const express = require('express');
const app = express();

require('lasso').configure('./lasso-config.json');

require('marko/node-require').install();
require('marko/compiler').defaultOptions.writeToDisk = false;
const pages = {
  index: require('./src/index.marko')
}

app.use('/static', express.static('static'));

app.get('/', function(req, res, next) {
  pages.index.render({}, res);
});

app.listen(process.env.PORT || 8080, function() {
  console.log('server up');
})
