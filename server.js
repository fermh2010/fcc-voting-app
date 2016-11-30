'use strict';

const express = require('express');
const app = express();

const staticPath = "./client/static";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const MongoID = mongodb.ObjectID;
const mongoURI = 'mongodb://fermh2010:123456@ds035177.mlab.com:35177/fcc_challenges';

require('lasso').configure({
    "outputDir": staticPath,
    "fingerprintsEnabled": false,
    "minify": true,
    "resolveCssUrls": true,
    "bundlingEnabled": true,
    "plugins": [
      "lasso-sass"
    ]
});

require('marko/node-require').install();
require('marko/compiler').defaultOptions.writeToDisk = false;
const pages = {
  index: require('./client/index.marko'),
  newPoll: require('./client/new-poll.marko'),
  userPolls: require('./client/user-polls.marko'),
  poll: require('./client/poll.marko')
}

const providers = {
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
        })
      })
      .catch(err => {
        reject(err);
      });
    });
  },
  userPolls: function() {
    const currentUser = 'fer'; // TODO

    return new Promise(function(resolve, reject) {
      MongoClient.connect(mongoURI)
      .then(db => {
        const c = db.collection('polls');
        c.find({ user: currentUser })
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
  }
};

const formParser = require('body-parser').urlencoded({
  extended: false
});

// middleware
app.use('/static', express.static(staticPath));

// routes
app.get('/', function(req, res, next) {
  pages.index.render({
    providers: providers
  }, res);
});

app.get('/logout', function(req, res, next) {
  res.end('TODO');
});

app.get('/user-polls', function(req, res, next) {
  pages.userPolls.render({
    providers: providers
  }, res);
});

app.get('/new-poll', function(req, res, next) {
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

  MongoClient.connect(mongoURI)
  .then(function(db) {
    const c = db.collection('polls');
    c.insertOne({
      title: pollTitle,
      options: pollOptions,
      user: 'fer'
    })
    .then(function() {
      db.close();
      res.redirect('/user-polls');
    })
    .catch(function(err){
      db.close();
      return next(err);
    })
  })
  .catch(function(err) {
    return next(err);
  })
});

app.get('/polls/:pollId', function(req, res, next) {
  MongoClient.connect(mongoURI)
  .then(db => {
    const c = db.collection('polls');
    c.findOne({ _id: new MongoID(req.params.pollId) })
    .then(doc => {
      db.close();

      if(!doc) {
        return res.status(200).send('poll not found');
      } else {
        pages.poll.render({
          poll: doc
        }, res);
      }
    })
    .catch(err => {
      db.close();
      return next(err);
    });
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
    res.send('You selected ' + option);
  } else {
    res.sendStatus(400);
  }
});

app.listen(process.env.PORT || 8080, function() {
  console.log('server up');
})
