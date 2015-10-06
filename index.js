try {
  module.exports = require('./compiled');
} catch (err) {
  module.exports = require('./lib/json2json');
}
