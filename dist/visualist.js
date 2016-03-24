(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g._v = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');

},{"./lib/parse":2,"./lib/stringify":6}],2:[function(require,module,exports){
// http://www.w3.org/TR/CSS21/grammar.html
// https://github.com/visionmedia/css-parse/pull/49#issuecomment-30088027
var commentre = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g

module.exports = function(css, options){
  options = options || {};

  /**
   * Positional.
   */

  var lineno = 1;
  var column = 1;

  /**
   * Update lineno and column based on `str`.
   */

  function updatePosition(str) {
    var lines = str.match(/\n/g);
    if (lines) lineno += lines.length;
    var i = str.lastIndexOf('\n');
    column = ~i ? str.length - i : column + str.length;
  }

  /**
   * Mark position and patch `node.position`.
   */

  function position() {
    var start = { line: lineno, column: column };
    return function(node){
      node.position = new Position(start);
      whitespace();
      return node;
    };
  }

  /**
   * Store position information for a node
   */

  function Position(start) {
    this.start = start;
    this.end = { line: lineno, column: column };
    this.source = options.source;
  }

  /**
   * Non-enumerable source string
   */

  Position.prototype.content = css;

  /**
   * Error `msg`.
   */

  var errorsList = [];

  function error(msg) {
    var err = new Error(options.source + ':' + lineno + ':' + column + ': ' + msg);
    err.reason = msg;
    err.filename = options.source;
    err.line = lineno;
    err.column = column;
    err.source = css;

    if (options.silent) {
      errorsList.push(err);
    } else {
      throw err;
    }
  }

  /**
   * Parse stylesheet.
   */

  function stylesheet() {
    var rulesList = rules();

    return {
      type: 'stylesheet',
      stylesheet: {
        rules: rulesList,
        parsingErrors: errorsList
      }
    };
  }

  /**
   * Opening brace.
   */

  function open() {
    return match(/^{\s*/);
  }

  /**
   * Closing brace.
   */

  function close() {
    return match(/^}/);
  }

  /**
   * Parse ruleset.
   */

  function rules() {
    var node;
    var rules = [];
    whitespace();
    comments(rules);
    while (css.length && css.charAt(0) != '}' && (node = atrule() || rule())) {
      if (node !== false) {
        rules.push(node);
        comments(rules);
      }
    }
    return rules;
  }

  /**
   * Match `re` and return captures.
   */

  function match(re) {
    var m = re.exec(css);
    if (!m) return;
    var str = m[0];
    updatePosition(str);
    css = css.slice(str.length);
    return m;
  }

  /**
   * Parse whitespace.
   */

  function whitespace() {
    match(/^\s*/);
  }

  /**
   * Parse comments;
   */

  function comments(rules) {
    var c;
    rules = rules || [];
    while (c = comment()) {
      if (c !== false) {
        rules.push(c);
      }
    }
    return rules;
  }

  /**
   * Parse comment.
   */

  function comment() {
    var pos = position();
    if ('/' != css.charAt(0) || '*' != css.charAt(1)) return;

    var i = 2;
    while ("" != css.charAt(i) && ('*' != css.charAt(i) || '/' != css.charAt(i + 1))) ++i;
    i += 2;

    if ("" === css.charAt(i-1)) {
      return error('End of comment missing');
    }

    var str = css.slice(2, i - 2);
    column += 2;
    updatePosition(str);
    css = css.slice(i);
    column += 2;

    return pos({
      type: 'comment',
      comment: str
    });
  }

  /**
   * Parse selector.
   */

  function selector() {
    var m = match(/^([^{]+)/);
    if (!m) return;
    /* @fix Remove all comments from selectors
     * http://ostermiller.org/findcomment.html */
    return trim(m[0])
      .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
      .replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function(m) {
        return m.replace(/,/g, '\u200C');
      })
      .split(/\s*(?![^(]*\)),\s*/)
      .map(function(s) {
        return s.replace(/\u200C/g, ',');
      });
  }

  /**
   * Parse declaration.
   */

  function declaration() {
    var pos = position();

    // prop
    var prop = match(/^(\*?[-#\/\*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
    if (!prop) return;
    prop = trim(prop[0]);

    // :
    if (!match(/^:\s*/)) return error("property missing ':'");

    // val
    var val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)/);

    var ret = pos({
      type: 'declaration',
      property: prop.replace(commentre, ''),
      value: val ? trim(val[0]).replace(commentre, '') : ''
    });

    // ;
    match(/^[;\s]*/);

    return ret;
  }

  /**
   * Parse declarations.
   */

  function declarations() {
    var decls = [];

    if (!open()) return error("missing '{'");
    comments(decls);

    // declarations
    var decl;
    while (decl = declaration()) {
      if (decl !== false) {
        decls.push(decl);
        comments(decls);
      }
    }

    if (!close()) return error("missing '}'");
    return decls;
  }

  /**
   * Parse keyframe.
   */

  function keyframe() {
    var m;
    var vals = [];
    var pos = position();

    while (m = match(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/)) {
      vals.push(m[1]);
      match(/^,\s*/);
    }

    if (!vals.length) return;

    return pos({
      type: 'keyframe',
      values: vals,
      declarations: declarations()
    });
  }

  /**
   * Parse keyframes.
   */

  function atkeyframes() {
    var pos = position();
    var m = match(/^@([-\w]+)?keyframes\s*/);

    if (!m) return;
    var vendor = m[1];

    // identifier
    var m = match(/^([-\w]+)\s*/);
    if (!m) return error("@keyframes missing name");
    var name = m[1];

    if (!open()) return error("@keyframes missing '{'");

    var frame;
    var frames = comments();
    while (frame = keyframe()) {
      frames.push(frame);
      frames = frames.concat(comments());
    }

    if (!close()) return error("@keyframes missing '}'");

    return pos({
      type: 'keyframes',
      name: name,
      vendor: vendor,
      keyframes: frames
    });
  }

  /**
   * Parse supports.
   */

  function atsupports() {
    var pos = position();
    var m = match(/^@supports *([^{]+)/);

    if (!m) return;
    var supports = trim(m[1]);

    if (!open()) return error("@supports missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@supports missing '}'");

    return pos({
      type: 'supports',
      supports: supports,
      rules: style
    });
  }

  /**
   * Parse host.
   */

  function athost() {
    var pos = position();
    var m = match(/^@host\s*/);

    if (!m) return;

    if (!open()) return error("@host missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@host missing '}'");

    return pos({
      type: 'host',
      rules: style
    });
  }

  /**
   * Parse media.
   */

  function atmedia() {
    var pos = position();
    var m = match(/^@media *([^{]+)/);

    if (!m) return;
    var media = trim(m[1]);

    if (!open()) return error("@media missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@media missing '}'");

    return pos({
      type: 'media',
      media: media,
      rules: style
    });
  }


  /**
   * Parse custom-media.
   */

  function atcustommedia() {
    var pos = position();
    var m = match(/^@custom-media\s+(--[^\s]+)\s*([^{;]+);/);
    if (!m) return;

    return pos({
      type: 'custom-media',
      name: trim(m[1]),
      media: trim(m[2])
    });
  }

  /**
   * Parse paged media.
   */

  function atpage() {
    var pos = position();
    var m = match(/^@page */);
    if (!m) return;

    var sel = selector() || [];

    if (!open()) return error("@page missing '{'");
    var decls = comments();

    // declarations
    var decl;
    while (decl = declaration()) {
      decls.push(decl);
      decls = decls.concat(comments());
    }

    if (!close()) return error("@page missing '}'");

    return pos({
      type: 'page',
      selectors: sel,
      declarations: decls
    });
  }

  /**
   * Parse document.
   */

  function atdocument() {
    var pos = position();
    var m = match(/^@([-\w]+)?document *([^{]+)/);
    if (!m) return;

    var vendor = trim(m[1]);
    var doc = trim(m[2]);

    if (!open()) return error("@document missing '{'");

    var style = comments().concat(rules());

    if (!close()) return error("@document missing '}'");

    return pos({
      type: 'document',
      document: doc,
      vendor: vendor,
      rules: style
    });
  }

  /**
   * Parse font-face.
   */

  function atfontface() {
    var pos = position();
    var m = match(/^@font-face\s*/);
    if (!m) return;

    if (!open()) return error("@font-face missing '{'");
    var decls = comments();

    // declarations
    var decl;
    while (decl = declaration()) {
      decls.push(decl);
      decls = decls.concat(comments());
    }

    if (!close()) return error("@font-face missing '}'");

    return pos({
      type: 'font-face',
      declarations: decls
    });
  }

  /**
   * Parse import
   */

  var atimport = _compileAtrule('import');

  /**
   * Parse charset
   */

  var atcharset = _compileAtrule('charset');

  /**
   * Parse namespace
   */

  var atnamespace = _compileAtrule('namespace');

  /**
   * Parse non-block at-rules
   */


  function _compileAtrule(name) {
    var re = new RegExp('^@' + name + '\\s*([^;]+);');
    return function() {
      var pos = position();
      var m = match(re);
      if (!m) return;
      var ret = { type: name };
      ret[name] = m[1].trim();
      return pos(ret);
    }
  }

  /**
   * Parse at rule.
   */

  function atrule() {
    if (css[0] != '@') return;

    return atkeyframes()
      || atmedia()
      || atcustommedia()
      || atsupports()
      || atimport()
      || atcharset()
      || atnamespace()
      || atdocument()
      || atpage()
      || athost()
      || atfontface();
  }

  /**
   * Parse rule.
   */

  function rule() {
    var pos = position();
    var sel = selector();

    if (!sel) return error('selector missing');
    comments();

    return pos({
      type: 'rule',
      selectors: sel,
      declarations: declarations()
    });
  }

  return addParent(stylesheet());
};

/**
 * Trim `str`.
 */

function trim(str) {
  return str ? str.replace(/^\s+|\s+$/g, '') : '';
}

/**
 * Adds non-enumerable parent node reference to each node.
 */

function addParent(obj, parent) {
  var isNode = obj && typeof obj.type === 'string';
  var childParent = isNode ? obj : parent;

  for (var k in obj) {
    var value = obj[k];
    if (Array.isArray(value)) {
      value.forEach(function(v) { addParent(v, childParent); });
    } else if (value && typeof value === 'object') {
      addParent(value, childParent);
    }
  }

  if (isNode) {
    Object.defineProperty(obj, 'parent', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: parent || null
    });
  }

  return obj;
}

},{}],3:[function(require,module,exports){

/**
 * Expose `Compiler`.
 */

module.exports = Compiler;

/**
 * Initialize a compiler.
 *
 * @param {Type} name
 * @return {Type}
 * @api public
 */

function Compiler(opts) {
  this.options = opts || {};
}

/**
 * Emit `str`
 */

Compiler.prototype.emit = function(str) {
  return str;
};

/**
 * Visit `node`.
 */

Compiler.prototype.visit = function(node){
  return this[node.type](node);
};

/**
 * Map visit over array of `nodes`, optionally using a `delim`
 */

Compiler.prototype.mapVisit = function(nodes, delim){
  var buf = '';
  delim = delim || '';

  for (var i = 0, length = nodes.length; i < length; i++) {
    buf += this.visit(nodes[i]);
    if (delim && i < length - 1) buf += this.emit(delim);
  }

  return buf;
};

},{}],4:[function(require,module,exports){

/**
 * Module dependencies.
 */

var Base = require('./compiler');
var inherits = require('inherits');

/**
 * Expose compiler.
 */

module.exports = Compiler;

/**
 * Initialize a new `Compiler`.
 */

function Compiler(options) {
  Base.call(this, options);
}

/**
 * Inherit from `Base.prototype`.
 */

inherits(Compiler, Base);

/**
 * Compile `node`.
 */

Compiler.prototype.compile = function(node){
  return node.stylesheet
    .rules.map(this.visit, this)
    .join('');
};

/**
 * Visit comment node.
 */

Compiler.prototype.comment = function(node){
  return this.emit('', node.position);
};

/**
 * Visit import node.
 */

Compiler.prototype.import = function(node){
  return this.emit('@import ' + node.import + ';', node.position);
};

/**
 * Visit media node.
 */

Compiler.prototype.media = function(node){
  return this.emit('@media ' + node.media, node.position)
    + this.emit('{')
    + this.mapVisit(node.rules)
    + this.emit('}');
};

/**
 * Visit document node.
 */

Compiler.prototype.document = function(node){
  var doc = '@' + (node.vendor || '') + 'document ' + node.document;

  return this.emit(doc, node.position)
    + this.emit('{')
    + this.mapVisit(node.rules)
    + this.emit('}');
};

/**
 * Visit charset node.
 */

Compiler.prototype.charset = function(node){
  return this.emit('@charset ' + node.charset + ';', node.position);
};

/**
 * Visit namespace node.
 */

Compiler.prototype.namespace = function(node){
  return this.emit('@namespace ' + node.namespace + ';', node.position);
};

/**
 * Visit supports node.
 */

Compiler.prototype.supports = function(node){
  return this.emit('@supports ' + node.supports, node.position)
    + this.emit('{')
    + this.mapVisit(node.rules)
    + this.emit('}');
};

/**
 * Visit keyframes node.
 */

Compiler.prototype.keyframes = function(node){
  return this.emit('@'
    + (node.vendor || '')
    + 'keyframes '
    + node.name, node.position)
    + this.emit('{')
    + this.mapVisit(node.keyframes)
    + this.emit('}');
};

/**
 * Visit keyframe node.
 */

Compiler.prototype.keyframe = function(node){
  var decls = node.declarations;

  return this.emit(node.values.join(','), node.position)
    + this.emit('{')
    + this.mapVisit(decls)
    + this.emit('}');
};

/**
 * Visit page node.
 */

Compiler.prototype.page = function(node){
  var sel = node.selectors.length
    ? node.selectors.join(', ')
    : '';

  return this.emit('@page ' + sel, node.position)
    + this.emit('{')
    + this.mapVisit(node.declarations)
    + this.emit('}');
};

/**
 * Visit font-face node.
 */

Compiler.prototype['font-face'] = function(node){
  return this.emit('@font-face', node.position)
    + this.emit('{')
    + this.mapVisit(node.declarations)
    + this.emit('}');
};

/**
 * Visit host node.
 */

Compiler.prototype.host = function(node){
  return this.emit('@host', node.position)
    + this.emit('{')
    + this.mapVisit(node.rules)
    + this.emit('}');
};

/**
 * Visit custom-media node.
 */

Compiler.prototype['custom-media'] = function(node){
  return this.emit('@custom-media ' + node.name + ' ' + node.media + ';', node.position);
};

/**
 * Visit rule node.
 */

Compiler.prototype.rule = function(node){
  var decls = node.declarations;
  if (!decls.length) return '';

  return this.emit(node.selectors.join(','), node.position)
    + this.emit('{')
    + this.mapVisit(decls)
    + this.emit('}');
};

/**
 * Visit declaration node.
 */

Compiler.prototype.declaration = function(node){
  return this.emit(node.property + ':' + node.value, node.position) + this.emit(';');
};


},{"./compiler":3,"inherits":8}],5:[function(require,module,exports){

/**
 * Module dependencies.
 */

var Base = require('./compiler');
var inherits = require('inherits');

/**
 * Expose compiler.
 */

module.exports = Compiler;

/**
 * Initialize a new `Compiler`.
 */

function Compiler(options) {
  options = options || {};
  Base.call(this, options);
  this.indentation = options.indent;
}

/**
 * Inherit from `Base.prototype`.
 */

inherits(Compiler, Base);

/**
 * Compile `node`.
 */

Compiler.prototype.compile = function(node){
  return this.stylesheet(node);
};

/**
 * Visit stylesheet node.
 */

Compiler.prototype.stylesheet = function(node){
  return this.mapVisit(node.stylesheet.rules, '\n\n');
};

/**
 * Visit comment node.
 */

Compiler.prototype.comment = function(node){
  return this.emit(this.indent() + '/*' + node.comment + '*/', node.position);
};

/**
 * Visit import node.
 */

Compiler.prototype.import = function(node){
  return this.emit('@import ' + node.import + ';', node.position);
};

/**
 * Visit media node.
 */

Compiler.prototype.media = function(node){
  return this.emit('@media ' + node.media, node.position)
    + this.emit(
        ' {\n'
        + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit document node.
 */

Compiler.prototype.document = function(node){
  var doc = '@' + (node.vendor || '') + 'document ' + node.document;

  return this.emit(doc, node.position)
    + this.emit(
        ' '
      + ' {\n'
      + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit charset node.
 */

Compiler.prototype.charset = function(node){
  return this.emit('@charset ' + node.charset + ';', node.position);
};

/**
 * Visit namespace node.
 */

Compiler.prototype.namespace = function(node){
  return this.emit('@namespace ' + node.namespace + ';', node.position);
};

/**
 * Visit supports node.
 */

Compiler.prototype.supports = function(node){
  return this.emit('@supports ' + node.supports, node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit keyframes node.
 */

Compiler.prototype.keyframes = function(node){
  return this.emit('@' + (node.vendor || '') + 'keyframes ' + node.name, node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(node.keyframes, '\n')
    + this.emit(
        this.indent(-1)
        + '}');
};

/**
 * Visit keyframe node.
 */

Compiler.prototype.keyframe = function(node){
  var decls = node.declarations;

  return this.emit(this.indent())
    + this.emit(node.values.join(', '), node.position)
    + this.emit(
      ' {\n'
      + this.indent(1))
    + this.mapVisit(decls, '\n')
    + this.emit(
      this.indent(-1)
      + '\n'
      + this.indent() + '}\n');
};

/**
 * Visit page node.
 */

Compiler.prototype.page = function(node){
  var sel = node.selectors.length
    ? node.selectors.join(', ') + ' '
    : '';

  return this.emit('@page ' + sel, node.position)
    + this.emit('{\n')
    + this.emit(this.indent(1))
    + this.mapVisit(node.declarations, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n}');
};

/**
 * Visit font-face node.
 */

Compiler.prototype['font-face'] = function(node){
  return this.emit('@font-face ', node.position)
    + this.emit('{\n')
    + this.emit(this.indent(1))
    + this.mapVisit(node.declarations, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n}');
};

/**
 * Visit host node.
 */

Compiler.prototype.host = function(node){
  return this.emit('@host', node.position)
    + this.emit(
        ' {\n'
        + this.indent(1))
    + this.mapVisit(node.rules, '\n\n')
    + this.emit(
        this.indent(-1)
        + '\n}');
};

/**
 * Visit custom-media node.
 */

Compiler.prototype['custom-media'] = function(node){
  return this.emit('@custom-media ' + node.name + ' ' + node.media + ';', node.position);
};

/**
 * Visit rule node.
 */

Compiler.prototype.rule = function(node){
  var indent = this.indent();
  var decls = node.declarations;
  if (!decls.length) return '';

  return this.emit(node.selectors.map(function(s){ return indent + s }).join(',\n'), node.position)
    + this.emit(' {\n')
    + this.emit(this.indent(1))
    + this.mapVisit(decls, '\n')
    + this.emit(this.indent(-1))
    + this.emit('\n' + this.indent() + '}');
};

/**
 * Visit declaration node.
 */

Compiler.prototype.declaration = function(node){
  return this.emit(this.indent())
    + this.emit(node.property + ': ' + node.value, node.position)
    + this.emit(';');
};

/**
 * Increase, decrease or return current indentation.
 */

Compiler.prototype.indent = function(level) {
  this.level = this.level || 1;

  if (null != level) {
    this.level += level;
    return '';
  }

  return Array(this.level).join(this.indentation || '  ');
};

},{"./compiler":3,"inherits":8}],6:[function(require,module,exports){

/**
 * Module dependencies.
 */

var Compressed = require('./compress');
var Identity = require('./identity');

/**
 * Stringfy the given AST `node`.
 *
 * Options:
 *
 *  - `compress` space-optimized output
 *  - `sourcemap` return an object with `.code` and `.map`
 *
 * @param {Object} node
 * @param {Object} [options]
 * @return {String}
 * @api public
 */

module.exports = function(node, options){
  options = options || {};

  var compiler = options.compress
    ? new Compressed(options)
    : new Identity(options);

  // source maps
  if (options.sourcemap) {
    var sourcemaps = require('./source-map-support');
    sourcemaps(compiler);

    var code = compiler.compile(node);
    compiler.applySourceMaps();

    var map = options.sourcemap === 'generator'
      ? compiler.map
      : compiler.map.toJSON();

    return { code: code, map: map };
  }

  var code = compiler.compile(node);
  return code;
};

},{"./compress":4,"./identity":5,"./source-map-support":7}],7:[function(require,module,exports){

/**
 * Module dependencies.
 */

var SourceMap = require('source-map').SourceMapGenerator;
var SourceMapConsumer = require('source-map').SourceMapConsumer;
var sourceMapResolve = require('source-map-resolve');
var urix = require('urix');
var fs = require('fs');
var path = require('path');

/**
 * Expose `mixin()`.
 */

module.exports = mixin;

/**
 * Mixin source map support into `compiler`.
 *
 * @param {Compiler} compiler
 * @api public
 */

function mixin(compiler) {
  compiler._comment = compiler.comment;
  compiler.map = new SourceMap();
  compiler.position = { line: 1, column: 1 };
  compiler.files = {};
  for (var k in exports) compiler[k] = exports[k];
}

/**
 * Update position.
 *
 * @param {String} str
 * @api private
 */

exports.updatePosition = function(str) {
  var lines = str.match(/\n/g);
  if (lines) this.position.line += lines.length;
  var i = str.lastIndexOf('\n');
  this.position.column = ~i ? str.length - i : this.position.column + str.length;
};

/**
 * Emit `str`.
 *
 * @param {String} str
 * @param {Object} [pos]
 * @return {String}
 * @api private
 */

exports.emit = function(str, pos) {
  if (pos) {
    var sourceFile = urix(pos.source || 'source.css');

    this.map.addMapping({
      source: sourceFile,
      generated: {
        line: this.position.line,
        column: Math.max(this.position.column - 1, 0)
      },
      original: {
        line: pos.start.line,
        column: pos.start.column - 1
      }
    });

    this.addFile(sourceFile, pos);
  }

  this.updatePosition(str);

  return str;
};

/**
 * Adds a file to the source map output if it has not already been added
 * @param {String} file
 * @param {Object} pos
 */

exports.addFile = function(file, pos) {
  if (typeof pos.content !== 'string') return;
  if (Object.prototype.hasOwnProperty.call(this.files, file)) return;

  this.files[file] = pos.content;
};

/**
 * Applies any original source maps to the output and embeds the source file
 * contents in the source map.
 */

exports.applySourceMaps = function() {
  Object.keys(this.files).forEach(function(file) {
    var content = this.files[file];
    this.map.setSourceContent(file, content);

    if (this.options.inputSourcemaps !== false) {
      var originalMap = sourceMapResolve.resolveSync(
        content, file, fs.readFileSync);
      if (originalMap) {
        var map = new SourceMapConsumer(originalMap.map);
        var relativeTo = originalMap.sourcesRelativeTo;
        this.map.applySourceMap(map, file, urix(path.dirname(relativeTo)));
      }
    }
  }, this);
};

/**
 * Process comments, drops sourceMap comments.
 * @param {Object} node
 */

exports.comment = function(node) {
  if (/^# sourceMappingURL=/.test(node.comment))
    return this.emit('', node.position);
  else
    return this._comment(node);
};

},{"fs":25,"path":26,"source-map":12,"source-map-resolve":11,"urix":23}],8:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],9:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

void (function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(factory)
  } else if (typeof exports === "object") {
    module.exports = factory()
  } else {
    root.resolveUrl = factory()
  }
}(this, function() {

  function resolveUrl(/* ...urls */) {
    var numUrls = arguments.length

    if (numUrls === 0) {
      throw new Error("resolveUrl requires at least one argument; got none.")
    }

    var base = document.createElement("base")
    base.href = arguments[0]

    if (numUrls === 1) {
      return base.href
    }

    var head = document.getElementsByTagName("head")[0]
    head.insertBefore(base, head.firstChild)

    var a = document.createElement("a")
    var resolved

    for (var index = 1; index < numUrls; index++) {
      a.href = arguments[index]
      resolved = a.href
      base.href = resolved
    }

    head.removeChild(base)

    return resolved
  }

  return resolveUrl

}));

},{}],10:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

void (function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(factory)
  } else if (typeof exports === "object") {
    module.exports = factory()
  } else {
    root.sourceMappingURL = factory()
  }
}(this, function() {

  var innerRegex = /[#@] sourceMappingURL=([^\s'"]*)/

  var regex = RegExp(
    "(?:" +
      "/\\*" +
      "(?:\\s*\r?\n(?://)?)?" +
      "(?:" + innerRegex.source + ")" +
      "\\s*" +
      "\\*/" +
      "|" +
      "//(?:" + innerRegex.source + ")" +
    ")" +
    "\\s*$"
  )

  return {

    regex: regex,
    _innerRegex: innerRegex,

    getFrom: function(code) {
      var match = code.match(regex)
      return (match ? match[1] || match[2] || "" : null)
    },

    existsIn: function(code) {
      return regex.test(code)
    },

    removeFrom: function(code) {
      return code.replace(regex, "")
    },

    insertBefore: function(code, string) {
      var match = code.match(regex)
      if (match) {
        return code.slice(0, match.index) + string + code.slice(match.index)
      } else {
        return code + string
      }
    }
  }

}));

},{}],11:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

// Note: source-map-resolve.js is generated from source-map-resolve-node.js and
// source-map-resolve-template.js. Only edit the two latter files, _not_
// source-map-resolve.js!

void (function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["source-map-url", "resolve-url"], factory)
  } else if (typeof exports === "object") {
    var sourceMappingURL = require("source-map-url")
    var resolveUrl = require("resolve-url")
    module.exports = factory(sourceMappingURL, resolveUrl)
  } else {
    root.sourceMapResolve = factory(root.sourceMappingURL, root.resolveUrl)
  }
}(this, function(sourceMappingURL, resolveUrl) {

  function callbackAsync(callback, error, result) {
    setImmediate(function() { callback(error, result) })
  }

  function parseMapToJSON(string) {
    return JSON.parse(string.replace(/^\)\]\}'/, ""))
  }



  function resolveSourceMap(code, codeUrl, read, callback) {
    var mapData
    try {
      mapData = resolveSourceMapHelper(code, codeUrl)
    } catch (error) {
      return callbackAsync(callback, error)
    }
    if (!mapData || mapData.map) {
      return callbackAsync(callback, null, mapData)
    }
    read(mapData.url, function(error, result) {
      if (error) {
        return callback(error)
      }
      try {
        mapData.map = parseMapToJSON(String(result))
      } catch (error) {
        return callback(error)
      }
      callback(null, mapData)
    })
  }

  function resolveSourceMapSync(code, codeUrl, read) {
    var mapData = resolveSourceMapHelper(code, codeUrl)
    if (!mapData || mapData.map) {
      return mapData
    }
    mapData.map = parseMapToJSON(String(read(mapData.url)))
    return mapData
  }

  var dataUriRegex = /^data:([^,;]*)(;[^,;]*)*(?:,(.*))?$/
  var jsonMimeTypeRegex = /^(?:application|text)\/json$/

  function resolveSourceMapHelper(code, codeUrl) {
    var url = sourceMappingURL.getFrom(code)
    if (!url) {
      return null
    }

    var dataUri = url.match(dataUriRegex)
    if (dataUri) {
      var mimeType = dataUri[1]
      var lastParameter = dataUri[2]
      var encoded = dataUri[3]
      if (!jsonMimeTypeRegex.test(mimeType)) {
        throw new Error("Unuseful data uri mime type: " + (mimeType || "text/plain"))
      }
      return {
        sourceMappingURL: url,
        url: null,
        sourcesRelativeTo: codeUrl,
        map: parseMapToJSON(lastParameter === ";base64" ? atob(encoded) : decodeURIComponent(encoded))
      }
    }

    var mapUrl = resolveUrl(codeUrl, url)
    return {
      sourceMappingURL: url,
      url: mapUrl,
      sourcesRelativeTo: mapUrl,
      map: null
    }
  }



  function resolveSources(map, mapUrl, read, options, callback) {
    if (typeof options === "function") {
      callback = options
      options = {}
    }
    var pending = map.sources.length
    var errored = false
    var result = {
      sourcesResolved: [],
      sourcesContent:  []
    }

    var done = function(error) {
      if (errored) {
        return
      }
      if (error) {
        errored = true
        return callback(error)
      }
      pending--
      if (pending === 0) {
        callback(null, result)
      }
    }

    resolveSourcesHelper(map, mapUrl, options, function(fullUrl, sourceContent, index) {
      result.sourcesResolved[index] = fullUrl
      if (typeof sourceContent === "string") {
        result.sourcesContent[index] = sourceContent
        callbackAsync(done, null)
      } else {
        read(fullUrl, function(error, source) {
          result.sourcesContent[index] = String(source)
          done(error)
        })
      }
    })
  }

  function resolveSourcesSync(map, mapUrl, read, options) {
    var result = {
      sourcesResolved: [],
      sourcesContent:  []
    }
    resolveSourcesHelper(map, mapUrl, options, function(fullUrl, sourceContent, index) {
      result.sourcesResolved[index] = fullUrl
      if (read !== null) {
        if (typeof sourceContent === "string") {
          result.sourcesContent[index] = sourceContent
        } else {
          result.sourcesContent[index] = String(read(fullUrl))
        }
      }
    })
    return result
  }

  var endingSlash = /\/?$/

  function resolveSourcesHelper(map, mapUrl, options, fn) {
    options = options || {}
    var fullUrl
    var sourceContent
    for (var index = 0, len = map.sources.length; index < len; index++) {
      if (map.sourceRoot && !options.ignoreSourceRoot) {
        // Make sure that the sourceRoot ends with a slash, so that `/scripts/subdir` becomes
        // `/scripts/subdir/<source>`, not `/scripts/<source>`. Pointing to a file as source root
        // does not make sense.
        fullUrl = resolveUrl(mapUrl, map.sourceRoot.replace(endingSlash, "/"), map.sources[index])
      } else {
        fullUrl = resolveUrl(mapUrl, map.sources[index])
      }
      sourceContent = (map.sourcesContent || [])[index]
      fn(fullUrl, sourceContent, index)
    }
  }



  function resolve(code, codeUrl, read, options, callback) {
    if (typeof options === "function") {
      callback = options
      options = {}
    }
    resolveSourceMap(code, codeUrl, read, function(error, mapData) {
      if (error) {
        return callback(error)
      }
      if (!mapData) {
        return callback(null, null)
      }
      resolveSources(mapData.map, mapData.sourcesRelativeTo, read, options, function(error, result) {
        if (error) {
          return callback(error)
        }
        mapData.sourcesResolved = result.sourcesResolved
        mapData.sourcesContent  = result.sourcesContent
        callback(null, mapData)
      })
    })
  }

  function resolveSync(code, codeUrl, read, options) {
    var mapData = resolveSourceMapSync(code, codeUrl, read)
    if (!mapData) {
      return null
    }
    var result = resolveSourcesSync(mapData.map, mapData.sourcesRelativeTo, read, options)
    mapData.sourcesResolved = result.sourcesResolved
    mapData.sourcesContent  = result.sourcesContent
    return mapData
  }



  return {
    resolveSourceMap:     resolveSourceMap,
    resolveSourceMapSync: resolveSourceMapSync,
    resolveSources:       resolveSources,
    resolveSourcesSync:   resolveSourcesSync,
    resolve:              resolve,
    resolveSync:          resolveSync
  }

}));

},{"resolve-url":9,"source-map-url":10}],12:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":18,"./source-map/source-map-generator":19,"./source-map/source-node":20}],13:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":21,"amdefine":22}],14:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string via the out parameter.
   */
  exports.decode = function base64VLQ_decode(aStr, aOutParam) {
    var i = 0;
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (i >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charAt(i++));
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aStr.slice(i);
  };

});

},{"./base64":15,"amdefine":22}],15:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var charToIntMap = {};
  var intToCharMap = {};

  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .forEach(function (ch, index) {
      charToIntMap[ch] = index;
      intToCharMap[index] = ch;
    });

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function base64_encode(aNumber) {
    if (aNumber in intToCharMap) {
      return intToCharMap[aNumber];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 digit to an integer.
   */
  exports.decode = function base64_decode(aChar) {
    if (aChar in charToIntMap) {
      return charToIntMap[aChar];
    }
    throw new TypeError("Not a valid base 64 digit: " + aChar);
  };

});

},{"amdefine":22}],16:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the index of
    //      the next closest element that is less than that element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element which is less than the one we are searching for, so we
    //      return -1.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return mid;
    }
    else if (cmp > 0) {
      // aHaystack[mid] is greater than our needle.
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
      }
      // We did not find an exact match, return the next closest one
      // (termination case 2).
      return mid;
    }
    else {
      // aHaystack[mid] is less than our needle.
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
      }
      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (2) or (3) and return the appropriate thing.
      return aLow < 0 ? -1 : aLow;
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the index of next lowest value checked if there is no exact hit. This is
   * because mappings between original and generated line/col pairs are single
   * points, and there is an implicit region between each of them, so a miss
   * just means that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare) {
    if (aHaystack.length === 0) {
      return -1;
    }
    return recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare)
  };

});

},{"amdefine":22}],17:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * Determine whether mappingB is after mappingA with respect to generated
   * position.
   */
  function generatedPositionAfter(mappingA, mappingB) {
    // Optimized for most common case
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA ||
           util.compareByGeneratedPositions(mappingA, mappingB) <= 0;
  }

  /**
   * A data structure to provide a sorted view of accumulated mappings in a
   * performance conscious manner. It trades a neglibable overhead in general
   * case for a large speedup in case of mappings being added in order.
   */
  function MappingList() {
    this._array = [];
    this._sorted = true;
    // Serves as infimum
    this._last = {generatedLine: -1, generatedColumn: 0};
  }

  /**
   * Iterate through internal items. This method takes the same arguments that
   * `Array.prototype.forEach` takes.
   *
   * NOTE: The order of the mappings is NOT guaranteed.
   */
  MappingList.prototype.unsortedForEach =
    function MappingList_forEach(aCallback, aThisArg) {
      this._array.forEach(aCallback, aThisArg);
    };

  /**
   * Add the given source mapping.
   *
   * @param Object aMapping
   */
  MappingList.prototype.add = function MappingList_add(aMapping) {
    var mapping;
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };

  /**
   * Returns the flat, sorted array of mappings. The mappings are sorted by
   * generated position.
   *
   * WARNING: This method returns internal data without copying, for
   * performance. The return value must NOT be mutated, and should be treated as
   * an immutable borrow. If you want to take ownership, you must make your own
   * copy.
   */
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util.compareByGeneratedPositions);
      this._sorted = true;
    }
    return this._array;
  };

  exports.MappingList = MappingList;

});

},{"./util":21,"amdefine":22}],18:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');

  /**
   * A SourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: Optional. The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Some source maps produce relative source paths like "./foo.js" instead of
    // "foo.js".  Normalize these first so that future comparisons will succeed.
    // See bugzil.la/1090768.
    sources = sources.map(util.normalize);

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  /**
   * Create a SourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns SourceMapConsumer
   */
  SourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(SourceMapConsumer.prototype);

      smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      smc.__generatedMappings = aSourceMap._mappings.toArray().slice();
      smc.__originalMappings = aSourceMap._mappings.toArray().slice()
        .sort(util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  SourceMapConsumer.prototype._nextCharIsMappingSeparator =
    function SourceMapConsumer_nextCharIsMappingSeparator(aStr) {
      var c = aStr.charAt(0);
      return c === ";" || c === ",";
    };

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var str = aStr;
      var temp = {};
      var mapping;

      while (str.length > 0) {
        if (str.charAt(0) === ';') {
          generatedLine++;
          str = str.slice(1);
          previousGeneratedColumn = 0;
        }
        else if (str.charAt(0) === ',') {
          str = str.slice(1);
        }
        else {
          mapping = {};
          mapping.generatedLine = generatedLine;

          // Generated column.
          base64VLQ.decode(str, temp);
          mapping.generatedColumn = previousGeneratedColumn + temp.value;
          previousGeneratedColumn = mapping.generatedColumn;
          str = temp.rest;

          if (str.length > 0 && !this._nextCharIsMappingSeparator(str)) {
            // Original source.
            base64VLQ.decode(str, temp);
            mapping.source = this._sources.at(previousSource + temp.value);
            previousSource += temp.value;
            str = temp.rest;
            if (str.length === 0 || this._nextCharIsMappingSeparator(str)) {
              throw new Error('Found a source, but no line and column');
            }

            // Original line.
            base64VLQ.decode(str, temp);
            mapping.originalLine = previousOriginalLine + temp.value;
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;
            str = temp.rest;
            if (str.length === 0 || this._nextCharIsMappingSeparator(str)) {
              throw new Error('Found a source and line, but no column');
            }

            // Original column.
            base64VLQ.decode(str, temp);
            mapping.originalColumn = previousOriginalColumn + temp.value;
            previousOriginalColumn = mapping.originalColumn;
            str = temp.rest;

            if (str.length > 0 && !this._nextCharIsMappingSeparator(str)) {
              // Original name.
              base64VLQ.decode(str, temp);
              mapping.name = this._names.at(previousName + temp.value);
              previousName += temp.value;
              str = temp.rest;
            }
          }

          this.__generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            this.__originalMappings.push(mapping);
          }
        }
      }

      this.__generatedMappings.sort(util.compareByGeneratedPositions);
      this.__originalMappings.sort(util.compareByOriginalPositions);
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  SourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator);
    };

  /**
   * Compute the last column for each generated mapping. The last column is
   * inclusive.
   */
  SourceMapConsumer.prototype.computeColumnSpans =
    function SourceMapConsumer_computeColumnSpans() {
      for (var index = 0; index < this._generatedMappings.length; ++index) {
        var mapping = this._generatedMappings[index];

        // Mappings do not contain a field for the last generated columnt. We
        // can come up with an optimistic estimate, however, by assuming that
        // mappings are contiguous (i.e. given two consecutive mappings, the
        // first mapping ends where the second one starts).
        if (index + 1 < this._generatedMappings.length) {
          var nextMapping = this._generatedMappings[index + 1];

          if (mapping.generatedLine === nextMapping.generatedLine) {
            mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
            continue;
          }
        }

        // The last mapping for each line spans the entire line.
        mapping.lastGeneratedColumn = Infinity;
      }
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  SourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var index = this._findMapping(needle,
                                    this._generatedMappings,
                                    "generatedLine",
                                    "generatedColumn",
                                    util.compareByGeneratedPositions);

      if (index >= 0) {
        var mapping = this._generatedMappings[index];

        if (mapping.generatedLine === needle.generatedLine) {
          var source = util.getArg(mapping, 'source', null);
          if (source != null && this.sourceRoot != null) {
            source = util.join(this.sourceRoot, source);
          }
          return {
            source: source,
            line: util.getArg(mapping, 'originalLine', null),
            column: util.getArg(mapping, 'originalColumn', null),
            name: util.getArg(mapping, 'name', null)
          };
        }
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  SourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot != null) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot != null
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      throw new Error('"' + aSource + '" is not in the SourceMap.');
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      if (this.sourceRoot != null) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }

      var index = this._findMapping(needle,
                                    this._originalMappings,
                                    "originalLine",
                                    "originalColumn",
                                    util.compareByOriginalPositions);

      if (index >= 0) {
        var mapping = this._originalMappings[index];

        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null),
          lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
        };
      }

      return {
        line: null,
        column: null,
        lastColumn: null
      };
    };

  /**
   * Returns all generated line and column information for the original source
   * and line provided. The only argument is an object with the following
   * properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *
   * and an array of objects is returned, each with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.allGeneratedPositionsFor =
    function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
      // When there is no exact match, SourceMapConsumer.prototype._findMapping
      // returns the index of the closest mapping less than the needle. By
      // setting needle.originalColumn to Infinity, we thus find the last
      // mapping for the given line, provided such a mapping exists.
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: Infinity
      };

      if (this.sourceRoot != null) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }

      var mappings = [];

      var index = this._findMapping(needle,
                                    this._originalMappings,
                                    "originalLine",
                                    "originalColumn",
                                    util.compareByOriginalPositions);
      if (index >= 0) {
        var mapping = this._originalMappings[index];

        while (mapping && mapping.originalLine === needle.originalLine) {
          mappings.push({
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          });

          mapping = this._originalMappings[--index];
        }
      }

      return mappings.reverse();
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source;
        if (source != null && sourceRoot != null) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name
        };
      }).forEach(aCallback, context);
    };

  exports.SourceMapConsumer = SourceMapConsumer;

});

},{"./array-set":13,"./base64-vlq":14,"./binary-search":16,"./util":21,"amdefine":22}],19:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;
  var MappingList = require('./mapping-list').MappingList;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. You may pass an object with the following
   * properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: A root for all relative URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, 'file', null);
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = new MappingList();
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      if (!this._skipValidation) {
        this._validateMapping(generated, original, source, name);
      }

      if (source != null && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name != null && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.add({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent != null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else if (this._sourcesContents) {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.'
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "sourceFile" relative if an absolute Url is passed.
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "sourceFile"
      this._mappings.unsortedForEach(function (mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            // Copy mapping
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source)
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null) {
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile = util.join(aSourceMapPath, sourceFile);
          }
          if (sourceRoot != null) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      var mappings = this._mappings.toArray();

      for (var i = 0, len = mappings.length; i < len; i++) {
        mapping = mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositions(mapping, mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source != null) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name != null) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this);
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":13,"./base64-vlq":14,"./mapping-list":17,"./util":21,"amdefine":22}],20:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
  // operating systems these days (capturing the result).
  var REGEX_NEWLINE = /(\r?\n)/;

  // Newline character code for charCodeAt() comparisons
  var NEWLINE_CODE = 10;

  // Private symbol for identifying `SourceNode`s when multiple versions of
  // the source-map library are loaded. This MUST NOT CHANGE across
  // versions!
  var isSourceNode = "$$$isSourceNode$$$";

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   * @param aRelativePath Optional. The path that relative sources in the
   *        SourceMapConsumer should be relative to.
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // All even indices of this array are one line of the generated code,
      // while all odd indices are the newlines between two adjacent lines
      // (since `REGEX_NEWLINE` captures its match).
      // Processed fragments are removed from this array, by calling `shiftNextLine`.
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var shiftNextLine = function() {
        var lineContents = remainingLines.shift();
        // The last line of a file might not have a newline.
        var newLine = remainingLines.shift() || "";
        return lineContents + newLine;
      };

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping !== null) {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate first line with "lastMapping"
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
            // The remaining code is added without mapping
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
            // No more remaining code, continue
            lastMapping = mapping;
            return;
          }
        }
        // We add the generated code until the first mapping
        // to the SourceNode without any mapping.
        // Each line is added as separate string.
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[0];
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[0] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      if (remainingLines.length > 0) {
        if (lastMapping) {
          // Associate the remaining code in the current line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        // and add the remaining lines without any mapping
        node.add(remainingLines.join(""));
      }

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aRelativePath != null) {
            sourceFile = util.join(aRelativePath, sourceFile);
          }
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          var source = aRelativePath
            ? util.join(aRelativePath, mapping.source)
            : mapping.source;
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i][isSourceNode]) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (var idx = 0, length = chunk.length; idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":19,"./util":21,"amdefine":22}],21:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  /**
   * Normalizes a path, or the path portion of a URL:
   *
   * - Replaces consequtive slashes with one slash.
   * - Removes unnecessary '.' parts.
   * - Removes unnecessary '<dir>/..' parts.
   *
   * Based on code in the Node.js 'path' core module.
   *
   * @param aPath The path or url to normalize.
   */
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = (path.charAt(0) === '/');

    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
      part = parts[i];
      if (part === '.') {
        parts.splice(i, 1);
      } else if (part === '..') {
        up++;
      } else if (up > 0) {
        if (part === '') {
          // The first part is blank if the path is absolute. Trying to go
          // above the root is a no-op. Therefore we can remove all '..' parts
          // directly after the root.
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join('/');

    if (path === '') {
      path = isAbsolute ? '/' : '.';
    }

    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;

  /**
   * Joins two paths/URLs.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be joined with the root.
   *
   * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
   *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
   *   first.
   * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
   *   is updated with the result and aRoot is returned. Otherwise the result
   *   is returned.
   *   - If aPath is absolute, the result is aPath.
   *   - Otherwise the two paths are joined with a slash.
   * - Joining for example 'http://' and 'www.example.com' is also supported.
   */
  function join(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    if (aPath === "") {
      aPath = ".";
    }
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }

    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    // `join('http://', 'www.example.com')`
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }

    var joined = aPath.charAt(0) === '/'
      ? aPath
      : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;

  /**
   * Make a path relative to a URL or another path.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be made relative to aRoot.
   */
  function relative(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }

    aRoot = aRoot.replace(/\/$/, '');

    // XXX: It is possible to remove this block, and the tests still pass!
    var url = urlParse(aRoot);
    if (aPath.charAt(0) == "/" && url && url.path == "/") {
      return aPath.slice(1);
    }

    return aPath.indexOf(aRoot + '/') === 0
      ? aPath.substr(aRoot.length + 1)
      : aPath;
  }
  exports.relative = relative;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  function strcmp(aStr1, aStr2) {
    var s1 = aStr1 || "";
    var s2 = aStr2 || "";
    return (s1 > s2) - (s1 < s2);
  }

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp;

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp || onlyCompareOriginal) {
      return cmp;
    }

    cmp = strcmp(mappingA.name, mappingB.name);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    return mappingA.generatedColumn - mappingB.generatedColumn;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings where the generated positions are
   * compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
    var cmp;

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp || onlyCompareGenerated) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositions = compareByGeneratedPositions;

});

},{"amdefine":22}],22:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 1.0.0 Copyright (c) 2011-2015, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                if (callback) {
                    process.nextTick(function () {
                        callback.apply(null, deps);
                    });
                }
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require('_process'),"/node_modules/css/node_modules/source-map/node_modules/amdefine/amdefine.js")

},{"_process":27,"path":26}],23:[function(require,module,exports){
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)

var path = require("path")

"use strict"

function urix(aPath) {
  if (path.sep === "\\") {
    return aPath
      .replace(/\\/g, "/")
      .replace(/^[a-z]:\/?/i, "/")
  }
  return aPath
}

module.exports = urix

},{"path":26}],24:[function(require,module,exports){
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.deepmerge = factory();
    }
}(this, function () {

return function deepmerge(target, src) {
    var array = Array.isArray(src);
    var dst = array && [] || {};

    if (array) {
        target = target || [];
        dst = dst.concat(target);
        src.forEach(function(e, i) {
            if (typeof dst[i] === 'undefined') {
                dst[i] = e;
            } else if (typeof e === 'object') {
                dst[i] = deepmerge(target[i], e);
            } else {
                if (target.indexOf(e) === -1) {
                    dst.push(e);
                }
            }
        });
    } else {
        if (target && typeof target === 'object') {
            Object.keys(target).forEach(function (key) {
                dst[key] = target[key];
            })
        }
        Object.keys(src).forEach(function (key) {
            if (typeof src[key] !== 'object' || !src[key]) {
                dst[key] = src[key];
            }
            else {
                if (!target[key]) {
                    dst[key] = src[key];
                } else {
                    dst[key] = deepmerge(target[key], src[key]);
                }
            }
        });
    }

    return dst;
}

}));

},{}],25:[function(require,module,exports){

},{}],26:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":27}],27:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],28:[function(require,module,exports){
/*
 * Copyright (C) 2007-2015 Diego Perini
 * All rights reserved.
 *
 * nwmatcher.js - A fast CSS selector engine and matcher
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.3.7
 * Created: 20070722
 * Release: 20151120
 *
 * License:
 *  http://javascript.nwbox.com/NWMatcher/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWMatcher/nwmatcher.js
 */

(function(global, factory) {

  if (typeof module == 'object' && typeof exports == 'object') {
    // in a Node.js environment, the nwmatcher functions will operate on
    // the passed "browserGlobal" and will be returned in an object
    module.exports = function (browserGlobal) {
      // passed global does not contain
      // references to native objects
      browserGlobal.console = console;
      browserGlobal.parseInt = parseInt;
      browserGlobal.Function = Function;
      browserGlobal.Boolean = Boolean;
      browserGlobal.Number = Number;
      browserGlobal.RegExp = RegExp;
      browserGlobal.String = String;
      browserGlobal.Object = Object;
      browserGlobal.Array = Array;
      browserGlobal.Error = Error;
      browserGlobal.Date = Date;
      browserGlobal.Math = Math;
      var exports = browserGlobal.Object();
      factory(browserGlobal, exports);
      return exports;
    };
    module.factory = factory;
  } else {
    // in a browser environment, the nwmatcher functions will operate on
    // the "global" loading them and be attached to "global.NW.Dom"
    factory(global,
      (global.NW || (global.NW = global.Object())) &&
      (global.NW.Dom || (global.NW.Dom = global.Object())));
    global.NW.Dom.factory = factory;
  }

})(this, function(global, exports) {

  var version = 'nwmatcher-1.3.7',

  Dom = exports,

  // processing context & root element
  doc = global.document,
  root = doc.documentElement,

  // save utility methods references
  slice = global.Array.prototype.slice,
  string = global.Object.prototype.toString,

  // persist previous parsed data
  isSingleMatch,
  isSingleSelect,

  lastSlice,
  lastContext,
  lastPosition,

  lastMatcher,
  lastSelector,

  lastPartsMatch,
  lastPartsSelect,

  // accepted prefix identifiers
  // (id, class & pseudo-class)
  prefixes = '[#.:]?',

  // accepted attribute operators
  operators = '([~*^$|!]?={1})',

  // accepted whitespace characters
  whitespace = '[\\x20\\t\\n\\r\\f]*',

  // 4 combinators F E, F>E, F+E, F~E
  combinators = '[\\x20]|[>+~](?=[^>+~])',

  // an+b format params for pseudo-classes
  pseudoparms = '(?:[-+]?\\d*n)?[-+]?\\d*',

  // CSS quoted string values
  quotedvalue = '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' + "|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'",

  // skip round brackets groups
  skipround = '\\([^()]+\\)|\\(.*\\)',
  // skip curly brackets groups
  skipcurly = '\\{[^{}]+\\}|\\{.*\\}',
  // skip square brackets groups
  skipsquare = '\\[[^[\\]]*\\]|\\[.*\\]',

  // skip [ ], ( ), { } brackets groups
  skipgroup = '\\[.*\\]|\\(.*\\)|\\{.*\\}',

  // http://www.w3.org/TR/css3-syntax/#characters
  // unicode/ISO 10646 characters 161 and higher
  // NOTE: Safari 2.0.x crashes with escaped (\\)
  // Unicode ranges in regular expressions so we
  // use a negated character range class instead
  encoding = '(?:[-\\w]|[^\\x00-\\xa0]|\\\\.)',

  // CSS identifier syntax
  identifier = '(?:-?[_a-zA-Z]{1}[-\\w]*|[^\\x00-\\xa0]+|\\\\.+)+',

  // build attribute string
  attrcheck = '(' + quotedvalue + '|' + identifier + ')',
  attributes = whitespace + '(' + encoding + '*:?' + encoding + '+)' +
    whitespace + '(?:' + operators + whitespace + attrcheck + ')?' + whitespace,
  attrmatcher = attributes.replace(attrcheck, '([\\x22\\x27]*)((?:\\\\?.)*?)\\3'),

  // build pseudoclass string
  pseudoclass = '((?:' +
    // an+b parameters or quoted string
    pseudoparms + '|' + quotedvalue + '|' +
    // id, class, pseudo-class selector
    prefixes + '|' + encoding + '+|' +
    // nested HTML attribute selector
    '\\[' + attributes + '\\]|' +
    // nested pseudo-class selector
    '\\(.+\\)|' + whitespace + '|' +
    // nested pseudos/separators
    ',)+)',

  // placeholder for extensions
  extensions = '.+',

  // CSS3: syntax scanner and
  // one pass validation only
  // using regular expression
  standardValidator =
    // discard start
    '(?=[\\x20\\t\\n\\r\\f]*[^>+~(){}<>])' +
    // open match group
    '(' +
    //universal selector
    '\\*' +
    // id/class/tag/pseudo-class identifier
    '|(?:' + prefixes + identifier + ')' +
    // combinator selector
    '|' + combinators +
    // HTML attribute selector
    '|\\[' + attributes + '\\]' +
    // pseudo-classes parameters
    '|\\(' + pseudoclass + '\\)' +
    // dom properties selector (extension)
    '|\\{' + extensions + '\\}' +
    // selector group separator (comma)
    '|(?:,|' + whitespace + ')' +
    // close match group
    ')+',

  // validator for complex selectors in ':not()' pseudo-classes
  extendedValidator = standardValidator.replace(pseudoclass, '.*'),

  // validator for standard selectors as default
  reValidator = new global.RegExp(standardValidator),

  // whitespace is any combination of these 5 character [\x20\t\n\r\f]
  // http://www.w3.org/TR/css3-selectors/#selector-syntax
  reTrimSpaces = new global.RegExp('^' +
    whitespace + '|' + whitespace + '$', 'g'),

  // only allow simple selectors nested in ':not()' pseudo-classes
  reSimpleNot = new global.RegExp('^(' +
    '(?!:not)' +
    '(' + prefixes +
    '|' + identifier +
    '|\\([^()]*\\))+' +
    '|\\[' + attributes + '\\]' +
    ')$'),

  // split comma groups, exclude commas from
  // quotes '' "" and from brackets () [] {}
  reSplitGroup = new global.RegExp('(' +
    '[^,\\\\()[\\]]+' +
    '|' + skipsquare +
    '|' + skipround +
    '|' + skipcurly +
    '|\\\\.' +
    ')+', 'g'),

  // split last, right most, selector group token
  reSplitToken = new global.RegExp('(' +
    '\\[' + attributes + '\\]|' +
    '\\(' + pseudoclass + '\\)|' +
    '\\\\.|[^\\x20\\t\\r\\n\\f>+~])+', 'g'),

  // for in excess whitespace removal
  reWhiteSpace = /[\x20\t\n\r\f]+/g,

  reOptimizeSelector = new global.RegExp(identifier + '|^$'),

  /*----------------------------- FEATURE TESTING ----------------------------*/

  // detect native methods
  isNative = (function() {
    var re = / \w+\(/,
    isnative = String(Object.prototype.toString).replace(re, ' (');
    return function(method) {
      return method && typeof method != 'string' &&
        isnative == String(method).replace(re, ' (');
    };
  })(),

  // NATIVE_XXXXX true if method exist and is callable
  // detect if DOM methods are native in browsers
  NATIVE_FOCUS = isNative(doc.hasFocus),
  NATIVE_QSAPI = isNative(doc.querySelector),
  NATIVE_GEBID = isNative(doc.getElementById),
  NATIVE_GEBTN = isNative(root.getElementsByTagName),
  NATIVE_GEBCN = isNative(root.getElementsByClassName),

  // detect native getAttribute/hasAttribute methods,
  // frameworks extend these to elements, but it seems
  // this does not work for XML namespaced attributes,
  // used to check both getAttribute/hasAttribute in IE
  NATIVE_GET_ATTRIBUTE = isNative(root.getAttribute),
  NATIVE_HAS_ATTRIBUTE = isNative(root.hasAttribute),

  // check if slice() can convert nodelist to array
  // see http://yura.thinkweb2.com/cft/
  NATIVE_SLICE_PROTO =
    (function() {
      var isBuggy = false;
      try {
        isBuggy = !!slice.call(doc.childNodes, 0)[0];
      } catch(e) { }
      return isBuggy;
    })(),

  // supports the new traversal API
  NATIVE_TRAVERSAL_API =
    'nextElementSibling' in root && 'previousElementSibling' in root,

  // BUGGY_XXXXX true if method is feature tested and has known bugs
  // detect buggy gEBID
  BUGGY_GEBID = NATIVE_GEBID ?
    (function() {
      var isBuggy = true, x = 'x' + global.String(+new global.Date),
        a = doc.createElementNS ? 'a' : '<a name="' + x + '">';
      (a = doc.createElement(a)).name = x;
      root.insertBefore(a, root.firstChild);
      isBuggy = !!doc.getElementById(x);
      root.removeChild(a);
      return isBuggy;
    })() :
    true,

  // detect IE gEBTN comment nodes bug
  BUGGY_GEBTN = NATIVE_GEBTN ?
    (function() {
      var div = doc.createElement('div');
      div.appendChild(doc.createComment(''));
      return !!div.getElementsByTagName('*')[0];
    })() :
    true,

  // detect Opera gEBCN second class and/or UTF8 bugs as well as Safari 3.2
  // caching class name results and not detecting when changed,
  // tests are based on the jQuery selector test suite
  BUGGY_GEBCN = NATIVE_GEBCN ?
    (function() {
      var isBuggy, div = doc.createElement('div'), test = '\u53f0\u5317';

      // Opera tests
      div.appendChild(doc.createElement('span')).
        setAttribute('class', test + 'abc ' + test);
      div.appendChild(doc.createElement('span')).
        setAttribute('class', 'x');

      isBuggy = !div.getElementsByClassName(test)[0];

      // Safari test
      div.lastChild.className = test;
      return isBuggy || div.getElementsByClassName(test).length != 2;
    })() :
    true,

  // detect IE bug with dynamic attributes
  BUGGY_GET_ATTRIBUTE = NATIVE_GET_ATTRIBUTE ?
    (function() {
      var input = doc.createElement('input');
      input.setAttribute('value', 5);
      return input.defaultValue != 5;
    })() :
    true,

  // detect IE bug with non-standard boolean attributes
  BUGGY_HAS_ATTRIBUTE = NATIVE_HAS_ATTRIBUTE ?
    (function() {
      var option = doc.createElement('option');
      option.setAttribute('selected', 'selected');
      return !option.hasAttribute('selected');
    })() :
    true,

  // detect Safari bug with selected option elements
  BUGGY_SELECTED =
    (function() {
      var select = doc.createElement('select');
      select.appendChild(doc.createElement('option'));
      return !select.firstChild.selected;
    })(),

  // initialized with the loading context
  // and reset for each different context
  BUGGY_QUIRKS_GEBCN,
  BUGGY_QUIRKS_QSAPI,

  QUIRKS_MODE,
  XML_DOCUMENT,

  // detect Opera browser
  OPERA = /opera/i.test(string.call(global.opera)),

  // skip simple selector optimizations for Opera >= 11
  OPERA_QSAPI = OPERA && global.parseFloat(global.opera.version()) >= 11,

  // check Selector API implementations
  RE_BUGGY_QSAPI = NATIVE_QSAPI ?
    (function() {
      var pattern = new global.Array(), context, element,

      expect = function(selector, element, n) {
        var result = false;
        context.appendChild(element);
        try { result = context.querySelectorAll(selector).length == n; } catch(e) { }
        while (context.firstChild) { context.removeChild(context.firstChild); }
        return result;
      };

      // certain bugs can only be detected in standard documents
      // to avoid writing a live loading document create a fake one
      if (doc.implementation && doc.implementation.createDocument) {
        // use a shadow document body as context
        context = doc.implementation.createDocument('', '', null).
          appendChild(doc.createElement('html')).
          appendChild(doc.createElement('head')).parentNode.
          appendChild(doc.createElement('body'));
      } else {
        // use an unattached div node as context
        context = doc.createElement('div');
      }

      // fix for Safari 8.x and other engines that
      // fail querying filtered sibling combinators
      element = doc.createElement('div');
      element.innerHTML = '<p id="a"></p><br>';
      expect('p#a+*', element, 0) &&
        pattern.push('\\w+#\\w+.*[+~]');

      // ^= $= *= operators bugs with empty values (Opera 10 / IE8)
      element = doc.createElement('p');
      element.setAttribute('class', '');
      expect('[class^=""]', element, 1) &&
        pattern.push('[*^$]=[\\x20\\t\\n\\r\\f]*(?:""|' + "'')");

      // :checked bug with option elements (Firefox 3.6.x)
      // it wrongly includes 'selected' options elements
      // HTML5 rules says selected options also match
      element = doc.createElement('option');
      element.setAttribute('selected', 'selected');
      expect(':checked', element, 0) &&
        pattern.push(':checked');

      // :enabled :disabled bugs with hidden fields (Firefox 3.5)
      // http://www.w3.org/TR/html5/links.html#selector-enabled
      // http://www.w3.org/TR/css3-selectors/#enableddisabled
      // not supported by IE8 Query Selector
      element = doc.createElement('input');
      element.setAttribute('type', 'hidden');
      expect(':enabled', element, 0) &&
        pattern.push(':enabled', ':disabled');

      // :link bugs with hyperlinks matching (Firefox/Safari)
      element = doc.createElement('link');
      element.setAttribute('href', 'x');
      expect(':link', element, 1) ||
        pattern.push(':link');

      // avoid attribute selectors for IE QSA
      if (BUGGY_HAS_ATTRIBUTE) {
        // IE fails in reading:
        // - original values for input/textarea
        // - original boolean values for controls
        pattern.push('\\[[\\x20\\t\\n\\r\\f]*(?:checked|disabled|ismap|multiple|readonly|selected|value)');
      }

      return pattern.length ?
        new global.RegExp(pattern.join('|')) :
        { 'test': function() { return false; } };

    })() :
    true,

  // matches class selectors
  RE_CLASS = new global.RegExp('(?:\\[[\\x20\\t\\n\\r\\f]*class\\b|\\.' + identifier + ')'),

  // matches simple id, tag & class selectors
  RE_SIMPLE_SELECTOR = new global.RegExp(
    BUGGY_GEBTN && BUGGY_GEBCN || OPERA ?
      '^#?-?[_a-zA-Z]{1}' + encoding + '*$' : BUGGY_GEBTN ?
      '^[.#]?-?[_a-zA-Z]{1}' + encoding + '*$' : BUGGY_GEBCN ?
      '^(?:\\*|#-?[_a-zA-Z]{1}' + encoding + '*)$' :
      '^(?:\\*|[.#]?-?[_a-zA-Z]{1}' + encoding + '*)$'),

  /*----------------------------- LOOKUP OBJECTS -----------------------------*/

  LINK_NODES = new global.Object({ 'a': 1, 'A': 1, 'area': 1, 'AREA': 1, 'link': 1, 'LINK': 1 }),

  // boolean attributes should return attribute name instead of true/false
  ATTR_BOOLEAN = new global.Object({
    'checked': 1, 'disabled': 1, 'ismap': 1,
    'multiple': 1, 'readonly': 1, 'selected': 1
  }),

  // dynamic attributes that needs to be checked against original HTML value
  ATTR_DEFAULT = new global.Object({
    'value': 'defaultValue',
    'checked': 'defaultChecked',
    'selected': 'defaultSelected'
  }),

  // attributes referencing URI data values need special treatment in IE
  ATTR_URIDATA = new global.Object({
    'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
    'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
  }),

  // HTML 5 draft specifications
  // http://www.whatwg.org/specs/web-apps/current-work/#selectors
  HTML_TABLE = new global.Object({
    // class attribute must be treated case-insensitive in HTML quirks mode
    // initialized by default to Standard Mode (case-sensitive),
    // set dynamically by the attribute resolver
    'class': 0,
    'accept': 1, 'accept-charset': 1, 'align': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'checked': 1, 'clear': 1, 'codetype': 1, 'color': 1,
    'compact': 1, 'declare': 1, 'defer': 1, 'dir': 1, 'direction': 1, 'disabled': 1,
    'enctype': 1, 'face': 1, 'frame': 1, 'hreflang': 1, 'http-equiv': 1, 'lang': 1,
    'language': 1, 'link': 1, 'media': 1, 'method': 1, 'multiple': 1, 'nohref': 1,
    'noresize': 1, 'noshade': 1, 'nowrap': 1, 'readonly': 1, 'rel': 1, 'rev': 1,
    'rules': 1, 'scope': 1, 'scrolling': 1, 'selected': 1, 'shape': 1, 'target': 1,
    'text': 1, 'type': 1, 'valign': 1, 'valuetype': 1, 'vlink': 1
  }),

  // the following attributes must be treated case-insensitive in XHTML mode
  // Niels Leenheer http://rakaz.nl/item/css_selector_bugs_case_sensitivity
  XHTML_TABLE = new global.Object({
    'accept': 1, 'accept-charset': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'codetype': 1, 'color': 1,
    'enctype': 1, 'face': 1, 'hreflang': 1, 'http-equiv': 1,
    'lang': 1, 'language': 1, 'link': 1, 'media': 1, 'rel': 1,
    'rev': 1, 'target': 1, 'text': 1, 'type': 1, 'vlink': 1
  }),

  /*-------------------------- REGULAR EXPRESSIONS ---------------------------*/

  // placeholder to add functionalities
  Selectors = new global.Object({
    // as a simple example this will check
    // for chars not in standard ascii table
    //
    // 'mySpecialSelector': {
    //  'Expression': /\u0080-\uffff/,
    //  'Callback': mySelectorCallback
    // }
    //
    // 'mySelectorCallback' will be invoked
    // only after passing all other standard
    // checks and only if none of them worked
  }),

  // attribute operators
  Operators = new global.Object({
     '=': "n=='%m'",
    '^=': "n.indexOf('%m')==0",
    '*=': "n.indexOf('%m')>-1",
    '|=': "(n+'-').indexOf('%m-')==0",
    '~=': "(' '+n+' ').indexOf(' %m ')>-1",
    '$=': "n.substr(n.length-'%m'.length)=='%m'"
  }),

  // optimization expressions
  Optimize = new global.Object({
    ID: new global.RegExp('^\\*?#(' + encoding + '+)|' + skipgroup),
    TAG: new global.RegExp('^(' + encoding + '+)|' + skipgroup),
    CLASS: new global.RegExp('^\\*?\\.(' + encoding + '+$)|' + skipgroup)
  }),

  // precompiled Regular Expressions
  Patterns = new global.Object({
    // structural pseudo-classes and child selectors
    spseudos: /^\:(root|empty|(?:first|last|only)(?:-child|-of-type)|nth(?:-last)?(?:-child|-of-type)\(\s*(even|odd|(?:[-+]{0,1}\d*n\s*)?[-+]{0,1}\s*\d*)\s*\))?(.*)/i,
    // uistates + dynamic + negation pseudo-classes
    dpseudos: /^\:(link|visited|target|active|focus|hover|checked|disabled|enabled|selected|lang\(([-\w]{2,})\)|not\(([^()]*|.*)\))?(.*)/i,
    // element attribute matcher
    attribute: new global.RegExp('^\\[' + attrmatcher + '\\](.*)'),
    // E > F
    children: /^[\x20\t\n\r\f]*\>[\x20\t\n\r\f]*(.*)/,
    // E + F
    adjacent: /^[\x20\t\n\r\f]*\+[\x20\t\n\r\f]*(.*)/,
    // E ~ F
    relative: /^[\x20\t\n\r\f]*\~[\x20\t\n\r\f]*(.*)/,
    // E F
    ancestor: /^[\x20\t\n\r\f]+(.*)/,
    // all
    universal: /^\*(.*)/,
    // id
    id: new global.RegExp('^#(' + encoding + '+)(.*)'),
    // tag
    tagName: new global.RegExp('^(' + encoding + '+)(.*)'),
    // class
    className: new global.RegExp('^\\.(' + encoding + '+)(.*)')
  }),

  /*------------------------------ UTIL METHODS ------------------------------*/

  // concat elements to data
  concatList =
    function(data, elements) {
      var i = -1, element;
      if (!data.length && global.Array.slice)
        return global.Array.slice(elements);
      while ((element = elements[++i]))
        data[data.length] = element;
      return data;
    },

  // concat elements to data and callback
  concatCall =
    function(data, elements, callback) {
      var i = -1, element;
      while ((element = elements[++i])) {
        if (false === callback(data[data.length] = element)) { break; }
      }
      return data;
    },

  // change context specific variables
  switchContext =
    function(from, force) {
      var div, oldDoc = doc;
      // save passed context
      lastContext = from;
      // set new context document
      doc = from.ownerDocument || from;
      if (force || oldDoc !== doc) {
        // set document root
        root = doc.documentElement;
        // set host environment flags
        XML_DOCUMENT = doc.createElement('DiV').nodeName == 'DiV';

        // In quirks mode css class names are case insensitive.
        // In standards mode they are case sensitive. See docs:
        // https://developer.mozilla.org/en/Mozilla_Quirks_Mode_Behavior
        // http://www.whatwg.org/specs/web-apps/current-work/#selectors
        QUIRKS_MODE = !XML_DOCUMENT &&
          typeof doc.compatMode == 'string' ?
          doc.compatMode.indexOf('CSS') < 0 :
          (function() {
            var style = doc.createElement('div').style;
            return style && (style.width = 1) && style.width == '1px';
          })();

        div = doc.createElement('div');
        div.appendChild(doc.createElement('p')).setAttribute('class', 'xXx');
        div.appendChild(doc.createElement('p')).setAttribute('class', 'xxx');

        // GEBCN buggy in quirks mode, match count is:
        // Firefox 3.0+ [xxx = 1, xXx = 1]
        // Opera 10.63+ [xxx = 0, xXx = 2]
        BUGGY_QUIRKS_GEBCN =
          !XML_DOCUMENT && NATIVE_GEBCN && QUIRKS_MODE &&
          (div.getElementsByClassName('xxx').length != 2 ||
          div.getElementsByClassName('xXx').length != 2);

        // QSAPI buggy in quirks mode, match count is:
        // At least Chrome 4+, Firefox 3.5+, Opera 10.x+, Safari 4+ [xxx = 1, xXx = 2]
        // Safari 3.2 QSA doesn't work with mixedcase in quirksmode [xxx = 1, xXx = 0]
        // https://bugs.webkit.org/show_bug.cgi?id=19047
        // must test the attribute selector '[class~=xxx]'
        // before '.xXx' or the bug may not present itself
        BUGGY_QUIRKS_QSAPI =
          !XML_DOCUMENT && NATIVE_QSAPI && QUIRKS_MODE &&
          (div.querySelectorAll('[class~=xxx]').length != 2 ||
          div.querySelectorAll('.xXx').length != 2);

        Config.CACHING && Dom.setCache(true, doc);
      }
    },

  // convert a CSS string or identifier containing escape sequence to a
  // javascript string with javascript escape sequences
  convertEscapes =
    function(str) {
      return str.replace(/\\([0-9a-fA-F]{1,6}\x20?|.)|([\x22\x27])/g, function(substring, p1, p2) {
        var codePoint, highHex, highSurrogate, lowHex, lowSurrogate;

        if (p2) {
          // unescaped " or '
          return '\\' + p2;
        }

        if (/^[0-9a-fA-F]/.test(p1)) {
          // \1f23
          codePoint = parseInt(p1, 16);

          if (codePoint < 0 || codePoint > 0x10ffff) {
            // the replacement character
            return '\\ufffd';
          }

          // javascript strings are in UTF-16
          if (codePoint <= 0xffff) {
            // Basic
            lowHex = '000' + codePoint.toString(16);
            return '\\u' + lowHex.substr(lowHex.length - 4);
          }

          // Supplementary
          codePoint -= 0x10000;
          highSurrogate = (codePoint >> 10) + 0xd800;
          lowSurrogate = (codePoint % 0x400) + 0xdc00;
          highHex = '000' + highSurrogate.toString(16);
          lowHex = '000' + lowSurrogate.toString(16);

          return '\\u' + highHex.substr(highHex.length - 4) +
            '\\u' + lowHex.substr(lowHex.length - 4);
        }

        if (/^[\\\x22\x27]/.test(p1)) {
          // \' \"
          return substring;
        }

        // \g \h \. \# etc
        return p1;
      });
    },

  /*------------------------------ DOM METHODS -------------------------------*/

  // element by id (raw)
  // @return reference or null
  byIdRaw =
    function(id, elements) {
      var i = -1, element = null;
      while ((element = elements[++i])) {
        if (element.getAttribute('id') == id) {
          break;
        }
      }
      return element;
    },

  // element by id
  // @return reference or null
  _byId = !BUGGY_GEBID ?
    function(id, from) {
      id = id.replace(/\\([^\\]{1})/g, '$1');
      return from.getElementById && from.getElementById(id) ||
        byIdRaw(id, from.getElementsByTagName('*'));
    } :
    function(id, from) {
      var element = null;
      id = id.replace(/\\([^\\]{1})/g, '$1');
      if (XML_DOCUMENT || from.nodeType != 9) {
        return byIdRaw(id, from.getElementsByTagName('*'));
      }
      if ((element = from.getElementById(id)) &&
        element.name == id && from.getElementsByName) {
        return byIdRaw(id, from.getElementsByName(id));
      }
      return element;
    },

  // publicly exposed byId
  // @return reference or null
  byId =
    function(id, from) {
      from || (from = doc);
      if (lastContext !== from) { switchContext(from); }
      return _byId(id, from);
    },

  // elements by tag (raw)
  // @return array
  byTagRaw =
    function(tag, from) {
      var any = tag == '*', element = from, elements = new global.Array(), next = element.firstChild;
      any || (tag = tag.toUpperCase());
      while ((element = next)) {
        if (element.tagName > '@' && (any || element.tagName.toUpperCase() == tag)) {
          elements[elements.length] = element;
        }
        if ((next = element.firstChild || element.nextSibling)) continue;
        while (!next && (element = element.parentNode) && element !== from) {
          next = element.nextSibling;
        }
      }
      return elements;
    },

  // elements by tag
  // @return array
  _byTag = !BUGGY_GEBTN && NATIVE_SLICE_PROTO ?
    function(tag, from) {
      return XML_DOCUMENT || from.nodeType == 11 ? byTagRaw(tag, from) :
        slice.call(from.getElementsByTagName(tag), 0);
    } :
    function(tag, from) {
      var i = -1, j = i, data = new global.Array(),
        element, elements = from.getElementsByTagName(tag);
      if (tag == '*') {
        while ((element = elements[++i])) {
          if (element.nodeName > '@')
            data[++j] = element;
        }
      } else {
        while ((element = elements[++i])) {
          data[i] = element;
        }
      }
      return data;
    },

  // publicly exposed byTag
  // @return array
  byTag =
    function(tag, from) {
      from || (from = doc);
      if (lastContext !== from) { switchContext(from); }
      return _byTag(tag, from);
    },

  // publicly exposed byName
  // @return array
  byName =
    function(name, from) {
      return select('[name="' + name.replace(/\\([^\\]{1})/g, '$1') + '"]', from);
    },

  // elements by class (raw)
  // @return array
  byClassRaw =
    function(name, from) {
      var i = -1, j = i, data = new global.Array(), element, elements = _byTag('*', from), n;
      name = ' ' + (QUIRKS_MODE ? name.toLowerCase() : name).replace(/\\([^\\]{1})/g, '$1') + ' ';
      while ((element = elements[++i])) {
        n = XML_DOCUMENT ? element.getAttribute('class') : element.className;
        if (n && n.length && (' ' + (QUIRKS_MODE ? n.toLowerCase() : n).
          replace(reWhiteSpace, ' ') + ' ').indexOf(name) > -1) {
          data[++j] = element;
        }
      }
      return data;
    },

  // elements by class
  // @return array
  _byClass =
    function(name, from) {
      return (BUGGY_GEBCN || BUGGY_QUIRKS_GEBCN || XML_DOCUMENT || !from.getElementsByClassName) ?
        byClassRaw(name, from) : slice.call(from.getElementsByClassName(name.replace(/\\([^\\]{1})/g, '$1')), 0);
    },

  // publicly exposed byClass
  // @return array
  byClass =
    function(name, from) {
      from || (from = doc);
      if (lastContext !== from) { switchContext(from); }
      return _byClass(name, from);
    },

  // check element is descendant of container
  // @return boolean
  contains = 'compareDocumentPosition' in root ?
    function(container, element) {
      return (container.compareDocumentPosition(element) & 16) == 16;
    } : 'contains' in root ?
    function(container, element) {
      return container !== element && container.contains(element);
    } :
    function(container, element) {
      while ((element = element.parentNode)) {
        if (element === container) return true;
      }
      return false;
    },

  // attribute value
  // @return string
  getAttribute = !BUGGY_GET_ATTRIBUTE ?
    function(node, attribute) {
      return node.getAttribute(attribute);
    } :
    function(node, attribute) {
      attribute = attribute.toLowerCase();
      if (typeof node[attribute] == 'object') {
        return node.attributes[attribute] &&
          node.attributes[attribute].value;
      }
      return (
        // 'type' can only be read by using native getAttribute
        attribute == 'type' ? node.getAttribute(attribute) :
        // specific URI data attributes (parameter 2 to fix IE bug)
        ATTR_URIDATA[attribute] ? node.getAttribute(attribute, 2) :
        // boolean attributes should return name instead of true/false
        ATTR_BOOLEAN[attribute] ? node.getAttribute(attribute) ? attribute : 'false' :
          (node = node.getAttributeNode(attribute)) && node.value);
    },

  // attribute presence
  // @return boolean
  hasAttribute = !BUGGY_HAS_ATTRIBUTE ?
    function(node, attribute) {
      return XML_DOCUMENT ?
        !!node.getAttribute(attribute) :
        node.hasAttribute(attribute);
    } :
    function(node, attribute) {
      // read the node attribute object
      var obj = node.getAttributeNode(attribute = attribute.toLowerCase());
      return ATTR_DEFAULT[attribute] && attribute != 'value' ?
        node[ATTR_DEFAULT[attribute]] : obj && obj.specified;
    },

  // check node emptyness
  // @return boolean
  isEmpty =
    function(node) {
      node = node.firstChild;
      while (node) {
        if (node.nodeType == 3 || node.nodeName > '@') return false;
        node = node.nextSibling;
      }
      return true;
    },

  // check if element matches the :link pseudo
  // @return boolean
  isLink =
    function(element) {
      return hasAttribute(element,'href') && LINK_NODES[element.nodeName];
    },

  // child position by nodeType
  // @return number
  nthElement =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling';
      while ((element = element[succ])) {
        if (element.nodeName > '@') ++count;
      }
      return count;
    },

  // child position by nodeName
  // @return number
  nthOfType =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling', type = element.nodeName;
      while ((element = element[succ])) {
        if (element.nodeName == type) ++count;
      }
      return count;
    },

  /*------------------------------- DEBUGGING --------------------------------*/

  // get/set (string/object) working modes
  configure =
    function(option) {
      if (typeof option == 'string') { return Config[option] || Config; }
      if (typeof option != 'object') { return false; }
      for (var i in option) {
        Config[i] = !!option[i];
        if (i == 'SIMPLENOT') {
          matchContexts = new global.Object();
          matchResolvers = new global.Object();
          selectContexts = new global.Object();
          selectResolvers = new global.Object();
          if (!Config[i]) { Config['USE_QSAPI'] = false; }
        } else if (i == 'USE_QSAPI') {
          Config[i] = !!option[i] && NATIVE_QSAPI;
        }
      }
      reValidator = new global.RegExp(Config.SIMPLENOT ?
        standardValidator : extendedValidator);
      return true;
    },

  // control user notifications
  emit =
    function(message) {
      if (Config.VERBOSITY) { throw new global.Error(message); }
      if (global.console && global.console.log) {
        global.console.log(message);
      }
    },

  Config = new global.Object({

    // used to enable/disable caching of result sets
    CACHING: false,

    // by default do not add missing left/right context
    // to selector string shortcuts like "+div" or "ul>"
    // callable Dom.shortcuts method has to be available
    SHORTCUTS: false,

    // by default disable complex selectors nested in
    // ':not()' pseudo-classes, as for specifications
    SIMPLENOT: true,

    // strict QSA match all non-unique IDs (false)
    // speed & libs compat match unique ID (true)
    UNIQUE_ID: true,

    // HTML5 handling for the ":checked" pseudo-class
    USE_HTML5: true,

    // controls enabling the Query Selector API branch
    USE_QSAPI: NATIVE_QSAPI,

    // controls the engine error/warning notifications
    VERBOSITY: true

  }),

  /*---------------------------- COMPILER METHODS ----------------------------*/

  // code string reused to build compiled functions
  ACCEPT_NODE = 'r[r.length]=c[k];if(f&&false===f(c[k]))break main;else continue main;',

  // compile a comma separated group of selector
  // @mode boolean true for select, false for match
  // return a compiled function
  compile =
    function(selector, source, mode) {

      var parts = typeof selector == 'string' ? selector.match(reSplitGroup) : selector;

      // ensures that source is a string
      typeof source == 'string' || (source = '');

      if (parts.length == 1) {
        source += compileSelector(parts[0], mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
      } else {
        // for each selector in the group
        var i = -1, seen = new global.Object(), token;
        while ((token = parts[++i])) {
          token = token.replace(reTrimSpaces, '');
          // avoid repeating the same token
          // in comma separated group (p, p)
          if (!seen[token] && (seen[token] = true)) {
            source += compileSelector(token, mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
          }
        }
      }

      if (mode) {
        // for select method
        return new global.Function('c,s,r,d,h,g,f,v',
          'var N,n,x=0,k=-1,e;main:while((e=c[++k])){' + source + '}return r;');
      } else {
        // for match method
        return new global.Function('e,s,r,d,h,g,f,v',
          'var N,n,x=0,k=e;' + source + 'return false;');
      }
    },

  // allows to cache already visited nodes
  FILTER =
    'var z=v[@]||(v[@]=[]),l=z.length-1;' +
    'while(l>=0&&z[l]!==e)--l;' +
    'if(l!==-1){break;}' +
    'z[z.length]=e;',

  // compile a CSS3 string selector into ad-hoc javascript matching function
  // @return string (to be compiled)
  compileSelector =
    function(selector, source, mode) {

      var a, b, n, k = 0, expr, match, result, status, test, type;

      while (selector) {

        k++;

        // *** Universal selector
        // * match all (empty block, do not remove)
        if ((match = selector.match(Patterns.universal))) {
          // do nothing, handled in the compiler where
          // BUGGY_GEBTN return comment nodes (ex: IE)
          expr = '';
        }

        // *** ID selector
        // #Foo Id case sensitive
        else if ((match = selector.match(Patterns.id))) {
          // document can contain conflicting elements (id/name)
          // prototype selector unit need this method to recover bad HTML forms
          source = 'if(' + (XML_DOCUMENT ?
            's.getAttribute(e,"id")' :
            '(e.submit?s.getAttribute(e,"id"):e.id)') +
            '=="' + match[1] + '"' +
            '){' + source + '}';
        }

        // *** Type selector
        // Foo Tag (case insensitive)
        else if ((match = selector.match(Patterns.tagName))) {
          // both tagName and nodeName properties may be upper/lower case
          // depending on their creation NAMESPACE in createElementNS()
          source = 'if(e.nodeName' + (XML_DOCUMENT ?
            '=="' + match[1] + '"' : '.toUpperCase()' +
            '=="' + match[1].toUpperCase() + '"') +
            '){' + source + '}';
        }

        // *** Class selector
        // .Foo Class (case sensitive)
        else if ((match = selector.match(Patterns.className))) {
          // W3C CSS3 specs: element whose "class" attribute has been assigned a
          // list of whitespace-separated values, see section 6.4 Class selectors
          // and notes at the bottom; explicitly non-normative in this specification.
          source = 'if((n=' + (XML_DOCUMENT ?
            's.getAttribute(e,"class")' : 'e.className') +
            ')&&n.length&&(" "+' + (QUIRKS_MODE ? 'n.toLowerCase()' : 'n') +
            '.replace(' + reWhiteSpace + '," ")+" ").indexOf(" ' +
            (QUIRKS_MODE ? match[1].toLowerCase() : match[1]) + ' ")>-1' +
            '){' + source + '}';
        }

        // *** Attribute selector
        // [attr] [attr=value] [attr="value"] [attr='value'] and !=, *=, ~=, |=, ^=, $=
        // case sensitivity is treated differently depending on the document type (see map)
        else if ((match = selector.match(Patterns.attribute))) {

          // xml namespaced attribute ?
          expr = match[1].split(':');
          expr = expr.length == 2 ? expr[1] : expr[0] + '';

          if (match[2] && !Operators[match[2]]) {
            emit('Unsupported operator in attribute selectors "' + selector + '"');
            return '';
          }

          test = 'false';

          // replace Operators parameter if needed
          if (match[2] && match[4] && (test = Operators[match[2]])) {
            match[4] = convertEscapes(match[4]);
            // case treatment depends on document
            HTML_TABLE['class'] = QUIRKS_MODE ? 1 : 0;
            type = (XML_DOCUMENT ? XHTML_TABLE : HTML_TABLE)[expr.toLowerCase()];
            test = test.replace(/\%m/g, type ? match[4].toLowerCase() : match[4]);
          } else if (match[2] == '!=' || match[2] == '=') {
            test = 'n' + match[2] + '=""';
          }

          source = 'if(n=s.hasAttribute(e,"' + match[1] + '")){' +
            (match[2] ? 'n=s.getAttribute(e,"' + match[1] + '")' : '') +
            (type && match[2] ? '.toLowerCase();' : ';') +
            'if(' + (match[2] ? test : 'n') + '){' + source + '}}';

        }

        // *** Adjacent sibling combinator
        // E + F (F adiacent sibling of E)
        else if ((match = selector.match(Patterns.adjacent))) {
          source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
          source = NATIVE_TRAVERSAL_API ?
            'var N' + k + '=e;while(e&&(e=e.previousElementSibling)){' + source + 'break;}e=N' + k + ';' :
            'var N' + k + '=e;while(e&&(e=e.previousSibling)){if(e.nodeName>"@"){' + source + 'break;}}e=N' + k + ';';
        }

        // *** General sibling combinator
        // E ~ F (F relative sibling of E)
        else if ((match = selector.match(Patterns.relative))) {
          source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
          source = NATIVE_TRAVERSAL_API ?
            ('var N' + k + '=e;e=e.parentNode.firstElementChild;' +
            'while(e&&e!==N' + k + '){' + source + 'e=e.nextElementSibling;}e=N' + k + ';') :
            ('var N' + k + '=e;e=e.parentNode.firstChild;' +
            'while(e&&e!==N' + k + '){if(e.nodeName>"@"){' + source + '}e=e.nextSibling;}e=N' + k + ';');
        }

        // *** Child combinator
        // E > F (F children of E)
        else if ((match = selector.match(Patterns.children))) {
          source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
          source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + 'break;}e=N' + k + ';';
        }

        // *** Descendant combinator
        // E F (E ancestor of F)
        else if ((match = selector.match(Patterns.ancestor))) {
          source = (mode ? '' : FILTER.replace(/@/g, k)) + source;
          source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
        }

        // *** Structural pseudo-classes
        // :root, :empty,
        // :first-child, :last-child, :only-child,
        // :first-of-type, :last-of-type, :only-of-type,
        // :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-of-type()
        else if ((match = selector.match(Patterns.spseudos)) && match[1]) {

          switch (match[1]) {
            case 'root':
              // element root of the document
              if (match[3]) {
                source = 'if(e===h||s.contains(h,e)){' + source + '}';
              } else {
                source = 'if(e===h){' + source + '}';
              }
              break;

            case 'empty':
              // element that has no children
              source = 'if(s.isEmpty(e)){' + source + '}';
              break;

            default:
              if (match[1] && match[2]) {
                if (match[2] == 'n') {
                  source = 'if(e!==h){' + source + '}';
                  break;
                } else if (match[2] == 'even') {
                  a = 2;
                  b = 0;
                } else if (match[2] == 'odd') {
                  a = 2;
                  b = 1;
                } else {
                  // assumes correct "an+b" format, "b" before "a" to keep "n" values
                  b = ((n = match[2].match(/(-?\d+)$/)) ? global.parseInt(n[1], 10) : 0);
                  a = ((n = match[2].match(/(-?\d*)n/i)) ? global.parseInt(n[1], 10) : 0);
                  if (n && n[1] == '-') a = -1;
                }

                // build test expression out of structural pseudo (an+b) parameters
                // see here: http://www.w3.org/TR/css3-selectors/#nth-child-pseudo
                test = a > 1 ?
                  (/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
                  'n>=' + b + '&&(n-(' + b + '))%' + a + '==0' : a < -1 ?
                  (/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
                  'n<=' + b + '&&(n-(' + b + '))%' + a + '==0' : a === 0 ?
                  'n==' + b : a == -1 ? 'n<=' + b : 'n>=' + b;

                // 4 cases: 1 (nth) x 4 (child, of-type, last-child, last-of-type)
                source =
                  'if(e!==h){' +
                    'n=s[' + (/-of-type/i.test(match[1]) ? '"nthOfType"' : '"nthElement"') + ']' +
                      '(e,' + (/last/i.test(match[1]) ? 'true' : 'false') + ');' +
                    'if(' + test + '){' + source + '}' +
                  '}';

              } else {
                // 6 cases: 3 (first, last, only) x 1 (child) x 2 (-of-type)
                a = /first/i.test(match[1]) ? 'previous' : 'next';
                n = /only/i.test(match[1]) ? 'previous' : 'next';
                b = /first|last/i.test(match[1]);

                type = /-of-type/i.test(match[1]) ? '&&n.nodeName!=e.nodeName' : '&&n.nodeName<"@"';

                source = 'if(e!==h){' +
                  ( 'n=e;while((n=n.' + a + 'Sibling)' + type + ');if(!n){' + (b ? source :
                    'n=e;while((n=n.' + n + 'Sibling)' + type + ');if(!n){' + source + '}') + '}' ) + '}';
              }
              break;
          }

        }

        // *** negation, user action and target pseudo-classes
        // *** UI element states and dynamic pseudo-classes
        // CSS3 :not, :checked, :enabled, :disabled, :target
        // CSS3 :active, :hover, :focus
        // CSS3 :link, :visited
        else if ((match = selector.match(Patterns.dpseudos)) && match[1]) {

          switch (match[1].match(/^\w+/)[0]) {
            // CSS3 negation pseudo-class
            case 'not':
              // compile nested selectors, DO NOT pass the callback parameter
              // SIMPLENOT allow disabling complex selectors nested
              // in ':not()' pseudo-classes, breaks some test units
              expr = match[3].replace(reTrimSpaces, '');

              if (Config.SIMPLENOT && !reSimpleNot.test(expr)) {
                // see above, log error but continue execution
                emit('Negation pseudo-class only accepts simple selectors "' + selector + '"');
                return '';
              } else {
                if ('compatMode' in doc) {
                  source = 'if(!' + compile(expr, '', false) + '(e,s,r,d,h,g)){' + source + '}';
                } else {
                  source = 'if(!s.match(e, "' + expr.replace(/\x22/g, '\\"') + '",g)){' + source +'}';
                }
              }
              break;

            // CSS3 UI element states
            case 'checked':
              // for radio buttons checkboxes (HTML4) and options (HTML5)
              source = 'if((typeof e.form!=="undefined"&&(/^(?:radio|checkbox)$/i).test(e.type)&&e.checked)' +
                (Config.USE_HTML5 ? '||(/^option$/i.test(e.nodeName)&&(e.selected||e.checked))' : '') +
                '){' + source + '}';
              break;
            case 'disabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!=="undefined"' +
                (Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
                ')||s.isLink(e))&&e.disabled===true){' + source + '}';
              break;
            case 'enabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!=="undefined"' +
                (Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
                ')||s.isLink(e))&&e.disabled===false){' + source + '}';
              break;

            // CSS3 lang pseudo-class
            case 'lang':
              test = '';
              if (match[2]) test = match[2].substr(0, 2) + '-';
              source = 'do{(n=e.lang||"").toLowerCase();' +
                'if((n==""&&h.lang=="' + match[2].toLowerCase() + '")||' +
                '(n&&(n=="' + match[2].toLowerCase() +
                '"||n.substr(0,3)=="' + test.toLowerCase() + '")))' +
                '{' + source + 'break;}}while((e=e.parentNode)&&e!==g);';
              break;

            // CSS3 target pseudo-class
            case 'target':
              source = 'if(e.id==d.location.hash.slice(1)){' + source + '}';
              break;

            // CSS3 dynamic pseudo-classes
            case 'link':
              source = 'if(s.isLink(e)&&!e.visited){' + source + '}';
              break;
            case 'visited':
              source = 'if(s.isLink(e)&&e.visited){' + source + '}';
              break;

            // CSS3 user action pseudo-classes IE & FF3 have native support
            // these capabilities may be emulated by some event managers
            case 'active':
              if (XML_DOCUMENT) break;
              source = 'if(e===d.activeElement){' + source + '}';
              break;
            case 'hover':
              if (XML_DOCUMENT) break;
              source = 'if(e===d.hoverElement){' + source + '}';
              break;
            case 'focus':
              if (XML_DOCUMENT) break;
              source = NATIVE_FOCUS ?
                'if(e===d.activeElement&&d.hasFocus()&&(e.type||e.href||typeof e.tabIndex=="number")){' + source + '}' :
                'if(e===d.activeElement&&(e.type||e.href)){' + source + '}';
              break;

            // CSS2 selected pseudo-classes, not part of current CSS3 drafts
            // the 'selected' property is only available for option elements
            case 'selected':
              // fix Safari selectedIndex property bug
              expr = BUGGY_SELECTED ? '||(n=e.parentNode)&&n.options[n.selectedIndex]===e' : '';
              source = 'if(/^option$/i.test(e.nodeName)&&(e.selected||e.checked' + expr + ')){' + source + '}';
              break;

            default:
              break;
          }

        }

        else {

          // this is where external extensions are
          // invoked if expressions match selectors
          expr = false;
          status = false;
          for (expr in Selectors) {
            if ((match = selector.match(Selectors[expr].Expression)) && match[1]) {
              result = Selectors[expr].Callback(match, source);
              source = result.source;
              status = result.status;
              if (status) { break; }
            }
          }

          // if an extension fails to parse the selector
          // it must return a false boolean in "status"
          if (!status) {
            // log error but continue execution, don't throw real exceptions
            // because blocking following processes maybe is not a good idea
            emit('Unknown pseudo-class selector "' + selector + '"');
            return '';
          }

          if (!expr) {
            // see above, log error but continue execution
            emit('Unknown token in selector "' + selector + '"');
            return '';
          }

        }

        // error if no matches found by the pattern scan
        if (!match) {
          emit('Invalid syntax in selector "' + selector + '"');
          return '';
        }

        // ensure "match" is not null or empty since
        // we do not throw real DOMExceptions above
        selector = match && match[match.length - 1];
      }

      return source;
    },

  /*----------------------------- QUERY METHODS ------------------------------*/

  // match element with selector
  // @return boolean
  match =
    function(element, selector, from, callback) {

      var parts;

      if (!(element && element.nodeType == 1)) {
        emit('Invalid element argument');
        return false;
      } else if (typeof selector != 'string') {
        emit('Invalid selector argument');
        return false;
      } else if (from && from.nodeType == 1 && !contains(from, element)) {
        return false;
      } else if (lastContext !== from) {
        // reset context data when it changes
        // and ensure context is set to a default
        switchContext(from || (from = element.ownerDocument));
      }

      selector = selector.replace(reTrimSpaces, '');

      Config.SHORTCUTS && (selector = Dom.shortcuts(selector, element, from));

      if (lastMatcher != selector) {
        // process valid selector strings
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleMatch = (parts = selector.match(reSplitGroup)).length < 2;
          // save passed selector
          lastMatcher = selector;
          lastPartsMatch = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return false;
        }
      } else parts = lastPartsMatch;

      // compile matcher resolvers if necessary
      if (!matchResolvers[selector] || matchContexts[selector] !== from) {
        matchResolvers[selector] = compile(isSingleMatch ? [selector] : parts, '', false);
        matchContexts[selector] = from;
      }

      return matchResolvers[selector](element, Snapshot, [ ], doc, root, from, callback, new global.Object());
    },

  // select only the first element
  // matching selector (document ordered)
  first =
    function(selector, from) {
      return select(selector, from, function() { return false; })[0] || null;
    },

  // select elements matching selector
  // using new Query Selector API
  // or cross-browser client API
  // @return array
  select =
    function(selector, from, callback) {

      var i, changed, element, elements, parts, token, original = selector;

      if (arguments.length === 0) {
        emit('Not enough arguments');
        return [ ];
      } else if (typeof selector != 'string') {
        return [ ];
      } else if (from && !(/1|9|11/).test(from.nodeType)) {
        emit('Invalid or illegal context element');
        return [ ];
      } else if (lastContext !== from) {
        // reset context data when it changes
        // and ensure context is set to a default
        switchContext(from || (from = doc));
      }

      if (Config.CACHING && (elements = Dom.loadResults(original, from, doc, root))) {
        return callback ? concatCall([ ], elements, callback) : elements;
      }

      if (!OPERA_QSAPI && RE_SIMPLE_SELECTOR.test(selector)) {
        switch (selector.charAt(0)) {
          case '#':
            if (Config.UNIQUE_ID) {
              elements = (element = _byId(selector.slice(1), from)) ? [ element ] : [ ];
            }
            break;
          case '.':
            elements = _byClass(selector.slice(1), from);
            break;
          default:
            elements = _byTag(selector, from);
            break;
        }
      }

      else if (!XML_DOCUMENT && Config.USE_QSAPI &&
        !(BUGGY_QUIRKS_QSAPI && RE_CLASS.test(selector)) &&
        !RE_BUGGY_QSAPI.test(selector)) {
        try {
          elements = from.querySelectorAll(selector);
        } catch(e) { }
      }

      if (elements) {
        elements = callback ? concatCall([ ], elements, callback) :
          NATIVE_SLICE_PROTO ? slice.call(elements) : concatList([ ], elements);
        Config.CACHING && Dom.saveResults(original, from, doc, elements);
        return elements;
      }

      selector = selector.replace(reTrimSpaces, '');

      Config.SHORTCUTS && (selector = Dom.shortcuts(selector, from));

      if ((changed = lastSelector != selector)) {
        // process valid selector strings
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleSelect = (parts = selector.match(reSplitGroup)).length < 2;
          // save passed selector
          lastSelector = selector;
          lastPartsSelect = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return [ ];
        }
      } else parts = lastPartsSelect;

      // commas separators are treated sequentially to maintain order
      if (from.nodeType == 11) {

        elements = byTagRaw('*', from);

      } else if (!XML_DOCUMENT && isSingleSelect) {

        if (changed) {
          // get right most selector token
          parts = selector.match(reSplitToken);
          token = parts[parts.length - 1];

          // only last slice before :not rules
          lastSlice = token.split(':not')[0];

          // position where token was found
          lastPosition = selector.length - token.length;
        }

        // ID optimization RTL, to reduce number of elements to visit
        if (Config.UNIQUE_ID && (parts = lastSlice.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, from))) {
            if (match(element, selector)) {
              callback && callback(element);
              elements = new global.Array(element);
            } else elements = new global.Array();
          }
        }

        // ID optimization LTR, to reduce selection context searches
        else if (Config.UNIQUE_ID && (parts = selector.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, doc))) {
            if ('#' + token == selector) {
              callback && callback(element);
              elements = new global.Array(element);
            } else if (/[>+~]/.test(selector)) {
              from = element.parentNode;
            } else {
              from = element;
            }
          } else elements = new global.Array();
        }

        if (elements) {
          Config.CACHING && Dom.saveResults(original, from, doc, elements);
          return elements;
        }

        if (!NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
          if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
          selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
        }

        else if ((parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
          if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
          if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
          } else {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
          }
        }

        else if ((parts = selector.match(Optimize.CLASS)) && (token = parts[1])) {
          if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
          for (i = 0, els = new global.Array(); elements.length > i; ++i) {
            els = concatList(els, elements[i].getElementsByTagName('*'));
          }
          elements = els;
          if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
          } else {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
          }
        }

        else if (NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
          if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
          selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
        }

      }

      if (!elements) {
        elements = /^(?:applet|object)$/i.test(from.nodeName) ? from.childNodes : _byTag('*', from);
      }
      // end of prefiltering pass

      // compile selector resolver if necessary
      if (!selectResolvers[selector] || selectContexts[selector] !== from) {
        selectResolvers[selector] = compile(isSingleSelect ? [selector] : parts, '', true);
        selectContexts[selector] = from;
      }

      elements = selectResolvers[selector](elements, Snapshot, [ ], doc, root, from, callback, new global.Object());

      Config.CACHING && Dom.saveResults(original, from, doc, elements);

      return elements;
    },

  /*-------------------------------- STORAGE ---------------------------------*/

  // empty function handler
  FN = function(x) { return x; },

  // compiled match functions returning booleans
  matchContexts = new global.Object(),
  matchResolvers = new global.Object(),

  // compiled select functions returning collections
  selectContexts = new global.Object(),
  selectResolvers = new global.Object(),

  // used to pass methods to compiled functions
  Snapshot = new global.Object({

    // element indexing methods
    nthElement: nthElement,
    nthOfType: nthOfType,

    // element inspection methods
    getAttribute: getAttribute,
    hasAttribute: hasAttribute,

    // element selection methods
    byClass: _byClass,
    byName: byName,
    byTag: _byTag,
    byId: _byId,

    // helper/check methods
    contains: contains,
    isEmpty: isEmpty,
    isLink: isLink,

    // selection/matching
    select: select,
    match: match
  }),

  Tokens = new global.Object({
    prefixes: prefixes,
    encoding: encoding,
    operators: operators,
    whitespace: whitespace,
    identifier: identifier,
    attributes: attributes,
    combinators: combinators,
    pseudoclass: pseudoclass,
    pseudoparms: pseudoparms,
    quotedvalue: quotedvalue
  });

  /*------------------------------- PUBLIC API -------------------------------*/

  // code referenced by extensions
  Dom.ACCEPT_NODE = ACCEPT_NODE;

  // retrieve element by id attr
  Dom.byId = byId;

  // retrieve elements by tag name
  Dom.byTag = byTag;

  // retrieve elements by name attr
  Dom.byName = byName;

  // retrieve elements by class name
  Dom.byClass = byClass;

  // read the value of the attribute
  // as was in the original HTML code
  Dom.getAttribute = getAttribute;

  // check for the attribute presence
  // as was in the original HTML code
  Dom.hasAttribute = hasAttribute;

  // element match selector, return boolean true/false
  Dom.match = match;

  // first element match only, return element or null
  Dom.first = first;

  // elements matching selector, starting from element
  Dom.select = select;

  // compile selector into ad-hoc javascript resolver
  Dom.compile = compile;

  // check that two elements are ancestor/descendant
  Dom.contains = contains;

  // handle selector engine configuration settings
  Dom.configure = configure;

  // initialize caching for each document
  Dom.setCache = FN;

  // load previously collected result set
  Dom.loadResults = FN;

  // save previously collected result set
  Dom.saveResults = FN;

  // handle missing context in selector strings
  Dom.shortcuts = FN;

  // log resolvers errors/warnings
  Dom.emit = emit;

  // options enabing specific engine functionality
  Dom.Config = Config;

  // pass methods references to compiled resolvers
  Dom.Snapshot = Snapshot;

  // operators descriptor
  // for attribute operators extensions
  Dom.Operators = Operators;

  // selectors descriptor
  // for pseudo-class selectors extensions
  Dom.Selectors = Selectors;

  // export string patterns
  Dom.Tokens = Tokens;

  // export version string
  Dom.Version = version;

  // add or overwrite user defined operators
  Dom.registerOperator =
    function(symbol, resolver) {
      Operators[symbol] || (Operators[symbol] = resolver);
    };

  // add selector patterns for user defined callbacks
  Dom.registerSelector =
    function(name, rexp, func) {
      Selectors[name] || (Selectors[name] = new global.Object({
        Expression: rexp,
        Callback: func
      }));
    };

  /*---------------------------------- INIT ----------------------------------*/

  // init context specific variables
  switchContext(doc, true);

});

},{}],29:[function(require,module,exports){
function count(self, substr) {
  var count = 0
  var pos = self.indexOf(substr)

  while (pos >= 0) {
    count += 1
    pos = self.indexOf(substr, pos + 1)
  }

  return count
}

module.exports = count
},{}],30:[function(require,module,exports){
function splitLeft(self, sep, maxSplit, limit) {

  if (typeof maxSplit === 'undefined') {
    var maxSplit = -1;
  }

  var splitResult = self.split(sep);
  var splitPart1 = splitResult.slice(0, maxSplit);
  var splitPart2 = splitResult.slice(maxSplit);

  if (splitPart2.length === 0) {
    splitResult = splitPart1;
  } else {
    splitResult = splitPart1.concat(splitPart2.join(sep));
  }

  if (typeof limit === 'undefined') {
    return splitResult;
  } else if (limit < 0) {
    return splitResult.slice(limit);
  } else {
    return splitResult.slice(0, limit);
  }

}

module.exports = splitLeft;

},{}],31:[function(require,module,exports){
function splitRight(self, sep, maxSplit, limit) {

  if (typeof maxSplit === 'undefined') {
    var maxSplit = -1;
  }
  if (typeof limit === 'undefined') {
    var limit = 0;
  }

  var splitResult = [self];

  for (var i = self.length-1; i >= 0; i--) {

    if (
      splitResult[0].slice(i).indexOf(sep) === 0 &&
      (splitResult.length <= maxSplit || maxSplit === -1)
    ) {
      splitResult.splice(1, 0, splitResult[0].slice(i+sep.length)); // insert
      splitResult[0] = splitResult[0].slice(0, i)
    }
  }

  if (limit >= 0) {
    return splitResult.slice(-limit);
  } else {
    return splitResult.slice(0, -limit);
  }

}

module.exports = splitRight;

},{}],32:[function(require,module,exports){
/*
string.js - Copyright (C) 2012-2014, JP Richardson <jprichardson@gmail.com>
*/

!(function() {
  "use strict";

  var VERSION = '3.3.1';

  var ENTITIES = {};

  // from http://semplicewebsites.com/removing-accents-javascript
  var latin_map={"Á":"A","Ă":"A","Ắ":"A","Ặ":"A","Ằ":"A","Ẳ":"A","Ẵ":"A","Ǎ":"A","Â":"A","Ấ":"A","Ậ":"A","Ầ":"A","Ẩ":"A","Ẫ":"A","Ä":"A","Ǟ":"A","Ȧ":"A","Ǡ":"A","Ạ":"A","Ȁ":"A","À":"A","Ả":"A","Ȃ":"A","Ā":"A","Ą":"A","Å":"A","Ǻ":"A","Ḁ":"A","Ⱥ":"A","Ã":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ḃ":"B","Ḅ":"B","Ɓ":"B","Ḇ":"B","Ƀ":"B","Ƃ":"B","Ć":"C","Č":"C","Ç":"C","Ḉ":"C","Ĉ":"C","Ċ":"C","Ƈ":"C","Ȼ":"C","Ď":"D","Ḑ":"D","Ḓ":"D","Ḋ":"D","Ḍ":"D","Ɗ":"D","Ḏ":"D","ǲ":"D","ǅ":"D","Đ":"D","Ƌ":"D","Ǳ":"DZ","Ǆ":"DZ","É":"E","Ĕ":"E","Ě":"E","Ȩ":"E","Ḝ":"E","Ê":"E","Ế":"E","Ệ":"E","Ề":"E","Ể":"E","Ễ":"E","Ḙ":"E","Ë":"E","Ė":"E","Ẹ":"E","Ȅ":"E","È":"E","Ẻ":"E","Ȇ":"E","Ē":"E","Ḗ":"E","Ḕ":"E","Ę":"E","Ɇ":"E","Ẽ":"E","Ḛ":"E","Ꝫ":"ET","Ḟ":"F","Ƒ":"F","Ǵ":"G","Ğ":"G","Ǧ":"G","Ģ":"G","Ĝ":"G","Ġ":"G","Ɠ":"G","Ḡ":"G","Ǥ":"G","Ḫ":"H","Ȟ":"H","Ḩ":"H","Ĥ":"H","Ⱨ":"H","Ḧ":"H","Ḣ":"H","Ḥ":"H","Ħ":"H","Í":"I","Ĭ":"I","Ǐ":"I","Î":"I","Ï":"I","Ḯ":"I","İ":"I","Ị":"I","Ȉ":"I","Ì":"I","Ỉ":"I","Ȋ":"I","Ī":"I","Į":"I","Ɨ":"I","Ĩ":"I","Ḭ":"I","Ꝺ":"D","Ꝼ":"F","Ᵹ":"G","Ꞃ":"R","Ꞅ":"S","Ꞇ":"T","Ꝭ":"IS","Ĵ":"J","Ɉ":"J","Ḱ":"K","Ǩ":"K","Ķ":"K","Ⱪ":"K","Ꝃ":"K","Ḳ":"K","Ƙ":"K","Ḵ":"K","Ꝁ":"K","Ꝅ":"K","Ĺ":"L","Ƚ":"L","Ľ":"L","Ļ":"L","Ḽ":"L","Ḷ":"L","Ḹ":"L","Ⱡ":"L","Ꝉ":"L","Ḻ":"L","Ŀ":"L","Ɫ":"L","ǈ":"L","Ł":"L","Ǉ":"LJ","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ń":"N","Ň":"N","Ņ":"N","Ṋ":"N","Ṅ":"N","Ṇ":"N","Ǹ":"N","Ɲ":"N","Ṉ":"N","Ƞ":"N","ǋ":"N","Ñ":"N","Ǌ":"NJ","Ó":"O","Ŏ":"O","Ǒ":"O","Ô":"O","Ố":"O","Ộ":"O","Ồ":"O","Ổ":"O","Ỗ":"O","Ö":"O","Ȫ":"O","Ȯ":"O","Ȱ":"O","Ọ":"O","Ő":"O","Ȍ":"O","Ò":"O","Ỏ":"O","Ơ":"O","Ớ":"O","Ợ":"O","Ờ":"O","Ở":"O","Ỡ":"O","Ȏ":"O","Ꝋ":"O","Ꝍ":"O","Ō":"O","Ṓ":"O","Ṑ":"O","Ɵ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Õ":"O","Ṍ":"O","Ṏ":"O","Ȭ":"O","Ƣ":"OI","Ꝏ":"OO","Ɛ":"E","Ɔ":"O","Ȣ":"OU","Ṕ":"P","Ṗ":"P","Ꝓ":"P","Ƥ":"P","Ꝕ":"P","Ᵽ":"P","Ꝑ":"P","Ꝙ":"Q","Ꝗ":"Q","Ŕ":"R","Ř":"R","Ŗ":"R","Ṙ":"R","Ṛ":"R","Ṝ":"R","Ȑ":"R","Ȓ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꜿ":"C","Ǝ":"E","Ś":"S","Ṥ":"S","Š":"S","Ṧ":"S","Ş":"S","Ŝ":"S","Ș":"S","Ṡ":"S","Ṣ":"S","Ṩ":"S","ẞ":"SS","Ť":"T","Ţ":"T","Ṱ":"T","Ț":"T","Ⱦ":"T","Ṫ":"T","Ṭ":"T","Ƭ":"T","Ṯ":"T","Ʈ":"T","Ŧ":"T","Ɐ":"A","Ꞁ":"L","Ɯ":"M","Ʌ":"V","Ꜩ":"TZ","Ú":"U","Ŭ":"U","Ǔ":"U","Û":"U","Ṷ":"U","Ü":"U","Ǘ":"U","Ǚ":"U","Ǜ":"U","Ǖ":"U","Ṳ":"U","Ụ":"U","Ű":"U","Ȕ":"U","Ù":"U","Ủ":"U","Ư":"U","Ứ":"U","Ự":"U","Ừ":"U","Ử":"U","Ữ":"U","Ȗ":"U","Ū":"U","Ṻ":"U","Ų":"U","Ů":"U","Ũ":"U","Ṹ":"U","Ṵ":"U","Ꝟ":"V","Ṿ":"V","Ʋ":"V","Ṽ":"V","Ꝡ":"VY","Ẃ":"W","Ŵ":"W","Ẅ":"W","Ẇ":"W","Ẉ":"W","Ẁ":"W","Ⱳ":"W","Ẍ":"X","Ẋ":"X","Ý":"Y","Ŷ":"Y","Ÿ":"Y","Ẏ":"Y","Ỵ":"Y","Ỳ":"Y","Ƴ":"Y","Ỷ":"Y","Ỿ":"Y","Ȳ":"Y","Ɏ":"Y","Ỹ":"Y","Ź":"Z","Ž":"Z","Ẑ":"Z","Ⱬ":"Z","Ż":"Z","Ẓ":"Z","Ȥ":"Z","Ẕ":"Z","Ƶ":"Z","Ĳ":"IJ","Œ":"OE","ᴀ":"A","ᴁ":"AE","ʙ":"B","ᴃ":"B","ᴄ":"C","ᴅ":"D","ᴇ":"E","ꜰ":"F","ɢ":"G","ʛ":"G","ʜ":"H","ɪ":"I","ʁ":"R","ᴊ":"J","ᴋ":"K","ʟ":"L","ᴌ":"L","ᴍ":"M","ɴ":"N","ᴏ":"O","ɶ":"OE","ᴐ":"O","ᴕ":"OU","ᴘ":"P","ʀ":"R","ᴎ":"N","ᴙ":"R","ꜱ":"S","ᴛ":"T","ⱻ":"E","ᴚ":"R","ᴜ":"U","ᴠ":"V","ᴡ":"W","ʏ":"Y","ᴢ":"Z","á":"a","ă":"a","ắ":"a","ặ":"a","ằ":"a","ẳ":"a","ẵ":"a","ǎ":"a","â":"a","ấ":"a","ậ":"a","ầ":"a","ẩ":"a","ẫ":"a","ä":"a","ǟ":"a","ȧ":"a","ǡ":"a","ạ":"a","ȁ":"a","à":"a","ả":"a","ȃ":"a","ā":"a","ą":"a","ᶏ":"a","ẚ":"a","å":"a","ǻ":"a","ḁ":"a","ⱥ":"a","ã":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ḃ":"b","ḅ":"b","ɓ":"b","ḇ":"b","ᵬ":"b","ᶀ":"b","ƀ":"b","ƃ":"b","ɵ":"o","ć":"c","č":"c","ç":"c","ḉ":"c","ĉ":"c","ɕ":"c","ċ":"c","ƈ":"c","ȼ":"c","ď":"d","ḑ":"d","ḓ":"d","ȡ":"d","ḋ":"d","ḍ":"d","ɗ":"d","ᶑ":"d","ḏ":"d","ᵭ":"d","ᶁ":"d","đ":"d","ɖ":"d","ƌ":"d","ı":"i","ȷ":"j","ɟ":"j","ʄ":"j","ǳ":"dz","ǆ":"dz","é":"e","ĕ":"e","ě":"e","ȩ":"e","ḝ":"e","ê":"e","ế":"e","ệ":"e","ề":"e","ể":"e","ễ":"e","ḙ":"e","ë":"e","ė":"e","ẹ":"e","ȅ":"e","è":"e","ẻ":"e","ȇ":"e","ē":"e","ḗ":"e","ḕ":"e","ⱸ":"e","ę":"e","ᶒ":"e","ɇ":"e","ẽ":"e","ḛ":"e","ꝫ":"et","ḟ":"f","ƒ":"f","ᵮ":"f","ᶂ":"f","ǵ":"g","ğ":"g","ǧ":"g","ģ":"g","ĝ":"g","ġ":"g","ɠ":"g","ḡ":"g","ᶃ":"g","ǥ":"g","ḫ":"h","ȟ":"h","ḩ":"h","ĥ":"h","ⱨ":"h","ḧ":"h","ḣ":"h","ḥ":"h","ɦ":"h","ẖ":"h","ħ":"h","ƕ":"hv","í":"i","ĭ":"i","ǐ":"i","î":"i","ï":"i","ḯ":"i","ị":"i","ȉ":"i","ì":"i","ỉ":"i","ȋ":"i","ī":"i","į":"i","ᶖ":"i","ɨ":"i","ĩ":"i","ḭ":"i","ꝺ":"d","ꝼ":"f","ᵹ":"g","ꞃ":"r","ꞅ":"s","ꞇ":"t","ꝭ":"is","ǰ":"j","ĵ":"j","ʝ":"j","ɉ":"j","ḱ":"k","ǩ":"k","ķ":"k","ⱪ":"k","ꝃ":"k","ḳ":"k","ƙ":"k","ḵ":"k","ᶄ":"k","ꝁ":"k","ꝅ":"k","ĺ":"l","ƚ":"l","ɬ":"l","ľ":"l","ļ":"l","ḽ":"l","ȴ":"l","ḷ":"l","ḹ":"l","ⱡ":"l","ꝉ":"l","ḻ":"l","ŀ":"l","ɫ":"l","ᶅ":"l","ɭ":"l","ł":"l","ǉ":"lj","ſ":"s","ẜ":"s","ẛ":"s","ẝ":"s","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ᵯ":"m","ᶆ":"m","ń":"n","ň":"n","ņ":"n","ṋ":"n","ȵ":"n","ṅ":"n","ṇ":"n","ǹ":"n","ɲ":"n","ṉ":"n","ƞ":"n","ᵰ":"n","ᶇ":"n","ɳ":"n","ñ":"n","ǌ":"nj","ó":"o","ŏ":"o","ǒ":"o","ô":"o","ố":"o","ộ":"o","ồ":"o","ổ":"o","ỗ":"o","ö":"o","ȫ":"o","ȯ":"o","ȱ":"o","ọ":"o","ő":"o","ȍ":"o","ò":"o","ỏ":"o","ơ":"o","ớ":"o","ợ":"o","ờ":"o","ở":"o","ỡ":"o","ȏ":"o","ꝋ":"o","ꝍ":"o","ⱺ":"o","ō":"o","ṓ":"o","ṑ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","õ":"o","ṍ":"o","ṏ":"o","ȭ":"o","ƣ":"oi","ꝏ":"oo","ɛ":"e","ᶓ":"e","ɔ":"o","ᶗ":"o","ȣ":"ou","ṕ":"p","ṗ":"p","ꝓ":"p","ƥ":"p","ᵱ":"p","ᶈ":"p","ꝕ":"p","ᵽ":"p","ꝑ":"p","ꝙ":"q","ʠ":"q","ɋ":"q","ꝗ":"q","ŕ":"r","ř":"r","ŗ":"r","ṙ":"r","ṛ":"r","ṝ":"r","ȑ":"r","ɾ":"r","ᵳ":"r","ȓ":"r","ṟ":"r","ɼ":"r","ᵲ":"r","ᶉ":"r","ɍ":"r","ɽ":"r","ↄ":"c","ꜿ":"c","ɘ":"e","ɿ":"r","ś":"s","ṥ":"s","š":"s","ṧ":"s","ş":"s","ŝ":"s","ș":"s","ṡ":"s","ṣ":"s","ṩ":"s","ʂ":"s","ᵴ":"s","ᶊ":"s","ȿ":"s","ɡ":"g","ß":"ss","ᴑ":"o","ᴓ":"o","ᴝ":"u","ť":"t","ţ":"t","ṱ":"t","ț":"t","ȶ":"t","ẗ":"t","ⱦ":"t","ṫ":"t","ṭ":"t","ƭ":"t","ṯ":"t","ᵵ":"t","ƫ":"t","ʈ":"t","ŧ":"t","ᵺ":"th","ɐ":"a","ᴂ":"ae","ǝ":"e","ᵷ":"g","ɥ":"h","ʮ":"h","ʯ":"h","ᴉ":"i","ʞ":"k","ꞁ":"l","ɯ":"m","ɰ":"m","ᴔ":"oe","ɹ":"r","ɻ":"r","ɺ":"r","ⱹ":"r","ʇ":"t","ʌ":"v","ʍ":"w","ʎ":"y","ꜩ":"tz","ú":"u","ŭ":"u","ǔ":"u","û":"u","ṷ":"u","ü":"u","ǘ":"u","ǚ":"u","ǜ":"u","ǖ":"u","ṳ":"u","ụ":"u","ű":"u","ȕ":"u","ù":"u","ủ":"u","ư":"u","ứ":"u","ự":"u","ừ":"u","ử":"u","ữ":"u","ȗ":"u","ū":"u","ṻ":"u","ų":"u","ᶙ":"u","ů":"u","ũ":"u","ṹ":"u","ṵ":"u","ᵫ":"ue","ꝸ":"um","ⱴ":"v","ꝟ":"v","ṿ":"v","ʋ":"v","ᶌ":"v","ⱱ":"v","ṽ":"v","ꝡ":"vy","ẃ":"w","ŵ":"w","ẅ":"w","ẇ":"w","ẉ":"w","ẁ":"w","ⱳ":"w","ẘ":"w","ẍ":"x","ẋ":"x","ᶍ":"x","ý":"y","ŷ":"y","ÿ":"y","ẏ":"y","ỵ":"y","ỳ":"y","ƴ":"y","ỷ":"y","ỿ":"y","ȳ":"y","ẙ":"y","ɏ":"y","ỹ":"y","ź":"z","ž":"z","ẑ":"z","ʑ":"z","ⱬ":"z","ż":"z","ẓ":"z","ȥ":"z","ẕ":"z","ᵶ":"z","ᶎ":"z","ʐ":"z","ƶ":"z","ɀ":"z","ﬀ":"ff","ﬃ":"ffi","ﬄ":"ffl","ﬁ":"fi","ﬂ":"fl","ĳ":"ij","œ":"oe","ﬆ":"st","ₐ":"a","ₑ":"e","ᵢ":"i","ⱼ":"j","ₒ":"o","ᵣ":"r","ᵤ":"u","ᵥ":"v","ₓ":"x"};

//******************************************************************************
// Added an initialize function which is essentially the code from the S
// constructor.  Now, the S constructor calls this and a new method named
// setValue calls it as well.  The setValue function allows constructors for
// modules that extend string.js to set the initial value of an object without
// knowing the internal workings of string.js.
//
// Also, all methods which return a new S object now call:
//
//      return new this.constructor(s);
//
// instead of:
//
//      return new S(s);
//
// This allows extended objects to keep their proper instanceOf and constructor.
//******************************************************************************

  function initialize (object, s) {
    if (s !== null && s !== undefined) {
      if (typeof s === 'string')
        object.s = s;
      else
        object.s = s.toString();
    } else {
      object.s = s; //null or undefined
    }

    object.orig = s; //original object, currently only used by toCSV() and toBoolean()

    if (s !== null && s !== undefined) {
      if (object.__defineGetter__) {
        object.__defineGetter__('length', function() {
          return object.s.length;
        })
      } else {
        object.length = s.length;
      }
    } else {
      object.length = -1;
    }
  }

  function S(s) {
  	initialize(this, s);
  }

  var __nsp = String.prototype;
  var __sp = S.prototype = {

    between: function(left, right) {
      var s = this.s;
      var startPos = s.indexOf(left);
      var endPos = s.indexOf(right, startPos + left.length);
      if (endPos == -1 && right != null)
        return new this.constructor('')
      else if (endPos == -1 && right == null)
        return new this.constructor(s.substring(startPos + left.length))
      else
        return new this.constructor(s.slice(startPos + left.length, endPos));
    },

    //# modified slightly from https://github.com/epeli/underscore.string
    camelize: function() {
      var s = this.trim().s.replace(/(\-|_|\s)+(.)?/g, function(mathc, sep, c) {
        return (c ? c.toUpperCase() : '');
      });
      return new this.constructor(s);
    },

    capitalize: function() {
      return new this.constructor(this.s.substr(0, 1).toUpperCase() + this.s.substring(1).toLowerCase());
    },

    charAt: function(index) {
      return this.s.charAt(index);
    },

    chompLeft: function(prefix) {
      var s = this.s;
      if (s.indexOf(prefix) === 0) {
         s = s.slice(prefix.length);
         return new this.constructor(s);
      } else {
        return this;
      }
    },

    chompRight: function(suffix) {
      if (this.endsWith(suffix)) {
        var s = this.s;
        s = s.slice(0, s.length - suffix.length);
        return new this.constructor(s);
      } else {
        return this;
      }
    },

    //#thanks Google
    collapseWhitespace: function() {
      var s = this.s.replace(/[\s\xa0]+/g, ' ').replace(/^\s+|\s+$/g, '');
      return new this.constructor(s);
    },

    contains: function(ss) {
      return this.s.indexOf(ss) >= 0;
    },

    count: function(ss) {
      return require('./_count')(this.s, ss)
    },

    //#modified from https://github.com/epeli/underscore.string
    dasherize: function() {
      var s = this.trim().s.replace(/[_\s]+/g, '-').replace(/([A-Z])/g, '-$1').replace(/-+/g, '-').toLowerCase();
      return new this.constructor(s);
    },

    latinise: function() {
      var s = this.replace(/[^A-Za-z0-9\[\] ]/g, function(x) { return latin_map[x] || x; });
      return new this.constructor(s);
    },

    decodeHtmlEntities: function() { //https://github.com/substack/node-ent/blob/master/index.js
      var s = this.s;
      s = s.replace(/&#(\d+);?/g, function (_, code) {
        return String.fromCharCode(code);
      })
      .replace(/&#[xX]([A-Fa-f0-9]+);?/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&([^;\W]+;?)/g, function (m, e) {
        var ee = e.replace(/;$/, '');
        var target = ENTITIES[e] || (e.match(/;$/) && ENTITIES[ee]);

        if (typeof target === 'number') {
          return String.fromCharCode(target);
        }
        else if (typeof target === 'string') {
          return target;
        }
        else {
          return m;
        }
      })

      return new this.constructor(s);
    },

    endsWith: function() {
      var suffixes = Array.prototype.slice.call(arguments, 0);
      for (var i = 0; i < suffixes.length; ++i) {
        var l  = this.s.length - suffixes[i].length;
        if (l >= 0 && this.s.indexOf(suffixes[i], l) === l) return true;
      }
      return false;
    },

    escapeHTML: function() { //from underscore.string
      return new this.constructor(this.s.replace(/[&<>"']/g, function(m){ return '&' + reversedEscapeChars[m] + ';'; }));
    },

    ensureLeft: function(prefix) {
      var s = this.s;
      if (s.indexOf(prefix) === 0) {
        return this;
      } else {
        return new this.constructor(prefix + s);
      }
    },

    ensureRight: function(suffix) {
      var s = this.s;
      if (this.endsWith(suffix))  {
        return this;
      } else {
        return new this.constructor(s + suffix);
      }
    },

    humanize: function() { //modified from underscore.string
      if (this.s === null || this.s === undefined)
        return new this.constructor('')
      var s = this.underscore().replace(/_id$/,'').replace(/_/g, ' ').trim().capitalize()
      return new this.constructor(s)
    },

    isAlpha: function() {
      return !/[^a-z\xDF-\xFF]|^$/.test(this.s.toLowerCase());
    },

    isAlphaNumeric: function() {
      return !/[^0-9a-z\xDF-\xFF]/.test(this.s.toLowerCase());
    },

    isEmpty: function() {
      return this.s === null || this.s === undefined ? true : /^[\s\xa0]*$/.test(this.s);
    },

    isLower: function() {
      return this.isAlpha() && this.s.toLowerCase() === this.s;
    },

    isNumeric: function() {
      return !/[^0-9]/.test(this.s);
    },

    isUpper: function() {
      return this.isAlpha() && this.s.toUpperCase() === this.s;
    },

    left: function(N) {
      if (N >= 0) {
        var s = this.s.substr(0, N);
        return new this.constructor(s);
      } else {
        return this.right(-N);
      }
    },

    lines: function() { //convert windows newlines to unix newlines then convert to an Array of lines
      return this.replaceAll('\r\n', '\n').s.split('\n');
    },

    pad: function(len, ch) { //https://github.com/component/pad
      if (ch == null) ch = ' ';
      if (this.s.length >= len) return new this.constructor(this.s);
      len = len - this.s.length;
      var left = Array(Math.ceil(len / 2) + 1).join(ch);
      var right = Array(Math.floor(len / 2) + 1).join(ch);
      return new this.constructor(left + this.s + right);
    },

    padLeft: function(len, ch) { //https://github.com/component/pad
      if (ch == null) ch = ' ';
      if (this.s.length >= len) return new this.constructor(this.s);
      return new this.constructor(Array(len - this.s.length + 1).join(ch) + this.s);
    },

    padRight: function(len, ch) { //https://github.com/component/pad
      if (ch == null) ch = ' ';
      if (this.s.length >= len) return new this.constructor(this.s);
      return new this.constructor(this.s + Array(len - this.s.length + 1).join(ch));
    },

    parseCSV: function(delimiter, qualifier, escape, lineDelimiter) { //try to parse no matter what
      delimiter = delimiter || ',';
      escape = escape || '\\'
      if (typeof qualifier == 'undefined')
        qualifier = '"';

      var i = 0, fieldBuffer = [], fields = [], len = this.s.length, inField = false, inUnqualifiedString = false, self = this;
      var ca = function(i){return self.s.charAt(i)};
      if (typeof lineDelimiter !== 'undefined') var rows = [];

      if (!qualifier)
        inField = true;

      while (i < len) {
        var current = ca(i);
        switch (current) {
          case escape:
            //fix for issues #32 and #35
            if (inField && ((escape !== qualifier) || ca(i+1) === qualifier)) {
              i += 1;
              fieldBuffer.push(ca(i));
              break;
            }
            if (escape !== qualifier) break;
          case qualifier:
            inField = !inField;
            break;
          case delimiter:
            if(inUnqualifiedString) {
              inField=false;
              inUnqualifiedString=false;
            }
            if (inField && qualifier)
              fieldBuffer.push(current);
            else {
              fields.push(fieldBuffer.join(''))
              fieldBuffer.length = 0;
            }
            break;
          case lineDelimiter:
            if(inUnqualifiedString) {
              inField=false;
              inUnqualifiedString=false;
              fields.push(fieldBuffer.join(''))
              rows.push(fields);
              fields = [];
              fieldBuffer.length = 0;
            }
            else if (inField) {
              fieldBuffer.push(current);
            } else {
              if (rows) {
                fields.push(fieldBuffer.join(''))
                rows.push(fields);
                fields = [];
                fieldBuffer.length = 0;
              }
            }
            break;
          case ' ':
            if (inField)
              fieldBuffer.push(current);
            break;
          default:
            if (inField)
              fieldBuffer.push(current);
            else if(current!==qualifier) {
              fieldBuffer.push(current);
              inField=true;
              inUnqualifiedString=true;
            }
            break;
        }
        i += 1;
      }

      fields.push(fieldBuffer.join(''));
      if (rows) {
        rows.push(fields);
        return rows;
      }
      return fields;
    },

    replaceAll: function(ss, r) {
      //var s = this.s.replace(new RegExp(ss, 'g'), r);
      var s = this.s.split(ss).join(r)
      return new this.constructor(s);
    },

    splitLeft: function(sep, maxSplit, limit) {
      return require('./_splitLeft')(this.s, sep, maxSplit, limit)
    },

    splitRight: function(sep, maxSplit, limit) {
      return require('./_splitRight')(this.s, sep, maxSplit, limit)
    },

    strip: function() {
      var ss = this.s;
      for(var i= 0, n=arguments.length; i<n; i++) {
        ss = ss.split(arguments[i]).join('');
      }
      return new this.constructor(ss);
    },

    stripLeft: function (chars) {
      var regex;
      var pattern;
      var ss = ensureString(this.s);

      if (chars === undefined) {
        pattern = /^\s+/g;
      }
      else {
        regex = escapeRegExp(chars);
        pattern = new RegExp("^[" + regex + "]+", "g");
      }

      return new this.constructor(ss.replace(pattern, ""));
    },

    stripRight: function (chars) {
      var regex;
      var pattern;
      var ss = ensureString(this.s);

      if (chars === undefined) {
        pattern = /\s+$/g;
      }
      else {
        regex = escapeRegExp(chars);
        pattern = new RegExp("[" + regex + "]+$", "g");
      }

      return new this.constructor(ss.replace(pattern, ""));
    },

    right: function(N) {
      if (N >= 0) {
        var s = this.s.substr(this.s.length - N, N);
        return new this.constructor(s);
      } else {
        return this.left(-N);
      }
    },

    setValue: function (s) {
	  initialize(this, s);
	  return this;
    },

    slugify: function() {
      var sl = (new S(new S(this.s).latinise().s.replace(/[^\w\s-]/g, '').toLowerCase())).dasherize().s;
      if (sl.charAt(0) === '-')
        sl = sl.substr(1);
      return new this.constructor(sl);
    },

    startsWith: function() {
      var prefixes = Array.prototype.slice.call(arguments, 0);
      for (var i = 0; i < prefixes.length; ++i) {
        if (this.s.lastIndexOf(prefixes[i], 0) === 0) return true;
      }
      return false;
    },

    stripPunctuation: function() {
      //return new this.constructor(this.s.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g,""));
      return new this.constructor(this.s.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " "));
    },

    stripTags: function() { //from sugar.js
      var s = this.s, args = arguments.length > 0 ? arguments : [''];
      multiArgs(args, function(tag) {
        s = s.replace(RegExp('<\/?' + tag + '[^<>]*>', 'gi'), '');
      });
      return new this.constructor(s);
    },

    template: function(values, opening, closing) {
      var s = this.s
      var opening = opening || Export.TMPL_OPEN
      var closing = closing || Export.TMPL_CLOSE

      var open = opening.replace(/[-[\]()*\s]/g, "\\$&").replace(/\$/g, '\\$')
      var close = closing.replace(/[-[\]()*\s]/g, "\\$&").replace(/\$/g, '\\$')
      var r = new RegExp(open + '(.+?)' + close, 'g')
        //, r = /\{\{(.+?)\}\}/g
      var matches = s.match(r) || [];

      matches.forEach(function(match) {
        var key = match.substring(opening.length, match.length - closing.length).trim();//chop {{ and }}
        var value = typeof values[key] == 'undefined' ? '' : values[key];
        s = s.replace(match, value);
      });
      return new this.constructor(s);
    },

    times: function(n) {
      return new this.constructor(new Array(n + 1).join(this.s));
    },

    titleCase: function() {
      var s = this.s;
      if (s) {
        s = s.replace(/(^[a-z]| [a-z]|-[a-z]|_[a-z])/g,
          function($1){
            return $1.toUpperCase();
          }
        );
      }
      return new this.constructor(s);
    },

    toBoolean: function() {
      if (typeof this.orig === 'string') {
        var s = this.s.toLowerCase();
        return s === 'true' || s === 'yes' || s === 'on' || s === '1';
      } else
        return this.orig === true || this.orig === 1;
    },

    toFloat: function(precision) {
      var num = parseFloat(this.s)
      if (precision)
        return parseFloat(num.toFixed(precision))
      else
        return num
    },

    toInt: function() { //thanks Google
      // If the string starts with '0x' or '-0x', parse as hex.
      return /^\s*-?0x/i.test(this.s) ? parseInt(this.s, 16) : parseInt(this.s, 10)
    },

    trim: function() {
      var s;
      if (typeof __nsp.trim === 'undefined')
        s = this.s.replace(/(^\s*|\s*$)/g, '')
      else
        s = this.s.trim()
      return new this.constructor(s);
    },

    trimLeft: function() {
      var s;
      if (__nsp.trimLeft)
        s = this.s.trimLeft();
      else
        s = this.s.replace(/(^\s*)/g, '');
      return new this.constructor(s);
    },

    trimRight: function() {
      var s;
      if (__nsp.trimRight)
        s = this.s.trimRight();
      else
        s = this.s.replace(/\s+$/, '');
      return new this.constructor(s);
    },

    truncate: function(length, pruneStr) { //from underscore.string, author: github.com/rwz
      var str = this.s;

      length = ~~length;
      pruneStr = pruneStr || '...';

      if (str.length <= length) return new this.constructor(str);

      var tmpl = function(c){ return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' '; },
        template = str.slice(0, length+1).replace(/.(?=\W*\w*$)/g, tmpl); // 'Hello, world' -> 'HellAA AAAAA'

      if (template.slice(template.length-2).match(/\w\w/))
        template = template.replace(/\s*\S+$/, '');
      else
        template = new S(template.slice(0, template.length-1)).trimRight().s;

      return (template+pruneStr).length > str.length ? new S(str) : new S(str.slice(0, template.length)+pruneStr);
    },

    toCSV: function() {
      var delim = ',', qualifier = '"', escape = '\\', encloseNumbers = true, keys = false;
      var dataArray = [];

      function hasVal(it) {
        return it !== null && it !== '';
      }

      if (typeof arguments[0] === 'object') {
        delim = arguments[0].delimiter || delim;
        delim = arguments[0].separator || delim;
        qualifier = arguments[0].qualifier || qualifier;
        encloseNumbers = !!arguments[0].encloseNumbers;
        escape = arguments[0].escape || escape;
        keys = !!arguments[0].keys;
      } else if (typeof arguments[0] === 'string') {
        delim = arguments[0];
      }

      if (typeof arguments[1] === 'string')
        qualifier = arguments[1];

      if (arguments[1] === null)
        qualifier = null;

       if (this.orig instanceof Array)
        dataArray  = this.orig;
      else { //object
        for (var key in this.orig)
          if (this.orig.hasOwnProperty(key))
            if (keys)
              dataArray.push(key);
            else
              dataArray.push(this.orig[key]);
      }

      var rep = escape + qualifier;
      var buildString = [];
      for (var i = 0; i < dataArray.length; ++i) {
        var shouldQualify = hasVal(qualifier)
        if (typeof dataArray[i] == 'number')
          shouldQualify &= encloseNumbers;

        if (shouldQualify)
          buildString.push(qualifier);

        if (dataArray[i] !== null && dataArray[i] !== undefined) {
          var d = new S(dataArray[i]).replaceAll(qualifier, rep).s;
          buildString.push(d);
        } else
          buildString.push('')

        if (shouldQualify)
          buildString.push(qualifier);

        if (delim)
          buildString.push(delim);
      }

      //chop last delim
      //console.log(buildString.length)
      buildString.length = buildString.length - 1;
      return new this.constructor(buildString.join(''));
    },

    toString: function() {
      return this.s;
    },

    //#modified from https://github.com/epeli/underscore.string
    underscore: function() {
      var s = this.trim().s.replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
      return new this.constructor(s);
    },

    unescapeHTML: function() { //from underscore.string
      return new this.constructor(this.s.replace(/\&([^;]+);/g, function(entity, entityCode){
        var match;

        if (entityCode in escapeChars) {
          return escapeChars[entityCode];
        } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
          return String.fromCharCode(parseInt(match[1], 16));
        } else if (match = entityCode.match(/^#(\d+)$/)) {
          return String.fromCharCode(~~match[1]);
        } else {
          return entity;
        }
      }));
    },

    valueOf: function() {
      return this.s.valueOf();
    },

    //#Added a New Function called wrapHTML.
    wrapHTML: function (tagName, tagAttrs) {
      var s = this.s, el = (tagName == null) ? 'span' : tagName, elAttr = '', wrapped = '';
      if(typeof tagAttrs == 'object') for(var prop in tagAttrs) elAttr += ' ' + prop + '="' +(new this.constructor(tagAttrs[prop])).escapeHTML() + '"';
      s = wrapped.concat('<', el, elAttr, '>', this, '</', el, '>');
      return new this.constructor(s);
    }
  }

  var methodsAdded = [];
  function extendPrototype() {
    for (var name in __sp) {
      (function(name){
        var func = __sp[name];
        if (!__nsp.hasOwnProperty(name)) {
          methodsAdded.push(name);
          __nsp[name] = function() {
            String.prototype.s = this;
            return func.apply(this, arguments);
          }
        }
      })(name);
    }
  }

  function restorePrototype() {
    for (var i = 0; i < methodsAdded.length; ++i)
      delete String.prototype[methodsAdded[i]];
    methodsAdded.length = 0;
  }


/*************************************
/* Attach Native JavaScript String Properties
/*************************************/

  var nativeProperties = getNativeStringProperties();
  for (var name in nativeProperties) {
    (function(name) {
      var stringProp = __nsp[name];
      if (typeof stringProp == 'function') {
        //console.log(stringProp)
        if (!__sp[name]) {
          if (nativeProperties[name] === 'string') {
            __sp[name] = function() {
              //console.log(name)
              return new this.constructor(stringProp.apply(this, arguments));
            }
          } else {
            __sp[name] = stringProp;
          }
        }
      }
    })(name);
  }


/*************************************
/* Function Aliases
/*************************************/

  __sp.repeat = __sp.times;
  __sp.include = __sp.contains;
  __sp.toInteger = __sp.toInt;
  __sp.toBool = __sp.toBoolean;
  __sp.decodeHTMLEntities = __sp.decodeHtmlEntities //ensure consistent casing scheme of 'HTML'


//******************************************************************************
// Set the constructor.  Without this, string.js objects are instances of
// Object instead of S.
//******************************************************************************

  __sp.constructor = S;


/*************************************
/* Private Functions
/*************************************/

  function getNativeStringProperties() {
    var names = getNativeStringPropertyNames();
    var retObj = {};

    for (var i = 0; i < names.length; ++i) {
      var name = names[i];
      if (name === 'to' || name === 'toEnd') continue;       // get rid of the shelljs prototype messup
      var func = __nsp[name];
      try {
        var type = typeof func.apply('teststring');
        retObj[name] = type;
      } catch (e) {}
    }
    return retObj;
  }

  function getNativeStringPropertyNames() {
    var results = [];
    if (Object.getOwnPropertyNames) {
      results = Object.getOwnPropertyNames(__nsp);
      results.splice(results.indexOf('valueOf'), 1);
      results.splice(results.indexOf('toString'), 1);
      return results;
    } else { //meant for legacy cruft, this could probably be made more efficient
      var stringNames = {};
      var objectNames = [];
      for (var name in String.prototype)
        stringNames[name] = name;

      for (var name in Object.prototype)
        delete stringNames[name];

      //stringNames['toString'] = 'toString'; //this was deleted with the rest of the object names
      for (var name in stringNames) {
        results.push(name);
      }
      return results;
    }
  }

  function Export(str) {
    return new S(str);
  };

  //attach exports to StringJSWrapper
  Export.extendPrototype = extendPrototype;
  Export.restorePrototype = restorePrototype;
  Export.VERSION = VERSION;
  Export.TMPL_OPEN = '{{';
  Export.TMPL_CLOSE = '}}';
  Export.ENTITIES = ENTITIES;



/*************************************
/* Exports
/*************************************/

  if (typeof module !== 'undefined'  && typeof module.exports !== 'undefined') {
    module.exports = Export;

  } else {

    if(typeof define === "function" && define.amd) {
      define([], function() {
        return Export;
      });
    } else {
      window.S = Export;
    }
  }


/*************************************
/* 3rd Party Private Functions
/*************************************/

  //from sugar.js
  function multiArgs(args, fn) {
    var result = [], i;
    for(i = 0; i < args.length; i++) {
      result.push(args[i]);
      if(fn) fn.call(args, args[i], i);
    }
    return result;
  }

  //from underscore.string
  var escapeChars = {
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    amp: '&'
  };

  function escapeRegExp (s) {
    // most part from https://github.com/skulpt/skulpt/blob/ecaf75e69c2e539eff124b2ab45df0b01eaf2295/src/str.js#L242
    var c;
    var i;
    var ret = [];
    var re = /^[A-Za-z0-9]+$/;
    s = ensureString(s);
    for (i = 0; i < s.length; ++i) {
      c = s.charAt(i);

      if (re.test(c)) {
        ret.push(c);
      }
      else {
        if (c === "\\000") {
          ret.push("\\000");
        }
        else {
          ret.push("\\" + c);
        }
      }
    }
    return ret.join("");
  }

  function ensureString(string) {
    return string == null ? '' : '' + string;
  }

  //from underscore.string
  var reversedEscapeChars = {};
  for(var key in escapeChars){ reversedEscapeChars[escapeChars[key]] = key; }

  ENTITIES = {
    "amp" : "&",
    "gt" : ">",
    "lt" : "<",
    "quot" : "\"",
    "apos" : "'",
    "AElig" : 198,
    "Aacute" : 193,
    "Acirc" : 194,
    "Agrave" : 192,
    "Aring" : 197,
    "Atilde" : 195,
    "Auml" : 196,
    "Ccedil" : 199,
    "ETH" : 208,
    "Eacute" : 201,
    "Ecirc" : 202,
    "Egrave" : 200,
    "Euml" : 203,
    "Iacute" : 205,
    "Icirc" : 206,
    "Igrave" : 204,
    "Iuml" : 207,
    "Ntilde" : 209,
    "Oacute" : 211,
    "Ocirc" : 212,
    "Ograve" : 210,
    "Oslash" : 216,
    "Otilde" : 213,
    "Ouml" : 214,
    "THORN" : 222,
    "Uacute" : 218,
    "Ucirc" : 219,
    "Ugrave" : 217,
    "Uuml" : 220,
    "Yacute" : 221,
    "aacute" : 225,
    "acirc" : 226,
    "aelig" : 230,
    "agrave" : 224,
    "aring" : 229,
    "atilde" : 227,
    "auml" : 228,
    "ccedil" : 231,
    "eacute" : 233,
    "ecirc" : 234,
    "egrave" : 232,
    "eth" : 240,
    "euml" : 235,
    "iacute" : 237,
    "icirc" : 238,
    "igrave" : 236,
    "iuml" : 239,
    "ntilde" : 241,
    "oacute" : 243,
    "ocirc" : 244,
    "ograve" : 242,
    "oslash" : 248,
    "otilde" : 245,
    "ouml" : 246,
    "szlig" : 223,
    "thorn" : 254,
    "uacute" : 250,
    "ucirc" : 251,
    "ugrave" : 249,
    "uuml" : 252,
    "yacute" : 253,
    "yuml" : 255,
    "copy" : 169,
    "reg" : 174,
    "nbsp" : 160,
    "iexcl" : 161,
    "cent" : 162,
    "pound" : 163,
    "curren" : 164,
    "yen" : 165,
    "brvbar" : 166,
    "sect" : 167,
    "uml" : 168,
    "ordf" : 170,
    "laquo" : 171,
    "not" : 172,
    "shy" : 173,
    "macr" : 175,
    "deg" : 176,
    "plusmn" : 177,
    "sup1" : 185,
    "sup2" : 178,
    "sup3" : 179,
    "acute" : 180,
    "micro" : 181,
    "para" : 182,
    "middot" : 183,
    "cedil" : 184,
    "ordm" : 186,
    "raquo" : 187,
    "frac14" : 188,
    "frac12" : 189,
    "frac34" : 190,
    "iquest" : 191,
    "times" : 215,
    "divide" : 247,
    "OElig;" : 338,
    "oelig;" : 339,
    "Scaron;" : 352,
    "scaron;" : 353,
    "Yuml;" : 376,
    "fnof;" : 402,
    "circ;" : 710,
    "tilde;" : 732,
    "Alpha;" : 913,
    "Beta;" : 914,
    "Gamma;" : 915,
    "Delta;" : 916,
    "Epsilon;" : 917,
    "Zeta;" : 918,
    "Eta;" : 919,
    "Theta;" : 920,
    "Iota;" : 921,
    "Kappa;" : 922,
    "Lambda;" : 923,
    "Mu;" : 924,
    "Nu;" : 925,
    "Xi;" : 926,
    "Omicron;" : 927,
    "Pi;" : 928,
    "Rho;" : 929,
    "Sigma;" : 931,
    "Tau;" : 932,
    "Upsilon;" : 933,
    "Phi;" : 934,
    "Chi;" : 935,
    "Psi;" : 936,
    "Omega;" : 937,
    "alpha;" : 945,
    "beta;" : 946,
    "gamma;" : 947,
    "delta;" : 948,
    "epsilon;" : 949,
    "zeta;" : 950,
    "eta;" : 951,
    "theta;" : 952,
    "iota;" : 953,
    "kappa;" : 954,
    "lambda;" : 955,
    "mu;" : 956,
    "nu;" : 957,
    "xi;" : 958,
    "omicron;" : 959,
    "pi;" : 960,
    "rho;" : 961,
    "sigmaf;" : 962,
    "sigma;" : 963,
    "tau;" : 964,
    "upsilon;" : 965,
    "phi;" : 966,
    "chi;" : 967,
    "psi;" : 968,
    "omega;" : 969,
    "thetasym;" : 977,
    "upsih;" : 978,
    "piv;" : 982,
    "ensp;" : 8194,
    "emsp;" : 8195,
    "thinsp;" : 8201,
    "zwnj;" : 8204,
    "zwj;" : 8205,
    "lrm;" : 8206,
    "rlm;" : 8207,
    "ndash;" : 8211,
    "mdash;" : 8212,
    "lsquo;" : 8216,
    "rsquo;" : 8217,
    "sbquo;" : 8218,
    "ldquo;" : 8220,
    "rdquo;" : 8221,
    "bdquo;" : 8222,
    "dagger;" : 8224,
    "Dagger;" : 8225,
    "bull;" : 8226,
    "hellip;" : 8230,
    "permil;" : 8240,
    "prime;" : 8242,
    "Prime;" : 8243,
    "lsaquo;" : 8249,
    "rsaquo;" : 8250,
    "oline;" : 8254,
    "frasl;" : 8260,
    "euro;" : 8364,
    "image;" : 8465,
    "weierp;" : 8472,
    "real;" : 8476,
    "trade;" : 8482,
    "alefsym;" : 8501,
    "larr;" : 8592,
    "uarr;" : 8593,
    "rarr;" : 8594,
    "darr;" : 8595,
    "harr;" : 8596,
    "crarr;" : 8629,
    "lArr;" : 8656,
    "uArr;" : 8657,
    "rArr;" : 8658,
    "dArr;" : 8659,
    "hArr;" : 8660,
    "forall;" : 8704,
    "part;" : 8706,
    "exist;" : 8707,
    "empty;" : 8709,
    "nabla;" : 8711,
    "isin;" : 8712,
    "notin;" : 8713,
    "ni;" : 8715,
    "prod;" : 8719,
    "sum;" : 8721,
    "minus;" : 8722,
    "lowast;" : 8727,
    "radic;" : 8730,
    "prop;" : 8733,
    "infin;" : 8734,
    "ang;" : 8736,
    "and;" : 8743,
    "or;" : 8744,
    "cap;" : 8745,
    "cup;" : 8746,
    "int;" : 8747,
    "there4;" : 8756,
    "sim;" : 8764,
    "cong;" : 8773,
    "asymp;" : 8776,
    "ne;" : 8800,
    "equiv;" : 8801,
    "le;" : 8804,
    "ge;" : 8805,
    "sub;" : 8834,
    "sup;" : 8835,
    "nsub;" : 8836,
    "sube;" : 8838,
    "supe;" : 8839,
    "oplus;" : 8853,
    "otimes;" : 8855,
    "perp;" : 8869,
    "sdot;" : 8901,
    "lceil;" : 8968,
    "rceil;" : 8969,
    "lfloor;" : 8970,
    "rfloor;" : 8971,
    "lang;" : 9001,
    "rang;" : 9002,
    "loz;" : 9674,
    "spades;" : 9824,
    "clubs;" : 9827,
    "hearts;" : 9829,
    "diams;" : 9830
  }


}).call(this);

},{"./_count":29,"./_splitLeft":30,"./_splitRight":31}],33:[function(require,module,exports){
var XCSSMatrix = require('./lib/XCSSMatrix.js');
module.exports = XCSSMatrix;

},{"./lib/XCSSMatrix.js":35}],34:[function(require,module,exports){
var vector = require('./utils/vector');
module.exports = Vector4;

/**
 * A 4 dimensional vector
 * @author Joe Lambert
 * @constructor
 */
function Vector4(x, y, z, w) {
  this.x = x;
  this.y = y;
  this.z = z;
  this.w = w;
  this.checkValues();
}

/**
 * Ensure that values are not undefined
 * @author Joe Lambert
 * @returns null
 */

Vector4.prototype.checkValues = function() {
  this.x = this.x || 0;
  this.y = this.y || 0;
  this.z = this.z || 0;
  this.w = this.w || 0;
};

/**
 * Get the length of the vector
 * @author Joe Lambert
 * @returns {float}
 */

Vector4.prototype.length = function() {
  this.checkValues();
  return vector.length(this);
};


/**
 * Get a normalised representation of the vector
 * @author Joe Lambert
 * @returns {Vector4}
 */

Vector4.prototype.normalize = function() {
	return vector.normalize(this);
};


/**
 * Vector Dot-Product
 * @param {Vector4} v The second vector to apply the product to
 * @author Joe Lambert
 * @returns {float} The Dot-Product of this and v.
 */

Vector4.prototype.dot = function(v) {
  return vector.dot(this, v);
};


/**
 * Vector Cross-Product
 * @param {Vector4} v The second vector to apply the product to
 * @author Joe Lambert
 * @returns {Vector4} The Cross-Product of this and v.
 */

Vector4.prototype.cross = function(v) {
  return vector.cross(this, v);
};


/**
 * Helper function required for matrix decomposition
 * A Javascript implementation of pseudo code available from http://www.w3.org/TR/css3-2d-transforms/#matrix-decomposition
 * @param {Vector4} aPoint A 3D point
 * @param {float} ascl
 * @param {float} bscl
 * @author Joe Lambert
 * @returns {Vector4}
 */

Vector4.prototype.combine = function(bPoint, ascl, bscl) {
  return vector.combine(this, bPoint, ascl, bscl);
};

Vector4.prototype.multiplyByMatrix = function (matrix) {
  return vector.multiplyByMatrix(this, matrix);
};

},{"./utils/vector":39}],35:[function(require,module,exports){
var utils = {
    angles: require('./utils/angle'),
    matrix: require('./utils/matrix'),
    transp: require('./utils/cssTransformString'),
    funcs: {
        // Given a function `fn`, return a function which calls `fn` with only 1
        //   argument, no matter how many are given.
        // Most useful where you only want the first value from a map/foreach/etc
        onlyFirstArg: function (fn, context) {
            context = context || this;

            return function (first) {
                return fn.call(context, first);
            };
        }
    }
};


/**
 *  Given a CSS transform string (like `rotate(3rad)`, or
 *    `matrix(1, 0, 0, 0, 1, 0)`), return an instance compatible with
 *    [`WebKitCSSMatrix`](http://developer.apple.com/library/safari/documentation/AudioVideo/Reference/WebKitCSSMatrixClassReference/WebKitCSSMatrix/WebKitCSSMatrix.html)
 *  @constructor
 *  @param {string} domstr - a string representation of a 2D or 3D transform matrix
 *    in the form given by the CSS transform property, i.e. just like the
 *    output from [[@link#toString]].
 *  @member {number} a - The first 2D vector value.
 *  @member {number} b - The second 2D vector value.
 *  @member {number} c - The third 2D vector value.
 *  @member {number} d - The fourth 2D vector value.
 *  @member {number} e - The fifth 2D vector value.
 *  @member {number} f - The sixth 2D vector value.
 *  @member {number} m11 - The 3D matrix value in the first row and first column.
 *  @member {number} m12 - The 3D matrix value in the first row and second column.
 *  @member {number} m13 - The 3D matrix value in the first row and third column.
 *  @member {number} m14 - The 3D matrix value in the first row and fourth column.
 *  @member {number} m21 - The 3D matrix value in the second row and first column.
 *  @member {number} m22 - The 3D matrix value in the second row and second column.
 *  @member {number} m23 - The 3D matrix value in the second row and third column.
 *  @member {number} m24 - The 3D matrix value in the second row and fourth column.
 *  @member {number} m31 - The 3D matrix value in the third row and first column.
 *  @member {number} m32 - The 3D matrix value in the third row and second column.
 *  @member {number} m33 - The 3D matrix value in the third row and third column.
 *  @member {number} m34 - The 3D matrix value in the third row and fourth column.
 *  @member {number} m41 - The 3D matrix value in the fourth row and first column.
 *  @member {number} m42 - The 3D matrix value in the fourth row and second column.
 *  @member {number} m43 - The 3D matrix value in the fourth row and third column.
 *  @member {number} m44 - The 3D matrix value in the fourth row and fourth column.
 *  @returns {XCSSMatrix} matrix
 */
function XCSSMatrix(domstr) {
    this.m11 = this.m22 = this.m33 = this.m44 = 1;

               this.m12 = this.m13 = this.m14 =
    this.m21 =            this.m23 = this.m24 =
    this.m31 = this.m32 =            this.m34 =
    this.m41 = this.m42 = this.m43            = 0;

    if (typeof domstr === 'string') {
        this.setMatrixValue(domstr);
    }
}

/**
 *  XCSSMatrix.displayName = 'XCSSMatrix'
 */
XCSSMatrix.displayName = 'XCSSMatrix';

var points2d = ['a', 'b', 'c', 'd', 'e', 'f'];
var points3d = [
    'm11', 'm12', 'm13', 'm14',
    'm21', 'm22', 'm23', 'm24',
    'm31', 'm32', 'm33', 'm34',
    'm41', 'm42', 'm43', 'm44'
];

([
    ['m11', 'a'],
    ['m12', 'b'],
    ['m21', 'c'],
    ['m22', 'd'],
    ['m41', 'e'],
    ['m42', 'f']
]).forEach(function (pair) {
    var key3d = pair[0], key2d = pair[1];

    Object.defineProperty(XCSSMatrix.prototype, key2d, {
        set: function (val) {
            this[key3d] = val;
        },

        get: function () {
            return this[key3d];
        },
        enumerable : true,
        configurable : true
    });
});


/**
 *  Multiply one matrix by another
 *  @method
 *  @member
 *  @param {XCSSMatrix} otherMatrix - The matrix to multiply this one by.
 */
XCSSMatrix.prototype.multiply = function (otherMatrix) {
    return utils.matrix.multiply(this, otherMatrix);
};

/**
 *  If the matrix is invertible, returns its inverse, otherwise returns null.
 *  @method
 *  @member
 *  @returns {XCSSMatrix|null}
 */
XCSSMatrix.prototype.inverse = function () {
    return utils.matrix.inverse(this);
};

/**
 *  Returns the result of rotating the matrix by a given vector.
 *
 *  If only the first argument is provided, the matrix is only rotated about
 *  the z axis.
 *  @method
 *  @member
 *  @param {number} rotX - The rotation around the x axis.
 *  @param {number} rotY - The rotation around the y axis. If undefined, the x component is used.
 *  @param {number} rotZ - The rotation around the z axis. If undefined, the x component is used.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.rotate = function (rx, ry, rz) {

    if (typeof rx !== 'number' || isNaN(rx)) rx = 0;

    if ((typeof ry !== 'number' || isNaN(ry)) &&
        (typeof rz !== 'number' || isNaN(rz))) {
        rz = rx;
        rx = 0;
        ry = 0;
    }

    if (typeof ry !== 'number' || isNaN(ry)) ry = 0;
    if (typeof rz !== 'number' || isNaN(rz)) rz = 0;

    rx = utils.angles.deg2rad(rx);
    ry = utils.angles.deg2rad(ry);
    rz = utils.angles.deg2rad(rz);

    var tx = new XCSSMatrix(),
        ty = new XCSSMatrix(),
        tz = new XCSSMatrix(),
        sinA, cosA, sq;

    rz /= 2;
    sinA  = Math.sin(rz);
    cosA  = Math.cos(rz);
    sq = sinA * sinA;

    // Matrices are identity outside the assigned values
    tz.m11 = tz.m22 = 1 - 2 * sq;
    tz.m12 = tz.m21 = 2 * sinA * cosA;
    tz.m21 *= -1;

    ry /= 2;
    sinA  = Math.sin(ry);
    cosA  = Math.cos(ry);
    sq = sinA * sinA;

    ty.m11 = ty.m33 = 1 - 2 * sq;
    ty.m13 = ty.m31 = 2 * sinA * cosA;
    ty.m13 *= -1;

    rx /= 2;
    sinA = Math.sin(rx);
    cosA = Math.cos(rx);
    sq = sinA * sinA;

    tx.m22 = tx.m33 = 1 - 2 * sq;
    tx.m23 = tx.m32 = 2 * sinA * cosA;
    tx.m32 *= -1;

    var identityMatrix = new XCSSMatrix(); // returns identity matrix by default
    var isIdentity     = this.toString() === identityMatrix.toString();
    var rotatedMatrix  = isIdentity ?
            tz.multiply(ty).multiply(tx) :
            this.multiply(tx).multiply(ty).multiply(tz);

    return rotatedMatrix;
};

/**
 *  Returns the result of rotating the matrix around a given vector by a given
 *  angle.
 *
 *  If the given vector is the origin vector then the matrix is rotated by the
 *  given angle around the z axis.
 *  @method
 *  @member
 *  @param {number} rotX - The rotation around the x axis.
 *  @param {number} rotY - The rotation around the y axis. If undefined, the x component is used.
 *  @param {number} rotZ - The rotation around the z axis. If undefined, the x component is used.
 *  @param {number} angle - The angle of rotation about the axis vector, in degrees.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.rotateAxisAngle = function (x, y, z, a) {
    if (typeof x !== 'number' || isNaN(x)) x = 0;
    if (typeof y !== 'number' || isNaN(y)) y = 0;
    if (typeof z !== 'number' || isNaN(z)) z = 0;
    if (typeof a !== 'number' || isNaN(a)) a = 0;
    if (x === 0 && y === 0 && z === 0) z = 1;
    a = (utils.angles.deg2rad(a) || 0) / 2;
    var t         = new XCSSMatrix(),
        len       = Math.sqrt(x * x + y * y + z * z),
        cosA      = Math.cos(a),
        sinA      = Math.sin(a),
        sq        = sinA * sinA,
        sc        = sinA * cosA,
        precision = function(v) { return parseFloat((v).toFixed(6)); },
        x2, y2, z2;

    // Bad vector, use something sensible
    if (len === 0) {
        x = 0;
        y = 0;
        z = 1;
    } else if (len !== 1) {
        x /= len;
        y /= len;
        z /= len;
    }

    // Optimise cases where axis is along major axis
    if (x === 1 && y === 0 && z === 0) {
        t.m22 = t.m33 = 1 - 2 * sq;
        t.m23 = t.m32 = 2 * sc;
        t.m32 *= -1;
    } else if (x === 0 && y === 1 && z === 0) {
        t.m11 = t.m33 = 1 - 2 * sq;
        t.m13 = t.m31 = 2 * sc;
        t.m13 *= -1;
    } else if (x === 0 && y === 0 && z === 1) {
        t.m11 = t.m22 = 1 - 2 * sq;
        t.m12 = t.m21 = 2 * sc;
        t.m21 *= -1;
    } else {
        x2  = x * x;
        y2  = y * y;
        z2  = z * z;
        // http://dev.w3.org/csswg/css-transforms/#mathematical-description
        t.m11 = precision(1 - 2 * (y2 + z2) * sq);
        t.m12 = precision(2 * (x * y * sq + z * sc));
        t.m13 = precision(2 * (x * z * sq - y * sc));
        t.m21 = precision(2 * (x * y * sq - z * sc));
        t.m22 = precision(1 - 2 * (x2 + z2) * sq);
        t.m23 = precision(2 * (y * z * sq + x * sc));
        t.m31 = precision(2 * (x * z * sq + y * sc));
        t.m32 = precision(2 * (y * z * sq - x * sc));
        t.m33 = precision(1 - 2 * (x2 + y2) * sq);
    }

    return this.multiply(t);
};

/**
 *  Returns the result of scaling the matrix by a given vector.
 *  @method
 *  @member
 *  @param {number} scaleX - the scaling factor in the x axis.
 *  @param {number} scaleY - the scaling factor in the y axis. If undefined, the x component is used.
 *  @param {number} scaleZ - the scaling factor in the z axis. If undefined, 1 is used.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.scale = function (scaleX, scaleY, scaleZ) {
    var transform = new XCSSMatrix();

    if (typeof scaleX !== 'number' || isNaN(scaleX)) scaleX = 1;
    if (typeof scaleY !== 'number' || isNaN(scaleY)) scaleY = scaleX;
    if (typeof scaleZ !== 'number' || isNaN(scaleZ)) scaleZ = 1;

    transform.m11 = scaleX;
    transform.m22 = scaleY;
    transform.m33 = scaleZ;

    return this.multiply(transform);
};

/**
 *  Returns the result of skewing the matrix by a given vector.
 *  @method
 *  @member
 *  @param {number} skewX - The scaling factor in the x axis.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.skewX = function (degrees) {
    var radians   = utils.angles.deg2rad(degrees);
    var transform = new XCSSMatrix();

    transform.c = Math.tan(radians);

    return this.multiply(transform);
};

/**
 *  Returns the result of skewing the matrix by a given vector.
 *  @method
 *  @member
 *  @param {number} skewY - the scaling factor in the x axis.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.skewY = function (degrees) {
    var radians   = utils.angles.deg2rad(degrees);
    var transform = new XCSSMatrix();

    transform.b = Math.tan(radians);

    return this.multiply(transform);
};

/**
 *  Returns the result of translating the matrix by a given vector.
 *  @method
 *  @member
 *  @param {number} x - The x component of the vector.
 *  @param {number} y - The y component of the vector.
 *  @param {number} z - The z component of the vector. If undefined, 0 is used.
 *  @returns XCSSMatrix
 */
XCSSMatrix.prototype.translate = function (x, y, z) {
    var t = new XCSSMatrix();

    if (typeof x !== 'number' || isNaN(x)) x = 0;
    if (typeof y !== 'number' || isNaN(y)) y = 0;
    if (typeof z !== 'number' || isNaN(z)) z = 0;

    t.m41 = x;
    t.m42 = y;
    t.m43 = z;

    return this.multiply(t);
};

/**
 *  Sets the matrix values using a string representation, such as that produced
 *  by the [[XCSSMatrix#toString]] method.
 *  @method
 *  @member
 *  @params {string} domstr - A string representation of a 2D or 3D transform matrix
 *    in the form given by the CSS transform property, i.e. just like the
 *    output from [[XCSSMatrix#toString]].
 *  @returns undefined
 */
XCSSMatrix.prototype.setMatrixValue = function (domstr) {

    var matrixString = toMatrixString(domstr.trim());
    var matrixObject = utils.transp.statementToObject(matrixString);

    if (!matrixObject) return;

    var is3d   = matrixObject.key === utils.transp.matrixFn3d;
    var keygen = is3d ? indextoKey3d : indextoKey2d;
    var values = matrixObject.value;
    var count  = values.length;

    if ((is3d && count !== 16) || !(is3d || count === 6)) return;

    values.forEach(function (obj, i) {
        var key = keygen(i);
        this[key] = obj.value;
    }, this);
};

function indextoKey2d (index) {
    return String.fromCharCode(index + 97); // ASCII char 97 == 'a'
}

function indextoKey3d (index) {
    return ('m' + (Math.floor(index / 4) + 1)) + (index % 4 + 1);
}
/**
 *  Returns a string representation of the matrix.
 *  @method
 *  @memberof XCSSMatrix
 *  @returns {string} matrixString - a string like `matrix(1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000)`
 *
 **/
XCSSMatrix.prototype.toString = function () {
    var points, prefix;

    if (utils.matrix.isAffine(this)) {
        prefix = utils.transp.matrixFn2d;
        points = points2d;
    } else {
        prefix = utils.transp.matrixFn3d;
        points = points3d;
    }

    return prefix + '(' +
        points.map(function (p) {
            return this[p].toFixed(6);
        }, this) .join(', ') +
        ')';
};

// ====== toMatrixString ====== //
var jsFunctions = {
    matrix: function (m, o) {
        var m2 = new XCSSMatrix(o.unparsed);

        return m.multiply(m2);
    },
    matrix3d: function (m, o) {
        var m2 = new XCSSMatrix(o.unparsed);

        return m.multiply(m2);
    },

    perspective: function (m, o) {
        var m2 = new XCSSMatrix();
        m2.m34 -= 1 / o.value[0].value;

        return m.multiply(m2);
    },

    rotate: function (m, o) {
        return m.rotate.apply(m, o.value.map(objectValues));
    },
    rotate3d: function (m, o) {
        return m.rotateAxisAngle.apply(m, o.value.map(objectValues));
    },
    rotateX: function (m, o) {
        return m.rotate.apply(m, [o.value[0].value, 0, 0]);
    },
    rotateY: function (m, o) {
        return m.rotate.apply(m, [0, o.value[0].value, 0]);
    },
    rotateZ: function (m, o) {
        return m.rotate.apply(m, [0, 0, o.value[0].value]);
    },

    scale: function (m, o) {
        return m.scale.apply(m, o.value.map(objectValues));
    },
    scale3d: function (m, o) {
        return m.scale.apply(m, o.value.map(objectValues));
    },
    scaleX: function (m, o) {
        return m.scale.apply(m, o.value.map(objectValues));
    },
    scaleY: function (m, o) {
        return m.scale.apply(m, [0, o.value[0].value, 0]);
    },
    scaleZ: function (m, o) {
        return m.scale.apply(m, [0, 0, o.value[0].value]);
    },

    skew: function (m, o) {
        var mX = new XCSSMatrix('skewX(' + o.value[0].unparsed + ')');
        var mY = new XCSSMatrix('skewY(' + (o.value[1]&&o.value[1].unparsed || 0) + ')');
        var sM = 'matrix(1.00000, '+ mY.b +', '+ mX.c +', 1.000000, 0.000000, 0.000000)';
        var m2 = new XCSSMatrix(sM);

        return m.multiply(m2);
    },
    skewX: function (m, o) {
        return m.skewX.apply(m, [o.value[0].value]);
    },
    skewY: function (m, o) {
        return m.skewY.apply(m, [o.value[0].value]);
    },

    translate: function (m, o) {
        return m.translate.apply(m, o.value.map(objectValues));
    },
    translate3d: function (m, o) {
        return m.translate.apply(m, o.value.map(objectValues));
    },
    translateX: function (m, o) {
        return m.translate.apply(m, [o.value[0].value, 0, 0]);
    },
    translateY: function (m, o) {
        return m.translate.apply(m, [0, o.value[0].value, 0]);
    },
    translateZ: function (m, o) {
        return m.translate.apply(m, [0, 0, o.value[0].value]);
    }
};

function objectValues(obj) {
    return obj.value;
}

function cssFunctionToJsFunction(cssFunctionName) {
    return jsFunctions[cssFunctionName];
}

function parsedToDegrees(parsed) {
    if (parsed.units === 'rad') {
        parsed.value = utils.angles.rad2deg(parsed.value);
        parsed.units = 'deg';
    }
    else if (parsed.units === 'grad') {
        parsed.value = utils.angles.grad2deg(parsed.value);
        parsed.units = 'deg';
    }

    return parsed;
}

function transformMatrix(matrix, operation) {
    // convert to degrees because all CSSMatrix methods expect degrees
    operation.value = operation.value.map(parsedToDegrees);

    var jsFunction = cssFunctionToJsFunction(operation.key);
    var result     = jsFunction(matrix, operation);

    return result || matrix;
}

/**
 *  Tranforms a `el.style.WebkitTransform`-style string
 *  (like `rotate(18rad) translate3d(50px, 100px, 10px)`)
 *  into a `getComputedStyle(el)`-style matrix string
 *  (like `matrix3d(0.660316, -0.750987, 0, 0, 0.750987, 0.660316, 0, 0, 0, 0, 1, 0, 108.114560, 28.482308, 10, 1)`)
 *  @private
 *  @method
 *  @param {string} transformString - `el.style.WebkitTransform`-style string (like `rotate(18rad) translate3d(50px, 100px, 10px)`)
 */
function toMatrixString(transformString) {
    var statements = utils.transp.stringToStatements(transformString);

    if (statements.length === 1 && (/^matrix/).test(transformString)) {
        return transformString;
    }

    // We only want the statement to pass to `utils.transp.statementToObject`
    //   not the other values (index, list) from `map`
    var statementToObject = utils.funcs.onlyFirstArg(utils.transp.statementToObject);
    var operations        = statements.map(statementToObject);
    var startingMatrix    = new XCSSMatrix();
    var transformedMatrix = operations.reduce(transformMatrix, startingMatrix);
    var matrixString      = transformedMatrix.toString();

    return matrixString;
}

module.exports = XCSSMatrix;

},{"./utils/angle":36,"./utils/cssTransformString":37,"./utils/matrix":38}],36:[function(require,module,exports){
module.exports = {
  deg2rad: deg2rad,
  rad2deg: rad2deg,
  grad2deg: grad2deg
};

/**
 *  Converts angles in degrees, which are used by the external API, to angles
 *  in radians used in internal calculations.
 *  @param {number} angle - An angle in degrees.
 *  @returns {number} radians
 */
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function rad2deg(radians) {
    return radians * (180 / Math.PI);
}

function grad2deg(gradians) {
    // 400 gradians in 360 degrees
    return gradians / (400 / 360);
}

},{}],37:[function(require,module,exports){
module.exports = {
    matrixFn2d: 'matrix',
    matrixFn3d: 'matrix3d',
    valueToObject: valueToObject,
    statementToObject: statementToObject,
    stringToStatements: stringToStatements
};

function valueToObject(value) {
    var units = /([\-\+]?[0-9]+[\.0-9]*)(deg|rad|grad|px|%)*/;
    var parts = value.match(units) || [];

    return {
        value: parseFloat(parts[1]),
        units: parts[2],
        unparsed: value
    };
}

function statementToObject(statement, skipValues) {
    var nameAndArgs    = /(\w+)\(([^\)]+)\)/i;
    var statementParts = statement.toString().match(nameAndArgs).slice(1);
    var functionName   = statementParts[0];
    var stringValues   = statementParts[1].split(/, ?/);
    var parsedValues   = !skipValues && stringValues.map(valueToObject);

    return {
        key: functionName,
        value: parsedValues || stringValues,
        unparsed: statement
    };
}

function stringToStatements(transformString) {
    var functionSignature   = /(\w+)\([^\)]+\)/ig;
    var transformStatements = transformString.match(functionSignature) || [];

    return transformStatements;
}

},{}],38:[function(require,module,exports){
module.exports = {
  determinant2x2: determinant2x2,
  determinant3x3: determinant3x3,
  determinant4x4: determinant4x4,
  isAffine: isAffine,
  isIdentityOrTranslation: isIdentityOrTranslation,
  adjoint: adjoint,
  inverse: inverse,
  multiply: multiply,
  decompose: decompose
};

/**
 *  Calculates the determinant of a 2x2 matrix.
 *  @param {number} a - Top-left value of the matrix.
 *  @param {number} b - Top-right value of the matrix.
 *  @param {number} c - Bottom-left value of the matrix.
 *  @param {number} d - Bottom-right value of the matrix.
 *  @returns {number}
 */
function determinant2x2(a, b, c, d) {
    return a * d - b * c;
}

/**
 *  Calculates the determinant of a 3x3 matrix.
 *  @param {number} a1 - Matrix value in position [1, 1].
 *  @param {number} a2 - Matrix value in position [1, 2].
 *  @param {number} a3 - Matrix value in position [1, 3].
 *  @param {number} b1 - Matrix value in position [2, 1].
 *  @param {number} b2 - Matrix value in position [2, 2].
 *  @param {number} b3 - Matrix value in position [2, 3].
 *  @param {number} c1 - Matrix value in position [3, 1].
 *  @param {number} c2 - Matrix value in position [3, 2].
 *  @param {number} c3 - Matrix value in position [3, 3].
 *  @returns {number}
 */
function determinant3x3(a1, a2, a3, b1, b2, b3, c1, c2, c3) {

    return a1 * determinant2x2(b2, b3, c2, c3) -
           b1 * determinant2x2(a2, a3, c2, c3) +
           c1 * determinant2x2(a2, a3, b2, b3);
}

/**
 *  Calculates the determinant of a 4x4 matrix.
 *  @param {XCSSMatrix} matrix - The matrix to calculate the determinant of.
 *  @returns {number}
 */
function determinant4x4(matrix) {
    var
        m = matrix,
        // Assign to individual variable names to aid selecting correct elements
        a1 = m.m11, b1 = m.m21, c1 = m.m31, d1 = m.m41,
        a2 = m.m12, b2 = m.m22, c2 = m.m32, d2 = m.m42,
        a3 = m.m13, b3 = m.m23, c3 = m.m33, d3 = m.m43,
        a4 = m.m14, b4 = m.m24, c4 = m.m34, d4 = m.m44;

    return a1 * determinant3x3(b2, b3, b4, c2, c3, c4, d2, d3, d4) -
           b1 * determinant3x3(a2, a3, a4, c2, c3, c4, d2, d3, d4) +
           c1 * determinant3x3(a2, a3, a4, b2, b3, b4, d2, d3, d4) -
           d1 * determinant3x3(a2, a3, a4, b2, b3, b4, c2, c3, c4);
}

/**
 *  Determines whether the matrix is affine.
 *  @returns {boolean}
 */
function isAffine(matrix) {
    return matrix.m13 === 0 && matrix.m14 === 0 &&
           matrix.m23 === 0 && matrix.m24 === 0 &&
           matrix.m31 === 0 && matrix.m32 === 0 &&
           matrix.m33 === 1 && matrix.m34 === 0 &&
           matrix.m43 === 0 && matrix.m44 === 1;
}

/**
 *  Returns whether the matrix is the identity matrix or a translation matrix.
 *  @return {boolean}
 */
function isIdentityOrTranslation(matrix) {
    var m = matrix;

    return m.m11 === 1 && m.m12 === 0 && m.m13 === 0 && m.m14 === 0 &&
           m.m21 === 0 && m.m22 === 1 && m.m23 === 0 && m.m24 === 0 &&
           m.m31 === 0 && m.m31 === 0 && m.m33 === 1 && m.m34 === 0 &&
    /* m41, m42 and m43 are the translation points */   m.m44 === 1;
}

/**
 *  Returns the adjoint matrix.
 *  @return {XCSSMatrix}
 */
function adjoint(matrix) {
    var m = matrix,
        // make `result` the same type as the given metric
        result = new matrix.constructor(),

        a1 = m.m11, b1 = m.m12, c1 = m.m13, d1 = m.m14,
        a2 = m.m21, b2 = m.m22, c2 = m.m23, d2 = m.m24,
        a3 = m.m31, b3 = m.m32, c3 = m.m33, d3 = m.m34,
        a4 = m.m41, b4 = m.m42, c4 = m.m43, d4 = m.m44;

    // Row column labeling reversed since we transpose rows & columns
    result.m11 =  determinant3x3(b2, b3, b4, c2, c3, c4, d2, d3, d4);
    result.m21 = -determinant3x3(a2, a3, a4, c2, c3, c4, d2, d3, d4);
    result.m31 =  determinant3x3(a2, a3, a4, b2, b3, b4, d2, d3, d4);
    result.m41 = -determinant3x3(a2, a3, a4, b2, b3, b4, c2, c3, c4);

    result.m12 = -determinant3x3(b1, b3, b4, c1, c3, c4, d1, d3, d4);
    result.m22 =  determinant3x3(a1, a3, a4, c1, c3, c4, d1, d3, d4);
    result.m32 = -determinant3x3(a1, a3, a4, b1, b3, b4, d1, d3, d4);
    result.m42 =  determinant3x3(a1, a3, a4, b1, b3, b4, c1, c3, c4);

    result.m13 =  determinant3x3(b1, b2, b4, c1, c2, c4, d1, d2, d4);
    result.m23 = -determinant3x3(a1, a2, a4, c1, c2, c4, d1, d2, d4);
    result.m33 =  determinant3x3(a1, a2, a4, b1, b2, b4, d1, d2, d4);
    result.m43 = -determinant3x3(a1, a2, a4, b1, b2, b4, c1, c2, c4);

    result.m14 = -determinant3x3(b1, b2, b3, c1, c2, c3, d1, d2, d3);
    result.m24 =  determinant3x3(a1, a2, a3, c1, c2, c3, d1, d2, d3);
    result.m34 = -determinant3x3(a1, a2, a3, b1, b2, b3, d1, d2, d3);
    result.m44 =  determinant3x3(a1, a2, a3, b1, b2, b3, c1, c2, c3);

    return result;
}

function inverse(matrix) {
  var inv;

  if (isIdentityOrTranslation(matrix)) {
      inv = new matrix.constructor();

      if (!(matrix.m41 === 0 && matrix.m42 === 0 && matrix.m43 === 0)) {
          inv.m41 = -matrix.m41;
          inv.m42 = -matrix.m42;
          inv.m43 = -matrix.m43;
      }

      return inv;
  }

  // Calculate the adjoint matrix
  var result = adjoint(matrix);

  // Calculate the 4x4 determinant
  var det = determinant4x4(matrix);

  // If the determinant is zero, then the inverse matrix is not unique
  if (Math.abs(det) < 1e-8) return null;

  // Scale the adjoint matrix to get the inverse
  for (var i = 1; i < 5; i++) {
      for (var j = 1; j < 5; j++) {
          result[('m' + i) + j] /= det;
      }
  }

  return result;
}

function multiply(matrix, otherMatrix) {
  if (!otherMatrix) return null;

  var a = otherMatrix,
      b = matrix,
      c = new matrix.constructor();

  c.m11 = a.m11 * b.m11 + a.m12 * b.m21 + a.m13 * b.m31 + a.m14 * b.m41;
  c.m12 = a.m11 * b.m12 + a.m12 * b.m22 + a.m13 * b.m32 + a.m14 * b.m42;
  c.m13 = a.m11 * b.m13 + a.m12 * b.m23 + a.m13 * b.m33 + a.m14 * b.m43;
  c.m14 = a.m11 * b.m14 + a.m12 * b.m24 + a.m13 * b.m34 + a.m14 * b.m44;

  c.m21 = a.m21 * b.m11 + a.m22 * b.m21 + a.m23 * b.m31 + a.m24 * b.m41;
  c.m22 = a.m21 * b.m12 + a.m22 * b.m22 + a.m23 * b.m32 + a.m24 * b.m42;
  c.m23 = a.m21 * b.m13 + a.m22 * b.m23 + a.m23 * b.m33 + a.m24 * b.m43;
  c.m24 = a.m21 * b.m14 + a.m22 * b.m24 + a.m23 * b.m34 + a.m24 * b.m44;

  c.m31 = a.m31 * b.m11 + a.m32 * b.m21 + a.m33 * b.m31 + a.m34 * b.m41;
  c.m32 = a.m31 * b.m12 + a.m32 * b.m22 + a.m33 * b.m32 + a.m34 * b.m42;
  c.m33 = a.m31 * b.m13 + a.m32 * b.m23 + a.m33 * b.m33 + a.m34 * b.m43;
  c.m34 = a.m31 * b.m14 + a.m32 * b.m24 + a.m33 * b.m34 + a.m34 * b.m44;

  c.m41 = a.m41 * b.m11 + a.m42 * b.m21 + a.m43 * b.m31 + a.m44 * b.m41;
  c.m42 = a.m41 * b.m12 + a.m42 * b.m22 + a.m43 * b.m32 + a.m44 * b.m42;
  c.m43 = a.m41 * b.m13 + a.m42 * b.m23 + a.m43 * b.m33 + a.m44 * b.m43;
  c.m44 = a.m41 * b.m14 + a.m42 * b.m24 + a.m43 * b.m34 + a.m44 * b.m44;

  return c;
}

function transpose(matrix) {
  var result = new matrix.constructor();
  var rows = 4, cols = 4;
  var i = cols, j;
  while (i) {
    j = rows;
    while (j) {
      result['m' + i + j] = matrix['m'+ j + i];
      j--;
    }
    i--;
  }
  return result;
}

/*
  Input:  matrix      ; a 4x4 matrix
  Output: translation ; a 3 component vector
          scale       ; a 3 component vector
          skew        ; skew factors XY,XZ,YZ represented as a 3 component vector
          perspective ; a 4 component vector
          rotate  ; a 4 component vector
  Returns false if the matrix cannot be decomposed, true if it can
*/
var Vector4 = require('../Vector4.js');
function decompose(matrix) {
  var perspectiveMatrix, rightHandSide, inversePerspectiveMatrix, transposedInversePerspectiveMatrix,
      perspective, translate, row, i, len, scale, skew, pdum3, rotate;

  // Normalize the matrix.
  if (matrix.m33 == 0) { return false; }

  for (i = 1; i <= 4; i++) {
    for (j = 1; j < 4; j++) {
      matrix['m'+i+j] /= matrix.m44;
    }
  }

  // perspectiveMatrix is used to solve for perspective, but it also provides
  // an easy way to test for singularity of the upper 3x3 component.
  perspectiveMatrix = matrix;
  perspectiveMatrix.m14 = 0;
  perspectiveMatrix.m24 = 0;
  perspectiveMatrix.m34 = 0;
  perspectiveMatrix.m44 = 1;

  if (determinant4x4(perspectiveMatrix) == 0) {
    return false;
  }

  // First, isolate perspective.
  if (matrix.m14 != 0 || matrix.m24 != 0 || matrix.m34 != 0) {
    // rightHandSide is the right hand side of the equation.
    rightHandSide = new Vector4(matrix.m14, matrix.m24, matrix.m34, matrix.m44);

    // Solve the equation by inverting perspectiveMatrix and multiplying
    // rightHandSide by the inverse.
    inversePerspectiveMatrix = inverse(perspectiveMatrix);
    transposedInversePerspectiveMatrix = transpose(inversePerspectiveMatrix);
    perspective = rightHandSide.multiplyByMatrix(transposedInversePerspectiveMatrix);
  }
  else {
    // No perspective.
    perspective = new Vector4(0, 0, 0, 1);
  }

  // Next take care of translation
  translate = new Vector4(matrix.m41, matrix.m42, matrix.m43);

  // Now get scale and shear. 'row' is a 3 element array of 3 component vectors
  row = [ new Vector4(), new Vector4(), new Vector4() ];
  for (i = 1, len = row.length; i < len; i++) {
    row[i-1].x = matrix['m'+i+'1'];
    row[i-1].y = matrix['m'+i+'2'];
    row[i-1].z = matrix['m'+i+'3'];
  }

  // Compute X scale factor and normalize first row.
  scale = new Vector4();
  skew = new Vector4();

  scale.x = row[0].length();
  row[0] = row[0].normalize();

  // Compute XY shear factor and make 2nd row orthogonal to 1st.
  skew.x = row[0].dot(row[1]);
  row[1] = row[1].combine(row[0], 1.0, -skew.x);

  // Now, compute Y scale and normalize 2nd row.
  scale.y = row[1].length();
  row[1] = row[1].normalize();
  skew.x /= scale.y;

  // Compute XZ and YZ shears, orthogonalize 3rd row
  skew.y = row[0].dot(row[2]);
  row[2] = row[2].combine(row[0], 1.0, -skew.y);
  skew.z = row[1].dot(row[2]);
  row[2] = row[2].combine(row[1], 1.0, -skew.z);

  // Next, get Z scale and normalize 3rd row.
  scale.z = row[2].length();
  row[2] = row[2].normalize();
  skew.y = (skew.y / scale.z) || 0;
  skew.z = (skew.z / scale.z) || 0;

  // At this point, the matrix (in rows) is orthonormal.
  // Check for a coordinate system flip.  If the determinant
  // is -1, then negate the matrix and the scaling factors.
  pdum3 = row[1].cross(row[2]);
  if (row[0].dot(pdum3) < 0) {
    for (i = 0; i < 3; i++) {
      scale.x *= -1;
      row[i].x *= -1;
      row[i].y *= -1;
      row[i].z *= -1;
    }
  }

  // Now, get the rotations out
  // FROM W3C
  rotate = new Vector4();
  rotate.x = 0.5 * Math.sqrt(Math.max(1 + row[0].x - row[1].y - row[2].z, 0));
  rotate.y = 0.5 * Math.sqrt(Math.max(1 - row[0].x + row[1].y - row[2].z, 0));
  rotate.z = 0.5 * Math.sqrt(Math.max(1 - row[0].x - row[1].y + row[2].z, 0));
  rotate.w = 0.5 * Math.sqrt(Math.max(1 + row[0].x + row[1].y + row[2].z, 0));

  // if (row[2].y > row[1].z) rotate[0] = -rotate[0];
  // if (row[0].z > row[2].x) rotate[1] = -rotate[1];
  // if (row[1].x > row[0].y) rotate[2] = -rotate[2];

  // FROM MORF.JS
  rotate.y = Math.asin(-row[0].z);
  if (Math.cos(rotate.y) != 0) {
    rotate.x = Math.atan2(row[1].z, row[2].z);
    rotate.z = Math.atan2(row[0].y, row[0].x);
  } else {
    rotate.x = Math.atan2(-row[2].x, row[1].y);
    rotate.z = 0;
  }

  // FROM http://blog.bwhiting.co.uk/?p=26
  // scale.x2 = Math.sqrt(matrix.m11*matrix.m11 + matrix.m21*matrix.m21 + matrix.m31*matrix.m31);
  // scale.y2 = Math.sqrt(matrix.m12*matrix.m12 + matrix.m22*matrix.m22 + matrix.m32*matrix.m32);
  // scale.z2 = Math.sqrt(matrix.m13*matrix.m13 + matrix.m23*matrix.m23 + matrix.m33*matrix.m33);

  // rotate.x2 = Math.atan2(matrix.m23/scale.z2, matrix.m33/scale.z2);
  // rotate.y2 = -Math.asin(matrix.m13/scale.z2);
  // rotate.z2 = Math.atan2(matrix.m12/scale.y2, matrix.m11/scale.x2);

  return {
    perspective : perspective,
    translate   : translate,
    skew        : skew,
    scale       : scale,
    rotate      : rotate
  };
}

},{"../Vector4.js":34}],39:[function(require,module,exports){
module.exports = {
  length           : length,
  normalize        : normalize,
  dot              : dot,
  cross            : cross,
  combine          : combine,
  multiplyByMatrix : multiplyByMatrix
};

/**
 * Get the length of the vector
 * @author Joe Lambert
 * @returns {float}
 */

function length(vector) {
  return Math.sqrt(vector.x*vector.x + vector.y*vector.y + vector.z*vector.z);
}


/**
 * Get a normalized representation of the vector
 * @author Joe Lambert
 * @returns {Vector4}
 */

function normalize(vector) {
  var len = length(vector),
    v = new vector.constructor(vector.x / len, vector.y / len, vector.z / len);

  return v;
}


/**
 * Vector Dot-Product
 * @param {Vector4} v The second vector to apply the product to
 * @author Joe Lambert
 * @returns {float} The Dot-Product of a and b.
 */

function dot(a, b) {
  return a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w;
}


/**
 * Vector Cross-Product
 * @param {Vector4} v The second vector to apply the product to
 * @author Joe Lambert
 * @returns {Vector4} The Cross-Product of a and b.
 */

function cross(a, b) {
  return new a.constructor(
    (a.y * b.z) - (a.z * b.y),
    (a.z * b.x) - (a.x * b.z),
    (a.x * b.y) - (a.y * b.x)
  );
}


/**
 * Helper function required for matrix decomposition
 * A Javascript implementation of pseudo code available from http://www.w3.org/TR/css3-2d-transforms/#matrix-decomposition
 * @param {Vector4} aPoint A 3D point
 * @param {float} ascl
 * @param {float} bscl
 * @author Joe Lambert
 * @returns {Vector4}
 */

function combine(aPoint, bPoint, ascl, bscl) {
  return new aPoint.constructor(
    (ascl * aPoint.x) + (bscl * bPoint.x),
    (ascl * aPoint.y) + (bscl * bPoint.y),
    (ascl * aPoint.z) + (bscl * bPoint.z)
  );
}

function multiplyByMatrix(vector, matrix) {
  return new vector.constructor(
    (matrix.m11 * vector.x) + (matrix.m12 * vector.y) + (matrix.m13 * vector.z),
    (matrix.m21 * vector.x) + (matrix.m22 * vector.y) + (matrix.m23 * vector.z),
    (matrix.m31 * vector.x) + (matrix.m32 * vector.y) + (matrix.m33 * vector.z)
  );
}

},{}],40:[function(require,module,exports){
function DOMParser(options){
	this.options = options ||{locator:{}};
	
}
DOMParser.prototype.parseFromString = function(source,mimeType){	
	var options = this.options;
	var sax =  new XMLReader();
	var domBuilder = options.domBuilder || new DOMHandler();//contentHandler and LexicalHandler
	var errorHandler = options.errorHandler;
	var locator = options.locator;
	var defaultNSMap = options.xmlns||{};
	var entityMap = {'lt':'<','gt':'>','amp':'&','quot':'"','apos':"'"}
	if(locator){
		domBuilder.setDocumentLocator(locator)
	}
	
	sax.errorHandler = buildErrorHandler(errorHandler,domBuilder,locator);
	sax.domBuilder = options.domBuilder || domBuilder;
	if(/\/x?html?$/.test(mimeType)){
		entityMap.nbsp = '\xa0';
		entityMap.copy = '\xa9';
		defaultNSMap['']= 'http://www.w3.org/1999/xhtml';
	}
	defaultNSMap.xml = defaultNSMap.xml || 'http://www.w3.org/XML/1998/namespace';
	if(source){
		sax.parse(source,defaultNSMap,entityMap);
	}else{
		sax.errorHandler.error("invalid document source");
	}
	return domBuilder.document;
}
function buildErrorHandler(errorImpl,domBuilder,locator){
	if(!errorImpl){
		if(domBuilder instanceof DOMHandler){
			return domBuilder;
		}
		errorImpl = domBuilder ;
	}
	var errorHandler = {}
	var isCallback = errorImpl instanceof Function;
	locator = locator||{}
	function build(key){
		var fn = errorImpl[key];
		if(!fn && isCallback){
			fn = errorImpl.length == 2?function(msg){errorImpl(key,msg)}:errorImpl;
		}
		errorHandler[key] = fn && function(msg){
			fn('[xmldom '+key+']\t'+msg+_locator(locator));
		}||function(){};
	}
	build('warning');
	build('error');
	build('fatalError');
	return errorHandler;
}

//console.log('#\n\n\n\n\n\n\n####')
/**
 * +ContentHandler+ErrorHandler
 * +LexicalHandler+EntityResolver2
 * -DeclHandler-DTDHandler 
 * 
 * DefaultHandler:EntityResolver, DTDHandler, ContentHandler, ErrorHandler
 * DefaultHandler2:DefaultHandler,LexicalHandler, DeclHandler, EntityResolver2
 * @link http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
 */
function DOMHandler() {
    this.cdata = false;
}
function position(locator,node){
	node.lineNumber = locator.lineNumber;
	node.columnNumber = locator.columnNumber;
}
/**
 * @see org.xml.sax.ContentHandler#startDocument
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
 */ 
DOMHandler.prototype = {
	startDocument : function() {
    	this.document = new DOMImplementation().createDocument(null, null, null);
    	if (this.locator) {
        	this.document.documentURI = this.locator.systemId;
    	}
	},
	startElement:function(namespaceURI, localName, qName, attrs) {
		var doc = this.document;
	    var el = doc.createElementNS(namespaceURI, qName||localName);
	    var len = attrs.length;
	    appendElement(this, el);
	    this.currentElement = el;
	    
		this.locator && position(this.locator,el)
	    for (var i = 0 ; i < len; i++) {
	        var namespaceURI = attrs.getURI(i);
	        var value = attrs.getValue(i);
	        var qName = attrs.getQName(i);
			var attr = doc.createAttributeNS(namespaceURI, qName);
			if( attr.getOffset){
				position(attr.getOffset(1),attr)
			}
			attr.value = attr.nodeValue = value;
			el.setAttributeNode(attr)
	    }
	},
	endElement:function(namespaceURI, localName, qName) {
		var current = this.currentElement
	    var tagName = current.tagName;
	    this.currentElement = current.parentNode;
	},
	startPrefixMapping:function(prefix, uri) {
	},
	endPrefixMapping:function(prefix) {
	},
	processingInstruction:function(target, data) {
	    var ins = this.document.createProcessingInstruction(target, data);
	    this.locator && position(this.locator,ins)
	    appendElement(this, ins);
	},
	ignorableWhitespace:function(ch, start, length) {
	},
	characters:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
		//console.log(chars)
		if(this.currentElement && chars){
			if (this.cdata) {
				var charNode = this.document.createCDATASection(chars);
				this.currentElement.appendChild(charNode);
			} else {
				var charNode = this.document.createTextNode(chars);
				this.currentElement.appendChild(charNode);
			}
			this.locator && position(this.locator,charNode)
		}
	},
	skippedEntity:function(name) {
	},
	endDocument:function() {
		this.document.normalize();
	},
	setDocumentLocator:function (locator) {
	    if(this.locator = locator){// && !('lineNumber' in locator)){
	    	locator.lineNumber = 0;
	    }
	},
	//LexicalHandler
	comment:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
	    var comm = this.document.createComment(chars);
	    this.locator && position(this.locator,comm)
	    appendElement(this, comm);
	},
	
	startCDATA:function() {
	    //used in characters() methods
	    this.cdata = true;
	},
	endCDATA:function() {
	    this.cdata = false;
	},
	
	startDTD:function(name, publicId, systemId) {
		var impl = this.document.implementation;
	    if (impl && impl.createDocumentType) {
	        var dt = impl.createDocumentType(name, publicId, systemId);
	        this.locator && position(this.locator,dt)
	        appendElement(this, dt);
	    }
	},
	/**
	 * @see org.xml.sax.ErrorHandler
	 * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
	 */
	warning:function(error) {
		console.warn('[xmldom warning]\t'+error,_locator(this.locator));
	},
	error:function(error) {
		console.error('[xmldom error]\t'+error,_locator(this.locator));
	},
	fatalError:function(error) {
		console.error('[xmldom fatalError]\t'+error,_locator(this.locator));
	    throw error;
	}
}
function _locator(l){
	if(l){
		return '\n@'+(l.systemId ||'')+'#[line:'+l.lineNumber+',col:'+l.columnNumber+']'
	}
}
function _toString(chars,start,length){
	if(typeof chars == 'string'){
		return chars.substr(start,length)
	}else{//java sax connect width xmldom on rhino(what about: "? && !(chars instanceof String)")
		if(chars.length >= start+length || start){
			return new java.lang.String(chars,start,length)+'';
		}
		return chars;
	}
}

/*
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html
 * used method of org.xml.sax.ext.LexicalHandler:
 *  #comment(chars, start, length)
 *  #startCDATA()
 *  #endCDATA()
 *  #startDTD(name, publicId, systemId)
 *
 *
 * IGNORED method of org.xml.sax.ext.LexicalHandler:
 *  #endDTD()
 *  #startEntity(name)
 *  #endEntity(name)
 *
 *
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html
 * IGNORED method of org.xml.sax.ext.DeclHandler
 * 	#attributeDecl(eName, aName, type, mode, value)
 *  #elementDecl(name, model)
 *  #externalEntityDecl(name, publicId, systemId)
 *  #internalEntityDecl(name, value)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
 * IGNORED method of org.xml.sax.EntityResolver2
 *  #resolveEntity(String name,String publicId,String baseURI,String systemId)
 *  #resolveEntity(publicId, systemId)
 *  #getExternalSubset(name, baseURI)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
 * IGNORED method of org.xml.sax.DTDHandler
 *  #notationDecl(name, publicId, systemId) {};
 *  #unparsedEntityDecl(name, publicId, systemId, notationName) {};
 */
"endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(/\w+/g,function(key){
	DOMHandler.prototype[key] = function(){return null}
})

/* Private static helpers treated below as private instance methods, so don't need to add these to the public API; we might use a Relator to also get rid of non-standard public properties */
function appendElement (hander,node) {
    if (!hander.currentElement) {
        hander.document.appendChild(node);
    } else {
        hander.currentElement.appendChild(node);
    }
}//appendChild and setAttributeNS are preformance key

if(typeof require == 'function'){
	var XMLReader = require('./sax').XMLReader;
	var DOMImplementation = exports.DOMImplementation = require('./dom').DOMImplementation;
	exports.XMLSerializer = require('./dom').XMLSerializer ;
	exports.DOMParser = DOMParser;
}

},{"./dom":41,"./sax":42}],41:[function(require,module,exports){
/*
 * DOM Level 2
 * Object DOMException
 * @see http://www.w3.org/TR/REC-DOM-Level-1/ecma-script-language-binding.html
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/ecma-script-binding.html
 */

function copy(src,dest){
	for(var p in src){
		dest[p] = src[p];
	}
}
/**
^\w+\.prototype\.([_\w]+)\s*=\s*((?:.*\{\s*?[\r\n][\s\S]*?^})|\S.*?(?=[;\r\n]));?
^\w+\.prototype\.([_\w]+)\s*=\s*(\S.*?(?=[;\r\n]));?
 */
function _extends(Class,Super){
	var pt = Class.prototype;
	if(Object.create){
		var ppt = Object.create(Super.prototype)
		pt.__proto__ = ppt;
	}
	if(!(pt instanceof Super)){
		function t(){};
		t.prototype = Super.prototype;
		t = new t();
		copy(pt,t);
		Class.prototype = pt = t;
	}
	if(pt.constructor != Class){
		if(typeof Class != 'function'){
			console.error("unknow Class:"+Class)
		}
		pt.constructor = Class
	}
}
var htmlns = 'http://www.w3.org/1999/xhtml' ;
// Node Types
var NodeType = {}
var ELEMENT_NODE                = NodeType.ELEMENT_NODE                = 1;
var ATTRIBUTE_NODE              = NodeType.ATTRIBUTE_NODE              = 2;
var TEXT_NODE                   = NodeType.TEXT_NODE                   = 3;
var CDATA_SECTION_NODE          = NodeType.CDATA_SECTION_NODE          = 4;
var ENTITY_REFERENCE_NODE       = NodeType.ENTITY_REFERENCE_NODE       = 5;
var ENTITY_NODE                 = NodeType.ENTITY_NODE                 = 6;
var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
var COMMENT_NODE                = NodeType.COMMENT_NODE                = 8;
var DOCUMENT_NODE               = NodeType.DOCUMENT_NODE               = 9;
var DOCUMENT_TYPE_NODE          = NodeType.DOCUMENT_TYPE_NODE          = 10;
var DOCUMENT_FRAGMENT_NODE      = NodeType.DOCUMENT_FRAGMENT_NODE      = 11;
var NOTATION_NODE               = NodeType.NOTATION_NODE               = 12;

// ExceptionCode
var ExceptionCode = {}
var ExceptionMessage = {};
var INDEX_SIZE_ERR              = ExceptionCode.INDEX_SIZE_ERR              = ((ExceptionMessage[1]="Index size error"),1);
var DOMSTRING_SIZE_ERR          = ExceptionCode.DOMSTRING_SIZE_ERR          = ((ExceptionMessage[2]="DOMString size error"),2);
var HIERARCHY_REQUEST_ERR       = ExceptionCode.HIERARCHY_REQUEST_ERR       = ((ExceptionMessage[3]="Hierarchy request error"),3);
var WRONG_DOCUMENT_ERR          = ExceptionCode.WRONG_DOCUMENT_ERR          = ((ExceptionMessage[4]="Wrong document"),4);
var INVALID_CHARACTER_ERR       = ExceptionCode.INVALID_CHARACTER_ERR       = ((ExceptionMessage[5]="Invalid character"),5);
var NO_DATA_ALLOWED_ERR         = ExceptionCode.NO_DATA_ALLOWED_ERR         = ((ExceptionMessage[6]="No data allowed"),6);
var NO_MODIFICATION_ALLOWED_ERR = ExceptionCode.NO_MODIFICATION_ALLOWED_ERR = ((ExceptionMessage[7]="No modification allowed"),7);
var NOT_FOUND_ERR               = ExceptionCode.NOT_FOUND_ERR               = ((ExceptionMessage[8]="Not found"),8);
var NOT_SUPPORTED_ERR           = ExceptionCode.NOT_SUPPORTED_ERR           = ((ExceptionMessage[9]="Not supported"),9);
var INUSE_ATTRIBUTE_ERR         = ExceptionCode.INUSE_ATTRIBUTE_ERR         = ((ExceptionMessage[10]="Attribute in use"),10);
//level2
var INVALID_STATE_ERR        	= ExceptionCode.INVALID_STATE_ERR        	= ((ExceptionMessage[11]="Invalid state"),11);
var SYNTAX_ERR               	= ExceptionCode.SYNTAX_ERR               	= ((ExceptionMessage[12]="Syntax error"),12);
var INVALID_MODIFICATION_ERR 	= ExceptionCode.INVALID_MODIFICATION_ERR 	= ((ExceptionMessage[13]="Invalid modification"),13);
var NAMESPACE_ERR            	= ExceptionCode.NAMESPACE_ERR           	= ((ExceptionMessage[14]="Invalid namespace"),14);
var INVALID_ACCESS_ERR       	= ExceptionCode.INVALID_ACCESS_ERR      	= ((ExceptionMessage[15]="Invalid access"),15);


function DOMException(code, message) {
	if(message instanceof Error){
		var error = message;
	}else{
		error = this;
		Error.call(this, ExceptionMessage[code]);
		this.message = ExceptionMessage[code];
		if(Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
	}
	error.code = code;
	if(message) this.message = this.message + ": " + message;
	return error;
};
DOMException.prototype = Error.prototype;
copy(ExceptionCode,DOMException)
/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-536297177
 * The NodeList interface provides the abstraction of an ordered collection of nodes, without defining or constraining how this collection is implemented. NodeList objects in the DOM are live.
 * The items in the NodeList are accessible via an integral index, starting from 0.
 */
function NodeList() {
};
NodeList.prototype = {
	/**
	 * The number of nodes in the list. The range of valid child node indices is 0 to length-1 inclusive.
	 * @standard level1
	 */
	length:0, 
	/**
	 * Returns the indexth item in the collection. If index is greater than or equal to the number of nodes in the list, this returns null.
	 * @standard level1
	 * @param index  unsigned long 
	 *   Index into the collection.
	 * @return Node
	 * 	The node at the indexth position in the NodeList, or null if that is not a valid index. 
	 */
	item: function(index) {
		return this[index] || null;
	},
	toString:function(){
		for(var buf = [], i = 0;i<this.length;i++){
			serializeToString(this[i],buf);
		}
		return buf.join('');
	}
};
function LiveNodeList(node,refresh){
	this._node = node;
	this._refresh = refresh
	_updateLiveList(this);
}
function _updateLiveList(list){
	var inc = list._node._inc || list._node.ownerDocument._inc;
	if(list._inc != inc){
		var ls = list._refresh(list._node);
		//console.log(ls.length)
		__set__(list,'length',ls.length);
		copy(ls,list);
		list._inc = inc;
	}
}
LiveNodeList.prototype.item = function(i){
	_updateLiveList(this);
	return this[i];
}

_extends(LiveNodeList,NodeList);
/**
 * 
 * Objects implementing the NamedNodeMap interface are used to represent collections of nodes that can be accessed by name. Note that NamedNodeMap does not inherit from NodeList; NamedNodeMaps are not maintained in any particular order. Objects contained in an object implementing NamedNodeMap may also be accessed by an ordinal index, but this is simply to allow convenient enumeration of the contents of a NamedNodeMap, and does not imply that the DOM specifies an order to these Nodes.
 * NamedNodeMap objects in the DOM are live.
 * used for attributes or DocumentType entities 
 */
function NamedNodeMap() {
};

function _findNodeIndex(list,node){
	var i = list.length;
	while(i--){
		if(list[i] === node){return i}
	}
}

function _addNamedNode(el,list,newAttr,oldAttr){
	if(oldAttr){
		list[_findNodeIndex(list,oldAttr)] = newAttr;
	}else{
		list[list.length++] = newAttr;
	}
	if(el){
		newAttr.ownerElement = el;
		var doc = el.ownerDocument;
		if(doc){
			oldAttr && _onRemoveAttribute(doc,el,oldAttr);
			_onAddAttribute(doc,el,newAttr);
		}
	}
}
function _removeNamedNode(el,list,attr){
	var i = _findNodeIndex(list,attr);
	if(i>=0){
		var lastIndex = list.length-1
		while(i<lastIndex){
			list[i] = list[++i]
		}
		list.length = lastIndex;
		if(el){
			var doc = el.ownerDocument;
			if(doc){
				_onRemoveAttribute(doc,el,attr);
				attr.ownerElement = null;
			}
		}
	}else{
		throw DOMException(NOT_FOUND_ERR,new Error())
	}
}
NamedNodeMap.prototype = {
	length:0,
	item:NodeList.prototype.item,
	getNamedItem: function(key) {
//		if(key.indexOf(':')>0 || key == 'xmlns'){
//			return null;
//		}
		var i = this.length;
		while(i--){
			var attr = this[i];
			if(attr.nodeName == key){
				return attr;
			}
		}
	},
	setNamedItem: function(attr) {
		var el = attr.ownerElement;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		var oldAttr = this.getNamedItem(attr.nodeName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},
	/* returns Node */
	setNamedItemNS: function(attr) {// raises: WRONG_DOCUMENT_ERR,NO_MODIFICATION_ALLOWED_ERR,INUSE_ATTRIBUTE_ERR
		var el = attr.ownerElement, oldAttr;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		oldAttr = this.getNamedItemNS(attr.namespaceURI,attr.localName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},

	/* returns Node */
	removeNamedItem: function(key) {
		var attr = this.getNamedItem(key);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
		
		
	},// raises: NOT_FOUND_ERR,NO_MODIFICATION_ALLOWED_ERR
	
	//for level2
	removeNamedItemNS:function(namespaceURI,localName){
		var attr = this.getNamedItemNS(namespaceURI,localName);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
	},
	getNamedItemNS: function(namespaceURI, localName) {
		var i = this.length;
		while(i--){
			var node = this[i];
			if(node.localName == localName && node.namespaceURI == namespaceURI){
				return node;
			}
		}
		return null;
	}
};
/**
 * @see http://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-102161490
 */
function DOMImplementation(/* Object */ features) {
	this._features = {};
	if (features) {
		for (var feature in features) {
			 this._features = features[feature];
		}
	}
};

DOMImplementation.prototype = {
	hasFeature: function(/* string */ feature, /* string */ version) {
		var versions = this._features[feature.toLowerCase()];
		if (versions && (!version || version in versions)) {
			return true;
		} else {
			return false;
		}
	},
	// Introduced in DOM Level 2:
	createDocument:function(namespaceURI,  qualifiedName, doctype){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR,WRONG_DOCUMENT_ERR
		var doc = new Document();
		doc.implementation = this;
		doc.childNodes = new NodeList();
		doc.doctype = doctype;
		if(doctype){
			doc.appendChild(doctype);
		}
		if(qualifiedName){
			var root = doc.createElementNS(namespaceURI,qualifiedName);
			doc.appendChild(root);
		}
		return doc;
	},
	// Introduced in DOM Level 2:
	createDocumentType:function(qualifiedName, publicId, systemId){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR
		var node = new DocumentType();
		node.name = qualifiedName;
		node.nodeName = qualifiedName;
		node.publicId = publicId;
		node.systemId = systemId;
		// Introduced in DOM Level 2:
		//readonly attribute DOMString        internalSubset;
		
		//TODO:..
		//  readonly attribute NamedNodeMap     entities;
		//  readonly attribute NamedNodeMap     notations;
		return node;
	}
};


/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-1950641247
 */

function Node() {
};

Node.prototype = {
	firstChild : null,
	lastChild : null,
	previousSibling : null,
	nextSibling : null,
	attributes : null,
	parentNode : null,
	childNodes : null,
	ownerDocument : null,
	nodeValue : null,
	namespaceURI : null,
	prefix : null,
	localName : null,
	// Modified in DOM Level 2:
	insertBefore:function(newChild, refChild){//raises 
		return _insertBefore(this,newChild,refChild);
	},
	replaceChild:function(newChild, oldChild){//raises 
		this.insertBefore(newChild,oldChild);
		if(oldChild){
			this.removeChild(oldChild);
		}
	},
	removeChild:function(oldChild){
		return _removeChild(this,oldChild);
	},
	appendChild:function(newChild){
		return this.insertBefore(newChild,null);
	},
	hasChildNodes:function(){
		return this.firstChild != null;
	},
	cloneNode:function(deep){
		return cloneNode(this.ownerDocument||this,this,deep);
	},
	// Modified in DOM Level 2:
	normalize:function(){
		var child = this.firstChild;
		while(child){
			var next = child.nextSibling;
			if(next && next.nodeType == TEXT_NODE && child.nodeType == TEXT_NODE){
				this.removeChild(next);
				child.appendData(next.data);
			}else{
				child.normalize();
				child = next;
			}
		}
	},
  	// Introduced in DOM Level 2:
	isSupported:function(feature, version){
		return this.ownerDocument.implementation.hasFeature(feature,version);
	},
    // Introduced in DOM Level 2:
    hasAttributes:function(){
    	return this.attributes.length>0;
    },
    lookupPrefix:function(namespaceURI){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			for(var n in map){
    				if(map[n] == namespaceURI){
    					return n;
    				}
    			}
    		}
    		el = el.nodeType == 2?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    lookupNamespaceURI:function(prefix){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			if(prefix in map){
    				return map[prefix] ;
    			}
    		}
    		el = el.nodeType == 2?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    isDefaultNamespace:function(namespaceURI){
    	var prefix = this.lookupPrefix(namespaceURI);
    	return prefix == null;
    }
};


function _xmlEncoder(c){
	return c == '<' && '&lt;' ||
         c == '>' && '&gt;' ||
         c == '&' && '&amp;' ||
         c == '"' && '&quot;' ||
         '&#'+c.charCodeAt()+';'
}


copy(NodeType,Node);
copy(NodeType,Node.prototype);

/**
 * @param callback return true for continue,false for break
 * @return boolean true: break visit;
 */
function _visitNode(node,callback){
	if(callback(node)){
		return true;
	}
	if(node = node.firstChild){
		do{
			if(_visitNode(node,callback)){return true}
        }while(node=node.nextSibling)
    }
}



function Document(){
}
function _onAddAttribute(doc,el,newAttr){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		el._nsMap[newAttr.prefix?newAttr.localName:''] = newAttr.value
	}
}
function _onRemoveAttribute(doc,el,newAttr,remove){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		delete el._nsMap[newAttr.prefix?newAttr.localName:'']
	}
}
function _onUpdateChild(doc,el,newChild){
	if(doc && doc._inc){
		doc._inc++;
		//update childNodes
		var cs = el.childNodes;
		if(newChild){
			cs[cs.length++] = newChild;
		}else{
			//console.log(1)
			var child = el.firstChild;
			var i = 0;
			while(child){
				cs[i++] = child;
				child =child.nextSibling;
			}
			cs.length = i;
		}
	}
}

/**
 * attributes;
 * children;
 * 
 * writeable properties:
 * nodeValue,Attr:value,CharacterData:data
 * prefix
 */
function _removeChild(parentNode,child){
	var previous = child.previousSibling;
	var next = child.nextSibling;
	if(previous){
		previous.nextSibling = next;
	}else{
		parentNode.firstChild = next
	}
	if(next){
		next.previousSibling = previous;
	}else{
		parentNode.lastChild = previous;
	}
	_onUpdateChild(parentNode.ownerDocument,parentNode);
	return child;
}
/**
 * preformance key(refChild == null)
 */
function _insertBefore(parentNode,newChild,nextChild){
	var cp = newChild.parentNode;
	if(cp){
		cp.removeChild(newChild);//remove and update
	}
	if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
		var newFirst = newChild.firstChild;
		if (newFirst == null) {
			return newChild;
		}
		var newLast = newChild.lastChild;
	}else{
		newFirst = newLast = newChild;
	}
	var pre = nextChild ? nextChild.previousSibling : parentNode.lastChild;

	newFirst.previousSibling = pre;
	newLast.nextSibling = nextChild;
	
	
	if(pre){
		pre.nextSibling = newFirst;
	}else{
		parentNode.firstChild = newFirst;
	}
	if(nextChild == null){
		parentNode.lastChild = newLast;
	}else{
		nextChild.previousSibling = newLast;
	}
	do{
		newFirst.parentNode = parentNode;
	}while(newFirst !== newLast && (newFirst= newFirst.nextSibling))
	_onUpdateChild(parentNode.ownerDocument||parentNode,parentNode);
	//console.log(parentNode.lastChild.nextSibling == null)
	if (newChild.nodeType == DOCUMENT_FRAGMENT_NODE) {
		newChild.firstChild = newChild.lastChild = null;
	}
	return newChild;
}
function _appendSingleChild(parentNode,newChild){
	var cp = newChild.parentNode;
	if(cp){
		var pre = parentNode.lastChild;
		cp.removeChild(newChild);//remove and update
		var pre = parentNode.lastChild;
	}
	var pre = parentNode.lastChild;
	newChild.parentNode = parentNode;
	newChild.previousSibling = pre;
	newChild.nextSibling = null;
	if(pre){
		pre.nextSibling = newChild;
	}else{
		parentNode.firstChild = newChild;
	}
	parentNode.lastChild = newChild;
	_onUpdateChild(parentNode.ownerDocument,parentNode,newChild);
	return newChild;
	//console.log("__aa",parentNode.lastChild.nextSibling == null)
}
Document.prototype = {
	//implementation : null,
	nodeName :  '#document',
	nodeType :  DOCUMENT_NODE,
	doctype :  null,
	documentElement :  null,
	_inc : 1,
	
	insertBefore :  function(newChild, refChild){//raises 
		if(newChild.nodeType == DOCUMENT_FRAGMENT_NODE){
			var child = newChild.firstChild;
			while(child){
				var next = child.nextSibling;
				this.insertBefore(child,refChild);
				child = next;
			}
			return newChild;
		}
		if(this.documentElement == null && newChild.nodeType == 1){
			this.documentElement = newChild;
		}
		
		return _insertBefore(this,newChild,refChild),(newChild.ownerDocument = this),newChild;
	},
	removeChild :  function(oldChild){
		if(this.documentElement == oldChild){
			this.documentElement = null;
		}
		return _removeChild(this,oldChild);
	},
	// Introduced in DOM Level 2:
	importNode : function(importedNode,deep){
		return importNode(this,importedNode,deep);
	},
	// Introduced in DOM Level 2:
	getElementById :	function(id){
		var rtv = null;
		_visitNode(this.documentElement,function(node){
			if(node.nodeType == 1){
				if(node.getAttribute('id') == id){
					rtv = node;
					return true;
				}
			}
		})
		return rtv;
	},
	
	//document factory method:
	createElement :	function(tagName){
		var node = new Element();
		node.ownerDocument = this;
		node.nodeName = tagName;
		node.tagName = tagName;
		node.childNodes = new NodeList();
		var attrs	= node.attributes = new NamedNodeMap();
		attrs._ownerElement = node;
		return node;
	},
	createDocumentFragment :	function(){
		var node = new DocumentFragment();
		node.ownerDocument = this;
		node.childNodes = new NodeList();
		return node;
	},
	createTextNode :	function(data){
		var node = new Text();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createComment :	function(data){
		var node = new Comment();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createCDATASection :	function(data){
		var node = new CDATASection();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createProcessingInstruction :	function(target,data){
		var node = new ProcessingInstruction();
		node.ownerDocument = this;
		node.tagName = node.target = target;
		node.nodeValue= node.data = data;
		return node;
	},
	createAttribute :	function(name){
		var node = new Attr();
		node.ownerDocument	= this;
		node.name = name;
		node.nodeName	= name;
		node.localName = name;
		node.specified = true;
		return node;
	},
	createEntityReference :	function(name){
		var node = new EntityReference();
		node.ownerDocument	= this;
		node.nodeName	= name;
		return node;
	},
	// Introduced in DOM Level 2:
	createElementNS :	function(namespaceURI,qualifiedName){
		var node = new Element();
		var pl = qualifiedName.split(':');
		var attrs	= node.attributes = new NamedNodeMap();
		node.childNodes = new NodeList();
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.tagName = qualifiedName;
		node.namespaceURI = namespaceURI;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		attrs._ownerElement = node;
		return node;
	},
	// Introduced in DOM Level 2:
	createAttributeNS :	function(namespaceURI,qualifiedName){
		var node = new Attr();
		var pl = qualifiedName.split(':');
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.name = qualifiedName;
		node.namespaceURI = namespaceURI;
		node.specified = true;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		return node;
	}
};
_extends(Document,Node);


function Element() {
	this._nsMap = {};
};
Element.prototype = {
	nodeType : ELEMENT_NODE,
	hasAttribute : function(name){
		return this.getAttributeNode(name)!=null;
	},
	getAttribute : function(name){
		var attr = this.getAttributeNode(name);
		return attr && attr.value || '';
	},
	getAttributeNode : function(name){
		return this.attributes.getNamedItem(name);
	},
	setAttribute : function(name, value){
		var attr = this.ownerDocument.createAttribute(name);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr)
	},
	removeAttribute : function(name){
		var attr = this.getAttributeNode(name)
		attr && this.removeAttributeNode(attr);
	},
	
	//four real opeartion method
	appendChild:function(newChild){
		if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
			return this.insertBefore(newChild,null);
		}else{
			return _appendSingleChild(this,newChild);
		}
	},
	setAttributeNode : function(newAttr){
		return this.attributes.setNamedItem(newAttr);
	},
	setAttributeNodeNS : function(newAttr){
		return this.attributes.setNamedItemNS(newAttr);
	},
	removeAttributeNode : function(oldAttr){
		return this.attributes.removeNamedItem(oldAttr.nodeName);
	},
	//get real attribute name,and remove it by removeAttributeNode
	removeAttributeNS : function(namespaceURI, localName){
		var old = this.getAttributeNodeNS(namespaceURI, localName);
		old && this.removeAttributeNode(old);
	},
	
	hasAttributeNS : function(namespaceURI, localName){
		return this.getAttributeNodeNS(namespaceURI, localName)!=null;
	},
	getAttributeNS : function(namespaceURI, localName){
		var attr = this.getAttributeNodeNS(namespaceURI, localName);
		return attr && attr.value || '';
	},
	setAttributeNS : function(namespaceURI, qualifiedName, value){
		var attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr)
	},
	getAttributeNodeNS : function(namespaceURI, localName){
		return this.attributes.getNamedItemNS(namespaceURI, localName);
	},
	
	getElementsByTagName : function(tagName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType == ELEMENT_NODE && (tagName === '*' || node.tagName == tagName)){
					ls.push(node);
				}
			});
			return ls;
		});
	},
	getElementsByTagNameNS : function(namespaceURI, localName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === '*' || node.namespaceURI === namespaceURI) && (localName === '*' || node.localName == localName)){
					ls.push(node);
				}
			});
			return ls;
		});
	}
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;


_extends(Element,Node);
function Attr() {
};
Attr.prototype.nodeType = ATTRIBUTE_NODE;
_extends(Attr,Node);


function CharacterData() {
};
CharacterData.prototype = {
	data : '',
	substringData : function(offset, count) {
		return this.data.substring(offset, offset+count);
	},
	appendData: function(text) {
		text = this.data+text;
		this.nodeValue = this.data = text;
		this.length = text.length;
	},
	insertData: function(offset,text) {
		this.replaceData(offset,0,text);
	
	},
	appendChild:function(newChild){
		//if(!(newChild instanceof CharacterData)){
			throw new Error(ExceptionMessage[3])
		//}
		return Node.prototype.appendChild.apply(this,arguments)
	},
	deleteData: function(offset, count) {
		this.replaceData(offset,count,"");
	},
	replaceData: function(offset, count, text) {
		var start = this.data.substring(0,offset);
		var end = this.data.substring(offset+count);
		text = start + text + end;
		this.nodeValue = this.data = text;
		this.length = text.length;
	}
}
_extends(CharacterData,Node);
function Text() {
};
Text.prototype = {
	nodeName : "#text",
	nodeType : TEXT_NODE,
	splitText : function(offset) {
		var text = this.data;
		var newText = text.substring(offset);
		text = text.substring(0, offset);
		this.data = this.nodeValue = text;
		this.length = text.length;
		var newNode = this.ownerDocument.createTextNode(newText);
		if(this.parentNode){
			this.parentNode.insertBefore(newNode, this.nextSibling);
		}
		return newNode;
	}
}
_extends(Text,CharacterData);
function Comment() {
};
Comment.prototype = {
	nodeName : "#comment",
	nodeType : COMMENT_NODE
}
_extends(Comment,CharacterData);

function CDATASection() {
};
CDATASection.prototype = {
	nodeName : "#cdata-section",
	nodeType : CDATA_SECTION_NODE
}
_extends(CDATASection,CharacterData);


function DocumentType() {
};
DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
_extends(DocumentType,Node);

function Notation() {
};
Notation.prototype.nodeType = NOTATION_NODE;
_extends(Notation,Node);

function Entity() {
};
Entity.prototype.nodeType = ENTITY_NODE;
_extends(Entity,Node);

function EntityReference() {
};
EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
_extends(EntityReference,Node);

function DocumentFragment() {
};
DocumentFragment.prototype.nodeName =	"#document-fragment";
DocumentFragment.prototype.nodeType =	DOCUMENT_FRAGMENT_NODE;
_extends(DocumentFragment,Node);


function ProcessingInstruction() {
}
ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
_extends(ProcessingInstruction,Node);
function XMLSerializer(){}
XMLSerializer.prototype.serializeToString = function(node,attributeSorter){
	return node.toString(attributeSorter);
}
Node.prototype.toString =function(attributeSorter){
	var buf = [];
	serializeToString(this,buf,attributeSorter);
	return buf.join('');
}
function serializeToString(node,buf,attributeSorter,isHTML){
	switch(node.nodeType){
	case ELEMENT_NODE:
		var attrs = node.attributes;
		var len = attrs.length;
		var child = node.firstChild;
		var nodeName = node.tagName;
		isHTML =  (htmlns === node.namespaceURI) ||isHTML 
		buf.push('<',nodeName);
		if(attributeSorter){
			buf.sort.apply(attrs, attributeSorter);
		}
		for(var i=0;i<len;i++){
			serializeToString(attrs.item(i),buf,attributeSorter,isHTML);
		}
		if(child || isHTML && !/^(?:meta|link|img|br|hr|input|button)$/i.test(nodeName)){
			buf.push('>');
			//if is cdata child node
			if(isHTML && /^script$/i.test(nodeName)){
				if(child){
					buf.push(child.data);
				}
			}else{
				while(child){
					serializeToString(child,buf,attributeSorter,isHTML);
					child = child.nextSibling;
				}
			}
			buf.push('</',nodeName,'>');
		}else{
			buf.push('/>');
		}
		return;
	case DOCUMENT_NODE:
	case DOCUMENT_FRAGMENT_NODE:
		var child = node.firstChild;
		while(child){
			serializeToString(child,buf,attributeSorter,isHTML);
			child = child.nextSibling;
		}
		return;
	case ATTRIBUTE_NODE:
		return buf.push(' ',node.name,'="',node.value.replace(/[<&"]/g,_xmlEncoder),'"');
	case TEXT_NODE:
		return buf.push(node.data.replace(/[<&]/g,_xmlEncoder));
	case CDATA_SECTION_NODE:
		return buf.push( '<![CDATA[',node.data,']]>');
	case COMMENT_NODE:
		return buf.push( "<!--",node.data,"-->");
	case DOCUMENT_TYPE_NODE:
		var pubid = node.publicId;
		var sysid = node.systemId;
		buf.push('<!DOCTYPE ',node.name);
		if(pubid){
			buf.push(' PUBLIC "',pubid);
			if (sysid && sysid!='.') {
				buf.push( '" "',sysid);
			}
			buf.push('">');
		}else if(sysid && sysid!='.'){
			buf.push(' SYSTEM "',sysid,'">');
		}else{
			var sub = node.internalSubset;
			if(sub){
				buf.push(" [",sub,"]");
			}
			buf.push(">");
		}
		return;
	case PROCESSING_INSTRUCTION_NODE:
		return buf.push( "<?",node.target," ",node.data,"?>");
	case ENTITY_REFERENCE_NODE:
		return buf.push( '&',node.nodeName,';');
	//case ENTITY_NODE:
	//case NOTATION_NODE:
	default:
		buf.push('??',node.nodeName);
	}
}
function importNode(doc,node,deep){
	var node2;
	switch (node.nodeType) {
	case ELEMENT_NODE:
		node2 = node.cloneNode(false);
		node2.ownerDocument = doc;
		//var attrs = node2.attributes;
		//var len = attrs.length;
		//for(var i=0;i<len;i++){
			//node2.setAttributeNodeNS(importNode(doc,attrs.item(i),deep));
		//}
	case DOCUMENT_FRAGMENT_NODE:
		break;
	case ATTRIBUTE_NODE:
		deep = true;
		break;
	//case ENTITY_REFERENCE_NODE:
	//case PROCESSING_INSTRUCTION_NODE:
	////case TEXT_NODE:
	//case CDATA_SECTION_NODE:
	//case COMMENT_NODE:
	//	deep = false;
	//	break;
	//case DOCUMENT_NODE:
	//case DOCUMENT_TYPE_NODE:
	//cannot be imported.
	//case ENTITY_NODE:
	//case NOTATION_NODE：
	//can not hit in level3
	//default:throw e;
	}
	if(!node2){
		node2 = node.cloneNode(false);//false
	}
	node2.ownerDocument = doc;
	node2.parentNode = null;
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(importNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}
//
//var _relationMap = {firstChild:1,lastChild:1,previousSibling:1,nextSibling:1,
//					attributes:1,childNodes:1,parentNode:1,documentElement:1,doctype,};
function cloneNode(doc,node,deep){
	var node2 = new node.constructor();
	for(var n in node){
		var v = node[n];
		if(typeof v != 'object' ){
			if(v != node2[n]){
				node2[n] = v;
			}
		}
	}
	if(node.childNodes){
		node2.childNodes = new NodeList();
	}
	node2.ownerDocument = doc;
	switch (node2.nodeType) {
	case ELEMENT_NODE:
		var attrs	= node.attributes;
		var attrs2	= node2.attributes = new NamedNodeMap();
		var len = attrs.length
		attrs2._ownerElement = node2;
		for(var i=0;i<len;i++){
			node2.setAttributeNode(cloneNode(doc,attrs.item(i),true));
		}
		break;;
	case ATTRIBUTE_NODE:
		deep = true;
	}
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(cloneNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}

function __set__(object,key,value){
	object[key] = value
}
//do dynamic
try{
	if(Object.defineProperty){
		Object.defineProperty(LiveNodeList.prototype,'length',{
			get:function(){
				_updateLiveList(this);
				return this.$$length;
			}
		});
		Object.defineProperty(Node.prototype,'textContent',{
			get:function(){
				return getTextContent(this);
			},
			set:function(data){
				switch(this.nodeType){
				case 1:
				case 11:
					while(this.firstChild){
						this.removeChild(this.firstChild);
					}
					if(data || String(data)){
						this.appendChild(this.ownerDocument.createTextNode(data));
					}
					break;
				default:
					//TODO:
					this.data = data;
					this.value = value;
					this.nodeValue = data;
				}
			}
		})
		
		function getTextContent(node){
			switch(node.nodeType){
			case 1:
			case 11:
				var buf = [];
				node = node.firstChild;
				while(node){
					if(node.nodeType!==7 && node.nodeType !==8){
						buf.push(getTextContent(node));
					}
					node = node.nextSibling;
				}
				return buf.join('');
			default:
				return node.nodeValue;
			}
		}
		__set__ = function(object,key,value){
			//console.log(value)
			object['$$'+key] = value
		}
	}
}catch(e){//ie8
}

if(typeof require == 'function'){
	exports.DOMImplementation = DOMImplementation;
	exports.XMLSerializer = XMLSerializer;
}

},{}],42:[function(require,module,exports){
//[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
//[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
//[5]   	Name	   ::=   	NameStartChar (NameChar)*
var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]///\u10000-\uEFFFF
var nameChar = new RegExp("[\\-\\.0-9"+nameStartChar.source.slice(1,-1)+"\u00B7\u0300-\u036F\\u203F-\u2040]");
var tagNamePattern = new RegExp('^'+nameStartChar.source+nameChar.source+'*(?:\:'+nameStartChar.source+nameChar.source+'*)?$');
//var tagNamePattern = /^[a-zA-Z_][\w\-\.]*(?:\:[a-zA-Z_][\w\-\.]*)?$/
//var handlers = 'resolveEntity,getExternalSubset,characters,endDocument,endElement,endPrefixMapping,ignorableWhitespace,processingInstruction,setDocumentLocator,skippedEntity,startDocument,startElement,startPrefixMapping,notationDecl,unparsedEntityDecl,error,fatalError,warning,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,comment,endCDATA,endDTD,endEntity,startCDATA,startDTD,startEntity'.split(',')

//S_TAG,	S_ATTR,	S_EQ,	S_V
//S_ATTR_S,	S_E,	S_S,	S_C
var S_TAG = 0;//tag name offerring
var S_ATTR = 1;//attr name offerring 
var S_ATTR_S=2;//attr name end and space offer
var S_EQ = 3;//=space?
var S_V = 4;//attr value(no quot value only)
var S_E = 5;//attr value end and no space(quot end)
var S_S = 6;//(attr value end || tag end ) && (space offer)
var S_C = 7;//closed el<el />

function XMLReader(){
	
}

XMLReader.prototype = {
	parse:function(source,defaultNSMap,entityMap){
		var domBuilder = this.domBuilder;
		domBuilder.startDocument();
		_copy(defaultNSMap ,defaultNSMap = {})
		parse(source,defaultNSMap,entityMap,
				domBuilder,this.errorHandler);
		domBuilder.endDocument();
	}
}
function parse(source,defaultNSMapCopy,entityMap,domBuilder,errorHandler){
  function fixedFromCharCode(code) {
		// String.prototype.fromCharCode does not supports
		// > 2 bytes unicode chars directly
		if (code > 0xffff) {
			code -= 0x10000;
			var surrogate1 = 0xd800 + (code >> 10)
				, surrogate2 = 0xdc00 + (code & 0x3ff);

			return String.fromCharCode(surrogate1, surrogate2);
		} else {
			return String.fromCharCode(code);
		}
	}
	function entityReplacer(a){
		var k = a.slice(1,-1);
		if(k in entityMap){
			return entityMap[k]; 
		}else if(k.charAt(0) === '#'){
			return fixedFromCharCode(parseInt(k.substr(1).replace('x','0x')))
		}else{
			errorHandler.error('entity not found:'+a);
			return a;
		}
	}
	function appendText(end){//has some bugs
		if(end>start){
			var xt = source.substring(start,end).replace(/&#?\w+;/g,entityReplacer);
			locator&&position(start);
			domBuilder.characters(xt,0,end-start);
			start = end
		}
	}
	function position(p,m){
		while(p>=lineEnd && (m = linePattern.exec(source))){
			lineStart = m.index;
			lineEnd = lineStart + m[0].length;
			locator.lineNumber++;
			//console.log('line++:',locator,startPos,endPos)
		}
		locator.columnNumber = p-lineStart+1;
	}
	var lineStart = 0;
	var lineEnd = 0;
	var linePattern = /.+(?:\r\n?|\n)|.*$/g
	var locator = domBuilder.locator;
	
	var parseStack = [{currentNSMap:defaultNSMapCopy}]
	var closeMap = {};
	var start = 0;
	while(true){
		try{
			var tagStart = source.indexOf('<',start);
			if(tagStart<0){
				if(!source.substr(start).match(/^\s*$/)){
					var doc = domBuilder.document;
	    			var text = doc.createTextNode(source.substr(start));
	    			doc.appendChild(text);
	    			domBuilder.currentElement = text;
				}
				return;
			}
			if(tagStart>start){
				appendText(tagStart);
			}
			switch(source.charAt(tagStart+1)){
			case '/':
				var end = source.indexOf('>',tagStart+3);
				var tagName = source.substring(tagStart+2,end);
				var config = parseStack.pop();
				var localNSMap = config.localNSMap;
		        if(config.tagName != tagName){
		            errorHandler.fatalError("end tag name: "+tagName+' is not match the current start tagName:'+config.tagName );
		        }
				domBuilder.endElement(config.uri,config.localName,tagName);
				if(localNSMap){
					for(var prefix in localNSMap){
						domBuilder.endPrefixMapping(prefix) ;
					}
				}
				end++;
				break;
				// end elment
			case '?':// <?...?>
				locator&&position(tagStart);
				end = parseInstruction(source,tagStart,domBuilder);
				break;
			case '!':// <!doctype,<![CDATA,<!--
				locator&&position(tagStart);
				end = parseDCC(source,tagStart,domBuilder,errorHandler);
				break;
			default:
			
				locator&&position(tagStart);
				
				var el = new ElementAttributes();
				
				//elStartEnd
				var end = parseElementStartPart(source,tagStart,el,entityReplacer,errorHandler);
				var len = el.length;
				
				if(locator){
					if(len){
						//attribute position fixed
						for(var i = 0;i<len;i++){
							var a = el[i];
							position(a.offset);
							a.offset = copyLocator(locator,{});
						}
					}
					position(end);
				}
				if(!el.closed && fixSelfClosed(source,end,el.tagName,closeMap)){
					el.closed = true;
					if(!entityMap.nbsp){
						errorHandler.warning('unclosed xml attribute');
					}
				}
				appendElement(el,domBuilder,parseStack);
				
				
				if(el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed){
					end = parseHtmlSpecialContent(source,end,el.tagName,entityReplacer,domBuilder)
				}else{
					end++;
				}
			}
		}catch(e){
			errorHandler.error('element parse error: '+e);
			end = -1;
		}
		if(end>start){
			start = end;
		}else{
			//TODO: 这里有可能sax回退，有位置错误风险
			appendText(Math.max(tagStart,start)+1);
		}
	}
}
function copyLocator(f,t){
	t.lineNumber = f.lineNumber;
	t.columnNumber = f.columnNumber;
	return t;
}

/**
 * @see #appendElement(source,elStartEnd,el,selfClosed,entityReplacer,domBuilder,parseStack);
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function parseElementStartPart(source,start,el,entityReplacer,errorHandler){
	var attrName;
	var value;
	var p = ++start;
	var s = S_TAG;//status
	while(true){
		var c = source.charAt(p);
		switch(c){
		case '=':
			if(s === S_ATTR){//attrName
				attrName = source.slice(start,p);
				s = S_EQ;
			}else if(s === S_ATTR_S){
				s = S_EQ;
			}else{
				//fatalError: equal must after attrName or space after attrName
				throw new Error('attribute equal must after attrName');
			}
			break;
		case '\'':
		case '"':
			if(s === S_EQ){//equal
				start = p+1;
				p = source.indexOf(c,start)
				if(p>0){
					value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					el.add(attrName,value,start-1);
					s = S_E;
				}else{
					//fatalError: no end quot match
					throw new Error('attribute value no end \''+c+'\' match');
				}
			}else if(s == S_V){
				value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
				//console.log(attrName,value,start,p)
				el.add(attrName,value,start);
				//console.dir(el)
				errorHandler.warning('attribute "'+attrName+'" missed start quot('+c+')!!');
				start = p+1;
				s = S_E
			}else{
				//fatalError: no equal before
				throw new Error('attribute value must after "="');
			}
			break;
		case '/':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_E:
			case S_S:
			case S_C:
				s = S_C;
				el.closed = true;
			case S_V:
			case S_ATTR:
			case S_ATTR_S:
				break;
			//case S_EQ:
			default:
				throw new Error("attribute invalid close char('/')")
			}
			break;
		case ''://end document
			//throw new Error('unexpected end of input')
			errorHandler.error('unexpected end of input');
		case '>':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_E:
			case S_S:
			case S_C:
				break;//normal
			case S_V://Compatible state
			case S_ATTR:
				value = source.slice(start,p);
				if(value.slice(-1) === '/'){
					el.closed  = true;
					value = value.slice(0,-1)
				}
			case S_ATTR_S:
				if(s === S_ATTR_S){
					value = attrName;
				}
				if(s == S_V){
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value.replace(/&#?\w+;/g,entityReplacer),start)
				}else{
					errorHandler.warning('attribute "'+value+'" missed value!! "'+value+'" instead!!')
					el.add(value,value,start)
				}
				break;
			case S_EQ:
				throw new Error('attribute value missed!!');
			}
//			console.log(tagName,tagNamePattern,tagNamePattern.test(tagName))
			return p;
		/*xml space '\x20' | #x9 | #xD | #xA; */
		case '\u0080':
			c = ' ';
		default:
			if(c<= ' '){//space
				switch(s){
				case S_TAG:
					el.setTagName(source.slice(start,p));//tagName
					s = S_S;
					break;
				case S_ATTR:
					attrName = source.slice(start,p)
					s = S_ATTR_S;
					break;
				case S_V:
					var value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value,start)
				case S_E:
					s = S_S;
					break;
				//case S_S:
				//case S_EQ:
				//case S_ATTR_S:
				//	void();break;
				//case S_C:
					//ignore warning
				}
			}else{//not space
//S_TAG,	S_ATTR,	S_EQ,	S_V
//S_ATTR_S,	S_E,	S_S,	S_C
				switch(s){
				//case S_TAG:void();break;
				//case S_ATTR:void();break;
				//case S_V:void();break;
				case S_ATTR_S:
					errorHandler.warning('attribute "'+attrName+'" missed value!! "'+attrName+'" instead!!')
					el.add(attrName,attrName,start);
					start = p;
					s = S_ATTR;
					break;
				case S_E:
					errorHandler.warning('attribute space is required"'+attrName+'"!!')
				case S_S:
					s = S_ATTR;
					start = p;
					break;
				case S_EQ:
					s = S_V;
					start = p;
					break;
				case S_C:
					throw new Error("elements closed character '/' and '>' must be connected to");
				}
			}
		}
		p++;
	}
}
/**
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function appendElement(el,domBuilder,parseStack){
	var tagName = el.tagName;
	var localNSMap = null;
	var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
	var i = el.length;
	while(i--){
		var a = el[i];
		var qName = a.qName;
		var value = a.value;
		var nsp = qName.indexOf(':');
		if(nsp>0){
			var prefix = a.prefix = qName.slice(0,nsp);
			var localName = qName.slice(nsp+1);
			var nsPrefix = prefix === 'xmlns' && localName
		}else{
			localName = qName;
			prefix = null
			nsPrefix = qName === 'xmlns' && ''
		}
		//can not set prefix,because prefix !== ''
		a.localName = localName ;
		//prefix == null for no ns prefix attribute 
		if(nsPrefix !== false){//hack!!
			if(localNSMap == null){
				localNSMap = {}
				//console.log(currentNSMap,0)
				_copy(currentNSMap,currentNSMap={})
				//console.log(currentNSMap,1)
			}
			currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
			a.uri = 'http://www.w3.org/2000/xmlns/'
			domBuilder.startPrefixMapping(nsPrefix, value) 
		}
	}
	var i = el.length;
	while(i--){
		a = el[i];
		var prefix = a.prefix;
		if(prefix){//no prefix attribute has no namespace
			if(prefix === 'xml'){
				a.uri = 'http://www.w3.org/XML/1998/namespace';
			}if(prefix !== 'xmlns'){
				a.uri = currentNSMap[prefix]
				
				//{console.log('###'+a.qName,domBuilder.locator.systemId+'',currentNSMap,a.uri)}
			}
		}
	}
	var nsp = tagName.indexOf(':');
	if(nsp>0){
		prefix = el.prefix = tagName.slice(0,nsp);
		localName = el.localName = tagName.slice(nsp+1);
	}else{
		prefix = null;//important!!
		localName = el.localName = tagName;
	}
	//no prefix element has default namespace
	var ns = el.uri = currentNSMap[prefix || ''];
	domBuilder.startElement(ns,localName,tagName,el);
	//endPrefixMapping and startPrefixMapping have not any help for dom builder
	//localNSMap = null
	if(el.closed){
		domBuilder.endElement(ns,localName,tagName);
		if(localNSMap){
			for(prefix in localNSMap){
				domBuilder.endPrefixMapping(prefix) 
			}
		}
	}else{
		el.currentNSMap = currentNSMap;
		el.localNSMap = localNSMap;
		parseStack.push(el);
	}
}
function parseHtmlSpecialContent(source,elStartEnd,tagName,entityReplacer,domBuilder){
	if(/^(?:script|textarea)$/i.test(tagName)){
		var elEndStart =  source.indexOf('</'+tagName+'>',elStartEnd);
		var text = source.substring(elStartEnd+1,elEndStart);
		if(/[&<]/.test(text)){
			if(/^script$/i.test(tagName)){
				//if(!/\]\]>/.test(text)){
					//lexHandler.startCDATA();
					domBuilder.characters(text,0,text.length);
					//lexHandler.endCDATA();
					return elEndStart;
				//}
			}//}else{//text area
				text = text.replace(/&#?\w+;/g,entityReplacer);
				domBuilder.characters(text,0,text.length);
				return elEndStart;
			//}
			
		}
	}
	return elStartEnd+1;
}
function fixSelfClosed(source,elStartEnd,tagName,closeMap){
	//if(tagName in closeMap){
	var pos = closeMap[tagName];
	if(pos == null){
		//console.log(tagName)
		pos = closeMap[tagName] = source.lastIndexOf('</'+tagName+'>')
	}
	return pos<elStartEnd;
	//} 
}
function _copy(source,target){
	for(var n in source){target[n] = source[n]}
}
function parseDCC(source,start,domBuilder,errorHandler){//sure start with '<!'
	var next= source.charAt(start+2)
	switch(next){
	case '-':
		if(source.charAt(start + 3) === '-'){
			var end = source.indexOf('-->',start+4);
			//append comment source.substring(4,end)//<!--
			if(end>start){
				domBuilder.comment(source,start+4,end-start-4);
				return end+3;
			}else{
				errorHandler.error("Unclosed comment");
				return -1;
			}
		}else{
			//error
			return -1;
		}
	default:
		if(source.substr(start+3,6) == 'CDATA['){
			var end = source.indexOf(']]>',start+9);
			domBuilder.startCDATA();
			domBuilder.characters(source,start+9,end-start-9);
			domBuilder.endCDATA() 
			return end+3;
		}
		//<!DOCTYPE
		//startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId) 
		var matchs = split(source,start);
		var len = matchs.length;
		if(len>1 && /!doctype/i.test(matchs[0][0])){
			var name = matchs[1][0];
			var pubid = len>3 && /^public$/i.test(matchs[2][0]) && matchs[3][0]
			var sysid = len>4 && matchs[4][0];
			var lastMatch = matchs[len-1]
			domBuilder.startDTD(name,pubid && pubid.replace(/^(['"])(.*?)\1$/,'$2'),
					sysid && sysid.replace(/^(['"])(.*?)\1$/,'$2'));
			domBuilder.endDTD();
			
			return lastMatch.index+lastMatch[0].length
		}
	}
	return -1;
}



function parseInstruction(source,start,domBuilder){
	var end = source.indexOf('?>',start);
	if(end){
		var match = source.substring(start,end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
		if(match){
			var len = match[0].length;
			domBuilder.processingInstruction(match[1], match[2]) ;
			return end+2;
		}else{//error
			return -1;
		}
	}
	return -1;
}

/**
 * @param source
 */
function ElementAttributes(source){
	
}
ElementAttributes.prototype = {
	setTagName:function(tagName){
		if(!tagNamePattern.test(tagName)){
			throw new Error('invalid tagName:'+tagName)
		}
		this.tagName = tagName
	},
	add:function(qName,value,offset){
		if(!tagNamePattern.test(qName)){
			throw new Error('invalid attribute:'+qName)
		}
		this[this.length++] = {qName:qName,value:value,offset:offset}
	},
	length:0,
	getLocalName:function(i){return this[i].localName},
	getOffset:function(i){return this[i].offset},
	getQName:function(i){return this[i].qName},
	getURI:function(i){return this[i].uri},
	getValue:function(i){return this[i].value}
//	,getIndex:function(uri, localName)){
//		if(localName){
//			
//		}else{
//			var qName = uri
//		}
//	},
//	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
//	getType:function(uri,localName){}
//	getType:function(i){},
}




function _set_proto_(thiz,parent){
	thiz.__proto__ = parent;
	return thiz;
}
if(!(_set_proto_({},_set_proto_.prototype) instanceof _set_proto_)){
	_set_proto_ = function(thiz,parent){
		function p(){};
		p.prototype = parent;
		p = new p();
		for(parent in thiz){
			p[parent] = thiz[parent];
		}
		return p;
	}
}

function split(source,start){
	var match;
	var buf = [];
	var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
	reg.lastIndex = start;
	reg.exec(source);//skip <
	while(match = reg.exec(source)){
		buf.push(match);
		if(match[1])return buf;
	}
}

if(typeof require == 'function'){
	exports.XMLReader = XMLReader;
}


},{}],43:[function(require,module,exports){
(function (process){
var
  merge = require('deepmerge'),
  xmldom = require('xmldom'),
  nwmatcher = require('nwmatcher');
  
if (!process.browser) {
  // Extend xmldom
  var Document = (new xmldom.DOMImplementation()).createDocument().constructor;
  Document.prototype.querySelectorAll = function(selector) {
    var nw = nwmatcher({document: this});
    return nw.select( selector, this.documentElement );
  };
}

module.exports = merge(xmldom, {
  Document: Document
});
}).call(this,require('_process'))

},{"_process":27,"deepmerge":24,"nwmatcher":28,"xmldom":40}],44:[function(require,module,exports){
var
  _S = require('string'),
  XCSSMatrix = require('xcssmatrix');

// Partial implementation
// https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement




function SVGMatrix() {
  this.a = this.d = 1;
  this.b = this.c = this.e = this.f = 0;
}

//SVGMatrix.prototype = new XCSSMatrix();
/*
get a(){ return this.m11; },

  get b(){ return this.m21; },

  get c(){ return this.m12; },

  get d(){ return this.m22; },

  get e(){ return this.m13; },

  get f(){ return this.m23; },
*/

/*
transform: function(a2, b2, c2, d2, e2, f2) {

    var me = this,
      a1 = me.a,
      b1 = me.b,
      c1 = me.c,
      d1 = me.d,
      e1 = me.e,
      f1 = me.f;

    me.a = a1 * a2 + c1 * b2;
    me.b = b1 * a2 + d1 * b2;
    me.c = a1 * c2 + c1 * d2;
    me.d = b1 * c2 + d1 * d2;
    me.e = a1 * e2 + c1 * f2 + e1;
    me.f = b1 * e2 + d1 * f2 + f1;

    return me._x()
  }
  */
  
// http://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
SVGMatrix.prototype.multiply = function(matrix) {
  var
    _this = this;
  
 /*
  a.a = a.a*b.a + a.c*b.b + a.e;
  a.b = a.b*b.a + a.d*b.b + a.f;
  a.c = a.a*b.c + a.c*b.d + a.e;
  a.d = a.b*b.c + a.d*b.d + a.f;
  a.e = a.a*b.e + a.c*b.f + a.e;
  a.f = a.b*b.e + a.d*b.f + a.f;
  */
 
  var m = new SVGMatrix();
  m.a = this.a;
  m.b = this.b;
  m.c = this.c;
  m.d = this.d;
  m.e = this.e;
  m.f = this.f;
  
  this.a = m.a * matrix.a + m.c * matrix.b;
  this.b = m.b * matrix.a + m.d * matrix.b;
  this.c = m.a * matrix.c + m.c * matrix.d;
  this.d = m.b * matrix.c + m.d * matrix.d;
  this.e = m.a * matrix.e + m.c * matrix.f + m.e;
  this.f = m.b * matrix.e + m.d * matrix.f + m.f;
 /*
  this.a = m.a * matrix.a + m.c * matrix.b;
  this.b = m.b * matrix.a + m.d * matrix.b;
  this.c = m.a * matrix.c + m.c * matrix.d;
  this.d = m.b * matrix.c + m.d * matrix.d;
  this.e = m.a * matrix.e + m.c * matrix.f;
  this.f = m.b * matrix.e + m.d * matrix.f;
  */
  return this;
};
/*

['m11', 'a'],
    ['m12', 'b'],
    ['m21', 'c'],
    ['m22', 'd'],
    ['m41', 'e'],
    ['m42', 'f']
*/
SVGMatrix.prototype.translate = function(x, y) {
  x = parseFloat(x);
  y = parseFloat(y);
  var m = new SVGMatrix();
  console.log("translate ---> x, y", x, y);
  m.e = x;
  m.f = y;
  /*var m = clone(this);
  m.e = m.a * x + m.b * y + m.e;
  m.f = m.c * x + m.d * y + m.f;*/
  return this.multiply(m);
};

SVGMatrix.prototype.scale = function(scale) {
  return this.scaleNonUniform(scale, scale);
};

SVGMatrix.prototype.scaleNonUniform = function(scaleX, scaleY) {
  scaleX = parseFloat(scaleX);
  scaleY = parseFloat(scaleY) || parseFloat(scaleX);
  this.a *= scaleX;
  this.c *= scaleY;
  this.b *= scaleX;
  this.d *= scaleY;
  return this;
};

function clone(matrix) {
  var matrix = new SVGMatrix();
  for (var prop in matrix) {
    if (typeof matrix[prop] !== 'function') {
      matrix[prop] = matrix[prop];
    }
  }
  return matrix;
}

SVGMatrix.prototype.skewX = function(angle) {
  var m = new SVGMatrix();
  m.c = Math.tan( parseFloat(angle) * Math.PI / 180 );
  return this.multiply(m);
};


SVGMatrix.prototype.flipY = function() {
  return this;
};

SVGMatrix.prototype.flipX = function() {
  console.log("FLIP X !!!!");
  
  return this.scaleNonUniform(-1, 1);
  /*
  var scale = this.a;
  
  
  this.a = this.a * -1;
  
  // Re-position back to origin
    if(this.e > 0)
        this.e = 0;
    else
        this.e = this.e + this.scale;

  
  */
  /*this.e = this.e * -1;
  this.a = this.a * -1;*/
  //this.b *= -1;
  //this.b *= -1;
  //this.c *= -1;
  //this.d *= -1;
  //this.e *= -1;
  //this.f *= -1;
 // this.e*= -1;
 
  /*
  this.a = 1;
  this.b = 0;
  this.c = 0;
  this.d = 1;
  this.e = 0;
  this.f = 0;
  
  return this;
   */
  var m = new SVGMatrix();
  m.a = -1;
  return this.multiply(m);
};

SVGMatrix.prototype.skewY = function(angle) {
  var m = new SVGMatrix();
  m.b = Math.tan( parseFloat(angle) * Math.PI / 180 );
  return this.multiply(m);
};

SVGMatrix.prototype.rotate = function(angle) {
  var cos = Math.cos(angle * Math.PI / 180),
    sin = Math.sin(angle * Math.PI / 180);
  var m = new SVGMatrix();
  m.a = cos;
  m.b = sin;
  m.c = -sin;
  m.d = cos;
  //return this;
   return this.multiply(m);
    
  /*
  var c0 = Math.cos(0 * Math.PI / 180), 
    s0 = Math.sin(0 * Math.PI / 180);
  
  var c = Math.cos(angle * Math.PI / 180), 
    s = Math.sin(angle * Math.PI / 180),
    m = this;
    //m = this;
    
    m.a = c0 * this.a - s0 * this.e;
    m.b = c0 * this.b - s0 * this.f;
    
    m.c = c * this.c + s * this.e;
    m.d = c * this.d + s * this.f;

    m.e = c * this.e - s * this.c;
    m.f = c * this.f - s * this.d;

    //return this.multiply(m);
    
    return this;
    */
   /*
   var deg = angle;
    var rad = parseFloat(deg) * (Math.PI/180),
        costheta = Math.cos(rad),
        sintheta = Math.sin(rad);
  
    var
      m = new SVGMatrix();
      
     m.a = costheta,
     m.b = sintheta,
     m.c = -sintheta,
     m.d = costheta;
*/

  var
   rx = parseFloat(angle) * (Math.PI/180),
   m = new SVGMatrix(),
        sinA, cosA, sq;

    rx /= 2;
    sinA  = Math.sin(rx);
    cosA  = Math.cos(rx);
    sq = sinA * sinA;

    // Matrices are identity outside the assigned values
    m.a = m.d = 1 - 2 * sq;
    m.b = m.c = 2 * sinA * cosA;
    m.c *= -1;
    
    //return this;
    return this.multiply(m);
  },


SVGMatrix.parse = function (string) {
  var
    statements = ['matrix', 'rotate', 'skewX', 'skewY', 'scale', 'translate'],
    transforms = [],
    t = null,
    matrix = new SVGMatrix(),
    re = /(\w+)\s*\(\s*([^\)]*\s*)\s*\)/g,
    m, st, args, p = SVGMatrix.prototype, method, e = null;
  while (m = re.exec(string)) {
    if (m) {
      st = m[1];
      console.info("m[2]. ", m[2]);
      args = m[2].split(/[,\s]+/);
      if (statements.indexOf(st) >= 0) {
        transforms.push({
          st: st,
          args: args
        });
      } else {
        e = true;
      }
    }
  }
  if (e) {
    console.log("error parsing svg matrix");
    return;
  }
  transforms.forEach(function(obj) {
    console.info("exec: ", obj.st);
    method = obj.st === 'scale' ? 'scaleNonUniform' : obj.st;
    if (method === 'rotate' && obj.args.length > 1) {
      matrix = p.translate.call(matrix, obj.args[1], obj.args[2]);
      matrix = p.rotate.call(matrix, obj.args[0]);
      matrix = p.translate.call(matrix, -obj.args[1], -obj.args[2]);
    } else if (p[method]) {
      matrix = p[method].apply(matrix, obj.args);
    }
  });
  /*
  statements.filter(function(st) {
    return transforms[st];
  }).forEach(function(st) {
    method = st === 'scale' ? 'scaleNonUniform' : st;
    matrix = p[method].apply(matrix, transforms[st].args);
  });
  */
  return matrix;
};



function SVGPoint(x, y) {
  this.x = parseFloat(x);
  this.y = parseFloat(y);
}

SVGPoint.prototype.matrixTransform = function(matrix) {
  console.log("transform point: ", matrix.e, matrix.f);
  var px = this.x * matrix.a + this.y * matrix.c + matrix.e;
  var py = this.x * matrix.b + this.y * matrix.d + matrix.f;
  return new SVGPoint(px, py);
};


function SVGRect(x, y, width, height) {
  this.x = parseFloat(x);
  this.y = parseFloat(y);
  this.width = parseFloat(width);
  this.height = parseFloat(height);
}

function SVGSVGElement() {
  
}

SVGSVGElement.prototype.createSVGMatrix = function() {
  return new SVGMatrix();
};

SVGSVGElement.prototype.createSVGPoint = function() {
  return new SVGPoint(0, 0);
};





SVGSVGElement.prototype.getBBox = (function() {
  
  var currentTextPosition = null;
  
  function getPoints(node) {
    
    var points = [];
    
    // Shapes
    if (node.nodeName === 'line') {
      var x1 = parseFloat(node.getAttribute('x1'));
      var y1 = parseFloat(node.getAttribute('y1'));
      var x2 = parseFloat(node.getAttribute('x2'));
      var y2 = parseFloat(node.getAttribute('y2'));
      points.push(new SVGPoint(x1, y1), new SVGPoint(x2, y2));
    }

    if (node.nodeName === 'rect') {
      var x1 = parseFloat(node.getAttribute('x'));
      var y1 = parseFloat(node.getAttribute('y'));
      var x2 = x1 + parseFloat(node.getAttribute('width'));
      var y2 = y1 + parseFloat(node.getAttribute('height'));
      points.push(new SVGPoint(x1, y1), new SVGPoint(x2, y1), new SVGPoint(x2, y2), new SVGPoint(x1, y2));
    }
    
    if (node.nodeName === 'circle') {
      var cx = parseFloat(node.getAttribute('cx'));
      var cy = parseFloat(node.getAttribute('cy'));
      var r = parseFloat(node.getAttribute('r'));
      var l = Math.floor(Math.PI * 2 * r);
      var t = Math.PI * 2 / r;
      points = points.concat(Array.apply(null, Array(l)).map(function(value, index) {
        var a = t * index;
        var x = cx + Math.cos(a) * r;
        var y = cy + Math.sin(a) * r;
        return new SVGPoint(x, y);
      }));
      points.push(new SVGPoint(cx, cy - r), new SVGPoint(cx + r, cy), new SVGPoint(cx, cy + r), new SVGPoint(cx - r, cy));
    }

    if (node.nodeName === 'ellipse') {
      var cx = parseFloat(node.getAttribute('cx'));
      var cy = parseFloat(node.getAttribute('cy'));
      var rx = parseFloat(node.getAttribute('rx'));
      var ry = parseFloat(node.getAttribute('ry'));
      var l = Math.floor(Math.PI * 2 * Math.sqrt((rx * rx) + (ry + ry)));
      var t = Math.PI * 2 / l;
      points = points.concat(Array.apply(null, Array(l)).map(function(value, index) {
        var a = t * index;
        var x = cx + Math.cos(a) * rx;
        var y = cy + Math.sin(a) * ry;
        return new SVGPoint(x, y);
      }));
    }
    
    if (node.nodeName === 'text') {
      currentTextPosition = null;
    }
    
    if (node.nodeType === 3 && node.data.trim()) {
      console.log("found text node: ", node);
      var elem, x = NaN, y = NaN, dx = NaN, dy = NaN;
      
      // Get absolute position
      elem = node;
      while ((elem = elem.parentNode) && (elem.nodeName === 'text' || elem.nodeName === 'tspan') && (isNaN(x) || isNaN(y))) {
        if (elem.nodeName === 'text' && currentTextPosition) {
          if (isNaN(x)) {
            x = currentTextPosition.x;
          }
          if (isNaN(y)) {
            y = currentTextPosition.y;
          }
        }
        x = isNaN(x) ? parseFloat(elem.getAttribute('x')) : x;
        y = isNaN(y) ? parseFloat(elem.getAttribute('y')) : y;
      }
      x = isNaN(x) ? 0 : x;
      y = isNaN(y) ? 0 : y;
      
      // Shift by relative position
      elem = node;
      while ((elem = elem.parentNode) && (elem.nodeName === 'text' || elem.nodeName === 'tspan') && (isNaN(dx) || isNaN(dy))) {
        dx = isNaN(dx) ? parseFloat(elem.getAttribute('dx')) : dx;
        dy = isNaN(dy) ? parseFloat(elem.getAttribute('dy')) : dy;
      }
      dx = isNaN(dx) ? 0 : dx;
      dy = isNaN(dy) ? 0 : dy;
      
      x+= dx;
      y+= dy;
      
      // Calculate text dimensions
      var elem = node.parentNode;
      var style = getStyle(elem);
      console.log("style ", style);
      var fontSize = parseFloat(style.fontSize);
      console.log("style ", fontSize);
      var w = elem.getComputedTextLength();
      var h = fontSize;

      // Add bounding points
      points.push(new SVGPoint(x, y), new SVGPoint(x + w, y), new SVGPoint(x + w, y - h), new SVGPoint(x, y - h));
      
      // Update current text position
      currentTextPosition = new SVGPoint(x + w, y);
    }
    
    // Process children
    if (node.nodeType === 1) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        var childPoints = getPoints(child);
        var matrix = null;
        if (child.nodeType === 1) {
          if (['g'].indexOf(child.nodeName) >= 0) {
            // Apply transformations
            var
              transform = child.getAttribute('transform');
              matrix = SVGMatrix.parse(transform);
          }
        }
        points = points.concat(childPoints.map(function(point) {
          return matrix && point.matrixTransform(matrix) || point;
        }));
      }
    }
    
    // Reset current text position
    if (node.nodeName === 'text') {
      currentTextPosition = null;
    }
    
    return points;
  }
        
  return function getBBox() {
    // TODO: Throw exception when not added to view
    
    var elem = this;
    var points = getPoints(elem);
        
    var x1, y1, x2, y2;
    points.forEach(function(point) {
      x1 = typeof x1 === 'undefined' ? point.x : Math.min(point.x, x1);
      y1 = typeof y1 === 'undefined' ? point.y : Math.min(point.y, y1);
      x2 = typeof x2 === 'undefined' ? point.x : Math.max(point.x, x2);
      y2 = typeof y2 === 'undefined' ? point.y : Math.max(point.y, y2);
    });
    
    return new SVGRect(
      x1 || 0,
      y1 || 0,
      (x2 - x1) || 0,
      (y2 - y1) || 0
    );

  };
  
})();

SVGSVGElement.prototype.getComputedTextLength = function() {
  console.log("getComputedTextLength()", this);
  return 0;
};


function getStyle(el) {
  //return getComputedStyle(el);
  var result = {};
  while (el.parentNode) {
    for (var i = 0; i < el.attributes.length; i++) {
      var attrNode = el.attributes[i];
      var name = _S(attrNode.name).camelize();
      var value = attrNode.value;
      if (!result[name]) {
        result[name] = value;
      }
    }
    el = el.parentNode;
  }
  console.warn("result: ", result);
  return result;
}


module.exports = {
  'SVGSVGElement': SVGSVGElement
};



},{"string":32,"xcssmatrix":33}],45:[function(require,module,exports){
(function (process){
var
  merge = require('deepmerge'),
  // Init DOM Implementation
  dom = process.browser ? {
    DOMImplementation: window.DOMImplementation,
    XMLSerializer: window.XMLSerializer,
    DOMParser: window.DOMParser,
    Document: window.Document
  } : require('./dom'),
  
  svg = require('./svg');
  

module.exports = merge(merge(dom, svg), {
  // Add more methods here
  
});
}).call(this,require('_process'))

},{"./dom":43,"./svg":44,"_process":27,"deepmerge":24}],46:[function(require,module,exports){
/**
 * Rounds a number or numerical members of an object to precision
 */ 
function round(num, digits) {
  digits = typeof digits === 'number' ? digits : 1;
  if (typeof num === 'object') {
    // Object
    for (var x in num) {
      num[x] = round(num[x]);
    }
  } else {
    // Actually round number
    var value = parseFloat(num);
    if (!isNaN(value) && new String(value).length === new String(num).length) {
      value = parseFloat(value.toFixed(digits));
      return value;
    }
  }
  return num;
};

module.exports = round;
},{}],47:[function(require,module,exports){
var XSSMatrix = require('xcssmatrix');

function SVGPoint(x, y) {
  this.x = x;
  this.y = y;
}

SVGPoint.prototype.matrixTransform = function(matrix) {
  return matrix.transformVector(vector);
};

module.exports = SVGPoint;

},{"xcssmatrix":33}],48:[function(require,module,exports){
var merge = require('deepmerge');
// Dom implementation
/*var dom = typeof window !== 'undefined' ? {
  DOMImplementation: window.DOMImplementation,
  XMLSerializer: window.XMLSerializer,
  DOMParser: window.DOMParser
} : require('xmldom');
*/
//var impl = typeof window !== 'undefined' ? window : require('./impl/window');
var impl = require('./impl/window');
console.log("*** IMPLEMENTATION: ", impl);

/*
 * 
console.log("dom: ", dom);
var DOMImplementation = dom.DOMImplementation;
var XMLSerializer = dom.XMLSerializer;
var DOMParser = dom.DOMParser;
*/
var round = require('./lib/round');
//var hyphenate = require('./lib/hyphenate');
var css = require('css');
var S = require('string');
//var fontkit = require('fontkit');
//var jsdom = require("jsdom");
var XCSSMatrix = require('xcssmatrix');
var SVGPoint = require('./lib/svgpoint');


  var 
    SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg",
    MATH = Math,
    PI = MATH.PI,
    cos = MATH.cos,
    sin = MATH.sin,
    sqrt = MATH.sqrt,
    pow = MATH.pow,
    floor = MATH.floor,
    fontFace = {},
    /**
     * Gets a pair of bezier control points
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} x2
     * @param {Number} y2
     * @param {Number} t
     */
    getControlPoints = function( x0, y0, x1, y1, x2, y2, t ) {
      t = typeof t === 'number' ? t : 0.5;
      var
        d01 = sqrt( pow( x1 - x0, 2 ) + pow( y1 - y0, 2 ) ),
        d12 = sqrt( pow( x2 - x1, 2 ) + pow( y2 - y1, 2 ) ),
        fa = t * d01 / ( d01 + d12 ),   // scaling factor for triangle Ta
        fb = t * d12 / ( d01 + d12 ),   // ditto for Tb, simplifies to fb=t-fa
        p1x = x1 - fa * ( x2 - x0 ),    // x2-x0 is the width of triangle T
        p1y = y1 - fa * ( y2 - y0 ),    // y2-y0 is the height of T
        p2x = x1 + fb * ( x2 - x0 ),
        p2y = y1 + fb * ( y2 - y0 );
      return {
        p1: {x: p1x, y: p1y}, 
        p2: {x: p2x, y: p2y}
      };
    },
    /*
    getFont = function(fontFamily) {
      var fontFamily = fontFamily || 'Arial';
      var file = '/Library/Fonts/' + fontFamily + '.ttf';
      // open a font synchronously 
      var font = fontFace[fontFamily] = fontFace[fontFamily] || fontkit.openSync(file);
      return font;
    },
    */
    /**
     * Retrieves the computed text length of the first element in the set if available.
     */
    computedTextLength = function(elem, style) {
      return 100;
      elem = _v(elem);
      style = style || typeof window !== 'undefined' && window.getComputedStyle(elem[0]) || elem.style();
      
      if (elem.length > 0) {
        var l;
        var text = elem[0].firstChild && elem[0].firstChild.data;
        
        if (!text) {
          return 0;
        }
        
        if (elem[0].getComputedTextLength) {
          l = elem[0].getComputedTextLength();
          return l;
        }
        
        var font = getFont(style.fontFamily);
        var fontSize = parseFloat(style.fontSize) || 16;
        var factor = fontSize / font.unitsPerEm;
        //console.log("ascent: ", font.descent * factor, (font.ascent / font.unitsPerEm) * fontSize);
        // layout a string, using default shaping features. 
        // returns a GlyphRun, describing glyphs and positions. 
        var run = font.layout(text);
        // get an SVG path for a glyph 
        var path = run.glyphs[0].path;
        var width = run.glyphs.map(function(glyph) {
          return glyph.advanceWidth;
        }).reduce(function(a, b) {
          return a + b;
        });
        return width * factor;
      }
      return null;
    };
    
    
  /**
   * Visualist Class
   * @param {String} selector
   */

  function Visualist(element) {
    var set = null, element, result, i, svg;
    // Collect constructor args
    if (typeof element === 'object' && element.namespaceURI === SVG_NAMESPACE_URI) {
      // Existing Element
      set = [element];
    } else if (typeof element === 'string') {
      // TODO: Implement parser
      // TODO: Query Selector
      
    }
    if (!set) {
      string = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"> </svg>';
      // Node:
      //string = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + string;
      //var document = jsdom.jsdom(string);
      var doc = (new impl.DOMParser()).parseFromString(string, 'text/xml');
      //var elem = document.documentElement.querySelector('svg');
      /*svg = document.createElementNS(SVG_NAMESPACE_URI, 'svg');
      svg.setAttribute("xmlns", SVG_NAMESPACE_URI);*/
      set = [doc.documentElement];
    }
    this.push.apply(this, set || []);
  }
  
  Visualist.prototype = [];
  
  /**
   * Visualist constructor
   */
  var _v = function(element, width, height, attrs) {
    var arg, i, _element, _width, _height, _attrs = {}, set;
    for (i = 0, arg; arg = arguments[i]; i++) {
      if (typeof arg === 'number' || typeof arg === 'string' && !isNaN(parseFloat(arg))) {
        // Numeric
        arg = typeof arg === 'number' ? parseFloat(arg) + "px" : arg;
        if (typeof _width !== 'undefined') {
          _height = arg;
        } else {
          _width = arg;
        }
      } else if (typeof arg === 'object' && arg.constructor === Object) {
        // Plain object
        _attrs = arg;
      } else {
        // Everything else may be an element or selector
        _element = arg;
      }
    }
    attrs = _attrs || {};
    // Merge width and height arguments withs attrs
    if (typeof _width !== 'undefined') {
      attrs.width = _width;
    }
    if (typeof _height !== 'undefined') {
      attrs.height = _height;
    }
    // Reuse or create instance
    set = _element instanceof Visualist ? _element : new Visualist(_element);
    set.attr(attrs);
    return set;
  };
  
  
  // Plugin API
  _v.fn = Visualist.prototype;
  
  /**
   * Extends visualist prototype
   * @param {Array} methods
   */
  _v.fn.extend = function( methods ) {
    for (var x in methods) {
      Visualist.prototype[x] = methods[x];
    }
  };
  
  // Private Components
  
  /**
   * Draw basic shapes
   * @param {String} tagName
   * @param {Object} params
   * @param {Object} attrs
   * @param {Array} children 
   */
  
  function shape(tagName, attrs) {
    var self = this;
    this.forEach(function(elem) {
      var child = self.create(tagName, attrs);
      _v(elem).append(child);
    });
    return this;
  }
  
  // Public Components
  
  _v.fn.extend({
    
    /**
     * Get the value of an attribute for the first element in the set of matched elements or set one or more attributes for every matched element.
     * @param {String} name
     * @param {Object} value
     */
    attr: function( name, value ) {
      //console.log("set attr: ", name, value);
      var
        _this = this;
      if (name && typeof name === 'object' || typeof value !== 'undefined') {
        // Set
        var attrs = typeof name === 'object' ? name : (function(name, value) {
          var attrs = {};
          attrs[name] = value;
          return attrs;
        })(name, value);
        this.forEach(function(elem) {
          for (var name in attrs) {
            value = attrs[name];
            
            if (typeof value === 'number' || typeof value === 'string') {
              // Round value:
              value = round(value);
              elem.setAttribute(S(name).dasherize(), value);
            }
            
            if (typeof value === 'object') {
              if (name === 'style') {
                _this.style(value);
              }
              // TODO: data-attributes
            }
          }
        });
        return this;
      } else if (name) {
        // Get
        if (this.length) {
          return this[0].getAttribute(name);
        }
        return null;
      }
      return this;
    },
    
    css: function (name, value) {
      console.log("*** get css: ", name, value);
      var styles = {};
      var elem = this[0];
      var window = elem.ownerDocument.defaultView;
      styles = window.getComputedStyle(elem);
      if (name) {
        return styles[name];
      }
      return styles;
    },
    
    /**
     * Get the value of an inline style for the first element in the set of matched elements or set one or more inline styles for every matched element.
     * @param {String} name
     * @param {Object} value
     */
    style: function( name, value ) {
      
      if (name && typeof name === 'object' || typeof value !== 'undefined') {
        var props = typeof name === 'object' ? name : (function(name, value) {
          var props = {};
          props[name] = value;
          return props;
        })(name, value);
          
        this.forEach(function(elem) {
          // Set
          var styles = {};
          console.log("get css text", elem);
          var cssText = elem.getAttribute('style');
          console.log("get css text", cssText);
          if (cssText) {
            var obj = css.parse('element { ' + cssText + ' }');
            obj.stylesheet.rules[0].declarations.forEach(function(rule) {
              if (!props.hasOwnProperty(rule.property)) {
                styles[S(rule.property).camelize()] = rule.value; 
              }
            });
          }
          
          // Remove empty styles
          for (var name in props) {
            var value;
            if (!props[name]) {
              delete styles[name];
            } else {
              value = props[name];
              styles[name] = value;
            }
          }
          cssText = Object.keys(styles).map(function(name) {
            return S(name).dasherize() + ": " + styles[name];
          }).join("; ");
          
          elem.setAttribute('style', cssText);
        });
      } else {
        // Get
        if (this.length) {
          var elem = this[0];
          var styles = {};
          var cssText = elem.getAttribute('style');
          console.log("cssText ", cssText);
          if (cssText) {
            var obj = css.parse('element.style { ' + cssText + ' }');
            obj.stylesheet.rules[0].declarations.forEach(function(rule) {
              styles[S(rule.property).camelize()] = rule.value; 
            });
          }
          return name ? styles[name] : styles;
        }
        return null;
      }
      return this;
    },
    
    svg: function() {
      var result = "";
      //var xmlSerializer = new XMLSerializer();
      this.forEach(function(elem) {
        //console.log("elem: ", elem.outerHTML);
        //result+= elem.outerHTML;
        if (typeof elem.outerHTML !== 'undefined') {
          result+= elem.outerHTML;
        } else {
          result+= (new impl.XMLSerializer()).serializeToString(elem);
        }
      });
      return result;
    },
    
    /**
     * Creates a new element with the specifed tagname.
     * @param {String} tagName
     * @param {Object} attrs
     */
    create: function( tagName, attrs ) {
      return _v((this[0] && this[0].ownerDocument || document).createElementNS(this[0] && this[0].namespaceURI || SVG_NAMESPACE_URI, tagName)).attr(attrs);
    },
    
    /**
     * Appends the specified child to the first element in the set.
     * @param {Object} child
     */
    append: function( child ) {
      if (this.length) {
        if (typeof child === 'string') {
          console.log("STRING: ", child);
          child = this[0].ownerDocument.createTextNode(child);
        }
        this[0].appendChild(child[0] || child);
      }
      return this;
    },
    
    prepend: function( child ) {
      if (this.length) {
        this[0].insertBefore(_v(child)[0], this[0].firstChild);
      }
    },
    
    /**
     * Removes all elements in the set or removes the specified child from the set of matched elements.
     * @param {Object} child
     */
    remove: function( child ) {
      this.forEach(function(elem) {
        if (child) {
          elem.removeChild(child);
        } else if (elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      });
      return this;
    },
    
    parent: function() {
      return _v(this[0] && this[0].parentNode);
    },
    
    /**
     * The arc() method creates an arc/curve (used to create circles, or parts of circles). 
     * @param {Number} x
     * @param {Number} y
     * @param {Number} r
     * @param {Number} sAngle
     * @param {Number} eAngle
     * @param {Boolean} counterclockwise
     * @param {Object} attrs
     */
    arc: function(cx, cy, r, sAngle, eAngle, counterclockwise, attrs) {
      counterclockwise = typeof counterclockwise === 'boolean' ? counterclockwise : false;
      var
        d = 'M ' + round(cx) + ', ' + round(cy),
        cxs,
        cys,
        cxe,
        cye;
      if (eAngle - sAngle === Math.PI * 2) {
        // Circle
        d+= ' m -' + r + ', 0 a ' + r + ',' + r + ' 0 1,0 ' + (r * 2) + ',0 a ' + r + ',' + r + ' 0 1,0 -' + (r * 2) + ',0';
      } else {
        cxs = round(cx + cos(sAngle) * r);
        cys = round(cy + sin(sAngle) * r);
        cxe = round(cx + cos(eAngle) * r);
        cye = round(cy + sin(eAngle) * r);
        d+= " L" + cxs + "," + cys +
          " A" + r + "," + r + " 0 " + (eAngle - sAngle > PI ? 1 : 0) + "," + (counterclockwise ? 0 : 1) +
          " " + cxe + "," + cye + " Z";
      }
      return shape.call(this, "path", merge({
        d: d
      }, attrs || {}));
    },
    
    /**
     * Draws a circle on every element in the set.
     * @param {Number} cx
     * @param {Number} cy
     * @param {Number} r
     * @param {Object} attrs
     */
    circle: function( cx, cy, r, attrs ) {
      return shape.call(this, "circle", merge({
        cx: cx, 
        cy: cy, 
        r: r
      }, attrs || {}));
    },
    
    /**
     * Draws an ellipse on every element in the set.
     * @param {Number} cx
     * @param {Number} cy
     * @param {Number} rx
     * @param {Number} ry
     * @param {Object} attrs
     */
    ellipse: function( cx, cy, rx, ry, attrs ) {
      return shape.call(this, "ellipse", merge({
        cx: cx, 
        cy: cy, 
        rx: rx,
        ry: ry
      }, attrs || {}));
    },
    
    /**
     * Draws a rectangle on every element in the set.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @param {Object} attrs
     */
    rect: function( x, y, width, height, attrs ) {
      return shape.call(this, "rect", merge({
        x: x, 
        y: y, 
        width: width,
        height: height
      }, attrs || {}));
    },
    
    /**
     * Draws a line on every element in the set.
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} x2
     * @param {Number} y2
     * @param {Object} attrs
     */
    line: function( x1, y1, x2, y2, attrs ) {
      return shape.call(this, "line", merge({
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
      }, attrs || {}));
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polygon: function( points, attrs ) {
      return shape.call(this, 'polygon', merge({
        points: getPath(points)
      }, attrs || {}));
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polyline: function( points, attrs ) {
      return shape.call(this, 'polyline', merge({
        points: getPath(points)
      }, attrs || {}));
    },
    
    /**
     * Draws a path on every element in the set.
     * @param {String} d
     * @param {Object} attrs
     */
    path: function( d, attrs ) {
      return shape.call(this, 'path', merge({
        d: d
      }, attrs || {}));
    },
    
    /**
     * Renders text on every element in the set.
     * @param {Number} x
     * @param {Number} y
     * @param {String} string
     * @param {Object} attrs
     */
    text: function( x, y, string, attrs ) {
      console.log("*** text: ", x, y, string, attrs);
      var elem = this.create('text', merge(attrs || {}, {
        x: x, 
        y: y
      }));
      this.append(elem);
      elem.append([(this[0] && this[0].ownerDocument || document).createTextNode(string)]);
      return this;
    },
    
    /**
     * Creates and returns a group layer on the first element in the set
     * @param {Object} attrs
     */
    g: function( attrs ) {
      var g = this.create('g', attrs);
      _v(this[0]).append(g);
      return g;
    },
    
    bbox: function() {
      // TODO: Check whether added to document view
      console.log("--------- BBOX: ", this[0].nodeName);
      try {
        return impl.SVGSVGElement.prototype.getBBox.apply(this[0], arguments);
      } catch (e) {
        console.error(e);
        return null;
      }
      
      var
        x = 0,
        y = 0,
        width = 0,
        height = 0,
        elem = this[0],
        x1, y1, x2, y2;
      
      if (elem.nodeName === 'text') {
        x = parseFloat(this.attr('x'));
        y = parseFloat(this.attr('y'));
        //width = parseFloat(this.attr('width'));
        //height = parseFloat(this.attr('height'));
      }  
      
      var c = computedTextLength(elem);
      var style = this.style();
      
      console.log("rect: ", rect);
       
      if (elem) {
        
        var
          fontSize = parseFloat(style.fontSize),
          rect = {};
        
        console.log("elem bbox: ", elem.nodeName, elem, x, y, width, height, c, fontSize);
        
        // Children
        var children = Array.prototype.slice.apply(elem.childNodes).filter(function(child) {
          return child.nodeType === 1;
        });
        
        if (children.length) {
        
          children.forEach(function(child) {
            var
              _child = _v(child),
              bounds = _child.bbox(),
              transform = _child.attr('transform');
            
            var matrix = new XCSSMatrix(transform);
            
            
            x1 = typeof x1 === 'number' ? Math.min(bounds.x, x1) : bounds.x;
            y1 = typeof y1 === 'number' ? Math.min(bounds.y, y1) : bounds.y;
            x2 = typeof x2 === 'number' ? Math.max(bounds.x + bounds.width, x2) : bounds.x + bounds.width;
            y2 = typeof y2 === 'number' ? Math.max(bounds.y + bounds.height, y2) : bounds.y + bounds.height;
  
            console.log("#### child: ", bounds, x1, y1, x2, y2, matrix.toString());
          });
          
          if (!x && x1 !== 0) {
            x = x1;
          }
          
          if (!y && y1 !== 0) {
            y = y1;
          }
          
          width = x2 - x1;
          height = y2 - y1;
          
        }
        
        // TEXT:
        if (elem.nodeName === 'text') {
          width = Math.max(computedTextLength(this), width);
          height = Math.max(fontSize, height);
          /*var font = getFont(style.fontFamily);
          var factor = fontSize / font.unitsPerEm;
          var offset = fontSize - (font.ascent / font.unitsPerEm) * fontSize;
          height = (font.ascent - font.descent) / font.unitsPerEm * fontSize;
          
          y = y - fontSize + offset;*/
        }
        
        rect.x = x;
        rect.y = y;
        rect.width = width;
        rect.height = height;
        
        console.log("*** elem bbox result: ", x, y, width, height, rect);
        
        return rect;
      }
      
      return null;
    },
    
    /**
     * Renders a smooth graph on every element in the set.
     * @param {Object} points
     * @param {Object} options
     */
    graph: function( points, attrs, options ) {
      
      this.forEach(function(elem) {
        
        var
          opts = merge({
            smooth: true, 
            tension: 0.4,
            approximate: true
          }, options || {}),
          t = !isNaN( opts.tension ) ? opts.tension : 0.5,
          el = _v(elem), 
          p,
          i,
          c,
          d,
          p1,
          p2,
          cps,
          path = el.create('path', attrs),
          pathStr = "";
          
        el.append(path);
        
        if (!opts.smooth) {
          for (i = 0; i < points.length; i++ ) {
            p = points[i];
            pathStr+= i > 0 ? "L" : "M";
            pathStr+= round(p.x) + " " + round(p.y) + " ";
          } 
        } else {
          // Smooth
          if (opts.approximate) {
            p = points[0];
            pathStr+= "M" + round(p.x) + " " + round(p.y) + " ";
            for (i = 1; i < points.length - 1; i++) {
                c = (points[i].x + points[i + 1].x) / 2;
                d = (points[i].y + points[i + 1].y) / 2;
                pathStr+= "Q" + round(points[i].x) + " " + round(points[i].y) + " " + c + " " + d + " ";
            }
            pathStr+= "T" + round(points[i].x) + " " + round(points[i].y) + " ";
          } else {
            p = points[0];
            pathStr+= "M" + p.x + " " + p.y + " ";
            for (i = 1; i < points.length - 1; i+=1) {
              p = points[i - 1];
              p1 = points[i];
              p2 = points[i + 1];
              cps = getControlPoints(p.x, p.y, p1.x, p1.y, p2.x, p2.y, t);
              pathStr+= "C" + round(cps.p1.x) + " " + round(cps.p1.y) + " " + round(cps.p2.x) + " " + round(cps.p2.y) + " " + round(p2.x) + " " + round(p2.y) + " ";
            }
            pathStr+= "T" + round(points[points.length - 1].x) + " " + round(points[points.length - 1].y) + " ";
          }
        }
        
        delete opts.smooth;
        delete opts.tension;
        delete opts.approximate;
        path.attr(merge({
          fill: 'none'
        }, {
          d: pathStr
        }));
        
      });
    },
    
    
    /**
     * Renders text into a bounding box by wrapping lines at spaces.
     * @param {Object} x
     * @param {Object} y
     * @param {Object} width
     * @param {Object} height
     * @param {Object} string
     * @param {Object} attrs
     */
    textbox: function( x, y, width, height, string, attrs ) {
      
      var 
        self = this;
      
      this.forEach(function(elem) {
        var
          _velem = _v(elem),
          lines = width ? [] : [string], 
          line = [],
          textLength = 0,
          words = width ? string.split(/\s+/) : [],
          text = self.create('text', merge(attrs || {}, {
            x: x,
            y: y
          })),
          textNode,
          style = text.style(),
          fontSize = parseFloat(style.fontSize) || 16,
          lineHeight = fontSize * 1.4,
          textAlign = (style.textAlign === 'end' || style.textAlign === 'right' ? 1 : style.textAlign === 'center' || style.textAlign === 'middle' ? 0.5 : 0);
          ty = 0;
        
        _velem.append(text);

        if (width) {
          // Break lines
          textNode = elem.ownerDocument.createTextNode("");
          text.append(textNode);
          words.forEach(function(word, index) {
            textNode.data = line.join(' ') + ' ' + word;
            textLength = computedTextLength(text, style);
            if (textLength > width) {
              // Break line
              lines.push({length: lineLength, text: line.join(' ')});
              lineLength = 0;
              line = [word];
            } else {
              // Add word to line
              lineLength = textLength;
              line.push(word);
            }
            if (index === words.length - 1) {
              lines.push({length: lineLength, text: line.join(' ')});
            }
          });
          text.remove(textNode);
        }
        
        // Render lines
        lines.forEach(function(line, index) {
          var tspan, dy;
          if (!height || ty + parseFloat(lineHeight) < height) {
            dy = index > 0 ? lineHeight : fontSize - 2;
            ty+= dy;
            tspan = self.create('tspan', {dy: dy});
            text.append(tspan);
            tspan
              .append(elem.ownerDocument.createTextNode(line.text));
            tspan.attr('x', parseInt(text.attr('x'), undefined) + (width - line.length) * textAlign);
          }
        });
      });
      return this;
    }
    
  });
module.exports = _v;
},{"./impl/window":45,"./lib/round":46,"./lib/svgpoint":47,"css":1,"deepmerge":24,"string":32,"xcssmatrix":33}]},{},[48])(48)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY3NzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9saWIvcGFyc2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvY29tcGlsZXIuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvY29tcHJlc3MuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvaWRlbnRpdHkuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvc291cmNlLW1hcC1zdXBwb3J0LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAtcmVzb2x2ZS9ub2RlX21vZHVsZXMvcmVzb2x2ZS11cmwvcmVzb2x2ZS11cmwuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwLXJlc29sdmUvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAtdXJsL3NvdXJjZS1tYXAtdXJsLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC1yZXNvbHZlL3NvdXJjZS1tYXAtcmVzb2x2ZS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL2FycmF5LXNldC5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmFzZTY0LXZscS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmFzZTY0LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9iaW5hcnktc2VhcmNoLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9tYXBwaW5nLWxpc3QuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3NvdXJjZS1tYXAtY29uc3VtZXIuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3NvdXJjZS1tYXAtZ2VuZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9zb3VyY2Utbm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbm9kZV9tb2R1bGVzL2FtZGVmaW5lL2FtZGVmaW5lLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvdXJpeC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWVwbWVyZ2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvbndtYXRjaGVyL3NyYy9ud21hdGNoZXIuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9fY291bnQuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9fc3BsaXRMZWZ0LmpzIiwibm9kZV9tb2R1bGVzL3N0cmluZy9saWIvX3NwbGl0UmlnaHQuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9zdHJpbmcuanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy94Y3NzbWF0cml4L2xpYi9WZWN0b3I0LmpzIiwibm9kZV9tb2R1bGVzL3hjc3NtYXRyaXgvbGliL1hDU1NNYXRyaXguanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9saWIvdXRpbHMvYW5nbGUuanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9saWIvdXRpbHMvY3NzVHJhbnNmb3JtU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL3hjc3NtYXRyaXgvbGliL3V0aWxzL21hdHJpeC5qcyIsIm5vZGVfbW9kdWxlcy94Y3NzbWF0cml4L2xpYi91dGlscy92ZWN0b3IuanMiLCJub2RlX21vZHVsZXMveG1sZG9tL2RvbS1wYXJzZXIuanMiLCJub2RlX21vZHVsZXMveG1sZG9tL2RvbS5qcyIsIm5vZGVfbW9kdWxlcy94bWxkb20vc2F4LmpzIiwic3JjL2ltcGwvZG9tLmpzIiwic3JjL2ltcGwvc3ZnLmpzIiwic3JjL2ltcGwvd2luZG93LmpzIiwic3JjL2xpYi9yb3VuZC5qcyIsInNyYy9saWIvc3ZncG9pbnQuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9rQ0E7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzloQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2xpYi9wYXJzZScpO1xuZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2xpYi9zdHJpbmdpZnknKTtcbiIsIi8vIGh0dHA6Ly93d3cudzMub3JnL1RSL0NTUzIxL2dyYW1tYXIuaHRtbFxuLy8gaHR0cHM6Ly9naXRodWIuY29tL3Zpc2lvbm1lZGlhL2Nzcy1wYXJzZS9wdWxsLzQ5I2lzc3VlY29tbWVudC0zMDA4ODAyN1xudmFyIGNvbW1lbnRyZSA9IC9cXC9cXCpbXipdKlxcKisoW14vKl1bXipdKlxcKispKlxcLy9nXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3NzLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uYWwuXG4gICAqL1xuXG4gIHZhciBsaW5lbm8gPSAxO1xuICB2YXIgY29sdW1uID0gMTtcblxuICAvKipcbiAgICogVXBkYXRlIGxpbmVubyBhbmQgY29sdW1uIGJhc2VkIG9uIGBzdHJgLlxuICAgKi9cblxuICBmdW5jdGlvbiB1cGRhdGVQb3NpdGlvbihzdHIpIHtcbiAgICB2YXIgbGluZXMgPSBzdHIubWF0Y2goL1xcbi9nKTtcbiAgICBpZiAobGluZXMpIGxpbmVubyArPSBsaW5lcy5sZW5ndGg7XG4gICAgdmFyIGkgPSBzdHIubGFzdEluZGV4T2YoJ1xcbicpO1xuICAgIGNvbHVtbiA9IH5pID8gc3RyLmxlbmd0aCAtIGkgOiBjb2x1bW4gKyBzdHIubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIE1hcmsgcG9zaXRpb24gYW5kIHBhdGNoIGBub2RlLnBvc2l0aW9uYC5cbiAgICovXG5cbiAgZnVuY3Rpb24gcG9zaXRpb24oKSB7XG4gICAgdmFyIHN0YXJ0ID0geyBsaW5lOiBsaW5lbm8sIGNvbHVtbjogY29sdW1uIH07XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5vZGUpe1xuICAgICAgbm9kZS5wb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihzdGFydCk7XG4gICAgICB3aGl0ZXNwYWNlKCk7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFN0b3JlIHBvc2l0aW9uIGluZm9ybWF0aW9uIGZvciBhIG5vZGVcbiAgICovXG5cbiAgZnVuY3Rpb24gUG9zaXRpb24oc3RhcnQpIHtcbiAgICB0aGlzLnN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5lbmQgPSB7IGxpbmU6IGxpbmVubywgY29sdW1uOiBjb2x1bW4gfTtcbiAgICB0aGlzLnNvdXJjZSA9IG9wdGlvbnMuc291cmNlO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vbi1lbnVtZXJhYmxlIHNvdXJjZSBzdHJpbmdcbiAgICovXG5cbiAgUG9zaXRpb24ucHJvdG90eXBlLmNvbnRlbnQgPSBjc3M7XG5cbiAgLyoqXG4gICAqIEVycm9yIGBtc2dgLlxuICAgKi9cblxuICB2YXIgZXJyb3JzTGlzdCA9IFtdO1xuXG4gIGZ1bmN0aW9uIGVycm9yKG1zZykge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3Iob3B0aW9ucy5zb3VyY2UgKyAnOicgKyBsaW5lbm8gKyAnOicgKyBjb2x1bW4gKyAnOiAnICsgbXNnKTtcbiAgICBlcnIucmVhc29uID0gbXNnO1xuICAgIGVyci5maWxlbmFtZSA9IG9wdGlvbnMuc291cmNlO1xuICAgIGVyci5saW5lID0gbGluZW5vO1xuICAgIGVyci5jb2x1bW4gPSBjb2x1bW47XG4gICAgZXJyLnNvdXJjZSA9IGNzcztcblxuICAgIGlmIChvcHRpb25zLnNpbGVudCkge1xuICAgICAgZXJyb3JzTGlzdC5wdXNoKGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Ugc3R5bGVzaGVldC5cbiAgICovXG5cbiAgZnVuY3Rpb24gc3R5bGVzaGVldCgpIHtcbiAgICB2YXIgcnVsZXNMaXN0ID0gcnVsZXMoKTtcblxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnc3R5bGVzaGVldCcsXG4gICAgICBzdHlsZXNoZWV0OiB7XG4gICAgICAgIHJ1bGVzOiBydWxlc0xpc3QsXG4gICAgICAgIHBhcnNpbmdFcnJvcnM6IGVycm9yc0xpc3RcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIE9wZW5pbmcgYnJhY2UuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG9wZW4oKSB7XG4gICAgcmV0dXJuIG1hdGNoKC9ee1xccyovKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zaW5nIGJyYWNlLlxuICAgKi9cblxuICBmdW5jdGlvbiBjbG9zZSgpIHtcbiAgICByZXR1cm4gbWF0Y2goL159Lyk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgcnVsZXNldC5cbiAgICovXG5cbiAgZnVuY3Rpb24gcnVsZXMoKSB7XG4gICAgdmFyIG5vZGU7XG4gICAgdmFyIHJ1bGVzID0gW107XG4gICAgd2hpdGVzcGFjZSgpO1xuICAgIGNvbW1lbnRzKHJ1bGVzKTtcbiAgICB3aGlsZSAoY3NzLmxlbmd0aCAmJiBjc3MuY2hhckF0KDApICE9ICd9JyAmJiAobm9kZSA9IGF0cnVsZSgpIHx8IHJ1bGUoKSkpIHtcbiAgICAgIGlmIChub2RlICE9PSBmYWxzZSkge1xuICAgICAgICBydWxlcy5wdXNoKG5vZGUpO1xuICAgICAgICBjb21tZW50cyhydWxlcyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydWxlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXRjaCBgcmVgIGFuZCByZXR1cm4gY2FwdHVyZXMuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG1hdGNoKHJlKSB7XG4gICAgdmFyIG0gPSByZS5leGVjKGNzcyk7XG4gICAgaWYgKCFtKSByZXR1cm47XG4gICAgdmFyIHN0ciA9IG1bMF07XG4gICAgdXBkYXRlUG9zaXRpb24oc3RyKTtcbiAgICBjc3MgPSBjc3Muc2xpY2Uoc3RyLmxlbmd0aCk7XG4gICAgcmV0dXJuIG07XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Ugd2hpdGVzcGFjZS5cbiAgICovXG5cbiAgZnVuY3Rpb24gd2hpdGVzcGFjZSgpIHtcbiAgICBtYXRjaCgvXlxccyovKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBjb21tZW50cztcbiAgICovXG5cbiAgZnVuY3Rpb24gY29tbWVudHMocnVsZXMpIHtcbiAgICB2YXIgYztcbiAgICBydWxlcyA9IHJ1bGVzIHx8IFtdO1xuICAgIHdoaWxlIChjID0gY29tbWVudCgpKSB7XG4gICAgICBpZiAoYyAhPT0gZmFsc2UpIHtcbiAgICAgICAgcnVsZXMucHVzaChjKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ1bGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGNvbW1lbnQuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNvbW1lbnQoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgaWYgKCcvJyAhPSBjc3MuY2hhckF0KDApIHx8ICcqJyAhPSBjc3MuY2hhckF0KDEpKSByZXR1cm47XG5cbiAgICB2YXIgaSA9IDI7XG4gICAgd2hpbGUgKFwiXCIgIT0gY3NzLmNoYXJBdChpKSAmJiAoJyonICE9IGNzcy5jaGFyQXQoaSkgfHwgJy8nICE9IGNzcy5jaGFyQXQoaSArIDEpKSkgKytpO1xuICAgIGkgKz0gMjtcblxuICAgIGlmIChcIlwiID09PSBjc3MuY2hhckF0KGktMSkpIHtcbiAgICAgIHJldHVybiBlcnJvcignRW5kIG9mIGNvbW1lbnQgbWlzc2luZycpO1xuICAgIH1cblxuICAgIHZhciBzdHIgPSBjc3Muc2xpY2UoMiwgaSAtIDIpO1xuICAgIGNvbHVtbiArPSAyO1xuICAgIHVwZGF0ZVBvc2l0aW9uKHN0cik7XG4gICAgY3NzID0gY3NzLnNsaWNlKGkpO1xuICAgIGNvbHVtbiArPSAyO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAnY29tbWVudCcsXG4gICAgICBjb21tZW50OiBzdHJcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBzZWxlY3Rvci5cbiAgICovXG5cbiAgZnVuY3Rpb24gc2VsZWN0b3IoKSB7XG4gICAgdmFyIG0gPSBtYXRjaCgvXihbXntdKykvKTtcbiAgICBpZiAoIW0pIHJldHVybjtcbiAgICAvKiBAZml4IFJlbW92ZSBhbGwgY29tbWVudHMgZnJvbSBzZWxlY3RvcnNcbiAgICAgKiBodHRwOi8vb3N0ZXJtaWxsZXIub3JnL2ZpbmRjb21tZW50Lmh0bWwgKi9cbiAgICByZXR1cm4gdHJpbShtWzBdKVxuICAgICAgLnJlcGxhY2UoL1xcL1xcKihbXipdfFtcXHJcXG5dfChcXCorKFteKi9dfFtcXHJcXG5dKSkpKlxcKlxcLysvZywgJycpXG4gICAgICAucmVwbGFjZSgvXCIoPzpcXFxcXCJ8W15cIl0pKlwifCcoPzpcXFxcJ3xbXiddKSonL2csIGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgcmV0dXJuIG0ucmVwbGFjZSgvLC9nLCAnXFx1MjAwQycpO1xuICAgICAgfSlcbiAgICAgIC5zcGxpdCgvXFxzKig/IVteKF0qXFwpKSxcXHMqLylcbiAgICAgIC5tYXAoZnVuY3Rpb24ocykge1xuICAgICAgICByZXR1cm4gcy5yZXBsYWNlKC9cXHUyMDBDL2csICcsJyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBkZWNsYXJhdGlvbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gZGVjbGFyYXRpb24oKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG5cbiAgICAvLyBwcm9wXG4gICAgdmFyIHByb3AgPSBtYXRjaCgvXihcXCo/Wy0jXFwvXFwqXFxcXFxcd10rKFxcW1swLTlhLXpfLV0rXFxdKT8pXFxzKi8pO1xuICAgIGlmICghcHJvcCkgcmV0dXJuO1xuICAgIHByb3AgPSB0cmltKHByb3BbMF0pO1xuXG4gICAgLy8gOlxuICAgIGlmICghbWF0Y2goL146XFxzKi8pKSByZXR1cm4gZXJyb3IoXCJwcm9wZXJ0eSBtaXNzaW5nICc6J1wiKTtcblxuICAgIC8vIHZhbFxuICAgIHZhciB2YWwgPSBtYXRjaCgvXigoPzonKD86XFxcXCd8LikqPyd8XCIoPzpcXFxcXCJ8LikqP1wifFxcKFteXFwpXSo/XFwpfFtefTtdKSspLyk7XG5cbiAgICB2YXIgcmV0ID0gcG9zKHtcbiAgICAgIHR5cGU6ICdkZWNsYXJhdGlvbicsXG4gICAgICBwcm9wZXJ0eTogcHJvcC5yZXBsYWNlKGNvbW1lbnRyZSwgJycpLFxuICAgICAgdmFsdWU6IHZhbCA/IHRyaW0odmFsWzBdKS5yZXBsYWNlKGNvbW1lbnRyZSwgJycpIDogJydcbiAgICB9KTtcblxuICAgIC8vIDtcbiAgICBtYXRjaCgvXls7XFxzXSovKTtcblxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgZGVjbGFyYXRpb25zLlxuICAgKi9cblxuICBmdW5jdGlvbiBkZWNsYXJhdGlvbnMoKSB7XG4gICAgdmFyIGRlY2xzID0gW107XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwibWlzc2luZyAneydcIik7XG4gICAgY29tbWVudHMoZGVjbHMpO1xuXG4gICAgLy8gZGVjbGFyYXRpb25zXG4gICAgdmFyIGRlY2w7XG4gICAgd2hpbGUgKGRlY2wgPSBkZWNsYXJhdGlvbigpKSB7XG4gICAgICBpZiAoZGVjbCAhPT0gZmFsc2UpIHtcbiAgICAgICAgZGVjbHMucHVzaChkZWNsKTtcbiAgICAgICAgY29tbWVudHMoZGVjbHMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwibWlzc2luZyAnfSdcIik7XG4gICAgcmV0dXJuIGRlY2xzO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGtleWZyYW1lLlxuICAgKi9cblxuICBmdW5jdGlvbiBrZXlmcmFtZSgpIHtcbiAgICB2YXIgbTtcbiAgICB2YXIgdmFscyA9IFtdO1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuXG4gICAgd2hpbGUgKG0gPSBtYXRjaCgvXigoXFxkK1xcLlxcZCt8XFwuXFxkK3xcXGQrKSU/fFthLXpdKylcXHMqLykpIHtcbiAgICAgIHZhbHMucHVzaChtWzFdKTtcbiAgICAgIG1hdGNoKC9eLFxccyovKTtcbiAgICB9XG5cbiAgICBpZiAoIXZhbHMubGVuZ3RoKSByZXR1cm47XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdrZXlmcmFtZScsXG4gICAgICB2YWx1ZXM6IHZhbHMsXG4gICAgICBkZWNsYXJhdGlvbnM6IGRlY2xhcmF0aW9ucygpXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Uga2V5ZnJhbWVzLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdGtleWZyYW1lcygpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQChbLVxcd10rKT9rZXlmcmFtZXNcXHMqLyk7XG5cbiAgICBpZiAoIW0pIHJldHVybjtcbiAgICB2YXIgdmVuZG9yID0gbVsxXTtcblxuICAgIC8vIGlkZW50aWZpZXJcbiAgICB2YXIgbSA9IG1hdGNoKC9eKFstXFx3XSspXFxzKi8pO1xuICAgIGlmICghbSkgcmV0dXJuIGVycm9yKFwiQGtleWZyYW1lcyBtaXNzaW5nIG5hbWVcIik7XG4gICAgdmFyIG5hbWUgPSBtWzFdO1xuXG4gICAgaWYgKCFvcGVuKCkpIHJldHVybiBlcnJvcihcIkBrZXlmcmFtZXMgbWlzc2luZyAneydcIik7XG5cbiAgICB2YXIgZnJhbWU7XG4gICAgdmFyIGZyYW1lcyA9IGNvbW1lbnRzKCk7XG4gICAgd2hpbGUgKGZyYW1lID0ga2V5ZnJhbWUoKSkge1xuICAgICAgZnJhbWVzLnB1c2goZnJhbWUpO1xuICAgICAgZnJhbWVzID0gZnJhbWVzLmNvbmNhdChjb21tZW50cygpKTtcbiAgICB9XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBrZXlmcmFtZXMgbWlzc2luZyAnfSdcIik7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdrZXlmcmFtZXMnLFxuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHZlbmRvcjogdmVuZG9yLFxuICAgICAga2V5ZnJhbWVzOiBmcmFtZXNcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBzdXBwb3J0cy5cbiAgICovXG5cbiAgZnVuY3Rpb24gYXRzdXBwb3J0cygpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQHN1cHBvcnRzICooW157XSspLyk7XG5cbiAgICBpZiAoIW0pIHJldHVybjtcbiAgICB2YXIgc3VwcG9ydHMgPSB0cmltKG1bMV0pO1xuXG4gICAgaWYgKCFvcGVuKCkpIHJldHVybiBlcnJvcihcIkBzdXBwb3J0cyBtaXNzaW5nICd7J1wiKTtcblxuICAgIHZhciBzdHlsZSA9IGNvbW1lbnRzKCkuY29uY2F0KHJ1bGVzKCkpO1xuXG4gICAgaWYgKCFjbG9zZSgpKSByZXR1cm4gZXJyb3IoXCJAc3VwcG9ydHMgbWlzc2luZyAnfSdcIik7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdzdXBwb3J0cycsXG4gICAgICBzdXBwb3J0czogc3VwcG9ydHMsXG4gICAgICBydWxlczogc3R5bGVcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBob3N0LlxuICAgKi9cblxuICBmdW5jdGlvbiBhdGhvc3QoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgdmFyIG0gPSBtYXRjaCgvXkBob3N0XFxzKi8pO1xuXG4gICAgaWYgKCFtKSByZXR1cm47XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQGhvc3QgbWlzc2luZyAneydcIik7XG5cbiAgICB2YXIgc3R5bGUgPSBjb21tZW50cygpLmNvbmNhdChydWxlcygpKTtcblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQGhvc3QgbWlzc2luZyAnfSdcIik7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdob3N0JyxcbiAgICAgIHJ1bGVzOiBzdHlsZVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG1lZGlhLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdG1lZGlhKCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15AbWVkaWEgKihbXntdKykvKTtcblxuICAgIGlmICghbSkgcmV0dXJuO1xuICAgIHZhciBtZWRpYSA9IHRyaW0obVsxXSk7XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQG1lZGlhIG1pc3NpbmcgJ3snXCIpO1xuXG4gICAgdmFyIHN0eWxlID0gY29tbWVudHMoKS5jb25jYXQocnVsZXMoKSk7XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBtZWRpYSBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ21lZGlhJyxcbiAgICAgIG1lZGlhOiBtZWRpYSxcbiAgICAgIHJ1bGVzOiBzdHlsZVxuICAgIH0pO1xuICB9XG5cblxuICAvKipcbiAgICogUGFyc2UgY3VzdG9tLW1lZGlhLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdGN1c3RvbW1lZGlhKCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15AY3VzdG9tLW1lZGlhXFxzKygtLVteXFxzXSspXFxzKihbXns7XSspOy8pO1xuICAgIGlmICghbSkgcmV0dXJuO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAnY3VzdG9tLW1lZGlhJyxcbiAgICAgIG5hbWU6IHRyaW0obVsxXSksXG4gICAgICBtZWRpYTogdHJpbShtWzJdKVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHBhZ2VkIG1lZGlhLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdHBhZ2UoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgdmFyIG0gPSBtYXRjaCgvXkBwYWdlICovKTtcbiAgICBpZiAoIW0pIHJldHVybjtcblxuICAgIHZhciBzZWwgPSBzZWxlY3RvcigpIHx8IFtdO1xuXG4gICAgaWYgKCFvcGVuKCkpIHJldHVybiBlcnJvcihcIkBwYWdlIG1pc3NpbmcgJ3snXCIpO1xuICAgIHZhciBkZWNscyA9IGNvbW1lbnRzKCk7XG5cbiAgICAvLyBkZWNsYXJhdGlvbnNcbiAgICB2YXIgZGVjbDtcbiAgICB3aGlsZSAoZGVjbCA9IGRlY2xhcmF0aW9uKCkpIHtcbiAgICAgIGRlY2xzLnB1c2goZGVjbCk7XG4gICAgICBkZWNscyA9IGRlY2xzLmNvbmNhdChjb21tZW50cygpKTtcbiAgICB9XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBwYWdlIG1pc3NpbmcgJ30nXCIpO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAncGFnZScsXG4gICAgICBzZWxlY3RvcnM6IHNlbCxcbiAgICAgIGRlY2xhcmF0aW9uczogZGVjbHNcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBkb2N1bWVudC5cbiAgICovXG5cbiAgZnVuY3Rpb24gYXRkb2N1bWVudCgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQChbLVxcd10rKT9kb2N1bWVudCAqKFtee10rKS8pO1xuICAgIGlmICghbSkgcmV0dXJuO1xuXG4gICAgdmFyIHZlbmRvciA9IHRyaW0obVsxXSk7XG4gICAgdmFyIGRvYyA9IHRyaW0obVsyXSk7XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQGRvY3VtZW50IG1pc3NpbmcgJ3snXCIpO1xuXG4gICAgdmFyIHN0eWxlID0gY29tbWVudHMoKS5jb25jYXQocnVsZXMoKSk7XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBkb2N1bWVudCBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ2RvY3VtZW50JyxcbiAgICAgIGRvY3VtZW50OiBkb2MsXG4gICAgICB2ZW5kb3I6IHZlbmRvcixcbiAgICAgIHJ1bGVzOiBzdHlsZVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGZvbnQtZmFjZS5cbiAgICovXG5cbiAgZnVuY3Rpb24gYXRmb250ZmFjZSgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQGZvbnQtZmFjZVxccyovKTtcbiAgICBpZiAoIW0pIHJldHVybjtcblxuICAgIGlmICghb3BlbigpKSByZXR1cm4gZXJyb3IoXCJAZm9udC1mYWNlIG1pc3NpbmcgJ3snXCIpO1xuICAgIHZhciBkZWNscyA9IGNvbW1lbnRzKCk7XG5cbiAgICAvLyBkZWNsYXJhdGlvbnNcbiAgICB2YXIgZGVjbDtcbiAgICB3aGlsZSAoZGVjbCA9IGRlY2xhcmF0aW9uKCkpIHtcbiAgICAgIGRlY2xzLnB1c2goZGVjbCk7XG4gICAgICBkZWNscyA9IGRlY2xzLmNvbmNhdChjb21tZW50cygpKTtcbiAgICB9XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBmb250LWZhY2UgbWlzc2luZyAnfSdcIik7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdmb250LWZhY2UnLFxuICAgICAgZGVjbGFyYXRpb25zOiBkZWNsc1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGltcG9ydFxuICAgKi9cblxuICB2YXIgYXRpbXBvcnQgPSBfY29tcGlsZUF0cnVsZSgnaW1wb3J0Jyk7XG5cbiAgLyoqXG4gICAqIFBhcnNlIGNoYXJzZXRcbiAgICovXG5cbiAgdmFyIGF0Y2hhcnNldCA9IF9jb21waWxlQXRydWxlKCdjaGFyc2V0Jyk7XG5cbiAgLyoqXG4gICAqIFBhcnNlIG5hbWVzcGFjZVxuICAgKi9cblxuICB2YXIgYXRuYW1lc3BhY2UgPSBfY29tcGlsZUF0cnVsZSgnbmFtZXNwYWNlJyk7XG5cbiAgLyoqXG4gICAqIFBhcnNlIG5vbi1ibG9jayBhdC1ydWxlc1xuICAgKi9cblxuXG4gIGZ1bmN0aW9uIF9jb21waWxlQXRydWxlKG5hbWUpIHtcbiAgICB2YXIgcmUgPSBuZXcgUmVnRXhwKCdeQCcgKyBuYW1lICsgJ1xcXFxzKihbXjtdKyk7Jyk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgICB2YXIgbSA9IG1hdGNoKHJlKTtcbiAgICAgIGlmICghbSkgcmV0dXJuO1xuICAgICAgdmFyIHJldCA9IHsgdHlwZTogbmFtZSB9O1xuICAgICAgcmV0W25hbWVdID0gbVsxXS50cmltKCk7XG4gICAgICByZXR1cm4gcG9zKHJldCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGF0IHJ1bGUuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0cnVsZSgpIHtcbiAgICBpZiAoY3NzWzBdICE9ICdAJykgcmV0dXJuO1xuXG4gICAgcmV0dXJuIGF0a2V5ZnJhbWVzKClcbiAgICAgIHx8IGF0bWVkaWEoKVxuICAgICAgfHwgYXRjdXN0b21tZWRpYSgpXG4gICAgICB8fCBhdHN1cHBvcnRzKClcbiAgICAgIHx8IGF0aW1wb3J0KClcbiAgICAgIHx8IGF0Y2hhcnNldCgpXG4gICAgICB8fCBhdG5hbWVzcGFjZSgpXG4gICAgICB8fCBhdGRvY3VtZW50KClcbiAgICAgIHx8IGF0cGFnZSgpXG4gICAgICB8fCBhdGhvc3QoKVxuICAgICAgfHwgYXRmb250ZmFjZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHJ1bGUuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHJ1bGUoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgdmFyIHNlbCA9IHNlbGVjdG9yKCk7XG5cbiAgICBpZiAoIXNlbCkgcmV0dXJuIGVycm9yKCdzZWxlY3RvciBtaXNzaW5nJyk7XG4gICAgY29tbWVudHMoKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ3J1bGUnLFxuICAgICAgc2VsZWN0b3JzOiBzZWwsXG4gICAgICBkZWNsYXJhdGlvbnM6IGRlY2xhcmF0aW9ucygpXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gYWRkUGFyZW50KHN0eWxlc2hlZXQoKSk7XG59O1xuXG4vKipcbiAqIFRyaW0gYHN0cmAuXG4gKi9cblxuZnVuY3Rpb24gdHJpbShzdHIpIHtcbiAgcmV0dXJuIHN0ciA/IHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJykgOiAnJztcbn1cblxuLyoqXG4gKiBBZGRzIG5vbi1lbnVtZXJhYmxlIHBhcmVudCBub2RlIHJlZmVyZW5jZSB0byBlYWNoIG5vZGUuXG4gKi9cblxuZnVuY3Rpb24gYWRkUGFyZW50KG9iaiwgcGFyZW50KSB7XG4gIHZhciBpc05vZGUgPSBvYmogJiYgdHlwZW9mIG9iai50eXBlID09PSAnc3RyaW5nJztcbiAgdmFyIGNoaWxkUGFyZW50ID0gaXNOb2RlID8gb2JqIDogcGFyZW50O1xuXG4gIGZvciAodmFyIGsgaW4gb2JqKSB7XG4gICAgdmFyIHZhbHVlID0gb2JqW2tdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgdmFsdWUuZm9yRWFjaChmdW5jdGlvbih2KSB7IGFkZFBhcmVudCh2LCBjaGlsZFBhcmVudCk7IH0pO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgYWRkUGFyZW50KHZhbHVlLCBjaGlsZFBhcmVudCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGlzTm9kZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdwYXJlbnQnLCB7XG4gICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgdmFsdWU6IHBhcmVudCB8fCBudWxsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gb2JqO1xufVxuIiwiXG4vKipcbiAqIEV4cG9zZSBgQ29tcGlsZXJgLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQ29tcGlsZXI7XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBhIGNvbXBpbGVyLlxuICpcbiAqIEBwYXJhbSB7VHlwZX0gbmFtZVxuICogQHJldHVybiB7VHlwZX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gQ29tcGlsZXIob3B0cykge1xuICB0aGlzLm9wdGlvbnMgPSBvcHRzIHx8IHt9O1xufVxuXG4vKipcbiAqIEVtaXQgYHN0cmBcbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHN0cikge1xuICByZXR1cm4gc3RyO1xufTtcblxuLyoqXG4gKiBWaXNpdCBgbm9kZWAuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLnZpc2l0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzW25vZGUudHlwZV0obm9kZSk7XG59O1xuXG4vKipcbiAqIE1hcCB2aXNpdCBvdmVyIGFycmF5IG9mIGBub2Rlc2AsIG9wdGlvbmFsbHkgdXNpbmcgYSBgZGVsaW1gXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLm1hcFZpc2l0ID0gZnVuY3Rpb24obm9kZXMsIGRlbGltKXtcbiAgdmFyIGJ1ZiA9ICcnO1xuICBkZWxpbSA9IGRlbGltIHx8ICcnO1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGJ1ZiArPSB0aGlzLnZpc2l0KG5vZGVzW2ldKTtcbiAgICBpZiAoZGVsaW0gJiYgaSA8IGxlbmd0aCAtIDEpIGJ1ZiArPSB0aGlzLmVtaXQoZGVsaW0pO1xuICB9XG5cbiAgcmV0dXJuIGJ1Zjtcbn07XG4iLCJcbi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgQmFzZSA9IHJlcXVpcmUoJy4vY29tcGlsZXInKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbi8qKlxuICogRXhwb3NlIGNvbXBpbGVyLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQ29tcGlsZXI7XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBhIG5ldyBgQ29tcGlsZXJgLlxuICovXG5cbmZ1bmN0aW9uIENvbXBpbGVyKG9wdGlvbnMpIHtcbiAgQmFzZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIEluaGVyaXQgZnJvbSBgQmFzZS5wcm90b3R5cGVgLlxuICovXG5cbmluaGVyaXRzKENvbXBpbGVyLCBCYXNlKTtcblxuLyoqXG4gKiBDb21waWxlIGBub2RlYC5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuY29tcGlsZSA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gbm9kZS5zdHlsZXNoZWV0XG4gICAgLnJ1bGVzLm1hcCh0aGlzLnZpc2l0LCB0aGlzKVxuICAgIC5qb2luKCcnKTtcbn07XG5cbi8qKlxuICogVmlzaXQgY29tbWVudCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jb21tZW50ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBpbXBvcnQgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuaW1wb3J0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BpbXBvcnQgJyArIG5vZGUuaW1wb3J0ICsgJzsnLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgbWVkaWEgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUubWVkaWEgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQG1lZGlhICcgKyBub2RlLm1lZGlhLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBkb2N1bWVudCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5kb2N1bWVudCA9IGZ1bmN0aW9uKG5vZGUpe1xuICB2YXIgZG9jID0gJ0AnICsgKG5vZGUudmVuZG9yIHx8ICcnKSArICdkb2N1bWVudCAnICsgbm9kZS5kb2N1bWVudDtcblxuICByZXR1cm4gdGhpcy5lbWl0KGRvYywgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgneycpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUucnVsZXMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgY2hhcnNldCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jaGFyc2V0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BjaGFyc2V0ICcgKyBub2RlLmNoYXJzZXQgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBuYW1lc3BhY2Ugbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUubmFtZXNwYWNlID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BuYW1lc3BhY2UgJyArIG5vZGUubmFtZXNwYWNlICsgJzsnLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgc3VwcG9ydHMgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuc3VwcG9ydHMgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQHN1cHBvcnRzICcgKyBub2RlLnN1cHBvcnRzLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBrZXlmcmFtZXMgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUua2V5ZnJhbWVzID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0AnXG4gICAgKyAobm9kZS52ZW5kb3IgfHwgJycpXG4gICAgKyAna2V5ZnJhbWVzICdcbiAgICArIG5vZGUubmFtZSwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgneycpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUua2V5ZnJhbWVzKVxuICAgICsgdGhpcy5lbWl0KCd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGtleWZyYW1lIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmtleWZyYW1lID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBkZWNscyA9IG5vZGUuZGVjbGFyYXRpb25zO1xuXG4gIHJldHVybiB0aGlzLmVtaXQobm9kZS52YWx1ZXMuam9pbignLCcpLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQoZGVjbHMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgcGFnZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5wYWdlID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBzZWwgPSBub2RlLnNlbGVjdG9ycy5sZW5ndGhcbiAgICA/IG5vZGUuc2VsZWN0b3JzLmpvaW4oJywgJylcbiAgICA6ICcnO1xuXG4gIHJldHVybiB0aGlzLmVtaXQoJ0BwYWdlICcgKyBzZWwsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLmRlY2xhcmF0aW9ucylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBmb250LWZhY2Ugbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGVbJ2ZvbnQtZmFjZSddID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0Bmb250LWZhY2UnLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5kZWNsYXJhdGlvbnMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgaG9zdCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5ob3N0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0Bob3N0Jywgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgneycpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUucnVsZXMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgY3VzdG9tLW1lZGlhIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlWydjdXN0b20tbWVkaWEnXSA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAY3VzdG9tLW1lZGlhICcgKyBub2RlLm5hbWUgKyAnICcgKyBub2RlLm1lZGlhICsgJzsnLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgcnVsZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5ydWxlID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBkZWNscyA9IG5vZGUuZGVjbGFyYXRpb25zO1xuICBpZiAoIWRlY2xzLmxlbmd0aCkgcmV0dXJuICcnO1xuXG4gIHJldHVybiB0aGlzLmVtaXQobm9kZS5zZWxlY3RvcnMuam9pbignLCcpLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQoZGVjbHMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgZGVjbGFyYXRpb24gbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuZGVjbGFyYXRpb24gPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdChub2RlLnByb3BlcnR5ICsgJzonICsgbm9kZS52YWx1ZSwgbm9kZS5wb3NpdGlvbikgKyB0aGlzLmVtaXQoJzsnKTtcbn07XG5cbiIsIlxuLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBCYXNlID0gcmVxdWlyZSgnLi9jb21waWxlcicpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuLyoqXG4gKiBFeHBvc2UgY29tcGlsZXIuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDb21waWxlcjtcblxuLyoqXG4gKiBJbml0aWFsaXplIGEgbmV3IGBDb21waWxlcmAuXG4gKi9cblxuZnVuY3Rpb24gQ29tcGlsZXIob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgQmFzZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICB0aGlzLmluZGVudGF0aW9uID0gb3B0aW9ucy5pbmRlbnQ7XG59XG5cbi8qKlxuICogSW5oZXJpdCBmcm9tIGBCYXNlLnByb3RvdHlwZWAuXG4gKi9cblxuaW5oZXJpdHMoQ29tcGlsZXIsIEJhc2UpO1xuXG4vKipcbiAqIENvbXBpbGUgYG5vZGVgLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLnN0eWxlc2hlZXQobm9kZSk7XG59O1xuXG4vKipcbiAqIFZpc2l0IHN0eWxlc2hlZXQgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuc3R5bGVzaGVldCA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5tYXBWaXNpdChub2RlLnN0eWxlc2hlZXQucnVsZXMsICdcXG5cXG4nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgY29tbWVudCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jb21tZW50ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQodGhpcy5pbmRlbnQoKSArICcvKicgKyBub2RlLmNvbW1lbnQgKyAnKi8nLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgaW1wb3J0IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmltcG9ydCA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAaW1wb3J0ICcgKyBub2RlLmltcG9ydCArICc7Jywgbm9kZS5wb3NpdGlvbik7XG59O1xuXG4vKipcbiAqIFZpc2l0IG1lZGlhIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLm1lZGlhID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BtZWRpYSAnICsgbm9kZS5tZWRpYSwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICAgJyB7XFxuJ1xuICAgICAgICArIHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLnJ1bGVzLCAnXFxuXFxuJylcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICAgdGhpcy5pbmRlbnQoLTEpXG4gICAgICAgICsgJ1xcbn0nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgZG9jdW1lbnQgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuZG9jdW1lbnQgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIGRvYyA9ICdAJyArIChub2RlLnZlbmRvciB8fCAnJykgKyAnZG9jdW1lbnQgJyArIG5vZGUuZG9jdW1lbnQ7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdChkb2MsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAgICcgJ1xuICAgICAgKyAnIHtcXG4nXG4gICAgICArIHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLnJ1bGVzLCAnXFxuXFxuJylcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICAgdGhpcy5pbmRlbnQoLTEpXG4gICAgICAgICsgJ1xcbn0nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgY2hhcnNldCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jaGFyc2V0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BjaGFyc2V0ICcgKyBub2RlLmNoYXJzZXQgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBuYW1lc3BhY2Ugbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUubmFtZXNwYWNlID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BuYW1lc3BhY2UgJyArIG5vZGUubmFtZXNwYWNlICsgJzsnLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgc3VwcG9ydHMgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuc3VwcG9ydHMgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQHN1cHBvcnRzICcgKyBub2RlLnN1cHBvcnRzLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgJyB7XFxuJ1xuICAgICAgKyB0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcywgJ1xcblxcbicpXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAgIHRoaXMuaW5kZW50KC0xKVxuICAgICAgICArICdcXG59Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGtleWZyYW1lcyBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5rZXlmcmFtZXMgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQCcgKyAobm9kZS52ZW5kb3IgfHwgJycpICsgJ2tleWZyYW1lcyAnICsgbm9kZS5uYW1lLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgJyB7XFxuJ1xuICAgICAgKyB0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5rZXlmcmFtZXMsICdcXG4nKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICB0aGlzLmluZGVudCgtMSlcbiAgICAgICAgKyAnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBrZXlmcmFtZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5rZXlmcmFtZSA9IGZ1bmN0aW9uKG5vZGUpe1xuICB2YXIgZGVjbHMgPSBub2RlLmRlY2xhcmF0aW9ucztcblxuICByZXR1cm4gdGhpcy5lbWl0KHRoaXMuaW5kZW50KCkpXG4gICAgKyB0aGlzLmVtaXQobm9kZS52YWx1ZXMuam9pbignLCAnKSwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICcge1xcbidcbiAgICAgICsgdGhpcy5pbmRlbnQoMSkpXG4gICAgKyB0aGlzLm1hcFZpc2l0KGRlY2xzLCAnXFxuJylcbiAgICArIHRoaXMuZW1pdChcbiAgICAgIHRoaXMuaW5kZW50KC0xKVxuICAgICAgKyAnXFxuJ1xuICAgICAgKyB0aGlzLmluZGVudCgpICsgJ31cXG4nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgcGFnZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5wYWdlID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBzZWwgPSBub2RlLnNlbGVjdG9ycy5sZW5ndGhcbiAgICA/IG5vZGUuc2VsZWN0b3JzLmpvaW4oJywgJykgKyAnICdcbiAgICA6ICcnO1xuXG4gIHJldHVybiB0aGlzLmVtaXQoJ0BwYWdlICcgKyBzZWwsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3tcXG4nKVxuICAgICsgdGhpcy5lbWl0KHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLmRlY2xhcmF0aW9ucywgJ1xcbicpXG4gICAgKyB0aGlzLmVtaXQodGhpcy5pbmRlbnQoLTEpKVxuICAgICsgdGhpcy5lbWl0KCdcXG59Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGZvbnQtZmFjZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZVsnZm9udC1mYWNlJ10gPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGZvbnQtZmFjZSAnLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7XFxuJylcbiAgICArIHRoaXMuZW1pdCh0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5kZWNsYXJhdGlvbnMsICdcXG4nKVxuICAgICsgdGhpcy5lbWl0KHRoaXMuaW5kZW50KC0xKSlcbiAgICArIHRoaXMuZW1pdCgnXFxufScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBob3N0IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmhvc3QgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGhvc3QnLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICAnIHtcXG4nXG4gICAgICAgICsgdGhpcy5pbmRlbnQoMSkpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUucnVsZXMsICdcXG5cXG4nKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICB0aGlzLmluZGVudCgtMSlcbiAgICAgICAgKyAnXFxufScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjdXN0b20tbWVkaWEgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGVbJ2N1c3RvbS1tZWRpYSddID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BjdXN0b20tbWVkaWEgJyArIG5vZGUubmFtZSArICcgJyArIG5vZGUubWVkaWEgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBydWxlIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLnJ1bGUgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIGluZGVudCA9IHRoaXMuaW5kZW50KCk7XG4gIHZhciBkZWNscyA9IG5vZGUuZGVjbGFyYXRpb25zO1xuICBpZiAoIWRlY2xzLmxlbmd0aCkgcmV0dXJuICcnO1xuXG4gIHJldHVybiB0aGlzLmVtaXQobm9kZS5zZWxlY3RvcnMubWFwKGZ1bmN0aW9uKHMpeyByZXR1cm4gaW5kZW50ICsgcyB9KS5qb2luKCcsXFxuJyksIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJyB7XFxuJylcbiAgICArIHRoaXMuZW1pdCh0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQoZGVjbHMsICdcXG4nKVxuICAgICsgdGhpcy5lbWl0KHRoaXMuaW5kZW50KC0xKSlcbiAgICArIHRoaXMuZW1pdCgnXFxuJyArIHRoaXMuaW5kZW50KCkgKyAnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBkZWNsYXJhdGlvbiBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5kZWNsYXJhdGlvbiA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KHRoaXMuaW5kZW50KCkpXG4gICAgKyB0aGlzLmVtaXQobm9kZS5wcm9wZXJ0eSArICc6ICcgKyBub2RlLnZhbHVlLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCc7Jyk7XG59O1xuXG4vKipcbiAqIEluY3JlYXNlLCBkZWNyZWFzZSBvciByZXR1cm4gY3VycmVudCBpbmRlbnRhdGlvbi5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuaW5kZW50ID0gZnVuY3Rpb24obGV2ZWwpIHtcbiAgdGhpcy5sZXZlbCA9IHRoaXMubGV2ZWwgfHwgMTtcblxuICBpZiAobnVsbCAhPSBsZXZlbCkge1xuICAgIHRoaXMubGV2ZWwgKz0gbGV2ZWw7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgcmV0dXJuIEFycmF5KHRoaXMubGV2ZWwpLmpvaW4odGhpcy5pbmRlbnRhdGlvbiB8fCAnICAnKTtcbn07XG4iLCJcbi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgQ29tcHJlc3NlZCA9IHJlcXVpcmUoJy4vY29tcHJlc3MnKTtcbnZhciBJZGVudGl0eSA9IHJlcXVpcmUoJy4vaWRlbnRpdHknKTtcblxuLyoqXG4gKiBTdHJpbmdmeSB0aGUgZ2l2ZW4gQVNUIGBub2RlYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBjb21wcmVzc2Agc3BhY2Utb3B0aW1pemVkIG91dHB1dFxuICogIC0gYHNvdXJjZW1hcGAgcmV0dXJuIGFuIG9iamVjdCB3aXRoIGAuY29kZWAgYW5kIGAubWFwYFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obm9kZSwgb3B0aW9ucyl7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHZhciBjb21waWxlciA9IG9wdGlvbnMuY29tcHJlc3NcbiAgICA/IG5ldyBDb21wcmVzc2VkKG9wdGlvbnMpXG4gICAgOiBuZXcgSWRlbnRpdHkob3B0aW9ucyk7XG5cbiAgLy8gc291cmNlIG1hcHNcbiAgaWYgKG9wdGlvbnMuc291cmNlbWFwKSB7XG4gICAgdmFyIHNvdXJjZW1hcHMgPSByZXF1aXJlKCcuL3NvdXJjZS1tYXAtc3VwcG9ydCcpO1xuICAgIHNvdXJjZW1hcHMoY29tcGlsZXIpO1xuXG4gICAgdmFyIGNvZGUgPSBjb21waWxlci5jb21waWxlKG5vZGUpO1xuICAgIGNvbXBpbGVyLmFwcGx5U291cmNlTWFwcygpO1xuXG4gICAgdmFyIG1hcCA9IG9wdGlvbnMuc291cmNlbWFwID09PSAnZ2VuZXJhdG9yJ1xuICAgICAgPyBjb21waWxlci5tYXBcbiAgICAgIDogY29tcGlsZXIubWFwLnRvSlNPTigpO1xuXG4gICAgcmV0dXJuIHsgY29kZTogY29kZSwgbWFwOiBtYXAgfTtcbiAgfVxuXG4gIHZhciBjb2RlID0gY29tcGlsZXIuY29tcGlsZShub2RlKTtcbiAgcmV0dXJuIGNvZGU7XG59O1xuIiwiXG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIFNvdXJjZU1hcCA9IHJlcXVpcmUoJ3NvdXJjZS1tYXAnKS5Tb3VyY2VNYXBHZW5lcmF0b3I7XG52YXIgU291cmNlTWFwQ29uc3VtZXIgPSByZXF1aXJlKCdzb3VyY2UtbWFwJykuU291cmNlTWFwQ29uc3VtZXI7XG52YXIgc291cmNlTWFwUmVzb2x2ZSA9IHJlcXVpcmUoJ3NvdXJjZS1tYXAtcmVzb2x2ZScpO1xudmFyIHVyaXggPSByZXF1aXJlKCd1cml4Jyk7XG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xudmFyIHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5cbi8qKlxuICogRXhwb3NlIGBtaXhpbigpYC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1peGluO1xuXG4vKipcbiAqIE1peGluIHNvdXJjZSBtYXAgc3VwcG9ydCBpbnRvIGBjb21waWxlcmAuXG4gKlxuICogQHBhcmFtIHtDb21waWxlcn0gY29tcGlsZXJcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbWl4aW4oY29tcGlsZXIpIHtcbiAgY29tcGlsZXIuX2NvbW1lbnQgPSBjb21waWxlci5jb21tZW50O1xuICBjb21waWxlci5tYXAgPSBuZXcgU291cmNlTWFwKCk7XG4gIGNvbXBpbGVyLnBvc2l0aW9uID0geyBsaW5lOiAxLCBjb2x1bW46IDEgfTtcbiAgY29tcGlsZXIuZmlsZXMgPSB7fTtcbiAgZm9yICh2YXIgayBpbiBleHBvcnRzKSBjb21waWxlcltrXSA9IGV4cG9ydHNba107XG59XG5cbi8qKlxuICogVXBkYXRlIHBvc2l0aW9uLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmV4cG9ydHMudXBkYXRlUG9zaXRpb24gPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIGxpbmVzID0gc3RyLm1hdGNoKC9cXG4vZyk7XG4gIGlmIChsaW5lcykgdGhpcy5wb3NpdGlvbi5saW5lICs9IGxpbmVzLmxlbmd0aDtcbiAgdmFyIGkgPSBzdHIubGFzdEluZGV4T2YoJ1xcbicpO1xuICB0aGlzLnBvc2l0aW9uLmNvbHVtbiA9IH5pID8gc3RyLmxlbmd0aCAtIGkgOiB0aGlzLnBvc2l0aW9uLmNvbHVtbiArIHN0ci5sZW5ndGg7XG59O1xuXG4vKipcbiAqIEVtaXQgYHN0cmAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtPYmplY3R9IFtwb3NdXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5leHBvcnRzLmVtaXQgPSBmdW5jdGlvbihzdHIsIHBvcykge1xuICBpZiAocG9zKSB7XG4gICAgdmFyIHNvdXJjZUZpbGUgPSB1cml4KHBvcy5zb3VyY2UgfHwgJ3NvdXJjZS5jc3MnKTtcblxuICAgIHRoaXMubWFwLmFkZE1hcHBpbmcoe1xuICAgICAgc291cmNlOiBzb3VyY2VGaWxlLFxuICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgIGxpbmU6IHRoaXMucG9zaXRpb24ubGluZSxcbiAgICAgICAgY29sdW1uOiBNYXRoLm1heCh0aGlzLnBvc2l0aW9uLmNvbHVtbiAtIDEsIDApXG4gICAgICB9LFxuICAgICAgb3JpZ2luYWw6IHtcbiAgICAgICAgbGluZTogcG9zLnN0YXJ0LmxpbmUsXG4gICAgICAgIGNvbHVtbjogcG9zLnN0YXJ0LmNvbHVtbiAtIDFcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYWRkRmlsZShzb3VyY2VGaWxlLCBwb3MpO1xuICB9XG5cbiAgdGhpcy51cGRhdGVQb3NpdGlvbihzdHIpO1xuXG4gIHJldHVybiBzdHI7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBmaWxlIHRvIHRoZSBzb3VyY2UgbWFwIG91dHB1dCBpZiBpdCBoYXMgbm90IGFscmVhZHkgYmVlbiBhZGRlZFxuICogQHBhcmFtIHtTdHJpbmd9IGZpbGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBwb3NcbiAqL1xuXG5leHBvcnRzLmFkZEZpbGUgPSBmdW5jdGlvbihmaWxlLCBwb3MpIHtcbiAgaWYgKHR5cGVvZiBwb3MuY29udGVudCAhPT0gJ3N0cmluZycpIHJldHVybjtcbiAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLmZpbGVzLCBmaWxlKSkgcmV0dXJuO1xuXG4gIHRoaXMuZmlsZXNbZmlsZV0gPSBwb3MuY29udGVudDtcbn07XG5cbi8qKlxuICogQXBwbGllcyBhbnkgb3JpZ2luYWwgc291cmNlIG1hcHMgdG8gdGhlIG91dHB1dCBhbmQgZW1iZWRzIHRoZSBzb3VyY2UgZmlsZVxuICogY29udGVudHMgaW4gdGhlIHNvdXJjZSBtYXAuXG4gKi9cblxuZXhwb3J0cy5hcHBseVNvdXJjZU1hcHMgPSBmdW5jdGlvbigpIHtcbiAgT2JqZWN0LmtleXModGhpcy5maWxlcykuZm9yRWFjaChmdW5jdGlvbihmaWxlKSB7XG4gICAgdmFyIGNvbnRlbnQgPSB0aGlzLmZpbGVzW2ZpbGVdO1xuICAgIHRoaXMubWFwLnNldFNvdXJjZUNvbnRlbnQoZmlsZSwgY29udGVudCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlucHV0U291cmNlbWFwcyAhPT0gZmFsc2UpIHtcbiAgICAgIHZhciBvcmlnaW5hbE1hcCA9IHNvdXJjZU1hcFJlc29sdmUucmVzb2x2ZVN5bmMoXG4gICAgICAgIGNvbnRlbnQsIGZpbGUsIGZzLnJlYWRGaWxlU3luYyk7XG4gICAgICBpZiAob3JpZ2luYWxNYXApIHtcbiAgICAgICAgdmFyIG1hcCA9IG5ldyBTb3VyY2VNYXBDb25zdW1lcihvcmlnaW5hbE1hcC5tYXApO1xuICAgICAgICB2YXIgcmVsYXRpdmVUbyA9IG9yaWdpbmFsTWFwLnNvdXJjZXNSZWxhdGl2ZVRvO1xuICAgICAgICB0aGlzLm1hcC5hcHBseVNvdXJjZU1hcChtYXAsIGZpbGUsIHVyaXgocGF0aC5kaXJuYW1lKHJlbGF0aXZlVG8pKSk7XG4gICAgICB9XG4gICAgfVxuICB9LCB0aGlzKTtcbn07XG5cbi8qKlxuICogUHJvY2VzcyBjb21tZW50cywgZHJvcHMgc291cmNlTWFwIGNvbW1lbnRzLlxuICogQHBhcmFtIHtPYmplY3R9IG5vZGVcbiAqL1xuXG5leHBvcnRzLmNvbW1lbnQgPSBmdW5jdGlvbihub2RlKSB7XG4gIGlmICgvXiMgc291cmNlTWFwcGluZ1VSTD0vLnRlc3Qobm9kZS5jb21tZW50KSlcbiAgICByZXR1cm4gdGhpcy5lbWl0KCcnLCBub2RlLnBvc2l0aW9uKTtcbiAgZWxzZVxuICAgIHJldHVybiB0aGlzLl9jb21tZW50KG5vZGUpO1xufTtcbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwiLy8gQ29weXJpZ2h0IDIwMTQgU2ltb24gTHlkZWxsXHJcbi8vIFgxMSAo4oCcTUlU4oCdKSBMaWNlbnNlZC4gKFNlZSBMSUNFTlNFLilcclxuXHJcbnZvaWQgKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcclxuICAgIGRlZmluZShmYWN0b3J5KVxyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcclxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpXHJcbiAgfSBlbHNlIHtcclxuICAgIHJvb3QucmVzb2x2ZVVybCA9IGZhY3RvcnkoKVxyXG4gIH1cclxufSh0aGlzLCBmdW5jdGlvbigpIHtcclxuXHJcbiAgZnVuY3Rpb24gcmVzb2x2ZVVybCgvKiAuLi51cmxzICovKSB7XHJcbiAgICB2YXIgbnVtVXJscyA9IGFyZ3VtZW50cy5sZW5ndGhcclxuXHJcbiAgICBpZiAobnVtVXJscyA9PT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZXNvbHZlVXJsIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBhcmd1bWVudDsgZ290IG5vbmUuXCIpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGJhc2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYmFzZVwiKVxyXG4gICAgYmFzZS5ocmVmID0gYXJndW1lbnRzWzBdXHJcblxyXG4gICAgaWYgKG51bVVybHMgPT09IDEpIHtcclxuICAgICAgcmV0dXJuIGJhc2UuaHJlZlxyXG4gICAgfVxyXG5cclxuICAgIHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJoZWFkXCIpWzBdXHJcbiAgICBoZWFkLmluc2VydEJlZm9yZShiYXNlLCBoZWFkLmZpcnN0Q2hpbGQpXHJcblxyXG4gICAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKVxyXG4gICAgdmFyIHJlc29sdmVkXHJcblxyXG4gICAgZm9yICh2YXIgaW5kZXggPSAxOyBpbmRleCA8IG51bVVybHM7IGluZGV4KyspIHtcclxuICAgICAgYS5ocmVmID0gYXJndW1lbnRzW2luZGV4XVxyXG4gICAgICByZXNvbHZlZCA9IGEuaHJlZlxyXG4gICAgICBiYXNlLmhyZWYgPSByZXNvbHZlZFxyXG4gICAgfVxyXG5cclxuICAgIGhlYWQucmVtb3ZlQ2hpbGQoYmFzZSlcclxuXHJcbiAgICByZXR1cm4gcmVzb2x2ZWRcclxuICB9XHJcblxyXG4gIHJldHVybiByZXNvbHZlVXJsXHJcblxyXG59KSk7XHJcbiIsIi8vIENvcHlyaWdodCAyMDE0IFNpbW9uIEx5ZGVsbFxuLy8gWDExICjigJxNSVTigJ0pIExpY2Vuc2VkLiAoU2VlIExJQ0VOU0UuKVxuXG52b2lkIChmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KClcbiAgfSBlbHNlIHtcbiAgICByb290LnNvdXJjZU1hcHBpbmdVUkwgPSBmYWN0b3J5KClcbiAgfVxufSh0aGlzLCBmdW5jdGlvbigpIHtcblxuICB2YXIgaW5uZXJSZWdleCA9IC9bI0BdIHNvdXJjZU1hcHBpbmdVUkw9KFteXFxzJ1wiXSopL1xuXG4gIHZhciByZWdleCA9IFJlZ0V4cChcbiAgICBcIig/OlwiICtcbiAgICAgIFwiL1xcXFwqXCIgK1xuICAgICAgXCIoPzpcXFxccypcXHI/XFxuKD86Ly8pPyk/XCIgK1xuICAgICAgXCIoPzpcIiArIGlubmVyUmVnZXguc291cmNlICsgXCIpXCIgK1xuICAgICAgXCJcXFxccypcIiArXG4gICAgICBcIlxcXFwqL1wiICtcbiAgICAgIFwifFwiICtcbiAgICAgIFwiLy8oPzpcIiArIGlubmVyUmVnZXguc291cmNlICsgXCIpXCIgK1xuICAgIFwiKVwiICtcbiAgICBcIlxcXFxzKiRcIlxuICApXG5cbiAgcmV0dXJuIHtcblxuICAgIHJlZ2V4OiByZWdleCxcbiAgICBfaW5uZXJSZWdleDogaW5uZXJSZWdleCxcblxuICAgIGdldEZyb206IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICAgIHZhciBtYXRjaCA9IGNvZGUubWF0Y2gocmVnZXgpXG4gICAgICByZXR1cm4gKG1hdGNoID8gbWF0Y2hbMV0gfHwgbWF0Y2hbMl0gfHwgXCJcIiA6IG51bGwpXG4gICAgfSxcblxuICAgIGV4aXN0c0luOiBmdW5jdGlvbihjb2RlKSB7XG4gICAgICByZXR1cm4gcmVnZXgudGVzdChjb2RlKVxuICAgIH0sXG5cbiAgICByZW1vdmVGcm9tOiBmdW5jdGlvbihjb2RlKSB7XG4gICAgICByZXR1cm4gY29kZS5yZXBsYWNlKHJlZ2V4LCBcIlwiKVxuICAgIH0sXG5cbiAgICBpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uKGNvZGUsIHN0cmluZykge1xuICAgICAgdmFyIG1hdGNoID0gY29kZS5tYXRjaChyZWdleClcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICByZXR1cm4gY29kZS5zbGljZSgwLCBtYXRjaC5pbmRleCkgKyBzdHJpbmcgKyBjb2RlLnNsaWNlKG1hdGNoLmluZGV4KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvZGUgKyBzdHJpbmdcbiAgICAgIH1cbiAgICB9XG4gIH1cblxufSkpO1xuIiwiLy8gQ29weXJpZ2h0IDIwMTQgU2ltb24gTHlkZWxsXG4vLyBYMTEgKOKAnE1JVOKAnSkgTGljZW5zZWQuIChTZWUgTElDRU5TRS4pXG5cbi8vIE5vdGU6IHNvdXJjZS1tYXAtcmVzb2x2ZS5qcyBpcyBnZW5lcmF0ZWQgZnJvbSBzb3VyY2UtbWFwLXJlc29sdmUtbm9kZS5qcyBhbmRcbi8vIHNvdXJjZS1tYXAtcmVzb2x2ZS10ZW1wbGF0ZS5qcy4gT25seSBlZGl0IHRoZSB0d28gbGF0dGVyIGZpbGVzLCBfbm90X1xuLy8gc291cmNlLW1hcC1yZXNvbHZlLmpzIVxuXG52b2lkIChmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXCJzb3VyY2UtbWFwLXVybFwiLCBcInJlc29sdmUtdXJsXCJdLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7XG4gICAgdmFyIHNvdXJjZU1hcHBpbmdVUkwgPSByZXF1aXJlKFwic291cmNlLW1hcC11cmxcIilcbiAgICB2YXIgcmVzb2x2ZVVybCA9IHJlcXVpcmUoXCJyZXNvbHZlLXVybFwiKVxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShzb3VyY2VNYXBwaW5nVVJMLCByZXNvbHZlVXJsKVxuICB9IGVsc2Uge1xuICAgIHJvb3Quc291cmNlTWFwUmVzb2x2ZSA9IGZhY3Rvcnkocm9vdC5zb3VyY2VNYXBwaW5nVVJMLCByb290LnJlc29sdmVVcmwpXG4gIH1cbn0odGhpcywgZnVuY3Rpb24oc291cmNlTWFwcGluZ1VSTCwgcmVzb2x2ZVVybCkge1xuXG4gIGZ1bmN0aW9uIGNhbGxiYWNrQXN5bmMoY2FsbGJhY2ssIGVycm9yLCByZXN1bHQpIHtcbiAgICBzZXRJbW1lZGlhdGUoZnVuY3Rpb24oKSB7IGNhbGxiYWNrKGVycm9yLCByZXN1bHQpIH0pXG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZU1hcFRvSlNPTihzdHJpbmcpIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShzdHJpbmcucmVwbGFjZSgvXlxcKVxcXVxcfScvLCBcIlwiKSlcbiAgfVxuXG5cblxuICBmdW5jdGlvbiByZXNvbHZlU291cmNlTWFwKGNvZGUsIGNvZGVVcmwsIHJlYWQsIGNhbGxiYWNrKSB7XG4gICAgdmFyIG1hcERhdGFcbiAgICB0cnkge1xuICAgICAgbWFwRGF0YSA9IHJlc29sdmVTb3VyY2VNYXBIZWxwZXIoY29kZSwgY29kZVVybClcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrQXN5bmMoY2FsbGJhY2ssIGVycm9yKVxuICAgIH1cbiAgICBpZiAoIW1hcERhdGEgfHwgbWFwRGF0YS5tYXApIHtcbiAgICAgIHJldHVybiBjYWxsYmFja0FzeW5jKGNhbGxiYWNrLCBudWxsLCBtYXBEYXRhKVxuICAgIH1cbiAgICByZWFkKG1hcERhdGEudXJsLCBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yKVxuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgbWFwRGF0YS5tYXAgPSBwYXJzZU1hcFRvSlNPTihTdHJpbmcocmVzdWx0KSlcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcilcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG51bGwsIG1hcERhdGEpXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVTb3VyY2VNYXBTeW5jKGNvZGUsIGNvZGVVcmwsIHJlYWQpIHtcbiAgICB2YXIgbWFwRGF0YSA9IHJlc29sdmVTb3VyY2VNYXBIZWxwZXIoY29kZSwgY29kZVVybClcbiAgICBpZiAoIW1hcERhdGEgfHwgbWFwRGF0YS5tYXApIHtcbiAgICAgIHJldHVybiBtYXBEYXRhXG4gICAgfVxuICAgIG1hcERhdGEubWFwID0gcGFyc2VNYXBUb0pTT04oU3RyaW5nKHJlYWQobWFwRGF0YS51cmwpKSlcbiAgICByZXR1cm4gbWFwRGF0YVxuICB9XG5cbiAgdmFyIGRhdGFVcmlSZWdleCA9IC9eZGF0YTooW14sO10qKSg7W14sO10qKSooPzosKC4qKSk/JC9cbiAgdmFyIGpzb25NaW1lVHlwZVJlZ2V4ID0gL14oPzphcHBsaWNhdGlvbnx0ZXh0KVxcL2pzb24kL1xuXG4gIGZ1bmN0aW9uIHJlc29sdmVTb3VyY2VNYXBIZWxwZXIoY29kZSwgY29kZVVybCkge1xuICAgIHZhciB1cmwgPSBzb3VyY2VNYXBwaW5nVVJMLmdldEZyb20oY29kZSlcbiAgICBpZiAoIXVybCkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgZGF0YVVyaSA9IHVybC5tYXRjaChkYXRhVXJpUmVnZXgpXG4gICAgaWYgKGRhdGFVcmkpIHtcbiAgICAgIHZhciBtaW1lVHlwZSA9IGRhdGFVcmlbMV1cbiAgICAgIHZhciBsYXN0UGFyYW1ldGVyID0gZGF0YVVyaVsyXVxuICAgICAgdmFyIGVuY29kZWQgPSBkYXRhVXJpWzNdXG4gICAgICBpZiAoIWpzb25NaW1lVHlwZVJlZ2V4LnRlc3QobWltZVR5cGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVudXNlZnVsIGRhdGEgdXJpIG1pbWUgdHlwZTogXCIgKyAobWltZVR5cGUgfHwgXCJ0ZXh0L3BsYWluXCIpKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlTWFwcGluZ1VSTDogdXJsLFxuICAgICAgICB1cmw6IG51bGwsXG4gICAgICAgIHNvdXJjZXNSZWxhdGl2ZVRvOiBjb2RlVXJsLFxuICAgICAgICBtYXA6IHBhcnNlTWFwVG9KU09OKGxhc3RQYXJhbWV0ZXIgPT09IFwiO2Jhc2U2NFwiID8gYXRvYihlbmNvZGVkKSA6IGRlY29kZVVSSUNvbXBvbmVudChlbmNvZGVkKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbWFwVXJsID0gcmVzb2x2ZVVybChjb2RlVXJsLCB1cmwpXG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZU1hcHBpbmdVUkw6IHVybCxcbiAgICAgIHVybDogbWFwVXJsLFxuICAgICAgc291cmNlc1JlbGF0aXZlVG86IG1hcFVybCxcbiAgICAgIG1hcDogbnVsbFxuICAgIH1cbiAgfVxuXG5cblxuICBmdW5jdGlvbiByZXNvbHZlU291cmNlcyhtYXAsIG1hcFVybCwgcmVhZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gICAgICBvcHRpb25zID0ge31cbiAgICB9XG4gICAgdmFyIHBlbmRpbmcgPSBtYXAuc291cmNlcy5sZW5ndGhcbiAgICB2YXIgZXJyb3JlZCA9IGZhbHNlXG4gICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgIHNvdXJjZXNSZXNvbHZlZDogW10sXG4gICAgICBzb3VyY2VzQ29udGVudDogIFtdXG4gICAgfVxuXG4gICAgdmFyIGRvbmUgPSBmdW5jdGlvbihlcnJvcikge1xuICAgICAgaWYgKGVycm9yZWQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgZXJyb3JlZCA9IHRydWVcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yKVxuICAgICAgfVxuICAgICAgcGVuZGluZy0tXG4gICAgICBpZiAocGVuZGluZyA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVzb2x2ZVNvdXJjZXNIZWxwZXIobWFwLCBtYXBVcmwsIG9wdGlvbnMsIGZ1bmN0aW9uKGZ1bGxVcmwsIHNvdXJjZUNvbnRlbnQsIGluZGV4KSB7XG4gICAgICByZXN1bHQuc291cmNlc1Jlc29sdmVkW2luZGV4XSA9IGZ1bGxVcmxcbiAgICAgIGlmICh0eXBlb2Ygc291cmNlQ29udGVudCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICByZXN1bHQuc291cmNlc0NvbnRlbnRbaW5kZXhdID0gc291cmNlQ29udGVudFxuICAgICAgICBjYWxsYmFja0FzeW5jKGRvbmUsIG51bGwpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWFkKGZ1bGxVcmwsIGZ1bmN0aW9uKGVycm9yLCBzb3VyY2UpIHtcbiAgICAgICAgICByZXN1bHQuc291cmNlc0NvbnRlbnRbaW5kZXhdID0gU3RyaW5nKHNvdXJjZSlcbiAgICAgICAgICBkb25lKGVycm9yKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlU291cmNlc1N5bmMobWFwLCBtYXBVcmwsIHJlYWQsIG9wdGlvbnMpIHtcbiAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgc291cmNlc1Jlc29sdmVkOiBbXSxcbiAgICAgIHNvdXJjZXNDb250ZW50OiAgW11cbiAgICB9XG4gICAgcmVzb2x2ZVNvdXJjZXNIZWxwZXIobWFwLCBtYXBVcmwsIG9wdGlvbnMsIGZ1bmN0aW9uKGZ1bGxVcmwsIHNvdXJjZUNvbnRlbnQsIGluZGV4KSB7XG4gICAgICByZXN1bHQuc291cmNlc1Jlc29sdmVkW2luZGV4XSA9IGZ1bGxVcmxcbiAgICAgIGlmIChyZWFkICE9PSBudWxsKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc291cmNlQ29udGVudCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIHJlc3VsdC5zb3VyY2VzQ29udGVudFtpbmRleF0gPSBzb3VyY2VDb250ZW50XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0LnNvdXJjZXNDb250ZW50W2luZGV4XSA9IFN0cmluZyhyZWFkKGZ1bGxVcmwpKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICB2YXIgZW5kaW5nU2xhc2ggPSAvXFwvPyQvXG5cbiAgZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZXNIZWxwZXIobWFwLCBtYXBVcmwsIG9wdGlvbnMsIGZuKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgZnVsbFVybFxuICAgIHZhciBzb3VyY2VDb250ZW50XG4gICAgZm9yICh2YXIgaW5kZXggPSAwLCBsZW4gPSBtYXAuc291cmNlcy5sZW5ndGg7IGluZGV4IDwgbGVuOyBpbmRleCsrKSB7XG4gICAgICBpZiAobWFwLnNvdXJjZVJvb3QgJiYgIW9wdGlvbnMuaWdub3JlU291cmNlUm9vdCkge1xuICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgc291cmNlUm9vdCBlbmRzIHdpdGggYSBzbGFzaCwgc28gdGhhdCBgL3NjcmlwdHMvc3ViZGlyYCBiZWNvbWVzXG4gICAgICAgIC8vIGAvc2NyaXB0cy9zdWJkaXIvPHNvdXJjZT5gLCBub3QgYC9zY3JpcHRzLzxzb3VyY2U+YC4gUG9pbnRpbmcgdG8gYSBmaWxlIGFzIHNvdXJjZSByb290XG4gICAgICAgIC8vIGRvZXMgbm90IG1ha2Ugc2Vuc2UuXG4gICAgICAgIGZ1bGxVcmwgPSByZXNvbHZlVXJsKG1hcFVybCwgbWFwLnNvdXJjZVJvb3QucmVwbGFjZShlbmRpbmdTbGFzaCwgXCIvXCIpLCBtYXAuc291cmNlc1tpbmRleF0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdWxsVXJsID0gcmVzb2x2ZVVybChtYXBVcmwsIG1hcC5zb3VyY2VzW2luZGV4XSlcbiAgICAgIH1cbiAgICAgIHNvdXJjZUNvbnRlbnQgPSAobWFwLnNvdXJjZXNDb250ZW50IHx8IFtdKVtpbmRleF1cbiAgICAgIGZuKGZ1bGxVcmwsIHNvdXJjZUNvbnRlbnQsIGluZGV4KVxuICAgIH1cbiAgfVxuXG5cblxuICBmdW5jdGlvbiByZXNvbHZlKGNvZGUsIGNvZGVVcmwsIHJlYWQsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9uc1xuICAgICAgb3B0aW9ucyA9IHt9XG4gICAgfVxuICAgIHJlc29sdmVTb3VyY2VNYXAoY29kZSwgY29kZVVybCwgcmVhZCwgZnVuY3Rpb24oZXJyb3IsIG1hcERhdGEpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpXG4gICAgICB9XG4gICAgICBpZiAoIW1hcERhdGEpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIG51bGwpXG4gICAgICB9XG4gICAgICByZXNvbHZlU291cmNlcyhtYXBEYXRhLm1hcCwgbWFwRGF0YS5zb3VyY2VzUmVsYXRpdmVUbywgcmVhZCwgb3B0aW9ucywgZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpXG4gICAgICAgIH1cbiAgICAgICAgbWFwRGF0YS5zb3VyY2VzUmVzb2x2ZWQgPSByZXN1bHQuc291cmNlc1Jlc29sdmVkXG4gICAgICAgIG1hcERhdGEuc291cmNlc0NvbnRlbnQgID0gcmVzdWx0LnNvdXJjZXNDb250ZW50XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG1hcERhdGEpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlU3luYyhjb2RlLCBjb2RlVXJsLCByZWFkLCBvcHRpb25zKSB7XG4gICAgdmFyIG1hcERhdGEgPSByZXNvbHZlU291cmNlTWFwU3luYyhjb2RlLCBjb2RlVXJsLCByZWFkKVxuICAgIGlmICghbWFwRGF0YSkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHJlc29sdmVTb3VyY2VzU3luYyhtYXBEYXRhLm1hcCwgbWFwRGF0YS5zb3VyY2VzUmVsYXRpdmVUbywgcmVhZCwgb3B0aW9ucylcbiAgICBtYXBEYXRhLnNvdXJjZXNSZXNvbHZlZCA9IHJlc3VsdC5zb3VyY2VzUmVzb2x2ZWRcbiAgICBtYXBEYXRhLnNvdXJjZXNDb250ZW50ICA9IHJlc3VsdC5zb3VyY2VzQ29udGVudFxuICAgIHJldHVybiBtYXBEYXRhXG4gIH1cblxuXG5cbiAgcmV0dXJuIHtcbiAgICByZXNvbHZlU291cmNlTWFwOiAgICAgcmVzb2x2ZVNvdXJjZU1hcCxcbiAgICByZXNvbHZlU291cmNlTWFwU3luYzogcmVzb2x2ZVNvdXJjZU1hcFN5bmMsXG4gICAgcmVzb2x2ZVNvdXJjZXM6ICAgICAgIHJlc29sdmVTb3VyY2VzLFxuICAgIHJlc29sdmVTb3VyY2VzU3luYzogICByZXNvbHZlU291cmNlc1N5bmMsXG4gICAgcmVzb2x2ZTogICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgcmVzb2x2ZVN5bmM6ICAgICAgICAgIHJlc29sdmVTeW5jXG4gIH1cblxufSkpO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDA5LTIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFLnR4dCBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuZXhwb3J0cy5Tb3VyY2VNYXBHZW5lcmF0b3IgPSByZXF1aXJlKCcuL3NvdXJjZS1tYXAvc291cmNlLW1hcC1nZW5lcmF0b3InKS5Tb3VyY2VNYXBHZW5lcmF0b3I7XG5leHBvcnRzLlNvdXJjZU1hcENvbnN1bWVyID0gcmVxdWlyZSgnLi9zb3VyY2UtbWFwL3NvdXJjZS1tYXAtY29uc3VtZXInKS5Tb3VyY2VNYXBDb25zdW1lcjtcbmV4cG9ydHMuU291cmNlTm9kZSA9IHJlcXVpcmUoJy4vc291cmNlLW1hcC9zb3VyY2Utbm9kZScpLlNvdXJjZU5vZGU7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbiAgLyoqXG4gICAqIEEgZGF0YSBzdHJ1Y3R1cmUgd2hpY2ggaXMgYSBjb21iaW5hdGlvbiBvZiBhbiBhcnJheSBhbmQgYSBzZXQuIEFkZGluZyBhIG5ld1xuICAgKiBtZW1iZXIgaXMgTygxKSwgdGVzdGluZyBmb3IgbWVtYmVyc2hpcCBpcyBPKDEpLCBhbmQgZmluZGluZyB0aGUgaW5kZXggb2YgYW5cbiAgICogZWxlbWVudCBpcyBPKDEpLiBSZW1vdmluZyBlbGVtZW50cyBmcm9tIHRoZSBzZXQgaXMgbm90IHN1cHBvcnRlZC4gT25seVxuICAgKiBzdHJpbmdzIGFyZSBzdXBwb3J0ZWQgZm9yIG1lbWJlcnNoaXAuXG4gICAqL1xuICBmdW5jdGlvbiBBcnJheVNldCgpIHtcbiAgICB0aGlzLl9hcnJheSA9IFtdO1xuICAgIHRoaXMuX3NldCA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXRpYyBtZXRob2QgZm9yIGNyZWF0aW5nIEFycmF5U2V0IGluc3RhbmNlcyBmcm9tIGFuIGV4aXN0aW5nIGFycmF5LlxuICAgKi9cbiAgQXJyYXlTZXQuZnJvbUFycmF5ID0gZnVuY3Rpb24gQXJyYXlTZXRfZnJvbUFycmF5KGFBcnJheSwgYUFsbG93RHVwbGljYXRlcykge1xuICAgIHZhciBzZXQgPSBuZXcgQXJyYXlTZXQoKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYUFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBzZXQuYWRkKGFBcnJheVtpXSwgYUFsbG93RHVwbGljYXRlcyk7XG4gICAgfVxuICAgIHJldHVybiBzZXQ7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkZCB0aGUgZ2l2ZW4gc3RyaW5nIHRvIHRoaXMgc2V0LlxuICAgKlxuICAgKiBAcGFyYW0gU3RyaW5nIGFTdHJcbiAgICovXG4gIEFycmF5U2V0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiBBcnJheVNldF9hZGQoYVN0ciwgYUFsbG93RHVwbGljYXRlcykge1xuICAgIHZhciBpc0R1cGxpY2F0ZSA9IHRoaXMuaGFzKGFTdHIpO1xuICAgIHZhciBpZHggPSB0aGlzLl9hcnJheS5sZW5ndGg7XG4gICAgaWYgKCFpc0R1cGxpY2F0ZSB8fCBhQWxsb3dEdXBsaWNhdGVzKSB7XG4gICAgICB0aGlzLl9hcnJheS5wdXNoKGFTdHIpO1xuICAgIH1cbiAgICBpZiAoIWlzRHVwbGljYXRlKSB7XG4gICAgICB0aGlzLl9zZXRbdXRpbC50b1NldFN0cmluZyhhU3RyKV0gPSBpZHg7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBJcyB0aGUgZ2l2ZW4gc3RyaW5nIGEgbWVtYmVyIG9mIHRoaXMgc2V0P1xuICAgKlxuICAgKiBAcGFyYW0gU3RyaW5nIGFTdHJcbiAgICovXG4gIEFycmF5U2V0LnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbiBBcnJheVNldF9oYXMoYVN0cikge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5fc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXRpbC50b1NldFN0cmluZyhhU3RyKSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFdoYXQgaXMgdGhlIGluZGV4IG9mIHRoZSBnaXZlbiBzdHJpbmcgaW4gdGhlIGFycmF5P1xuICAgKlxuICAgKiBAcGFyYW0gU3RyaW5nIGFTdHJcbiAgICovXG4gIEFycmF5U2V0LnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gQXJyYXlTZXRfaW5kZXhPZihhU3RyKSB7XG4gICAgaWYgKHRoaXMuaGFzKGFTdHIpKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc2V0W3V0aWwudG9TZXRTdHJpbmcoYVN0cildO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1wiJyArIGFTdHIgKyAnXCIgaXMgbm90IGluIHRoZSBzZXQuJyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFdoYXQgaXMgdGhlIGVsZW1lbnQgYXQgdGhlIGdpdmVuIGluZGV4P1xuICAgKlxuICAgKiBAcGFyYW0gTnVtYmVyIGFJZHhcbiAgICovXG4gIEFycmF5U2V0LnByb3RvdHlwZS5hdCA9IGZ1bmN0aW9uIEFycmF5U2V0X2F0KGFJZHgpIHtcbiAgICBpZiAoYUlkeCA+PSAwICYmIGFJZHggPCB0aGlzLl9hcnJheS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hcnJheVthSWR4XTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKCdObyBlbGVtZW50IGluZGV4ZWQgYnkgJyArIGFJZHgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhcnJheSByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHNldCAod2hpY2ggaGFzIHRoZSBwcm9wZXIgaW5kaWNlc1xuICAgKiBpbmRpY2F0ZWQgYnkgaW5kZXhPZikuIE5vdGUgdGhhdCB0aGlzIGlzIGEgY29weSBvZiB0aGUgaW50ZXJuYWwgYXJyYXkgdXNlZFxuICAgKiBmb3Igc3RvcmluZyB0aGUgbWVtYmVycyBzbyB0aGF0IG5vIG9uZSBjYW4gbWVzcyB3aXRoIGludGVybmFsIHN0YXRlLlxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLnRvQXJyYXkgPSBmdW5jdGlvbiBBcnJheVNldF90b0FycmF5KCkge1xuICAgIHJldHVybiB0aGlzLl9hcnJheS5zbGljZSgpO1xuICB9O1xuXG4gIGV4cG9ydHMuQXJyYXlTZXQgPSBBcnJheVNldDtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICpcbiAqIEJhc2VkIG9uIHRoZSBCYXNlIDY0IFZMUSBpbXBsZW1lbnRhdGlvbiBpbiBDbG9zdXJlIENvbXBpbGVyOlxuICogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jbG9zdXJlLWNvbXBpbGVyL3NvdXJjZS9icm93c2UvdHJ1bmsvc3JjL2NvbS9nb29nbGUvZGVidWdnaW5nL3NvdXJjZW1hcC9CYXNlNjRWTFEuamF2YVxuICpcbiAqIENvcHlyaWdodCAyMDExIFRoZSBDbG9zdXJlIENvbXBpbGVyIEF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAgKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICogICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICogICogTmVpdGhlciB0aGUgbmFtZSBvZiBHb29nbGUgSW5jLiBub3IgdGhlIG5hbWVzIG9mIGl0c1xuICogICAgY29udHJpYnV0b3JzIG1heSBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0cyBkZXJpdmVkXG4gKiAgICBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SU1xuICogXCJBUyBJU1wiIEFORCBBTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVFxuICogTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SXG4gKiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVFxuICogT1dORVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsXG4gKiBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gKiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSxcbiAqIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWVxuICogVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVFxuICogKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFXG4gKiBPRiBUSElTIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciBiYXNlNjQgPSByZXF1aXJlKCcuL2Jhc2U2NCcpO1xuXG4gIC8vIEEgc2luZ2xlIGJhc2UgNjQgZGlnaXQgY2FuIGNvbnRhaW4gNiBiaXRzIG9mIGRhdGEuIEZvciB0aGUgYmFzZSA2NCB2YXJpYWJsZVxuICAvLyBsZW5ndGggcXVhbnRpdGllcyB3ZSB1c2UgaW4gdGhlIHNvdXJjZSBtYXAgc3BlYywgdGhlIGZpcnN0IGJpdCBpcyB0aGUgc2lnbixcbiAgLy8gdGhlIG5leHQgZm91ciBiaXRzIGFyZSB0aGUgYWN0dWFsIHZhbHVlLCBhbmQgdGhlIDZ0aCBiaXQgaXMgdGhlXG4gIC8vIGNvbnRpbnVhdGlvbiBiaXQuIFRoZSBjb250aW51YXRpb24gYml0IHRlbGxzIHVzIHdoZXRoZXIgdGhlcmUgYXJlIG1vcmVcbiAgLy8gZGlnaXRzIGluIHRoaXMgdmFsdWUgZm9sbG93aW5nIHRoaXMgZGlnaXQuXG4gIC8vXG4gIC8vICAgQ29udGludWF0aW9uXG4gIC8vICAgfCAgICBTaWduXG4gIC8vICAgfCAgICB8XG4gIC8vICAgViAgICBWXG4gIC8vICAgMTAxMDExXG5cbiAgdmFyIFZMUV9CQVNFX1NISUZUID0gNTtcblxuICAvLyBiaW5hcnk6IDEwMDAwMFxuICB2YXIgVkxRX0JBU0UgPSAxIDw8IFZMUV9CQVNFX1NISUZUO1xuXG4gIC8vIGJpbmFyeTogMDExMTExXG4gIHZhciBWTFFfQkFTRV9NQVNLID0gVkxRX0JBU0UgLSAxO1xuXG4gIC8vIGJpbmFyeTogMTAwMDAwXG4gIHZhciBWTFFfQ09OVElOVUFUSU9OX0JJVCA9IFZMUV9CQVNFO1xuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyBmcm9tIGEgdHdvLWNvbXBsZW1lbnQgdmFsdWUgdG8gYSB2YWx1ZSB3aGVyZSB0aGUgc2lnbiBiaXQgaXNcbiAgICogcGxhY2VkIGluIHRoZSBsZWFzdCBzaWduaWZpY2FudCBiaXQuICBGb3IgZXhhbXBsZSwgYXMgZGVjaW1hbHM6XG4gICAqICAgMSBiZWNvbWVzIDIgKDEwIGJpbmFyeSksIC0xIGJlY29tZXMgMyAoMTEgYmluYXJ5KVxuICAgKiAgIDIgYmVjb21lcyA0ICgxMDAgYmluYXJ5KSwgLTIgYmVjb21lcyA1ICgxMDEgYmluYXJ5KVxuICAgKi9cbiAgZnVuY3Rpb24gdG9WTFFTaWduZWQoYVZhbHVlKSB7XG4gICAgcmV0dXJuIGFWYWx1ZSA8IDBcbiAgICAgID8gKCgtYVZhbHVlKSA8PCAxKSArIDFcbiAgICAgIDogKGFWYWx1ZSA8PCAxKSArIDA7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdG8gYSB0d28tY29tcGxlbWVudCB2YWx1ZSBmcm9tIGEgdmFsdWUgd2hlcmUgdGhlIHNpZ24gYml0IGlzXG4gICAqIHBsYWNlZCBpbiB0aGUgbGVhc3Qgc2lnbmlmaWNhbnQgYml0LiAgRm9yIGV4YW1wbGUsIGFzIGRlY2ltYWxzOlxuICAgKiAgIDIgKDEwIGJpbmFyeSkgYmVjb21lcyAxLCAzICgxMSBiaW5hcnkpIGJlY29tZXMgLTFcbiAgICogICA0ICgxMDAgYmluYXJ5KSBiZWNvbWVzIDIsIDUgKDEwMSBiaW5hcnkpIGJlY29tZXMgLTJcbiAgICovXG4gIGZ1bmN0aW9uIGZyb21WTFFTaWduZWQoYVZhbHVlKSB7XG4gICAgdmFyIGlzTmVnYXRpdmUgPSAoYVZhbHVlICYgMSkgPT09IDE7XG4gICAgdmFyIHNoaWZ0ZWQgPSBhVmFsdWUgPj4gMTtcbiAgICByZXR1cm4gaXNOZWdhdGl2ZVxuICAgICAgPyAtc2hpZnRlZFxuICAgICAgOiBzaGlmdGVkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJhc2UgNjQgVkxRIGVuY29kZWQgdmFsdWUuXG4gICAqL1xuICBleHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uIGJhc2U2NFZMUV9lbmNvZGUoYVZhbHVlKSB7XG4gICAgdmFyIGVuY29kZWQgPSBcIlwiO1xuICAgIHZhciBkaWdpdDtcblxuICAgIHZhciB2bHEgPSB0b1ZMUVNpZ25lZChhVmFsdWUpO1xuXG4gICAgZG8ge1xuICAgICAgZGlnaXQgPSB2bHEgJiBWTFFfQkFTRV9NQVNLO1xuICAgICAgdmxxID4+Pj0gVkxRX0JBU0VfU0hJRlQ7XG4gICAgICBpZiAodmxxID4gMCkge1xuICAgICAgICAvLyBUaGVyZSBhcmUgc3RpbGwgbW9yZSBkaWdpdHMgaW4gdGhpcyB2YWx1ZSwgc28gd2UgbXVzdCBtYWtlIHN1cmUgdGhlXG4gICAgICAgIC8vIGNvbnRpbnVhdGlvbiBiaXQgaXMgbWFya2VkLlxuICAgICAgICBkaWdpdCB8PSBWTFFfQ09OVElOVUFUSU9OX0JJVDtcbiAgICAgIH1cbiAgICAgIGVuY29kZWQgKz0gYmFzZTY0LmVuY29kZShkaWdpdCk7XG4gICAgfSB3aGlsZSAodmxxID4gMCk7XG5cbiAgICByZXR1cm4gZW5jb2RlZDtcbiAgfTtcblxuICAvKipcbiAgICogRGVjb2RlcyB0aGUgbmV4dCBiYXNlIDY0IFZMUSB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBzdHJpbmcgYW5kIHJldHVybnMgdGhlXG4gICAqIHZhbHVlIGFuZCB0aGUgcmVzdCBvZiB0aGUgc3RyaW5nIHZpYSB0aGUgb3V0IHBhcmFtZXRlci5cbiAgICovXG4gIGV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24gYmFzZTY0VkxRX2RlY29kZShhU3RyLCBhT3V0UGFyYW0pIHtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIHN0ckxlbiA9IGFTdHIubGVuZ3RoO1xuICAgIHZhciByZXN1bHQgPSAwO1xuICAgIHZhciBzaGlmdCA9IDA7XG4gICAgdmFyIGNvbnRpbnVhdGlvbiwgZGlnaXQ7XG5cbiAgICBkbyB7XG4gICAgICBpZiAoaSA+PSBzdHJMZW4pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgbW9yZSBkaWdpdHMgaW4gYmFzZSA2NCBWTFEgdmFsdWUuXCIpO1xuICAgICAgfVxuICAgICAgZGlnaXQgPSBiYXNlNjQuZGVjb2RlKGFTdHIuY2hhckF0KGkrKykpO1xuICAgICAgY29udGludWF0aW9uID0gISEoZGlnaXQgJiBWTFFfQ09OVElOVUFUSU9OX0JJVCk7XG4gICAgICBkaWdpdCAmPSBWTFFfQkFTRV9NQVNLO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0ICsgKGRpZ2l0IDw8IHNoaWZ0KTtcbiAgICAgIHNoaWZ0ICs9IFZMUV9CQVNFX1NISUZUO1xuICAgIH0gd2hpbGUgKGNvbnRpbnVhdGlvbik7XG5cbiAgICBhT3V0UGFyYW0udmFsdWUgPSBmcm9tVkxRU2lnbmVkKHJlc3VsdCk7XG4gICAgYU91dFBhcmFtLnJlc3QgPSBhU3RyLnNsaWNlKGkpO1xuICB9O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIGNoYXJUb0ludE1hcCA9IHt9O1xuICB2YXIgaW50VG9DaGFyTWFwID0ge307XG5cbiAgJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG4gICAgLnNwbGl0KCcnKVxuICAgIC5mb3JFYWNoKGZ1bmN0aW9uIChjaCwgaW5kZXgpIHtcbiAgICAgIGNoYXJUb0ludE1hcFtjaF0gPSBpbmRleDtcbiAgICAgIGludFRvQ2hhck1hcFtpbmRleF0gPSBjaDtcbiAgICB9KTtcblxuICAvKipcbiAgICogRW5jb2RlIGFuIGludGVnZXIgaW4gdGhlIHJhbmdlIG9mIDAgdG8gNjMgdG8gYSBzaW5nbGUgYmFzZSA2NCBkaWdpdC5cbiAgICovXG4gIGV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gYmFzZTY0X2VuY29kZShhTnVtYmVyKSB7XG4gICAgaWYgKGFOdW1iZXIgaW4gaW50VG9DaGFyTWFwKSB7XG4gICAgICByZXR1cm4gaW50VG9DaGFyTWFwW2FOdW1iZXJdO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDYzOiBcIiArIGFOdW1iZXIpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZWNvZGUgYSBzaW5nbGUgYmFzZSA2NCBkaWdpdCB0byBhbiBpbnRlZ2VyLlxuICAgKi9cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiBiYXNlNjRfZGVjb2RlKGFDaGFyKSB7XG4gICAgaWYgKGFDaGFyIGluIGNoYXJUb0ludE1hcCkge1xuICAgICAgcmV0dXJuIGNoYXJUb0ludE1hcFthQ2hhcl07XG4gICAgfVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJOb3QgYSB2YWxpZCBiYXNlIDY0IGRpZ2l0OiBcIiArIGFDaGFyKTtcbiAgfTtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIC8qKlxuICAgKiBSZWN1cnNpdmUgaW1wbGVtZW50YXRpb24gb2YgYmluYXJ5IHNlYXJjaC5cbiAgICpcbiAgICogQHBhcmFtIGFMb3cgSW5kaWNlcyBoZXJlIGFuZCBsb3dlciBkbyBub3QgY29udGFpbiB0aGUgbmVlZGxlLlxuICAgKiBAcGFyYW0gYUhpZ2ggSW5kaWNlcyBoZXJlIGFuZCBoaWdoZXIgZG8gbm90IGNvbnRhaW4gdGhlIG5lZWRsZS5cbiAgICogQHBhcmFtIGFOZWVkbGUgVGhlIGVsZW1lbnQgYmVpbmcgc2VhcmNoZWQgZm9yLlxuICAgKiBAcGFyYW0gYUhheXN0YWNrIFRoZSBub24tZW1wdHkgYXJyYXkgYmVpbmcgc2VhcmNoZWQuXG4gICAqIEBwYXJhbSBhQ29tcGFyZSBGdW5jdGlvbiB3aGljaCB0YWtlcyB0d28gZWxlbWVudHMgYW5kIHJldHVybnMgLTEsIDAsIG9yIDEuXG4gICAqL1xuICBmdW5jdGlvbiByZWN1cnNpdmVTZWFyY2goYUxvdywgYUhpZ2gsIGFOZWVkbGUsIGFIYXlzdGFjaywgYUNvbXBhcmUpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHRlcm1pbmF0ZXMgd2hlbiBvbmUgb2YgdGhlIGZvbGxvd2luZyBpcyB0cnVlOlxuICAgIC8vXG4gICAgLy8gICAxLiBXZSBmaW5kIHRoZSBleGFjdCBlbGVtZW50IHdlIGFyZSBsb29raW5nIGZvci5cbiAgICAvL1xuICAgIC8vICAgMi4gV2UgZGlkIG5vdCBmaW5kIHRoZSBleGFjdCBlbGVtZW50LCBidXQgd2UgY2FuIHJldHVybiB0aGUgaW5kZXggb2ZcbiAgICAvLyAgICAgIHRoZSBuZXh0IGNsb3Nlc3QgZWxlbWVudCB0aGF0IGlzIGxlc3MgdGhhbiB0aGF0IGVsZW1lbnQuXG4gICAgLy9cbiAgICAvLyAgIDMuIFdlIGRpZCBub3QgZmluZCB0aGUgZXhhY3QgZWxlbWVudCwgYW5kIHRoZXJlIGlzIG5vIG5leHQtY2xvc2VzdFxuICAgIC8vICAgICAgZWxlbWVudCB3aGljaCBpcyBsZXNzIHRoYW4gdGhlIG9uZSB3ZSBhcmUgc2VhcmNoaW5nIGZvciwgc28gd2VcbiAgICAvLyAgICAgIHJldHVybiAtMS5cbiAgICB2YXIgbWlkID0gTWF0aC5mbG9vcigoYUhpZ2ggLSBhTG93KSAvIDIpICsgYUxvdztcbiAgICB2YXIgY21wID0gYUNvbXBhcmUoYU5lZWRsZSwgYUhheXN0YWNrW21pZF0sIHRydWUpO1xuICAgIGlmIChjbXAgPT09IDApIHtcbiAgICAgIC8vIEZvdW5kIHRoZSBlbGVtZW50IHdlIGFyZSBsb29raW5nIGZvci5cbiAgICAgIHJldHVybiBtaWQ7XG4gICAgfVxuICAgIGVsc2UgaWYgKGNtcCA+IDApIHtcbiAgICAgIC8vIGFIYXlzdGFja1ttaWRdIGlzIGdyZWF0ZXIgdGhhbiBvdXIgbmVlZGxlLlxuICAgICAgaWYgKGFIaWdoIC0gbWlkID4gMSkge1xuICAgICAgICAvLyBUaGUgZWxlbWVudCBpcyBpbiB0aGUgdXBwZXIgaGFsZi5cbiAgICAgICAgcmV0dXJuIHJlY3Vyc2l2ZVNlYXJjaChtaWQsIGFIaWdoLCBhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlKTtcbiAgICAgIH1cbiAgICAgIC8vIFdlIGRpZCBub3QgZmluZCBhbiBleGFjdCBtYXRjaCwgcmV0dXJuIHRoZSBuZXh0IGNsb3Nlc3Qgb25lXG4gICAgICAvLyAodGVybWluYXRpb24gY2FzZSAyKS5cbiAgICAgIHJldHVybiBtaWQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgLy8gYUhheXN0YWNrW21pZF0gaXMgbGVzcyB0aGFuIG91ciBuZWVkbGUuXG4gICAgICBpZiAobWlkIC0gYUxvdyA+IDEpIHtcbiAgICAgICAgLy8gVGhlIGVsZW1lbnQgaXMgaW4gdGhlIGxvd2VyIGhhbGYuXG4gICAgICAgIHJldHVybiByZWN1cnNpdmVTZWFyY2goYUxvdywgbWlkLCBhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlKTtcbiAgICAgIH1cbiAgICAgIC8vIFRoZSBleGFjdCBuZWVkbGUgZWxlbWVudCB3YXMgbm90IGZvdW5kIGluIHRoaXMgaGF5c3RhY2suIERldGVybWluZSBpZlxuICAgICAgLy8gd2UgYXJlIGluIHRlcm1pbmF0aW9uIGNhc2UgKDIpIG9yICgzKSBhbmQgcmV0dXJuIHRoZSBhcHByb3ByaWF0ZSB0aGluZy5cbiAgICAgIHJldHVybiBhTG93IDwgMCA/IC0xIDogYUxvdztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBpcyBhbiBpbXBsZW1lbnRhdGlvbiBvZiBiaW5hcnkgc2VhcmNoIHdoaWNoIHdpbGwgYWx3YXlzIHRyeSBhbmQgcmV0dXJuXG4gICAqIHRoZSBpbmRleCBvZiBuZXh0IGxvd2VzdCB2YWx1ZSBjaGVja2VkIGlmIHRoZXJlIGlzIG5vIGV4YWN0IGhpdC4gVGhpcyBpc1xuICAgKiBiZWNhdXNlIG1hcHBpbmdzIGJldHdlZW4gb3JpZ2luYWwgYW5kIGdlbmVyYXRlZCBsaW5lL2NvbCBwYWlycyBhcmUgc2luZ2xlXG4gICAqIHBvaW50cywgYW5kIHRoZXJlIGlzIGFuIGltcGxpY2l0IHJlZ2lvbiBiZXR3ZWVuIGVhY2ggb2YgdGhlbSwgc28gYSBtaXNzXG4gICAqIGp1c3QgbWVhbnMgdGhhdCB5b3UgYXJlbid0IG9uIHRoZSB2ZXJ5IHN0YXJ0IG9mIGEgcmVnaW9uLlxuICAgKlxuICAgKiBAcGFyYW0gYU5lZWRsZSBUaGUgZWxlbWVudCB5b3UgYXJlIGxvb2tpbmcgZm9yLlxuICAgKiBAcGFyYW0gYUhheXN0YWNrIFRoZSBhcnJheSB0aGF0IGlzIGJlaW5nIHNlYXJjaGVkLlxuICAgKiBAcGFyYW0gYUNvbXBhcmUgQSBmdW5jdGlvbiB3aGljaCB0YWtlcyB0aGUgbmVlZGxlIGFuZCBhbiBlbGVtZW50IGluIHRoZVxuICAgKiAgICAgYXJyYXkgYW5kIHJldHVybnMgLTEsIDAsIG9yIDEgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlIG5lZWRsZSBpcyBsZXNzXG4gICAqICAgICB0aGFuLCBlcXVhbCB0bywgb3IgZ3JlYXRlciB0aGFuIHRoZSBlbGVtZW50LCByZXNwZWN0aXZlbHkuXG4gICAqL1xuICBleHBvcnRzLnNlYXJjaCA9IGZ1bmN0aW9uIHNlYXJjaChhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlKSB7XG4gICAgaWYgKGFIYXlzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gICAgcmV0dXJuIHJlY3Vyc2l2ZVNlYXJjaCgtMSwgYUhheXN0YWNrLmxlbmd0aCwgYU5lZWRsZSwgYUhheXN0YWNrLCBhQ29tcGFyZSlcbiAgfTtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTQgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbiAgLyoqXG4gICAqIERldGVybWluZSB3aGV0aGVyIG1hcHBpbmdCIGlzIGFmdGVyIG1hcHBpbmdBIHdpdGggcmVzcGVjdCB0byBnZW5lcmF0ZWRcbiAgICogcG9zaXRpb24uXG4gICAqL1xuICBmdW5jdGlvbiBnZW5lcmF0ZWRQb3NpdGlvbkFmdGVyKG1hcHBpbmdBLCBtYXBwaW5nQikge1xuICAgIC8vIE9wdGltaXplZCBmb3IgbW9zdCBjb21tb24gY2FzZVxuICAgIHZhciBsaW5lQSA9IG1hcHBpbmdBLmdlbmVyYXRlZExpbmU7XG4gICAgdmFyIGxpbmVCID0gbWFwcGluZ0IuZ2VuZXJhdGVkTGluZTtcbiAgICB2YXIgY29sdW1uQSA9IG1hcHBpbmdBLmdlbmVyYXRlZENvbHVtbjtcbiAgICB2YXIgY29sdW1uQiA9IG1hcHBpbmdCLmdlbmVyYXRlZENvbHVtbjtcbiAgICByZXR1cm4gbGluZUIgPiBsaW5lQSB8fCBsaW5lQiA9PSBsaW5lQSAmJiBjb2x1bW5CID49IGNvbHVtbkEgfHxcbiAgICAgICAgICAgdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMobWFwcGluZ0EsIG1hcHBpbmdCKSA8PSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgZGF0YSBzdHJ1Y3R1cmUgdG8gcHJvdmlkZSBhIHNvcnRlZCB2aWV3IG9mIGFjY3VtdWxhdGVkIG1hcHBpbmdzIGluIGFcbiAgICogcGVyZm9ybWFuY2UgY29uc2Npb3VzIG1hbm5lci4gSXQgdHJhZGVzIGEgbmVnbGliYWJsZSBvdmVyaGVhZCBpbiBnZW5lcmFsXG4gICAqIGNhc2UgZm9yIGEgbGFyZ2Ugc3BlZWR1cCBpbiBjYXNlIG9mIG1hcHBpbmdzIGJlaW5nIGFkZGVkIGluIG9yZGVyLlxuICAgKi9cbiAgZnVuY3Rpb24gTWFwcGluZ0xpc3QoKSB7XG4gICAgdGhpcy5fYXJyYXkgPSBbXTtcbiAgICB0aGlzLl9zb3J0ZWQgPSB0cnVlO1xuICAgIC8vIFNlcnZlcyBhcyBpbmZpbXVtXG4gICAgdGhpcy5fbGFzdCA9IHtnZW5lcmF0ZWRMaW5lOiAtMSwgZ2VuZXJhdGVkQ29sdW1uOiAwfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRlIHRocm91Z2ggaW50ZXJuYWwgaXRlbXMuIFRoaXMgbWV0aG9kIHRha2VzIHRoZSBzYW1lIGFyZ3VtZW50cyB0aGF0XG4gICAqIGBBcnJheS5wcm90b3R5cGUuZm9yRWFjaGAgdGFrZXMuXG4gICAqXG4gICAqIE5PVEU6IFRoZSBvcmRlciBvZiB0aGUgbWFwcGluZ3MgaXMgTk9UIGd1YXJhbnRlZWQuXG4gICAqL1xuICBNYXBwaW5nTGlzdC5wcm90b3R5cGUudW5zb3J0ZWRGb3JFYWNoID1cbiAgICBmdW5jdGlvbiBNYXBwaW5nTGlzdF9mb3JFYWNoKGFDYWxsYmFjaywgYVRoaXNBcmcpIHtcbiAgICAgIHRoaXMuX2FycmF5LmZvckVhY2goYUNhbGxiYWNrLCBhVGhpc0FyZyk7XG4gICAgfTtcblxuICAvKipcbiAgICogQWRkIHRoZSBnaXZlbiBzb3VyY2UgbWFwcGluZy5cbiAgICpcbiAgICogQHBhcmFtIE9iamVjdCBhTWFwcGluZ1xuICAgKi9cbiAgTWFwcGluZ0xpc3QucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIE1hcHBpbmdMaXN0X2FkZChhTWFwcGluZykge1xuICAgIHZhciBtYXBwaW5nO1xuICAgIGlmIChnZW5lcmF0ZWRQb3NpdGlvbkFmdGVyKHRoaXMuX2xhc3QsIGFNYXBwaW5nKSkge1xuICAgICAgdGhpcy5fbGFzdCA9IGFNYXBwaW5nO1xuICAgICAgdGhpcy5fYXJyYXkucHVzaChhTWFwcGluZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3NvcnRlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fYXJyYXkucHVzaChhTWFwcGluZyk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBmbGF0LCBzb3J0ZWQgYXJyYXkgb2YgbWFwcGluZ3MuIFRoZSBtYXBwaW5ncyBhcmUgc29ydGVkIGJ5XG4gICAqIGdlbmVyYXRlZCBwb3NpdGlvbi5cbiAgICpcbiAgICogV0FSTklORzogVGhpcyBtZXRob2QgcmV0dXJucyBpbnRlcm5hbCBkYXRhIHdpdGhvdXQgY29weWluZywgZm9yXG4gICAqIHBlcmZvcm1hbmNlLiBUaGUgcmV0dXJuIHZhbHVlIG11c3QgTk9UIGJlIG11dGF0ZWQsIGFuZCBzaG91bGQgYmUgdHJlYXRlZCBhc1xuICAgKiBhbiBpbW11dGFibGUgYm9ycm93LiBJZiB5b3Ugd2FudCB0byB0YWtlIG93bmVyc2hpcCwgeW91IG11c3QgbWFrZSB5b3VyIG93blxuICAgKiBjb3B5LlxuICAgKi9cbiAgTWFwcGluZ0xpc3QucHJvdG90eXBlLnRvQXJyYXkgPSBmdW5jdGlvbiBNYXBwaW5nTGlzdF90b0FycmF5KCkge1xuICAgIGlmICghdGhpcy5fc29ydGVkKSB7XG4gICAgICB0aGlzLl9hcnJheS5zb3J0KHV0aWwuY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zKTtcbiAgICAgIHRoaXMuX3NvcnRlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcnJheTtcbiAgfTtcblxuICBleHBvcnRzLk1hcHBpbmdMaXN0ID0gTWFwcGluZ0xpc3Q7XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICB2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuICB2YXIgYmluYXJ5U2VhcmNoID0gcmVxdWlyZSgnLi9iaW5hcnktc2VhcmNoJyk7XG4gIHZhciBBcnJheVNldCA9IHJlcXVpcmUoJy4vYXJyYXktc2V0JykuQXJyYXlTZXQ7XG4gIHZhciBiYXNlNjRWTFEgPSByZXF1aXJlKCcuL2Jhc2U2NC12bHEnKTtcblxuICAvKipcbiAgICogQSBTb3VyY2VNYXBDb25zdW1lciBpbnN0YW5jZSByZXByZXNlbnRzIGEgcGFyc2VkIHNvdXJjZSBtYXAgd2hpY2ggd2UgY2FuXG4gICAqIHF1ZXJ5IGZvciBpbmZvcm1hdGlvbiBhYm91dCB0aGUgb3JpZ2luYWwgZmlsZSBwb3NpdGlvbnMgYnkgZ2l2aW5nIGl0IGEgZmlsZVxuICAgKiBwb3NpdGlvbiBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZS5cbiAgICpcbiAgICogVGhlIG9ubHkgcGFyYW1ldGVyIGlzIHRoZSByYXcgc291cmNlIG1hcCAoZWl0aGVyIGFzIGEgSlNPTiBzdHJpbmcsIG9yXG4gICAqIGFscmVhZHkgcGFyc2VkIHRvIGFuIG9iamVjdCkuIEFjY29yZGluZyB0byB0aGUgc3BlYywgc291cmNlIG1hcHMgaGF2ZSB0aGVcbiAgICogZm9sbG93aW5nIGF0dHJpYnV0ZXM6XG4gICAqXG4gICAqICAgLSB2ZXJzaW9uOiBXaGljaCB2ZXJzaW9uIG9mIHRoZSBzb3VyY2UgbWFwIHNwZWMgdGhpcyBtYXAgaXMgZm9sbG93aW5nLlxuICAgKiAgIC0gc291cmNlczogQW4gYXJyYXkgb2YgVVJMcyB0byB0aGUgb3JpZ2luYWwgc291cmNlIGZpbGVzLlxuICAgKiAgIC0gbmFtZXM6IEFuIGFycmF5IG9mIGlkZW50aWZpZXJzIHdoaWNoIGNhbiBiZSByZWZlcnJlbmNlZCBieSBpbmRpdmlkdWFsIG1hcHBpbmdzLlxuICAgKiAgIC0gc291cmNlUm9vdDogT3B0aW9uYWwuIFRoZSBVUkwgcm9vdCBmcm9tIHdoaWNoIGFsbCBzb3VyY2VzIGFyZSByZWxhdGl2ZS5cbiAgICogICAtIHNvdXJjZXNDb250ZW50OiBPcHRpb25hbC4gQW4gYXJyYXkgb2YgY29udGVudHMgb2YgdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlcy5cbiAgICogICAtIG1hcHBpbmdzOiBBIHN0cmluZyBvZiBiYXNlNjQgVkxRcyB3aGljaCBjb250YWluIHRoZSBhY3R1YWwgbWFwcGluZ3MuXG4gICAqICAgLSBmaWxlOiBPcHRpb25hbC4gVGhlIGdlbmVyYXRlZCBmaWxlIHRoaXMgc291cmNlIG1hcCBpcyBhc3NvY2lhdGVkIHdpdGguXG4gICAqXG4gICAqIEhlcmUgaXMgYW4gZXhhbXBsZSBzb3VyY2UgbWFwLCB0YWtlbiBmcm9tIHRoZSBzb3VyY2UgbWFwIHNwZWNbMF06XG4gICAqXG4gICAqICAgICB7XG4gICAqICAgICAgIHZlcnNpb24gOiAzLFxuICAgKiAgICAgICBmaWxlOiBcIm91dC5qc1wiLFxuICAgKiAgICAgICBzb3VyY2VSb290IDogXCJcIixcbiAgICogICAgICAgc291cmNlczogW1wiZm9vLmpzXCIsIFwiYmFyLmpzXCJdLFxuICAgKiAgICAgICBuYW1lczogW1wic3JjXCIsIFwibWFwc1wiLCBcImFyZVwiLCBcImZ1blwiXSxcbiAgICogICAgICAgbWFwcGluZ3M6IFwiQUEsQUI7O0FCQ0RFO1wiXG4gICAqICAgICB9XG4gICAqXG4gICAqIFswXTogaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vZG9jdW1lbnQvZC8xVTFSR0FlaFF3UnlwVVRvdkYxS1JscGlPRnplMGItXzJnYzZmQUgwS1kway9lZGl0P3BsaT0xI1xuICAgKi9cbiAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXIoYVNvdXJjZU1hcCkge1xuICAgIHZhciBzb3VyY2VNYXAgPSBhU291cmNlTWFwO1xuICAgIGlmICh0eXBlb2YgYVNvdXJjZU1hcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNvdXJjZU1hcCA9IEpTT04ucGFyc2UoYVNvdXJjZU1hcC5yZXBsYWNlKC9eXFwpXFxdXFx9Jy8sICcnKSk7XG4gICAgfVxuXG4gICAgdmFyIHZlcnNpb24gPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICd2ZXJzaW9uJyk7XG4gICAgdmFyIHNvdXJjZXMgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdzb3VyY2VzJyk7XG4gICAgLy8gU2FzcyAzLjMgbGVhdmVzIG91dCB0aGUgJ25hbWVzJyBhcnJheSwgc28gd2UgZGV2aWF0ZSBmcm9tIHRoZSBzcGVjICh3aGljaFxuICAgIC8vIHJlcXVpcmVzIHRoZSBhcnJheSkgdG8gcGxheSBuaWNlIGhlcmUuXG4gICAgdmFyIG5hbWVzID0gdXRpbC5nZXRBcmcoc291cmNlTWFwLCAnbmFtZXMnLCBbXSk7XG4gICAgdmFyIHNvdXJjZVJvb3QgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdzb3VyY2VSb290JywgbnVsbCk7XG4gICAgdmFyIHNvdXJjZXNDb250ZW50ID0gdXRpbC5nZXRBcmcoc291cmNlTWFwLCAnc291cmNlc0NvbnRlbnQnLCBudWxsKTtcbiAgICB2YXIgbWFwcGluZ3MgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdtYXBwaW5ncycpO1xuICAgIHZhciBmaWxlID0gdXRpbC5nZXRBcmcoc291cmNlTWFwLCAnZmlsZScsIG51bGwpO1xuXG4gICAgLy8gT25jZSBhZ2FpbiwgU2FzcyBkZXZpYXRlcyBmcm9tIHRoZSBzcGVjIGFuZCBzdXBwbGllcyB0aGUgdmVyc2lvbiBhcyBhXG4gICAgLy8gc3RyaW5nIHJhdGhlciB0aGFuIGEgbnVtYmVyLCBzbyB3ZSB1c2UgbG9vc2UgZXF1YWxpdHkgY2hlY2tpbmcgaGVyZS5cbiAgICBpZiAodmVyc2lvbiAhPSB0aGlzLl92ZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIHZlcnNpb246ICcgKyB2ZXJzaW9uKTtcbiAgICB9XG5cbiAgICAvLyBTb21lIHNvdXJjZSBtYXBzIHByb2R1Y2UgcmVsYXRpdmUgc291cmNlIHBhdGhzIGxpa2UgXCIuL2Zvby5qc1wiIGluc3RlYWQgb2ZcbiAgICAvLyBcImZvby5qc1wiLiAgTm9ybWFsaXplIHRoZXNlIGZpcnN0IHNvIHRoYXQgZnV0dXJlIGNvbXBhcmlzb25zIHdpbGwgc3VjY2VlZC5cbiAgICAvLyBTZWUgYnVnemlsLmxhLzEwOTA3NjguXG4gICAgc291cmNlcyA9IHNvdXJjZXMubWFwKHV0aWwubm9ybWFsaXplKTtcblxuICAgIC8vIFBhc3MgYHRydWVgIGJlbG93IHRvIGFsbG93IGR1cGxpY2F0ZSBuYW1lcyBhbmQgc291cmNlcy4gV2hpbGUgc291cmNlIG1hcHNcbiAgICAvLyBhcmUgaW50ZW5kZWQgdG8gYmUgY29tcHJlc3NlZCBhbmQgZGVkdXBsaWNhdGVkLCB0aGUgVHlwZVNjcmlwdCBjb21waWxlclxuICAgIC8vIHNvbWV0aW1lcyBnZW5lcmF0ZXMgc291cmNlIG1hcHMgd2l0aCBkdXBsaWNhdGVzIGluIHRoZW0uIFNlZSBHaXRodWIgaXNzdWVcbiAgICAvLyAjNzIgYW5kIGJ1Z3ppbC5sYS84ODk0OTIuXG4gICAgdGhpcy5fbmFtZXMgPSBBcnJheVNldC5mcm9tQXJyYXkobmFtZXMsIHRydWUpO1xuICAgIHRoaXMuX3NvdXJjZXMgPSBBcnJheVNldC5mcm9tQXJyYXkoc291cmNlcywgdHJ1ZSk7XG5cbiAgICB0aGlzLnNvdXJjZVJvb3QgPSBzb3VyY2VSb290O1xuICAgIHRoaXMuc291cmNlc0NvbnRlbnQgPSBzb3VyY2VzQ29udGVudDtcbiAgICB0aGlzLl9tYXBwaW5ncyA9IG1hcHBpbmdzO1xuICAgIHRoaXMuZmlsZSA9IGZpbGU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgU291cmNlTWFwQ29uc3VtZXIgZnJvbSBhIFNvdXJjZU1hcEdlbmVyYXRvci5cbiAgICpcbiAgICogQHBhcmFtIFNvdXJjZU1hcEdlbmVyYXRvciBhU291cmNlTWFwXG4gICAqICAgICAgICBUaGUgc291cmNlIG1hcCB0aGF0IHdpbGwgYmUgY29uc3VtZWQuXG4gICAqIEByZXR1cm5zIFNvdXJjZU1hcENvbnN1bWVyXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5mcm9tU291cmNlTWFwID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9mcm9tU291cmNlTWFwKGFTb3VyY2VNYXApIHtcbiAgICAgIHZhciBzbWMgPSBPYmplY3QuY3JlYXRlKFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZSk7XG5cbiAgICAgIHNtYy5fbmFtZXMgPSBBcnJheVNldC5mcm9tQXJyYXkoYVNvdXJjZU1hcC5fbmFtZXMudG9BcnJheSgpLCB0cnVlKTtcbiAgICAgIHNtYy5fc291cmNlcyA9IEFycmF5U2V0LmZyb21BcnJheShhU291cmNlTWFwLl9zb3VyY2VzLnRvQXJyYXkoKSwgdHJ1ZSk7XG4gICAgICBzbWMuc291cmNlUm9vdCA9IGFTb3VyY2VNYXAuX3NvdXJjZVJvb3Q7XG4gICAgICBzbWMuc291cmNlc0NvbnRlbnQgPSBhU291cmNlTWFwLl9nZW5lcmF0ZVNvdXJjZXNDb250ZW50KHNtYy5fc291cmNlcy50b0FycmF5KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtYy5zb3VyY2VSb290KTtcbiAgICAgIHNtYy5maWxlID0gYVNvdXJjZU1hcC5fZmlsZTtcblxuICAgICAgc21jLl9fZ2VuZXJhdGVkTWFwcGluZ3MgPSBhU291cmNlTWFwLl9tYXBwaW5ncy50b0FycmF5KCkuc2xpY2UoKTtcbiAgICAgIHNtYy5fX29yaWdpbmFsTWFwcGluZ3MgPSBhU291cmNlTWFwLl9tYXBwaW5ncy50b0FycmF5KCkuc2xpY2UoKVxuICAgICAgICAuc29ydCh1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKTtcblxuICAgICAgcmV0dXJuIHNtYztcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBUaGUgdmVyc2lvbiBvZiB0aGUgc291cmNlIG1hcHBpbmcgc3BlYyB0aGF0IHdlIGFyZSBjb25zdW1pbmcuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX3ZlcnNpb24gPSAzO1xuXG4gIC8qKlxuICAgKiBUaGUgbGlzdCBvZiBvcmlnaW5hbCBzb3VyY2VzLlxuICAgKi9cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZSwgJ3NvdXJjZXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc291cmNlcy50b0FycmF5KCkubWFwKGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCA/IHV0aWwuam9pbih0aGlzLnNvdXJjZVJvb3QsIHMpIDogcztcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gYF9fZ2VuZXJhdGVkTWFwcGluZ3NgIGFuZCBgX19vcmlnaW5hbE1hcHBpbmdzYCBhcmUgYXJyYXlzIHRoYXQgaG9sZCB0aGVcbiAgLy8gcGFyc2VkIG1hcHBpbmcgY29vcmRpbmF0ZXMgZnJvbSB0aGUgc291cmNlIG1hcCdzIFwibWFwcGluZ3NcIiBhdHRyaWJ1dGUuIFRoZXlcbiAgLy8gYXJlIGxhemlseSBpbnN0YW50aWF0ZWQsIGFjY2Vzc2VkIHZpYSB0aGUgYF9nZW5lcmF0ZWRNYXBwaW5nc2AgYW5kXG4gIC8vIGBfb3JpZ2luYWxNYXBwaW5nc2AgZ2V0dGVycyByZXNwZWN0aXZlbHksIGFuZCB3ZSBvbmx5IHBhcnNlIHRoZSBtYXBwaW5nc1xuICAvLyBhbmQgY3JlYXRlIHRoZXNlIGFycmF5cyBvbmNlIHF1ZXJpZWQgZm9yIGEgc291cmNlIGxvY2F0aW9uLiBXZSBqdW1wIHRocm91Z2hcbiAgLy8gdGhlc2UgaG9vcHMgYmVjYXVzZSB0aGVyZSBjYW4gYmUgbWFueSB0aG91c2FuZHMgb2YgbWFwcGluZ3MsIGFuZCBwYXJzaW5nXG4gIC8vIHRoZW0gaXMgZXhwZW5zaXZlLCBzbyB3ZSBvbmx5IHdhbnQgdG8gZG8gaXQgaWYgd2UgbXVzdC5cbiAgLy9cbiAgLy8gRWFjaCBvYmplY3QgaW4gdGhlIGFycmF5cyBpcyBvZiB0aGUgZm9ybTpcbiAgLy9cbiAgLy8gICAgIHtcbiAgLy8gICAgICAgZ2VuZXJhdGVkTGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgY29kZSxcbiAgLy8gICAgICAgZ2VuZXJhdGVkQ29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUsXG4gIC8vICAgICAgIHNvdXJjZTogVGhlIHBhdGggdG8gdGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlIHRoYXQgZ2VuZXJhdGVkIHRoaXNcbiAgLy8gICAgICAgICAgICAgICBjaHVuayBvZiBjb2RlLFxuICAvLyAgICAgICBvcmlnaW5hbExpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlIHRoYXRcbiAgLy8gICAgICAgICAgICAgICAgICAgICBjb3JyZXNwb25kcyB0byB0aGlzIGNodW5rIG9mIGdlbmVyYXRlZCBjb2RlLFxuICAvLyAgICAgICBvcmlnaW5hbENvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSB0aGF0XG4gIC8vICAgICAgICAgICAgICAgICAgICAgICBjb3JyZXNwb25kcyB0byB0aGlzIGNodW5rIG9mIGdlbmVyYXRlZCBjb2RlLFxuICAvLyAgICAgICBuYW1lOiBUaGUgbmFtZSBvZiB0aGUgb3JpZ2luYWwgc3ltYm9sIHdoaWNoIGdlbmVyYXRlZCB0aGlzIGNodW5rIG9mXG4gIC8vICAgICAgICAgICAgIGNvZGUuXG4gIC8vICAgICB9XG4gIC8vXG4gIC8vIEFsbCBwcm9wZXJ0aWVzIGV4Y2VwdCBmb3IgYGdlbmVyYXRlZExpbmVgIGFuZCBgZ2VuZXJhdGVkQ29sdW1uYCBjYW4gYmVcbiAgLy8gYG51bGxgLlxuICAvL1xuICAvLyBgX2dlbmVyYXRlZE1hcHBpbmdzYCBpcyBvcmRlcmVkIGJ5IHRoZSBnZW5lcmF0ZWQgcG9zaXRpb25zLlxuICAvL1xuICAvLyBgX29yaWdpbmFsTWFwcGluZ3NgIGlzIG9yZGVyZWQgYnkgdGhlIG9yaWdpbmFsIHBvc2l0aW9ucy5cblxuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IG51bGw7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUsICdfZ2VuZXJhdGVkTWFwcGluZ3MnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIXRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncykge1xuICAgICAgICB0aGlzLl9fZ2VuZXJhdGVkTWFwcGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fX29yaWdpbmFsTWFwcGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcGFyc2VNYXBwaW5ncyh0aGlzLl9tYXBwaW5ncywgdGhpcy5zb3VyY2VSb290KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncztcbiAgICB9XG4gIH0pO1xuXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fX29yaWdpbmFsTWFwcGluZ3MgPSBudWxsO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLCAnX29yaWdpbmFsTWFwcGluZ3MnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIXRoaXMuX19vcmlnaW5hbE1hcHBpbmdzKSB7XG4gICAgICAgIHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IFtdO1xuICAgICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncyA9IFtdO1xuICAgICAgICB0aGlzLl9wYXJzZU1hcHBpbmdzKHRoaXMuX21hcHBpbmdzLCB0aGlzLnNvdXJjZVJvb3QpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fX29yaWdpbmFsTWFwcGluZ3M7XG4gICAgfVxuICB9KTtcblxuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX25leHRDaGFySXNNYXBwaW5nU2VwYXJhdG9yID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9uZXh0Q2hhcklzTWFwcGluZ1NlcGFyYXRvcihhU3RyKSB7XG4gICAgICB2YXIgYyA9IGFTdHIuY2hhckF0KDApO1xuICAgICAgcmV0dXJuIGMgPT09IFwiO1wiIHx8IGMgPT09IFwiLFwiO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIHRoZSBtYXBwaW5ncyBpbiBhIHN0cmluZyBpbiB0byBhIGRhdGEgc3RydWN0dXJlIHdoaWNoIHdlIGNhbiBlYXNpbHlcbiAgICogcXVlcnkgKHRoZSBvcmRlcmVkIGFycmF5cyBpbiB0aGUgYHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5nc2AgYW5kXG4gICAqIGB0aGlzLl9fb3JpZ2luYWxNYXBwaW5nc2AgcHJvcGVydGllcykuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuX3BhcnNlTWFwcGluZ3MgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX3BhcnNlTWFwcGluZ3MoYVN0ciwgYVNvdXJjZVJvb3QpIHtcbiAgICAgIHZhciBnZW5lcmF0ZWRMaW5lID0gMTtcbiAgICAgIHZhciBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNPcmlnaW5hbExpbmUgPSAwO1xuICAgICAgdmFyIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSAwO1xuICAgICAgdmFyIHByZXZpb3VzU291cmNlID0gMDtcbiAgICAgIHZhciBwcmV2aW91c05hbWUgPSAwO1xuICAgICAgdmFyIHN0ciA9IGFTdHI7XG4gICAgICB2YXIgdGVtcCA9IHt9O1xuICAgICAgdmFyIG1hcHBpbmc7XG5cbiAgICAgIHdoaWxlIChzdHIubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAoc3RyLmNoYXJBdCgwKSA9PT0gJzsnKSB7XG4gICAgICAgICAgZ2VuZXJhdGVkTGluZSsrO1xuICAgICAgICAgIHN0ciA9IHN0ci5zbGljZSgxKTtcbiAgICAgICAgICBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RyLmNoYXJBdCgwKSA9PT0gJywnKSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNsaWNlKDEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG1hcHBpbmcgPSB7fTtcbiAgICAgICAgICBtYXBwaW5nLmdlbmVyYXRlZExpbmUgPSBnZW5lcmF0ZWRMaW5lO1xuXG4gICAgICAgICAgLy8gR2VuZXJhdGVkIGNvbHVtbi5cbiAgICAgICAgICBiYXNlNjRWTFEuZGVjb2RlKHN0ciwgdGVtcCk7XG4gICAgICAgICAgbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4gPSBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiArIHRlbXAudmFsdWU7XG4gICAgICAgICAgcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gPSBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbjtcbiAgICAgICAgICBzdHIgPSB0ZW1wLnJlc3Q7XG5cbiAgICAgICAgICBpZiAoc3RyLmxlbmd0aCA+IDAgJiYgIXRoaXMuX25leHRDaGFySXNNYXBwaW5nU2VwYXJhdG9yKHN0cikpIHtcbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIHNvdXJjZS5cbiAgICAgICAgICAgIGJhc2U2NFZMUS5kZWNvZGUoc3RyLCB0ZW1wKTtcbiAgICAgICAgICAgIG1hcHBpbmcuc291cmNlID0gdGhpcy5fc291cmNlcy5hdChwcmV2aW91c1NvdXJjZSArIHRlbXAudmFsdWUpO1xuICAgICAgICAgICAgcHJldmlvdXNTb3VyY2UgKz0gdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIHN0ciA9IHRlbXAucmVzdDtcbiAgICAgICAgICAgIGlmIChzdHIubGVuZ3RoID09PSAwIHx8IHRoaXMuX25leHRDaGFySXNNYXBwaW5nU2VwYXJhdG9yKHN0cikpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCBhIHNvdXJjZSwgYnV0IG5vIGxpbmUgYW5kIGNvbHVtbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBsaW5lLlxuICAgICAgICAgICAgYmFzZTY0VkxRLmRlY29kZShzdHIsIHRlbXApO1xuICAgICAgICAgICAgbWFwcGluZy5vcmlnaW5hbExpbmUgPSBwcmV2aW91c09yaWdpbmFsTGluZSArIHRlbXAudmFsdWU7XG4gICAgICAgICAgICBwcmV2aW91c09yaWdpbmFsTGluZSA9IG1hcHBpbmcub3JpZ2luYWxMaW5lO1xuICAgICAgICAgICAgLy8gTGluZXMgYXJlIHN0b3JlZCAwLWJhc2VkXG4gICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsTGluZSArPSAxO1xuICAgICAgICAgICAgc3RyID0gdGVtcC5yZXN0O1xuICAgICAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDAgfHwgdGhpcy5fbmV4dENoYXJJc01hcHBpbmdTZXBhcmF0b3Ioc3RyKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIGEgc291cmNlIGFuZCBsaW5lLCBidXQgbm8gY29sdW1uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGNvbHVtbi5cbiAgICAgICAgICAgIGJhc2U2NFZMUS5kZWNvZGUoc3RyLCB0ZW1wKTtcbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxDb2x1bW4gPSBwcmV2aW91c09yaWdpbmFsQ29sdW1uICsgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uO1xuICAgICAgICAgICAgc3RyID0gdGVtcC5yZXN0O1xuXG4gICAgICAgICAgICBpZiAoc3RyLmxlbmd0aCA+IDAgJiYgIXRoaXMuX25leHRDaGFySXNNYXBwaW5nU2VwYXJhdG9yKHN0cikpIHtcbiAgICAgICAgICAgICAgLy8gT3JpZ2luYWwgbmFtZS5cbiAgICAgICAgICAgICAgYmFzZTY0VkxRLmRlY29kZShzdHIsIHRlbXApO1xuICAgICAgICAgICAgICBtYXBwaW5nLm5hbWUgPSB0aGlzLl9uYW1lcy5hdChwcmV2aW91c05hbWUgKyB0ZW1wLnZhbHVlKTtcbiAgICAgICAgICAgICAgcHJldmlvdXNOYW1lICs9IHRlbXAudmFsdWU7XG4gICAgICAgICAgICAgIHN0ciA9IHRlbXAucmVzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLl9fZ2VuZXJhdGVkTWFwcGluZ3MucHVzaChtYXBwaW5nKTtcbiAgICAgICAgICBpZiAodHlwZW9mIG1hcHBpbmcub3JpZ2luYWxMaW5lID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5fX29yaWdpbmFsTWFwcGluZ3MucHVzaChtYXBwaW5nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzLnNvcnQodXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMpO1xuICAgICAgdGhpcy5fX29yaWdpbmFsTWFwcGluZ3Muc29ydCh1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBtYXBwaW5nIHRoYXQgYmVzdCBtYXRjaGVzIHRoZSBoeXBvdGhldGljYWwgXCJuZWVkbGVcIiBtYXBwaW5nIHRoYXRcbiAgICogd2UgYXJlIHNlYXJjaGluZyBmb3IgaW4gdGhlIGdpdmVuIFwiaGF5c3RhY2tcIiBvZiBtYXBwaW5ncy5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fZmluZE1hcHBpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2ZpbmRNYXBwaW5nKGFOZWVkbGUsIGFNYXBwaW5ncywgYUxpbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFDb2x1bW5OYW1lLCBhQ29tcGFyYXRvcikge1xuICAgICAgLy8gVG8gcmV0dXJuIHRoZSBwb3NpdGlvbiB3ZSBhcmUgc2VhcmNoaW5nIGZvciwgd2UgbXVzdCBmaXJzdCBmaW5kIHRoZVxuICAgICAgLy8gbWFwcGluZyBmb3IgdGhlIGdpdmVuIHBvc2l0aW9uIGFuZCB0aGVuIHJldHVybiB0aGUgb3Bwb3NpdGUgcG9zaXRpb24gaXRcbiAgICAgIC8vIHBvaW50cyB0by4gQmVjYXVzZSB0aGUgbWFwcGluZ3MgYXJlIHNvcnRlZCwgd2UgY2FuIHVzZSBiaW5hcnkgc2VhcmNoIHRvXG4gICAgICAvLyBmaW5kIHRoZSBiZXN0IG1hcHBpbmcuXG5cbiAgICAgIGlmIChhTmVlZGxlW2FMaW5lTmFtZV0gPD0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdMaW5lIG11c3QgYmUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIDEsIGdvdCAnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBhTmVlZGxlW2FMaW5lTmFtZV0pO1xuICAgICAgfVxuICAgICAgaWYgKGFOZWVkbGVbYUNvbHVtbk5hbWVdIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDb2x1bW4gbXVzdCBiZSBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gMCwgZ290ICdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArIGFOZWVkbGVbYUNvbHVtbk5hbWVdKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGJpbmFyeVNlYXJjaC5zZWFyY2goYU5lZWRsZSwgYU1hcHBpbmdzLCBhQ29tcGFyYXRvcik7XG4gICAgfTtcblxuICAvKipcbiAgICogQ29tcHV0ZSB0aGUgbGFzdCBjb2x1bW4gZm9yIGVhY2ggZ2VuZXJhdGVkIG1hcHBpbmcuIFRoZSBsYXN0IGNvbHVtbiBpc1xuICAgKiBpbmNsdXNpdmUuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuY29tcHV0ZUNvbHVtblNwYW5zID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9jb21wdXRlQ29sdW1uU3BhbnMoKSB7XG4gICAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3MubGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3NbaW5kZXhdO1xuXG4gICAgICAgIC8vIE1hcHBpbmdzIGRvIG5vdCBjb250YWluIGEgZmllbGQgZm9yIHRoZSBsYXN0IGdlbmVyYXRlZCBjb2x1bW50LiBXZVxuICAgICAgICAvLyBjYW4gY29tZSB1cCB3aXRoIGFuIG9wdGltaXN0aWMgZXN0aW1hdGUsIGhvd2V2ZXIsIGJ5IGFzc3VtaW5nIHRoYXRcbiAgICAgICAgLy8gbWFwcGluZ3MgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gZ2l2ZW4gdHdvIGNvbnNlY3V0aXZlIG1hcHBpbmdzLCB0aGVcbiAgICAgICAgLy8gZmlyc3QgbWFwcGluZyBlbmRzIHdoZXJlIHRoZSBzZWNvbmQgb25lIHN0YXJ0cykuXG4gICAgICAgIGlmIChpbmRleCArIDEgPCB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgbmV4dE1hcHBpbmcgPSB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5nc1tpbmRleCArIDFdO1xuXG4gICAgICAgICAgaWYgKG1hcHBpbmcuZ2VuZXJhdGVkTGluZSA9PT0gbmV4dE1hcHBpbmcuZ2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgICAgbWFwcGluZy5sYXN0R2VuZXJhdGVkQ29sdW1uID0gbmV4dE1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uIC0gMTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBsYXN0IG1hcHBpbmcgZm9yIGVhY2ggbGluZSBzcGFucyB0aGUgZW50aXJlIGxpbmUuXG4gICAgICAgIG1hcHBpbmcubGFzdEdlbmVyYXRlZENvbHVtbiA9IEluZmluaXR5O1xuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG9yaWdpbmFsIHNvdXJjZSwgbGluZSwgYW5kIGNvbHVtbiBpbmZvcm1hdGlvbiBmb3IgdGhlIGdlbmVyYXRlZFxuICAgKiBzb3VyY2UncyBsaW5lIGFuZCBjb2x1bW4gcG9zaXRpb25zIHByb3ZpZGVkLiBUaGUgb25seSBhcmd1bWVudCBpcyBhbiBvYmplY3RcbiAgICogd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UuXG4gICAqICAgLSBjb2x1bW46IFRoZSBjb2x1bW4gbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLlxuICAgKlxuICAgKiBhbmQgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gc291cmNlOiBUaGUgb3JpZ2luYWwgc291cmNlIGZpbGUsIG9yIG51bGwuXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIG5hbWU6IFRoZSBvcmlnaW5hbCBpZGVudGlmaWVyLCBvciBudWxsLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLm9yaWdpbmFsUG9zaXRpb25Gb3IgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX29yaWdpbmFsUG9zaXRpb25Gb3IoYUFyZ3MpIHtcbiAgICAgIHZhciBuZWVkbGUgPSB7XG4gICAgICAgIGdlbmVyYXRlZExpbmU6IHV0aWwuZ2V0QXJnKGFBcmdzLCAnbGluZScpLFxuICAgICAgICBnZW5lcmF0ZWRDb2x1bW46IHV0aWwuZ2V0QXJnKGFBcmdzLCAnY29sdW1uJylcbiAgICAgIH07XG5cbiAgICAgIHZhciBpbmRleCA9IHRoaXMuX2ZpbmRNYXBwaW5nKG5lZWRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJnZW5lcmF0ZWRMaW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImdlbmVyYXRlZENvbHVtblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMpO1xuXG4gICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICB2YXIgbWFwcGluZyA9IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzW2luZGV4XTtcblxuICAgICAgICBpZiAobWFwcGluZy5nZW5lcmF0ZWRMaW5lID09PSBuZWVkbGUuZ2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgIHZhciBzb3VyY2UgPSB1dGlsLmdldEFyZyhtYXBwaW5nLCAnc291cmNlJywgbnVsbCk7XG4gICAgICAgICAgaWYgKHNvdXJjZSAhPSBudWxsICYmIHRoaXMuc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBzb3VyY2UgPSB1dGlsLmpvaW4odGhpcy5zb3VyY2VSb290LCBzb3VyY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgICBsaW5lOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnb3JpZ2luYWxMaW5lJywgbnVsbCksXG4gICAgICAgICAgICBjb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdvcmlnaW5hbENvbHVtbicsIG51bGwpLFxuICAgICAgICAgICAgbmFtZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ25hbWUnLCBudWxsKVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlOiBudWxsLFxuICAgICAgICBsaW5lOiBudWxsLFxuICAgICAgICBjb2x1bW46IG51bGwsXG4gICAgICAgIG5hbWU6IG51bGxcbiAgICAgIH07XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgb3JpZ2luYWwgc291cmNlIGNvbnRlbnQuIFRoZSBvbmx5IGFyZ3VtZW50IGlzIHRoZSB1cmwgb2YgdGhlXG4gICAqIG9yaWdpbmFsIHNvdXJjZSBmaWxlLiBSZXR1cm5zIG51bGwgaWYgbm8gb3JpZ2luYWwgc291cmNlIGNvbnRlbnQgaXNcbiAgICogYXZhaWxpYmxlLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLnNvdXJjZUNvbnRlbnRGb3IgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX3NvdXJjZUNvbnRlbnRGb3IoYVNvdXJjZSkge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZXNDb250ZW50KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgYVNvdXJjZSA9IHV0aWwucmVsYXRpdmUodGhpcy5zb3VyY2VSb290LCBhU291cmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3NvdXJjZXMuaGFzKGFTb3VyY2UpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNvdXJjZXNDb250ZW50W3RoaXMuX3NvdXJjZXMuaW5kZXhPZihhU291cmNlKV07XG4gICAgICB9XG5cbiAgICAgIHZhciB1cmw7XG4gICAgICBpZiAodGhpcy5zb3VyY2VSb290ICE9IG51bGxcbiAgICAgICAgICAmJiAodXJsID0gdXRpbC51cmxQYXJzZSh0aGlzLnNvdXJjZVJvb3QpKSkge1xuICAgICAgICAvLyBYWFg6IGZpbGU6Ly8gVVJJcyBhbmQgYWJzb2x1dGUgcGF0aHMgbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9yIGZvclxuICAgICAgICAvLyBtYW55IHVzZXJzLiBXZSBjYW4gaGVscCB0aGVtIG91dCB3aGVuIHRoZXkgZXhwZWN0IGZpbGU6Ly8gVVJJcyB0b1xuICAgICAgICAvLyBiZWhhdmUgbGlrZSBpdCB3b3VsZCBpZiB0aGV5IHdlcmUgcnVubmluZyBhIGxvY2FsIEhUVFAgc2VydmVyLiBTZWVcbiAgICAgICAgLy8gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9ODg1NTk3LlxuICAgICAgICB2YXIgZmlsZVVyaUFic1BhdGggPSBhU291cmNlLnJlcGxhY2UoL15maWxlOlxcL1xcLy8sIFwiXCIpO1xuICAgICAgICBpZiAodXJsLnNjaGVtZSA9PSBcImZpbGVcIlxuICAgICAgICAgICAgJiYgdGhpcy5fc291cmNlcy5oYXMoZmlsZVVyaUFic1BhdGgpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlc0NvbnRlbnRbdGhpcy5fc291cmNlcy5pbmRleE9mKGZpbGVVcmlBYnNQYXRoKV1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoIXVybC5wYXRoIHx8IHVybC5wYXRoID09IFwiL1wiKVxuICAgICAgICAgICAgJiYgdGhpcy5fc291cmNlcy5oYXMoXCIvXCIgKyBhU291cmNlKSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNvdXJjZXNDb250ZW50W3RoaXMuX3NvdXJjZXMuaW5kZXhPZihcIi9cIiArIGFTb3VyY2UpXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1wiJyArIGFTb3VyY2UgKyAnXCIgaXMgbm90IGluIHRoZSBTb3VyY2VNYXAuJyk7XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgZ2VuZXJhdGVkIGxpbmUgYW5kIGNvbHVtbiBpbmZvcm1hdGlvbiBmb3IgdGhlIG9yaWdpbmFsIHNvdXJjZSxcbiAgICogbGluZSwgYW5kIGNvbHVtbiBwb3NpdGlvbnMgcHJvdmlkZWQuIFRoZSBvbmx5IGFyZ3VtZW50IGlzIGFuIG9iamVjdCB3aXRoXG4gICAqIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIHNvdXJjZTogVGhlIGZpbGVuYW1lIG9mIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqICAgLSBsaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICpcbiAgICogYW5kIGFuIG9iamVjdCBpcyByZXR1cm5lZCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UsIG9yIG51bGwuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuZ2VuZXJhdGVkUG9zaXRpb25Gb3IgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2dlbmVyYXRlZFBvc2l0aW9uRm9yKGFBcmdzKSB7XG4gICAgICB2YXIgbmVlZGxlID0ge1xuICAgICAgICBzb3VyY2U6IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJyksXG4gICAgICAgIG9yaWdpbmFsTGluZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdsaW5lJyksXG4gICAgICAgIG9yaWdpbmFsQ29sdW1uOiB1dGlsLmdldEFyZyhhQXJncywgJ2NvbHVtbicpXG4gICAgICB9O1xuXG4gICAgICBpZiAodGhpcy5zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgbmVlZGxlLnNvdXJjZSA9IHV0aWwucmVsYXRpdmUodGhpcy5zb3VyY2VSb290LCBuZWVkbGUuc291cmNlKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5fZmluZE1hcHBpbmcobmVlZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3JpZ2luYWxNYXBwaW5ncyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwib3JpZ2luYWxMaW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm9yaWdpbmFsQ29sdW1uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKTtcblxuICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgdmFyIG1hcHBpbmcgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzW2luZGV4XTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxpbmU6IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdnZW5lcmF0ZWRMaW5lJywgbnVsbCksXG4gICAgICAgICAgY29sdW1uOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnZ2VuZXJhdGVkQ29sdW1uJywgbnVsbCksXG4gICAgICAgICAgbGFzdENvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2xhc3RHZW5lcmF0ZWRDb2x1bW4nLCBudWxsKVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsaW5lOiBudWxsLFxuICAgICAgICBjb2x1bW46IG51bGwsXG4gICAgICAgIGxhc3RDb2x1bW46IG51bGxcbiAgICAgIH07XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyBhbGwgZ2VuZXJhdGVkIGxpbmUgYW5kIGNvbHVtbiBpbmZvcm1hdGlvbiBmb3IgdGhlIG9yaWdpbmFsIHNvdXJjZVxuICAgKiBhbmQgbGluZSBwcm92aWRlZC4gVGhlIG9ubHkgYXJndW1lbnQgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gc291cmNlOiBUaGUgZmlsZW5hbWUgb2YgdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKlxuICAgKiBhbmQgYW4gYXJyYXkgb2Ygb2JqZWN0cyBpcyByZXR1cm5lZCwgZWFjaCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UsIG9yIG51bGwuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuYWxsR2VuZXJhdGVkUG9zaXRpb25zRm9yID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9hbGxHZW5lcmF0ZWRQb3NpdGlvbnNGb3IoYUFyZ3MpIHtcbiAgICAgIC8vIFdoZW4gdGhlcmUgaXMgbm8gZXhhY3QgbWF0Y2gsIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fZmluZE1hcHBpbmdcbiAgICAgIC8vIHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBjbG9zZXN0IG1hcHBpbmcgbGVzcyB0aGFuIHRoZSBuZWVkbGUuIEJ5XG4gICAgICAvLyBzZXR0aW5nIG5lZWRsZS5vcmlnaW5hbENvbHVtbiB0byBJbmZpbml0eSwgd2UgdGh1cyBmaW5kIHRoZSBsYXN0XG4gICAgICAvLyBtYXBwaW5nIGZvciB0aGUgZ2l2ZW4gbGluZSwgcHJvdmlkZWQgc3VjaCBhIG1hcHBpbmcgZXhpc3RzLlxuICAgICAgdmFyIG5lZWRsZSA9IHtcbiAgICAgICAgc291cmNlOiB1dGlsLmdldEFyZyhhQXJncywgJ3NvdXJjZScpLFxuICAgICAgICBvcmlnaW5hbExpbmU6IHV0aWwuZ2V0QXJnKGFBcmdzLCAnbGluZScpLFxuICAgICAgICBvcmlnaW5hbENvbHVtbjogSW5maW5pdHlcbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBuZWVkbGUuc291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIG5lZWRsZS5zb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICB2YXIgbWFwcGluZ3MgPSBbXTtcblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5fZmluZE1hcHBpbmcobmVlZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3JpZ2luYWxNYXBwaW5ncyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwib3JpZ2luYWxMaW5lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm9yaWdpbmFsQ29sdW1uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKTtcbiAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fb3JpZ2luYWxNYXBwaW5nc1tpbmRleF07XG5cbiAgICAgICAgd2hpbGUgKG1hcHBpbmcgJiYgbWFwcGluZy5vcmlnaW5hbExpbmUgPT09IG5lZWRsZS5vcmlnaW5hbExpbmUpIHtcbiAgICAgICAgICBtYXBwaW5ncy5wdXNoKHtcbiAgICAgICAgICAgIGxpbmU6IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdnZW5lcmF0ZWRMaW5lJywgbnVsbCksXG4gICAgICAgICAgICBjb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdnZW5lcmF0ZWRDb2x1bW4nLCBudWxsKSxcbiAgICAgICAgICAgIGxhc3RDb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdsYXN0R2VuZXJhdGVkQ29sdW1uJywgbnVsbClcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG1hcHBpbmcgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzWy0taW5kZXhdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYXBwaW5ncy5yZXZlcnNlKCk7XG4gICAgfTtcblxuICBTb3VyY2VNYXBDb25zdW1lci5HRU5FUkFURURfT1JERVIgPSAxO1xuICBTb3VyY2VNYXBDb25zdW1lci5PUklHSU5BTF9PUkRFUiA9IDI7XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgb3ZlciBlYWNoIG1hcHBpbmcgYmV0d2VlbiBhbiBvcmlnaW5hbCBzb3VyY2UvbGluZS9jb2x1bW4gYW5kIGFcbiAgICogZ2VuZXJhdGVkIGxpbmUvY29sdW1uIGluIHRoaXMgc291cmNlIG1hcC5cbiAgICpcbiAgICogQHBhcmFtIEZ1bmN0aW9uIGFDYWxsYmFja1xuICAgKiAgICAgICAgVGhlIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdpdGggZWFjaCBtYXBwaW5nLlxuICAgKiBAcGFyYW0gT2JqZWN0IGFDb250ZXh0XG4gICAqICAgICAgICBPcHRpb25hbC4gSWYgc3BlY2lmaWVkLCB0aGlzIG9iamVjdCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgZXZlcnlcbiAgICogICAgICAgIHRpbWUgdGhhdCBgYUNhbGxiYWNrYCBpcyBjYWxsZWQuXG4gICAqIEBwYXJhbSBhT3JkZXJcbiAgICogICAgICAgIEVpdGhlciBgU291cmNlTWFwQ29uc3VtZXIuR0VORVJBVEVEX09SREVSYCBvclxuICAgKiAgICAgICAgYFNvdXJjZU1hcENvbnN1bWVyLk9SSUdJTkFMX09SREVSYC4gU3BlY2lmaWVzIHdoZXRoZXIgeW91IHdhbnQgdG9cbiAgICogICAgICAgIGl0ZXJhdGUgb3ZlciB0aGUgbWFwcGluZ3Mgc29ydGVkIGJ5IHRoZSBnZW5lcmF0ZWQgZmlsZSdzIGxpbmUvY29sdW1uXG4gICAqICAgICAgICBvcmRlciBvciB0aGUgb3JpZ2luYWwncyBzb3VyY2UvbGluZS9jb2x1bW4gb3JkZXIsIHJlc3BlY3RpdmVseS4gRGVmYXVsdHMgdG9cbiAgICogICAgICAgIGBTb3VyY2VNYXBDb25zdW1lci5HRU5FUkFURURfT1JERVJgLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLmVhY2hNYXBwaW5nID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcl9lYWNoTWFwcGluZyhhQ2FsbGJhY2ssIGFDb250ZXh0LCBhT3JkZXIpIHtcbiAgICAgIHZhciBjb250ZXh0ID0gYUNvbnRleHQgfHwgbnVsbDtcbiAgICAgIHZhciBvcmRlciA9IGFPcmRlciB8fCBTb3VyY2VNYXBDb25zdW1lci5HRU5FUkFURURfT1JERVI7XG5cbiAgICAgIHZhciBtYXBwaW5ncztcbiAgICAgIHN3aXRjaCAob3JkZXIpIHtcbiAgICAgIGNhc2UgU291cmNlTWFwQ29uc3VtZXIuR0VORVJBVEVEX09SREVSOlxuICAgICAgICBtYXBwaW5ncyA9IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU291cmNlTWFwQ29uc3VtZXIuT1JJR0lOQUxfT1JERVI6XG4gICAgICAgIG1hcHBpbmdzID0gdGhpcy5fb3JpZ2luYWxNYXBwaW5ncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIG9yZGVyIG9mIGl0ZXJhdGlvbi5cIik7XG4gICAgICB9XG5cbiAgICAgIHZhciBzb3VyY2VSb290ID0gdGhpcy5zb3VyY2VSb290O1xuICAgICAgbWFwcGluZ3MubWFwKGZ1bmN0aW9uIChtYXBwaW5nKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBtYXBwaW5nLnNvdXJjZTtcbiAgICAgICAgaWYgKHNvdXJjZSAhPSBudWxsICYmIHNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgIHNvdXJjZSA9IHV0aWwuam9pbihzb3VyY2VSb290LCBzb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZ2VuZXJhdGVkTGluZTogbWFwcGluZy5nZW5lcmF0ZWRMaW5lLFxuICAgICAgICAgIGdlbmVyYXRlZENvbHVtbjogbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4sXG4gICAgICAgICAgb3JpZ2luYWxMaW5lOiBtYXBwaW5nLm9yaWdpbmFsTGluZSxcbiAgICAgICAgICBvcmlnaW5hbENvbHVtbjogbWFwcGluZy5vcmlnaW5hbENvbHVtbixcbiAgICAgICAgICBuYW1lOiBtYXBwaW5nLm5hbWVcbiAgICAgICAgfTtcbiAgICAgIH0pLmZvckVhY2goYUNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9O1xuXG4gIGV4cG9ydHMuU291cmNlTWFwQ29uc3VtZXIgPSBTb3VyY2VNYXBDb25zdW1lcjtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciBiYXNlNjRWTFEgPSByZXF1aXJlKCcuL2Jhc2U2NC12bHEnKTtcbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbiAgdmFyIEFycmF5U2V0ID0gcmVxdWlyZSgnLi9hcnJheS1zZXQnKS5BcnJheVNldDtcbiAgdmFyIE1hcHBpbmdMaXN0ID0gcmVxdWlyZSgnLi9tYXBwaW5nLWxpc3QnKS5NYXBwaW5nTGlzdDtcblxuICAvKipcbiAgICogQW4gaW5zdGFuY2Ugb2YgdGhlIFNvdXJjZU1hcEdlbmVyYXRvciByZXByZXNlbnRzIGEgc291cmNlIG1hcCB3aGljaCBpc1xuICAgKiBiZWluZyBidWlsdCBpbmNyZW1lbnRhbGx5LiBZb3UgbWF5IHBhc3MgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZ1xuICAgKiBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gZmlsZTogVGhlIGZpbGVuYW1lIG9mIHRoZSBnZW5lcmF0ZWQgc291cmNlLlxuICAgKiAgIC0gc291cmNlUm9vdDogQSByb290IGZvciBhbGwgcmVsYXRpdmUgVVJMcyBpbiB0aGlzIHNvdXJjZSBtYXAuXG4gICAqL1xuICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3IoYUFyZ3MpIHtcbiAgICBpZiAoIWFBcmdzKSB7XG4gICAgICBhQXJncyA9IHt9O1xuICAgIH1cbiAgICB0aGlzLl9maWxlID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdmaWxlJywgbnVsbCk7XG4gICAgdGhpcy5fc291cmNlUm9vdCA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlUm9vdCcsIG51bGwpO1xuICAgIHRoaXMuX3NraXBWYWxpZGF0aW9uID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdza2lwVmFsaWRhdGlvbicsIGZhbHNlKTtcbiAgICB0aGlzLl9zb3VyY2VzID0gbmV3IEFycmF5U2V0KCk7XG4gICAgdGhpcy5fbmFtZXMgPSBuZXcgQXJyYXlTZXQoKTtcbiAgICB0aGlzLl9tYXBwaW5ncyA9IG5ldyBNYXBwaW5nTGlzdCgpO1xuICAgIHRoaXMuX3NvdXJjZXNDb250ZW50cyA9IG51bGw7XG4gIH1cblxuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLl92ZXJzaW9uID0gMztcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBTb3VyY2VNYXBHZW5lcmF0b3IgYmFzZWQgb24gYSBTb3VyY2VNYXBDb25zdW1lclxuICAgKlxuICAgKiBAcGFyYW0gYVNvdXJjZU1hcENvbnN1bWVyIFRoZSBTb3VyY2VNYXAuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IuZnJvbVNvdXJjZU1hcCA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX2Zyb21Tb3VyY2VNYXAoYVNvdXJjZU1hcENvbnN1bWVyKSB7XG4gICAgICB2YXIgc291cmNlUm9vdCA9IGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VSb290O1xuICAgICAgdmFyIGdlbmVyYXRvciA9IG5ldyBTb3VyY2VNYXBHZW5lcmF0b3Ioe1xuICAgICAgICBmaWxlOiBhU291cmNlTWFwQ29uc3VtZXIuZmlsZSxcbiAgICAgICAgc291cmNlUm9vdDogc291cmNlUm9vdFxuICAgICAgfSk7XG4gICAgICBhU291cmNlTWFwQ29uc3VtZXIuZWFjaE1hcHBpbmcoZnVuY3Rpb24gKG1hcHBpbmcpIHtcbiAgICAgICAgdmFyIG5ld01hcHBpbmcgPSB7XG4gICAgICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgICAgICBsaW5lOiBtYXBwaW5nLmdlbmVyYXRlZExpbmUsXG4gICAgICAgICAgICBjb2x1bW46IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChtYXBwaW5nLnNvdXJjZSAhPSBudWxsKSB7XG4gICAgICAgICAgbmV3TWFwcGluZy5zb3VyY2UgPSBtYXBwaW5nLnNvdXJjZTtcbiAgICAgICAgICBpZiAoc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBuZXdNYXBwaW5nLnNvdXJjZSA9IHV0aWwucmVsYXRpdmUoc291cmNlUm9vdCwgbmV3TWFwcGluZy5zb3VyY2UpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG5ld01hcHBpbmcub3JpZ2luYWwgPSB7XG4gICAgICAgICAgICBsaW5lOiBtYXBwaW5nLm9yaWdpbmFsTGluZSxcbiAgICAgICAgICAgIGNvbHVtbjogbWFwcGluZy5vcmlnaW5hbENvbHVtblxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAobWFwcGluZy5uYW1lICE9IG51bGwpIHtcbiAgICAgICAgICAgIG5ld01hcHBpbmcubmFtZSA9IG1hcHBpbmcubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBnZW5lcmF0b3IuYWRkTWFwcGluZyhuZXdNYXBwaW5nKTtcbiAgICAgIH0pO1xuICAgICAgYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbiAoc291cmNlRmlsZSkge1xuICAgICAgICB2YXIgY29udGVudCA9IGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VDb250ZW50Rm9yKHNvdXJjZUZpbGUpO1xuICAgICAgICBpZiAoY29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgZ2VuZXJhdG9yLnNldFNvdXJjZUNvbnRlbnQoc291cmNlRmlsZSwgY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGdlbmVyYXRvcjtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgYSBzaW5nbGUgbWFwcGluZyBmcm9tIG9yaWdpbmFsIHNvdXJjZSBsaW5lIGFuZCBjb2x1bW4gdG8gdGhlIGdlbmVyYXRlZFxuICAgKiBzb3VyY2UncyBsaW5lIGFuZCBjb2x1bW4gZm9yIHRoaXMgc291cmNlIG1hcCBiZWluZyBjcmVhdGVkLiBUaGUgbWFwcGluZ1xuICAgKiBvYmplY3Qgc2hvdWxkIGhhdmUgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gZ2VuZXJhdGVkOiBBbiBvYmplY3Qgd2l0aCB0aGUgZ2VuZXJhdGVkIGxpbmUgYW5kIGNvbHVtbiBwb3NpdGlvbnMuXG4gICAqICAgLSBvcmlnaW5hbDogQW4gb2JqZWN0IHdpdGggdGhlIG9yaWdpbmFsIGxpbmUgYW5kIGNvbHVtbiBwb3NpdGlvbnMuXG4gICAqICAgLSBzb3VyY2U6IFRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZSAocmVsYXRpdmUgdG8gdGhlIHNvdXJjZVJvb3QpLlxuICAgKiAgIC0gbmFtZTogQW4gb3B0aW9uYWwgb3JpZ2luYWwgdG9rZW4gbmFtZSBmb3IgdGhpcyBtYXBwaW5nLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5hZGRNYXBwaW5nID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfYWRkTWFwcGluZyhhQXJncykge1xuICAgICAgdmFyIGdlbmVyYXRlZCA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnZ2VuZXJhdGVkJyk7XG4gICAgICB2YXIgb3JpZ2luYWwgPSB1dGlsLmdldEFyZyhhQXJncywgJ29yaWdpbmFsJywgbnVsbCk7XG4gICAgICB2YXIgc291cmNlID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdzb3VyY2UnLCBudWxsKTtcbiAgICAgIHZhciBuYW1lID0gdXRpbC5nZXRBcmcoYUFyZ3MsICduYW1lJywgbnVsbCk7XG5cbiAgICAgIGlmICghdGhpcy5fc2tpcFZhbGlkYXRpb24pIHtcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVNYXBwaW5nKGdlbmVyYXRlZCwgb3JpZ2luYWwsIHNvdXJjZSwgbmFtZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzb3VyY2UgIT0gbnVsbCAmJiAhdGhpcy5fc291cmNlcy5oYXMoc291cmNlKSkge1xuICAgICAgICB0aGlzLl9zb3VyY2VzLmFkZChzb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAobmFtZSAhPSBudWxsICYmICF0aGlzLl9uYW1lcy5oYXMobmFtZSkpIHtcbiAgICAgICAgdGhpcy5fbmFtZXMuYWRkKG5hbWUpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9tYXBwaW5ncy5hZGQoe1xuICAgICAgICBnZW5lcmF0ZWRMaW5lOiBnZW5lcmF0ZWQubGluZSxcbiAgICAgICAgZ2VuZXJhdGVkQ29sdW1uOiBnZW5lcmF0ZWQuY29sdW1uLFxuICAgICAgICBvcmlnaW5hbExpbmU6IG9yaWdpbmFsICE9IG51bGwgJiYgb3JpZ2luYWwubGluZSxcbiAgICAgICAgb3JpZ2luYWxDb2x1bW46IG9yaWdpbmFsICE9IG51bGwgJiYgb3JpZ2luYWwuY29sdW1uLFxuICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgbmFtZTogbmFtZVxuICAgICAgfSk7XG4gICAgfTtcblxuICAvKipcbiAgICogU2V0IHRoZSBzb3VyY2UgY29udGVudCBmb3IgYSBzb3VyY2UgZmlsZS5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuc2V0U291cmNlQ29udGVudCA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX3NldFNvdXJjZUNvbnRlbnQoYVNvdXJjZUZpbGUsIGFTb3VyY2VDb250ZW50KSB7XG4gICAgICB2YXIgc291cmNlID0gYVNvdXJjZUZpbGU7XG4gICAgICBpZiAodGhpcy5fc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgIHNvdXJjZSA9IHV0aWwucmVsYXRpdmUodGhpcy5fc291cmNlUm9vdCwgc291cmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFTb3VyY2VDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgLy8gQWRkIHRoZSBzb3VyY2UgY29udGVudCB0byB0aGUgX3NvdXJjZXNDb250ZW50cyBtYXAuXG4gICAgICAgIC8vIENyZWF0ZSBhIG5ldyBfc291cmNlc0NvbnRlbnRzIG1hcCBpZiB0aGUgcHJvcGVydHkgaXMgbnVsbC5cbiAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2VzQ29udGVudHMpIHtcbiAgICAgICAgICB0aGlzLl9zb3VyY2VzQ29udGVudHMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zb3VyY2VzQ29udGVudHNbdXRpbC50b1NldFN0cmluZyhzb3VyY2UpXSA9IGFTb3VyY2VDb250ZW50O1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9zb3VyY2VzQ29udGVudHMpIHtcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBzb3VyY2UgZmlsZSBmcm9tIHRoZSBfc291cmNlc0NvbnRlbnRzIG1hcC5cbiAgICAgICAgLy8gSWYgdGhlIF9zb3VyY2VzQ29udGVudHMgbWFwIGlzIGVtcHR5LCBzZXQgdGhlIHByb3BlcnR5IHRvIG51bGwuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zb3VyY2VzQ29udGVudHNbdXRpbC50b1NldFN0cmluZyhzb3VyY2UpXTtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX3NvdXJjZXNDb250ZW50cykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5fc291cmNlc0NvbnRlbnRzID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdGhlIG1hcHBpbmdzIG9mIGEgc3ViLXNvdXJjZS1tYXAgZm9yIGEgc3BlY2lmaWMgc291cmNlIGZpbGUgdG8gdGhlXG4gICAqIHNvdXJjZSBtYXAgYmVpbmcgZ2VuZXJhdGVkLiBFYWNoIG1hcHBpbmcgdG8gdGhlIHN1cHBsaWVkIHNvdXJjZSBmaWxlIGlzXG4gICAqIHJld3JpdHRlbiB1c2luZyB0aGUgc3VwcGxpZWQgc291cmNlIG1hcC4gTm90ZTogVGhlIHJlc29sdXRpb24gZm9yIHRoZVxuICAgKiByZXN1bHRpbmcgbWFwcGluZ3MgaXMgdGhlIG1pbmltaXVtIG9mIHRoaXMgbWFwIGFuZCB0aGUgc3VwcGxpZWQgbWFwLlxuICAgKlxuICAgKiBAcGFyYW0gYVNvdXJjZU1hcENvbnN1bWVyIFRoZSBzb3VyY2UgbWFwIHRvIGJlIGFwcGxpZWQuXG4gICAqIEBwYXJhbSBhU291cmNlRmlsZSBPcHRpb25hbC4gVGhlIGZpbGVuYW1lIG9mIHRoZSBzb3VyY2UgZmlsZS5cbiAgICogICAgICAgIElmIG9taXR0ZWQsIFNvdXJjZU1hcENvbnN1bWVyJ3MgZmlsZSBwcm9wZXJ0eSB3aWxsIGJlIHVzZWQuXG4gICAqIEBwYXJhbSBhU291cmNlTWFwUGF0aCBPcHRpb25hbC4gVGhlIGRpcm5hbWUgb2YgdGhlIHBhdGggdG8gdGhlIHNvdXJjZSBtYXBcbiAgICogICAgICAgIHRvIGJlIGFwcGxpZWQuIElmIHJlbGF0aXZlLCBpdCBpcyByZWxhdGl2ZSB0byB0aGUgU291cmNlTWFwQ29uc3VtZXIuXG4gICAqICAgICAgICBUaGlzIHBhcmFtZXRlciBpcyBuZWVkZWQgd2hlbiB0aGUgdHdvIHNvdXJjZSBtYXBzIGFyZW4ndCBpbiB0aGUgc2FtZVxuICAgKiAgICAgICAgZGlyZWN0b3J5LCBhbmQgdGhlIHNvdXJjZSBtYXAgdG8gYmUgYXBwbGllZCBjb250YWlucyByZWxhdGl2ZSBzb3VyY2VcbiAgICogICAgICAgIHBhdGhzLiBJZiBzbywgdGhvc2UgcmVsYXRpdmUgc291cmNlIHBhdGhzIG5lZWQgdG8gYmUgcmV3cml0dGVuXG4gICAqICAgICAgICByZWxhdGl2ZSB0byB0aGUgU291cmNlTWFwR2VuZXJhdG9yLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5hcHBseVNvdXJjZU1hcCA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX2FwcGx5U291cmNlTWFwKGFTb3VyY2VNYXBDb25zdW1lciwgYVNvdXJjZUZpbGUsIGFTb3VyY2VNYXBQYXRoKSB7XG4gICAgICB2YXIgc291cmNlRmlsZSA9IGFTb3VyY2VGaWxlO1xuICAgICAgLy8gSWYgYVNvdXJjZUZpbGUgaXMgb21pdHRlZCwgd2Ugd2lsbCB1c2UgdGhlIGZpbGUgcHJvcGVydHkgb2YgdGhlIFNvdXJjZU1hcFxuICAgICAgaWYgKGFTb3VyY2VGaWxlID09IG51bGwpIHtcbiAgICAgICAgaWYgKGFTb3VyY2VNYXBDb25zdW1lci5maWxlID09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5hcHBseVNvdXJjZU1hcCByZXF1aXJlcyBlaXRoZXIgYW4gZXhwbGljaXQgc291cmNlIGZpbGUsICcgK1xuICAgICAgICAgICAgJ29yIHRoZSBzb3VyY2UgbWFwXFwncyBcImZpbGVcIiBwcm9wZXJ0eS4gQm90aCB3ZXJlIG9taXR0ZWQuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlRmlsZSA9IGFTb3VyY2VNYXBDb25zdW1lci5maWxlO1xuICAgICAgfVxuICAgICAgdmFyIHNvdXJjZVJvb3QgPSB0aGlzLl9zb3VyY2VSb290O1xuICAgICAgLy8gTWFrZSBcInNvdXJjZUZpbGVcIiByZWxhdGl2ZSBpZiBhbiBhYnNvbHV0ZSBVcmwgaXMgcGFzc2VkLlxuICAgICAgaWYgKHNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBzb3VyY2VGaWxlID0gdXRpbC5yZWxhdGl2ZShzb3VyY2VSb290LCBzb3VyY2VGaWxlKTtcbiAgICAgIH1cbiAgICAgIC8vIEFwcGx5aW5nIHRoZSBTb3VyY2VNYXAgY2FuIGFkZCBhbmQgcmVtb3ZlIGl0ZW1zIGZyb20gdGhlIHNvdXJjZXMgYW5kXG4gICAgICAvLyB0aGUgbmFtZXMgYXJyYXkuXG4gICAgICB2YXIgbmV3U291cmNlcyA9IG5ldyBBcnJheVNldCgpO1xuICAgICAgdmFyIG5ld05hbWVzID0gbmV3IEFycmF5U2V0KCk7XG5cbiAgICAgIC8vIEZpbmQgbWFwcGluZ3MgZm9yIHRoZSBcInNvdXJjZUZpbGVcIlxuICAgICAgdGhpcy5fbWFwcGluZ3MudW5zb3J0ZWRGb3JFYWNoKGZ1bmN0aW9uIChtYXBwaW5nKSB7XG4gICAgICAgIGlmIChtYXBwaW5nLnNvdXJjZSA9PT0gc291cmNlRmlsZSAmJiBtYXBwaW5nLm9yaWdpbmFsTGluZSAhPSBudWxsKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgaWYgaXQgY2FuIGJlIG1hcHBlZCBieSB0aGUgc291cmNlIG1hcCwgdGhlbiB1cGRhdGUgdGhlIG1hcHBpbmcuXG4gICAgICAgICAgdmFyIG9yaWdpbmFsID0gYVNvdXJjZU1hcENvbnN1bWVyLm9yaWdpbmFsUG9zaXRpb25Gb3Ioe1xuICAgICAgICAgICAgbGluZTogbWFwcGluZy5vcmlnaW5hbExpbmUsXG4gICAgICAgICAgICBjb2x1bW46IG1hcHBpbmcub3JpZ2luYWxDb2x1bW5cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAob3JpZ2luYWwuc291cmNlICE9IG51bGwpIHtcbiAgICAgICAgICAgIC8vIENvcHkgbWFwcGluZ1xuICAgICAgICAgICAgbWFwcGluZy5zb3VyY2UgPSBvcmlnaW5hbC5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoYVNvdXJjZU1hcFBhdGggIT0gbnVsbCkge1xuICAgICAgICAgICAgICBtYXBwaW5nLnNvdXJjZSA9IHV0aWwuam9pbihhU291cmNlTWFwUGF0aCwgbWFwcGluZy5zb3VyY2UpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIG1hcHBpbmcuc291cmNlID0gdXRpbC5yZWxhdGl2ZShzb3VyY2VSb290LCBtYXBwaW5nLnNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsTGluZSA9IG9yaWdpbmFsLmxpbmU7XG4gICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uID0gb3JpZ2luYWwuY29sdW1uO1xuICAgICAgICAgICAgaWYgKG9yaWdpbmFsLm5hbWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBtYXBwaW5nLm5hbWUgPSBvcmlnaW5hbC5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzb3VyY2UgPSBtYXBwaW5nLnNvdXJjZTtcbiAgICAgICAgaWYgKHNvdXJjZSAhPSBudWxsICYmICFuZXdTb3VyY2VzLmhhcyhzb3VyY2UpKSB7XG4gICAgICAgICAgbmV3U291cmNlcy5hZGQoc291cmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBuYW1lID0gbWFwcGluZy5uYW1lO1xuICAgICAgICBpZiAobmFtZSAhPSBudWxsICYmICFuZXdOYW1lcy5oYXMobmFtZSkpIHtcbiAgICAgICAgICBuZXdOYW1lcy5hZGQobmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgfSwgdGhpcyk7XG4gICAgICB0aGlzLl9zb3VyY2VzID0gbmV3U291cmNlcztcbiAgICAgIHRoaXMuX25hbWVzID0gbmV3TmFtZXM7XG5cbiAgICAgIC8vIENvcHkgc291cmNlc0NvbnRlbnRzIG9mIGFwcGxpZWQgbWFwLlxuICAgICAgYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbiAoc291cmNlRmlsZSkge1xuICAgICAgICB2YXIgY29udGVudCA9IGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VDb250ZW50Rm9yKHNvdXJjZUZpbGUpO1xuICAgICAgICBpZiAoY29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKGFTb3VyY2VNYXBQYXRoICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNvdXJjZUZpbGUgPSB1dGlsLmpvaW4oYVNvdXJjZU1hcFBhdGgsIHNvdXJjZUZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBzb3VyY2VGaWxlID0gdXRpbC5yZWxhdGl2ZShzb3VyY2VSb290LCBzb3VyY2VGaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zZXRTb3VyY2VDb250ZW50KHNvdXJjZUZpbGUsIGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICB9LCB0aGlzKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBIG1hcHBpbmcgY2FuIGhhdmUgb25lIG9mIHRoZSB0aHJlZSBsZXZlbHMgb2YgZGF0YTpcbiAgICpcbiAgICogICAxLiBKdXN0IHRoZSBnZW5lcmF0ZWQgcG9zaXRpb24uXG4gICAqICAgMi4gVGhlIEdlbmVyYXRlZCBwb3NpdGlvbiwgb3JpZ2luYWwgcG9zaXRpb24sIGFuZCBvcmlnaW5hbCBzb3VyY2UuXG4gICAqICAgMy4gR2VuZXJhdGVkIGFuZCBvcmlnaW5hbCBwb3NpdGlvbiwgb3JpZ2luYWwgc291cmNlLCBhcyB3ZWxsIGFzIGEgbmFtZVxuICAgKiAgICAgIHRva2VuLlxuICAgKlxuICAgKiBUbyBtYWludGFpbiBjb25zaXN0ZW5jeSwgd2UgdmFsaWRhdGUgdGhhdCBhbnkgbmV3IG1hcHBpbmcgYmVpbmcgYWRkZWQgZmFsbHNcbiAgICogaW4gdG8gb25lIG9mIHRoZXNlIGNhdGVnb3JpZXMuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLl92YWxpZGF0ZU1hcHBpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl92YWxpZGF0ZU1hcHBpbmcoYUdlbmVyYXRlZCwgYU9yaWdpbmFsLCBhU291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYU5hbWUpIHtcbiAgICAgIGlmIChhR2VuZXJhdGVkICYmICdsaW5lJyBpbiBhR2VuZXJhdGVkICYmICdjb2x1bW4nIGluIGFHZW5lcmF0ZWRcbiAgICAgICAgICAmJiBhR2VuZXJhdGVkLmxpbmUgPiAwICYmIGFHZW5lcmF0ZWQuY29sdW1uID49IDBcbiAgICAgICAgICAmJiAhYU9yaWdpbmFsICYmICFhU291cmNlICYmICFhTmFtZSkge1xuICAgICAgICAvLyBDYXNlIDEuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGFHZW5lcmF0ZWQgJiYgJ2xpbmUnIGluIGFHZW5lcmF0ZWQgJiYgJ2NvbHVtbicgaW4gYUdlbmVyYXRlZFxuICAgICAgICAgICAgICAgJiYgYU9yaWdpbmFsICYmICdsaW5lJyBpbiBhT3JpZ2luYWwgJiYgJ2NvbHVtbicgaW4gYU9yaWdpbmFsXG4gICAgICAgICAgICAgICAmJiBhR2VuZXJhdGVkLmxpbmUgPiAwICYmIGFHZW5lcmF0ZWQuY29sdW1uID49IDBcbiAgICAgICAgICAgICAgICYmIGFPcmlnaW5hbC5saW5lID4gMCAmJiBhT3JpZ2luYWwuY29sdW1uID49IDBcbiAgICAgICAgICAgICAgICYmIGFTb3VyY2UpIHtcbiAgICAgICAgLy8gQ2FzZXMgMiBhbmQgMy5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBtYXBwaW5nOiAnICsgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGdlbmVyYXRlZDogYUdlbmVyYXRlZCxcbiAgICAgICAgICBzb3VyY2U6IGFTb3VyY2UsXG4gICAgICAgICAgb3JpZ2luYWw6IGFPcmlnaW5hbCxcbiAgICAgICAgICBuYW1lOiBhTmFtZVxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogU2VyaWFsaXplIHRoZSBhY2N1bXVsYXRlZCBtYXBwaW5ncyBpbiB0byB0aGUgc3RyZWFtIG9mIGJhc2UgNjQgVkxRc1xuICAgKiBzcGVjaWZpZWQgYnkgdGhlIHNvdXJjZSBtYXAgZm9ybWF0LlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5fc2VyaWFsaXplTWFwcGluZ3MgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9zZXJpYWxpemVNYXBwaW5ncygpIHtcbiAgICAgIHZhciBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNHZW5lcmF0ZWRMaW5lID0gMTtcbiAgICAgIHZhciBwcmV2aW91c09yaWdpbmFsQ29sdW1uID0gMDtcbiAgICAgIHZhciBwcmV2aW91c09yaWdpbmFsTGluZSA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNOYW1lID0gMDtcbiAgICAgIHZhciBwcmV2aW91c1NvdXJjZSA9IDA7XG4gICAgICB2YXIgcmVzdWx0ID0gJyc7XG4gICAgICB2YXIgbWFwcGluZztcblxuICAgICAgdmFyIG1hcHBpbmdzID0gdGhpcy5fbWFwcGluZ3MudG9BcnJheSgpO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gbWFwcGluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgbWFwcGluZyA9IG1hcHBpbmdzW2ldO1xuXG4gICAgICAgIGlmIChtYXBwaW5nLmdlbmVyYXRlZExpbmUgIT09IHByZXZpb3VzR2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gMDtcbiAgICAgICAgICB3aGlsZSAobWFwcGluZy5nZW5lcmF0ZWRMaW5lICE9PSBwcmV2aW91c0dlbmVyYXRlZExpbmUpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSAnOyc7XG4gICAgICAgICAgICBwcmV2aW91c0dlbmVyYXRlZExpbmUrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICBpZiAoIXV0aWwuY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zKG1hcHBpbmcsIG1hcHBpbmdzW2kgLSAxXSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQgKz0gJywnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdCArPSBiYXNlNjRWTFEuZW5jb2RlKG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4pO1xuICAgICAgICBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uO1xuXG4gICAgICAgIGlmIChtYXBwaW5nLnNvdXJjZSAhPSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0ICs9IGJhc2U2NFZMUS5lbmNvZGUodGhpcy5fc291cmNlcy5pbmRleE9mKG1hcHBpbmcuc291cmNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gcHJldmlvdXNTb3VyY2UpO1xuICAgICAgICAgIHByZXZpb3VzU291cmNlID0gdGhpcy5fc291cmNlcy5pbmRleE9mKG1hcHBpbmcuc291cmNlKTtcblxuICAgICAgICAgIC8vIGxpbmVzIGFyZSBzdG9yZWQgMC1iYXNlZCBpbiBTb3VyY2VNYXAgc3BlYyB2ZXJzaW9uIDNcbiAgICAgICAgICByZXN1bHQgKz0gYmFzZTY0VkxRLmVuY29kZShtYXBwaW5nLm9yaWdpbmFsTGluZSAtIDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtIHByZXZpb3VzT3JpZ2luYWxMaW5lKTtcbiAgICAgICAgICBwcmV2aW91c09yaWdpbmFsTGluZSA9IG1hcHBpbmcub3JpZ2luYWxMaW5lIC0gMTtcblxuICAgICAgICAgIHJlc3VsdCArPSBiYXNlNjRWTFEuZW5jb2RlKG1hcHBpbmcub3JpZ2luYWxDb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4pO1xuICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uO1xuXG4gICAgICAgICAgaWYgKG1hcHBpbmcubmFtZSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gYmFzZTY0VkxRLmVuY29kZSh0aGlzLl9uYW1lcy5pbmRleE9mKG1hcHBpbmcubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gcHJldmlvdXNOYW1lKTtcbiAgICAgICAgICAgIHByZXZpb3VzTmFtZSA9IHRoaXMuX25hbWVzLmluZGV4T2YobWFwcGluZy5uYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuX2dlbmVyYXRlU291cmNlc0NvbnRlbnQgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9nZW5lcmF0ZVNvdXJjZXNDb250ZW50KGFTb3VyY2VzLCBhU291cmNlUm9vdCkge1xuICAgICAgcmV0dXJuIGFTb3VyY2VzLm1hcChmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgIGlmICghdGhpcy5fc291cmNlc0NvbnRlbnRzKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFTb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICBzb3VyY2UgPSB1dGlsLnJlbGF0aXZlKGFTb3VyY2VSb290LCBzb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXkgPSB1dGlsLnRvU2V0U3RyaW5nKHNvdXJjZSk7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5fc291cmNlc0NvbnRlbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSlcbiAgICAgICAgICA/IHRoaXMuX3NvdXJjZXNDb250ZW50c1trZXldXG4gICAgICAgICAgOiBudWxsO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfTtcblxuICAvKipcbiAgICogRXh0ZXJuYWxpemUgdGhlIHNvdXJjZSBtYXAuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLnRvSlNPTiA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX3RvSlNPTigpIHtcbiAgICAgIHZhciBtYXAgPSB7XG4gICAgICAgIHZlcnNpb246IHRoaXMuX3ZlcnNpb24sXG4gICAgICAgIHNvdXJjZXM6IHRoaXMuX3NvdXJjZXMudG9BcnJheSgpLFxuICAgICAgICBuYW1lczogdGhpcy5fbmFtZXMudG9BcnJheSgpLFxuICAgICAgICBtYXBwaW5nczogdGhpcy5fc2VyaWFsaXplTWFwcGluZ3MoKVxuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9maWxlICE9IG51bGwpIHtcbiAgICAgICAgbWFwLmZpbGUgPSB0aGlzLl9maWxlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX3NvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBtYXAuc291cmNlUm9vdCA9IHRoaXMuX3NvdXJjZVJvb3Q7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fc291cmNlc0NvbnRlbnRzKSB7XG4gICAgICAgIG1hcC5zb3VyY2VzQ29udGVudCA9IHRoaXMuX2dlbmVyYXRlU291cmNlc0NvbnRlbnQobWFwLnNvdXJjZXMsIG1hcC5zb3VyY2VSb290KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1hcDtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXIgdGhlIHNvdXJjZSBtYXAgYmVpbmcgZ2VuZXJhdGVkIHRvIGEgc3RyaW5nLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS50b1N0cmluZyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX3RvU3RyaW5nKCkge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMpO1xuICAgIH07XG5cbiAgZXhwb3J0cy5Tb3VyY2VNYXBHZW5lcmF0b3IgPSBTb3VyY2VNYXBHZW5lcmF0b3I7XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICB2YXIgU291cmNlTWFwR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9zb3VyY2UtbWFwLWdlbmVyYXRvcicpLlNvdXJjZU1hcEdlbmVyYXRvcjtcbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICAvLyBNYXRjaGVzIGEgV2luZG93cy1zdHlsZSBgXFxyXFxuYCBuZXdsaW5lIG9yIGEgYFxcbmAgbmV3bGluZSB1c2VkIGJ5IGFsbCBvdGhlclxuICAvLyBvcGVyYXRpbmcgc3lzdGVtcyB0aGVzZSBkYXlzIChjYXB0dXJpbmcgdGhlIHJlc3VsdCkuXG4gIHZhciBSRUdFWF9ORVdMSU5FID0gLyhcXHI/XFxuKS87XG5cbiAgLy8gTmV3bGluZSBjaGFyYWN0ZXIgY29kZSBmb3IgY2hhckNvZGVBdCgpIGNvbXBhcmlzb25zXG4gIHZhciBORVdMSU5FX0NPREUgPSAxMDtcblxuICAvLyBQcml2YXRlIHN5bWJvbCBmb3IgaWRlbnRpZnlpbmcgYFNvdXJjZU5vZGVgcyB3aGVuIG11bHRpcGxlIHZlcnNpb25zIG9mXG4gIC8vIHRoZSBzb3VyY2UtbWFwIGxpYnJhcnkgYXJlIGxvYWRlZC4gVGhpcyBNVVNUIE5PVCBDSEFOR0UgYWNyb3NzXG4gIC8vIHZlcnNpb25zIVxuICB2YXIgaXNTb3VyY2VOb2RlID0gXCIkJCRpc1NvdXJjZU5vZGUkJCRcIjtcblxuICAvKipcbiAgICogU291cmNlTm9kZXMgcHJvdmlkZSBhIHdheSB0byBhYnN0cmFjdCBvdmVyIGludGVycG9sYXRpbmcvY29uY2F0ZW5hdGluZ1xuICAgKiBzbmlwcGV0cyBvZiBnZW5lcmF0ZWQgSmF2YVNjcmlwdCBzb3VyY2UgY29kZSB3aGlsZSBtYWludGFpbmluZyB0aGUgbGluZSBhbmRcbiAgICogY29sdW1uIGluZm9ybWF0aW9uIGFzc29jaWF0ZWQgd2l0aCB0aGUgb3JpZ2luYWwgc291cmNlIGNvZGUuXG4gICAqXG4gICAqIEBwYXJhbSBhTGluZSBUaGUgb3JpZ2luYWwgbGluZSBudW1iZXIuXG4gICAqIEBwYXJhbSBhQ29sdW1uIFRoZSBvcmlnaW5hbCBjb2x1bW4gbnVtYmVyLlxuICAgKiBAcGFyYW0gYVNvdXJjZSBUaGUgb3JpZ2luYWwgc291cmNlJ3MgZmlsZW5hbWUuXG4gICAqIEBwYXJhbSBhQ2h1bmtzIE9wdGlvbmFsLiBBbiBhcnJheSBvZiBzdHJpbmdzIHdoaWNoIGFyZSBzbmlwcGV0cyBvZlxuICAgKiAgICAgICAgZ2VuZXJhdGVkIEpTLCBvciBvdGhlciBTb3VyY2VOb2Rlcy5cbiAgICogQHBhcmFtIGFOYW1lIFRoZSBvcmlnaW5hbCBpZGVudGlmaWVyLlxuICAgKi9cbiAgZnVuY3Rpb24gU291cmNlTm9kZShhTGluZSwgYUNvbHVtbiwgYVNvdXJjZSwgYUNodW5rcywgYU5hbWUpIHtcbiAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgdGhpcy5zb3VyY2VDb250ZW50cyA9IHt9O1xuICAgIHRoaXMubGluZSA9IGFMaW5lID09IG51bGwgPyBudWxsIDogYUxpbmU7XG4gICAgdGhpcy5jb2x1bW4gPSBhQ29sdW1uID09IG51bGwgPyBudWxsIDogYUNvbHVtbjtcbiAgICB0aGlzLnNvdXJjZSA9IGFTb3VyY2UgPT0gbnVsbCA/IG51bGwgOiBhU291cmNlO1xuICAgIHRoaXMubmFtZSA9IGFOYW1lID09IG51bGwgPyBudWxsIDogYU5hbWU7XG4gICAgdGhpc1tpc1NvdXJjZU5vZGVdID0gdHJ1ZTtcbiAgICBpZiAoYUNodW5rcyAhPSBudWxsKSB0aGlzLmFkZChhQ2h1bmtzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgU291cmNlTm9kZSBmcm9tIGdlbmVyYXRlZCBjb2RlIGFuZCBhIFNvdXJjZU1hcENvbnN1bWVyLlxuICAgKlxuICAgKiBAcGFyYW0gYUdlbmVyYXRlZENvZGUgVGhlIGdlbmVyYXRlZCBjb2RlXG4gICAqIEBwYXJhbSBhU291cmNlTWFwQ29uc3VtZXIgVGhlIFNvdXJjZU1hcCBmb3IgdGhlIGdlbmVyYXRlZCBjb2RlXG4gICAqIEBwYXJhbSBhUmVsYXRpdmVQYXRoIE9wdGlvbmFsLiBUaGUgcGF0aCB0aGF0IHJlbGF0aXZlIHNvdXJjZXMgaW4gdGhlXG4gICAqICAgICAgICBTb3VyY2VNYXBDb25zdW1lciBzaG91bGQgYmUgcmVsYXRpdmUgdG8uXG4gICAqL1xuICBTb3VyY2VOb2RlLmZyb21TdHJpbmdXaXRoU291cmNlTWFwID1cbiAgICBmdW5jdGlvbiBTb3VyY2VOb2RlX2Zyb21TdHJpbmdXaXRoU291cmNlTWFwKGFHZW5lcmF0ZWRDb2RlLCBhU291cmNlTWFwQ29uc3VtZXIsIGFSZWxhdGl2ZVBhdGgpIHtcbiAgICAgIC8vIFRoZSBTb3VyY2VOb2RlIHdlIHdhbnQgdG8gZmlsbCB3aXRoIHRoZSBnZW5lcmF0ZWQgY29kZVxuICAgICAgLy8gYW5kIHRoZSBTb3VyY2VNYXBcbiAgICAgIHZhciBub2RlID0gbmV3IFNvdXJjZU5vZGUoKTtcblxuICAgICAgLy8gQWxsIGV2ZW4gaW5kaWNlcyBvZiB0aGlzIGFycmF5IGFyZSBvbmUgbGluZSBvZiB0aGUgZ2VuZXJhdGVkIGNvZGUsXG4gICAgICAvLyB3aGlsZSBhbGwgb2RkIGluZGljZXMgYXJlIHRoZSBuZXdsaW5lcyBiZXR3ZWVuIHR3byBhZGphY2VudCBsaW5lc1xuICAgICAgLy8gKHNpbmNlIGBSRUdFWF9ORVdMSU5FYCBjYXB0dXJlcyBpdHMgbWF0Y2gpLlxuICAgICAgLy8gUHJvY2Vzc2VkIGZyYWdtZW50cyBhcmUgcmVtb3ZlZCBmcm9tIHRoaXMgYXJyYXksIGJ5IGNhbGxpbmcgYHNoaWZ0TmV4dExpbmVgLlxuICAgICAgdmFyIHJlbWFpbmluZ0xpbmVzID0gYUdlbmVyYXRlZENvZGUuc3BsaXQoUkVHRVhfTkVXTElORSk7XG4gICAgICB2YXIgc2hpZnROZXh0TGluZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbGluZUNvbnRlbnRzID0gcmVtYWluaW5nTGluZXMuc2hpZnQoKTtcbiAgICAgICAgLy8gVGhlIGxhc3QgbGluZSBvZiBhIGZpbGUgbWlnaHQgbm90IGhhdmUgYSBuZXdsaW5lLlxuICAgICAgICB2YXIgbmV3TGluZSA9IHJlbWFpbmluZ0xpbmVzLnNoaWZ0KCkgfHwgXCJcIjtcbiAgICAgICAgcmV0dXJuIGxpbmVDb250ZW50cyArIG5ld0xpbmU7XG4gICAgICB9O1xuXG4gICAgICAvLyBXZSBuZWVkIHRvIHJlbWVtYmVyIHRoZSBwb3NpdGlvbiBvZiBcInJlbWFpbmluZ0xpbmVzXCJcbiAgICAgIHZhciBsYXN0R2VuZXJhdGVkTGluZSA9IDEsIGxhc3RHZW5lcmF0ZWRDb2x1bW4gPSAwO1xuXG4gICAgICAvLyBUaGUgZ2VuZXJhdGUgU291cmNlTm9kZXMgd2UgbmVlZCBhIGNvZGUgcmFuZ2UuXG4gICAgICAvLyBUbyBleHRyYWN0IGl0IGN1cnJlbnQgYW5kIGxhc3QgbWFwcGluZyBpcyB1c2VkLlxuICAgICAgLy8gSGVyZSB3ZSBzdG9yZSB0aGUgbGFzdCBtYXBwaW5nLlxuICAgICAgdmFyIGxhc3RNYXBwaW5nID0gbnVsbDtcblxuICAgICAgYVNvdXJjZU1hcENvbnN1bWVyLmVhY2hNYXBwaW5nKGZ1bmN0aW9uIChtYXBwaW5nKSB7XG4gICAgICAgIGlmIChsYXN0TWFwcGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIFdlIGFkZCB0aGUgY29kZSBmcm9tIFwibGFzdE1hcHBpbmdcIiB0byBcIm1hcHBpbmdcIjpcbiAgICAgICAgICAvLyBGaXJzdCBjaGVjayBpZiB0aGVyZSBpcyBhIG5ldyBsaW5lIGluIGJldHdlZW4uXG4gICAgICAgICAgaWYgKGxhc3RHZW5lcmF0ZWRMaW5lIDwgbWFwcGluZy5nZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgICB2YXIgY29kZSA9IFwiXCI7XG4gICAgICAgICAgICAvLyBBc3NvY2lhdGUgZmlyc3QgbGluZSB3aXRoIFwibGFzdE1hcHBpbmdcIlxuICAgICAgICAgICAgYWRkTWFwcGluZ1dpdGhDb2RlKGxhc3RNYXBwaW5nLCBzaGlmdE5leHRMaW5lKCkpO1xuICAgICAgICAgICAgbGFzdEdlbmVyYXRlZExpbmUrKztcbiAgICAgICAgICAgIGxhc3RHZW5lcmF0ZWRDb2x1bW4gPSAwO1xuICAgICAgICAgICAgLy8gVGhlIHJlbWFpbmluZyBjb2RlIGlzIGFkZGVkIHdpdGhvdXQgbWFwcGluZ1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGVyZSBpcyBubyBuZXcgbGluZSBpbiBiZXR3ZWVuLlxuICAgICAgICAgICAgLy8gQXNzb2NpYXRlIHRoZSBjb2RlIGJldHdlZW4gXCJsYXN0R2VuZXJhdGVkQ29sdW1uXCIgYW5kXG4gICAgICAgICAgICAvLyBcIm1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uXCIgd2l0aCBcImxhc3RNYXBwaW5nXCJcbiAgICAgICAgICAgIHZhciBuZXh0TGluZSA9IHJlbWFpbmluZ0xpbmVzWzBdO1xuICAgICAgICAgICAgdmFyIGNvZGUgPSBuZXh0TGluZS5zdWJzdHIoMCwgbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4gLVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEdlbmVyYXRlZENvbHVtbik7XG4gICAgICAgICAgICByZW1haW5pbmdMaW5lc1swXSA9IG5leHRMaW5lLnN1YnN0cihtYXBwaW5nLmdlbmVyYXRlZENvbHVtbiAtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0R2VuZXJhdGVkQ29sdW1uKTtcbiAgICAgICAgICAgIGxhc3RHZW5lcmF0ZWRDb2x1bW4gPSBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbjtcbiAgICAgICAgICAgIGFkZE1hcHBpbmdXaXRoQ29kZShsYXN0TWFwcGluZywgY29kZSk7XG4gICAgICAgICAgICAvLyBObyBtb3JlIHJlbWFpbmluZyBjb2RlLCBjb250aW51ZVxuICAgICAgICAgICAgbGFzdE1hcHBpbmcgPSBtYXBwaW5nO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBXZSBhZGQgdGhlIGdlbmVyYXRlZCBjb2RlIHVudGlsIHRoZSBmaXJzdCBtYXBwaW5nXG4gICAgICAgIC8vIHRvIHRoZSBTb3VyY2VOb2RlIHdpdGhvdXQgYW55IG1hcHBpbmcuXG4gICAgICAgIC8vIEVhY2ggbGluZSBpcyBhZGRlZCBhcyBzZXBhcmF0ZSBzdHJpbmcuXG4gICAgICAgIHdoaWxlIChsYXN0R2VuZXJhdGVkTGluZSA8IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgIG5vZGUuYWRkKHNoaWZ0TmV4dExpbmUoKSk7XG4gICAgICAgICAgbGFzdEdlbmVyYXRlZExpbmUrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAobGFzdEdlbmVyYXRlZENvbHVtbiA8IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uKSB7XG4gICAgICAgICAgdmFyIG5leHRMaW5lID0gcmVtYWluaW5nTGluZXNbMF07XG4gICAgICAgICAgbm9kZS5hZGQobmV4dExpbmUuc3Vic3RyKDAsIG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uKSk7XG4gICAgICAgICAgcmVtYWluaW5nTGluZXNbMF0gPSBuZXh0TGluZS5zdWJzdHIobWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4pO1xuICAgICAgICAgIGxhc3RHZW5lcmF0ZWRDb2x1bW4gPSBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbjtcbiAgICAgICAgfVxuICAgICAgICBsYXN0TWFwcGluZyA9IG1hcHBpbmc7XG4gICAgICB9LCB0aGlzKTtcbiAgICAgIC8vIFdlIGhhdmUgcHJvY2Vzc2VkIGFsbCBtYXBwaW5ncy5cbiAgICAgIGlmIChyZW1haW5pbmdMaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmIChsYXN0TWFwcGluZykge1xuICAgICAgICAgIC8vIEFzc29jaWF0ZSB0aGUgcmVtYWluaW5nIGNvZGUgaW4gdGhlIGN1cnJlbnQgbGluZSB3aXRoIFwibGFzdE1hcHBpbmdcIlxuICAgICAgICAgIGFkZE1hcHBpbmdXaXRoQ29kZShsYXN0TWFwcGluZywgc2hpZnROZXh0TGluZSgpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhbmQgYWRkIHRoZSByZW1haW5pbmcgbGluZXMgd2l0aG91dCBhbnkgbWFwcGluZ1xuICAgICAgICBub2RlLmFkZChyZW1haW5pbmdMaW5lcy5qb2luKFwiXCIpKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ29weSBzb3VyY2VzQ29udGVudCBpbnRvIFNvdXJjZU5vZGVcbiAgICAgIGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZUZpbGUpIHtcbiAgICAgICAgdmFyIGNvbnRlbnQgPSBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlQ29udGVudEZvcihzb3VyY2VGaWxlKTtcbiAgICAgICAgaWYgKGNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIGlmIChhUmVsYXRpdmVQYXRoICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNvdXJjZUZpbGUgPSB1dGlsLmpvaW4oYVJlbGF0aXZlUGF0aCwgc291cmNlRmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5vZGUuc2V0U291cmNlQ29udGVudChzb3VyY2VGaWxlLCBjb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBub2RlO1xuXG4gICAgICBmdW5jdGlvbiBhZGRNYXBwaW5nV2l0aENvZGUobWFwcGluZywgY29kZSkge1xuICAgICAgICBpZiAobWFwcGluZyA9PT0gbnVsbCB8fCBtYXBwaW5nLnNvdXJjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbm9kZS5hZGQoY29kZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHNvdXJjZSA9IGFSZWxhdGl2ZVBhdGhcbiAgICAgICAgICAgID8gdXRpbC5qb2luKGFSZWxhdGl2ZVBhdGgsIG1hcHBpbmcuc291cmNlKVxuICAgICAgICAgICAgOiBtYXBwaW5nLnNvdXJjZTtcbiAgICAgICAgICBub2RlLmFkZChuZXcgU291cmNlTm9kZShtYXBwaW5nLm9yaWdpbmFsTGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmcubmFtZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogQWRkIGEgY2h1bmsgb2YgZ2VuZXJhdGVkIEpTIHRvIHRoaXMgc291cmNlIG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSBhQ2h1bmsgQSBzdHJpbmcgc25pcHBldCBvZiBnZW5lcmF0ZWQgSlMgY29kZSwgYW5vdGhlciBpbnN0YW5jZSBvZlxuICAgKiAgICAgICAgU291cmNlTm9kZSwgb3IgYW4gYXJyYXkgd2hlcmUgZWFjaCBtZW1iZXIgaXMgb25lIG9mIHRob3NlIHRoaW5ncy5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfYWRkKGFDaHVuaykge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGFDaHVuaykpIHtcbiAgICAgIGFDaHVuay5mb3JFYWNoKGZ1bmN0aW9uIChjaHVuaykge1xuICAgICAgICB0aGlzLmFkZChjaHVuayk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoYUNodW5rW2lzU291cmNlTm9kZV0gfHwgdHlwZW9mIGFDaHVuayA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgaWYgKGFDaHVuaykge1xuICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2goYUNodW5rKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIkV4cGVjdGVkIGEgU291cmNlTm9kZSwgc3RyaW5nLCBvciBhbiBhcnJheSBvZiBTb3VyY2VOb2RlcyBhbmQgc3RyaW5ncy4gR290IFwiICsgYUNodW5rXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQWRkIGEgY2h1bmsgb2YgZ2VuZXJhdGVkIEpTIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhpcyBzb3VyY2Ugbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIGFDaHVuayBBIHN0cmluZyBzbmlwcGV0IG9mIGdlbmVyYXRlZCBKUyBjb2RlLCBhbm90aGVyIGluc3RhbmNlIG9mXG4gICAqICAgICAgICBTb3VyY2VOb2RlLCBvciBhbiBhcnJheSB3aGVyZSBlYWNoIG1lbWJlciBpcyBvbmUgb2YgdGhvc2UgdGhpbmdzLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUucHJlcGVuZCA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfcHJlcGVuZChhQ2h1bmspIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShhQ2h1bmspKSB7XG4gICAgICBmb3IgKHZhciBpID0gYUNodW5rLmxlbmd0aC0xOyBpID49IDA7IGktLSkge1xuICAgICAgICB0aGlzLnByZXBlbmQoYUNodW5rW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoYUNodW5rW2lzU291cmNlTm9kZV0gfHwgdHlwZW9mIGFDaHVuayA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy5jaGlsZHJlbi51bnNoaWZ0KGFDaHVuayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgXCJFeHBlY3RlZCBhIFNvdXJjZU5vZGUsIHN0cmluZywgb3IgYW4gYXJyYXkgb2YgU291cmNlTm9kZXMgYW5kIHN0cmluZ3MuIEdvdCBcIiArIGFDaHVua1xuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIFdhbGsgb3ZlciB0aGUgdHJlZSBvZiBKUyBzbmlwcGV0cyBpbiB0aGlzIG5vZGUgYW5kIGl0cyBjaGlsZHJlbi4gVGhlXG4gICAqIHdhbGtpbmcgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIGVhY2ggc25pcHBldCBvZiBKUyBhbmQgaXMgcGFzc2VkIHRoYXRcbiAgICogc25pcHBldCBhbmQgdGhlIGl0cyBvcmlnaW5hbCBhc3NvY2lhdGVkIHNvdXJjZSdzIGxpbmUvY29sdW1uIGxvY2F0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gYUZuIFRoZSB0cmF2ZXJzYWwgZnVuY3Rpb24uXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS53YWxrID0gZnVuY3Rpb24gU291cmNlTm9kZV93YWxrKGFGbikge1xuICAgIHZhciBjaHVuaztcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgY2h1bmsgPSB0aGlzLmNoaWxkcmVuW2ldO1xuICAgICAgaWYgKGNodW5rW2lzU291cmNlTm9kZV0pIHtcbiAgICAgICAgY2h1bmsud2FsayhhRm4pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChjaHVuayAhPT0gJycpIHtcbiAgICAgICAgICBhRm4oY2h1bmssIHsgc291cmNlOiB0aGlzLnNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgbGluZTogdGhpcy5saW5lLFxuICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW46IHRoaXMuY29sdW1uLFxuICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0aGlzLm5hbWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIExpa2UgYFN0cmluZy5wcm90b3R5cGUuam9pbmAgZXhjZXB0IGZvciBTb3VyY2VOb2Rlcy4gSW5zZXJ0cyBgYVN0cmAgYmV0d2VlblxuICAgKiBlYWNoIG9mIGB0aGlzLmNoaWxkcmVuYC5cbiAgICpcbiAgICogQHBhcmFtIGFTZXAgVGhlIHNlcGFyYXRvci5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLmpvaW4gPSBmdW5jdGlvbiBTb3VyY2VOb2RlX2pvaW4oYVNlcCkge1xuICAgIHZhciBuZXdDaGlsZHJlbjtcbiAgICB2YXIgaTtcbiAgICB2YXIgbGVuID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7XG4gICAgaWYgKGxlbiA+IDApIHtcbiAgICAgIG5ld0NoaWxkcmVuID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuLTE7IGkrKykge1xuICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKHRoaXMuY2hpbGRyZW5baV0pO1xuICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKGFTZXApO1xuICAgICAgfVxuICAgICAgbmV3Q2hpbGRyZW4ucHVzaCh0aGlzLmNoaWxkcmVuW2ldKTtcbiAgICAgIHRoaXMuY2hpbGRyZW4gPSBuZXdDaGlsZHJlbjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGwgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlIG9uIHRoZSB2ZXJ5IHJpZ2h0LW1vc3Qgc291cmNlIHNuaXBwZXQuIFVzZWZ1bFxuICAgKiBmb3IgdHJpbW1pbmcgd2hpdGVzcGFjZSBmcm9tIHRoZSBlbmQgb2YgYSBzb3VyY2Ugbm9kZSwgZXRjLlxuICAgKlxuICAgKiBAcGFyYW0gYVBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gcmVwbGFjZS5cbiAgICogQHBhcmFtIGFSZXBsYWNlbWVudCBUaGUgdGhpbmcgdG8gcmVwbGFjZSB0aGUgcGF0dGVybiB3aXRoLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUucmVwbGFjZVJpZ2h0ID0gZnVuY3Rpb24gU291cmNlTm9kZV9yZXBsYWNlUmlnaHQoYVBhdHRlcm4sIGFSZXBsYWNlbWVudCkge1xuICAgIHZhciBsYXN0Q2hpbGQgPSB0aGlzLmNoaWxkcmVuW3RoaXMuY2hpbGRyZW4ubGVuZ3RoIC0gMV07XG4gICAgaWYgKGxhc3RDaGlsZFtpc1NvdXJjZU5vZGVdKSB7XG4gICAgICBsYXN0Q2hpbGQucmVwbGFjZVJpZ2h0KGFQYXR0ZXJuLCBhUmVwbGFjZW1lbnQpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgbGFzdENoaWxkID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5jaGlsZHJlblt0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDFdID0gbGFzdENoaWxkLnJlcGxhY2UoYVBhdHRlcm4sIGFSZXBsYWNlbWVudCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKCcnLnJlcGxhY2UoYVBhdHRlcm4sIGFSZXBsYWNlbWVudCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogU2V0IHRoZSBzb3VyY2UgY29udGVudCBmb3IgYSBzb3VyY2UgZmlsZS4gVGhpcyB3aWxsIGJlIGFkZGVkIHRvIHRoZSBTb3VyY2VNYXBHZW5lcmF0b3JcbiAgICogaW4gdGhlIHNvdXJjZXNDb250ZW50IGZpZWxkLlxuICAgKlxuICAgKiBAcGFyYW0gYVNvdXJjZUZpbGUgVGhlIGZpbGVuYW1lIG9mIHRoZSBzb3VyY2UgZmlsZVxuICAgKiBAcGFyYW0gYVNvdXJjZUNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhlIHNvdXJjZSBmaWxlXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS5zZXRTb3VyY2VDb250ZW50ID1cbiAgICBmdW5jdGlvbiBTb3VyY2VOb2RlX3NldFNvdXJjZUNvbnRlbnQoYVNvdXJjZUZpbGUsIGFTb3VyY2VDb250ZW50KSB7XG4gICAgICB0aGlzLnNvdXJjZUNvbnRlbnRzW3V0aWwudG9TZXRTdHJpbmcoYVNvdXJjZUZpbGUpXSA9IGFTb3VyY2VDb250ZW50O1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFdhbGsgb3ZlciB0aGUgdHJlZSBvZiBTb3VyY2VOb2Rlcy4gVGhlIHdhbGtpbmcgZnVuY3Rpb24gaXMgY2FsbGVkIGZvciBlYWNoXG4gICAqIHNvdXJjZSBmaWxlIGNvbnRlbnQgYW5kIGlzIHBhc3NlZCB0aGUgZmlsZW5hbWUgYW5kIHNvdXJjZSBjb250ZW50LlxuICAgKlxuICAgKiBAcGFyYW0gYUZuIFRoZSB0cmF2ZXJzYWwgZnVuY3Rpb24uXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS53YWxrU291cmNlQ29udGVudHMgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU5vZGVfd2Fsa1NvdXJjZUNvbnRlbnRzKGFGbikge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMuY2hpbGRyZW5baV1baXNTb3VyY2VOb2RlXSkge1xuICAgICAgICAgIHRoaXMuY2hpbGRyZW5baV0ud2Fsa1NvdXJjZUNvbnRlbnRzKGFGbik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIHNvdXJjZXMgPSBPYmplY3Qua2V5cyh0aGlzLnNvdXJjZUNvbnRlbnRzKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzb3VyY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGFGbih1dGlsLmZyb21TZXRTdHJpbmcoc291cmNlc1tpXSksIHRoaXMuc291cmNlQ29udGVudHNbc291cmNlc1tpXV0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc291cmNlIG5vZGUuIFdhbGtzIG92ZXIgdGhlIHRyZWVcbiAgICogYW5kIGNvbmNhdGVuYXRlcyBhbGwgdGhlIHZhcmlvdXMgc25pcHBldHMgdG9nZXRoZXIgdG8gb25lIHN0cmluZy5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gU291cmNlTm9kZV90b1N0cmluZygpIHtcbiAgICB2YXIgc3RyID0gXCJcIjtcbiAgICB0aGlzLndhbGsoZnVuY3Rpb24gKGNodW5rKSB7XG4gICAgICBzdHIgKz0gY2h1bms7XG4gICAgfSk7XG4gICAgcmV0dXJuIHN0cjtcbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc291cmNlIG5vZGUgYWxvbmcgd2l0aCBhIHNvdXJjZVxuICAgKiBtYXAuXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS50b1N0cmluZ1dpdGhTb3VyY2VNYXAgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX3RvU3RyaW5nV2l0aFNvdXJjZU1hcChhQXJncykge1xuICAgIHZhciBnZW5lcmF0ZWQgPSB7XG4gICAgICBjb2RlOiBcIlwiLFxuICAgICAgbGluZTogMSxcbiAgICAgIGNvbHVtbjogMFxuICAgIH07XG4gICAgdmFyIG1hcCA9IG5ldyBTb3VyY2VNYXBHZW5lcmF0b3IoYUFyZ3MpO1xuICAgIHZhciBzb3VyY2VNYXBwaW5nQWN0aXZlID0gZmFsc2U7XG4gICAgdmFyIGxhc3RPcmlnaW5hbFNvdXJjZSA9IG51bGw7XG4gICAgdmFyIGxhc3RPcmlnaW5hbExpbmUgPSBudWxsO1xuICAgIHZhciBsYXN0T3JpZ2luYWxDb2x1bW4gPSBudWxsO1xuICAgIHZhciBsYXN0T3JpZ2luYWxOYW1lID0gbnVsbDtcbiAgICB0aGlzLndhbGsoZnVuY3Rpb24gKGNodW5rLCBvcmlnaW5hbCkge1xuICAgICAgZ2VuZXJhdGVkLmNvZGUgKz0gY2h1bms7XG4gICAgICBpZiAob3JpZ2luYWwuc291cmNlICE9PSBudWxsXG4gICAgICAgICAgJiYgb3JpZ2luYWwubGluZSAhPT0gbnVsbFxuICAgICAgICAgICYmIG9yaWdpbmFsLmNvbHVtbiAhPT0gbnVsbCkge1xuICAgICAgICBpZihsYXN0T3JpZ2luYWxTb3VyY2UgIT09IG9yaWdpbmFsLnNvdXJjZVxuICAgICAgICAgICB8fCBsYXN0T3JpZ2luYWxMaW5lICE9PSBvcmlnaW5hbC5saW5lXG4gICAgICAgICAgIHx8IGxhc3RPcmlnaW5hbENvbHVtbiAhPT0gb3JpZ2luYWwuY29sdW1uXG4gICAgICAgICAgIHx8IGxhc3RPcmlnaW5hbE5hbWUgIT09IG9yaWdpbmFsLm5hbWUpIHtcbiAgICAgICAgICBtYXAuYWRkTWFwcGluZyh7XG4gICAgICAgICAgICBzb3VyY2U6IG9yaWdpbmFsLnNvdXJjZSxcbiAgICAgICAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgICAgICAgIGxpbmU6IG9yaWdpbmFsLmxpbmUsXG4gICAgICAgICAgICAgIGNvbHVtbjogb3JpZ2luYWwuY29sdW1uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgICAgICAgIGxpbmU6IGdlbmVyYXRlZC5saW5lLFxuICAgICAgICAgICAgICBjb2x1bW46IGdlbmVyYXRlZC5jb2x1bW5cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiBvcmlnaW5hbC5uYW1lXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGFzdE9yaWdpbmFsU291cmNlID0gb3JpZ2luYWwuc291cmNlO1xuICAgICAgICBsYXN0T3JpZ2luYWxMaW5lID0gb3JpZ2luYWwubGluZTtcbiAgICAgICAgbGFzdE9yaWdpbmFsQ29sdW1uID0gb3JpZ2luYWwuY29sdW1uO1xuICAgICAgICBsYXN0T3JpZ2luYWxOYW1lID0gb3JpZ2luYWwubmFtZTtcbiAgICAgICAgc291cmNlTWFwcGluZ0FjdGl2ZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHNvdXJjZU1hcHBpbmdBY3RpdmUpIHtcbiAgICAgICAgbWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgIGdlbmVyYXRlZDoge1xuICAgICAgICAgICAgbGluZTogZ2VuZXJhdGVkLmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IGdlbmVyYXRlZC5jb2x1bW5cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBsYXN0T3JpZ2luYWxTb3VyY2UgPSBudWxsO1xuICAgICAgICBzb3VyY2VNYXBwaW5nQWN0aXZlID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBpZHggPSAwLCBsZW5ndGggPSBjaHVuay5sZW5ndGg7IGlkeCA8IGxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgaWYgKGNodW5rLmNoYXJDb2RlQXQoaWR4KSA9PT0gTkVXTElORV9DT0RFKSB7XG4gICAgICAgICAgZ2VuZXJhdGVkLmxpbmUrKztcbiAgICAgICAgICBnZW5lcmF0ZWQuY29sdW1uID0gMDtcbiAgICAgICAgICAvLyBNYXBwaW5ncyBlbmQgYXQgZW9sXG4gICAgICAgICAgaWYgKGlkeCArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgICAgbGFzdE9yaWdpbmFsU291cmNlID0gbnVsbDtcbiAgICAgICAgICAgIHNvdXJjZU1hcHBpbmdBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZU1hcHBpbmdBY3RpdmUpIHtcbiAgICAgICAgICAgIG1hcC5hZGRNYXBwaW5nKHtcbiAgICAgICAgICAgICAgc291cmNlOiBvcmlnaW5hbC5zb3VyY2UsXG4gICAgICAgICAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgICAgICAgICAgbGluZTogb3JpZ2luYWwubGluZSxcbiAgICAgICAgICAgICAgICBjb2x1bW46IG9yaWdpbmFsLmNvbHVtblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBnZW5lcmF0ZWQ6IHtcbiAgICAgICAgICAgICAgICBsaW5lOiBnZW5lcmF0ZWQubGluZSxcbiAgICAgICAgICAgICAgICBjb2x1bW46IGdlbmVyYXRlZC5jb2x1bW5cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgbmFtZTogb3JpZ2luYWwubmFtZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGdlbmVyYXRlZC5jb2x1bW4rKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMud2Fsa1NvdXJjZUNvbnRlbnRzKGZ1bmN0aW9uIChzb3VyY2VGaWxlLCBzb3VyY2VDb250ZW50KSB7XG4gICAgICBtYXAuc2V0U291cmNlQ29udGVudChzb3VyY2VGaWxlLCBzb3VyY2VDb250ZW50KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7IGNvZGU6IGdlbmVyYXRlZC5jb2RlLCBtYXA6IG1hcCB9O1xuICB9O1xuXG4gIGV4cG9ydHMuU291cmNlTm9kZSA9IFNvdXJjZU5vZGU7XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICAvKipcbiAgICogVGhpcyBpcyBhIGhlbHBlciBmdW5jdGlvbiBmb3IgZ2V0dGluZyB2YWx1ZXMgZnJvbSBwYXJhbWV0ZXIvb3B0aW9uc1xuICAgKiBvYmplY3RzLlxuICAgKlxuICAgKiBAcGFyYW0gYXJncyBUaGUgb2JqZWN0IHdlIGFyZSBleHRyYWN0aW5nIHZhbHVlcyBmcm9tXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB3ZSBhcmUgZ2V0dGluZy5cbiAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSBBbiBvcHRpb25hbCB2YWx1ZSB0byByZXR1cm4gaWYgdGhlIHByb3BlcnR5IGlzIG1pc3NpbmdcbiAgICogZnJvbSB0aGUgb2JqZWN0LiBJZiB0aGlzIGlzIG5vdCBzcGVjaWZpZWQgYW5kIHRoZSBwcm9wZXJ0eSBpcyBtaXNzaW5nLCBhblxuICAgKiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAgICovXG4gIGZ1bmN0aW9uIGdldEFyZyhhQXJncywgYU5hbWUsIGFEZWZhdWx0VmFsdWUpIHtcbiAgICBpZiAoYU5hbWUgaW4gYUFyZ3MpIHtcbiAgICAgIHJldHVybiBhQXJnc1thTmFtZV07XG4gICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICByZXR1cm4gYURlZmF1bHRWYWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcIicgKyBhTmFtZSArICdcIiBpcyBhIHJlcXVpcmVkIGFyZ3VtZW50LicpO1xuICAgIH1cbiAgfVxuICBleHBvcnRzLmdldEFyZyA9IGdldEFyZztcblxuICB2YXIgdXJsUmVnZXhwID0gL14oPzooW1xcdytcXC0uXSspOik/XFwvXFwvKD86KFxcdys6XFx3KylAKT8oW1xcdy5dKikoPzo6KFxcZCspKT8oXFxTKikkLztcbiAgdmFyIGRhdGFVcmxSZWdleHAgPSAvXmRhdGE6LitcXCwuKyQvO1xuXG4gIGZ1bmN0aW9uIHVybFBhcnNlKGFVcmwpIHtcbiAgICB2YXIgbWF0Y2ggPSBhVXJsLm1hdGNoKHVybFJlZ2V4cCk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBzY2hlbWU6IG1hdGNoWzFdLFxuICAgICAgYXV0aDogbWF0Y2hbMl0sXG4gICAgICBob3N0OiBtYXRjaFszXSxcbiAgICAgIHBvcnQ6IG1hdGNoWzRdLFxuICAgICAgcGF0aDogbWF0Y2hbNV1cbiAgICB9O1xuICB9XG4gIGV4cG9ydHMudXJsUGFyc2UgPSB1cmxQYXJzZTtcblxuICBmdW5jdGlvbiB1cmxHZW5lcmF0ZShhUGFyc2VkVXJsKSB7XG4gICAgdmFyIHVybCA9ICcnO1xuICAgIGlmIChhUGFyc2VkVXJsLnNjaGVtZSkge1xuICAgICAgdXJsICs9IGFQYXJzZWRVcmwuc2NoZW1lICsgJzonO1xuICAgIH1cbiAgICB1cmwgKz0gJy8vJztcbiAgICBpZiAoYVBhcnNlZFVybC5hdXRoKSB7XG4gICAgICB1cmwgKz0gYVBhcnNlZFVybC5hdXRoICsgJ0AnO1xuICAgIH1cbiAgICBpZiAoYVBhcnNlZFVybC5ob3N0KSB7XG4gICAgICB1cmwgKz0gYVBhcnNlZFVybC5ob3N0O1xuICAgIH1cbiAgICBpZiAoYVBhcnNlZFVybC5wb3J0KSB7XG4gICAgICB1cmwgKz0gXCI6XCIgKyBhUGFyc2VkVXJsLnBvcnRcbiAgICB9XG4gICAgaWYgKGFQYXJzZWRVcmwucGF0aCkge1xuICAgICAgdXJsICs9IGFQYXJzZWRVcmwucGF0aDtcbiAgICB9XG4gICAgcmV0dXJuIHVybDtcbiAgfVxuICBleHBvcnRzLnVybEdlbmVyYXRlID0gdXJsR2VuZXJhdGU7XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZXMgYSBwYXRoLCBvciB0aGUgcGF0aCBwb3J0aW9uIG9mIGEgVVJMOlxuICAgKlxuICAgKiAtIFJlcGxhY2VzIGNvbnNlcXV0aXZlIHNsYXNoZXMgd2l0aCBvbmUgc2xhc2guXG4gICAqIC0gUmVtb3ZlcyB1bm5lY2Vzc2FyeSAnLicgcGFydHMuXG4gICAqIC0gUmVtb3ZlcyB1bm5lY2Vzc2FyeSAnPGRpcj4vLi4nIHBhcnRzLlxuICAgKlxuICAgKiBCYXNlZCBvbiBjb2RlIGluIHRoZSBOb2RlLmpzICdwYXRoJyBjb3JlIG1vZHVsZS5cbiAgICpcbiAgICogQHBhcmFtIGFQYXRoIFRoZSBwYXRoIG9yIHVybCB0byBub3JtYWxpemUuXG4gICAqL1xuICBmdW5jdGlvbiBub3JtYWxpemUoYVBhdGgpIHtcbiAgICB2YXIgcGF0aCA9IGFQYXRoO1xuICAgIHZhciB1cmwgPSB1cmxQYXJzZShhUGF0aCk7XG4gICAgaWYgKHVybCkge1xuICAgICAgaWYgKCF1cmwucGF0aCkge1xuICAgICAgICByZXR1cm4gYVBhdGg7XG4gICAgICB9XG4gICAgICBwYXRoID0gdXJsLnBhdGg7XG4gICAgfVxuICAgIHZhciBpc0Fic29sdXRlID0gKHBhdGguY2hhckF0KDApID09PSAnLycpO1xuXG4gICAgdmFyIHBhcnRzID0gcGF0aC5zcGxpdCgvXFwvKy8pO1xuICAgIGZvciAodmFyIHBhcnQsIHVwID0gMCwgaSA9IHBhcnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBwYXJ0ID0gcGFydHNbaV07XG4gICAgICBpZiAocGFydCA9PT0gJy4nKSB7XG4gICAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIH0gZWxzZSBpZiAocGFydCA9PT0gJy4uJykge1xuICAgICAgICB1cCsrO1xuICAgICAgfSBlbHNlIGlmICh1cCA+IDApIHtcbiAgICAgICAgaWYgKHBhcnQgPT09ICcnKSB7XG4gICAgICAgICAgLy8gVGhlIGZpcnN0IHBhcnQgaXMgYmxhbmsgaWYgdGhlIHBhdGggaXMgYWJzb2x1dGUuIFRyeWluZyB0byBnb1xuICAgICAgICAgIC8vIGFib3ZlIHRoZSByb290IGlzIGEgbm8tb3AuIFRoZXJlZm9yZSB3ZSBjYW4gcmVtb3ZlIGFsbCAnLi4nIHBhcnRzXG4gICAgICAgICAgLy8gZGlyZWN0bHkgYWZ0ZXIgdGhlIHJvb3QuXG4gICAgICAgICAgcGFydHMuc3BsaWNlKGkgKyAxLCB1cCk7XG4gICAgICAgICAgdXAgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhcnRzLnNwbGljZShpLCAyKTtcbiAgICAgICAgICB1cC0tO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHBhdGggPSBwYXJ0cy5qb2luKCcvJyk7XG5cbiAgICBpZiAocGF0aCA9PT0gJycpIHtcbiAgICAgIHBhdGggPSBpc0Fic29sdXRlID8gJy8nIDogJy4nO1xuICAgIH1cblxuICAgIGlmICh1cmwpIHtcbiAgICAgIHVybC5wYXRoID0gcGF0aDtcbiAgICAgIHJldHVybiB1cmxHZW5lcmF0ZSh1cmwpO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aDtcbiAgfVxuICBleHBvcnRzLm5vcm1hbGl6ZSA9IG5vcm1hbGl6ZTtcblxuICAvKipcbiAgICogSm9pbnMgdHdvIHBhdGhzL1VSTHMuXG4gICAqXG4gICAqIEBwYXJhbSBhUm9vdCBUaGUgcm9vdCBwYXRoIG9yIFVSTC5cbiAgICogQHBhcmFtIGFQYXRoIFRoZSBwYXRoIG9yIFVSTCB0byBiZSBqb2luZWQgd2l0aCB0aGUgcm9vdC5cbiAgICpcbiAgICogLSBJZiBhUGF0aCBpcyBhIFVSTCBvciBhIGRhdGEgVVJJLCBhUGF0aCBpcyByZXR1cm5lZCwgdW5sZXNzIGFQYXRoIGlzIGFcbiAgICogICBzY2hlbWUtcmVsYXRpdmUgVVJMOiBUaGVuIHRoZSBzY2hlbWUgb2YgYVJvb3QsIGlmIGFueSwgaXMgcHJlcGVuZGVkXG4gICAqICAgZmlyc3QuXG4gICAqIC0gT3RoZXJ3aXNlIGFQYXRoIGlzIGEgcGF0aC4gSWYgYVJvb3QgaXMgYSBVUkwsIHRoZW4gaXRzIHBhdGggcG9ydGlvblxuICAgKiAgIGlzIHVwZGF0ZWQgd2l0aCB0aGUgcmVzdWx0IGFuZCBhUm9vdCBpcyByZXR1cm5lZC4gT3RoZXJ3aXNlIHRoZSByZXN1bHRcbiAgICogICBpcyByZXR1cm5lZC5cbiAgICogICAtIElmIGFQYXRoIGlzIGFic29sdXRlLCB0aGUgcmVzdWx0IGlzIGFQYXRoLlxuICAgKiAgIC0gT3RoZXJ3aXNlIHRoZSB0d28gcGF0aHMgYXJlIGpvaW5lZCB3aXRoIGEgc2xhc2guXG4gICAqIC0gSm9pbmluZyBmb3IgZXhhbXBsZSAnaHR0cDovLycgYW5kICd3d3cuZXhhbXBsZS5jb20nIGlzIGFsc28gc3VwcG9ydGVkLlxuICAgKi9cbiAgZnVuY3Rpb24gam9pbihhUm9vdCwgYVBhdGgpIHtcbiAgICBpZiAoYVJvb3QgPT09IFwiXCIpIHtcbiAgICAgIGFSb290ID0gXCIuXCI7XG4gICAgfVxuICAgIGlmIChhUGF0aCA9PT0gXCJcIikge1xuICAgICAgYVBhdGggPSBcIi5cIjtcbiAgICB9XG4gICAgdmFyIGFQYXRoVXJsID0gdXJsUGFyc2UoYVBhdGgpO1xuICAgIHZhciBhUm9vdFVybCA9IHVybFBhcnNlKGFSb290KTtcbiAgICBpZiAoYVJvb3RVcmwpIHtcbiAgICAgIGFSb290ID0gYVJvb3RVcmwucGF0aCB8fCAnLyc7XG4gICAgfVxuXG4gICAgLy8gYGpvaW4oZm9vLCAnLy93d3cuZXhhbXBsZS5vcmcnKWBcbiAgICBpZiAoYVBhdGhVcmwgJiYgIWFQYXRoVXJsLnNjaGVtZSkge1xuICAgICAgaWYgKGFSb290VXJsKSB7XG4gICAgICAgIGFQYXRoVXJsLnNjaGVtZSA9IGFSb290VXJsLnNjaGVtZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB1cmxHZW5lcmF0ZShhUGF0aFVybCk7XG4gICAgfVxuXG4gICAgaWYgKGFQYXRoVXJsIHx8IGFQYXRoLm1hdGNoKGRhdGFVcmxSZWdleHApKSB7XG4gICAgICByZXR1cm4gYVBhdGg7XG4gICAgfVxuXG4gICAgLy8gYGpvaW4oJ2h0dHA6Ly8nLCAnd3d3LmV4YW1wbGUuY29tJylgXG4gICAgaWYgKGFSb290VXJsICYmICFhUm9vdFVybC5ob3N0ICYmICFhUm9vdFVybC5wYXRoKSB7XG4gICAgICBhUm9vdFVybC5ob3N0ID0gYVBhdGg7XG4gICAgICByZXR1cm4gdXJsR2VuZXJhdGUoYVJvb3RVcmwpO1xuICAgIH1cblxuICAgIHZhciBqb2luZWQgPSBhUGF0aC5jaGFyQXQoMCkgPT09ICcvJ1xuICAgICAgPyBhUGF0aFxuICAgICAgOiBub3JtYWxpemUoYVJvb3QucmVwbGFjZSgvXFwvKyQvLCAnJykgKyAnLycgKyBhUGF0aCk7XG5cbiAgICBpZiAoYVJvb3RVcmwpIHtcbiAgICAgIGFSb290VXJsLnBhdGggPSBqb2luZWQ7XG4gICAgICByZXR1cm4gdXJsR2VuZXJhdGUoYVJvb3RVcmwpO1xuICAgIH1cbiAgICByZXR1cm4gam9pbmVkO1xuICB9XG4gIGV4cG9ydHMuam9pbiA9IGpvaW47XG5cbiAgLyoqXG4gICAqIE1ha2UgYSBwYXRoIHJlbGF0aXZlIHRvIGEgVVJMIG9yIGFub3RoZXIgcGF0aC5cbiAgICpcbiAgICogQHBhcmFtIGFSb290IFRoZSByb290IHBhdGggb3IgVVJMLlxuICAgKiBAcGFyYW0gYVBhdGggVGhlIHBhdGggb3IgVVJMIHRvIGJlIG1hZGUgcmVsYXRpdmUgdG8gYVJvb3QuXG4gICAqL1xuICBmdW5jdGlvbiByZWxhdGl2ZShhUm9vdCwgYVBhdGgpIHtcbiAgICBpZiAoYVJvb3QgPT09IFwiXCIpIHtcbiAgICAgIGFSb290ID0gXCIuXCI7XG4gICAgfVxuXG4gICAgYVJvb3QgPSBhUm9vdC5yZXBsYWNlKC9cXC8kLywgJycpO1xuXG4gICAgLy8gWFhYOiBJdCBpcyBwb3NzaWJsZSB0byByZW1vdmUgdGhpcyBibG9jaywgYW5kIHRoZSB0ZXN0cyBzdGlsbCBwYXNzIVxuICAgIHZhciB1cmwgPSB1cmxQYXJzZShhUm9vdCk7XG4gICAgaWYgKGFQYXRoLmNoYXJBdCgwKSA9PSBcIi9cIiAmJiB1cmwgJiYgdXJsLnBhdGggPT0gXCIvXCIpIHtcbiAgICAgIHJldHVybiBhUGF0aC5zbGljZSgxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVBhdGguaW5kZXhPZihhUm9vdCArICcvJykgPT09IDBcbiAgICAgID8gYVBhdGguc3Vic3RyKGFSb290Lmxlbmd0aCArIDEpXG4gICAgICA6IGFQYXRoO1xuICB9XG4gIGV4cG9ydHMucmVsYXRpdmUgPSByZWxhdGl2ZTtcblxuICAvKipcbiAgICogQmVjYXVzZSBiZWhhdmlvciBnb2VzIHdhY2t5IHdoZW4geW91IHNldCBgX19wcm90b19fYCBvbiBvYmplY3RzLCB3ZVxuICAgKiBoYXZlIHRvIHByZWZpeCBhbGwgdGhlIHN0cmluZ3MgaW4gb3VyIHNldCB3aXRoIGFuIGFyYml0cmFyeSBjaGFyYWN0ZXIuXG4gICAqXG4gICAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9zb3VyY2UtbWFwL3B1bGwvMzEgYW5kXG4gICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL3NvdXJjZS1tYXAvaXNzdWVzLzMwXG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgZnVuY3Rpb24gdG9TZXRTdHJpbmcoYVN0cikge1xuICAgIHJldHVybiAnJCcgKyBhU3RyO1xuICB9XG4gIGV4cG9ydHMudG9TZXRTdHJpbmcgPSB0b1NldFN0cmluZztcblxuICBmdW5jdGlvbiBmcm9tU2V0U3RyaW5nKGFTdHIpIHtcbiAgICByZXR1cm4gYVN0ci5zdWJzdHIoMSk7XG4gIH1cbiAgZXhwb3J0cy5mcm9tU2V0U3RyaW5nID0gZnJvbVNldFN0cmluZztcblxuICBmdW5jdGlvbiBzdHJjbXAoYVN0cjEsIGFTdHIyKSB7XG4gICAgdmFyIHMxID0gYVN0cjEgfHwgXCJcIjtcbiAgICB2YXIgczIgPSBhU3RyMiB8fCBcIlwiO1xuICAgIHJldHVybiAoczEgPiBzMikgLSAoczEgPCBzMik7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyYXRvciBiZXR3ZWVuIHR3byBtYXBwaW5ncyB3aGVyZSB0aGUgb3JpZ2luYWwgcG9zaXRpb25zIGFyZSBjb21wYXJlZC5cbiAgICpcbiAgICogT3B0aW9uYWxseSBwYXNzIGluIGB0cnVlYCBhcyBgb25seUNvbXBhcmVHZW5lcmF0ZWRgIHRvIGNvbnNpZGVyIHR3b1xuICAgKiBtYXBwaW5ncyB3aXRoIHRoZSBzYW1lIG9yaWdpbmFsIHNvdXJjZS9saW5lL2NvbHVtbiwgYnV0IGRpZmZlcmVudCBnZW5lcmF0ZWRcbiAgICogbGluZSBhbmQgY29sdW1uIHRoZSBzYW1lLiBVc2VmdWwgd2hlbiBzZWFyY2hpbmcgZm9yIGEgbWFwcGluZyB3aXRoIGFcbiAgICogc3R1YmJlZCBvdXQgbWFwcGluZy5cbiAgICovXG4gIGZ1bmN0aW9uIGNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zKG1hcHBpbmdBLCBtYXBwaW5nQiwgb25seUNvbXBhcmVPcmlnaW5hbCkge1xuICAgIHZhciBjbXA7XG5cbiAgICBjbXAgPSBzdHJjbXAobWFwcGluZ0Euc291cmNlLCBtYXBwaW5nQi5zb3VyY2UpO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxMaW5lIC0gbWFwcGluZ0Iub3JpZ2luYWxMaW5lO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxDb2x1bW4gLSBtYXBwaW5nQi5vcmlnaW5hbENvbHVtbjtcbiAgICBpZiAoY21wIHx8IG9ubHlDb21wYXJlT3JpZ2luYWwpIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gc3RyY21wKG1hcHBpbmdBLm5hbWUsIG1hcHBpbmdCLm5hbWUpO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0EuZ2VuZXJhdGVkTGluZSAtIG1hcHBpbmdCLmdlbmVyYXRlZExpbmU7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFwcGluZ0EuZ2VuZXJhdGVkQ29sdW1uIC0gbWFwcGluZ0IuZ2VuZXJhdGVkQ29sdW1uO1xuICB9O1xuICBleHBvcnRzLmNvbXBhcmVCeU9yaWdpbmFsUG9zaXRpb25zID0gY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnM7XG5cbiAgLyoqXG4gICAqIENvbXBhcmF0b3IgYmV0d2VlbiB0d28gbWFwcGluZ3Mgd2hlcmUgdGhlIGdlbmVyYXRlZCBwb3NpdGlvbnMgYXJlXG4gICAqIGNvbXBhcmVkLlxuICAgKlxuICAgKiBPcHRpb25hbGx5IHBhc3MgaW4gYHRydWVgIGFzIGBvbmx5Q29tcGFyZUdlbmVyYXRlZGAgdG8gY29uc2lkZXIgdHdvXG4gICAqIG1hcHBpbmdzIHdpdGggdGhlIHNhbWUgZ2VuZXJhdGVkIGxpbmUgYW5kIGNvbHVtbiwgYnV0IGRpZmZlcmVudFxuICAgKiBzb3VyY2UvbmFtZS9vcmlnaW5hbCBsaW5lIGFuZCBjb2x1bW4gdGhlIHNhbWUuIFVzZWZ1bCB3aGVuIHNlYXJjaGluZyBmb3IgYVxuICAgKiBtYXBwaW5nIHdpdGggYSBzdHViYmVkIG91dCBtYXBwaW5nLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zKG1hcHBpbmdBLCBtYXBwaW5nQiwgb25seUNvbXBhcmVHZW5lcmF0ZWQpIHtcbiAgICB2YXIgY21wO1xuXG4gICAgY21wID0gbWFwcGluZ0EuZ2VuZXJhdGVkTGluZSAtIG1hcHBpbmdCLmdlbmVyYXRlZExpbmU7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5nZW5lcmF0ZWRDb2x1bW4gLSBtYXBwaW5nQi5nZW5lcmF0ZWRDb2x1bW47XG4gICAgaWYgKGNtcCB8fCBvbmx5Q29tcGFyZUdlbmVyYXRlZCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBzdHJjbXAobWFwcGluZ0Euc291cmNlLCBtYXBwaW5nQi5zb3VyY2UpO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxMaW5lIC0gbWFwcGluZ0Iub3JpZ2luYWxMaW5lO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgY21wID0gbWFwcGluZ0Eub3JpZ2luYWxDb2x1bW4gLSBtYXBwaW5nQi5vcmlnaW5hbENvbHVtbjtcbiAgICBpZiAoY21wKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIHJldHVybiBzdHJjbXAobWFwcGluZ0EubmFtZSwgbWFwcGluZ0IubmFtZSk7XG4gIH07XG4gIGV4cG9ydHMuY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zID0gY29tcGFyZUJ5R2VuZXJhdGVkUG9zaXRpb25zO1xuXG59KTtcbiIsIi8qKiB2aW06IGV0OnRzPTQ6c3c9NDpzdHM9NFxuICogQGxpY2Vuc2UgYW1kZWZpbmUgMS4wLjAgQ29weXJpZ2h0IChjKSAyMDExLTIwMTUsIFRoZSBEb2pvIEZvdW5kYXRpb24gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIEF2YWlsYWJsZSB2aWEgdGhlIE1JVCBvciBuZXcgQlNEIGxpY2Vuc2UuXG4gKiBzZWU6IGh0dHA6Ly9naXRodWIuY29tL2pyYnVya2UvYW1kZWZpbmUgZm9yIGRldGFpbHNcbiAqL1xuXG4vKmpzbGludCBub2RlOiB0cnVlICovXG4vKmdsb2JhbCBtb2R1bGUsIHByb2Nlc3MgKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZGVmaW5lIGZvciBub2RlLlxuICogQHBhcmFtIHtPYmplY3R9IG1vZHVsZSB0aGUgXCJtb2R1bGVcIiBvYmplY3QgdGhhdCBpcyBkZWZpbmVkIGJ5IE5vZGUgZm9yIHRoZVxuICogY3VycmVudCBtb2R1bGUuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbcmVxdWlyZUZuXS4gTm9kZSdzIHJlcXVpcmUgZnVuY3Rpb24gZm9yIHRoZSBjdXJyZW50IG1vZHVsZS5cbiAqIEl0IG9ubHkgbmVlZHMgdG8gYmUgcGFzc2VkIGluIE5vZGUgdmVyc2lvbnMgYmVmb3JlIDAuNSwgd2hlbiBtb2R1bGUucmVxdWlyZVxuICogZGlkIG5vdCBleGlzdC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gYSBkZWZpbmUgZnVuY3Rpb24gdGhhdCBpcyB1c2FibGUgZm9yIHRoZSBjdXJyZW50IG5vZGVcbiAqIG1vZHVsZS5cbiAqL1xuZnVuY3Rpb24gYW1kZWZpbmUobW9kdWxlLCByZXF1aXJlRm4pIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgdmFyIGRlZmluZUNhY2hlID0ge30sXG4gICAgICAgIGxvYWRlckNhY2hlID0ge30sXG4gICAgICAgIGFscmVhZHlDYWxsZWQgPSBmYWxzZSxcbiAgICAgICAgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKSxcbiAgICAgICAgbWFrZVJlcXVpcmUsIHN0cmluZ1JlcXVpcmU7XG5cbiAgICAvKipcbiAgICAgKiBUcmltcyB0aGUgLiBhbmQgLi4gZnJvbSBhbiBhcnJheSBvZiBwYXRoIHNlZ21lbnRzLlxuICAgICAqIEl0IHdpbGwga2VlcCBhIGxlYWRpbmcgcGF0aCBzZWdtZW50IGlmIGEgLi4gd2lsbCBiZWNvbWVcbiAgICAgKiB0aGUgZmlyc3QgcGF0aCBzZWdtZW50LCB0byBoZWxwIHdpdGggbW9kdWxlIG5hbWUgbG9va3VwcyxcbiAgICAgKiB3aGljaCBhY3QgbGlrZSBwYXRocywgYnV0IGNhbiBiZSByZW1hcHBlZC4gQnV0IHRoZSBlbmQgcmVzdWx0LFxuICAgICAqIGFsbCBwYXRocyB0aGF0IHVzZSB0aGlzIGZ1bmN0aW9uIHNob3VsZCBsb29rIG5vcm1hbGl6ZWQuXG4gICAgICogTk9URTogdGhpcyBtZXRob2QgTU9ESUZJRVMgdGhlIGlucHV0IGFycmF5LlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFyeSB0aGUgYXJyYXkgb2YgcGF0aCBzZWdtZW50cy5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB0cmltRG90cyhhcnkpIHtcbiAgICAgICAgdmFyIGksIHBhcnQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGFyeVtpXTsgaSs9IDEpIHtcbiAgICAgICAgICAgIHBhcnQgPSBhcnlbaV07XG4gICAgICAgICAgICBpZiAocGFydCA9PT0gJy4nKSB7XG4gICAgICAgICAgICAgICAgYXJ5LnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBpIC09IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhcnQgPT09ICcuLicpIHtcbiAgICAgICAgICAgICAgICBpZiAoaSA9PT0gMSAmJiAoYXJ5WzJdID09PSAnLi4nIHx8IGFyeVswXSA9PT0gJy4uJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9FbmQgb2YgdGhlIGxpbmUuIEtlZXAgYXQgbGVhc3Qgb25lIG5vbi1kb3RcbiAgICAgICAgICAgICAgICAgICAgLy9wYXRoIHNlZ21lbnQgYXQgdGhlIGZyb250IHNvIGl0IGNhbiBiZSBtYXBwZWRcbiAgICAgICAgICAgICAgICAgICAgLy9jb3JyZWN0bHkgdG8gZGlzay4gT3RoZXJ3aXNlLCB0aGVyZSBpcyBsaWtlbHlcbiAgICAgICAgICAgICAgICAgICAgLy9ubyBwYXRoIG1hcHBpbmcgZm9yIGEgcGF0aCBzdGFydGluZyB3aXRoICcuLicuXG4gICAgICAgICAgICAgICAgICAgIC8vVGhpcyBjYW4gc3RpbGwgZmFpbCwgYnV0IGNhdGNoZXMgdGhlIG1vc3QgcmVhc29uYWJsZVxuICAgICAgICAgICAgICAgICAgICAvL3VzZXMgb2YgLi5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhcnkuc3BsaWNlKGkgLSAxLCAyKTtcbiAgICAgICAgICAgICAgICAgICAgaSAtPSAyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5vcm1hbGl6ZShuYW1lLCBiYXNlTmFtZSkge1xuICAgICAgICB2YXIgYmFzZVBhcnRzO1xuXG4gICAgICAgIC8vQWRqdXN0IGFueSByZWxhdGl2ZSBwYXRocy5cbiAgICAgICAgaWYgKG5hbWUgJiYgbmFtZS5jaGFyQXQoMCkgPT09ICcuJykge1xuICAgICAgICAgICAgLy9JZiBoYXZlIGEgYmFzZSBuYW1lLCB0cnkgdG8gbm9ybWFsaXplIGFnYWluc3QgaXQsXG4gICAgICAgICAgICAvL290aGVyd2lzZSwgYXNzdW1lIGl0IGlzIGEgdG9wLWxldmVsIHJlcXVpcmUgdGhhdCB3aWxsXG4gICAgICAgICAgICAvL2JlIHJlbGF0aXZlIHRvIGJhc2VVcmwgaW4gdGhlIGVuZC5cbiAgICAgICAgICAgIGlmIChiYXNlTmFtZSkge1xuICAgICAgICAgICAgICAgIGJhc2VQYXJ0cyA9IGJhc2VOYW1lLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgYmFzZVBhcnRzID0gYmFzZVBhcnRzLnNsaWNlKDAsIGJhc2VQYXJ0cy5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICBiYXNlUGFydHMgPSBiYXNlUGFydHMuY29uY2F0KG5hbWUuc3BsaXQoJy8nKSk7XG4gICAgICAgICAgICAgICAgdHJpbURvdHMoYmFzZVBhcnRzKTtcbiAgICAgICAgICAgICAgICBuYW1lID0gYmFzZVBhcnRzLmpvaW4oJy8nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSB0aGUgbm9ybWFsaXplKCkgZnVuY3Rpb24gcGFzc2VkIHRvIGEgbG9hZGVyIHBsdWdpbidzXG4gICAgICogbm9ybWFsaXplIG1ldGhvZC5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBtYWtlTm9ybWFsaXplKHJlbE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbm9ybWFsaXplKG5hbWUsIHJlbE5hbWUpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1ha2VMb2FkKGlkKSB7XG4gICAgICAgIGZ1bmN0aW9uIGxvYWQodmFsdWUpIHtcbiAgICAgICAgICAgIGxvYWRlckNhY2hlW2lkXSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9hZC5mcm9tVGV4dCA9IGZ1bmN0aW9uIChpZCwgdGV4dCkge1xuICAgICAgICAgICAgLy9UaGlzIG9uZSBpcyBkaWZmaWN1bHQgYmVjYXVzZSB0aGUgdGV4dCBjYW4vcHJvYmFibHkgdXNlc1xuICAgICAgICAgICAgLy9kZWZpbmUsIGFuZCBhbnkgcmVsYXRpdmUgcGF0aHMgYW5kIHJlcXVpcmVzIHNob3VsZCBiZSByZWxhdGl2ZVxuICAgICAgICAgICAgLy90byB0aGF0IGlkIHdhcyBpdCB3b3VsZCBiZSBmb3VuZCBvbiBkaXNrLiBCdXQgdGhpcyB3b3VsZCByZXF1aXJlXG4gICAgICAgICAgICAvL2Jvb3RzdHJhcHBpbmcgYSBtb2R1bGUvcmVxdWlyZSBmYWlybHkgZGVlcGx5IGZyb20gbm9kZSBjb3JlLlxuICAgICAgICAgICAgLy9Ob3Qgc3VyZSBob3cgYmVzdCB0byBnbyBhYm91dCB0aGF0IHlldC5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYW1kZWZpbmUgZG9lcyBub3QgaW1wbGVtZW50IGxvYWQuZnJvbVRleHQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gbG9hZDtcbiAgICB9XG5cbiAgICBtYWtlUmVxdWlyZSA9IGZ1bmN0aW9uIChzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIHJlbElkKSB7XG4gICAgICAgIGZ1bmN0aW9uIGFtZFJlcXVpcmUoZGVwcywgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZGVwcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAvL1N5bmNocm9ub3VzLCBzaW5nbGUgbW9kdWxlIHJlcXVpcmUoJycpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1JlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCBkZXBzLCByZWxJZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vQXJyYXkgb2YgZGVwZW5kZW5jaWVzIHdpdGggYSBjYWxsYmFjay5cblxuICAgICAgICAgICAgICAgIC8vQ29udmVydCB0aGUgZGVwZW5kZW5jaWVzIHRvIG1vZHVsZXMuXG4gICAgICAgICAgICAgICAgZGVwcyA9IGRlcHMubWFwKGZ1bmN0aW9uIChkZXBOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHJpbmdSZXF1aXJlKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgZGVwTmFtZSwgcmVsSWQpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy9XYWl0IGZvciBuZXh0IHRpY2sgdG8gY2FsbCBiYWNrIHRoZSByZXF1aXJlIGNhbGwuXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkobnVsbCwgZGVwcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFtZFJlcXVpcmUudG9VcmwgPSBmdW5jdGlvbiAoZmlsZVBhdGgpIHtcbiAgICAgICAgICAgIGlmIChmaWxlUGF0aC5pbmRleE9mKCcuJykgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbm9ybWFsaXplKGZpbGVQYXRoLCBwYXRoLmRpcm5hbWUobW9kdWxlLmZpbGVuYW1lKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWxlUGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gYW1kUmVxdWlyZTtcbiAgICB9O1xuXG4gICAgLy9GYXZvciBleHBsaWNpdCB2YWx1ZSwgcGFzc2VkIGluIGlmIHRoZSBtb2R1bGUgd2FudHMgdG8gc3VwcG9ydCBOb2RlIDAuNC5cbiAgICByZXF1aXJlRm4gPSByZXF1aXJlRm4gfHwgZnVuY3Rpb24gcmVxKCkge1xuICAgICAgICByZXR1cm4gbW9kdWxlLnJlcXVpcmUuYXBwbHkobW9kdWxlLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBydW5GYWN0b3J5KGlkLCBkZXBzLCBmYWN0b3J5KSB7XG4gICAgICAgIHZhciByLCBlLCBtLCByZXN1bHQ7XG5cbiAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICBlID0gbG9hZGVyQ2FjaGVbaWRdID0ge307XG4gICAgICAgICAgICBtID0ge1xuICAgICAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgICAgICB1cmk6IF9fZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgZXhwb3J0czogZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHIgPSBtYWtlUmVxdWlyZShyZXF1aXJlRm4sIGUsIG0sIGlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vT25seSBzdXBwb3J0IG9uZSBkZWZpbmUgY2FsbCBwZXIgZmlsZVxuICAgICAgICAgICAgaWYgKGFscmVhZHlDYWxsZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FtZGVmaW5lIHdpdGggbm8gbW9kdWxlIElEIGNhbm5vdCBiZSBjYWxsZWQgbW9yZSB0aGFuIG9uY2UgcGVyIGZpbGUuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbHJlYWR5Q2FsbGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy9Vc2UgdGhlIHJlYWwgdmFyaWFibGVzIGZyb20gbm9kZVxuICAgICAgICAgICAgLy9Vc2UgbW9kdWxlLmV4cG9ydHMgZm9yIGV4cG9ydHMsIHNpbmNlXG4gICAgICAgICAgICAvL3RoZSBleHBvcnRzIGluIGhlcmUgaXMgYW1kZWZpbmUgZXhwb3J0cy5cbiAgICAgICAgICAgIGUgPSBtb2R1bGUuZXhwb3J0cztcbiAgICAgICAgICAgIG0gPSBtb2R1bGU7XG4gICAgICAgICAgICByID0gbWFrZVJlcXVpcmUocmVxdWlyZUZuLCBlLCBtLCBtb2R1bGUuaWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9JZiB0aGVyZSBhcmUgZGVwZW5kZW5jaWVzLCB0aGV5IGFyZSBzdHJpbmdzLCBzbyBuZWVkXG4gICAgICAgIC8vdG8gY29udmVydCB0aGVtIHRvIGRlcGVuZGVuY3kgdmFsdWVzLlxuICAgICAgICBpZiAoZGVwcykge1xuICAgICAgICAgICAgZGVwcyA9IGRlcHMubWFwKGZ1bmN0aW9uIChkZXBOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHIoZGVwTmFtZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQ2FsbCB0aGUgZmFjdG9yeSB3aXRoIHRoZSByaWdodCBkZXBlbmRlbmNpZXMuXG4gICAgICAgIGlmICh0eXBlb2YgZmFjdG9yeSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgcmVzdWx0ID0gZmFjdG9yeS5hcHBseShtLmV4cG9ydHMsIGRlcHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gZmFjdG9yeTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbS5leHBvcnRzID0gcmVzdWx0O1xuICAgICAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyQ2FjaGVbaWRdID0gbS5leHBvcnRzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RyaW5nUmVxdWlyZSA9IGZ1bmN0aW9uIChzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIGlkLCByZWxJZCkge1xuICAgICAgICAvL1NwbGl0IHRoZSBJRCBieSBhICEgc28gdGhhdFxuICAgICAgICB2YXIgaW5kZXggPSBpZC5pbmRleE9mKCchJyksXG4gICAgICAgICAgICBvcmlnaW5hbElkID0gaWQsXG4gICAgICAgICAgICBwcmVmaXgsIHBsdWdpbjtcblxuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICBpZCA9IG5vcm1hbGl6ZShpZCwgcmVsSWQpO1xuXG4gICAgICAgICAgICAvL1N0cmFpZ2h0IG1vZHVsZSBsb29rdXAuIElmIGl0IGlzIG9uZSBvZiB0aGUgc3BlY2lhbCBkZXBlbmRlbmNpZXMsXG4gICAgICAgICAgICAvL2RlYWwgd2l0aCBpdCwgb3RoZXJ3aXNlLCBkZWxlZ2F0ZSB0byBub2RlLlxuICAgICAgICAgICAgaWYgKGlkID09PSAncmVxdWlyZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWFrZVJlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCByZWxJZCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlkID09PSAnZXhwb3J0cycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwb3J0cztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaWQgPT09ICdtb2R1bGUnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZHVsZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobG9hZGVyQ2FjaGUuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVmaW5lQ2FjaGVbaWRdKSB7XG4gICAgICAgICAgICAgICAgcnVuRmFjdG9yeS5hcHBseShudWxsLCBkZWZpbmVDYWNoZVtpZF0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkZXJDYWNoZVtpZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmKHN5c3RlbVJlcXVpcmUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN5c3RlbVJlcXVpcmUob3JpZ2luYWxJZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBtb2R1bGUgd2l0aCBJRDogJyArIGlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL1RoZXJlIGlzIGEgcGx1Z2luIGluIHBsYXkuXG4gICAgICAgICAgICBwcmVmaXggPSBpZC5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgICAgICAgaWQgPSBpZC5zdWJzdHJpbmcoaW5kZXggKyAxLCBpZC5sZW5ndGgpO1xuXG4gICAgICAgICAgICBwbHVnaW4gPSBzdHJpbmdSZXF1aXJlKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgcHJlZml4LCByZWxJZCk7XG5cbiAgICAgICAgICAgIGlmIChwbHVnaW4ubm9ybWFsaXplKSB7XG4gICAgICAgICAgICAgICAgaWQgPSBwbHVnaW4ubm9ybWFsaXplKGlkLCBtYWtlTm9ybWFsaXplKHJlbElkKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vTm9ybWFsaXplIHRoZSBJRCBub3JtYWxseS5cbiAgICAgICAgICAgICAgICBpZCA9IG5vcm1hbGl6ZShpZCwgcmVsSWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobG9hZGVyQ2FjaGVbaWRdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGx1Z2luLmxvYWQoaWQsIG1ha2VSZXF1aXJlKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgcmVsSWQpLCBtYWtlTG9hZChpZCksIHt9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkZXJDYWNoZVtpZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy9DcmVhdGUgYSBkZWZpbmUgZnVuY3Rpb24gc3BlY2lmaWMgdG8gdGhlIG1vZHVsZSBhc2tpbmcgZm9yIGFtZGVmaW5lLlxuICAgIGZ1bmN0aW9uIGRlZmluZShpZCwgZGVwcywgZmFjdG9yeSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpZCkpIHtcbiAgICAgICAgICAgIGZhY3RvcnkgPSBkZXBzO1xuICAgICAgICAgICAgZGVwcyA9IGlkO1xuICAgICAgICAgICAgaWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgZmFjdG9yeSA9IGlkO1xuICAgICAgICAgICAgaWQgPSBkZXBzID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcHMgJiYgIUFycmF5LmlzQXJyYXkoZGVwcykpIHtcbiAgICAgICAgICAgIGZhY3RvcnkgPSBkZXBzO1xuICAgICAgICAgICAgZGVwcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZGVwcykge1xuICAgICAgICAgICAgZGVwcyA9IFsncmVxdWlyZScsICdleHBvcnRzJywgJ21vZHVsZSddO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9TZXQgdXAgcHJvcGVydGllcyBmb3IgdGhpcyBtb2R1bGUuIElmIGFuIElELCB0aGVuIHVzZVxuICAgICAgICAvL2ludGVybmFsIGNhY2hlLiBJZiBubyBJRCwgdGhlbiB1c2UgdGhlIGV4dGVybmFsIHZhcmlhYmxlc1xuICAgICAgICAvL2ZvciB0aGlzIG5vZGUgbW9kdWxlLlxuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgIC8vUHV0IHRoZSBtb2R1bGUgaW4gZGVlcCBmcmVlemUgdW50aWwgdGhlcmUgaXMgYVxuICAgICAgICAgICAgLy9yZXF1aXJlIGNhbGwgZm9yIGl0LlxuICAgICAgICAgICAgZGVmaW5lQ2FjaGVbaWRdID0gW2lkLCBkZXBzLCBmYWN0b3J5XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJ1bkZhY3RvcnkoaWQsIGRlcHMsIGZhY3RvcnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy9kZWZpbmUucmVxdWlyZSwgd2hpY2ggaGFzIGFjY2VzcyB0byBhbGwgdGhlIHZhbHVlcyBpbiB0aGVcbiAgICAvL2NhY2hlLiBVc2VmdWwgZm9yIEFNRCBtb2R1bGVzIHRoYXQgYWxsIGhhdmUgSURzIGluIHRoZSBmaWxlLFxuICAgIC8vYnV0IG5lZWQgdG8gZmluYWxseSBleHBvcnQgYSB2YWx1ZSB0byBub2RlIGJhc2VkIG9uIG9uZSBvZiB0aG9zZVxuICAgIC8vSURzLlxuICAgIGRlZmluZS5yZXF1aXJlID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIGlmIChsb2FkZXJDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgIHJldHVybiBsb2FkZXJDYWNoZVtpZF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVmaW5lQ2FjaGVbaWRdKSB7XG4gICAgICAgICAgICBydW5GYWN0b3J5LmFwcGx5KG51bGwsIGRlZmluZUNhY2hlW2lkXSk7XG4gICAgICAgICAgICByZXR1cm4gbG9hZGVyQ2FjaGVbaWRdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGRlZmluZS5hbWQgPSB7fTtcblxuICAgIHJldHVybiBkZWZpbmU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYW1kZWZpbmU7XG4iLCIvLyBDb3B5cmlnaHQgMjAxNCBTaW1vbiBMeWRlbGxcclxuLy8gWDExICjigJxNSVTigJ0pIExpY2Vuc2VkLiAoU2VlIExJQ0VOU0UuKVxyXG5cclxudmFyIHBhdGggPSByZXF1aXJlKFwicGF0aFwiKVxyXG5cclxuXCJ1c2Ugc3RyaWN0XCJcclxuXHJcbmZ1bmN0aW9uIHVyaXgoYVBhdGgpIHtcclxuICBpZiAocGF0aC5zZXAgPT09IFwiXFxcXFwiKSB7XHJcbiAgICByZXR1cm4gYVBhdGhcclxuICAgICAgLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpXHJcbiAgICAgIC5yZXBsYWNlKC9eW2Etel06XFwvPy9pLCBcIi9cIilcclxuICB9XHJcbiAgcmV0dXJuIGFQYXRoXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gdXJpeFxyXG4iLCIoZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByb290LmRlZXBtZXJnZSA9IGZhY3RvcnkoKTtcbiAgICB9XG59KHRoaXMsIGZ1bmN0aW9uICgpIHtcblxucmV0dXJuIGZ1bmN0aW9uIGRlZXBtZXJnZSh0YXJnZXQsIHNyYykge1xuICAgIHZhciBhcnJheSA9IEFycmF5LmlzQXJyYXkoc3JjKTtcbiAgICB2YXIgZHN0ID0gYXJyYXkgJiYgW10gfHwge307XG5cbiAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0IHx8IFtdO1xuICAgICAgICBkc3QgPSBkc3QuY29uY2F0KHRhcmdldCk7XG4gICAgICAgIHNyYy5mb3JFYWNoKGZ1bmN0aW9uKGUsIGkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZHN0W2ldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGRzdFtpXSA9IGU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGRzdFtpXSA9IGRlZXBtZXJnZSh0YXJnZXRbaV0sIGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0LmluZGV4T2YoZSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGRzdC5wdXNoKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRhcmdldCAmJiB0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXModGFyZ2V0KS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICBkc3Rba2V5XSA9IHRhcmdldFtrZXldO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBPYmplY3Qua2V5cyhzcmMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzcmNba2V5XSAhPT0gJ29iamVjdCcgfHwgIXNyY1trZXldKSB7XG4gICAgICAgICAgICAgICAgZHN0W2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0W2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgZHN0W2tleV0gPSBzcmNba2V5XTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkc3Rba2V5XSA9IGRlZXBtZXJnZSh0YXJnZXRba2V5XSwgc3JjW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRzdDtcbn1cblxufSkpO1xuIixudWxsLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gcmVzb2x2ZXMgLiBhbmQgLi4gZWxlbWVudHMgaW4gYSBwYXRoIGFycmF5IHdpdGggZGlyZWN0b3J5IG5hbWVzIHRoZXJlXG4vLyBtdXN0IGJlIG5vIHNsYXNoZXMsIGVtcHR5IGVsZW1lbnRzLCBvciBkZXZpY2UgbmFtZXMgKGM6XFwpIGluIHRoZSBhcnJheVxuLy8gKHNvIGFsc28gbm8gbGVhZGluZyBhbmQgdHJhaWxpbmcgc2xhc2hlcyAtIGl0IGRvZXMgbm90IGRpc3Rpbmd1aXNoXG4vLyByZWxhdGl2ZSBhbmQgYWJzb2x1dGUgcGF0aHMpXG5mdW5jdGlvbiBub3JtYWxpemVBcnJheShwYXJ0cywgYWxsb3dBYm92ZVJvb3QpIHtcbiAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgdmFyIHVwID0gMDtcbiAgZm9yICh2YXIgaSA9IHBhcnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdmFyIGxhc3QgPSBwYXJ0c1tpXTtcbiAgICBpZiAobGFzdCA9PT0gJy4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cCsrO1xuICAgIH0gZWxzZSBpZiAodXApIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwLS07XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhdGggaXMgYWxsb3dlZCB0byBnbyBhYm92ZSB0aGUgcm9vdCwgcmVzdG9yZSBsZWFkaW5nIC4uc1xuICBpZiAoYWxsb3dBYm92ZVJvb3QpIHtcbiAgICBmb3IgKDsgdXAtLTsgdXApIHtcbiAgICAgIHBhcnRzLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzO1xufVxuXG4vLyBTcGxpdCBhIGZpbGVuYW1lIGludG8gW3Jvb3QsIGRpciwgYmFzZW5hbWUsIGV4dF0sIHVuaXggdmVyc2lvblxuLy8gJ3Jvb3QnIGlzIGp1c3QgYSBzbGFzaCwgb3Igbm90aGluZy5cbnZhciBzcGxpdFBhdGhSZSA9XG4gICAgL14oXFwvP3wpKFtcXHNcXFNdKj8pKCg/OlxcLnsxLDJ9fFteXFwvXSs/fCkoXFwuW14uXFwvXSp8KSkoPzpbXFwvXSopJC87XG52YXIgc3BsaXRQYXRoID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aFJlLmV4ZWMoZmlsZW5hbWUpLnNsaWNlKDEpO1xufTtcblxuLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXNvbHZlZFBhdGggPSAnJyxcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIHZhciBwYXRoID0gKGkgPj0gMCkgPyBhcmd1bWVudHNbaV0gOiBwcm9jZXNzLmN3ZCgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBhbmQgaW52YWxpZCBlbnRyaWVzXG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGgucmVzb2x2ZSBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9IGVsc2UgaWYgKCFwYXRoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBwYXRoICsgJy8nICsgcmVzb2x2ZWRQYXRoO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsIGJ1dFxuICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcmVzb2x2ZWRQYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHJlc29sdmVkUGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFyZXNvbHZlZEFic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgcmV0dXJuICgocmVzb2x2ZWRBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHJlc29sdmVkUGF0aCkgfHwgJy4nO1xufTtcblxuLy8gcGF0aC5ub3JtYWxpemUocGF0aClcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMubm9ybWFsaXplID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgaXNBYnNvbHV0ZSA9IGV4cG9ydHMuaXNBYnNvbHV0ZShwYXRoKSxcbiAgICAgIHRyYWlsaW5nU2xhc2ggPSBzdWJzdHIocGF0aCwgLTEpID09PSAnLyc7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFpc0Fic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgaWYgKCFwYXRoICYmICFpc0Fic29sdXRlKSB7XG4gICAgcGF0aCA9ICcuJztcbiAgfVxuICBpZiAocGF0aCAmJiB0cmFpbGluZ1NsYXNoKSB7XG4gICAgcGF0aCArPSAnLyc7XG4gIH1cblxuICByZXR1cm4gKGlzQWJzb2x1dGUgPyAnLycgOiAnJykgKyBwYXRoO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5pc0Fic29sdXRlID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuam9pbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcGF0aHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICByZXR1cm4gZXhwb3J0cy5ub3JtYWxpemUoZmlsdGVyKHBhdGhzLCBmdW5jdGlvbihwLCBpbmRleCkge1xuICAgIGlmICh0eXBlb2YgcCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLmpvaW4gbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9KS5qb2luKCcvJykpO1xufTtcblxuXG4vLyBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZWxhdGl2ZSA9IGZ1bmN0aW9uKGZyb20sIHRvKSB7XG4gIGZyb20gPSBleHBvcnRzLnJlc29sdmUoZnJvbSkuc3Vic3RyKDEpO1xuICB0byA9IGV4cG9ydHMucmVzb2x2ZSh0bykuc3Vic3RyKDEpO1xuXG4gIGZ1bmN0aW9uIHRyaW0oYXJyKSB7XG4gICAgdmFyIHN0YXJ0ID0gMDtcbiAgICBmb3IgKDsgc3RhcnQgPCBhcnIubGVuZ3RoOyBzdGFydCsrKSB7XG4gICAgICBpZiAoYXJyW3N0YXJ0XSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIHZhciBlbmQgPSBhcnIubGVuZ3RoIC0gMTtcbiAgICBmb3IgKDsgZW5kID49IDA7IGVuZC0tKSB7XG4gICAgICBpZiAoYXJyW2VuZF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPiBlbmQpIHJldHVybiBbXTtcbiAgICByZXR1cm4gYXJyLnNsaWNlKHN0YXJ0LCBlbmQgLSBzdGFydCArIDEpO1xuICB9XG5cbiAgdmFyIGZyb21QYXJ0cyA9IHRyaW0oZnJvbS5zcGxpdCgnLycpKTtcbiAgdmFyIHRvUGFydHMgPSB0cmltKHRvLnNwbGl0KCcvJykpO1xuXG4gIHZhciBsZW5ndGggPSBNYXRoLm1pbihmcm9tUGFydHMubGVuZ3RoLCB0b1BhcnRzLmxlbmd0aCk7XG4gIHZhciBzYW1lUGFydHNMZW5ndGggPSBsZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZnJvbVBhcnRzW2ldICE9PSB0b1BhcnRzW2ldKSB7XG4gICAgICBzYW1lUGFydHNMZW5ndGggPSBpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIG91dHB1dFBhcnRzID0gW107XG4gIGZvciAodmFyIGkgPSBzYW1lUGFydHNMZW5ndGg7IGkgPCBmcm9tUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBvdXRwdXRQYXJ0cy5wdXNoKCcuLicpO1xuICB9XG5cbiAgb3V0cHV0UGFydHMgPSBvdXRwdXRQYXJ0cy5jb25jYXQodG9QYXJ0cy5zbGljZShzYW1lUGFydHNMZW5ndGgpKTtcblxuICByZXR1cm4gb3V0cHV0UGFydHMuam9pbignLycpO1xufTtcblxuZXhwb3J0cy5zZXAgPSAnLyc7XG5leHBvcnRzLmRlbGltaXRlciA9ICc6JztcblxuZXhwb3J0cy5kaXJuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgcmVzdWx0ID0gc3BsaXRQYXRoKHBhdGgpLFxuICAgICAgcm9vdCA9IHJlc3VsdFswXSxcbiAgICAgIGRpciA9IHJlc3VsdFsxXTtcblxuICBpZiAoIXJvb3QgJiYgIWRpcikge1xuICAgIC8vIE5vIGRpcm5hbWUgd2hhdHNvZXZlclxuICAgIHJldHVybiAnLic7XG4gIH1cblxuICBpZiAoZGlyKSB7XG4gICAgLy8gSXQgaGFzIGEgZGlybmFtZSwgc3RyaXAgdHJhaWxpbmcgc2xhc2hcbiAgICBkaXIgPSBkaXIuc3Vic3RyKDAsIGRpci5sZW5ndGggLSAxKTtcbiAgfVxuXG4gIHJldHVybiByb290ICsgZGlyO1xufTtcblxuXG5leHBvcnRzLmJhc2VuYW1lID0gZnVuY3Rpb24ocGF0aCwgZXh0KSB7XG4gIHZhciBmID0gc3BsaXRQYXRoKHBhdGgpWzJdO1xuICAvLyBUT0RPOiBtYWtlIHRoaXMgY29tcGFyaXNvbiBjYXNlLWluc2Vuc2l0aXZlIG9uIHdpbmRvd3M/XG4gIGlmIChleHQgJiYgZi5zdWJzdHIoLTEgKiBleHQubGVuZ3RoKSA9PT0gZXh0KSB7XG4gICAgZiA9IGYuc3Vic3RyKDAsIGYubGVuZ3RoIC0gZXh0Lmxlbmd0aCk7XG4gIH1cbiAgcmV0dXJuIGY7XG59O1xuXG5cbmV4cG9ydHMuZXh0bmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aChwYXRoKVszXTtcbn07XG5cbmZ1bmN0aW9uIGZpbHRlciAoeHMsIGYpIHtcbiAgICBpZiAoeHMuZmlsdGVyKSByZXR1cm4geHMuZmlsdGVyKGYpO1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChmKHhzW2ldLCBpLCB4cykpIHJlcy5wdXNoKHhzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbn1cblxuLy8gU3RyaW5nLnByb3RvdHlwZS5zdWJzdHIgLSBuZWdhdGl2ZSBpbmRleCBkb24ndCB3b3JrIGluIElFOFxudmFyIHN1YnN0ciA9ICdhYicuc3Vic3RyKC0xKSA9PT0gJ2InXG4gICAgPyBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7IHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pIH1cbiAgICA6IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHtcbiAgICAgICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSBzdHIubGVuZ3RoICsgc3RhcnQ7XG4gICAgICAgIHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pO1xuICAgIH1cbjtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLypcbiAqIENvcHlyaWdodCAoQykgMjAwNy0yMDE1IERpZWdvIFBlcmluaVxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBud21hdGNoZXIuanMgLSBBIGZhc3QgQ1NTIHNlbGVjdG9yIGVuZ2luZSBhbmQgbWF0Y2hlclxuICpcbiAqIEF1dGhvcjogRGllZ28gUGVyaW5pIDxkaWVnby5wZXJpbmkgYXQgZ21haWwgY29tPlxuICogVmVyc2lvbjogMS4zLjdcbiAqIENyZWF0ZWQ6IDIwMDcwNzIyXG4gKiBSZWxlYXNlOiAyMDE1MTEyMFxuICpcbiAqIExpY2Vuc2U6XG4gKiAgaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL05XTWF0Y2hlci9NSVQtTElDRU5TRVxuICogRG93bmxvYWQ6XG4gKiAgaHR0cDovL2phdmFzY3JpcHQubndib3guY29tL05XTWF0Y2hlci9ud21hdGNoZXIuanNcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsLCBmYWN0b3J5KSB7XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgPT0gJ29iamVjdCcgJiYgdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcpIHtcbiAgICAvLyBpbiBhIE5vZGUuanMgZW52aXJvbm1lbnQsIHRoZSBud21hdGNoZXIgZnVuY3Rpb25zIHdpbGwgb3BlcmF0ZSBvblxuICAgIC8vIHRoZSBwYXNzZWQgXCJicm93c2VyR2xvYmFsXCIgYW5kIHdpbGwgYmUgcmV0dXJuZWQgaW4gYW4gb2JqZWN0XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYnJvd3Nlckdsb2JhbCkge1xuICAgICAgLy8gcGFzc2VkIGdsb2JhbCBkb2VzIG5vdCBjb250YWluXG4gICAgICAvLyByZWZlcmVuY2VzIHRvIG5hdGl2ZSBvYmplY3RzXG4gICAgICBicm93c2VyR2xvYmFsLmNvbnNvbGUgPSBjb25zb2xlO1xuICAgICAgYnJvd3Nlckdsb2JhbC5wYXJzZUludCA9IHBhcnNlSW50O1xuICAgICAgYnJvd3Nlckdsb2JhbC5GdW5jdGlvbiA9IEZ1bmN0aW9uO1xuICAgICAgYnJvd3Nlckdsb2JhbC5Cb29sZWFuID0gQm9vbGVhbjtcbiAgICAgIGJyb3dzZXJHbG9iYWwuTnVtYmVyID0gTnVtYmVyO1xuICAgICAgYnJvd3Nlckdsb2JhbC5SZWdFeHAgPSBSZWdFeHA7XG4gICAgICBicm93c2VyR2xvYmFsLlN0cmluZyA9IFN0cmluZztcbiAgICAgIGJyb3dzZXJHbG9iYWwuT2JqZWN0ID0gT2JqZWN0O1xuICAgICAgYnJvd3Nlckdsb2JhbC5BcnJheSA9IEFycmF5O1xuICAgICAgYnJvd3Nlckdsb2JhbC5FcnJvciA9IEVycm9yO1xuICAgICAgYnJvd3Nlckdsb2JhbC5EYXRlID0gRGF0ZTtcbiAgICAgIGJyb3dzZXJHbG9iYWwuTWF0aCA9IE1hdGg7XG4gICAgICB2YXIgZXhwb3J0cyA9IGJyb3dzZXJHbG9iYWwuT2JqZWN0KCk7XG4gICAgICBmYWN0b3J5KGJyb3dzZXJHbG9iYWwsIGV4cG9ydHMpO1xuICAgICAgcmV0dXJuIGV4cG9ydHM7XG4gICAgfTtcbiAgICBtb2R1bGUuZmFjdG9yeSA9IGZhY3Rvcnk7XG4gIH0gZWxzZSB7XG4gICAgLy8gaW4gYSBicm93c2VyIGVudmlyb25tZW50LCB0aGUgbndtYXRjaGVyIGZ1bmN0aW9ucyB3aWxsIG9wZXJhdGUgb25cbiAgICAvLyB0aGUgXCJnbG9iYWxcIiBsb2FkaW5nIHRoZW0gYW5kIGJlIGF0dGFjaGVkIHRvIFwiZ2xvYmFsLk5XLkRvbVwiXG4gICAgZmFjdG9yeShnbG9iYWwsXG4gICAgICAoZ2xvYmFsLk5XIHx8IChnbG9iYWwuTlcgPSBnbG9iYWwuT2JqZWN0KCkpKSAmJlxuICAgICAgKGdsb2JhbC5OVy5Eb20gfHwgKGdsb2JhbC5OVy5Eb20gPSBnbG9iYWwuT2JqZWN0KCkpKSk7XG4gICAgZ2xvYmFsLk5XLkRvbS5mYWN0b3J5ID0gZmFjdG9yeTtcbiAgfVxuXG59KSh0aGlzLCBmdW5jdGlvbihnbG9iYWwsIGV4cG9ydHMpIHtcblxuICB2YXIgdmVyc2lvbiA9ICdud21hdGNoZXItMS4zLjcnLFxuXG4gIERvbSA9IGV4cG9ydHMsXG5cbiAgLy8gcHJvY2Vzc2luZyBjb250ZXh0ICYgcm9vdCBlbGVtZW50XG4gIGRvYyA9IGdsb2JhbC5kb2N1bWVudCxcbiAgcm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQsXG5cbiAgLy8gc2F2ZSB1dGlsaXR5IG1ldGhvZHMgcmVmZXJlbmNlc1xuICBzbGljZSA9IGdsb2JhbC5BcnJheS5wcm90b3R5cGUuc2xpY2UsXG4gIHN0cmluZyA9IGdsb2JhbC5PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuXG4gIC8vIHBlcnNpc3QgcHJldmlvdXMgcGFyc2VkIGRhdGFcbiAgaXNTaW5nbGVNYXRjaCxcbiAgaXNTaW5nbGVTZWxlY3QsXG5cbiAgbGFzdFNsaWNlLFxuICBsYXN0Q29udGV4dCxcbiAgbGFzdFBvc2l0aW9uLFxuXG4gIGxhc3RNYXRjaGVyLFxuICBsYXN0U2VsZWN0b3IsXG5cbiAgbGFzdFBhcnRzTWF0Y2gsXG4gIGxhc3RQYXJ0c1NlbGVjdCxcblxuICAvLyBhY2NlcHRlZCBwcmVmaXggaWRlbnRpZmllcnNcbiAgLy8gKGlkLCBjbGFzcyAmIHBzZXVkby1jbGFzcylcbiAgcHJlZml4ZXMgPSAnWyMuOl0/JyxcblxuICAvLyBhY2NlcHRlZCBhdHRyaWJ1dGUgb3BlcmF0b3JzXG4gIG9wZXJhdG9ycyA9ICcoW34qXiR8IV0/PXsxfSknLFxuXG4gIC8vIGFjY2VwdGVkIHdoaXRlc3BhY2UgY2hhcmFjdGVyc1xuICB3aGl0ZXNwYWNlID0gJ1tcXFxceDIwXFxcXHRcXFxcblxcXFxyXFxcXGZdKicsXG5cbiAgLy8gNCBjb21iaW5hdG9ycyBGIEUsIEY+RSwgRitFLCBGfkVcbiAgY29tYmluYXRvcnMgPSAnW1xcXFx4MjBdfFs+K35dKD89W14+K35dKScsXG5cbiAgLy8gYW4rYiBmb3JtYXQgcGFyYW1zIGZvciBwc2V1ZG8tY2xhc3Nlc1xuICBwc2V1ZG9wYXJtcyA9ICcoPzpbLStdP1xcXFxkKm4pP1stK10/XFxcXGQqJyxcblxuICAvLyBDU1MgcXVvdGVkIHN0cmluZyB2YWx1ZXNcbiAgcXVvdGVkdmFsdWUgPSAnXCJbXlwiXFxcXFxcXFxdKig/OlxcXFxcXFxcLlteXCJcXFxcXFxcXF0qKSpcIicgKyBcInwnW14nXFxcXFxcXFxdKig/OlxcXFxcXFxcLlteJ1xcXFxcXFxcXSopKidcIixcblxuICAvLyBza2lwIHJvdW5kIGJyYWNrZXRzIGdyb3Vwc1xuICBza2lwcm91bmQgPSAnXFxcXChbXigpXStcXFxcKXxcXFxcKC4qXFxcXCknLFxuICAvLyBza2lwIGN1cmx5IGJyYWNrZXRzIGdyb3Vwc1xuICBza2lwY3VybHkgPSAnXFxcXHtbXnt9XStcXFxcfXxcXFxcey4qXFxcXH0nLFxuICAvLyBza2lwIHNxdWFyZSBicmFja2V0cyBncm91cHNcbiAgc2tpcHNxdWFyZSA9ICdcXFxcW1teW1xcXFxdXSpcXFxcXXxcXFxcWy4qXFxcXF0nLFxuXG4gIC8vIHNraXAgWyBdLCAoICksIHsgfSBicmFja2V0cyBncm91cHNcbiAgc2tpcGdyb3VwID0gJ1xcXFxbLipcXFxcXXxcXFxcKC4qXFxcXCl8XFxcXHsuKlxcXFx9JyxcblxuICAvLyBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLXN5bnRheC8jY2hhcmFjdGVyc1xuICAvLyB1bmljb2RlL0lTTyAxMDY0NiBjaGFyYWN0ZXJzIDE2MSBhbmQgaGlnaGVyXG4gIC8vIE5PVEU6IFNhZmFyaSAyLjAueCBjcmFzaGVzIHdpdGggZXNjYXBlZCAoXFxcXClcbiAgLy8gVW5pY29kZSByYW5nZXMgaW4gcmVndWxhciBleHByZXNzaW9ucyBzbyB3ZVxuICAvLyB1c2UgYSBuZWdhdGVkIGNoYXJhY3RlciByYW5nZSBjbGFzcyBpbnN0ZWFkXG4gIGVuY29kaW5nID0gJyg/OlstXFxcXHddfFteXFxcXHgwMC1cXFxceGEwXXxcXFxcXFxcXC4pJyxcblxuICAvLyBDU1MgaWRlbnRpZmllciBzeW50YXhcbiAgaWRlbnRpZmllciA9ICcoPzotP1tfYS16QS1aXXsxfVstXFxcXHddKnxbXlxcXFx4MDAtXFxcXHhhMF0rfFxcXFxcXFxcLispKycsXG5cbiAgLy8gYnVpbGQgYXR0cmlidXRlIHN0cmluZ1xuICBhdHRyY2hlY2sgPSAnKCcgKyBxdW90ZWR2YWx1ZSArICd8JyArIGlkZW50aWZpZXIgKyAnKScsXG4gIGF0dHJpYnV0ZXMgPSB3aGl0ZXNwYWNlICsgJygnICsgZW5jb2RpbmcgKyAnKjo/JyArIGVuY29kaW5nICsgJyspJyArXG4gICAgd2hpdGVzcGFjZSArICcoPzonICsgb3BlcmF0b3JzICsgd2hpdGVzcGFjZSArIGF0dHJjaGVjayArICcpPycgKyB3aGl0ZXNwYWNlLFxuICBhdHRybWF0Y2hlciA9IGF0dHJpYnV0ZXMucmVwbGFjZShhdHRyY2hlY2ssICcoW1xcXFx4MjJcXFxceDI3XSopKCg/OlxcXFxcXFxcPy4pKj8pXFxcXDMnKSxcblxuICAvLyBidWlsZCBwc2V1ZG9jbGFzcyBzdHJpbmdcbiAgcHNldWRvY2xhc3MgPSAnKCg/OicgK1xuICAgIC8vIGFuK2IgcGFyYW1ldGVycyBvciBxdW90ZWQgc3RyaW5nXG4gICAgcHNldWRvcGFybXMgKyAnfCcgKyBxdW90ZWR2YWx1ZSArICd8JyArXG4gICAgLy8gaWQsIGNsYXNzLCBwc2V1ZG8tY2xhc3Mgc2VsZWN0b3JcbiAgICBwcmVmaXhlcyArICd8JyArIGVuY29kaW5nICsgJyt8JyArXG4gICAgLy8gbmVzdGVkIEhUTUwgYXR0cmlidXRlIHNlbGVjdG9yXG4gICAgJ1xcXFxbJyArIGF0dHJpYnV0ZXMgKyAnXFxcXF18JyArXG4gICAgLy8gbmVzdGVkIHBzZXVkby1jbGFzcyBzZWxlY3RvclxuICAgICdcXFxcKC4rXFxcXCl8JyArIHdoaXRlc3BhY2UgKyAnfCcgK1xuICAgIC8vIG5lc3RlZCBwc2V1ZG9zL3NlcGFyYXRvcnNcbiAgICAnLCkrKScsXG5cbiAgLy8gcGxhY2Vob2xkZXIgZm9yIGV4dGVuc2lvbnNcbiAgZXh0ZW5zaW9ucyA9ICcuKycsXG5cbiAgLy8gQ1NTMzogc3ludGF4IHNjYW5uZXIgYW5kXG4gIC8vIG9uZSBwYXNzIHZhbGlkYXRpb24gb25seVxuICAvLyB1c2luZyByZWd1bGFyIGV4cHJlc3Npb25cbiAgc3RhbmRhcmRWYWxpZGF0b3IgPVxuICAgIC8vIGRpc2NhcmQgc3RhcnRcbiAgICAnKD89W1xcXFx4MjBcXFxcdFxcXFxuXFxcXHJcXFxcZl0qW14+K34oKXt9PD5dKScgK1xuICAgIC8vIG9wZW4gbWF0Y2ggZ3JvdXBcbiAgICAnKCcgK1xuICAgIC8vdW5pdmVyc2FsIHNlbGVjdG9yXG4gICAgJ1xcXFwqJyArXG4gICAgLy8gaWQvY2xhc3MvdGFnL3BzZXVkby1jbGFzcyBpZGVudGlmaWVyXG4gICAgJ3woPzonICsgcHJlZml4ZXMgKyBpZGVudGlmaWVyICsgJyknICtcbiAgICAvLyBjb21iaW5hdG9yIHNlbGVjdG9yXG4gICAgJ3wnICsgY29tYmluYXRvcnMgK1xuICAgIC8vIEhUTUwgYXR0cmlidXRlIHNlbGVjdG9yXG4gICAgJ3xcXFxcWycgKyBhdHRyaWJ1dGVzICsgJ1xcXFxdJyArXG4gICAgLy8gcHNldWRvLWNsYXNzZXMgcGFyYW1ldGVyc1xuICAgICd8XFxcXCgnICsgcHNldWRvY2xhc3MgKyAnXFxcXCknICtcbiAgICAvLyBkb20gcHJvcGVydGllcyBzZWxlY3RvciAoZXh0ZW5zaW9uKVxuICAgICd8XFxcXHsnICsgZXh0ZW5zaW9ucyArICdcXFxcfScgK1xuICAgIC8vIHNlbGVjdG9yIGdyb3VwIHNlcGFyYXRvciAoY29tbWEpXG4gICAgJ3woPzosfCcgKyB3aGl0ZXNwYWNlICsgJyknICtcbiAgICAvLyBjbG9zZSBtYXRjaCBncm91cFxuICAgICcpKycsXG5cbiAgLy8gdmFsaWRhdG9yIGZvciBjb21wbGV4IHNlbGVjdG9ycyBpbiAnOm5vdCgpJyBwc2V1ZG8tY2xhc3Nlc1xuICBleHRlbmRlZFZhbGlkYXRvciA9IHN0YW5kYXJkVmFsaWRhdG9yLnJlcGxhY2UocHNldWRvY2xhc3MsICcuKicpLFxuXG4gIC8vIHZhbGlkYXRvciBmb3Igc3RhbmRhcmQgc2VsZWN0b3JzIGFzIGRlZmF1bHRcbiAgcmVWYWxpZGF0b3IgPSBuZXcgZ2xvYmFsLlJlZ0V4cChzdGFuZGFyZFZhbGlkYXRvciksXG5cbiAgLy8gd2hpdGVzcGFjZSBpcyBhbnkgY29tYmluYXRpb24gb2YgdGhlc2UgNSBjaGFyYWN0ZXIgW1xceDIwXFx0XFxuXFxyXFxmXVxuICAvLyBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLXNlbGVjdG9ycy8jc2VsZWN0b3Itc3ludGF4XG4gIHJlVHJpbVNwYWNlcyA9IG5ldyBnbG9iYWwuUmVnRXhwKCdeJyArXG4gICAgd2hpdGVzcGFjZSArICd8JyArIHdoaXRlc3BhY2UgKyAnJCcsICdnJyksXG5cbiAgLy8gb25seSBhbGxvdyBzaW1wbGUgc2VsZWN0b3JzIG5lc3RlZCBpbiAnOm5vdCgpJyBwc2V1ZG8tY2xhc3Nlc1xuICByZVNpbXBsZU5vdCA9IG5ldyBnbG9iYWwuUmVnRXhwKCdeKCcgK1xuICAgICcoPyE6bm90KScgK1xuICAgICcoJyArIHByZWZpeGVzICtcbiAgICAnfCcgKyBpZGVudGlmaWVyICtcbiAgICAnfFxcXFwoW14oKV0qXFxcXCkpKycgK1xuICAgICd8XFxcXFsnICsgYXR0cmlidXRlcyArICdcXFxcXScgK1xuICAgICcpJCcpLFxuXG4gIC8vIHNwbGl0IGNvbW1hIGdyb3VwcywgZXhjbHVkZSBjb21tYXMgZnJvbVxuICAvLyBxdW90ZXMgJycgXCJcIiBhbmQgZnJvbSBicmFja2V0cyAoKSBbXSB7fVxuICByZVNwbGl0R3JvdXAgPSBuZXcgZ2xvYmFsLlJlZ0V4cCgnKCcgK1xuICAgICdbXixcXFxcXFxcXCgpW1xcXFxdXSsnICtcbiAgICAnfCcgKyBza2lwc3F1YXJlICtcbiAgICAnfCcgKyBza2lwcm91bmQgK1xuICAgICd8JyArIHNraXBjdXJseSArXG4gICAgJ3xcXFxcXFxcXC4nICtcbiAgICAnKSsnLCAnZycpLFxuXG4gIC8vIHNwbGl0IGxhc3QsIHJpZ2h0IG1vc3QsIHNlbGVjdG9yIGdyb3VwIHRva2VuXG4gIHJlU3BsaXRUb2tlbiA9IG5ldyBnbG9iYWwuUmVnRXhwKCcoJyArXG4gICAgJ1xcXFxbJyArIGF0dHJpYnV0ZXMgKyAnXFxcXF18JyArXG4gICAgJ1xcXFwoJyArIHBzZXVkb2NsYXNzICsgJ1xcXFwpfCcgK1xuICAgICdcXFxcXFxcXC58W15cXFxceDIwXFxcXHRcXFxcclxcXFxuXFxcXGY+K35dKSsnLCAnZycpLFxuXG4gIC8vIGZvciBpbiBleGNlc3Mgd2hpdGVzcGFjZSByZW1vdmFsXG4gIHJlV2hpdGVTcGFjZSA9IC9bXFx4MjBcXHRcXG5cXHJcXGZdKy9nLFxuXG4gIHJlT3B0aW1pemVTZWxlY3RvciA9IG5ldyBnbG9iYWwuUmVnRXhwKGlkZW50aWZpZXIgKyAnfF4kJyksXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBGRUFUVVJFIFRFU1RJTkcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZGV0ZWN0IG5hdGl2ZSBtZXRob2RzXG4gIGlzTmF0aXZlID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciByZSA9IC8gXFx3K1xcKC8sXG4gICAgaXNuYXRpdmUgPSBTdHJpbmcoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZykucmVwbGFjZShyZSwgJyAoJyk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgICAgcmV0dXJuIG1ldGhvZCAmJiB0eXBlb2YgbWV0aG9kICE9ICdzdHJpbmcnICYmXG4gICAgICAgIGlzbmF0aXZlID09IFN0cmluZyhtZXRob2QpLnJlcGxhY2UocmUsICcgKCcpO1xuICAgIH07XG4gIH0pKCksXG5cbiAgLy8gTkFUSVZFX1hYWFhYIHRydWUgaWYgbWV0aG9kIGV4aXN0IGFuZCBpcyBjYWxsYWJsZVxuICAvLyBkZXRlY3QgaWYgRE9NIG1ldGhvZHMgYXJlIG5hdGl2ZSBpbiBicm93c2Vyc1xuICBOQVRJVkVfRk9DVVMgPSBpc05hdGl2ZShkb2MuaGFzRm9jdXMpLFxuICBOQVRJVkVfUVNBUEkgPSBpc05hdGl2ZShkb2MucXVlcnlTZWxlY3RvciksXG4gIE5BVElWRV9HRUJJRCA9IGlzTmF0aXZlKGRvYy5nZXRFbGVtZW50QnlJZCksXG4gIE5BVElWRV9HRUJUTiA9IGlzTmF0aXZlKHJvb3QuZ2V0RWxlbWVudHNCeVRhZ05hbWUpLFxuICBOQVRJVkVfR0VCQ04gPSBpc05hdGl2ZShyb290LmdldEVsZW1lbnRzQnlDbGFzc05hbWUpLFxuXG4gIC8vIGRldGVjdCBuYXRpdmUgZ2V0QXR0cmlidXRlL2hhc0F0dHJpYnV0ZSBtZXRob2RzLFxuICAvLyBmcmFtZXdvcmtzIGV4dGVuZCB0aGVzZSB0byBlbGVtZW50cywgYnV0IGl0IHNlZW1zXG4gIC8vIHRoaXMgZG9lcyBub3Qgd29yayBmb3IgWE1MIG5hbWVzcGFjZWQgYXR0cmlidXRlcyxcbiAgLy8gdXNlZCB0byBjaGVjayBib3RoIGdldEF0dHJpYnV0ZS9oYXNBdHRyaWJ1dGUgaW4gSUVcbiAgTkFUSVZFX0dFVF9BVFRSSUJVVEUgPSBpc05hdGl2ZShyb290LmdldEF0dHJpYnV0ZSksXG4gIE5BVElWRV9IQVNfQVRUUklCVVRFID0gaXNOYXRpdmUocm9vdC5oYXNBdHRyaWJ1dGUpLFxuXG4gIC8vIGNoZWNrIGlmIHNsaWNlKCkgY2FuIGNvbnZlcnQgbm9kZWxpc3QgdG8gYXJyYXlcbiAgLy8gc2VlIGh0dHA6Ly95dXJhLnRoaW5rd2ViMi5jb20vY2Z0L1xuICBOQVRJVkVfU0xJQ0VfUFJPVE8gPVxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpc0J1Z2d5ID0gZmFsc2U7XG4gICAgICB0cnkge1xuICAgICAgICBpc0J1Z2d5ID0gISFzbGljZS5jYWxsKGRvYy5jaGlsZE5vZGVzLCAwKVswXTtcbiAgICAgIH0gY2F0Y2goZSkgeyB9XG4gICAgICByZXR1cm4gaXNCdWdneTtcbiAgICB9KSgpLFxuXG4gIC8vIHN1cHBvcnRzIHRoZSBuZXcgdHJhdmVyc2FsIEFQSVxuICBOQVRJVkVfVFJBVkVSU0FMX0FQSSA9XG4gICAgJ25leHRFbGVtZW50U2libGluZycgaW4gcm9vdCAmJiAncHJldmlvdXNFbGVtZW50U2libGluZycgaW4gcm9vdCxcblxuICAvLyBCVUdHWV9YWFhYWCB0cnVlIGlmIG1ldGhvZCBpcyBmZWF0dXJlIHRlc3RlZCBhbmQgaGFzIGtub3duIGJ1Z3NcbiAgLy8gZGV0ZWN0IGJ1Z2d5IGdFQklEXG4gIEJVR0dZX0dFQklEID0gTkFUSVZFX0dFQklEID9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaXNCdWdneSA9IHRydWUsIHggPSAneCcgKyBnbG9iYWwuU3RyaW5nKCtuZXcgZ2xvYmFsLkRhdGUpLFxuICAgICAgICBhID0gZG9jLmNyZWF0ZUVsZW1lbnROUyA/ICdhJyA6ICc8YSBuYW1lPVwiJyArIHggKyAnXCI+JztcbiAgICAgIChhID0gZG9jLmNyZWF0ZUVsZW1lbnQoYSkpLm5hbWUgPSB4O1xuICAgICAgcm9vdC5pbnNlcnRCZWZvcmUoYSwgcm9vdC5maXJzdENoaWxkKTtcbiAgICAgIGlzQnVnZ3kgPSAhIWRvYy5nZXRFbGVtZW50QnlJZCh4KTtcbiAgICAgIHJvb3QucmVtb3ZlQ2hpbGQoYSk7XG4gICAgICByZXR1cm4gaXNCdWdneTtcbiAgICB9KSgpIDpcbiAgICB0cnVlLFxuXG4gIC8vIGRldGVjdCBJRSBnRUJUTiBjb21tZW50IG5vZGVzIGJ1Z1xuICBCVUdHWV9HRUJUTiA9IE5BVElWRV9HRUJUTiA/XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRpdiA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGRpdi5hcHBlbmRDaGlsZChkb2MuY3JlYXRlQ29tbWVudCgnJykpO1xuICAgICAgcmV0dXJuICEhZGl2LmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJylbMF07XG4gICAgfSkoKSA6XG4gICAgdHJ1ZSxcblxuICAvLyBkZXRlY3QgT3BlcmEgZ0VCQ04gc2Vjb25kIGNsYXNzIGFuZC9vciBVVEY4IGJ1Z3MgYXMgd2VsbCBhcyBTYWZhcmkgMy4yXG4gIC8vIGNhY2hpbmcgY2xhc3MgbmFtZSByZXN1bHRzIGFuZCBub3QgZGV0ZWN0aW5nIHdoZW4gY2hhbmdlZCxcbiAgLy8gdGVzdHMgYXJlIGJhc2VkIG9uIHRoZSBqUXVlcnkgc2VsZWN0b3IgdGVzdCBzdWl0ZVxuICBCVUdHWV9HRUJDTiA9IE5BVElWRV9HRUJDTiA/XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlzQnVnZ3ksIGRpdiA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKSwgdGVzdCA9ICdcXHU1M2YwXFx1NTMxNyc7XG5cbiAgICAgIC8vIE9wZXJhIHRlc3RzXG4gICAgICBkaXYuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSkuXG4gICAgICAgIHNldEF0dHJpYnV0ZSgnY2xhc3MnLCB0ZXN0ICsgJ2FiYyAnICsgdGVzdCk7XG4gICAgICBkaXYuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKSkuXG4gICAgICAgIHNldEF0dHJpYnV0ZSgnY2xhc3MnLCAneCcpO1xuXG4gICAgICBpc0J1Z2d5ID0gIWRpdi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKHRlc3QpWzBdO1xuXG4gICAgICAvLyBTYWZhcmkgdGVzdFxuICAgICAgZGl2Lmxhc3RDaGlsZC5jbGFzc05hbWUgPSB0ZXN0O1xuICAgICAgcmV0dXJuIGlzQnVnZ3kgfHwgZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUodGVzdCkubGVuZ3RoICE9IDI7XG4gICAgfSkoKSA6XG4gICAgdHJ1ZSxcblxuICAvLyBkZXRlY3QgSUUgYnVnIHdpdGggZHluYW1pYyBhdHRyaWJ1dGVzXG4gIEJVR0dZX0dFVF9BVFRSSUJVVEUgPSBOQVRJVkVfR0VUX0FUVFJJQlVURSA/XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlucHV0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgNSk7XG4gICAgICByZXR1cm4gaW5wdXQuZGVmYXVsdFZhbHVlICE9IDU7XG4gICAgfSkoKSA6XG4gICAgdHJ1ZSxcblxuICAvLyBkZXRlY3QgSUUgYnVnIHdpdGggbm9uLXN0YW5kYXJkIGJvb2xlYW4gYXR0cmlidXRlc1xuICBCVUdHWV9IQVNfQVRUUklCVVRFID0gTkFUSVZFX0hBU19BVFRSSUJVVEUgP1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvcHRpb24gPSBkb2MuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XG4gICAgICBvcHRpb24uc2V0QXR0cmlidXRlKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xuICAgICAgcmV0dXJuICFvcHRpb24uaGFzQXR0cmlidXRlKCdzZWxlY3RlZCcpO1xuICAgIH0pKCkgOlxuICAgIHRydWUsXG5cbiAgLy8gZGV0ZWN0IFNhZmFyaSBidWcgd2l0aCBzZWxlY3RlZCBvcHRpb24gZWxlbWVudHNcbiAgQlVHR1lfU0VMRUNURUQgPVxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxlY3QgPSBkb2MuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG4gICAgICBzZWxlY3QuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpKTtcbiAgICAgIHJldHVybiAhc2VsZWN0LmZpcnN0Q2hpbGQuc2VsZWN0ZWQ7XG4gICAgfSkoKSxcblxuICAvLyBpbml0aWFsaXplZCB3aXRoIHRoZSBsb2FkaW5nIGNvbnRleHRcbiAgLy8gYW5kIHJlc2V0IGZvciBlYWNoIGRpZmZlcmVudCBjb250ZXh0XG4gIEJVR0dZX1FVSVJLU19HRUJDTixcbiAgQlVHR1lfUVVJUktTX1FTQVBJLFxuXG4gIFFVSVJLU19NT0RFLFxuICBYTUxfRE9DVU1FTlQsXG5cbiAgLy8gZGV0ZWN0IE9wZXJhIGJyb3dzZXJcbiAgT1BFUkEgPSAvb3BlcmEvaS50ZXN0KHN0cmluZy5jYWxsKGdsb2JhbC5vcGVyYSkpLFxuXG4gIC8vIHNraXAgc2ltcGxlIHNlbGVjdG9yIG9wdGltaXphdGlvbnMgZm9yIE9wZXJhID49IDExXG4gIE9QRVJBX1FTQVBJID0gT1BFUkEgJiYgZ2xvYmFsLnBhcnNlRmxvYXQoZ2xvYmFsLm9wZXJhLnZlcnNpb24oKSkgPj0gMTEsXG5cbiAgLy8gY2hlY2sgU2VsZWN0b3IgQVBJIGltcGxlbWVudGF0aW9uc1xuICBSRV9CVUdHWV9RU0FQSSA9IE5BVElWRV9RU0FQSSA/XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhdHRlcm4gPSBuZXcgZ2xvYmFsLkFycmF5KCksIGNvbnRleHQsIGVsZW1lbnQsXG5cbiAgICAgIGV4cGVjdCA9IGZ1bmN0aW9uKHNlbGVjdG9yLCBlbGVtZW50LCBuKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgY29udGV4dC5hcHBlbmRDaGlsZChlbGVtZW50KTtcbiAgICAgICAgdHJ5IHsgcmVzdWx0ID0gY29udGV4dC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKS5sZW5ndGggPT0gbjsgfSBjYXRjaChlKSB7IH1cbiAgICAgICAgd2hpbGUgKGNvbnRleHQuZmlyc3RDaGlsZCkgeyBjb250ZXh0LnJlbW92ZUNoaWxkKGNvbnRleHQuZmlyc3RDaGlsZCk7IH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH07XG5cbiAgICAgIC8vIGNlcnRhaW4gYnVncyBjYW4gb25seSBiZSBkZXRlY3RlZCBpbiBzdGFuZGFyZCBkb2N1bWVudHNcbiAgICAgIC8vIHRvIGF2b2lkIHdyaXRpbmcgYSBsaXZlIGxvYWRpbmcgZG9jdW1lbnQgY3JlYXRlIGEgZmFrZSBvbmVcbiAgICAgIGlmIChkb2MuaW1wbGVtZW50YXRpb24gJiYgZG9jLmltcGxlbWVudGF0aW9uLmNyZWF0ZURvY3VtZW50KSB7XG4gICAgICAgIC8vIHVzZSBhIHNoYWRvdyBkb2N1bWVudCBib2R5IGFzIGNvbnRleHRcbiAgICAgICAgY29udGV4dCA9IGRvYy5pbXBsZW1lbnRhdGlvbi5jcmVhdGVEb2N1bWVudCgnJywgJycsIG51bGwpLlxuICAgICAgICAgIGFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdodG1sJykpLlxuICAgICAgICAgIGFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdoZWFkJykpLnBhcmVudE5vZGUuXG4gICAgICAgICAgYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2JvZHknKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB1c2UgYW4gdW5hdHRhY2hlZCBkaXYgbm9kZSBhcyBjb250ZXh0XG4gICAgICAgIGNvbnRleHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGZpeCBmb3IgU2FmYXJpIDgueCBhbmQgb3RoZXIgZW5naW5lcyB0aGF0XG4gICAgICAvLyBmYWlsIHF1ZXJ5aW5nIGZpbHRlcmVkIHNpYmxpbmcgY29tYmluYXRvcnNcbiAgICAgIGVsZW1lbnQgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBlbGVtZW50LmlubmVySFRNTCA9ICc8cCBpZD1cImFcIj48L3A+PGJyPic7XG4gICAgICBleHBlY3QoJ3AjYSsqJywgZWxlbWVudCwgMCkgJiZcbiAgICAgICAgcGF0dGVybi5wdXNoKCdcXFxcdysjXFxcXHcrLipbK35dJyk7XG5cbiAgICAgIC8vIF49ICQ9ICo9IG9wZXJhdG9ycyBidWdzIHdpdGggZW1wdHkgdmFsdWVzIChPcGVyYSAxMCAvIElFOClcbiAgICAgIGVsZW1lbnQgPSBkb2MuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJycpO1xuICAgICAgZXhwZWN0KCdbY2xhc3NePVwiXCJdJywgZWxlbWVudCwgMSkgJiZcbiAgICAgICAgcGF0dGVybi5wdXNoKCdbKl4kXT1bXFxcXHgyMFxcXFx0XFxcXG5cXFxcclxcXFxmXSooPzpcIlwifCcgKyBcIicnKVwiKTtcblxuICAgICAgLy8gOmNoZWNrZWQgYnVnIHdpdGggb3B0aW9uIGVsZW1lbnRzIChGaXJlZm94IDMuNi54KVxuICAgICAgLy8gaXQgd3JvbmdseSBpbmNsdWRlcyAnc2VsZWN0ZWQnIG9wdGlvbnMgZWxlbWVudHNcbiAgICAgIC8vIEhUTUw1IHJ1bGVzIHNheXMgc2VsZWN0ZWQgb3B0aW9ucyBhbHNvIG1hdGNoXG4gICAgICBlbGVtZW50ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XG4gICAgICBleHBlY3QoJzpjaGVja2VkJywgZWxlbWVudCwgMCkgJiZcbiAgICAgICAgcGF0dGVybi5wdXNoKCc6Y2hlY2tlZCcpO1xuXG4gICAgICAvLyA6ZW5hYmxlZCA6ZGlzYWJsZWQgYnVncyB3aXRoIGhpZGRlbiBmaWVsZHMgKEZpcmVmb3ggMy41KVxuICAgICAgLy8gaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvbGlua3MuaHRtbCNzZWxlY3Rvci1lbmFibGVkXG4gICAgICAvLyBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLXNlbGVjdG9ycy8jZW5hYmxlZGRpc2FibGVkXG4gICAgICAvLyBub3Qgc3VwcG9ydGVkIGJ5IElFOCBRdWVyeSBTZWxlY3RvclxuICAgICAgZWxlbWVudCA9IGRvYy5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnaGlkZGVuJyk7XG4gICAgICBleHBlY3QoJzplbmFibGVkJywgZWxlbWVudCwgMCkgJiZcbiAgICAgICAgcGF0dGVybi5wdXNoKCc6ZW5hYmxlZCcsICc6ZGlzYWJsZWQnKTtcblxuICAgICAgLy8gOmxpbmsgYnVncyB3aXRoIGh5cGVybGlua3MgbWF0Y2hpbmcgKEZpcmVmb3gvU2FmYXJpKVxuICAgICAgZWxlbWVudCA9IGRvYy5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnaHJlZicsICd4Jyk7XG4gICAgICBleHBlY3QoJzpsaW5rJywgZWxlbWVudCwgMSkgfHxcbiAgICAgICAgcGF0dGVybi5wdXNoKCc6bGluaycpO1xuXG4gICAgICAvLyBhdm9pZCBhdHRyaWJ1dGUgc2VsZWN0b3JzIGZvciBJRSBRU0FcbiAgICAgIGlmIChCVUdHWV9IQVNfQVRUUklCVVRFKSB7XG4gICAgICAgIC8vIElFIGZhaWxzIGluIHJlYWRpbmc6XG4gICAgICAgIC8vIC0gb3JpZ2luYWwgdmFsdWVzIGZvciBpbnB1dC90ZXh0YXJlYVxuICAgICAgICAvLyAtIG9yaWdpbmFsIGJvb2xlYW4gdmFsdWVzIGZvciBjb250cm9sc1xuICAgICAgICBwYXR0ZXJuLnB1c2goJ1xcXFxbW1xcXFx4MjBcXFxcdFxcXFxuXFxcXHJcXFxcZl0qKD86Y2hlY2tlZHxkaXNhYmxlZHxpc21hcHxtdWx0aXBsZXxyZWFkb25seXxzZWxlY3RlZHx2YWx1ZSknKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhdHRlcm4ubGVuZ3RoID9cbiAgICAgICAgbmV3IGdsb2JhbC5SZWdFeHAocGF0dGVybi5qb2luKCd8JykpIDpcbiAgICAgICAgeyAndGVzdCc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2U7IH0gfTtcblxuICAgIH0pKCkgOlxuICAgIHRydWUsXG5cbiAgLy8gbWF0Y2hlcyBjbGFzcyBzZWxlY3RvcnNcbiAgUkVfQ0xBU1MgPSBuZXcgZ2xvYmFsLlJlZ0V4cCgnKD86XFxcXFtbXFxcXHgyMFxcXFx0XFxcXG5cXFxcclxcXFxmXSpjbGFzc1xcXFxifFxcXFwuJyArIGlkZW50aWZpZXIgKyAnKScpLFxuXG4gIC8vIG1hdGNoZXMgc2ltcGxlIGlkLCB0YWcgJiBjbGFzcyBzZWxlY3RvcnNcbiAgUkVfU0lNUExFX1NFTEVDVE9SID0gbmV3IGdsb2JhbC5SZWdFeHAoXG4gICAgQlVHR1lfR0VCVE4gJiYgQlVHR1lfR0VCQ04gfHwgT1BFUkEgP1xuICAgICAgJ14jPy0/W19hLXpBLVpdezF9JyArIGVuY29kaW5nICsgJyokJyA6IEJVR0dZX0dFQlROID9cbiAgICAgICdeWy4jXT8tP1tfYS16QS1aXXsxfScgKyBlbmNvZGluZyArICcqJCcgOiBCVUdHWV9HRUJDTiA/XG4gICAgICAnXig/OlxcXFwqfCMtP1tfYS16QS1aXXsxfScgKyBlbmNvZGluZyArICcqKSQnIDpcbiAgICAgICdeKD86XFxcXCp8Wy4jXT8tP1tfYS16QS1aXXsxfScgKyBlbmNvZGluZyArICcqKSQnKSxcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIExPT0tVUCBPQkpFQ1RTIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICBMSU5LX05PREVTID0gbmV3IGdsb2JhbC5PYmplY3QoeyAnYSc6IDEsICdBJzogMSwgJ2FyZWEnOiAxLCAnQVJFQSc6IDEsICdsaW5rJzogMSwgJ0xJTksnOiAxIH0pLFxuXG4gIC8vIGJvb2xlYW4gYXR0cmlidXRlcyBzaG91bGQgcmV0dXJuIGF0dHJpYnV0ZSBuYW1lIGluc3RlYWQgb2YgdHJ1ZS9mYWxzZVxuICBBVFRSX0JPT0xFQU4gPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgJ2NoZWNrZWQnOiAxLCAnZGlzYWJsZWQnOiAxLCAnaXNtYXAnOiAxLFxuICAgICdtdWx0aXBsZSc6IDEsICdyZWFkb25seSc6IDEsICdzZWxlY3RlZCc6IDFcbiAgfSksXG5cbiAgLy8gZHluYW1pYyBhdHRyaWJ1dGVzIHRoYXQgbmVlZHMgdG8gYmUgY2hlY2tlZCBhZ2FpbnN0IG9yaWdpbmFsIEhUTUwgdmFsdWVcbiAgQVRUUl9ERUZBVUxUID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgICd2YWx1ZSc6ICdkZWZhdWx0VmFsdWUnLFxuICAgICdjaGVja2VkJzogJ2RlZmF1bHRDaGVja2VkJyxcbiAgICAnc2VsZWN0ZWQnOiAnZGVmYXVsdFNlbGVjdGVkJ1xuICB9KSxcblxuICAvLyBhdHRyaWJ1dGVzIHJlZmVyZW5jaW5nIFVSSSBkYXRhIHZhbHVlcyBuZWVkIHNwZWNpYWwgdHJlYXRtZW50IGluIElFXG4gIEFUVFJfVVJJREFUQSA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICAnYWN0aW9uJzogMiwgJ2NpdGUnOiAyLCAnY29kZWJhc2UnOiAyLCAnZGF0YSc6IDIsICdocmVmJzogMixcbiAgICAnbG9uZ2Rlc2MnOiAyLCAnbG93c3JjJzogMiwgJ3NyYyc6IDIsICd1c2VtYXAnOiAyXG4gIH0pLFxuXG4gIC8vIEhUTUwgNSBkcmFmdCBzcGVjaWZpY2F0aW9uc1xuICAvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrLyNzZWxlY3RvcnNcbiAgSFRNTF9UQUJMRSA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICAvLyBjbGFzcyBhdHRyaWJ1dGUgbXVzdCBiZSB0cmVhdGVkIGNhc2UtaW5zZW5zaXRpdmUgaW4gSFRNTCBxdWlya3MgbW9kZVxuICAgIC8vIGluaXRpYWxpemVkIGJ5IGRlZmF1bHQgdG8gU3RhbmRhcmQgTW9kZSAoY2FzZS1zZW5zaXRpdmUpLFxuICAgIC8vIHNldCBkeW5hbWljYWxseSBieSB0aGUgYXR0cmlidXRlIHJlc29sdmVyXG4gICAgJ2NsYXNzJzogMCxcbiAgICAnYWNjZXB0JzogMSwgJ2FjY2VwdC1jaGFyc2V0JzogMSwgJ2FsaWduJzogMSwgJ2FsaW5rJzogMSwgJ2F4aXMnOiAxLFxuICAgICdiZ2NvbG9yJzogMSwgJ2NoYXJzZXQnOiAxLCAnY2hlY2tlZCc6IDEsICdjbGVhcic6IDEsICdjb2RldHlwZSc6IDEsICdjb2xvcic6IDEsXG4gICAgJ2NvbXBhY3QnOiAxLCAnZGVjbGFyZSc6IDEsICdkZWZlcic6IDEsICdkaXInOiAxLCAnZGlyZWN0aW9uJzogMSwgJ2Rpc2FibGVkJzogMSxcbiAgICAnZW5jdHlwZSc6IDEsICdmYWNlJzogMSwgJ2ZyYW1lJzogMSwgJ2hyZWZsYW5nJzogMSwgJ2h0dHAtZXF1aXYnOiAxLCAnbGFuZyc6IDEsXG4gICAgJ2xhbmd1YWdlJzogMSwgJ2xpbmsnOiAxLCAnbWVkaWEnOiAxLCAnbWV0aG9kJzogMSwgJ211bHRpcGxlJzogMSwgJ25vaHJlZic6IDEsXG4gICAgJ25vcmVzaXplJzogMSwgJ25vc2hhZGUnOiAxLCAnbm93cmFwJzogMSwgJ3JlYWRvbmx5JzogMSwgJ3JlbCc6IDEsICdyZXYnOiAxLFxuICAgICdydWxlcyc6IDEsICdzY29wZSc6IDEsICdzY3JvbGxpbmcnOiAxLCAnc2VsZWN0ZWQnOiAxLCAnc2hhcGUnOiAxLCAndGFyZ2V0JzogMSxcbiAgICAndGV4dCc6IDEsICd0eXBlJzogMSwgJ3ZhbGlnbic6IDEsICd2YWx1ZXR5cGUnOiAxLCAndmxpbmsnOiAxXG4gIH0pLFxuXG4gIC8vIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlcyBtdXN0IGJlIHRyZWF0ZWQgY2FzZS1pbnNlbnNpdGl2ZSBpbiBYSFRNTCBtb2RlXG4gIC8vIE5pZWxzIExlZW5oZWVyIGh0dHA6Ly9yYWthei5ubC9pdGVtL2Nzc19zZWxlY3Rvcl9idWdzX2Nhc2Vfc2Vuc2l0aXZpdHlcbiAgWEhUTUxfVEFCTEUgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgJ2FjY2VwdCc6IDEsICdhY2NlcHQtY2hhcnNldCc6IDEsICdhbGluayc6IDEsICdheGlzJzogMSxcbiAgICAnYmdjb2xvcic6IDEsICdjaGFyc2V0JzogMSwgJ2NvZGV0eXBlJzogMSwgJ2NvbG9yJzogMSxcbiAgICAnZW5jdHlwZSc6IDEsICdmYWNlJzogMSwgJ2hyZWZsYW5nJzogMSwgJ2h0dHAtZXF1aXYnOiAxLFxuICAgICdsYW5nJzogMSwgJ2xhbmd1YWdlJzogMSwgJ2xpbmsnOiAxLCAnbWVkaWEnOiAxLCAncmVsJzogMSxcbiAgICAncmV2JzogMSwgJ3RhcmdldCc6IDEsICd0ZXh0JzogMSwgJ3R5cGUnOiAxLCAndmxpbmsnOiAxXG4gIH0pLFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUkVHVUxBUiBFWFBSRVNTSU9OUyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIHBsYWNlaG9sZGVyIHRvIGFkZCBmdW5jdGlvbmFsaXRpZXNcbiAgU2VsZWN0b3JzID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgIC8vIGFzIGEgc2ltcGxlIGV4YW1wbGUgdGhpcyB3aWxsIGNoZWNrXG4gICAgLy8gZm9yIGNoYXJzIG5vdCBpbiBzdGFuZGFyZCBhc2NpaSB0YWJsZVxuICAgIC8vXG4gICAgLy8gJ215U3BlY2lhbFNlbGVjdG9yJzoge1xuICAgIC8vICAnRXhwcmVzc2lvbic6IC9cXHUwMDgwLVxcdWZmZmYvLFxuICAgIC8vICAnQ2FsbGJhY2snOiBteVNlbGVjdG9yQ2FsbGJhY2tcbiAgICAvLyB9XG4gICAgLy9cbiAgICAvLyAnbXlTZWxlY3RvckNhbGxiYWNrJyB3aWxsIGJlIGludm9rZWRcbiAgICAvLyBvbmx5IGFmdGVyIHBhc3NpbmcgYWxsIG90aGVyIHN0YW5kYXJkXG4gICAgLy8gY2hlY2tzIGFuZCBvbmx5IGlmIG5vbmUgb2YgdGhlbSB3b3JrZWRcbiAgfSksXG5cbiAgLy8gYXR0cmlidXRlIG9wZXJhdG9yc1xuICBPcGVyYXRvcnMgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgICc9JzogXCJuPT0nJW0nXCIsXG4gICAgJ149JzogXCJuLmluZGV4T2YoJyVtJyk9PTBcIixcbiAgICAnKj0nOiBcIm4uaW5kZXhPZignJW0nKT4tMVwiLFxuICAgICd8PSc6IFwiKG4rJy0nKS5pbmRleE9mKCclbS0nKT09MFwiLFxuICAgICd+PSc6IFwiKCcgJytuKycgJykuaW5kZXhPZignICVtICcpPi0xXCIsXG4gICAgJyQ9JzogXCJuLnN1YnN0cihuLmxlbmd0aC0nJW0nLmxlbmd0aCk9PSclbSdcIlxuICB9KSxcblxuICAvLyBvcHRpbWl6YXRpb24gZXhwcmVzc2lvbnNcbiAgT3B0aW1pemUgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgSUQ6IG5ldyBnbG9iYWwuUmVnRXhwKCdeXFxcXCo/IygnICsgZW5jb2RpbmcgKyAnKyl8JyArIHNraXBncm91cCksXG4gICAgVEFHOiBuZXcgZ2xvYmFsLlJlZ0V4cCgnXignICsgZW5jb2RpbmcgKyAnKyl8JyArIHNraXBncm91cCksXG4gICAgQ0xBU1M6IG5ldyBnbG9iYWwuUmVnRXhwKCdeXFxcXCo/XFxcXC4oJyArIGVuY29kaW5nICsgJyskKXwnICsgc2tpcGdyb3VwKVxuICB9KSxcblxuICAvLyBwcmVjb21waWxlZCBSZWd1bGFyIEV4cHJlc3Npb25zXG4gIFBhdHRlcm5zID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgIC8vIHN0cnVjdHVyYWwgcHNldWRvLWNsYXNzZXMgYW5kIGNoaWxkIHNlbGVjdG9yc1xuICAgIHNwc2V1ZG9zOiAvXlxcOihyb290fGVtcHR5fCg/OmZpcnN0fGxhc3R8b25seSkoPzotY2hpbGR8LW9mLXR5cGUpfG50aCg/Oi1sYXN0KT8oPzotY2hpbGR8LW9mLXR5cGUpXFwoXFxzKihldmVufG9kZHwoPzpbLStdezAsMX1cXGQqblxccyopP1stK117MCwxfVxccypcXGQqKVxccypcXCkpPyguKikvaSxcbiAgICAvLyB1aXN0YXRlcyArIGR5bmFtaWMgKyBuZWdhdGlvbiBwc2V1ZG8tY2xhc3Nlc1xuICAgIGRwc2V1ZG9zOiAvXlxcOihsaW5rfHZpc2l0ZWR8dGFyZ2V0fGFjdGl2ZXxmb2N1c3xob3ZlcnxjaGVja2VkfGRpc2FibGVkfGVuYWJsZWR8c2VsZWN0ZWR8bGFuZ1xcKChbLVxcd117Mix9KVxcKXxub3RcXCgoW14oKV0qfC4qKVxcKSk/KC4qKS9pLFxuICAgIC8vIGVsZW1lbnQgYXR0cmlidXRlIG1hdGNoZXJcbiAgICBhdHRyaWJ1dGU6IG5ldyBnbG9iYWwuUmVnRXhwKCdeXFxcXFsnICsgYXR0cm1hdGNoZXIgKyAnXFxcXF0oLiopJyksXG4gICAgLy8gRSA+IEZcbiAgICBjaGlsZHJlbjogL15bXFx4MjBcXHRcXG5cXHJcXGZdKlxcPltcXHgyMFxcdFxcblxcclxcZl0qKC4qKS8sXG4gICAgLy8gRSArIEZcbiAgICBhZGphY2VudDogL15bXFx4MjBcXHRcXG5cXHJcXGZdKlxcK1tcXHgyMFxcdFxcblxcclxcZl0qKC4qKS8sXG4gICAgLy8gRSB+IEZcbiAgICByZWxhdGl2ZTogL15bXFx4MjBcXHRcXG5cXHJcXGZdKlxcfltcXHgyMFxcdFxcblxcclxcZl0qKC4qKS8sXG4gICAgLy8gRSBGXG4gICAgYW5jZXN0b3I6IC9eW1xceDIwXFx0XFxuXFxyXFxmXSsoLiopLyxcbiAgICAvLyBhbGxcbiAgICB1bml2ZXJzYWw6IC9eXFwqKC4qKS8sXG4gICAgLy8gaWRcbiAgICBpZDogbmV3IGdsb2JhbC5SZWdFeHAoJ14jKCcgKyBlbmNvZGluZyArICcrKSguKiknKSxcbiAgICAvLyB0YWdcbiAgICB0YWdOYW1lOiBuZXcgZ2xvYmFsLlJlZ0V4cCgnXignICsgZW5jb2RpbmcgKyAnKykoLiopJyksXG4gICAgLy8gY2xhc3NcbiAgICBjbGFzc05hbWU6IG5ldyBnbG9iYWwuUmVnRXhwKCdeXFxcXC4oJyArIGVuY29kaW5nICsgJyspKC4qKScpXG4gIH0pLFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFVUSUwgTUVUSE9EUyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGNvbmNhdCBlbGVtZW50cyB0byBkYXRhXG4gIGNvbmNhdExpc3QgPVxuICAgIGZ1bmN0aW9uKGRhdGEsIGVsZW1lbnRzKSB7XG4gICAgICB2YXIgaSA9IC0xLCBlbGVtZW50O1xuICAgICAgaWYgKCFkYXRhLmxlbmd0aCAmJiBnbG9iYWwuQXJyYXkuc2xpY2UpXG4gICAgICAgIHJldHVybiBnbG9iYWwuQXJyYXkuc2xpY2UoZWxlbWVudHMpO1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudHNbKytpXSkpXG4gICAgICAgIGRhdGFbZGF0YS5sZW5ndGhdID0gZWxlbWVudDtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgLy8gY29uY2F0IGVsZW1lbnRzIHRvIGRhdGEgYW5kIGNhbGxiYWNrXG4gIGNvbmNhdENhbGwgPVxuICAgIGZ1bmN0aW9uKGRhdGEsIGVsZW1lbnRzLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGkgPSAtMSwgZWxlbWVudDtcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnRzWysraV0pKSB7XG4gICAgICAgIGlmIChmYWxzZSA9PT0gY2FsbGJhY2soZGF0YVtkYXRhLmxlbmd0aF0gPSBlbGVtZW50KSkgeyBicmVhazsgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAvLyBjaGFuZ2UgY29udGV4dCBzcGVjaWZpYyB2YXJpYWJsZXNcbiAgc3dpdGNoQ29udGV4dCA9XG4gICAgZnVuY3Rpb24oZnJvbSwgZm9yY2UpIHtcbiAgICAgIHZhciBkaXYsIG9sZERvYyA9IGRvYztcbiAgICAgIC8vIHNhdmUgcGFzc2VkIGNvbnRleHRcbiAgICAgIGxhc3RDb250ZXh0ID0gZnJvbTtcbiAgICAgIC8vIHNldCBuZXcgY29udGV4dCBkb2N1bWVudFxuICAgICAgZG9jID0gZnJvbS5vd25lckRvY3VtZW50IHx8IGZyb207XG4gICAgICBpZiAoZm9yY2UgfHwgb2xkRG9jICE9PSBkb2MpIHtcbiAgICAgICAgLy8gc2V0IGRvY3VtZW50IHJvb3RcbiAgICAgICAgcm9vdCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG4gICAgICAgIC8vIHNldCBob3N0IGVudmlyb25tZW50IGZsYWdzXG4gICAgICAgIFhNTF9ET0NVTUVOVCA9IGRvYy5jcmVhdGVFbGVtZW50KCdEaVYnKS5ub2RlTmFtZSA9PSAnRGlWJztcblxuICAgICAgICAvLyBJbiBxdWlya3MgbW9kZSBjc3MgY2xhc3MgbmFtZXMgYXJlIGNhc2UgaW5zZW5zaXRpdmUuXG4gICAgICAgIC8vIEluIHN0YW5kYXJkcyBtb2RlIHRoZXkgYXJlIGNhc2Ugc2Vuc2l0aXZlLiBTZWUgZG9jczpcbiAgICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vTW96aWxsYV9RdWlya3NfTW9kZV9CZWhhdmlvclxuICAgICAgICAvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrLyNzZWxlY3RvcnNcbiAgICAgICAgUVVJUktTX01PREUgPSAhWE1MX0RPQ1VNRU5UICYmXG4gICAgICAgICAgdHlwZW9mIGRvYy5jb21wYXRNb2RlID09ICdzdHJpbmcnID9cbiAgICAgICAgICBkb2MuY29tcGF0TW9kZS5pbmRleE9mKCdDU1MnKSA8IDAgOlxuICAgICAgICAgIChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBzdHlsZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKS5zdHlsZTtcbiAgICAgICAgICAgIHJldHVybiBzdHlsZSAmJiAoc3R5bGUud2lkdGggPSAxKSAmJiBzdHlsZS53aWR0aCA9PSAnMXB4JztcbiAgICAgICAgICB9KSgpO1xuXG4gICAgICAgIGRpdiA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGl2LmFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdwJykpLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAneFh4Jyk7XG4gICAgICAgIGRpdi5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgncCcpKS5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJ3h4eCcpO1xuXG4gICAgICAgIC8vIEdFQkNOIGJ1Z2d5IGluIHF1aXJrcyBtb2RlLCBtYXRjaCBjb3VudCBpczpcbiAgICAgICAgLy8gRmlyZWZveCAzLjArIFt4eHggPSAxLCB4WHggPSAxXVxuICAgICAgICAvLyBPcGVyYSAxMC42MysgW3h4eCA9IDAsIHhYeCA9IDJdXG4gICAgICAgIEJVR0dZX1FVSVJLU19HRUJDTiA9XG4gICAgICAgICAgIVhNTF9ET0NVTUVOVCAmJiBOQVRJVkVfR0VCQ04gJiYgUVVJUktTX01PREUgJiZcbiAgICAgICAgICAoZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3h4eCcpLmxlbmd0aCAhPSAyIHx8XG4gICAgICAgICAgZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3hYeCcpLmxlbmd0aCAhPSAyKTtcblxuICAgICAgICAvLyBRU0FQSSBidWdneSBpbiBxdWlya3MgbW9kZSwgbWF0Y2ggY291bnQgaXM6XG4gICAgICAgIC8vIEF0IGxlYXN0IENocm9tZSA0KywgRmlyZWZveCAzLjUrLCBPcGVyYSAxMC54KywgU2FmYXJpIDQrIFt4eHggPSAxLCB4WHggPSAyXVxuICAgICAgICAvLyBTYWZhcmkgMy4yIFFTQSBkb2Vzbid0IHdvcmsgd2l0aCBtaXhlZGNhc2UgaW4gcXVpcmtzbW9kZSBbeHh4ID0gMSwgeFh4ID0gMF1cbiAgICAgICAgLy8gaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE5MDQ3XG4gICAgICAgIC8vIG11c3QgdGVzdCB0aGUgYXR0cmlidXRlIHNlbGVjdG9yICdbY2xhc3N+PXh4eF0nXG4gICAgICAgIC8vIGJlZm9yZSAnLnhYeCcgb3IgdGhlIGJ1ZyBtYXkgbm90IHByZXNlbnQgaXRzZWxmXG4gICAgICAgIEJVR0dZX1FVSVJLU19RU0FQSSA9XG4gICAgICAgICAgIVhNTF9ET0NVTUVOVCAmJiBOQVRJVkVfUVNBUEkgJiYgUVVJUktTX01PREUgJiZcbiAgICAgICAgICAoZGl2LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tjbGFzc349eHh4XScpLmxlbmd0aCAhPSAyIHx8XG4gICAgICAgICAgZGl2LnF1ZXJ5U2VsZWN0b3JBbGwoJy54WHgnKS5sZW5ndGggIT0gMik7XG5cbiAgICAgICAgQ29uZmlnLkNBQ0hJTkcgJiYgRG9tLnNldENhY2hlKHRydWUsIGRvYyk7XG4gICAgICB9XG4gICAgfSxcblxuICAvLyBjb252ZXJ0IGEgQ1NTIHN0cmluZyBvciBpZGVudGlmaWVyIGNvbnRhaW5pbmcgZXNjYXBlIHNlcXVlbmNlIHRvIGFcbiAgLy8gamF2YXNjcmlwdCBzdHJpbmcgd2l0aCBqYXZhc2NyaXB0IGVzY2FwZSBzZXF1ZW5jZXNcbiAgY29udmVydEVzY2FwZXMgPVxuICAgIGZ1bmN0aW9uKHN0cikge1xuICAgICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXFxcKFswLTlhLWZBLUZdezEsNn1cXHgyMD98Lil8KFtcXHgyMlxceDI3XSkvZywgZnVuY3Rpb24oc3Vic3RyaW5nLCBwMSwgcDIpIHtcbiAgICAgICAgdmFyIGNvZGVQb2ludCwgaGlnaEhleCwgaGlnaFN1cnJvZ2F0ZSwgbG93SGV4LCBsb3dTdXJyb2dhdGU7XG5cbiAgICAgICAgaWYgKHAyKSB7XG4gICAgICAgICAgLy8gdW5lc2NhcGVkIFwiIG9yICdcbiAgICAgICAgICByZXR1cm4gJ1xcXFwnICsgcDI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoL15bMC05YS1mQS1GXS8udGVzdChwMSkpIHtcbiAgICAgICAgICAvLyBcXDFmMjNcbiAgICAgICAgICBjb2RlUG9pbnQgPSBwYXJzZUludChwMSwgMTYpO1xuXG4gICAgICAgICAgaWYgKGNvZGVQb2ludCA8IDAgfHwgY29kZVBvaW50ID4gMHgxMGZmZmYpIHtcbiAgICAgICAgICAgIC8vIHRoZSByZXBsYWNlbWVudCBjaGFyYWN0ZXJcbiAgICAgICAgICAgIHJldHVybiAnXFxcXHVmZmZkJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBqYXZhc2NyaXB0IHN0cmluZ3MgYXJlIGluIFVURi0xNlxuICAgICAgICAgIGlmIChjb2RlUG9pbnQgPD0gMHhmZmZmKSB7XG4gICAgICAgICAgICAvLyBCYXNpY1xuICAgICAgICAgICAgbG93SGV4ID0gJzAwMCcgKyBjb2RlUG9pbnQudG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgcmV0dXJuICdcXFxcdScgKyBsb3dIZXguc3Vic3RyKGxvd0hleC5sZW5ndGggLSA0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTdXBwbGVtZW50YXJ5XG4gICAgICAgICAgY29kZVBvaW50IC09IDB4MTAwMDA7XG4gICAgICAgICAgaGlnaFN1cnJvZ2F0ZSA9IChjb2RlUG9pbnQgPj4gMTApICsgMHhkODAwO1xuICAgICAgICAgIGxvd1N1cnJvZ2F0ZSA9IChjb2RlUG9pbnQgJSAweDQwMCkgKyAweGRjMDA7XG4gICAgICAgICAgaGlnaEhleCA9ICcwMDAnICsgaGlnaFN1cnJvZ2F0ZS50b1N0cmluZygxNik7XG4gICAgICAgICAgbG93SGV4ID0gJzAwMCcgKyBsb3dTdXJyb2dhdGUudG9TdHJpbmcoMTYpO1xuXG4gICAgICAgICAgcmV0dXJuICdcXFxcdScgKyBoaWdoSGV4LnN1YnN0cihoaWdoSGV4Lmxlbmd0aCAtIDQpICtcbiAgICAgICAgICAgICdcXFxcdScgKyBsb3dIZXguc3Vic3RyKGxvd0hleC5sZW5ndGggLSA0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvXltcXFxcXFx4MjJcXHgyN10vLnRlc3QocDEpKSB7XG4gICAgICAgICAgLy8gXFwnIFxcXCJcbiAgICAgICAgICByZXR1cm4gc3Vic3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gXFxnIFxcaCBcXC4gXFwjIGV0Y1xuICAgICAgICByZXR1cm4gcDE7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIERPTSBNRVRIT0RTIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGVsZW1lbnQgYnkgaWQgKHJhdylcbiAgLy8gQHJldHVybiByZWZlcmVuY2Ugb3IgbnVsbFxuICBieUlkUmF3ID1cbiAgICBmdW5jdGlvbihpZCwgZWxlbWVudHMpIHtcbiAgICAgIHZhciBpID0gLTEsIGVsZW1lbnQgPSBudWxsO1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudHNbKytpXSkpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdpZCcpID09IGlkKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH0sXG5cbiAgLy8gZWxlbWVudCBieSBpZFxuICAvLyBAcmV0dXJuIHJlZmVyZW5jZSBvciBudWxsXG4gIF9ieUlkID0gIUJVR0dZX0dFQklEID9cbiAgICBmdW5jdGlvbihpZCwgZnJvbSkge1xuICAgICAgaWQgPSBpZC5yZXBsYWNlKC9cXFxcKFteXFxcXF17MX0pL2csICckMScpO1xuICAgICAgcmV0dXJuIGZyb20uZ2V0RWxlbWVudEJ5SWQgJiYgZnJvbS5nZXRFbGVtZW50QnlJZChpZCkgfHxcbiAgICAgICAgYnlJZFJhdyhpZCwgZnJvbS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnKicpKTtcbiAgICB9IDpcbiAgICBmdW5jdGlvbihpZCwgZnJvbSkge1xuICAgICAgdmFyIGVsZW1lbnQgPSBudWxsO1xuICAgICAgaWQgPSBpZC5yZXBsYWNlKC9cXFxcKFteXFxcXF17MX0pL2csICckMScpO1xuICAgICAgaWYgKFhNTF9ET0NVTUVOVCB8fCBmcm9tLm5vZGVUeXBlICE9IDkpIHtcbiAgICAgICAgcmV0dXJuIGJ5SWRSYXcoaWQsIGZyb20uZ2V0RWxlbWVudHNCeVRhZ05hbWUoJyonKSk7XG4gICAgICB9XG4gICAgICBpZiAoKGVsZW1lbnQgPSBmcm9tLmdldEVsZW1lbnRCeUlkKGlkKSkgJiZcbiAgICAgICAgZWxlbWVudC5uYW1lID09IGlkICYmIGZyb20uZ2V0RWxlbWVudHNCeU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGJ5SWRSYXcoaWQsIGZyb20uZ2V0RWxlbWVudHNCeU5hbWUoaWQpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH0sXG5cbiAgLy8gcHVibGljbHkgZXhwb3NlZCBieUlkXG4gIC8vIEByZXR1cm4gcmVmZXJlbmNlIG9yIG51bGxcbiAgYnlJZCA9XG4gICAgZnVuY3Rpb24oaWQsIGZyb20pIHtcbiAgICAgIGZyb20gfHwgKGZyb20gPSBkb2MpO1xuICAgICAgaWYgKGxhc3RDb250ZXh0ICE9PSBmcm9tKSB7IHN3aXRjaENvbnRleHQoZnJvbSk7IH1cbiAgICAgIHJldHVybiBfYnlJZChpZCwgZnJvbSk7XG4gICAgfSxcblxuICAvLyBlbGVtZW50cyBieSB0YWcgKHJhdylcbiAgLy8gQHJldHVybiBhcnJheVxuICBieVRhZ1JhdyA9XG4gICAgZnVuY3Rpb24odGFnLCBmcm9tKSB7XG4gICAgICB2YXIgYW55ID0gdGFnID09ICcqJywgZWxlbWVudCA9IGZyb20sIGVsZW1lbnRzID0gbmV3IGdsb2JhbC5BcnJheSgpLCBuZXh0ID0gZWxlbWVudC5maXJzdENoaWxkO1xuICAgICAgYW55IHx8ICh0YWcgPSB0YWcudG9VcHBlckNhc2UoKSk7XG4gICAgICB3aGlsZSAoKGVsZW1lbnQgPSBuZXh0KSkge1xuICAgICAgICBpZiAoZWxlbWVudC50YWdOYW1lID4gJ0AnICYmIChhbnkgfHwgZWxlbWVudC50YWdOYW1lLnRvVXBwZXJDYXNlKCkgPT0gdGFnKSkge1xuICAgICAgICAgIGVsZW1lbnRzW2VsZW1lbnRzLmxlbmd0aF0gPSBlbGVtZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmICgobmV4dCA9IGVsZW1lbnQuZmlyc3RDaGlsZCB8fCBlbGVtZW50Lm5leHRTaWJsaW5nKSkgY29udGludWU7XG4gICAgICAgIHdoaWxlICghbmV4dCAmJiAoZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZSkgJiYgZWxlbWVudCAhPT0gZnJvbSkge1xuICAgICAgICAgIG5leHQgPSBlbGVtZW50Lm5leHRTaWJsaW5nO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZWxlbWVudHM7XG4gICAgfSxcblxuICAvLyBlbGVtZW50cyBieSB0YWdcbiAgLy8gQHJldHVybiBhcnJheVxuICBfYnlUYWcgPSAhQlVHR1lfR0VCVE4gJiYgTkFUSVZFX1NMSUNFX1BST1RPID9cbiAgICBmdW5jdGlvbih0YWcsIGZyb20pIHtcbiAgICAgIHJldHVybiBYTUxfRE9DVU1FTlQgfHwgZnJvbS5ub2RlVHlwZSA9PSAxMSA/IGJ5VGFnUmF3KHRhZywgZnJvbSkgOlxuICAgICAgICBzbGljZS5jYWxsKGZyb20uZ2V0RWxlbWVudHNCeVRhZ05hbWUodGFnKSwgMCk7XG4gICAgfSA6XG4gICAgZnVuY3Rpb24odGFnLCBmcm9tKSB7XG4gICAgICB2YXIgaSA9IC0xLCBqID0gaSwgZGF0YSA9IG5ldyBnbG9iYWwuQXJyYXkoKSxcbiAgICAgICAgZWxlbWVudCwgZWxlbWVudHMgPSBmcm9tLmdldEVsZW1lbnRzQnlUYWdOYW1lKHRhZyk7XG4gICAgICBpZiAodGFnID09ICcqJykge1xuICAgICAgICB3aGlsZSAoKGVsZW1lbnQgPSBlbGVtZW50c1srK2ldKSkge1xuICAgICAgICAgIGlmIChlbGVtZW50Lm5vZGVOYW1lID4gJ0AnKVxuICAgICAgICAgICAgZGF0YVsrK2pdID0gZWxlbWVudDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudHNbKytpXSkpIHtcbiAgICAgICAgICBkYXRhW2ldID0gZWxlbWVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAvLyBwdWJsaWNseSBleHBvc2VkIGJ5VGFnXG4gIC8vIEByZXR1cm4gYXJyYXlcbiAgYnlUYWcgPVxuICAgIGZ1bmN0aW9uKHRhZywgZnJvbSkge1xuICAgICAgZnJvbSB8fCAoZnJvbSA9IGRvYyk7XG4gICAgICBpZiAobGFzdENvbnRleHQgIT09IGZyb20pIHsgc3dpdGNoQ29udGV4dChmcm9tKTsgfVxuICAgICAgcmV0dXJuIF9ieVRhZyh0YWcsIGZyb20pO1xuICAgIH0sXG5cbiAgLy8gcHVibGljbHkgZXhwb3NlZCBieU5hbWVcbiAgLy8gQHJldHVybiBhcnJheVxuICBieU5hbWUgPVxuICAgIGZ1bmN0aW9uKG5hbWUsIGZyb20pIHtcbiAgICAgIHJldHVybiBzZWxlY3QoJ1tuYW1lPVwiJyArIG5hbWUucmVwbGFjZSgvXFxcXChbXlxcXFxdezF9KS9nLCAnJDEnKSArICdcIl0nLCBmcm9tKTtcbiAgICB9LFxuXG4gIC8vIGVsZW1lbnRzIGJ5IGNsYXNzIChyYXcpXG4gIC8vIEByZXR1cm4gYXJyYXlcbiAgYnlDbGFzc1JhdyA9XG4gICAgZnVuY3Rpb24obmFtZSwgZnJvbSkge1xuICAgICAgdmFyIGkgPSAtMSwgaiA9IGksIGRhdGEgPSBuZXcgZ2xvYmFsLkFycmF5KCksIGVsZW1lbnQsIGVsZW1lbnRzID0gX2J5VGFnKCcqJywgZnJvbSksIG47XG4gICAgICBuYW1lID0gJyAnICsgKFFVSVJLU19NT0RFID8gbmFtZS50b0xvd2VyQ2FzZSgpIDogbmFtZSkucmVwbGFjZSgvXFxcXChbXlxcXFxdezF9KS9nLCAnJDEnKSArICcgJztcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnRzWysraV0pKSB7XG4gICAgICAgIG4gPSBYTUxfRE9DVU1FTlQgPyBlbGVtZW50LmdldEF0dHJpYnV0ZSgnY2xhc3MnKSA6IGVsZW1lbnQuY2xhc3NOYW1lO1xuICAgICAgICBpZiAobiAmJiBuLmxlbmd0aCAmJiAoJyAnICsgKFFVSVJLU19NT0RFID8gbi50b0xvd2VyQ2FzZSgpIDogbikuXG4gICAgICAgICAgcmVwbGFjZShyZVdoaXRlU3BhY2UsICcgJykgKyAnICcpLmluZGV4T2YobmFtZSkgPiAtMSkge1xuICAgICAgICAgIGRhdGFbKytqXSA9IGVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgLy8gZWxlbWVudHMgYnkgY2xhc3NcbiAgLy8gQHJldHVybiBhcnJheVxuICBfYnlDbGFzcyA9XG4gICAgZnVuY3Rpb24obmFtZSwgZnJvbSkge1xuICAgICAgcmV0dXJuIChCVUdHWV9HRUJDTiB8fCBCVUdHWV9RVUlSS1NfR0VCQ04gfHwgWE1MX0RPQ1VNRU5UIHx8ICFmcm9tLmdldEVsZW1lbnRzQnlDbGFzc05hbWUpID9cbiAgICAgICAgYnlDbGFzc1JhdyhuYW1lLCBmcm9tKSA6IHNsaWNlLmNhbGwoZnJvbS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKG5hbWUucmVwbGFjZSgvXFxcXChbXlxcXFxdezF9KS9nLCAnJDEnKSksIDApO1xuICAgIH0sXG5cbiAgLy8gcHVibGljbHkgZXhwb3NlZCBieUNsYXNzXG4gIC8vIEByZXR1cm4gYXJyYXlcbiAgYnlDbGFzcyA9XG4gICAgZnVuY3Rpb24obmFtZSwgZnJvbSkge1xuICAgICAgZnJvbSB8fCAoZnJvbSA9IGRvYyk7XG4gICAgICBpZiAobGFzdENvbnRleHQgIT09IGZyb20pIHsgc3dpdGNoQ29udGV4dChmcm9tKTsgfVxuICAgICAgcmV0dXJuIF9ieUNsYXNzKG5hbWUsIGZyb20pO1xuICAgIH0sXG5cbiAgLy8gY2hlY2sgZWxlbWVudCBpcyBkZXNjZW5kYW50IG9mIGNvbnRhaW5lclxuICAvLyBAcmV0dXJuIGJvb2xlYW5cbiAgY29udGFpbnMgPSAnY29tcGFyZURvY3VtZW50UG9zaXRpb24nIGluIHJvb3QgP1xuICAgIGZ1bmN0aW9uKGNvbnRhaW5lciwgZWxlbWVudCkge1xuICAgICAgcmV0dXJuIChjb250YWluZXIuY29tcGFyZURvY3VtZW50UG9zaXRpb24oZWxlbWVudCkgJiAxNikgPT0gMTY7XG4gICAgfSA6ICdjb250YWlucycgaW4gcm9vdCA/XG4gICAgZnVuY3Rpb24oY29udGFpbmVyLCBlbGVtZW50KSB7XG4gICAgICByZXR1cm4gY29udGFpbmVyICE9PSBlbGVtZW50ICYmIGNvbnRhaW5lci5jb250YWlucyhlbGVtZW50KTtcbiAgICB9IDpcbiAgICBmdW5jdGlvbihjb250YWluZXIsIGVsZW1lbnQpIHtcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZSkpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT09IGNvbnRhaW5lcikgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAvLyBhdHRyaWJ1dGUgdmFsdWVcbiAgLy8gQHJldHVybiBzdHJpbmdcbiAgZ2V0QXR0cmlidXRlID0gIUJVR0dZX0dFVF9BVFRSSUJVVEUgP1xuICAgIGZ1bmN0aW9uKG5vZGUsIGF0dHJpYnV0ZSkge1xuICAgICAgcmV0dXJuIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZSk7XG4gICAgfSA6XG4gICAgZnVuY3Rpb24obm9kZSwgYXR0cmlidXRlKSB7XG4gICAgICBhdHRyaWJ1dGUgPSBhdHRyaWJ1dGUudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0eXBlb2Ygbm9kZVthdHRyaWJ1dGVdID09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiBub2RlLmF0dHJpYnV0ZXNbYXR0cmlidXRlXSAmJlxuICAgICAgICAgIG5vZGUuYXR0cmlidXRlc1thdHRyaWJ1dGVdLnZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgLy8gJ3R5cGUnIGNhbiBvbmx5IGJlIHJlYWQgYnkgdXNpbmcgbmF0aXZlIGdldEF0dHJpYnV0ZVxuICAgICAgICBhdHRyaWJ1dGUgPT0gJ3R5cGUnID8gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlKSA6XG4gICAgICAgIC8vIHNwZWNpZmljIFVSSSBkYXRhIGF0dHJpYnV0ZXMgKHBhcmFtZXRlciAyIHRvIGZpeCBJRSBidWcpXG4gICAgICAgIEFUVFJfVVJJREFUQVthdHRyaWJ1dGVdID8gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlLCAyKSA6XG4gICAgICAgIC8vIGJvb2xlYW4gYXR0cmlidXRlcyBzaG91bGQgcmV0dXJuIG5hbWUgaW5zdGVhZCBvZiB0cnVlL2ZhbHNlXG4gICAgICAgIEFUVFJfQk9PTEVBTlthdHRyaWJ1dGVdID8gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlKSA/IGF0dHJpYnV0ZSA6ICdmYWxzZScgOlxuICAgICAgICAgIChub2RlID0gbm9kZS5nZXRBdHRyaWJ1dGVOb2RlKGF0dHJpYnV0ZSkpICYmIG5vZGUudmFsdWUpO1xuICAgIH0sXG5cbiAgLy8gYXR0cmlidXRlIHByZXNlbmNlXG4gIC8vIEByZXR1cm4gYm9vbGVhblxuICBoYXNBdHRyaWJ1dGUgPSAhQlVHR1lfSEFTX0FUVFJJQlVURSA/XG4gICAgZnVuY3Rpb24obm9kZSwgYXR0cmlidXRlKSB7XG4gICAgICByZXR1cm4gWE1MX0RPQ1VNRU5UID9cbiAgICAgICAgISFub2RlLmdldEF0dHJpYnV0ZShhdHRyaWJ1dGUpIDpcbiAgICAgICAgbm9kZS5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlKTtcbiAgICB9IDpcbiAgICBmdW5jdGlvbihub2RlLCBhdHRyaWJ1dGUpIHtcbiAgICAgIC8vIHJlYWQgdGhlIG5vZGUgYXR0cmlidXRlIG9iamVjdFxuICAgICAgdmFyIG9iaiA9IG5vZGUuZ2V0QXR0cmlidXRlTm9kZShhdHRyaWJ1dGUgPSBhdHRyaWJ1dGUudG9Mb3dlckNhc2UoKSk7XG4gICAgICByZXR1cm4gQVRUUl9ERUZBVUxUW2F0dHJpYnV0ZV0gJiYgYXR0cmlidXRlICE9ICd2YWx1ZScgP1xuICAgICAgICBub2RlW0FUVFJfREVGQVVMVFthdHRyaWJ1dGVdXSA6IG9iaiAmJiBvYmouc3BlY2lmaWVkO1xuICAgIH0sXG5cbiAgLy8gY2hlY2sgbm9kZSBlbXB0eW5lc3NcbiAgLy8gQHJldHVybiBib29sZWFuXG4gIGlzRW1wdHkgPVxuICAgIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIG5vZGUgPSBub2RlLmZpcnN0Q2hpbGQ7XG4gICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PSAzIHx8IG5vZGUubm9kZU5hbWUgPiAnQCcpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbm9kZSA9IG5vZGUubmV4dFNpYmxpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gIC8vIGNoZWNrIGlmIGVsZW1lbnQgbWF0Y2hlcyB0aGUgOmxpbmsgcHNldWRvXG4gIC8vIEByZXR1cm4gYm9vbGVhblxuICBpc0xpbmsgPVxuICAgIGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBoYXNBdHRyaWJ1dGUoZWxlbWVudCwnaHJlZicpICYmIExJTktfTk9ERVNbZWxlbWVudC5ub2RlTmFtZV07XG4gICAgfSxcblxuICAvLyBjaGlsZCBwb3NpdGlvbiBieSBub2RlVHlwZVxuICAvLyBAcmV0dXJuIG51bWJlclxuICBudGhFbGVtZW50ID1cbiAgICBmdW5jdGlvbihlbGVtZW50LCBsYXN0KSB7XG4gICAgICB2YXIgY291bnQgPSAxLCBzdWNjID0gbGFzdCA/ICduZXh0U2libGluZycgOiAncHJldmlvdXNTaWJsaW5nJztcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnRbc3VjY10pKSB7XG4gICAgICAgIGlmIChlbGVtZW50Lm5vZGVOYW1lID4gJ0AnKSArK2NvdW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgLy8gY2hpbGQgcG9zaXRpb24gYnkgbm9kZU5hbWVcbiAgLy8gQHJldHVybiBudW1iZXJcbiAgbnRoT2ZUeXBlID1cbiAgICBmdW5jdGlvbihlbGVtZW50LCBsYXN0KSB7XG4gICAgICB2YXIgY291bnQgPSAxLCBzdWNjID0gbGFzdCA/ICduZXh0U2libGluZycgOiAncHJldmlvdXNTaWJsaW5nJywgdHlwZSA9IGVsZW1lbnQubm9kZU5hbWU7XG4gICAgICB3aGlsZSAoKGVsZW1lbnQgPSBlbGVtZW50W3N1Y2NdKSkge1xuICAgICAgICBpZiAoZWxlbWVudC5ub2RlTmFtZSA9PSB0eXBlKSArK2NvdW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH0sXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIERFQlVHR0lORyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZ2V0L3NldCAoc3RyaW5nL29iamVjdCkgd29ya2luZyBtb2Rlc1xuICBjb25maWd1cmUgPVxuICAgIGZ1bmN0aW9uKG9wdGlvbikge1xuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gPT0gJ3N0cmluZycpIHsgcmV0dXJuIENvbmZpZ1tvcHRpb25dIHx8IENvbmZpZzsgfVxuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gIT0gJ29iamVjdCcpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICBmb3IgKHZhciBpIGluIG9wdGlvbikge1xuICAgICAgICBDb25maWdbaV0gPSAhIW9wdGlvbltpXTtcbiAgICAgICAgaWYgKGkgPT0gJ1NJTVBMRU5PVCcpIHtcbiAgICAgICAgICBtYXRjaENvbnRleHRzID0gbmV3IGdsb2JhbC5PYmplY3QoKTtcbiAgICAgICAgICBtYXRjaFJlc29sdmVycyA9IG5ldyBnbG9iYWwuT2JqZWN0KCk7XG4gICAgICAgICAgc2VsZWN0Q29udGV4dHMgPSBuZXcgZ2xvYmFsLk9iamVjdCgpO1xuICAgICAgICAgIHNlbGVjdFJlc29sdmVycyA9IG5ldyBnbG9iYWwuT2JqZWN0KCk7XG4gICAgICAgICAgaWYgKCFDb25maWdbaV0pIHsgQ29uZmlnWydVU0VfUVNBUEknXSA9IGZhbHNlOyB9XG4gICAgICAgIH0gZWxzZSBpZiAoaSA9PSAnVVNFX1FTQVBJJykge1xuICAgICAgICAgIENvbmZpZ1tpXSA9ICEhb3B0aW9uW2ldICYmIE5BVElWRV9RU0FQSTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVWYWxpZGF0b3IgPSBuZXcgZ2xvYmFsLlJlZ0V4cChDb25maWcuU0lNUExFTk9UID9cbiAgICAgICAgc3RhbmRhcmRWYWxpZGF0b3IgOiBleHRlbmRlZFZhbGlkYXRvcik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gIC8vIGNvbnRyb2wgdXNlciBub3RpZmljYXRpb25zXG4gIGVtaXQgPVxuICAgIGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgIGlmIChDb25maWcuVkVSQk9TSVRZKSB7IHRocm93IG5ldyBnbG9iYWwuRXJyb3IobWVzc2FnZSk7IH1cbiAgICAgIGlmIChnbG9iYWwuY29uc29sZSAmJiBnbG9iYWwuY29uc29sZS5sb2cpIHtcbiAgICAgICAgZ2xvYmFsLmNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgQ29uZmlnID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuXG4gICAgLy8gdXNlZCB0byBlbmFibGUvZGlzYWJsZSBjYWNoaW5nIG9mIHJlc3VsdCBzZXRzXG4gICAgQ0FDSElORzogZmFsc2UsXG5cbiAgICAvLyBieSBkZWZhdWx0IGRvIG5vdCBhZGQgbWlzc2luZyBsZWZ0L3JpZ2h0IGNvbnRleHRcbiAgICAvLyB0byBzZWxlY3RvciBzdHJpbmcgc2hvcnRjdXRzIGxpa2UgXCIrZGl2XCIgb3IgXCJ1bD5cIlxuICAgIC8vIGNhbGxhYmxlIERvbS5zaG9ydGN1dHMgbWV0aG9kIGhhcyB0byBiZSBhdmFpbGFibGVcbiAgICBTSE9SVENVVFM6IGZhbHNlLFxuXG4gICAgLy8gYnkgZGVmYXVsdCBkaXNhYmxlIGNvbXBsZXggc2VsZWN0b3JzIG5lc3RlZCBpblxuICAgIC8vICc6bm90KCknIHBzZXVkby1jbGFzc2VzLCBhcyBmb3Igc3BlY2lmaWNhdGlvbnNcbiAgICBTSU1QTEVOT1Q6IHRydWUsXG5cbiAgICAvLyBzdHJpY3QgUVNBIG1hdGNoIGFsbCBub24tdW5pcXVlIElEcyAoZmFsc2UpXG4gICAgLy8gc3BlZWQgJiBsaWJzIGNvbXBhdCBtYXRjaCB1bmlxdWUgSUQgKHRydWUpXG4gICAgVU5JUVVFX0lEOiB0cnVlLFxuXG4gICAgLy8gSFRNTDUgaGFuZGxpbmcgZm9yIHRoZSBcIjpjaGVja2VkXCIgcHNldWRvLWNsYXNzXG4gICAgVVNFX0hUTUw1OiB0cnVlLFxuXG4gICAgLy8gY29udHJvbHMgZW5hYmxpbmcgdGhlIFF1ZXJ5IFNlbGVjdG9yIEFQSSBicmFuY2hcbiAgICBVU0VfUVNBUEk6IE5BVElWRV9RU0FQSSxcblxuICAgIC8vIGNvbnRyb2xzIHRoZSBlbmdpbmUgZXJyb3Ivd2FybmluZyBub3RpZmljYXRpb25zXG4gICAgVkVSQk9TSVRZOiB0cnVlXG5cbiAgfSksXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIENPTVBJTEVSIE1FVEhPRFMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gY29kZSBzdHJpbmcgcmV1c2VkIHRvIGJ1aWxkIGNvbXBpbGVkIGZ1bmN0aW9uc1xuICBBQ0NFUFRfTk9ERSA9ICdyW3IubGVuZ3RoXT1jW2tdO2lmKGYmJmZhbHNlPT09ZihjW2tdKSlicmVhayBtYWluO2Vsc2UgY29udGludWUgbWFpbjsnLFxuXG4gIC8vIGNvbXBpbGUgYSBjb21tYSBzZXBhcmF0ZWQgZ3JvdXAgb2Ygc2VsZWN0b3JcbiAgLy8gQG1vZGUgYm9vbGVhbiB0cnVlIGZvciBzZWxlY3QsIGZhbHNlIGZvciBtYXRjaFxuICAvLyByZXR1cm4gYSBjb21waWxlZCBmdW5jdGlvblxuICBjb21waWxlID1cbiAgICBmdW5jdGlvbihzZWxlY3Rvciwgc291cmNlLCBtb2RlKSB7XG5cbiAgICAgIHZhciBwYXJ0cyA9IHR5cGVvZiBzZWxlY3RvciA9PSAnc3RyaW5nJyA/IHNlbGVjdG9yLm1hdGNoKHJlU3BsaXRHcm91cCkgOiBzZWxlY3RvcjtcblxuICAgICAgLy8gZW5zdXJlcyB0aGF0IHNvdXJjZSBpcyBhIHN0cmluZ1xuICAgICAgdHlwZW9mIHNvdXJjZSA9PSAnc3RyaW5nJyB8fCAoc291cmNlID0gJycpO1xuXG4gICAgICBpZiAocGFydHMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgc291cmNlICs9IGNvbXBpbGVTZWxlY3RvcihwYXJ0c1swXSwgbW9kZSA/IEFDQ0VQVF9OT0RFIDogJ2YmJmYoayk7cmV0dXJuIHRydWU7JywgbW9kZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmb3IgZWFjaCBzZWxlY3RvciBpbiB0aGUgZ3JvdXBcbiAgICAgICAgdmFyIGkgPSAtMSwgc2VlbiA9IG5ldyBnbG9iYWwuT2JqZWN0KCksIHRva2VuO1xuICAgICAgICB3aGlsZSAoKHRva2VuID0gcGFydHNbKytpXSkpIHtcbiAgICAgICAgICB0b2tlbiA9IHRva2VuLnJlcGxhY2UocmVUcmltU3BhY2VzLCAnJyk7XG4gICAgICAgICAgLy8gYXZvaWQgcmVwZWF0aW5nIHRoZSBzYW1lIHRva2VuXG4gICAgICAgICAgLy8gaW4gY29tbWEgc2VwYXJhdGVkIGdyb3VwIChwLCBwKVxuICAgICAgICAgIGlmICghc2Vlblt0b2tlbl0gJiYgKHNlZW5bdG9rZW5dID0gdHJ1ZSkpIHtcbiAgICAgICAgICAgIHNvdXJjZSArPSBjb21waWxlU2VsZWN0b3IodG9rZW4sIG1vZGUgPyBBQ0NFUFRfTk9ERSA6ICdmJiZmKGspO3JldHVybiB0cnVlOycsIG1vZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobW9kZSkge1xuICAgICAgICAvLyBmb3Igc2VsZWN0IG1ldGhvZFxuICAgICAgICByZXR1cm4gbmV3IGdsb2JhbC5GdW5jdGlvbignYyxzLHIsZCxoLGcsZix2JyxcbiAgICAgICAgICAndmFyIE4sbix4PTAsaz0tMSxlO21haW46d2hpbGUoKGU9Y1srK2tdKSl7JyArIHNvdXJjZSArICd9cmV0dXJuIHI7Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmb3IgbWF0Y2ggbWV0aG9kXG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLkZ1bmN0aW9uKCdlLHMscixkLGgsZyxmLHYnLFxuICAgICAgICAgICd2YXIgTixuLHg9MCxrPWU7JyArIHNvdXJjZSArICdyZXR1cm4gZmFsc2U7Jyk7XG4gICAgICB9XG4gICAgfSxcblxuICAvLyBhbGxvd3MgdG8gY2FjaGUgYWxyZWFkeSB2aXNpdGVkIG5vZGVzXG4gIEZJTFRFUiA9XG4gICAgJ3ZhciB6PXZbQF18fCh2W0BdPVtdKSxsPXoubGVuZ3RoLTE7JyArXG4gICAgJ3doaWxlKGw+PTAmJnpbbF0hPT1lKS0tbDsnICtcbiAgICAnaWYobCE9PS0xKXticmVhazt9JyArXG4gICAgJ3pbei5sZW5ndGhdPWU7JyxcblxuICAvLyBjb21waWxlIGEgQ1NTMyBzdHJpbmcgc2VsZWN0b3IgaW50byBhZC1ob2MgamF2YXNjcmlwdCBtYXRjaGluZyBmdW5jdGlvblxuICAvLyBAcmV0dXJuIHN0cmluZyAodG8gYmUgY29tcGlsZWQpXG4gIGNvbXBpbGVTZWxlY3RvciA9XG4gICAgZnVuY3Rpb24oc2VsZWN0b3IsIHNvdXJjZSwgbW9kZSkge1xuXG4gICAgICB2YXIgYSwgYiwgbiwgayA9IDAsIGV4cHIsIG1hdGNoLCByZXN1bHQsIHN0YXR1cywgdGVzdCwgdHlwZTtcblxuICAgICAgd2hpbGUgKHNlbGVjdG9yKSB7XG5cbiAgICAgICAgaysrO1xuXG4gICAgICAgIC8vICoqKiBVbml2ZXJzYWwgc2VsZWN0b3JcbiAgICAgICAgLy8gKiBtYXRjaCBhbGwgKGVtcHR5IGJsb2NrLCBkbyBub3QgcmVtb3ZlKVxuICAgICAgICBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMudW5pdmVyc2FsKSkpIHtcbiAgICAgICAgICAvLyBkbyBub3RoaW5nLCBoYW5kbGVkIGluIHRoZSBjb21waWxlciB3aGVyZVxuICAgICAgICAgIC8vIEJVR0dZX0dFQlROIHJldHVybiBjb21tZW50IG5vZGVzIChleDogSUUpXG4gICAgICAgICAgZXhwciA9ICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIElEIHNlbGVjdG9yXG4gICAgICAgIC8vICNGb28gSWQgY2FzZSBzZW5zaXRpdmVcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuaWQpKSkge1xuICAgICAgICAgIC8vIGRvY3VtZW50IGNhbiBjb250YWluIGNvbmZsaWN0aW5nIGVsZW1lbnRzIChpZC9uYW1lKVxuICAgICAgICAgIC8vIHByb3RvdHlwZSBzZWxlY3RvciB1bml0IG5lZWQgdGhpcyBtZXRob2QgdG8gcmVjb3ZlciBiYWQgSFRNTCBmb3Jtc1xuICAgICAgICAgIHNvdXJjZSA9ICdpZignICsgKFhNTF9ET0NVTUVOVCA/XG4gICAgICAgICAgICAncy5nZXRBdHRyaWJ1dGUoZSxcImlkXCIpJyA6XG4gICAgICAgICAgICAnKGUuc3VibWl0P3MuZ2V0QXR0cmlidXRlKGUsXCJpZFwiKTplLmlkKScpICtcbiAgICAgICAgICAgICc9PVwiJyArIG1hdGNoWzFdICsgJ1wiJyArXG4gICAgICAgICAgICAnKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIFR5cGUgc2VsZWN0b3JcbiAgICAgICAgLy8gRm9vIFRhZyAoY2FzZSBpbnNlbnNpdGl2ZSlcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMudGFnTmFtZSkpKSB7XG4gICAgICAgICAgLy8gYm90aCB0YWdOYW1lIGFuZCBub2RlTmFtZSBwcm9wZXJ0aWVzIG1heSBiZSB1cHBlci9sb3dlciBjYXNlXG4gICAgICAgICAgLy8gZGVwZW5kaW5nIG9uIHRoZWlyIGNyZWF0aW9uIE5BTUVTUEFDRSBpbiBjcmVhdGVFbGVtZW50TlMoKVxuICAgICAgICAgIHNvdXJjZSA9ICdpZihlLm5vZGVOYW1lJyArIChYTUxfRE9DVU1FTlQgP1xuICAgICAgICAgICAgJz09XCInICsgbWF0Y2hbMV0gKyAnXCInIDogJy50b1VwcGVyQ2FzZSgpJyArXG4gICAgICAgICAgICAnPT1cIicgKyBtYXRjaFsxXS50b1VwcGVyQ2FzZSgpICsgJ1wiJykgK1xuICAgICAgICAgICAgJyl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICoqKiBDbGFzcyBzZWxlY3RvclxuICAgICAgICAvLyAuRm9vIENsYXNzIChjYXNlIHNlbnNpdGl2ZSlcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuY2xhc3NOYW1lKSkpIHtcbiAgICAgICAgICAvLyBXM0MgQ1NTMyBzcGVjczogZWxlbWVudCB3aG9zZSBcImNsYXNzXCIgYXR0cmlidXRlIGhhcyBiZWVuIGFzc2lnbmVkIGFcbiAgICAgICAgICAvLyBsaXN0IG9mIHdoaXRlc3BhY2Utc2VwYXJhdGVkIHZhbHVlcywgc2VlIHNlY3Rpb24gNi40IENsYXNzIHNlbGVjdG9yc1xuICAgICAgICAgIC8vIGFuZCBub3RlcyBhdCB0aGUgYm90dG9tOyBleHBsaWNpdGx5IG5vbi1ub3JtYXRpdmUgaW4gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAgICAgICAgIHNvdXJjZSA9ICdpZigobj0nICsgKFhNTF9ET0NVTUVOVCA/XG4gICAgICAgICAgICAncy5nZXRBdHRyaWJ1dGUoZSxcImNsYXNzXCIpJyA6ICdlLmNsYXNzTmFtZScpICtcbiAgICAgICAgICAgICcpJiZuLmxlbmd0aCYmKFwiIFwiKycgKyAoUVVJUktTX01PREUgPyAnbi50b0xvd2VyQ2FzZSgpJyA6ICduJykgK1xuICAgICAgICAgICAgJy5yZXBsYWNlKCcgKyByZVdoaXRlU3BhY2UgKyAnLFwiIFwiKStcIiBcIikuaW5kZXhPZihcIiAnICtcbiAgICAgICAgICAgIChRVUlSS1NfTU9ERSA/IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCkgOiBtYXRjaFsxXSkgKyAnIFwiKT4tMScgK1xuICAgICAgICAgICAgJyl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICoqKiBBdHRyaWJ1dGUgc2VsZWN0b3JcbiAgICAgICAgLy8gW2F0dHJdIFthdHRyPXZhbHVlXSBbYXR0cj1cInZhbHVlXCJdIFthdHRyPSd2YWx1ZSddIGFuZCAhPSwgKj0sIH49LCB8PSwgXj0sICQ9XG4gICAgICAgIC8vIGNhc2Ugc2Vuc2l0aXZpdHkgaXMgdHJlYXRlZCBkaWZmZXJlbnRseSBkZXBlbmRpbmcgb24gdGhlIGRvY3VtZW50IHR5cGUgKHNlZSBtYXApXG4gICAgICAgIGVsc2UgaWYgKChtYXRjaCA9IHNlbGVjdG9yLm1hdGNoKFBhdHRlcm5zLmF0dHJpYnV0ZSkpKSB7XG5cbiAgICAgICAgICAvLyB4bWwgbmFtZXNwYWNlZCBhdHRyaWJ1dGUgP1xuICAgICAgICAgIGV4cHIgPSBtYXRjaFsxXS5zcGxpdCgnOicpO1xuICAgICAgICAgIGV4cHIgPSBleHByLmxlbmd0aCA9PSAyID8gZXhwclsxXSA6IGV4cHJbMF0gKyAnJztcblxuICAgICAgICAgIGlmIChtYXRjaFsyXSAmJiAhT3BlcmF0b3JzW21hdGNoWzJdXSkge1xuICAgICAgICAgICAgZW1pdCgnVW5zdXBwb3J0ZWQgb3BlcmF0b3IgaW4gYXR0cmlidXRlIHNlbGVjdG9ycyBcIicgKyBzZWxlY3RvciArICdcIicpO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRlc3QgPSAnZmFsc2UnO1xuXG4gICAgICAgICAgLy8gcmVwbGFjZSBPcGVyYXRvcnMgcGFyYW1ldGVyIGlmIG5lZWRlZFxuICAgICAgICAgIGlmIChtYXRjaFsyXSAmJiBtYXRjaFs0XSAmJiAodGVzdCA9IE9wZXJhdG9yc1ttYXRjaFsyXV0pKSB7XG4gICAgICAgICAgICBtYXRjaFs0XSA9IGNvbnZlcnRFc2NhcGVzKG1hdGNoWzRdKTtcbiAgICAgICAgICAgIC8vIGNhc2UgdHJlYXRtZW50IGRlcGVuZHMgb24gZG9jdW1lbnRcbiAgICAgICAgICAgIEhUTUxfVEFCTEVbJ2NsYXNzJ10gPSBRVUlSS1NfTU9ERSA/IDEgOiAwO1xuICAgICAgICAgICAgdHlwZSA9IChYTUxfRE9DVU1FTlQgPyBYSFRNTF9UQUJMRSA6IEhUTUxfVEFCTEUpW2V4cHIudG9Mb3dlckNhc2UoKV07XG4gICAgICAgICAgICB0ZXN0ID0gdGVzdC5yZXBsYWNlKC9cXCVtL2csIHR5cGUgPyBtYXRjaFs0XS50b0xvd2VyQ2FzZSgpIDogbWF0Y2hbNF0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAobWF0Y2hbMl0gPT0gJyE9JyB8fCBtYXRjaFsyXSA9PSAnPScpIHtcbiAgICAgICAgICAgIHRlc3QgPSAnbicgKyBtYXRjaFsyXSArICc9XCJcIic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc291cmNlID0gJ2lmKG49cy5oYXNBdHRyaWJ1dGUoZSxcIicgKyBtYXRjaFsxXSArICdcIikpeycgK1xuICAgICAgICAgICAgKG1hdGNoWzJdID8gJ249cy5nZXRBdHRyaWJ1dGUoZSxcIicgKyBtYXRjaFsxXSArICdcIiknIDogJycpICtcbiAgICAgICAgICAgICh0eXBlICYmIG1hdGNoWzJdID8gJy50b0xvd2VyQ2FzZSgpOycgOiAnOycpICtcbiAgICAgICAgICAgICdpZignICsgKG1hdGNoWzJdID8gdGVzdCA6ICduJykgKyAnKXsnICsgc291cmNlICsgJ319JztcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIEFkamFjZW50IHNpYmxpbmcgY29tYmluYXRvclxuICAgICAgICAvLyBFICsgRiAoRiBhZGlhY2VudCBzaWJsaW5nIG9mIEUpXG4gICAgICAgIGVsc2UgaWYgKChtYXRjaCA9IHNlbGVjdG9yLm1hdGNoKFBhdHRlcm5zLmFkamFjZW50KSkpIHtcbiAgICAgICAgICBzb3VyY2UgPSAobW9kZSA/ICcnIDogRklMVEVSLnJlcGxhY2UoL0AvZywgaykpICsgc291cmNlO1xuICAgICAgICAgIHNvdXJjZSA9IE5BVElWRV9UUkFWRVJTQUxfQVBJID9cbiAgICAgICAgICAgICd2YXIgTicgKyBrICsgJz1lO3doaWxlKGUmJihlPWUucHJldmlvdXNFbGVtZW50U2libGluZykpeycgKyBzb3VyY2UgKyAnYnJlYWs7fWU9TicgKyBrICsgJzsnIDpcbiAgICAgICAgICAgICd2YXIgTicgKyBrICsgJz1lO3doaWxlKGUmJihlPWUucHJldmlvdXNTaWJsaW5nKSl7aWYoZS5ub2RlTmFtZT5cIkBcIil7JyArIHNvdXJjZSArICdicmVhazt9fWU9TicgKyBrICsgJzsnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIEdlbmVyYWwgc2libGluZyBjb21iaW5hdG9yXG4gICAgICAgIC8vIEUgfiBGIChGIHJlbGF0aXZlIHNpYmxpbmcgb2YgRSlcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMucmVsYXRpdmUpKSkge1xuICAgICAgICAgIHNvdXJjZSA9IChtb2RlID8gJycgOiBGSUxURVIucmVwbGFjZSgvQC9nLCBrKSkgKyBzb3VyY2U7XG4gICAgICAgICAgc291cmNlID0gTkFUSVZFX1RSQVZFUlNBTF9BUEkgP1xuICAgICAgICAgICAgKCd2YXIgTicgKyBrICsgJz1lO2U9ZS5wYXJlbnROb2RlLmZpcnN0RWxlbWVudENoaWxkOycgK1xuICAgICAgICAgICAgJ3doaWxlKGUmJmUhPT1OJyArIGsgKyAnKXsnICsgc291cmNlICsgJ2U9ZS5uZXh0RWxlbWVudFNpYmxpbmc7fWU9TicgKyBrICsgJzsnKSA6XG4gICAgICAgICAgICAoJ3ZhciBOJyArIGsgKyAnPWU7ZT1lLnBhcmVudE5vZGUuZmlyc3RDaGlsZDsnICtcbiAgICAgICAgICAgICd3aGlsZShlJiZlIT09TicgKyBrICsgJyl7aWYoZS5ub2RlTmFtZT5cIkBcIil7JyArIHNvdXJjZSArICd9ZT1lLm5leHRTaWJsaW5nO31lPU4nICsgayArICc7Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogQ2hpbGQgY29tYmluYXRvclxuICAgICAgICAvLyBFID4gRiAoRiBjaGlsZHJlbiBvZiBFKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5jaGlsZHJlbikpKSB7XG4gICAgICAgICAgc291cmNlID0gKG1vZGUgPyAnJyA6IEZJTFRFUi5yZXBsYWNlKC9AL2csIGspKSArIHNvdXJjZTtcbiAgICAgICAgICBzb3VyY2UgPSAndmFyIE4nICsgayArICc9ZTt3aGlsZShlJiZlIT09aCYmZSE9PWcmJihlPWUucGFyZW50Tm9kZSkpeycgKyBzb3VyY2UgKyAnYnJlYWs7fWU9TicgKyBrICsgJzsnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIERlc2NlbmRhbnQgY29tYmluYXRvclxuICAgICAgICAvLyBFIEYgKEUgYW5jZXN0b3Igb2YgRilcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuYW5jZXN0b3IpKSkge1xuICAgICAgICAgIHNvdXJjZSA9IChtb2RlID8gJycgOiBGSUxURVIucmVwbGFjZSgvQC9nLCBrKSkgKyBzb3VyY2U7XG4gICAgICAgICAgc291cmNlID0gJ3ZhciBOJyArIGsgKyAnPWU7d2hpbGUoZSYmZSE9PWgmJmUhPT1nJiYoZT1lLnBhcmVudE5vZGUpKXsnICsgc291cmNlICsgJ31lPU4nICsgayArICc7JztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICoqKiBTdHJ1Y3R1cmFsIHBzZXVkby1jbGFzc2VzXG4gICAgICAgIC8vIDpyb290LCA6ZW1wdHksXG4gICAgICAgIC8vIDpmaXJzdC1jaGlsZCwgOmxhc3QtY2hpbGQsIDpvbmx5LWNoaWxkLFxuICAgICAgICAvLyA6Zmlyc3Qtb2YtdHlwZSwgOmxhc3Qtb2YtdHlwZSwgOm9ubHktb2YtdHlwZSxcbiAgICAgICAgLy8gOm50aC1jaGlsZCgpLCA6bnRoLWxhc3QtY2hpbGQoKSwgOm50aC1vZi10eXBlKCksIDpudGgtbGFzdC1vZi10eXBlKClcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuc3BzZXVkb3MpKSAmJiBtYXRjaFsxXSkge1xuXG4gICAgICAgICAgc3dpdGNoIChtYXRjaFsxXSkge1xuICAgICAgICAgICAgY2FzZSAncm9vdCc6XG4gICAgICAgICAgICAgIC8vIGVsZW1lbnQgcm9vdCBvZiB0aGUgZG9jdW1lbnRcbiAgICAgICAgICAgICAgaWYgKG1hdGNoWzNdKSB7XG4gICAgICAgICAgICAgICAgc291cmNlID0gJ2lmKGU9PT1ofHxzLmNvbnRhaW5zKGgsZSkpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc291cmNlID0gJ2lmKGU9PT1oKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICdlbXB0eSc6XG4gICAgICAgICAgICAgIC8vIGVsZW1lbnQgdGhhdCBoYXMgbm8gY2hpbGRyZW5cbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKHMuaXNFbXB0eShlKSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIGlmIChtYXRjaFsxXSAmJiBtYXRjaFsyXSkge1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaFsyXSA9PSAnbicpIHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihlIT09aCl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWF0Y2hbMl0gPT0gJ2V2ZW4nKSB7XG4gICAgICAgICAgICAgICAgICBhID0gMjtcbiAgICAgICAgICAgICAgICAgIGIgPSAwO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWF0Y2hbMl0gPT0gJ29kZCcpIHtcbiAgICAgICAgICAgICAgICAgIGEgPSAyO1xuICAgICAgICAgICAgICAgICAgYiA9IDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGFzc3VtZXMgY29ycmVjdCBcImFuK2JcIiBmb3JtYXQsIFwiYlwiIGJlZm9yZSBcImFcIiB0byBrZWVwIFwiblwiIHZhbHVlc1xuICAgICAgICAgICAgICAgICAgYiA9ICgobiA9IG1hdGNoWzJdLm1hdGNoKC8oLT9cXGQrKSQvKSkgPyBnbG9iYWwucGFyc2VJbnQoblsxXSwgMTApIDogMCk7XG4gICAgICAgICAgICAgICAgICBhID0gKChuID0gbWF0Y2hbMl0ubWF0Y2goLygtP1xcZCopbi9pKSkgPyBnbG9iYWwucGFyc2VJbnQoblsxXSwgMTApIDogMCk7XG4gICAgICAgICAgICAgICAgICBpZiAobiAmJiBuWzFdID09ICctJykgYSA9IC0xO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGJ1aWxkIHRlc3QgZXhwcmVzc2lvbiBvdXQgb2Ygc3RydWN0dXJhbCBwc2V1ZG8gKGFuK2IpIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICAgICAvLyBzZWUgaGVyZTogaHR0cDovL3d3dy53My5vcmcvVFIvY3NzMy1zZWxlY3RvcnMvI250aC1jaGlsZC1wc2V1ZG9cbiAgICAgICAgICAgICAgICB0ZXN0ID0gYSA+IDEgP1xuICAgICAgICAgICAgICAgICAgKC9sYXN0L2kudGVzdChtYXRjaFsxXSkpID8gJyhuLSgnICsgYiArICcpKSUnICsgYSArICc9PTAnIDpcbiAgICAgICAgICAgICAgICAgICduPj0nICsgYiArICcmJihuLSgnICsgYiArICcpKSUnICsgYSArICc9PTAnIDogYSA8IC0xID9cbiAgICAgICAgICAgICAgICAgICgvbGFzdC9pLnRlc3QobWF0Y2hbMV0pKSA/ICcobi0oJyArIGIgKyAnKSklJyArIGEgKyAnPT0wJyA6XG4gICAgICAgICAgICAgICAgICAnbjw9JyArIGIgKyAnJiYobi0oJyArIGIgKyAnKSklJyArIGEgKyAnPT0wJyA6IGEgPT09IDAgP1xuICAgICAgICAgICAgICAgICAgJ249PScgKyBiIDogYSA9PSAtMSA/ICduPD0nICsgYiA6ICduPj0nICsgYjtcblxuICAgICAgICAgICAgICAgIC8vIDQgY2FzZXM6IDEgKG50aCkgeCA0IChjaGlsZCwgb2YtdHlwZSwgbGFzdC1jaGlsZCwgbGFzdC1vZi10eXBlKVxuICAgICAgICAgICAgICAgIHNvdXJjZSA9XG4gICAgICAgICAgICAgICAgICAnaWYoZSE9PWgpeycgK1xuICAgICAgICAgICAgICAgICAgICAnbj1zWycgKyAoLy1vZi10eXBlL2kudGVzdChtYXRjaFsxXSkgPyAnXCJudGhPZlR5cGVcIicgOiAnXCJudGhFbGVtZW50XCInKSArICddJyArXG4gICAgICAgICAgICAgICAgICAgICAgJyhlLCcgKyAoL2xhc3QvaS50ZXN0KG1hdGNoWzFdKSA/ICd0cnVlJyA6ICdmYWxzZScpICsgJyk7JyArXG4gICAgICAgICAgICAgICAgICAgICdpZignICsgdGVzdCArICcpeycgKyBzb3VyY2UgKyAnfScgK1xuICAgICAgICAgICAgICAgICAgJ30nO1xuXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gNiBjYXNlczogMyAoZmlyc3QsIGxhc3QsIG9ubHkpIHggMSAoY2hpbGQpIHggMiAoLW9mLXR5cGUpXG4gICAgICAgICAgICAgICAgYSA9IC9maXJzdC9pLnRlc3QobWF0Y2hbMV0pID8gJ3ByZXZpb3VzJyA6ICduZXh0JztcbiAgICAgICAgICAgICAgICBuID0gL29ubHkvaS50ZXN0KG1hdGNoWzFdKSA/ICdwcmV2aW91cycgOiAnbmV4dCc7XG4gICAgICAgICAgICAgICAgYiA9IC9maXJzdHxsYXN0L2kudGVzdChtYXRjaFsxXSk7XG5cbiAgICAgICAgICAgICAgICB0eXBlID0gLy1vZi10eXBlL2kudGVzdChtYXRjaFsxXSkgPyAnJiZuLm5vZGVOYW1lIT1lLm5vZGVOYW1lJyA6ICcmJm4ubm9kZU5hbWU8XCJAXCInO1xuXG4gICAgICAgICAgICAgICAgc291cmNlID0gJ2lmKGUhPT1oKXsnICtcbiAgICAgICAgICAgICAgICAgICggJ249ZTt3aGlsZSgobj1uLicgKyBhICsgJ1NpYmxpbmcpJyArIHR5cGUgKyAnKTtpZighbil7JyArIChiID8gc291cmNlIDpcbiAgICAgICAgICAgICAgICAgICAgJ249ZTt3aGlsZSgobj1uLicgKyBuICsgJ1NpYmxpbmcpJyArIHR5cGUgKyAnKTtpZighbil7JyArIHNvdXJjZSArICd9JykgKyAnfScgKSArICd9JztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICoqKiBuZWdhdGlvbiwgdXNlciBhY3Rpb24gYW5kIHRhcmdldCBwc2V1ZG8tY2xhc3Nlc1xuICAgICAgICAvLyAqKiogVUkgZWxlbWVudCBzdGF0ZXMgYW5kIGR5bmFtaWMgcHNldWRvLWNsYXNzZXNcbiAgICAgICAgLy8gQ1NTMyA6bm90LCA6Y2hlY2tlZCwgOmVuYWJsZWQsIDpkaXNhYmxlZCwgOnRhcmdldFxuICAgICAgICAvLyBDU1MzIDphY3RpdmUsIDpob3ZlciwgOmZvY3VzXG4gICAgICAgIC8vIENTUzMgOmxpbmssIDp2aXNpdGVkXG4gICAgICAgIGVsc2UgaWYgKChtYXRjaCA9IHNlbGVjdG9yLm1hdGNoKFBhdHRlcm5zLmRwc2V1ZG9zKSkgJiYgbWF0Y2hbMV0pIHtcblxuICAgICAgICAgIHN3aXRjaCAobWF0Y2hbMV0ubWF0Y2goL15cXHcrLylbMF0pIHtcbiAgICAgICAgICAgIC8vIENTUzMgbmVnYXRpb24gcHNldWRvLWNsYXNzXG4gICAgICAgICAgICBjYXNlICdub3QnOlxuICAgICAgICAgICAgICAvLyBjb21waWxlIG5lc3RlZCBzZWxlY3RvcnMsIERPIE5PVCBwYXNzIHRoZSBjYWxsYmFjayBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgLy8gU0lNUExFTk9UIGFsbG93IGRpc2FibGluZyBjb21wbGV4IHNlbGVjdG9ycyBuZXN0ZWRcbiAgICAgICAgICAgICAgLy8gaW4gJzpub3QoKScgcHNldWRvLWNsYXNzZXMsIGJyZWFrcyBzb21lIHRlc3QgdW5pdHNcbiAgICAgICAgICAgICAgZXhwciA9IG1hdGNoWzNdLnJlcGxhY2UocmVUcmltU3BhY2VzLCAnJyk7XG5cbiAgICAgICAgICAgICAgaWYgKENvbmZpZy5TSU1QTEVOT1QgJiYgIXJlU2ltcGxlTm90LnRlc3QoZXhwcikpIHtcbiAgICAgICAgICAgICAgICAvLyBzZWUgYWJvdmUsIGxvZyBlcnJvciBidXQgY29udGludWUgZXhlY3V0aW9uXG4gICAgICAgICAgICAgICAgZW1pdCgnTmVnYXRpb24gcHNldWRvLWNsYXNzIG9ubHkgYWNjZXB0cyBzaW1wbGUgc2VsZWN0b3JzIFwiJyArIHNlbGVjdG9yICsgJ1wiJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICgnY29tcGF0TW9kZScgaW4gZG9jKSB7XG4gICAgICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoIScgKyBjb21waWxlKGV4cHIsICcnLCBmYWxzZSkgKyAnKGUscyxyLGQsaCxnKSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc291cmNlID0gJ2lmKCFzLm1hdGNoKGUsIFwiJyArIGV4cHIucmVwbGFjZSgvXFx4MjIvZywgJ1xcXFxcIicpICsgJ1wiLGcpKXsnICsgc291cmNlICsnfSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBDU1MzIFVJIGVsZW1lbnQgc3RhdGVzXG4gICAgICAgICAgICBjYXNlICdjaGVja2VkJzpcbiAgICAgICAgICAgICAgLy8gZm9yIHJhZGlvIGJ1dHRvbnMgY2hlY2tib3hlcyAoSFRNTDQpIGFuZCBvcHRpb25zIChIVE1MNSlcbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKCh0eXBlb2YgZS5mb3JtIT09XCJ1bmRlZmluZWRcIiYmKC9eKD86cmFkaW98Y2hlY2tib3gpJC9pKS50ZXN0KGUudHlwZSkmJmUuY2hlY2tlZCknICtcbiAgICAgICAgICAgICAgICAoQ29uZmlnLlVTRV9IVE1MNSA/ICd8fCgvXm9wdGlvbiQvaS50ZXN0KGUubm9kZU5hbWUpJiYoZS5zZWxlY3RlZHx8ZS5jaGVja2VkKSknIDogJycpICtcbiAgICAgICAgICAgICAgICAnKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2Rpc2FibGVkJzpcbiAgICAgICAgICAgICAgLy8gZG9lcyBub3QgY29uc2lkZXIgaGlkZGVuIGlucHV0IGZpZWxkc1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoKCh0eXBlb2YgZS5mb3JtIT09XCJ1bmRlZmluZWRcIicgK1xuICAgICAgICAgICAgICAgIChDb25maWcuVVNFX0hUTUw1ID8gJycgOiAnJiYhKC9eaGlkZGVuJC9pKS50ZXN0KGUudHlwZSknKSArXG4gICAgICAgICAgICAgICAgJyl8fHMuaXNMaW5rKGUpKSYmZS5kaXNhYmxlZD09PXRydWUpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZW5hYmxlZCc6XG4gICAgICAgICAgICAgIC8vIGRvZXMgbm90IGNvbnNpZGVyIGhpZGRlbiBpbnB1dCBmaWVsZHNcbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKCgodHlwZW9mIGUuZm9ybSE9PVwidW5kZWZpbmVkXCInICtcbiAgICAgICAgICAgICAgICAoQ29uZmlnLlVTRV9IVE1MNSA/ICcnIDogJyYmISgvXmhpZGRlbiQvaSkudGVzdChlLnR5cGUpJykgK1xuICAgICAgICAgICAgICAgICcpfHxzLmlzTGluayhlKSkmJmUuZGlzYWJsZWQ9PT1mYWxzZSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIC8vIENTUzMgbGFuZyBwc2V1ZG8tY2xhc3NcbiAgICAgICAgICAgIGNhc2UgJ2xhbmcnOlxuICAgICAgICAgICAgICB0ZXN0ID0gJyc7XG4gICAgICAgICAgICAgIGlmIChtYXRjaFsyXSkgdGVzdCA9IG1hdGNoWzJdLnN1YnN0cigwLCAyKSArICctJztcbiAgICAgICAgICAgICAgc291cmNlID0gJ2RveyhuPWUubGFuZ3x8XCJcIikudG9Mb3dlckNhc2UoKTsnICtcbiAgICAgICAgICAgICAgICAnaWYoKG49PVwiXCImJmgubGFuZz09XCInICsgbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSArICdcIil8fCcgK1xuICAgICAgICAgICAgICAgICcobiYmKG49PVwiJyArIG1hdGNoWzJdLnRvTG93ZXJDYXNlKCkgK1xuICAgICAgICAgICAgICAgICdcInx8bi5zdWJzdHIoMCwzKT09XCInICsgdGVzdC50b0xvd2VyQ2FzZSgpICsgJ1wiKSkpJyArXG4gICAgICAgICAgICAgICAgJ3snICsgc291cmNlICsgJ2JyZWFrO319d2hpbGUoKGU9ZS5wYXJlbnROb2RlKSYmZSE9PWcpOyc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBDU1MzIHRhcmdldCBwc2V1ZG8tY2xhc3NcbiAgICAgICAgICAgIGNhc2UgJ3RhcmdldCc6XG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihlLmlkPT1kLmxvY2F0aW9uLmhhc2guc2xpY2UoMSkpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBDU1MzIGR5bmFtaWMgcHNldWRvLWNsYXNzZXNcbiAgICAgICAgICAgIGNhc2UgJ2xpbmsnOlxuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYocy5pc0xpbmsoZSkmJiFlLnZpc2l0ZWQpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndmlzaXRlZCc6XG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihzLmlzTGluayhlKSYmZS52aXNpdGVkKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gQ1NTMyB1c2VyIGFjdGlvbiBwc2V1ZG8tY2xhc3NlcyBJRSAmIEZGMyBoYXZlIG5hdGl2ZSBzdXBwb3J0XG4gICAgICAgICAgICAvLyB0aGVzZSBjYXBhYmlsaXRpZXMgbWF5IGJlIGVtdWxhdGVkIGJ5IHNvbWUgZXZlbnQgbWFuYWdlcnNcbiAgICAgICAgICAgIGNhc2UgJ2FjdGl2ZSc6XG4gICAgICAgICAgICAgIGlmIChYTUxfRE9DVU1FTlQpIGJyZWFrO1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoZT09PWQuYWN0aXZlRWxlbWVudCl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdob3Zlcic6XG4gICAgICAgICAgICAgIGlmIChYTUxfRE9DVU1FTlQpIGJyZWFrO1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoZT09PWQuaG92ZXJFbGVtZW50KXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2ZvY3VzJzpcbiAgICAgICAgICAgICAgaWYgKFhNTF9ET0NVTUVOVCkgYnJlYWs7XG4gICAgICAgICAgICAgIHNvdXJjZSA9IE5BVElWRV9GT0NVUyA/XG4gICAgICAgICAgICAgICAgJ2lmKGU9PT1kLmFjdGl2ZUVsZW1lbnQmJmQuaGFzRm9jdXMoKSYmKGUudHlwZXx8ZS5ocmVmfHx0eXBlb2YgZS50YWJJbmRleD09XCJudW1iZXJcIikpeycgKyBzb3VyY2UgKyAnfScgOlxuICAgICAgICAgICAgICAgICdpZihlPT09ZC5hY3RpdmVFbGVtZW50JiYoZS50eXBlfHxlLmhyZWYpKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gQ1NTMiBzZWxlY3RlZCBwc2V1ZG8tY2xhc3Nlcywgbm90IHBhcnQgb2YgY3VycmVudCBDU1MzIGRyYWZ0c1xuICAgICAgICAgICAgLy8gdGhlICdzZWxlY3RlZCcgcHJvcGVydHkgaXMgb25seSBhdmFpbGFibGUgZm9yIG9wdGlvbiBlbGVtZW50c1xuICAgICAgICAgICAgY2FzZSAnc2VsZWN0ZWQnOlxuICAgICAgICAgICAgICAvLyBmaXggU2FmYXJpIHNlbGVjdGVkSW5kZXggcHJvcGVydHkgYnVnXG4gICAgICAgICAgICAgIGV4cHIgPSBCVUdHWV9TRUxFQ1RFRCA/ICd8fChuPWUucGFyZW50Tm9kZSkmJm4ub3B0aW9uc1tuLnNlbGVjdGVkSW5kZXhdPT09ZScgOiAnJztcbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKC9eb3B0aW9uJC9pLnRlc3QoZS5ub2RlTmFtZSkmJihlLnNlbGVjdGVkfHxlLmNoZWNrZWQnICsgZXhwciArICcpKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIHtcblxuICAgICAgICAgIC8vIHRoaXMgaXMgd2hlcmUgZXh0ZXJuYWwgZXh0ZW5zaW9ucyBhcmVcbiAgICAgICAgICAvLyBpbnZva2VkIGlmIGV4cHJlc3Npb25zIG1hdGNoIHNlbGVjdG9yc1xuICAgICAgICAgIGV4cHIgPSBmYWxzZTtcbiAgICAgICAgICBzdGF0dXMgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgKGV4cHIgaW4gU2VsZWN0b3JzKSB7XG4gICAgICAgICAgICBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goU2VsZWN0b3JzW2V4cHJdLkV4cHJlc3Npb24pKSAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICByZXN1bHQgPSBTZWxlY3RvcnNbZXhwcl0uQ2FsbGJhY2sobWF0Y2gsIHNvdXJjZSk7XG4gICAgICAgICAgICAgIHNvdXJjZSA9IHJlc3VsdC5zb3VyY2U7XG4gICAgICAgICAgICAgIHN0YXR1cyA9IHJlc3VsdC5zdGF0dXM7XG4gICAgICAgICAgICAgIGlmIChzdGF0dXMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBpZiBhbiBleHRlbnNpb24gZmFpbHMgdG8gcGFyc2UgdGhlIHNlbGVjdG9yXG4gICAgICAgICAgLy8gaXQgbXVzdCByZXR1cm4gYSBmYWxzZSBib29sZWFuIGluIFwic3RhdHVzXCJcbiAgICAgICAgICBpZiAoIXN0YXR1cykge1xuICAgICAgICAgICAgLy8gbG9nIGVycm9yIGJ1dCBjb250aW51ZSBleGVjdXRpb24sIGRvbid0IHRocm93IHJlYWwgZXhjZXB0aW9uc1xuICAgICAgICAgICAgLy8gYmVjYXVzZSBibG9ja2luZyBmb2xsb3dpbmcgcHJvY2Vzc2VzIG1heWJlIGlzIG5vdCBhIGdvb2QgaWRlYVxuICAgICAgICAgICAgZW1pdCgnVW5rbm93biBwc2V1ZG8tY2xhc3Mgc2VsZWN0b3IgXCInICsgc2VsZWN0b3IgKyAnXCInKTtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWV4cHIpIHtcbiAgICAgICAgICAgIC8vIHNlZSBhYm92ZSwgbG9nIGVycm9yIGJ1dCBjb250aW51ZSBleGVjdXRpb25cbiAgICAgICAgICAgIGVtaXQoJ1Vua25vd24gdG9rZW4gaW4gc2VsZWN0b3IgXCInICsgc2VsZWN0b3IgKyAnXCInKTtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVycm9yIGlmIG5vIG1hdGNoZXMgZm91bmQgYnkgdGhlIHBhdHRlcm4gc2NhblxuICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgZW1pdCgnSW52YWxpZCBzeW50YXggaW4gc2VsZWN0b3IgXCInICsgc2VsZWN0b3IgKyAnXCInKTtcbiAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbnN1cmUgXCJtYXRjaFwiIGlzIG5vdCBudWxsIG9yIGVtcHR5IHNpbmNlXG4gICAgICAgIC8vIHdlIGRvIG5vdCB0aHJvdyByZWFsIERPTUV4Y2VwdGlvbnMgYWJvdmVcbiAgICAgICAgc2VsZWN0b3IgPSBtYXRjaCAmJiBtYXRjaFttYXRjaC5sZW5ndGggLSAxXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICB9LFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gUVVFUlkgTUVUSE9EUyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIG1hdGNoIGVsZW1lbnQgd2l0aCBzZWxlY3RvclxuICAvLyBAcmV0dXJuIGJvb2xlYW5cbiAgbWF0Y2ggPVxuICAgIGZ1bmN0aW9uKGVsZW1lbnQsIHNlbGVjdG9yLCBmcm9tLCBjYWxsYmFjaykge1xuXG4gICAgICB2YXIgcGFydHM7XG5cbiAgICAgIGlmICghKGVsZW1lbnQgJiYgZWxlbWVudC5ub2RlVHlwZSA9PSAxKSkge1xuICAgICAgICBlbWl0KCdJbnZhbGlkIGVsZW1lbnQgYXJndW1lbnQnKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZWN0b3IgIT0gJ3N0cmluZycpIHtcbiAgICAgICAgZW1pdCgnSW52YWxpZCBzZWxlY3RvciBhcmd1bWVudCcpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGZyb20gJiYgZnJvbS5ub2RlVHlwZSA9PSAxICYmICFjb250YWlucyhmcm9tLCBlbGVtZW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGxhc3RDb250ZXh0ICE9PSBmcm9tKSB7XG4gICAgICAgIC8vIHJlc2V0IGNvbnRleHQgZGF0YSB3aGVuIGl0IGNoYW5nZXNcbiAgICAgICAgLy8gYW5kIGVuc3VyZSBjb250ZXh0IGlzIHNldCB0byBhIGRlZmF1bHRcbiAgICAgICAgc3dpdGNoQ29udGV4dChmcm9tIHx8IChmcm9tID0gZWxlbWVudC5vd25lckRvY3VtZW50KSk7XG4gICAgICB9XG5cbiAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZShyZVRyaW1TcGFjZXMsICcnKTtcblxuICAgICAgQ29uZmlnLlNIT1JUQ1VUUyAmJiAoc2VsZWN0b3IgPSBEb20uc2hvcnRjdXRzKHNlbGVjdG9yLCBlbGVtZW50LCBmcm9tKSk7XG5cbiAgICAgIGlmIChsYXN0TWF0Y2hlciAhPSBzZWxlY3Rvcikge1xuICAgICAgICAvLyBwcm9jZXNzIHZhbGlkIHNlbGVjdG9yIHN0cmluZ3NcbiAgICAgICAgaWYgKChwYXJ0cyA9IHNlbGVjdG9yLm1hdGNoKHJlVmFsaWRhdG9yKSkgJiYgcGFydHNbMF0gPT0gc2VsZWN0b3IpIHtcbiAgICAgICAgICBpc1NpbmdsZU1hdGNoID0gKHBhcnRzID0gc2VsZWN0b3IubWF0Y2gocmVTcGxpdEdyb3VwKSkubGVuZ3RoIDwgMjtcbiAgICAgICAgICAvLyBzYXZlIHBhc3NlZCBzZWxlY3RvclxuICAgICAgICAgIGxhc3RNYXRjaGVyID0gc2VsZWN0b3I7XG4gICAgICAgICAgbGFzdFBhcnRzTWF0Y2ggPSBwYXJ0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbWl0KCdUaGUgc3RyaW5nIFwiJyArIHNlbGVjdG9yICsgJ1wiLCBpcyBub3QgYSB2YWxpZCBDU1Mgc2VsZWN0b3InKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBwYXJ0cyA9IGxhc3RQYXJ0c01hdGNoO1xuXG4gICAgICAvLyBjb21waWxlIG1hdGNoZXIgcmVzb2x2ZXJzIGlmIG5lY2Vzc2FyeVxuICAgICAgaWYgKCFtYXRjaFJlc29sdmVyc1tzZWxlY3Rvcl0gfHwgbWF0Y2hDb250ZXh0c1tzZWxlY3Rvcl0gIT09IGZyb20pIHtcbiAgICAgICAgbWF0Y2hSZXNvbHZlcnNbc2VsZWN0b3JdID0gY29tcGlsZShpc1NpbmdsZU1hdGNoID8gW3NlbGVjdG9yXSA6IHBhcnRzLCAnJywgZmFsc2UpO1xuICAgICAgICBtYXRjaENvbnRleHRzW3NlbGVjdG9yXSA9IGZyb207XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYXRjaFJlc29sdmVyc1tzZWxlY3Rvcl0oZWxlbWVudCwgU25hcHNob3QsIFsgXSwgZG9jLCByb290LCBmcm9tLCBjYWxsYmFjaywgbmV3IGdsb2JhbC5PYmplY3QoKSk7XG4gICAgfSxcblxuICAvLyBzZWxlY3Qgb25seSB0aGUgZmlyc3QgZWxlbWVudFxuICAvLyBtYXRjaGluZyBzZWxlY3RvciAoZG9jdW1lbnQgb3JkZXJlZClcbiAgZmlyc3QgPVxuICAgIGZ1bmN0aW9uKHNlbGVjdG9yLCBmcm9tKSB7XG4gICAgICByZXR1cm4gc2VsZWN0KHNlbGVjdG9yLCBmcm9tLCBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlOyB9KVswXSB8fCBudWxsO1xuICAgIH0sXG5cbiAgLy8gc2VsZWN0IGVsZW1lbnRzIG1hdGNoaW5nIHNlbGVjdG9yXG4gIC8vIHVzaW5nIG5ldyBRdWVyeSBTZWxlY3RvciBBUElcbiAgLy8gb3IgY3Jvc3MtYnJvd3NlciBjbGllbnQgQVBJXG4gIC8vIEByZXR1cm4gYXJyYXlcbiAgc2VsZWN0ID1cbiAgICBmdW5jdGlvbihzZWxlY3RvciwgZnJvbSwgY2FsbGJhY2spIHtcblxuICAgICAgdmFyIGksIGNoYW5nZWQsIGVsZW1lbnQsIGVsZW1lbnRzLCBwYXJ0cywgdG9rZW4sIG9yaWdpbmFsID0gc2VsZWN0b3I7XG5cbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGVtaXQoJ05vdCBlbm91Z2ggYXJndW1lbnRzJyk7XG4gICAgICAgIHJldHVybiBbIF07XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxlY3RvciAhPSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gWyBdO1xuICAgICAgfSBlbHNlIGlmIChmcm9tICYmICEoLzF8OXwxMS8pLnRlc3QoZnJvbS5ub2RlVHlwZSkpIHtcbiAgICAgICAgZW1pdCgnSW52YWxpZCBvciBpbGxlZ2FsIGNvbnRleHQgZWxlbWVudCcpO1xuICAgICAgICByZXR1cm4gWyBdO1xuICAgICAgfSBlbHNlIGlmIChsYXN0Q29udGV4dCAhPT0gZnJvbSkge1xuICAgICAgICAvLyByZXNldCBjb250ZXh0IGRhdGEgd2hlbiBpdCBjaGFuZ2VzXG4gICAgICAgIC8vIGFuZCBlbnN1cmUgY29udGV4dCBpcyBzZXQgdG8gYSBkZWZhdWx0XG4gICAgICAgIHN3aXRjaENvbnRleHQoZnJvbSB8fCAoZnJvbSA9IGRvYykpO1xuICAgICAgfVxuXG4gICAgICBpZiAoQ29uZmlnLkNBQ0hJTkcgJiYgKGVsZW1lbnRzID0gRG9tLmxvYWRSZXN1bHRzKG9yaWdpbmFsLCBmcm9tLCBkb2MsIHJvb3QpKSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sgPyBjb25jYXRDYWxsKFsgXSwgZWxlbWVudHMsIGNhbGxiYWNrKSA6IGVsZW1lbnRzO1xuICAgICAgfVxuXG4gICAgICBpZiAoIU9QRVJBX1FTQVBJICYmIFJFX1NJTVBMRV9TRUxFQ1RPUi50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgICBzd2l0Y2ggKHNlbGVjdG9yLmNoYXJBdCgwKSkge1xuICAgICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgICAgaWYgKENvbmZpZy5VTklRVUVfSUQpIHtcbiAgICAgICAgICAgICAgZWxlbWVudHMgPSAoZWxlbWVudCA9IF9ieUlkKHNlbGVjdG9yLnNsaWNlKDEpLCBmcm9tKSkgPyBbIGVsZW1lbnQgXSA6IFsgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJy4nOlxuICAgICAgICAgICAgZWxlbWVudHMgPSBfYnlDbGFzcyhzZWxlY3Rvci5zbGljZSgxKSwgZnJvbSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgZWxlbWVudHMgPSBfYnlUYWcoc2VsZWN0b3IsIGZyb20pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZWxzZSBpZiAoIVhNTF9ET0NVTUVOVCAmJiBDb25maWcuVVNFX1FTQVBJICYmXG4gICAgICAgICEoQlVHR1lfUVVJUktTX1FTQVBJICYmIFJFX0NMQVNTLnRlc3Qoc2VsZWN0b3IpKSAmJlxuICAgICAgICAhUkVfQlVHR1lfUVNBUEkudGVzdChzZWxlY3RvcikpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBlbGVtZW50cyA9IGZyb20ucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgIH0gY2F0Y2goZSkgeyB9XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50cykge1xuICAgICAgICBlbGVtZW50cyA9IGNhbGxiYWNrID8gY29uY2F0Q2FsbChbIF0sIGVsZW1lbnRzLCBjYWxsYmFjaykgOlxuICAgICAgICAgIE5BVElWRV9TTElDRV9QUk9UTyA/IHNsaWNlLmNhbGwoZWxlbWVudHMpIDogY29uY2F0TGlzdChbIF0sIGVsZW1lbnRzKTtcbiAgICAgICAgQ29uZmlnLkNBQ0hJTkcgJiYgRG9tLnNhdmVSZXN1bHRzKG9yaWdpbmFsLCBmcm9tLCBkb2MsIGVsZW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGVsZW1lbnRzO1xuICAgICAgfVxuXG4gICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnJlcGxhY2UocmVUcmltU3BhY2VzLCAnJyk7XG5cbiAgICAgIENvbmZpZy5TSE9SVENVVFMgJiYgKHNlbGVjdG9yID0gRG9tLnNob3J0Y3V0cyhzZWxlY3RvciwgZnJvbSkpO1xuXG4gICAgICBpZiAoKGNoYW5nZWQgPSBsYXN0U2VsZWN0b3IgIT0gc2VsZWN0b3IpKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgdmFsaWQgc2VsZWN0b3Igc3RyaW5nc1xuICAgICAgICBpZiAoKHBhcnRzID0gc2VsZWN0b3IubWF0Y2gocmVWYWxpZGF0b3IpKSAmJiBwYXJ0c1swXSA9PSBzZWxlY3Rvcikge1xuICAgICAgICAgIGlzU2luZ2xlU2VsZWN0ID0gKHBhcnRzID0gc2VsZWN0b3IubWF0Y2gocmVTcGxpdEdyb3VwKSkubGVuZ3RoIDwgMjtcbiAgICAgICAgICAvLyBzYXZlIHBhc3NlZCBzZWxlY3RvclxuICAgICAgICAgIGxhc3RTZWxlY3RvciA9IHNlbGVjdG9yO1xuICAgICAgICAgIGxhc3RQYXJ0c1NlbGVjdCA9IHBhcnRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVtaXQoJ1RoZSBzdHJpbmcgXCInICsgc2VsZWN0b3IgKyAnXCIsIGlzIG5vdCBhIHZhbGlkIENTUyBzZWxlY3RvcicpO1xuICAgICAgICAgIHJldHVybiBbIF07XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBwYXJ0cyA9IGxhc3RQYXJ0c1NlbGVjdDtcblxuICAgICAgLy8gY29tbWFzIHNlcGFyYXRvcnMgYXJlIHRyZWF0ZWQgc2VxdWVudGlhbGx5IHRvIG1haW50YWluIG9yZGVyXG4gICAgICBpZiAoZnJvbS5ub2RlVHlwZSA9PSAxMSkge1xuXG4gICAgICAgIGVsZW1lbnRzID0gYnlUYWdSYXcoJyonLCBmcm9tKTtcblxuICAgICAgfSBlbHNlIGlmICghWE1MX0RPQ1VNRU5UICYmIGlzU2luZ2xlU2VsZWN0KSB7XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAvLyBnZXQgcmlnaHQgbW9zdCBzZWxlY3RvciB0b2tlblxuICAgICAgICAgIHBhcnRzID0gc2VsZWN0b3IubWF0Y2gocmVTcGxpdFRva2VuKTtcbiAgICAgICAgICB0b2tlbiA9IHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuXG4gICAgICAgICAgLy8gb25seSBsYXN0IHNsaWNlIGJlZm9yZSA6bm90IHJ1bGVzXG4gICAgICAgICAgbGFzdFNsaWNlID0gdG9rZW4uc3BsaXQoJzpub3QnKVswXTtcblxuICAgICAgICAgIC8vIHBvc2l0aW9uIHdoZXJlIHRva2VuIHdhcyBmb3VuZFxuICAgICAgICAgIGxhc3RQb3NpdGlvbiA9IHNlbGVjdG9yLmxlbmd0aCAtIHRva2VuLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElEIG9wdGltaXphdGlvbiBSVEwsIHRvIHJlZHVjZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gdmlzaXRcbiAgICAgICAgaWYgKENvbmZpZy5VTklRVUVfSUQgJiYgKHBhcnRzID0gbGFzdFNsaWNlLm1hdGNoKE9wdGltaXplLklEKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50ID0gX2J5SWQodG9rZW4sIGZyb20pKSkge1xuICAgICAgICAgICAgaWYgKG1hdGNoKGVsZW1lbnQsIHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlbGVtZW50KTtcbiAgICAgICAgICAgICAgZWxlbWVudHMgPSBuZXcgZ2xvYmFsLkFycmF5KGVsZW1lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGVsZW1lbnRzID0gbmV3IGdsb2JhbC5BcnJheSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElEIG9wdGltaXphdGlvbiBMVFIsIHRvIHJlZHVjZSBzZWxlY3Rpb24gY29udGV4dCBzZWFyY2hlc1xuICAgICAgICBlbHNlIGlmIChDb25maWcuVU5JUVVFX0lEICYmIChwYXJ0cyA9IHNlbGVjdG9yLm1hdGNoKE9wdGltaXplLklEKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50ID0gX2J5SWQodG9rZW4sIGRvYykpKSB7XG4gICAgICAgICAgICBpZiAoJyMnICsgdG9rZW4gPT0gc2VsZWN0b3IpIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soZWxlbWVudCk7XG4gICAgICAgICAgICAgIGVsZW1lbnRzID0gbmV3IGdsb2JhbC5BcnJheShlbGVtZW50KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoL1s+K35dLy50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICBmcm9tID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZnJvbSA9IGVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGVsZW1lbnRzID0gbmV3IGdsb2JhbC5BcnJheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVsZW1lbnRzKSB7XG4gICAgICAgICAgQ29uZmlnLkNBQ0hJTkcgJiYgRG9tLnNhdmVSZXN1bHRzKG9yaWdpbmFsLCBmcm9tLCBkb2MsIGVsZW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gZWxlbWVudHM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIU5BVElWRV9HRUJDTiAmJiAocGFydHMgPSBsYXN0U2xpY2UubWF0Y2goT3B0aW1pemUuVEFHKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50cyA9IF9ieVRhZyh0b2tlbiwgZnJvbSkpLmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gWyBdOyB9XG4gICAgICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5zbGljZSgwLCBsYXN0UG9zaXRpb24pICsgc2VsZWN0b3Iuc2xpY2UobGFzdFBvc2l0aW9uKS5yZXBsYWNlKHRva2VuLCAnKicpO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSBpZiAoKHBhcnRzID0gbGFzdFNsaWNlLm1hdGNoKE9wdGltaXplLkNMQVNTKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50cyA9IF9ieUNsYXNzKHRva2VuLCBmcm9tKSkubGVuZ3RoID09PSAwKSB7IHJldHVybiBbIF07IH1cbiAgICAgICAgICBpZiAocmVPcHRpbWl6ZVNlbGVjdG9yLnRlc3Qoc2VsZWN0b3IuY2hhckF0KHNlbGVjdG9yLmluZGV4T2YodG9rZW4pIC0gMSkpKSB7XG4gICAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UoJy4nICsgdG9rZW4sICcnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5zbGljZSgwLCBsYXN0UG9zaXRpb24pICsgc2VsZWN0b3Iuc2xpY2UobGFzdFBvc2l0aW9uKS5yZXBsYWNlKCcuJyArIHRva2VuLCAnKicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2UgaWYgKChwYXJ0cyA9IHNlbGVjdG9yLm1hdGNoKE9wdGltaXplLkNMQVNTKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50cyA9IF9ieUNsYXNzKHRva2VuLCBmcm9tKSkubGVuZ3RoID09PSAwKSB7IHJldHVybiBbIF07IH1cbiAgICAgICAgICBmb3IgKGkgPSAwLCBlbHMgPSBuZXcgZ2xvYmFsLkFycmF5KCk7IGVsZW1lbnRzLmxlbmd0aCA+IGk7ICsraSkge1xuICAgICAgICAgICAgZWxzID0gY29uY2F0TGlzdChlbHMsIGVsZW1lbnRzW2ldLmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbGVtZW50cyA9IGVscztcbiAgICAgICAgICBpZiAocmVPcHRpbWl6ZVNlbGVjdG9yLnRlc3Qoc2VsZWN0b3IuY2hhckF0KHNlbGVjdG9yLmluZGV4T2YodG9rZW4pIC0gMSkpKSB7XG4gICAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UoJy4nICsgdG9rZW4sICcnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5zbGljZSgwLCBsYXN0UG9zaXRpb24pICsgc2VsZWN0b3Iuc2xpY2UobGFzdFBvc2l0aW9uKS5yZXBsYWNlKCcuJyArIHRva2VuLCAnKicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2UgaWYgKE5BVElWRV9HRUJDTiAmJiAocGFydHMgPSBsYXN0U2xpY2UubWF0Y2goT3B0aW1pemUuVEFHKSkgJiYgKHRva2VuID0gcGFydHNbMV0pKSB7XG4gICAgICAgICAgaWYgKChlbGVtZW50cyA9IF9ieVRhZyh0b2tlbiwgZnJvbSkpLmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gWyBdOyB9XG4gICAgICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5zbGljZSgwLCBsYXN0UG9zaXRpb24pICsgc2VsZWN0b3Iuc2xpY2UobGFzdFBvc2l0aW9uKS5yZXBsYWNlKHRva2VuLCAnKicpO1xuICAgICAgICB9XG5cbiAgICAgIH1cblxuICAgICAgaWYgKCFlbGVtZW50cykge1xuICAgICAgICBlbGVtZW50cyA9IC9eKD86YXBwbGV0fG9iamVjdCkkL2kudGVzdChmcm9tLm5vZGVOYW1lKSA/IGZyb20uY2hpbGROb2RlcyA6IF9ieVRhZygnKicsIGZyb20pO1xuICAgICAgfVxuICAgICAgLy8gZW5kIG9mIHByZWZpbHRlcmluZyBwYXNzXG5cbiAgICAgIC8vIGNvbXBpbGUgc2VsZWN0b3IgcmVzb2x2ZXIgaWYgbmVjZXNzYXJ5XG4gICAgICBpZiAoIXNlbGVjdFJlc29sdmVyc1tzZWxlY3Rvcl0gfHwgc2VsZWN0Q29udGV4dHNbc2VsZWN0b3JdICE9PSBmcm9tKSB7XG4gICAgICAgIHNlbGVjdFJlc29sdmVyc1tzZWxlY3Rvcl0gPSBjb21waWxlKGlzU2luZ2xlU2VsZWN0ID8gW3NlbGVjdG9yXSA6IHBhcnRzLCAnJywgdHJ1ZSk7XG4gICAgICAgIHNlbGVjdENvbnRleHRzW3NlbGVjdG9yXSA9IGZyb207XG4gICAgICB9XG5cbiAgICAgIGVsZW1lbnRzID0gc2VsZWN0UmVzb2x2ZXJzW3NlbGVjdG9yXShlbGVtZW50cywgU25hcHNob3QsIFsgXSwgZG9jLCByb290LCBmcm9tLCBjYWxsYmFjaywgbmV3IGdsb2JhbC5PYmplY3QoKSk7XG5cbiAgICAgIENvbmZpZy5DQUNISU5HICYmIERvbS5zYXZlUmVzdWx0cyhvcmlnaW5hbCwgZnJvbSwgZG9jLCBlbGVtZW50cyk7XG5cbiAgICAgIHJldHVybiBlbGVtZW50cztcbiAgICB9LFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gU1RPUkFHRSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGVtcHR5IGZ1bmN0aW9uIGhhbmRsZXJcbiAgRk4gPSBmdW5jdGlvbih4KSB7IHJldHVybiB4OyB9LFxuXG4gIC8vIGNvbXBpbGVkIG1hdGNoIGZ1bmN0aW9ucyByZXR1cm5pbmcgYm9vbGVhbnNcbiAgbWF0Y2hDb250ZXh0cyA9IG5ldyBnbG9iYWwuT2JqZWN0KCksXG4gIG1hdGNoUmVzb2x2ZXJzID0gbmV3IGdsb2JhbC5PYmplY3QoKSxcblxuICAvLyBjb21waWxlZCBzZWxlY3QgZnVuY3Rpb25zIHJldHVybmluZyBjb2xsZWN0aW9uc1xuICBzZWxlY3RDb250ZXh0cyA9IG5ldyBnbG9iYWwuT2JqZWN0KCksXG4gIHNlbGVjdFJlc29sdmVycyA9IG5ldyBnbG9iYWwuT2JqZWN0KCksXG5cbiAgLy8gdXNlZCB0byBwYXNzIG1ldGhvZHMgdG8gY29tcGlsZWQgZnVuY3Rpb25zXG4gIFNuYXBzaG90ID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuXG4gICAgLy8gZWxlbWVudCBpbmRleGluZyBtZXRob2RzXG4gICAgbnRoRWxlbWVudDogbnRoRWxlbWVudCxcbiAgICBudGhPZlR5cGU6IG50aE9mVHlwZSxcblxuICAgIC8vIGVsZW1lbnQgaW5zcGVjdGlvbiBtZXRob2RzXG4gICAgZ2V0QXR0cmlidXRlOiBnZXRBdHRyaWJ1dGUsXG4gICAgaGFzQXR0cmlidXRlOiBoYXNBdHRyaWJ1dGUsXG5cbiAgICAvLyBlbGVtZW50IHNlbGVjdGlvbiBtZXRob2RzXG4gICAgYnlDbGFzczogX2J5Q2xhc3MsXG4gICAgYnlOYW1lOiBieU5hbWUsXG4gICAgYnlUYWc6IF9ieVRhZyxcbiAgICBieUlkOiBfYnlJZCxcblxuICAgIC8vIGhlbHBlci9jaGVjayBtZXRob2RzXG4gICAgY29udGFpbnM6IGNvbnRhaW5zLFxuICAgIGlzRW1wdHk6IGlzRW1wdHksXG4gICAgaXNMaW5rOiBpc0xpbmssXG5cbiAgICAvLyBzZWxlY3Rpb24vbWF0Y2hpbmdcbiAgICBzZWxlY3Q6IHNlbGVjdCxcbiAgICBtYXRjaDogbWF0Y2hcbiAgfSksXG5cbiAgVG9rZW5zID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgIHByZWZpeGVzOiBwcmVmaXhlcyxcbiAgICBlbmNvZGluZzogZW5jb2RpbmcsXG4gICAgb3BlcmF0b3JzOiBvcGVyYXRvcnMsXG4gICAgd2hpdGVzcGFjZTogd2hpdGVzcGFjZSxcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyLFxuICAgIGF0dHJpYnV0ZXM6IGF0dHJpYnV0ZXMsXG4gICAgY29tYmluYXRvcnM6IGNvbWJpbmF0b3JzLFxuICAgIHBzZXVkb2NsYXNzOiBwc2V1ZG9jbGFzcyxcbiAgICBwc2V1ZG9wYXJtczogcHNldWRvcGFybXMsXG4gICAgcXVvdGVkdmFsdWU6IHF1b3RlZHZhbHVlXG4gIH0pO1xuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBQVUJMSUMgQVBJIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGNvZGUgcmVmZXJlbmNlZCBieSBleHRlbnNpb25zXG4gIERvbS5BQ0NFUFRfTk9ERSA9IEFDQ0VQVF9OT0RFO1xuXG4gIC8vIHJldHJpZXZlIGVsZW1lbnQgYnkgaWQgYXR0clxuICBEb20uYnlJZCA9IGJ5SWQ7XG5cbiAgLy8gcmV0cmlldmUgZWxlbWVudHMgYnkgdGFnIG5hbWVcbiAgRG9tLmJ5VGFnID0gYnlUYWc7XG5cbiAgLy8gcmV0cmlldmUgZWxlbWVudHMgYnkgbmFtZSBhdHRyXG4gIERvbS5ieU5hbWUgPSBieU5hbWU7XG5cbiAgLy8gcmV0cmlldmUgZWxlbWVudHMgYnkgY2xhc3MgbmFtZVxuICBEb20uYnlDbGFzcyA9IGJ5Q2xhc3M7XG5cbiAgLy8gcmVhZCB0aGUgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAvLyBhcyB3YXMgaW4gdGhlIG9yaWdpbmFsIEhUTUwgY29kZVxuICBEb20uZ2V0QXR0cmlidXRlID0gZ2V0QXR0cmlidXRlO1xuXG4gIC8vIGNoZWNrIGZvciB0aGUgYXR0cmlidXRlIHByZXNlbmNlXG4gIC8vIGFzIHdhcyBpbiB0aGUgb3JpZ2luYWwgSFRNTCBjb2RlXG4gIERvbS5oYXNBdHRyaWJ1dGUgPSBoYXNBdHRyaWJ1dGU7XG5cbiAgLy8gZWxlbWVudCBtYXRjaCBzZWxlY3RvciwgcmV0dXJuIGJvb2xlYW4gdHJ1ZS9mYWxzZVxuICBEb20ubWF0Y2ggPSBtYXRjaDtcblxuICAvLyBmaXJzdCBlbGVtZW50IG1hdGNoIG9ubHksIHJldHVybiBlbGVtZW50IG9yIG51bGxcbiAgRG9tLmZpcnN0ID0gZmlyc3Q7XG5cbiAgLy8gZWxlbWVudHMgbWF0Y2hpbmcgc2VsZWN0b3IsIHN0YXJ0aW5nIGZyb20gZWxlbWVudFxuICBEb20uc2VsZWN0ID0gc2VsZWN0O1xuXG4gIC8vIGNvbXBpbGUgc2VsZWN0b3IgaW50byBhZC1ob2MgamF2YXNjcmlwdCByZXNvbHZlclxuICBEb20uY29tcGlsZSA9IGNvbXBpbGU7XG5cbiAgLy8gY2hlY2sgdGhhdCB0d28gZWxlbWVudHMgYXJlIGFuY2VzdG9yL2Rlc2NlbmRhbnRcbiAgRG9tLmNvbnRhaW5zID0gY29udGFpbnM7XG5cbiAgLy8gaGFuZGxlIHNlbGVjdG9yIGVuZ2luZSBjb25maWd1cmF0aW9uIHNldHRpbmdzXG4gIERvbS5jb25maWd1cmUgPSBjb25maWd1cmU7XG5cbiAgLy8gaW5pdGlhbGl6ZSBjYWNoaW5nIGZvciBlYWNoIGRvY3VtZW50XG4gIERvbS5zZXRDYWNoZSA9IEZOO1xuXG4gIC8vIGxvYWQgcHJldmlvdXNseSBjb2xsZWN0ZWQgcmVzdWx0IHNldFxuICBEb20ubG9hZFJlc3VsdHMgPSBGTjtcblxuICAvLyBzYXZlIHByZXZpb3VzbHkgY29sbGVjdGVkIHJlc3VsdCBzZXRcbiAgRG9tLnNhdmVSZXN1bHRzID0gRk47XG5cbiAgLy8gaGFuZGxlIG1pc3NpbmcgY29udGV4dCBpbiBzZWxlY3RvciBzdHJpbmdzXG4gIERvbS5zaG9ydGN1dHMgPSBGTjtcblxuICAvLyBsb2cgcmVzb2x2ZXJzIGVycm9ycy93YXJuaW5nc1xuICBEb20uZW1pdCA9IGVtaXQ7XG5cbiAgLy8gb3B0aW9ucyBlbmFiaW5nIHNwZWNpZmljIGVuZ2luZSBmdW5jdGlvbmFsaXR5XG4gIERvbS5Db25maWcgPSBDb25maWc7XG5cbiAgLy8gcGFzcyBtZXRob2RzIHJlZmVyZW5jZXMgdG8gY29tcGlsZWQgcmVzb2x2ZXJzXG4gIERvbS5TbmFwc2hvdCA9IFNuYXBzaG90O1xuXG4gIC8vIG9wZXJhdG9ycyBkZXNjcmlwdG9yXG4gIC8vIGZvciBhdHRyaWJ1dGUgb3BlcmF0b3JzIGV4dGVuc2lvbnNcbiAgRG9tLk9wZXJhdG9ycyA9IE9wZXJhdG9ycztcblxuICAvLyBzZWxlY3RvcnMgZGVzY3JpcHRvclxuICAvLyBmb3IgcHNldWRvLWNsYXNzIHNlbGVjdG9ycyBleHRlbnNpb25zXG4gIERvbS5TZWxlY3RvcnMgPSBTZWxlY3RvcnM7XG5cbiAgLy8gZXhwb3J0IHN0cmluZyBwYXR0ZXJuc1xuICBEb20uVG9rZW5zID0gVG9rZW5zO1xuXG4gIC8vIGV4cG9ydCB2ZXJzaW9uIHN0cmluZ1xuICBEb20uVmVyc2lvbiA9IHZlcnNpb247XG5cbiAgLy8gYWRkIG9yIG92ZXJ3cml0ZSB1c2VyIGRlZmluZWQgb3BlcmF0b3JzXG4gIERvbS5yZWdpc3Rlck9wZXJhdG9yID1cbiAgICBmdW5jdGlvbihzeW1ib2wsIHJlc29sdmVyKSB7XG4gICAgICBPcGVyYXRvcnNbc3ltYm9sXSB8fCAoT3BlcmF0b3JzW3N5bWJvbF0gPSByZXNvbHZlcik7XG4gICAgfTtcblxuICAvLyBhZGQgc2VsZWN0b3IgcGF0dGVybnMgZm9yIHVzZXIgZGVmaW5lZCBjYWxsYmFja3NcbiAgRG9tLnJlZ2lzdGVyU2VsZWN0b3IgPVxuICAgIGZ1bmN0aW9uKG5hbWUsIHJleHAsIGZ1bmMpIHtcbiAgICAgIFNlbGVjdG9yc1tuYW1lXSB8fCAoU2VsZWN0b3JzW25hbWVdID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgICAgICBFeHByZXNzaW9uOiByZXhwLFxuICAgICAgICBDYWxsYmFjazogZnVuY1xuICAgICAgfSkpO1xuICAgIH07XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIElOSVQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gaW5pdCBjb250ZXh0IHNwZWNpZmljIHZhcmlhYmxlc1xuICBzd2l0Y2hDb250ZXh0KGRvYywgdHJ1ZSk7XG5cbn0pO1xuIiwiZnVuY3Rpb24gY291bnQoc2VsZiwgc3Vic3RyKSB7XG4gIHZhciBjb3VudCA9IDBcbiAgdmFyIHBvcyA9IHNlbGYuaW5kZXhPZihzdWJzdHIpXG5cbiAgd2hpbGUgKHBvcyA+PSAwKSB7XG4gICAgY291bnQgKz0gMVxuICAgIHBvcyA9IHNlbGYuaW5kZXhPZihzdWJzdHIsIHBvcyArIDEpXG4gIH1cblxuICByZXR1cm4gY291bnRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb3VudCIsImZ1bmN0aW9uIHNwbGl0TGVmdChzZWxmLCBzZXAsIG1heFNwbGl0LCBsaW1pdCkge1xuXG4gIGlmICh0eXBlb2YgbWF4U3BsaXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIG1heFNwbGl0ID0gLTE7XG4gIH1cblxuICB2YXIgc3BsaXRSZXN1bHQgPSBzZWxmLnNwbGl0KHNlcCk7XG4gIHZhciBzcGxpdFBhcnQxID0gc3BsaXRSZXN1bHQuc2xpY2UoMCwgbWF4U3BsaXQpO1xuICB2YXIgc3BsaXRQYXJ0MiA9IHNwbGl0UmVzdWx0LnNsaWNlKG1heFNwbGl0KTtcblxuICBpZiAoc3BsaXRQYXJ0Mi5sZW5ndGggPT09IDApIHtcbiAgICBzcGxpdFJlc3VsdCA9IHNwbGl0UGFydDE7XG4gIH0gZWxzZSB7XG4gICAgc3BsaXRSZXN1bHQgPSBzcGxpdFBhcnQxLmNvbmNhdChzcGxpdFBhcnQyLmpvaW4oc2VwKSk7XG4gIH1cblxuICBpZiAodHlwZW9mIGxpbWl0ID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBzcGxpdFJlc3VsdDtcbiAgfSBlbHNlIGlmIChsaW1pdCA8IDApIHtcbiAgICByZXR1cm4gc3BsaXRSZXN1bHQuc2xpY2UobGltaXQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzcGxpdFJlc3VsdC5zbGljZSgwLCBsaW1pdCk7XG4gIH1cblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNwbGl0TGVmdDtcbiIsImZ1bmN0aW9uIHNwbGl0UmlnaHQoc2VsZiwgc2VwLCBtYXhTcGxpdCwgbGltaXQpIHtcblxuICBpZiAodHlwZW9mIG1heFNwbGl0ID09PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBtYXhTcGxpdCA9IC0xO1xuICB9XG4gIGlmICh0eXBlb2YgbGltaXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIGxpbWl0ID0gMDtcbiAgfVxuXG4gIHZhciBzcGxpdFJlc3VsdCA9IFtzZWxmXTtcblxuICBmb3IgKHZhciBpID0gc2VsZi5sZW5ndGgtMTsgaSA+PSAwOyBpLS0pIHtcblxuICAgIGlmIChcbiAgICAgIHNwbGl0UmVzdWx0WzBdLnNsaWNlKGkpLmluZGV4T2Yoc2VwKSA9PT0gMCAmJlxuICAgICAgKHNwbGl0UmVzdWx0Lmxlbmd0aCA8PSBtYXhTcGxpdCB8fCBtYXhTcGxpdCA9PT0gLTEpXG4gICAgKSB7XG4gICAgICBzcGxpdFJlc3VsdC5zcGxpY2UoMSwgMCwgc3BsaXRSZXN1bHRbMF0uc2xpY2UoaStzZXAubGVuZ3RoKSk7IC8vIGluc2VydFxuICAgICAgc3BsaXRSZXN1bHRbMF0gPSBzcGxpdFJlc3VsdFswXS5zbGljZSgwLCBpKVxuICAgIH1cbiAgfVxuXG4gIGlmIChsaW1pdCA+PSAwKSB7XG4gICAgcmV0dXJuIHNwbGl0UmVzdWx0LnNsaWNlKC1saW1pdCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHNwbGl0UmVzdWx0LnNsaWNlKDAsIC1saW1pdCk7XG4gIH1cblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNwbGl0UmlnaHQ7XG4iLCIvKlxuc3RyaW5nLmpzIC0gQ29weXJpZ2h0IChDKSAyMDEyLTIwMTQsIEpQIFJpY2hhcmRzb24gPGpwcmljaGFyZHNvbkBnbWFpbC5jb20+XG4qL1xuXG4hKGZ1bmN0aW9uKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgVkVSU0lPTiA9ICczLjMuMSc7XG5cbiAgdmFyIEVOVElUSUVTID0ge307XG5cbiAgLy8gZnJvbSBodHRwOi8vc2VtcGxpY2V3ZWJzaXRlcy5jb20vcmVtb3ZpbmctYWNjZW50cy1qYXZhc2NyaXB0XG4gIHZhciBsYXRpbl9tYXA9e1wiw4FcIjpcIkFcIixcIsSCXCI6XCJBXCIsXCLhuq5cIjpcIkFcIixcIuG6tlwiOlwiQVwiLFwi4bqwXCI6XCJBXCIsXCLhurJcIjpcIkFcIixcIuG6tFwiOlwiQVwiLFwix41cIjpcIkFcIixcIsOCXCI6XCJBXCIsXCLhuqRcIjpcIkFcIixcIuG6rFwiOlwiQVwiLFwi4bqmXCI6XCJBXCIsXCLhuqhcIjpcIkFcIixcIuG6qlwiOlwiQVwiLFwiw4RcIjpcIkFcIixcIseeXCI6XCJBXCIsXCLIplwiOlwiQVwiLFwix6BcIjpcIkFcIixcIuG6oFwiOlwiQVwiLFwiyIBcIjpcIkFcIixcIsOAXCI6XCJBXCIsXCLhuqJcIjpcIkFcIixcIsiCXCI6XCJBXCIsXCLEgFwiOlwiQVwiLFwixIRcIjpcIkFcIixcIsOFXCI6XCJBXCIsXCLHulwiOlwiQVwiLFwi4biAXCI6XCJBXCIsXCLIulwiOlwiQVwiLFwiw4NcIjpcIkFcIixcIuqcslwiOlwiQUFcIixcIsOGXCI6XCJBRVwiLFwix7xcIjpcIkFFXCIsXCLHolwiOlwiQUVcIixcIuqctFwiOlwiQU9cIixcIuqctlwiOlwiQVVcIixcIuqcuFwiOlwiQVZcIixcIuqculwiOlwiQVZcIixcIuqcvFwiOlwiQVlcIixcIuG4glwiOlwiQlwiLFwi4biEXCI6XCJCXCIsXCLGgVwiOlwiQlwiLFwi4biGXCI6XCJCXCIsXCLJg1wiOlwiQlwiLFwixoJcIjpcIkJcIixcIsSGXCI6XCJDXCIsXCLEjFwiOlwiQ1wiLFwiw4dcIjpcIkNcIixcIuG4iFwiOlwiQ1wiLFwixIhcIjpcIkNcIixcIsSKXCI6XCJDXCIsXCLGh1wiOlwiQ1wiLFwiyLtcIjpcIkNcIixcIsSOXCI6XCJEXCIsXCLhuJBcIjpcIkRcIixcIuG4klwiOlwiRFwiLFwi4biKXCI6XCJEXCIsXCLhuIxcIjpcIkRcIixcIsaKXCI6XCJEXCIsXCLhuI5cIjpcIkRcIixcIseyXCI6XCJEXCIsXCLHhVwiOlwiRFwiLFwixJBcIjpcIkRcIixcIsaLXCI6XCJEXCIsXCLHsVwiOlwiRFpcIixcIseEXCI6XCJEWlwiLFwiw4lcIjpcIkVcIixcIsSUXCI6XCJFXCIsXCLEmlwiOlwiRVwiLFwiyKhcIjpcIkVcIixcIuG4nFwiOlwiRVwiLFwiw4pcIjpcIkVcIixcIuG6vlwiOlwiRVwiLFwi4buGXCI6XCJFXCIsXCLhu4BcIjpcIkVcIixcIuG7glwiOlwiRVwiLFwi4buEXCI6XCJFXCIsXCLhuJhcIjpcIkVcIixcIsOLXCI6XCJFXCIsXCLEllwiOlwiRVwiLFwi4bq4XCI6XCJFXCIsXCLIhFwiOlwiRVwiLFwiw4hcIjpcIkVcIixcIuG6ulwiOlwiRVwiLFwiyIZcIjpcIkVcIixcIsSSXCI6XCJFXCIsXCLhuJZcIjpcIkVcIixcIuG4lFwiOlwiRVwiLFwixJhcIjpcIkVcIixcIsmGXCI6XCJFXCIsXCLhurxcIjpcIkVcIixcIuG4mlwiOlwiRVwiLFwi6p2qXCI6XCJFVFwiLFwi4bieXCI6XCJGXCIsXCLGkVwiOlwiRlwiLFwix7RcIjpcIkdcIixcIsSeXCI6XCJHXCIsXCLHplwiOlwiR1wiLFwixKJcIjpcIkdcIixcIsScXCI6XCJHXCIsXCLEoFwiOlwiR1wiLFwixpNcIjpcIkdcIixcIuG4oFwiOlwiR1wiLFwix6RcIjpcIkdcIixcIuG4qlwiOlwiSFwiLFwiyJ5cIjpcIkhcIixcIuG4qFwiOlwiSFwiLFwixKRcIjpcIkhcIixcIuKxp1wiOlwiSFwiLFwi4bimXCI6XCJIXCIsXCLhuKJcIjpcIkhcIixcIuG4pFwiOlwiSFwiLFwixKZcIjpcIkhcIixcIsONXCI6XCJJXCIsXCLErFwiOlwiSVwiLFwix49cIjpcIklcIixcIsOOXCI6XCJJXCIsXCLDj1wiOlwiSVwiLFwi4biuXCI6XCJJXCIsXCLEsFwiOlwiSVwiLFwi4buKXCI6XCJJXCIsXCLIiFwiOlwiSVwiLFwiw4xcIjpcIklcIixcIuG7iFwiOlwiSVwiLFwiyIpcIjpcIklcIixcIsSqXCI6XCJJXCIsXCLErlwiOlwiSVwiLFwixpdcIjpcIklcIixcIsSoXCI6XCJJXCIsXCLhuKxcIjpcIklcIixcIuqduVwiOlwiRFwiLFwi6p27XCI6XCJGXCIsXCLqnb1cIjpcIkdcIixcIuqeglwiOlwiUlwiLFwi6p6EXCI6XCJTXCIsXCLqnoZcIjpcIlRcIixcIuqdrFwiOlwiSVNcIixcIsS0XCI6XCJKXCIsXCLJiFwiOlwiSlwiLFwi4biwXCI6XCJLXCIsXCLHqFwiOlwiS1wiLFwixLZcIjpcIktcIixcIuKxqVwiOlwiS1wiLFwi6p2CXCI6XCJLXCIsXCLhuLJcIjpcIktcIixcIsaYXCI6XCJLXCIsXCLhuLRcIjpcIktcIixcIuqdgFwiOlwiS1wiLFwi6p2EXCI6XCJLXCIsXCLEuVwiOlwiTFwiLFwiyL1cIjpcIkxcIixcIsS9XCI6XCJMXCIsXCLEu1wiOlwiTFwiLFwi4bi8XCI6XCJMXCIsXCLhuLZcIjpcIkxcIixcIuG4uFwiOlwiTFwiLFwi4rGgXCI6XCJMXCIsXCLqnYhcIjpcIkxcIixcIuG4ulwiOlwiTFwiLFwixL9cIjpcIkxcIixcIuKxolwiOlwiTFwiLFwix4hcIjpcIkxcIixcIsWBXCI6XCJMXCIsXCLHh1wiOlwiTEpcIixcIuG4vlwiOlwiTVwiLFwi4bmAXCI6XCJNXCIsXCLhuYJcIjpcIk1cIixcIuKxrlwiOlwiTVwiLFwixYNcIjpcIk5cIixcIsWHXCI6XCJOXCIsXCLFhVwiOlwiTlwiLFwi4bmKXCI6XCJOXCIsXCLhuYRcIjpcIk5cIixcIuG5hlwiOlwiTlwiLFwix7hcIjpcIk5cIixcIsadXCI6XCJOXCIsXCLhuYhcIjpcIk5cIixcIsigXCI6XCJOXCIsXCLHi1wiOlwiTlwiLFwiw5FcIjpcIk5cIixcIseKXCI6XCJOSlwiLFwiw5NcIjpcIk9cIixcIsWOXCI6XCJPXCIsXCLHkVwiOlwiT1wiLFwiw5RcIjpcIk9cIixcIuG7kFwiOlwiT1wiLFwi4buYXCI6XCJPXCIsXCLhu5JcIjpcIk9cIixcIuG7lFwiOlwiT1wiLFwi4buWXCI6XCJPXCIsXCLDllwiOlwiT1wiLFwiyKpcIjpcIk9cIixcIsiuXCI6XCJPXCIsXCLIsFwiOlwiT1wiLFwi4buMXCI6XCJPXCIsXCLFkFwiOlwiT1wiLFwiyIxcIjpcIk9cIixcIsOSXCI6XCJPXCIsXCLhu45cIjpcIk9cIixcIsagXCI6XCJPXCIsXCLhu5pcIjpcIk9cIixcIuG7olwiOlwiT1wiLFwi4bucXCI6XCJPXCIsXCLhu55cIjpcIk9cIixcIuG7oFwiOlwiT1wiLFwiyI5cIjpcIk9cIixcIuqdilwiOlwiT1wiLFwi6p2MXCI6XCJPXCIsXCLFjFwiOlwiT1wiLFwi4bmSXCI6XCJPXCIsXCLhuZBcIjpcIk9cIixcIsafXCI6XCJPXCIsXCLHqlwiOlwiT1wiLFwix6xcIjpcIk9cIixcIsOYXCI6XCJPXCIsXCLHvlwiOlwiT1wiLFwiw5VcIjpcIk9cIixcIuG5jFwiOlwiT1wiLFwi4bmOXCI6XCJPXCIsXCLIrFwiOlwiT1wiLFwixqJcIjpcIk9JXCIsXCLqnY5cIjpcIk9PXCIsXCLGkFwiOlwiRVwiLFwixoZcIjpcIk9cIixcIsiiXCI6XCJPVVwiLFwi4bmUXCI6XCJQXCIsXCLhuZZcIjpcIlBcIixcIuqdklwiOlwiUFwiLFwixqRcIjpcIlBcIixcIuqdlFwiOlwiUFwiLFwi4rGjXCI6XCJQXCIsXCLqnZBcIjpcIlBcIixcIuqdmFwiOlwiUVwiLFwi6p2WXCI6XCJRXCIsXCLFlFwiOlwiUlwiLFwixZhcIjpcIlJcIixcIsWWXCI6XCJSXCIsXCLhuZhcIjpcIlJcIixcIuG5mlwiOlwiUlwiLFwi4bmcXCI6XCJSXCIsXCLIkFwiOlwiUlwiLFwiyJJcIjpcIlJcIixcIuG5nlwiOlwiUlwiLFwiyYxcIjpcIlJcIixcIuKxpFwiOlwiUlwiLFwi6py+XCI6XCJDXCIsXCLGjlwiOlwiRVwiLFwixZpcIjpcIlNcIixcIuG5pFwiOlwiU1wiLFwixaBcIjpcIlNcIixcIuG5plwiOlwiU1wiLFwixZ5cIjpcIlNcIixcIsWcXCI6XCJTXCIsXCLImFwiOlwiU1wiLFwi4bmgXCI6XCJTXCIsXCLhuaJcIjpcIlNcIixcIuG5qFwiOlwiU1wiLFwi4bqeXCI6XCJTU1wiLFwixaRcIjpcIlRcIixcIsWiXCI6XCJUXCIsXCLhubBcIjpcIlRcIixcIsiaXCI6XCJUXCIsXCLIvlwiOlwiVFwiLFwi4bmqXCI6XCJUXCIsXCLhuaxcIjpcIlRcIixcIsasXCI6XCJUXCIsXCLhua5cIjpcIlRcIixcIsauXCI6XCJUXCIsXCLFplwiOlwiVFwiLFwi4rGvXCI6XCJBXCIsXCLqnoBcIjpcIkxcIixcIsacXCI6XCJNXCIsXCLJhVwiOlwiVlwiLFwi6pyoXCI6XCJUWlwiLFwiw5pcIjpcIlVcIixcIsWsXCI6XCJVXCIsXCLHk1wiOlwiVVwiLFwiw5tcIjpcIlVcIixcIuG5tlwiOlwiVVwiLFwiw5xcIjpcIlVcIixcIseXXCI6XCJVXCIsXCLHmVwiOlwiVVwiLFwix5tcIjpcIlVcIixcIseVXCI6XCJVXCIsXCLhubJcIjpcIlVcIixcIuG7pFwiOlwiVVwiLFwixbBcIjpcIlVcIixcIsiUXCI6XCJVXCIsXCLDmVwiOlwiVVwiLFwi4bumXCI6XCJVXCIsXCLGr1wiOlwiVVwiLFwi4buoXCI6XCJVXCIsXCLhu7BcIjpcIlVcIixcIuG7qlwiOlwiVVwiLFwi4busXCI6XCJVXCIsXCLhu65cIjpcIlVcIixcIsiWXCI6XCJVXCIsXCLFqlwiOlwiVVwiLFwi4bm6XCI6XCJVXCIsXCLFslwiOlwiVVwiLFwixa5cIjpcIlVcIixcIsWoXCI6XCJVXCIsXCLhubhcIjpcIlVcIixcIuG5tFwiOlwiVVwiLFwi6p2eXCI6XCJWXCIsXCLhub5cIjpcIlZcIixcIsayXCI6XCJWXCIsXCLhubxcIjpcIlZcIixcIuqdoFwiOlwiVllcIixcIuG6glwiOlwiV1wiLFwixbRcIjpcIldcIixcIuG6hFwiOlwiV1wiLFwi4bqGXCI6XCJXXCIsXCLhuohcIjpcIldcIixcIuG6gFwiOlwiV1wiLFwi4rGyXCI6XCJXXCIsXCLhuoxcIjpcIlhcIixcIuG6ilwiOlwiWFwiLFwiw51cIjpcIllcIixcIsW2XCI6XCJZXCIsXCLFuFwiOlwiWVwiLFwi4bqOXCI6XCJZXCIsXCLhu7RcIjpcIllcIixcIuG7slwiOlwiWVwiLFwixrNcIjpcIllcIixcIuG7tlwiOlwiWVwiLFwi4bu+XCI6XCJZXCIsXCLIslwiOlwiWVwiLFwiyY5cIjpcIllcIixcIuG7uFwiOlwiWVwiLFwixblcIjpcIlpcIixcIsW9XCI6XCJaXCIsXCLhupBcIjpcIlpcIixcIuKxq1wiOlwiWlwiLFwixbtcIjpcIlpcIixcIuG6klwiOlwiWlwiLFwiyKRcIjpcIlpcIixcIuG6lFwiOlwiWlwiLFwixrVcIjpcIlpcIixcIsSyXCI6XCJJSlwiLFwixZJcIjpcIk9FXCIsXCLhtIBcIjpcIkFcIixcIuG0gVwiOlwiQUVcIixcIsqZXCI6XCJCXCIsXCLhtINcIjpcIkJcIixcIuG0hFwiOlwiQ1wiLFwi4bSFXCI6XCJEXCIsXCLhtIdcIjpcIkVcIixcIuqcsFwiOlwiRlwiLFwiyaJcIjpcIkdcIixcIsqbXCI6XCJHXCIsXCLKnFwiOlwiSFwiLFwiyapcIjpcIklcIixcIsqBXCI6XCJSXCIsXCLhtIpcIjpcIkpcIixcIuG0i1wiOlwiS1wiLFwiyp9cIjpcIkxcIixcIuG0jFwiOlwiTFwiLFwi4bSNXCI6XCJNXCIsXCLJtFwiOlwiTlwiLFwi4bSPXCI6XCJPXCIsXCLJtlwiOlwiT0VcIixcIuG0kFwiOlwiT1wiLFwi4bSVXCI6XCJPVVwiLFwi4bSYXCI6XCJQXCIsXCLKgFwiOlwiUlwiLFwi4bSOXCI6XCJOXCIsXCLhtJlcIjpcIlJcIixcIuqcsVwiOlwiU1wiLFwi4bSbXCI6XCJUXCIsXCLisbtcIjpcIkVcIixcIuG0mlwiOlwiUlwiLFwi4bScXCI6XCJVXCIsXCLhtKBcIjpcIlZcIixcIuG0oVwiOlwiV1wiLFwiyo9cIjpcIllcIixcIuG0olwiOlwiWlwiLFwiw6FcIjpcImFcIixcIsSDXCI6XCJhXCIsXCLhuq9cIjpcImFcIixcIuG6t1wiOlwiYVwiLFwi4bqxXCI6XCJhXCIsXCLhurNcIjpcImFcIixcIuG6tVwiOlwiYVwiLFwix45cIjpcImFcIixcIsOiXCI6XCJhXCIsXCLhuqVcIjpcImFcIixcIuG6rVwiOlwiYVwiLFwi4bqnXCI6XCJhXCIsXCLhuqlcIjpcImFcIixcIuG6q1wiOlwiYVwiLFwiw6RcIjpcImFcIixcIsefXCI6XCJhXCIsXCLIp1wiOlwiYVwiLFwix6FcIjpcImFcIixcIuG6oVwiOlwiYVwiLFwiyIFcIjpcImFcIixcIsOgXCI6XCJhXCIsXCLhuqNcIjpcImFcIixcIsiDXCI6XCJhXCIsXCLEgVwiOlwiYVwiLFwixIVcIjpcImFcIixcIuG2j1wiOlwiYVwiLFwi4bqaXCI6XCJhXCIsXCLDpVwiOlwiYVwiLFwix7tcIjpcImFcIixcIuG4gVwiOlwiYVwiLFwi4rGlXCI6XCJhXCIsXCLDo1wiOlwiYVwiLFwi6pyzXCI6XCJhYVwiLFwiw6ZcIjpcImFlXCIsXCLHvVwiOlwiYWVcIixcIsejXCI6XCJhZVwiLFwi6py1XCI6XCJhb1wiLFwi6py3XCI6XCJhdVwiLFwi6py5XCI6XCJhdlwiLFwi6py7XCI6XCJhdlwiLFwi6py9XCI6XCJheVwiLFwi4biDXCI6XCJiXCIsXCLhuIVcIjpcImJcIixcIsmTXCI6XCJiXCIsXCLhuIdcIjpcImJcIixcIuG1rFwiOlwiYlwiLFwi4baAXCI6XCJiXCIsXCLGgFwiOlwiYlwiLFwixoNcIjpcImJcIixcIsm1XCI6XCJvXCIsXCLEh1wiOlwiY1wiLFwixI1cIjpcImNcIixcIsOnXCI6XCJjXCIsXCLhuIlcIjpcImNcIixcIsSJXCI6XCJjXCIsXCLJlVwiOlwiY1wiLFwixItcIjpcImNcIixcIsaIXCI6XCJjXCIsXCLIvFwiOlwiY1wiLFwixI9cIjpcImRcIixcIuG4kVwiOlwiZFwiLFwi4biTXCI6XCJkXCIsXCLIoVwiOlwiZFwiLFwi4biLXCI6XCJkXCIsXCLhuI1cIjpcImRcIixcIsmXXCI6XCJkXCIsXCLhtpFcIjpcImRcIixcIuG4j1wiOlwiZFwiLFwi4bWtXCI6XCJkXCIsXCLhtoFcIjpcImRcIixcIsSRXCI6XCJkXCIsXCLJllwiOlwiZFwiLFwixoxcIjpcImRcIixcIsSxXCI6XCJpXCIsXCLIt1wiOlwialwiLFwiyZ9cIjpcImpcIixcIsqEXCI6XCJqXCIsXCLHs1wiOlwiZHpcIixcIseGXCI6XCJkelwiLFwiw6lcIjpcImVcIixcIsSVXCI6XCJlXCIsXCLEm1wiOlwiZVwiLFwiyKlcIjpcImVcIixcIuG4nVwiOlwiZVwiLFwiw6pcIjpcImVcIixcIuG6v1wiOlwiZVwiLFwi4buHXCI6XCJlXCIsXCLhu4FcIjpcImVcIixcIuG7g1wiOlwiZVwiLFwi4buFXCI6XCJlXCIsXCLhuJlcIjpcImVcIixcIsOrXCI6XCJlXCIsXCLEl1wiOlwiZVwiLFwi4bq5XCI6XCJlXCIsXCLIhVwiOlwiZVwiLFwiw6hcIjpcImVcIixcIuG6u1wiOlwiZVwiLFwiyIdcIjpcImVcIixcIsSTXCI6XCJlXCIsXCLhuJdcIjpcImVcIixcIuG4lVwiOlwiZVwiLFwi4rG4XCI6XCJlXCIsXCLEmVwiOlwiZVwiLFwi4baSXCI6XCJlXCIsXCLJh1wiOlwiZVwiLFwi4bq9XCI6XCJlXCIsXCLhuJtcIjpcImVcIixcIuqdq1wiOlwiZXRcIixcIuG4n1wiOlwiZlwiLFwixpJcIjpcImZcIixcIuG1rlwiOlwiZlwiLFwi4baCXCI6XCJmXCIsXCLHtVwiOlwiZ1wiLFwixJ9cIjpcImdcIixcIsenXCI6XCJnXCIsXCLEo1wiOlwiZ1wiLFwixJ1cIjpcImdcIixcIsShXCI6XCJnXCIsXCLJoFwiOlwiZ1wiLFwi4bihXCI6XCJnXCIsXCLhtoNcIjpcImdcIixcIselXCI6XCJnXCIsXCLhuKtcIjpcImhcIixcIsifXCI6XCJoXCIsXCLhuKlcIjpcImhcIixcIsSlXCI6XCJoXCIsXCLisahcIjpcImhcIixcIuG4p1wiOlwiaFwiLFwi4bijXCI6XCJoXCIsXCLhuKVcIjpcImhcIixcIsmmXCI6XCJoXCIsXCLhupZcIjpcImhcIixcIsSnXCI6XCJoXCIsXCLGlVwiOlwiaHZcIixcIsOtXCI6XCJpXCIsXCLErVwiOlwiaVwiLFwix5BcIjpcImlcIixcIsOuXCI6XCJpXCIsXCLDr1wiOlwiaVwiLFwi4bivXCI6XCJpXCIsXCLhu4tcIjpcImlcIixcIsiJXCI6XCJpXCIsXCLDrFwiOlwiaVwiLFwi4buJXCI6XCJpXCIsXCLIi1wiOlwiaVwiLFwixKtcIjpcImlcIixcIsSvXCI6XCJpXCIsXCLhtpZcIjpcImlcIixcIsmoXCI6XCJpXCIsXCLEqVwiOlwiaVwiLFwi4bitXCI6XCJpXCIsXCLqnbpcIjpcImRcIixcIuqdvFwiOlwiZlwiLFwi4bW5XCI6XCJnXCIsXCLqnoNcIjpcInJcIixcIuqehVwiOlwic1wiLFwi6p6HXCI6XCJ0XCIsXCLqna1cIjpcImlzXCIsXCLHsFwiOlwialwiLFwixLVcIjpcImpcIixcIsqdXCI6XCJqXCIsXCLJiVwiOlwialwiLFwi4bixXCI6XCJrXCIsXCLHqVwiOlwia1wiLFwixLdcIjpcImtcIixcIuKxqlwiOlwia1wiLFwi6p2DXCI6XCJrXCIsXCLhuLNcIjpcImtcIixcIsaZXCI6XCJrXCIsXCLhuLVcIjpcImtcIixcIuG2hFwiOlwia1wiLFwi6p2BXCI6XCJrXCIsXCLqnYVcIjpcImtcIixcIsS6XCI6XCJsXCIsXCLGmlwiOlwibFwiLFwiyaxcIjpcImxcIixcIsS+XCI6XCJsXCIsXCLEvFwiOlwibFwiLFwi4bi9XCI6XCJsXCIsXCLItFwiOlwibFwiLFwi4bi3XCI6XCJsXCIsXCLhuLlcIjpcImxcIixcIuKxoVwiOlwibFwiLFwi6p2JXCI6XCJsXCIsXCLhuLtcIjpcImxcIixcIsWAXCI6XCJsXCIsXCLJq1wiOlwibFwiLFwi4baFXCI6XCJsXCIsXCLJrVwiOlwibFwiLFwixYJcIjpcImxcIixcIseJXCI6XCJsalwiLFwixb9cIjpcInNcIixcIuG6nFwiOlwic1wiLFwi4bqbXCI6XCJzXCIsXCLhup1cIjpcInNcIixcIuG4v1wiOlwibVwiLFwi4bmBXCI6XCJtXCIsXCLhuYNcIjpcIm1cIixcIsmxXCI6XCJtXCIsXCLhta9cIjpcIm1cIixcIuG2hlwiOlwibVwiLFwixYRcIjpcIm5cIixcIsWIXCI6XCJuXCIsXCLFhlwiOlwiblwiLFwi4bmLXCI6XCJuXCIsXCLItVwiOlwiblwiLFwi4bmFXCI6XCJuXCIsXCLhuYdcIjpcIm5cIixcIse5XCI6XCJuXCIsXCLJslwiOlwiblwiLFwi4bmJXCI6XCJuXCIsXCLGnlwiOlwiblwiLFwi4bWwXCI6XCJuXCIsXCLhtodcIjpcIm5cIixcIsmzXCI6XCJuXCIsXCLDsVwiOlwiblwiLFwix4xcIjpcIm5qXCIsXCLDs1wiOlwib1wiLFwixY9cIjpcIm9cIixcIseSXCI6XCJvXCIsXCLDtFwiOlwib1wiLFwi4buRXCI6XCJvXCIsXCLhu5lcIjpcIm9cIixcIuG7k1wiOlwib1wiLFwi4buVXCI6XCJvXCIsXCLhu5dcIjpcIm9cIixcIsO2XCI6XCJvXCIsXCLIq1wiOlwib1wiLFwiyK9cIjpcIm9cIixcIsixXCI6XCJvXCIsXCLhu41cIjpcIm9cIixcIsWRXCI6XCJvXCIsXCLIjVwiOlwib1wiLFwiw7JcIjpcIm9cIixcIuG7j1wiOlwib1wiLFwixqFcIjpcIm9cIixcIuG7m1wiOlwib1wiLFwi4bujXCI6XCJvXCIsXCLhu51cIjpcIm9cIixcIuG7n1wiOlwib1wiLFwi4buhXCI6XCJvXCIsXCLIj1wiOlwib1wiLFwi6p2LXCI6XCJvXCIsXCLqnY1cIjpcIm9cIixcIuKxulwiOlwib1wiLFwixY1cIjpcIm9cIixcIuG5k1wiOlwib1wiLFwi4bmRXCI6XCJvXCIsXCLHq1wiOlwib1wiLFwix61cIjpcIm9cIixcIsO4XCI6XCJvXCIsXCLHv1wiOlwib1wiLFwiw7VcIjpcIm9cIixcIuG5jVwiOlwib1wiLFwi4bmPXCI6XCJvXCIsXCLIrVwiOlwib1wiLFwixqNcIjpcIm9pXCIsXCLqnY9cIjpcIm9vXCIsXCLJm1wiOlwiZVwiLFwi4baTXCI6XCJlXCIsXCLJlFwiOlwib1wiLFwi4baXXCI6XCJvXCIsXCLIo1wiOlwib3VcIixcIuG5lVwiOlwicFwiLFwi4bmXXCI6XCJwXCIsXCLqnZNcIjpcInBcIixcIsalXCI6XCJwXCIsXCLhtbFcIjpcInBcIixcIuG2iFwiOlwicFwiLFwi6p2VXCI6XCJwXCIsXCLhtb1cIjpcInBcIixcIuqdkVwiOlwicFwiLFwi6p2ZXCI6XCJxXCIsXCLKoFwiOlwicVwiLFwiyYtcIjpcInFcIixcIuqdl1wiOlwicVwiLFwixZVcIjpcInJcIixcIsWZXCI6XCJyXCIsXCLFl1wiOlwiclwiLFwi4bmZXCI6XCJyXCIsXCLhuZtcIjpcInJcIixcIuG5nVwiOlwiclwiLFwiyJFcIjpcInJcIixcIsm+XCI6XCJyXCIsXCLhtbNcIjpcInJcIixcIsiTXCI6XCJyXCIsXCLhuZ9cIjpcInJcIixcIsm8XCI6XCJyXCIsXCLhtbJcIjpcInJcIixcIuG2iVwiOlwiclwiLFwiyY1cIjpcInJcIixcIsm9XCI6XCJyXCIsXCLihoRcIjpcImNcIixcIuqcv1wiOlwiY1wiLFwiyZhcIjpcImVcIixcIsm/XCI6XCJyXCIsXCLFm1wiOlwic1wiLFwi4bmlXCI6XCJzXCIsXCLFoVwiOlwic1wiLFwi4bmnXCI6XCJzXCIsXCLFn1wiOlwic1wiLFwixZ1cIjpcInNcIixcIsiZXCI6XCJzXCIsXCLhuaFcIjpcInNcIixcIuG5o1wiOlwic1wiLFwi4bmpXCI6XCJzXCIsXCLKglwiOlwic1wiLFwi4bW0XCI6XCJzXCIsXCLhtopcIjpcInNcIixcIsi/XCI6XCJzXCIsXCLJoVwiOlwiZ1wiLFwiw59cIjpcInNzXCIsXCLhtJFcIjpcIm9cIixcIuG0k1wiOlwib1wiLFwi4bSdXCI6XCJ1XCIsXCLFpVwiOlwidFwiLFwixaNcIjpcInRcIixcIuG5sVwiOlwidFwiLFwiyJtcIjpcInRcIixcIsi2XCI6XCJ0XCIsXCLhupdcIjpcInRcIixcIuKxplwiOlwidFwiLFwi4bmrXCI6XCJ0XCIsXCLhua1cIjpcInRcIixcIsatXCI6XCJ0XCIsXCLhua9cIjpcInRcIixcIuG1tVwiOlwidFwiLFwixqtcIjpcInRcIixcIsqIXCI6XCJ0XCIsXCLFp1wiOlwidFwiLFwi4bW6XCI6XCJ0aFwiLFwiyZBcIjpcImFcIixcIuG0glwiOlwiYWVcIixcIsedXCI6XCJlXCIsXCLhtbdcIjpcImdcIixcIsmlXCI6XCJoXCIsXCLKrlwiOlwiaFwiLFwiyq9cIjpcImhcIixcIuG0iVwiOlwiaVwiLFwiyp5cIjpcImtcIixcIuqegVwiOlwibFwiLFwiya9cIjpcIm1cIixcIsmwXCI6XCJtXCIsXCLhtJRcIjpcIm9lXCIsXCLJuVwiOlwiclwiLFwiybtcIjpcInJcIixcIsm6XCI6XCJyXCIsXCLisblcIjpcInJcIixcIsqHXCI6XCJ0XCIsXCLKjFwiOlwidlwiLFwiyo1cIjpcIndcIixcIsqOXCI6XCJ5XCIsXCLqnKlcIjpcInR6XCIsXCLDulwiOlwidVwiLFwixa1cIjpcInVcIixcIseUXCI6XCJ1XCIsXCLDu1wiOlwidVwiLFwi4bm3XCI6XCJ1XCIsXCLDvFwiOlwidVwiLFwix5hcIjpcInVcIixcIseaXCI6XCJ1XCIsXCLHnFwiOlwidVwiLFwix5ZcIjpcInVcIixcIuG5s1wiOlwidVwiLFwi4bulXCI6XCJ1XCIsXCLFsVwiOlwidVwiLFwiyJVcIjpcInVcIixcIsO5XCI6XCJ1XCIsXCLhu6dcIjpcInVcIixcIsawXCI6XCJ1XCIsXCLhu6lcIjpcInVcIixcIuG7sVwiOlwidVwiLFwi4burXCI6XCJ1XCIsXCLhu61cIjpcInVcIixcIuG7r1wiOlwidVwiLFwiyJdcIjpcInVcIixcIsWrXCI6XCJ1XCIsXCLhubtcIjpcInVcIixcIsWzXCI6XCJ1XCIsXCLhtplcIjpcInVcIixcIsWvXCI6XCJ1XCIsXCLFqVwiOlwidVwiLFwi4bm5XCI6XCJ1XCIsXCLhubVcIjpcInVcIixcIuG1q1wiOlwidWVcIixcIuqduFwiOlwidW1cIixcIuKxtFwiOlwidlwiLFwi6p2fXCI6XCJ2XCIsXCLhub9cIjpcInZcIixcIsqLXCI6XCJ2XCIsXCLhtoxcIjpcInZcIixcIuKxsVwiOlwidlwiLFwi4bm9XCI6XCJ2XCIsXCLqnaFcIjpcInZ5XCIsXCLhuoNcIjpcIndcIixcIsW1XCI6XCJ3XCIsXCLhuoVcIjpcIndcIixcIuG6h1wiOlwid1wiLFwi4bqJXCI6XCJ3XCIsXCLhuoFcIjpcIndcIixcIuKxs1wiOlwid1wiLFwi4bqYXCI6XCJ3XCIsXCLhuo1cIjpcInhcIixcIuG6i1wiOlwieFwiLFwi4baNXCI6XCJ4XCIsXCLDvVwiOlwieVwiLFwixbdcIjpcInlcIixcIsO/XCI6XCJ5XCIsXCLhuo9cIjpcInlcIixcIuG7tVwiOlwieVwiLFwi4buzXCI6XCJ5XCIsXCLGtFwiOlwieVwiLFwi4bu3XCI6XCJ5XCIsXCLhu79cIjpcInlcIixcIsizXCI6XCJ5XCIsXCLhuplcIjpcInlcIixcIsmPXCI6XCJ5XCIsXCLhu7lcIjpcInlcIixcIsW6XCI6XCJ6XCIsXCLFvlwiOlwielwiLFwi4bqRXCI6XCJ6XCIsXCLKkVwiOlwielwiLFwi4rGsXCI6XCJ6XCIsXCLFvFwiOlwielwiLFwi4bqTXCI6XCJ6XCIsXCLIpVwiOlwielwiLFwi4bqVXCI6XCJ6XCIsXCLhtbZcIjpcInpcIixcIuG2jlwiOlwielwiLFwiypBcIjpcInpcIixcIsa2XCI6XCJ6XCIsXCLJgFwiOlwielwiLFwi76yAXCI6XCJmZlwiLFwi76yDXCI6XCJmZmlcIixcIu+shFwiOlwiZmZsXCIsXCLvrIFcIjpcImZpXCIsXCLvrIJcIjpcImZsXCIsXCLEs1wiOlwiaWpcIixcIsWTXCI6XCJvZVwiLFwi76yGXCI6XCJzdFwiLFwi4oKQXCI6XCJhXCIsXCLigpFcIjpcImVcIixcIuG1olwiOlwiaVwiLFwi4rG8XCI6XCJqXCIsXCLigpJcIjpcIm9cIixcIuG1o1wiOlwiclwiLFwi4bWkXCI6XCJ1XCIsXCLhtaVcIjpcInZcIixcIuKCk1wiOlwieFwifTtcblxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbi8vIEFkZGVkIGFuIGluaXRpYWxpemUgZnVuY3Rpb24gd2hpY2ggaXMgZXNzZW50aWFsbHkgdGhlIGNvZGUgZnJvbSB0aGUgU1xuLy8gY29uc3RydWN0b3IuICBOb3csIHRoZSBTIGNvbnN0cnVjdG9yIGNhbGxzIHRoaXMgYW5kIGEgbmV3IG1ldGhvZCBuYW1lZFxuLy8gc2V0VmFsdWUgY2FsbHMgaXQgYXMgd2VsbC4gIFRoZSBzZXRWYWx1ZSBmdW5jdGlvbiBhbGxvd3MgY29uc3RydWN0b3JzIGZvclxuLy8gbW9kdWxlcyB0aGF0IGV4dGVuZCBzdHJpbmcuanMgdG8gc2V0IHRoZSBpbml0aWFsIHZhbHVlIG9mIGFuIG9iamVjdCB3aXRob3V0XG4vLyBrbm93aW5nIHRoZSBpbnRlcm5hbCB3b3JraW5ncyBvZiBzdHJpbmcuanMuXG4vL1xuLy8gQWxzbywgYWxsIG1ldGhvZHMgd2hpY2ggcmV0dXJuIGEgbmV3IFMgb2JqZWN0IG5vdyBjYWxsOlxuLy9cbi8vICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuLy9cbi8vIGluc3RlYWQgb2Y6XG4vL1xuLy8gICAgICByZXR1cm4gbmV3IFMocyk7XG4vL1xuLy8gVGhpcyBhbGxvd3MgZXh0ZW5kZWQgb2JqZWN0cyB0byBrZWVwIHRoZWlyIHByb3BlciBpbnN0YW5jZU9mIGFuZCBjb25zdHJ1Y3Rvci5cbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cbiAgZnVuY3Rpb24gaW5pdGlhbGl6ZSAob2JqZWN0LCBzKSB7XG4gICAgaWYgKHMgIT09IG51bGwgJiYgcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodHlwZW9mIHMgPT09ICdzdHJpbmcnKVxuICAgICAgICBvYmplY3QucyA9IHM7XG4gICAgICBlbHNlXG4gICAgICAgIG9iamVjdC5zID0gcy50b1N0cmluZygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3QucyA9IHM7IC8vbnVsbCBvciB1bmRlZmluZWRcbiAgICB9XG5cbiAgICBvYmplY3Qub3JpZyA9IHM7IC8vb3JpZ2luYWwgb2JqZWN0LCBjdXJyZW50bHkgb25seSB1c2VkIGJ5IHRvQ1NWKCkgYW5kIHRvQm9vbGVhbigpXG5cbiAgICBpZiAocyAhPT0gbnVsbCAmJiBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChvYmplY3QuX19kZWZpbmVHZXR0ZXJfXykge1xuICAgICAgICBvYmplY3QuX19kZWZpbmVHZXR0ZXJfXygnbGVuZ3RoJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIG9iamVjdC5zLmxlbmd0aDtcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdC5sZW5ndGggPSBzLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JqZWN0Lmxlbmd0aCA9IC0xO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIFMocykge1xuICBcdGluaXRpYWxpemUodGhpcywgcyk7XG4gIH1cblxuICB2YXIgX19uc3AgPSBTdHJpbmcucHJvdG90eXBlO1xuICB2YXIgX19zcCA9IFMucHJvdG90eXBlID0ge1xuXG4gICAgYmV0d2VlbjogZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgdmFyIHN0YXJ0UG9zID0gcy5pbmRleE9mKGxlZnQpO1xuICAgICAgdmFyIGVuZFBvcyA9IHMuaW5kZXhPZihyaWdodCwgc3RhcnRQb3MgKyBsZWZ0Lmxlbmd0aCk7XG4gICAgICBpZiAoZW5kUG9zID09IC0xICYmIHJpZ2h0ICE9IG51bGwpXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcignJylcbiAgICAgIGVsc2UgaWYgKGVuZFBvcyA9PSAtMSAmJiByaWdodCA9PSBudWxsKVxuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocy5zdWJzdHJpbmcoc3RhcnRQb3MgKyBsZWZ0Lmxlbmd0aCkpXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzLnNsaWNlKHN0YXJ0UG9zICsgbGVmdC5sZW5ndGgsIGVuZFBvcykpO1xuICAgIH0sXG5cbiAgICAvLyMgbW9kaWZpZWQgc2xpZ2h0bHkgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZXBlbGkvdW5kZXJzY29yZS5zdHJpbmdcbiAgICBjYW1lbGl6ZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcyA9IHRoaXMudHJpbSgpLnMucmVwbGFjZSgvKFxcLXxffFxccykrKC4pPy9nLCBmdW5jdGlvbihtYXRoYywgc2VwLCBjKSB7XG4gICAgICAgIHJldHVybiAoYyA/IGMudG9VcHBlckNhc2UoKSA6ICcnKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICBjYXBpdGFsaXplOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMuc3Vic3RyKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyB0aGlzLnMuc3Vic3RyaW5nKDEpLnRvTG93ZXJDYXNlKCkpO1xuICAgIH0sXG5cbiAgICBjaGFyQXQ6IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICByZXR1cm4gdGhpcy5zLmNoYXJBdChpbmRleCk7XG4gICAgfSxcblxuICAgIGNob21wTGVmdDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICB2YXIgcyA9IHRoaXMucztcbiAgICAgIGlmIChzLmluZGV4T2YocHJlZml4KSA9PT0gMCkge1xuICAgICAgICAgcyA9IHMuc2xpY2UocHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY2hvbXBSaWdodDogZnVuY3Rpb24oc3VmZml4KSB7XG4gICAgICBpZiAodGhpcy5lbmRzV2l0aChzdWZmaXgpKSB7XG4gICAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgICBzID0gcy5zbGljZSgwLCBzLmxlbmd0aCAtIHN1ZmZpeC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8jdGhhbmtzIEdvb2dsZVxuICAgIGNvbGxhcHNlV2hpdGVzcGFjZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcyA9IHRoaXMucy5yZXBsYWNlKC9bXFxzXFx4YTBdKy9nLCAnICcpLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgY29udGFpbnM6IGZ1bmN0aW9uKHNzKSB7XG4gICAgICByZXR1cm4gdGhpcy5zLmluZGV4T2Yoc3MpID49IDA7XG4gICAgfSxcblxuICAgIGNvdW50OiBmdW5jdGlvbihzcykge1xuICAgICAgcmV0dXJuIHJlcXVpcmUoJy4vX2NvdW50JykodGhpcy5zLCBzcylcbiAgICB9LFxuXG4gICAgLy8jbW9kaWZpZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZXBlbGkvdW5kZXJzY29yZS5zdHJpbmdcbiAgICBkYXNoZXJpemU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnRyaW0oKS5zLnJlcGxhY2UoL1tfXFxzXSsvZywgJy0nKS5yZXBsYWNlKC8oW0EtWl0pL2csICctJDEnKS5yZXBsYWNlKC8tKy9nLCAnLScpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIGxhdGluaXNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzID0gdGhpcy5yZXBsYWNlKC9bXkEtWmEtejAtOVxcW1xcXSBdL2csIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIGxhdGluX21hcFt4XSB8fCB4OyB9KTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgZGVjb2RlSHRtbEVudGl0aWVzOiBmdW5jdGlvbigpIHsgLy9odHRwczovL2dpdGh1Yi5jb20vc3Vic3RhY2svbm9kZS1lbnQvYmxvYi9tYXN0ZXIvaW5kZXguanNcbiAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgcyA9IHMucmVwbGFjZSgvJiMoXFxkKyk7Py9nLCBmdW5jdGlvbiAoXywgY29kZSkge1xuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlKTtcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZSgvJiNbeFhdKFtBLUZhLWYwLTldKyk7Py9nLCBmdW5jdGlvbiAoXywgaGV4KSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KGhleCwgMTYpKTtcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZSgvJihbXjtcXFddKzs/KS9nLCBmdW5jdGlvbiAobSwgZSkge1xuICAgICAgICB2YXIgZWUgPSBlLnJlcGxhY2UoLzskLywgJycpO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gRU5USVRJRVNbZV0gfHwgKGUubWF0Y2goLzskLykgJiYgRU5USVRJRVNbZWVdKTtcblxuICAgICAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSh0YXJnZXQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICBlbmRzV2l0aDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3VmZml4ZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWZmaXhlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgbCAgPSB0aGlzLnMubGVuZ3RoIC0gc3VmZml4ZXNbaV0ubGVuZ3RoO1xuICAgICAgICBpZiAobCA+PSAwICYmIHRoaXMucy5pbmRleE9mKHN1ZmZpeGVzW2ldLCBsKSA9PT0gbCkgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIGVzY2FwZUhUTUw6IGZ1bmN0aW9uKCkgeyAvL2Zyb20gdW5kZXJzY29yZS5zdHJpbmdcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMucmVwbGFjZSgvWyY8PlwiJ10vZywgZnVuY3Rpb24obSl7IHJldHVybiAnJicgKyByZXZlcnNlZEVzY2FwZUNoYXJzW21dICsgJzsnOyB9KSk7XG4gICAgfSxcblxuICAgIGVuc3VyZUxlZnQ6IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICBpZiAocy5pbmRleE9mKHByZWZpeCkgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IocHJlZml4ICsgcyk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGVuc3VyZVJpZ2h0OiBmdW5jdGlvbihzdWZmaXgpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgaWYgKHRoaXMuZW5kc1dpdGgoc3VmZml4KSkgIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IocyArIHN1ZmZpeCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGh1bWFuaXplOiBmdW5jdGlvbigpIHsgLy9tb2RpZmllZCBmcm9tIHVuZGVyc2NvcmUuc3RyaW5nXG4gICAgICBpZiAodGhpcy5zID09PSBudWxsIHx8IHRoaXMucyA9PT0gdW5kZWZpbmVkKVxuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IoJycpXG4gICAgICB2YXIgcyA9IHRoaXMudW5kZXJzY29yZSgpLnJlcGxhY2UoL19pZCQvLCcnKS5yZXBsYWNlKC9fL2csICcgJykudHJpbSgpLmNhcGl0YWxpemUoKVxuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpXG4gICAgfSxcblxuICAgIGlzQWxwaGE6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICEvW15hLXpcXHhERi1cXHhGRl18XiQvLnRlc3QodGhpcy5zLnRvTG93ZXJDYXNlKCkpO1xuICAgIH0sXG5cbiAgICBpc0FscGhhTnVtZXJpYzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIS9bXjAtOWEtelxceERGLVxceEZGXS8udGVzdCh0aGlzLnMudG9Mb3dlckNhc2UoKSk7XG4gICAgfSxcblxuICAgIGlzRW1wdHk6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMucyA9PT0gbnVsbCB8fCB0aGlzLnMgPT09IHVuZGVmaW5lZCA/IHRydWUgOiAvXltcXHNcXHhhMF0qJC8udGVzdCh0aGlzLnMpO1xuICAgIH0sXG5cbiAgICBpc0xvd2VyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzQWxwaGEoKSAmJiB0aGlzLnMudG9Mb3dlckNhc2UoKSA9PT0gdGhpcy5zO1xuICAgIH0sXG5cbiAgICBpc051bWVyaWM6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICEvW14wLTldLy50ZXN0KHRoaXMucyk7XG4gICAgfSxcblxuICAgIGlzVXBwZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuaXNBbHBoYSgpICYmIHRoaXMucy50b1VwcGVyQ2FzZSgpID09PSB0aGlzLnM7XG4gICAgfSxcblxuICAgIGxlZnQ6IGZ1bmN0aW9uKE4pIHtcbiAgICAgIGlmIChOID49IDApIHtcbiAgICAgICAgdmFyIHMgPSB0aGlzLnMuc3Vic3RyKDAsIE4pO1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5yaWdodCgtTik7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGxpbmVzOiBmdW5jdGlvbigpIHsgLy9jb252ZXJ0IHdpbmRvd3MgbmV3bGluZXMgdG8gdW5peCBuZXdsaW5lcyB0aGVuIGNvbnZlcnQgdG8gYW4gQXJyYXkgb2YgbGluZXNcbiAgICAgIHJldHVybiB0aGlzLnJlcGxhY2VBbGwoJ1xcclxcbicsICdcXG4nKS5zLnNwbGl0KCdcXG4nKTtcbiAgICB9LFxuXG4gICAgcGFkOiBmdW5jdGlvbihsZW4sIGNoKSB7IC8vaHR0cHM6Ly9naXRodWIuY29tL2NvbXBvbmVudC9wYWRcbiAgICAgIGlmIChjaCA9PSBudWxsKSBjaCA9ICcgJztcbiAgICAgIGlmICh0aGlzLnMubGVuZ3RoID49IGxlbikgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucyk7XG4gICAgICBsZW4gPSBsZW4gLSB0aGlzLnMubGVuZ3RoO1xuICAgICAgdmFyIGxlZnQgPSBBcnJheShNYXRoLmNlaWwobGVuIC8gMikgKyAxKS5qb2luKGNoKTtcbiAgICAgIHZhciByaWdodCA9IEFycmF5KE1hdGguZmxvb3IobGVuIC8gMikgKyAxKS5qb2luKGNoKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihsZWZ0ICsgdGhpcy5zICsgcmlnaHQpO1xuICAgIH0sXG5cbiAgICBwYWRMZWZ0OiBmdW5jdGlvbihsZW4sIGNoKSB7IC8vaHR0cHM6Ly9naXRodWIuY29tL2NvbXBvbmVudC9wYWRcbiAgICAgIGlmIChjaCA9PSBudWxsKSBjaCA9ICcgJztcbiAgICAgIGlmICh0aGlzLnMubGVuZ3RoID49IGxlbikgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucyk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IoQXJyYXkobGVuIC0gdGhpcy5zLmxlbmd0aCArIDEpLmpvaW4oY2gpICsgdGhpcy5zKTtcbiAgICB9LFxuXG4gICAgcGFkUmlnaHQ6IGZ1bmN0aW9uKGxlbiwgY2gpIHsgLy9odHRwczovL2dpdGh1Yi5jb20vY29tcG9uZW50L3BhZFxuICAgICAgaWYgKGNoID09IG51bGwpIGNoID0gJyAnO1xuICAgICAgaWYgKHRoaXMucy5sZW5ndGggPj0gbGVuKSByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5zKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMgKyBBcnJheShsZW4gLSB0aGlzLnMubGVuZ3RoICsgMSkuam9pbihjaCkpO1xuICAgIH0sXG5cbiAgICBwYXJzZUNTVjogZnVuY3Rpb24oZGVsaW1pdGVyLCBxdWFsaWZpZXIsIGVzY2FwZSwgbGluZURlbGltaXRlcikgeyAvL3RyeSB0byBwYXJzZSBubyBtYXR0ZXIgd2hhdFxuICAgICAgZGVsaW1pdGVyID0gZGVsaW1pdGVyIHx8ICcsJztcbiAgICAgIGVzY2FwZSA9IGVzY2FwZSB8fCAnXFxcXCdcbiAgICAgIGlmICh0eXBlb2YgcXVhbGlmaWVyID09ICd1bmRlZmluZWQnKVxuICAgICAgICBxdWFsaWZpZXIgPSAnXCInO1xuXG4gICAgICB2YXIgaSA9IDAsIGZpZWxkQnVmZmVyID0gW10sIGZpZWxkcyA9IFtdLCBsZW4gPSB0aGlzLnMubGVuZ3RoLCBpbkZpZWxkID0gZmFsc2UsIGluVW5xdWFsaWZpZWRTdHJpbmcgPSBmYWxzZSwgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgY2EgPSBmdW5jdGlvbihpKXtyZXR1cm4gc2VsZi5zLmNoYXJBdChpKX07XG4gICAgICBpZiAodHlwZW9mIGxpbmVEZWxpbWl0ZXIgIT09ICd1bmRlZmluZWQnKSB2YXIgcm93cyA9IFtdO1xuXG4gICAgICBpZiAoIXF1YWxpZmllcilcbiAgICAgICAgaW5GaWVsZCA9IHRydWU7XG5cbiAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gY2EoaSk7XG4gICAgICAgIHN3aXRjaCAoY3VycmVudCkge1xuICAgICAgICAgIGNhc2UgZXNjYXBlOlxuICAgICAgICAgICAgLy9maXggZm9yIGlzc3VlcyAjMzIgYW5kICMzNVxuICAgICAgICAgICAgaWYgKGluRmllbGQgJiYgKChlc2NhcGUgIT09IHF1YWxpZmllcikgfHwgY2EoaSsxKSA9PT0gcXVhbGlmaWVyKSkge1xuICAgICAgICAgICAgICBpICs9IDE7XG4gICAgICAgICAgICAgIGZpZWxkQnVmZmVyLnB1c2goY2EoaSkpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlc2NhcGUgIT09IHF1YWxpZmllcikgYnJlYWs7XG4gICAgICAgICAgY2FzZSBxdWFsaWZpZXI6XG4gICAgICAgICAgICBpbkZpZWxkID0gIWluRmllbGQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGRlbGltaXRlcjpcbiAgICAgICAgICAgIGlmKGluVW5xdWFsaWZpZWRTdHJpbmcpIHtcbiAgICAgICAgICAgICAgaW5GaWVsZD1mYWxzZTtcbiAgICAgICAgICAgICAgaW5VbnF1YWxpZmllZFN0cmluZz1mYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbkZpZWxkICYmIHF1YWxpZmllcilcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIucHVzaChjdXJyZW50KTtcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBmaWVsZHMucHVzaChmaWVsZEJ1ZmZlci5qb2luKCcnKSlcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgbGluZURlbGltaXRlcjpcbiAgICAgICAgICAgIGlmKGluVW5xdWFsaWZpZWRTdHJpbmcpIHtcbiAgICAgICAgICAgICAgaW5GaWVsZD1mYWxzZTtcbiAgICAgICAgICAgICAgaW5VbnF1YWxpZmllZFN0cmluZz1mYWxzZTtcbiAgICAgICAgICAgICAgZmllbGRzLnB1c2goZmllbGRCdWZmZXIuam9pbignJykpXG4gICAgICAgICAgICAgIHJvd3MucHVzaChmaWVsZHMpO1xuICAgICAgICAgICAgICBmaWVsZHMgPSBbXTtcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGluRmllbGQpIHtcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIucHVzaChjdXJyZW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlmIChyb3dzKSB7XG4gICAgICAgICAgICAgICAgZmllbGRzLnB1c2goZmllbGRCdWZmZXIuam9pbignJykpXG4gICAgICAgICAgICAgICAgcm93cy5wdXNoKGZpZWxkcyk7XG4gICAgICAgICAgICAgICAgZmllbGRzID0gW107XG4gICAgICAgICAgICAgICAgZmllbGRCdWZmZXIubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnICc6XG4gICAgICAgICAgICBpZiAoaW5GaWVsZClcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIucHVzaChjdXJyZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBpZiAoaW5GaWVsZClcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIucHVzaChjdXJyZW50KTtcbiAgICAgICAgICAgIGVsc2UgaWYoY3VycmVudCE9PXF1YWxpZmllcikge1xuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgICBpbkZpZWxkPXRydWU7XG4gICAgICAgICAgICAgIGluVW5xdWFsaWZpZWRTdHJpbmc9dHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGkgKz0gMTtcbiAgICAgIH1cblxuICAgICAgZmllbGRzLnB1c2goZmllbGRCdWZmZXIuam9pbignJykpO1xuICAgICAgaWYgKHJvd3MpIHtcbiAgICAgICAgcm93cy5wdXNoKGZpZWxkcyk7XG4gICAgICAgIHJldHVybiByb3dzO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpZWxkcztcbiAgICB9LFxuXG4gICAgcmVwbGFjZUFsbDogZnVuY3Rpb24oc3MsIHIpIHtcbiAgICAgIC8vdmFyIHMgPSB0aGlzLnMucmVwbGFjZShuZXcgUmVnRXhwKHNzLCAnZycpLCByKTtcbiAgICAgIHZhciBzID0gdGhpcy5zLnNwbGl0KHNzKS5qb2luKHIpXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHNwbGl0TGVmdDogZnVuY3Rpb24oc2VwLCBtYXhTcGxpdCwgbGltaXQpIHtcbiAgICAgIHJldHVybiByZXF1aXJlKCcuL19zcGxpdExlZnQnKSh0aGlzLnMsIHNlcCwgbWF4U3BsaXQsIGxpbWl0KVxuICAgIH0sXG5cbiAgICBzcGxpdFJpZ2h0OiBmdW5jdGlvbihzZXAsIG1heFNwbGl0LCBsaW1pdCkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUoJy4vX3NwbGl0UmlnaHQnKSh0aGlzLnMsIHNlcCwgbWF4U3BsaXQsIGxpbWl0KVxuICAgIH0sXG5cbiAgICBzdHJpcDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc3MgPSB0aGlzLnM7XG4gICAgICBmb3IodmFyIGk9IDAsIG49YXJndW1lbnRzLmxlbmd0aDsgaTxuOyBpKyspIHtcbiAgICAgICAgc3MgPSBzcy5zcGxpdChhcmd1bWVudHNbaV0pLmpvaW4oJycpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHNzKTtcbiAgICB9LFxuXG4gICAgc3RyaXBMZWZ0OiBmdW5jdGlvbiAoY2hhcnMpIHtcbiAgICAgIHZhciByZWdleDtcbiAgICAgIHZhciBwYXR0ZXJuO1xuICAgICAgdmFyIHNzID0gZW5zdXJlU3RyaW5nKHRoaXMucyk7XG5cbiAgICAgIGlmIChjaGFycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBhdHRlcm4gPSAvXlxccysvZztcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZWdleCA9IGVzY2FwZVJlZ0V4cChjaGFycyk7XG4gICAgICAgIHBhdHRlcm4gPSBuZXcgUmVnRXhwKFwiXltcIiArIHJlZ2V4ICsgXCJdK1wiLCBcImdcIik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcihzcy5yZXBsYWNlKHBhdHRlcm4sIFwiXCIpKTtcbiAgICB9LFxuXG4gICAgc3RyaXBSaWdodDogZnVuY3Rpb24gKGNoYXJzKSB7XG4gICAgICB2YXIgcmVnZXg7XG4gICAgICB2YXIgcGF0dGVybjtcbiAgICAgIHZhciBzcyA9IGVuc3VyZVN0cmluZyh0aGlzLnMpO1xuXG4gICAgICBpZiAoY2hhcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwYXR0ZXJuID0gL1xccyskL2c7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmVnZXggPSBlc2NhcGVSZWdFeHAoY2hhcnMpO1xuICAgICAgICBwYXR0ZXJuID0gbmV3IFJlZ0V4cChcIltcIiArIHJlZ2V4ICsgXCJdKyRcIiwgXCJnXCIpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Ioc3MucmVwbGFjZShwYXR0ZXJuLCBcIlwiKSk7XG4gICAgfSxcblxuICAgIHJpZ2h0OiBmdW5jdGlvbihOKSB7XG4gICAgICBpZiAoTiA+PSAwKSB7XG4gICAgICAgIHZhciBzID0gdGhpcy5zLnN1YnN0cih0aGlzLnMubGVuZ3RoIC0gTiwgTik7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxlZnQoLU4pO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBzZXRWYWx1ZTogZnVuY3Rpb24gKHMpIHtcblx0ICBpbml0aWFsaXplKHRoaXMsIHMpO1xuXHQgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBzbHVnaWZ5OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzbCA9IChuZXcgUyhuZXcgUyh0aGlzLnMpLmxhdGluaXNlKCkucy5yZXBsYWNlKC9bXlxcd1xccy1dL2csICcnKS50b0xvd2VyQ2FzZSgpKSkuZGFzaGVyaXplKCkucztcbiAgICAgIGlmIChzbC5jaGFyQXQoMCkgPT09ICctJylcbiAgICAgICAgc2wgPSBzbC5zdWJzdHIoMSk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Ioc2wpO1xuICAgIH0sXG5cbiAgICBzdGFydHNXaXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwcmVmaXhlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWZpeGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGlmICh0aGlzLnMubGFzdEluZGV4T2YocHJlZml4ZXNbaV0sIDApID09PSAwKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgc3RyaXBQdW5jdHVhdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAvL3JldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMucmVwbGFjZSgvW1xcLiwtXFwvIyEkJVxcXiZcXCo7Ont9PVxcLV9gfigpXS9nLFwiXCIpKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMucmVwbGFjZSgvW15cXHdcXHNdfF8vZywgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikpO1xuICAgIH0sXG5cbiAgICBzdHJpcFRhZ3M6IGZ1bmN0aW9uKCkgeyAvL2Zyb20gc3VnYXIuanNcbiAgICAgIHZhciBzID0gdGhpcy5zLCBhcmdzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgPyBhcmd1bWVudHMgOiBbJyddO1xuICAgICAgbXVsdGlBcmdzKGFyZ3MsIGZ1bmN0aW9uKHRhZykge1xuICAgICAgICBzID0gcy5yZXBsYWNlKFJlZ0V4cCgnPFxcLz8nICsgdGFnICsgJ1tePD5dKj4nLCAnZ2knKSwgJycpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRlbXBsYXRlOiBmdW5jdGlvbih2YWx1ZXMsIG9wZW5pbmcsIGNsb3NpbmcpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zXG4gICAgICB2YXIgb3BlbmluZyA9IG9wZW5pbmcgfHwgRXhwb3J0LlRNUExfT1BFTlxuICAgICAgdmFyIGNsb3NpbmcgPSBjbG9zaW5nIHx8IEV4cG9ydC5UTVBMX0NMT1NFXG5cbiAgICAgIHZhciBvcGVuID0gb3BlbmluZy5yZXBsYWNlKC9bLVtcXF0oKSpcXHNdL2csIFwiXFxcXCQmXCIpLnJlcGxhY2UoL1xcJC9nLCAnXFxcXCQnKVxuICAgICAgdmFyIGNsb3NlID0gY2xvc2luZy5yZXBsYWNlKC9bLVtcXF0oKSpcXHNdL2csIFwiXFxcXCQmXCIpLnJlcGxhY2UoL1xcJC9nLCAnXFxcXCQnKVxuICAgICAgdmFyIHIgPSBuZXcgUmVnRXhwKG9wZW4gKyAnKC4rPyknICsgY2xvc2UsICdnJylcbiAgICAgICAgLy8sIHIgPSAvXFx7XFx7KC4rPylcXH1cXH0vZ1xuICAgICAgdmFyIG1hdGNoZXMgPSBzLm1hdGNoKHIpIHx8IFtdO1xuXG4gICAgICBtYXRjaGVzLmZvckVhY2goZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgICAgdmFyIGtleSA9IG1hdGNoLnN1YnN0cmluZyhvcGVuaW5nLmxlbmd0aCwgbWF0Y2gubGVuZ3RoIC0gY2xvc2luZy5sZW5ndGgpLnRyaW0oKTsvL2Nob3Age3sgYW5kIH19XG4gICAgICAgIHZhciB2YWx1ZSA9IHR5cGVvZiB2YWx1ZXNba2V5XSA9PSAndW5kZWZpbmVkJyA/ICcnIDogdmFsdWVzW2tleV07XG4gICAgICAgIHMgPSBzLnJlcGxhY2UobWF0Y2gsIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICB0aW1lczogZnVuY3Rpb24obikge1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKG5ldyBBcnJheShuICsgMSkuam9pbih0aGlzLnMpKTtcbiAgICB9LFxuXG4gICAgdGl0bGVDYXNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgaWYgKHMpIHtcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvKF5bYS16XXwgW2Etel18LVthLXpdfF9bYS16XSkvZyxcbiAgICAgICAgICBmdW5jdGlvbigkMSl7XG4gICAgICAgICAgICByZXR1cm4gJDEudG9VcHBlckNhc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRvQm9vbGVhbjogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMub3JpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdmFyIHMgPSB0aGlzLnMudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgcmV0dXJuIHMgPT09ICd0cnVlJyB8fCBzID09PSAneWVzJyB8fCBzID09PSAnb24nIHx8IHMgPT09ICcxJztcbiAgICAgIH0gZWxzZVxuICAgICAgICByZXR1cm4gdGhpcy5vcmlnID09PSB0cnVlIHx8IHRoaXMub3JpZyA9PT0gMTtcbiAgICB9LFxuXG4gICAgdG9GbG9hdDogZnVuY3Rpb24ocHJlY2lzaW9uKSB7XG4gICAgICB2YXIgbnVtID0gcGFyc2VGbG9hdCh0aGlzLnMpXG4gICAgICBpZiAocHJlY2lzaW9uKVxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChudW0udG9GaXhlZChwcmVjaXNpb24pKVxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gbnVtXG4gICAgfSxcblxuICAgIHRvSW50OiBmdW5jdGlvbigpIHsgLy90aGFua3MgR29vZ2xlXG4gICAgICAvLyBJZiB0aGUgc3RyaW5nIHN0YXJ0cyB3aXRoICcweCcgb3IgJy0weCcsIHBhcnNlIGFzIGhleC5cbiAgICAgIHJldHVybiAvXlxccyotPzB4L2kudGVzdCh0aGlzLnMpID8gcGFyc2VJbnQodGhpcy5zLCAxNikgOiBwYXJzZUludCh0aGlzLnMsIDEwKVxuICAgIH0sXG5cbiAgICB0cmltOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzO1xuICAgICAgaWYgKHR5cGVvZiBfX25zcC50cmltID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgcyA9IHRoaXMucy5yZXBsYWNlKC8oXlxccyp8XFxzKiQpL2csICcnKVxuICAgICAgZWxzZVxuICAgICAgICBzID0gdGhpcy5zLnRyaW0oKVxuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICB0cmltTGVmdDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcztcbiAgICAgIGlmIChfX25zcC50cmltTGVmdClcbiAgICAgICAgcyA9IHRoaXMucy50cmltTGVmdCgpO1xuICAgICAgZWxzZVxuICAgICAgICBzID0gdGhpcy5zLnJlcGxhY2UoLyheXFxzKikvZywgJycpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICB0cmltUmlnaHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHM7XG4gICAgICBpZiAoX19uc3AudHJpbVJpZ2h0KVxuICAgICAgICBzID0gdGhpcy5zLnRyaW1SaWdodCgpO1xuICAgICAgZWxzZVxuICAgICAgICBzID0gdGhpcy5zLnJlcGxhY2UoL1xccyskLywgJycpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICB0cnVuY2F0ZTogZnVuY3Rpb24obGVuZ3RoLCBwcnVuZVN0cikgeyAvL2Zyb20gdW5kZXJzY29yZS5zdHJpbmcsIGF1dGhvcjogZ2l0aHViLmNvbS9yd3pcbiAgICAgIHZhciBzdHIgPSB0aGlzLnM7XG5cbiAgICAgIGxlbmd0aCA9IH5+bGVuZ3RoO1xuICAgICAgcHJ1bmVTdHIgPSBwcnVuZVN0ciB8fCAnLi4uJztcblxuICAgICAgaWYgKHN0ci5sZW5ndGggPD0gbGVuZ3RoKSByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Ioc3RyKTtcblxuICAgICAgdmFyIHRtcGwgPSBmdW5jdGlvbihjKXsgcmV0dXJuIGMudG9VcHBlckNhc2UoKSAhPT0gYy50b0xvd2VyQ2FzZSgpID8gJ0EnIDogJyAnOyB9LFxuICAgICAgICB0ZW1wbGF0ZSA9IHN0ci5zbGljZSgwLCBsZW5ndGgrMSkucmVwbGFjZSgvLig/PVxcVypcXHcqJCkvZywgdG1wbCk7IC8vICdIZWxsbywgd29ybGQnIC0+ICdIZWxsQUEgQUFBQUEnXG5cbiAgICAgIGlmICh0ZW1wbGF0ZS5zbGljZSh0ZW1wbGF0ZS5sZW5ndGgtMikubWF0Y2goL1xcd1xcdy8pKVxuICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoL1xccypcXFMrJC8sICcnKTtcbiAgICAgIGVsc2VcbiAgICAgICAgdGVtcGxhdGUgPSBuZXcgUyh0ZW1wbGF0ZS5zbGljZSgwLCB0ZW1wbGF0ZS5sZW5ndGgtMSkpLnRyaW1SaWdodCgpLnM7XG5cbiAgICAgIHJldHVybiAodGVtcGxhdGUrcHJ1bmVTdHIpLmxlbmd0aCA+IHN0ci5sZW5ndGggPyBuZXcgUyhzdHIpIDogbmV3IFMoc3RyLnNsaWNlKDAsIHRlbXBsYXRlLmxlbmd0aCkrcHJ1bmVTdHIpO1xuICAgIH0sXG5cbiAgICB0b0NTVjogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGVsaW0gPSAnLCcsIHF1YWxpZmllciA9ICdcIicsIGVzY2FwZSA9ICdcXFxcJywgZW5jbG9zZU51bWJlcnMgPSB0cnVlLCBrZXlzID0gZmFsc2U7XG4gICAgICB2YXIgZGF0YUFycmF5ID0gW107XG5cbiAgICAgIGZ1bmN0aW9uIGhhc1ZhbChpdCkge1xuICAgICAgICByZXR1cm4gaXQgIT09IG51bGwgJiYgaXQgIT09ICcnO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZGVsaW0gPSBhcmd1bWVudHNbMF0uZGVsaW1pdGVyIHx8IGRlbGltO1xuICAgICAgICBkZWxpbSA9IGFyZ3VtZW50c1swXS5zZXBhcmF0b3IgfHwgZGVsaW07XG4gICAgICAgIHF1YWxpZmllciA9IGFyZ3VtZW50c1swXS5xdWFsaWZpZXIgfHwgcXVhbGlmaWVyO1xuICAgICAgICBlbmNsb3NlTnVtYmVycyA9ICEhYXJndW1lbnRzWzBdLmVuY2xvc2VOdW1iZXJzO1xuICAgICAgICBlc2NhcGUgPSBhcmd1bWVudHNbMF0uZXNjYXBlIHx8IGVzY2FwZTtcbiAgICAgICAga2V5cyA9ICEhYXJndW1lbnRzWzBdLmtleXM7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmd1bWVudHNbMF0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGRlbGltID0gYXJndW1lbnRzWzBdO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHF1YWxpZmllciA9IGFyZ3VtZW50c1sxXTtcblxuICAgICAgaWYgKGFyZ3VtZW50c1sxXSA9PT0gbnVsbClcbiAgICAgICAgcXVhbGlmaWVyID0gbnVsbDtcblxuICAgICAgIGlmICh0aGlzLm9yaWcgaW5zdGFuY2VvZiBBcnJheSlcbiAgICAgICAgZGF0YUFycmF5ICA9IHRoaXMub3JpZztcbiAgICAgIGVsc2UgeyAvL29iamVjdFxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5vcmlnKVxuICAgICAgICAgIGlmICh0aGlzLm9yaWcuaGFzT3duUHJvcGVydHkoa2V5KSlcbiAgICAgICAgICAgIGlmIChrZXlzKVxuICAgICAgICAgICAgICBkYXRhQXJyYXkucHVzaChrZXkpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBkYXRhQXJyYXkucHVzaCh0aGlzLm9yaWdba2V5XSk7XG4gICAgICB9XG5cbiAgICAgIHZhciByZXAgPSBlc2NhcGUgKyBxdWFsaWZpZXI7XG4gICAgICB2YXIgYnVpbGRTdHJpbmcgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YUFycmF5Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBzaG91bGRRdWFsaWZ5ID0gaGFzVmFsKHF1YWxpZmllcilcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhQXJyYXlbaV0gPT0gJ251bWJlcicpXG4gICAgICAgICAgc2hvdWxkUXVhbGlmeSAmPSBlbmNsb3NlTnVtYmVycztcblxuICAgICAgICBpZiAoc2hvdWxkUXVhbGlmeSlcbiAgICAgICAgICBidWlsZFN0cmluZy5wdXNoKHF1YWxpZmllcik7XG5cbiAgICAgICAgaWYgKGRhdGFBcnJheVtpXSAhPT0gbnVsbCAmJiBkYXRhQXJyYXlbaV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhciBkID0gbmV3IFMoZGF0YUFycmF5W2ldKS5yZXBsYWNlQWxsKHF1YWxpZmllciwgcmVwKS5zO1xuICAgICAgICAgIGJ1aWxkU3RyaW5nLnB1c2goZCk7XG4gICAgICAgIH0gZWxzZVxuICAgICAgICAgIGJ1aWxkU3RyaW5nLnB1c2goJycpXG5cbiAgICAgICAgaWYgKHNob3VsZFF1YWxpZnkpXG4gICAgICAgICAgYnVpbGRTdHJpbmcucHVzaChxdWFsaWZpZXIpO1xuXG4gICAgICAgIGlmIChkZWxpbSlcbiAgICAgICAgICBidWlsZFN0cmluZy5wdXNoKGRlbGltKTtcbiAgICAgIH1cblxuICAgICAgLy9jaG9wIGxhc3QgZGVsaW1cbiAgICAgIC8vY29uc29sZS5sb2coYnVpbGRTdHJpbmcubGVuZ3RoKVxuICAgICAgYnVpbGRTdHJpbmcubGVuZ3RoID0gYnVpbGRTdHJpbmcubGVuZ3RoIC0gMTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihidWlsZFN0cmluZy5qb2luKCcnKSk7XG4gICAgfSxcblxuICAgIHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnM7XG4gICAgfSxcblxuICAgIC8vI21vZGlmaWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2VwZWxpL3VuZGVyc2NvcmUuc3RyaW5nXG4gICAgdW5kZXJzY29yZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcyA9IHRoaXMudHJpbSgpLnMucmVwbGFjZSgvKFthLXpcXGRdKShbQS1aXSspL2csICckMV8kMicpLnJlcGxhY2UoLyhbQS1aXFxkXSspKFtBLVpdW2Etel0pL2csJyQxXyQyJykucmVwbGFjZSgvWy1cXHNdKy9nLCAnXycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHVuZXNjYXBlSFRNTDogZnVuY3Rpb24oKSB7IC8vZnJvbSB1bmRlcnNjb3JlLnN0cmluZ1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucy5yZXBsYWNlKC9cXCYoW147XSspOy9nLCBmdW5jdGlvbihlbnRpdHksIGVudGl0eUNvZGUpe1xuICAgICAgICB2YXIgbWF0Y2g7XG5cbiAgICAgICAgaWYgKGVudGl0eUNvZGUgaW4gZXNjYXBlQ2hhcnMpIHtcbiAgICAgICAgICByZXR1cm4gZXNjYXBlQ2hhcnNbZW50aXR5Q29kZV07XG4gICAgICAgIH0gZWxzZSBpZiAobWF0Y2ggPSBlbnRpdHlDb2RlLm1hdGNoKC9eI3goW1xcZGEtZkEtRl0rKSQvKSkge1xuICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KG1hdGNoWzFdLCAxNikpO1xuICAgICAgICB9IGVsc2UgaWYgKG1hdGNoID0gZW50aXR5Q29kZS5tYXRjaCgvXiMoXFxkKykkLykpIHtcbiAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSh+fm1hdGNoWzFdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZW50aXR5O1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSxcblxuICAgIHZhbHVlT2Y6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMucy52YWx1ZU9mKCk7XG4gICAgfSxcblxuICAgIC8vI0FkZGVkIGEgTmV3IEZ1bmN0aW9uIGNhbGxlZCB3cmFwSFRNTC5cbiAgICB3cmFwSFRNTDogZnVuY3Rpb24gKHRhZ05hbWUsIHRhZ0F0dHJzKSB7XG4gICAgICB2YXIgcyA9IHRoaXMucywgZWwgPSAodGFnTmFtZSA9PSBudWxsKSA/ICdzcGFuJyA6IHRhZ05hbWUsIGVsQXR0ciA9ICcnLCB3cmFwcGVkID0gJyc7XG4gICAgICBpZih0eXBlb2YgdGFnQXR0cnMgPT0gJ29iamVjdCcpIGZvcih2YXIgcHJvcCBpbiB0YWdBdHRycykgZWxBdHRyICs9ICcgJyArIHByb3AgKyAnPVwiJyArKG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRhZ0F0dHJzW3Byb3BdKSkuZXNjYXBlSFRNTCgpICsgJ1wiJztcbiAgICAgIHMgPSB3cmFwcGVkLmNvbmNhdCgnPCcsIGVsLCBlbEF0dHIsICc+JywgdGhpcywgJzwvJywgZWwsICc+Jyk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfVxuICB9XG5cbiAgdmFyIG1ldGhvZHNBZGRlZCA9IFtdO1xuICBmdW5jdGlvbiBleHRlbmRQcm90b3R5cGUoKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiBfX3NwKSB7XG4gICAgICAoZnVuY3Rpb24obmFtZSl7XG4gICAgICAgIHZhciBmdW5jID0gX19zcFtuYW1lXTtcbiAgICAgICAgaWYgKCFfX25zcC5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgIG1ldGhvZHNBZGRlZC5wdXNoKG5hbWUpO1xuICAgICAgICAgIF9fbnNwW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBTdHJpbmcucHJvdG90eXBlLnMgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pKG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc3RvcmVQcm90b3R5cGUoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtZXRob2RzQWRkZWQubGVuZ3RoOyArK2kpXG4gICAgICBkZWxldGUgU3RyaW5nLnByb3RvdHlwZVttZXRob2RzQWRkZWRbaV1dO1xuICAgIG1ldGhvZHNBZGRlZC5sZW5ndGggPSAwO1xuICB9XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbi8qIEF0dGFjaCBOYXRpdmUgSmF2YVNjcmlwdCBTdHJpbmcgUHJvcGVydGllc1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgdmFyIG5hdGl2ZVByb3BlcnRpZXMgPSBnZXROYXRpdmVTdHJpbmdQcm9wZXJ0aWVzKCk7XG4gIGZvciAodmFyIG5hbWUgaW4gbmF0aXZlUHJvcGVydGllcykge1xuICAgIChmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgc3RyaW5nUHJvcCA9IF9fbnNwW25hbWVdO1xuICAgICAgaWYgKHR5cGVvZiBzdHJpbmdQcm9wID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhzdHJpbmdQcm9wKVxuICAgICAgICBpZiAoIV9fc3BbbmFtZV0pIHtcbiAgICAgICAgICBpZiAobmF0aXZlUHJvcGVydGllc1tuYW1lXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIF9fc3BbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhuYW1lKVxuICAgICAgICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Ioc3RyaW5nUHJvcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX19zcFtuYW1lXSA9IHN0cmluZ1Byb3A7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkobmFtZSk7XG4gIH1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuLyogRnVuY3Rpb24gQWxpYXNlc1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgX19zcC5yZXBlYXQgPSBfX3NwLnRpbWVzO1xuICBfX3NwLmluY2x1ZGUgPSBfX3NwLmNvbnRhaW5zO1xuICBfX3NwLnRvSW50ZWdlciA9IF9fc3AudG9JbnQ7XG4gIF9fc3AudG9Cb29sID0gX19zcC50b0Jvb2xlYW47XG4gIF9fc3AuZGVjb2RlSFRNTEVudGl0aWVzID0gX19zcC5kZWNvZGVIdG1sRW50aXRpZXMgLy9lbnN1cmUgY29uc2lzdGVudCBjYXNpbmcgc2NoZW1lIG9mICdIVE1MJ1xuXG5cbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4vLyBTZXQgdGhlIGNvbnN0cnVjdG9yLiAgV2l0aG91dCB0aGlzLCBzdHJpbmcuanMgb2JqZWN0cyBhcmUgaW5zdGFuY2VzIG9mXG4vLyBPYmplY3QgaW5zdGVhZCBvZiBTLlxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblxuICBfX3NwLmNvbnN0cnVjdG9yID0gUztcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuLyogUHJpdmF0ZSBGdW5jdGlvbnNcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gIGZ1bmN0aW9uIGdldE5hdGl2ZVN0cmluZ1Byb3BlcnRpZXMoKSB7XG4gICAgdmFyIG5hbWVzID0gZ2V0TmF0aXZlU3RyaW5nUHJvcGVydHlOYW1lcygpO1xuICAgIHZhciByZXRPYmogPSB7fTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBuYW1lID0gbmFtZXNbaV07XG4gICAgICBpZiAobmFtZSA9PT0gJ3RvJyB8fCBuYW1lID09PSAndG9FbmQnKSBjb250aW51ZTsgICAgICAgLy8gZ2V0IHJpZCBvZiB0aGUgc2hlbGxqcyBwcm90b3R5cGUgbWVzc3VwXG4gICAgICB2YXIgZnVuYyA9IF9fbnNwW25hbWVdO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgZnVuYy5hcHBseSgndGVzdHN0cmluZycpO1xuICAgICAgICByZXRPYmpbbmFtZV0gPSB0eXBlO1xuICAgICAgfSBjYXRjaCAoZSkge31cbiAgICB9XG4gICAgcmV0dXJuIHJldE9iajtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE5hdGl2ZVN0cmluZ1Byb3BlcnR5TmFtZXMoKSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMpIHtcbiAgICAgIHJlc3VsdHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhfX25zcCk7XG4gICAgICByZXN1bHRzLnNwbGljZShyZXN1bHRzLmluZGV4T2YoJ3ZhbHVlT2YnKSwgMSk7XG4gICAgICByZXN1bHRzLnNwbGljZShyZXN1bHRzLmluZGV4T2YoJ3RvU3RyaW5nJyksIDEpO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfSBlbHNlIHsgLy9tZWFudCBmb3IgbGVnYWN5IGNydWZ0LCB0aGlzIGNvdWxkIHByb2JhYmx5IGJlIG1hZGUgbW9yZSBlZmZpY2llbnRcbiAgICAgIHZhciBzdHJpbmdOYW1lcyA9IHt9O1xuICAgICAgdmFyIG9iamVjdE5hbWVzID0gW107XG4gICAgICBmb3IgKHZhciBuYW1lIGluIFN0cmluZy5wcm90b3R5cGUpXG4gICAgICAgIHN0cmluZ05hbWVzW25hbWVdID0gbmFtZTtcblxuICAgICAgZm9yICh2YXIgbmFtZSBpbiBPYmplY3QucHJvdG90eXBlKVxuICAgICAgICBkZWxldGUgc3RyaW5nTmFtZXNbbmFtZV07XG5cbiAgICAgIC8vc3RyaW5nTmFtZXNbJ3RvU3RyaW5nJ10gPSAndG9TdHJpbmcnOyAvL3RoaXMgd2FzIGRlbGV0ZWQgd2l0aCB0aGUgcmVzdCBvZiB0aGUgb2JqZWN0IG5hbWVzXG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN0cmluZ05hbWVzKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChuYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEV4cG9ydChzdHIpIHtcbiAgICByZXR1cm4gbmV3IFMoc3RyKTtcbiAgfTtcblxuICAvL2F0dGFjaCBleHBvcnRzIHRvIFN0cmluZ0pTV3JhcHBlclxuICBFeHBvcnQuZXh0ZW5kUHJvdG90eXBlID0gZXh0ZW5kUHJvdG90eXBlO1xuICBFeHBvcnQucmVzdG9yZVByb3RvdHlwZSA9IHJlc3RvcmVQcm90b3R5cGU7XG4gIEV4cG9ydC5WRVJTSU9OID0gVkVSU0lPTjtcbiAgRXhwb3J0LlRNUExfT1BFTiA9ICd7eyc7XG4gIEV4cG9ydC5UTVBMX0NMT1NFID0gJ319JztcbiAgRXhwb3J0LkVOVElUSUVTID0gRU5USVRJRVM7XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuLyogRXhwb3J0c1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBFeHBvcnQ7XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gRXhwb3J0O1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5TID0gRXhwb3J0O1xuICAgIH1cbiAgfVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4vKiAzcmQgUGFydHkgUHJpdmF0ZSBGdW5jdGlvbnNcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gIC8vZnJvbSBzdWdhci5qc1xuICBmdW5jdGlvbiBtdWx0aUFyZ3MoYXJncywgZm4pIHtcbiAgICB2YXIgcmVzdWx0ID0gW10sIGk7XG4gICAgZm9yKGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0LnB1c2goYXJnc1tpXSk7XG4gICAgICBpZihmbikgZm4uY2FsbChhcmdzLCBhcmdzW2ldLCBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vZnJvbSB1bmRlcnNjb3JlLnN0cmluZ1xuICB2YXIgZXNjYXBlQ2hhcnMgPSB7XG4gICAgbHQ6ICc8JyxcbiAgICBndDogJz4nLFxuICAgIHF1b3Q6ICdcIicsXG4gICAgYXBvczogXCInXCIsXG4gICAgYW1wOiAnJidcbiAgfTtcblxuICBmdW5jdGlvbiBlc2NhcGVSZWdFeHAgKHMpIHtcbiAgICAvLyBtb3N0IHBhcnQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vc2t1bHB0L3NrdWxwdC9ibG9iL2VjYWY3NWU2OWMyZTUzOWVmZjEyNGIyYWI0NWRmMGIwMWVhZjIyOTUvc3JjL3N0ci5qcyNMMjQyXG4gICAgdmFyIGM7XG4gICAgdmFyIGk7XG4gICAgdmFyIHJldCA9IFtdO1xuICAgIHZhciByZSA9IC9eW0EtWmEtejAtOV0rJC87XG4gICAgcyA9IGVuc3VyZVN0cmluZyhzKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcy5sZW5ndGg7ICsraSkge1xuICAgICAgYyA9IHMuY2hhckF0KGkpO1xuXG4gICAgICBpZiAocmUudGVzdChjKSkge1xuICAgICAgICByZXQucHVzaChjKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBpZiAoYyA9PT0gXCJcXFxcMDAwXCIpIHtcbiAgICAgICAgICByZXQucHVzaChcIlxcXFwwMDBcIik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmV0LnB1c2goXCJcXFxcXCIgKyBjKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmV0LmpvaW4oXCJcIik7XG4gIH1cblxuICBmdW5jdGlvbiBlbnN1cmVTdHJpbmcoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgfVxuXG4gIC8vZnJvbSB1bmRlcnNjb3JlLnN0cmluZ1xuICB2YXIgcmV2ZXJzZWRFc2NhcGVDaGFycyA9IHt9O1xuICBmb3IodmFyIGtleSBpbiBlc2NhcGVDaGFycyl7IHJldmVyc2VkRXNjYXBlQ2hhcnNbZXNjYXBlQ2hhcnNba2V5XV0gPSBrZXk7IH1cblxuICBFTlRJVElFUyA9IHtcbiAgICBcImFtcFwiIDogXCImXCIsXG4gICAgXCJndFwiIDogXCI+XCIsXG4gICAgXCJsdFwiIDogXCI8XCIsXG4gICAgXCJxdW90XCIgOiBcIlxcXCJcIixcbiAgICBcImFwb3NcIiA6IFwiJ1wiLFxuICAgIFwiQUVsaWdcIiA6IDE5OCxcbiAgICBcIkFhY3V0ZVwiIDogMTkzLFxuICAgIFwiQWNpcmNcIiA6IDE5NCxcbiAgICBcIkFncmF2ZVwiIDogMTkyLFxuICAgIFwiQXJpbmdcIiA6IDE5NyxcbiAgICBcIkF0aWxkZVwiIDogMTk1LFxuICAgIFwiQXVtbFwiIDogMTk2LFxuICAgIFwiQ2NlZGlsXCIgOiAxOTksXG4gICAgXCJFVEhcIiA6IDIwOCxcbiAgICBcIkVhY3V0ZVwiIDogMjAxLFxuICAgIFwiRWNpcmNcIiA6IDIwMixcbiAgICBcIkVncmF2ZVwiIDogMjAwLFxuICAgIFwiRXVtbFwiIDogMjAzLFxuICAgIFwiSWFjdXRlXCIgOiAyMDUsXG4gICAgXCJJY2lyY1wiIDogMjA2LFxuICAgIFwiSWdyYXZlXCIgOiAyMDQsXG4gICAgXCJJdW1sXCIgOiAyMDcsXG4gICAgXCJOdGlsZGVcIiA6IDIwOSxcbiAgICBcIk9hY3V0ZVwiIDogMjExLFxuICAgIFwiT2NpcmNcIiA6IDIxMixcbiAgICBcIk9ncmF2ZVwiIDogMjEwLFxuICAgIFwiT3NsYXNoXCIgOiAyMTYsXG4gICAgXCJPdGlsZGVcIiA6IDIxMyxcbiAgICBcIk91bWxcIiA6IDIxNCxcbiAgICBcIlRIT1JOXCIgOiAyMjIsXG4gICAgXCJVYWN1dGVcIiA6IDIxOCxcbiAgICBcIlVjaXJjXCIgOiAyMTksXG4gICAgXCJVZ3JhdmVcIiA6IDIxNyxcbiAgICBcIlV1bWxcIiA6IDIyMCxcbiAgICBcIllhY3V0ZVwiIDogMjIxLFxuICAgIFwiYWFjdXRlXCIgOiAyMjUsXG4gICAgXCJhY2lyY1wiIDogMjI2LFxuICAgIFwiYWVsaWdcIiA6IDIzMCxcbiAgICBcImFncmF2ZVwiIDogMjI0LFxuICAgIFwiYXJpbmdcIiA6IDIyOSxcbiAgICBcImF0aWxkZVwiIDogMjI3LFxuICAgIFwiYXVtbFwiIDogMjI4LFxuICAgIFwiY2NlZGlsXCIgOiAyMzEsXG4gICAgXCJlYWN1dGVcIiA6IDIzMyxcbiAgICBcImVjaXJjXCIgOiAyMzQsXG4gICAgXCJlZ3JhdmVcIiA6IDIzMixcbiAgICBcImV0aFwiIDogMjQwLFxuICAgIFwiZXVtbFwiIDogMjM1LFxuICAgIFwiaWFjdXRlXCIgOiAyMzcsXG4gICAgXCJpY2lyY1wiIDogMjM4LFxuICAgIFwiaWdyYXZlXCIgOiAyMzYsXG4gICAgXCJpdW1sXCIgOiAyMzksXG4gICAgXCJudGlsZGVcIiA6IDI0MSxcbiAgICBcIm9hY3V0ZVwiIDogMjQzLFxuICAgIFwib2NpcmNcIiA6IDI0NCxcbiAgICBcIm9ncmF2ZVwiIDogMjQyLFxuICAgIFwib3NsYXNoXCIgOiAyNDgsXG4gICAgXCJvdGlsZGVcIiA6IDI0NSxcbiAgICBcIm91bWxcIiA6IDI0NixcbiAgICBcInN6bGlnXCIgOiAyMjMsXG4gICAgXCJ0aG9yblwiIDogMjU0LFxuICAgIFwidWFjdXRlXCIgOiAyNTAsXG4gICAgXCJ1Y2lyY1wiIDogMjUxLFxuICAgIFwidWdyYXZlXCIgOiAyNDksXG4gICAgXCJ1dW1sXCIgOiAyNTIsXG4gICAgXCJ5YWN1dGVcIiA6IDI1MyxcbiAgICBcInl1bWxcIiA6IDI1NSxcbiAgICBcImNvcHlcIiA6IDE2OSxcbiAgICBcInJlZ1wiIDogMTc0LFxuICAgIFwibmJzcFwiIDogMTYwLFxuICAgIFwiaWV4Y2xcIiA6IDE2MSxcbiAgICBcImNlbnRcIiA6IDE2MixcbiAgICBcInBvdW5kXCIgOiAxNjMsXG4gICAgXCJjdXJyZW5cIiA6IDE2NCxcbiAgICBcInllblwiIDogMTY1LFxuICAgIFwiYnJ2YmFyXCIgOiAxNjYsXG4gICAgXCJzZWN0XCIgOiAxNjcsXG4gICAgXCJ1bWxcIiA6IDE2OCxcbiAgICBcIm9yZGZcIiA6IDE3MCxcbiAgICBcImxhcXVvXCIgOiAxNzEsXG4gICAgXCJub3RcIiA6IDE3MixcbiAgICBcInNoeVwiIDogMTczLFxuICAgIFwibWFjclwiIDogMTc1LFxuICAgIFwiZGVnXCIgOiAxNzYsXG4gICAgXCJwbHVzbW5cIiA6IDE3NyxcbiAgICBcInN1cDFcIiA6IDE4NSxcbiAgICBcInN1cDJcIiA6IDE3OCxcbiAgICBcInN1cDNcIiA6IDE3OSxcbiAgICBcImFjdXRlXCIgOiAxODAsXG4gICAgXCJtaWNyb1wiIDogMTgxLFxuICAgIFwicGFyYVwiIDogMTgyLFxuICAgIFwibWlkZG90XCIgOiAxODMsXG4gICAgXCJjZWRpbFwiIDogMTg0LFxuICAgIFwib3JkbVwiIDogMTg2LFxuICAgIFwicmFxdW9cIiA6IDE4NyxcbiAgICBcImZyYWMxNFwiIDogMTg4LFxuICAgIFwiZnJhYzEyXCIgOiAxODksXG4gICAgXCJmcmFjMzRcIiA6IDE5MCxcbiAgICBcImlxdWVzdFwiIDogMTkxLFxuICAgIFwidGltZXNcIiA6IDIxNSxcbiAgICBcImRpdmlkZVwiIDogMjQ3LFxuICAgIFwiT0VsaWc7XCIgOiAzMzgsXG4gICAgXCJvZWxpZztcIiA6IDMzOSxcbiAgICBcIlNjYXJvbjtcIiA6IDM1MixcbiAgICBcInNjYXJvbjtcIiA6IDM1MyxcbiAgICBcIll1bWw7XCIgOiAzNzYsXG4gICAgXCJmbm9mO1wiIDogNDAyLFxuICAgIFwiY2lyYztcIiA6IDcxMCxcbiAgICBcInRpbGRlO1wiIDogNzMyLFxuICAgIFwiQWxwaGE7XCIgOiA5MTMsXG4gICAgXCJCZXRhO1wiIDogOTE0LFxuICAgIFwiR2FtbWE7XCIgOiA5MTUsXG4gICAgXCJEZWx0YTtcIiA6IDkxNixcbiAgICBcIkVwc2lsb247XCIgOiA5MTcsXG4gICAgXCJaZXRhO1wiIDogOTE4LFxuICAgIFwiRXRhO1wiIDogOTE5LFxuICAgIFwiVGhldGE7XCIgOiA5MjAsXG4gICAgXCJJb3RhO1wiIDogOTIxLFxuICAgIFwiS2FwcGE7XCIgOiA5MjIsXG4gICAgXCJMYW1iZGE7XCIgOiA5MjMsXG4gICAgXCJNdTtcIiA6IDkyNCxcbiAgICBcIk51O1wiIDogOTI1LFxuICAgIFwiWGk7XCIgOiA5MjYsXG4gICAgXCJPbWljcm9uO1wiIDogOTI3LFxuICAgIFwiUGk7XCIgOiA5MjgsXG4gICAgXCJSaG87XCIgOiA5MjksXG4gICAgXCJTaWdtYTtcIiA6IDkzMSxcbiAgICBcIlRhdTtcIiA6IDkzMixcbiAgICBcIlVwc2lsb247XCIgOiA5MzMsXG4gICAgXCJQaGk7XCIgOiA5MzQsXG4gICAgXCJDaGk7XCIgOiA5MzUsXG4gICAgXCJQc2k7XCIgOiA5MzYsXG4gICAgXCJPbWVnYTtcIiA6IDkzNyxcbiAgICBcImFscGhhO1wiIDogOTQ1LFxuICAgIFwiYmV0YTtcIiA6IDk0NixcbiAgICBcImdhbW1hO1wiIDogOTQ3LFxuICAgIFwiZGVsdGE7XCIgOiA5NDgsXG4gICAgXCJlcHNpbG9uO1wiIDogOTQ5LFxuICAgIFwiemV0YTtcIiA6IDk1MCxcbiAgICBcImV0YTtcIiA6IDk1MSxcbiAgICBcInRoZXRhO1wiIDogOTUyLFxuICAgIFwiaW90YTtcIiA6IDk1MyxcbiAgICBcImthcHBhO1wiIDogOTU0LFxuICAgIFwibGFtYmRhO1wiIDogOTU1LFxuICAgIFwibXU7XCIgOiA5NTYsXG4gICAgXCJudTtcIiA6IDk1NyxcbiAgICBcInhpO1wiIDogOTU4LFxuICAgIFwib21pY3JvbjtcIiA6IDk1OSxcbiAgICBcInBpO1wiIDogOTYwLFxuICAgIFwicmhvO1wiIDogOTYxLFxuICAgIFwic2lnbWFmO1wiIDogOTYyLFxuICAgIFwic2lnbWE7XCIgOiA5NjMsXG4gICAgXCJ0YXU7XCIgOiA5NjQsXG4gICAgXCJ1cHNpbG9uO1wiIDogOTY1LFxuICAgIFwicGhpO1wiIDogOTY2LFxuICAgIFwiY2hpO1wiIDogOTY3LFxuICAgIFwicHNpO1wiIDogOTY4LFxuICAgIFwib21lZ2E7XCIgOiA5NjksXG4gICAgXCJ0aGV0YXN5bTtcIiA6IDk3NyxcbiAgICBcInVwc2loO1wiIDogOTc4LFxuICAgIFwicGl2O1wiIDogOTgyLFxuICAgIFwiZW5zcDtcIiA6IDgxOTQsXG4gICAgXCJlbXNwO1wiIDogODE5NSxcbiAgICBcInRoaW5zcDtcIiA6IDgyMDEsXG4gICAgXCJ6d25qO1wiIDogODIwNCxcbiAgICBcInp3ajtcIiA6IDgyMDUsXG4gICAgXCJscm07XCIgOiA4MjA2LFxuICAgIFwicmxtO1wiIDogODIwNyxcbiAgICBcIm5kYXNoO1wiIDogODIxMSxcbiAgICBcIm1kYXNoO1wiIDogODIxMixcbiAgICBcImxzcXVvO1wiIDogODIxNixcbiAgICBcInJzcXVvO1wiIDogODIxNyxcbiAgICBcInNicXVvO1wiIDogODIxOCxcbiAgICBcImxkcXVvO1wiIDogODIyMCxcbiAgICBcInJkcXVvO1wiIDogODIyMSxcbiAgICBcImJkcXVvO1wiIDogODIyMixcbiAgICBcImRhZ2dlcjtcIiA6IDgyMjQsXG4gICAgXCJEYWdnZXI7XCIgOiA4MjI1LFxuICAgIFwiYnVsbDtcIiA6IDgyMjYsXG4gICAgXCJoZWxsaXA7XCIgOiA4MjMwLFxuICAgIFwicGVybWlsO1wiIDogODI0MCxcbiAgICBcInByaW1lO1wiIDogODI0MixcbiAgICBcIlByaW1lO1wiIDogODI0MyxcbiAgICBcImxzYXF1bztcIiA6IDgyNDksXG4gICAgXCJyc2FxdW87XCIgOiA4MjUwLFxuICAgIFwib2xpbmU7XCIgOiA4MjU0LFxuICAgIFwiZnJhc2w7XCIgOiA4MjYwLFxuICAgIFwiZXVybztcIiA6IDgzNjQsXG4gICAgXCJpbWFnZTtcIiA6IDg0NjUsXG4gICAgXCJ3ZWllcnA7XCIgOiA4NDcyLFxuICAgIFwicmVhbDtcIiA6IDg0NzYsXG4gICAgXCJ0cmFkZTtcIiA6IDg0ODIsXG4gICAgXCJhbGVmc3ltO1wiIDogODUwMSxcbiAgICBcImxhcnI7XCIgOiA4NTkyLFxuICAgIFwidWFycjtcIiA6IDg1OTMsXG4gICAgXCJyYXJyO1wiIDogODU5NCxcbiAgICBcImRhcnI7XCIgOiA4NTk1LFxuICAgIFwiaGFycjtcIiA6IDg1OTYsXG4gICAgXCJjcmFycjtcIiA6IDg2MjksXG4gICAgXCJsQXJyO1wiIDogODY1NixcbiAgICBcInVBcnI7XCIgOiA4NjU3LFxuICAgIFwickFycjtcIiA6IDg2NTgsXG4gICAgXCJkQXJyO1wiIDogODY1OSxcbiAgICBcImhBcnI7XCIgOiA4NjYwLFxuICAgIFwiZm9yYWxsO1wiIDogODcwNCxcbiAgICBcInBhcnQ7XCIgOiA4NzA2LFxuICAgIFwiZXhpc3Q7XCIgOiA4NzA3LFxuICAgIFwiZW1wdHk7XCIgOiA4NzA5LFxuICAgIFwibmFibGE7XCIgOiA4NzExLFxuICAgIFwiaXNpbjtcIiA6IDg3MTIsXG4gICAgXCJub3RpbjtcIiA6IDg3MTMsXG4gICAgXCJuaTtcIiA6IDg3MTUsXG4gICAgXCJwcm9kO1wiIDogODcxOSxcbiAgICBcInN1bTtcIiA6IDg3MjEsXG4gICAgXCJtaW51cztcIiA6IDg3MjIsXG4gICAgXCJsb3dhc3Q7XCIgOiA4NzI3LFxuICAgIFwicmFkaWM7XCIgOiA4NzMwLFxuICAgIFwicHJvcDtcIiA6IDg3MzMsXG4gICAgXCJpbmZpbjtcIiA6IDg3MzQsXG4gICAgXCJhbmc7XCIgOiA4NzM2LFxuICAgIFwiYW5kO1wiIDogODc0MyxcbiAgICBcIm9yO1wiIDogODc0NCxcbiAgICBcImNhcDtcIiA6IDg3NDUsXG4gICAgXCJjdXA7XCIgOiA4NzQ2LFxuICAgIFwiaW50O1wiIDogODc0NyxcbiAgICBcInRoZXJlNDtcIiA6IDg3NTYsXG4gICAgXCJzaW07XCIgOiA4NzY0LFxuICAgIFwiY29uZztcIiA6IDg3NzMsXG4gICAgXCJhc3ltcDtcIiA6IDg3NzYsXG4gICAgXCJuZTtcIiA6IDg4MDAsXG4gICAgXCJlcXVpdjtcIiA6IDg4MDEsXG4gICAgXCJsZTtcIiA6IDg4MDQsXG4gICAgXCJnZTtcIiA6IDg4MDUsXG4gICAgXCJzdWI7XCIgOiA4ODM0LFxuICAgIFwic3VwO1wiIDogODgzNSxcbiAgICBcIm5zdWI7XCIgOiA4ODM2LFxuICAgIFwic3ViZTtcIiA6IDg4MzgsXG4gICAgXCJzdXBlO1wiIDogODgzOSxcbiAgICBcIm9wbHVzO1wiIDogODg1MyxcbiAgICBcIm90aW1lcztcIiA6IDg4NTUsXG4gICAgXCJwZXJwO1wiIDogODg2OSxcbiAgICBcInNkb3Q7XCIgOiA4OTAxLFxuICAgIFwibGNlaWw7XCIgOiA4OTY4LFxuICAgIFwicmNlaWw7XCIgOiA4OTY5LFxuICAgIFwibGZsb29yO1wiIDogODk3MCxcbiAgICBcInJmbG9vcjtcIiA6IDg5NzEsXG4gICAgXCJsYW5nO1wiIDogOTAwMSxcbiAgICBcInJhbmc7XCIgOiA5MDAyLFxuICAgIFwibG96O1wiIDogOTY3NCxcbiAgICBcInNwYWRlcztcIiA6IDk4MjQsXG4gICAgXCJjbHVicztcIiA6IDk4MjcsXG4gICAgXCJoZWFydHM7XCIgOiA5ODI5LFxuICAgIFwiZGlhbXM7XCIgOiA5ODMwXG4gIH1cblxuXG59KS5jYWxsKHRoaXMpO1xuIiwidmFyIFhDU1NNYXRyaXggPSByZXF1aXJlKCcuL2xpYi9YQ1NTTWF0cml4LmpzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IFhDU1NNYXRyaXg7XG4iLCJ2YXIgdmVjdG9yID0gcmVxdWlyZSgnLi91dGlscy92ZWN0b3InKTtcbm1vZHVsZS5leHBvcnRzID0gVmVjdG9yNDtcblxuLyoqXG4gKiBBIDQgZGltZW5zaW9uYWwgdmVjdG9yXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVmVjdG9yNCh4LCB5LCB6LCB3KSB7XG4gIHRoaXMueCA9IHg7XG4gIHRoaXMueSA9IHk7XG4gIHRoaXMueiA9IHo7XG4gIHRoaXMudyA9IHc7XG4gIHRoaXMuY2hlY2tWYWx1ZXMoKTtcbn1cblxuLyoqXG4gKiBFbnN1cmUgdGhhdCB2YWx1ZXMgYXJlIG5vdCB1bmRlZmluZWRcbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIG51bGxcbiAqL1xuXG5WZWN0b3I0LnByb3RvdHlwZS5jaGVja1ZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnggPSB0aGlzLnggfHwgMDtcbiAgdGhpcy55ID0gdGhpcy55IHx8IDA7XG4gIHRoaXMueiA9IHRoaXMueiB8fCAwO1xuICB0aGlzLncgPSB0aGlzLncgfHwgMDtcbn07XG5cbi8qKlxuICogR2V0IHRoZSBsZW5ndGggb2YgdGhlIHZlY3RvclxuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge2Zsb2F0fVxuICovXG5cblZlY3RvcjQucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmNoZWNrVmFsdWVzKCk7XG4gIHJldHVybiB2ZWN0b3IubGVuZ3RoKHRoaXMpO1xufTtcblxuXG4vKipcbiAqIEdldCBhIG5vcm1hbGlzZWQgcmVwcmVzZW50YXRpb24gb2YgdGhlIHZlY3RvclxuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge1ZlY3RvcjR9XG4gKi9cblxuVmVjdG9yNC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB2ZWN0b3Iubm9ybWFsaXplKHRoaXMpO1xufTtcblxuXG4vKipcbiAqIFZlY3RvciBEb3QtUHJvZHVjdFxuICogQHBhcmFtIHtWZWN0b3I0fSB2IFRoZSBzZWNvbmQgdmVjdG9yIHRvIGFwcGx5IHRoZSBwcm9kdWN0IHRvXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7ZmxvYXR9IFRoZSBEb3QtUHJvZHVjdCBvZiB0aGlzIGFuZCB2LlxuICovXG5cblZlY3RvcjQucHJvdG90eXBlLmRvdCA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIHZlY3Rvci5kb3QodGhpcywgdik7XG59O1xuXG5cbi8qKlxuICogVmVjdG9yIENyb3NzLVByb2R1Y3RcbiAqIEBwYXJhbSB7VmVjdG9yNH0gdiBUaGUgc2Vjb25kIHZlY3RvciB0byBhcHBseSB0aGUgcHJvZHVjdCB0b1xuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge1ZlY3RvcjR9IFRoZSBDcm9zcy1Qcm9kdWN0IG9mIHRoaXMgYW5kIHYuXG4gKi9cblxuVmVjdG9yNC5wcm90b3R5cGUuY3Jvc3MgPSBmdW5jdGlvbih2KSB7XG4gIHJldHVybiB2ZWN0b3IuY3Jvc3ModGhpcywgdik7XG59O1xuXG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHJlcXVpcmVkIGZvciBtYXRyaXggZGVjb21wb3NpdGlvblxuICogQSBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHBzZXVkbyBjb2RlIGF2YWlsYWJsZSBmcm9tIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtMmQtdHJhbnNmb3Jtcy8jbWF0cml4LWRlY29tcG9zaXRpb25cbiAqIEBwYXJhbSB7VmVjdG9yNH0gYVBvaW50IEEgM0QgcG9pbnRcbiAqIEBwYXJhbSB7ZmxvYXR9IGFzY2xcbiAqIEBwYXJhbSB7ZmxvYXR9IGJzY2xcbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIHtWZWN0b3I0fVxuICovXG5cblZlY3RvcjQucHJvdG90eXBlLmNvbWJpbmUgPSBmdW5jdGlvbihiUG9pbnQsIGFzY2wsIGJzY2wpIHtcbiAgcmV0dXJuIHZlY3Rvci5jb21iaW5lKHRoaXMsIGJQb2ludCwgYXNjbCwgYnNjbCk7XG59O1xuXG5WZWN0b3I0LnByb3RvdHlwZS5tdWx0aXBseUJ5TWF0cml4ID0gZnVuY3Rpb24gKG1hdHJpeCkge1xuICByZXR1cm4gdmVjdG9yLm11bHRpcGx5QnlNYXRyaXgodGhpcywgbWF0cml4KTtcbn07XG4iLCJ2YXIgdXRpbHMgPSB7XG4gICAgYW5nbGVzOiByZXF1aXJlKCcuL3V0aWxzL2FuZ2xlJyksXG4gICAgbWF0cml4OiByZXF1aXJlKCcuL3V0aWxzL21hdHJpeCcpLFxuICAgIHRyYW5zcDogcmVxdWlyZSgnLi91dGlscy9jc3NUcmFuc2Zvcm1TdHJpbmcnKSxcbiAgICBmdW5jczoge1xuICAgICAgICAvLyBHaXZlbiBhIGZ1bmN0aW9uIGBmbmAsIHJldHVybiBhIGZ1bmN0aW9uIHdoaWNoIGNhbGxzIGBmbmAgd2l0aCBvbmx5IDFcbiAgICAgICAgLy8gICBhcmd1bWVudCwgbm8gbWF0dGVyIGhvdyBtYW55IGFyZSBnaXZlbi5cbiAgICAgICAgLy8gTW9zdCB1c2VmdWwgd2hlcmUgeW91IG9ubHkgd2FudCB0aGUgZmlyc3QgdmFsdWUgZnJvbSBhIG1hcC9mb3JlYWNoL2V0Y1xuICAgICAgICBvbmx5Rmlyc3RBcmc6IGZ1bmN0aW9uIChmbiwgY29udGV4dCkge1xuICAgICAgICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwgdGhpcztcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmaXJzdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbi5jYWxsKGNvbnRleHQsIGZpcnN0KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbi8qKlxuICogIEdpdmVuIGEgQ1NTIHRyYW5zZm9ybSBzdHJpbmcgKGxpa2UgYHJvdGF0ZSgzcmFkKWAsIG9yXG4gKiAgICBgbWF0cml4KDEsIDAsIDAsIDAsIDEsIDApYCksIHJldHVybiBhbiBpbnN0YW5jZSBjb21wYXRpYmxlIHdpdGhcbiAqICAgIFtgV2ViS2l0Q1NTTWF0cml4YF0oaHR0cDovL2RldmVsb3Blci5hcHBsZS5jb20vbGlicmFyeS9zYWZhcmkvZG9jdW1lbnRhdGlvbi9BdWRpb1ZpZGVvL1JlZmVyZW5jZS9XZWJLaXRDU1NNYXRyaXhDbGFzc1JlZmVyZW5jZS9XZWJLaXRDU1NNYXRyaXgvV2ViS2l0Q1NTTWF0cml4Lmh0bWwpXG4gKiAgQGNvbnN0cnVjdG9yXG4gKiAgQHBhcmFtIHtzdHJpbmd9IGRvbXN0ciAtIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgMkQgb3IgM0QgdHJhbnNmb3JtIG1hdHJpeFxuICogICAgaW4gdGhlIGZvcm0gZ2l2ZW4gYnkgdGhlIENTUyB0cmFuc2Zvcm0gcHJvcGVydHksIGkuZS4ganVzdCBsaWtlIHRoZVxuICogICAgb3V0cHV0IGZyb20gW1tAbGluayN0b1N0cmluZ11dLlxuICogIEBtZW1iZXIge251bWJlcn0gYSAtIFRoZSBmaXJzdCAyRCB2ZWN0b3IgdmFsdWUuXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBiIC0gVGhlIHNlY29uZCAyRCB2ZWN0b3IgdmFsdWUuXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBjIC0gVGhlIHRoaXJkIDJEIHZlY3RvciB2YWx1ZS5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IGQgLSBUaGUgZm91cnRoIDJEIHZlY3RvciB2YWx1ZS5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IGUgLSBUaGUgZmlmdGggMkQgdmVjdG9yIHZhbHVlLlxuICogIEBtZW1iZXIge251bWJlcn0gZiAtIFRoZSBzaXh0aCAyRCB2ZWN0b3IgdmFsdWUuXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMTEgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBmaXJzdCByb3cgYW5kIGZpcnN0IGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0xMiAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIGZpcnN0IHJvdyBhbmQgc2Vjb25kIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0xMyAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIGZpcnN0IHJvdyBhbmQgdGhpcmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTE0IC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZmlyc3Qgcm93IGFuZCBmb3VydGggY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTIxIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgc2Vjb25kIHJvdyBhbmQgZmlyc3QgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTIyIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgc2Vjb25kIHJvdyBhbmQgc2Vjb25kIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0yMyAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIHNlY29uZCByb3cgYW5kIHRoaXJkIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0yNCAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIHNlY29uZCByb3cgYW5kIGZvdXJ0aCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMzEgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSB0aGlyZCByb3cgYW5kIGZpcnN0IGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0zMiAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIHRoaXJkIHJvdyBhbmQgc2Vjb25kIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0zMyAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIHRoaXJkIHJvdyBhbmQgdGhpcmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTM0IC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgdGhpcmQgcm93IGFuZCBmb3VydGggY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTQxIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZm91cnRoIHJvdyBhbmQgZmlyc3QgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTQyIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZm91cnRoIHJvdyBhbmQgc2Vjb25kIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG00MyAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIGZvdXJ0aCByb3cgYW5kIHRoaXJkIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG00NCAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIGZvdXJ0aCByb3cgYW5kIGZvdXJ0aCBjb2x1bW4uXG4gKiAgQHJldHVybnMge1hDU1NNYXRyaXh9IG1hdHJpeFxuICovXG5mdW5jdGlvbiBYQ1NTTWF0cml4KGRvbXN0cikge1xuICAgIHRoaXMubTExID0gdGhpcy5tMjIgPSB0aGlzLm0zMyA9IHRoaXMubTQ0ID0gMTtcblxuICAgICAgICAgICAgICAgdGhpcy5tMTIgPSB0aGlzLm0xMyA9IHRoaXMubTE0ID1cbiAgICB0aGlzLm0yMSA9ICAgICAgICAgICAgdGhpcy5tMjMgPSB0aGlzLm0yNCA9XG4gICAgdGhpcy5tMzEgPSB0aGlzLm0zMiA9ICAgICAgICAgICAgdGhpcy5tMzQgPVxuICAgIHRoaXMubTQxID0gdGhpcy5tNDIgPSB0aGlzLm00MyAgICAgICAgICAgID0gMDtcblxuICAgIGlmICh0eXBlb2YgZG9tc3RyID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLnNldE1hdHJpeFZhbHVlKGRvbXN0cik7XG4gICAgfVxufVxuXG4vKipcbiAqICBYQ1NTTWF0cml4LmRpc3BsYXlOYW1lID0gJ1hDU1NNYXRyaXgnXG4gKi9cblhDU1NNYXRyaXguZGlzcGxheU5hbWUgPSAnWENTU01hdHJpeCc7XG5cbnZhciBwb2ludHMyZCA9IFsnYScsICdiJywgJ2MnLCAnZCcsICdlJywgJ2YnXTtcbnZhciBwb2ludHMzZCA9IFtcbiAgICAnbTExJywgJ20xMicsICdtMTMnLCAnbTE0JyxcbiAgICAnbTIxJywgJ20yMicsICdtMjMnLCAnbTI0JyxcbiAgICAnbTMxJywgJ20zMicsICdtMzMnLCAnbTM0JyxcbiAgICAnbTQxJywgJ200MicsICdtNDMnLCAnbTQ0J1xuXTtcblxuKFtcbiAgICBbJ20xMScsICdhJ10sXG4gICAgWydtMTInLCAnYiddLFxuICAgIFsnbTIxJywgJ2MnXSxcbiAgICBbJ20yMicsICdkJ10sXG4gICAgWydtNDEnLCAnZSddLFxuICAgIFsnbTQyJywgJ2YnXVxuXSkuZm9yRWFjaChmdW5jdGlvbiAocGFpcikge1xuICAgIHZhciBrZXkzZCA9IHBhaXJbMF0sIGtleTJkID0gcGFpclsxXTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShYQ1NTTWF0cml4LnByb3RvdHlwZSwga2V5MmQsIHtcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICB0aGlzW2tleTNkXSA9IHZhbDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2tleTNkXTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZSA6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWVcbiAgICB9KTtcbn0pO1xuXG5cbi8qKlxuICogIE11bHRpcGx5IG9uZSBtYXRyaXggYnkgYW5vdGhlclxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtYQ1NTTWF0cml4fSBvdGhlck1hdHJpeCAtIFRoZSBtYXRyaXggdG8gbXVsdGlwbHkgdGhpcyBvbmUgYnkuXG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLm11bHRpcGx5ID0gZnVuY3Rpb24gKG90aGVyTWF0cml4KSB7XG4gICAgcmV0dXJuIHV0aWxzLm1hdHJpeC5tdWx0aXBseSh0aGlzLCBvdGhlck1hdHJpeCk7XG59O1xuXG4vKipcbiAqICBJZiB0aGUgbWF0cml4IGlzIGludmVydGlibGUsIHJldHVybnMgaXRzIGludmVyc2UsIG90aGVyd2lzZSByZXR1cm5zIG51bGwuXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcmV0dXJucyB7WENTU01hdHJpeHxudWxsfVxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5pbnZlcnNlID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB1dGlscy5tYXRyaXguaW52ZXJzZSh0aGlzKTtcbn07XG5cbi8qKlxuICogIFJldHVybnMgdGhlIHJlc3VsdCBvZiByb3RhdGluZyB0aGUgbWF0cml4IGJ5IGEgZ2l2ZW4gdmVjdG9yLlxuICpcbiAqICBJZiBvbmx5IHRoZSBmaXJzdCBhcmd1bWVudCBpcyBwcm92aWRlZCwgdGhlIG1hdHJpeCBpcyBvbmx5IHJvdGF0ZWQgYWJvdXRcbiAqICB0aGUgeiBheGlzLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHJvdFggLSBUaGUgcm90YXRpb24gYXJvdW5kIHRoZSB4IGF4aXMuXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHJvdFkgLSBUaGUgcm90YXRpb24gYXJvdW5kIHRoZSB5IGF4aXMuIElmIHVuZGVmaW5lZCwgdGhlIHggY29tcG9uZW50IGlzIHVzZWQuXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHJvdFogLSBUaGUgcm90YXRpb24gYXJvdW5kIHRoZSB6IGF4aXMuIElmIHVuZGVmaW5lZCwgdGhlIHggY29tcG9uZW50IGlzIHVzZWQuXG4gKiAgQHJldHVybnMgWENTU01hdHJpeFxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5yb3RhdGUgPSBmdW5jdGlvbiAocngsIHJ5LCByeikge1xuXG4gICAgaWYgKHR5cGVvZiByeCAhPT0gJ251bWJlcicgfHwgaXNOYU4ocngpKSByeCA9IDA7XG5cbiAgICBpZiAoKHR5cGVvZiByeSAhPT0gJ251bWJlcicgfHwgaXNOYU4ocnkpKSAmJlxuICAgICAgICAodHlwZW9mIHJ6ICE9PSAnbnVtYmVyJyB8fCBpc05hTihyeikpKSB7XG4gICAgICAgIHJ6ID0gcng7XG4gICAgICAgIHJ4ID0gMDtcbiAgICAgICAgcnkgPSAwO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgcnkgIT09ICdudW1iZXInIHx8IGlzTmFOKHJ5KSkgcnkgPSAwO1xuICAgIGlmICh0eXBlb2YgcnogIT09ICdudW1iZXInIHx8IGlzTmFOKHJ6KSkgcnogPSAwO1xuXG4gICAgcnggPSB1dGlscy5hbmdsZXMuZGVnMnJhZChyeCk7XG4gICAgcnkgPSB1dGlscy5hbmdsZXMuZGVnMnJhZChyeSk7XG4gICAgcnogPSB1dGlscy5hbmdsZXMuZGVnMnJhZChyeik7XG5cbiAgICB2YXIgdHggPSBuZXcgWENTU01hdHJpeCgpLFxuICAgICAgICB0eSA9IG5ldyBYQ1NTTWF0cml4KCksXG4gICAgICAgIHR6ID0gbmV3IFhDU1NNYXRyaXgoKSxcbiAgICAgICAgc2luQSwgY29zQSwgc3E7XG5cbiAgICByeiAvPSAyO1xuICAgIHNpbkEgID0gTWF0aC5zaW4ocnopO1xuICAgIGNvc0EgID0gTWF0aC5jb3MocnopO1xuICAgIHNxID0gc2luQSAqIHNpbkE7XG5cbiAgICAvLyBNYXRyaWNlcyBhcmUgaWRlbnRpdHkgb3V0c2lkZSB0aGUgYXNzaWduZWQgdmFsdWVzXG4gICAgdHoubTExID0gdHoubTIyID0gMSAtIDIgKiBzcTtcbiAgICB0ei5tMTIgPSB0ei5tMjEgPSAyICogc2luQSAqIGNvc0E7XG4gICAgdHoubTIxICo9IC0xO1xuXG4gICAgcnkgLz0gMjtcbiAgICBzaW5BICA9IE1hdGguc2luKHJ5KTtcbiAgICBjb3NBICA9IE1hdGguY29zKHJ5KTtcbiAgICBzcSA9IHNpbkEgKiBzaW5BO1xuXG4gICAgdHkubTExID0gdHkubTMzID0gMSAtIDIgKiBzcTtcbiAgICB0eS5tMTMgPSB0eS5tMzEgPSAyICogc2luQSAqIGNvc0E7XG4gICAgdHkubTEzICo9IC0xO1xuXG4gICAgcnggLz0gMjtcbiAgICBzaW5BID0gTWF0aC5zaW4ocngpO1xuICAgIGNvc0EgPSBNYXRoLmNvcyhyeCk7XG4gICAgc3EgPSBzaW5BICogc2luQTtcblxuICAgIHR4Lm0yMiA9IHR4Lm0zMyA9IDEgLSAyICogc3E7XG4gICAgdHgubTIzID0gdHgubTMyID0gMiAqIHNpbkEgKiBjb3NBO1xuICAgIHR4Lm0zMiAqPSAtMTtcblxuICAgIHZhciBpZGVudGl0eU1hdHJpeCA9IG5ldyBYQ1NTTWF0cml4KCk7IC8vIHJldHVybnMgaWRlbnRpdHkgbWF0cml4IGJ5IGRlZmF1bHRcbiAgICB2YXIgaXNJZGVudGl0eSAgICAgPSB0aGlzLnRvU3RyaW5nKCkgPT09IGlkZW50aXR5TWF0cml4LnRvU3RyaW5nKCk7XG4gICAgdmFyIHJvdGF0ZWRNYXRyaXggID0gaXNJZGVudGl0eSA/XG4gICAgICAgICAgICB0ei5tdWx0aXBseSh0eSkubXVsdGlwbHkodHgpIDpcbiAgICAgICAgICAgIHRoaXMubXVsdGlwbHkodHgpLm11bHRpcGx5KHR5KS5tdWx0aXBseSh0eik7XG5cbiAgICByZXR1cm4gcm90YXRlZE1hdHJpeDtcbn07XG5cbi8qKlxuICogIFJldHVybnMgdGhlIHJlc3VsdCBvZiByb3RhdGluZyB0aGUgbWF0cml4IGFyb3VuZCBhIGdpdmVuIHZlY3RvciBieSBhIGdpdmVuXG4gKiAgYW5nbGUuXG4gKlxuICogIElmIHRoZSBnaXZlbiB2ZWN0b3IgaXMgdGhlIG9yaWdpbiB2ZWN0b3IgdGhlbiB0aGUgbWF0cml4IGlzIHJvdGF0ZWQgYnkgdGhlXG4gKiAgZ2l2ZW4gYW5nbGUgYXJvdW5kIHRoZSB6IGF4aXMuXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcGFyYW0ge251bWJlcn0gcm90WCAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHggYXhpcy5cbiAqICBAcGFyYW0ge251bWJlcn0gcm90WSAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHkgYXhpcy4gSWYgdW5kZWZpbmVkLCB0aGUgeCBjb21wb25lbnQgaXMgdXNlZC5cbiAqICBAcGFyYW0ge251bWJlcn0gcm90WiAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHogYXhpcy4gSWYgdW5kZWZpbmVkLCB0aGUgeCBjb21wb25lbnQgaXMgdXNlZC5cbiAqICBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBUaGUgYW5nbGUgb2Ygcm90YXRpb24gYWJvdXQgdGhlIGF4aXMgdmVjdG9yLCBpbiBkZWdyZWVzLlxuICogIEByZXR1cm5zIFhDU1NNYXRyaXhcbiAqL1xuWENTU01hdHJpeC5wcm90b3R5cGUucm90YXRlQXhpc0FuZ2xlID0gZnVuY3Rpb24gKHgsIHksIHosIGEpIHtcbiAgICBpZiAodHlwZW9mIHggIT09ICdudW1iZXInIHx8IGlzTmFOKHgpKSB4ID0gMDtcbiAgICBpZiAodHlwZW9mIHkgIT09ICdudW1iZXInIHx8IGlzTmFOKHkpKSB5ID0gMDtcbiAgICBpZiAodHlwZW9mIHogIT09ICdudW1iZXInIHx8IGlzTmFOKHopKSB6ID0gMDtcbiAgICBpZiAodHlwZW9mIGEgIT09ICdudW1iZXInIHx8IGlzTmFOKGEpKSBhID0gMDtcbiAgICBpZiAoeCA9PT0gMCAmJiB5ID09PSAwICYmIHogPT09IDApIHogPSAxO1xuICAgIGEgPSAodXRpbHMuYW5nbGVzLmRlZzJyYWQoYSkgfHwgMCkgLyAyO1xuICAgIHZhciB0ICAgICAgICAgPSBuZXcgWENTU01hdHJpeCgpLFxuICAgICAgICBsZW4gICAgICAgPSBNYXRoLnNxcnQoeCAqIHggKyB5ICogeSArIHogKiB6KSxcbiAgICAgICAgY29zQSAgICAgID0gTWF0aC5jb3MoYSksXG4gICAgICAgIHNpbkEgICAgICA9IE1hdGguc2luKGEpLFxuICAgICAgICBzcSAgICAgICAgPSBzaW5BICogc2luQSxcbiAgICAgICAgc2MgICAgICAgID0gc2luQSAqIGNvc0EsXG4gICAgICAgIHByZWNpc2lvbiA9IGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHBhcnNlRmxvYXQoKHYpLnRvRml4ZWQoNikpOyB9LFxuICAgICAgICB4MiwgeTIsIHoyO1xuXG4gICAgLy8gQmFkIHZlY3RvciwgdXNlIHNvbWV0aGluZyBzZW5zaWJsZVxuICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgeCA9IDA7XG4gICAgICAgIHkgPSAwO1xuICAgICAgICB6ID0gMTtcbiAgICB9IGVsc2UgaWYgKGxlbiAhPT0gMSkge1xuICAgICAgICB4IC89IGxlbjtcbiAgICAgICAgeSAvPSBsZW47XG4gICAgICAgIHogLz0gbGVuO1xuICAgIH1cblxuICAgIC8vIE9wdGltaXNlIGNhc2VzIHdoZXJlIGF4aXMgaXMgYWxvbmcgbWFqb3IgYXhpc1xuICAgIGlmICh4ID09PSAxICYmIHkgPT09IDAgJiYgeiA9PT0gMCkge1xuICAgICAgICB0Lm0yMiA9IHQubTMzID0gMSAtIDIgKiBzcTtcbiAgICAgICAgdC5tMjMgPSB0Lm0zMiA9IDIgKiBzYztcbiAgICAgICAgdC5tMzIgKj0gLTE7XG4gICAgfSBlbHNlIGlmICh4ID09PSAwICYmIHkgPT09IDEgJiYgeiA9PT0gMCkge1xuICAgICAgICB0Lm0xMSA9IHQubTMzID0gMSAtIDIgKiBzcTtcbiAgICAgICAgdC5tMTMgPSB0Lm0zMSA9IDIgKiBzYztcbiAgICAgICAgdC5tMTMgKj0gLTE7XG4gICAgfSBlbHNlIGlmICh4ID09PSAwICYmIHkgPT09IDAgJiYgeiA9PT0gMSkge1xuICAgICAgICB0Lm0xMSA9IHQubTIyID0gMSAtIDIgKiBzcTtcbiAgICAgICAgdC5tMTIgPSB0Lm0yMSA9IDIgKiBzYztcbiAgICAgICAgdC5tMjEgKj0gLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgeDIgID0geCAqIHg7XG4gICAgICAgIHkyICA9IHkgKiB5O1xuICAgICAgICB6MiAgPSB6ICogejtcbiAgICAgICAgLy8gaHR0cDovL2Rldi53My5vcmcvY3Nzd2cvY3NzLXRyYW5zZm9ybXMvI21hdGhlbWF0aWNhbC1kZXNjcmlwdGlvblxuICAgICAgICB0Lm0xMSA9IHByZWNpc2lvbigxIC0gMiAqICh5MiArIHoyKSAqIHNxKTtcbiAgICAgICAgdC5tMTIgPSBwcmVjaXNpb24oMiAqICh4ICogeSAqIHNxICsgeiAqIHNjKSk7XG4gICAgICAgIHQubTEzID0gcHJlY2lzaW9uKDIgKiAoeCAqIHogKiBzcSAtIHkgKiBzYykpO1xuICAgICAgICB0Lm0yMSA9IHByZWNpc2lvbigyICogKHggKiB5ICogc3EgLSB6ICogc2MpKTtcbiAgICAgICAgdC5tMjIgPSBwcmVjaXNpb24oMSAtIDIgKiAoeDIgKyB6MikgKiBzcSk7XG4gICAgICAgIHQubTIzID0gcHJlY2lzaW9uKDIgKiAoeSAqIHogKiBzcSArIHggKiBzYykpO1xuICAgICAgICB0Lm0zMSA9IHByZWNpc2lvbigyICogKHggKiB6ICogc3EgKyB5ICogc2MpKTtcbiAgICAgICAgdC5tMzIgPSBwcmVjaXNpb24oMiAqICh5ICogeiAqIHNxIC0geCAqIHNjKSk7XG4gICAgICAgIHQubTMzID0gcHJlY2lzaW9uKDEgLSAyICogKHgyICsgeTIpICogc3EpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm11bHRpcGx5KHQpO1xufTtcblxuLyoqXG4gKiAgUmV0dXJucyB0aGUgcmVzdWx0IG9mIHNjYWxpbmcgdGhlIG1hdHJpeCBieSBhIGdpdmVuIHZlY3Rvci5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlclxuICogIEBwYXJhbSB7bnVtYmVyfSBzY2FsZVggLSB0aGUgc2NhbGluZyBmYWN0b3IgaW4gdGhlIHggYXhpcy5cbiAqICBAcGFyYW0ge251bWJlcn0gc2NhbGVZIC0gdGhlIHNjYWxpbmcgZmFjdG9yIGluIHRoZSB5IGF4aXMuIElmIHVuZGVmaW5lZCwgdGhlIHggY29tcG9uZW50IGlzIHVzZWQuXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHNjYWxlWiAtIHRoZSBzY2FsaW5nIGZhY3RvciBpbiB0aGUgeiBheGlzLiBJZiB1bmRlZmluZWQsIDEgaXMgdXNlZC5cbiAqICBAcmV0dXJucyBYQ1NTTWF0cml4XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24gKHNjYWxlWCwgc2NhbGVZLCBzY2FsZVopIHtcbiAgICB2YXIgdHJhbnNmb3JtID0gbmV3IFhDU1NNYXRyaXgoKTtcblxuICAgIGlmICh0eXBlb2Ygc2NhbGVYICE9PSAnbnVtYmVyJyB8fCBpc05hTihzY2FsZVgpKSBzY2FsZVggPSAxO1xuICAgIGlmICh0eXBlb2Ygc2NhbGVZICE9PSAnbnVtYmVyJyB8fCBpc05hTihzY2FsZVkpKSBzY2FsZVkgPSBzY2FsZVg7XG4gICAgaWYgKHR5cGVvZiBzY2FsZVogIT09ICdudW1iZXInIHx8IGlzTmFOKHNjYWxlWikpIHNjYWxlWiA9IDE7XG5cbiAgICB0cmFuc2Zvcm0ubTExID0gc2NhbGVYO1xuICAgIHRyYW5zZm9ybS5tMjIgPSBzY2FsZVk7XG4gICAgdHJhbnNmb3JtLm0zMyA9IHNjYWxlWjtcblxuICAgIHJldHVybiB0aGlzLm11bHRpcGx5KHRyYW5zZm9ybSk7XG59O1xuXG4vKipcbiAqICBSZXR1cm5zIHRoZSByZXN1bHQgb2Ygc2tld2luZyB0aGUgbWF0cml4IGJ5IGEgZ2l2ZW4gdmVjdG9yLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHNrZXdYIC0gVGhlIHNjYWxpbmcgZmFjdG9yIGluIHRoZSB4IGF4aXMuXG4gKiAgQHJldHVybnMgWENTU01hdHJpeFxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5za2V3WCA9IGZ1bmN0aW9uIChkZWdyZWVzKSB7XG4gICAgdmFyIHJhZGlhbnMgICA9IHV0aWxzLmFuZ2xlcy5kZWcycmFkKGRlZ3JlZXMpO1xuICAgIHZhciB0cmFuc2Zvcm0gPSBuZXcgWENTU01hdHJpeCgpO1xuXG4gICAgdHJhbnNmb3JtLmMgPSBNYXRoLnRhbihyYWRpYW5zKTtcblxuICAgIHJldHVybiB0aGlzLm11bHRpcGx5KHRyYW5zZm9ybSk7XG59O1xuXG4vKipcbiAqICBSZXR1cm5zIHRoZSByZXN1bHQgb2Ygc2tld2luZyB0aGUgbWF0cml4IGJ5IGEgZ2l2ZW4gdmVjdG9yLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHNrZXdZIC0gdGhlIHNjYWxpbmcgZmFjdG9yIGluIHRoZSB4IGF4aXMuXG4gKiAgQHJldHVybnMgWENTU01hdHJpeFxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5za2V3WSA9IGZ1bmN0aW9uIChkZWdyZWVzKSB7XG4gICAgdmFyIHJhZGlhbnMgICA9IHV0aWxzLmFuZ2xlcy5kZWcycmFkKGRlZ3JlZXMpO1xuICAgIHZhciB0cmFuc2Zvcm0gPSBuZXcgWENTU01hdHJpeCgpO1xuXG4gICAgdHJhbnNmb3JtLmIgPSBNYXRoLnRhbihyYWRpYW5zKTtcblxuICAgIHJldHVybiB0aGlzLm11bHRpcGx5KHRyYW5zZm9ybSk7XG59O1xuXG4vKipcbiAqICBSZXR1cm5zIHRoZSByZXN1bHQgb2YgdHJhbnNsYXRpbmcgdGhlIG1hdHJpeCBieSBhIGdpdmVuIHZlY3Rvci5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlclxuICogIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAqICBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLiBJZiB1bmRlZmluZWQsIDAgaXMgdXNlZC5cbiAqICBAcmV0dXJucyBYQ1NTTWF0cml4XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnRyYW5zbGF0ZSA9IGZ1bmN0aW9uICh4LCB5LCB6KSB7XG4gICAgdmFyIHQgPSBuZXcgWENTU01hdHJpeCgpO1xuXG4gICAgaWYgKHR5cGVvZiB4ICE9PSAnbnVtYmVyJyB8fCBpc05hTih4KSkgeCA9IDA7XG4gICAgaWYgKHR5cGVvZiB5ICE9PSAnbnVtYmVyJyB8fCBpc05hTih5KSkgeSA9IDA7XG4gICAgaWYgKHR5cGVvZiB6ICE9PSAnbnVtYmVyJyB8fCBpc05hTih6KSkgeiA9IDA7XG5cbiAgICB0Lm00MSA9IHg7XG4gICAgdC5tNDIgPSB5O1xuICAgIHQubTQzID0gejtcblxuICAgIHJldHVybiB0aGlzLm11bHRpcGx5KHQpO1xufTtcblxuLyoqXG4gKiAgU2V0cyB0aGUgbWF0cml4IHZhbHVlcyB1c2luZyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiwgc3VjaCBhcyB0aGF0IHByb2R1Y2VkXG4gKiAgYnkgdGhlIFtbWENTU01hdHJpeCN0b1N0cmluZ11dIG1ldGhvZC5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlclxuICogIEBwYXJhbXMge3N0cmluZ30gZG9tc3RyIC0gQSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYSAyRCBvciAzRCB0cmFuc2Zvcm0gbWF0cml4XG4gKiAgICBpbiB0aGUgZm9ybSBnaXZlbiBieSB0aGUgQ1NTIHRyYW5zZm9ybSBwcm9wZXJ0eSwgaS5lLiBqdXN0IGxpa2UgdGhlXG4gKiAgICBvdXRwdXQgZnJvbSBbW1hDU1NNYXRyaXgjdG9TdHJpbmddXS5cbiAqICBAcmV0dXJucyB1bmRlZmluZWRcbiAqL1xuWENTU01hdHJpeC5wcm90b3R5cGUuc2V0TWF0cml4VmFsdWUgPSBmdW5jdGlvbiAoZG9tc3RyKSB7XG5cbiAgICB2YXIgbWF0cml4U3RyaW5nID0gdG9NYXRyaXhTdHJpbmcoZG9tc3RyLnRyaW0oKSk7XG4gICAgdmFyIG1hdHJpeE9iamVjdCA9IHV0aWxzLnRyYW5zcC5zdGF0ZW1lbnRUb09iamVjdChtYXRyaXhTdHJpbmcpO1xuXG4gICAgaWYgKCFtYXRyaXhPYmplY3QpIHJldHVybjtcblxuICAgIHZhciBpczNkICAgPSBtYXRyaXhPYmplY3Qua2V5ID09PSB1dGlscy50cmFuc3AubWF0cml4Rm4zZDtcbiAgICB2YXIga2V5Z2VuID0gaXMzZCA/IGluZGV4dG9LZXkzZCA6IGluZGV4dG9LZXkyZDtcbiAgICB2YXIgdmFsdWVzID0gbWF0cml4T2JqZWN0LnZhbHVlO1xuICAgIHZhciBjb3VudCAgPSB2YWx1ZXMubGVuZ3RoO1xuXG4gICAgaWYgKChpczNkICYmIGNvdW50ICE9PSAxNikgfHwgIShpczNkIHx8IGNvdW50ID09PSA2KSkgcmV0dXJuO1xuXG4gICAgdmFsdWVzLmZvckVhY2goZnVuY3Rpb24gKG9iaiwgaSkge1xuICAgICAgICB2YXIga2V5ID0ga2V5Z2VuKGkpO1xuICAgICAgICB0aGlzW2tleV0gPSBvYmoudmFsdWU7XG4gICAgfSwgdGhpcyk7XG59O1xuXG5mdW5jdGlvbiBpbmRleHRvS2V5MmQgKGluZGV4KSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoaW5kZXggKyA5Nyk7IC8vIEFTQ0lJIGNoYXIgOTcgPT0gJ2EnXG59XG5cbmZ1bmN0aW9uIGluZGV4dG9LZXkzZCAoaW5kZXgpIHtcbiAgICByZXR1cm4gKCdtJyArIChNYXRoLmZsb29yKGluZGV4IC8gNCkgKyAxKSkgKyAoaW5kZXggJSA0ICsgMSk7XG59XG4vKipcbiAqICBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtYXRyaXguXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJvZiBYQ1NTTWF0cml4XG4gKiAgQHJldHVybnMge3N0cmluZ30gbWF0cml4U3RyaW5nIC0gYSBzdHJpbmcgbGlrZSBgbWF0cml4KDEuMDAwMDAwLCAwLjAwMDAwMCwgMC4wMDAwMDAsIDEuMDAwMDAwLCAwLjAwMDAwMCwgMC4wMDAwMDApYFxuICpcbiAqKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwb2ludHMsIHByZWZpeDtcblxuICAgIGlmICh1dGlscy5tYXRyaXguaXNBZmZpbmUodGhpcykpIHtcbiAgICAgICAgcHJlZml4ID0gdXRpbHMudHJhbnNwLm1hdHJpeEZuMmQ7XG4gICAgICAgIHBvaW50cyA9IHBvaW50czJkO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHByZWZpeCA9IHV0aWxzLnRyYW5zcC5tYXRyaXhGbjNkO1xuICAgICAgICBwb2ludHMgPSBwb2ludHMzZDtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJlZml4ICsgJygnICtcbiAgICAgICAgcG9pbnRzLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbcF0udG9GaXhlZCg2KTtcbiAgICAgICAgfSwgdGhpcykgLmpvaW4oJywgJykgK1xuICAgICAgICAnKSc7XG59O1xuXG4vLyA9PT09PT0gdG9NYXRyaXhTdHJpbmcgPT09PT09IC8vXG52YXIganNGdW5jdGlvbnMgPSB7XG4gICAgbWF0cml4OiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICB2YXIgbTIgPSBuZXcgWENTU01hdHJpeChvLnVucGFyc2VkKTtcblxuICAgICAgICByZXR1cm4gbS5tdWx0aXBseShtMik7XG4gICAgfSxcbiAgICBtYXRyaXgzZDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgdmFyIG0yID0gbmV3IFhDU1NNYXRyaXgoby51bnBhcnNlZCk7XG5cbiAgICAgICAgcmV0dXJuIG0ubXVsdGlwbHkobTIpO1xuICAgIH0sXG5cbiAgICBwZXJzcGVjdGl2ZTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgdmFyIG0yID0gbmV3IFhDU1NNYXRyaXgoKTtcbiAgICAgICAgbTIubTM0IC09IDEgLyBvLnZhbHVlWzBdLnZhbHVlO1xuXG4gICAgICAgIHJldHVybiBtLm11bHRpcGx5KG0yKTtcbiAgICB9LFxuXG4gICAgcm90YXRlOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5yb3RhdGUuYXBwbHkobSwgby52YWx1ZS5tYXAob2JqZWN0VmFsdWVzKSk7XG4gICAgfSxcbiAgICByb3RhdGUzZDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0ucm90YXRlQXhpc0FuZ2xlLmFwcGx5KG0sIG8udmFsdWUubWFwKG9iamVjdFZhbHVlcykpO1xuICAgIH0sXG4gICAgcm90YXRlWDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0ucm90YXRlLmFwcGx5KG0sIFtvLnZhbHVlWzBdLnZhbHVlLCAwLCAwXSk7XG4gICAgfSxcbiAgICByb3RhdGVZOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5yb3RhdGUuYXBwbHkobSwgWzAsIG8udmFsdWVbMF0udmFsdWUsIDBdKTtcbiAgICB9LFxuICAgIHJvdGF0ZVo6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnJvdGF0ZS5hcHBseShtLCBbMCwgMCwgby52YWx1ZVswXS52YWx1ZV0pO1xuICAgIH0sXG5cbiAgICBzY2FsZTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0uc2NhbGUuYXBwbHkobSwgby52YWx1ZS5tYXAob2JqZWN0VmFsdWVzKSk7XG4gICAgfSxcbiAgICBzY2FsZTNkOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5zY2FsZS5hcHBseShtLCBvLnZhbHVlLm1hcChvYmplY3RWYWx1ZXMpKTtcbiAgICB9LFxuICAgIHNjYWxlWDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0uc2NhbGUuYXBwbHkobSwgby52YWx1ZS5tYXAob2JqZWN0VmFsdWVzKSk7XG4gICAgfSxcbiAgICBzY2FsZVk6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnNjYWxlLmFwcGx5KG0sIFswLCBvLnZhbHVlWzBdLnZhbHVlLCAwXSk7XG4gICAgfSxcbiAgICBzY2FsZVo6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnNjYWxlLmFwcGx5KG0sIFswLCAwLCBvLnZhbHVlWzBdLnZhbHVlXSk7XG4gICAgfSxcblxuICAgIHNrZXc6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHZhciBtWCA9IG5ldyBYQ1NTTWF0cml4KCdza2V3WCgnICsgby52YWx1ZVswXS51bnBhcnNlZCArICcpJyk7XG4gICAgICAgIHZhciBtWSA9IG5ldyBYQ1NTTWF0cml4KCdza2V3WSgnICsgKG8udmFsdWVbMV0mJm8udmFsdWVbMV0udW5wYXJzZWQgfHwgMCkgKyAnKScpO1xuICAgICAgICB2YXIgc00gPSAnbWF0cml4KDEuMDAwMDAsICcrIG1ZLmIgKycsICcrIG1YLmMgKycsIDEuMDAwMDAwLCAwLjAwMDAwMCwgMC4wMDAwMDApJztcbiAgICAgICAgdmFyIG0yID0gbmV3IFhDU1NNYXRyaXgoc00pO1xuXG4gICAgICAgIHJldHVybiBtLm11bHRpcGx5KG0yKTtcbiAgICB9LFxuICAgIHNrZXdYOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5za2V3WC5hcHBseShtLCBbby52YWx1ZVswXS52YWx1ZV0pO1xuICAgIH0sXG4gICAgc2tld1k6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnNrZXdZLmFwcGx5KG0sIFtvLnZhbHVlWzBdLnZhbHVlXSk7XG4gICAgfSxcblxuICAgIHRyYW5zbGF0ZTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0udHJhbnNsYXRlLmFwcGx5KG0sIG8udmFsdWUubWFwKG9iamVjdFZhbHVlcykpO1xuICAgIH0sXG4gICAgdHJhbnNsYXRlM2Q6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnRyYW5zbGF0ZS5hcHBseShtLCBvLnZhbHVlLm1hcChvYmplY3RWYWx1ZXMpKTtcbiAgICB9LFxuICAgIHRyYW5zbGF0ZVg6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnRyYW5zbGF0ZS5hcHBseShtLCBbby52YWx1ZVswXS52YWx1ZSwgMCwgMF0pO1xuICAgIH0sXG4gICAgdHJhbnNsYXRlWTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0udHJhbnNsYXRlLmFwcGx5KG0sIFswLCBvLnZhbHVlWzBdLnZhbHVlLCAwXSk7XG4gICAgfSxcbiAgICB0cmFuc2xhdGVaOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS50cmFuc2xhdGUuYXBwbHkobSwgWzAsIDAsIG8udmFsdWVbMF0udmFsdWVdKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBvYmplY3RWYWx1ZXMob2JqKSB7XG4gICAgcmV0dXJuIG9iai52YWx1ZTtcbn1cblxuZnVuY3Rpb24gY3NzRnVuY3Rpb25Ub0pzRnVuY3Rpb24oY3NzRnVuY3Rpb25OYW1lKSB7XG4gICAgcmV0dXJuIGpzRnVuY3Rpb25zW2Nzc0Z1bmN0aW9uTmFtZV07XG59XG5cbmZ1bmN0aW9uIHBhcnNlZFRvRGVncmVlcyhwYXJzZWQpIHtcbiAgICBpZiAocGFyc2VkLnVuaXRzID09PSAncmFkJykge1xuICAgICAgICBwYXJzZWQudmFsdWUgPSB1dGlscy5hbmdsZXMucmFkMmRlZyhwYXJzZWQudmFsdWUpO1xuICAgICAgICBwYXJzZWQudW5pdHMgPSAnZGVnJztcbiAgICB9XG4gICAgZWxzZSBpZiAocGFyc2VkLnVuaXRzID09PSAnZ3JhZCcpIHtcbiAgICAgICAgcGFyc2VkLnZhbHVlID0gdXRpbHMuYW5nbGVzLmdyYWQyZGVnKHBhcnNlZC52YWx1ZSk7XG4gICAgICAgIHBhcnNlZC51bml0cyA9ICdkZWcnO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWQ7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybU1hdHJpeChtYXRyaXgsIG9wZXJhdGlvbikge1xuICAgIC8vIGNvbnZlcnQgdG8gZGVncmVlcyBiZWNhdXNlIGFsbCBDU1NNYXRyaXggbWV0aG9kcyBleHBlY3QgZGVncmVlc1xuICAgIG9wZXJhdGlvbi52YWx1ZSA9IG9wZXJhdGlvbi52YWx1ZS5tYXAocGFyc2VkVG9EZWdyZWVzKTtcblxuICAgIHZhciBqc0Z1bmN0aW9uID0gY3NzRnVuY3Rpb25Ub0pzRnVuY3Rpb24ob3BlcmF0aW9uLmtleSk7XG4gICAgdmFyIHJlc3VsdCAgICAgPSBqc0Z1bmN0aW9uKG1hdHJpeCwgb3BlcmF0aW9uKTtcblxuICAgIHJldHVybiByZXN1bHQgfHwgbWF0cml4O1xufVxuXG4vKipcbiAqICBUcmFuZm9ybXMgYSBgZWwuc3R5bGUuV2Via2l0VHJhbnNmb3JtYC1zdHlsZSBzdHJpbmdcbiAqICAobGlrZSBgcm90YXRlKDE4cmFkKSB0cmFuc2xhdGUzZCg1MHB4LCAxMDBweCwgMTBweClgKVxuICogIGludG8gYSBgZ2V0Q29tcHV0ZWRTdHlsZShlbClgLXN0eWxlIG1hdHJpeCBzdHJpbmdcbiAqICAobGlrZSBgbWF0cml4M2QoMC42NjAzMTYsIC0wLjc1MDk4NywgMCwgMCwgMC43NTA5ODcsIDAuNjYwMzE2LCAwLCAwLCAwLCAwLCAxLCAwLCAxMDguMTE0NTYwLCAyOC40ODIzMDgsIDEwLCAxKWApXG4gKiAgQHByaXZhdGVcbiAqICBAbWV0aG9kXG4gKiAgQHBhcmFtIHtzdHJpbmd9IHRyYW5zZm9ybVN0cmluZyAtIGBlbC5zdHlsZS5XZWJraXRUcmFuc2Zvcm1gLXN0eWxlIHN0cmluZyAobGlrZSBgcm90YXRlKDE4cmFkKSB0cmFuc2xhdGUzZCg1MHB4LCAxMDBweCwgMTBweClgKVxuICovXG5mdW5jdGlvbiB0b01hdHJpeFN0cmluZyh0cmFuc2Zvcm1TdHJpbmcpIHtcbiAgICB2YXIgc3RhdGVtZW50cyA9IHV0aWxzLnRyYW5zcC5zdHJpbmdUb1N0YXRlbWVudHModHJhbnNmb3JtU3RyaW5nKTtcblxuICAgIGlmIChzdGF0ZW1lbnRzLmxlbmd0aCA9PT0gMSAmJiAoL15tYXRyaXgvKS50ZXN0KHRyYW5zZm9ybVN0cmluZykpIHtcbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybVN0cmluZztcbiAgICB9XG5cbiAgICAvLyBXZSBvbmx5IHdhbnQgdGhlIHN0YXRlbWVudCB0byBwYXNzIHRvIGB1dGlscy50cmFuc3Auc3RhdGVtZW50VG9PYmplY3RgXG4gICAgLy8gICBub3QgdGhlIG90aGVyIHZhbHVlcyAoaW5kZXgsIGxpc3QpIGZyb20gYG1hcGBcbiAgICB2YXIgc3RhdGVtZW50VG9PYmplY3QgPSB1dGlscy5mdW5jcy5vbmx5Rmlyc3RBcmcodXRpbHMudHJhbnNwLnN0YXRlbWVudFRvT2JqZWN0KTtcbiAgICB2YXIgb3BlcmF0aW9ucyAgICAgICAgPSBzdGF0ZW1lbnRzLm1hcChzdGF0ZW1lbnRUb09iamVjdCk7XG4gICAgdmFyIHN0YXJ0aW5nTWF0cml4ICAgID0gbmV3IFhDU1NNYXRyaXgoKTtcbiAgICB2YXIgdHJhbnNmb3JtZWRNYXRyaXggPSBvcGVyYXRpb25zLnJlZHVjZSh0cmFuc2Zvcm1NYXRyaXgsIHN0YXJ0aW5nTWF0cml4KTtcbiAgICB2YXIgbWF0cml4U3RyaW5nICAgICAgPSB0cmFuc2Zvcm1lZE1hdHJpeC50b1N0cmluZygpO1xuXG4gICAgcmV0dXJuIG1hdHJpeFN0cmluZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBYQ1NTTWF0cml4O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRlZzJyYWQ6IGRlZzJyYWQsXG4gIHJhZDJkZWc6IHJhZDJkZWcsXG4gIGdyYWQyZGVnOiBncmFkMmRlZ1xufTtcblxuLyoqXG4gKiAgQ29udmVydHMgYW5nbGVzIGluIGRlZ3JlZXMsIHdoaWNoIGFyZSB1c2VkIGJ5IHRoZSBleHRlcm5hbCBBUEksIHRvIGFuZ2xlc1xuICogIGluIHJhZGlhbnMgdXNlZCBpbiBpbnRlcm5hbCBjYWxjdWxhdGlvbnMuXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGFuZ2xlIC0gQW4gYW5nbGUgaW4gZGVncmVlcy5cbiAqICBAcmV0dXJucyB7bnVtYmVyfSByYWRpYW5zXG4gKi9cbmZ1bmN0aW9uIGRlZzJyYWQoYW5nbGUpIHtcbiAgICByZXR1cm4gYW5nbGUgKiBNYXRoLlBJIC8gMTgwO1xufVxuXG5mdW5jdGlvbiByYWQyZGVnKHJhZGlhbnMpIHtcbiAgICByZXR1cm4gcmFkaWFucyAqICgxODAgLyBNYXRoLlBJKTtcbn1cblxuZnVuY3Rpb24gZ3JhZDJkZWcoZ3JhZGlhbnMpIHtcbiAgICAvLyA0MDAgZ3JhZGlhbnMgaW4gMzYwIGRlZ3JlZXNcbiAgICByZXR1cm4gZ3JhZGlhbnMgLyAoNDAwIC8gMzYwKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIG1hdHJpeEZuMmQ6ICdtYXRyaXgnLFxuICAgIG1hdHJpeEZuM2Q6ICdtYXRyaXgzZCcsXG4gICAgdmFsdWVUb09iamVjdDogdmFsdWVUb09iamVjdCxcbiAgICBzdGF0ZW1lbnRUb09iamVjdDogc3RhdGVtZW50VG9PYmplY3QsXG4gICAgc3RyaW5nVG9TdGF0ZW1lbnRzOiBzdHJpbmdUb1N0YXRlbWVudHNcbn07XG5cbmZ1bmN0aW9uIHZhbHVlVG9PYmplY3QodmFsdWUpIHtcbiAgICB2YXIgdW5pdHMgPSAvKFtcXC1cXCtdP1swLTldK1tcXC4wLTldKikoZGVnfHJhZHxncmFkfHB4fCUpKi87XG4gICAgdmFyIHBhcnRzID0gdmFsdWUubWF0Y2godW5pdHMpIHx8IFtdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHBhcnNlRmxvYXQocGFydHNbMV0pLFxuICAgICAgICB1bml0czogcGFydHNbMl0sXG4gICAgICAgIHVucGFyc2VkOiB2YWx1ZVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIHN0YXRlbWVudFRvT2JqZWN0KHN0YXRlbWVudCwgc2tpcFZhbHVlcykge1xuICAgIHZhciBuYW1lQW5kQXJncyAgICA9IC8oXFx3KylcXCgoW15cXCldKylcXCkvaTtcbiAgICB2YXIgc3RhdGVtZW50UGFydHMgPSBzdGF0ZW1lbnQudG9TdHJpbmcoKS5tYXRjaChuYW1lQW5kQXJncykuc2xpY2UoMSk7XG4gICAgdmFyIGZ1bmN0aW9uTmFtZSAgID0gc3RhdGVtZW50UGFydHNbMF07XG4gICAgdmFyIHN0cmluZ1ZhbHVlcyAgID0gc3RhdGVtZW50UGFydHNbMV0uc3BsaXQoLywgPy8pO1xuICAgIHZhciBwYXJzZWRWYWx1ZXMgICA9ICFza2lwVmFsdWVzICYmIHN0cmluZ1ZhbHVlcy5tYXAodmFsdWVUb09iamVjdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBrZXk6IGZ1bmN0aW9uTmFtZSxcbiAgICAgICAgdmFsdWU6IHBhcnNlZFZhbHVlcyB8fCBzdHJpbmdWYWx1ZXMsXG4gICAgICAgIHVucGFyc2VkOiBzdGF0ZW1lbnRcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdUb1N0YXRlbWVudHModHJhbnNmb3JtU3RyaW5nKSB7XG4gICAgdmFyIGZ1bmN0aW9uU2lnbmF0dXJlICAgPSAvKFxcdyspXFwoW15cXCldK1xcKS9pZztcbiAgICB2YXIgdHJhbnNmb3JtU3RhdGVtZW50cyA9IHRyYW5zZm9ybVN0cmluZy5tYXRjaChmdW5jdGlvblNpZ25hdHVyZSkgfHwgW107XG5cbiAgICByZXR1cm4gdHJhbnNmb3JtU3RhdGVtZW50cztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBkZXRlcm1pbmFudDJ4MjogZGV0ZXJtaW5hbnQyeDIsXG4gIGRldGVybWluYW50M3gzOiBkZXRlcm1pbmFudDN4MyxcbiAgZGV0ZXJtaW5hbnQ0eDQ6IGRldGVybWluYW50NHg0LFxuICBpc0FmZmluZTogaXNBZmZpbmUsXG4gIGlzSWRlbnRpdHlPclRyYW5zbGF0aW9uOiBpc0lkZW50aXR5T3JUcmFuc2xhdGlvbixcbiAgYWRqb2ludDogYWRqb2ludCxcbiAgaW52ZXJzZTogaW52ZXJzZSxcbiAgbXVsdGlwbHk6IG11bHRpcGx5LFxuICBkZWNvbXBvc2U6IGRlY29tcG9zZVxufTtcblxuLyoqXG4gKiAgQ2FsY3VsYXRlcyB0aGUgZGV0ZXJtaW5hbnQgb2YgYSAyeDIgbWF0cml4LlxuICogIEBwYXJhbSB7bnVtYmVyfSBhIC0gVG9wLWxlZnQgdmFsdWUgb2YgdGhlIG1hdHJpeC5cbiAqICBAcGFyYW0ge251bWJlcn0gYiAtIFRvcC1yaWdodCB2YWx1ZSBvZiB0aGUgbWF0cml4LlxuICogIEBwYXJhbSB7bnVtYmVyfSBjIC0gQm90dG9tLWxlZnQgdmFsdWUgb2YgdGhlIG1hdHJpeC5cbiAqICBAcGFyYW0ge251bWJlcn0gZCAtIEJvdHRvbS1yaWdodCB2YWx1ZSBvZiB0aGUgbWF0cml4LlxuICogIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGRldGVybWluYW50MngyKGEsIGIsIGMsIGQpIHtcbiAgICByZXR1cm4gYSAqIGQgLSBiICogYztcbn1cblxuLyoqXG4gKiAgQ2FsY3VsYXRlcyB0aGUgZGV0ZXJtaW5hbnQgb2YgYSAzeDMgbWF0cml4LlxuICogIEBwYXJhbSB7bnVtYmVyfSBhMSAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMSwgMV0uXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGEyIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFsxLCAyXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYTMgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzEsIDNdLlxuICogIEBwYXJhbSB7bnVtYmVyfSBiMSAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMiwgMV0uXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGIyIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFsyLCAyXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYjMgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzIsIDNdLlxuICogIEBwYXJhbSB7bnVtYmVyfSBjMSAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMywgMV0uXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGMyIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFszLCAyXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYzMgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzMsIDNdLlxuICogIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGRldGVybWluYW50M3gzKGExLCBhMiwgYTMsIGIxLCBiMiwgYjMsIGMxLCBjMiwgYzMpIHtcblxuICAgIHJldHVybiBhMSAqIGRldGVybWluYW50MngyKGIyLCBiMywgYzIsIGMzKSAtXG4gICAgICAgICAgIGIxICogZGV0ZXJtaW5hbnQyeDIoYTIsIGEzLCBjMiwgYzMpICtcbiAgICAgICAgICAgYzEgKiBkZXRlcm1pbmFudDJ4MihhMiwgYTMsIGIyLCBiMyk7XG59XG5cbi8qKlxuICogIENhbGN1bGF0ZXMgdGhlIGRldGVybWluYW50IG9mIGEgNHg0IG1hdHJpeC5cbiAqICBAcGFyYW0ge1hDU1NNYXRyaXh9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gY2FsY3VsYXRlIHRoZSBkZXRlcm1pbmFudCBvZi5cbiAqICBAcmV0dXJucyB7bnVtYmVyfVxuICovXG5mdW5jdGlvbiBkZXRlcm1pbmFudDR4NChtYXRyaXgpIHtcbiAgICB2YXJcbiAgICAgICAgbSA9IG1hdHJpeCxcbiAgICAgICAgLy8gQXNzaWduIHRvIGluZGl2aWR1YWwgdmFyaWFibGUgbmFtZXMgdG8gYWlkIHNlbGVjdGluZyBjb3JyZWN0IGVsZW1lbnRzXG4gICAgICAgIGExID0gbS5tMTEsIGIxID0gbS5tMjEsIGMxID0gbS5tMzEsIGQxID0gbS5tNDEsXG4gICAgICAgIGEyID0gbS5tMTIsIGIyID0gbS5tMjIsIGMyID0gbS5tMzIsIGQyID0gbS5tNDIsXG4gICAgICAgIGEzID0gbS5tMTMsIGIzID0gbS5tMjMsIGMzID0gbS5tMzMsIGQzID0gbS5tNDMsXG4gICAgICAgIGE0ID0gbS5tMTQsIGI0ID0gbS5tMjQsIGM0ID0gbS5tMzQsIGQ0ID0gbS5tNDQ7XG5cbiAgICByZXR1cm4gYTEgKiBkZXRlcm1pbmFudDN4MyhiMiwgYjMsIGI0LCBjMiwgYzMsIGM0LCBkMiwgZDMsIGQ0KSAtXG4gICAgICAgICAgIGIxICogZGV0ZXJtaW5hbnQzeDMoYTIsIGEzLCBhNCwgYzIsIGMzLCBjNCwgZDIsIGQzLCBkNCkgK1xuICAgICAgICAgICBjMSAqIGRldGVybWluYW50M3gzKGEyLCBhMywgYTQsIGIyLCBiMywgYjQsIGQyLCBkMywgZDQpIC1cbiAgICAgICAgICAgZDEgKiBkZXRlcm1pbmFudDN4MyhhMiwgYTMsIGE0LCBiMiwgYjMsIGI0LCBjMiwgYzMsIGM0KTtcbn1cblxuLyoqXG4gKiAgRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBtYXRyaXggaXMgYWZmaW5lLlxuICogIEByZXR1cm5zIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBpc0FmZmluZShtYXRyaXgpIHtcbiAgICByZXR1cm4gbWF0cml4Lm0xMyA9PT0gMCAmJiBtYXRyaXgubTE0ID09PSAwICYmXG4gICAgICAgICAgIG1hdHJpeC5tMjMgPT09IDAgJiYgbWF0cml4Lm0yNCA9PT0gMCAmJlxuICAgICAgICAgICBtYXRyaXgubTMxID09PSAwICYmIG1hdHJpeC5tMzIgPT09IDAgJiZcbiAgICAgICAgICAgbWF0cml4Lm0zMyA9PT0gMSAmJiBtYXRyaXgubTM0ID09PSAwICYmXG4gICAgICAgICAgIG1hdHJpeC5tNDMgPT09IDAgJiYgbWF0cml4Lm00NCA9PT0gMTtcbn1cblxuLyoqXG4gKiAgUmV0dXJucyB3aGV0aGVyIHRoZSBtYXRyaXggaXMgdGhlIGlkZW50aXR5IG1hdHJpeCBvciBhIHRyYW5zbGF0aW9uIG1hdHJpeC5cbiAqICBAcmV0dXJuIHtib29sZWFufVxuICovXG5mdW5jdGlvbiBpc0lkZW50aXR5T3JUcmFuc2xhdGlvbihtYXRyaXgpIHtcbiAgICB2YXIgbSA9IG1hdHJpeDtcblxuICAgIHJldHVybiBtLm0xMSA9PT0gMSAmJiBtLm0xMiA9PT0gMCAmJiBtLm0xMyA9PT0gMCAmJiBtLm0xNCA9PT0gMCAmJlxuICAgICAgICAgICBtLm0yMSA9PT0gMCAmJiBtLm0yMiA9PT0gMSAmJiBtLm0yMyA9PT0gMCAmJiBtLm0yNCA9PT0gMCAmJlxuICAgICAgICAgICBtLm0zMSA9PT0gMCAmJiBtLm0zMSA9PT0gMCAmJiBtLm0zMyA9PT0gMSAmJiBtLm0zNCA9PT0gMCAmJlxuICAgIC8qIG00MSwgbTQyIGFuZCBtNDMgYXJlIHRoZSB0cmFuc2xhdGlvbiBwb2ludHMgKi8gICBtLm00NCA9PT0gMTtcbn1cblxuLyoqXG4gKiAgUmV0dXJucyB0aGUgYWRqb2ludCBtYXRyaXguXG4gKiAgQHJldHVybiB7WENTU01hdHJpeH1cbiAqL1xuZnVuY3Rpb24gYWRqb2ludChtYXRyaXgpIHtcbiAgICB2YXIgbSA9IG1hdHJpeCxcbiAgICAgICAgLy8gbWFrZSBgcmVzdWx0YCB0aGUgc2FtZSB0eXBlIGFzIHRoZSBnaXZlbiBtZXRyaWNcbiAgICAgICAgcmVzdWx0ID0gbmV3IG1hdHJpeC5jb25zdHJ1Y3RvcigpLFxuXG4gICAgICAgIGExID0gbS5tMTEsIGIxID0gbS5tMTIsIGMxID0gbS5tMTMsIGQxID0gbS5tMTQsXG4gICAgICAgIGEyID0gbS5tMjEsIGIyID0gbS5tMjIsIGMyID0gbS5tMjMsIGQyID0gbS5tMjQsXG4gICAgICAgIGEzID0gbS5tMzEsIGIzID0gbS5tMzIsIGMzID0gbS5tMzMsIGQzID0gbS5tMzQsXG4gICAgICAgIGE0ID0gbS5tNDEsIGI0ID0gbS5tNDIsIGM0ID0gbS5tNDMsIGQ0ID0gbS5tNDQ7XG5cbiAgICAvLyBSb3cgY29sdW1uIGxhYmVsaW5nIHJldmVyc2VkIHNpbmNlIHdlIHRyYW5zcG9zZSByb3dzICYgY29sdW1uc1xuICAgIHJlc3VsdC5tMTEgPSAgZGV0ZXJtaW5hbnQzeDMoYjIsIGIzLCBiNCwgYzIsIGMzLCBjNCwgZDIsIGQzLCBkNCk7XG4gICAgcmVzdWx0Lm0yMSA9IC1kZXRlcm1pbmFudDN4MyhhMiwgYTMsIGE0LCBjMiwgYzMsIGM0LCBkMiwgZDMsIGQ0KTtcbiAgICByZXN1bHQubTMxID0gIGRldGVybWluYW50M3gzKGEyLCBhMywgYTQsIGIyLCBiMywgYjQsIGQyLCBkMywgZDQpO1xuICAgIHJlc3VsdC5tNDEgPSAtZGV0ZXJtaW5hbnQzeDMoYTIsIGEzLCBhNCwgYjIsIGIzLCBiNCwgYzIsIGMzLCBjNCk7XG5cbiAgICByZXN1bHQubTEyID0gLWRldGVybWluYW50M3gzKGIxLCBiMywgYjQsIGMxLCBjMywgYzQsIGQxLCBkMywgZDQpO1xuICAgIHJlc3VsdC5tMjIgPSAgZGV0ZXJtaW5hbnQzeDMoYTEsIGEzLCBhNCwgYzEsIGMzLCBjNCwgZDEsIGQzLCBkNCk7XG4gICAgcmVzdWx0Lm0zMiA9IC1kZXRlcm1pbmFudDN4MyhhMSwgYTMsIGE0LCBiMSwgYjMsIGI0LCBkMSwgZDMsIGQ0KTtcbiAgICByZXN1bHQubTQyID0gIGRldGVybWluYW50M3gzKGExLCBhMywgYTQsIGIxLCBiMywgYjQsIGMxLCBjMywgYzQpO1xuXG4gICAgcmVzdWx0Lm0xMyA9ICBkZXRlcm1pbmFudDN4MyhiMSwgYjIsIGI0LCBjMSwgYzIsIGM0LCBkMSwgZDIsIGQ0KTtcbiAgICByZXN1bHQubTIzID0gLWRldGVybWluYW50M3gzKGExLCBhMiwgYTQsIGMxLCBjMiwgYzQsIGQxLCBkMiwgZDQpO1xuICAgIHJlc3VsdC5tMzMgPSAgZGV0ZXJtaW5hbnQzeDMoYTEsIGEyLCBhNCwgYjEsIGIyLCBiNCwgZDEsIGQyLCBkNCk7XG4gICAgcmVzdWx0Lm00MyA9IC1kZXRlcm1pbmFudDN4MyhhMSwgYTIsIGE0LCBiMSwgYjIsIGI0LCBjMSwgYzIsIGM0KTtcblxuICAgIHJlc3VsdC5tMTQgPSAtZGV0ZXJtaW5hbnQzeDMoYjEsIGIyLCBiMywgYzEsIGMyLCBjMywgZDEsIGQyLCBkMyk7XG4gICAgcmVzdWx0Lm0yNCA9ICBkZXRlcm1pbmFudDN4MyhhMSwgYTIsIGEzLCBjMSwgYzIsIGMzLCBkMSwgZDIsIGQzKTtcbiAgICByZXN1bHQubTM0ID0gLWRldGVybWluYW50M3gzKGExLCBhMiwgYTMsIGIxLCBiMiwgYjMsIGQxLCBkMiwgZDMpO1xuICAgIHJlc3VsdC5tNDQgPSAgZGV0ZXJtaW5hbnQzeDMoYTEsIGEyLCBhMywgYjEsIGIyLCBiMywgYzEsIGMyLCBjMyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBpbnZlcnNlKG1hdHJpeCkge1xuICB2YXIgaW52O1xuXG4gIGlmIChpc0lkZW50aXR5T3JUcmFuc2xhdGlvbihtYXRyaXgpKSB7XG4gICAgICBpbnYgPSBuZXcgbWF0cml4LmNvbnN0cnVjdG9yKCk7XG5cbiAgICAgIGlmICghKG1hdHJpeC5tNDEgPT09IDAgJiYgbWF0cml4Lm00MiA9PT0gMCAmJiBtYXRyaXgubTQzID09PSAwKSkge1xuICAgICAgICAgIGludi5tNDEgPSAtbWF0cml4Lm00MTtcbiAgICAgICAgICBpbnYubTQyID0gLW1hdHJpeC5tNDI7XG4gICAgICAgICAgaW52Lm00MyA9IC1tYXRyaXgubTQzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gaW52O1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBhZGpvaW50IG1hdHJpeFxuICB2YXIgcmVzdWx0ID0gYWRqb2ludChtYXRyaXgpO1xuXG4gIC8vIENhbGN1bGF0ZSB0aGUgNHg0IGRldGVybWluYW50XG4gIHZhciBkZXQgPSBkZXRlcm1pbmFudDR4NChtYXRyaXgpO1xuXG4gIC8vIElmIHRoZSBkZXRlcm1pbmFudCBpcyB6ZXJvLCB0aGVuIHRoZSBpbnZlcnNlIG1hdHJpeCBpcyBub3QgdW5pcXVlXG4gIGlmIChNYXRoLmFicyhkZXQpIDwgMWUtOCkgcmV0dXJuIG51bGw7XG5cbiAgLy8gU2NhbGUgdGhlIGFkam9pbnQgbWF0cml4IHRvIGdldCB0aGUgaW52ZXJzZVxuICBmb3IgKHZhciBpID0gMTsgaSA8IDU7IGkrKykge1xuICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCA1OyBqKyspIHtcbiAgICAgICAgICByZXN1bHRbKCdtJyArIGkpICsgal0gLz0gZGV0O1xuICAgICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gbXVsdGlwbHkobWF0cml4LCBvdGhlck1hdHJpeCkge1xuICBpZiAoIW90aGVyTWF0cml4KSByZXR1cm4gbnVsbDtcblxuICB2YXIgYSA9IG90aGVyTWF0cml4LFxuICAgICAgYiA9IG1hdHJpeCxcbiAgICAgIGMgPSBuZXcgbWF0cml4LmNvbnN0cnVjdG9yKCk7XG5cbiAgYy5tMTEgPSBhLm0xMSAqIGIubTExICsgYS5tMTIgKiBiLm0yMSArIGEubTEzICogYi5tMzEgKyBhLm0xNCAqIGIubTQxO1xuICBjLm0xMiA9IGEubTExICogYi5tMTIgKyBhLm0xMiAqIGIubTIyICsgYS5tMTMgKiBiLm0zMiArIGEubTE0ICogYi5tNDI7XG4gIGMubTEzID0gYS5tMTEgKiBiLm0xMyArIGEubTEyICogYi5tMjMgKyBhLm0xMyAqIGIubTMzICsgYS5tMTQgKiBiLm00MztcbiAgYy5tMTQgPSBhLm0xMSAqIGIubTE0ICsgYS5tMTIgKiBiLm0yNCArIGEubTEzICogYi5tMzQgKyBhLm0xNCAqIGIubTQ0O1xuXG4gIGMubTIxID0gYS5tMjEgKiBiLm0xMSArIGEubTIyICogYi5tMjEgKyBhLm0yMyAqIGIubTMxICsgYS5tMjQgKiBiLm00MTtcbiAgYy5tMjIgPSBhLm0yMSAqIGIubTEyICsgYS5tMjIgKiBiLm0yMiArIGEubTIzICogYi5tMzIgKyBhLm0yNCAqIGIubTQyO1xuICBjLm0yMyA9IGEubTIxICogYi5tMTMgKyBhLm0yMiAqIGIubTIzICsgYS5tMjMgKiBiLm0zMyArIGEubTI0ICogYi5tNDM7XG4gIGMubTI0ID0gYS5tMjEgKiBiLm0xNCArIGEubTIyICogYi5tMjQgKyBhLm0yMyAqIGIubTM0ICsgYS5tMjQgKiBiLm00NDtcblxuICBjLm0zMSA9IGEubTMxICogYi5tMTEgKyBhLm0zMiAqIGIubTIxICsgYS5tMzMgKiBiLm0zMSArIGEubTM0ICogYi5tNDE7XG4gIGMubTMyID0gYS5tMzEgKiBiLm0xMiArIGEubTMyICogYi5tMjIgKyBhLm0zMyAqIGIubTMyICsgYS5tMzQgKiBiLm00MjtcbiAgYy5tMzMgPSBhLm0zMSAqIGIubTEzICsgYS5tMzIgKiBiLm0yMyArIGEubTMzICogYi5tMzMgKyBhLm0zNCAqIGIubTQzO1xuICBjLm0zNCA9IGEubTMxICogYi5tMTQgKyBhLm0zMiAqIGIubTI0ICsgYS5tMzMgKiBiLm0zNCArIGEubTM0ICogYi5tNDQ7XG5cbiAgYy5tNDEgPSBhLm00MSAqIGIubTExICsgYS5tNDIgKiBiLm0yMSArIGEubTQzICogYi5tMzEgKyBhLm00NCAqIGIubTQxO1xuICBjLm00MiA9IGEubTQxICogYi5tMTIgKyBhLm00MiAqIGIubTIyICsgYS5tNDMgKiBiLm0zMiArIGEubTQ0ICogYi5tNDI7XG4gIGMubTQzID0gYS5tNDEgKiBiLm0xMyArIGEubTQyICogYi5tMjMgKyBhLm00MyAqIGIubTMzICsgYS5tNDQgKiBiLm00MztcbiAgYy5tNDQgPSBhLm00MSAqIGIubTE0ICsgYS5tNDIgKiBiLm0yNCArIGEubTQzICogYi5tMzQgKyBhLm00NCAqIGIubTQ0O1xuXG4gIHJldHVybiBjO1xufVxuXG5mdW5jdGlvbiB0cmFuc3Bvc2UobWF0cml4KSB7XG4gIHZhciByZXN1bHQgPSBuZXcgbWF0cml4LmNvbnN0cnVjdG9yKCk7XG4gIHZhciByb3dzID0gNCwgY29scyA9IDQ7XG4gIHZhciBpID0gY29scywgajtcbiAgd2hpbGUgKGkpIHtcbiAgICBqID0gcm93cztcbiAgICB3aGlsZSAoaikge1xuICAgICAgcmVzdWx0WydtJyArIGkgKyBqXSA9IG1hdHJpeFsnbScrIGogKyBpXTtcbiAgICAgIGotLTtcbiAgICB9XG4gICAgaS0tO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qXG4gIElucHV0OiAgbWF0cml4ICAgICAgOyBhIDR4NCBtYXRyaXhcbiAgT3V0cHV0OiB0cmFuc2xhdGlvbiA7IGEgMyBjb21wb25lbnQgdmVjdG9yXG4gICAgICAgICAgc2NhbGUgICAgICAgOyBhIDMgY29tcG9uZW50IHZlY3RvclxuICAgICAgICAgIHNrZXcgICAgICAgIDsgc2tldyBmYWN0b3JzIFhZLFhaLFlaIHJlcHJlc2VudGVkIGFzIGEgMyBjb21wb25lbnQgdmVjdG9yXG4gICAgICAgICAgcGVyc3BlY3RpdmUgOyBhIDQgY29tcG9uZW50IHZlY3RvclxuICAgICAgICAgIHJvdGF0ZSAgOyBhIDQgY29tcG9uZW50IHZlY3RvclxuICBSZXR1cm5zIGZhbHNlIGlmIHRoZSBtYXRyaXggY2Fubm90IGJlIGRlY29tcG9zZWQsIHRydWUgaWYgaXQgY2FuXG4qL1xudmFyIFZlY3RvcjQgPSByZXF1aXJlKCcuLi9WZWN0b3I0LmpzJyk7XG5mdW5jdGlvbiBkZWNvbXBvc2UobWF0cml4KSB7XG4gIHZhciBwZXJzcGVjdGl2ZU1hdHJpeCwgcmlnaHRIYW5kU2lkZSwgaW52ZXJzZVBlcnNwZWN0aXZlTWF0cml4LCB0cmFuc3Bvc2VkSW52ZXJzZVBlcnNwZWN0aXZlTWF0cml4LFxuICAgICAgcGVyc3BlY3RpdmUsIHRyYW5zbGF0ZSwgcm93LCBpLCBsZW4sIHNjYWxlLCBza2V3LCBwZHVtMywgcm90YXRlO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgbWF0cml4LlxuICBpZiAobWF0cml4Lm0zMyA9PSAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGZvciAoaSA9IDE7IGkgPD0gNDsgaSsrKSB7XG4gICAgZm9yIChqID0gMTsgaiA8IDQ7IGorKykge1xuICAgICAgbWF0cml4WydtJytpK2pdIC89IG1hdHJpeC5tNDQ7XG4gICAgfVxuICB9XG5cbiAgLy8gcGVyc3BlY3RpdmVNYXRyaXggaXMgdXNlZCB0byBzb2x2ZSBmb3IgcGVyc3BlY3RpdmUsIGJ1dCBpdCBhbHNvIHByb3ZpZGVzXG4gIC8vIGFuIGVhc3kgd2F5IHRvIHRlc3QgZm9yIHNpbmd1bGFyaXR5IG9mIHRoZSB1cHBlciAzeDMgY29tcG9uZW50LlxuICBwZXJzcGVjdGl2ZU1hdHJpeCA9IG1hdHJpeDtcbiAgcGVyc3BlY3RpdmVNYXRyaXgubTE0ID0gMDtcbiAgcGVyc3BlY3RpdmVNYXRyaXgubTI0ID0gMDtcbiAgcGVyc3BlY3RpdmVNYXRyaXgubTM0ID0gMDtcbiAgcGVyc3BlY3RpdmVNYXRyaXgubTQ0ID0gMTtcblxuICBpZiAoZGV0ZXJtaW5hbnQ0eDQocGVyc3BlY3RpdmVNYXRyaXgpID09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBGaXJzdCwgaXNvbGF0ZSBwZXJzcGVjdGl2ZS5cbiAgaWYgKG1hdHJpeC5tMTQgIT0gMCB8fCBtYXRyaXgubTI0ICE9IDAgfHwgbWF0cml4Lm0zNCAhPSAwKSB7XG4gICAgLy8gcmlnaHRIYW5kU2lkZSBpcyB0aGUgcmlnaHQgaGFuZCBzaWRlIG9mIHRoZSBlcXVhdGlvbi5cbiAgICByaWdodEhhbmRTaWRlID0gbmV3IFZlY3RvcjQobWF0cml4Lm0xNCwgbWF0cml4Lm0yNCwgbWF0cml4Lm0zNCwgbWF0cml4Lm00NCk7XG5cbiAgICAvLyBTb2x2ZSB0aGUgZXF1YXRpb24gYnkgaW52ZXJ0aW5nIHBlcnNwZWN0aXZlTWF0cml4IGFuZCBtdWx0aXBseWluZ1xuICAgIC8vIHJpZ2h0SGFuZFNpZGUgYnkgdGhlIGludmVyc2UuXG4gICAgaW52ZXJzZVBlcnNwZWN0aXZlTWF0cml4ID0gaW52ZXJzZShwZXJzcGVjdGl2ZU1hdHJpeCk7XG4gICAgdHJhbnNwb3NlZEludmVyc2VQZXJzcGVjdGl2ZU1hdHJpeCA9IHRyYW5zcG9zZShpbnZlcnNlUGVyc3BlY3RpdmVNYXRyaXgpO1xuICAgIHBlcnNwZWN0aXZlID0gcmlnaHRIYW5kU2lkZS5tdWx0aXBseUJ5TWF0cml4KHRyYW5zcG9zZWRJbnZlcnNlUGVyc3BlY3RpdmVNYXRyaXgpO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIE5vIHBlcnNwZWN0aXZlLlxuICAgIHBlcnNwZWN0aXZlID0gbmV3IFZlY3RvcjQoMCwgMCwgMCwgMSk7XG4gIH1cblxuICAvLyBOZXh0IHRha2UgY2FyZSBvZiB0cmFuc2xhdGlvblxuICB0cmFuc2xhdGUgPSBuZXcgVmVjdG9yNChtYXRyaXgubTQxLCBtYXRyaXgubTQyLCBtYXRyaXgubTQzKTtcblxuICAvLyBOb3cgZ2V0IHNjYWxlIGFuZCBzaGVhci4gJ3JvdycgaXMgYSAzIGVsZW1lbnQgYXJyYXkgb2YgMyBjb21wb25lbnQgdmVjdG9yc1xuICByb3cgPSBbIG5ldyBWZWN0b3I0KCksIG5ldyBWZWN0b3I0KCksIG5ldyBWZWN0b3I0KCkgXTtcbiAgZm9yIChpID0gMSwgbGVuID0gcm93Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcm93W2ktMV0ueCA9IG1hdHJpeFsnbScraSsnMSddO1xuICAgIHJvd1tpLTFdLnkgPSBtYXRyaXhbJ20nK2krJzInXTtcbiAgICByb3dbaS0xXS56ID0gbWF0cml4WydtJytpKyczJ107XG4gIH1cblxuICAvLyBDb21wdXRlIFggc2NhbGUgZmFjdG9yIGFuZCBub3JtYWxpemUgZmlyc3Qgcm93LlxuICBzY2FsZSA9IG5ldyBWZWN0b3I0KCk7XG4gIHNrZXcgPSBuZXcgVmVjdG9yNCgpO1xuXG4gIHNjYWxlLnggPSByb3dbMF0ubGVuZ3RoKCk7XG4gIHJvd1swXSA9IHJvd1swXS5ub3JtYWxpemUoKTtcblxuICAvLyBDb21wdXRlIFhZIHNoZWFyIGZhY3RvciBhbmQgbWFrZSAybmQgcm93IG9ydGhvZ29uYWwgdG8gMXN0LlxuICBza2V3LnggPSByb3dbMF0uZG90KHJvd1sxXSk7XG4gIHJvd1sxXSA9IHJvd1sxXS5jb21iaW5lKHJvd1swXSwgMS4wLCAtc2tldy54KTtcblxuICAvLyBOb3csIGNvbXB1dGUgWSBzY2FsZSBhbmQgbm9ybWFsaXplIDJuZCByb3cuXG4gIHNjYWxlLnkgPSByb3dbMV0ubGVuZ3RoKCk7XG4gIHJvd1sxXSA9IHJvd1sxXS5ub3JtYWxpemUoKTtcbiAgc2tldy54IC89IHNjYWxlLnk7XG5cbiAgLy8gQ29tcHV0ZSBYWiBhbmQgWVogc2hlYXJzLCBvcnRob2dvbmFsaXplIDNyZCByb3dcbiAgc2tldy55ID0gcm93WzBdLmRvdChyb3dbMl0pO1xuICByb3dbMl0gPSByb3dbMl0uY29tYmluZShyb3dbMF0sIDEuMCwgLXNrZXcueSk7XG4gIHNrZXcueiA9IHJvd1sxXS5kb3Qocm93WzJdKTtcbiAgcm93WzJdID0gcm93WzJdLmNvbWJpbmUocm93WzFdLCAxLjAsIC1za2V3LnopO1xuXG4gIC8vIE5leHQsIGdldCBaIHNjYWxlIGFuZCBub3JtYWxpemUgM3JkIHJvdy5cbiAgc2NhbGUueiA9IHJvd1syXS5sZW5ndGgoKTtcbiAgcm93WzJdID0gcm93WzJdLm5vcm1hbGl6ZSgpO1xuICBza2V3LnkgPSAoc2tldy55IC8gc2NhbGUueikgfHwgMDtcbiAgc2tldy56ID0gKHNrZXcueiAvIHNjYWxlLnopIHx8IDA7XG5cbiAgLy8gQXQgdGhpcyBwb2ludCwgdGhlIG1hdHJpeCAoaW4gcm93cykgaXMgb3J0aG9ub3JtYWwuXG4gIC8vIENoZWNrIGZvciBhIGNvb3JkaW5hdGUgc3lzdGVtIGZsaXAuICBJZiB0aGUgZGV0ZXJtaW5hbnRcbiAgLy8gaXMgLTEsIHRoZW4gbmVnYXRlIHRoZSBtYXRyaXggYW5kIHRoZSBzY2FsaW5nIGZhY3RvcnMuXG4gIHBkdW0zID0gcm93WzFdLmNyb3NzKHJvd1syXSk7XG4gIGlmIChyb3dbMF0uZG90KHBkdW0zKSA8IDApIHtcbiAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICBzY2FsZS54ICo9IC0xO1xuICAgICAgcm93W2ldLnggKj0gLTE7XG4gICAgICByb3dbaV0ueSAqPSAtMTtcbiAgICAgIHJvd1tpXS56ICo9IC0xO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5vdywgZ2V0IHRoZSByb3RhdGlvbnMgb3V0XG4gIC8vIEZST00gVzNDXG4gIHJvdGF0ZSA9IG5ldyBWZWN0b3I0KCk7XG4gIHJvdGF0ZS54ID0gMC41ICogTWF0aC5zcXJ0KE1hdGgubWF4KDEgKyByb3dbMF0ueCAtIHJvd1sxXS55IC0gcm93WzJdLnosIDApKTtcbiAgcm90YXRlLnkgPSAwLjUgKiBNYXRoLnNxcnQoTWF0aC5tYXgoMSAtIHJvd1swXS54ICsgcm93WzFdLnkgLSByb3dbMl0ueiwgMCkpO1xuICByb3RhdGUueiA9IDAuNSAqIE1hdGguc3FydChNYXRoLm1heCgxIC0gcm93WzBdLnggLSByb3dbMV0ueSArIHJvd1syXS56LCAwKSk7XG4gIHJvdGF0ZS53ID0gMC41ICogTWF0aC5zcXJ0KE1hdGgubWF4KDEgKyByb3dbMF0ueCArIHJvd1sxXS55ICsgcm93WzJdLnosIDApKTtcblxuICAvLyBpZiAocm93WzJdLnkgPiByb3dbMV0ueikgcm90YXRlWzBdID0gLXJvdGF0ZVswXTtcbiAgLy8gaWYgKHJvd1swXS56ID4gcm93WzJdLngpIHJvdGF0ZVsxXSA9IC1yb3RhdGVbMV07XG4gIC8vIGlmIChyb3dbMV0ueCA+IHJvd1swXS55KSByb3RhdGVbMl0gPSAtcm90YXRlWzJdO1xuXG4gIC8vIEZST00gTU9SRi5KU1xuICByb3RhdGUueSA9IE1hdGguYXNpbigtcm93WzBdLnopO1xuICBpZiAoTWF0aC5jb3Mocm90YXRlLnkpICE9IDApIHtcbiAgICByb3RhdGUueCA9IE1hdGguYXRhbjIocm93WzFdLnosIHJvd1syXS56KTtcbiAgICByb3RhdGUueiA9IE1hdGguYXRhbjIocm93WzBdLnksIHJvd1swXS54KTtcbiAgfSBlbHNlIHtcbiAgICByb3RhdGUueCA9IE1hdGguYXRhbjIoLXJvd1syXS54LCByb3dbMV0ueSk7XG4gICAgcm90YXRlLnogPSAwO1xuICB9XG5cbiAgLy8gRlJPTSBodHRwOi8vYmxvZy5id2hpdGluZy5jby51ay8/cD0yNlxuICAvLyBzY2FsZS54MiA9IE1hdGguc3FydChtYXRyaXgubTExKm1hdHJpeC5tMTEgKyBtYXRyaXgubTIxKm1hdHJpeC5tMjEgKyBtYXRyaXgubTMxKm1hdHJpeC5tMzEpO1xuICAvLyBzY2FsZS55MiA9IE1hdGguc3FydChtYXRyaXgubTEyKm1hdHJpeC5tMTIgKyBtYXRyaXgubTIyKm1hdHJpeC5tMjIgKyBtYXRyaXgubTMyKm1hdHJpeC5tMzIpO1xuICAvLyBzY2FsZS56MiA9IE1hdGguc3FydChtYXRyaXgubTEzKm1hdHJpeC5tMTMgKyBtYXRyaXgubTIzKm1hdHJpeC5tMjMgKyBtYXRyaXgubTMzKm1hdHJpeC5tMzMpO1xuXG4gIC8vIHJvdGF0ZS54MiA9IE1hdGguYXRhbjIobWF0cml4Lm0yMy9zY2FsZS56MiwgbWF0cml4Lm0zMy9zY2FsZS56Mik7XG4gIC8vIHJvdGF0ZS55MiA9IC1NYXRoLmFzaW4obWF0cml4Lm0xMy9zY2FsZS56Mik7XG4gIC8vIHJvdGF0ZS56MiA9IE1hdGguYXRhbjIobWF0cml4Lm0xMi9zY2FsZS55MiwgbWF0cml4Lm0xMS9zY2FsZS54Mik7XG5cbiAgcmV0dXJuIHtcbiAgICBwZXJzcGVjdGl2ZSA6IHBlcnNwZWN0aXZlLFxuICAgIHRyYW5zbGF0ZSAgIDogdHJhbnNsYXRlLFxuICAgIHNrZXcgICAgICAgIDogc2tldyxcbiAgICBzY2FsZSAgICAgICA6IHNjYWxlLFxuICAgIHJvdGF0ZSAgICAgIDogcm90YXRlXG4gIH07XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgbGVuZ3RoICAgICAgICAgICA6IGxlbmd0aCxcbiAgbm9ybWFsaXplICAgICAgICA6IG5vcm1hbGl6ZSxcbiAgZG90ICAgICAgICAgICAgICA6IGRvdCxcbiAgY3Jvc3MgICAgICAgICAgICA6IGNyb3NzLFxuICBjb21iaW5lICAgICAgICAgIDogY29tYmluZSxcbiAgbXVsdGlwbHlCeU1hdHJpeCA6IG11bHRpcGx5QnlNYXRyaXhcbn07XG5cbi8qKlxuICogR2V0IHRoZSBsZW5ndGggb2YgdGhlIHZlY3RvclxuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge2Zsb2F0fVxuICovXG5cbmZ1bmN0aW9uIGxlbmd0aCh2ZWN0b3IpIHtcbiAgcmV0dXJuIE1hdGguc3FydCh2ZWN0b3IueCp2ZWN0b3IueCArIHZlY3Rvci55KnZlY3Rvci55ICsgdmVjdG9yLnoqdmVjdG9yLnopO1xufVxuXG5cbi8qKlxuICogR2V0IGEgbm9ybWFsaXplZCByZXByZXNlbnRhdGlvbiBvZiB0aGUgdmVjdG9yXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7VmVjdG9yNH1cbiAqL1xuXG5mdW5jdGlvbiBub3JtYWxpemUodmVjdG9yKSB7XG4gIHZhciBsZW4gPSBsZW5ndGgodmVjdG9yKSxcbiAgICB2ID0gbmV3IHZlY3Rvci5jb25zdHJ1Y3Rvcih2ZWN0b3IueCAvIGxlbiwgdmVjdG9yLnkgLyBsZW4sIHZlY3Rvci56IC8gbGVuKTtcblxuICByZXR1cm4gdjtcbn1cblxuXG4vKipcbiAqIFZlY3RvciBEb3QtUHJvZHVjdFxuICogQHBhcmFtIHtWZWN0b3I0fSB2IFRoZSBzZWNvbmQgdmVjdG9yIHRvIGFwcGx5IHRoZSBwcm9kdWN0IHRvXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7ZmxvYXR9IFRoZSBEb3QtUHJvZHVjdCBvZiBhIGFuZCBiLlxuICovXG5cbmZ1bmN0aW9uIGRvdChhLCBiKSB7XG4gIHJldHVybiBhLngqYi54ICsgYS55KmIueSArIGEueipiLnogKyBhLncqYi53O1xufVxuXG5cbi8qKlxuICogVmVjdG9yIENyb3NzLVByb2R1Y3RcbiAqIEBwYXJhbSB7VmVjdG9yNH0gdiBUaGUgc2Vjb25kIHZlY3RvciB0byBhcHBseSB0aGUgcHJvZHVjdCB0b1xuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge1ZlY3RvcjR9IFRoZSBDcm9zcy1Qcm9kdWN0IG9mIGEgYW5kIGIuXG4gKi9cblxuZnVuY3Rpb24gY3Jvc3MoYSwgYikge1xuICByZXR1cm4gbmV3IGEuY29uc3RydWN0b3IoXG4gICAgKGEueSAqIGIueikgLSAoYS56ICogYi55KSxcbiAgICAoYS56ICogYi54KSAtIChhLnggKiBiLnopLFxuICAgIChhLnggKiBiLnkpIC0gKGEueSAqIGIueClcbiAgKTtcbn1cblxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiByZXF1aXJlZCBmb3IgbWF0cml4IGRlY29tcG9zaXRpb25cbiAqIEEgSmF2YXNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiBwc2V1ZG8gY29kZSBhdmFpbGFibGUgZnJvbSBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLTJkLXRyYW5zZm9ybXMvI21hdHJpeC1kZWNvbXBvc2l0aW9uXG4gKiBAcGFyYW0ge1ZlY3RvcjR9IGFQb2ludCBBIDNEIHBvaW50XG4gKiBAcGFyYW0ge2Zsb2F0fSBhc2NsXG4gKiBAcGFyYW0ge2Zsb2F0fSBic2NsXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7VmVjdG9yNH1cbiAqL1xuXG5mdW5jdGlvbiBjb21iaW5lKGFQb2ludCwgYlBvaW50LCBhc2NsLCBic2NsKSB7XG4gIHJldHVybiBuZXcgYVBvaW50LmNvbnN0cnVjdG9yKFxuICAgIChhc2NsICogYVBvaW50LngpICsgKGJzY2wgKiBiUG9pbnQueCksXG4gICAgKGFzY2wgKiBhUG9pbnQueSkgKyAoYnNjbCAqIGJQb2ludC55KSxcbiAgICAoYXNjbCAqIGFQb2ludC56KSArIChic2NsICogYlBvaW50LnopXG4gICk7XG59XG5cbmZ1bmN0aW9uIG11bHRpcGx5QnlNYXRyaXgodmVjdG9yLCBtYXRyaXgpIHtcbiAgcmV0dXJuIG5ldyB2ZWN0b3IuY29uc3RydWN0b3IoXG4gICAgKG1hdHJpeC5tMTEgKiB2ZWN0b3IueCkgKyAobWF0cml4Lm0xMiAqIHZlY3Rvci55KSArIChtYXRyaXgubTEzICogdmVjdG9yLnopLFxuICAgIChtYXRyaXgubTIxICogdmVjdG9yLngpICsgKG1hdHJpeC5tMjIgKiB2ZWN0b3IueSkgKyAobWF0cml4Lm0yMyAqIHZlY3Rvci56KSxcbiAgICAobWF0cml4Lm0zMSAqIHZlY3Rvci54KSArIChtYXRyaXgubTMyICogdmVjdG9yLnkpICsgKG1hdHJpeC5tMzMgKiB2ZWN0b3IueilcbiAgKTtcbn1cbiIsImZ1bmN0aW9uIERPTVBhcnNlcihvcHRpb25zKXtcclxuXHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8e2xvY2F0b3I6e319O1xyXG5cdFxyXG59XHJcbkRPTVBhcnNlci5wcm90b3R5cGUucGFyc2VGcm9tU3RyaW5nID0gZnVuY3Rpb24oc291cmNlLG1pbWVUeXBlKXtcdFxyXG5cdHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xyXG5cdHZhciBzYXggPSAgbmV3IFhNTFJlYWRlcigpO1xyXG5cdHZhciBkb21CdWlsZGVyID0gb3B0aW9ucy5kb21CdWlsZGVyIHx8IG5ldyBET01IYW5kbGVyKCk7Ly9jb250ZW50SGFuZGxlciBhbmQgTGV4aWNhbEhhbmRsZXJcclxuXHR2YXIgZXJyb3JIYW5kbGVyID0gb3B0aW9ucy5lcnJvckhhbmRsZXI7XHJcblx0dmFyIGxvY2F0b3IgPSBvcHRpb25zLmxvY2F0b3I7XHJcblx0dmFyIGRlZmF1bHROU01hcCA9IG9wdGlvbnMueG1sbnN8fHt9O1xyXG5cdHZhciBlbnRpdHlNYXAgPSB7J2x0JzonPCcsJ2d0JzonPicsJ2FtcCc6JyYnLCdxdW90JzonXCInLCdhcG9zJzpcIidcIn1cclxuXHRpZihsb2NhdG9yKXtcclxuXHRcdGRvbUJ1aWxkZXIuc2V0RG9jdW1lbnRMb2NhdG9yKGxvY2F0b3IpXHJcblx0fVxyXG5cdFxyXG5cdHNheC5lcnJvckhhbmRsZXIgPSBidWlsZEVycm9ySGFuZGxlcihlcnJvckhhbmRsZXIsZG9tQnVpbGRlcixsb2NhdG9yKTtcclxuXHRzYXguZG9tQnVpbGRlciA9IG9wdGlvbnMuZG9tQnVpbGRlciB8fCBkb21CdWlsZGVyO1xyXG5cdGlmKC9cXC94P2h0bWw/JC8udGVzdChtaW1lVHlwZSkpe1xyXG5cdFx0ZW50aXR5TWFwLm5ic3AgPSAnXFx4YTAnO1xyXG5cdFx0ZW50aXR5TWFwLmNvcHkgPSAnXFx4YTknO1xyXG5cdFx0ZGVmYXVsdE5TTWFwWycnXT0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnO1xyXG5cdH1cclxuXHRkZWZhdWx0TlNNYXAueG1sID0gZGVmYXVsdE5TTWFwLnhtbCB8fCAnaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlJztcclxuXHRpZihzb3VyY2Upe1xyXG5cdFx0c2F4LnBhcnNlKHNvdXJjZSxkZWZhdWx0TlNNYXAsZW50aXR5TWFwKTtcclxuXHR9ZWxzZXtcclxuXHRcdHNheC5lcnJvckhhbmRsZXIuZXJyb3IoXCJpbnZhbGlkIGRvY3VtZW50IHNvdXJjZVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGRvbUJ1aWxkZXIuZG9jdW1lbnQ7XHJcbn1cclxuZnVuY3Rpb24gYnVpbGRFcnJvckhhbmRsZXIoZXJyb3JJbXBsLGRvbUJ1aWxkZXIsbG9jYXRvcil7XHJcblx0aWYoIWVycm9ySW1wbCl7XHJcblx0XHRpZihkb21CdWlsZGVyIGluc3RhbmNlb2YgRE9NSGFuZGxlcil7XHJcblx0XHRcdHJldHVybiBkb21CdWlsZGVyO1xyXG5cdFx0fVxyXG5cdFx0ZXJyb3JJbXBsID0gZG9tQnVpbGRlciA7XHJcblx0fVxyXG5cdHZhciBlcnJvckhhbmRsZXIgPSB7fVxyXG5cdHZhciBpc0NhbGxiYWNrID0gZXJyb3JJbXBsIGluc3RhbmNlb2YgRnVuY3Rpb247XHJcblx0bG9jYXRvciA9IGxvY2F0b3J8fHt9XHJcblx0ZnVuY3Rpb24gYnVpbGQoa2V5KXtcclxuXHRcdHZhciBmbiA9IGVycm9ySW1wbFtrZXldO1xyXG5cdFx0aWYoIWZuICYmIGlzQ2FsbGJhY2spe1xyXG5cdFx0XHRmbiA9IGVycm9ySW1wbC5sZW5ndGggPT0gMj9mdW5jdGlvbihtc2cpe2Vycm9ySW1wbChrZXksbXNnKX06ZXJyb3JJbXBsO1xyXG5cdFx0fVxyXG5cdFx0ZXJyb3JIYW5kbGVyW2tleV0gPSBmbiAmJiBmdW5jdGlvbihtc2cpe1xyXG5cdFx0XHRmbignW3htbGRvbSAnK2tleSsnXVxcdCcrbXNnK19sb2NhdG9yKGxvY2F0b3IpKTtcclxuXHRcdH18fGZ1bmN0aW9uKCl7fTtcclxuXHR9XHJcblx0YnVpbGQoJ3dhcm5pbmcnKTtcclxuXHRidWlsZCgnZXJyb3InKTtcclxuXHRidWlsZCgnZmF0YWxFcnJvcicpO1xyXG5cdHJldHVybiBlcnJvckhhbmRsZXI7XHJcbn1cclxuXHJcbi8vY29uc29sZS5sb2coJyNcXG5cXG5cXG5cXG5cXG5cXG5cXG4jIyMjJylcclxuLyoqXHJcbiAqICtDb250ZW50SGFuZGxlcitFcnJvckhhbmRsZXJcclxuICogK0xleGljYWxIYW5kbGVyK0VudGl0eVJlc29sdmVyMlxyXG4gKiAtRGVjbEhhbmRsZXItRFRESGFuZGxlciBcclxuICogXHJcbiAqIERlZmF1bHRIYW5kbGVyOkVudGl0eVJlc29sdmVyLCBEVERIYW5kbGVyLCBDb250ZW50SGFuZGxlciwgRXJyb3JIYW5kbGVyXHJcbiAqIERlZmF1bHRIYW5kbGVyMjpEZWZhdWx0SGFuZGxlcixMZXhpY2FsSGFuZGxlciwgRGVjbEhhbmRsZXIsIEVudGl0eVJlc29sdmVyMlxyXG4gKiBAbGluayBodHRwOi8vd3d3LnNheHByb2plY3Qub3JnL2FwaWRvYy9vcmcveG1sL3NheC9oZWxwZXJzL0RlZmF1bHRIYW5kbGVyLmh0bWxcclxuICovXHJcbmZ1bmN0aW9uIERPTUhhbmRsZXIoKSB7XHJcbiAgICB0aGlzLmNkYXRhID0gZmFsc2U7XHJcbn1cclxuZnVuY3Rpb24gcG9zaXRpb24obG9jYXRvcixub2RlKXtcclxuXHRub2RlLmxpbmVOdW1iZXIgPSBsb2NhdG9yLmxpbmVOdW1iZXI7XHJcblx0bm9kZS5jb2x1bW5OdW1iZXIgPSBsb2NhdG9yLmNvbHVtbk51bWJlcjtcclxufVxyXG4vKipcclxuICogQHNlZSBvcmcueG1sLnNheC5Db250ZW50SGFuZGxlciNzdGFydERvY3VtZW50XHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L0NvbnRlbnRIYW5kbGVyLmh0bWxcclxuICovIFxyXG5ET01IYW5kbGVyLnByb3RvdHlwZSA9IHtcclxuXHRzdGFydERvY3VtZW50IDogZnVuY3Rpb24oKSB7XHJcbiAgICBcdHRoaXMuZG9jdW1lbnQgPSBuZXcgRE9NSW1wbGVtZW50YXRpb24oKS5jcmVhdGVEb2N1bWVudChudWxsLCBudWxsLCBudWxsKTtcclxuICAgIFx0aWYgKHRoaXMubG9jYXRvcikge1xyXG4gICAgICAgIFx0dGhpcy5kb2N1bWVudC5kb2N1bWVudFVSSSA9IHRoaXMubG9jYXRvci5zeXN0ZW1JZDtcclxuICAgIFx0fVxyXG5cdH0sXHJcblx0c3RhcnRFbGVtZW50OmZ1bmN0aW9uKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lLCBxTmFtZSwgYXR0cnMpIHtcclxuXHRcdHZhciBkb2MgPSB0aGlzLmRvY3VtZW50O1xyXG5cdCAgICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcU5hbWV8fGxvY2FsTmFtZSk7XHJcblx0ICAgIHZhciBsZW4gPSBhdHRycy5sZW5ndGg7XHJcblx0ICAgIGFwcGVuZEVsZW1lbnQodGhpcywgZWwpO1xyXG5cdCAgICB0aGlzLmN1cnJlbnRFbGVtZW50ID0gZWw7XHJcblx0ICAgIFxyXG5cdFx0dGhpcy5sb2NhdG9yICYmIHBvc2l0aW9uKHRoaXMubG9jYXRvcixlbClcclxuXHQgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgbGVuOyBpKyspIHtcclxuXHQgICAgICAgIHZhciBuYW1lc3BhY2VVUkkgPSBhdHRycy5nZXRVUkkoaSk7XHJcblx0ICAgICAgICB2YXIgdmFsdWUgPSBhdHRycy5nZXRWYWx1ZShpKTtcclxuXHQgICAgICAgIHZhciBxTmFtZSA9IGF0dHJzLmdldFFOYW1lKGkpO1xyXG5cdFx0XHR2YXIgYXR0ciA9IGRvYy5jcmVhdGVBdHRyaWJ1dGVOUyhuYW1lc3BhY2VVUkksIHFOYW1lKTtcclxuXHRcdFx0aWYoIGF0dHIuZ2V0T2Zmc2V0KXtcclxuXHRcdFx0XHRwb3NpdGlvbihhdHRyLmdldE9mZnNldCgxKSxhdHRyKVxyXG5cdFx0XHR9XHJcblx0XHRcdGF0dHIudmFsdWUgPSBhdHRyLm5vZGVWYWx1ZSA9IHZhbHVlO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGVOb2RlKGF0dHIpXHJcblx0ICAgIH1cclxuXHR9LFxyXG5cdGVuZEVsZW1lbnQ6ZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUsIHFOYW1lKSB7XHJcblx0XHR2YXIgY3VycmVudCA9IHRoaXMuY3VycmVudEVsZW1lbnRcclxuXHQgICAgdmFyIHRhZ05hbWUgPSBjdXJyZW50LnRhZ05hbWU7XHJcblx0ICAgIHRoaXMuY3VycmVudEVsZW1lbnQgPSBjdXJyZW50LnBhcmVudE5vZGU7XHJcblx0fSxcclxuXHRzdGFydFByZWZpeE1hcHBpbmc6ZnVuY3Rpb24ocHJlZml4LCB1cmkpIHtcclxuXHR9LFxyXG5cdGVuZFByZWZpeE1hcHBpbmc6ZnVuY3Rpb24ocHJlZml4KSB7XHJcblx0fSxcclxuXHRwcm9jZXNzaW5nSW5zdHJ1Y3Rpb246ZnVuY3Rpb24odGFyZ2V0LCBkYXRhKSB7XHJcblx0ICAgIHZhciBpbnMgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZVByb2Nlc3NpbmdJbnN0cnVjdGlvbih0YXJnZXQsIGRhdGEpO1xyXG5cdCAgICB0aGlzLmxvY2F0b3IgJiYgcG9zaXRpb24odGhpcy5sb2NhdG9yLGlucylcclxuXHQgICAgYXBwZW5kRWxlbWVudCh0aGlzLCBpbnMpO1xyXG5cdH0sXHJcblx0aWdub3JhYmxlV2hpdGVzcGFjZTpmdW5jdGlvbihjaCwgc3RhcnQsIGxlbmd0aCkge1xyXG5cdH0sXHJcblx0Y2hhcmFjdGVyczpmdW5jdGlvbihjaGFycywgc3RhcnQsIGxlbmd0aCkge1xyXG5cdFx0Y2hhcnMgPSBfdG9TdHJpbmcuYXBwbHkodGhpcyxhcmd1bWVudHMpXHJcblx0XHQvL2NvbnNvbGUubG9nKGNoYXJzKVxyXG5cdFx0aWYodGhpcy5jdXJyZW50RWxlbWVudCAmJiBjaGFycyl7XHJcblx0XHRcdGlmICh0aGlzLmNkYXRhKSB7XHJcblx0XHRcdFx0dmFyIGNoYXJOb2RlID0gdGhpcy5kb2N1bWVudC5jcmVhdGVDREFUQVNlY3Rpb24oY2hhcnMpO1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hhck5vZGUpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciBjaGFyTm9kZSA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hhcnMpO1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hhck5vZGUpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMubG9jYXRvciAmJiBwb3NpdGlvbih0aGlzLmxvY2F0b3IsY2hhck5vZGUpXHJcblx0XHR9XHJcblx0fSxcclxuXHRza2lwcGVkRW50aXR5OmZ1bmN0aW9uKG5hbWUpIHtcclxuXHR9LFxyXG5cdGVuZERvY3VtZW50OmZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy5kb2N1bWVudC5ub3JtYWxpemUoKTtcclxuXHR9LFxyXG5cdHNldERvY3VtZW50TG9jYXRvcjpmdW5jdGlvbiAobG9jYXRvcikge1xyXG5cdCAgICBpZih0aGlzLmxvY2F0b3IgPSBsb2NhdG9yKXsvLyAmJiAhKCdsaW5lTnVtYmVyJyBpbiBsb2NhdG9yKSl7XHJcblx0ICAgIFx0bG9jYXRvci5saW5lTnVtYmVyID0gMDtcclxuXHQgICAgfVxyXG5cdH0sXHJcblx0Ly9MZXhpY2FsSGFuZGxlclxyXG5cdGNvbW1lbnQ6ZnVuY3Rpb24oY2hhcnMsIHN0YXJ0LCBsZW5ndGgpIHtcclxuXHRcdGNoYXJzID0gX3RvU3RyaW5nLmFwcGx5KHRoaXMsYXJndW1lbnRzKVxyXG5cdCAgICB2YXIgY29tbSA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlQ29tbWVudChjaGFycyk7XHJcblx0ICAgIHRoaXMubG9jYXRvciAmJiBwb3NpdGlvbih0aGlzLmxvY2F0b3IsY29tbSlcclxuXHQgICAgYXBwZW5kRWxlbWVudCh0aGlzLCBjb21tKTtcclxuXHR9LFxyXG5cdFxyXG5cdHN0YXJ0Q0RBVEE6ZnVuY3Rpb24oKSB7XHJcblx0ICAgIC8vdXNlZCBpbiBjaGFyYWN0ZXJzKCkgbWV0aG9kc1xyXG5cdCAgICB0aGlzLmNkYXRhID0gdHJ1ZTtcclxuXHR9LFxyXG5cdGVuZENEQVRBOmZ1bmN0aW9uKCkge1xyXG5cdCAgICB0aGlzLmNkYXRhID0gZmFsc2U7XHJcblx0fSxcclxuXHRcclxuXHRzdGFydERURDpmdW5jdGlvbihuYW1lLCBwdWJsaWNJZCwgc3lzdGVtSWQpIHtcclxuXHRcdHZhciBpbXBsID0gdGhpcy5kb2N1bWVudC5pbXBsZW1lbnRhdGlvbjtcclxuXHQgICAgaWYgKGltcGwgJiYgaW1wbC5jcmVhdGVEb2N1bWVudFR5cGUpIHtcclxuXHQgICAgICAgIHZhciBkdCA9IGltcGwuY3JlYXRlRG9jdW1lbnRUeXBlKG5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZCk7XHJcblx0ICAgICAgICB0aGlzLmxvY2F0b3IgJiYgcG9zaXRpb24odGhpcy5sb2NhdG9yLGR0KVxyXG5cdCAgICAgICAgYXBwZW5kRWxlbWVudCh0aGlzLCBkdCk7XHJcblx0ICAgIH1cclxuXHR9LFxyXG5cdC8qKlxyXG5cdCAqIEBzZWUgb3JnLnhtbC5zYXguRXJyb3JIYW5kbGVyXHJcblx0ICogQGxpbmsgaHR0cDovL3d3dy5zYXhwcm9qZWN0Lm9yZy9hcGlkb2Mvb3JnL3htbC9zYXgvRXJyb3JIYW5kbGVyLmh0bWxcclxuXHQgKi9cclxuXHR3YXJuaW5nOmZ1bmN0aW9uKGVycm9yKSB7XHJcblx0XHRjb25zb2xlLndhcm4oJ1t4bWxkb20gd2FybmluZ11cXHQnK2Vycm9yLF9sb2NhdG9yKHRoaXMubG9jYXRvcikpO1xyXG5cdH0sXHJcblx0ZXJyb3I6ZnVuY3Rpb24oZXJyb3IpIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoJ1t4bWxkb20gZXJyb3JdXFx0JytlcnJvcixfbG9jYXRvcih0aGlzLmxvY2F0b3IpKTtcclxuXHR9LFxyXG5cdGZhdGFsRXJyb3I6ZnVuY3Rpb24oZXJyb3IpIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoJ1t4bWxkb20gZmF0YWxFcnJvcl1cXHQnK2Vycm9yLF9sb2NhdG9yKHRoaXMubG9jYXRvcikpO1xyXG5cdCAgICB0aHJvdyBlcnJvcjtcclxuXHR9XHJcbn1cclxuZnVuY3Rpb24gX2xvY2F0b3IobCl7XHJcblx0aWYobCl7XHJcblx0XHRyZXR1cm4gJ1xcbkAnKyhsLnN5c3RlbUlkIHx8JycpKycjW2xpbmU6JytsLmxpbmVOdW1iZXIrJyxjb2w6JytsLmNvbHVtbk51bWJlcisnXSdcclxuXHR9XHJcbn1cclxuZnVuY3Rpb24gX3RvU3RyaW5nKGNoYXJzLHN0YXJ0LGxlbmd0aCl7XHJcblx0aWYodHlwZW9mIGNoYXJzID09ICdzdHJpbmcnKXtcclxuXHRcdHJldHVybiBjaGFycy5zdWJzdHIoc3RhcnQsbGVuZ3RoKVxyXG5cdH1lbHNley8vamF2YSBzYXggY29ubmVjdCB3aWR0aCB4bWxkb20gb24gcmhpbm8od2hhdCBhYm91dDogXCI/ICYmICEoY2hhcnMgaW5zdGFuY2VvZiBTdHJpbmcpXCIpXHJcblx0XHRpZihjaGFycy5sZW5ndGggPj0gc3RhcnQrbGVuZ3RoIHx8IHN0YXJ0KXtcclxuXHRcdFx0cmV0dXJuIG5ldyBqYXZhLmxhbmcuU3RyaW5nKGNoYXJzLHN0YXJ0LGxlbmd0aCkrJyc7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gY2hhcnM7XHJcblx0fVxyXG59XHJcblxyXG4vKlxyXG4gKiBAbGluayBodHRwOi8vd3d3LnNheHByb2plY3Qub3JnL2FwaWRvYy9vcmcveG1sL3NheC9leHQvTGV4aWNhbEhhbmRsZXIuaHRtbFxyXG4gKiB1c2VkIG1ldGhvZCBvZiBvcmcueG1sLnNheC5leHQuTGV4aWNhbEhhbmRsZXI6XHJcbiAqICAjY29tbWVudChjaGFycywgc3RhcnQsIGxlbmd0aClcclxuICogICNzdGFydENEQVRBKClcclxuICogICNlbmRDREFUQSgpXHJcbiAqICAjc3RhcnREVEQobmFtZSwgcHVibGljSWQsIHN5c3RlbUlkKVxyXG4gKlxyXG4gKlxyXG4gKiBJR05PUkVEIG1ldGhvZCBvZiBvcmcueG1sLnNheC5leHQuTGV4aWNhbEhhbmRsZXI6XHJcbiAqICAjZW5kRFREKClcclxuICogICNzdGFydEVudGl0eShuYW1lKVxyXG4gKiAgI2VuZEVudGl0eShuYW1lKVxyXG4gKlxyXG4gKlxyXG4gKiBAbGluayBodHRwOi8vd3d3LnNheHByb2plY3Qub3JnL2FwaWRvYy9vcmcveG1sL3NheC9leHQvRGVjbEhhbmRsZXIuaHRtbFxyXG4gKiBJR05PUkVEIG1ldGhvZCBvZiBvcmcueG1sLnNheC5leHQuRGVjbEhhbmRsZXJcclxuICogXHQjYXR0cmlidXRlRGVjbChlTmFtZSwgYU5hbWUsIHR5cGUsIG1vZGUsIHZhbHVlKVxyXG4gKiAgI2VsZW1lbnREZWNsKG5hbWUsIG1vZGVsKVxyXG4gKiAgI2V4dGVybmFsRW50aXR5RGVjbChuYW1lLCBwdWJsaWNJZCwgc3lzdGVtSWQpXHJcbiAqICAjaW50ZXJuYWxFbnRpdHlEZWNsKG5hbWUsIHZhbHVlKVxyXG4gKiBAbGluayBodHRwOi8vd3d3LnNheHByb2plY3Qub3JnL2FwaWRvYy9vcmcveG1sL3NheC9leHQvRW50aXR5UmVzb2x2ZXIyLmh0bWxcclxuICogSUdOT1JFRCBtZXRob2Qgb2Ygb3JnLnhtbC5zYXguRW50aXR5UmVzb2x2ZXIyXHJcbiAqICAjcmVzb2x2ZUVudGl0eShTdHJpbmcgbmFtZSxTdHJpbmcgcHVibGljSWQsU3RyaW5nIGJhc2VVUkksU3RyaW5nIHN5c3RlbUlkKVxyXG4gKiAgI3Jlc29sdmVFbnRpdHkocHVibGljSWQsIHN5c3RlbUlkKVxyXG4gKiAgI2dldEV4dGVybmFsU3Vic2V0KG5hbWUsIGJhc2VVUkkpXHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L0RUREhhbmRsZXIuaHRtbFxyXG4gKiBJR05PUkVEIG1ldGhvZCBvZiBvcmcueG1sLnNheC5EVERIYW5kbGVyXHJcbiAqICAjbm90YXRpb25EZWNsKG5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZCkge307XHJcbiAqICAjdW5wYXJzZWRFbnRpdHlEZWNsKG5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZCwgbm90YXRpb25OYW1lKSB7fTtcclxuICovXHJcblwiZW5kRFRELHN0YXJ0RW50aXR5LGVuZEVudGl0eSxhdHRyaWJ1dGVEZWNsLGVsZW1lbnREZWNsLGV4dGVybmFsRW50aXR5RGVjbCxpbnRlcm5hbEVudGl0eURlY2wscmVzb2x2ZUVudGl0eSxnZXRFeHRlcm5hbFN1YnNldCxub3RhdGlvbkRlY2wsdW5wYXJzZWRFbnRpdHlEZWNsXCIucmVwbGFjZSgvXFx3Ky9nLGZ1bmN0aW9uKGtleSl7XHJcblx0RE9NSGFuZGxlci5wcm90b3R5cGVba2V5XSA9IGZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9XHJcbn0pXHJcblxyXG4vKiBQcml2YXRlIHN0YXRpYyBoZWxwZXJzIHRyZWF0ZWQgYmVsb3cgYXMgcHJpdmF0ZSBpbnN0YW5jZSBtZXRob2RzLCBzbyBkb24ndCBuZWVkIHRvIGFkZCB0aGVzZSB0byB0aGUgcHVibGljIEFQSTsgd2UgbWlnaHQgdXNlIGEgUmVsYXRvciB0byBhbHNvIGdldCByaWQgb2Ygbm9uLXN0YW5kYXJkIHB1YmxpYyBwcm9wZXJ0aWVzICovXHJcbmZ1bmN0aW9uIGFwcGVuZEVsZW1lbnQgKGhhbmRlcixub2RlKSB7XHJcbiAgICBpZiAoIWhhbmRlci5jdXJyZW50RWxlbWVudCkge1xyXG4gICAgICAgIGhhbmRlci5kb2N1bWVudC5hcHBlbmRDaGlsZChub2RlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaGFuZGVyLmN1cnJlbnRFbGVtZW50LmFwcGVuZENoaWxkKG5vZGUpO1xyXG4gICAgfVxyXG59Ly9hcHBlbmRDaGlsZCBhbmQgc2V0QXR0cmlidXRlTlMgYXJlIHByZWZvcm1hbmNlIGtleVxyXG5cclxuaWYodHlwZW9mIHJlcXVpcmUgPT0gJ2Z1bmN0aW9uJyl7XHJcblx0dmFyIFhNTFJlYWRlciA9IHJlcXVpcmUoJy4vc2F4JykuWE1MUmVhZGVyO1xyXG5cdHZhciBET01JbXBsZW1lbnRhdGlvbiA9IGV4cG9ydHMuRE9NSW1wbGVtZW50YXRpb24gPSByZXF1aXJlKCcuL2RvbScpLkRPTUltcGxlbWVudGF0aW9uO1xyXG5cdGV4cG9ydHMuWE1MU2VyaWFsaXplciA9IHJlcXVpcmUoJy4vZG9tJykuWE1MU2VyaWFsaXplciA7XHJcblx0ZXhwb3J0cy5ET01QYXJzZXIgPSBET01QYXJzZXI7XHJcbn1cclxuIiwiLypcbiAqIERPTSBMZXZlbCAyXG4gKiBPYmplY3QgRE9NRXhjZXB0aW9uXG4gKiBAc2VlIGh0dHA6Ly93d3cudzMub3JnL1RSL1JFQy1ET00tTGV2ZWwtMS9lY21hLXNjcmlwdC1sYW5ndWFnZS1iaW5kaW5nLmh0bWxcbiAqIEBzZWUgaHR0cDovL3d3dy53My5vcmcvVFIvMjAwMC9SRUMtRE9NLUxldmVsLTItQ29yZS0yMDAwMTExMy9lY21hLXNjcmlwdC1iaW5kaW5nLmh0bWxcbiAqL1xuXG5mdW5jdGlvbiBjb3B5KHNyYyxkZXN0KXtcblx0Zm9yKHZhciBwIGluIHNyYyl7XG5cdFx0ZGVzdFtwXSA9IHNyY1twXTtcblx0fVxufVxuLyoqXG5eXFx3K1xcLnByb3RvdHlwZVxcLihbX1xcd10rKVxccyo9XFxzKigoPzouKlxce1xccyo/W1xcclxcbl1bXFxzXFxTXSo/Xn0pfFxcUy4qPyg/PVs7XFxyXFxuXSkpOz9cbl5cXHcrXFwucHJvdG90eXBlXFwuKFtfXFx3XSspXFxzKj1cXHMqKFxcUy4qPyg/PVs7XFxyXFxuXSkpOz9cbiAqL1xuZnVuY3Rpb24gX2V4dGVuZHMoQ2xhc3MsU3VwZXIpe1xuXHR2YXIgcHQgPSBDbGFzcy5wcm90b3R5cGU7XG5cdGlmKE9iamVjdC5jcmVhdGUpe1xuXHRcdHZhciBwcHQgPSBPYmplY3QuY3JlYXRlKFN1cGVyLnByb3RvdHlwZSlcblx0XHRwdC5fX3Byb3RvX18gPSBwcHQ7XG5cdH1cblx0aWYoIShwdCBpbnN0YW5jZW9mIFN1cGVyKSl7XG5cdFx0ZnVuY3Rpb24gdCgpe307XG5cdFx0dC5wcm90b3R5cGUgPSBTdXBlci5wcm90b3R5cGU7XG5cdFx0dCA9IG5ldyB0KCk7XG5cdFx0Y29weShwdCx0KTtcblx0XHRDbGFzcy5wcm90b3R5cGUgPSBwdCA9IHQ7XG5cdH1cblx0aWYocHQuY29uc3RydWN0b3IgIT0gQ2xhc3Mpe1xuXHRcdGlmKHR5cGVvZiBDbGFzcyAhPSAnZnVuY3Rpb24nKXtcblx0XHRcdGNvbnNvbGUuZXJyb3IoXCJ1bmtub3cgQ2xhc3M6XCIrQ2xhc3MpXG5cdFx0fVxuXHRcdHB0LmNvbnN0cnVjdG9yID0gQ2xhc3Ncblx0fVxufVxudmFyIGh0bWxucyA9ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sJyA7XG4vLyBOb2RlIFR5cGVzXG52YXIgTm9kZVR5cGUgPSB7fVxudmFyIEVMRU1FTlRfTk9ERSAgICAgICAgICAgICAgICA9IE5vZGVUeXBlLkVMRU1FTlRfTk9ERSAgICAgICAgICAgICAgICA9IDE7XG52YXIgQVRUUklCVVRFX05PREUgICAgICAgICAgICAgID0gTm9kZVR5cGUuQVRUUklCVVRFX05PREUgICAgICAgICAgICAgID0gMjtcbnZhciBURVhUX05PREUgICAgICAgICAgICAgICAgICAgPSBOb2RlVHlwZS5URVhUX05PREUgICAgICAgICAgICAgICAgICAgPSAzO1xudmFyIENEQVRBX1NFQ1RJT05fTk9ERSAgICAgICAgICA9IE5vZGVUeXBlLkNEQVRBX1NFQ1RJT05fTk9ERSAgICAgICAgICA9IDQ7XG52YXIgRU5USVRZX1JFRkVSRU5DRV9OT0RFICAgICAgID0gTm9kZVR5cGUuRU5USVRZX1JFRkVSRU5DRV9OT0RFICAgICAgID0gNTtcbnZhciBFTlRJVFlfTk9ERSAgICAgICAgICAgICAgICAgPSBOb2RlVHlwZS5FTlRJVFlfTk9ERSAgICAgICAgICAgICAgICAgPSA2O1xudmFyIFBST0NFU1NJTkdfSU5TVFJVQ1RJT05fTk9ERSA9IE5vZGVUeXBlLlBST0NFU1NJTkdfSU5TVFJVQ1RJT05fTk9ERSA9IDc7XG52YXIgQ09NTUVOVF9OT0RFICAgICAgICAgICAgICAgID0gTm9kZVR5cGUuQ09NTUVOVF9OT0RFICAgICAgICAgICAgICAgID0gODtcbnZhciBET0NVTUVOVF9OT0RFICAgICAgICAgICAgICAgPSBOb2RlVHlwZS5ET0NVTUVOVF9OT0RFICAgICAgICAgICAgICAgPSA5O1xudmFyIERPQ1VNRU5UX1RZUEVfTk9ERSAgICAgICAgICA9IE5vZGVUeXBlLkRPQ1VNRU5UX1RZUEVfTk9ERSAgICAgICAgICA9IDEwO1xudmFyIERPQ1VNRU5UX0ZSQUdNRU5UX05PREUgICAgICA9IE5vZGVUeXBlLkRPQ1VNRU5UX0ZSQUdNRU5UX05PREUgICAgICA9IDExO1xudmFyIE5PVEFUSU9OX05PREUgICAgICAgICAgICAgICA9IE5vZGVUeXBlLk5PVEFUSU9OX05PREUgICAgICAgICAgICAgICA9IDEyO1xuXG4vLyBFeGNlcHRpb25Db2RlXG52YXIgRXhjZXB0aW9uQ29kZSA9IHt9XG52YXIgRXhjZXB0aW9uTWVzc2FnZSA9IHt9O1xudmFyIElOREVYX1NJWkVfRVJSICAgICAgICAgICAgICA9IEV4Y2VwdGlvbkNvZGUuSU5ERVhfU0laRV9FUlIgICAgICAgICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzFdPVwiSW5kZXggc2l6ZSBlcnJvclwiKSwxKTtcbnZhciBET01TVFJJTkdfU0laRV9FUlIgICAgICAgICAgPSBFeGNlcHRpb25Db2RlLkRPTVNUUklOR19TSVpFX0VSUiAgICAgICAgICA9ICgoRXhjZXB0aW9uTWVzc2FnZVsyXT1cIkRPTVN0cmluZyBzaXplIGVycm9yXCIpLDIpO1xudmFyIEhJRVJBUkNIWV9SRVFVRVNUX0VSUiAgICAgICA9IEV4Y2VwdGlvbkNvZGUuSElFUkFSQ0hZX1JFUVVFU1RfRVJSICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzNdPVwiSGllcmFyY2h5IHJlcXVlc3QgZXJyb3JcIiksMyk7XG52YXIgV1JPTkdfRE9DVU1FTlRfRVJSICAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5XUk9OR19ET0NVTUVOVF9FUlIgICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbNF09XCJXcm9uZyBkb2N1bWVudFwiKSw0KTtcbnZhciBJTlZBTElEX0NIQVJBQ1RFUl9FUlIgICAgICAgPSBFeGNlcHRpb25Db2RlLklOVkFMSURfQ0hBUkFDVEVSX0VSUiAgICAgICA9ICgoRXhjZXB0aW9uTWVzc2FnZVs1XT1cIkludmFsaWQgY2hhcmFjdGVyXCIpLDUpO1xudmFyIE5PX0RBVEFfQUxMT1dFRF9FUlIgICAgICAgICA9IEV4Y2VwdGlvbkNvZGUuTk9fREFUQV9BTExPV0VEX0VSUiAgICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzZdPVwiTm8gZGF0YSBhbGxvd2VkXCIpLDYpO1xudmFyIE5PX01PRElGSUNBVElPTl9BTExPV0VEX0VSUiA9IEV4Y2VwdGlvbkNvZGUuTk9fTU9ESUZJQ0FUSU9OX0FMTE9XRURfRVJSID0gKChFeGNlcHRpb25NZXNzYWdlWzddPVwiTm8gbW9kaWZpY2F0aW9uIGFsbG93ZWRcIiksNyk7XG52YXIgTk9UX0ZPVU5EX0VSUiAgICAgICAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5OT1RfRk9VTkRfRVJSICAgICAgICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbOF09XCJOb3QgZm91bmRcIiksOCk7XG52YXIgTk9UX1NVUFBPUlRFRF9FUlIgICAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5OT1RfU1VQUE9SVEVEX0VSUiAgICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbOV09XCJOb3Qgc3VwcG9ydGVkXCIpLDkpO1xudmFyIElOVVNFX0FUVFJJQlVURV9FUlIgICAgICAgICA9IEV4Y2VwdGlvbkNvZGUuSU5VU0VfQVRUUklCVVRFX0VSUiAgICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzEwXT1cIkF0dHJpYnV0ZSBpbiB1c2VcIiksMTApO1xuLy9sZXZlbDJcbnZhciBJTlZBTElEX1NUQVRFX0VSUiAgICAgICAgXHQ9IEV4Y2VwdGlvbkNvZGUuSU5WQUxJRF9TVEFURV9FUlIgICAgICAgIFx0PSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMTFdPVwiSW52YWxpZCBzdGF0ZVwiKSwxMSk7XG52YXIgU1lOVEFYX0VSUiAgICAgICAgICAgICAgIFx0PSBFeGNlcHRpb25Db2RlLlNZTlRBWF9FUlIgICAgICAgICAgICAgICBcdD0gKChFeGNlcHRpb25NZXNzYWdlWzEyXT1cIlN5bnRheCBlcnJvclwiKSwxMik7XG52YXIgSU5WQUxJRF9NT0RJRklDQVRJT05fRVJSIFx0PSBFeGNlcHRpb25Db2RlLklOVkFMSURfTU9ESUZJQ0FUSU9OX0VSUiBcdD0gKChFeGNlcHRpb25NZXNzYWdlWzEzXT1cIkludmFsaWQgbW9kaWZpY2F0aW9uXCIpLDEzKTtcbnZhciBOQU1FU1BBQ0VfRVJSICAgICAgICAgICAgXHQ9IEV4Y2VwdGlvbkNvZGUuTkFNRVNQQUNFX0VSUiAgICAgICAgICAgXHQ9ICgoRXhjZXB0aW9uTWVzc2FnZVsxNF09XCJJbnZhbGlkIG5hbWVzcGFjZVwiKSwxNCk7XG52YXIgSU5WQUxJRF9BQ0NFU1NfRVJSICAgICAgIFx0PSBFeGNlcHRpb25Db2RlLklOVkFMSURfQUNDRVNTX0VSUiAgICAgIFx0PSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMTVdPVwiSW52YWxpZCBhY2Nlc3NcIiksMTUpO1xuXG5cbmZ1bmN0aW9uIERPTUV4Y2VwdGlvbihjb2RlLCBtZXNzYWdlKSB7XG5cdGlmKG1lc3NhZ2UgaW5zdGFuY2VvZiBFcnJvcil7XG5cdFx0dmFyIGVycm9yID0gbWVzc2FnZTtcblx0fWVsc2V7XG5cdFx0ZXJyb3IgPSB0aGlzO1xuXHRcdEVycm9yLmNhbGwodGhpcywgRXhjZXB0aW9uTWVzc2FnZVtjb2RlXSk7XG5cdFx0dGhpcy5tZXNzYWdlID0gRXhjZXB0aW9uTWVzc2FnZVtjb2RlXTtcblx0XHRpZihFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgRE9NRXhjZXB0aW9uKTtcblx0fVxuXHRlcnJvci5jb2RlID0gY29kZTtcblx0aWYobWVzc2FnZSkgdGhpcy5tZXNzYWdlID0gdGhpcy5tZXNzYWdlICsgXCI6IFwiICsgbWVzc2FnZTtcblx0cmV0dXJuIGVycm9yO1xufTtcbkRPTUV4Y2VwdGlvbi5wcm90b3R5cGUgPSBFcnJvci5wcm90b3R5cGU7XG5jb3B5KEV4Y2VwdGlvbkNvZGUsRE9NRXhjZXB0aW9uKVxuLyoqXG4gKiBAc2VlIGh0dHA6Ly93d3cudzMub3JnL1RSLzIwMDAvUkVDLURPTS1MZXZlbC0yLUNvcmUtMjAwMDExMTMvY29yZS5odG1sI0lELTUzNjI5NzE3N1xuICogVGhlIE5vZGVMaXN0IGludGVyZmFjZSBwcm92aWRlcyB0aGUgYWJzdHJhY3Rpb24gb2YgYW4gb3JkZXJlZCBjb2xsZWN0aW9uIG9mIG5vZGVzLCB3aXRob3V0IGRlZmluaW5nIG9yIGNvbnN0cmFpbmluZyBob3cgdGhpcyBjb2xsZWN0aW9uIGlzIGltcGxlbWVudGVkLiBOb2RlTGlzdCBvYmplY3RzIGluIHRoZSBET00gYXJlIGxpdmUuXG4gKiBUaGUgaXRlbXMgaW4gdGhlIE5vZGVMaXN0IGFyZSBhY2Nlc3NpYmxlIHZpYSBhbiBpbnRlZ3JhbCBpbmRleCwgc3RhcnRpbmcgZnJvbSAwLlxuICovXG5mdW5jdGlvbiBOb2RlTGlzdCgpIHtcbn07XG5Ob2RlTGlzdC5wcm90b3R5cGUgPSB7XG5cdC8qKlxuXHQgKiBUaGUgbnVtYmVyIG9mIG5vZGVzIGluIHRoZSBsaXN0LiBUaGUgcmFuZ2Ugb2YgdmFsaWQgY2hpbGQgbm9kZSBpbmRpY2VzIGlzIDAgdG8gbGVuZ3RoLTEgaW5jbHVzaXZlLlxuXHQgKiBAc3RhbmRhcmQgbGV2ZWwxXG5cdCAqL1xuXHRsZW5ndGg6MCwgXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBpbmRleHRoIGl0ZW0gaW4gdGhlIGNvbGxlY3Rpb24uIElmIGluZGV4IGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byB0aGUgbnVtYmVyIG9mIG5vZGVzIGluIHRoZSBsaXN0LCB0aGlzIHJldHVybnMgbnVsbC5cblx0ICogQHN0YW5kYXJkIGxldmVsMVxuXHQgKiBAcGFyYW0gaW5kZXggIHVuc2lnbmVkIGxvbmcgXG5cdCAqICAgSW5kZXggaW50byB0aGUgY29sbGVjdGlvbi5cblx0ICogQHJldHVybiBOb2RlXG5cdCAqIFx0VGhlIG5vZGUgYXQgdGhlIGluZGV4dGggcG9zaXRpb24gaW4gdGhlIE5vZGVMaXN0LCBvciBudWxsIGlmIHRoYXQgaXMgbm90IGEgdmFsaWQgaW5kZXguIFxuXHQgKi9cblx0aXRlbTogZnVuY3Rpb24oaW5kZXgpIHtcblx0XHRyZXR1cm4gdGhpc1tpbmRleF0gfHwgbnVsbDtcblx0fSxcblx0dG9TdHJpbmc6ZnVuY3Rpb24oKXtcblx0XHRmb3IodmFyIGJ1ZiA9IFtdLCBpID0gMDtpPHRoaXMubGVuZ3RoO2krKyl7XG5cdFx0XHRzZXJpYWxpemVUb1N0cmluZyh0aGlzW2ldLGJ1Zik7XG5cdFx0fVxuXHRcdHJldHVybiBidWYuam9pbignJyk7XG5cdH1cbn07XG5mdW5jdGlvbiBMaXZlTm9kZUxpc3Qobm9kZSxyZWZyZXNoKXtcblx0dGhpcy5fbm9kZSA9IG5vZGU7XG5cdHRoaXMuX3JlZnJlc2ggPSByZWZyZXNoXG5cdF91cGRhdGVMaXZlTGlzdCh0aGlzKTtcbn1cbmZ1bmN0aW9uIF91cGRhdGVMaXZlTGlzdChsaXN0KXtcblx0dmFyIGluYyA9IGxpc3QuX25vZGUuX2luYyB8fCBsaXN0Ll9ub2RlLm93bmVyRG9jdW1lbnQuX2luYztcblx0aWYobGlzdC5faW5jICE9IGluYyl7XG5cdFx0dmFyIGxzID0gbGlzdC5fcmVmcmVzaChsaXN0Ll9ub2RlKTtcblx0XHQvL2NvbnNvbGUubG9nKGxzLmxlbmd0aClcblx0XHRfX3NldF9fKGxpc3QsJ2xlbmd0aCcsbHMubGVuZ3RoKTtcblx0XHRjb3B5KGxzLGxpc3QpO1xuXHRcdGxpc3QuX2luYyA9IGluYztcblx0fVxufVxuTGl2ZU5vZGVMaXN0LnByb3RvdHlwZS5pdGVtID0gZnVuY3Rpb24oaSl7XG5cdF91cGRhdGVMaXZlTGlzdCh0aGlzKTtcblx0cmV0dXJuIHRoaXNbaV07XG59XG5cbl9leHRlbmRzKExpdmVOb2RlTGlzdCxOb2RlTGlzdCk7XG4vKipcbiAqIFxuICogT2JqZWN0cyBpbXBsZW1lbnRpbmcgdGhlIE5hbWVkTm9kZU1hcCBpbnRlcmZhY2UgYXJlIHVzZWQgdG8gcmVwcmVzZW50IGNvbGxlY3Rpb25zIG9mIG5vZGVzIHRoYXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IG5hbWUuIE5vdGUgdGhhdCBOYW1lZE5vZGVNYXAgZG9lcyBub3QgaW5oZXJpdCBmcm9tIE5vZGVMaXN0OyBOYW1lZE5vZGVNYXBzIGFyZSBub3QgbWFpbnRhaW5lZCBpbiBhbnkgcGFydGljdWxhciBvcmRlci4gT2JqZWN0cyBjb250YWluZWQgaW4gYW4gb2JqZWN0IGltcGxlbWVudGluZyBOYW1lZE5vZGVNYXAgbWF5IGFsc28gYmUgYWNjZXNzZWQgYnkgYW4gb3JkaW5hbCBpbmRleCwgYnV0IHRoaXMgaXMgc2ltcGx5IHRvIGFsbG93IGNvbnZlbmllbnQgZW51bWVyYXRpb24gb2YgdGhlIGNvbnRlbnRzIG9mIGEgTmFtZWROb2RlTWFwLCBhbmQgZG9lcyBub3QgaW1wbHkgdGhhdCB0aGUgRE9NIHNwZWNpZmllcyBhbiBvcmRlciB0byB0aGVzZSBOb2Rlcy5cbiAqIE5hbWVkTm9kZU1hcCBvYmplY3RzIGluIHRoZSBET00gYXJlIGxpdmUuXG4gKiB1c2VkIGZvciBhdHRyaWJ1dGVzIG9yIERvY3VtZW50VHlwZSBlbnRpdGllcyBcbiAqL1xuZnVuY3Rpb24gTmFtZWROb2RlTWFwKCkge1xufTtcblxuZnVuY3Rpb24gX2ZpbmROb2RlSW5kZXgobGlzdCxub2RlKXtcblx0dmFyIGkgPSBsaXN0Lmxlbmd0aDtcblx0d2hpbGUoaS0tKXtcblx0XHRpZihsaXN0W2ldID09PSBub2RlKXtyZXR1cm4gaX1cblx0fVxufVxuXG5mdW5jdGlvbiBfYWRkTmFtZWROb2RlKGVsLGxpc3QsbmV3QXR0cixvbGRBdHRyKXtcblx0aWYob2xkQXR0cil7XG5cdFx0bGlzdFtfZmluZE5vZGVJbmRleChsaXN0LG9sZEF0dHIpXSA9IG5ld0F0dHI7XG5cdH1lbHNle1xuXHRcdGxpc3RbbGlzdC5sZW5ndGgrK10gPSBuZXdBdHRyO1xuXHR9XG5cdGlmKGVsKXtcblx0XHRuZXdBdHRyLm93bmVyRWxlbWVudCA9IGVsO1xuXHRcdHZhciBkb2MgPSBlbC5vd25lckRvY3VtZW50O1xuXHRcdGlmKGRvYyl7XG5cdFx0XHRvbGRBdHRyICYmIF9vblJlbW92ZUF0dHJpYnV0ZShkb2MsZWwsb2xkQXR0cik7XG5cdFx0XHRfb25BZGRBdHRyaWJ1dGUoZG9jLGVsLG5ld0F0dHIpO1xuXHRcdH1cblx0fVxufVxuZnVuY3Rpb24gX3JlbW92ZU5hbWVkTm9kZShlbCxsaXN0LGF0dHIpe1xuXHR2YXIgaSA9IF9maW5kTm9kZUluZGV4KGxpc3QsYXR0cik7XG5cdGlmKGk+PTApe1xuXHRcdHZhciBsYXN0SW5kZXggPSBsaXN0Lmxlbmd0aC0xXG5cdFx0d2hpbGUoaTxsYXN0SW5kZXgpe1xuXHRcdFx0bGlzdFtpXSA9IGxpc3RbKytpXVxuXHRcdH1cblx0XHRsaXN0Lmxlbmd0aCA9IGxhc3RJbmRleDtcblx0XHRpZihlbCl7XG5cdFx0XHR2YXIgZG9jID0gZWwub3duZXJEb2N1bWVudDtcblx0XHRcdGlmKGRvYyl7XG5cdFx0XHRcdF9vblJlbW92ZUF0dHJpYnV0ZShkb2MsZWwsYXR0cik7XG5cdFx0XHRcdGF0dHIub3duZXJFbGVtZW50ID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1lbHNle1xuXHRcdHRocm93IERPTUV4Y2VwdGlvbihOT1RfRk9VTkRfRVJSLG5ldyBFcnJvcigpKVxuXHR9XG59XG5OYW1lZE5vZGVNYXAucHJvdG90eXBlID0ge1xuXHRsZW5ndGg6MCxcblx0aXRlbTpOb2RlTGlzdC5wcm90b3R5cGUuaXRlbSxcblx0Z2V0TmFtZWRJdGVtOiBmdW5jdGlvbihrZXkpIHtcbi8vXHRcdGlmKGtleS5pbmRleE9mKCc6Jyk+MCB8fCBrZXkgPT0gJ3htbG5zJyl7XG4vL1x0XHRcdHJldHVybiBudWxsO1xuLy9cdFx0fVxuXHRcdHZhciBpID0gdGhpcy5sZW5ndGg7XG5cdFx0d2hpbGUoaS0tKXtcblx0XHRcdHZhciBhdHRyID0gdGhpc1tpXTtcblx0XHRcdGlmKGF0dHIubm9kZU5hbWUgPT0ga2V5KXtcblx0XHRcdFx0cmV0dXJuIGF0dHI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHRzZXROYW1lZEl0ZW06IGZ1bmN0aW9uKGF0dHIpIHtcblx0XHR2YXIgZWwgPSBhdHRyLm93bmVyRWxlbWVudDtcblx0XHRpZihlbCAmJiBlbCE9dGhpcy5fb3duZXJFbGVtZW50KXtcblx0XHRcdHRocm93IG5ldyBET01FeGNlcHRpb24oSU5VU0VfQVRUUklCVVRFX0VSUik7XG5cdFx0fVxuXHRcdHZhciBvbGRBdHRyID0gdGhpcy5nZXROYW1lZEl0ZW0oYXR0ci5ub2RlTmFtZSk7XG5cdFx0X2FkZE5hbWVkTm9kZSh0aGlzLl9vd25lckVsZW1lbnQsdGhpcyxhdHRyLG9sZEF0dHIpO1xuXHRcdHJldHVybiBvbGRBdHRyO1xuXHR9LFxuXHQvKiByZXR1cm5zIE5vZGUgKi9cblx0c2V0TmFtZWRJdGVtTlM6IGZ1bmN0aW9uKGF0dHIpIHsvLyByYWlzZXM6IFdST05HX0RPQ1VNRU5UX0VSUixOT19NT0RJRklDQVRJT05fQUxMT1dFRF9FUlIsSU5VU0VfQVRUUklCVVRFX0VSUlxuXHRcdHZhciBlbCA9IGF0dHIub3duZXJFbGVtZW50LCBvbGRBdHRyO1xuXHRcdGlmKGVsICYmIGVsIT10aGlzLl9vd25lckVsZW1lbnQpe1xuXHRcdFx0dGhyb3cgbmV3IERPTUV4Y2VwdGlvbihJTlVTRV9BVFRSSUJVVEVfRVJSKTtcblx0XHR9XG5cdFx0b2xkQXR0ciA9IHRoaXMuZ2V0TmFtZWRJdGVtTlMoYXR0ci5uYW1lc3BhY2VVUkksYXR0ci5sb2NhbE5hbWUpO1xuXHRcdF9hZGROYW1lZE5vZGUodGhpcy5fb3duZXJFbGVtZW50LHRoaXMsYXR0cixvbGRBdHRyKTtcblx0XHRyZXR1cm4gb2xkQXR0cjtcblx0fSxcblxuXHQvKiByZXR1cm5zIE5vZGUgKi9cblx0cmVtb3ZlTmFtZWRJdGVtOiBmdW5jdGlvbihrZXkpIHtcblx0XHR2YXIgYXR0ciA9IHRoaXMuZ2V0TmFtZWRJdGVtKGtleSk7XG5cdFx0X3JlbW92ZU5hbWVkTm9kZSh0aGlzLl9vd25lckVsZW1lbnQsdGhpcyxhdHRyKTtcblx0XHRyZXR1cm4gYXR0cjtcblx0XHRcblx0XHRcblx0fSwvLyByYWlzZXM6IE5PVF9GT1VORF9FUlIsTk9fTU9ESUZJQ0FUSU9OX0FMTE9XRURfRVJSXG5cdFxuXHQvL2ZvciBsZXZlbDJcblx0cmVtb3ZlTmFtZWRJdGVtTlM6ZnVuY3Rpb24obmFtZXNwYWNlVVJJLGxvY2FsTmFtZSl7XG5cdFx0dmFyIGF0dHIgPSB0aGlzLmdldE5hbWVkSXRlbU5TKG5hbWVzcGFjZVVSSSxsb2NhbE5hbWUpO1xuXHRcdF9yZW1vdmVOYW1lZE5vZGUodGhpcy5fb3duZXJFbGVtZW50LHRoaXMsYXR0cik7XG5cdFx0cmV0dXJuIGF0dHI7XG5cdH0sXG5cdGdldE5hbWVkSXRlbU5TOiBmdW5jdGlvbihuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSkge1xuXHRcdHZhciBpID0gdGhpcy5sZW5ndGg7XG5cdFx0d2hpbGUoaS0tKXtcblx0XHRcdHZhciBub2RlID0gdGhpc1tpXTtcblx0XHRcdGlmKG5vZGUubG9jYWxOYW1lID09IGxvY2FsTmFtZSAmJiBub2RlLm5hbWVzcGFjZVVSSSA9PSBuYW1lc3BhY2VVUkkpe1xuXHRcdFx0XHRyZXR1cm4gbm9kZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn07XG4vKipcbiAqIEBzZWUgaHR0cDovL3d3dy53My5vcmcvVFIvUkVDLURPTS1MZXZlbC0xL2xldmVsLW9uZS1jb3JlLmh0bWwjSUQtMTAyMTYxNDkwXG4gKi9cbmZ1bmN0aW9uIERPTUltcGxlbWVudGF0aW9uKC8qIE9iamVjdCAqLyBmZWF0dXJlcykge1xuXHR0aGlzLl9mZWF0dXJlcyA9IHt9O1xuXHRpZiAoZmVhdHVyZXMpIHtcblx0XHRmb3IgKHZhciBmZWF0dXJlIGluIGZlYXR1cmVzKSB7XG5cdFx0XHQgdGhpcy5fZmVhdHVyZXMgPSBmZWF0dXJlc1tmZWF0dXJlXTtcblx0XHR9XG5cdH1cbn07XG5cbkRPTUltcGxlbWVudGF0aW9uLnByb3RvdHlwZSA9IHtcblx0aGFzRmVhdHVyZTogZnVuY3Rpb24oLyogc3RyaW5nICovIGZlYXR1cmUsIC8qIHN0cmluZyAqLyB2ZXJzaW9uKSB7XG5cdFx0dmFyIHZlcnNpb25zID0gdGhpcy5fZmVhdHVyZXNbZmVhdHVyZS50b0xvd2VyQ2FzZSgpXTtcblx0XHRpZiAodmVyc2lvbnMgJiYgKCF2ZXJzaW9uIHx8IHZlcnNpb24gaW4gdmVyc2lvbnMpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fSxcblx0Ly8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcblx0Y3JlYXRlRG9jdW1lbnQ6ZnVuY3Rpb24obmFtZXNwYWNlVVJJLCAgcXVhbGlmaWVkTmFtZSwgZG9jdHlwZSl7Ly8gcmFpc2VzOklOVkFMSURfQ0hBUkFDVEVSX0VSUixOQU1FU1BBQ0VfRVJSLFdST05HX0RPQ1VNRU5UX0VSUlxuXHRcdHZhciBkb2MgPSBuZXcgRG9jdW1lbnQoKTtcblx0XHRkb2MuaW1wbGVtZW50YXRpb24gPSB0aGlzO1xuXHRcdGRvYy5jaGlsZE5vZGVzID0gbmV3IE5vZGVMaXN0KCk7XG5cdFx0ZG9jLmRvY3R5cGUgPSBkb2N0eXBlO1xuXHRcdGlmKGRvY3R5cGUpe1xuXHRcdFx0ZG9jLmFwcGVuZENoaWxkKGRvY3R5cGUpO1xuXHRcdH1cblx0XHRpZihxdWFsaWZpZWROYW1lKXtcblx0XHRcdHZhciByb290ID0gZG9jLmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkkscXVhbGlmaWVkTmFtZSk7XG5cdFx0XHRkb2MuYXBwZW5kQ2hpbGQocm9vdCk7XG5cdFx0fVxuXHRcdHJldHVybiBkb2M7XG5cdH0sXG5cdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdGNyZWF0ZURvY3VtZW50VHlwZTpmdW5jdGlvbihxdWFsaWZpZWROYW1lLCBwdWJsaWNJZCwgc3lzdGVtSWQpey8vIHJhaXNlczpJTlZBTElEX0NIQVJBQ1RFUl9FUlIsTkFNRVNQQUNFX0VSUlxuXHRcdHZhciBub2RlID0gbmV3IERvY3VtZW50VHlwZSgpO1xuXHRcdG5vZGUubmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS5ub2RlTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS5wdWJsaWNJZCA9IHB1YmxpY0lkO1xuXHRcdG5vZGUuc3lzdGVtSWQgPSBzeXN0ZW1JZDtcblx0XHQvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuXHRcdC8vcmVhZG9ubHkgYXR0cmlidXRlIERPTVN0cmluZyAgICAgICAgaW50ZXJuYWxTdWJzZXQ7XG5cdFx0XG5cdFx0Ly9UT0RPOi4uXG5cdFx0Ly8gIHJlYWRvbmx5IGF0dHJpYnV0ZSBOYW1lZE5vZGVNYXAgICAgIGVudGl0aWVzO1xuXHRcdC8vICByZWFkb25seSBhdHRyaWJ1dGUgTmFtZWROb2RlTWFwICAgICBub3RhdGlvbnM7XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH1cbn07XG5cblxuLyoqXG4gKiBAc2VlIGh0dHA6Ly93d3cudzMub3JnL1RSLzIwMDAvUkVDLURPTS1MZXZlbC0yLUNvcmUtMjAwMDExMTMvY29yZS5odG1sI0lELTE5NTA2NDEyNDdcbiAqL1xuXG5mdW5jdGlvbiBOb2RlKCkge1xufTtcblxuTm9kZS5wcm90b3R5cGUgPSB7XG5cdGZpcnN0Q2hpbGQgOiBudWxsLFxuXHRsYXN0Q2hpbGQgOiBudWxsLFxuXHRwcmV2aW91c1NpYmxpbmcgOiBudWxsLFxuXHRuZXh0U2libGluZyA6IG51bGwsXG5cdGF0dHJpYnV0ZXMgOiBudWxsLFxuXHRwYXJlbnROb2RlIDogbnVsbCxcblx0Y2hpbGROb2RlcyA6IG51bGwsXG5cdG93bmVyRG9jdW1lbnQgOiBudWxsLFxuXHRub2RlVmFsdWUgOiBudWxsLFxuXHRuYW1lc3BhY2VVUkkgOiBudWxsLFxuXHRwcmVmaXggOiBudWxsLFxuXHRsb2NhbE5hbWUgOiBudWxsLFxuXHQvLyBNb2RpZmllZCBpbiBET00gTGV2ZWwgMjpcblx0aW5zZXJ0QmVmb3JlOmZ1bmN0aW9uKG5ld0NoaWxkLCByZWZDaGlsZCl7Ly9yYWlzZXMgXG5cdFx0cmV0dXJuIF9pbnNlcnRCZWZvcmUodGhpcyxuZXdDaGlsZCxyZWZDaGlsZCk7XG5cdH0sXG5cdHJlcGxhY2VDaGlsZDpmdW5jdGlvbihuZXdDaGlsZCwgb2xkQ2hpbGQpey8vcmFpc2VzIFxuXHRcdHRoaXMuaW5zZXJ0QmVmb3JlKG5ld0NoaWxkLG9sZENoaWxkKTtcblx0XHRpZihvbGRDaGlsZCl7XG5cdFx0XHR0aGlzLnJlbW92ZUNoaWxkKG9sZENoaWxkKTtcblx0XHR9XG5cdH0sXG5cdHJlbW92ZUNoaWxkOmZ1bmN0aW9uKG9sZENoaWxkKXtcblx0XHRyZXR1cm4gX3JlbW92ZUNoaWxkKHRoaXMsb2xkQ2hpbGQpO1xuXHR9LFxuXHRhcHBlbmRDaGlsZDpmdW5jdGlvbihuZXdDaGlsZCl7XG5cdFx0cmV0dXJuIHRoaXMuaW5zZXJ0QmVmb3JlKG5ld0NoaWxkLG51bGwpO1xuXHR9LFxuXHRoYXNDaGlsZE5vZGVzOmZ1bmN0aW9uKCl7XG5cdFx0cmV0dXJuIHRoaXMuZmlyc3RDaGlsZCAhPSBudWxsO1xuXHR9LFxuXHRjbG9uZU5vZGU6ZnVuY3Rpb24oZGVlcCl7XG5cdFx0cmV0dXJuIGNsb25lTm9kZSh0aGlzLm93bmVyRG9jdW1lbnR8fHRoaXMsdGhpcyxkZWVwKTtcblx0fSxcblx0Ly8gTW9kaWZpZWQgaW4gRE9NIExldmVsIDI6XG5cdG5vcm1hbGl6ZTpmdW5jdGlvbigpe1xuXHRcdHZhciBjaGlsZCA9IHRoaXMuZmlyc3RDaGlsZDtcblx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHR2YXIgbmV4dCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdFx0aWYobmV4dCAmJiBuZXh0Lm5vZGVUeXBlID09IFRFWFRfTk9ERSAmJiBjaGlsZC5ub2RlVHlwZSA9PSBURVhUX05PREUpe1xuXHRcdFx0XHR0aGlzLnJlbW92ZUNoaWxkKG5leHQpO1xuXHRcdFx0XHRjaGlsZC5hcHBlbmREYXRhKG5leHQuZGF0YSk7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0Y2hpbGQubm9ybWFsaXplKCk7XG5cdFx0XHRcdGNoaWxkID0gbmV4dDtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG4gIFx0Ly8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcblx0aXNTdXBwb3J0ZWQ6ZnVuY3Rpb24oZmVhdHVyZSwgdmVyc2lvbil7XG5cdFx0cmV0dXJuIHRoaXMub3duZXJEb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5oYXNGZWF0dXJlKGZlYXR1cmUsdmVyc2lvbik7XG5cdH0sXG4gICAgLy8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcbiAgICBoYXNBdHRyaWJ1dGVzOmZ1bmN0aW9uKCl7XG4gICAgXHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmxlbmd0aD4wO1xuICAgIH0sXG4gICAgbG9va3VwUHJlZml4OmZ1bmN0aW9uKG5hbWVzcGFjZVVSSSl7XG4gICAgXHR2YXIgZWwgPSB0aGlzO1xuICAgIFx0d2hpbGUoZWwpe1xuICAgIFx0XHR2YXIgbWFwID0gZWwuX25zTWFwO1xuICAgIFx0XHQvL2NvbnNvbGUuZGlyKG1hcClcbiAgICBcdFx0aWYobWFwKXtcbiAgICBcdFx0XHRmb3IodmFyIG4gaW4gbWFwKXtcbiAgICBcdFx0XHRcdGlmKG1hcFtuXSA9PSBuYW1lc3BhY2VVUkkpe1xuICAgIFx0XHRcdFx0XHRyZXR1cm4gbjtcbiAgICBcdFx0XHRcdH1cbiAgICBcdFx0XHR9XG4gICAgXHRcdH1cbiAgICBcdFx0ZWwgPSBlbC5ub2RlVHlwZSA9PSAyP2VsLm93bmVyRG9jdW1lbnQgOiBlbC5wYXJlbnROb2RlO1xuICAgIFx0fVxuICAgIFx0cmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAzOlxuICAgIGxvb2t1cE5hbWVzcGFjZVVSSTpmdW5jdGlvbihwcmVmaXgpe1xuICAgIFx0dmFyIGVsID0gdGhpcztcbiAgICBcdHdoaWxlKGVsKXtcbiAgICBcdFx0dmFyIG1hcCA9IGVsLl9uc01hcDtcbiAgICBcdFx0Ly9jb25zb2xlLmRpcihtYXApXG4gICAgXHRcdGlmKG1hcCl7XG4gICAgXHRcdFx0aWYocHJlZml4IGluIG1hcCl7XG4gICAgXHRcdFx0XHRyZXR1cm4gbWFwW3ByZWZpeF0gO1xuICAgIFx0XHRcdH1cbiAgICBcdFx0fVxuICAgIFx0XHRlbCA9IGVsLm5vZGVUeXBlID09IDI/ZWwub3duZXJEb2N1bWVudCA6IGVsLnBhcmVudE5vZGU7XG4gICAgXHR9XG4gICAgXHRyZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDM6XG4gICAgaXNEZWZhdWx0TmFtZXNwYWNlOmZ1bmN0aW9uKG5hbWVzcGFjZVVSSSl7XG4gICAgXHR2YXIgcHJlZml4ID0gdGhpcy5sb29rdXBQcmVmaXgobmFtZXNwYWNlVVJJKTtcbiAgICBcdHJldHVybiBwcmVmaXggPT0gbnVsbDtcbiAgICB9XG59O1xuXG5cbmZ1bmN0aW9uIF94bWxFbmNvZGVyKGMpe1xuXHRyZXR1cm4gYyA9PSAnPCcgJiYgJyZsdDsnIHx8XG4gICAgICAgICBjID09ICc+JyAmJiAnJmd0OycgfHxcbiAgICAgICAgIGMgPT0gJyYnICYmICcmYW1wOycgfHxcbiAgICAgICAgIGMgPT0gJ1wiJyAmJiAnJnF1b3Q7JyB8fFxuICAgICAgICAgJyYjJytjLmNoYXJDb2RlQXQoKSsnOydcbn1cblxuXG5jb3B5KE5vZGVUeXBlLE5vZGUpO1xuY29weShOb2RlVHlwZSxOb2RlLnByb3RvdHlwZSk7XG5cbi8qKlxuICogQHBhcmFtIGNhbGxiYWNrIHJldHVybiB0cnVlIGZvciBjb250aW51ZSxmYWxzZSBmb3IgYnJlYWtcbiAqIEByZXR1cm4gYm9vbGVhbiB0cnVlOiBicmVhayB2aXNpdDtcbiAqL1xuZnVuY3Rpb24gX3Zpc2l0Tm9kZShub2RlLGNhbGxiYWNrKXtcblx0aWYoY2FsbGJhY2sobm9kZSkpe1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGlmKG5vZGUgPSBub2RlLmZpcnN0Q2hpbGQpe1xuXHRcdGRve1xuXHRcdFx0aWYoX3Zpc2l0Tm9kZShub2RlLGNhbGxiYWNrKSl7cmV0dXJuIHRydWV9XG4gICAgICAgIH13aGlsZShub2RlPW5vZGUubmV4dFNpYmxpbmcpXG4gICAgfVxufVxuXG5cblxuZnVuY3Rpb24gRG9jdW1lbnQoKXtcbn1cbmZ1bmN0aW9uIF9vbkFkZEF0dHJpYnV0ZShkb2MsZWwsbmV3QXR0cil7XG5cdGRvYyAmJiBkb2MuX2luYysrO1xuXHR2YXIgbnMgPSBuZXdBdHRyLm5hbWVzcGFjZVVSSSA7XG5cdGlmKG5zID09ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3htbG5zLycpe1xuXHRcdC8vdXBkYXRlIG5hbWVzcGFjZVxuXHRcdGVsLl9uc01hcFtuZXdBdHRyLnByZWZpeD9uZXdBdHRyLmxvY2FsTmFtZTonJ10gPSBuZXdBdHRyLnZhbHVlXG5cdH1cbn1cbmZ1bmN0aW9uIF9vblJlbW92ZUF0dHJpYnV0ZShkb2MsZWwsbmV3QXR0cixyZW1vdmUpe1xuXHRkb2MgJiYgZG9jLl9pbmMrKztcblx0dmFyIG5zID0gbmV3QXR0ci5uYW1lc3BhY2VVUkkgO1xuXHRpZihucyA9PSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC94bWxucy8nKXtcblx0XHQvL3VwZGF0ZSBuYW1lc3BhY2Vcblx0XHRkZWxldGUgZWwuX25zTWFwW25ld0F0dHIucHJlZml4P25ld0F0dHIubG9jYWxOYW1lOicnXVxuXHR9XG59XG5mdW5jdGlvbiBfb25VcGRhdGVDaGlsZChkb2MsZWwsbmV3Q2hpbGQpe1xuXHRpZihkb2MgJiYgZG9jLl9pbmMpe1xuXHRcdGRvYy5faW5jKys7XG5cdFx0Ly91cGRhdGUgY2hpbGROb2Rlc1xuXHRcdHZhciBjcyA9IGVsLmNoaWxkTm9kZXM7XG5cdFx0aWYobmV3Q2hpbGQpe1xuXHRcdFx0Y3NbY3MubGVuZ3RoKytdID0gbmV3Q2hpbGQ7XG5cdFx0fWVsc2V7XG5cdFx0XHQvL2NvbnNvbGUubG9nKDEpXG5cdFx0XHR2YXIgY2hpbGQgPSBlbC5maXJzdENoaWxkO1xuXHRcdFx0dmFyIGkgPSAwO1xuXHRcdFx0d2hpbGUoY2hpbGQpe1xuXHRcdFx0XHRjc1tpKytdID0gY2hpbGQ7XG5cdFx0XHRcdGNoaWxkID1jaGlsZC5uZXh0U2libGluZztcblx0XHRcdH1cblx0XHRcdGNzLmxlbmd0aCA9IGk7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogYXR0cmlidXRlcztcbiAqIGNoaWxkcmVuO1xuICogXG4gKiB3cml0ZWFibGUgcHJvcGVydGllczpcbiAqIG5vZGVWYWx1ZSxBdHRyOnZhbHVlLENoYXJhY3RlckRhdGE6ZGF0YVxuICogcHJlZml4XG4gKi9cbmZ1bmN0aW9uIF9yZW1vdmVDaGlsZChwYXJlbnROb2RlLGNoaWxkKXtcblx0dmFyIHByZXZpb3VzID0gY2hpbGQucHJldmlvdXNTaWJsaW5nO1xuXHR2YXIgbmV4dCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRpZihwcmV2aW91cyl7XG5cdFx0cHJldmlvdXMubmV4dFNpYmxpbmcgPSBuZXh0O1xuXHR9ZWxzZXtcblx0XHRwYXJlbnROb2RlLmZpcnN0Q2hpbGQgPSBuZXh0XG5cdH1cblx0aWYobmV4dCl7XG5cdFx0bmV4dC5wcmV2aW91c1NpYmxpbmcgPSBwcmV2aW91cztcblx0fWVsc2V7XG5cdFx0cGFyZW50Tm9kZS5sYXN0Q2hpbGQgPSBwcmV2aW91cztcblx0fVxuXHRfb25VcGRhdGVDaGlsZChwYXJlbnROb2RlLm93bmVyRG9jdW1lbnQscGFyZW50Tm9kZSk7XG5cdHJldHVybiBjaGlsZDtcbn1cbi8qKlxuICogcHJlZm9ybWFuY2Uga2V5KHJlZkNoaWxkID09IG51bGwpXG4gKi9cbmZ1bmN0aW9uIF9pbnNlcnRCZWZvcmUocGFyZW50Tm9kZSxuZXdDaGlsZCxuZXh0Q2hpbGQpe1xuXHR2YXIgY3AgPSBuZXdDaGlsZC5wYXJlbnROb2RlO1xuXHRpZihjcCl7XG5cdFx0Y3AucmVtb3ZlQ2hpbGQobmV3Q2hpbGQpOy8vcmVtb3ZlIGFuZCB1cGRhdGVcblx0fVxuXHRpZihuZXdDaGlsZC5ub2RlVHlwZSA9PT0gRE9DVU1FTlRfRlJBR01FTlRfTk9ERSl7XG5cdFx0dmFyIG5ld0ZpcnN0ID0gbmV3Q2hpbGQuZmlyc3RDaGlsZDtcblx0XHRpZiAobmV3Rmlyc3QgPT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG5ld0NoaWxkO1xuXHRcdH1cblx0XHR2YXIgbmV3TGFzdCA9IG5ld0NoaWxkLmxhc3RDaGlsZDtcblx0fWVsc2V7XG5cdFx0bmV3Rmlyc3QgPSBuZXdMYXN0ID0gbmV3Q2hpbGQ7XG5cdH1cblx0dmFyIHByZSA9IG5leHRDaGlsZCA/IG5leHRDaGlsZC5wcmV2aW91c1NpYmxpbmcgOiBwYXJlbnROb2RlLmxhc3RDaGlsZDtcblxuXHRuZXdGaXJzdC5wcmV2aW91c1NpYmxpbmcgPSBwcmU7XG5cdG5ld0xhc3QubmV4dFNpYmxpbmcgPSBuZXh0Q2hpbGQ7XG5cdFxuXHRcblx0aWYocHJlKXtcblx0XHRwcmUubmV4dFNpYmxpbmcgPSBuZXdGaXJzdDtcblx0fWVsc2V7XG5cdFx0cGFyZW50Tm9kZS5maXJzdENoaWxkID0gbmV3Rmlyc3Q7XG5cdH1cblx0aWYobmV4dENoaWxkID09IG51bGwpe1xuXHRcdHBhcmVudE5vZGUubGFzdENoaWxkID0gbmV3TGFzdDtcblx0fWVsc2V7XG5cdFx0bmV4dENoaWxkLnByZXZpb3VzU2libGluZyA9IG5ld0xhc3Q7XG5cdH1cblx0ZG97XG5cdFx0bmV3Rmlyc3QucGFyZW50Tm9kZSA9IHBhcmVudE5vZGU7XG5cdH13aGlsZShuZXdGaXJzdCAhPT0gbmV3TGFzdCAmJiAobmV3Rmlyc3Q9IG5ld0ZpcnN0Lm5leHRTaWJsaW5nKSlcblx0X29uVXBkYXRlQ2hpbGQocGFyZW50Tm9kZS5vd25lckRvY3VtZW50fHxwYXJlbnROb2RlLHBhcmVudE5vZGUpO1xuXHQvL2NvbnNvbGUubG9nKHBhcmVudE5vZGUubGFzdENoaWxkLm5leHRTaWJsaW5nID09IG51bGwpXG5cdGlmIChuZXdDaGlsZC5ub2RlVHlwZSA9PSBET0NVTUVOVF9GUkFHTUVOVF9OT0RFKSB7XG5cdFx0bmV3Q2hpbGQuZmlyc3RDaGlsZCA9IG5ld0NoaWxkLmxhc3RDaGlsZCA9IG51bGw7XG5cdH1cblx0cmV0dXJuIG5ld0NoaWxkO1xufVxuZnVuY3Rpb24gX2FwcGVuZFNpbmdsZUNoaWxkKHBhcmVudE5vZGUsbmV3Q2hpbGQpe1xuXHR2YXIgY3AgPSBuZXdDaGlsZC5wYXJlbnROb2RlO1xuXHRpZihjcCl7XG5cdFx0dmFyIHByZSA9IHBhcmVudE5vZGUubGFzdENoaWxkO1xuXHRcdGNwLnJlbW92ZUNoaWxkKG5ld0NoaWxkKTsvL3JlbW92ZSBhbmQgdXBkYXRlXG5cdFx0dmFyIHByZSA9IHBhcmVudE5vZGUubGFzdENoaWxkO1xuXHR9XG5cdHZhciBwcmUgPSBwYXJlbnROb2RlLmxhc3RDaGlsZDtcblx0bmV3Q2hpbGQucGFyZW50Tm9kZSA9IHBhcmVudE5vZGU7XG5cdG5ld0NoaWxkLnByZXZpb3VzU2libGluZyA9IHByZTtcblx0bmV3Q2hpbGQubmV4dFNpYmxpbmcgPSBudWxsO1xuXHRpZihwcmUpe1xuXHRcdHByZS5uZXh0U2libGluZyA9IG5ld0NoaWxkO1xuXHR9ZWxzZXtcblx0XHRwYXJlbnROb2RlLmZpcnN0Q2hpbGQgPSBuZXdDaGlsZDtcblx0fVxuXHRwYXJlbnROb2RlLmxhc3RDaGlsZCA9IG5ld0NoaWxkO1xuXHRfb25VcGRhdGVDaGlsZChwYXJlbnROb2RlLm93bmVyRG9jdW1lbnQscGFyZW50Tm9kZSxuZXdDaGlsZCk7XG5cdHJldHVybiBuZXdDaGlsZDtcblx0Ly9jb25zb2xlLmxvZyhcIl9fYWFcIixwYXJlbnROb2RlLmxhc3RDaGlsZC5uZXh0U2libGluZyA9PSBudWxsKVxufVxuRG9jdW1lbnQucHJvdG90eXBlID0ge1xuXHQvL2ltcGxlbWVudGF0aW9uIDogbnVsbCxcblx0bm9kZU5hbWUgOiAgJyNkb2N1bWVudCcsXG5cdG5vZGVUeXBlIDogIERPQ1VNRU5UX05PREUsXG5cdGRvY3R5cGUgOiAgbnVsbCxcblx0ZG9jdW1lbnRFbGVtZW50IDogIG51bGwsXG5cdF9pbmMgOiAxLFxuXHRcblx0aW5zZXJ0QmVmb3JlIDogIGZ1bmN0aW9uKG5ld0NoaWxkLCByZWZDaGlsZCl7Ly9yYWlzZXMgXG5cdFx0aWYobmV3Q2hpbGQubm9kZVR5cGUgPT0gRE9DVU1FTlRfRlJBR01FTlRfTk9ERSl7XG5cdFx0XHR2YXIgY2hpbGQgPSBuZXdDaGlsZC5maXJzdENoaWxkO1xuXHRcdFx0d2hpbGUoY2hpbGQpe1xuXHRcdFx0XHR2YXIgbmV4dCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdFx0XHR0aGlzLmluc2VydEJlZm9yZShjaGlsZCxyZWZDaGlsZCk7XG5cdFx0XHRcdGNoaWxkID0gbmV4dDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXdDaGlsZDtcblx0XHR9XG5cdFx0aWYodGhpcy5kb2N1bWVudEVsZW1lbnQgPT0gbnVsbCAmJiBuZXdDaGlsZC5ub2RlVHlwZSA9PSAxKXtcblx0XHRcdHRoaXMuZG9jdW1lbnRFbGVtZW50ID0gbmV3Q2hpbGQ7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBfaW5zZXJ0QmVmb3JlKHRoaXMsbmV3Q2hpbGQscmVmQ2hpbGQpLChuZXdDaGlsZC5vd25lckRvY3VtZW50ID0gdGhpcyksbmV3Q2hpbGQ7XG5cdH0sXG5cdHJlbW92ZUNoaWxkIDogIGZ1bmN0aW9uKG9sZENoaWxkKXtcblx0XHRpZih0aGlzLmRvY3VtZW50RWxlbWVudCA9PSBvbGRDaGlsZCl7XG5cdFx0XHR0aGlzLmRvY3VtZW50RWxlbWVudCA9IG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBfcmVtb3ZlQ2hpbGQodGhpcyxvbGRDaGlsZCk7XG5cdH0sXG5cdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdGltcG9ydE5vZGUgOiBmdW5jdGlvbihpbXBvcnRlZE5vZGUsZGVlcCl7XG5cdFx0cmV0dXJuIGltcG9ydE5vZGUodGhpcyxpbXBvcnRlZE5vZGUsZGVlcCk7XG5cdH0sXG5cdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdGdldEVsZW1lbnRCeUlkIDpcdGZ1bmN0aW9uKGlkKXtcblx0XHR2YXIgcnR2ID0gbnVsbDtcblx0XHRfdmlzaXROb2RlKHRoaXMuZG9jdW1lbnRFbGVtZW50LGZ1bmN0aW9uKG5vZGUpe1xuXHRcdFx0aWYobm9kZS5ub2RlVHlwZSA9PSAxKXtcblx0XHRcdFx0aWYobm9kZS5nZXRBdHRyaWJ1dGUoJ2lkJykgPT0gaWQpe1xuXHRcdFx0XHRcdHJ0diA9IG5vZGU7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KVxuXHRcdHJldHVybiBydHY7XG5cdH0sXG5cdFxuXHQvL2RvY3VtZW50IGZhY3RvcnkgbWV0aG9kOlxuXHRjcmVhdGVFbGVtZW50IDpcdGZ1bmN0aW9uKHRhZ05hbWUpe1xuXHRcdHZhciBub2RlID0gbmV3IEVsZW1lbnQoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUubm9kZU5hbWUgPSB0YWdOYW1lO1xuXHRcdG5vZGUudGFnTmFtZSA9IHRhZ05hbWU7XG5cdFx0bm9kZS5jaGlsZE5vZGVzID0gbmV3IE5vZGVMaXN0KCk7XG5cdFx0dmFyIGF0dHJzXHQ9IG5vZGUuYXR0cmlidXRlcyA9IG5ldyBOYW1lZE5vZGVNYXAoKTtcblx0XHRhdHRycy5fb3duZXJFbGVtZW50ID0gbm9kZTtcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0Y3JlYXRlRG9jdW1lbnRGcmFnbWVudCA6XHRmdW5jdGlvbigpe1xuXHRcdHZhciBub2RlID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUuY2hpbGROb2RlcyA9IG5ldyBOb2RlTGlzdCgpO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVUZXh0Tm9kZSA6XHRmdW5jdGlvbihkYXRhKXtcblx0XHR2YXIgbm9kZSA9IG5ldyBUZXh0KCk7XG5cdFx0bm9kZS5vd25lckRvY3VtZW50ID0gdGhpcztcblx0XHRub2RlLmFwcGVuZERhdGEoZGF0YSlcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0Y3JlYXRlQ29tbWVudCA6XHRmdW5jdGlvbihkYXRhKXtcblx0XHR2YXIgbm9kZSA9IG5ldyBDb21tZW50KCk7XG5cdFx0bm9kZS5vd25lckRvY3VtZW50ID0gdGhpcztcblx0XHRub2RlLmFwcGVuZERhdGEoZGF0YSlcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0Y3JlYXRlQ0RBVEFTZWN0aW9uIDpcdGZ1bmN0aW9uKGRhdGEpe1xuXHRcdHZhciBub2RlID0gbmV3IENEQVRBU2VjdGlvbigpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudCA9IHRoaXM7XG5cdFx0bm9kZS5hcHBlbmREYXRhKGRhdGEpXG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdGNyZWF0ZVByb2Nlc3NpbmdJbnN0cnVjdGlvbiA6XHRmdW5jdGlvbih0YXJnZXQsZGF0YSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgUHJvY2Vzc2luZ0luc3RydWN0aW9uKCk7XG5cdFx0bm9kZS5vd25lckRvY3VtZW50ID0gdGhpcztcblx0XHRub2RlLnRhZ05hbWUgPSBub2RlLnRhcmdldCA9IHRhcmdldDtcblx0XHRub2RlLm5vZGVWYWx1ZT0gbm9kZS5kYXRhID0gZGF0YTtcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0Y3JlYXRlQXR0cmlidXRlIDpcdGZ1bmN0aW9uKG5hbWUpe1xuXHRcdHZhciBub2RlID0gbmV3IEF0dHIoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnRcdD0gdGhpcztcblx0XHRub2RlLm5hbWUgPSBuYW1lO1xuXHRcdG5vZGUubm9kZU5hbWVcdD0gbmFtZTtcblx0XHRub2RlLmxvY2FsTmFtZSA9IG5hbWU7XG5cdFx0bm9kZS5zcGVjaWZpZWQgPSB0cnVlO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVFbnRpdHlSZWZlcmVuY2UgOlx0ZnVuY3Rpb24obmFtZSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgRW50aXR5UmVmZXJlbmNlKCk7XG5cdFx0bm9kZS5vd25lckRvY3VtZW50XHQ9IHRoaXM7XG5cdFx0bm9kZS5ub2RlTmFtZVx0PSBuYW1lO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHQvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuXHRjcmVhdGVFbGVtZW50TlMgOlx0ZnVuY3Rpb24obmFtZXNwYWNlVVJJLHF1YWxpZmllZE5hbWUpe1xuXHRcdHZhciBub2RlID0gbmV3IEVsZW1lbnQoKTtcblx0XHR2YXIgcGwgPSBxdWFsaWZpZWROYW1lLnNwbGl0KCc6Jyk7XG5cdFx0dmFyIGF0dHJzXHQ9IG5vZGUuYXR0cmlidXRlcyA9IG5ldyBOYW1lZE5vZGVNYXAoKTtcblx0XHRub2RlLmNoaWxkTm9kZXMgPSBuZXcgTm9kZUxpc3QoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUubm9kZU5hbWUgPSBxdWFsaWZpZWROYW1lO1xuXHRcdG5vZGUudGFnTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS5uYW1lc3BhY2VVUkkgPSBuYW1lc3BhY2VVUkk7XG5cdFx0aWYocGwubGVuZ3RoID09IDIpe1xuXHRcdFx0bm9kZS5wcmVmaXggPSBwbFswXTtcblx0XHRcdG5vZGUubG9jYWxOYW1lID0gcGxbMV07XG5cdFx0fWVsc2V7XG5cdFx0XHQvL2VsLnByZWZpeCA9IG51bGw7XG5cdFx0XHRub2RlLmxvY2FsTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0fVxuXHRcdGF0dHJzLl9vd25lckVsZW1lbnQgPSBub2RlO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHQvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuXHRjcmVhdGVBdHRyaWJ1dGVOUyA6XHRmdW5jdGlvbihuYW1lc3BhY2VVUkkscXVhbGlmaWVkTmFtZSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgQXR0cigpO1xuXHRcdHZhciBwbCA9IHF1YWxpZmllZE5hbWUuc3BsaXQoJzonKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUubm9kZU5hbWUgPSBxdWFsaWZpZWROYW1lO1xuXHRcdG5vZGUubmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS5uYW1lc3BhY2VVUkkgPSBuYW1lc3BhY2VVUkk7XG5cdFx0bm9kZS5zcGVjaWZpZWQgPSB0cnVlO1xuXHRcdGlmKHBsLmxlbmd0aCA9PSAyKXtcblx0XHRcdG5vZGUucHJlZml4ID0gcGxbMF07XG5cdFx0XHRub2RlLmxvY2FsTmFtZSA9IHBsWzFdO1xuXHRcdH1lbHNle1xuXHRcdFx0Ly9lbC5wcmVmaXggPSBudWxsO1xuXHRcdFx0bm9kZS5sb2NhbE5hbWUgPSBxdWFsaWZpZWROYW1lO1xuXHRcdH1cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxufTtcbl9leHRlbmRzKERvY3VtZW50LE5vZGUpO1xuXG5cbmZ1bmN0aW9uIEVsZW1lbnQoKSB7XG5cdHRoaXMuX25zTWFwID0ge307XG59O1xuRWxlbWVudC5wcm90b3R5cGUgPSB7XG5cdG5vZGVUeXBlIDogRUxFTUVOVF9OT0RFLFxuXHRoYXNBdHRyaWJ1dGUgOiBmdW5jdGlvbihuYW1lKXtcblx0XHRyZXR1cm4gdGhpcy5nZXRBdHRyaWJ1dGVOb2RlKG5hbWUpIT1udWxsO1xuXHR9LFxuXHRnZXRBdHRyaWJ1dGUgOiBmdW5jdGlvbihuYW1lKXtcblx0XHR2YXIgYXR0ciA9IHRoaXMuZ2V0QXR0cmlidXRlTm9kZShuYW1lKTtcblx0XHRyZXR1cm4gYXR0ciAmJiBhdHRyLnZhbHVlIHx8ICcnO1xuXHR9LFxuXHRnZXRBdHRyaWJ1dGVOb2RlIDogZnVuY3Rpb24obmFtZSl7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0obmFtZSk7XG5cdH0sXG5cdHNldEF0dHJpYnV0ZSA6IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKXtcblx0XHR2YXIgYXR0ciA9IHRoaXMub3duZXJEb2N1bWVudC5jcmVhdGVBdHRyaWJ1dGUobmFtZSk7XG5cdFx0YXR0ci52YWx1ZSA9IGF0dHIubm9kZVZhbHVlID0gXCJcIiArIHZhbHVlO1xuXHRcdHRoaXMuc2V0QXR0cmlidXRlTm9kZShhdHRyKVxuXHR9LFxuXHRyZW1vdmVBdHRyaWJ1dGUgOiBmdW5jdGlvbihuYW1lKXtcblx0XHR2YXIgYXR0ciA9IHRoaXMuZ2V0QXR0cmlidXRlTm9kZShuYW1lKVxuXHRcdGF0dHIgJiYgdGhpcy5yZW1vdmVBdHRyaWJ1dGVOb2RlKGF0dHIpO1xuXHR9LFxuXHRcblx0Ly9mb3VyIHJlYWwgb3BlYXJ0aW9uIG1ldGhvZFxuXHRhcHBlbmRDaGlsZDpmdW5jdGlvbihuZXdDaGlsZCl7XG5cdFx0aWYobmV3Q2hpbGQubm9kZVR5cGUgPT09IERPQ1VNRU5UX0ZSQUdNRU5UX05PREUpe1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zZXJ0QmVmb3JlKG5ld0NoaWxkLG51bGwpO1xuXHRcdH1lbHNle1xuXHRcdFx0cmV0dXJuIF9hcHBlbmRTaW5nbGVDaGlsZCh0aGlzLG5ld0NoaWxkKTtcblx0XHR9XG5cdH0sXG5cdHNldEF0dHJpYnV0ZU5vZGUgOiBmdW5jdGlvbihuZXdBdHRyKXtcblx0XHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLnNldE5hbWVkSXRlbShuZXdBdHRyKTtcblx0fSxcblx0c2V0QXR0cmlidXRlTm9kZU5TIDogZnVuY3Rpb24obmV3QXR0cil7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlcy5zZXROYW1lZEl0ZW1OUyhuZXdBdHRyKTtcblx0fSxcblx0cmVtb3ZlQXR0cmlidXRlTm9kZSA6IGZ1bmN0aW9uKG9sZEF0dHIpe1xuXHRcdHJldHVybiB0aGlzLmF0dHJpYnV0ZXMucmVtb3ZlTmFtZWRJdGVtKG9sZEF0dHIubm9kZU5hbWUpO1xuXHR9LFxuXHQvL2dldCByZWFsIGF0dHJpYnV0ZSBuYW1lLGFuZCByZW1vdmUgaXQgYnkgcmVtb3ZlQXR0cmlidXRlTm9kZVxuXHRyZW1vdmVBdHRyaWJ1dGVOUyA6IGZ1bmN0aW9uKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKXtcblx0XHR2YXIgb2xkID0gdGhpcy5nZXRBdHRyaWJ1dGVOb2RlTlMobmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpO1xuXHRcdG9sZCAmJiB0aGlzLnJlbW92ZUF0dHJpYnV0ZU5vZGUob2xkKTtcblx0fSxcblx0XG5cdGhhc0F0dHJpYnV0ZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpe1xuXHRcdHJldHVybiB0aGlzLmdldEF0dHJpYnV0ZU5vZGVOUyhuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSkhPW51bGw7XG5cdH0sXG5cdGdldEF0dHJpYnV0ZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpe1xuXHRcdHZhciBhdHRyID0gdGhpcy5nZXRBdHRyaWJ1dGVOb2RlTlMobmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpO1xuXHRcdHJldHVybiBhdHRyICYmIGF0dHIudmFsdWUgfHwgJyc7XG5cdH0sXG5cdHNldEF0dHJpYnV0ZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lLCB2YWx1ZSl7XG5cdFx0dmFyIGF0dHIgPSB0aGlzLm93bmVyRG9jdW1lbnQuY3JlYXRlQXR0cmlidXRlTlMobmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lKTtcblx0XHRhdHRyLnZhbHVlID0gYXR0ci5ub2RlVmFsdWUgPSBcIlwiICsgdmFsdWU7XG5cdFx0dGhpcy5zZXRBdHRyaWJ1dGVOb2RlKGF0dHIpXG5cdH0sXG5cdGdldEF0dHJpYnV0ZU5vZGVOUyA6IGZ1bmN0aW9uKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKXtcblx0XHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbU5TKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKTtcblx0fSxcblx0XG5cdGdldEVsZW1lbnRzQnlUYWdOYW1lIDogZnVuY3Rpb24odGFnTmFtZSl7XG5cdFx0cmV0dXJuIG5ldyBMaXZlTm9kZUxpc3QodGhpcyxmdW5jdGlvbihiYXNlKXtcblx0XHRcdHZhciBscyA9IFtdO1xuXHRcdFx0X3Zpc2l0Tm9kZShiYXNlLGZ1bmN0aW9uKG5vZGUpe1xuXHRcdFx0XHRpZihub2RlICE9PSBiYXNlICYmIG5vZGUubm9kZVR5cGUgPT0gRUxFTUVOVF9OT0RFICYmICh0YWdOYW1lID09PSAnKicgfHwgbm9kZS50YWdOYW1lID09IHRhZ05hbWUpKXtcblx0XHRcdFx0XHRscy5wdXNoKG5vZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBscztcblx0XHR9KTtcblx0fSxcblx0Z2V0RWxlbWVudHNCeVRhZ05hbWVOUyA6IGZ1bmN0aW9uKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKXtcblx0XHRyZXR1cm4gbmV3IExpdmVOb2RlTGlzdCh0aGlzLGZ1bmN0aW9uKGJhc2Upe1xuXHRcdFx0dmFyIGxzID0gW107XG5cdFx0XHRfdmlzaXROb2RlKGJhc2UsZnVuY3Rpb24obm9kZSl7XG5cdFx0XHRcdGlmKG5vZGUgIT09IGJhc2UgJiYgbm9kZS5ub2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFICYmIChuYW1lc3BhY2VVUkkgPT09ICcqJyB8fCBub2RlLm5hbWVzcGFjZVVSSSA9PT0gbmFtZXNwYWNlVVJJKSAmJiAobG9jYWxOYW1lID09PSAnKicgfHwgbm9kZS5sb2NhbE5hbWUgPT0gbG9jYWxOYW1lKSl7XG5cdFx0XHRcdFx0bHMucHVzaChub2RlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gbHM7XG5cdFx0fSk7XG5cdH1cbn07XG5Eb2N1bWVudC5wcm90b3R5cGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUgPSBFbGVtZW50LnByb3RvdHlwZS5nZXRFbGVtZW50c0J5VGFnTmFtZTtcbkRvY3VtZW50LnByb3RvdHlwZS5nZXRFbGVtZW50c0J5VGFnTmFtZU5TID0gRWxlbWVudC5wcm90b3R5cGUuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUztcblxuXG5fZXh0ZW5kcyhFbGVtZW50LE5vZGUpO1xuZnVuY3Rpb24gQXR0cigpIHtcbn07XG5BdHRyLnByb3RvdHlwZS5ub2RlVHlwZSA9IEFUVFJJQlVURV9OT0RFO1xuX2V4dGVuZHMoQXR0cixOb2RlKTtcblxuXG5mdW5jdGlvbiBDaGFyYWN0ZXJEYXRhKCkge1xufTtcbkNoYXJhY3RlckRhdGEucHJvdG90eXBlID0ge1xuXHRkYXRhIDogJycsXG5cdHN1YnN0cmluZ0RhdGEgOiBmdW5jdGlvbihvZmZzZXQsIGNvdW50KSB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5zdWJzdHJpbmcob2Zmc2V0LCBvZmZzZXQrY291bnQpO1xuXHR9LFxuXHRhcHBlbmREYXRhOiBmdW5jdGlvbih0ZXh0KSB7XG5cdFx0dGV4dCA9IHRoaXMuZGF0YSt0ZXh0O1xuXHRcdHRoaXMubm9kZVZhbHVlID0gdGhpcy5kYXRhID0gdGV4dDtcblx0XHR0aGlzLmxlbmd0aCA9IHRleHQubGVuZ3RoO1xuXHR9LFxuXHRpbnNlcnREYXRhOiBmdW5jdGlvbihvZmZzZXQsdGV4dCkge1xuXHRcdHRoaXMucmVwbGFjZURhdGEob2Zmc2V0LDAsdGV4dCk7XG5cdFxuXHR9LFxuXHRhcHBlbmRDaGlsZDpmdW5jdGlvbihuZXdDaGlsZCl7XG5cdFx0Ly9pZighKG5ld0NoaWxkIGluc3RhbmNlb2YgQ2hhcmFjdGVyRGF0YSkpe1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKEV4Y2VwdGlvbk1lc3NhZ2VbM10pXG5cdFx0Ly99XG5cdFx0cmV0dXJuIE5vZGUucHJvdG90eXBlLmFwcGVuZENoaWxkLmFwcGx5KHRoaXMsYXJndW1lbnRzKVxuXHR9LFxuXHRkZWxldGVEYXRhOiBmdW5jdGlvbihvZmZzZXQsIGNvdW50KSB7XG5cdFx0dGhpcy5yZXBsYWNlRGF0YShvZmZzZXQsY291bnQsXCJcIik7XG5cdH0sXG5cdHJlcGxhY2VEYXRhOiBmdW5jdGlvbihvZmZzZXQsIGNvdW50LCB0ZXh0KSB7XG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5kYXRhLnN1YnN0cmluZygwLG9mZnNldCk7XG5cdFx0dmFyIGVuZCA9IHRoaXMuZGF0YS5zdWJzdHJpbmcob2Zmc2V0K2NvdW50KTtcblx0XHR0ZXh0ID0gc3RhcnQgKyB0ZXh0ICsgZW5kO1xuXHRcdHRoaXMubm9kZVZhbHVlID0gdGhpcy5kYXRhID0gdGV4dDtcblx0XHR0aGlzLmxlbmd0aCA9IHRleHQubGVuZ3RoO1xuXHR9XG59XG5fZXh0ZW5kcyhDaGFyYWN0ZXJEYXRhLE5vZGUpO1xuZnVuY3Rpb24gVGV4dCgpIHtcbn07XG5UZXh0LnByb3RvdHlwZSA9IHtcblx0bm9kZU5hbWUgOiBcIiN0ZXh0XCIsXG5cdG5vZGVUeXBlIDogVEVYVF9OT0RFLFxuXHRzcGxpdFRleHQgOiBmdW5jdGlvbihvZmZzZXQpIHtcblx0XHR2YXIgdGV4dCA9IHRoaXMuZGF0YTtcblx0XHR2YXIgbmV3VGV4dCA9IHRleHQuc3Vic3RyaW5nKG9mZnNldCk7XG5cdFx0dGV4dCA9IHRleHQuc3Vic3RyaW5nKDAsIG9mZnNldCk7XG5cdFx0dGhpcy5kYXRhID0gdGhpcy5ub2RlVmFsdWUgPSB0ZXh0O1xuXHRcdHRoaXMubGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdFx0dmFyIG5ld05vZGUgPSB0aGlzLm93bmVyRG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobmV3VGV4dCk7XG5cdFx0aWYodGhpcy5wYXJlbnROb2RlKXtcblx0XHRcdHRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUobmV3Tm9kZSwgdGhpcy5uZXh0U2libGluZyk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXdOb2RlO1xuXHR9XG59XG5fZXh0ZW5kcyhUZXh0LENoYXJhY3RlckRhdGEpO1xuZnVuY3Rpb24gQ29tbWVudCgpIHtcbn07XG5Db21tZW50LnByb3RvdHlwZSA9IHtcblx0bm9kZU5hbWUgOiBcIiNjb21tZW50XCIsXG5cdG5vZGVUeXBlIDogQ09NTUVOVF9OT0RFXG59XG5fZXh0ZW5kcyhDb21tZW50LENoYXJhY3RlckRhdGEpO1xuXG5mdW5jdGlvbiBDREFUQVNlY3Rpb24oKSB7XG59O1xuQ0RBVEFTZWN0aW9uLnByb3RvdHlwZSA9IHtcblx0bm9kZU5hbWUgOiBcIiNjZGF0YS1zZWN0aW9uXCIsXG5cdG5vZGVUeXBlIDogQ0RBVEFfU0VDVElPTl9OT0RFXG59XG5fZXh0ZW5kcyhDREFUQVNlY3Rpb24sQ2hhcmFjdGVyRGF0YSk7XG5cblxuZnVuY3Rpb24gRG9jdW1lbnRUeXBlKCkge1xufTtcbkRvY3VtZW50VHlwZS5wcm90b3R5cGUubm9kZVR5cGUgPSBET0NVTUVOVF9UWVBFX05PREU7XG5fZXh0ZW5kcyhEb2N1bWVudFR5cGUsTm9kZSk7XG5cbmZ1bmN0aW9uIE5vdGF0aW9uKCkge1xufTtcbk5vdGF0aW9uLnByb3RvdHlwZS5ub2RlVHlwZSA9IE5PVEFUSU9OX05PREU7XG5fZXh0ZW5kcyhOb3RhdGlvbixOb2RlKTtcblxuZnVuY3Rpb24gRW50aXR5KCkge1xufTtcbkVudGl0eS5wcm90b3R5cGUubm9kZVR5cGUgPSBFTlRJVFlfTk9ERTtcbl9leHRlbmRzKEVudGl0eSxOb2RlKTtcblxuZnVuY3Rpb24gRW50aXR5UmVmZXJlbmNlKCkge1xufTtcbkVudGl0eVJlZmVyZW5jZS5wcm90b3R5cGUubm9kZVR5cGUgPSBFTlRJVFlfUkVGRVJFTkNFX05PREU7XG5fZXh0ZW5kcyhFbnRpdHlSZWZlcmVuY2UsTm9kZSk7XG5cbmZ1bmN0aW9uIERvY3VtZW50RnJhZ21lbnQoKSB7XG59O1xuRG9jdW1lbnRGcmFnbWVudC5wcm90b3R5cGUubm9kZU5hbWUgPVx0XCIjZG9jdW1lbnQtZnJhZ21lbnRcIjtcbkRvY3VtZW50RnJhZ21lbnQucHJvdG90eXBlLm5vZGVUeXBlID1cdERPQ1VNRU5UX0ZSQUdNRU5UX05PREU7XG5fZXh0ZW5kcyhEb2N1bWVudEZyYWdtZW50LE5vZGUpO1xuXG5cbmZ1bmN0aW9uIFByb2Nlc3NpbmdJbnN0cnVjdGlvbigpIHtcbn1cblByb2Nlc3NpbmdJbnN0cnVjdGlvbi5wcm90b3R5cGUubm9kZVR5cGUgPSBQUk9DRVNTSU5HX0lOU1RSVUNUSU9OX05PREU7XG5fZXh0ZW5kcyhQcm9jZXNzaW5nSW5zdHJ1Y3Rpb24sTm9kZSk7XG5mdW5jdGlvbiBYTUxTZXJpYWxpemVyKCl7fVxuWE1MU2VyaWFsaXplci5wcm90b3R5cGUuc2VyaWFsaXplVG9TdHJpbmcgPSBmdW5jdGlvbihub2RlLGF0dHJpYnV0ZVNvcnRlcil7XG5cdHJldHVybiBub2RlLnRvU3RyaW5nKGF0dHJpYnV0ZVNvcnRlcik7XG59XG5Ob2RlLnByb3RvdHlwZS50b1N0cmluZyA9ZnVuY3Rpb24oYXR0cmlidXRlU29ydGVyKXtcblx0dmFyIGJ1ZiA9IFtdO1xuXHRzZXJpYWxpemVUb1N0cmluZyh0aGlzLGJ1ZixhdHRyaWJ1dGVTb3J0ZXIpO1xuXHRyZXR1cm4gYnVmLmpvaW4oJycpO1xufVxuZnVuY3Rpb24gc2VyaWFsaXplVG9TdHJpbmcobm9kZSxidWYsYXR0cmlidXRlU29ydGVyLGlzSFRNTCl7XG5cdHN3aXRjaChub2RlLm5vZGVUeXBlKXtcblx0Y2FzZSBFTEVNRU5UX05PREU6XG5cdFx0dmFyIGF0dHJzID0gbm9kZS5hdHRyaWJ1dGVzO1xuXHRcdHZhciBsZW4gPSBhdHRycy5sZW5ndGg7XG5cdFx0dmFyIGNoaWxkID0gbm9kZS5maXJzdENoaWxkO1xuXHRcdHZhciBub2RlTmFtZSA9IG5vZGUudGFnTmFtZTtcblx0XHRpc0hUTUwgPSAgKGh0bWxucyA9PT0gbm9kZS5uYW1lc3BhY2VVUkkpIHx8aXNIVE1MIFxuXHRcdGJ1Zi5wdXNoKCc8Jyxub2RlTmFtZSk7XG5cdFx0aWYoYXR0cmlidXRlU29ydGVyKXtcblx0XHRcdGJ1Zi5zb3J0LmFwcGx5KGF0dHJzLCBhdHRyaWJ1dGVTb3J0ZXIpO1xuXHRcdH1cblx0XHRmb3IodmFyIGk9MDtpPGxlbjtpKyspe1xuXHRcdFx0c2VyaWFsaXplVG9TdHJpbmcoYXR0cnMuaXRlbShpKSxidWYsYXR0cmlidXRlU29ydGVyLGlzSFRNTCk7XG5cdFx0fVxuXHRcdGlmKGNoaWxkIHx8IGlzSFRNTCAmJiAhL14oPzptZXRhfGxpbmt8aW1nfGJyfGhyfGlucHV0fGJ1dHRvbikkL2kudGVzdChub2RlTmFtZSkpe1xuXHRcdFx0YnVmLnB1c2goJz4nKTtcblx0XHRcdC8vaWYgaXMgY2RhdGEgY2hpbGQgbm9kZVxuXHRcdFx0aWYoaXNIVE1MICYmIC9ec2NyaXB0JC9pLnRlc3Qobm9kZU5hbWUpKXtcblx0XHRcdFx0aWYoY2hpbGQpe1xuXHRcdFx0XHRcdGJ1Zi5wdXNoKGNoaWxkLmRhdGEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0d2hpbGUoY2hpbGQpe1xuXHRcdFx0XHRcdHNlcmlhbGl6ZVRvU3RyaW5nKGNoaWxkLGJ1ZixhdHRyaWJ1dGVTb3J0ZXIsaXNIVE1MKTtcblx0XHRcdFx0XHRjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRidWYucHVzaCgnPC8nLG5vZGVOYW1lLCc+Jyk7XG5cdFx0fWVsc2V7XG5cdFx0XHRidWYucHVzaCgnLz4nKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHRjYXNlIERPQ1VNRU5UX05PREU6XG5cdGNhc2UgRE9DVU1FTlRfRlJBR01FTlRfTk9ERTpcblx0XHR2YXIgY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG5cdFx0d2hpbGUoY2hpbGQpe1xuXHRcdFx0c2VyaWFsaXplVG9TdHJpbmcoY2hpbGQsYnVmLGF0dHJpYnV0ZVNvcnRlcixpc0hUTUwpO1xuXHRcdFx0Y2hpbGQgPSBjaGlsZC5uZXh0U2libGluZztcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHRjYXNlIEFUVFJJQlVURV9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaCgnICcsbm9kZS5uYW1lLCc9XCInLG5vZGUudmFsdWUucmVwbGFjZSgvWzwmXCJdL2csX3htbEVuY29kZXIpLCdcIicpO1xuXHRjYXNlIFRFWFRfTk9ERTpcblx0XHRyZXR1cm4gYnVmLnB1c2gobm9kZS5kYXRhLnJlcGxhY2UoL1s8Jl0vZyxfeG1sRW5jb2RlcikpO1xuXHRjYXNlIENEQVRBX1NFQ1RJT05fTk9ERTpcblx0XHRyZXR1cm4gYnVmLnB1c2goICc8IVtDREFUQVsnLG5vZGUuZGF0YSwnXV0+Jyk7XG5cdGNhc2UgQ09NTUVOVF9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaCggXCI8IS0tXCIsbm9kZS5kYXRhLFwiLS0+XCIpO1xuXHRjYXNlIERPQ1VNRU5UX1RZUEVfTk9ERTpcblx0XHR2YXIgcHViaWQgPSBub2RlLnB1YmxpY0lkO1xuXHRcdHZhciBzeXNpZCA9IG5vZGUuc3lzdGVtSWQ7XG5cdFx0YnVmLnB1c2goJzwhRE9DVFlQRSAnLG5vZGUubmFtZSk7XG5cdFx0aWYocHViaWQpe1xuXHRcdFx0YnVmLnB1c2goJyBQVUJMSUMgXCInLHB1YmlkKTtcblx0XHRcdGlmIChzeXNpZCAmJiBzeXNpZCE9Jy4nKSB7XG5cdFx0XHRcdGJ1Zi5wdXNoKCAnXCIgXCInLHN5c2lkKTtcblx0XHRcdH1cblx0XHRcdGJ1Zi5wdXNoKCdcIj4nKTtcblx0XHR9ZWxzZSBpZihzeXNpZCAmJiBzeXNpZCE9Jy4nKXtcblx0XHRcdGJ1Zi5wdXNoKCcgU1lTVEVNIFwiJyxzeXNpZCwnXCI+Jyk7XG5cdFx0fWVsc2V7XG5cdFx0XHR2YXIgc3ViID0gbm9kZS5pbnRlcm5hbFN1YnNldDtcblx0XHRcdGlmKHN1Yil7XG5cdFx0XHRcdGJ1Zi5wdXNoKFwiIFtcIixzdWIsXCJdXCIpO1xuXHRcdFx0fVxuXHRcdFx0YnVmLnB1c2goXCI+XCIpO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdGNhc2UgUFJPQ0VTU0lOR19JTlNUUlVDVElPTl9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaCggXCI8P1wiLG5vZGUudGFyZ2V0LFwiIFwiLG5vZGUuZGF0YSxcIj8+XCIpO1xuXHRjYXNlIEVOVElUWV9SRUZFUkVOQ0VfTk9ERTpcblx0XHRyZXR1cm4gYnVmLnB1c2goICcmJyxub2RlLm5vZGVOYW1lLCc7Jyk7XG5cdC8vY2FzZSBFTlRJVFlfTk9ERTpcblx0Ly9jYXNlIE5PVEFUSU9OX05PREU6XG5cdGRlZmF1bHQ6XG5cdFx0YnVmLnB1c2goJz8/Jyxub2RlLm5vZGVOYW1lKTtcblx0fVxufVxuZnVuY3Rpb24gaW1wb3J0Tm9kZShkb2Msbm9kZSxkZWVwKXtcblx0dmFyIG5vZGUyO1xuXHRzd2l0Y2ggKG5vZGUubm9kZVR5cGUpIHtcblx0Y2FzZSBFTEVNRU5UX05PREU6XG5cdFx0bm9kZTIgPSBub2RlLmNsb25lTm9kZShmYWxzZSk7XG5cdFx0bm9kZTIub3duZXJEb2N1bWVudCA9IGRvYztcblx0XHQvL3ZhciBhdHRycyA9IG5vZGUyLmF0dHJpYnV0ZXM7XG5cdFx0Ly92YXIgbGVuID0gYXR0cnMubGVuZ3RoO1xuXHRcdC8vZm9yKHZhciBpPTA7aTxsZW47aSsrKXtcblx0XHRcdC8vbm9kZTIuc2V0QXR0cmlidXRlTm9kZU5TKGltcG9ydE5vZGUoZG9jLGF0dHJzLml0ZW0oaSksZGVlcCkpO1xuXHRcdC8vfVxuXHRjYXNlIERPQ1VNRU5UX0ZSQUdNRU5UX05PREU6XG5cdFx0YnJlYWs7XG5cdGNhc2UgQVRUUklCVVRFX05PREU6XG5cdFx0ZGVlcCA9IHRydWU7XG5cdFx0YnJlYWs7XG5cdC8vY2FzZSBFTlRJVFlfUkVGRVJFTkNFX05PREU6XG5cdC8vY2FzZSBQUk9DRVNTSU5HX0lOU1RSVUNUSU9OX05PREU6XG5cdC8vLy9jYXNlIFRFWFRfTk9ERTpcblx0Ly9jYXNlIENEQVRBX1NFQ1RJT05fTk9ERTpcblx0Ly9jYXNlIENPTU1FTlRfTk9ERTpcblx0Ly9cdGRlZXAgPSBmYWxzZTtcblx0Ly9cdGJyZWFrO1xuXHQvL2Nhc2UgRE9DVU1FTlRfTk9ERTpcblx0Ly9jYXNlIERPQ1VNRU5UX1RZUEVfTk9ERTpcblx0Ly9jYW5ub3QgYmUgaW1wb3J0ZWQuXG5cdC8vY2FzZSBFTlRJVFlfTk9ERTpcblx0Ly9jYXNlIE5PVEFUSU9OX05PREXvvJpcblx0Ly9jYW4gbm90IGhpdCBpbiBsZXZlbDNcblx0Ly9kZWZhdWx0OnRocm93IGU7XG5cdH1cblx0aWYoIW5vZGUyKXtcblx0XHRub2RlMiA9IG5vZGUuY2xvbmVOb2RlKGZhbHNlKTsvL2ZhbHNlXG5cdH1cblx0bm9kZTIub3duZXJEb2N1bWVudCA9IGRvYztcblx0bm9kZTIucGFyZW50Tm9kZSA9IG51bGw7XG5cdGlmKGRlZXApe1xuXHRcdHZhciBjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcblx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRub2RlMi5hcHBlbmRDaGlsZChpbXBvcnROb2RlKGRvYyxjaGlsZCxkZWVwKSk7XG5cdFx0XHRjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbm9kZTI7XG59XG4vL1xuLy92YXIgX3JlbGF0aW9uTWFwID0ge2ZpcnN0Q2hpbGQ6MSxsYXN0Q2hpbGQ6MSxwcmV2aW91c1NpYmxpbmc6MSxuZXh0U2libGluZzoxLFxuLy9cdFx0XHRcdFx0YXR0cmlidXRlczoxLGNoaWxkTm9kZXM6MSxwYXJlbnROb2RlOjEsZG9jdW1lbnRFbGVtZW50OjEsZG9jdHlwZSx9O1xuZnVuY3Rpb24gY2xvbmVOb2RlKGRvYyxub2RlLGRlZXApe1xuXHR2YXIgbm9kZTIgPSBuZXcgbm9kZS5jb25zdHJ1Y3RvcigpO1xuXHRmb3IodmFyIG4gaW4gbm9kZSl7XG5cdFx0dmFyIHYgPSBub2RlW25dO1xuXHRcdGlmKHR5cGVvZiB2ICE9ICdvYmplY3QnICl7XG5cdFx0XHRpZih2ICE9IG5vZGUyW25dKXtcblx0XHRcdFx0bm9kZTJbbl0gPSB2O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZihub2RlLmNoaWxkTm9kZXMpe1xuXHRcdG5vZGUyLmNoaWxkTm9kZXMgPSBuZXcgTm9kZUxpc3QoKTtcblx0fVxuXHRub2RlMi5vd25lckRvY3VtZW50ID0gZG9jO1xuXHRzd2l0Y2ggKG5vZGUyLm5vZGVUeXBlKSB7XG5cdGNhc2UgRUxFTUVOVF9OT0RFOlxuXHRcdHZhciBhdHRyc1x0PSBub2RlLmF0dHJpYnV0ZXM7XG5cdFx0dmFyIGF0dHJzMlx0PSBub2RlMi5hdHRyaWJ1dGVzID0gbmV3IE5hbWVkTm9kZU1hcCgpO1xuXHRcdHZhciBsZW4gPSBhdHRycy5sZW5ndGhcblx0XHRhdHRyczIuX293bmVyRWxlbWVudCA9IG5vZGUyO1xuXHRcdGZvcih2YXIgaT0wO2k8bGVuO2krKyl7XG5cdFx0XHRub2RlMi5zZXRBdHRyaWJ1dGVOb2RlKGNsb25lTm9kZShkb2MsYXR0cnMuaXRlbShpKSx0cnVlKSk7XG5cdFx0fVxuXHRcdGJyZWFrOztcblx0Y2FzZSBBVFRSSUJVVEVfTk9ERTpcblx0XHRkZWVwID0gdHJ1ZTtcblx0fVxuXHRpZihkZWVwKXtcblx0XHR2YXIgY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG5cdFx0d2hpbGUoY2hpbGQpe1xuXHRcdFx0bm9kZTIuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKGRvYyxjaGlsZCxkZWVwKSk7XG5cdFx0XHRjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gbm9kZTI7XG59XG5cbmZ1bmN0aW9uIF9fc2V0X18ob2JqZWN0LGtleSx2YWx1ZSl7XG5cdG9iamVjdFtrZXldID0gdmFsdWVcbn1cbi8vZG8gZHluYW1pY1xudHJ5e1xuXHRpZihPYmplY3QuZGVmaW5lUHJvcGVydHkpe1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaXZlTm9kZUxpc3QucHJvdG90eXBlLCdsZW5ndGgnLHtcblx0XHRcdGdldDpmdW5jdGlvbigpe1xuXHRcdFx0XHRfdXBkYXRlTGl2ZUxpc3QodGhpcyk7XG5cdFx0XHRcdHJldHVybiB0aGlzLiQkbGVuZ3RoO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShOb2RlLnByb3RvdHlwZSwndGV4dENvbnRlbnQnLHtcblx0XHRcdGdldDpmdW5jdGlvbigpe1xuXHRcdFx0XHRyZXR1cm4gZ2V0VGV4dENvbnRlbnQodGhpcyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0OmZ1bmN0aW9uKGRhdGEpe1xuXHRcdFx0XHRzd2l0Y2godGhpcy5ub2RlVHlwZSl7XG5cdFx0XHRcdGNhc2UgMTpcblx0XHRcdFx0Y2FzZSAxMTpcblx0XHRcdFx0XHR3aGlsZSh0aGlzLmZpcnN0Q2hpbGQpe1xuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVDaGlsZCh0aGlzLmZpcnN0Q2hpbGQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZihkYXRhIHx8IFN0cmluZyhkYXRhKSl7XG5cdFx0XHRcdFx0XHR0aGlzLmFwcGVuZENoaWxkKHRoaXMub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShkYXRhKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdC8vVE9ETzpcblx0XHRcdFx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHRcdFx0XHR0aGlzLm5vZGVWYWx1ZSA9IGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KVxuXHRcdFxuXHRcdGZ1bmN0aW9uIGdldFRleHRDb250ZW50KG5vZGUpe1xuXHRcdFx0c3dpdGNoKG5vZGUubm9kZVR5cGUpe1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0Y2FzZSAxMTpcblx0XHRcdFx0dmFyIGJ1ZiA9IFtdO1xuXHRcdFx0XHRub2RlID0gbm9kZS5maXJzdENoaWxkO1xuXHRcdFx0XHR3aGlsZShub2RlKXtcblx0XHRcdFx0XHRpZihub2RlLm5vZGVUeXBlIT09NyAmJiBub2RlLm5vZGVUeXBlICE9PTgpe1xuXHRcdFx0XHRcdFx0YnVmLnB1c2goZ2V0VGV4dENvbnRlbnQobm9kZSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRub2RlID0gbm9kZS5uZXh0U2libGluZztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYnVmLmpvaW4oJycpO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIG5vZGUubm9kZVZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRfX3NldF9fID0gZnVuY3Rpb24ob2JqZWN0LGtleSx2YWx1ZSl7XG5cdFx0XHQvL2NvbnNvbGUubG9nKHZhbHVlKVxuXHRcdFx0b2JqZWN0WyckJCcra2V5XSA9IHZhbHVlXG5cdFx0fVxuXHR9XG59Y2F0Y2goZSl7Ly9pZThcbn1cblxuaWYodHlwZW9mIHJlcXVpcmUgPT0gJ2Z1bmN0aW9uJyl7XG5cdGV4cG9ydHMuRE9NSW1wbGVtZW50YXRpb24gPSBET01JbXBsZW1lbnRhdGlvbjtcblx0ZXhwb3J0cy5YTUxTZXJpYWxpemVyID0gWE1MU2VyaWFsaXplcjtcbn1cbiIsIi8vWzRdICAgXHROYW1lU3RhcnRDaGFyXHQgICA6Oj0gICBcdFwiOlwiIHwgW0EtWl0gfCBcIl9cIiB8IFthLXpdIHwgWyN4QzAtI3hENl0gfCBbI3hEOC0jeEY2XSB8IFsjeEY4LSN4MkZGXSB8IFsjeDM3MC0jeDM3RF0gfCBbI3gzN0YtI3gxRkZGXSB8IFsjeDIwMEMtI3gyMDBEXSB8IFsjeDIwNzAtI3gyMThGXSB8IFsjeDJDMDAtI3gyRkVGXSB8IFsjeDMwMDEtI3hEN0ZGXSB8IFsjeEY5MDAtI3hGRENGXSB8IFsjeEZERjAtI3hGRkZEXSB8IFsjeDEwMDAwLSN4RUZGRkZdXHJcbi8vWzRhXSAgIFx0TmFtZUNoYXJcdCAgIDo6PSAgIFx0TmFtZVN0YXJ0Q2hhciB8IFwiLVwiIHwgXCIuXCIgfCBbMC05XSB8ICN4QjcgfCBbI3gwMzAwLSN4MDM2Rl0gfCBbI3gyMDNGLSN4MjA0MF1cclxuLy9bNV0gICBcdE5hbWVcdCAgIDo6PSAgIFx0TmFtZVN0YXJ0Q2hhciAoTmFtZUNoYXIpKlxyXG52YXIgbmFtZVN0YXJ0Q2hhciA9IC9bQS1aX2EtelxceEMwLVxceEQ2XFx4RDgtXFx4RjZcXHUwMEY4LVxcdTAyRkZcXHUwMzcwLVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDLVxcdTIwMERcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdLy8vXFx1MTAwMDAtXFx1RUZGRkZcclxudmFyIG5hbWVDaGFyID0gbmV3IFJlZ0V4cChcIltcXFxcLVxcXFwuMC05XCIrbmFtZVN0YXJ0Q2hhci5zb3VyY2Uuc2xpY2UoMSwtMSkrXCJcXHUwMEI3XFx1MDMwMC1cXHUwMzZGXFxcXHUyMDNGLVxcdTIwNDBdXCIpO1xyXG52YXIgdGFnTmFtZVBhdHRlcm4gPSBuZXcgUmVnRXhwKCdeJytuYW1lU3RhcnRDaGFyLnNvdXJjZStuYW1lQ2hhci5zb3VyY2UrJyooPzpcXDonK25hbWVTdGFydENoYXIuc291cmNlK25hbWVDaGFyLnNvdXJjZSsnKik/JCcpO1xyXG4vL3ZhciB0YWdOYW1lUGF0dGVybiA9IC9eW2EtekEtWl9dW1xcd1xcLVxcLl0qKD86XFw6W2EtekEtWl9dW1xcd1xcLVxcLl0qKT8kL1xyXG4vL3ZhciBoYW5kbGVycyA9ICdyZXNvbHZlRW50aXR5LGdldEV4dGVybmFsU3Vic2V0LGNoYXJhY3RlcnMsZW5kRG9jdW1lbnQsZW5kRWxlbWVudCxlbmRQcmVmaXhNYXBwaW5nLGlnbm9yYWJsZVdoaXRlc3BhY2UscHJvY2Vzc2luZ0luc3RydWN0aW9uLHNldERvY3VtZW50TG9jYXRvcixza2lwcGVkRW50aXR5LHN0YXJ0RG9jdW1lbnQsc3RhcnRFbGVtZW50LHN0YXJ0UHJlZml4TWFwcGluZyxub3RhdGlvbkRlY2wsdW5wYXJzZWRFbnRpdHlEZWNsLGVycm9yLGZhdGFsRXJyb3Isd2FybmluZyxhdHRyaWJ1dGVEZWNsLGVsZW1lbnREZWNsLGV4dGVybmFsRW50aXR5RGVjbCxpbnRlcm5hbEVudGl0eURlY2wsY29tbWVudCxlbmRDREFUQSxlbmREVEQsZW5kRW50aXR5LHN0YXJ0Q0RBVEEsc3RhcnREVEQsc3RhcnRFbnRpdHknLnNwbGl0KCcsJylcclxuXHJcbi8vU19UQUcsXHRTX0FUVFIsXHRTX0VRLFx0U19WXHJcbi8vU19BVFRSX1MsXHRTX0UsXHRTX1MsXHRTX0NcclxudmFyIFNfVEFHID0gMDsvL3RhZyBuYW1lIG9mZmVycmluZ1xyXG52YXIgU19BVFRSID0gMTsvL2F0dHIgbmFtZSBvZmZlcnJpbmcgXHJcbnZhciBTX0FUVFJfUz0yOy8vYXR0ciBuYW1lIGVuZCBhbmQgc3BhY2Ugb2ZmZXJcclxudmFyIFNfRVEgPSAzOy8vPXNwYWNlP1xyXG52YXIgU19WID0gNDsvL2F0dHIgdmFsdWUobm8gcXVvdCB2YWx1ZSBvbmx5KVxyXG52YXIgU19FID0gNTsvL2F0dHIgdmFsdWUgZW5kIGFuZCBubyBzcGFjZShxdW90IGVuZClcclxudmFyIFNfUyA9IDY7Ly8oYXR0ciB2YWx1ZSBlbmQgfHwgdGFnIGVuZCApICYmIChzcGFjZSBvZmZlcilcclxudmFyIFNfQyA9IDc7Ly9jbG9zZWQgZWw8ZWwgLz5cclxuXHJcbmZ1bmN0aW9uIFhNTFJlYWRlcigpe1xyXG5cdFxyXG59XHJcblxyXG5YTUxSZWFkZXIucHJvdG90eXBlID0ge1xyXG5cdHBhcnNlOmZ1bmN0aW9uKHNvdXJjZSxkZWZhdWx0TlNNYXAsZW50aXR5TWFwKXtcclxuXHRcdHZhciBkb21CdWlsZGVyID0gdGhpcy5kb21CdWlsZGVyO1xyXG5cdFx0ZG9tQnVpbGRlci5zdGFydERvY3VtZW50KCk7XHJcblx0XHRfY29weShkZWZhdWx0TlNNYXAgLGRlZmF1bHROU01hcCA9IHt9KVxyXG5cdFx0cGFyc2Uoc291cmNlLGRlZmF1bHROU01hcCxlbnRpdHlNYXAsXHJcblx0XHRcdFx0ZG9tQnVpbGRlcix0aGlzLmVycm9ySGFuZGxlcik7XHJcblx0XHRkb21CdWlsZGVyLmVuZERvY3VtZW50KCk7XHJcblx0fVxyXG59XHJcbmZ1bmN0aW9uIHBhcnNlKHNvdXJjZSxkZWZhdWx0TlNNYXBDb3B5LGVudGl0eU1hcCxkb21CdWlsZGVyLGVycm9ySGFuZGxlcil7XHJcbiAgZnVuY3Rpb24gZml4ZWRGcm9tQ2hhckNvZGUoY29kZSkge1xyXG5cdFx0Ly8gU3RyaW5nLnByb3RvdHlwZS5mcm9tQ2hhckNvZGUgZG9lcyBub3Qgc3VwcG9ydHNcclxuXHRcdC8vID4gMiBieXRlcyB1bmljb2RlIGNoYXJzIGRpcmVjdGx5XHJcblx0XHRpZiAoY29kZSA+IDB4ZmZmZikge1xyXG5cdFx0XHRjb2RlIC09IDB4MTAwMDA7XHJcblx0XHRcdHZhciBzdXJyb2dhdGUxID0gMHhkODAwICsgKGNvZGUgPj4gMTApXHJcblx0XHRcdFx0LCBzdXJyb2dhdGUyID0gMHhkYzAwICsgKGNvZGUgJiAweDNmZik7XHJcblxyXG5cdFx0XHRyZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShzdXJyb2dhdGUxLCBzdXJyb2dhdGUyKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRmdW5jdGlvbiBlbnRpdHlSZXBsYWNlcihhKXtcclxuXHRcdHZhciBrID0gYS5zbGljZSgxLC0xKTtcclxuXHRcdGlmKGsgaW4gZW50aXR5TWFwKXtcclxuXHRcdFx0cmV0dXJuIGVudGl0eU1hcFtrXTsgXHJcblx0XHR9ZWxzZSBpZihrLmNoYXJBdCgwKSA9PT0gJyMnKXtcclxuXHRcdFx0cmV0dXJuIGZpeGVkRnJvbUNoYXJDb2RlKHBhcnNlSW50KGsuc3Vic3RyKDEpLnJlcGxhY2UoJ3gnLCcweCcpKSlcclxuXHRcdH1lbHNle1xyXG5cdFx0XHRlcnJvckhhbmRsZXIuZXJyb3IoJ2VudGl0eSBub3QgZm91bmQ6JythKTtcclxuXHRcdFx0cmV0dXJuIGE7XHJcblx0XHR9XHJcblx0fVxyXG5cdGZ1bmN0aW9uIGFwcGVuZFRleHQoZW5kKXsvL2hhcyBzb21lIGJ1Z3NcclxuXHRcdGlmKGVuZD5zdGFydCl7XHJcblx0XHRcdHZhciB4dCA9IHNvdXJjZS5zdWJzdHJpbmcoc3RhcnQsZW5kKS5yZXBsYWNlKC8mIz9cXHcrOy9nLGVudGl0eVJlcGxhY2VyKTtcclxuXHRcdFx0bG9jYXRvciYmcG9zaXRpb24oc3RhcnQpO1xyXG5cdFx0XHRkb21CdWlsZGVyLmNoYXJhY3RlcnMoeHQsMCxlbmQtc3RhcnQpO1xyXG5cdFx0XHRzdGFydCA9IGVuZFxyXG5cdFx0fVxyXG5cdH1cclxuXHRmdW5jdGlvbiBwb3NpdGlvbihwLG0pe1xyXG5cdFx0d2hpbGUocD49bGluZUVuZCAmJiAobSA9IGxpbmVQYXR0ZXJuLmV4ZWMoc291cmNlKSkpe1xyXG5cdFx0XHRsaW5lU3RhcnQgPSBtLmluZGV4O1xyXG5cdFx0XHRsaW5lRW5kID0gbGluZVN0YXJ0ICsgbVswXS5sZW5ndGg7XHJcblx0XHRcdGxvY2F0b3IubGluZU51bWJlcisrO1xyXG5cdFx0XHQvL2NvbnNvbGUubG9nKCdsaW5lKys6Jyxsb2NhdG9yLHN0YXJ0UG9zLGVuZFBvcylcclxuXHRcdH1cclxuXHRcdGxvY2F0b3IuY29sdW1uTnVtYmVyID0gcC1saW5lU3RhcnQrMTtcclxuXHR9XHJcblx0dmFyIGxpbmVTdGFydCA9IDA7XHJcblx0dmFyIGxpbmVFbmQgPSAwO1xyXG5cdHZhciBsaW5lUGF0dGVybiA9IC8uKyg/Olxcclxcbj98XFxuKXwuKiQvZ1xyXG5cdHZhciBsb2NhdG9yID0gZG9tQnVpbGRlci5sb2NhdG9yO1xyXG5cdFxyXG5cdHZhciBwYXJzZVN0YWNrID0gW3tjdXJyZW50TlNNYXA6ZGVmYXVsdE5TTWFwQ29weX1dXHJcblx0dmFyIGNsb3NlTWFwID0ge307XHJcblx0dmFyIHN0YXJ0ID0gMDtcclxuXHR3aGlsZSh0cnVlKXtcclxuXHRcdHRyeXtcclxuXHRcdFx0dmFyIHRhZ1N0YXJ0ID0gc291cmNlLmluZGV4T2YoJzwnLHN0YXJ0KTtcclxuXHRcdFx0aWYodGFnU3RhcnQ8MCl7XHJcblx0XHRcdFx0aWYoIXNvdXJjZS5zdWJzdHIoc3RhcnQpLm1hdGNoKC9eXFxzKiQvKSl7XHJcblx0XHRcdFx0XHR2YXIgZG9jID0gZG9tQnVpbGRlci5kb2N1bWVudDtcclxuXHQgICAgXHRcdFx0dmFyIHRleHQgPSBkb2MuY3JlYXRlVGV4dE5vZGUoc291cmNlLnN1YnN0cihzdGFydCkpO1xyXG5cdCAgICBcdFx0XHRkb2MuYXBwZW5kQ2hpbGQodGV4dCk7XHJcblx0ICAgIFx0XHRcdGRvbUJ1aWxkZXIuY3VycmVudEVsZW1lbnQgPSB0ZXh0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYodGFnU3RhcnQ+c3RhcnQpe1xyXG5cdFx0XHRcdGFwcGVuZFRleHQodGFnU3RhcnQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHN3aXRjaChzb3VyY2UuY2hhckF0KHRhZ1N0YXJ0KzEpKXtcclxuXHRcdFx0Y2FzZSAnLyc6XHJcblx0XHRcdFx0dmFyIGVuZCA9IHNvdXJjZS5pbmRleE9mKCc+Jyx0YWdTdGFydCszKTtcclxuXHRcdFx0XHR2YXIgdGFnTmFtZSA9IHNvdXJjZS5zdWJzdHJpbmcodGFnU3RhcnQrMixlbmQpO1xyXG5cdFx0XHRcdHZhciBjb25maWcgPSBwYXJzZVN0YWNrLnBvcCgpO1xyXG5cdFx0XHRcdHZhciBsb2NhbE5TTWFwID0gY29uZmlnLmxvY2FsTlNNYXA7XHJcblx0XHQgICAgICAgIGlmKGNvbmZpZy50YWdOYW1lICE9IHRhZ05hbWUpe1xyXG5cdFx0ICAgICAgICAgICAgZXJyb3JIYW5kbGVyLmZhdGFsRXJyb3IoXCJlbmQgdGFnIG5hbWU6IFwiK3RhZ05hbWUrJyBpcyBub3QgbWF0Y2ggdGhlIGN1cnJlbnQgc3RhcnQgdGFnTmFtZTonK2NvbmZpZy50YWdOYW1lICk7XHJcblx0XHQgICAgICAgIH1cclxuXHRcdFx0XHRkb21CdWlsZGVyLmVuZEVsZW1lbnQoY29uZmlnLnVyaSxjb25maWcubG9jYWxOYW1lLHRhZ05hbWUpO1xyXG5cdFx0XHRcdGlmKGxvY2FsTlNNYXApe1xyXG5cdFx0XHRcdFx0Zm9yKHZhciBwcmVmaXggaW4gbG9jYWxOU01hcCl7XHJcblx0XHRcdFx0XHRcdGRvbUJ1aWxkZXIuZW5kUHJlZml4TWFwcGluZyhwcmVmaXgpIDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZW5kKys7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Ly8gZW5kIGVsbWVudFxyXG5cdFx0XHRjYXNlICc/JzovLyA8Py4uLj8+XHJcblx0XHRcdFx0bG9jYXRvciYmcG9zaXRpb24odGFnU3RhcnQpO1xyXG5cdFx0XHRcdGVuZCA9IHBhcnNlSW5zdHJ1Y3Rpb24oc291cmNlLHRhZ1N0YXJ0LGRvbUJ1aWxkZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICchJzovLyA8IWRvY3R5cGUsPCFbQ0RBVEEsPCEtLVxyXG5cdFx0XHRcdGxvY2F0b3ImJnBvc2l0aW9uKHRhZ1N0YXJ0KTtcclxuXHRcdFx0XHRlbmQgPSBwYXJzZURDQyhzb3VyY2UsdGFnU3RhcnQsZG9tQnVpbGRlcixlcnJvckhhbmRsZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcclxuXHRcdFx0XHRsb2NhdG9yJiZwb3NpdGlvbih0YWdTdGFydCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0dmFyIGVsID0gbmV3IEVsZW1lbnRBdHRyaWJ1dGVzKCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Ly9lbFN0YXJ0RW5kXHJcblx0XHRcdFx0dmFyIGVuZCA9IHBhcnNlRWxlbWVudFN0YXJ0UGFydChzb3VyY2UsdGFnU3RhcnQsZWwsZW50aXR5UmVwbGFjZXIsZXJyb3JIYW5kbGVyKTtcclxuXHRcdFx0XHR2YXIgbGVuID0gZWwubGVuZ3RoO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmKGxvY2F0b3Ipe1xyXG5cdFx0XHRcdFx0aWYobGVuKXtcclxuXHRcdFx0XHRcdFx0Ly9hdHRyaWJ1dGUgcG9zaXRpb24gZml4ZWRcclxuXHRcdFx0XHRcdFx0Zm9yKHZhciBpID0gMDtpPGxlbjtpKyspe1xyXG5cdFx0XHRcdFx0XHRcdHZhciBhID0gZWxbaV07XHJcblx0XHRcdFx0XHRcdFx0cG9zaXRpb24oYS5vZmZzZXQpO1xyXG5cdFx0XHRcdFx0XHRcdGEub2Zmc2V0ID0gY29weUxvY2F0b3IobG9jYXRvcix7fSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHBvc2l0aW9uKGVuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmKCFlbC5jbG9zZWQgJiYgZml4U2VsZkNsb3NlZChzb3VyY2UsZW5kLGVsLnRhZ05hbWUsY2xvc2VNYXApKXtcclxuXHRcdFx0XHRcdGVsLmNsb3NlZCA9IHRydWU7XHJcblx0XHRcdFx0XHRpZighZW50aXR5TWFwLm5ic3Ape1xyXG5cdFx0XHRcdFx0XHRlcnJvckhhbmRsZXIud2FybmluZygndW5jbG9zZWQgeG1sIGF0dHJpYnV0ZScpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRhcHBlbmRFbGVtZW50KGVsLGRvbUJ1aWxkZXIscGFyc2VTdGFjayk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYoZWwudXJpID09PSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCcgJiYgIWVsLmNsb3NlZCl7XHJcblx0XHRcdFx0XHRlbmQgPSBwYXJzZUh0bWxTcGVjaWFsQ29udGVudChzb3VyY2UsZW5kLGVsLnRhZ05hbWUsZW50aXR5UmVwbGFjZXIsZG9tQnVpbGRlcilcclxuXHRcdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHRcdGVuZCsrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fWNhdGNoKGUpe1xyXG5cdFx0XHRlcnJvckhhbmRsZXIuZXJyb3IoJ2VsZW1lbnQgcGFyc2UgZXJyb3I6ICcrZSk7XHJcblx0XHRcdGVuZCA9IC0xO1xyXG5cdFx0fVxyXG5cdFx0aWYoZW5kPnN0YXJ0KXtcclxuXHRcdFx0c3RhcnQgPSBlbmQ7XHJcblx0XHR9ZWxzZXtcclxuXHRcdFx0Ly9UT0RPOiDov5nph4zmnInlj6/og71zYXjlm57pgIDvvIzmnInkvY3nva7plJnor6/po47pmalcclxuXHRcdFx0YXBwZW5kVGV4dChNYXRoLm1heCh0YWdTdGFydCxzdGFydCkrMSk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbmZ1bmN0aW9uIGNvcHlMb2NhdG9yKGYsdCl7XHJcblx0dC5saW5lTnVtYmVyID0gZi5saW5lTnVtYmVyO1xyXG5cdHQuY29sdW1uTnVtYmVyID0gZi5jb2x1bW5OdW1iZXI7XHJcblx0cmV0dXJuIHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBAc2VlICNhcHBlbmRFbGVtZW50KHNvdXJjZSxlbFN0YXJ0RW5kLGVsLHNlbGZDbG9zZWQsZW50aXR5UmVwbGFjZXIsZG9tQnVpbGRlcixwYXJzZVN0YWNrKTtcclxuICogQHJldHVybiBlbmQgb2YgdGhlIGVsZW1lbnRTdGFydFBhcnQoZW5kIG9mIGVsZW1lbnRFbmRQYXJ0IGZvciBzZWxmQ2xvc2VkIGVsKVxyXG4gKi9cclxuZnVuY3Rpb24gcGFyc2VFbGVtZW50U3RhcnRQYXJ0KHNvdXJjZSxzdGFydCxlbCxlbnRpdHlSZXBsYWNlcixlcnJvckhhbmRsZXIpe1xyXG5cdHZhciBhdHRyTmFtZTtcclxuXHR2YXIgdmFsdWU7XHJcblx0dmFyIHAgPSArK3N0YXJ0O1xyXG5cdHZhciBzID0gU19UQUc7Ly9zdGF0dXNcclxuXHR3aGlsZSh0cnVlKXtcclxuXHRcdHZhciBjID0gc291cmNlLmNoYXJBdChwKTtcclxuXHRcdHN3aXRjaChjKXtcclxuXHRcdGNhc2UgJz0nOlxyXG5cdFx0XHRpZihzID09PSBTX0FUVFIpey8vYXR0ck5hbWVcclxuXHRcdFx0XHRhdHRyTmFtZSA9IHNvdXJjZS5zbGljZShzdGFydCxwKTtcclxuXHRcdFx0XHRzID0gU19FUTtcclxuXHRcdFx0fWVsc2UgaWYocyA9PT0gU19BVFRSX1Mpe1xyXG5cdFx0XHRcdHMgPSBTX0VRO1xyXG5cdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHQvL2ZhdGFsRXJyb3I6IGVxdWFsIG11c3QgYWZ0ZXIgYXR0ck5hbWUgb3Igc3BhY2UgYWZ0ZXIgYXR0ck5hbWVcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2F0dHJpYnV0ZSBlcXVhbCBtdXN0IGFmdGVyIGF0dHJOYW1lJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHRjYXNlICdcXCcnOlxyXG5cdFx0Y2FzZSAnXCInOlxyXG5cdFx0XHRpZihzID09PSBTX0VRKXsvL2VxdWFsXHJcblx0XHRcdFx0c3RhcnQgPSBwKzE7XHJcblx0XHRcdFx0cCA9IHNvdXJjZS5pbmRleE9mKGMsc3RhcnQpXHJcblx0XHRcdFx0aWYocD4wKXtcclxuXHRcdFx0XHRcdHZhbHVlID0gc291cmNlLnNsaWNlKHN0YXJ0LHApLnJlcGxhY2UoLyYjP1xcdys7L2csZW50aXR5UmVwbGFjZXIpO1xyXG5cdFx0XHRcdFx0ZWwuYWRkKGF0dHJOYW1lLHZhbHVlLHN0YXJ0LTEpO1xyXG5cdFx0XHRcdFx0cyA9IFNfRTtcclxuXHRcdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHRcdC8vZmF0YWxFcnJvcjogbm8gZW5kIHF1b3QgbWF0Y2hcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignYXR0cmlidXRlIHZhbHVlIG5vIGVuZCBcXCcnK2MrJ1xcJyBtYXRjaCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fWVsc2UgaWYocyA9PSBTX1Ype1xyXG5cdFx0XHRcdHZhbHVlID0gc291cmNlLnNsaWNlKHN0YXJ0LHApLnJlcGxhY2UoLyYjP1xcdys7L2csZW50aXR5UmVwbGFjZXIpO1xyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coYXR0ck5hbWUsdmFsdWUsc3RhcnQscClcclxuXHRcdFx0XHRlbC5hZGQoYXR0ck5hbWUsdmFsdWUsc3RhcnQpO1xyXG5cdFx0XHRcdC8vY29uc29sZS5kaXIoZWwpXHJcblx0XHRcdFx0ZXJyb3JIYW5kbGVyLndhcm5pbmcoJ2F0dHJpYnV0ZSBcIicrYXR0ck5hbWUrJ1wiIG1pc3NlZCBzdGFydCBxdW90KCcrYysnKSEhJyk7XHJcblx0XHRcdFx0c3RhcnQgPSBwKzE7XHJcblx0XHRcdFx0cyA9IFNfRVxyXG5cdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHQvL2ZhdGFsRXJyb3I6IG5vIGVxdWFsIGJlZm9yZVxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignYXR0cmlidXRlIHZhbHVlIG11c3QgYWZ0ZXIgXCI9XCInKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJy8nOlxyXG5cdFx0XHRzd2l0Y2gocyl7XHJcblx0XHRcdGNhc2UgU19UQUc6XHJcblx0XHRcdFx0ZWwuc2V0VGFnTmFtZShzb3VyY2Uuc2xpY2Uoc3RhcnQscCkpO1xyXG5cdFx0XHRjYXNlIFNfRTpcclxuXHRcdFx0Y2FzZSBTX1M6XHJcblx0XHRcdGNhc2UgU19DOlxyXG5cdFx0XHRcdHMgPSBTX0M7XHJcblx0XHRcdFx0ZWwuY2xvc2VkID0gdHJ1ZTtcclxuXHRcdFx0Y2FzZSBTX1Y6XHJcblx0XHRcdGNhc2UgU19BVFRSOlxyXG5cdFx0XHRjYXNlIFNfQVRUUl9TOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHQvL2Nhc2UgU19FUTpcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJhdHRyaWJ1dGUgaW52YWxpZCBjbG9zZSBjaGFyKCcvJylcIilcclxuXHRcdFx0fVxyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJyc6Ly9lbmQgZG9jdW1lbnRcclxuXHRcdFx0Ly90aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0JylcclxuXHRcdFx0ZXJyb3JIYW5kbGVyLmVycm9yKCd1bmV4cGVjdGVkIGVuZCBvZiBpbnB1dCcpO1xyXG5cdFx0Y2FzZSAnPic6XHJcblx0XHRcdHN3aXRjaChzKXtcclxuXHRcdFx0Y2FzZSBTX1RBRzpcclxuXHRcdFx0XHRlbC5zZXRUYWdOYW1lKHNvdXJjZS5zbGljZShzdGFydCxwKSk7XHJcblx0XHRcdGNhc2UgU19FOlxyXG5cdFx0XHRjYXNlIFNfUzpcclxuXHRcdFx0Y2FzZSBTX0M6XHJcblx0XHRcdFx0YnJlYWs7Ly9ub3JtYWxcclxuXHRcdFx0Y2FzZSBTX1Y6Ly9Db21wYXRpYmxlIHN0YXRlXHJcblx0XHRcdGNhc2UgU19BVFRSOlxyXG5cdFx0XHRcdHZhbHVlID0gc291cmNlLnNsaWNlKHN0YXJ0LHApO1xyXG5cdFx0XHRcdGlmKHZhbHVlLnNsaWNlKC0xKSA9PT0gJy8nKXtcclxuXHRcdFx0XHRcdGVsLmNsb3NlZCAgPSB0cnVlO1xyXG5cdFx0XHRcdFx0dmFsdWUgPSB2YWx1ZS5zbGljZSgwLC0xKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0Y2FzZSBTX0FUVFJfUzpcclxuXHRcdFx0XHRpZihzID09PSBTX0FUVFJfUyl7XHJcblx0XHRcdFx0XHR2YWx1ZSA9IGF0dHJOYW1lO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZihzID09IFNfVil7XHJcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIud2FybmluZygnYXR0cmlidXRlIFwiJyt2YWx1ZSsnXCIgbWlzc2VkIHF1b3QoXCIpISEnKTtcclxuXHRcdFx0XHRcdGVsLmFkZChhdHRyTmFtZSx2YWx1ZS5yZXBsYWNlKC8mIz9cXHcrOy9nLGVudGl0eVJlcGxhY2VyKSxzdGFydClcclxuXHRcdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHRcdGVycm9ySGFuZGxlci53YXJuaW5nKCdhdHRyaWJ1dGUgXCInK3ZhbHVlKydcIiBtaXNzZWQgdmFsdWUhISBcIicrdmFsdWUrJ1wiIGluc3RlYWQhIScpXHJcblx0XHRcdFx0XHRlbC5hZGQodmFsdWUsdmFsdWUsc3RhcnQpXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlIFNfRVE6XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdhdHRyaWJ1dGUgdmFsdWUgbWlzc2VkISEnKTtcclxuXHRcdFx0fVxyXG4vL1x0XHRcdGNvbnNvbGUubG9nKHRhZ05hbWUsdGFnTmFtZVBhdHRlcm4sdGFnTmFtZVBhdHRlcm4udGVzdCh0YWdOYW1lKSlcclxuXHRcdFx0cmV0dXJuIHA7XHJcblx0XHQvKnhtbCBzcGFjZSAnXFx4MjAnIHwgI3g5IHwgI3hEIHwgI3hBOyAqL1xyXG5cdFx0Y2FzZSAnXFx1MDA4MCc6XHJcblx0XHRcdGMgPSAnICc7XHJcblx0XHRkZWZhdWx0OlxyXG5cdFx0XHRpZihjPD0gJyAnKXsvL3NwYWNlXHJcblx0XHRcdFx0c3dpdGNoKHMpe1xyXG5cdFx0XHRcdGNhc2UgU19UQUc6XHJcblx0XHRcdFx0XHRlbC5zZXRUYWdOYW1lKHNvdXJjZS5zbGljZShzdGFydCxwKSk7Ly90YWdOYW1lXHJcblx0XHRcdFx0XHRzID0gU19TO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX0FUVFI6XHJcblx0XHRcdFx0XHRhdHRyTmFtZSA9IHNvdXJjZS5zbGljZShzdGFydCxwKVxyXG5cdFx0XHRcdFx0cyA9IFNfQVRUUl9TO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX1Y6XHJcblx0XHRcdFx0XHR2YXIgdmFsdWUgPSBzb3VyY2Uuc2xpY2Uoc3RhcnQscCkucmVwbGFjZSgvJiM/XFx3KzsvZyxlbnRpdHlSZXBsYWNlcik7XHJcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIud2FybmluZygnYXR0cmlidXRlIFwiJyt2YWx1ZSsnXCIgbWlzc2VkIHF1b3QoXCIpISEnKTtcclxuXHRcdFx0XHRcdGVsLmFkZChhdHRyTmFtZSx2YWx1ZSxzdGFydClcclxuXHRcdFx0XHRjYXNlIFNfRTpcclxuXHRcdFx0XHRcdHMgPSBTX1M7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHQvL2Nhc2UgU19TOlxyXG5cdFx0XHRcdC8vY2FzZSBTX0VROlxyXG5cdFx0XHRcdC8vY2FzZSBTX0FUVFJfUzpcclxuXHRcdFx0XHQvL1x0dm9pZCgpO2JyZWFrO1xyXG5cdFx0XHRcdC8vY2FzZSBTX0M6XHJcblx0XHRcdFx0XHQvL2lnbm9yZSB3YXJuaW5nXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ZWxzZXsvL25vdCBzcGFjZVxyXG4vL1NfVEFHLFx0U19BVFRSLFx0U19FUSxcdFNfVlxyXG4vL1NfQVRUUl9TLFx0U19FLFx0U19TLFx0U19DXHJcblx0XHRcdFx0c3dpdGNoKHMpe1xyXG5cdFx0XHRcdC8vY2FzZSBTX1RBRzp2b2lkKCk7YnJlYWs7XHJcblx0XHRcdFx0Ly9jYXNlIFNfQVRUUjp2b2lkKCk7YnJlYWs7XHJcblx0XHRcdFx0Ly9jYXNlIFNfVjp2b2lkKCk7YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX0FUVFJfUzpcclxuXHRcdFx0XHRcdGVycm9ySGFuZGxlci53YXJuaW5nKCdhdHRyaWJ1dGUgXCInK2F0dHJOYW1lKydcIiBtaXNzZWQgdmFsdWUhISBcIicrYXR0ck5hbWUrJ1wiIGluc3RlYWQhIScpXHJcblx0XHRcdFx0XHRlbC5hZGQoYXR0ck5hbWUsYXR0ck5hbWUsc3RhcnQpO1xyXG5cdFx0XHRcdFx0c3RhcnQgPSBwO1xyXG5cdFx0XHRcdFx0cyA9IFNfQVRUUjtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2UgU19FOlxyXG5cdFx0XHRcdFx0ZXJyb3JIYW5kbGVyLndhcm5pbmcoJ2F0dHJpYnV0ZSBzcGFjZSBpcyByZXF1aXJlZFwiJythdHRyTmFtZSsnXCIhIScpXHJcblx0XHRcdFx0Y2FzZSBTX1M6XHJcblx0XHRcdFx0XHRzID0gU19BVFRSO1xyXG5cdFx0XHRcdFx0c3RhcnQgPSBwO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX0VROlxyXG5cdFx0XHRcdFx0cyA9IFNfVjtcclxuXHRcdFx0XHRcdHN0YXJ0ID0gcDtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2UgU19DOlxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZWxlbWVudHMgY2xvc2VkIGNoYXJhY3RlciAnLycgYW5kICc+JyBtdXN0IGJlIGNvbm5lY3RlZCB0b1wiKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHArKztcclxuXHR9XHJcbn1cclxuLyoqXHJcbiAqIEByZXR1cm4gZW5kIG9mIHRoZSBlbGVtZW50U3RhcnRQYXJ0KGVuZCBvZiBlbGVtZW50RW5kUGFydCBmb3Igc2VsZkNsb3NlZCBlbClcclxuICovXHJcbmZ1bmN0aW9uIGFwcGVuZEVsZW1lbnQoZWwsZG9tQnVpbGRlcixwYXJzZVN0YWNrKXtcclxuXHR2YXIgdGFnTmFtZSA9IGVsLnRhZ05hbWU7XHJcblx0dmFyIGxvY2FsTlNNYXAgPSBudWxsO1xyXG5cdHZhciBjdXJyZW50TlNNYXAgPSBwYXJzZVN0YWNrW3BhcnNlU3RhY2subGVuZ3RoLTFdLmN1cnJlbnROU01hcDtcclxuXHR2YXIgaSA9IGVsLmxlbmd0aDtcclxuXHR3aGlsZShpLS0pe1xyXG5cdFx0dmFyIGEgPSBlbFtpXTtcclxuXHRcdHZhciBxTmFtZSA9IGEucU5hbWU7XHJcblx0XHR2YXIgdmFsdWUgPSBhLnZhbHVlO1xyXG5cdFx0dmFyIG5zcCA9IHFOYW1lLmluZGV4T2YoJzonKTtcclxuXHRcdGlmKG5zcD4wKXtcclxuXHRcdFx0dmFyIHByZWZpeCA9IGEucHJlZml4ID0gcU5hbWUuc2xpY2UoMCxuc3ApO1xyXG5cdFx0XHR2YXIgbG9jYWxOYW1lID0gcU5hbWUuc2xpY2UobnNwKzEpO1xyXG5cdFx0XHR2YXIgbnNQcmVmaXggPSBwcmVmaXggPT09ICd4bWxucycgJiYgbG9jYWxOYW1lXHJcblx0XHR9ZWxzZXtcclxuXHRcdFx0bG9jYWxOYW1lID0gcU5hbWU7XHJcblx0XHRcdHByZWZpeCA9IG51bGxcclxuXHRcdFx0bnNQcmVmaXggPSBxTmFtZSA9PT0gJ3htbG5zJyAmJiAnJ1xyXG5cdFx0fVxyXG5cdFx0Ly9jYW4gbm90IHNldCBwcmVmaXgsYmVjYXVzZSBwcmVmaXggIT09ICcnXHJcblx0XHRhLmxvY2FsTmFtZSA9IGxvY2FsTmFtZSA7XHJcblx0XHQvL3ByZWZpeCA9PSBudWxsIGZvciBubyBucyBwcmVmaXggYXR0cmlidXRlIFxyXG5cdFx0aWYobnNQcmVmaXggIT09IGZhbHNlKXsvL2hhY2shIVxyXG5cdFx0XHRpZihsb2NhbE5TTWFwID09IG51bGwpe1xyXG5cdFx0XHRcdGxvY2FsTlNNYXAgPSB7fVxyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coY3VycmVudE5TTWFwLDApXHJcblx0XHRcdFx0X2NvcHkoY3VycmVudE5TTWFwLGN1cnJlbnROU01hcD17fSlcclxuXHRcdFx0XHQvL2NvbnNvbGUubG9nKGN1cnJlbnROU01hcCwxKVxyXG5cdFx0XHR9XHJcblx0XHRcdGN1cnJlbnROU01hcFtuc1ByZWZpeF0gPSBsb2NhbE5TTWFwW25zUHJlZml4XSA9IHZhbHVlO1xyXG5cdFx0XHRhLnVyaSA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3htbG5zLydcclxuXHRcdFx0ZG9tQnVpbGRlci5zdGFydFByZWZpeE1hcHBpbmcobnNQcmVmaXgsIHZhbHVlKSBcclxuXHRcdH1cclxuXHR9XHJcblx0dmFyIGkgPSBlbC5sZW5ndGg7XHJcblx0d2hpbGUoaS0tKXtcclxuXHRcdGEgPSBlbFtpXTtcclxuXHRcdHZhciBwcmVmaXggPSBhLnByZWZpeDtcclxuXHRcdGlmKHByZWZpeCl7Ly9ubyBwcmVmaXggYXR0cmlidXRlIGhhcyBubyBuYW1lc3BhY2VcclxuXHRcdFx0aWYocHJlZml4ID09PSAneG1sJyl7XHJcblx0XHRcdFx0YS51cmkgPSAnaHR0cDovL3d3dy53My5vcmcvWE1MLzE5OTgvbmFtZXNwYWNlJztcclxuXHRcdFx0fWlmKHByZWZpeCAhPT0gJ3htbG5zJyl7XHJcblx0XHRcdFx0YS51cmkgPSBjdXJyZW50TlNNYXBbcHJlZml4XVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdC8ve2NvbnNvbGUubG9nKCcjIyMnK2EucU5hbWUsZG9tQnVpbGRlci5sb2NhdG9yLnN5c3RlbUlkKycnLGN1cnJlbnROU01hcCxhLnVyaSl9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0dmFyIG5zcCA9IHRhZ05hbWUuaW5kZXhPZignOicpO1xyXG5cdGlmKG5zcD4wKXtcclxuXHRcdHByZWZpeCA9IGVsLnByZWZpeCA9IHRhZ05hbWUuc2xpY2UoMCxuc3ApO1xyXG5cdFx0bG9jYWxOYW1lID0gZWwubG9jYWxOYW1lID0gdGFnTmFtZS5zbGljZShuc3ArMSk7XHJcblx0fWVsc2V7XHJcblx0XHRwcmVmaXggPSBudWxsOy8vaW1wb3J0YW50ISFcclxuXHRcdGxvY2FsTmFtZSA9IGVsLmxvY2FsTmFtZSA9IHRhZ05hbWU7XHJcblx0fVxyXG5cdC8vbm8gcHJlZml4IGVsZW1lbnQgaGFzIGRlZmF1bHQgbmFtZXNwYWNlXHJcblx0dmFyIG5zID0gZWwudXJpID0gY3VycmVudE5TTWFwW3ByZWZpeCB8fCAnJ107XHJcblx0ZG9tQnVpbGRlci5zdGFydEVsZW1lbnQobnMsbG9jYWxOYW1lLHRhZ05hbWUsZWwpO1xyXG5cdC8vZW5kUHJlZml4TWFwcGluZyBhbmQgc3RhcnRQcmVmaXhNYXBwaW5nIGhhdmUgbm90IGFueSBoZWxwIGZvciBkb20gYnVpbGRlclxyXG5cdC8vbG9jYWxOU01hcCA9IG51bGxcclxuXHRpZihlbC5jbG9zZWQpe1xyXG5cdFx0ZG9tQnVpbGRlci5lbmRFbGVtZW50KG5zLGxvY2FsTmFtZSx0YWdOYW1lKTtcclxuXHRcdGlmKGxvY2FsTlNNYXApe1xyXG5cdFx0XHRmb3IocHJlZml4IGluIGxvY2FsTlNNYXApe1xyXG5cdFx0XHRcdGRvbUJ1aWxkZXIuZW5kUHJlZml4TWFwcGluZyhwcmVmaXgpIFxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fWVsc2V7XHJcblx0XHRlbC5jdXJyZW50TlNNYXAgPSBjdXJyZW50TlNNYXA7XHJcblx0XHRlbC5sb2NhbE5TTWFwID0gbG9jYWxOU01hcDtcclxuXHRcdHBhcnNlU3RhY2sucHVzaChlbCk7XHJcblx0fVxyXG59XHJcbmZ1bmN0aW9uIHBhcnNlSHRtbFNwZWNpYWxDb250ZW50KHNvdXJjZSxlbFN0YXJ0RW5kLHRhZ05hbWUsZW50aXR5UmVwbGFjZXIsZG9tQnVpbGRlcil7XHJcblx0aWYoL14oPzpzY3JpcHR8dGV4dGFyZWEpJC9pLnRlc3QodGFnTmFtZSkpe1xyXG5cdFx0dmFyIGVsRW5kU3RhcnQgPSAgc291cmNlLmluZGV4T2YoJzwvJyt0YWdOYW1lKyc+JyxlbFN0YXJ0RW5kKTtcclxuXHRcdHZhciB0ZXh0ID0gc291cmNlLnN1YnN0cmluZyhlbFN0YXJ0RW5kKzEsZWxFbmRTdGFydCk7XHJcblx0XHRpZigvWyY8XS8udGVzdCh0ZXh0KSl7XHJcblx0XHRcdGlmKC9ec2NyaXB0JC9pLnRlc3QodGFnTmFtZSkpe1xyXG5cdFx0XHRcdC8vaWYoIS9cXF1cXF0+Ly50ZXN0KHRleHQpKXtcclxuXHRcdFx0XHRcdC8vbGV4SGFuZGxlci5zdGFydENEQVRBKCk7XHJcblx0XHRcdFx0XHRkb21CdWlsZGVyLmNoYXJhY3RlcnModGV4dCwwLHRleHQubGVuZ3RoKTtcclxuXHRcdFx0XHRcdC8vbGV4SGFuZGxlci5lbmRDREFUQSgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGVsRW5kU3RhcnQ7XHJcblx0XHRcdFx0Ly99XHJcblx0XHRcdH0vL31lbHNley8vdGV4dCBhcmVhXHJcblx0XHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvJiM/XFx3KzsvZyxlbnRpdHlSZXBsYWNlcik7XHJcblx0XHRcdFx0ZG9tQnVpbGRlci5jaGFyYWN0ZXJzKHRleHQsMCx0ZXh0Lmxlbmd0aCk7XHJcblx0XHRcdFx0cmV0dXJuIGVsRW5kU3RhcnQ7XHJcblx0XHRcdC8vfVxyXG5cdFx0XHRcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIGVsU3RhcnRFbmQrMTtcclxufVxyXG5mdW5jdGlvbiBmaXhTZWxmQ2xvc2VkKHNvdXJjZSxlbFN0YXJ0RW5kLHRhZ05hbWUsY2xvc2VNYXApe1xyXG5cdC8vaWYodGFnTmFtZSBpbiBjbG9zZU1hcCl7XHJcblx0dmFyIHBvcyA9IGNsb3NlTWFwW3RhZ05hbWVdO1xyXG5cdGlmKHBvcyA9PSBudWxsKXtcclxuXHRcdC8vY29uc29sZS5sb2codGFnTmFtZSlcclxuXHRcdHBvcyA9IGNsb3NlTWFwW3RhZ05hbWVdID0gc291cmNlLmxhc3RJbmRleE9mKCc8LycrdGFnTmFtZSsnPicpXHJcblx0fVxyXG5cdHJldHVybiBwb3M8ZWxTdGFydEVuZDtcclxuXHQvL30gXHJcbn1cclxuZnVuY3Rpb24gX2NvcHkoc291cmNlLHRhcmdldCl7XHJcblx0Zm9yKHZhciBuIGluIHNvdXJjZSl7dGFyZ2V0W25dID0gc291cmNlW25dfVxyXG59XHJcbmZ1bmN0aW9uIHBhcnNlRENDKHNvdXJjZSxzdGFydCxkb21CdWlsZGVyLGVycm9ySGFuZGxlcil7Ly9zdXJlIHN0YXJ0IHdpdGggJzwhJ1xyXG5cdHZhciBuZXh0PSBzb3VyY2UuY2hhckF0KHN0YXJ0KzIpXHJcblx0c3dpdGNoKG5leHQpe1xyXG5cdGNhc2UgJy0nOlxyXG5cdFx0aWYoc291cmNlLmNoYXJBdChzdGFydCArIDMpID09PSAnLScpe1xyXG5cdFx0XHR2YXIgZW5kID0gc291cmNlLmluZGV4T2YoJy0tPicsc3RhcnQrNCk7XHJcblx0XHRcdC8vYXBwZW5kIGNvbW1lbnQgc291cmNlLnN1YnN0cmluZyg0LGVuZCkvLzwhLS1cclxuXHRcdFx0aWYoZW5kPnN0YXJ0KXtcclxuXHRcdFx0XHRkb21CdWlsZGVyLmNvbW1lbnQoc291cmNlLHN0YXJ0KzQsZW5kLXN0YXJ0LTQpO1xyXG5cdFx0XHRcdHJldHVybiBlbmQrMztcclxuXHRcdFx0fWVsc2V7XHJcblx0XHRcdFx0ZXJyb3JIYW5kbGVyLmVycm9yKFwiVW5jbG9zZWQgY29tbWVudFwiKTtcclxuXHRcdFx0XHRyZXR1cm4gLTE7XHJcblx0XHRcdH1cclxuXHRcdH1lbHNle1xyXG5cdFx0XHQvL2Vycm9yXHJcblx0XHRcdHJldHVybiAtMTtcclxuXHRcdH1cclxuXHRkZWZhdWx0OlxyXG5cdFx0aWYoc291cmNlLnN1YnN0cihzdGFydCszLDYpID09ICdDREFUQVsnKXtcclxuXHRcdFx0dmFyIGVuZCA9IHNvdXJjZS5pbmRleE9mKCddXT4nLHN0YXJ0KzkpO1xyXG5cdFx0XHRkb21CdWlsZGVyLnN0YXJ0Q0RBVEEoKTtcclxuXHRcdFx0ZG9tQnVpbGRlci5jaGFyYWN0ZXJzKHNvdXJjZSxzdGFydCs5LGVuZC1zdGFydC05KTtcclxuXHRcdFx0ZG9tQnVpbGRlci5lbmRDREFUQSgpIFxyXG5cdFx0XHRyZXR1cm4gZW5kKzM7XHJcblx0XHR9XHJcblx0XHQvLzwhRE9DVFlQRVxyXG5cdFx0Ly9zdGFydERURChqYXZhLmxhbmcuU3RyaW5nIG5hbWUsIGphdmEubGFuZy5TdHJpbmcgcHVibGljSWQsIGphdmEubGFuZy5TdHJpbmcgc3lzdGVtSWQpIFxyXG5cdFx0dmFyIG1hdGNocyA9IHNwbGl0KHNvdXJjZSxzdGFydCk7XHJcblx0XHR2YXIgbGVuID0gbWF0Y2hzLmxlbmd0aDtcclxuXHRcdGlmKGxlbj4xICYmIC8hZG9jdHlwZS9pLnRlc3QobWF0Y2hzWzBdWzBdKSl7XHJcblx0XHRcdHZhciBuYW1lID0gbWF0Y2hzWzFdWzBdO1xyXG5cdFx0XHR2YXIgcHViaWQgPSBsZW4+MyAmJiAvXnB1YmxpYyQvaS50ZXN0KG1hdGNoc1syXVswXSkgJiYgbWF0Y2hzWzNdWzBdXHJcblx0XHRcdHZhciBzeXNpZCA9IGxlbj40ICYmIG1hdGNoc1s0XVswXTtcclxuXHRcdFx0dmFyIGxhc3RNYXRjaCA9IG1hdGNoc1tsZW4tMV1cclxuXHRcdFx0ZG9tQnVpbGRlci5zdGFydERURChuYW1lLHB1YmlkICYmIHB1YmlkLnJlcGxhY2UoL14oWydcIl0pKC4qPylcXDEkLywnJDInKSxcclxuXHRcdFx0XHRcdHN5c2lkICYmIHN5c2lkLnJlcGxhY2UoL14oWydcIl0pKC4qPylcXDEkLywnJDInKSk7XHJcblx0XHRcdGRvbUJ1aWxkZXIuZW5kRFREKCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gbGFzdE1hdGNoLmluZGV4K2xhc3RNYXRjaFswXS5sZW5ndGhcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIC0xO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHBhcnNlSW5zdHJ1Y3Rpb24oc291cmNlLHN0YXJ0LGRvbUJ1aWxkZXIpe1xyXG5cdHZhciBlbmQgPSBzb3VyY2UuaW5kZXhPZignPz4nLHN0YXJ0KTtcclxuXHRpZihlbmQpe1xyXG5cdFx0dmFyIG1hdGNoID0gc291cmNlLnN1YnN0cmluZyhzdGFydCxlbmQpLm1hdGNoKC9ePFxcPyhcXFMqKVxccyooW1xcc1xcU10qPylcXHMqJC8pO1xyXG5cdFx0aWYobWF0Y2gpe1xyXG5cdFx0XHR2YXIgbGVuID0gbWF0Y2hbMF0ubGVuZ3RoO1xyXG5cdFx0XHRkb21CdWlsZGVyLnByb2Nlc3NpbmdJbnN0cnVjdGlvbihtYXRjaFsxXSwgbWF0Y2hbMl0pIDtcclxuXHRcdFx0cmV0dXJuIGVuZCsyO1xyXG5cdFx0fWVsc2V7Ly9lcnJvclxyXG5cdFx0XHRyZXR1cm4gLTE7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbSBzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIEVsZW1lbnRBdHRyaWJ1dGVzKHNvdXJjZSl7XHJcblx0XHJcbn1cclxuRWxlbWVudEF0dHJpYnV0ZXMucHJvdG90eXBlID0ge1xyXG5cdHNldFRhZ05hbWU6ZnVuY3Rpb24odGFnTmFtZSl7XHJcblx0XHRpZighdGFnTmFtZVBhdHRlcm4udGVzdCh0YWdOYW1lKSl7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignaW52YWxpZCB0YWdOYW1lOicrdGFnTmFtZSlcclxuXHRcdH1cclxuXHRcdHRoaXMudGFnTmFtZSA9IHRhZ05hbWVcclxuXHR9LFxyXG5cdGFkZDpmdW5jdGlvbihxTmFtZSx2YWx1ZSxvZmZzZXQpe1xyXG5cdFx0aWYoIXRhZ05hbWVQYXR0ZXJuLnRlc3QocU5hbWUpKXtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGF0dHJpYnV0ZTonK3FOYW1lKVxyXG5cdFx0fVxyXG5cdFx0dGhpc1t0aGlzLmxlbmd0aCsrXSA9IHtxTmFtZTpxTmFtZSx2YWx1ZTp2YWx1ZSxvZmZzZXQ6b2Zmc2V0fVxyXG5cdH0sXHJcblx0bGVuZ3RoOjAsXHJcblx0Z2V0TG9jYWxOYW1lOmZ1bmN0aW9uKGkpe3JldHVybiB0aGlzW2ldLmxvY2FsTmFtZX0sXHJcblx0Z2V0T2Zmc2V0OmZ1bmN0aW9uKGkpe3JldHVybiB0aGlzW2ldLm9mZnNldH0sXHJcblx0Z2V0UU5hbWU6ZnVuY3Rpb24oaSl7cmV0dXJuIHRoaXNbaV0ucU5hbWV9LFxyXG5cdGdldFVSSTpmdW5jdGlvbihpKXtyZXR1cm4gdGhpc1tpXS51cml9LFxyXG5cdGdldFZhbHVlOmZ1bmN0aW9uKGkpe3JldHVybiB0aGlzW2ldLnZhbHVlfVxyXG4vL1x0LGdldEluZGV4OmZ1bmN0aW9uKHVyaSwgbG9jYWxOYW1lKSl7XHJcbi8vXHRcdGlmKGxvY2FsTmFtZSl7XHJcbi8vXHRcdFx0XHJcbi8vXHRcdH1lbHNle1xyXG4vL1x0XHRcdHZhciBxTmFtZSA9IHVyaVxyXG4vL1x0XHR9XHJcbi8vXHR9LFxyXG4vL1x0Z2V0VmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nZXRWYWx1ZSh0aGlzLmdldEluZGV4LmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9LFxyXG4vL1x0Z2V0VHlwZTpmdW5jdGlvbih1cmksbG9jYWxOYW1lKXt9XHJcbi8vXHRnZXRUeXBlOmZ1bmN0aW9uKGkpe30sXHJcbn1cclxuXHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIF9zZXRfcHJvdG9fKHRoaXoscGFyZW50KXtcclxuXHR0aGl6Ll9fcHJvdG9fXyA9IHBhcmVudDtcclxuXHRyZXR1cm4gdGhpejtcclxufVxyXG5pZighKF9zZXRfcHJvdG9fKHt9LF9zZXRfcHJvdG9fLnByb3RvdHlwZSkgaW5zdGFuY2VvZiBfc2V0X3Byb3RvXykpe1xyXG5cdF9zZXRfcHJvdG9fID0gZnVuY3Rpb24odGhpeixwYXJlbnQpe1xyXG5cdFx0ZnVuY3Rpb24gcCgpe307XHJcblx0XHRwLnByb3RvdHlwZSA9IHBhcmVudDtcclxuXHRcdHAgPSBuZXcgcCgpO1xyXG5cdFx0Zm9yKHBhcmVudCBpbiB0aGl6KXtcclxuXHRcdFx0cFtwYXJlbnRdID0gdGhpeltwYXJlbnRdO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHA7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBzcGxpdChzb3VyY2Usc3RhcnQpe1xyXG5cdHZhciBtYXRjaDtcclxuXHR2YXIgYnVmID0gW107XHJcblx0dmFyIHJlZyA9IC8nW14nXSsnfFwiW15cIl0rXCJ8W15cXHM8PlxcLz1dKz0/fChcXC8/XFxzKj58PCkvZztcclxuXHRyZWcubGFzdEluZGV4ID0gc3RhcnQ7XHJcblx0cmVnLmV4ZWMoc291cmNlKTsvL3NraXAgPFxyXG5cdHdoaWxlKG1hdGNoID0gcmVnLmV4ZWMoc291cmNlKSl7XHJcblx0XHRidWYucHVzaChtYXRjaCk7XHJcblx0XHRpZihtYXRjaFsxXSlyZXR1cm4gYnVmO1xyXG5cdH1cclxufVxyXG5cclxuaWYodHlwZW9mIHJlcXVpcmUgPT0gJ2Z1bmN0aW9uJyl7XHJcblx0ZXhwb3J0cy5YTUxSZWFkZXIgPSBYTUxSZWFkZXI7XHJcbn1cclxuXHJcbiIsInZhclxuICBtZXJnZSA9IHJlcXVpcmUoJ2RlZXBtZXJnZScpLFxuICB4bWxkb20gPSByZXF1aXJlKCd4bWxkb20nKSxcbiAgbndtYXRjaGVyID0gcmVxdWlyZSgnbndtYXRjaGVyJyk7XG4gIFxuaWYgKCFwcm9jZXNzLmJyb3dzZXIpIHtcbiAgLy8gRXh0ZW5kIHhtbGRvbVxuICB2YXIgRG9jdW1lbnQgPSAobmV3IHhtbGRvbS5ET01JbXBsZW1lbnRhdGlvbigpKS5jcmVhdGVEb2N1bWVudCgpLmNvbnN0cnVjdG9yO1xuICBEb2N1bWVudC5wcm90b3R5cGUucXVlcnlTZWxlY3RvckFsbCA9IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgdmFyIG53ID0gbndtYXRjaGVyKHtkb2N1bWVudDogdGhpc30pO1xuICAgIHJldHVybiBudy5zZWxlY3QoIHNlbGVjdG9yLCB0aGlzLmRvY3VtZW50RWxlbWVudCApO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlKHhtbGRvbSwge1xuICBEb2N1bWVudDogRG9jdW1lbnRcbn0pOyIsInZhclxuICBfUyA9IHJlcXVpcmUoJ3N0cmluZycpLFxuICBYQ1NTTWF0cml4ID0gcmVxdWlyZSgneGNzc21hdHJpeCcpO1xuXG4vLyBQYXJ0aWFsIGltcGxlbWVudGF0aW9uXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvU1ZHU1ZHRWxlbWVudFxuXG5cblxuXG5mdW5jdGlvbiBTVkdNYXRyaXgoKSB7XG4gIHRoaXMuYSA9IHRoaXMuZCA9IDE7XG4gIHRoaXMuYiA9IHRoaXMuYyA9IHRoaXMuZSA9IHRoaXMuZiA9IDA7XG59XG5cbi8vU1ZHTWF0cml4LnByb3RvdHlwZSA9IG5ldyBYQ1NTTWF0cml4KCk7XG4vKlxuZ2V0IGEoKXsgcmV0dXJuIHRoaXMubTExOyB9LFxuXG4gIGdldCBiKCl7IHJldHVybiB0aGlzLm0yMTsgfSxcblxuICBnZXQgYygpeyByZXR1cm4gdGhpcy5tMTI7IH0sXG5cbiAgZ2V0IGQoKXsgcmV0dXJuIHRoaXMubTIyOyB9LFxuXG4gIGdldCBlKCl7IHJldHVybiB0aGlzLm0xMzsgfSxcblxuICBnZXQgZigpeyByZXR1cm4gdGhpcy5tMjM7IH0sXG4qL1xuXG4vKlxudHJhbnNmb3JtOiBmdW5jdGlvbihhMiwgYjIsIGMyLCBkMiwgZTIsIGYyKSB7XG5cbiAgICB2YXIgbWUgPSB0aGlzLFxuICAgICAgYTEgPSBtZS5hLFxuICAgICAgYjEgPSBtZS5iLFxuICAgICAgYzEgPSBtZS5jLFxuICAgICAgZDEgPSBtZS5kLFxuICAgICAgZTEgPSBtZS5lLFxuICAgICAgZjEgPSBtZS5mO1xuXG4gICAgbWUuYSA9IGExICogYTIgKyBjMSAqIGIyO1xuICAgIG1lLmIgPSBiMSAqIGEyICsgZDEgKiBiMjtcbiAgICBtZS5jID0gYTEgKiBjMiArIGMxICogZDI7XG4gICAgbWUuZCA9IGIxICogYzIgKyBkMSAqIGQyO1xuICAgIG1lLmUgPSBhMSAqIGUyICsgYzEgKiBmMiArIGUxO1xuICAgIG1lLmYgPSBiMSAqIGUyICsgZDEgKiBmMiArIGYxO1xuXG4gICAgcmV0dXJuIG1lLl94KClcbiAgfVxuICAqL1xuICBcbi8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjcyMDUwMTgvbXVsdGlwbHktMi1tYXRyaWNlcy1pbi1qYXZhc2NyaXB0XG5TVkdNYXRyaXgucHJvdG90eXBlLm11bHRpcGx5ID0gZnVuY3Rpb24obWF0cml4KSB7XG4gIHZhclxuICAgIF90aGlzID0gdGhpcztcbiAgXG4gLypcbiAgYS5hID0gYS5hKmIuYSArIGEuYypiLmIgKyBhLmU7XG4gIGEuYiA9IGEuYipiLmEgKyBhLmQqYi5iICsgYS5mO1xuICBhLmMgPSBhLmEqYi5jICsgYS5jKmIuZCArIGEuZTtcbiAgYS5kID0gYS5iKmIuYyArIGEuZCpiLmQgKyBhLmY7XG4gIGEuZSA9IGEuYSpiLmUgKyBhLmMqYi5mICsgYS5lO1xuICBhLmYgPSBhLmIqYi5lICsgYS5kKmIuZiArIGEuZjtcbiAgKi9cbiBcbiAgdmFyIG0gPSBuZXcgU1ZHTWF0cml4KCk7XG4gIG0uYSA9IHRoaXMuYTtcbiAgbS5iID0gdGhpcy5iO1xuICBtLmMgPSB0aGlzLmM7XG4gIG0uZCA9IHRoaXMuZDtcbiAgbS5lID0gdGhpcy5lO1xuICBtLmYgPSB0aGlzLmY7XG4gIFxuICB0aGlzLmEgPSBtLmEgKiBtYXRyaXguYSArIG0uYyAqIG1hdHJpeC5iO1xuICB0aGlzLmIgPSBtLmIgKiBtYXRyaXguYSArIG0uZCAqIG1hdHJpeC5iO1xuICB0aGlzLmMgPSBtLmEgKiBtYXRyaXguYyArIG0uYyAqIG1hdHJpeC5kO1xuICB0aGlzLmQgPSBtLmIgKiBtYXRyaXguYyArIG0uZCAqIG1hdHJpeC5kO1xuICB0aGlzLmUgPSBtLmEgKiBtYXRyaXguZSArIG0uYyAqIG1hdHJpeC5mICsgbS5lO1xuICB0aGlzLmYgPSBtLmIgKiBtYXRyaXguZSArIG0uZCAqIG1hdHJpeC5mICsgbS5mO1xuIC8qXG4gIHRoaXMuYSA9IG0uYSAqIG1hdHJpeC5hICsgbS5jICogbWF0cml4LmI7XG4gIHRoaXMuYiA9IG0uYiAqIG1hdHJpeC5hICsgbS5kICogbWF0cml4LmI7XG4gIHRoaXMuYyA9IG0uYSAqIG1hdHJpeC5jICsgbS5jICogbWF0cml4LmQ7XG4gIHRoaXMuZCA9IG0uYiAqIG1hdHJpeC5jICsgbS5kICogbWF0cml4LmQ7XG4gIHRoaXMuZSA9IG0uYSAqIG1hdHJpeC5lICsgbS5jICogbWF0cml4LmY7XG4gIHRoaXMuZiA9IG0uYiAqIG1hdHJpeC5lICsgbS5kICogbWF0cml4LmY7XG4gICovXG4gIHJldHVybiB0aGlzO1xufTtcbi8qXG5cblsnbTExJywgJ2EnXSxcbiAgICBbJ20xMicsICdiJ10sXG4gICAgWydtMjEnLCAnYyddLFxuICAgIFsnbTIyJywgJ2QnXSxcbiAgICBbJ200MScsICdlJ10sXG4gICAgWydtNDInLCAnZiddXG4qL1xuU1ZHTWF0cml4LnByb3RvdHlwZS50cmFuc2xhdGUgPSBmdW5jdGlvbih4LCB5KSB7XG4gIHggPSBwYXJzZUZsb2F0KHgpO1xuICB5ID0gcGFyc2VGbG9hdCh5KTtcbiAgdmFyIG0gPSBuZXcgU1ZHTWF0cml4KCk7XG4gIGNvbnNvbGUubG9nKFwidHJhbnNsYXRlIC0tLT4geCwgeVwiLCB4LCB5KTtcbiAgbS5lID0geDtcbiAgbS5mID0geTtcbiAgLyp2YXIgbSA9IGNsb25lKHRoaXMpO1xuICBtLmUgPSBtLmEgKiB4ICsgbS5iICogeSArIG0uZTtcbiAgbS5mID0gbS5jICogeCArIG0uZCAqIHkgKyBtLmY7Ki9cbiAgcmV0dXJuIHRoaXMubXVsdGlwbHkobSk7XG59O1xuXG5TVkdNYXRyaXgucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24oc2NhbGUpIHtcbiAgcmV0dXJuIHRoaXMuc2NhbGVOb25Vbmlmb3JtKHNjYWxlLCBzY2FsZSk7XG59O1xuXG5TVkdNYXRyaXgucHJvdG90eXBlLnNjYWxlTm9uVW5pZm9ybSA9IGZ1bmN0aW9uKHNjYWxlWCwgc2NhbGVZKSB7XG4gIHNjYWxlWCA9IHBhcnNlRmxvYXQoc2NhbGVYKTtcbiAgc2NhbGVZID0gcGFyc2VGbG9hdChzY2FsZVkpIHx8IHBhcnNlRmxvYXQoc2NhbGVYKTtcbiAgdGhpcy5hICo9IHNjYWxlWDtcbiAgdGhpcy5jICo9IHNjYWxlWTtcbiAgdGhpcy5iICo9IHNjYWxlWDtcbiAgdGhpcy5kICo9IHNjYWxlWTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBjbG9uZShtYXRyaXgpIHtcbiAgdmFyIG1hdHJpeCA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgZm9yICh2YXIgcHJvcCBpbiBtYXRyaXgpIHtcbiAgICBpZiAodHlwZW9mIG1hdHJpeFtwcm9wXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgbWF0cml4W3Byb3BdID0gbWF0cml4W3Byb3BdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbWF0cml4O1xufVxuXG5TVkdNYXRyaXgucHJvdG90eXBlLnNrZXdYID0gZnVuY3Rpb24oYW5nbGUpIHtcbiAgdmFyIG0gPSBuZXcgU1ZHTWF0cml4KCk7XG4gIG0uYyA9IE1hdGgudGFuKCBwYXJzZUZsb2F0KGFuZ2xlKSAqIE1hdGguUEkgLyAxODAgKTtcbiAgcmV0dXJuIHRoaXMubXVsdGlwbHkobSk7XG59O1xuXG5cblNWR01hdHJpeC5wcm90b3R5cGUuZmxpcFkgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5TVkdNYXRyaXgucHJvdG90eXBlLmZsaXBYID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKFwiRkxJUCBYICEhISFcIik7XG4gIFxuICByZXR1cm4gdGhpcy5zY2FsZU5vblVuaWZvcm0oLTEsIDEpO1xuICAvKlxuICB2YXIgc2NhbGUgPSB0aGlzLmE7XG4gIFxuICBcbiAgdGhpcy5hID0gdGhpcy5hICogLTE7XG4gIFxuICAvLyBSZS1wb3NpdGlvbiBiYWNrIHRvIG9yaWdpblxuICAgIGlmKHRoaXMuZSA+IDApXG4gICAgICAgIHRoaXMuZSA9IDA7XG4gICAgZWxzZVxuICAgICAgICB0aGlzLmUgPSB0aGlzLmUgKyB0aGlzLnNjYWxlO1xuXG4gIFxuICAqL1xuICAvKnRoaXMuZSA9IHRoaXMuZSAqIC0xO1xuICB0aGlzLmEgPSB0aGlzLmEgKiAtMTsqL1xuICAvL3RoaXMuYiAqPSAtMTtcbiAgLy90aGlzLmIgKj0gLTE7XG4gIC8vdGhpcy5jICo9IC0xO1xuICAvL3RoaXMuZCAqPSAtMTtcbiAgLy90aGlzLmUgKj0gLTE7XG4gIC8vdGhpcy5mICo9IC0xO1xuIC8vIHRoaXMuZSo9IC0xO1xuIFxuICAvKlxuICB0aGlzLmEgPSAxO1xuICB0aGlzLmIgPSAwO1xuICB0aGlzLmMgPSAwO1xuICB0aGlzLmQgPSAxO1xuICB0aGlzLmUgPSAwO1xuICB0aGlzLmYgPSAwO1xuICBcbiAgcmV0dXJuIHRoaXM7XG4gICAqL1xuICB2YXIgbSA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgbS5hID0gLTE7XG4gIHJldHVybiB0aGlzLm11bHRpcGx5KG0pO1xufTtcblxuU1ZHTWF0cml4LnByb3RvdHlwZS5za2V3WSA9IGZ1bmN0aW9uKGFuZ2xlKSB7XG4gIHZhciBtID0gbmV3IFNWR01hdHJpeCgpO1xuICBtLmIgPSBNYXRoLnRhbiggcGFyc2VGbG9hdChhbmdsZSkgKiBNYXRoLlBJIC8gMTgwICk7XG4gIHJldHVybiB0aGlzLm11bHRpcGx5KG0pO1xufTtcblxuU1ZHTWF0cml4LnByb3RvdHlwZS5yb3RhdGUgPSBmdW5jdGlvbihhbmdsZSkge1xuICB2YXIgY29zID0gTWF0aC5jb3MoYW5nbGUgKiBNYXRoLlBJIC8gMTgwKSxcbiAgICBzaW4gPSBNYXRoLnNpbihhbmdsZSAqIE1hdGguUEkgLyAxODApO1xuICB2YXIgbSA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgbS5hID0gY29zO1xuICBtLmIgPSBzaW47XG4gIG0uYyA9IC1zaW47XG4gIG0uZCA9IGNvcztcbiAgLy9yZXR1cm4gdGhpcztcbiAgIHJldHVybiB0aGlzLm11bHRpcGx5KG0pO1xuICAgIFxuICAvKlxuICB2YXIgYzAgPSBNYXRoLmNvcygwICogTWF0aC5QSSAvIDE4MCksIFxuICAgIHMwID0gTWF0aC5zaW4oMCAqIE1hdGguUEkgLyAxODApO1xuICBcbiAgdmFyIGMgPSBNYXRoLmNvcyhhbmdsZSAqIE1hdGguUEkgLyAxODApLCBcbiAgICBzID0gTWF0aC5zaW4oYW5nbGUgKiBNYXRoLlBJIC8gMTgwKSxcbiAgICBtID0gdGhpcztcbiAgICAvL20gPSB0aGlzO1xuICAgIFxuICAgIG0uYSA9IGMwICogdGhpcy5hIC0gczAgKiB0aGlzLmU7XG4gICAgbS5iID0gYzAgKiB0aGlzLmIgLSBzMCAqIHRoaXMuZjtcbiAgICBcbiAgICBtLmMgPSBjICogdGhpcy5jICsgcyAqIHRoaXMuZTtcbiAgICBtLmQgPSBjICogdGhpcy5kICsgcyAqIHRoaXMuZjtcblxuICAgIG0uZSA9IGMgKiB0aGlzLmUgLSBzICogdGhpcy5jO1xuICAgIG0uZiA9IGMgKiB0aGlzLmYgLSBzICogdGhpcy5kO1xuXG4gICAgLy9yZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbiAgICBcbiAgICByZXR1cm4gdGhpcztcbiAgICAqL1xuICAgLypcbiAgIHZhciBkZWcgPSBhbmdsZTtcbiAgICB2YXIgcmFkID0gcGFyc2VGbG9hdChkZWcpICogKE1hdGguUEkvMTgwKSxcbiAgICAgICAgY29zdGhldGEgPSBNYXRoLmNvcyhyYWQpLFxuICAgICAgICBzaW50aGV0YSA9IE1hdGguc2luKHJhZCk7XG4gIFxuICAgIHZhclxuICAgICAgbSA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgICAgIFxuICAgICBtLmEgPSBjb3N0aGV0YSxcbiAgICAgbS5iID0gc2ludGhldGEsXG4gICAgIG0uYyA9IC1zaW50aGV0YSxcbiAgICAgbS5kID0gY29zdGhldGE7XG4qL1xuXG4gIHZhclxuICAgcnggPSBwYXJzZUZsb2F0KGFuZ2xlKSAqIChNYXRoLlBJLzE4MCksXG4gICBtID0gbmV3IFNWR01hdHJpeCgpLFxuICAgICAgICBzaW5BLCBjb3NBLCBzcTtcblxuICAgIHJ4IC89IDI7XG4gICAgc2luQSAgPSBNYXRoLnNpbihyeCk7XG4gICAgY29zQSAgPSBNYXRoLmNvcyhyeCk7XG4gICAgc3EgPSBzaW5BICogc2luQTtcblxuICAgIC8vIE1hdHJpY2VzIGFyZSBpZGVudGl0eSBvdXRzaWRlIHRoZSBhc3NpZ25lZCB2YWx1ZXNcbiAgICBtLmEgPSBtLmQgPSAxIC0gMiAqIHNxO1xuICAgIG0uYiA9IG0uYyA9IDIgKiBzaW5BICogY29zQTtcbiAgICBtLmMgKj0gLTE7XG4gICAgXG4gICAgLy9yZXR1cm4gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbiAgfSxcblxuXG5TVkdNYXRyaXgucGFyc2UgPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gIHZhclxuICAgIHN0YXRlbWVudHMgPSBbJ21hdHJpeCcsICdyb3RhdGUnLCAnc2tld1gnLCAnc2tld1knLCAnc2NhbGUnLCAndHJhbnNsYXRlJ10sXG4gICAgdHJhbnNmb3JtcyA9IFtdLFxuICAgIHQgPSBudWxsLFxuICAgIG1hdHJpeCA9IG5ldyBTVkdNYXRyaXgoKSxcbiAgICByZSA9IC8oXFx3KylcXHMqXFwoXFxzKihbXlxcKV0qXFxzKilcXHMqXFwpL2csXG4gICAgbSwgc3QsIGFyZ3MsIHAgPSBTVkdNYXRyaXgucHJvdG90eXBlLCBtZXRob2QsIGUgPSBudWxsO1xuICB3aGlsZSAobSA9IHJlLmV4ZWMoc3RyaW5nKSkge1xuICAgIGlmIChtKSB7XG4gICAgICBzdCA9IG1bMV07XG4gICAgICBjb25zb2xlLmluZm8oXCJtWzJdLiBcIiwgbVsyXSk7XG4gICAgICBhcmdzID0gbVsyXS5zcGxpdCgvWyxcXHNdKy8pO1xuICAgICAgaWYgKHN0YXRlbWVudHMuaW5kZXhPZihzdCkgPj0gMCkge1xuICAgICAgICB0cmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgIHN0OiBzdCxcbiAgICAgICAgICBhcmdzOiBhcmdzXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChlKSB7XG4gICAgY29uc29sZS5sb2coXCJlcnJvciBwYXJzaW5nIHN2ZyBtYXRyaXhcIik7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRyYW5zZm9ybXMuZm9yRWFjaChmdW5jdGlvbihvYmopIHtcbiAgICBjb25zb2xlLmluZm8oXCJleGVjOiBcIiwgb2JqLnN0KTtcbiAgICBtZXRob2QgPSBvYmouc3QgPT09ICdzY2FsZScgPyAnc2NhbGVOb25Vbmlmb3JtJyA6IG9iai5zdDtcbiAgICBpZiAobWV0aG9kID09PSAncm90YXRlJyAmJiBvYmouYXJncy5sZW5ndGggPiAxKSB7XG4gICAgICBtYXRyaXggPSBwLnRyYW5zbGF0ZS5jYWxsKG1hdHJpeCwgb2JqLmFyZ3NbMV0sIG9iai5hcmdzWzJdKTtcbiAgICAgIG1hdHJpeCA9IHAucm90YXRlLmNhbGwobWF0cml4LCBvYmouYXJnc1swXSk7XG4gICAgICBtYXRyaXggPSBwLnRyYW5zbGF0ZS5jYWxsKG1hdHJpeCwgLW9iai5hcmdzWzFdLCAtb2JqLmFyZ3NbMl0pO1xuICAgIH0gZWxzZSBpZiAocFttZXRob2RdKSB7XG4gICAgICBtYXRyaXggPSBwW21ldGhvZF0uYXBwbHkobWF0cml4LCBvYmouYXJncyk7XG4gICAgfVxuICB9KTtcbiAgLypcbiAgc3RhdGVtZW50cy5maWx0ZXIoZnVuY3Rpb24oc3QpIHtcbiAgICByZXR1cm4gdHJhbnNmb3Jtc1tzdF07XG4gIH0pLmZvckVhY2goZnVuY3Rpb24oc3QpIHtcbiAgICBtZXRob2QgPSBzdCA9PT0gJ3NjYWxlJyA/ICdzY2FsZU5vblVuaWZvcm0nIDogc3Q7XG4gICAgbWF0cml4ID0gcFttZXRob2RdLmFwcGx5KG1hdHJpeCwgdHJhbnNmb3Jtc1tzdF0uYXJncyk7XG4gIH0pO1xuICAqL1xuICByZXR1cm4gbWF0cml4O1xufTtcblxuXG5cbmZ1bmN0aW9uIFNWR1BvaW50KHgsIHkpIHtcbiAgdGhpcy54ID0gcGFyc2VGbG9hdCh4KTtcbiAgdGhpcy55ID0gcGFyc2VGbG9hdCh5KTtcbn1cblxuU1ZHUG9pbnQucHJvdG90eXBlLm1hdHJpeFRyYW5zZm9ybSA9IGZ1bmN0aW9uKG1hdHJpeCkge1xuICBjb25zb2xlLmxvZyhcInRyYW5zZm9ybSBwb2ludDogXCIsIG1hdHJpeC5lLCBtYXRyaXguZik7XG4gIHZhciBweCA9IHRoaXMueCAqIG1hdHJpeC5hICsgdGhpcy55ICogbWF0cml4LmMgKyBtYXRyaXguZTtcbiAgdmFyIHB5ID0gdGhpcy54ICogbWF0cml4LmIgKyB0aGlzLnkgKiBtYXRyaXguZCArIG1hdHJpeC5mO1xuICByZXR1cm4gbmV3IFNWR1BvaW50KHB4LCBweSk7XG59O1xuXG5cbmZ1bmN0aW9uIFNWR1JlY3QoeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuICB0aGlzLnggPSBwYXJzZUZsb2F0KHgpO1xuICB0aGlzLnkgPSBwYXJzZUZsb2F0KHkpO1xuICB0aGlzLndpZHRoID0gcGFyc2VGbG9hdCh3aWR0aCk7XG4gIHRoaXMuaGVpZ2h0ID0gcGFyc2VGbG9hdChoZWlnaHQpO1xufVxuXG5mdW5jdGlvbiBTVkdTVkdFbGVtZW50KCkge1xuICBcbn1cblxuU1ZHU1ZHRWxlbWVudC5wcm90b3R5cGUuY3JlYXRlU1ZHTWF0cml4ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgU1ZHTWF0cml4KCk7XG59O1xuXG5TVkdTVkdFbGVtZW50LnByb3RvdHlwZS5jcmVhdGVTVkdQb2ludCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFNWR1BvaW50KDAsIDApO1xufTtcblxuXG5cblxuXG5TVkdTVkdFbGVtZW50LnByb3RvdHlwZS5nZXRCQm94ID0gKGZ1bmN0aW9uKCkge1xuICBcbiAgdmFyIGN1cnJlbnRUZXh0UG9zaXRpb24gPSBudWxsO1xuICBcbiAgZnVuY3Rpb24gZ2V0UG9pbnRzKG5vZGUpIHtcbiAgICBcbiAgICB2YXIgcG9pbnRzID0gW107XG4gICAgXG4gICAgLy8gU2hhcGVzXG4gICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdsaW5lJykge1xuICAgICAgdmFyIHgxID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgneDEnKSk7XG4gICAgICB2YXIgeTEgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCd5MScpKTtcbiAgICAgIHZhciB4MiA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3gyJykpO1xuICAgICAgdmFyIHkyID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgneTInKSk7XG4gICAgICBwb2ludHMucHVzaChuZXcgU1ZHUG9pbnQoeDEsIHkxKSwgbmV3IFNWR1BvaW50KHgyLCB5MikpO1xuICAgIH1cblxuICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAncmVjdCcpIHtcbiAgICAgIHZhciB4MSA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3gnKSk7XG4gICAgICB2YXIgeTEgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCd5JykpO1xuICAgICAgdmFyIHgyID0geDEgKyBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCd3aWR0aCcpKTtcbiAgICAgIHZhciB5MiA9IHkxICsgcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgnaGVpZ2h0JykpO1xuICAgICAgcG9pbnRzLnB1c2gobmV3IFNWR1BvaW50KHgxLCB5MSksIG5ldyBTVkdQb2ludCh4MiwgeTEpLCBuZXcgU1ZHUG9pbnQoeDIsIHkyKSwgbmV3IFNWR1BvaW50KHgxLCB5MikpO1xuICAgIH1cbiAgICBcbiAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ2NpcmNsZScpIHtcbiAgICAgIHZhciBjeCA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ2N4JykpO1xuICAgICAgdmFyIGN5ID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgnY3knKSk7XG4gICAgICB2YXIgciA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3InKSk7XG4gICAgICB2YXIgbCA9IE1hdGguZmxvb3IoTWF0aC5QSSAqIDIgKiByKTtcbiAgICAgIHZhciB0ID0gTWF0aC5QSSAqIDIgLyByO1xuICAgICAgcG9pbnRzID0gcG9pbnRzLmNvbmNhdChBcnJheS5hcHBseShudWxsLCBBcnJheShsKSkubWFwKGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICB2YXIgYSA9IHQgKiBpbmRleDtcbiAgICAgICAgdmFyIHggPSBjeCArIE1hdGguY29zKGEpICogcjtcbiAgICAgICAgdmFyIHkgPSBjeSArIE1hdGguc2luKGEpICogcjtcbiAgICAgICAgcmV0dXJuIG5ldyBTVkdQb2ludCh4LCB5KTtcbiAgICAgIH0pKTtcbiAgICAgIHBvaW50cy5wdXNoKG5ldyBTVkdQb2ludChjeCwgY3kgLSByKSwgbmV3IFNWR1BvaW50KGN4ICsgciwgY3kpLCBuZXcgU1ZHUG9pbnQoY3gsIGN5ICsgciksIG5ldyBTVkdQb2ludChjeCAtIHIsIGN5KSk7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdlbGxpcHNlJykge1xuICAgICAgdmFyIGN4ID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgnY3gnKSk7XG4gICAgICB2YXIgY3kgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCdjeScpKTtcbiAgICAgIHZhciByeCA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3J4JykpO1xuICAgICAgdmFyIHJ5ID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgncnknKSk7XG4gICAgICB2YXIgbCA9IE1hdGguZmxvb3IoTWF0aC5QSSAqIDIgKiBNYXRoLnNxcnQoKHJ4ICogcngpICsgKHJ5ICsgcnkpKSk7XG4gICAgICB2YXIgdCA9IE1hdGguUEkgKiAyIC8gbDtcbiAgICAgIHBvaW50cyA9IHBvaW50cy5jb25jYXQoQXJyYXkuYXBwbHkobnVsbCwgQXJyYXkobCkpLm1hcChmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGEgPSB0ICogaW5kZXg7XG4gICAgICAgIHZhciB4ID0gY3ggKyBNYXRoLmNvcyhhKSAqIHJ4O1xuICAgICAgICB2YXIgeSA9IGN5ICsgTWF0aC5zaW4oYSkgKiByeTtcbiAgICAgICAgcmV0dXJuIG5ldyBTVkdQb2ludCh4LCB5KTtcbiAgICAgIH0pKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICd0ZXh0Jykge1xuICAgICAgY3VycmVudFRleHRQb3NpdGlvbiA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAzICYmIG5vZGUuZGF0YS50cmltKCkpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZm91bmQgdGV4dCBub2RlOiBcIiwgbm9kZSk7XG4gICAgICB2YXIgZWxlbSwgeCA9IE5hTiwgeSA9IE5hTiwgZHggPSBOYU4sIGR5ID0gTmFOO1xuICAgICAgXG4gICAgICAvLyBHZXQgYWJzb2x1dGUgcG9zaXRpb25cbiAgICAgIGVsZW0gPSBub2RlO1xuICAgICAgd2hpbGUgKChlbGVtID0gZWxlbS5wYXJlbnROb2RlKSAmJiAoZWxlbS5ub2RlTmFtZSA9PT0gJ3RleHQnIHx8IGVsZW0ubm9kZU5hbWUgPT09ICd0c3BhbicpICYmIChpc05hTih4KSB8fCBpc05hTih5KSkpIHtcbiAgICAgICAgaWYgKGVsZW0ubm9kZU5hbWUgPT09ICd0ZXh0JyAmJiBjdXJyZW50VGV4dFBvc2l0aW9uKSB7XG4gICAgICAgICAgaWYgKGlzTmFOKHgpKSB7XG4gICAgICAgICAgICB4ID0gY3VycmVudFRleHRQb3NpdGlvbi54O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaXNOYU4oeSkpIHtcbiAgICAgICAgICAgIHkgPSBjdXJyZW50VGV4dFBvc2l0aW9uLnk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHggPSBpc05hTih4KSA/IHBhcnNlRmxvYXQoZWxlbS5nZXRBdHRyaWJ1dGUoJ3gnKSkgOiB4O1xuICAgICAgICB5ID0gaXNOYU4oeSkgPyBwYXJzZUZsb2F0KGVsZW0uZ2V0QXR0cmlidXRlKCd5JykpIDogeTtcbiAgICAgIH1cbiAgICAgIHggPSBpc05hTih4KSA/IDAgOiB4O1xuICAgICAgeSA9IGlzTmFOKHkpID8gMCA6IHk7XG4gICAgICBcbiAgICAgIC8vIFNoaWZ0IGJ5IHJlbGF0aXZlIHBvc2l0aW9uXG4gICAgICBlbGVtID0gbm9kZTtcbiAgICAgIHdoaWxlICgoZWxlbSA9IGVsZW0ucGFyZW50Tm9kZSkgJiYgKGVsZW0ubm9kZU5hbWUgPT09ICd0ZXh0JyB8fCBlbGVtLm5vZGVOYW1lID09PSAndHNwYW4nKSAmJiAoaXNOYU4oZHgpIHx8IGlzTmFOKGR5KSkpIHtcbiAgICAgICAgZHggPSBpc05hTihkeCkgPyBwYXJzZUZsb2F0KGVsZW0uZ2V0QXR0cmlidXRlKCdkeCcpKSA6IGR4O1xuICAgICAgICBkeSA9IGlzTmFOKGR5KSA/IHBhcnNlRmxvYXQoZWxlbS5nZXRBdHRyaWJ1dGUoJ2R5JykpIDogZHk7XG4gICAgICB9XG4gICAgICBkeCA9IGlzTmFOKGR4KSA/IDAgOiBkeDtcbiAgICAgIGR5ID0gaXNOYU4oZHkpID8gMCA6IGR5O1xuICAgICAgXG4gICAgICB4Kz0gZHg7XG4gICAgICB5Kz0gZHk7XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSB0ZXh0IGRpbWVuc2lvbnNcbiAgICAgIHZhciBlbGVtID0gbm9kZS5wYXJlbnROb2RlO1xuICAgICAgdmFyIHN0eWxlID0gZ2V0U3R5bGUoZWxlbSk7XG4gICAgICBjb25zb2xlLmxvZyhcInN0eWxlIFwiLCBzdHlsZSk7XG4gICAgICB2YXIgZm9udFNpemUgPSBwYXJzZUZsb2F0KHN0eWxlLmZvbnRTaXplKTtcbiAgICAgIGNvbnNvbGUubG9nKFwic3R5bGUgXCIsIGZvbnRTaXplKTtcbiAgICAgIHZhciB3ID0gZWxlbS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICAgIHZhciBoID0gZm9udFNpemU7XG5cbiAgICAgIC8vIEFkZCBib3VuZGluZyBwb2ludHNcbiAgICAgIHBvaW50cy5wdXNoKG5ldyBTVkdQb2ludCh4LCB5KSwgbmV3IFNWR1BvaW50KHggKyB3LCB5KSwgbmV3IFNWR1BvaW50KHggKyB3LCB5IC0gaCksIG5ldyBTVkdQb2ludCh4LCB5IC0gaCkpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgY3VycmVudCB0ZXh0IHBvc2l0aW9uXG4gICAgICBjdXJyZW50VGV4dFBvc2l0aW9uID0gbmV3IFNWR1BvaW50KHggKyB3LCB5KTtcbiAgICB9XG4gICAgXG4gICAgLy8gUHJvY2VzcyBjaGlsZHJlblxuICAgIGlmIChub2RlLm5vZGVUeXBlID09PSAxKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkTm9kZXNbaV07XG4gICAgICAgIHZhciBjaGlsZFBvaW50cyA9IGdldFBvaW50cyhjaGlsZCk7XG4gICAgICAgIHZhciBtYXRyaXggPSBudWxsO1xuICAgICAgICBpZiAoY2hpbGQubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgICBpZiAoWydnJ10uaW5kZXhPZihjaGlsZC5ub2RlTmFtZSkgPj0gMCkge1xuICAgICAgICAgICAgLy8gQXBwbHkgdHJhbnNmb3JtYXRpb25zXG4gICAgICAgICAgICB2YXJcbiAgICAgICAgICAgICAgdHJhbnNmb3JtID0gY2hpbGQuZ2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcbiAgICAgICAgICAgICAgbWF0cml4ID0gU1ZHTWF0cml4LnBhcnNlKHRyYW5zZm9ybSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBvaW50cyA9IHBvaW50cy5jb25jYXQoY2hpbGRQb2ludHMubWFwKGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgICAgcmV0dXJuIG1hdHJpeCAmJiBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KSB8fCBwb2ludDtcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBSZXNldCBjdXJyZW50IHRleHQgcG9zaXRpb25cbiAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ3RleHQnKSB7XG4gICAgICBjdXJyZW50VGV4dFBvc2l0aW9uID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHBvaW50cztcbiAgfVxuICAgICAgICBcbiAgcmV0dXJuIGZ1bmN0aW9uIGdldEJCb3goKSB7XG4gICAgLy8gVE9ETzogVGhyb3cgZXhjZXB0aW9uIHdoZW4gbm90IGFkZGVkIHRvIHZpZXdcbiAgICBcbiAgICB2YXIgZWxlbSA9IHRoaXM7XG4gICAgdmFyIHBvaW50cyA9IGdldFBvaW50cyhlbGVtKTtcbiAgICAgICAgXG4gICAgdmFyIHgxLCB5MSwgeDIsIHkyO1xuICAgIHBvaW50cy5mb3JFYWNoKGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICB4MSA9IHR5cGVvZiB4MSA9PT0gJ3VuZGVmaW5lZCcgPyBwb2ludC54IDogTWF0aC5taW4ocG9pbnQueCwgeDEpO1xuICAgICAgeTEgPSB0eXBlb2YgeTEgPT09ICd1bmRlZmluZWQnID8gcG9pbnQueSA6IE1hdGgubWluKHBvaW50LnksIHkxKTtcbiAgICAgIHgyID0gdHlwZW9mIHgyID09PSAndW5kZWZpbmVkJyA/IHBvaW50LnggOiBNYXRoLm1heChwb2ludC54LCB4Mik7XG4gICAgICB5MiA9IHR5cGVvZiB5MiA9PT0gJ3VuZGVmaW5lZCcgPyBwb2ludC55IDogTWF0aC5tYXgocG9pbnQueSwgeTIpO1xuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBuZXcgU1ZHUmVjdChcbiAgICAgIHgxIHx8IDAsXG4gICAgICB5MSB8fCAwLFxuICAgICAgKHgyIC0geDEpIHx8IDAsXG4gICAgICAoeTIgLSB5MSkgfHwgMFxuICAgICk7XG5cbiAgfTtcbiAgXG59KSgpO1xuXG5TVkdTVkdFbGVtZW50LnByb3RvdHlwZS5nZXRDb21wdXRlZFRleHRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coXCJnZXRDb21wdXRlZFRleHRMZW5ndGgoKVwiLCB0aGlzKTtcbiAgcmV0dXJuIDA7XG59O1xuXG5cbmZ1bmN0aW9uIGdldFN0eWxlKGVsKSB7XG4gIC8vcmV0dXJuIGdldENvbXB1dGVkU3R5bGUoZWwpO1xuICB2YXIgcmVzdWx0ID0ge307XG4gIHdoaWxlIChlbC5wYXJlbnROb2RlKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbC5hdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYXR0ck5vZGUgPSBlbC5hdHRyaWJ1dGVzW2ldO1xuICAgICAgdmFyIG5hbWUgPSBfUyhhdHRyTm9kZS5uYW1lKS5jYW1lbGl6ZSgpO1xuICAgICAgdmFyIHZhbHVlID0gYXR0ck5vZGUudmFsdWU7XG4gICAgICBpZiAoIXJlc3VsdFtuYW1lXSkge1xuICAgICAgICByZXN1bHRbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWwgPSBlbC5wYXJlbnROb2RlO1xuICB9XG4gIGNvbnNvbGUud2FybihcInJlc3VsdDogXCIsIHJlc3VsdCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdTVkdTVkdFbGVtZW50JzogU1ZHU1ZHRWxlbWVudFxufTtcblxuXG4iLCJ2YXJcbiAgbWVyZ2UgPSByZXF1aXJlKCdkZWVwbWVyZ2UnKSxcbiAgLy8gSW5pdCBET00gSW1wbGVtZW50YXRpb25cbiAgZG9tID0gcHJvY2Vzcy5icm93c2VyID8ge1xuICAgIERPTUltcGxlbWVudGF0aW9uOiB3aW5kb3cuRE9NSW1wbGVtZW50YXRpb24sXG4gICAgWE1MU2VyaWFsaXplcjogd2luZG93LlhNTFNlcmlhbGl6ZXIsXG4gICAgRE9NUGFyc2VyOiB3aW5kb3cuRE9NUGFyc2VyLFxuICAgIERvY3VtZW50OiB3aW5kb3cuRG9jdW1lbnRcbiAgfSA6IHJlcXVpcmUoJy4vZG9tJyksXG4gIFxuICBzdmcgPSByZXF1aXJlKCcuL3N2ZycpO1xuICBcblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZShtZXJnZShkb20sIHN2ZyksIHtcbiAgLy8gQWRkIG1vcmUgbWV0aG9kcyBoZXJlXG4gIFxufSk7IiwiLyoqXG4gKiBSb3VuZHMgYSBudW1iZXIgb3IgbnVtZXJpY2FsIG1lbWJlcnMgb2YgYW4gb2JqZWN0IHRvIHByZWNpc2lvblxuICovIFxuZnVuY3Rpb24gcm91bmQobnVtLCBkaWdpdHMpIHtcbiAgZGlnaXRzID0gdHlwZW9mIGRpZ2l0cyA9PT0gJ251bWJlcicgPyBkaWdpdHMgOiAxO1xuICBpZiAodHlwZW9mIG51bSA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBPYmplY3RcbiAgICBmb3IgKHZhciB4IGluIG51bSkge1xuICAgICAgbnVtW3hdID0gcm91bmQobnVtW3hdKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gQWN0dWFsbHkgcm91bmQgbnVtYmVyXG4gICAgdmFyIHZhbHVlID0gcGFyc2VGbG9hdChudW0pO1xuICAgIGlmICghaXNOYU4odmFsdWUpICYmIG5ldyBTdHJpbmcodmFsdWUpLmxlbmd0aCA9PT0gbmV3IFN0cmluZyhudW0pLmxlbmd0aCkge1xuICAgICAgdmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlLnRvRml4ZWQoZGlnaXRzKSk7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBudW07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJvdW5kOyIsInZhciBYU1NNYXRyaXggPSByZXF1aXJlKCd4Y3NzbWF0cml4Jyk7XG5cbmZ1bmN0aW9uIFNWR1BvaW50KHgsIHkpIHtcbiAgdGhpcy54ID0geDtcbiAgdGhpcy55ID0geTtcbn1cblxuU1ZHUG9pbnQucHJvdG90eXBlLm1hdHJpeFRyYW5zZm9ybSA9IGZ1bmN0aW9uKG1hdHJpeCkge1xuICByZXR1cm4gbWF0cml4LnRyYW5zZm9ybVZlY3Rvcih2ZWN0b3IpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTVkdQb2ludDtcbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoJ2RlZXBtZXJnZScpO1xuLy8gRG9tIGltcGxlbWVudGF0aW9uXG4vKnZhciBkb20gPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHtcbiAgRE9NSW1wbGVtZW50YXRpb246IHdpbmRvdy5ET01JbXBsZW1lbnRhdGlvbixcbiAgWE1MU2VyaWFsaXplcjogd2luZG93LlhNTFNlcmlhbGl6ZXIsXG4gIERPTVBhcnNlcjogd2luZG93LkRPTVBhcnNlclxufSA6IHJlcXVpcmUoJ3htbGRvbScpO1xuKi9cbi8vdmFyIGltcGwgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHJlcXVpcmUoJy4vaW1wbC93aW5kb3cnKTtcbnZhciBpbXBsID0gcmVxdWlyZSgnLi9pbXBsL3dpbmRvdycpO1xuY29uc29sZS5sb2coXCIqKiogSU1QTEVNRU5UQVRJT046IFwiLCBpbXBsKTtcblxuLypcbiAqIFxuY29uc29sZS5sb2coXCJkb206IFwiLCBkb20pO1xudmFyIERPTUltcGxlbWVudGF0aW9uID0gZG9tLkRPTUltcGxlbWVudGF0aW9uO1xudmFyIFhNTFNlcmlhbGl6ZXIgPSBkb20uWE1MU2VyaWFsaXplcjtcbnZhciBET01QYXJzZXIgPSBkb20uRE9NUGFyc2VyO1xuKi9cbnZhciByb3VuZCA9IHJlcXVpcmUoJy4vbGliL3JvdW5kJyk7XG4vL3ZhciBoeXBoZW5hdGUgPSByZXF1aXJlKCcuL2xpYi9oeXBoZW5hdGUnKTtcbnZhciBjc3MgPSByZXF1aXJlKCdjc3MnKTtcbnZhciBTID0gcmVxdWlyZSgnc3RyaW5nJyk7XG4vL3ZhciBmb250a2l0ID0gcmVxdWlyZSgnZm9udGtpdCcpO1xuLy92YXIganNkb20gPSByZXF1aXJlKFwianNkb21cIik7XG52YXIgWENTU01hdHJpeCA9IHJlcXVpcmUoJ3hjc3NtYXRyaXgnKTtcbnZhciBTVkdQb2ludCA9IHJlcXVpcmUoJy4vbGliL3N2Z3BvaW50Jyk7XG5cblxuICB2YXIgXG4gICAgU1ZHX05BTUVTUEFDRV9VUkkgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsXG4gICAgTUFUSCA9IE1hdGgsXG4gICAgUEkgPSBNQVRILlBJLFxuICAgIGNvcyA9IE1BVEguY29zLFxuICAgIHNpbiA9IE1BVEguc2luLFxuICAgIHNxcnQgPSBNQVRILnNxcnQsXG4gICAgcG93ID0gTUFUSC5wb3csXG4gICAgZmxvb3IgPSBNQVRILmZsb29yLFxuICAgIGZvbnRGYWNlID0ge30sXG4gICAgLyoqXG4gICAgICogR2V0cyBhIHBhaXIgb2YgYmV6aWVyIGNvbnRyb2wgcG9pbnRzXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRcbiAgICAgKi9cbiAgICBnZXRDb250cm9sUG9pbnRzID0gZnVuY3Rpb24oIHgwLCB5MCwgeDEsIHkxLCB4MiwgeTIsIHQgKSB7XG4gICAgICB0ID0gdHlwZW9mIHQgPT09ICdudW1iZXInID8gdCA6IDAuNTtcbiAgICAgIHZhclxuICAgICAgICBkMDEgPSBzcXJ0KCBwb3coIHgxIC0geDAsIDIgKSArIHBvdyggeTEgLSB5MCwgMiApICksXG4gICAgICAgIGQxMiA9IHNxcnQoIHBvdyggeDIgLSB4MSwgMiApICsgcG93KCB5MiAtIHkxLCAyICkgKSxcbiAgICAgICAgZmEgPSB0ICogZDAxIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBzY2FsaW5nIGZhY3RvciBmb3IgdHJpYW5nbGUgVGFcbiAgICAgICAgZmIgPSB0ICogZDEyIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBkaXR0byBmb3IgVGIsIHNpbXBsaWZpZXMgdG8gZmI9dC1mYVxuICAgICAgICBwMXggPSB4MSAtIGZhICogKCB4MiAtIHgwICksICAgIC8vIHgyLXgwIGlzIHRoZSB3aWR0aCBvZiB0cmlhbmdsZSBUXG4gICAgICAgIHAxeSA9IHkxIC0gZmEgKiAoIHkyIC0geTAgKSwgICAgLy8geTIteTAgaXMgdGhlIGhlaWdodCBvZiBUXG4gICAgICAgIHAyeCA9IHgxICsgZmIgKiAoIHgyIC0geDAgKSxcbiAgICAgICAgcDJ5ID0geTEgKyBmYiAqICggeTIgLSB5MCApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcDE6IHt4OiBwMXgsIHk6IHAxeX0sIFxuICAgICAgICBwMjoge3g6IHAyeCwgeTogcDJ5fVxuICAgICAgfTtcbiAgICB9LFxuICAgIC8qXG4gICAgZ2V0Rm9udCA9IGZ1bmN0aW9uKGZvbnRGYW1pbHkpIHtcbiAgICAgIHZhciBmb250RmFtaWx5ID0gZm9udEZhbWlseSB8fCAnQXJpYWwnO1xuICAgICAgdmFyIGZpbGUgPSAnL0xpYnJhcnkvRm9udHMvJyArIGZvbnRGYW1pbHkgKyAnLnR0Zic7XG4gICAgICAvLyBvcGVuIGEgZm9udCBzeW5jaHJvbm91c2x5IFxuICAgICAgdmFyIGZvbnQgPSBmb250RmFjZVtmb250RmFtaWx5XSA9IGZvbnRGYWNlW2ZvbnRGYW1pbHldIHx8IGZvbnRraXQub3BlblN5bmMoZmlsZSk7XG4gICAgICByZXR1cm4gZm9udDtcbiAgICB9LFxuICAgICovXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb21wdXRlZCB0ZXh0IGxlbmd0aCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IGlmIGF2YWlsYWJsZS5cbiAgICAgKi9cbiAgICBjb21wdXRlZFRleHRMZW5ndGggPSBmdW5jdGlvbihlbGVtLCBzdHlsZSkge1xuICAgICAgcmV0dXJuIDEwMDtcbiAgICAgIGVsZW0gPSBfdihlbGVtKTtcbiAgICAgIHN0eWxlID0gc3R5bGUgfHwgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbVswXSkgfHwgZWxlbS5zdHlsZSgpO1xuICAgICAgXG4gICAgICBpZiAoZWxlbS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBsO1xuICAgICAgICB2YXIgdGV4dCA9IGVsZW1bMF0uZmlyc3RDaGlsZCAmJiBlbGVtWzBdLmZpcnN0Q2hpbGQuZGF0YTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdGV4dCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoZWxlbVswXS5nZXRDb21wdXRlZFRleHRMZW5ndGgpIHtcbiAgICAgICAgICBsID0gZWxlbVswXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICAgICAgICByZXR1cm4gbDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIGZvbnQgPSBnZXRGb250KHN0eWxlLmZvbnRGYW1pbHkpO1xuICAgICAgICB2YXIgZm9udFNpemUgPSBwYXJzZUZsb2F0KHN0eWxlLmZvbnRTaXplKSB8fCAxNjtcbiAgICAgICAgdmFyIGZhY3RvciA9IGZvbnRTaXplIC8gZm9udC51bml0c1BlckVtO1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiYXNjZW50OiBcIiwgZm9udC5kZXNjZW50ICogZmFjdG9yLCAoZm9udC5hc2NlbnQgLyBmb250LnVuaXRzUGVyRW0pICogZm9udFNpemUpO1xuICAgICAgICAvLyBsYXlvdXQgYSBzdHJpbmcsIHVzaW5nIGRlZmF1bHQgc2hhcGluZyBmZWF0dXJlcy4gXG4gICAgICAgIC8vIHJldHVybnMgYSBHbHlwaFJ1biwgZGVzY3JpYmluZyBnbHlwaHMgYW5kIHBvc2l0aW9ucy4gXG4gICAgICAgIHZhciBydW4gPSBmb250LmxheW91dCh0ZXh0KTtcbiAgICAgICAgLy8gZ2V0IGFuIFNWRyBwYXRoIGZvciBhIGdseXBoIFxuICAgICAgICB2YXIgcGF0aCA9IHJ1bi5nbHlwaHNbMF0ucGF0aDtcbiAgICAgICAgdmFyIHdpZHRoID0gcnVuLmdseXBocy5tYXAoZnVuY3Rpb24oZ2x5cGgpIHtcbiAgICAgICAgICByZXR1cm4gZ2x5cGguYWR2YW5jZVdpZHRoO1xuICAgICAgICB9KS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIHJldHVybiBhICsgYjtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB3aWR0aCAqIGZhY3RvcjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG4gICAgXG4gICAgXG4gIC8qKlxuICAgKiBWaXN1YWxpc3QgQ2xhc3NcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yXG4gICAqL1xuXG4gIGZ1bmN0aW9uIFZpc3VhbGlzdChlbGVtZW50KSB7XG4gICAgdmFyIHNldCA9IG51bGwsIGVsZW1lbnQsIHJlc3VsdCwgaSwgc3ZnO1xuICAgIC8vIENvbGxlY3QgY29uc3RydWN0b3IgYXJnc1xuICAgIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ29iamVjdCcgJiYgZWxlbWVudC5uYW1lc3BhY2VVUkkgPT09IFNWR19OQU1FU1BBQ0VfVVJJKSB7XG4gICAgICAvLyBFeGlzdGluZyBFbGVtZW50XG4gICAgICBzZXQgPSBbZWxlbWVudF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZWxlbWVudCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFRPRE86IEltcGxlbWVudCBwYXJzZXJcbiAgICAgIC8vIFRPRE86IFF1ZXJ5IFNlbGVjdG9yXG4gICAgICBcbiAgICB9XG4gICAgaWYgKCFzZXQpIHtcbiAgICAgIHN0cmluZyA9ICc8c3ZnIHZlcnNpb249XCIxLjFcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIgeG1sOnNwYWNlPVwicHJlc2VydmVcIj4gPC9zdmc+JztcbiAgICAgIC8vIE5vZGU6XG4gICAgICAvL3N0cmluZyA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJ1dGYtOFwiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyBcIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOXCIgXCJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGRcIj4nICsgc3RyaW5nO1xuICAgICAgLy92YXIgZG9jdW1lbnQgPSBqc2RvbS5qc2RvbShzdHJpbmcpO1xuICAgICAgdmFyIGRvYyA9IChuZXcgaW1wbC5ET01QYXJzZXIoKSkucGFyc2VGcm9tU3RyaW5nKHN0cmluZywgJ3RleHQveG1sJyk7XG4gICAgICAvL3ZhciBlbGVtID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xuICAgICAgLypzdmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRV9VUkksICdzdmcnKTtcbiAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoXCJ4bWxuc1wiLCBTVkdfTkFNRVNQQUNFX1VSSSk7Ki9cbiAgICAgIHNldCA9IFtkb2MuZG9jdW1lbnRFbGVtZW50XTtcbiAgICB9XG4gICAgdGhpcy5wdXNoLmFwcGx5KHRoaXMsIHNldCB8fCBbXSk7XG4gIH1cbiAgXG4gIFZpc3VhbGlzdC5wcm90b3R5cGUgPSBbXTtcbiAgXG4gIC8qKlxuICAgKiBWaXN1YWxpc3QgY29uc3RydWN0b3JcbiAgICovXG4gIHZhciBfdiA9IGZ1bmN0aW9uKGVsZW1lbnQsIHdpZHRoLCBoZWlnaHQsIGF0dHJzKSB7XG4gICAgdmFyIGFyZywgaSwgX2VsZW1lbnQsIF93aWR0aCwgX2hlaWdodCwgX2F0dHJzID0ge30sIHNldDtcbiAgICBmb3IgKGkgPSAwLCBhcmc7IGFyZyA9IGFyZ3VtZW50c1tpXTsgaSsrKSB7XG4gICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgJiYgIWlzTmFOKHBhcnNlRmxvYXQoYXJnKSkpIHtcbiAgICAgICAgLy8gTnVtZXJpY1xuICAgICAgICBhcmcgPSB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyA/IHBhcnNlRmxvYXQoYXJnKSArIFwicHhcIiA6IGFyZztcbiAgICAgICAgaWYgKHR5cGVvZiBfd2lkdGggIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgX2hlaWdodCA9IGFyZztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBfd2lkdGggPSBhcmc7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgLy8gUGxhaW4gb2JqZWN0XG4gICAgICAgIF9hdHRycyA9IGFyZztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEV2ZXJ5dGhpbmcgZWxzZSBtYXkgYmUgYW4gZWxlbWVudCBvciBzZWxlY3RvclxuICAgICAgICBfZWxlbWVudCA9IGFyZztcbiAgICAgIH1cbiAgICB9XG4gICAgYXR0cnMgPSBfYXR0cnMgfHwge307XG4gICAgLy8gTWVyZ2Ugd2lkdGggYW5kIGhlaWdodCBhcmd1bWVudHMgd2l0aHMgYXR0cnNcbiAgICBpZiAodHlwZW9mIF93aWR0aCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGF0dHJzLndpZHRoID0gX3dpZHRoO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIF9oZWlnaHQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBhdHRycy5oZWlnaHQgPSBfaGVpZ2h0O1xuICAgIH1cbiAgICAvLyBSZXVzZSBvciBjcmVhdGUgaW5zdGFuY2VcbiAgICBzZXQgPSBfZWxlbWVudCBpbnN0YW5jZW9mIFZpc3VhbGlzdCA/IF9lbGVtZW50IDogbmV3IFZpc3VhbGlzdChfZWxlbWVudCk7XG4gICAgc2V0LmF0dHIoYXR0cnMpO1xuICAgIHJldHVybiBzZXQ7XG4gIH07XG4gIFxuICBcbiAgLy8gUGx1Z2luIEFQSVxuICBfdi5mbiA9IFZpc3VhbGlzdC5wcm90b3R5cGU7XG4gIFxuICAvKipcbiAgICogRXh0ZW5kcyB2aXN1YWxpc3QgcHJvdG90eXBlXG4gICAqIEBwYXJhbSB7QXJyYXl9IG1ldGhvZHNcbiAgICovXG4gIF92LmZuLmV4dGVuZCA9IGZ1bmN0aW9uKCBtZXRob2RzICkge1xuICAgIGZvciAodmFyIHggaW4gbWV0aG9kcykge1xuICAgICAgVmlzdWFsaXN0LnByb3RvdHlwZVt4XSA9IG1ldGhvZHNbeF07XG4gICAgfVxuICB9O1xuICBcbiAgLy8gUHJpdmF0ZSBDb21wb25lbnRzXG4gIFxuICAvKipcbiAgICogRHJhdyBiYXNpYyBzaGFwZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtc1xuICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICogQHBhcmFtIHtBcnJheX0gY2hpbGRyZW4gXG4gICAqL1xuICBcbiAgZnVuY3Rpb24gc2hhcGUodGFnTmFtZSwgYXR0cnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIHZhciBjaGlsZCA9IHNlbGYuY3JlYXRlKHRhZ05hbWUsIGF0dHJzKTtcbiAgICAgIF92KGVsZW0pLmFwcGVuZChjaGlsZCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgXG4gIC8vIFB1YmxpYyBDb21wb25lbnRzXG4gIFxuICBfdi5mbi5leHRlbmQoe1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2YgYW4gYXR0cmlidXRlIGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIGF0dHJpYnV0ZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIGF0dHI6IGZ1bmN0aW9uKCBuYW1lLCB2YWx1ZSApIHtcbiAgICAgIC8vY29uc29sZS5sb2coXCJzZXQgYXR0cjogXCIsIG5hbWUsIHZhbHVlKTtcbiAgICAgIHZhclxuICAgICAgICBfdGhpcyA9IHRoaXM7XG4gICAgICBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAvLyBTZXRcbiAgICAgICAgdmFyIGF0dHJzID0gdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnID8gbmFtZSA6IChmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICAgIHZhciBhdHRycyA9IHt9O1xuICAgICAgICAgIGF0dHJzW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgcmV0dXJuIGF0dHJzO1xuICAgICAgICB9KShuYW1lLCB2YWx1ZSk7XG4gICAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBhdHRycykge1xuICAgICAgICAgICAgdmFsdWUgPSBhdHRyc1tuYW1lXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAvLyBSb3VuZCB2YWx1ZTpcbiAgICAgICAgICAgICAgdmFsdWUgPSByb3VuZCh2YWx1ZSk7XG4gICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKFMobmFtZSkuZGFzaGVyaXplKCksIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5zdHlsZSh2YWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gVE9ETzogZGF0YS1hdHRyaWJ1dGVzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUpIHtcbiAgICAgICAgLy8gR2V0XG4gICAgICAgIGlmICh0aGlzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiB0aGlzWzBdLmdldEF0dHJpYnV0ZShuYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgXG4gICAgY3NzOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiKioqIGdldCBjc3M6IFwiLCBuYW1lLCB2YWx1ZSk7XG4gICAgICB2YXIgc3R5bGVzID0ge307XG4gICAgICB2YXIgZWxlbSA9IHRoaXNbMF07XG4gICAgICB2YXIgd2luZG93ID0gZWxlbS5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3O1xuICAgICAgc3R5bGVzID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbSk7XG4gICAgICBpZiAobmFtZSkge1xuICAgICAgICByZXR1cm4gc3R5bGVzW25hbWVdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0eWxlcztcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2YgYW4gaW5saW5lIHN0eWxlIGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIGlubGluZSBzdHlsZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIHN0eWxlOiBmdW5jdGlvbiggbmFtZSwgdmFsdWUgKSB7XG4gICAgICBcbiAgICAgIGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBwcm9wcyA9IHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyA/IG5hbWUgOiAoZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICAgICAgICB2YXIgcHJvcHMgPSB7fTtcbiAgICAgICAgICBwcm9wc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgIHJldHVybiBwcm9wcztcbiAgICAgICAgfSkobmFtZSwgdmFsdWUpO1xuICAgICAgICAgIFxuICAgICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICAgIC8vIFNldFxuICAgICAgICAgIHZhciBzdHlsZXMgPSB7fTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImdldCBjc3MgdGV4dFwiLCBlbGVtKTtcbiAgICAgICAgICB2YXIgY3NzVGV4dCA9IGVsZW0uZ2V0QXR0cmlidXRlKCdzdHlsZScpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiZ2V0IGNzcyB0ZXh0XCIsIGNzc1RleHQpO1xuICAgICAgICAgIGlmIChjc3NUZXh0KSB7XG4gICAgICAgICAgICB2YXIgb2JqID0gY3NzLnBhcnNlKCdlbGVtZW50IHsgJyArIGNzc1RleHQgKyAnIH0nKTtcbiAgICAgICAgICAgIG9iai5zdHlsZXNoZWV0LnJ1bGVzWzBdLmRlY2xhcmF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHJ1bGUpIHtcbiAgICAgICAgICAgICAgaWYgKCFwcm9wcy5oYXNPd25Qcm9wZXJ0eShydWxlLnByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHN0eWxlc1tTKHJ1bGUucHJvcGVydHkpLmNhbWVsaXplKCldID0gcnVsZS52YWx1ZTsgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW1vdmUgZW1wdHkgc3R5bGVzXG4gICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBwcm9wcykge1xuICAgICAgICAgICAgdmFyIHZhbHVlO1xuICAgICAgICAgICAgaWYgKCFwcm9wc1tuYW1lXSkge1xuICAgICAgICAgICAgICBkZWxldGUgc3R5bGVzW25hbWVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBwcm9wc1tuYW1lXTtcbiAgICAgICAgICAgICAgc3R5bGVzW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNzc1RleHQgPSBPYmplY3Qua2V5cyhzdHlsZXMpLm1hcChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gUyhuYW1lKS5kYXNoZXJpemUoKSArIFwiOiBcIiArIHN0eWxlc1tuYW1lXTtcbiAgICAgICAgICB9KS5qb2luKFwiOyBcIik7XG4gICAgICAgICAgXG4gICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgY3NzVGV4dCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gR2V0XG4gICAgICAgIGlmICh0aGlzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBlbGVtID0gdGhpc1swXTtcbiAgICAgICAgICB2YXIgc3R5bGVzID0ge307XG4gICAgICAgICAgdmFyIGNzc1RleHQgPSBlbGVtLmdldEF0dHJpYnV0ZSgnc3R5bGUnKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImNzc1RleHQgXCIsIGNzc1RleHQpO1xuICAgICAgICAgIGlmIChjc3NUZXh0KSB7XG4gICAgICAgICAgICB2YXIgb2JqID0gY3NzLnBhcnNlKCdlbGVtZW50LnN0eWxlIHsgJyArIGNzc1RleHQgKyAnIH0nKTtcbiAgICAgICAgICAgIG9iai5zdHlsZXNoZWV0LnJ1bGVzWzBdLmRlY2xhcmF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHJ1bGUpIHtcbiAgICAgICAgICAgICAgc3R5bGVzW1MocnVsZS5wcm9wZXJ0eSkuY2FtZWxpemUoKV0gPSBydWxlLnZhbHVlOyBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmFtZSA/IHN0eWxlc1tuYW1lXSA6IHN0eWxlcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgXG4gICAgc3ZnOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBcIlwiO1xuICAgICAgLy92YXIgeG1sU2VyaWFsaXplciA9IG5ldyBYTUxTZXJpYWxpemVyKCk7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiZWxlbTogXCIsIGVsZW0ub3V0ZXJIVE1MKTtcbiAgICAgICAgLy9yZXN1bHQrPSBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgaWYgKHR5cGVvZiBlbGVtLm91dGVySFRNTCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXN1bHQrPSBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQrPSAobmV3IGltcGwuWE1MU2VyaWFsaXplcigpKS5zZXJpYWxpemVUb1N0cmluZyhlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBlbGVtZW50IHdpdGggdGhlIHNwZWNpZmVkIHRhZ25hbWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uKCB0YWdOYW1lLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBfdigodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZUVsZW1lbnROUyh0aGlzWzBdICYmIHRoaXNbMF0ubmFtZXNwYWNlVVJJIHx8IFNWR19OQU1FU1BBQ0VfVVJJLCB0YWdOYW1lKSkuYXR0cihhdHRycyk7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBBcHBlbmRzIHRoZSBzcGVjaWZpZWQgY2hpbGQgdG8gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBhcHBlbmQ6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIGlmICh0aGlzLmxlbmd0aCkge1xuICAgICAgICBpZiAodHlwZW9mIGNoaWxkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiU1RSSU5HOiBcIiwgY2hpbGQpO1xuICAgICAgICAgIGNoaWxkID0gdGhpc1swXS5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNoaWxkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzWzBdLmFwcGVuZENoaWxkKGNoaWxkWzBdIHx8IGNoaWxkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgXG4gICAgcHJlcGVuZDogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgaWYgKHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXNbMF0uaW5zZXJ0QmVmb3JlKF92KGNoaWxkKVswXSwgdGhpc1swXS5maXJzdENoaWxkKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGVsZW1lbnRzIGluIHRoZSBzZXQgb3IgcmVtb3ZlcyB0aGUgc3BlY2lmaWVkIGNoaWxkIGZyb20gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIHJlbW92ZTogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbS5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgZWxlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsZW0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgXG4gICAgcGFyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfdih0aGlzWzBdICYmIHRoaXNbMF0ucGFyZW50Tm9kZSk7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBUaGUgYXJjKCkgbWV0aG9kIGNyZWF0ZXMgYW4gYXJjL2N1cnZlICh1c2VkIHRvIGNyZWF0ZSBjaXJjbGVzLCBvciBwYXJ0cyBvZiBjaXJjbGVzKS4gXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHNBbmdsZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBlQW5nbGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNvdW50ZXJjbG9ja3dpc2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBhcmM6IGZ1bmN0aW9uKGN4LCBjeSwgciwgc0FuZ2xlLCBlQW5nbGUsIGNvdW50ZXJjbG9ja3dpc2UsIGF0dHJzKSB7XG4gICAgICBjb3VudGVyY2xvY2t3aXNlID0gdHlwZW9mIGNvdW50ZXJjbG9ja3dpc2UgPT09ICdib29sZWFuJyA/IGNvdW50ZXJjbG9ja3dpc2UgOiBmYWxzZTtcbiAgICAgIHZhclxuICAgICAgICBkID0gJ00gJyArIHJvdW5kKGN4KSArICcsICcgKyByb3VuZChjeSksXG4gICAgICAgIGN4cyxcbiAgICAgICAgY3lzLFxuICAgICAgICBjeGUsXG4gICAgICAgIGN5ZTtcbiAgICAgIGlmIChlQW5nbGUgLSBzQW5nbGUgPT09IE1hdGguUEkgKiAyKSB7XG4gICAgICAgIC8vIENpcmNsZVxuICAgICAgICBkKz0gJyBtIC0nICsgciArICcsIDAgYSAnICsgciArICcsJyArIHIgKyAnIDAgMSwwICcgKyAociAqIDIpICsgJywwIGEgJyArIHIgKyAnLCcgKyByICsgJyAwIDEsMCAtJyArIChyICogMikgKyAnLDAnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3hzID0gcm91bmQoY3ggKyBjb3Moc0FuZ2xlKSAqIHIpO1xuICAgICAgICBjeXMgPSByb3VuZChjeSArIHNpbihzQW5nbGUpICogcik7XG4gICAgICAgIGN4ZSA9IHJvdW5kKGN4ICsgY29zKGVBbmdsZSkgKiByKTtcbiAgICAgICAgY3llID0gcm91bmQoY3kgKyBzaW4oZUFuZ2xlKSAqIHIpO1xuICAgICAgICBkKz0gXCIgTFwiICsgY3hzICsgXCIsXCIgKyBjeXMgK1xuICAgICAgICAgIFwiIEFcIiArIHIgKyBcIixcIiArIHIgKyBcIiAwIFwiICsgKGVBbmdsZSAtIHNBbmdsZSA+IFBJID8gMSA6IDApICsgXCIsXCIgKyAoY291bnRlcmNsb2Nrd2lzZSA/IDAgOiAxKSArXG4gICAgICAgICAgXCIgXCIgKyBjeGUgKyBcIixcIiArIGN5ZSArIFwiIFpcIjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwicGF0aFwiLCBtZXJnZSh7XG4gICAgICAgIGQ6IGRcbiAgICAgIH0sIGF0dHJzIHx8IHt9KSk7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGNpcmNsZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBjaXJjbGU6IGZ1bmN0aW9uKCBjeCwgY3ksIHIsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJjaXJjbGVcIiwgbWVyZ2Uoe1xuICAgICAgICBjeDogY3gsIFxuICAgICAgICBjeTogY3ksIFxuICAgICAgICByOiByXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogRHJhd3MgYW4gZWxsaXBzZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ5XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZWxsaXBzZTogZnVuY3Rpb24oIGN4LCBjeSwgcngsIHJ5LCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiZWxsaXBzZVwiLCBtZXJnZSh7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHJ4OiByeCxcbiAgICAgICAgcnk6IHJ5XG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSByZWN0YW5nbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcmVjdDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJyZWN0XCIsIG1lcmdlKHtcbiAgICAgICAgeDogeCwgXG4gICAgICAgIHk6IHksIFxuICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBsaW5lIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBsaW5lOiBmdW5jdGlvbiggeDEsIHkxLCB4MiwgeTIsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJsaW5lXCIsIG1lcmdlKHtcbiAgICAgICAgeDE6IHgxLFxuICAgICAgICB5MTogeTEsXG4gICAgICAgIHgyOiB4MixcbiAgICAgICAgeTI6IHkyXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBwb2x5Z29uIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9pbnRzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcG9seWdvbjogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWdvbicsIG1lcmdlKHtcbiAgICAgICAgcG9pbnRzOiBnZXRQYXRoKHBvaW50cylcbiAgICAgIH0sIGF0dHJzIHx8IHt9KSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBvbHlnb24gb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwb2x5bGluZTogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWxpbmUnLCBtZXJnZSh7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBwYXRoIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBhdGg6IGZ1bmN0aW9uKCBkLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICdwYXRoJywgbWVyZ2Uoe1xuICAgICAgICBkOiBkXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogUmVuZGVycyB0ZXh0IG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHRleHQ6IGZ1bmN0aW9uKCB4LCB5LCBzdHJpbmcsIGF0dHJzICkge1xuICAgICAgY29uc29sZS5sb2coXCIqKiogdGV4dDogXCIsIHgsIHksIHN0cmluZywgYXR0cnMpO1xuICAgICAgdmFyIGVsZW0gPSB0aGlzLmNyZWF0ZSgndGV4dCcsIG1lcmdlKGF0dHJzIHx8IHt9LCB7XG4gICAgICAgIHg6IHgsIFxuICAgICAgICB5OiB5XG4gICAgICB9KSk7XG4gICAgICB0aGlzLmFwcGVuZChlbGVtKTtcbiAgICAgIGVsZW0uYXBwZW5kKFsodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZVRleHROb2RlKHN0cmluZyldKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIGdyb3VwIGxheWVyIG9uIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBnOiBmdW5jdGlvbiggYXR0cnMgKSB7XG4gICAgICB2YXIgZyA9IHRoaXMuY3JlYXRlKCdnJywgYXR0cnMpO1xuICAgICAgX3YodGhpc1swXSkuYXBwZW5kKGcpO1xuICAgICAgcmV0dXJuIGc7XG4gICAgfSxcbiAgICBcbiAgICBiYm94OiBmdW5jdGlvbigpIHtcbiAgICAgIC8vIFRPRE86IENoZWNrIHdoZXRoZXIgYWRkZWQgdG8gZG9jdW1lbnQgdmlld1xuICAgICAgY29uc29sZS5sb2coXCItLS0tLS0tLS0gQkJPWDogXCIsIHRoaXNbMF0ubm9kZU5hbWUpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGltcGwuU1ZHU1ZHRWxlbWVudC5wcm90b3R5cGUuZ2V0QkJveC5hcHBseSh0aGlzWzBdLCBhcmd1bWVudHMpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdmFyXG4gICAgICAgIHggPSAwLFxuICAgICAgICB5ID0gMCxcbiAgICAgICAgd2lkdGggPSAwLFxuICAgICAgICBoZWlnaHQgPSAwLFxuICAgICAgICBlbGVtID0gdGhpc1swXSxcbiAgICAgICAgeDEsIHkxLCB4MiwgeTI7XG4gICAgICBcbiAgICAgIGlmIChlbGVtLm5vZGVOYW1lID09PSAndGV4dCcpIHtcbiAgICAgICAgeCA9IHBhcnNlRmxvYXQodGhpcy5hdHRyKCd4JykpO1xuICAgICAgICB5ID0gcGFyc2VGbG9hdCh0aGlzLmF0dHIoJ3knKSk7XG4gICAgICAgIC8vd2lkdGggPSBwYXJzZUZsb2F0KHRoaXMuYXR0cignd2lkdGgnKSk7XG4gICAgICAgIC8vaGVpZ2h0ID0gcGFyc2VGbG9hdCh0aGlzLmF0dHIoJ2hlaWdodCcpKTtcbiAgICAgIH0gIFxuICAgICAgXG4gICAgICB2YXIgYyA9IGNvbXB1dGVkVGV4dExlbmd0aChlbGVtKTtcbiAgICAgIHZhciBzdHlsZSA9IHRoaXMuc3R5bGUoKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coXCJyZWN0OiBcIiwgcmVjdCk7XG4gICAgICAgXG4gICAgICBpZiAoZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyXG4gICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KHN0eWxlLmZvbnRTaXplKSxcbiAgICAgICAgICByZWN0ID0ge307XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhcImVsZW0gYmJveDogXCIsIGVsZW0ubm9kZU5hbWUsIGVsZW0sIHgsIHksIHdpZHRoLCBoZWlnaHQsIGMsIGZvbnRTaXplKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENoaWxkcmVuXG4gICAgICAgIHZhciBjaGlsZHJlbiA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5hcHBseShlbGVtLmNoaWxkTm9kZXMpLmZpbHRlcihmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAgIHJldHVybiBjaGlsZC5ub2RlVHlwZSA9PT0gMTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIFxuICAgICAgICAgIGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICAgIHZhclxuICAgICAgICAgICAgICBfY2hpbGQgPSBfdihjaGlsZCksXG4gICAgICAgICAgICAgIGJvdW5kcyA9IF9jaGlsZC5iYm94KCksXG4gICAgICAgICAgICAgIHRyYW5zZm9ybSA9IF9jaGlsZC5hdHRyKCd0cmFuc2Zvcm0nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIG1hdHJpeCA9IG5ldyBYQ1NTTWF0cml4KHRyYW5zZm9ybSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgeDEgPSB0eXBlb2YgeDEgPT09ICdudW1iZXInID8gTWF0aC5taW4oYm91bmRzLngsIHgxKSA6IGJvdW5kcy54O1xuICAgICAgICAgICAgeTEgPSB0eXBlb2YgeTEgPT09ICdudW1iZXInID8gTWF0aC5taW4oYm91bmRzLnksIHkxKSA6IGJvdW5kcy55O1xuICAgICAgICAgICAgeDIgPSB0eXBlb2YgeDIgPT09ICdudW1iZXInID8gTWF0aC5tYXgoYm91bmRzLnggKyBib3VuZHMud2lkdGgsIHgyKSA6IGJvdW5kcy54ICsgYm91bmRzLndpZHRoO1xuICAgICAgICAgICAgeTIgPSB0eXBlb2YgeTIgPT09ICdudW1iZXInID8gTWF0aC5tYXgoYm91bmRzLnkgKyBib3VuZHMuaGVpZ2h0LCB5MikgOiBib3VuZHMueSArIGJvdW5kcy5oZWlnaHQ7XG4gIFxuICAgICAgICAgICAgY29uc29sZS5sb2coXCIjIyMjIGNoaWxkOiBcIiwgYm91bmRzLCB4MSwgeTEsIHgyLCB5MiwgbWF0cml4LnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICgheCAmJiB4MSAhPT0gMCkge1xuICAgICAgICAgICAgeCA9IHgxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXkgJiYgeTEgIT09IDApIHtcbiAgICAgICAgICAgIHkgPSB5MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgd2lkdGggPSB4MiAtIHgxO1xuICAgICAgICAgIGhlaWdodCA9IHkyIC0geTE7XG4gICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFRFWFQ6XG4gICAgICAgIGlmIChlbGVtLm5vZGVOYW1lID09PSAndGV4dCcpIHtcbiAgICAgICAgICB3aWR0aCA9IE1hdGgubWF4KGNvbXB1dGVkVGV4dExlbmd0aCh0aGlzKSwgd2lkdGgpO1xuICAgICAgICAgIGhlaWdodCA9IE1hdGgubWF4KGZvbnRTaXplLCBoZWlnaHQpO1xuICAgICAgICAgIC8qdmFyIGZvbnQgPSBnZXRGb250KHN0eWxlLmZvbnRGYW1pbHkpO1xuICAgICAgICAgIHZhciBmYWN0b3IgPSBmb250U2l6ZSAvIGZvbnQudW5pdHNQZXJFbTtcbiAgICAgICAgICB2YXIgb2Zmc2V0ID0gZm9udFNpemUgLSAoZm9udC5hc2NlbnQgLyBmb250LnVuaXRzUGVyRW0pICogZm9udFNpemU7XG4gICAgICAgICAgaGVpZ2h0ID0gKGZvbnQuYXNjZW50IC0gZm9udC5kZXNjZW50KSAvIGZvbnQudW5pdHNQZXJFbSAqIGZvbnRTaXplO1xuICAgICAgICAgIFxuICAgICAgICAgIHkgPSB5IC0gZm9udFNpemUgKyBvZmZzZXQ7Ki9cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmVjdC54ID0geDtcbiAgICAgICAgcmVjdC55ID0geTtcbiAgICAgICAgcmVjdC53aWR0aCA9IHdpZHRoO1xuICAgICAgICByZWN0LmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKFwiKioqIGVsZW0gYmJveCByZXN1bHQ6IFwiLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCByZWN0KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiByZWN0O1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBzbW9vdGggZ3JhcGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuICAgIGdyYXBoOiBmdW5jdGlvbiggcG9pbnRzLCBhdHRycywgb3B0aW9ucyApIHtcbiAgICAgIFxuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgXG4gICAgICAgIHZhclxuICAgICAgICAgIG9wdHMgPSBtZXJnZSh7XG4gICAgICAgICAgICBzbW9vdGg6IHRydWUsIFxuICAgICAgICAgICAgdGVuc2lvbjogMC40LFxuICAgICAgICAgICAgYXBwcm94aW1hdGU6IHRydWVcbiAgICAgICAgICB9LCBvcHRpb25zIHx8IHt9KSxcbiAgICAgICAgICB0ID0gIWlzTmFOKCBvcHRzLnRlbnNpb24gKSA/IG9wdHMudGVuc2lvbiA6IDAuNSxcbiAgICAgICAgICBlbCA9IF92KGVsZW0pLCBcbiAgICAgICAgICBwLFxuICAgICAgICAgIGksXG4gICAgICAgICAgYyxcbiAgICAgICAgICBkLFxuICAgICAgICAgIHAxLFxuICAgICAgICAgIHAyLFxuICAgICAgICAgIGNwcyxcbiAgICAgICAgICBwYXRoID0gZWwuY3JlYXRlKCdwYXRoJywgYXR0cnMpLFxuICAgICAgICAgIHBhdGhTdHIgPSBcIlwiO1xuICAgICAgICAgIFxuICAgICAgICBlbC5hcHBlbmQocGF0aCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIW9wdHMuc21vb3RoKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbaV07XG4gICAgICAgICAgICBwYXRoU3RyKz0gaSA+IDAgPyBcIkxcIiA6IFwiTVwiO1xuICAgICAgICAgICAgcGF0aFN0cis9IHJvdW5kKHAueCkgKyBcIiBcIiArIHJvdW5kKHAueSkgKyBcIiBcIjtcbiAgICAgICAgICB9IFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFNtb290aFxuICAgICAgICAgIGlmIChvcHRzLmFwcHJveGltYXRlKSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzWzBdO1xuICAgICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcm91bmQocC54KSArIFwiIFwiICsgcm91bmQocC55KSArIFwiIFwiO1xuICAgICAgICAgICAgZm9yIChpID0gMTsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjID0gKHBvaW50c1tpXS54ICsgcG9pbnRzW2kgKyAxXS54KSAvIDI7XG4gICAgICAgICAgICAgICAgZCA9IChwb2ludHNbaV0ueSArIHBvaW50c1tpICsgMV0ueSkgLyAyO1xuICAgICAgICAgICAgICAgIHBhdGhTdHIrPSBcIlFcIiArIHJvdW5kKHBvaW50c1tpXS54KSArIFwiIFwiICsgcm91bmQocG9pbnRzW2ldLnkpICsgXCIgXCIgKyBjICsgXCIgXCIgKyBkICsgXCIgXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXRoU3RyKz0gXCJUXCIgKyByb3VuZChwb2ludHNbaV0ueCkgKyBcIiBcIiArIHJvdW5kKHBvaW50c1tpXS55KSArIFwiIFwiO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzWzBdO1xuICAgICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSs9MSkge1xuICAgICAgICAgICAgICBwID0gcG9pbnRzW2kgLSAxXTtcbiAgICAgICAgICAgICAgcDEgPSBwb2ludHNbaV07XG4gICAgICAgICAgICAgIHAyID0gcG9pbnRzW2kgKyAxXTtcbiAgICAgICAgICAgICAgY3BzID0gZ2V0Q29udHJvbFBvaW50cyhwLngsIHAueSwgcDEueCwgcDEueSwgcDIueCwgcDIueSwgdCk7XG4gICAgICAgICAgICAgIHBhdGhTdHIrPSBcIkNcIiArIHJvdW5kKGNwcy5wMS54KSArIFwiIFwiICsgcm91bmQoY3BzLnAxLnkpICsgXCIgXCIgKyByb3VuZChjcHMucDIueCkgKyBcIiBcIiArIHJvdW5kKGNwcy5wMi55KSArIFwiIFwiICsgcm91bmQocDIueCkgKyBcIiBcIiArIHJvdW5kKHAyLnkpICsgXCIgXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXRoU3RyKz0gXCJUXCIgKyByb3VuZChwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLngpICsgXCIgXCIgKyByb3VuZChwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLnkpICsgXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBkZWxldGUgb3B0cy5zbW9vdGg7XG4gICAgICAgIGRlbGV0ZSBvcHRzLnRlbnNpb247XG4gICAgICAgIGRlbGV0ZSBvcHRzLmFwcHJveGltYXRlO1xuICAgICAgICBwYXRoLmF0dHIobWVyZ2Uoe1xuICAgICAgICAgIGZpbGw6ICdub25lJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZDogcGF0aFN0clxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgfSk7XG4gICAgfSxcbiAgICBcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIHRleHQgaW50byBhIGJvdW5kaW5nIGJveCBieSB3cmFwcGluZyBsaW5lcyBhdCBzcGFjZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0geVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB3aWR0aFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RyaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgdGV4dGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIHN0cmluZywgYXR0cnMgKSB7XG4gICAgICBcbiAgICAgIHZhciBcbiAgICAgICAgc2VsZiA9IHRoaXM7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHZhclxuICAgICAgICAgIF92ZWxlbSA9IF92KGVsZW0pLFxuICAgICAgICAgIGxpbmVzID0gd2lkdGggPyBbXSA6IFtzdHJpbmddLCBcbiAgICAgICAgICBsaW5lID0gW10sXG4gICAgICAgICAgdGV4dExlbmd0aCA9IDAsXG4gICAgICAgICAgd29yZHMgPSB3aWR0aCA/IHN0cmluZy5zcGxpdCgvXFxzKy8pIDogW10sXG4gICAgICAgICAgdGV4dCA9IHNlbGYuY3JlYXRlKCd0ZXh0JywgbWVyZ2UoYXR0cnMgfHwge30sIHtcbiAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICB5OiB5XG4gICAgICAgICAgfSkpLFxuICAgICAgICAgIHRleHROb2RlLFxuICAgICAgICAgIHN0eWxlID0gdGV4dC5zdHlsZSgpLFxuICAgICAgICAgIGZvbnRTaXplID0gcGFyc2VGbG9hdChzdHlsZS5mb250U2l6ZSkgfHwgMTYsXG4gICAgICAgICAgbGluZUhlaWdodCA9IGZvbnRTaXplICogMS40LFxuICAgICAgICAgIHRleHRBbGlnbiA9IChzdHlsZS50ZXh0QWxpZ24gPT09ICdlbmQnIHx8IHN0eWxlLnRleHRBbGlnbiA9PT0gJ3JpZ2h0JyA/IDEgOiBzdHlsZS50ZXh0QWxpZ24gPT09ICdjZW50ZXInIHx8IHN0eWxlLnRleHRBbGlnbiA9PT0gJ21pZGRsZScgPyAwLjUgOiAwKTtcbiAgICAgICAgICB0eSA9IDA7XG4gICAgICAgIFxuICAgICAgICBfdmVsZW0uYXBwZW5kKHRleHQpO1xuXG4gICAgICAgIGlmICh3aWR0aCkge1xuICAgICAgICAgIC8vIEJyZWFrIGxpbmVzXG4gICAgICAgICAgdGV4dE5vZGUgPSBlbGVtLm93bmVyRG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoXCJcIik7XG4gICAgICAgICAgdGV4dC5hcHBlbmQodGV4dE5vZGUpO1xuICAgICAgICAgIHdvcmRzLmZvckVhY2goZnVuY3Rpb24od29yZCwgaW5kZXgpIHtcbiAgICAgICAgICAgIHRleHROb2RlLmRhdGEgPSBsaW5lLmpvaW4oJyAnKSArICcgJyArIHdvcmQ7XG4gICAgICAgICAgICB0ZXh0TGVuZ3RoID0gY29tcHV0ZWRUZXh0TGVuZ3RoKHRleHQsIHN0eWxlKTtcbiAgICAgICAgICAgIGlmICh0ZXh0TGVuZ3RoID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgLy8gQnJlYWsgbGluZVxuICAgICAgICAgICAgICBsaW5lcy5wdXNoKHtsZW5ndGg6IGxpbmVMZW5ndGgsIHRleHQ6IGxpbmUuam9pbignICcpfSk7XG4gICAgICAgICAgICAgIGxpbmVMZW5ndGggPSAwO1xuICAgICAgICAgICAgICBsaW5lID0gW3dvcmRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gQWRkIHdvcmQgdG8gbGluZVxuICAgICAgICAgICAgICBsaW5lTGVuZ3RoID0gdGV4dExlbmd0aDtcbiAgICAgICAgICAgICAgbGluZS5wdXNoKHdvcmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGluZGV4ID09PSB3b3Jkcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgIGxpbmVzLnB1c2goe2xlbmd0aDogbGluZUxlbmd0aCwgdGV4dDogbGluZS5qb2luKCcgJyl9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0ZXh0LnJlbW92ZSh0ZXh0Tm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlbmRlciBsaW5lc1xuICAgICAgICBsaW5lcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUsIGluZGV4KSB7XG4gICAgICAgICAgdmFyIHRzcGFuLCBkeTtcbiAgICAgICAgICBpZiAoIWhlaWdodCB8fCB0eSArIHBhcnNlRmxvYXQobGluZUhlaWdodCkgPCBoZWlnaHQpIHtcbiAgICAgICAgICAgIGR5ID0gaW5kZXggPiAwID8gbGluZUhlaWdodCA6IGZvbnRTaXplIC0gMjtcbiAgICAgICAgICAgIHR5Kz0gZHk7XG4gICAgICAgICAgICB0c3BhbiA9IHNlbGYuY3JlYXRlKCd0c3BhbicsIHtkeTogZHl9KTtcbiAgICAgICAgICAgIHRleHQuYXBwZW5kKHRzcGFuKTtcbiAgICAgICAgICAgIHRzcGFuXG4gICAgICAgICAgICAgIC5hcHBlbmQoZWxlbS5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGxpbmUudGV4dCkpO1xuICAgICAgICAgICAgdHNwYW4uYXR0cigneCcsIHBhcnNlSW50KHRleHQuYXR0cigneCcpLCB1bmRlZmluZWQpICsgKHdpZHRoIC0gbGluZS5sZW5ndGgpICogdGV4dEFsaWduKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgXG4gIH0pO1xubW9kdWxlLmV4cG9ydHMgPSBfdjsiXX0=
