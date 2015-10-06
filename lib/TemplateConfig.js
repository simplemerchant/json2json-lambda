'use strict';
// handle CommonJS/Node.js or browser
var TemplateConfig, sysmo,
  bind = function(fn, me) {
    return function() {
      return fn.apply(me, arguments);
    };
  };

sysmo = (typeof require === "function" ? require('sysmo') : void 0) || (typeof window !==
  "undefined" && window !== null ? window.Sysmo : void 0);

// class definition

TemplateConfig = (function() {
  function TemplateConfig(config) {
    this.applyFormatting = bind(this.applyFormatting, this);
    this.aggregate = bind(this.aggregate, this);
    this.processable = bind(this.processable, this);
    this.getValue = bind(this.getValue, this);
    this.getKey = bind(this.getKey, this);
    this.getPath = bind(this.getPath, this);
    // if there is no node path, set to current node
    config.path || (config.path = '.');
    // ensure 'as' template exists
    config.as || (config.as = {});
    // convert property name to array
    if (sysmo.isString(config.choose)) {
      config.choose = [config.choose];
    }
    // include multiple templates to apply before this one
    if (sysmo.isString(config.include)) {
      config.include = [config.include];
    }
    // create settings
    this.arrayToMap = !!config.key;
    this.mapToArray = !this.arrayToMap && config.key === false && !config.as;
    this.directMap = !!(this.arrayToMap && config.value);
    this.nestTemplate = !!config.nested;
    this.includeAll = !!config.all;
    this.config = config;
  }

  TemplateConfig.prototype.getPath = function() {
    return this.config.path;
  };

  // used to get a key when converting an array to a map
  TemplateConfig.prototype.getKey = function(node) {
    switch (sysmo.type(this.config.key)) {
      case 'Function':
        return {
          name: 'value',
          value: this.config.key(node)
        };
      default:
        return {
          name: 'path',
          value: this.config.key
        };
    }
  };

  // used to get a single value when converting an array to a map
  TemplateConfig.prototype.getValue = function(node, context) {
    switch (sysmo.type(this.config.value)) {
      case 'Function':
        return {
          name: 'value',
          value: this.config.value(node)
        };
      case 'String':
        return {
          name: 'path',
          value: this.config.value
        };
      default:
        return {
          name: 'template',
          value: this.config.as
        };
    }
  };

  // indicates if the key/value pair should be included in transformation
  TemplateConfig.prototype.processable = function(node, value, key) {
    var i, len, path, paths, ref;
    // no choose() implies all properties go,
    // but there are other properties that may cause filtering
    if (!this.config.choose && this.includeAll) {
      return true;
    }
    // convert array to chooser function that compares key names
    if (!this.config.choose && !this.paths) {
      this.paths = [];
      ref = this.config.as;
      for (key in ref) {
        value = ref[key];
        if (sysmo.isString(value)) {
          this.paths.push(value.split('.')[0]);
        }
      }
    }
    // create callback for arry
    if (sysmo.isArray(this.config.choose)) {
      paths = this.paths || [];
      paths = paths.concat(this.config.choose);
      for (i = 0, len = paths.length; i < len; i++) {
        path = paths[i];
        if (path.split('.')[0] === key) {
          return true;
        }
      }
      return false;
    }
    // if not a function yet, treat as boolean value
    if (!sysmo.isFunction(this.config.choose)) {
      // if config.key and config.value exist, most likely want to map all
      return !!(this.includeAll || this.directMap);
    } else {
      return !!this.config.choose.call(this, node, value, key);
    }
  };

  // used to combine or reduce a value if one already exists in the context.
  // can be a map that aggregates specific properties
  TemplateConfig.prototype.aggregate = function(context, key, value, existing) {
    var aggregator, ref;
    aggregator = ((ref = this.config.aggregate) != null ? ref[key] : void 0) || this.config
      .aggregate;
    if (!sysmo.isFunction(aggregator)) {
      return false;
    }
    context[key] = aggregator(key, value, existing);
    return true;
  };

  TemplateConfig.prototype.applyFormatting = function(node, value, key) {
    var formatter, pair, ref;
    // if key is a number, assume this is an array element and skip
    if (!sysmo.isNumber(key)) {
      formatter = ((ref = this.config.format) != null ? ref[key] : void 0) || this.config
        .format;
      pair = sysmo.isFunction(formatter) ? formatter(node, value, key) : {};
    } else {
      pair = {};
    }
    if (!('key' in pair)) {
      pair.key = key;
    }
    if (!('value' in pair)) {
      pair.value = value;
    }
    return pair;
  };

  return TemplateConfig;

})();

// register module (CommonJS/Node.js) or handle browser

if (typeof module !== "undefined" && module !== null) {
  module.exports = TemplateConfig;
} else {
  window.json2json || (window.json2json = {});
  window.json2json.TemplateConfig = TemplateConfig;
}
