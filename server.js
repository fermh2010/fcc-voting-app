'use strict';

/*eslint no-console: "off"*/

// init environment variables in .env file
require('dotenv').config();

const express = require('express');
const app = express();

const staticPath = './client/static';

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

require('marko/express'); // enable res.marko
require('marko/node-require').install();
require('marko/compiler').defaultOptions.writeToDisk = false;

const templates = {
    index: require('./client/index.marko'),
    newPoll: require('./client/new-poll.marko'),
    userPolls: require('./client/user-polls.marko'),
    poll: require('./client/poll.marko')
};

const pages = {
    renderIndex: function(res, data) {
        res.marko(templates.index, data);
    },
    renderNewPoll: function(res, data) {
        res.marko(templates.newPoll, data);
    },
    renderUserPolls: function(res, data) {
        res.marko(templates.userPolls, data);
    },
    renderPoll: function(res, data) {
        res.marko(templates.poll, data);
    },
};

const redisURI = process.env.REDIS_URI;
if(!redisURI)
    throw new Error('redis URI not set in REDIS_URI environment variable');

const mongoURI = process.env.MONGODB_URI;
if(!mongoURI)
    throw new Error('mongo URI not set in MONGODB_URI environment variable');

const mongo = require('mongodb');

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
        secret: '16026ffa8d635073d6b11a00e9bb2d71bb8aa63c',
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
    app.get('/', function(req, res) {
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

        pages.renderIndex(res, { provider });
    });

    const loginRouter = require('./lib/auth.js')(pages, db);
    app.use('/auth', loginRouter);

    const pollsRouter = require('./lib/polls.js')(pages, db);
    app.use('/polls', pollsRouter);

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
 * - use marko custom tags for components?
 * - proper http verbs for some routes
 */
