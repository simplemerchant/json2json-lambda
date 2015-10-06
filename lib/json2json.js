'use strict';
// load modules in CommonJS/Node.js environment, not needed in browser

if ((typeof exports !== "undefined" && exports !== null) && (typeof require !== "undefined" &&
    require !== null)) {
  exports.ObjectTemplate = require('./ObjectTemplate');
  exports.TemplateConfig = require('./TemplateConfig');
} else if (typeof window !== "undefined" && window !== null) {
  window.json2json = {};
}
