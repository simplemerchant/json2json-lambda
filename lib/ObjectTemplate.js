// handle CommonJS/Node.js or browser
var ObjectTemplate, TemplateConfig, sysmo,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

sysmo = (typeof require === "function" ? require('sysmo') : void 0) || (typeof window !== "undefined" && window !== null ? window.Sysmo : void 0);

TemplateConfig = (typeof require === "function" ? require('./TemplateConfig') : void 0) || (typeof window !== "undefined" && window !== null ? window.json2json.TemplateConfig : void 0);

// class definition

ObjectTemplate = (function() {
  function ObjectTemplate(config, parent) {
    this.paths = bind(this.paths, this);
    this.pathAccessed = bind(this.pathAccessed, this);
    this.getNode = bind(this.getNode, this);
    this.nodeToProcess = bind(this.nodeToProcess, this);
    this.aggregateValue = bind(this.aggregateValue, this);
    this.updateContext = bind(this.updateContext, this);
    this.processRemaining = bind(this.processRemaining, this);
    this.processTemplate = bind(this.processTemplate, this);
    this.chooseValue = bind(this.chooseValue, this);
    this.chooseKey = bind(this.chooseKey, this);
    this.createMapStructure = bind(this.createMapStructure, this);
    this.processMap = bind(this.processMap, this);
    this.processArray = bind(this.processArray, this);
    this.transform = bind(this.transform, this);
    this.config = new TemplateConfig(config);
    this.parent = parent;
  }

  ObjectTemplate.prototype.transform = function(data) {
    var node;
    node = this.nodeToProcess(data);
    if (node == null) {
      return null;
    }
    // process properties
    switch (sysmo.type(node)) {
      case 'Array':
        return this.processArray(node);
      case 'Object':
        return this.processMap(node);
      default:
        return null;
    }
  };

  // assume each array element is a map
  ObjectTemplate.prototype.processArray = function(node) {
    var context, element, i, index, key, len, value;
    // convert array to hash if config.arrayToMap is true
    context = this.config.arrayToMap ? {} : [];
    for (index = i = 0, len = node.length; i < len; index = ++i) {
      // when @config.processable node, element, index
      // convert the index to a key if converting array to map
      // @updateContext handles the context type automatically
      element = node[index];
      key = this.config.arrayToMap ? this.chooseKey(element) : index;
      // don't call @processMap because it can lead to double nesting if @config.nestTemplate is true
      value = this.createMapStructure(element);
      this.updateContext(context, element, value, key);
    }
    return context;
  };

  ObjectTemplate.prototype.processMap = function(node) {
    var context, nested_context, nested_key;
    context = this.createMapStructure(node);
    if (this.config.nestTemplate && (nested_key = this.chooseKey(node))) {
      nested_context = {};
      nested_context[nested_key] = context;
      context = nested_context;
    }
    return context;
  };

  ObjectTemplate.prototype.createMapStructure = function(node) {
    var context, key, nested, value;
    context = {};
    if (!this.config.nestTemplate) {
      return this.chooseValue(node, context);
    }
    // loop through properties to pick up any key/values that should be nested
    for (key in node) {
      value = node[key];
      if (!(this.config.processable(node, value, key))) {
        continue;
      }
      // call @getNode() to register the use of the property on that node
      nested = this.getNode(node, key);
      value = this.chooseValue(nested);
      this.updateContext(context, nested, value, key);
    }
    return context;
  };

  ObjectTemplate.prototype.chooseKey = function(node) {
    var result;
    result = this.config.getKey(node);
    switch (result.name) {
      case 'value':
        return result.value;
      case 'path':
        return this.getNode(node, result.value);
      default:
        return null;
    }
  };

  ObjectTemplate.prototype.chooseValue = function(node, context) {
    var result;
    if (context == null) {
      context = {};
    }
    result = this.config.getValue(node);
    switch (result.name) {
      case 'value':
        return result.value;
      case 'path':
        return this.getNode(node, result.value);
      case 'template':
        return this.processTemplate(node, context, result.value);
      default:
        return null;
    }
  };

  ObjectTemplate.prototype.processTemplate = function(node, context, template) {
    var filter, key, value;
    if (template == null) {
      template = {};
    }
    // loop through properties in template
    for (key in template) {
      // process mapping instructions
      value = template[key];
      switch (sysmo.type(value)) {
        // string should be the path to a property on the current node
        case 'String':
          filter = (function(_this) {
            return function(node, path) {
              return _this.getNode(node, path);
            };
          })(this);
          break;
        // array gets multiple property values
        case 'Array':
          filter = (function(_this) {
            return function(node, paths) {
              var i, len, path, results;
              results = [];
              for (i = 0, len = paths.length; i < len; i++) {
                path = paths[i];
                results.push(_this.getNode(node, path));
              }
              return results;
            };
          })(this);
          break;
        // function is a custom filter for the node
        case 'Function':
          filter = (function(_this) {
            return function(node, value) {
              return value.call(_this, node, key);
            };
          })(this);
          break;
        case 'Object':
          filter = (function(_this) {
            return function(node, config) {
              return new _this.constructor(config, _this).transform(node);
            };
          })(this);
          break;
        default:
          filter = function(node, value) {
            return value;
          };
      }
      value = filter(node, value);
      this.updateContext(context, node, value, key);
    }
    this.processRemaining(context, node);
    return context;
  };

  ObjectTemplate.prototype.processRemaining = function(context, node) {
    var key, value;
    // loop through properties to pick up any key/values that should be chosen.
    // skip if node property already used, the property was specified by the template, or it should not be choose.
    for (key in node) {
      value = node[key];
      if (!this.pathAccessed(node, key) && indexOf.call(context, key) < 0 && this.config.processable(node, value, key)) {
        this.updateContext(context, node, value, key);
      }
    }
    return context;
  };

  ObjectTemplate.prototype.updateContext = function(context, node, value, key) {
    var formatted, i, item, len, results;
    // format key and value
    formatted = this.config.applyFormatting(node, value, key);
    if (sysmo.isArray(formatted)) {
      results = [];
      for (i = 0, len = formatted.length; i < len; i++) {
        item = formatted[i];
        results.push(this.aggregateValue(context, item.key, item.value));
      }
      return results;
    } else if (formatted != null) {
      return this.aggregateValue(context, formatted.key, formatted.value);
    }
  };

  ObjectTemplate.prototype.aggregateValue = function(context, key, value) {
    var existing;
    if (value == null) {
      return context;
    }
    // if context is an array, just add the value
    if (sysmo.isArray(context)) {
      context.push(value);
      return context;
    }
    existing = context[key];
    if (this.config.aggregate(context, key, value, existing)) {
      return context;
    }
    if (existing == null) {
      context[key] = value;
    } else if (!sysmo.isArray(existing)) {
      context[key] = [existing, value];
    } else {
      context[key].push(value);
    }
    return context;
  };

  ObjectTemplate.prototype.nodeToProcess = function(node) {
    return this.getNode(node, this.config.getPath());
  };

  ObjectTemplate.prototype.getNode = function(node, path) {
    if (!path) {
      return null;
    }
    if (path === '.') {
      return node;
    }
    this.paths(node, path);
    return sysmo.getDeepValue(node, path, true);
  };

  ObjectTemplate.prototype.pathAccessed = function(node, path) {
    var key;
    key = path.split('.')[0];
    return this.paths(node).indexOf(key) !== -1;
  };

  // track the first property in a path for each node through object tree
  ObjectTemplate.prototype.paths = function(node, path) {
    var index, paths;
    if (path) {
      path = path.split('.')[0];
    }
    this.pathNodes || (this.pathNodes = this.parent && this.parent.pathNodes || []);
    this.pathCache || (this.pathCache = this.parent && this.parent.pathCache || []);
    index = this.pathNodes.indexOf(node);
    if (!path) {
      return (index !== -1 ? this.pathCache[index] : []);
    }
    if (index === -1) {
      paths = [];
      this.pathNodes.push(node);
      this.pathCache.push(paths);
    } else {
      paths = this.pathCache[index];
    }
    if (path && paths.indexOf(path) === -1) {
      paths.push(path);
    }
    return paths;
  };

  return ObjectTemplate;

})();

// register module (CommonJS/Node.js) or handle browser

if (typeof module !== "undefined" && module !== null) {
  module.exports = ObjectTemplate;
} else {
  window.json2json || (window.json2json = {});
  window.json2json.ObjectTemplate = ObjectTemplate;
}
