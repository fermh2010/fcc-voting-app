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
  index: require('./client/index.marko')
}

const providers = {
  polls: function() {
    return new Promise(function(resolve, reject) {
      resolve([ { title: 'Foo' }, { title: 'Bar'} ]);
    });
  }
};

const markoGlobals = {
  providers: providers
}

app.use('/static', express.static(staticPath));

app.get('/', function(req, res, next) {
  pages.index.render({
    $global: markoGlobals
  }, res);
});

app.get('/login', function(req, res, next) {
  res.end('TODO');
});

app.get('/user_polls', function(req, res, next) {
  res.end('TODO');
});

app.get('/new_poll', function(req, res, next) {
  res.end('TODO');
});

app.listen(process.env.PORT || 8080, function() {
  console.log('server up');
})
