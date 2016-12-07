'use strict';

/*eslint no-console: "off"*/

module.exports = function(pages, db) {
    const express = require('express');
    const router = express.Router();
    const bodyParser = require('body-parser');
    const formParser = bodyParser.urlencoded({
        extended: false
    });
    const ObjectID = require('mongodb').ObjectID;

    router.get('/user', function(req, res) {
        if(!req.session.user)
            return res.sendStatus(400); // TODO is this ok?

        const provider = new Promise((resolve, reject) => {
            const c = db.collection('polls');
            c.find({
                submittedBy: req.session.user._id
            })
            .toArray()
            .then(arr => {
                resolve(arr);
            })
            .catch(err => {
                reject(err);
            });
        });

        pages.renderUserPolls(res, { provider });
    });

    router.get('/new', function(req, res) {
        pages.renderNewPoll(res);
    });

    router.post('/new', formParser, function(req, res, next) {
        if(!req.body) {
            console.log('ERROR: empty body for POST /new-poll'); // TODO: use production logger
            return res.sendStatus(400);
        }

        if(!req.session.user)
            return res.sendStatus(400); // TODO is this ok?

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
        c.insertOne({
            title: pollTitle,
            options: pollOptions,
            submittedBy: req.session.user._id
        })
        .then(() => {
            return res.redirect('/polls/user');
        })
        .catch(err => {
            return next(err);
        });
    });

    router.get('/votes/:pollId', function(req, res) {
        const getPoll = new Promise((resolve, reject) => {
            const c = db.collection('polls');
            c.findOne({ _id: new ObjectID(req.params.pollId) })
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

        const provider = new Promise(function(resolve, reject) {
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
        });

        pages.renderPoll(res, { provider });
    });

    router.post('/votes/:pollId', formParser, function(req, res, next) {
        if(!req.body)
            return res.sendStatus(400);

        if(!req.session.user)
            return res.sendStatus(400); // TODO is this ok?

        const option = req.body['selected-option'];
        if(option) {
            const c = db.collection('votes');
            c.findOneAndReplace({
                user: req.session.user._id,
                poll: req.params.pollId
            }, {
                user: req.session.user._id,
                poll: req.params.pollId,
                option
            }, {
                upsert: true
            })
            .then(result => {
                if(!result.ok) {
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

    return router;
};
