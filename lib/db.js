const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const ObjectID = mongo.ObjectID;
const mongoURI = 'mongodb://fermh2010:123456@ds035177.mlab.com:35177/fcc_challenges';

module.exports = {
    allPolls: function(_skip, _limit) {
        return new Promise(function(resolve, reject) {
            const skip = _skip || 0;
            const limit = _limit || 10;
            MongoClient.connect(mongoURI)
            .then(db => {
                const c = db.collection('polls');
                c.find()
                .skip(skip)
                .limit(limit)
                .toArray()
                .then(arr => {
                    db.close();
                    resolve(arr);
                })
                .catch(err => {
                    db.close();
                    reject(err);
                });
            })
            .catch(err => {
                reject(err);
            });
        });
    },

    userPolls: function(user) {
        return new Promise(function(resolve, reject) {
            MongoClient.connect(mongoURI)
            .then(db => {
                const c = db.collection('polls');
                c.find({ submittedBy: user })
                .toArray()
                .then(arr => {
                    db.close();
                    resolve(arr);
                })
                .catch(err => {
                    db.close();
                    reject(err);
                });
            })
            .catch(err => {
                reject(err);
            });
        });
    },

    createPoll: function(title, options, submittedBy) {
        return new Promise(function(resolve, reject) {
            MongoClient.connect(mongoURI)
            .then(function(db) {
                const c = db.collection('polls');
                c.insertOne({ title, options, submittedBy })
                .then(() => {
                    db.close();
                    resolve();
                })
                .catch(err => {
                    db.close();
                    reject(err);
                });
            })
            .catch(err => {
                reject(err);
            });
        });
    },

    getPoll: function(pollId) {
        return new Promise(function(resolve, reject) {
            MongoClient.connect(mongoURI)
            .then(db => {
                const c = db.collection('polls');
                c.findOne({ _id: new ObjectID(pollId) })
                .then(doc => {
                    db.close();
                    resolve(doc);
                })
                .catch(err => {
                    db.close();
                    reject(err);
                });
            })
            .catch(err => {
                reject(err);
            });
        });
    },

    submitVote: function(pollId, option, user) {
        return new Promise(function(resolve, reject) {
            MongoClient.connect(mongoURI)
            .then(db => {
                const c = db.collection('votes');
                c.updateOne(
                  { user, poll: pollId },
                  { user, poll: pollId, option },
                  { upsert: true })
                .then(result => {
                    db.close();
                    resolve(result.result.ok);
                })
                .catch(err => {
                    db.close();
                    reject(err);
                });
            })
            .catch(err => {
                reject(err);
            });
        });
    }
};
