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
  userPolls: require('./client/user-polls.marko')
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

app.use('/static', express.static(staticPath));

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

app.listen(process.env.PORT || 8080, function() {
  console.log('server up');
})
