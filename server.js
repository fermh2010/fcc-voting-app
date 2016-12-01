'use strict';

/*eslint no-console: "off"*/

const express = require('express');
const app = express();
const db = require('./lib/db.js');

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

require('marko/node-require').install();
require('marko/compiler').defaultOptions.writeToDisk = false;
const pages = {
    index: require('./client/index.marko'),
    newPoll: require('./client/new-poll.marko'),
    userPolls: require('./client/user-polls.marko'),
    poll: require('./client/poll.marko')
};

const formParser = require('body-parser').urlencoded({
    extended: false
});

// middleware
app.use('/static', express.static(staticPath));

// routes
app.get('/', function(req, res) {
    pages.index.render({
        provider: db.allPolls()
    }, res);
});

app.get('/logout', function(req, res) {
    res.end('TODO');
});

app.get('/user-polls', function(req, res) {
    pages.userPolls.render({
        provider: db.userPolls('fer')
    }, res);
});

app.get('/new-poll', function(req, res) {
    pages.newPoll.render({}, res);
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

    db.createPoll(pollTitle, pollOptions, 'fer')
    .then(() => {
        res.redirect('/user-polls');
    })
    .catch(err => {
        return next(err);
    });
});

app.get('/polls/:pollId', function(req, res) {
    pages.poll.render({
        provider: new Promise(function(resolve, reject) {
            Promise.all([
                db.getPoll(req.params.pollId),
                db.getPollVotes(req.params.pollId)
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
    }, res);
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
