const express = require('express');
const app = express();

const staticPath = "./client/static";

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
  allPolls: function() {
    return new Promise(function(resolve, reject) {
      resolve([ { title: 'Foo' }, { title: 'Bar'}, { title: 'Baz' } ]);
    });
  },
  userPolls: function() {
    return new Promise(function(resolve, reject) {
      resolve([ { title: 'asd' }, { title: 'qwe'}, { title: 'zxc' } ]);
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

app.post('/new-poll', function(req, res, next) {
  res.end('TODO');
});

app.get('/polls/:pollId', function(req, res, next) {
  const pollId = Number(req.params.pollId);
  if(isNaN(pollId)) {
    return next(new Error('invalid poll id'));
  }

  const poll = {
    title: 'aasdasdasd asda sa sdasd?',
    options: [
      'option1',
      'option2',
      'option3'
    ]
  };

  pages.poll.render({
    poll: poll
  }, res);
});

app.post('/polls/:pollId', formParser, function(req, res, next) {
  if(!req.body)
    res.sendStatus(400);

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
