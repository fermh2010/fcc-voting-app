'use strict';

/*eslint no-console: "off"*/

// init environment variables in .env file
require('dotenv').config();

const express = require('express');
const app = express();
//const http = require('http');
const https = require('https');
const concat = require('concat-stream');

const staticPath = './client/static';

const fbApp = {
    id: '702963836530548',
    secret: 'e8fa530bfe8b6e700cd116a144db393a'
};

const redisURI = process.env.REDIS_URI;
if(!redisURI)
    throw new Error('redis URI not set in REDIS_URI environment variable');

const mongoURI = process.env.MONGODB_URI;
if(!mongoURI)
    throw new Error('mongo URI not set in MONGODB_URI environment variable');

const mongo = require('mongodb');

require('lasso').configure({
    'outputDir': staticPath,
    'fingerprintsEnabled': false,
    'minify': true,
    'resolveCssUrls': true,
    'bundlingEnabled': true,
    'plugins': [
        'lasso-sass'
    ]
});

require('marko/express'); //enable res.marko
require('marko/node-require').install();
require('marko/compiler').defaultOptions.writeToDisk = false;
const pages = {
    index: require('./client/index.marko'),
    newPoll: require('./client/new-poll.marko'),
    userPolls: require('./client/user-polls.marko'),
    poll: require('./client/poll.marko')
};

// initialization
Promise.all([
    mongo.MongoClient.connect(mongoURI)
])
.then(values => {
    const db = values[0];

    // static assets middleware
    app.use('/static', express.static(staticPath));

    // session middleware
    const session = require('express-session');
    const RedisStore = require('connect-redis')(session);
    const redisClient = require('redis').createClient(redisURI);
    app.use(session({
        store: new RedisStore({
            client: redisClient
        }),
        name: 's',
        secret: 'abcdefg123456',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 3600 * 24
        }
    }));

    // helmet middleware
    if(process.env.NODE_ENV === 'production') {
        const helmet = require('helmet');
        app.use(helmet.hidePoweredBy());
        app.use(helmet.dnsPrefetchControl());
        app.use(helmet.frameguard());
        app.use(helmet.ieNoOpen());
        app.use(helmet.noSniff());
        app.use(helmet.xssFilter());
    }

    // routes
    const bodyParser = require('body-parser');
    const formParser = bodyParser.urlencoded({
        extended: false
    });

    app.get('/login', function(req, res) {
        res.type('html');
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                </head>
                <body>
                    <ul>
                        <li> <a href='/loginfb'>Login with Facebook</a> </li>
                        <li> <a href='/logintw'>Login with Twitter</a> </li>
                    </ul>
                </body>
            </html>
            `);
    });

    app.get('/loginfb', function(req, res) {
        const redirectURL = 'http://localhost:8080/loginfb2'; // TODO: read host
        const fbUrl = 'https://www.facebook.com/v2.8/dialog/oauth'
            + `?client_id=${fbApp.id}`
            + `&redirect_uri=${redirectURL}`;
        res.redirect(fbUrl);
    });

    app.get('/loginfb2', function(req, res, next) { // read auth code from url and request access token
        const authCode = req.query.code;
        if(!authCode)
            return res.redirect('/'); // TODO: show 'flash' message or similar

        const redirectURL = 'http://localhost:8080/loginfb2'; // TODO: read host

        const fbUrl = 'https://graph.facebook.com/v2.8/oauth/access_token'
            + `?client_id=${fbApp.id}`
            + `&client_secret=${fbApp.secret}`
            + `&redirect_uri=${redirectURL}`
            + `&code=${authCode}`;

        https.get(fbUrl, r => {
            r.on('error', err => {
                next(err);
            });
            r.pipe(concat(data => {
                try {
                    const parsed = JSON.parse(data);
                    const token = parsed['access_token'];
                    if(!token)
                        next(new Error('access token missing from facebook login response'));

                    res.locals.fbToken = token;
                    next();
                } catch(err) {
                    return next(err);
                }
            }));
        });
    }, function(req, res, next) { // use facebook user access token to retrieve its unique user id
        https.get(`https://graph.facebook.com/me?access_token=${res.locals.fbToken}`, r => {
            r.on('error', err => {
                next(err);
            });
            r.pipe(concat(data => {
                try {
                    const parsed = JSON.parse(data);
                    const userID = parsed['id'];
                    const userDoc = {
                        facebook: userID
                    };

                    const c = db.collection('users');
                    c.findOneAndUpdate(userDoc, userDoc, {
                        upsert: true,
                        returnOriginal: false
                    })
                    .then(result => {
                        req.session.user = result.value;
                        res.redirect('/');
                    })
                    .catch(err => {
                        next(err);
                    });
                } catch(err) {
                    return next(err);
                }
            }));
        });
    });

    app.get('/', function(req, res) {
        res.type('html');

        const skip = req.query.skip || 0;
        const limit = req.query.limit || 10;
        const provider = new Promise((resolve, reject) => {
            const c = db.collection('polls');
            c.find()
            .skip(skip)
            .limit(limit)
            .toArray()
            .then(arr => {
                resolve(arr);
            })
            .catch(err => {
                reject(err);
            });
        });

        res.marko(pages.index, {
            provider
        });
    });

    app.get('/logout', function(req, res) {
        req.session.destroy(err => {
            if(err)
                console.log(err);
            res.redirect('/');
        });
    });

    app.get('/user-polls', function(req, res) {
        res.type('html');

        const provider = new Promise((resolve, reject) => {
            const c = db.collection('polls');
            c.find({ submittedBy: 'fer' }) // TODO real user
            .toArray()
            .then(arr => {
                resolve(arr);
            })
            .catch(err => {
                reject(err);
            });
        });

        res.marko(pages.userPolls, { provider });
    });

    app.get('/new-poll', function(req, res) {
        res.type('html');

        res.marko(pages.newPoll);
    });

    app.post('/new-poll', formParser, function(req, res, next) {
        if(!req.body) {
            console.log('ERROR: empty body for POST /new-poll'); // TODO: use production logger
            return res.sendStatus(400);
        }

        const pollTitle = req.body['poll-title'];
        const pollOptionsRaw = req.body['poll-options'];
        if(!pollTitle || !pollOptionsRaw) {
            console.log('ERROR: invalid parameters for POST /new-poll'); // TODO: use production logger
            return res.sendStatus(400);
        } else if(pollTitle.length == 0 || pollOptionsRaw.length == 0) {
            console.log('ERROR: empty parameters for POST /new-poll'); // TODO: use production logger
            return res.sendStatus(400);
        }

        const pollOptions = pollOptionsRaw.split(',').map(function(option) {
            return option.trim();
        });

        const c = db.collection('polls');
        c.insertOne({ pollTitle, pollOptions, submittedBy: 'fer' }) // TODO real user
        .then(() => {
            return res.redirect('/user-polls');
        })
        .catch(err => {
            return next(err);
        });
    });

    app.get('/polls/:pollId', function(req, res) {
        res.type('html');

        const getPoll = new Promise((resolve, reject) => {
            const c = db.collection('polls');
            c.findOne({ _id: new mongo.ObjectID(req.params.pollId) })
            .then(doc => {
                resolve(doc);
            })
            .catch(err => {
                reject(err);
            });
        });

        const getPollVotes = new Promise((resolve, reject) => {
            const c = db.collection('votes');
            const p = [
                { $match: { poll: req.params.pollId } },
                { $group: { _id: '$option', total: { $sum: 1 } } },
                { $project: { option: '$_id', _id: 0, total: 1 } }
            ];

            c.aggregate(p)
            .toArray()
            .then(arr => {
                resolve(arr);
            })
            .catch(err => {
                reject(err);
            });
        });

        res.marko(pages.poll, {
            provider: new Promise(function(resolve, reject) {
                Promise.all([
                    getPoll,
                    getPollVotes
                ])
                .then(values => {
                    const poll = values[0];
                    const votes = values[1];
                    const merged = {};
                    for(let option of poll.options)
                        merged[option] = 0;
                    for(let vote of votes)
                        merged[vote.option] = vote.total;

                    resolve({
                        pollTitle: poll.title,
                        pollOptionsVotes: poll.options,
                        pollCreator: poll.submittedBy,
                        pollResults: merged,
                        userCurrentVote: undefined
                    });
                })
                .catch(err => {
                    reject(err);
                });
            })
        });
    });

    app.post('/polls/:pollId', formParser, function(req, res, next) {
        if(!req.body)
            return res.sendStatus(400);

        const option = req.body['selected-option'];
        if(option) {
            db.submitVote(req.params.pollId, option, 'fer') // TODO: user
            .then(success => {
                if(!success) {
                    return res.status(500).send('could not submit vote');
                } else {
                    res.redirect('back');
                }
            })
            .catch(err => {
                return next(err);
            });
        } else {
            res.sendStatus(400);
        }
    });

    app.listen(process.env.PORT || 8080, function() {
        console.log('server up');
    });
})
.catch(err => {
    console.log(err.message);
});
/**
 * - handle errors properly
 * - group route handlers into separate files
 */
