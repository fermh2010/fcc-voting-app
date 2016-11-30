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

const providers = {
    allPolls: function(skip, limit) {
        return db.allPolls(skip, limit);
    },
    userPolls: function() {
        return db.userPolls('fer'); // TODO
    }
};

const formParser = require('body-parser').urlencoded({
    extended: false
});

// middleware
app.use('/static', express.static(staticPath));

// routes
app.get('/', function(req, res) {
    pages.index.render({
        providers: providers
    }, res);
});

app.get('/logout', function(req, res) {
    res.end('TODO');
});

app.get('/user-polls', function(req, res) {
    pages.userPolls.render({
        providers: providers
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

app.get('/polls/:pollId', function(req, res, next) {
    db.getPoll(req.params.pollId)
    .then(doc => {
        if(!doc) {
            return res.status(200).send('poll not found');
        } else {
            pages.poll.render({
                poll: doc
            }, res);
        }
    })
    .catch(err => {
        return next(err);
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
