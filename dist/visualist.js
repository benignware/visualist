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
  
  var a = this;
  var b = matrix;
 /*
  a.a = a.a*b.a + a.c*b.b + a.e;
  a.b = a.b*b.a + a.d*b.b + a.f;
  a.c = a.a*b.c + a.c*b.d + a.e;
  a.d = a.b*b.c + a.d*b.d + a.f;
  a.e = a.a*b.e + a.c*b.f + a.e;
  a.f = a.b*b.e + a.d*b.f + a.f;
  */
  a.a = this.a * matrix.a + this.c * matrix.b;
  a.b = this.b * matrix.a + this.d * matrix.b;
  a.c = this.a * matrix.c + this.c * matrix.d;
  a.d = this.b * matrix.c + this.d * matrix.d;
  a.e = this.a * matrix.e + this.c * matrix.f + this.e;
  a.f = this.b * matrix.e + this.d * matrix.f + this.f;
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

SVGMatrix.prototype.skewY = function(angle) {
  var m = new SVGMatrix();
  m.b = Math.tan( parseFloat(angle) * Math.PI / 180 );
  return this.multiply(m);
};

SVGMatrix.prototype.rotate = function(angle) {
  var cos = Math.cos(angle * Math.PI / 180),
    sin = Math.sin(angle * Math.PI / 180);
  var m = this;
  m.a = cos;
  m.b = sin;
  m.c = -sin;
  m.d = cos;
  m.e = 0;
  m.f = 0;
  return this;
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
    transforms = {},
    t = null,
    matrix = new SVGMatrix(),
    re = /(\w+)\s*\(\s*([^\)]*)\s*\)/g,
    m, st, args, p = SVGMatrix.prototype, method;
  while (m = re.exec(string)) {
    if (m) {
      st = m[1];
      args = m[2].split(/,|\s+/);
      if (statements.indexOf(st) >= 0) {
        console.info('valid');
        transforms[st] = {
          args: args
        };
      }
    }
  }
  statements.filter(function(st) {
    return transforms[st];
  }).forEach(function(st) {
    method = st === 'scale' ? 'scaleNonUniform' : st;
    matrix = p[method].apply(matrix, transforms[st].args);
  });
  
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
      var style = getComputedStyle(elem);
      var fontSize = parseFloat(style.fontSize);
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


module.exports = {
  'SVGSVGElement': SVGSVGElement
};

},{"xcssmatrix":33}],45:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY3NzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9saWIvcGFyc2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvY29tcGlsZXIuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvY29tcHJlc3MuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvaWRlbnRpdHkuanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY3NzL2xpYi9zdHJpbmdpZnkvc291cmNlLW1hcC1zdXBwb3J0LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAtcmVzb2x2ZS9ub2RlX21vZHVsZXMvcmVzb2x2ZS11cmwvcmVzb2x2ZS11cmwuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwLXJlc29sdmUvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAtdXJsL3NvdXJjZS1tYXAtdXJsLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC1yZXNvbHZlL3NvdXJjZS1tYXAtcmVzb2x2ZS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL2FycmF5LXNldC5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmFzZTY0LXZscS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvYmFzZTY0LmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9iaW5hcnktc2VhcmNoLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9tYXBwaW5nLWxpc3QuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3NvdXJjZS1tYXAtY29uc3VtZXIuanMiLCJub2RlX21vZHVsZXMvY3NzL25vZGVfbW9kdWxlcy9zb3VyY2UtbWFwL2xpYi9zb3VyY2UtbWFwL3NvdXJjZS1tYXAtZ2VuZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvc291cmNlLW1hcC9saWIvc291cmNlLW1hcC9zb3VyY2Utbm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbGliL3NvdXJjZS1tYXAvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9jc3Mvbm9kZV9tb2R1bGVzL3NvdXJjZS1tYXAvbm9kZV9tb2R1bGVzL2FtZGVmaW5lL2FtZGVmaW5lLmpzIiwibm9kZV9tb2R1bGVzL2Nzcy9ub2RlX21vZHVsZXMvdXJpeC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWVwbWVyZ2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvbndtYXRjaGVyL3NyYy9ud21hdGNoZXIuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9fY291bnQuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9fc3BsaXRMZWZ0LmpzIiwibm9kZV9tb2R1bGVzL3N0cmluZy9saWIvX3NwbGl0UmlnaHQuanMiLCJub2RlX21vZHVsZXMvc3RyaW5nL2xpYi9zdHJpbmcuanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy94Y3NzbWF0cml4L2xpYi9WZWN0b3I0LmpzIiwibm9kZV9tb2R1bGVzL3hjc3NtYXRyaXgvbGliL1hDU1NNYXRyaXguanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9saWIvdXRpbHMvYW5nbGUuanMiLCJub2RlX21vZHVsZXMveGNzc21hdHJpeC9saWIvdXRpbHMvY3NzVHJhbnNmb3JtU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL3hjc3NtYXRyaXgvbGliL3V0aWxzL21hdHJpeC5qcyIsIm5vZGVfbW9kdWxlcy94Y3NzbWF0cml4L2xpYi91dGlscy92ZWN0b3IuanMiLCJub2RlX21vZHVsZXMveG1sZG9tL2RvbS1wYXJzZXIuanMiLCJub2RlX21vZHVsZXMveG1sZG9tL2RvbS5qcyIsIm5vZGVfbW9kdWxlcy94bWxkb20vc2F4LmpzIiwic3JjL2ltcGwvZG9tLmpzIiwic3JjL2ltcGwvc3ZnLmpzIiwic3JjL2ltcGwvd2luZG93LmpzIiwic3JjL2xpYi9yb3VuZC5qcyIsInNyYy9saWIvc3ZncG9pbnQuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9rQ0E7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vbGliL3BhcnNlJyk7XG5leHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vbGliL3N0cmluZ2lmeScpO1xuIiwiLy8gaHR0cDovL3d3dy53My5vcmcvVFIvQ1NTMjEvZ3JhbW1hci5odG1sXG4vLyBodHRwczovL2dpdGh1Yi5jb20vdmlzaW9ubWVkaWEvY3NzLXBhcnNlL3B1bGwvNDkjaXNzdWVjb21tZW50LTMwMDg4MDI3XG52YXIgY29tbWVudHJlID0gL1xcL1xcKlteKl0qXFwqKyhbXi8qXVteKl0qXFwqKykqXFwvL2dcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjc3MsIG9wdGlvbnMpe1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvKipcbiAgICogUG9zaXRpb25hbC5cbiAgICovXG5cbiAgdmFyIGxpbmVubyA9IDE7XG4gIHZhciBjb2x1bW4gPSAxO1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgbGluZW5vIGFuZCBjb2x1bW4gYmFzZWQgb24gYHN0cmAuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZVBvc2l0aW9uKHN0cikge1xuICAgIHZhciBsaW5lcyA9IHN0ci5tYXRjaCgvXFxuL2cpO1xuICAgIGlmIChsaW5lcykgbGluZW5vICs9IGxpbmVzLmxlbmd0aDtcbiAgICB2YXIgaSA9IHN0ci5sYXN0SW5kZXhPZignXFxuJyk7XG4gICAgY29sdW1uID0gfmkgPyBzdHIubGVuZ3RoIC0gaSA6IGNvbHVtbiArIHN0ci5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogTWFyayBwb3NpdGlvbiBhbmQgcGF0Y2ggYG5vZGUucG9zaXRpb25gLlxuICAgKi9cblxuICBmdW5jdGlvbiBwb3NpdGlvbigpIHtcbiAgICB2YXIgc3RhcnQgPSB7IGxpbmU6IGxpbmVubywgY29sdW1uOiBjb2x1bW4gfTtcbiAgICByZXR1cm4gZnVuY3Rpb24obm9kZSl7XG4gICAgICBub2RlLnBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHN0YXJ0KTtcbiAgICAgIHdoaXRlc3BhY2UoKTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU3RvcmUgcG9zaXRpb24gaW5mb3JtYXRpb24gZm9yIGEgbm9kZVxuICAgKi9cblxuICBmdW5jdGlvbiBQb3NpdGlvbihzdGFydCkge1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydDtcbiAgICB0aGlzLmVuZCA9IHsgbGluZTogbGluZW5vLCBjb2x1bW46IGNvbHVtbiB9O1xuICAgIHRoaXMuc291cmNlID0gb3B0aW9ucy5zb3VyY2U7XG4gIH1cblxuICAvKipcbiAgICogTm9uLWVudW1lcmFibGUgc291cmNlIHN0cmluZ1xuICAgKi9cblxuICBQb3NpdGlvbi5wcm90b3R5cGUuY29udGVudCA9IGNzcztcblxuICAvKipcbiAgICogRXJyb3IgYG1zZ2AuXG4gICAqL1xuXG4gIHZhciBlcnJvcnNMaXN0ID0gW107XG5cbiAgZnVuY3Rpb24gZXJyb3IobXNnKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihvcHRpb25zLnNvdXJjZSArICc6JyArIGxpbmVubyArICc6JyArIGNvbHVtbiArICc6ICcgKyBtc2cpO1xuICAgIGVyci5yZWFzb24gPSBtc2c7XG4gICAgZXJyLmZpbGVuYW1lID0gb3B0aW9ucy5zb3VyY2U7XG4gICAgZXJyLmxpbmUgPSBsaW5lbm87XG4gICAgZXJyLmNvbHVtbiA9IGNvbHVtbjtcbiAgICBlcnIuc291cmNlID0gY3NzO1xuXG4gICAgaWYgKG9wdGlvbnMuc2lsZW50KSB7XG4gICAgICBlcnJvcnNMaXN0LnB1c2goZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBzdHlsZXNoZWV0LlxuICAgKi9cblxuICBmdW5jdGlvbiBzdHlsZXNoZWV0KCkge1xuICAgIHZhciBydWxlc0xpc3QgPSBydWxlcygpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdzdHlsZXNoZWV0JyxcbiAgICAgIHN0eWxlc2hlZXQ6IHtcbiAgICAgICAgcnVsZXM6IHJ1bGVzTGlzdCxcbiAgICAgICAgcGFyc2luZ0Vycm9yczogZXJyb3JzTGlzdFxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogT3BlbmluZyBicmFjZS5cbiAgICovXG5cbiAgZnVuY3Rpb24gb3BlbigpIHtcbiAgICByZXR1cm4gbWF0Y2goL157XFxzKi8pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3NpbmcgYnJhY2UuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGNsb3NlKCkge1xuICAgIHJldHVybiBtYXRjaCgvXn0vKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBydWxlc2V0LlxuICAgKi9cblxuICBmdW5jdGlvbiBydWxlcygpIHtcbiAgICB2YXIgbm9kZTtcbiAgICB2YXIgcnVsZXMgPSBbXTtcbiAgICB3aGl0ZXNwYWNlKCk7XG4gICAgY29tbWVudHMocnVsZXMpO1xuICAgIHdoaWxlIChjc3MubGVuZ3RoICYmIGNzcy5jaGFyQXQoMCkgIT0gJ30nICYmIChub2RlID0gYXRydWxlKCkgfHwgcnVsZSgpKSkge1xuICAgICAgaWYgKG5vZGUgIT09IGZhbHNlKSB7XG4gICAgICAgIHJ1bGVzLnB1c2gobm9kZSk7XG4gICAgICAgIGNvbW1lbnRzKHJ1bGVzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ1bGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIE1hdGNoIGByZWAgYW5kIHJldHVybiBjYXB0dXJlcy5cbiAgICovXG5cbiAgZnVuY3Rpb24gbWF0Y2gocmUpIHtcbiAgICB2YXIgbSA9IHJlLmV4ZWMoY3NzKTtcbiAgICBpZiAoIW0pIHJldHVybjtcbiAgICB2YXIgc3RyID0gbVswXTtcbiAgICB1cGRhdGVQb3NpdGlvbihzdHIpO1xuICAgIGNzcyA9IGNzcy5zbGljZShzdHIubGVuZ3RoKTtcbiAgICByZXR1cm4gbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSB3aGl0ZXNwYWNlLlxuICAgKi9cblxuICBmdW5jdGlvbiB3aGl0ZXNwYWNlKCkge1xuICAgIG1hdGNoKC9eXFxzKi8pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGNvbW1lbnRzO1xuICAgKi9cblxuICBmdW5jdGlvbiBjb21tZW50cyhydWxlcykge1xuICAgIHZhciBjO1xuICAgIHJ1bGVzID0gcnVsZXMgfHwgW107XG4gICAgd2hpbGUgKGMgPSBjb21tZW50KCkpIHtcbiAgICAgIGlmIChjICE9PSBmYWxzZSkge1xuICAgICAgICBydWxlcy5wdXNoKGMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcnVsZXM7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgY29tbWVudC5cbiAgICovXG5cbiAgZnVuY3Rpb24gY29tbWVudCgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICBpZiAoJy8nICE9IGNzcy5jaGFyQXQoMCkgfHwgJyonICE9IGNzcy5jaGFyQXQoMSkpIHJldHVybjtcblxuICAgIHZhciBpID0gMjtcbiAgICB3aGlsZSAoXCJcIiAhPSBjc3MuY2hhckF0KGkpICYmICgnKicgIT0gY3NzLmNoYXJBdChpKSB8fCAnLycgIT0gY3NzLmNoYXJBdChpICsgMSkpKSArK2k7XG4gICAgaSArPSAyO1xuXG4gICAgaWYgKFwiXCIgPT09IGNzcy5jaGFyQXQoaS0xKSkge1xuICAgICAgcmV0dXJuIGVycm9yKCdFbmQgb2YgY29tbWVudCBtaXNzaW5nJyk7XG4gICAgfVxuXG4gICAgdmFyIHN0ciA9IGNzcy5zbGljZSgyLCBpIC0gMik7XG4gICAgY29sdW1uICs9IDI7XG4gICAgdXBkYXRlUG9zaXRpb24oc3RyKTtcbiAgICBjc3MgPSBjc3Muc2xpY2UoaSk7XG4gICAgY29sdW1uICs9IDI7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdjb21tZW50JyxcbiAgICAgIGNvbW1lbnQ6IHN0clxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHNlbGVjdG9yLlxuICAgKi9cblxuICBmdW5jdGlvbiBzZWxlY3RvcigpIHtcbiAgICB2YXIgbSA9IG1hdGNoKC9eKFtee10rKS8pO1xuICAgIGlmICghbSkgcmV0dXJuO1xuICAgIC8qIEBmaXggUmVtb3ZlIGFsbCBjb21tZW50cyBmcm9tIHNlbGVjdG9yc1xuICAgICAqIGh0dHA6Ly9vc3Rlcm1pbGxlci5vcmcvZmluZGNvbW1lbnQuaHRtbCAqL1xuICAgIHJldHVybiB0cmltKG1bMF0pXG4gICAgICAucmVwbGFjZSgvXFwvXFwqKFteKl18W1xcclxcbl18KFxcKisoW14qL118W1xcclxcbl0pKSkqXFwqXFwvKy9nLCAnJylcbiAgICAgIC5yZXBsYWNlKC9cIig/OlxcXFxcInxbXlwiXSkqXCJ8Jyg/OlxcXFwnfFteJ10pKicvZywgZnVuY3Rpb24obSkge1xuICAgICAgICByZXR1cm4gbS5yZXBsYWNlKC8sL2csICdcXHUyMDBDJyk7XG4gICAgICB9KVxuICAgICAgLnNwbGl0KC9cXHMqKD8hW14oXSpcXCkpLFxccyovKVxuICAgICAgLm1hcChmdW5jdGlvbihzKSB7XG4gICAgICAgIHJldHVybiBzLnJlcGxhY2UoL1xcdTIwMEMvZywgJywnKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGRlY2xhcmF0aW9uLlxuICAgKi9cblxuICBmdW5jdGlvbiBkZWNsYXJhdGlvbigpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcblxuICAgIC8vIHByb3BcbiAgICB2YXIgcHJvcCA9IG1hdGNoKC9eKFxcKj9bLSNcXC9cXCpcXFxcXFx3XSsoXFxbWzAtOWEtel8tXStcXF0pPylcXHMqLyk7XG4gICAgaWYgKCFwcm9wKSByZXR1cm47XG4gICAgcHJvcCA9IHRyaW0ocHJvcFswXSk7XG5cbiAgICAvLyA6XG4gICAgaWYgKCFtYXRjaCgvXjpcXHMqLykpIHJldHVybiBlcnJvcihcInByb3BlcnR5IG1pc3NpbmcgJzonXCIpO1xuXG4gICAgLy8gdmFsXG4gICAgdmFyIHZhbCA9IG1hdGNoKC9eKCg/OicoPzpcXFxcJ3wuKSo/J3xcIig/OlxcXFxcInwuKSo/XCJ8XFwoW15cXCldKj9cXCl8W159O10pKykvKTtcblxuICAgIHZhciByZXQgPSBwb3Moe1xuICAgICAgdHlwZTogJ2RlY2xhcmF0aW9uJyxcbiAgICAgIHByb3BlcnR5OiBwcm9wLnJlcGxhY2UoY29tbWVudHJlLCAnJyksXG4gICAgICB2YWx1ZTogdmFsID8gdHJpbSh2YWxbMF0pLnJlcGxhY2UoY29tbWVudHJlLCAnJykgOiAnJ1xuICAgIH0pO1xuXG4gICAgLy8gO1xuICAgIG1hdGNoKC9eWztcXHNdKi8pO1xuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBkZWNsYXJhdGlvbnMuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGRlY2xhcmF0aW9ucygpIHtcbiAgICB2YXIgZGVjbHMgPSBbXTtcblxuICAgIGlmICghb3BlbigpKSByZXR1cm4gZXJyb3IoXCJtaXNzaW5nICd7J1wiKTtcbiAgICBjb21tZW50cyhkZWNscyk7XG5cbiAgICAvLyBkZWNsYXJhdGlvbnNcbiAgICB2YXIgZGVjbDtcbiAgICB3aGlsZSAoZGVjbCA9IGRlY2xhcmF0aW9uKCkpIHtcbiAgICAgIGlmIChkZWNsICE9PSBmYWxzZSkge1xuICAgICAgICBkZWNscy5wdXNoKGRlY2wpO1xuICAgICAgICBjb21tZW50cyhkZWNscyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFjbG9zZSgpKSByZXR1cm4gZXJyb3IoXCJtaXNzaW5nICd9J1wiKTtcbiAgICByZXR1cm4gZGVjbHM7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Uga2V5ZnJhbWUuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGtleWZyYW1lKCkge1xuICAgIHZhciBtO1xuICAgIHZhciB2YWxzID0gW107XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG5cbiAgICB3aGlsZSAobSA9IG1hdGNoKC9eKChcXGQrXFwuXFxkK3xcXC5cXGQrfFxcZCspJT98W2Etel0rKVxccyovKSkge1xuICAgICAgdmFscy5wdXNoKG1bMV0pO1xuICAgICAgbWF0Y2goL14sXFxzKi8pO1xuICAgIH1cblxuICAgIGlmICghdmFscy5sZW5ndGgpIHJldHVybjtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ2tleWZyYW1lJyxcbiAgICAgIHZhbHVlczogdmFscyxcbiAgICAgIGRlY2xhcmF0aW9uczogZGVjbGFyYXRpb25zKClcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBrZXlmcmFtZXMuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0a2V5ZnJhbWVzKCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15AKFstXFx3XSspP2tleWZyYW1lc1xccyovKTtcblxuICAgIGlmICghbSkgcmV0dXJuO1xuICAgIHZhciB2ZW5kb3IgPSBtWzFdO1xuXG4gICAgLy8gaWRlbnRpZmllclxuICAgIHZhciBtID0gbWF0Y2goL14oWy1cXHddKylcXHMqLyk7XG4gICAgaWYgKCFtKSByZXR1cm4gZXJyb3IoXCJAa2V5ZnJhbWVzIG1pc3NpbmcgbmFtZVwiKTtcbiAgICB2YXIgbmFtZSA9IG1bMV07XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQGtleWZyYW1lcyBtaXNzaW5nICd7J1wiKTtcblxuICAgIHZhciBmcmFtZTtcbiAgICB2YXIgZnJhbWVzID0gY29tbWVudHMoKTtcbiAgICB3aGlsZSAoZnJhbWUgPSBrZXlmcmFtZSgpKSB7XG4gICAgICBmcmFtZXMucHVzaChmcmFtZSk7XG4gICAgICBmcmFtZXMgPSBmcmFtZXMuY29uY2F0KGNvbW1lbnRzKCkpO1xuICAgIH1cblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQGtleWZyYW1lcyBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ2tleWZyYW1lcycsXG4gICAgICBuYW1lOiBuYW1lLFxuICAgICAgdmVuZG9yOiB2ZW5kb3IsXG4gICAgICBrZXlmcmFtZXM6IGZyYW1lc1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHN1cHBvcnRzLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdHN1cHBvcnRzKCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15Ac3VwcG9ydHMgKihbXntdKykvKTtcblxuICAgIGlmICghbSkgcmV0dXJuO1xuICAgIHZhciBzdXBwb3J0cyA9IHRyaW0obVsxXSk7XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQHN1cHBvcnRzIG1pc3NpbmcgJ3snXCIpO1xuXG4gICAgdmFyIHN0eWxlID0gY29tbWVudHMoKS5jb25jYXQocnVsZXMoKSk7XG5cbiAgICBpZiAoIWNsb3NlKCkpIHJldHVybiBlcnJvcihcIkBzdXBwb3J0cyBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ3N1cHBvcnRzJyxcbiAgICAgIHN1cHBvcnRzOiBzdXBwb3J0cyxcbiAgICAgIHJ1bGVzOiBzdHlsZVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGhvc3QuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0aG9zdCgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQGhvc3RcXHMqLyk7XG5cbiAgICBpZiAoIW0pIHJldHVybjtcblxuICAgIGlmICghb3BlbigpKSByZXR1cm4gZXJyb3IoXCJAaG9zdCBtaXNzaW5nICd7J1wiKTtcblxuICAgIHZhciBzdHlsZSA9IGNvbW1lbnRzKCkuY29uY2F0KHJ1bGVzKCkpO1xuXG4gICAgaWYgKCFjbG9zZSgpKSByZXR1cm4gZXJyb3IoXCJAaG9zdCBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ2hvc3QnLFxuICAgICAgcnVsZXM6IHN0eWxlXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgbWVkaWEuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0bWVkaWEoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgdmFyIG0gPSBtYXRjaCgvXkBtZWRpYSAqKFtee10rKS8pO1xuXG4gICAgaWYgKCFtKSByZXR1cm47XG4gICAgdmFyIG1lZGlhID0gdHJpbShtWzFdKTtcblxuICAgIGlmICghb3BlbigpKSByZXR1cm4gZXJyb3IoXCJAbWVkaWEgbWlzc2luZyAneydcIik7XG5cbiAgICB2YXIgc3R5bGUgPSBjb21tZW50cygpLmNvbmNhdChydWxlcygpKTtcblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQG1lZGlhIG1pc3NpbmcgJ30nXCIpO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAnbWVkaWEnLFxuICAgICAgbWVkaWE6IG1lZGlhLFxuICAgICAgcnVsZXM6IHN0eWxlXG4gICAgfSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBQYXJzZSBjdXN0b20tbWVkaWEuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0Y3VzdG9tbWVkaWEoKSB7XG4gICAgdmFyIHBvcyA9IHBvc2l0aW9uKCk7XG4gICAgdmFyIG0gPSBtYXRjaCgvXkBjdXN0b20tbWVkaWFcXHMrKC0tW15cXHNdKylcXHMqKFteeztdKyk7Lyk7XG4gICAgaWYgKCFtKSByZXR1cm47XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdjdXN0b20tbWVkaWEnLFxuICAgICAgbmFtZTogdHJpbShtWzFdKSxcbiAgICAgIG1lZGlhOiB0cmltKG1bMl0pXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgcGFnZWQgbWVkaWEuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGF0cGFnZSgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgbSA9IG1hdGNoKC9eQHBhZ2UgKi8pO1xuICAgIGlmICghbSkgcmV0dXJuO1xuXG4gICAgdmFyIHNlbCA9IHNlbGVjdG9yKCkgfHwgW107XG5cbiAgICBpZiAoIW9wZW4oKSkgcmV0dXJuIGVycm9yKFwiQHBhZ2UgbWlzc2luZyAneydcIik7XG4gICAgdmFyIGRlY2xzID0gY29tbWVudHMoKTtcblxuICAgIC8vIGRlY2xhcmF0aW9uc1xuICAgIHZhciBkZWNsO1xuICAgIHdoaWxlIChkZWNsID0gZGVjbGFyYXRpb24oKSkge1xuICAgICAgZGVjbHMucHVzaChkZWNsKTtcbiAgICAgIGRlY2xzID0gZGVjbHMuY29uY2F0KGNvbW1lbnRzKCkpO1xuICAgIH1cblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQHBhZ2UgbWlzc2luZyAnfSdcIik7XG5cbiAgICByZXR1cm4gcG9zKHtcbiAgICAgIHR5cGU6ICdwYWdlJyxcbiAgICAgIHNlbGVjdG9yczogc2VsLFxuICAgICAgZGVjbGFyYXRpb25zOiBkZWNsc1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGRvY3VtZW50LlxuICAgKi9cblxuICBmdW5jdGlvbiBhdGRvY3VtZW50KCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15AKFstXFx3XSspP2RvY3VtZW50ICooW157XSspLyk7XG4gICAgaWYgKCFtKSByZXR1cm47XG5cbiAgICB2YXIgdmVuZG9yID0gdHJpbShtWzFdKTtcbiAgICB2YXIgZG9jID0gdHJpbShtWzJdKTtcblxuICAgIGlmICghb3BlbigpKSByZXR1cm4gZXJyb3IoXCJAZG9jdW1lbnQgbWlzc2luZyAneydcIik7XG5cbiAgICB2YXIgc3R5bGUgPSBjb21tZW50cygpLmNvbmNhdChydWxlcygpKTtcblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQGRvY3VtZW50IG1pc3NpbmcgJ30nXCIpO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAnZG9jdW1lbnQnLFxuICAgICAgZG9jdW1lbnQ6IGRvYyxcbiAgICAgIHZlbmRvcjogdmVuZG9yLFxuICAgICAgcnVsZXM6IHN0eWxlXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgZm9udC1mYWNlLlxuICAgKi9cblxuICBmdW5jdGlvbiBhdGZvbnRmYWNlKCkge1xuICAgIHZhciBwb3MgPSBwb3NpdGlvbigpO1xuICAgIHZhciBtID0gbWF0Y2goL15AZm9udC1mYWNlXFxzKi8pO1xuICAgIGlmICghbSkgcmV0dXJuO1xuXG4gICAgaWYgKCFvcGVuKCkpIHJldHVybiBlcnJvcihcIkBmb250LWZhY2UgbWlzc2luZyAneydcIik7XG4gICAgdmFyIGRlY2xzID0gY29tbWVudHMoKTtcblxuICAgIC8vIGRlY2xhcmF0aW9uc1xuICAgIHZhciBkZWNsO1xuICAgIHdoaWxlIChkZWNsID0gZGVjbGFyYXRpb24oKSkge1xuICAgICAgZGVjbHMucHVzaChkZWNsKTtcbiAgICAgIGRlY2xzID0gZGVjbHMuY29uY2F0KGNvbW1lbnRzKCkpO1xuICAgIH1cblxuICAgIGlmICghY2xvc2UoKSkgcmV0dXJuIGVycm9yKFwiQGZvbnQtZmFjZSBtaXNzaW5nICd9J1wiKTtcblxuICAgIHJldHVybiBwb3Moe1xuICAgICAgdHlwZTogJ2ZvbnQtZmFjZScsXG4gICAgICBkZWNsYXJhdGlvbnM6IGRlY2xzXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgaW1wb3J0XG4gICAqL1xuXG4gIHZhciBhdGltcG9ydCA9IF9jb21waWxlQXRydWxlKCdpbXBvcnQnKTtcblxuICAvKipcbiAgICogUGFyc2UgY2hhcnNldFxuICAgKi9cblxuICB2YXIgYXRjaGFyc2V0ID0gX2NvbXBpbGVBdHJ1bGUoJ2NoYXJzZXQnKTtcblxuICAvKipcbiAgICogUGFyc2UgbmFtZXNwYWNlXG4gICAqL1xuXG4gIHZhciBhdG5hbWVzcGFjZSA9IF9jb21waWxlQXRydWxlKCduYW1lc3BhY2UnKTtcblxuICAvKipcbiAgICogUGFyc2Ugbm9uLWJsb2NrIGF0LXJ1bGVzXG4gICAqL1xuXG5cbiAgZnVuY3Rpb24gX2NvbXBpbGVBdHJ1bGUobmFtZSkge1xuICAgIHZhciByZSA9IG5ldyBSZWdFeHAoJ15AJyArIG5hbWUgKyAnXFxcXHMqKFteO10rKTsnKTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICAgIHZhciBtID0gbWF0Y2gocmUpO1xuICAgICAgaWYgKCFtKSByZXR1cm47XG4gICAgICB2YXIgcmV0ID0geyB0eXBlOiBuYW1lIH07XG4gICAgICByZXRbbmFtZV0gPSBtWzFdLnRyaW0oKTtcbiAgICAgIHJldHVybiBwb3MocmV0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgYXQgcnVsZS5cbiAgICovXG5cbiAgZnVuY3Rpb24gYXRydWxlKCkge1xuICAgIGlmIChjc3NbMF0gIT0gJ0AnKSByZXR1cm47XG5cbiAgICByZXR1cm4gYXRrZXlmcmFtZXMoKVxuICAgICAgfHwgYXRtZWRpYSgpXG4gICAgICB8fCBhdGN1c3RvbW1lZGlhKClcbiAgICAgIHx8IGF0c3VwcG9ydHMoKVxuICAgICAgfHwgYXRpbXBvcnQoKVxuICAgICAgfHwgYXRjaGFyc2V0KClcbiAgICAgIHx8IGF0bmFtZXNwYWNlKClcbiAgICAgIHx8IGF0ZG9jdW1lbnQoKVxuICAgICAgfHwgYXRwYWdlKClcbiAgICAgIHx8IGF0aG9zdCgpXG4gICAgICB8fCBhdGZvbnRmYWNlKCk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgcnVsZS5cbiAgICovXG5cbiAgZnVuY3Rpb24gcnVsZSgpIHtcbiAgICB2YXIgcG9zID0gcG9zaXRpb24oKTtcbiAgICB2YXIgc2VsID0gc2VsZWN0b3IoKTtcblxuICAgIGlmICghc2VsKSByZXR1cm4gZXJyb3IoJ3NlbGVjdG9yIG1pc3NpbmcnKTtcbiAgICBjb21tZW50cygpO1xuXG4gICAgcmV0dXJuIHBvcyh7XG4gICAgICB0eXBlOiAncnVsZScsXG4gICAgICBzZWxlY3RvcnM6IHNlbCxcbiAgICAgIGRlY2xhcmF0aW9uczogZGVjbGFyYXRpb25zKClcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBhZGRQYXJlbnQoc3R5bGVzaGVldCgpKTtcbn07XG5cbi8qKlxuICogVHJpbSBgc3RyYC5cbiAqL1xuXG5mdW5jdGlvbiB0cmltKHN0cikge1xuICByZXR1cm4gc3RyID8gc3RyLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKSA6ICcnO1xufVxuXG4vKipcbiAqIEFkZHMgbm9uLWVudW1lcmFibGUgcGFyZW50IG5vZGUgcmVmZXJlbmNlIHRvIGVhY2ggbm9kZS5cbiAqL1xuXG5mdW5jdGlvbiBhZGRQYXJlbnQob2JqLCBwYXJlbnQpIHtcbiAgdmFyIGlzTm9kZSA9IG9iaiAmJiB0eXBlb2Ygb2JqLnR5cGUgPT09ICdzdHJpbmcnO1xuICB2YXIgY2hpbGRQYXJlbnQgPSBpc05vZGUgPyBvYmogOiBwYXJlbnQ7XG5cbiAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICB2YXIgdmFsdWUgPSBvYmpba107XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICB2YWx1ZS5mb3JFYWNoKGZ1bmN0aW9uKHYpIHsgYWRkUGFyZW50KHYsIGNoaWxkUGFyZW50KTsgfSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICBhZGRQYXJlbnQodmFsdWUsIGNoaWxkUGFyZW50KTtcbiAgICB9XG4gIH1cblxuICBpZiAoaXNOb2RlKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgJ3BhcmVudCcsIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICB2YWx1ZTogcGFyZW50IHx8IG51bGxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBvYmo7XG59XG4iLCJcbi8qKlxuICogRXhwb3NlIGBDb21waWxlcmAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDb21waWxlcjtcblxuLyoqXG4gKiBJbml0aWFsaXplIGEgY29tcGlsZXIuXG4gKlxuICogQHBhcmFtIHtUeXBlfSBuYW1lXG4gKiBAcmV0dXJuIHtUeXBlfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBDb21waWxlcihvcHRzKSB7XG4gIHRoaXMub3B0aW9ucyA9IG9wdHMgfHwge307XG59XG5cbi8qKlxuICogRW1pdCBgc3RyYFxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oc3RyKSB7XG4gIHJldHVybiBzdHI7XG59O1xuXG4vKipcbiAqIFZpc2l0IGBub2RlYC5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUudmlzaXQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXNbbm9kZS50eXBlXShub2RlKTtcbn07XG5cbi8qKlxuICogTWFwIHZpc2l0IG92ZXIgYXJyYXkgb2YgYG5vZGVzYCwgb3B0aW9uYWxseSB1c2luZyBhIGBkZWxpbWBcbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUubWFwVmlzaXQgPSBmdW5jdGlvbihub2RlcywgZGVsaW0pe1xuICB2YXIgYnVmID0gJyc7XG4gIGRlbGltID0gZGVsaW0gfHwgJyc7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG5vZGVzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgYnVmICs9IHRoaXMudmlzaXQobm9kZXNbaV0pO1xuICAgIGlmIChkZWxpbSAmJiBpIDwgbGVuZ3RoIC0gMSkgYnVmICs9IHRoaXMuZW1pdChkZWxpbSk7XG4gIH1cblxuICByZXR1cm4gYnVmO1xufTtcbiIsIlxuLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBCYXNlID0gcmVxdWlyZSgnLi9jb21waWxlcicpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuLyoqXG4gKiBFeHBvc2UgY29tcGlsZXIuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBDb21waWxlcjtcblxuLyoqXG4gKiBJbml0aWFsaXplIGEgbmV3IGBDb21waWxlcmAuXG4gKi9cblxuZnVuY3Rpb24gQ29tcGlsZXIob3B0aW9ucykge1xuICBCYXNlLmNhbGwodGhpcywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogSW5oZXJpdCBmcm9tIGBCYXNlLnByb3RvdHlwZWAuXG4gKi9cblxuaW5oZXJpdHMoQ29tcGlsZXIsIEJhc2UpO1xuXG4vKipcbiAqIENvbXBpbGUgYG5vZGVgLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiBub2RlLnN0eWxlc2hlZXRcbiAgICAucnVsZXMubWFwKHRoaXMudmlzaXQsIHRoaXMpXG4gICAgLmpvaW4oJycpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjb21tZW50IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmNvbW1lbnQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnJywgbm9kZS5wb3NpdGlvbik7XG59O1xuXG4vKipcbiAqIFZpc2l0IGltcG9ydCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5pbXBvcnQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGltcG9ydCAnICsgbm9kZS5pbXBvcnQgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBtZWRpYSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5tZWRpYSA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAbWVkaWEgJyArIG5vZGUubWVkaWEsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLnJ1bGVzKVxuICAgICsgdGhpcy5lbWl0KCd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGRvY3VtZW50IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmRvY3VtZW50ID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBkb2MgPSAnQCcgKyAobm9kZS52ZW5kb3IgfHwgJycpICsgJ2RvY3VtZW50ICcgKyBub2RlLmRvY3VtZW50O1xuXG4gIHJldHVybiB0aGlzLmVtaXQoZG9jLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjaGFyc2V0IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmNoYXJzZXQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGNoYXJzZXQgJyArIG5vZGUuY2hhcnNldCArICc7Jywgbm9kZS5wb3NpdGlvbik7XG59O1xuXG4vKipcbiAqIFZpc2l0IG5hbWVzcGFjZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5uYW1lc3BhY2UgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQG5hbWVzcGFjZSAnICsgbm9kZS5uYW1lc3BhY2UgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBzdXBwb3J0cyBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5zdXBwb3J0cyA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAc3VwcG9ydHMgJyArIG5vZGUuc3VwcG9ydHMsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLnJ1bGVzKVxuICAgICsgdGhpcy5lbWl0KCd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGtleWZyYW1lcyBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5rZXlmcmFtZXMgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQCdcbiAgICArIChub2RlLnZlbmRvciB8fCAnJylcbiAgICArICdrZXlmcmFtZXMgJ1xuICAgICsgbm9kZS5uYW1lLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5rZXlmcmFtZXMpXG4gICAgKyB0aGlzLmVtaXQoJ30nKTtcbn07XG5cbi8qKlxuICogVmlzaXQga2V5ZnJhbWUgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUua2V5ZnJhbWUgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIGRlY2xzID0gbm9kZS5kZWNsYXJhdGlvbnM7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdChub2RlLnZhbHVlcy5qb2luKCcsJyksIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChkZWNscylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBwYWdlIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLnBhZ2UgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIHNlbCA9IG5vZGUuc2VsZWN0b3JzLmxlbmd0aFxuICAgID8gbm9kZS5zZWxlY3RvcnMuam9pbignLCAnKVxuICAgIDogJyc7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdCgnQHBhZ2UgJyArIHNlbCwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgneycpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUuZGVjbGFyYXRpb25zKVxuICAgICsgdGhpcy5lbWl0KCd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGZvbnQtZmFjZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZVsnZm9udC1mYWNlJ10gPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGZvbnQtZmFjZScsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLmRlY2xhcmF0aW9ucylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBob3N0IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmhvc3QgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGhvc3QnLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KCd7JylcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjdXN0b20tbWVkaWEgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGVbJ2N1c3RvbS1tZWRpYSddID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BjdXN0b20tbWVkaWEgJyArIG5vZGUubmFtZSArICcgJyArIG5vZGUubWVkaWEgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBydWxlIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLnJ1bGUgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIGRlY2xzID0gbm9kZS5kZWNsYXJhdGlvbnM7XG4gIGlmICghZGVjbHMubGVuZ3RoKSByZXR1cm4gJyc7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdChub2RlLnNlbGVjdG9ycy5qb2luKCcsJyksIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3snKVxuICAgICsgdGhpcy5tYXBWaXNpdChkZWNscylcbiAgICArIHRoaXMuZW1pdCgnfScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBkZWNsYXJhdGlvbiBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5kZWNsYXJhdGlvbiA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KG5vZGUucHJvcGVydHkgKyAnOicgKyBub2RlLnZhbHVlLCBub2RlLnBvc2l0aW9uKSArIHRoaXMuZW1pdCgnOycpO1xufTtcblxuIiwiXG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL2NvbXBpbGVyJyk7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG4vKipcbiAqIEV4cG9zZSBjb21waWxlci5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBpbGVyO1xuXG4vKipcbiAqIEluaXRpYWxpemUgYSBuZXcgYENvbXBpbGVyYC5cbiAqL1xuXG5mdW5jdGlvbiBDb21waWxlcihvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBCYXNlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gIHRoaXMuaW5kZW50YXRpb24gPSBvcHRpb25zLmluZGVudDtcbn1cblxuLyoqXG4gKiBJbmhlcml0IGZyb20gYEJhc2UucHJvdG90eXBlYC5cbiAqL1xuXG5pbmhlcml0cyhDb21waWxlciwgQmFzZSk7XG5cbi8qKlxuICogQ29tcGlsZSBgbm9kZWAuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmNvbXBpbGUgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuc3R5bGVzaGVldChub2RlKTtcbn07XG5cbi8qKlxuICogVmlzaXQgc3R5bGVzaGVldCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5zdHlsZXNoZWV0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLm1hcFZpc2l0KG5vZGUuc3R5bGVzaGVldC5ydWxlcywgJ1xcblxcbicpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjb21tZW50IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmNvbW1lbnQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCh0aGlzLmluZGVudCgpICsgJy8qJyArIG5vZGUuY29tbWVudCArICcqLycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBpbXBvcnQgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuaW1wb3J0ID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQoJ0BpbXBvcnQgJyArIG5vZGUuaW1wb3J0ICsgJzsnLCBub2RlLnBvc2l0aW9uKTtcbn07XG5cbi8qKlxuICogVmlzaXQgbWVkaWEgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUubWVkaWEgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQG1lZGlhICcgKyBub2RlLm1lZGlhLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICAnIHtcXG4nXG4gICAgICAgICsgdGhpcy5pbmRlbnQoMSkpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUucnVsZXMsICdcXG5cXG4nKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICB0aGlzLmluZGVudCgtMSlcbiAgICAgICAgKyAnXFxufScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBkb2N1bWVudCBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5kb2N1bWVudCA9IGZ1bmN0aW9uKG5vZGUpe1xuICB2YXIgZG9jID0gJ0AnICsgKG5vZGUudmVuZG9yIHx8ICcnKSArICdkb2N1bWVudCAnICsgbm9kZS5kb2N1bWVudDtcblxuICByZXR1cm4gdGhpcy5lbWl0KGRvYywgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICAgJyAnXG4gICAgICArICcge1xcbidcbiAgICAgICsgdGhpcy5pbmRlbnQoMSkpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUucnVsZXMsICdcXG5cXG4nKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgICB0aGlzLmluZGVudCgtMSlcbiAgICAgICAgKyAnXFxufScpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBjaGFyc2V0IG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmNoYXJzZXQgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGNoYXJzZXQgJyArIG5vZGUuY2hhcnNldCArICc7Jywgbm9kZS5wb3NpdGlvbik7XG59O1xuXG4vKipcbiAqIFZpc2l0IG5hbWVzcGFjZSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5uYW1lc3BhY2UgPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQG5hbWVzcGFjZSAnICsgbm9kZS5uYW1lc3BhY2UgKyAnOycsIG5vZGUucG9zaXRpb24pO1xufTtcblxuLyoqXG4gKiBWaXNpdCBzdXBwb3J0cyBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5zdXBwb3J0cyA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAc3VwcG9ydHMgJyArIG5vZGUuc3VwcG9ydHMsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAnIHtcXG4nXG4gICAgICArIHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLnJ1bGVzLCAnXFxuXFxuJylcbiAgICArIHRoaXMuZW1pdChcbiAgICAgICAgdGhpcy5pbmRlbnQoLTEpXG4gICAgICAgICsgJ1xcbn0nKTtcbn07XG5cbi8qKlxuICogVmlzaXQga2V5ZnJhbWVzIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmtleWZyYW1lcyA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAJyArIChub2RlLnZlbmRvciB8fCAnJykgKyAna2V5ZnJhbWVzICcgKyBub2RlLm5hbWUsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAnIHtcXG4nXG4gICAgICArIHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLmtleWZyYW1lcywgJ1xcbicpXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAgIHRoaXMuaW5kZW50KC0xKVxuICAgICAgICArICd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGtleWZyYW1lIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmtleWZyYW1lID0gZnVuY3Rpb24obm9kZSl7XG4gIHZhciBkZWNscyA9IG5vZGUuZGVjbGFyYXRpb25zO1xuXG4gIHJldHVybiB0aGlzLmVtaXQodGhpcy5pbmRlbnQoKSlcbiAgICArIHRoaXMuZW1pdChub2RlLnZhbHVlcy5qb2luKCcsICcpLCBub2RlLnBvc2l0aW9uKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgJyB7XFxuJ1xuICAgICAgKyB0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQoZGVjbHMsICdcXG4nKVxuICAgICsgdGhpcy5lbWl0KFxuICAgICAgdGhpcy5pbmRlbnQoLTEpXG4gICAgICArICdcXG4nXG4gICAgICArIHRoaXMuaW5kZW50KCkgKyAnfVxcbicpO1xufTtcblxuLyoqXG4gKiBWaXNpdCBwYWdlIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLnBhZ2UgPSBmdW5jdGlvbihub2RlKXtcbiAgdmFyIHNlbCA9IG5vZGUuc2VsZWN0b3JzLmxlbmd0aFxuICAgID8gbm9kZS5zZWxlY3RvcnMuam9pbignLCAnKSArICcgJ1xuICAgIDogJyc7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdCgnQHBhZ2UgJyArIHNlbCwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgne1xcbicpXG4gICAgKyB0aGlzLmVtaXQodGhpcy5pbmRlbnQoMSkpXG4gICAgKyB0aGlzLm1hcFZpc2l0KG5vZGUuZGVjbGFyYXRpb25zLCAnXFxuJylcbiAgICArIHRoaXMuZW1pdCh0aGlzLmluZGVudCgtMSkpXG4gICAgKyB0aGlzLmVtaXQoJ1xcbn0nKTtcbn07XG5cbi8qKlxuICogVmlzaXQgZm9udC1mYWNlIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlWydmb250LWZhY2UnXSA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAZm9udC1mYWNlICcsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJ3tcXG4nKVxuICAgICsgdGhpcy5lbWl0KHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChub2RlLmRlY2xhcmF0aW9ucywgJ1xcbicpXG4gICAgKyB0aGlzLmVtaXQodGhpcy5pbmRlbnQoLTEpKVxuICAgICsgdGhpcy5lbWl0KCdcXG59Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGhvc3Qgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUuaG9zdCA9IGZ1bmN0aW9uKG5vZGUpe1xuICByZXR1cm4gdGhpcy5lbWl0KCdAaG9zdCcsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAgICcge1xcbidcbiAgICAgICAgKyB0aGlzLmluZGVudCgxKSlcbiAgICArIHRoaXMubWFwVmlzaXQobm9kZS5ydWxlcywgJ1xcblxcbicpXG4gICAgKyB0aGlzLmVtaXQoXG4gICAgICAgIHRoaXMuaW5kZW50KC0xKVxuICAgICAgICArICdcXG59Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGN1c3RvbS1tZWRpYSBub2RlLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZVsnY3VzdG9tLW1lZGlhJ10gPSBmdW5jdGlvbihub2RlKXtcbiAgcmV0dXJuIHRoaXMuZW1pdCgnQGN1c3RvbS1tZWRpYSAnICsgbm9kZS5uYW1lICsgJyAnICsgbm9kZS5tZWRpYSArICc7Jywgbm9kZS5wb3NpdGlvbik7XG59O1xuXG4vKipcbiAqIFZpc2l0IHJ1bGUgbm9kZS5cbiAqL1xuXG5Db21waWxlci5wcm90b3R5cGUucnVsZSA9IGZ1bmN0aW9uKG5vZGUpe1xuICB2YXIgaW5kZW50ID0gdGhpcy5pbmRlbnQoKTtcbiAgdmFyIGRlY2xzID0gbm9kZS5kZWNsYXJhdGlvbnM7XG4gIGlmICghZGVjbHMubGVuZ3RoKSByZXR1cm4gJyc7XG5cbiAgcmV0dXJuIHRoaXMuZW1pdChub2RlLnNlbGVjdG9ycy5tYXAoZnVuY3Rpb24ocyl7IHJldHVybiBpbmRlbnQgKyBzIH0pLmpvaW4oJyxcXG4nKSwgbm9kZS5wb3NpdGlvbilcbiAgICArIHRoaXMuZW1pdCgnIHtcXG4nKVxuICAgICsgdGhpcy5lbWl0KHRoaXMuaW5kZW50KDEpKVxuICAgICsgdGhpcy5tYXBWaXNpdChkZWNscywgJ1xcbicpXG4gICAgKyB0aGlzLmVtaXQodGhpcy5pbmRlbnQoLTEpKVxuICAgICsgdGhpcy5lbWl0KCdcXG4nICsgdGhpcy5pbmRlbnQoKSArICd9Jyk7XG59O1xuXG4vKipcbiAqIFZpc2l0IGRlY2xhcmF0aW9uIG5vZGUuXG4gKi9cblxuQ29tcGlsZXIucHJvdG90eXBlLmRlY2xhcmF0aW9uID0gZnVuY3Rpb24obm9kZSl7XG4gIHJldHVybiB0aGlzLmVtaXQodGhpcy5pbmRlbnQoKSlcbiAgICArIHRoaXMuZW1pdChub2RlLnByb3BlcnR5ICsgJzogJyArIG5vZGUudmFsdWUsIG5vZGUucG9zaXRpb24pXG4gICAgKyB0aGlzLmVtaXQoJzsnKTtcbn07XG5cbi8qKlxuICogSW5jcmVhc2UsIGRlY3JlYXNlIG9yIHJldHVybiBjdXJyZW50IGluZGVudGF0aW9uLlxuICovXG5cbkNvbXBpbGVyLnByb3RvdHlwZS5pbmRlbnQgPSBmdW5jdGlvbihsZXZlbCkge1xuICB0aGlzLmxldmVsID0gdGhpcy5sZXZlbCB8fCAxO1xuXG4gIGlmIChudWxsICE9IGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbCArPSBsZXZlbDtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICByZXR1cm4gQXJyYXkodGhpcy5sZXZlbCkuam9pbih0aGlzLmluZGVudGF0aW9uIHx8ICcgICcpO1xufTtcbiIsIlxuLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBDb21wcmVzc2VkID0gcmVxdWlyZSgnLi9jb21wcmVzcycpO1xudmFyIElkZW50aXR5ID0gcmVxdWlyZSgnLi9pZGVudGl0eScpO1xuXG4vKipcbiAqIFN0cmluZ2Z5IHRoZSBnaXZlbiBBU1QgYG5vZGVgLlxuICpcbiAqIE9wdGlvbnM6XG4gKlxuICogIC0gYGNvbXByZXNzYCBzcGFjZS1vcHRpbWl6ZWQgb3V0cHV0XG4gKiAgLSBgc291cmNlbWFwYCByZXR1cm4gYW4gb2JqZWN0IHdpdGggYC5jb2RlYCBhbmQgYC5tYXBgXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihub2RlLCBvcHRpb25zKXtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgdmFyIGNvbXBpbGVyID0gb3B0aW9ucy5jb21wcmVzc1xuICAgID8gbmV3IENvbXByZXNzZWQob3B0aW9ucylcbiAgICA6IG5ldyBJZGVudGl0eShvcHRpb25zKTtcblxuICAvLyBzb3VyY2UgbWFwc1xuICBpZiAob3B0aW9ucy5zb3VyY2VtYXApIHtcbiAgICB2YXIgc291cmNlbWFwcyA9IHJlcXVpcmUoJy4vc291cmNlLW1hcC1zdXBwb3J0Jyk7XG4gICAgc291cmNlbWFwcyhjb21waWxlcik7XG5cbiAgICB2YXIgY29kZSA9IGNvbXBpbGVyLmNvbXBpbGUobm9kZSk7XG4gICAgY29tcGlsZXIuYXBwbHlTb3VyY2VNYXBzKCk7XG5cbiAgICB2YXIgbWFwID0gb3B0aW9ucy5zb3VyY2VtYXAgPT09ICdnZW5lcmF0b3InXG4gICAgICA/IGNvbXBpbGVyLm1hcFxuICAgICAgOiBjb21waWxlci5tYXAudG9KU09OKCk7XG5cbiAgICByZXR1cm4geyBjb2RlOiBjb2RlLCBtYXA6IG1hcCB9O1xuICB9XG5cbiAgdmFyIGNvZGUgPSBjb21waWxlci5jb21waWxlKG5vZGUpO1xuICByZXR1cm4gY29kZTtcbn07XG4iLCJcbi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xuXG52YXIgU291cmNlTWFwID0gcmVxdWlyZSgnc291cmNlLW1hcCcpLlNvdXJjZU1hcEdlbmVyYXRvcjtcbnZhciBTb3VyY2VNYXBDb25zdW1lciA9IHJlcXVpcmUoJ3NvdXJjZS1tYXAnKS5Tb3VyY2VNYXBDb25zdW1lcjtcbnZhciBzb3VyY2VNYXBSZXNvbHZlID0gcmVxdWlyZSgnc291cmNlLW1hcC1yZXNvbHZlJyk7XG52YXIgdXJpeCA9IHJlcXVpcmUoJ3VyaXgnKTtcbnZhciBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG52YXIgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcblxuLyoqXG4gKiBFeHBvc2UgYG1peGluKClgLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gbWl4aW47XG5cbi8qKlxuICogTWl4aW4gc291cmNlIG1hcCBzdXBwb3J0IGludG8gYGNvbXBpbGVyYC5cbiAqXG4gKiBAcGFyYW0ge0NvbXBpbGVyfSBjb21waWxlclxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBtaXhpbihjb21waWxlcikge1xuICBjb21waWxlci5fY29tbWVudCA9IGNvbXBpbGVyLmNvbW1lbnQ7XG4gIGNvbXBpbGVyLm1hcCA9IG5ldyBTb3VyY2VNYXAoKTtcbiAgY29tcGlsZXIucG9zaXRpb24gPSB7IGxpbmU6IDEsIGNvbHVtbjogMSB9O1xuICBjb21waWxlci5maWxlcyA9IHt9O1xuICBmb3IgKHZhciBrIGluIGV4cG9ydHMpIGNvbXBpbGVyW2tdID0gZXhwb3J0c1trXTtcbn1cblxuLyoqXG4gKiBVcGRhdGUgcG9zaXRpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZXhwb3J0cy51cGRhdGVQb3NpdGlvbiA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgbGluZXMgPSBzdHIubWF0Y2goL1xcbi9nKTtcbiAgaWYgKGxpbmVzKSB0aGlzLnBvc2l0aW9uLmxpbmUgKz0gbGluZXMubGVuZ3RoO1xuICB2YXIgaSA9IHN0ci5sYXN0SW5kZXhPZignXFxuJyk7XG4gIHRoaXMucG9zaXRpb24uY29sdW1uID0gfmkgPyBzdHIubGVuZ3RoIC0gaSA6IHRoaXMucG9zaXRpb24uY29sdW1uICsgc3RyLmxlbmd0aDtcbn07XG5cbi8qKlxuICogRW1pdCBgc3RyYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcGFyYW0ge09iamVjdH0gW3Bvc11cbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmV4cG9ydHMuZW1pdCA9IGZ1bmN0aW9uKHN0ciwgcG9zKSB7XG4gIGlmIChwb3MpIHtcbiAgICB2YXIgc291cmNlRmlsZSA9IHVyaXgocG9zLnNvdXJjZSB8fCAnc291cmNlLmNzcycpO1xuXG4gICAgdGhpcy5tYXAuYWRkTWFwcGluZyh7XG4gICAgICBzb3VyY2U6IHNvdXJjZUZpbGUsXG4gICAgICBnZW5lcmF0ZWQ6IHtcbiAgICAgICAgbGluZTogdGhpcy5wb3NpdGlvbi5saW5lLFxuICAgICAgICBjb2x1bW46IE1hdGgubWF4KHRoaXMucG9zaXRpb24uY29sdW1uIC0gMSwgMClcbiAgICAgIH0sXG4gICAgICBvcmlnaW5hbDoge1xuICAgICAgICBsaW5lOiBwb3Muc3RhcnQubGluZSxcbiAgICAgICAgY29sdW1uOiBwb3Muc3RhcnQuY29sdW1uIC0gMVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRGaWxlKHNvdXJjZUZpbGUsIHBvcyk7XG4gIH1cblxuICB0aGlzLnVwZGF0ZVBvc2l0aW9uKHN0cik7XG5cbiAgcmV0dXJuIHN0cjtcbn07XG5cbi8qKlxuICogQWRkcyBhIGZpbGUgdG8gdGhlIHNvdXJjZSBtYXAgb3V0cHV0IGlmIGl0IGhhcyBub3QgYWxyZWFkeSBiZWVuIGFkZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gZmlsZVxuICogQHBhcmFtIHtPYmplY3R9IHBvc1xuICovXG5cbmV4cG9ydHMuYWRkRmlsZSA9IGZ1bmN0aW9uKGZpbGUsIHBvcykge1xuICBpZiAodHlwZW9mIHBvcy5jb250ZW50ICE9PSAnc3RyaW5nJykgcmV0dXJuO1xuICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMuZmlsZXMsIGZpbGUpKSByZXR1cm47XG5cbiAgdGhpcy5maWxlc1tmaWxlXSA9IHBvcy5jb250ZW50O1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIGFueSBvcmlnaW5hbCBzb3VyY2UgbWFwcyB0byB0aGUgb3V0cHV0IGFuZCBlbWJlZHMgdGhlIHNvdXJjZSBmaWxlXG4gKiBjb250ZW50cyBpbiB0aGUgc291cmNlIG1hcC5cbiAqL1xuXG5leHBvcnRzLmFwcGx5U291cmNlTWFwcyA9IGZ1bmN0aW9uKCkge1xuICBPYmplY3Qua2V5cyh0aGlzLmZpbGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGZpbGUpIHtcbiAgICB2YXIgY29udGVudCA9IHRoaXMuZmlsZXNbZmlsZV07XG4gICAgdGhpcy5tYXAuc2V0U291cmNlQ29udGVudChmaWxlLCBjb250ZW50KTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuaW5wdXRTb3VyY2VtYXBzICE9PSBmYWxzZSkge1xuICAgICAgdmFyIG9yaWdpbmFsTWFwID0gc291cmNlTWFwUmVzb2x2ZS5yZXNvbHZlU3luYyhcbiAgICAgICAgY29udGVudCwgZmlsZSwgZnMucmVhZEZpbGVTeW5jKTtcbiAgICAgIGlmIChvcmlnaW5hbE1hcCkge1xuICAgICAgICB2YXIgbWFwID0gbmV3IFNvdXJjZU1hcENvbnN1bWVyKG9yaWdpbmFsTWFwLm1hcCk7XG4gICAgICAgIHZhciByZWxhdGl2ZVRvID0gb3JpZ2luYWxNYXAuc291cmNlc1JlbGF0aXZlVG87XG4gICAgICAgIHRoaXMubWFwLmFwcGx5U291cmNlTWFwKG1hcCwgZmlsZSwgdXJpeChwYXRoLmRpcm5hbWUocmVsYXRpdmVUbykpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHRoaXMpO1xufTtcblxuLyoqXG4gKiBQcm9jZXNzIGNvbW1lbnRzLCBkcm9wcyBzb3VyY2VNYXAgY29tbWVudHMuXG4gKiBAcGFyYW0ge09iamVjdH0gbm9kZVxuICovXG5cbmV4cG9ydHMuY29tbWVudCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgaWYgKC9eIyBzb3VyY2VNYXBwaW5nVVJMPS8udGVzdChub2RlLmNvbW1lbnQpKVxuICAgIHJldHVybiB0aGlzLmVtaXQoJycsIG5vZGUucG9zaXRpb24pO1xuICBlbHNlXG4gICAgcmV0dXJuIHRoaXMuX2NvbW1lbnQobm9kZSk7XG59O1xuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvLyBDb3B5cmlnaHQgMjAxNCBTaW1vbiBMeWRlbGxcclxuLy8gWDExICjigJxNSVTigJ0pIExpY2Vuc2VkLiAoU2VlIExJQ0VOU0UuKVxyXG5cclxudm9pZCAoZnVuY3Rpb24ocm9vdCwgZmFjdG9yeSkge1xyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xyXG4gICAgZGVmaW5lKGZhY3RvcnkpXHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikge1xyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KClcclxuICB9IGVsc2Uge1xyXG4gICAgcm9vdC5yZXNvbHZlVXJsID0gZmFjdG9yeSgpXHJcbiAgfVxyXG59KHRoaXMsIGZ1bmN0aW9uKCkge1xyXG5cclxuICBmdW5jdGlvbiByZXNvbHZlVXJsKC8qIC4uLnVybHMgKi8pIHtcclxuICAgIHZhciBudW1VcmxzID0gYXJndW1lbnRzLmxlbmd0aFxyXG5cclxuICAgIGlmIChudW1VcmxzID09PSAwKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInJlc29sdmVVcmwgcmVxdWlyZXMgYXQgbGVhc3Qgb25lIGFyZ3VtZW50OyBnb3Qgbm9uZS5cIilcclxuICAgIH1cclxuXHJcbiAgICB2YXIgYmFzZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiYXNlXCIpXHJcbiAgICBiYXNlLmhyZWYgPSBhcmd1bWVudHNbMF1cclxuXHJcbiAgICBpZiAobnVtVXJscyA9PT0gMSkge1xyXG4gICAgICByZXR1cm4gYmFzZS5ocmVmXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF1cclxuICAgIGhlYWQuaW5zZXJ0QmVmb3JlKGJhc2UsIGhlYWQuZmlyc3RDaGlsZClcclxuXHJcbiAgICB2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpXHJcbiAgICB2YXIgcmVzb2x2ZWRcclxuXHJcbiAgICBmb3IgKHZhciBpbmRleCA9IDE7IGluZGV4IDwgbnVtVXJsczsgaW5kZXgrKykge1xyXG4gICAgICBhLmhyZWYgPSBhcmd1bWVudHNbaW5kZXhdXHJcbiAgICAgIHJlc29sdmVkID0gYS5ocmVmXHJcbiAgICAgIGJhc2UuaHJlZiA9IHJlc29sdmVkXHJcbiAgICB9XHJcblxyXG4gICAgaGVhZC5yZW1vdmVDaGlsZChiYXNlKVxyXG5cclxuICAgIHJldHVybiByZXNvbHZlZFxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJlc29sdmVVcmxcclxuXHJcbn0pKTtcclxuIiwiLy8gQ29weXJpZ2h0IDIwMTQgU2ltb24gTHlkZWxsXG4vLyBYMTEgKOKAnE1JVOKAnSkgTGljZW5zZWQuIChTZWUgTElDRU5TRS4pXG5cbnZvaWQgKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZhY3RvcnkpXG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKVxuICB9IGVsc2Uge1xuICAgIHJvb3Quc291cmNlTWFwcGluZ1VSTCA9IGZhY3RvcnkoKVxuICB9XG59KHRoaXMsIGZ1bmN0aW9uKCkge1xuXG4gIHZhciBpbm5lclJlZ2V4ID0gL1sjQF0gc291cmNlTWFwcGluZ1VSTD0oW15cXHMnXCJdKikvXG5cbiAgdmFyIHJlZ2V4ID0gUmVnRXhwKFxuICAgIFwiKD86XCIgK1xuICAgICAgXCIvXFxcXCpcIiArXG4gICAgICBcIig/OlxcXFxzKlxccj9cXG4oPzovLyk/KT9cIiArXG4gICAgICBcIig/OlwiICsgaW5uZXJSZWdleC5zb3VyY2UgKyBcIilcIiArXG4gICAgICBcIlxcXFxzKlwiICtcbiAgICAgIFwiXFxcXCovXCIgK1xuICAgICAgXCJ8XCIgK1xuICAgICAgXCIvLyg/OlwiICsgaW5uZXJSZWdleC5zb3VyY2UgKyBcIilcIiArXG4gICAgXCIpXCIgK1xuICAgIFwiXFxcXHMqJFwiXG4gIClcblxuICByZXR1cm4ge1xuXG4gICAgcmVnZXg6IHJlZ2V4LFxuICAgIF9pbm5lclJlZ2V4OiBpbm5lclJlZ2V4LFxuXG4gICAgZ2V0RnJvbTogZnVuY3Rpb24oY29kZSkge1xuICAgICAgdmFyIG1hdGNoID0gY29kZS5tYXRjaChyZWdleClcbiAgICAgIHJldHVybiAobWF0Y2ggPyBtYXRjaFsxXSB8fCBtYXRjaFsyXSB8fCBcIlwiIDogbnVsbClcbiAgICB9LFxuXG4gICAgZXhpc3RzSW46IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICAgIHJldHVybiByZWdleC50ZXN0KGNvZGUpXG4gICAgfSxcblxuICAgIHJlbW92ZUZyb206IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICAgIHJldHVybiBjb2RlLnJlcGxhY2UocmVnZXgsIFwiXCIpXG4gICAgfSxcblxuICAgIGluc2VydEJlZm9yZTogZnVuY3Rpb24oY29kZSwgc3RyaW5nKSB7XG4gICAgICB2YXIgbWF0Y2ggPSBjb2RlLm1hdGNoKHJlZ2V4KVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIHJldHVybiBjb2RlLnNsaWNlKDAsIG1hdGNoLmluZGV4KSArIHN0cmluZyArIGNvZGUuc2xpY2UobWF0Y2guaW5kZXgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY29kZSArIHN0cmluZ1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG59KSk7XG4iLCIvLyBDb3B5cmlnaHQgMjAxNCBTaW1vbiBMeWRlbGxcbi8vIFgxMSAo4oCcTUlU4oCdKSBMaWNlbnNlZC4gKFNlZSBMSUNFTlNFLilcblxuLy8gTm90ZTogc291cmNlLW1hcC1yZXNvbHZlLmpzIGlzIGdlbmVyYXRlZCBmcm9tIHNvdXJjZS1tYXAtcmVzb2x2ZS1ub2RlLmpzIGFuZFxuLy8gc291cmNlLW1hcC1yZXNvbHZlLXRlbXBsYXRlLmpzLiBPbmx5IGVkaXQgdGhlIHR3byBsYXR0ZXIgZmlsZXMsIF9ub3RfXG4vLyBzb3VyY2UtbWFwLXJlc29sdmUuanMhXG5cbnZvaWQgKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFtcInNvdXJjZS1tYXAtdXJsXCIsIFwicmVzb2x2ZS11cmxcIl0sIGZhY3RvcnkpXG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcbiAgICB2YXIgc291cmNlTWFwcGluZ1VSTCA9IHJlcXVpcmUoXCJzb3VyY2UtbWFwLXVybFwiKVxuICAgIHZhciByZXNvbHZlVXJsID0gcmVxdWlyZShcInJlc29sdmUtdXJsXCIpXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHNvdXJjZU1hcHBpbmdVUkwsIHJlc29sdmVVcmwpXG4gIH0gZWxzZSB7XG4gICAgcm9vdC5zb3VyY2VNYXBSZXNvbHZlID0gZmFjdG9yeShyb290LnNvdXJjZU1hcHBpbmdVUkwsIHJvb3QucmVzb2x2ZVVybClcbiAgfVxufSh0aGlzLCBmdW5jdGlvbihzb3VyY2VNYXBwaW5nVVJMLCByZXNvbHZlVXJsKSB7XG5cbiAgZnVuY3Rpb24gY2FsbGJhY2tBc3luYyhjYWxsYmFjaywgZXJyb3IsIHJlc3VsdCkge1xuICAgIHNldEltbWVkaWF0ZShmdW5jdGlvbigpIHsgY2FsbGJhY2soZXJyb3IsIHJlc3VsdCkgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlTWFwVG9KU09OKHN0cmluZykge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHN0cmluZy5yZXBsYWNlKC9eXFwpXFxdXFx9Jy8sIFwiXCIpKVxuICB9XG5cblxuXG4gIGZ1bmN0aW9uIHJlc29sdmVTb3VyY2VNYXAoY29kZSwgY29kZVVybCwgcmVhZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgbWFwRGF0YVxuICAgIHRyeSB7XG4gICAgICBtYXBEYXRhID0gcmVzb2x2ZVNvdXJjZU1hcEhlbHBlcihjb2RlLCBjb2RlVXJsKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2tBc3luYyhjYWxsYmFjaywgZXJyb3IpXG4gICAgfVxuICAgIGlmICghbWFwRGF0YSB8fCBtYXBEYXRhLm1hcCkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrQXN5bmMoY2FsbGJhY2ssIG51bGwsIG1hcERhdGEpXG4gICAgfVxuICAgIHJlYWQobWFwRGF0YS51cmwsIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpXG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBtYXBEYXRhLm1hcCA9IHBhcnNlTWFwVG9KU09OKFN0cmluZyhyZXN1bHQpKVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycm9yKVxuICAgICAgfVxuICAgICAgY2FsbGJhY2sobnVsbCwgbWFwRGF0YSlcbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZU1hcFN5bmMoY29kZSwgY29kZVVybCwgcmVhZCkge1xuICAgIHZhciBtYXBEYXRhID0gcmVzb2x2ZVNvdXJjZU1hcEhlbHBlcihjb2RlLCBjb2RlVXJsKVxuICAgIGlmICghbWFwRGF0YSB8fCBtYXBEYXRhLm1hcCkge1xuICAgICAgcmV0dXJuIG1hcERhdGFcbiAgICB9XG4gICAgbWFwRGF0YS5tYXAgPSBwYXJzZU1hcFRvSlNPTihTdHJpbmcocmVhZChtYXBEYXRhLnVybCkpKVxuICAgIHJldHVybiBtYXBEYXRhXG4gIH1cblxuICB2YXIgZGF0YVVyaVJlZ2V4ID0gL15kYXRhOihbXiw7XSopKDtbXiw7XSopKig/OiwoLiopKT8kL1xuICB2YXIganNvbk1pbWVUeXBlUmVnZXggPSAvXig/OmFwcGxpY2F0aW9ufHRleHQpXFwvanNvbiQvXG5cbiAgZnVuY3Rpb24gcmVzb2x2ZVNvdXJjZU1hcEhlbHBlcihjb2RlLCBjb2RlVXJsKSB7XG4gICAgdmFyIHVybCA9IHNvdXJjZU1hcHBpbmdVUkwuZ2V0RnJvbShjb2RlKVxuICAgIGlmICghdXJsKSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkYXRhVXJpID0gdXJsLm1hdGNoKGRhdGFVcmlSZWdleClcbiAgICBpZiAoZGF0YVVyaSkge1xuICAgICAgdmFyIG1pbWVUeXBlID0gZGF0YVVyaVsxXVxuICAgICAgdmFyIGxhc3RQYXJhbWV0ZXIgPSBkYXRhVXJpWzJdXG4gICAgICB2YXIgZW5jb2RlZCA9IGRhdGFVcmlbM11cbiAgICAgIGlmICghanNvbk1pbWVUeXBlUmVnZXgudGVzdChtaW1lVHlwZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW51c2VmdWwgZGF0YSB1cmkgbWltZSB0eXBlOiBcIiArIChtaW1lVHlwZSB8fCBcInRleHQvcGxhaW5cIikpXG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2VNYXBwaW5nVVJMOiB1cmwsXG4gICAgICAgIHVybDogbnVsbCxcbiAgICAgICAgc291cmNlc1JlbGF0aXZlVG86IGNvZGVVcmwsXG4gICAgICAgIG1hcDogcGFyc2VNYXBUb0pTT04obGFzdFBhcmFtZXRlciA9PT0gXCI7YmFzZTY0XCIgPyBhdG9iKGVuY29kZWQpIDogZGVjb2RlVVJJQ29tcG9uZW50KGVuY29kZWQpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBtYXBVcmwgPSByZXNvbHZlVXJsKGNvZGVVcmwsIHVybClcbiAgICByZXR1cm4ge1xuICAgICAgc291cmNlTWFwcGluZ1VSTDogdXJsLFxuICAgICAgdXJsOiBtYXBVcmwsXG4gICAgICBzb3VyY2VzUmVsYXRpdmVUbzogbWFwVXJsLFxuICAgICAgbWFwOiBudWxsXG4gICAgfVxuICB9XG5cblxuXG4gIGZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzKG1hcCwgbWFwVXJsLCByZWFkLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnNcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgIH1cbiAgICB2YXIgcGVuZGluZyA9IG1hcC5zb3VyY2VzLmxlbmd0aFxuICAgIHZhciBlcnJvcmVkID0gZmFsc2VcbiAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgc291cmNlc1Jlc29sdmVkOiBbXSxcbiAgICAgIHNvdXJjZXNDb250ZW50OiAgW11cbiAgICB9XG5cbiAgICB2YXIgZG9uZSA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3JlZCkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBlcnJvcmVkID0gdHJ1ZVxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpXG4gICAgICB9XG4gICAgICBwZW5kaW5nLS1cbiAgICAgIGlmIChwZW5kaW5nID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdClcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXNvbHZlU291cmNlc0hlbHBlcihtYXAsIG1hcFVybCwgb3B0aW9ucywgZnVuY3Rpb24oZnVsbFVybCwgc291cmNlQ29udGVudCwgaW5kZXgpIHtcbiAgICAgIHJlc3VsdC5zb3VyY2VzUmVzb2x2ZWRbaW5kZXhdID0gZnVsbFVybFxuICAgICAgaWYgKHR5cGVvZiBzb3VyY2VDb250ZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJlc3VsdC5zb3VyY2VzQ29udGVudFtpbmRleF0gPSBzb3VyY2VDb250ZW50XG4gICAgICAgIGNhbGxiYWNrQXN5bmMoZG9uZSwgbnVsbClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYWQoZnVsbFVybCwgZnVuY3Rpb24oZXJyb3IsIHNvdXJjZSkge1xuICAgICAgICAgIHJlc3VsdC5zb3VyY2VzQ29udGVudFtpbmRleF0gPSBTdHJpbmcoc291cmNlKVxuICAgICAgICAgIGRvbmUoZXJyb3IpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVTb3VyY2VzU3luYyhtYXAsIG1hcFVybCwgcmVhZCwgb3B0aW9ucykge1xuICAgIHZhciByZXN1bHQgPSB7XG4gICAgICBzb3VyY2VzUmVzb2x2ZWQ6IFtdLFxuICAgICAgc291cmNlc0NvbnRlbnQ6ICBbXVxuICAgIH1cbiAgICByZXNvbHZlU291cmNlc0hlbHBlcihtYXAsIG1hcFVybCwgb3B0aW9ucywgZnVuY3Rpb24oZnVsbFVybCwgc291cmNlQ29udGVudCwgaW5kZXgpIHtcbiAgICAgIHJlc3VsdC5zb3VyY2VzUmVzb2x2ZWRbaW5kZXhdID0gZnVsbFVybFxuICAgICAgaWYgKHJlYWQgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzb3VyY2VDb250ZW50ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgcmVzdWx0LnNvdXJjZXNDb250ZW50W2luZGV4XSA9IHNvdXJjZUNvbnRlbnRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQuc291cmNlc0NvbnRlbnRbaW5kZXhdID0gU3RyaW5nKHJlYWQoZnVsbFVybCkpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gIHZhciBlbmRpbmdTbGFzaCA9IC9cXC8/JC9cblxuICBmdW5jdGlvbiByZXNvbHZlU291cmNlc0hlbHBlcihtYXAsIG1hcFVybCwgb3B0aW9ucywgZm4pIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHZhciBmdWxsVXJsXG4gICAgdmFyIHNvdXJjZUNvbnRlbnRcbiAgICBmb3IgKHZhciBpbmRleCA9IDAsIGxlbiA9IG1hcC5zb3VyY2VzLmxlbmd0aDsgaW5kZXggPCBsZW47IGluZGV4KyspIHtcbiAgICAgIGlmIChtYXAuc291cmNlUm9vdCAmJiAhb3B0aW9ucy5pZ25vcmVTb3VyY2VSb290KSB7XG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBzb3VyY2VSb290IGVuZHMgd2l0aCBhIHNsYXNoLCBzbyB0aGF0IGAvc2NyaXB0cy9zdWJkaXJgIGJlY29tZXNcbiAgICAgICAgLy8gYC9zY3JpcHRzL3N1YmRpci88c291cmNlPmAsIG5vdCBgL3NjcmlwdHMvPHNvdXJjZT5gLiBQb2ludGluZyB0byBhIGZpbGUgYXMgc291cmNlIHJvb3RcbiAgICAgICAgLy8gZG9lcyBub3QgbWFrZSBzZW5zZS5cbiAgICAgICAgZnVsbFVybCA9IHJlc29sdmVVcmwobWFwVXJsLCBtYXAuc291cmNlUm9vdC5yZXBsYWNlKGVuZGluZ1NsYXNoLCBcIi9cIiksIG1hcC5zb3VyY2VzW2luZGV4XSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bGxVcmwgPSByZXNvbHZlVXJsKG1hcFVybCwgbWFwLnNvdXJjZXNbaW5kZXhdKVxuICAgICAgfVxuICAgICAgc291cmNlQ29udGVudCA9IChtYXAuc291cmNlc0NvbnRlbnQgfHwgW10pW2luZGV4XVxuICAgICAgZm4oZnVsbFVybCwgc291cmNlQ29udGVudCwgaW5kZXgpXG4gICAgfVxuICB9XG5cblxuXG4gIGZ1bmN0aW9uIHJlc29sdmUoY29kZSwgY29kZVVybCwgcmVhZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gICAgICBvcHRpb25zID0ge31cbiAgICB9XG4gICAgcmVzb2x2ZVNvdXJjZU1hcChjb2RlLCBjb2RlVXJsLCByZWFkLCBmdW5jdGlvbihlcnJvciwgbWFwRGF0YSkge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcilcbiAgICAgIH1cbiAgICAgIGlmICghbWFwRGF0YSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgbnVsbClcbiAgICAgIH1cbiAgICAgIHJlc29sdmVTb3VyY2VzKG1hcERhdGEubWFwLCBtYXBEYXRhLnNvdXJjZXNSZWxhdGl2ZVRvLCByZWFkLCBvcHRpb25zLCBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcilcbiAgICAgICAgfVxuICAgICAgICBtYXBEYXRhLnNvdXJjZXNSZXNvbHZlZCA9IHJlc3VsdC5zb3VyY2VzUmVzb2x2ZWRcbiAgICAgICAgbWFwRGF0YS5zb3VyY2VzQ29udGVudCAgPSByZXN1bHQuc291cmNlc0NvbnRlbnRcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbWFwRGF0YSlcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVTeW5jKGNvZGUsIGNvZGVVcmwsIHJlYWQsIG9wdGlvbnMpIHtcbiAgICB2YXIgbWFwRGF0YSA9IHJlc29sdmVTb3VyY2VNYXBTeW5jKGNvZGUsIGNvZGVVcmwsIHJlYWQpXG4gICAgaWYgKCFtYXBEYXRhKSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gcmVzb2x2ZVNvdXJjZXNTeW5jKG1hcERhdGEubWFwLCBtYXBEYXRhLnNvdXJjZXNSZWxhdGl2ZVRvLCByZWFkLCBvcHRpb25zKVxuICAgIG1hcERhdGEuc291cmNlc1Jlc29sdmVkID0gcmVzdWx0LnNvdXJjZXNSZXNvbHZlZFxuICAgIG1hcERhdGEuc291cmNlc0NvbnRlbnQgID0gcmVzdWx0LnNvdXJjZXNDb250ZW50XG4gICAgcmV0dXJuIG1hcERhdGFcbiAgfVxuXG5cblxuICByZXR1cm4ge1xuICAgIHJlc29sdmVTb3VyY2VNYXA6ICAgICByZXNvbHZlU291cmNlTWFwLFxuICAgIHJlc29sdmVTb3VyY2VNYXBTeW5jOiByZXNvbHZlU291cmNlTWFwU3luYyxcbiAgICByZXNvbHZlU291cmNlczogICAgICAgcmVzb2x2ZVNvdXJjZXMsXG4gICAgcmVzb2x2ZVNvdXJjZXNTeW5jOiAgIHJlc29sdmVTb3VyY2VzU3luYyxcbiAgICByZXNvbHZlOiAgICAgICAgICAgICAgcmVzb2x2ZSxcbiAgICByZXNvbHZlU3luYzogICAgICAgICAgcmVzb2x2ZVN5bmNcbiAgfVxuXG59KSk7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0UudHh0IG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5leHBvcnRzLlNvdXJjZU1hcEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vc291cmNlLW1hcC9zb3VyY2UtbWFwLWdlbmVyYXRvcicpLlNvdXJjZU1hcEdlbmVyYXRvcjtcbmV4cG9ydHMuU291cmNlTWFwQ29uc3VtZXIgPSByZXF1aXJlKCcuL3NvdXJjZS1tYXAvc291cmNlLW1hcC1jb25zdW1lcicpLlNvdXJjZU1hcENvbnN1bWVyO1xuZXhwb3J0cy5Tb3VyY2VOb2RlID0gcmVxdWlyZSgnLi9zb3VyY2UtbWFwL3NvdXJjZS1ub2RlJykuU291cmNlTm9kZTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICAvKipcbiAgICogQSBkYXRhIHN0cnVjdHVyZSB3aGljaCBpcyBhIGNvbWJpbmF0aW9uIG9mIGFuIGFycmF5IGFuZCBhIHNldC4gQWRkaW5nIGEgbmV3XG4gICAqIG1lbWJlciBpcyBPKDEpLCB0ZXN0aW5nIGZvciBtZW1iZXJzaGlwIGlzIE8oMSksIGFuZCBmaW5kaW5nIHRoZSBpbmRleCBvZiBhblxuICAgKiBlbGVtZW50IGlzIE8oMSkuIFJlbW92aW5nIGVsZW1lbnRzIGZyb20gdGhlIHNldCBpcyBub3Qgc3VwcG9ydGVkLiBPbmx5XG4gICAqIHN0cmluZ3MgYXJlIHN1cHBvcnRlZCBmb3IgbWVtYmVyc2hpcC5cbiAgICovXG4gIGZ1bmN0aW9uIEFycmF5U2V0KCkge1xuICAgIHRoaXMuX2FycmF5ID0gW107XG4gICAgdGhpcy5fc2V0ID0ge307XG4gIH1cblxuICAvKipcbiAgICogU3RhdGljIG1ldGhvZCBmb3IgY3JlYXRpbmcgQXJyYXlTZXQgaW5zdGFuY2VzIGZyb20gYW4gZXhpc3RpbmcgYXJyYXkuXG4gICAqL1xuICBBcnJheVNldC5mcm9tQXJyYXkgPSBmdW5jdGlvbiBBcnJheVNldF9mcm9tQXJyYXkoYUFycmF5LCBhQWxsb3dEdXBsaWNhdGVzKSB7XG4gICAgdmFyIHNldCA9IG5ldyBBcnJheVNldCgpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhQXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHNldC5hZGQoYUFycmF5W2ldLCBhQWxsb3dEdXBsaWNhdGVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHNldDtcbiAgfTtcblxuICAvKipcbiAgICogQWRkIHRoZSBnaXZlbiBzdHJpbmcgdG8gdGhpcyBzZXQuXG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIEFycmF5U2V0X2FkZChhU3RyLCBhQWxsb3dEdXBsaWNhdGVzKSB7XG4gICAgdmFyIGlzRHVwbGljYXRlID0gdGhpcy5oYXMoYVN0cik7XG4gICAgdmFyIGlkeCA9IHRoaXMuX2FycmF5Lmxlbmd0aDtcbiAgICBpZiAoIWlzRHVwbGljYXRlIHx8IGFBbGxvd0R1cGxpY2F0ZXMpIHtcbiAgICAgIHRoaXMuX2FycmF5LnB1c2goYVN0cik7XG4gICAgfVxuICAgIGlmICghaXNEdXBsaWNhdGUpIHtcbiAgICAgIHRoaXMuX3NldFt1dGlsLnRvU2V0U3RyaW5nKGFTdHIpXSA9IGlkeDtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIElzIHRoZSBnaXZlbiBzdHJpbmcgYSBtZW1iZXIgb2YgdGhpcyBzZXQ/XG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uIEFycmF5U2V0X2hhcyhhU3RyKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLl9zZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLnRvU2V0U3RyaW5nKGFTdHIpKTtcbiAgfTtcblxuICAvKipcbiAgICogV2hhdCBpcyB0aGUgaW5kZXggb2YgdGhlIGdpdmVuIHN0cmluZyBpbiB0aGUgYXJyYXk/XG4gICAqXG4gICAqIEBwYXJhbSBTdHJpbmcgYVN0clxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBBcnJheVNldF9pbmRleE9mKGFTdHIpIHtcbiAgICBpZiAodGhpcy5oYXMoYVN0cikpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zZXRbdXRpbC50b1NldFN0cmluZyhhU3RyKV07XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcignXCInICsgYVN0ciArICdcIiBpcyBub3QgaW4gdGhlIHNldC4nKTtcbiAgfTtcblxuICAvKipcbiAgICogV2hhdCBpcyB0aGUgZWxlbWVudCBhdCB0aGUgZ2l2ZW4gaW5kZXg/XG4gICAqXG4gICAqIEBwYXJhbSBOdW1iZXIgYUlkeFxuICAgKi9cbiAgQXJyYXlTZXQucHJvdG90eXBlLmF0ID0gZnVuY3Rpb24gQXJyYXlTZXRfYXQoYUlkeCkge1xuICAgIGlmIChhSWR4ID49IDAgJiYgYUlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2FycmF5W2FJZHhdO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnQgaW5kZXhlZCBieSAnICsgYUlkeCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFycmF5IHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc2V0ICh3aGljaCBoYXMgdGhlIHByb3BlciBpbmRpY2VzXG4gICAqIGluZGljYXRlZCBieSBpbmRleE9mKS4gTm90ZSB0aGF0IHRoaXMgaXMgYSBjb3B5IG9mIHRoZSBpbnRlcm5hbCBhcnJheSB1c2VkXG4gICAqIGZvciBzdG9yaW5nIHRoZSBtZW1iZXJzIHNvIHRoYXQgbm8gb25lIGNhbiBtZXNzIHdpdGggaW50ZXJuYWwgc3RhdGUuXG4gICAqL1xuICBBcnJheVNldC5wcm90b3R5cGUudG9BcnJheSA9IGZ1bmN0aW9uIEFycmF5U2V0X3RvQXJyYXkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FycmF5LnNsaWNlKCk7XG4gIH07XG5cbiAgZXhwb3J0cy5BcnJheVNldCA9IEFycmF5U2V0O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKlxuICogQmFzZWQgb24gdGhlIEJhc2UgNjQgVkxRIGltcGxlbWVudGF0aW9uIGluIENsb3N1cmUgQ29tcGlsZXI6XG4gKiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nsb3N1cmUtY29tcGlsZXIvc291cmNlL2Jyb3dzZS90cnVuay9zcmMvY29tL2dvb2dsZS9kZWJ1Z2dpbmcvc291cmNlbWFwL0Jhc2U2NFZMUS5qYXZhXG4gKlxuICogQ29weXJpZ2h0IDIwMTEgVGhlIENsb3N1cmUgQ29tcGlsZXIgQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKiAgKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKiAgKiBOZWl0aGVyIHRoZSBuYW1lIG9mIEdvb2dsZSBJbmMuIG5vciB0aGUgbmFtZXMgb2YgaXRzXG4gKiAgICBjb250cmlidXRvcnMgbWF5IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzIGRlcml2ZWRcbiAqICAgIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTXG4gKiBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UXG4gKiBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1JcbiAqIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUXG4gKiBPV05FUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCxcbiAqIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiAqIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLFxuICogREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZXG4gKiBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4gKiAoSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0VcbiAqIE9GIFRISVMgU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIGJhc2U2NCA9IHJlcXVpcmUoJy4vYmFzZTY0Jyk7XG5cbiAgLy8gQSBzaW5nbGUgYmFzZSA2NCBkaWdpdCBjYW4gY29udGFpbiA2IGJpdHMgb2YgZGF0YS4gRm9yIHRoZSBiYXNlIDY0IHZhcmlhYmxlXG4gIC8vIGxlbmd0aCBxdWFudGl0aWVzIHdlIHVzZSBpbiB0aGUgc291cmNlIG1hcCBzcGVjLCB0aGUgZmlyc3QgYml0IGlzIHRoZSBzaWduLFxuICAvLyB0aGUgbmV4dCBmb3VyIGJpdHMgYXJlIHRoZSBhY3R1YWwgdmFsdWUsIGFuZCB0aGUgNnRoIGJpdCBpcyB0aGVcbiAgLy8gY29udGludWF0aW9uIGJpdC4gVGhlIGNvbnRpbnVhdGlvbiBiaXQgdGVsbHMgdXMgd2hldGhlciB0aGVyZSBhcmUgbW9yZVxuICAvLyBkaWdpdHMgaW4gdGhpcyB2YWx1ZSBmb2xsb3dpbmcgdGhpcyBkaWdpdC5cbiAgLy9cbiAgLy8gICBDb250aW51YXRpb25cbiAgLy8gICB8ICAgIFNpZ25cbiAgLy8gICB8ICAgIHxcbiAgLy8gICBWICAgIFZcbiAgLy8gICAxMDEwMTFcblxuICB2YXIgVkxRX0JBU0VfU0hJRlQgPSA1O1xuXG4gIC8vIGJpbmFyeTogMTAwMDAwXG4gIHZhciBWTFFfQkFTRSA9IDEgPDwgVkxRX0JBU0VfU0hJRlQ7XG5cbiAgLy8gYmluYXJ5OiAwMTExMTFcbiAgdmFyIFZMUV9CQVNFX01BU0sgPSBWTFFfQkFTRSAtIDE7XG5cbiAgLy8gYmluYXJ5OiAxMDAwMDBcbiAgdmFyIFZMUV9DT05USU5VQVRJT05fQklUID0gVkxRX0JBU0U7XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGZyb20gYSB0d28tY29tcGxlbWVudCB2YWx1ZSB0byBhIHZhbHVlIHdoZXJlIHRoZSBzaWduIGJpdCBpc1xuICAgKiBwbGFjZWQgaW4gdGhlIGxlYXN0IHNpZ25pZmljYW50IGJpdC4gIEZvciBleGFtcGxlLCBhcyBkZWNpbWFsczpcbiAgICogICAxIGJlY29tZXMgMiAoMTAgYmluYXJ5KSwgLTEgYmVjb21lcyAzICgxMSBiaW5hcnkpXG4gICAqICAgMiBiZWNvbWVzIDQgKDEwMCBiaW5hcnkpLCAtMiBiZWNvbWVzIDUgKDEwMSBiaW5hcnkpXG4gICAqL1xuICBmdW5jdGlvbiB0b1ZMUVNpZ25lZChhVmFsdWUpIHtcbiAgICByZXR1cm4gYVZhbHVlIDwgMFxuICAgICAgPyAoKC1hVmFsdWUpIDw8IDEpICsgMVxuICAgICAgOiAoYVZhbHVlIDw8IDEpICsgMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0byBhIHR3by1jb21wbGVtZW50IHZhbHVlIGZyb20gYSB2YWx1ZSB3aGVyZSB0aGUgc2lnbiBiaXQgaXNcbiAgICogcGxhY2VkIGluIHRoZSBsZWFzdCBzaWduaWZpY2FudCBiaXQuICBGb3IgZXhhbXBsZSwgYXMgZGVjaW1hbHM6XG4gICAqICAgMiAoMTAgYmluYXJ5KSBiZWNvbWVzIDEsIDMgKDExIGJpbmFyeSkgYmVjb21lcyAtMVxuICAgKiAgIDQgKDEwMCBiaW5hcnkpIGJlY29tZXMgMiwgNSAoMTAxIGJpbmFyeSkgYmVjb21lcyAtMlxuICAgKi9cbiAgZnVuY3Rpb24gZnJvbVZMUVNpZ25lZChhVmFsdWUpIHtcbiAgICB2YXIgaXNOZWdhdGl2ZSA9IChhVmFsdWUgJiAxKSA9PT0gMTtcbiAgICB2YXIgc2hpZnRlZCA9IGFWYWx1ZSA+PiAxO1xuICAgIHJldHVybiBpc05lZ2F0aXZlXG4gICAgICA/IC1zaGlmdGVkXG4gICAgICA6IHNoaWZ0ZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYmFzZSA2NCBWTFEgZW5jb2RlZCB2YWx1ZS5cbiAgICovXG4gIGV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gYmFzZTY0VkxRX2VuY29kZShhVmFsdWUpIHtcbiAgICB2YXIgZW5jb2RlZCA9IFwiXCI7XG4gICAgdmFyIGRpZ2l0O1xuXG4gICAgdmFyIHZscSA9IHRvVkxRU2lnbmVkKGFWYWx1ZSk7XG5cbiAgICBkbyB7XG4gICAgICBkaWdpdCA9IHZscSAmIFZMUV9CQVNFX01BU0s7XG4gICAgICB2bHEgPj4+PSBWTFFfQkFTRV9TSElGVDtcbiAgICAgIGlmICh2bHEgPiAwKSB7XG4gICAgICAgIC8vIFRoZXJlIGFyZSBzdGlsbCBtb3JlIGRpZ2l0cyBpbiB0aGlzIHZhbHVlLCBzbyB3ZSBtdXN0IG1ha2Ugc3VyZSB0aGVcbiAgICAgICAgLy8gY29udGludWF0aW9uIGJpdCBpcyBtYXJrZWQuXG4gICAgICAgIGRpZ2l0IHw9IFZMUV9DT05USU5VQVRJT05fQklUO1xuICAgICAgfVxuICAgICAgZW5jb2RlZCArPSBiYXNlNjQuZW5jb2RlKGRpZ2l0KTtcbiAgICB9IHdoaWxlICh2bHEgPiAwKTtcblxuICAgIHJldHVybiBlbmNvZGVkO1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZWNvZGVzIHRoZSBuZXh0IGJhc2UgNjQgVkxRIHZhbHVlIGZyb20gdGhlIGdpdmVuIHN0cmluZyBhbmQgcmV0dXJucyB0aGVcbiAgICogdmFsdWUgYW5kIHRoZSByZXN0IG9mIHRoZSBzdHJpbmcgdmlhIHRoZSBvdXQgcGFyYW1ldGVyLlxuICAgKi9cbiAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiBiYXNlNjRWTFFfZGVjb2RlKGFTdHIsIGFPdXRQYXJhbSkge1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgc3RyTGVuID0gYVN0ci5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdCA9IDA7XG4gICAgdmFyIHNoaWZ0ID0gMDtcbiAgICB2YXIgY29udGludWF0aW9uLCBkaWdpdDtcblxuICAgIGRvIHtcbiAgICAgIGlmIChpID49IHN0ckxlbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBtb3JlIGRpZ2l0cyBpbiBiYXNlIDY0IFZMUSB2YWx1ZS5cIik7XG4gICAgICB9XG4gICAgICBkaWdpdCA9IGJhc2U2NC5kZWNvZGUoYVN0ci5jaGFyQXQoaSsrKSk7XG4gICAgICBjb250aW51YXRpb24gPSAhIShkaWdpdCAmIFZMUV9DT05USU5VQVRJT05fQklUKTtcbiAgICAgIGRpZ2l0ICY9IFZMUV9CQVNFX01BU0s7XG4gICAgICByZXN1bHQgPSByZXN1bHQgKyAoZGlnaXQgPDwgc2hpZnQpO1xuICAgICAgc2hpZnQgKz0gVkxRX0JBU0VfU0hJRlQ7XG4gICAgfSB3aGlsZSAoY29udGludWF0aW9uKTtcblxuICAgIGFPdXRQYXJhbS52YWx1ZSA9IGZyb21WTFFTaWduZWQocmVzdWx0KTtcbiAgICBhT3V0UGFyYW0ucmVzdCA9IGFTdHIuc2xpY2UoaSk7XG4gIH07XG5cbn0pO1xuIiwiLyogLSotIE1vZGU6IGpzOyBqcy1pbmRlbnQtbGV2ZWw6IDI7IC0qLSAqL1xuLypcbiAqIENvcHlyaWdodCAyMDExIE1vemlsbGEgRm91bmRhdGlvbiBhbmQgY29udHJpYnV0b3JzXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBsaWNlbnNlLiBTZWUgTElDRU5TRSBvcjpcbiAqIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9CU0QtMy1DbGF1c2VcbiAqL1xuaWYgKHR5cGVvZiBkZWZpbmUgIT09ICdmdW5jdGlvbicpIHtcbiAgICB2YXIgZGVmaW5lID0gcmVxdWlyZSgnYW1kZWZpbmUnKShtb2R1bGUsIHJlcXVpcmUpO1xufVxuZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcblxuICB2YXIgY2hhclRvSW50TWFwID0ge307XG4gIHZhciBpbnRUb0NoYXJNYXAgPSB7fTtcblxuICAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbiAgICAuc3BsaXQoJycpXG4gICAgLmZvckVhY2goZnVuY3Rpb24gKGNoLCBpbmRleCkge1xuICAgICAgY2hhclRvSW50TWFwW2NoXSA9IGluZGV4O1xuICAgICAgaW50VG9DaGFyTWFwW2luZGV4XSA9IGNoO1xuICAgIH0pO1xuXG4gIC8qKlxuICAgKiBFbmNvZGUgYW4gaW50ZWdlciBpbiB0aGUgcmFuZ2Ugb2YgMCB0byA2MyB0byBhIHNpbmdsZSBiYXNlIDY0IGRpZ2l0LlxuICAgKi9cbiAgZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiBiYXNlNjRfZW5jb2RlKGFOdW1iZXIpIHtcbiAgICBpZiAoYU51bWJlciBpbiBpbnRUb0NoYXJNYXApIHtcbiAgICAgIHJldHVybiBpbnRUb0NoYXJNYXBbYU51bWJlcl07XG4gICAgfVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNdXN0IGJlIGJldHdlZW4gMCBhbmQgNjM6IFwiICsgYU51bWJlcik7XG4gIH07XG5cbiAgLyoqXG4gICAqIERlY29kZSBhIHNpbmdsZSBiYXNlIDY0IGRpZ2l0IHRvIGFuIGludGVnZXIuXG4gICAqL1xuICBleHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIGJhc2U2NF9kZWNvZGUoYUNoYXIpIHtcbiAgICBpZiAoYUNoYXIgaW4gY2hhclRvSW50TWFwKSB7XG4gICAgICByZXR1cm4gY2hhclRvSW50TWFwW2FDaGFyXTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vdCBhIHZhbGlkIGJhc2UgNjQgZGlnaXQ6IFwiICsgYUNoYXIpO1xuICB9O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgLyoqXG4gICAqIFJlY3Vyc2l2ZSBpbXBsZW1lbnRhdGlvbiBvZiBiaW5hcnkgc2VhcmNoLlxuICAgKlxuICAgKiBAcGFyYW0gYUxvdyBJbmRpY2VzIGhlcmUgYW5kIGxvd2VyIGRvIG5vdCBjb250YWluIHRoZSBuZWVkbGUuXG4gICAqIEBwYXJhbSBhSGlnaCBJbmRpY2VzIGhlcmUgYW5kIGhpZ2hlciBkbyBub3QgY29udGFpbiB0aGUgbmVlZGxlLlxuICAgKiBAcGFyYW0gYU5lZWRsZSBUaGUgZWxlbWVudCBiZWluZyBzZWFyY2hlZCBmb3IuXG4gICAqIEBwYXJhbSBhSGF5c3RhY2sgVGhlIG5vbi1lbXB0eSBhcnJheSBiZWluZyBzZWFyY2hlZC5cbiAgICogQHBhcmFtIGFDb21wYXJlIEZ1bmN0aW9uIHdoaWNoIHRha2VzIHR3byBlbGVtZW50cyBhbmQgcmV0dXJucyAtMSwgMCwgb3IgMS5cbiAgICovXG4gIGZ1bmN0aW9uIHJlY3Vyc2l2ZVNlYXJjaChhTG93LCBhSGlnaCwgYU5lZWRsZSwgYUhheXN0YWNrLCBhQ29tcGFyZSkge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gdGVybWluYXRlcyB3aGVuIG9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIHRydWU6XG4gICAgLy9cbiAgICAvLyAgIDEuIFdlIGZpbmQgdGhlIGV4YWN0IGVsZW1lbnQgd2UgYXJlIGxvb2tpbmcgZm9yLlxuICAgIC8vXG4gICAgLy8gICAyLiBXZSBkaWQgbm90IGZpbmQgdGhlIGV4YWN0IGVsZW1lbnQsIGJ1dCB3ZSBjYW4gcmV0dXJuIHRoZSBpbmRleCBvZlxuICAgIC8vICAgICAgdGhlIG5leHQgY2xvc2VzdCBlbGVtZW50IHRoYXQgaXMgbGVzcyB0aGFuIHRoYXQgZWxlbWVudC5cbiAgICAvL1xuICAgIC8vICAgMy4gV2UgZGlkIG5vdCBmaW5kIHRoZSBleGFjdCBlbGVtZW50LCBhbmQgdGhlcmUgaXMgbm8gbmV4dC1jbG9zZXN0XG4gICAgLy8gICAgICBlbGVtZW50IHdoaWNoIGlzIGxlc3MgdGhhbiB0aGUgb25lIHdlIGFyZSBzZWFyY2hpbmcgZm9yLCBzbyB3ZVxuICAgIC8vICAgICAgcmV0dXJuIC0xLlxuICAgIHZhciBtaWQgPSBNYXRoLmZsb29yKChhSGlnaCAtIGFMb3cpIC8gMikgKyBhTG93O1xuICAgIHZhciBjbXAgPSBhQ29tcGFyZShhTmVlZGxlLCBhSGF5c3RhY2tbbWlkXSwgdHJ1ZSk7XG4gICAgaWYgKGNtcCA9PT0gMCkge1xuICAgICAgLy8gRm91bmQgdGhlIGVsZW1lbnQgd2UgYXJlIGxvb2tpbmcgZm9yLlxuICAgICAgcmV0dXJuIG1pZDtcbiAgICB9XG4gICAgZWxzZSBpZiAoY21wID4gMCkge1xuICAgICAgLy8gYUhheXN0YWNrW21pZF0gaXMgZ3JlYXRlciB0aGFuIG91ciBuZWVkbGUuXG4gICAgICBpZiAoYUhpZ2ggLSBtaWQgPiAxKSB7XG4gICAgICAgIC8vIFRoZSBlbGVtZW50IGlzIGluIHRoZSB1cHBlciBoYWxmLlxuICAgICAgICByZXR1cm4gcmVjdXJzaXZlU2VhcmNoKG1pZCwgYUhpZ2gsIGFOZWVkbGUsIGFIYXlzdGFjaywgYUNvbXBhcmUpO1xuICAgICAgfVxuICAgICAgLy8gV2UgZGlkIG5vdCBmaW5kIGFuIGV4YWN0IG1hdGNoLCByZXR1cm4gdGhlIG5leHQgY2xvc2VzdCBvbmVcbiAgICAgIC8vICh0ZXJtaW5hdGlvbiBjYXNlIDIpLlxuICAgICAgcmV0dXJuIG1pZDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAvLyBhSGF5c3RhY2tbbWlkXSBpcyBsZXNzIHRoYW4gb3VyIG5lZWRsZS5cbiAgICAgIGlmIChtaWQgLSBhTG93ID4gMSkge1xuICAgICAgICAvLyBUaGUgZWxlbWVudCBpcyBpbiB0aGUgbG93ZXIgaGFsZi5cbiAgICAgICAgcmV0dXJuIHJlY3Vyc2l2ZVNlYXJjaChhTG93LCBtaWQsIGFOZWVkbGUsIGFIYXlzdGFjaywgYUNvbXBhcmUpO1xuICAgICAgfVxuICAgICAgLy8gVGhlIGV4YWN0IG5lZWRsZSBlbGVtZW50IHdhcyBub3QgZm91bmQgaW4gdGhpcyBoYXlzdGFjay4gRGV0ZXJtaW5lIGlmXG4gICAgICAvLyB3ZSBhcmUgaW4gdGVybWluYXRpb24gY2FzZSAoMikgb3IgKDMpIGFuZCByZXR1cm4gdGhlIGFwcHJvcHJpYXRlIHRoaW5nLlxuICAgICAgcmV0dXJuIGFMb3cgPCAwID8gLTEgOiBhTG93O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGlzIGFuIGltcGxlbWVudGF0aW9uIG9mIGJpbmFyeSBzZWFyY2ggd2hpY2ggd2lsbCBhbHdheXMgdHJ5IGFuZCByZXR1cm5cbiAgICogdGhlIGluZGV4IG9mIG5leHQgbG93ZXN0IHZhbHVlIGNoZWNrZWQgaWYgdGhlcmUgaXMgbm8gZXhhY3QgaGl0LiBUaGlzIGlzXG4gICAqIGJlY2F1c2UgbWFwcGluZ3MgYmV0d2VlbiBvcmlnaW5hbCBhbmQgZ2VuZXJhdGVkIGxpbmUvY29sIHBhaXJzIGFyZSBzaW5nbGVcbiAgICogcG9pbnRzLCBhbmQgdGhlcmUgaXMgYW4gaW1wbGljaXQgcmVnaW9uIGJldHdlZW4gZWFjaCBvZiB0aGVtLCBzbyBhIG1pc3NcbiAgICoganVzdCBtZWFucyB0aGF0IHlvdSBhcmVuJ3Qgb24gdGhlIHZlcnkgc3RhcnQgb2YgYSByZWdpb24uXG4gICAqXG4gICAqIEBwYXJhbSBhTmVlZGxlIFRoZSBlbGVtZW50IHlvdSBhcmUgbG9va2luZyBmb3IuXG4gICAqIEBwYXJhbSBhSGF5c3RhY2sgVGhlIGFycmF5IHRoYXQgaXMgYmVpbmcgc2VhcmNoZWQuXG4gICAqIEBwYXJhbSBhQ29tcGFyZSBBIGZ1bmN0aW9uIHdoaWNoIHRha2VzIHRoZSBuZWVkbGUgYW5kIGFuIGVsZW1lbnQgaW4gdGhlXG4gICAqICAgICBhcnJheSBhbmQgcmV0dXJucyAtMSwgMCwgb3IgMSBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgbmVlZGxlIGlzIGxlc3NcbiAgICogICAgIHRoYW4sIGVxdWFsIHRvLCBvciBncmVhdGVyIHRoYW4gdGhlIGVsZW1lbnQsIHJlc3BlY3RpdmVseS5cbiAgICovXG4gIGV4cG9ydHMuc2VhcmNoID0gZnVuY3Rpb24gc2VhcmNoKGFOZWVkbGUsIGFIYXlzdGFjaywgYUNvbXBhcmUpIHtcbiAgICBpZiAoYUhheXN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICByZXR1cm4gcmVjdXJzaXZlU2VhcmNoKC0xLCBhSGF5c3RhY2subGVuZ3RoLCBhTmVlZGxlLCBhSGF5c3RhY2ssIGFDb21wYXJlKVxuICB9O1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxNCBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuICAvKipcbiAgICogRGV0ZXJtaW5lIHdoZXRoZXIgbWFwcGluZ0IgaXMgYWZ0ZXIgbWFwcGluZ0Egd2l0aCByZXNwZWN0IHRvIGdlbmVyYXRlZFxuICAgKiBwb3NpdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIGdlbmVyYXRlZFBvc2l0aW9uQWZ0ZXIobWFwcGluZ0EsIG1hcHBpbmdCKSB7XG4gICAgLy8gT3B0aW1pemVkIGZvciBtb3N0IGNvbW1vbiBjYXNlXG4gICAgdmFyIGxpbmVBID0gbWFwcGluZ0EuZ2VuZXJhdGVkTGluZTtcbiAgICB2YXIgbGluZUIgPSBtYXBwaW5nQi5nZW5lcmF0ZWRMaW5lO1xuICAgIHZhciBjb2x1bW5BID0gbWFwcGluZ0EuZ2VuZXJhdGVkQ29sdW1uO1xuICAgIHZhciBjb2x1bW5CID0gbWFwcGluZ0IuZ2VuZXJhdGVkQ29sdW1uO1xuICAgIHJldHVybiBsaW5lQiA+IGxpbmVBIHx8IGxpbmVCID09IGxpbmVBICYmIGNvbHVtbkIgPj0gY29sdW1uQSB8fFxuICAgICAgICAgICB1dGlsLmNvbXBhcmVCeUdlbmVyYXRlZFBvc2l0aW9ucyhtYXBwaW5nQSwgbWFwcGluZ0IpIDw9IDA7XG4gIH1cblxuICAvKipcbiAgICogQSBkYXRhIHN0cnVjdHVyZSB0byBwcm92aWRlIGEgc29ydGVkIHZpZXcgb2YgYWNjdW11bGF0ZWQgbWFwcGluZ3MgaW4gYVxuICAgKiBwZXJmb3JtYW5jZSBjb25zY2lvdXMgbWFubmVyLiBJdCB0cmFkZXMgYSBuZWdsaWJhYmxlIG92ZXJoZWFkIGluIGdlbmVyYWxcbiAgICogY2FzZSBmb3IgYSBsYXJnZSBzcGVlZHVwIGluIGNhc2Ugb2YgbWFwcGluZ3MgYmVpbmcgYWRkZWQgaW4gb3JkZXIuXG4gICAqL1xuICBmdW5jdGlvbiBNYXBwaW5nTGlzdCgpIHtcbiAgICB0aGlzLl9hcnJheSA9IFtdO1xuICAgIHRoaXMuX3NvcnRlZCA9IHRydWU7XG4gICAgLy8gU2VydmVzIGFzIGluZmltdW1cbiAgICB0aGlzLl9sYXN0ID0ge2dlbmVyYXRlZExpbmU6IC0xLCBnZW5lcmF0ZWRDb2x1bW46IDB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdGUgdGhyb3VnaCBpbnRlcm5hbCBpdGVtcy4gVGhpcyBtZXRob2QgdGFrZXMgdGhlIHNhbWUgYXJndW1lbnRzIHRoYXRcbiAgICogYEFycmF5LnByb3RvdHlwZS5mb3JFYWNoYCB0YWtlcy5cbiAgICpcbiAgICogTk9URTogVGhlIG9yZGVyIG9mIHRoZSBtYXBwaW5ncyBpcyBOT1QgZ3VhcmFudGVlZC5cbiAgICovXG4gIE1hcHBpbmdMaXN0LnByb3RvdHlwZS51bnNvcnRlZEZvckVhY2ggPVxuICAgIGZ1bmN0aW9uIE1hcHBpbmdMaXN0X2ZvckVhY2goYUNhbGxiYWNrLCBhVGhpc0FyZykge1xuICAgICAgdGhpcy5fYXJyYXkuZm9yRWFjaChhQ2FsbGJhY2ssIGFUaGlzQXJnKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgdGhlIGdpdmVuIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gT2JqZWN0IGFNYXBwaW5nXG4gICAqL1xuICBNYXBwaW5nTGlzdC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gTWFwcGluZ0xpc3RfYWRkKGFNYXBwaW5nKSB7XG4gICAgdmFyIG1hcHBpbmc7XG4gICAgaWYgKGdlbmVyYXRlZFBvc2l0aW9uQWZ0ZXIodGhpcy5fbGFzdCwgYU1hcHBpbmcpKSB7XG4gICAgICB0aGlzLl9sYXN0ID0gYU1hcHBpbmc7XG4gICAgICB0aGlzLl9hcnJheS5wdXNoKGFNYXBwaW5nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc29ydGVkID0gZmFsc2U7XG4gICAgICB0aGlzLl9hcnJheS5wdXNoKGFNYXBwaW5nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGZsYXQsIHNvcnRlZCBhcnJheSBvZiBtYXBwaW5ncy4gVGhlIG1hcHBpbmdzIGFyZSBzb3J0ZWQgYnlcbiAgICogZ2VuZXJhdGVkIHBvc2l0aW9uLlxuICAgKlxuICAgKiBXQVJOSU5HOiBUaGlzIG1ldGhvZCByZXR1cm5zIGludGVybmFsIGRhdGEgd2l0aG91dCBjb3B5aW5nLCBmb3JcbiAgICogcGVyZm9ybWFuY2UuIFRoZSByZXR1cm4gdmFsdWUgbXVzdCBOT1QgYmUgbXV0YXRlZCwgYW5kIHNob3VsZCBiZSB0cmVhdGVkIGFzXG4gICAqIGFuIGltbXV0YWJsZSBib3Jyb3cuIElmIHlvdSB3YW50IHRvIHRha2Ugb3duZXJzaGlwLCB5b3UgbXVzdCBtYWtlIHlvdXIgb3duXG4gICAqIGNvcHkuXG4gICAqL1xuICBNYXBwaW5nTGlzdC5wcm90b3R5cGUudG9BcnJheSA9IGZ1bmN0aW9uIE1hcHBpbmdMaXN0X3RvQXJyYXkoKSB7XG4gICAgaWYgKCF0aGlzLl9zb3J0ZWQpIHtcbiAgICAgIHRoaXMuX2FycmF5LnNvcnQodXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMpO1xuICAgICAgdGhpcy5fc29ydGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FycmF5O1xuICB9O1xuXG4gIGV4cG9ydHMuTWFwcGluZ0xpc3QgPSBNYXBwaW5nTGlzdDtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG4gIHZhciBiaW5hcnlTZWFyY2ggPSByZXF1aXJlKCcuL2JpbmFyeS1zZWFyY2gnKTtcbiAgdmFyIEFycmF5U2V0ID0gcmVxdWlyZSgnLi9hcnJheS1zZXQnKS5BcnJheVNldDtcbiAgdmFyIGJhc2U2NFZMUSA9IHJlcXVpcmUoJy4vYmFzZTY0LXZscScpO1xuXG4gIC8qKlxuICAgKiBBIFNvdXJjZU1hcENvbnN1bWVyIGluc3RhbmNlIHJlcHJlc2VudHMgYSBwYXJzZWQgc291cmNlIG1hcCB3aGljaCB3ZSBjYW5cbiAgICogcXVlcnkgZm9yIGluZm9ybWF0aW9uIGFib3V0IHRoZSBvcmlnaW5hbCBmaWxlIHBvc2l0aW9ucyBieSBnaXZpbmcgaXQgYSBmaWxlXG4gICAqIHBvc2l0aW9uIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLlxuICAgKlxuICAgKiBUaGUgb25seSBwYXJhbWV0ZXIgaXMgdGhlIHJhdyBzb3VyY2UgbWFwIChlaXRoZXIgYXMgYSBKU09OIHN0cmluZywgb3JcbiAgICogYWxyZWFkeSBwYXJzZWQgdG8gYW4gb2JqZWN0KS4gQWNjb3JkaW5nIHRvIHRoZSBzcGVjLCBzb3VyY2UgbWFwcyBoYXZlIHRoZVxuICAgKiBmb2xsb3dpbmcgYXR0cmlidXRlczpcbiAgICpcbiAgICogICAtIHZlcnNpb246IFdoaWNoIHZlcnNpb24gb2YgdGhlIHNvdXJjZSBtYXAgc3BlYyB0aGlzIG1hcCBpcyBmb2xsb3dpbmcuXG4gICAqICAgLSBzb3VyY2VzOiBBbiBhcnJheSBvZiBVUkxzIHRvIHRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZXMuXG4gICAqICAgLSBuYW1lczogQW4gYXJyYXkgb2YgaWRlbnRpZmllcnMgd2hpY2ggY2FuIGJlIHJlZmVycmVuY2VkIGJ5IGluZGl2aWR1YWwgbWFwcGluZ3MuXG4gICAqICAgLSBzb3VyY2VSb290OiBPcHRpb25hbC4gVGhlIFVSTCByb290IGZyb20gd2hpY2ggYWxsIHNvdXJjZXMgYXJlIHJlbGF0aXZlLlxuICAgKiAgIC0gc291cmNlc0NvbnRlbnQ6IE9wdGlvbmFsLiBBbiBhcnJheSBvZiBjb250ZW50cyBvZiB0aGUgb3JpZ2luYWwgc291cmNlIGZpbGVzLlxuICAgKiAgIC0gbWFwcGluZ3M6IEEgc3RyaW5nIG9mIGJhc2U2NCBWTFFzIHdoaWNoIGNvbnRhaW4gdGhlIGFjdHVhbCBtYXBwaW5ncy5cbiAgICogICAtIGZpbGU6IE9wdGlvbmFsLiBUaGUgZ2VuZXJhdGVkIGZpbGUgdGhpcyBzb3VyY2UgbWFwIGlzIGFzc29jaWF0ZWQgd2l0aC5cbiAgICpcbiAgICogSGVyZSBpcyBhbiBleGFtcGxlIHNvdXJjZSBtYXAsIHRha2VuIGZyb20gdGhlIHNvdXJjZSBtYXAgc3BlY1swXTpcbiAgICpcbiAgICogICAgIHtcbiAgICogICAgICAgdmVyc2lvbiA6IDMsXG4gICAqICAgICAgIGZpbGU6IFwib3V0LmpzXCIsXG4gICAqICAgICAgIHNvdXJjZVJvb3QgOiBcIlwiLFxuICAgKiAgICAgICBzb3VyY2VzOiBbXCJmb28uanNcIiwgXCJiYXIuanNcIl0sXG4gICAqICAgICAgIG5hbWVzOiBbXCJzcmNcIiwgXCJtYXBzXCIsIFwiYXJlXCIsIFwiZnVuXCJdLFxuICAgKiAgICAgICBtYXBwaW5nczogXCJBQSxBQjs7QUJDREU7XCJcbiAgICogICAgIH1cbiAgICpcbiAgICogWzBdOiBodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9kb2N1bWVudC9kLzFVMVJHQWVoUXdSeXBVVG92RjFLUmxwaU9GemUwYi1fMmdjNmZBSDBLWTBrL2VkaXQ/cGxpPTEjXG4gICAqL1xuICBmdW5jdGlvbiBTb3VyY2VNYXBDb25zdW1lcihhU291cmNlTWFwKSB7XG4gICAgdmFyIHNvdXJjZU1hcCA9IGFTb3VyY2VNYXA7XG4gICAgaWYgKHR5cGVvZiBhU291cmNlTWFwID09PSAnc3RyaW5nJykge1xuICAgICAgc291cmNlTWFwID0gSlNPTi5wYXJzZShhU291cmNlTWFwLnJlcGxhY2UoL15cXClcXF1cXH0nLywgJycpKTtcbiAgICB9XG5cbiAgICB2YXIgdmVyc2lvbiA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3ZlcnNpb24nKTtcbiAgICB2YXIgc291cmNlcyA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3NvdXJjZXMnKTtcbiAgICAvLyBTYXNzIDMuMyBsZWF2ZXMgb3V0IHRoZSAnbmFtZXMnIGFycmF5LCBzbyB3ZSBkZXZpYXRlIGZyb20gdGhlIHNwZWMgKHdoaWNoXG4gICAgLy8gcmVxdWlyZXMgdGhlIGFycmF5KSB0byBwbGF5IG5pY2UgaGVyZS5cbiAgICB2YXIgbmFtZXMgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICduYW1lcycsIFtdKTtcbiAgICB2YXIgc291cmNlUm9vdCA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ3NvdXJjZVJvb3QnLCBudWxsKTtcbiAgICB2YXIgc291cmNlc0NvbnRlbnQgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdzb3VyY2VzQ29udGVudCcsIG51bGwpO1xuICAgIHZhciBtYXBwaW5ncyA9IHV0aWwuZ2V0QXJnKHNvdXJjZU1hcCwgJ21hcHBpbmdzJyk7XG4gICAgdmFyIGZpbGUgPSB1dGlsLmdldEFyZyhzb3VyY2VNYXAsICdmaWxlJywgbnVsbCk7XG5cbiAgICAvLyBPbmNlIGFnYWluLCBTYXNzIGRldmlhdGVzIGZyb20gdGhlIHNwZWMgYW5kIHN1cHBsaWVzIHRoZSB2ZXJzaW9uIGFzIGFcbiAgICAvLyBzdHJpbmcgcmF0aGVyIHRoYW4gYSBudW1iZXIsIHNvIHdlIHVzZSBsb29zZSBlcXVhbGl0eSBjaGVja2luZyBoZXJlLlxuICAgIGlmICh2ZXJzaW9uICE9IHRoaXMuX3ZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgdmVyc2lvbjogJyArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIC8vIFNvbWUgc291cmNlIG1hcHMgcHJvZHVjZSByZWxhdGl2ZSBzb3VyY2UgcGF0aHMgbGlrZSBcIi4vZm9vLmpzXCIgaW5zdGVhZCBvZlxuICAgIC8vIFwiZm9vLmpzXCIuICBOb3JtYWxpemUgdGhlc2UgZmlyc3Qgc28gdGhhdCBmdXR1cmUgY29tcGFyaXNvbnMgd2lsbCBzdWNjZWVkLlxuICAgIC8vIFNlZSBidWd6aWwubGEvMTA5MDc2OC5cbiAgICBzb3VyY2VzID0gc291cmNlcy5tYXAodXRpbC5ub3JtYWxpemUpO1xuXG4gICAgLy8gUGFzcyBgdHJ1ZWAgYmVsb3cgdG8gYWxsb3cgZHVwbGljYXRlIG5hbWVzIGFuZCBzb3VyY2VzLiBXaGlsZSBzb3VyY2UgbWFwc1xuICAgIC8vIGFyZSBpbnRlbmRlZCB0byBiZSBjb21wcmVzc2VkIGFuZCBkZWR1cGxpY2F0ZWQsIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyXG4gICAgLy8gc29tZXRpbWVzIGdlbmVyYXRlcyBzb3VyY2UgbWFwcyB3aXRoIGR1cGxpY2F0ZXMgaW4gdGhlbS4gU2VlIEdpdGh1YiBpc3N1ZVxuICAgIC8vICM3MiBhbmQgYnVnemlsLmxhLzg4OTQ5Mi5cbiAgICB0aGlzLl9uYW1lcyA9IEFycmF5U2V0LmZyb21BcnJheShuYW1lcywgdHJ1ZSk7XG4gICAgdGhpcy5fc291cmNlcyA9IEFycmF5U2V0LmZyb21BcnJheShzb3VyY2VzLCB0cnVlKTtcblxuICAgIHRoaXMuc291cmNlUm9vdCA9IHNvdXJjZVJvb3Q7XG4gICAgdGhpcy5zb3VyY2VzQ29udGVudCA9IHNvdXJjZXNDb250ZW50O1xuICAgIHRoaXMuX21hcHBpbmdzID0gbWFwcGluZ3M7XG4gICAgdGhpcy5maWxlID0gZmlsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBTb3VyY2VNYXBDb25zdW1lciBmcm9tIGEgU291cmNlTWFwR2VuZXJhdG9yLlxuICAgKlxuICAgKiBAcGFyYW0gU291cmNlTWFwR2VuZXJhdG9yIGFTb3VyY2VNYXBcbiAgICogICAgICAgIFRoZSBzb3VyY2UgbWFwIHRoYXQgd2lsbCBiZSBjb25zdW1lZC5cbiAgICogQHJldHVybnMgU291cmNlTWFwQ29uc3VtZXJcbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLmZyb21Tb3VyY2VNYXAgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2Zyb21Tb3VyY2VNYXAoYVNvdXJjZU1hcCkge1xuICAgICAgdmFyIHNtYyA9IE9iamVjdC5jcmVhdGUoU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlKTtcblxuICAgICAgc21jLl9uYW1lcyA9IEFycmF5U2V0LmZyb21BcnJheShhU291cmNlTWFwLl9uYW1lcy50b0FycmF5KCksIHRydWUpO1xuICAgICAgc21jLl9zb3VyY2VzID0gQXJyYXlTZXQuZnJvbUFycmF5KGFTb3VyY2VNYXAuX3NvdXJjZXMudG9BcnJheSgpLCB0cnVlKTtcbiAgICAgIHNtYy5zb3VyY2VSb290ID0gYVNvdXJjZU1hcC5fc291cmNlUm9vdDtcbiAgICAgIHNtYy5zb3VyY2VzQ29udGVudCA9IGFTb3VyY2VNYXAuX2dlbmVyYXRlU291cmNlc0NvbnRlbnQoc21jLl9zb3VyY2VzLnRvQXJyYXkoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc21jLnNvdXJjZVJvb3QpO1xuICAgICAgc21jLmZpbGUgPSBhU291cmNlTWFwLl9maWxlO1xuXG4gICAgICBzbWMuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IGFTb3VyY2VNYXAuX21hcHBpbmdzLnRvQXJyYXkoKS5zbGljZSgpO1xuICAgICAgc21jLl9fb3JpZ2luYWxNYXBwaW5ncyA9IGFTb3VyY2VNYXAuX21hcHBpbmdzLnRvQXJyYXkoKS5zbGljZSgpXG4gICAgICAgIC5zb3J0KHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMpO1xuXG4gICAgICByZXR1cm4gc21jO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFRoZSB2ZXJzaW9uIG9mIHRoZSBzb3VyY2UgbWFwcGluZyBzcGVjIHRoYXQgd2UgYXJlIGNvbnN1bWluZy5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fdmVyc2lvbiA9IDM7XG5cbiAgLyoqXG4gICAqIFRoZSBsaXN0IG9mIG9yaWdpbmFsIHNvdXJjZXMuXG4gICAqL1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLCAnc291cmNlcycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zb3VyY2VzLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlUm9vdCAhPSBudWxsID8gdXRpbC5qb2luKHRoaXMuc291cmNlUm9vdCwgcykgOiBzO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuICB9KTtcblxuICAvLyBgX19nZW5lcmF0ZWRNYXBwaW5nc2AgYW5kIGBfX29yaWdpbmFsTWFwcGluZ3NgIGFyZSBhcnJheXMgdGhhdCBob2xkIHRoZVxuICAvLyBwYXJzZWQgbWFwcGluZyBjb29yZGluYXRlcyBmcm9tIHRoZSBzb3VyY2UgbWFwJ3MgXCJtYXBwaW5nc1wiIGF0dHJpYnV0ZS4gVGhleVxuICAvLyBhcmUgbGF6aWx5IGluc3RhbnRpYXRlZCwgYWNjZXNzZWQgdmlhIHRoZSBgX2dlbmVyYXRlZE1hcHBpbmdzYCBhbmRcbiAgLy8gYF9vcmlnaW5hbE1hcHBpbmdzYCBnZXR0ZXJzIHJlc3BlY3RpdmVseSwgYW5kIHdlIG9ubHkgcGFyc2UgdGhlIG1hcHBpbmdzXG4gIC8vIGFuZCBjcmVhdGUgdGhlc2UgYXJyYXlzIG9uY2UgcXVlcmllZCBmb3IgYSBzb3VyY2UgbG9jYXRpb24uIFdlIGp1bXAgdGhyb3VnaFxuICAvLyB0aGVzZSBob29wcyBiZWNhdXNlIHRoZXJlIGNhbiBiZSBtYW55IHRob3VzYW5kcyBvZiBtYXBwaW5ncywgYW5kIHBhcnNpbmdcbiAgLy8gdGhlbSBpcyBleHBlbnNpdmUsIHNvIHdlIG9ubHkgd2FudCB0byBkbyBpdCBpZiB3ZSBtdXN0LlxuICAvL1xuICAvLyBFYWNoIG9iamVjdCBpbiB0aGUgYXJyYXlzIGlzIG9mIHRoZSBmb3JtOlxuICAvL1xuICAvLyAgICAge1xuICAvLyAgICAgICBnZW5lcmF0ZWRMaW5lOiBUaGUgbGluZSBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBjb2RlLFxuICAvLyAgICAgICBnZW5lcmF0ZWRDb2x1bW46IFRoZSBjb2x1bW4gbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgY29kZSxcbiAgLy8gICAgICAgc291cmNlOiBUaGUgcGF0aCB0byB0aGUgb3JpZ2luYWwgc291cmNlIGZpbGUgdGhhdCBnZW5lcmF0ZWQgdGhpc1xuICAvLyAgICAgICAgICAgICAgIGNodW5rIG9mIGNvZGUsXG4gIC8vICAgICAgIG9yaWdpbmFsTGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBvcmlnaW5hbCBzb3VyY2UgdGhhdFxuICAvLyAgICAgICAgICAgICAgICAgICAgIGNvcnJlc3BvbmRzIHRvIHRoaXMgY2h1bmsgb2YgZ2VuZXJhdGVkIGNvZGUsXG4gIC8vICAgICAgIG9yaWdpbmFsQ29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlIHRoYXRcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgIGNvcnJlc3BvbmRzIHRvIHRoaXMgY2h1bmsgb2YgZ2VuZXJhdGVkIGNvZGUsXG4gIC8vICAgICAgIG5hbWU6IFRoZSBuYW1lIG9mIHRoZSBvcmlnaW5hbCBzeW1ib2wgd2hpY2ggZ2VuZXJhdGVkIHRoaXMgY2h1bmsgb2ZcbiAgLy8gICAgICAgICAgICAgY29kZS5cbiAgLy8gICAgIH1cbiAgLy9cbiAgLy8gQWxsIHByb3BlcnRpZXMgZXhjZXB0IGZvciBgZ2VuZXJhdGVkTGluZWAgYW5kIGBnZW5lcmF0ZWRDb2x1bW5gIGNhbiBiZVxuICAvLyBgbnVsbGAuXG4gIC8vXG4gIC8vIGBfZ2VuZXJhdGVkTWFwcGluZ3NgIGlzIG9yZGVyZWQgYnkgdGhlIGdlbmVyYXRlZCBwb3NpdGlvbnMuXG4gIC8vXG4gIC8vIGBfb3JpZ2luYWxNYXBwaW5nc2AgaXMgb3JkZXJlZCBieSB0aGUgb3JpZ2luYWwgcG9zaXRpb25zLlxuXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fX2dlbmVyYXRlZE1hcHBpbmdzID0gbnVsbDtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZSwgJ19nZW5lcmF0ZWRNYXBwaW5ncycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzKSB7XG4gICAgICAgIHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncyA9IFtdO1xuICAgICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncyA9IFtdO1xuICAgICAgICB0aGlzLl9wYXJzZU1hcHBpbmdzKHRoaXMuX21hcHBpbmdzLCB0aGlzLnNvdXJjZVJvb3QpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzO1xuICAgIH1cbiAgfSk7XG5cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9fb3JpZ2luYWxNYXBwaW5ncyA9IG51bGw7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUsICdfb3JpZ2luYWxNYXBwaW5ncycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghdGhpcy5fX29yaWdpbmFsTWFwcGluZ3MpIHtcbiAgICAgICAgdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzID0gW107XG4gICAgICAgIHRoaXMuX19vcmlnaW5hbE1hcHBpbmdzID0gW107XG4gICAgICAgIHRoaXMuX3BhcnNlTWFwcGluZ3ModGhpcy5fbWFwcGluZ3MsIHRoaXMuc291cmNlUm9vdCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncztcbiAgICB9XG4gIH0pO1xuXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fbmV4dENoYXJJc01hcHBpbmdTZXBhcmF0b3IgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX25leHRDaGFySXNNYXBwaW5nU2VwYXJhdG9yKGFTdHIpIHtcbiAgICAgIHZhciBjID0gYVN0ci5jaGFyQXQoMCk7XG4gICAgICByZXR1cm4gYyA9PT0gXCI7XCIgfHwgYyA9PT0gXCIsXCI7XG4gICAgfTtcblxuICAvKipcbiAgICogUGFyc2UgdGhlIG1hcHBpbmdzIGluIGEgc3RyaW5nIGluIHRvIGEgZGF0YSBzdHJ1Y3R1cmUgd2hpY2ggd2UgY2FuIGVhc2lseVxuICAgKiBxdWVyeSAodGhlIG9yZGVyZWQgYXJyYXlzIGluIHRoZSBgdGhpcy5fX2dlbmVyYXRlZE1hcHBpbmdzYCBhbmRcbiAgICogYHRoaXMuX19vcmlnaW5hbE1hcHBpbmdzYCBwcm9wZXJ0aWVzKS5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5fcGFyc2VNYXBwaW5ncyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfcGFyc2VNYXBwaW5ncyhhU3RyLCBhU291cmNlUm9vdCkge1xuICAgICAgdmFyIGdlbmVyYXRlZExpbmUgPSAxO1xuICAgICAgdmFyIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gMDtcbiAgICAgIHZhciBwcmV2aW91c09yaWdpbmFsTGluZSA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNPcmlnaW5hbENvbHVtbiA9IDA7XG4gICAgICB2YXIgcHJldmlvdXNTb3VyY2UgPSAwO1xuICAgICAgdmFyIHByZXZpb3VzTmFtZSA9IDA7XG4gICAgICB2YXIgc3RyID0gYVN0cjtcbiAgICAgIHZhciB0ZW1wID0ge307XG4gICAgICB2YXIgbWFwcGluZztcblxuICAgICAgd2hpbGUgKHN0ci5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmIChzdHIuY2hhckF0KDApID09PSAnOycpIHtcbiAgICAgICAgICBnZW5lcmF0ZWRMaW5lKys7XG4gICAgICAgICAgc3RyID0gc3RyLnNsaWNlKDEpO1xuICAgICAgICAgIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdHIuY2hhckF0KDApID09PSAnLCcpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc2xpY2UoMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbWFwcGluZyA9IHt9O1xuICAgICAgICAgIG1hcHBpbmcuZ2VuZXJhdGVkTGluZSA9IGdlbmVyYXRlZExpbmU7XG5cbiAgICAgICAgICAvLyBHZW5lcmF0ZWQgY29sdW1uLlxuICAgICAgICAgIGJhc2U2NFZMUS5kZWNvZGUoc3RyLCB0ZW1wKTtcbiAgICAgICAgICBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbiA9IHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uICsgdGVtcC52YWx1ZTtcbiAgICAgICAgICBwcmV2aW91c0dlbmVyYXRlZENvbHVtbiA9IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uO1xuICAgICAgICAgIHN0ciA9IHRlbXAucmVzdDtcblxuICAgICAgICAgIGlmIChzdHIubGVuZ3RoID4gMCAmJiAhdGhpcy5fbmV4dENoYXJJc01hcHBpbmdTZXBhcmF0b3Ioc3RyKSkge1xuICAgICAgICAgICAgLy8gT3JpZ2luYWwgc291cmNlLlxuICAgICAgICAgICAgYmFzZTY0VkxRLmRlY29kZShzdHIsIHRlbXApO1xuICAgICAgICAgICAgbWFwcGluZy5zb3VyY2UgPSB0aGlzLl9zb3VyY2VzLmF0KHByZXZpb3VzU291cmNlICsgdGVtcC52YWx1ZSk7XG4gICAgICAgICAgICBwcmV2aW91c1NvdXJjZSArPSB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgc3RyID0gdGVtcC5yZXN0O1xuICAgICAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDAgfHwgdGhpcy5fbmV4dENoYXJJc01hcHBpbmdTZXBhcmF0b3Ioc3RyKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIGEgc291cmNlLCBidXQgbm8gbGluZSBhbmQgY29sdW1uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGxpbmUuXG4gICAgICAgICAgICBiYXNlNjRWTFEuZGVjb2RlKHN0ciwgdGVtcCk7XG4gICAgICAgICAgICBtYXBwaW5nLm9yaWdpbmFsTGluZSA9IHByZXZpb3VzT3JpZ2luYWxMaW5lICsgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxMaW5lID0gbWFwcGluZy5vcmlnaW5hbExpbmU7XG4gICAgICAgICAgICAvLyBMaW5lcyBhcmUgc3RvcmVkIDAtYmFzZWRcbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxMaW5lICs9IDE7XG4gICAgICAgICAgICBzdHIgPSB0ZW1wLnJlc3Q7XG4gICAgICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gMCB8fCB0aGlzLl9uZXh0Q2hhcklzTWFwcGluZ1NlcGFyYXRvcihzdHIpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgYSBzb3VyY2UgYW5kIGxpbmUsIGJ1dCBubyBjb2x1bW4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT3JpZ2luYWwgY29sdW1uLlxuICAgICAgICAgICAgYmFzZTY0VkxRLmRlY29kZShzdHIsIHRlbXApO1xuICAgICAgICAgICAgbWFwcGluZy5vcmlnaW5hbENvbHVtbiA9IHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gKyB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgcHJldmlvdXNPcmlnaW5hbENvbHVtbiA9IG1hcHBpbmcub3JpZ2luYWxDb2x1bW47XG4gICAgICAgICAgICBzdHIgPSB0ZW1wLnJlc3Q7XG5cbiAgICAgICAgICAgIGlmIChzdHIubGVuZ3RoID4gMCAmJiAhdGhpcy5fbmV4dENoYXJJc01hcHBpbmdTZXBhcmF0b3Ioc3RyKSkge1xuICAgICAgICAgICAgICAvLyBPcmlnaW5hbCBuYW1lLlxuICAgICAgICAgICAgICBiYXNlNjRWTFEuZGVjb2RlKHN0ciwgdGVtcCk7XG4gICAgICAgICAgICAgIG1hcHBpbmcubmFtZSA9IHRoaXMuX25hbWVzLmF0KHByZXZpb3VzTmFtZSArIHRlbXAudmFsdWUpO1xuICAgICAgICAgICAgICBwcmV2aW91c05hbWUgKz0gdGVtcC52YWx1ZTtcbiAgICAgICAgICAgICAgc3RyID0gdGVtcC5yZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuX19nZW5lcmF0ZWRNYXBwaW5ncy5wdXNoKG1hcHBpbmcpO1xuICAgICAgICAgIGlmICh0eXBlb2YgbWFwcGluZy5vcmlnaW5hbExpbmUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncy5wdXNoKG1hcHBpbmcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLl9fZ2VuZXJhdGVkTWFwcGluZ3Muc29ydCh1dGlsLmNvbXBhcmVCeUdlbmVyYXRlZFBvc2l0aW9ucyk7XG4gICAgICB0aGlzLl9fb3JpZ2luYWxNYXBwaW5ncy5zb3J0KHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMpO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIEZpbmQgdGhlIG1hcHBpbmcgdGhhdCBiZXN0IG1hdGNoZXMgdGhlIGh5cG90aGV0aWNhbCBcIm5lZWRsZVwiIG1hcHBpbmcgdGhhdFxuICAgKiB3ZSBhcmUgc2VhcmNoaW5nIGZvciBpbiB0aGUgZ2l2ZW4gXCJoYXlzdGFja1wiIG9mIG1hcHBpbmdzLlxuICAgKi9cbiAgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9maW5kTWFwcGluZyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfZmluZE1hcHBpbmcoYU5lZWRsZSwgYU1hcHBpbmdzLCBhTGluZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYUNvbHVtbk5hbWUsIGFDb21wYXJhdG9yKSB7XG4gICAgICAvLyBUbyByZXR1cm4gdGhlIHBvc2l0aW9uIHdlIGFyZSBzZWFyY2hpbmcgZm9yLCB3ZSBtdXN0IGZpcnN0IGZpbmQgdGhlXG4gICAgICAvLyBtYXBwaW5nIGZvciB0aGUgZ2l2ZW4gcG9zaXRpb24gYW5kIHRoZW4gcmV0dXJuIHRoZSBvcHBvc2l0ZSBwb3NpdGlvbiBpdFxuICAgICAgLy8gcG9pbnRzIHRvLiBCZWNhdXNlIHRoZSBtYXBwaW5ncyBhcmUgc29ydGVkLCB3ZSBjYW4gdXNlIGJpbmFyeSBzZWFyY2ggdG9cbiAgICAgIC8vIGZpbmQgdGhlIGJlc3QgbWFwcGluZy5cblxuICAgICAgaWYgKGFOZWVkbGVbYUxpbmVOYW1lXSA8PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0xpbmUgbXVzdCBiZSBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gMSwgZ290ICdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArIGFOZWVkbGVbYUxpbmVOYW1lXSk7XG4gICAgICB9XG4gICAgICBpZiAoYU5lZWRsZVthQ29sdW1uTmFtZV0gPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0NvbHVtbiBtdXN0IGJlIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byAwLCBnb3QgJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgYU5lZWRsZVthQ29sdW1uTmFtZV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYmluYXJ5U2VhcmNoLnNlYXJjaChhTmVlZGxlLCBhTWFwcGluZ3MsIGFDb21wYXJhdG9yKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBDb21wdXRlIHRoZSBsYXN0IGNvbHVtbiBmb3IgZWFjaCBnZW5lcmF0ZWQgbWFwcGluZy4gVGhlIGxhc3QgY29sdW1uIGlzXG4gICAqIGluY2x1c2l2ZS5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5jb21wdXRlQ29sdW1uU3BhbnMgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2NvbXB1dGVDb2x1bW5TcGFucygpIHtcbiAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5ncy5sZW5ndGg7ICsraW5kZXgpIHtcbiAgICAgICAgdmFyIG1hcHBpbmcgPSB0aGlzLl9nZW5lcmF0ZWRNYXBwaW5nc1tpbmRleF07XG5cbiAgICAgICAgLy8gTWFwcGluZ3MgZG8gbm90IGNvbnRhaW4gYSBmaWVsZCBmb3IgdGhlIGxhc3QgZ2VuZXJhdGVkIGNvbHVtbnQuIFdlXG4gICAgICAgIC8vIGNhbiBjb21lIHVwIHdpdGggYW4gb3B0aW1pc3RpYyBlc3RpbWF0ZSwgaG93ZXZlciwgYnkgYXNzdW1pbmcgdGhhdFxuICAgICAgICAvLyBtYXBwaW5ncyBhcmUgY29udGlndW91cyAoaS5lLiBnaXZlbiB0d28gY29uc2VjdXRpdmUgbWFwcGluZ3MsIHRoZVxuICAgICAgICAvLyBmaXJzdCBtYXBwaW5nIGVuZHMgd2hlcmUgdGhlIHNlY29uZCBvbmUgc3RhcnRzKS5cbiAgICAgICAgaWYgKGluZGV4ICsgMSA8IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBuZXh0TWFwcGluZyA9IHRoaXMuX2dlbmVyYXRlZE1hcHBpbmdzW2luZGV4ICsgMV07XG5cbiAgICAgICAgICBpZiAobWFwcGluZy5nZW5lcmF0ZWRMaW5lID09PSBuZXh0TWFwcGluZy5nZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgICBtYXBwaW5nLmxhc3RHZW5lcmF0ZWRDb2x1bW4gPSBuZXh0TWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4gLSAxO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGxhc3QgbWFwcGluZyBmb3IgZWFjaCBsaW5lIHNwYW5zIHRoZSBlbnRpcmUgbGluZS5cbiAgICAgICAgbWFwcGluZy5sYXN0R2VuZXJhdGVkQ29sdW1uID0gSW5maW5pdHk7XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgb3JpZ2luYWwgc291cmNlLCBsaW5lLCBhbmQgY29sdW1uIGluZm9ybWF0aW9uIGZvciB0aGUgZ2VuZXJhdGVkXG4gICAqIHNvdXJjZSdzIGxpbmUgYW5kIGNvbHVtbiBwb3NpdGlvbnMgcHJvdmlkZWQuIFRoZSBvbmx5IGFyZ3VtZW50IGlzIGFuIG9iamVjdFxuICAgKiB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgICpcbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZS5cbiAgICogICAtIGNvbHVtbjogVGhlIGNvbHVtbiBudW1iZXIgaW4gdGhlIGdlbmVyYXRlZCBzb3VyY2UuXG4gICAqXG4gICAqIGFuZCBhbiBvYmplY3QgaXMgcmV0dXJuZWQgd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBzb3VyY2U6IFRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZSwgb3IgbnVsbC5cbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gbmFtZTogVGhlIG9yaWdpbmFsIGlkZW50aWZpZXIsIG9yIG51bGwuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUub3JpZ2luYWxQb3NpdGlvbkZvciA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfb3JpZ2luYWxQb3NpdGlvbkZvcihhQXJncykge1xuICAgICAgdmFyIG5lZWRsZSA9IHtcbiAgICAgICAgZ2VuZXJhdGVkTGluZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdsaW5lJyksXG4gICAgICAgIGdlbmVyYXRlZENvbHVtbjogdXRpbC5nZXRBcmcoYUFyZ3MsICdjb2x1bW4nKVxuICAgICAgfTtcblxuICAgICAgdmFyIGluZGV4ID0gdGhpcy5fZmluZE1hcHBpbmcobmVlZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImdlbmVyYXRlZExpbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZ2VuZXJhdGVkQ29sdW1uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmNvbXBhcmVCeUdlbmVyYXRlZFBvc2l0aW9ucyk7XG5cbiAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgIHZhciBtYXBwaW5nID0gdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3NbaW5kZXhdO1xuXG4gICAgICAgIGlmIChtYXBwaW5nLmdlbmVyYXRlZExpbmUgPT09IG5lZWRsZS5nZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgdmFyIHNvdXJjZSA9IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdzb3VyY2UnLCBudWxsKTtcbiAgICAgICAgICBpZiAoc291cmNlICE9IG51bGwgJiYgdGhpcy5zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNvdXJjZSA9IHV0aWwuam9pbih0aGlzLnNvdXJjZVJvb3QsIHNvdXJjZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICAgIGxpbmU6IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdvcmlnaW5hbExpbmUnLCBudWxsKSxcbiAgICAgICAgICAgIGNvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ29yaWdpbmFsQ29sdW1uJywgbnVsbCksXG4gICAgICAgICAgICBuYW1lOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnbmFtZScsIG51bGwpXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzb3VyY2U6IG51bGwsXG4gICAgICAgIGxpbmU6IG51bGwsXG4gICAgICAgIGNvbHVtbjogbnVsbCxcbiAgICAgICAgbmFtZTogbnVsbFxuICAgICAgfTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBvcmlnaW5hbCBzb3VyY2UgY29udGVudC4gVGhlIG9ubHkgYXJndW1lbnQgaXMgdGhlIHVybCBvZiB0aGVcbiAgICogb3JpZ2luYWwgc291cmNlIGZpbGUuIFJldHVybnMgbnVsbCBpZiBubyBvcmlnaW5hbCBzb3VyY2UgY29udGVudCBpc1xuICAgKiBhdmFpbGlibGUuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuc291cmNlQ29udGVudEZvciA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfc291cmNlQ29udGVudEZvcihhU291cmNlKSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlc0NvbnRlbnQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBhU291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIGFTb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fc291cmNlcy5oYXMoYVNvdXJjZSkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlc0NvbnRlbnRbdGhpcy5fc291cmNlcy5pbmRleE9mKGFTb3VyY2UpXTtcbiAgICAgIH1cblxuICAgICAgdmFyIHVybDtcbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbFxuICAgICAgICAgICYmICh1cmwgPSB1dGlsLnVybFBhcnNlKHRoaXMuc291cmNlUm9vdCkpKSB7XG4gICAgICAgIC8vIFhYWDogZmlsZTovLyBVUklzIGFuZCBhYnNvbHV0ZSBwYXRocyBsZWFkIHRvIHVuZXhwZWN0ZWQgYmVoYXZpb3IgZm9yXG4gICAgICAgIC8vIG1hbnkgdXNlcnMuIFdlIGNhbiBoZWxwIHRoZW0gb3V0IHdoZW4gdGhleSBleHBlY3QgZmlsZTovLyBVUklzIHRvXG4gICAgICAgIC8vIGJlaGF2ZSBsaWtlIGl0IHdvdWxkIGlmIHRoZXkgd2VyZSBydW5uaW5nIGEgbG9jYWwgSFRUUCBzZXJ2ZXIuIFNlZVxuICAgICAgICAvLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD04ODU1OTcuXG4gICAgICAgIHZhciBmaWxlVXJpQWJzUGF0aCA9IGFTb3VyY2UucmVwbGFjZSgvXmZpbGU6XFwvXFwvLywgXCJcIik7XG4gICAgICAgIGlmICh1cmwuc2NoZW1lID09IFwiZmlsZVwiXG4gICAgICAgICAgICAmJiB0aGlzLl9zb3VyY2VzLmhhcyhmaWxlVXJpQWJzUGF0aCkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2VzQ29udGVudFt0aGlzLl9zb3VyY2VzLmluZGV4T2YoZmlsZVVyaUFic1BhdGgpXVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCghdXJsLnBhdGggfHwgdXJsLnBhdGggPT0gXCIvXCIpXG4gICAgICAgICAgICAmJiB0aGlzLl9zb3VyY2VzLmhhcyhcIi9cIiArIGFTb3VyY2UpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlc0NvbnRlbnRbdGhpcy5fc291cmNlcy5pbmRleE9mKFwiL1wiICsgYVNvdXJjZSldO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcignXCInICsgYVNvdXJjZSArICdcIiBpcyBub3QgaW4gdGhlIFNvdXJjZU1hcC4nKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uIGZvciB0aGUgb3JpZ2luYWwgc291cmNlLFxuICAgKiBsaW5lLCBhbmQgY29sdW1uIHBvc2l0aW9ucyBwcm92aWRlZC4gVGhlIG9ubHkgYXJndW1lbnQgaXMgYW4gb2JqZWN0IHdpdGhcbiAgICogdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gc291cmNlOiBUaGUgZmlsZW5hbWUgb2YgdGhlIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAtIGxpbmU6IFRoZSBsaW5lIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKlxuICAgKiBhbmQgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5nZW5lcmF0ZWRQb3NpdGlvbkZvciA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwQ29uc3VtZXJfZ2VuZXJhdGVkUG9zaXRpb25Gb3IoYUFyZ3MpIHtcbiAgICAgIHZhciBuZWVkbGUgPSB7XG4gICAgICAgIHNvdXJjZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdzb3VyY2UnKSxcbiAgICAgICAgb3JpZ2luYWxMaW5lOiB1dGlsLmdldEFyZyhhQXJncywgJ2xpbmUnKSxcbiAgICAgICAgb3JpZ2luYWxDb2x1bW46IHV0aWwuZ2V0QXJnKGFBcmdzLCAnY29sdW1uJylcbiAgICAgIH07XG5cbiAgICAgIGlmICh0aGlzLnNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICBuZWVkbGUuc291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLnNvdXJjZVJvb3QsIG5lZWRsZS5zb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLl9maW5kTWFwcGluZyhuZWVkbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJvcmlnaW5hbExpbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwib3JpZ2luYWxDb2x1bW5cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMpO1xuXG4gICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICB2YXIgbWFwcGluZyA9IHRoaXMuX29yaWdpbmFsTWFwcGluZ3NbaW5kZXhdO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbGluZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZExpbmUnLCBudWxsKSxcbiAgICAgICAgICBjb2x1bW46IHV0aWwuZ2V0QXJnKG1hcHBpbmcsICdnZW5lcmF0ZWRDb2x1bW4nLCBudWxsKSxcbiAgICAgICAgICBsYXN0Q29sdW1uOiB1dGlsLmdldEFyZyhtYXBwaW5nLCAnbGFzdEdlbmVyYXRlZENvbHVtbicsIG51bGwpXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGxpbmU6IG51bGwsXG4gICAgICAgIGNvbHVtbjogbnVsbCxcbiAgICAgICAgbGFzdENvbHVtbjogbnVsbFxuICAgICAgfTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uIGluZm9ybWF0aW9uIGZvciB0aGUgb3JpZ2luYWwgc291cmNlXG4gICAqIGFuZCBsaW5lIHByb3ZpZGVkLiBUaGUgb25seSBhcmd1bWVudCBpcyBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nXG4gICAqIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBzb3VyY2U6IFRoZSBmaWxlbmFtZSBvZiB0aGUgb3JpZ2luYWwgc291cmNlLlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBvcmlnaW5hbCBzb3VyY2UuXG4gICAqXG4gICAqIGFuZCBhbiBhcnJheSBvZiBvYmplY3RzIGlzIHJldHVybmVkLCBlYWNoIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAgIC0gbGluZTogVGhlIGxpbmUgbnVtYmVyIGluIHRoZSBnZW5lcmF0ZWQgc291cmNlLCBvciBudWxsLlxuICAgKiAgIC0gY29sdW1uOiBUaGUgY29sdW1uIG51bWJlciBpbiB0aGUgZ2VuZXJhdGVkIHNvdXJjZSwgb3IgbnVsbC5cbiAgICovXG4gIFNvdXJjZU1hcENvbnN1bWVyLnByb3RvdHlwZS5hbGxHZW5lcmF0ZWRQb3NpdGlvbnNGb3IgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2FsbEdlbmVyYXRlZFBvc2l0aW9uc0ZvcihhQXJncykge1xuICAgICAgLy8gV2hlbiB0aGVyZSBpcyBubyBleGFjdCBtYXRjaCwgU291cmNlTWFwQ29uc3VtZXIucHJvdG90eXBlLl9maW5kTWFwcGluZ1xuICAgICAgLy8gcmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGNsb3Nlc3QgbWFwcGluZyBsZXNzIHRoYW4gdGhlIG5lZWRsZS4gQnlcbiAgICAgIC8vIHNldHRpbmcgbmVlZGxlLm9yaWdpbmFsQ29sdW1uIHRvIEluZmluaXR5LCB3ZSB0aHVzIGZpbmQgdGhlIGxhc3RcbiAgICAgIC8vIG1hcHBpbmcgZm9yIHRoZSBnaXZlbiBsaW5lLCBwcm92aWRlZCBzdWNoIGEgbWFwcGluZyBleGlzdHMuXG4gICAgICB2YXIgbmVlZGxlID0ge1xuICAgICAgICBzb3VyY2U6IHV0aWwuZ2V0QXJnKGFBcmdzLCAnc291cmNlJyksXG4gICAgICAgIG9yaWdpbmFsTGluZTogdXRpbC5nZXRBcmcoYUFyZ3MsICdsaW5lJyksXG4gICAgICAgIG9yaWdpbmFsQ29sdW1uOiBJbmZpbml0eVxuICAgICAgfTtcblxuICAgICAgaWYgKHRoaXMuc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgIG5lZWRsZS5zb3VyY2UgPSB1dGlsLnJlbGF0aXZlKHRoaXMuc291cmNlUm9vdCwgbmVlZGxlLnNvdXJjZSk7XG4gICAgICB9XG5cbiAgICAgIHZhciBtYXBwaW5ncyA9IFtdO1xuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLl9maW5kTWFwcGluZyhuZWVkbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJvcmlnaW5hbExpbmVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwib3JpZ2luYWxDb2x1bW5cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV0aWwuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMpO1xuICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgdmFyIG1hcHBpbmcgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzW2luZGV4XTtcblxuICAgICAgICB3aGlsZSAobWFwcGluZyAmJiBtYXBwaW5nLm9yaWdpbmFsTGluZSA9PT0gbmVlZGxlLm9yaWdpbmFsTGluZSkge1xuICAgICAgICAgIG1hcHBpbmdzLnB1c2goe1xuICAgICAgICAgICAgbGluZTogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZExpbmUnLCBudWxsKSxcbiAgICAgICAgICAgIGNvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2dlbmVyYXRlZENvbHVtbicsIG51bGwpLFxuICAgICAgICAgICAgbGFzdENvbHVtbjogdXRpbC5nZXRBcmcobWFwcGluZywgJ2xhc3RHZW5lcmF0ZWRDb2x1bW4nLCBudWxsKVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgbWFwcGluZyA9IHRoaXMuX29yaWdpbmFsTWFwcGluZ3NbLS1pbmRleF07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1hcHBpbmdzLnJldmVyc2UoKTtcbiAgICB9O1xuXG4gIFNvdXJjZU1hcENvbnN1bWVyLkdFTkVSQVRFRF9PUkRFUiA9IDE7XG4gIFNvdXJjZU1hcENvbnN1bWVyLk9SSUdJTkFMX09SREVSID0gMjtcblxuICAvKipcbiAgICogSXRlcmF0ZSBvdmVyIGVhY2ggbWFwcGluZyBiZXR3ZWVuIGFuIG9yaWdpbmFsIHNvdXJjZS9saW5lL2NvbHVtbiBhbmQgYVxuICAgKiBnZW5lcmF0ZWQgbGluZS9jb2x1bW4gaW4gdGhpcyBzb3VyY2UgbWFwLlxuICAgKlxuICAgKiBAcGFyYW0gRnVuY3Rpb24gYUNhbGxiYWNrXG4gICAqICAgICAgICBUaGUgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2l0aCBlYWNoIG1hcHBpbmcuXG4gICAqIEBwYXJhbSBPYmplY3QgYUNvbnRleHRcbiAgICogICAgICAgIE9wdGlvbmFsLiBJZiBzcGVjaWZpZWQsIHRoaXMgb2JqZWN0IHdpbGwgYmUgdGhlIHZhbHVlIG9mIGB0aGlzYCBldmVyeVxuICAgKiAgICAgICAgdGltZSB0aGF0IGBhQ2FsbGJhY2tgIGlzIGNhbGxlZC5cbiAgICogQHBhcmFtIGFPcmRlclxuICAgKiAgICAgICAgRWl0aGVyIGBTb3VyY2VNYXBDb25zdW1lci5HRU5FUkFURURfT1JERVJgIG9yXG4gICAqICAgICAgICBgU291cmNlTWFwQ29uc3VtZXIuT1JJR0lOQUxfT1JERVJgLiBTcGVjaWZpZXMgd2hldGhlciB5b3Ugd2FudCB0b1xuICAgKiAgICAgICAgaXRlcmF0ZSBvdmVyIHRoZSBtYXBwaW5ncyBzb3J0ZWQgYnkgdGhlIGdlbmVyYXRlZCBmaWxlJ3MgbGluZS9jb2x1bW5cbiAgICogICAgICAgIG9yZGVyIG9yIHRoZSBvcmlnaW5hbCdzIHNvdXJjZS9saW5lL2NvbHVtbiBvcmRlciwgcmVzcGVjdGl2ZWx5LiBEZWZhdWx0cyB0b1xuICAgKiAgICAgICAgYFNvdXJjZU1hcENvbnN1bWVyLkdFTkVSQVRFRF9PUkRFUmAuXG4gICAqL1xuICBTb3VyY2VNYXBDb25zdW1lci5wcm90b3R5cGUuZWFjaE1hcHBpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcENvbnN1bWVyX2VhY2hNYXBwaW5nKGFDYWxsYmFjaywgYUNvbnRleHQsIGFPcmRlcikge1xuICAgICAgdmFyIGNvbnRleHQgPSBhQ29udGV4dCB8fCBudWxsO1xuICAgICAgdmFyIG9yZGVyID0gYU9yZGVyIHx8IFNvdXJjZU1hcENvbnN1bWVyLkdFTkVSQVRFRF9PUkRFUjtcblxuICAgICAgdmFyIG1hcHBpbmdzO1xuICAgICAgc3dpdGNoIChvcmRlcikge1xuICAgICAgY2FzZSBTb3VyY2VNYXBDb25zdW1lci5HRU5FUkFURURfT1JERVI6XG4gICAgICAgIG1hcHBpbmdzID0gdGhpcy5fZ2VuZXJhdGVkTWFwcGluZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTb3VyY2VNYXBDb25zdW1lci5PUklHSU5BTF9PUkRFUjpcbiAgICAgICAgbWFwcGluZ3MgPSB0aGlzLl9vcmlnaW5hbE1hcHBpbmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gb3JkZXIgb2YgaXRlcmF0aW9uLlwiKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHNvdXJjZVJvb3QgPSB0aGlzLnNvdXJjZVJvb3Q7XG4gICAgICBtYXBwaW5ncy5tYXAoZnVuY3Rpb24gKG1hcHBpbmcpIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IG1hcHBpbmcuc291cmNlO1xuICAgICAgICBpZiAoc291cmNlICE9IG51bGwgJiYgc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgICAgc291cmNlID0gdXRpbC5qb2luKHNvdXJjZVJvb3QsIHNvdXJjZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBnZW5lcmF0ZWRMaW5lOiBtYXBwaW5nLmdlbmVyYXRlZExpbmUsXG4gICAgICAgICAgZ2VuZXJhdGVkQ29sdW1uOiBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbixcbiAgICAgICAgICBvcmlnaW5hbExpbmU6IG1hcHBpbmcub3JpZ2luYWxMaW5lLFxuICAgICAgICAgIG9yaWdpbmFsQ29sdW1uOiBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uLFxuICAgICAgICAgIG5hbWU6IG1hcHBpbmcubmFtZVxuICAgICAgICB9O1xuICAgICAgfSkuZm9yRWFjaChhQ2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH07XG5cbiAgZXhwb3J0cy5Tb3VyY2VNYXBDb25zdW1lciA9IFNvdXJjZU1hcENvbnN1bWVyO1xuXG59KTtcbiIsIi8qIC0qLSBNb2RlOiBqczsganMtaW5kZW50LWxldmVsOiAyOyAtKi0gKi9cbi8qXG4gKiBDb3B5cmlnaHQgMjAxMSBNb3ppbGxhIEZvdW5kYXRpb24gYW5kIGNvbnRyaWJ1dG9yc1xuICogTGljZW5zZWQgdW5kZXIgdGhlIE5ldyBCU0QgbGljZW5zZS4gU2VlIExJQ0VOU0Ugb3I6XG4gKiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvQlNELTMtQ2xhdXNlXG4gKi9cbmlmICh0eXBlb2YgZGVmaW5lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdmFyIGRlZmluZSA9IHJlcXVpcmUoJ2FtZGVmaW5lJykobW9kdWxlLCByZXF1aXJlKTtcbn1cbmRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbiAgdmFyIGJhc2U2NFZMUSA9IHJlcXVpcmUoJy4vYmFzZTY0LXZscScpO1xuICB2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuICB2YXIgQXJyYXlTZXQgPSByZXF1aXJlKCcuL2FycmF5LXNldCcpLkFycmF5U2V0O1xuICB2YXIgTWFwcGluZ0xpc3QgPSByZXF1aXJlKCcuL21hcHBpbmctbGlzdCcpLk1hcHBpbmdMaXN0O1xuXG4gIC8qKlxuICAgKiBBbiBpbnN0YW5jZSBvZiB0aGUgU291cmNlTWFwR2VuZXJhdG9yIHJlcHJlc2VudHMgYSBzb3VyY2UgbWFwIHdoaWNoIGlzXG4gICAqIGJlaW5nIGJ1aWx0IGluY3JlbWVudGFsbHkuIFlvdSBtYXkgcGFzcyBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nXG4gICAqIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBmaWxlOiBUaGUgZmlsZW5hbWUgb2YgdGhlIGdlbmVyYXRlZCBzb3VyY2UuXG4gICAqICAgLSBzb3VyY2VSb290OiBBIHJvb3QgZm9yIGFsbCByZWxhdGl2ZSBVUkxzIGluIHRoaXMgc291cmNlIG1hcC5cbiAgICovXG4gIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcihhQXJncykge1xuICAgIGlmICghYUFyZ3MpIHtcbiAgICAgIGFBcmdzID0ge307XG4gICAgfVxuICAgIHRoaXMuX2ZpbGUgPSB1dGlsLmdldEFyZyhhQXJncywgJ2ZpbGUnLCBudWxsKTtcbiAgICB0aGlzLl9zb3VyY2VSb290ID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdzb3VyY2VSb290JywgbnVsbCk7XG4gICAgdGhpcy5fc2tpcFZhbGlkYXRpb24gPSB1dGlsLmdldEFyZyhhQXJncywgJ3NraXBWYWxpZGF0aW9uJywgZmFsc2UpO1xuICAgIHRoaXMuX3NvdXJjZXMgPSBuZXcgQXJyYXlTZXQoKTtcbiAgICB0aGlzLl9uYW1lcyA9IG5ldyBBcnJheVNldCgpO1xuICAgIHRoaXMuX21hcHBpbmdzID0gbmV3IE1hcHBpbmdMaXN0KCk7XG4gICAgdGhpcy5fc291cmNlc0NvbnRlbnRzID0gbnVsbDtcbiAgfVxuXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuX3ZlcnNpb24gPSAzO1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IFNvdXJjZU1hcEdlbmVyYXRvciBiYXNlZCBvbiBhIFNvdXJjZU1hcENvbnN1bWVyXG4gICAqXG4gICAqIEBwYXJhbSBhU291cmNlTWFwQ29uc3VtZXIgVGhlIFNvdXJjZU1hcC5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5mcm9tU291cmNlTWFwID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfZnJvbVNvdXJjZU1hcChhU291cmNlTWFwQ29uc3VtZXIpIHtcbiAgICAgIHZhciBzb3VyY2VSb290ID0gYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZVJvb3Q7XG4gICAgICB2YXIgZ2VuZXJhdG9yID0gbmV3IFNvdXJjZU1hcEdlbmVyYXRvcih7XG4gICAgICAgIGZpbGU6IGFTb3VyY2VNYXBDb25zdW1lci5maWxlLFxuICAgICAgICBzb3VyY2VSb290OiBzb3VyY2VSb290XG4gICAgICB9KTtcbiAgICAgIGFTb3VyY2VNYXBDb25zdW1lci5lYWNoTWFwcGluZyhmdW5jdGlvbiAobWFwcGluZykge1xuICAgICAgICB2YXIgbmV3TWFwcGluZyA9IHtcbiAgICAgICAgICBnZW5lcmF0ZWQ6IHtcbiAgICAgICAgICAgIGxpbmU6IG1hcHBpbmcuZ2VuZXJhdGVkTGluZSxcbiAgICAgICAgICAgIGNvbHVtbjogbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW5cbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG1hcHBpbmcuc291cmNlICE9IG51bGwpIHtcbiAgICAgICAgICBuZXdNYXBwaW5nLnNvdXJjZSA9IG1hcHBpbmcuc291cmNlO1xuICAgICAgICAgIGlmIChzb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICAgIG5ld01hcHBpbmcuc291cmNlID0gdXRpbC5yZWxhdGl2ZShzb3VyY2VSb290LCBuZXdNYXBwaW5nLnNvdXJjZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbmV3TWFwcGluZy5vcmlnaW5hbCA9IHtcbiAgICAgICAgICAgIGxpbmU6IG1hcHBpbmcub3JpZ2luYWxMaW5lLFxuICAgICAgICAgICAgY29sdW1uOiBtYXBwaW5nLm9yaWdpbmFsQ29sdW1uXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChtYXBwaW5nLm5hbWUgIT0gbnVsbCkge1xuICAgICAgICAgICAgbmV3TWFwcGluZy5uYW1lID0gbWFwcGluZy5uYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdlbmVyYXRvci5hZGRNYXBwaW5nKG5ld01hcHBpbmcpO1xuICAgICAgfSk7XG4gICAgICBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzb3VyY2VGaWxlKSB7XG4gICAgICAgIHZhciBjb250ZW50ID0gYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZUNvbnRlbnRGb3Ioc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChjb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBnZW5lcmF0b3Iuc2V0U291cmNlQ29udGVudChzb3VyY2VGaWxlLCBjb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZ2VuZXJhdG9yO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIEFkZCBhIHNpbmdsZSBtYXBwaW5nIGZyb20gb3JpZ2luYWwgc291cmNlIGxpbmUgYW5kIGNvbHVtbiB0byB0aGUgZ2VuZXJhdGVkXG4gICAqIHNvdXJjZSdzIGxpbmUgYW5kIGNvbHVtbiBmb3IgdGhpcyBzb3VyY2UgbWFwIGJlaW5nIGNyZWF0ZWQuIFRoZSBtYXBwaW5nXG4gICAqIG9iamVjdCBzaG91bGQgaGF2ZSB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICAqXG4gICAqICAgLSBnZW5lcmF0ZWQ6IEFuIG9iamVjdCB3aXRoIHRoZSBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uIHBvc2l0aW9ucy5cbiAgICogICAtIG9yaWdpbmFsOiBBbiBvYmplY3Qgd2l0aCB0aGUgb3JpZ2luYWwgbGluZSBhbmQgY29sdW1uIHBvc2l0aW9ucy5cbiAgICogICAtIHNvdXJjZTogVGhlIG9yaWdpbmFsIHNvdXJjZSBmaWxlIChyZWxhdGl2ZSB0byB0aGUgc291cmNlUm9vdCkuXG4gICAqICAgLSBuYW1lOiBBbiBvcHRpb25hbCBvcmlnaW5hbCB0b2tlbiBuYW1lIGZvciB0aGlzIG1hcHBpbmcuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLmFkZE1hcHBpbmcgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU1hcEdlbmVyYXRvcl9hZGRNYXBwaW5nKGFBcmdzKSB7XG4gICAgICB2YXIgZ2VuZXJhdGVkID0gdXRpbC5nZXRBcmcoYUFyZ3MsICdnZW5lcmF0ZWQnKTtcbiAgICAgIHZhciBvcmlnaW5hbCA9IHV0aWwuZ2V0QXJnKGFBcmdzLCAnb3JpZ2luYWwnLCBudWxsKTtcbiAgICAgIHZhciBzb3VyY2UgPSB1dGlsLmdldEFyZyhhQXJncywgJ3NvdXJjZScsIG51bGwpO1xuICAgICAgdmFyIG5hbWUgPSB1dGlsLmdldEFyZyhhQXJncywgJ25hbWUnLCBudWxsKTtcblxuICAgICAgaWYgKCF0aGlzLl9za2lwVmFsaWRhdGlvbikge1xuICAgICAgICB0aGlzLl92YWxpZGF0ZU1hcHBpbmcoZ2VuZXJhdGVkLCBvcmlnaW5hbCwgc291cmNlLCBuYW1lKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNvdXJjZSAhPSBudWxsICYmICF0aGlzLl9zb3VyY2VzLmhhcyhzb3VyY2UpKSB7XG4gICAgICAgIHRoaXMuX3NvdXJjZXMuYWRkKHNvdXJjZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lICE9IG51bGwgJiYgIXRoaXMuX25hbWVzLmhhcyhuYW1lKSkge1xuICAgICAgICB0aGlzLl9uYW1lcy5hZGQobmFtZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX21hcHBpbmdzLmFkZCh7XG4gICAgICAgIGdlbmVyYXRlZExpbmU6IGdlbmVyYXRlZC5saW5lLFxuICAgICAgICBnZW5lcmF0ZWRDb2x1bW46IGdlbmVyYXRlZC5jb2x1bW4sXG4gICAgICAgIG9yaWdpbmFsTGluZTogb3JpZ2luYWwgIT0gbnVsbCAmJiBvcmlnaW5hbC5saW5lLFxuICAgICAgICBvcmlnaW5hbENvbHVtbjogb3JpZ2luYWwgIT0gbnVsbCAmJiBvcmlnaW5hbC5jb2x1bW4sXG4gICAgICAgIHNvdXJjZTogc291cmNlLFxuICAgICAgICBuYW1lOiBuYW1lXG4gICAgICB9KTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgdGhlIHNvdXJjZSBjb250ZW50IGZvciBhIHNvdXJjZSBmaWxlLlxuICAgKi9cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5zZXRTb3VyY2VDb250ZW50ID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3Jfc2V0U291cmNlQ29udGVudChhU291cmNlRmlsZSwgYVNvdXJjZUNvbnRlbnQpIHtcbiAgICAgIHZhciBzb3VyY2UgPSBhU291cmNlRmlsZTtcbiAgICAgIGlmICh0aGlzLl9zb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgc291cmNlID0gdXRpbC5yZWxhdGl2ZSh0aGlzLl9zb3VyY2VSb290LCBzb3VyY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYVNvdXJjZUNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAvLyBBZGQgdGhlIHNvdXJjZSBjb250ZW50IHRvIHRoZSBfc291cmNlc0NvbnRlbnRzIG1hcC5cbiAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IF9zb3VyY2VzQ29udGVudHMgbWFwIGlmIHRoZSBwcm9wZXJ0eSBpcyBudWxsLlxuICAgICAgICBpZiAoIXRoaXMuX3NvdXJjZXNDb250ZW50cykge1xuICAgICAgICAgIHRoaXMuX3NvdXJjZXNDb250ZW50cyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NvdXJjZXNDb250ZW50c1t1dGlsLnRvU2V0U3RyaW5nKHNvdXJjZSldID0gYVNvdXJjZUNvbnRlbnQ7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3NvdXJjZXNDb250ZW50cykge1xuICAgICAgICAvLyBSZW1vdmUgdGhlIHNvdXJjZSBmaWxlIGZyb20gdGhlIF9zb3VyY2VzQ29udGVudHMgbWFwLlxuICAgICAgICAvLyBJZiB0aGUgX3NvdXJjZXNDb250ZW50cyBtYXAgaXMgZW1wdHksIHNldCB0aGUgcHJvcGVydHkgdG8gbnVsbC5cbiAgICAgICAgZGVsZXRlIHRoaXMuX3NvdXJjZXNDb250ZW50c1t1dGlsLnRvU2V0U3RyaW5nKHNvdXJjZSldO1xuICAgICAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fc291cmNlc0NvbnRlbnRzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aGlzLl9zb3VyY2VzQ29udGVudHMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogQXBwbGllcyB0aGUgbWFwcGluZ3Mgb2YgYSBzdWItc291cmNlLW1hcCBmb3IgYSBzcGVjaWZpYyBzb3VyY2UgZmlsZSB0byB0aGVcbiAgICogc291cmNlIG1hcCBiZWluZyBnZW5lcmF0ZWQuIEVhY2ggbWFwcGluZyB0byB0aGUgc3VwcGxpZWQgc291cmNlIGZpbGUgaXNcbiAgICogcmV3cml0dGVuIHVzaW5nIHRoZSBzdXBwbGllZCBzb3VyY2UgbWFwLiBOb3RlOiBUaGUgcmVzb2x1dGlvbiBmb3IgdGhlXG4gICAqIHJlc3VsdGluZyBtYXBwaW5ncyBpcyB0aGUgbWluaW1pdW0gb2YgdGhpcyBtYXAgYW5kIHRoZSBzdXBwbGllZCBtYXAuXG4gICAqXG4gICAqIEBwYXJhbSBhU291cmNlTWFwQ29uc3VtZXIgVGhlIHNvdXJjZSBtYXAgdG8gYmUgYXBwbGllZC5cbiAgICogQHBhcmFtIGFTb3VyY2VGaWxlIE9wdGlvbmFsLiBUaGUgZmlsZW5hbWUgb2YgdGhlIHNvdXJjZSBmaWxlLlxuICAgKiAgICAgICAgSWYgb21pdHRlZCwgU291cmNlTWFwQ29uc3VtZXIncyBmaWxlIHByb3BlcnR5IHdpbGwgYmUgdXNlZC5cbiAgICogQHBhcmFtIGFTb3VyY2VNYXBQYXRoIE9wdGlvbmFsLiBUaGUgZGlybmFtZSBvZiB0aGUgcGF0aCB0byB0aGUgc291cmNlIG1hcFxuICAgKiAgICAgICAgdG8gYmUgYXBwbGllZC4gSWYgcmVsYXRpdmUsIGl0IGlzIHJlbGF0aXZlIHRvIHRoZSBTb3VyY2VNYXBDb25zdW1lci5cbiAgICogICAgICAgIFRoaXMgcGFyYW1ldGVyIGlzIG5lZWRlZCB3aGVuIHRoZSB0d28gc291cmNlIG1hcHMgYXJlbid0IGluIHRoZSBzYW1lXG4gICAqICAgICAgICBkaXJlY3RvcnksIGFuZCB0aGUgc291cmNlIG1hcCB0byBiZSBhcHBsaWVkIGNvbnRhaW5zIHJlbGF0aXZlIHNvdXJjZVxuICAgKiAgICAgICAgcGF0aHMuIElmIHNvLCB0aG9zZSByZWxhdGl2ZSBzb3VyY2UgcGF0aHMgbmVlZCB0byBiZSByZXdyaXR0ZW5cbiAgICogICAgICAgIHJlbGF0aXZlIHRvIHRoZSBTb3VyY2VNYXBHZW5lcmF0b3IuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLmFwcGx5U291cmNlTWFwID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfYXBwbHlTb3VyY2VNYXAoYVNvdXJjZU1hcENvbnN1bWVyLCBhU291cmNlRmlsZSwgYVNvdXJjZU1hcFBhdGgpIHtcbiAgICAgIHZhciBzb3VyY2VGaWxlID0gYVNvdXJjZUZpbGU7XG4gICAgICAvLyBJZiBhU291cmNlRmlsZSBpcyBvbWl0dGVkLCB3ZSB3aWxsIHVzZSB0aGUgZmlsZSBwcm9wZXJ0eSBvZiB0aGUgU291cmNlTWFwXG4gICAgICBpZiAoYVNvdXJjZUZpbGUgPT0gbnVsbCkge1xuICAgICAgICBpZiAoYVNvdXJjZU1hcENvbnN1bWVyLmZpbGUgPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLmFwcGx5U291cmNlTWFwIHJlcXVpcmVzIGVpdGhlciBhbiBleHBsaWNpdCBzb3VyY2UgZmlsZSwgJyArXG4gICAgICAgICAgICAnb3IgdGhlIHNvdXJjZSBtYXBcXCdzIFwiZmlsZVwiIHByb3BlcnR5LiBCb3RoIHdlcmUgb21pdHRlZC4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VGaWxlID0gYVNvdXJjZU1hcENvbnN1bWVyLmZpbGU7XG4gICAgICB9XG4gICAgICB2YXIgc291cmNlUm9vdCA9IHRoaXMuX3NvdXJjZVJvb3Q7XG4gICAgICAvLyBNYWtlIFwic291cmNlRmlsZVwiIHJlbGF0aXZlIGlmIGFuIGFic29sdXRlIFVybCBpcyBwYXNzZWQuXG4gICAgICBpZiAoc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgIHNvdXJjZUZpbGUgPSB1dGlsLnJlbGF0aXZlKHNvdXJjZVJvb3QsIHNvdXJjZUZpbGUpO1xuICAgICAgfVxuICAgICAgLy8gQXBwbHlpbmcgdGhlIFNvdXJjZU1hcCBjYW4gYWRkIGFuZCByZW1vdmUgaXRlbXMgZnJvbSB0aGUgc291cmNlcyBhbmRcbiAgICAgIC8vIHRoZSBuYW1lcyBhcnJheS5cbiAgICAgIHZhciBuZXdTb3VyY2VzID0gbmV3IEFycmF5U2V0KCk7XG4gICAgICB2YXIgbmV3TmFtZXMgPSBuZXcgQXJyYXlTZXQoKTtcblxuICAgICAgLy8gRmluZCBtYXBwaW5ncyBmb3IgdGhlIFwic291cmNlRmlsZVwiXG4gICAgICB0aGlzLl9tYXBwaW5ncy51bnNvcnRlZEZvckVhY2goZnVuY3Rpb24gKG1hcHBpbmcpIHtcbiAgICAgICAgaWYgKG1hcHBpbmcuc291cmNlID09PSBzb3VyY2VGaWxlICYmIG1hcHBpbmcub3JpZ2luYWxMaW5lICE9IG51bGwpIHtcbiAgICAgICAgICAvLyBDaGVjayBpZiBpdCBjYW4gYmUgbWFwcGVkIGJ5IHRoZSBzb3VyY2UgbWFwLCB0aGVuIHVwZGF0ZSB0aGUgbWFwcGluZy5cbiAgICAgICAgICB2YXIgb3JpZ2luYWwgPSBhU291cmNlTWFwQ29uc3VtZXIub3JpZ2luYWxQb3NpdGlvbkZvcih7XG4gICAgICAgICAgICBsaW5lOiBtYXBwaW5nLm9yaWdpbmFsTGluZSxcbiAgICAgICAgICAgIGNvbHVtbjogbWFwcGluZy5vcmlnaW5hbENvbHVtblxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChvcmlnaW5hbC5zb3VyY2UgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gQ29weSBtYXBwaW5nXG4gICAgICAgICAgICBtYXBwaW5nLnNvdXJjZSA9IG9yaWdpbmFsLnNvdXJjZTtcbiAgICAgICAgICAgIGlmIChhU291cmNlTWFwUGF0aCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIG1hcHBpbmcuc291cmNlID0gdXRpbC5qb2luKGFTb3VyY2VNYXBQYXRoLCBtYXBwaW5nLnNvdXJjZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbWFwcGluZy5zb3VyY2UgPSB1dGlsLnJlbGF0aXZlKHNvdXJjZVJvb3QsIG1hcHBpbmcuc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxMaW5lID0gb3JpZ2luYWwubGluZTtcbiAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxDb2x1bW4gPSBvcmlnaW5hbC5jb2x1bW47XG4gICAgICAgICAgICBpZiAob3JpZ2luYWwubmFtZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIG1hcHBpbmcubmFtZSA9IG9yaWdpbmFsLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNvdXJjZSA9IG1hcHBpbmcuc291cmNlO1xuICAgICAgICBpZiAoc291cmNlICE9IG51bGwgJiYgIW5ld1NvdXJjZXMuaGFzKHNvdXJjZSkpIHtcbiAgICAgICAgICBuZXdTb3VyY2VzLmFkZChzb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5hbWUgPSBtYXBwaW5nLm5hbWU7XG4gICAgICAgIGlmIChuYW1lICE9IG51bGwgJiYgIW5ld05hbWVzLmhhcyhuYW1lKSkge1xuICAgICAgICAgIG5ld05hbWVzLmFkZChuYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICB9LCB0aGlzKTtcbiAgICAgIHRoaXMuX3NvdXJjZXMgPSBuZXdTb3VyY2VzO1xuICAgICAgdGhpcy5fbmFtZXMgPSBuZXdOYW1lcztcblxuICAgICAgLy8gQ29weSBzb3VyY2VzQ29udGVudHMgb2YgYXBwbGllZCBtYXAuXG4gICAgICBhU291cmNlTWFwQ29uc3VtZXIuc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzb3VyY2VGaWxlKSB7XG4gICAgICAgIHZhciBjb250ZW50ID0gYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZUNvbnRlbnRGb3Ioc291cmNlRmlsZSk7XG4gICAgICAgIGlmIChjb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoYVNvdXJjZU1hcFBhdGggIT0gbnVsbCkge1xuICAgICAgICAgICAgc291cmNlRmlsZSA9IHV0aWwuam9pbihhU291cmNlTWFwUGF0aCwgc291cmNlRmlsZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzb3VyY2VSb290ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNvdXJjZUZpbGUgPSB1dGlsLnJlbGF0aXZlKHNvdXJjZVJvb3QsIHNvdXJjZUZpbGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnNldFNvdXJjZUNvbnRlbnQoc291cmNlRmlsZSwgY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgIH0sIHRoaXMpO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIEEgbWFwcGluZyBjYW4gaGF2ZSBvbmUgb2YgdGhlIHRocmVlIGxldmVscyBvZiBkYXRhOlxuICAgKlxuICAgKiAgIDEuIEp1c3QgdGhlIGdlbmVyYXRlZCBwb3NpdGlvbi5cbiAgICogICAyLiBUaGUgR2VuZXJhdGVkIHBvc2l0aW9uLCBvcmlnaW5hbCBwb3NpdGlvbiwgYW5kIG9yaWdpbmFsIHNvdXJjZS5cbiAgICogICAzLiBHZW5lcmF0ZWQgYW5kIG9yaWdpbmFsIHBvc2l0aW9uLCBvcmlnaW5hbCBzb3VyY2UsIGFzIHdlbGwgYXMgYSBuYW1lXG4gICAqICAgICAgdG9rZW4uXG4gICAqXG4gICAqIFRvIG1haW50YWluIGNvbnNpc3RlbmN5LCB3ZSB2YWxpZGF0ZSB0aGF0IGFueSBuZXcgbWFwcGluZyBiZWluZyBhZGRlZCBmYWxsc1xuICAgKiBpbiB0byBvbmUgb2YgdGhlc2UgY2F0ZWdvcmllcy5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUuX3ZhbGlkYXRlTWFwcGluZyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX3ZhbGlkYXRlTWFwcGluZyhhR2VuZXJhdGVkLCBhT3JpZ2luYWwsIGFTb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhTmFtZSkge1xuICAgICAgaWYgKGFHZW5lcmF0ZWQgJiYgJ2xpbmUnIGluIGFHZW5lcmF0ZWQgJiYgJ2NvbHVtbicgaW4gYUdlbmVyYXRlZFxuICAgICAgICAgICYmIGFHZW5lcmF0ZWQubGluZSA+IDAgJiYgYUdlbmVyYXRlZC5jb2x1bW4gPj0gMFxuICAgICAgICAgICYmICFhT3JpZ2luYWwgJiYgIWFTb3VyY2UgJiYgIWFOYW1lKSB7XG4gICAgICAgIC8vIENhc2UgMS5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoYUdlbmVyYXRlZCAmJiAnbGluZScgaW4gYUdlbmVyYXRlZCAmJiAnY29sdW1uJyBpbiBhR2VuZXJhdGVkXG4gICAgICAgICAgICAgICAmJiBhT3JpZ2luYWwgJiYgJ2xpbmUnIGluIGFPcmlnaW5hbCAmJiAnY29sdW1uJyBpbiBhT3JpZ2luYWxcbiAgICAgICAgICAgICAgICYmIGFHZW5lcmF0ZWQubGluZSA+IDAgJiYgYUdlbmVyYXRlZC5jb2x1bW4gPj0gMFxuICAgICAgICAgICAgICAgJiYgYU9yaWdpbmFsLmxpbmUgPiAwICYmIGFPcmlnaW5hbC5jb2x1bW4gPj0gMFxuICAgICAgICAgICAgICAgJiYgYVNvdXJjZSkge1xuICAgICAgICAvLyBDYXNlcyAyIGFuZCAzLlxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG1hcHBpbmc6ICcgKyBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgZ2VuZXJhdGVkOiBhR2VuZXJhdGVkLFxuICAgICAgICAgIHNvdXJjZTogYVNvdXJjZSxcbiAgICAgICAgICBvcmlnaW5hbDogYU9yaWdpbmFsLFxuICAgICAgICAgIG5hbWU6IGFOYW1lXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gIC8qKlxuICAgKiBTZXJpYWxpemUgdGhlIGFjY3VtdWxhdGVkIG1hcHBpbmdzIGluIHRvIHRoZSBzdHJlYW0gb2YgYmFzZSA2NCBWTFFzXG4gICAqIHNwZWNpZmllZCBieSB0aGUgc291cmNlIG1hcCBmb3JtYXQuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLl9zZXJpYWxpemVNYXBwaW5ncyA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX3NlcmlhbGl6ZU1hcHBpbmdzKCkge1xuICAgICAgdmFyIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gMDtcbiAgICAgIHZhciBwcmV2aW91c0dlbmVyYXRlZExpbmUgPSAxO1xuICAgICAgdmFyIHByZXZpb3VzT3JpZ2luYWxDb2x1bW4gPSAwO1xuICAgICAgdmFyIHByZXZpb3VzT3JpZ2luYWxMaW5lID0gMDtcbiAgICAgIHZhciBwcmV2aW91c05hbWUgPSAwO1xuICAgICAgdmFyIHByZXZpb3VzU291cmNlID0gMDtcbiAgICAgIHZhciByZXN1bHQgPSAnJztcbiAgICAgIHZhciBtYXBwaW5nO1xuXG4gICAgICB2YXIgbWFwcGluZ3MgPSB0aGlzLl9tYXBwaW5ncy50b0FycmF5KCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBtYXBwaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBtYXBwaW5nID0gbWFwcGluZ3NbaV07XG5cbiAgICAgICAgaWYgKG1hcHBpbmcuZ2VuZXJhdGVkTGluZSAhPT0gcHJldmlvdXNHZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgcHJldmlvdXNHZW5lcmF0ZWRDb2x1bW4gPSAwO1xuICAgICAgICAgIHdoaWxlIChtYXBwaW5nLmdlbmVyYXRlZExpbmUgIT09IHByZXZpb3VzR2VuZXJhdGVkTGluZSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9ICc7JztcbiAgICAgICAgICAgIHByZXZpb3VzR2VuZXJhdGVkTGluZSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgIGlmICghdXRpbC5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMobWFwcGluZywgbWFwcGluZ3NbaSAtIDFdKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdCArPSAnLCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0ICs9IGJhc2U2NFZMUS5lbmNvZGUobWFwcGluZy5nZW5lcmF0ZWRDb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLSBwcmV2aW91c0dlbmVyYXRlZENvbHVtbik7XG4gICAgICAgIHByZXZpb3VzR2VuZXJhdGVkQ29sdW1uID0gbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW47XG5cbiAgICAgICAgaWYgKG1hcHBpbmcuc291cmNlICE9IG51bGwpIHtcbiAgICAgICAgICByZXN1bHQgKz0gYmFzZTY0VkxRLmVuY29kZSh0aGlzLl9zb3VyY2VzLmluZGV4T2YobWFwcGluZy5zb3VyY2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLSBwcmV2aW91c1NvdXJjZSk7XG4gICAgICAgICAgcHJldmlvdXNTb3VyY2UgPSB0aGlzLl9zb3VyY2VzLmluZGV4T2YobWFwcGluZy5zb3VyY2UpO1xuXG4gICAgICAgICAgLy8gbGluZXMgYXJlIHN0b3JlZCAwLWJhc2VkIGluIFNvdXJjZU1hcCBzcGVjIHZlcnNpb24gM1xuICAgICAgICAgIHJlc3VsdCArPSBiYXNlNjRWTFEuZW5jb2RlKG1hcHBpbmcub3JpZ2luYWxMaW5lIC0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gcHJldmlvdXNPcmlnaW5hbExpbmUpO1xuICAgICAgICAgIHByZXZpb3VzT3JpZ2luYWxMaW5lID0gbWFwcGluZy5vcmlnaW5hbExpbmUgLSAxO1xuXG4gICAgICAgICAgcmVzdWx0ICs9IGJhc2U2NFZMUS5lbmNvZGUobWFwcGluZy5vcmlnaW5hbENvbHVtblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0gcHJldmlvdXNPcmlnaW5hbENvbHVtbik7XG4gICAgICAgICAgcHJldmlvdXNPcmlnaW5hbENvbHVtbiA9IG1hcHBpbmcub3JpZ2luYWxDb2x1bW47XG5cbiAgICAgICAgICBpZiAobWFwcGluZy5uYW1lICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBiYXNlNjRWTFEuZW5jb2RlKHRoaXMuX25hbWVzLmluZGV4T2YobWFwcGluZy5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLSBwcmV2aW91c05hbWUpO1xuICAgICAgICAgICAgcHJldmlvdXNOYW1lID0gdGhpcy5fbmFtZXMuaW5kZXhPZihtYXBwaW5nLm5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgU291cmNlTWFwR2VuZXJhdG9yLnByb3RvdHlwZS5fZ2VuZXJhdGVTb3VyY2VzQ29udGVudCA9XG4gICAgZnVuY3Rpb24gU291cmNlTWFwR2VuZXJhdG9yX2dlbmVyYXRlU291cmNlc0NvbnRlbnQoYVNvdXJjZXMsIGFTb3VyY2VSb290KSB7XG4gICAgICByZXR1cm4gYVNvdXJjZXMubWFwKGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VyY2VzQ29udGVudHMpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYVNvdXJjZVJvb3QgIT0gbnVsbCkge1xuICAgICAgICAgIHNvdXJjZSA9IHV0aWwucmVsYXRpdmUoYVNvdXJjZVJvb3QsIHNvdXJjZSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGtleSA9IHV0aWwudG9TZXRTdHJpbmcoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLl9zb3VyY2VzQ29udGVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5KVxuICAgICAgICAgID8gdGhpcy5fc291cmNlc0NvbnRlbnRzW2tleV1cbiAgICAgICAgICA6IG51bGw7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBFeHRlcm5hbGl6ZSB0aGUgc291cmNlIG1hcC5cbiAgICovXG4gIFNvdXJjZU1hcEdlbmVyYXRvci5wcm90b3R5cGUudG9KU09OID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfdG9KU09OKCkge1xuICAgICAgdmFyIG1hcCA9IHtcbiAgICAgICAgdmVyc2lvbjogdGhpcy5fdmVyc2lvbixcbiAgICAgICAgc291cmNlczogdGhpcy5fc291cmNlcy50b0FycmF5KCksXG4gICAgICAgIG5hbWVzOiB0aGlzLl9uYW1lcy50b0FycmF5KCksXG4gICAgICAgIG1hcHBpbmdzOiB0aGlzLl9zZXJpYWxpemVNYXBwaW5ncygpXG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2ZpbGUgIT0gbnVsbCkge1xuICAgICAgICBtYXAuZmlsZSA9IHRoaXMuX2ZpbGU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fc291cmNlUm9vdCAhPSBudWxsKSB7XG4gICAgICAgIG1hcC5zb3VyY2VSb290ID0gdGhpcy5fc291cmNlUm9vdDtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9zb3VyY2VzQ29udGVudHMpIHtcbiAgICAgICAgbWFwLnNvdXJjZXNDb250ZW50ID0gdGhpcy5fZ2VuZXJhdGVTb3VyY2VzQ29udGVudChtYXAuc291cmNlcywgbWFwLnNvdXJjZVJvb3QpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWFwO1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlciB0aGUgc291cmNlIG1hcCBiZWluZyBnZW5lcmF0ZWQgdG8gYSBzdHJpbmcuXG4gICAqL1xuICBTb3VyY2VNYXBHZW5lcmF0b3IucHJvdG90eXBlLnRvU3RyaW5nID1cbiAgICBmdW5jdGlvbiBTb3VyY2VNYXBHZW5lcmF0b3JfdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgfTtcblxuICBleHBvcnRzLlNvdXJjZU1hcEdlbmVyYXRvciA9IFNvdXJjZU1hcEdlbmVyYXRvcjtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIHZhciBTb3VyY2VNYXBHZW5lcmF0b3IgPSByZXF1aXJlKCcuL3NvdXJjZS1tYXAtZ2VuZXJhdG9yJykuU291cmNlTWFwR2VuZXJhdG9yO1xuICB2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4gIC8vIE1hdGNoZXMgYSBXaW5kb3dzLXN0eWxlIGBcXHJcXG5gIG5ld2xpbmUgb3IgYSBgXFxuYCBuZXdsaW5lIHVzZWQgYnkgYWxsIG90aGVyXG4gIC8vIG9wZXJhdGluZyBzeXN0ZW1zIHRoZXNlIGRheXMgKGNhcHR1cmluZyB0aGUgcmVzdWx0KS5cbiAgdmFyIFJFR0VYX05FV0xJTkUgPSAvKFxccj9cXG4pLztcblxuICAvLyBOZXdsaW5lIGNoYXJhY3RlciBjb2RlIGZvciBjaGFyQ29kZUF0KCkgY29tcGFyaXNvbnNcbiAgdmFyIE5FV0xJTkVfQ09ERSA9IDEwO1xuXG4gIC8vIFByaXZhdGUgc3ltYm9sIGZvciBpZGVudGlmeWluZyBgU291cmNlTm9kZWBzIHdoZW4gbXVsdGlwbGUgdmVyc2lvbnMgb2ZcbiAgLy8gdGhlIHNvdXJjZS1tYXAgbGlicmFyeSBhcmUgbG9hZGVkLiBUaGlzIE1VU1QgTk9UIENIQU5HRSBhY3Jvc3NcbiAgLy8gdmVyc2lvbnMhXG4gIHZhciBpc1NvdXJjZU5vZGUgPSBcIiQkJGlzU291cmNlTm9kZSQkJFwiO1xuXG4gIC8qKlxuICAgKiBTb3VyY2VOb2RlcyBwcm92aWRlIGEgd2F5IHRvIGFic3RyYWN0IG92ZXIgaW50ZXJwb2xhdGluZy9jb25jYXRlbmF0aW5nXG4gICAqIHNuaXBwZXRzIG9mIGdlbmVyYXRlZCBKYXZhU2NyaXB0IHNvdXJjZSBjb2RlIHdoaWxlIG1haW50YWluaW5nIHRoZSBsaW5lIGFuZFxuICAgKiBjb2x1bW4gaW5mb3JtYXRpb24gYXNzb2NpYXRlZCB3aXRoIHRoZSBvcmlnaW5hbCBzb3VyY2UgY29kZS5cbiAgICpcbiAgICogQHBhcmFtIGFMaW5lIFRoZSBvcmlnaW5hbCBsaW5lIG51bWJlci5cbiAgICogQHBhcmFtIGFDb2x1bW4gVGhlIG9yaWdpbmFsIGNvbHVtbiBudW1iZXIuXG4gICAqIEBwYXJhbSBhU291cmNlIFRoZSBvcmlnaW5hbCBzb3VyY2UncyBmaWxlbmFtZS5cbiAgICogQHBhcmFtIGFDaHVua3MgT3B0aW9uYWwuIEFuIGFycmF5IG9mIHN0cmluZ3Mgd2hpY2ggYXJlIHNuaXBwZXRzIG9mXG4gICAqICAgICAgICBnZW5lcmF0ZWQgSlMsIG9yIG90aGVyIFNvdXJjZU5vZGVzLlxuICAgKiBAcGFyYW0gYU5hbWUgVGhlIG9yaWdpbmFsIGlkZW50aWZpZXIuXG4gICAqL1xuICBmdW5jdGlvbiBTb3VyY2VOb2RlKGFMaW5lLCBhQ29sdW1uLCBhU291cmNlLCBhQ2h1bmtzLCBhTmFtZSkge1xuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNvbnRlbnRzID0ge307XG4gICAgdGhpcy5saW5lID0gYUxpbmUgPT0gbnVsbCA/IG51bGwgOiBhTGluZTtcbiAgICB0aGlzLmNvbHVtbiA9IGFDb2x1bW4gPT0gbnVsbCA/IG51bGwgOiBhQ29sdW1uO1xuICAgIHRoaXMuc291cmNlID0gYVNvdXJjZSA9PSBudWxsID8gbnVsbCA6IGFTb3VyY2U7XG4gICAgdGhpcy5uYW1lID0gYU5hbWUgPT0gbnVsbCA/IG51bGwgOiBhTmFtZTtcbiAgICB0aGlzW2lzU291cmNlTm9kZV0gPSB0cnVlO1xuICAgIGlmIChhQ2h1bmtzICE9IG51bGwpIHRoaXMuYWRkKGFDaHVua3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBTb3VyY2VOb2RlIGZyb20gZ2VuZXJhdGVkIGNvZGUgYW5kIGEgU291cmNlTWFwQ29uc3VtZXIuXG4gICAqXG4gICAqIEBwYXJhbSBhR2VuZXJhdGVkQ29kZSBUaGUgZ2VuZXJhdGVkIGNvZGVcbiAgICogQHBhcmFtIGFTb3VyY2VNYXBDb25zdW1lciBUaGUgU291cmNlTWFwIGZvciB0aGUgZ2VuZXJhdGVkIGNvZGVcbiAgICogQHBhcmFtIGFSZWxhdGl2ZVBhdGggT3B0aW9uYWwuIFRoZSBwYXRoIHRoYXQgcmVsYXRpdmUgc291cmNlcyBpbiB0aGVcbiAgICogICAgICAgIFNvdXJjZU1hcENvbnN1bWVyIHNob3VsZCBiZSByZWxhdGl2ZSB0by5cbiAgICovXG4gIFNvdXJjZU5vZGUuZnJvbVN0cmluZ1dpdGhTb3VyY2VNYXAgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU5vZGVfZnJvbVN0cmluZ1dpdGhTb3VyY2VNYXAoYUdlbmVyYXRlZENvZGUsIGFTb3VyY2VNYXBDb25zdW1lciwgYVJlbGF0aXZlUGF0aCkge1xuICAgICAgLy8gVGhlIFNvdXJjZU5vZGUgd2Ugd2FudCB0byBmaWxsIHdpdGggdGhlIGdlbmVyYXRlZCBjb2RlXG4gICAgICAvLyBhbmQgdGhlIFNvdXJjZU1hcFxuICAgICAgdmFyIG5vZGUgPSBuZXcgU291cmNlTm9kZSgpO1xuXG4gICAgICAvLyBBbGwgZXZlbiBpbmRpY2VzIG9mIHRoaXMgYXJyYXkgYXJlIG9uZSBsaW5lIG9mIHRoZSBnZW5lcmF0ZWQgY29kZSxcbiAgICAgIC8vIHdoaWxlIGFsbCBvZGQgaW5kaWNlcyBhcmUgdGhlIG5ld2xpbmVzIGJldHdlZW4gdHdvIGFkamFjZW50IGxpbmVzXG4gICAgICAvLyAoc2luY2UgYFJFR0VYX05FV0xJTkVgIGNhcHR1cmVzIGl0cyBtYXRjaCkuXG4gICAgICAvLyBQcm9jZXNzZWQgZnJhZ21lbnRzIGFyZSByZW1vdmVkIGZyb20gdGhpcyBhcnJheSwgYnkgY2FsbGluZyBgc2hpZnROZXh0TGluZWAuXG4gICAgICB2YXIgcmVtYWluaW5nTGluZXMgPSBhR2VuZXJhdGVkQ29kZS5zcGxpdChSRUdFWF9ORVdMSU5FKTtcbiAgICAgIHZhciBzaGlmdE5leHRMaW5lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBsaW5lQ29udGVudHMgPSByZW1haW5pbmdMaW5lcy5zaGlmdCgpO1xuICAgICAgICAvLyBUaGUgbGFzdCBsaW5lIG9mIGEgZmlsZSBtaWdodCBub3QgaGF2ZSBhIG5ld2xpbmUuXG4gICAgICAgIHZhciBuZXdMaW5lID0gcmVtYWluaW5nTGluZXMuc2hpZnQoKSB8fCBcIlwiO1xuICAgICAgICByZXR1cm4gbGluZUNvbnRlbnRzICsgbmV3TGluZTtcbiAgICAgIH07XG5cbiAgICAgIC8vIFdlIG5lZWQgdG8gcmVtZW1iZXIgdGhlIHBvc2l0aW9uIG9mIFwicmVtYWluaW5nTGluZXNcIlxuICAgICAgdmFyIGxhc3RHZW5lcmF0ZWRMaW5lID0gMSwgbGFzdEdlbmVyYXRlZENvbHVtbiA9IDA7XG5cbiAgICAgIC8vIFRoZSBnZW5lcmF0ZSBTb3VyY2VOb2RlcyB3ZSBuZWVkIGEgY29kZSByYW5nZS5cbiAgICAgIC8vIFRvIGV4dHJhY3QgaXQgY3VycmVudCBhbmQgbGFzdCBtYXBwaW5nIGlzIHVzZWQuXG4gICAgICAvLyBIZXJlIHdlIHN0b3JlIHRoZSBsYXN0IG1hcHBpbmcuXG4gICAgICB2YXIgbGFzdE1hcHBpbmcgPSBudWxsO1xuXG4gICAgICBhU291cmNlTWFwQ29uc3VtZXIuZWFjaE1hcHBpbmcoZnVuY3Rpb24gKG1hcHBpbmcpIHtcbiAgICAgICAgaWYgKGxhc3RNYXBwaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gV2UgYWRkIHRoZSBjb2RlIGZyb20gXCJsYXN0TWFwcGluZ1wiIHRvIFwibWFwcGluZ1wiOlxuICAgICAgICAgIC8vIEZpcnN0IGNoZWNrIGlmIHRoZXJlIGlzIGEgbmV3IGxpbmUgaW4gYmV0d2Vlbi5cbiAgICAgICAgICBpZiAobGFzdEdlbmVyYXRlZExpbmUgPCBtYXBwaW5nLmdlbmVyYXRlZExpbmUpIHtcbiAgICAgICAgICAgIHZhciBjb2RlID0gXCJcIjtcbiAgICAgICAgICAgIC8vIEFzc29jaWF0ZSBmaXJzdCBsaW5lIHdpdGggXCJsYXN0TWFwcGluZ1wiXG4gICAgICAgICAgICBhZGRNYXBwaW5nV2l0aENvZGUobGFzdE1hcHBpbmcsIHNoaWZ0TmV4dExpbmUoKSk7XG4gICAgICAgICAgICBsYXN0R2VuZXJhdGVkTGluZSsrO1xuICAgICAgICAgICAgbGFzdEdlbmVyYXRlZENvbHVtbiA9IDA7XG4gICAgICAgICAgICAvLyBUaGUgcmVtYWluaW5nIGNvZGUgaXMgYWRkZWQgd2l0aG91dCBtYXBwaW5nXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZXJlIGlzIG5vIG5ldyBsaW5lIGluIGJldHdlZW4uXG4gICAgICAgICAgICAvLyBBc3NvY2lhdGUgdGhlIGNvZGUgYmV0d2VlbiBcImxhc3RHZW5lcmF0ZWRDb2x1bW5cIiBhbmRcbiAgICAgICAgICAgIC8vIFwibWFwcGluZy5nZW5lcmF0ZWRDb2x1bW5cIiB3aXRoIFwibGFzdE1hcHBpbmdcIlxuICAgICAgICAgICAgdmFyIG5leHRMaW5lID0gcmVtYWluaW5nTGluZXNbMF07XG4gICAgICAgICAgICB2YXIgY29kZSA9IG5leHRMaW5lLnN1YnN0cigwLCBtYXBwaW5nLmdlbmVyYXRlZENvbHVtbiAtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0R2VuZXJhdGVkQ29sdW1uKTtcbiAgICAgICAgICAgIHJlbWFpbmluZ0xpbmVzWzBdID0gbmV4dExpbmUuc3Vic3RyKG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uIC1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RHZW5lcmF0ZWRDb2x1bW4pO1xuICAgICAgICAgICAgbGFzdEdlbmVyYXRlZENvbHVtbiA9IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uO1xuICAgICAgICAgICAgYWRkTWFwcGluZ1dpdGhDb2RlKGxhc3RNYXBwaW5nLCBjb2RlKTtcbiAgICAgICAgICAgIC8vIE5vIG1vcmUgcmVtYWluaW5nIGNvZGUsIGNvbnRpbnVlXG4gICAgICAgICAgICBsYXN0TWFwcGluZyA9IG1hcHBpbmc7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFdlIGFkZCB0aGUgZ2VuZXJhdGVkIGNvZGUgdW50aWwgdGhlIGZpcnN0IG1hcHBpbmdcbiAgICAgICAgLy8gdG8gdGhlIFNvdXJjZU5vZGUgd2l0aG91dCBhbnkgbWFwcGluZy5cbiAgICAgICAgLy8gRWFjaCBsaW5lIGlzIGFkZGVkIGFzIHNlcGFyYXRlIHN0cmluZy5cbiAgICAgICAgd2hpbGUgKGxhc3RHZW5lcmF0ZWRMaW5lIDwgbWFwcGluZy5nZW5lcmF0ZWRMaW5lKSB7XG4gICAgICAgICAgbm9kZS5hZGQoc2hpZnROZXh0TGluZSgpKTtcbiAgICAgICAgICBsYXN0R2VuZXJhdGVkTGluZSsrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsYXN0R2VuZXJhdGVkQ29sdW1uIDwgbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4pIHtcbiAgICAgICAgICB2YXIgbmV4dExpbmUgPSByZW1haW5pbmdMaW5lc1swXTtcbiAgICAgICAgICBub2RlLmFkZChuZXh0TGluZS5zdWJzdHIoMCwgbWFwcGluZy5nZW5lcmF0ZWRDb2x1bW4pKTtcbiAgICAgICAgICByZW1haW5pbmdMaW5lc1swXSA9IG5leHRMaW5lLnN1YnN0cihtYXBwaW5nLmdlbmVyYXRlZENvbHVtbik7XG4gICAgICAgICAgbGFzdEdlbmVyYXRlZENvbHVtbiA9IG1hcHBpbmcuZ2VuZXJhdGVkQ29sdW1uO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RNYXBwaW5nID0gbWFwcGluZztcbiAgICAgIH0sIHRoaXMpO1xuICAgICAgLy8gV2UgaGF2ZSBwcm9jZXNzZWQgYWxsIG1hcHBpbmdzLlxuICAgICAgaWYgKHJlbWFpbmluZ0xpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaWYgKGxhc3RNYXBwaW5nKSB7XG4gICAgICAgICAgLy8gQXNzb2NpYXRlIHRoZSByZW1haW5pbmcgY29kZSBpbiB0aGUgY3VycmVudCBsaW5lIHdpdGggXCJsYXN0TWFwcGluZ1wiXG4gICAgICAgICAgYWRkTWFwcGluZ1dpdGhDb2RlKGxhc3RNYXBwaW5nLCBzaGlmdE5leHRMaW5lKCkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFuZCBhZGQgdGhlIHJlbWFpbmluZyBsaW5lcyB3aXRob3V0IGFueSBtYXBwaW5nXG4gICAgICAgIG5vZGUuYWRkKHJlbWFpbmluZ0xpbmVzLmpvaW4oXCJcIikpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb3B5IHNvdXJjZXNDb250ZW50IGludG8gU291cmNlTm9kZVxuICAgICAgYVNvdXJjZU1hcENvbnN1bWVyLnNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbiAoc291cmNlRmlsZSkge1xuICAgICAgICB2YXIgY29udGVudCA9IGFTb3VyY2VNYXBDb25zdW1lci5zb3VyY2VDb250ZW50Rm9yKHNvdXJjZUZpbGUpO1xuICAgICAgICBpZiAoY29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKGFSZWxhdGl2ZVBhdGggIT0gbnVsbCkge1xuICAgICAgICAgICAgc291cmNlRmlsZSA9IHV0aWwuam9pbihhUmVsYXRpdmVQYXRoLCBzb3VyY2VGaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbm9kZS5zZXRTb3VyY2VDb250ZW50KHNvdXJjZUZpbGUsIGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIG5vZGU7XG5cbiAgICAgIGZ1bmN0aW9uIGFkZE1hcHBpbmdXaXRoQ29kZShtYXBwaW5nLCBjb2RlKSB7XG4gICAgICAgIGlmIChtYXBwaW5nID09PSBudWxsIHx8IG1hcHBpbmcuc291cmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBub2RlLmFkZChjb2RlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgc291cmNlID0gYVJlbGF0aXZlUGF0aFxuICAgICAgICAgICAgPyB1dGlsLmpvaW4oYVJlbGF0aXZlUGF0aCwgbWFwcGluZy5zb3VyY2UpXG4gICAgICAgICAgICA6IG1hcHBpbmcuc291cmNlO1xuICAgICAgICAgIG5vZGUuYWRkKG5ldyBTb3VyY2VOb2RlKG1hcHBpbmcub3JpZ2luYWxMaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcHBpbmcub3JpZ2luYWxDb2x1bW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwcGluZy5uYW1lKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgYSBjaHVuayBvZiBnZW5lcmF0ZWQgSlMgdG8gdGhpcyBzb3VyY2Ugbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIGFDaHVuayBBIHN0cmluZyBzbmlwcGV0IG9mIGdlbmVyYXRlZCBKUyBjb2RlLCBhbm90aGVyIGluc3RhbmNlIG9mXG4gICAqICAgICAgICBTb3VyY2VOb2RlLCBvciBhbiBhcnJheSB3aGVyZSBlYWNoIG1lbWJlciBpcyBvbmUgb2YgdGhvc2UgdGhpbmdzLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gU291cmNlTm9kZV9hZGQoYUNodW5rKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYUNodW5rKSkge1xuICAgICAgYUNodW5rLmZvckVhY2goZnVuY3Rpb24gKGNodW5rKSB7XG4gICAgICAgIHRoaXMuYWRkKGNodW5rKTtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cbiAgICBlbHNlIGlmIChhQ2h1bmtbaXNTb3VyY2VOb2RlXSB8fCB0eXBlb2YgYUNodW5rID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBpZiAoYUNodW5rKSB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChhQ2h1bmspO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIFwiRXhwZWN0ZWQgYSBTb3VyY2VOb2RlLCBzdHJpbmcsIG9yIGFuIGFycmF5IG9mIFNvdXJjZU5vZGVzIGFuZCBzdHJpbmdzLiBHb3QgXCIgKyBhQ2h1bmtcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBZGQgYSBjaHVuayBvZiBnZW5lcmF0ZWQgSlMgdG8gdGhlIGJlZ2lubmluZyBvZiB0aGlzIHNvdXJjZSBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gYUNodW5rIEEgc3RyaW5nIHNuaXBwZXQgb2YgZ2VuZXJhdGVkIEpTIGNvZGUsIGFub3RoZXIgaW5zdGFuY2Ugb2ZcbiAgICogICAgICAgIFNvdXJjZU5vZGUsIG9yIGFuIGFycmF5IHdoZXJlIGVhY2ggbWVtYmVyIGlzIG9uZSBvZiB0aG9zZSB0aGluZ3MuXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS5wcmVwZW5kID0gZnVuY3Rpb24gU291cmNlTm9kZV9wcmVwZW5kKGFDaHVuaykge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGFDaHVuaykpIHtcbiAgICAgIGZvciAodmFyIGkgPSBhQ2h1bmsubGVuZ3RoLTE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIHRoaXMucHJlcGVuZChhQ2h1bmtbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChhQ2h1bmtbaXNTb3VyY2VOb2RlXSB8fCB0eXBlb2YgYUNodW5rID09PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aGlzLmNoaWxkcmVuLnVuc2hpZnQoYUNodW5rKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIkV4cGVjdGVkIGEgU291cmNlTm9kZSwgc3RyaW5nLCBvciBhbiBhcnJheSBvZiBTb3VyY2VOb2RlcyBhbmQgc3RyaW5ncy4gR290IFwiICsgYUNodW5rXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogV2FsayBvdmVyIHRoZSB0cmVlIG9mIEpTIHNuaXBwZXRzIGluIHRoaXMgbm9kZSBhbmQgaXRzIGNoaWxkcmVuLiBUaGVcbiAgICogd2Fsa2luZyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzbmlwcGV0IG9mIEpTIGFuZCBpcyBwYXNzZWQgdGhhdFxuICAgKiBzbmlwcGV0IGFuZCB0aGUgaXRzIG9yaWdpbmFsIGFzc29jaWF0ZWQgc291cmNlJ3MgbGluZS9jb2x1bW4gbG9jYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBhRm4gVGhlIHRyYXZlcnNhbCBmdW5jdGlvbi5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLndhbGsgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX3dhbGsoYUZuKSB7XG4gICAgdmFyIGNodW5rO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjaHVuayA9IHRoaXMuY2hpbGRyZW5baV07XG4gICAgICBpZiAoY2h1bmtbaXNTb3VyY2VOb2RlXSkge1xuICAgICAgICBjaHVuay53YWxrKGFGbik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKGNodW5rICE9PSAnJykge1xuICAgICAgICAgIGFGbihjaHVuaywgeyBzb3VyY2U6IHRoaXMuc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiB0aGlzLmxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgIGNvbHVtbjogdGhpcy5jb2x1bW4sXG4gICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMubmFtZSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogTGlrZSBgU3RyaW5nLnByb3RvdHlwZS5qb2luYCBleGNlcHQgZm9yIFNvdXJjZU5vZGVzLiBJbnNlcnRzIGBhU3RyYCBiZXR3ZWVuXG4gICAqIGVhY2ggb2YgYHRoaXMuY2hpbGRyZW5gLlxuICAgKlxuICAgKiBAcGFyYW0gYVNlcCBUaGUgc2VwYXJhdG9yLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfam9pbihhU2VwKSB7XG4gICAgdmFyIG5ld0NoaWxkcmVuO1xuICAgIHZhciBpO1xuICAgIHZhciBsZW4gPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDtcbiAgICBpZiAobGVuID4gMCkge1xuICAgICAgbmV3Q2hpbGRyZW4gPSBbXTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW4tMTsgaSsrKSB7XG4gICAgICAgIG5ld0NoaWxkcmVuLnB1c2godGhpcy5jaGlsZHJlbltpXSk7XG4gICAgICAgIG5ld0NoaWxkcmVuLnB1c2goYVNlcCk7XG4gICAgICB9XG4gICAgICBuZXdDaGlsZHJlbi5wdXNoKHRoaXMuY2hpbGRyZW5baV0pO1xuICAgICAgdGhpcy5jaGlsZHJlbiA9IG5ld0NoaWxkcmVuO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQ2FsbCBTdHJpbmcucHJvdG90eXBlLnJlcGxhY2Ugb24gdGhlIHZlcnkgcmlnaHQtbW9zdCBzb3VyY2Ugc25pcHBldC4gVXNlZnVsXG4gICAqIGZvciB0cmltbWluZyB3aGl0ZXNwYWNlIGZyb20gdGhlIGVuZCBvZiBhIHNvdXJjZSBub2RlLCBldGMuXG4gICAqXG4gICAqIEBwYXJhbSBhUGF0dGVybiBUaGUgcGF0dGVybiB0byByZXBsYWNlLlxuICAgKiBAcGFyYW0gYVJlcGxhY2VtZW50IFRoZSB0aGluZyB0byByZXBsYWNlIHRoZSBwYXR0ZXJuIHdpdGguXG4gICAqL1xuICBTb3VyY2VOb2RlLnByb3RvdHlwZS5yZXBsYWNlUmlnaHQgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX3JlcGxhY2VSaWdodChhUGF0dGVybiwgYVJlcGxhY2VtZW50KSB7XG4gICAgdmFyIGxhc3RDaGlsZCA9IHRoaXMuY2hpbGRyZW5bdGhpcy5jaGlsZHJlbi5sZW5ndGggLSAxXTtcbiAgICBpZiAobGFzdENoaWxkW2lzU291cmNlTm9kZV0pIHtcbiAgICAgIGxhc3RDaGlsZC5yZXBsYWNlUmlnaHQoYVBhdHRlcm4sIGFSZXBsYWNlbWVudCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBsYXN0Q2hpbGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmNoaWxkcmVuW3RoaXMuY2hpbGRyZW4ubGVuZ3RoIC0gMV0gPSBsYXN0Q2hpbGQucmVwbGFjZShhUGF0dGVybiwgYVJlcGxhY2VtZW50KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmNoaWxkcmVuLnB1c2goJycucmVwbGFjZShhUGF0dGVybiwgYVJlcGxhY2VtZW50KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTZXQgdGhlIHNvdXJjZSBjb250ZW50IGZvciBhIHNvdXJjZSBmaWxlLiBUaGlzIHdpbGwgYmUgYWRkZWQgdG8gdGhlIFNvdXJjZU1hcEdlbmVyYXRvclxuICAgKiBpbiB0aGUgc291cmNlc0NvbnRlbnQgZmllbGQuXG4gICAqXG4gICAqIEBwYXJhbSBhU291cmNlRmlsZSBUaGUgZmlsZW5hbWUgb2YgdGhlIHNvdXJjZSBmaWxlXG4gICAqIEBwYXJhbSBhU291cmNlQ29udGVudCBUaGUgY29udGVudCBvZiB0aGUgc291cmNlIGZpbGVcbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLnNldFNvdXJjZUNvbnRlbnQgPVxuICAgIGZ1bmN0aW9uIFNvdXJjZU5vZGVfc2V0U291cmNlQ29udGVudChhU291cmNlRmlsZSwgYVNvdXJjZUNvbnRlbnQpIHtcbiAgICAgIHRoaXMuc291cmNlQ29udGVudHNbdXRpbC50b1NldFN0cmluZyhhU291cmNlRmlsZSldID0gYVNvdXJjZUNvbnRlbnQ7XG4gICAgfTtcblxuICAvKipcbiAgICogV2FsayBvdmVyIHRoZSB0cmVlIG9mIFNvdXJjZU5vZGVzLiBUaGUgd2Fsa2luZyBmdW5jdGlvbiBpcyBjYWxsZWQgZm9yIGVhY2hcbiAgICogc291cmNlIGZpbGUgY29udGVudCBhbmQgaXMgcGFzc2VkIHRoZSBmaWxlbmFtZSBhbmQgc291cmNlIGNvbnRlbnQuXG4gICAqXG4gICAqIEBwYXJhbSBhRm4gVGhlIHRyYXZlcnNhbCBmdW5jdGlvbi5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLndhbGtTb3VyY2VDb250ZW50cyA9XG4gICAgZnVuY3Rpb24gU291cmNlTm9kZV93YWxrU291cmNlQ29udGVudHMoYUZuKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAodGhpcy5jaGlsZHJlbltpXVtpc1NvdXJjZU5vZGVdKSB7XG4gICAgICAgICAgdGhpcy5jaGlsZHJlbltpXS53YWxrU291cmNlQ29udGVudHMoYUZuKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgc291cmNlcyA9IE9iamVjdC5rZXlzKHRoaXMuc291cmNlQ29udGVudHMpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHNvdXJjZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgYUZuKHV0aWwuZnJvbVNldFN0cmluZyhzb3VyY2VzW2ldKSwgdGhpcy5zb3VyY2VDb250ZW50c1tzb3VyY2VzW2ldXSk7XG4gICAgICB9XG4gICAgfTtcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBzb3VyY2Ugbm9kZS4gV2Fsa3Mgb3ZlciB0aGUgdHJlZVxuICAgKiBhbmQgY29uY2F0ZW5hdGVzIGFsbCB0aGUgdmFyaW91cyBzbmlwcGV0cyB0b2dldGhlciB0byBvbmUgc3RyaW5nLlxuICAgKi9cbiAgU291cmNlTm9kZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiBTb3VyY2VOb2RlX3RvU3RyaW5nKCkge1xuICAgIHZhciBzdHIgPSBcIlwiO1xuICAgIHRoaXMud2FsayhmdW5jdGlvbiAoY2h1bmspIHtcbiAgICAgIHN0ciArPSBjaHVuaztcbiAgICB9KTtcbiAgICByZXR1cm4gc3RyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBzb3VyY2Ugbm9kZSBhbG9uZyB3aXRoIGEgc291cmNlXG4gICAqIG1hcC5cbiAgICovXG4gIFNvdXJjZU5vZGUucHJvdG90eXBlLnRvU3RyaW5nV2l0aFNvdXJjZU1hcCA9IGZ1bmN0aW9uIFNvdXJjZU5vZGVfdG9TdHJpbmdXaXRoU291cmNlTWFwKGFBcmdzKSB7XG4gICAgdmFyIGdlbmVyYXRlZCA9IHtcbiAgICAgIGNvZGU6IFwiXCIsXG4gICAgICBsaW5lOiAxLFxuICAgICAgY29sdW1uOiAwXG4gICAgfTtcbiAgICB2YXIgbWFwID0gbmV3IFNvdXJjZU1hcEdlbmVyYXRvcihhQXJncyk7XG4gICAgdmFyIHNvdXJjZU1hcHBpbmdBY3RpdmUgPSBmYWxzZTtcbiAgICB2YXIgbGFzdE9yaWdpbmFsU291cmNlID0gbnVsbDtcbiAgICB2YXIgbGFzdE9yaWdpbmFsTGluZSA9IG51bGw7XG4gICAgdmFyIGxhc3RPcmlnaW5hbENvbHVtbiA9IG51bGw7XG4gICAgdmFyIGxhc3RPcmlnaW5hbE5hbWUgPSBudWxsO1xuICAgIHRoaXMud2FsayhmdW5jdGlvbiAoY2h1bmssIG9yaWdpbmFsKSB7XG4gICAgICBnZW5lcmF0ZWQuY29kZSArPSBjaHVuaztcbiAgICAgIGlmIChvcmlnaW5hbC5zb3VyY2UgIT09IG51bGxcbiAgICAgICAgICAmJiBvcmlnaW5hbC5saW5lICE9PSBudWxsXG4gICAgICAgICAgJiYgb3JpZ2luYWwuY29sdW1uICE9PSBudWxsKSB7XG4gICAgICAgIGlmKGxhc3RPcmlnaW5hbFNvdXJjZSAhPT0gb3JpZ2luYWwuc291cmNlXG4gICAgICAgICAgIHx8IGxhc3RPcmlnaW5hbExpbmUgIT09IG9yaWdpbmFsLmxpbmVcbiAgICAgICAgICAgfHwgbGFzdE9yaWdpbmFsQ29sdW1uICE9PSBvcmlnaW5hbC5jb2x1bW5cbiAgICAgICAgICAgfHwgbGFzdE9yaWdpbmFsTmFtZSAhPT0gb3JpZ2luYWwubmFtZSkge1xuICAgICAgICAgIG1hcC5hZGRNYXBwaW5nKHtcbiAgICAgICAgICAgIHNvdXJjZTogb3JpZ2luYWwuc291cmNlLFxuICAgICAgICAgICAgb3JpZ2luYWw6IHtcbiAgICAgICAgICAgICAgbGluZTogb3JpZ2luYWwubGluZSxcbiAgICAgICAgICAgICAgY29sdW1uOiBvcmlnaW5hbC5jb2x1bW5cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZW5lcmF0ZWQ6IHtcbiAgICAgICAgICAgICAgbGluZTogZ2VuZXJhdGVkLmxpbmUsXG4gICAgICAgICAgICAgIGNvbHVtbjogZ2VuZXJhdGVkLmNvbHVtblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5hbWU6IG9yaWdpbmFsLm5hbWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0T3JpZ2luYWxTb3VyY2UgPSBvcmlnaW5hbC5zb3VyY2U7XG4gICAgICAgIGxhc3RPcmlnaW5hbExpbmUgPSBvcmlnaW5hbC5saW5lO1xuICAgICAgICBsYXN0T3JpZ2luYWxDb2x1bW4gPSBvcmlnaW5hbC5jb2x1bW47XG4gICAgICAgIGxhc3RPcmlnaW5hbE5hbWUgPSBvcmlnaW5hbC5uYW1lO1xuICAgICAgICBzb3VyY2VNYXBwaW5nQWN0aXZlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoc291cmNlTWFwcGluZ0FjdGl2ZSkge1xuICAgICAgICBtYXAuYWRkTWFwcGluZyh7XG4gICAgICAgICAgZ2VuZXJhdGVkOiB7XG4gICAgICAgICAgICBsaW5lOiBnZW5lcmF0ZWQubGluZSxcbiAgICAgICAgICAgIGNvbHVtbjogZ2VuZXJhdGVkLmNvbHVtblxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGxhc3RPcmlnaW5hbFNvdXJjZSA9IG51bGw7XG4gICAgICAgIHNvdXJjZU1hcHBpbmdBY3RpdmUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGlkeCA9IDAsIGxlbmd0aCA9IGNodW5rLmxlbmd0aDsgaWR4IDwgbGVuZ3RoOyBpZHgrKykge1xuICAgICAgICBpZiAoY2h1bmsuY2hhckNvZGVBdChpZHgpID09PSBORVdMSU5FX0NPREUpIHtcbiAgICAgICAgICBnZW5lcmF0ZWQubGluZSsrO1xuICAgICAgICAgIGdlbmVyYXRlZC5jb2x1bW4gPSAwO1xuICAgICAgICAgIC8vIE1hcHBpbmdzIGVuZCBhdCBlb2xcbiAgICAgICAgICBpZiAoaWR4ICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgICBsYXN0T3JpZ2luYWxTb3VyY2UgPSBudWxsO1xuICAgICAgICAgICAgc291cmNlTWFwcGluZ0FjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc291cmNlTWFwcGluZ0FjdGl2ZSkge1xuICAgICAgICAgICAgbWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgICAgICBzb3VyY2U6IG9yaWdpbmFsLnNvdXJjZSxcbiAgICAgICAgICAgICAgb3JpZ2luYWw6IHtcbiAgICAgICAgICAgICAgICBsaW5lOiBvcmlnaW5hbC5saW5lLFxuICAgICAgICAgICAgICAgIGNvbHVtbjogb3JpZ2luYWwuY29sdW1uXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGdlbmVyYXRlZDoge1xuICAgICAgICAgICAgICAgIGxpbmU6IGdlbmVyYXRlZC5saW5lLFxuICAgICAgICAgICAgICAgIGNvbHVtbjogZ2VuZXJhdGVkLmNvbHVtblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBuYW1lOiBvcmlnaW5hbC5uYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZ2VuZXJhdGVkLmNvbHVtbisrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy53YWxrU291cmNlQ29udGVudHMoZnVuY3Rpb24gKHNvdXJjZUZpbGUsIHNvdXJjZUNvbnRlbnQpIHtcbiAgICAgIG1hcC5zZXRTb3VyY2VDb250ZW50KHNvdXJjZUZpbGUsIHNvdXJjZUNvbnRlbnQpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgY29kZTogZ2VuZXJhdGVkLmNvZGUsIG1hcDogbWFwIH07XG4gIH07XG5cbiAgZXhwb3J0cy5Tb3VyY2VOb2RlID0gU291cmNlTm9kZTtcblxufSk7XG4iLCIvKiAtKi0gTW9kZToganM7IGpzLWluZGVudC1sZXZlbDogMjsgLSotICovXG4vKlxuICogQ29weXJpZ2h0IDIwMTEgTW96aWxsYSBGb3VuZGF0aW9uIGFuZCBjb250cmlidXRvcnNcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBOZXcgQlNEIGxpY2Vuc2UuIFNlZSBMSUNFTlNFIG9yOlxuICogaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL0JTRC0zLUNsYXVzZVxuICovXG5pZiAodHlwZW9mIGRlZmluZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHZhciBkZWZpbmUgPSByZXF1aXJlKCdhbWRlZmluZScpKG1vZHVsZSwgcmVxdWlyZSk7XG59XG5kZWZpbmUoZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgaGVscGVyIGZ1bmN0aW9uIGZvciBnZXR0aW5nIHZhbHVlcyBmcm9tIHBhcmFtZXRlci9vcHRpb25zXG4gICAqIG9iamVjdHMuXG4gICAqXG4gICAqIEBwYXJhbSBhcmdzIFRoZSBvYmplY3Qgd2UgYXJlIGV4dHJhY3RpbmcgdmFsdWVzIGZyb21cbiAgICogQHBhcmFtIG5hbWUgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHdlIGFyZSBnZXR0aW5nLlxuICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIEFuIG9wdGlvbmFsIHZhbHVlIHRvIHJldHVybiBpZiB0aGUgcHJvcGVydHkgaXMgbWlzc2luZ1xuICAgKiBmcm9tIHRoZSBvYmplY3QuIElmIHRoaXMgaXMgbm90IHNwZWNpZmllZCBhbmQgdGhlIHByb3BlcnR5IGlzIG1pc3NpbmcsIGFuXG4gICAqIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0QXJnKGFBcmdzLCBhTmFtZSwgYURlZmF1bHRWYWx1ZSkge1xuICAgIGlmIChhTmFtZSBpbiBhQXJncykge1xuICAgICAgcmV0dXJuIGFBcmdzW2FOYW1lXTtcbiAgICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICAgIHJldHVybiBhRGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1wiJyArIGFOYW1lICsgJ1wiIGlzIGEgcmVxdWlyZWQgYXJndW1lbnQuJyk7XG4gICAgfVxuICB9XG4gIGV4cG9ydHMuZ2V0QXJnID0gZ2V0QXJnO1xuXG4gIHZhciB1cmxSZWdleHAgPSAvXig/OihbXFx3K1xcLS5dKyk6KT9cXC9cXC8oPzooXFx3KzpcXHcrKUApPyhbXFx3Ll0qKSg/OjooXFxkKykpPyhcXFMqKSQvO1xuICB2YXIgZGF0YVVybFJlZ2V4cCA9IC9eZGF0YTouK1xcLC4rJC87XG5cbiAgZnVuY3Rpb24gdXJsUGFyc2UoYVVybCkge1xuICAgIHZhciBtYXRjaCA9IGFVcmwubWF0Y2godXJsUmVnZXhwKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHNjaGVtZTogbWF0Y2hbMV0sXG4gICAgICBhdXRoOiBtYXRjaFsyXSxcbiAgICAgIGhvc3Q6IG1hdGNoWzNdLFxuICAgICAgcG9ydDogbWF0Y2hbNF0sXG4gICAgICBwYXRoOiBtYXRjaFs1XVxuICAgIH07XG4gIH1cbiAgZXhwb3J0cy51cmxQYXJzZSA9IHVybFBhcnNlO1xuXG4gIGZ1bmN0aW9uIHVybEdlbmVyYXRlKGFQYXJzZWRVcmwpIHtcbiAgICB2YXIgdXJsID0gJyc7XG4gICAgaWYgKGFQYXJzZWRVcmwuc2NoZW1lKSB7XG4gICAgICB1cmwgKz0gYVBhcnNlZFVybC5zY2hlbWUgKyAnOic7XG4gICAgfVxuICAgIHVybCArPSAnLy8nO1xuICAgIGlmIChhUGFyc2VkVXJsLmF1dGgpIHtcbiAgICAgIHVybCArPSBhUGFyc2VkVXJsLmF1dGggKyAnQCc7XG4gICAgfVxuICAgIGlmIChhUGFyc2VkVXJsLmhvc3QpIHtcbiAgICAgIHVybCArPSBhUGFyc2VkVXJsLmhvc3Q7XG4gICAgfVxuICAgIGlmIChhUGFyc2VkVXJsLnBvcnQpIHtcbiAgICAgIHVybCArPSBcIjpcIiArIGFQYXJzZWRVcmwucG9ydFxuICAgIH1cbiAgICBpZiAoYVBhcnNlZFVybC5wYXRoKSB7XG4gICAgICB1cmwgKz0gYVBhcnNlZFVybC5wYXRoO1xuICAgIH1cbiAgICByZXR1cm4gdXJsO1xuICB9XG4gIGV4cG9ydHMudXJsR2VuZXJhdGUgPSB1cmxHZW5lcmF0ZTtcblxuICAvKipcbiAgICogTm9ybWFsaXplcyBhIHBhdGgsIG9yIHRoZSBwYXRoIHBvcnRpb24gb2YgYSBVUkw6XG4gICAqXG4gICAqIC0gUmVwbGFjZXMgY29uc2VxdXRpdmUgc2xhc2hlcyB3aXRoIG9uZSBzbGFzaC5cbiAgICogLSBSZW1vdmVzIHVubmVjZXNzYXJ5ICcuJyBwYXJ0cy5cbiAgICogLSBSZW1vdmVzIHVubmVjZXNzYXJ5ICc8ZGlyPi8uLicgcGFydHMuXG4gICAqXG4gICAqIEJhc2VkIG9uIGNvZGUgaW4gdGhlIE5vZGUuanMgJ3BhdGgnIGNvcmUgbW9kdWxlLlxuICAgKlxuICAgKiBAcGFyYW0gYVBhdGggVGhlIHBhdGggb3IgdXJsIHRvIG5vcm1hbGl6ZS5cbiAgICovXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZShhUGF0aCkge1xuICAgIHZhciBwYXRoID0gYVBhdGg7XG4gICAgdmFyIHVybCA9IHVybFBhcnNlKGFQYXRoKTtcbiAgICBpZiAodXJsKSB7XG4gICAgICBpZiAoIXVybC5wYXRoKSB7XG4gICAgICAgIHJldHVybiBhUGF0aDtcbiAgICAgIH1cbiAgICAgIHBhdGggPSB1cmwucGF0aDtcbiAgICB9XG4gICAgdmFyIGlzQWJzb2x1dGUgPSAocGF0aC5jaGFyQXQoMCkgPT09ICcvJyk7XG5cbiAgICB2YXIgcGFydHMgPSBwYXRoLnNwbGl0KC9cXC8rLyk7XG4gICAgZm9yICh2YXIgcGFydCwgdXAgPSAwLCBpID0gcGFydHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHBhcnQgPSBwYXJ0c1tpXTtcbiAgICAgIGlmIChwYXJ0ID09PSAnLicpIHtcbiAgICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgfSBlbHNlIGlmIChwYXJ0ID09PSAnLi4nKSB7XG4gICAgICAgIHVwKys7XG4gICAgICB9IGVsc2UgaWYgKHVwID4gMCkge1xuICAgICAgICBpZiAocGFydCA9PT0gJycpIHtcbiAgICAgICAgICAvLyBUaGUgZmlyc3QgcGFydCBpcyBibGFuayBpZiB0aGUgcGF0aCBpcyBhYnNvbHV0ZS4gVHJ5aW5nIHRvIGdvXG4gICAgICAgICAgLy8gYWJvdmUgdGhlIHJvb3QgaXMgYSBuby1vcC4gVGhlcmVmb3JlIHdlIGNhbiByZW1vdmUgYWxsICcuLicgcGFydHNcbiAgICAgICAgICAvLyBkaXJlY3RseSBhZnRlciB0aGUgcm9vdC5cbiAgICAgICAgICBwYXJ0cy5zcGxpY2UoaSArIDEsIHVwKTtcbiAgICAgICAgICB1cCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFydHMuc3BsaWNlKGksIDIpO1xuICAgICAgICAgIHVwLS07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcGF0aCA9IHBhcnRzLmpvaW4oJy8nKTtcblxuICAgIGlmIChwYXRoID09PSAnJykge1xuICAgICAgcGF0aCA9IGlzQWJzb2x1dGUgPyAnLycgOiAnLic7XG4gICAgfVxuXG4gICAgaWYgKHVybCkge1xuICAgICAgdXJsLnBhdGggPSBwYXRoO1xuICAgICAgcmV0dXJuIHVybEdlbmVyYXRlKHVybCk7XG4gICAgfVxuICAgIHJldHVybiBwYXRoO1xuICB9XG4gIGV4cG9ydHMubm9ybWFsaXplID0gbm9ybWFsaXplO1xuXG4gIC8qKlxuICAgKiBKb2lucyB0d28gcGF0aHMvVVJMcy5cbiAgICpcbiAgICogQHBhcmFtIGFSb290IFRoZSByb290IHBhdGggb3IgVVJMLlxuICAgKiBAcGFyYW0gYVBhdGggVGhlIHBhdGggb3IgVVJMIHRvIGJlIGpvaW5lZCB3aXRoIHRoZSByb290LlxuICAgKlxuICAgKiAtIElmIGFQYXRoIGlzIGEgVVJMIG9yIGEgZGF0YSBVUkksIGFQYXRoIGlzIHJldHVybmVkLCB1bmxlc3MgYVBhdGggaXMgYVxuICAgKiAgIHNjaGVtZS1yZWxhdGl2ZSBVUkw6IFRoZW4gdGhlIHNjaGVtZSBvZiBhUm9vdCwgaWYgYW55LCBpcyBwcmVwZW5kZWRcbiAgICogICBmaXJzdC5cbiAgICogLSBPdGhlcndpc2UgYVBhdGggaXMgYSBwYXRoLiBJZiBhUm9vdCBpcyBhIFVSTCwgdGhlbiBpdHMgcGF0aCBwb3J0aW9uXG4gICAqICAgaXMgdXBkYXRlZCB3aXRoIHRoZSByZXN1bHQgYW5kIGFSb290IGlzIHJldHVybmVkLiBPdGhlcndpc2UgdGhlIHJlc3VsdFxuICAgKiAgIGlzIHJldHVybmVkLlxuICAgKiAgIC0gSWYgYVBhdGggaXMgYWJzb2x1dGUsIHRoZSByZXN1bHQgaXMgYVBhdGguXG4gICAqICAgLSBPdGhlcndpc2UgdGhlIHR3byBwYXRocyBhcmUgam9pbmVkIHdpdGggYSBzbGFzaC5cbiAgICogLSBKb2luaW5nIGZvciBleGFtcGxlICdodHRwOi8vJyBhbmQgJ3d3dy5leGFtcGxlLmNvbScgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gICAqL1xuICBmdW5jdGlvbiBqb2luKGFSb290LCBhUGF0aCkge1xuICAgIGlmIChhUm9vdCA9PT0gXCJcIikge1xuICAgICAgYVJvb3QgPSBcIi5cIjtcbiAgICB9XG4gICAgaWYgKGFQYXRoID09PSBcIlwiKSB7XG4gICAgICBhUGF0aCA9IFwiLlwiO1xuICAgIH1cbiAgICB2YXIgYVBhdGhVcmwgPSB1cmxQYXJzZShhUGF0aCk7XG4gICAgdmFyIGFSb290VXJsID0gdXJsUGFyc2UoYVJvb3QpO1xuICAgIGlmIChhUm9vdFVybCkge1xuICAgICAgYVJvb3QgPSBhUm9vdFVybC5wYXRoIHx8ICcvJztcbiAgICB9XG5cbiAgICAvLyBgam9pbihmb28sICcvL3d3dy5leGFtcGxlLm9yZycpYFxuICAgIGlmIChhUGF0aFVybCAmJiAhYVBhdGhVcmwuc2NoZW1lKSB7XG4gICAgICBpZiAoYVJvb3RVcmwpIHtcbiAgICAgICAgYVBhdGhVcmwuc2NoZW1lID0gYVJvb3RVcmwuc2NoZW1lO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHVybEdlbmVyYXRlKGFQYXRoVXJsKTtcbiAgICB9XG5cbiAgICBpZiAoYVBhdGhVcmwgfHwgYVBhdGgubWF0Y2goZGF0YVVybFJlZ2V4cCkpIHtcbiAgICAgIHJldHVybiBhUGF0aDtcbiAgICB9XG5cbiAgICAvLyBgam9pbignaHR0cDovLycsICd3d3cuZXhhbXBsZS5jb20nKWBcbiAgICBpZiAoYVJvb3RVcmwgJiYgIWFSb290VXJsLmhvc3QgJiYgIWFSb290VXJsLnBhdGgpIHtcbiAgICAgIGFSb290VXJsLmhvc3QgPSBhUGF0aDtcbiAgICAgIHJldHVybiB1cmxHZW5lcmF0ZShhUm9vdFVybCk7XG4gICAgfVxuXG4gICAgdmFyIGpvaW5lZCA9IGFQYXRoLmNoYXJBdCgwKSA9PT0gJy8nXG4gICAgICA/IGFQYXRoXG4gICAgICA6IG5vcm1hbGl6ZShhUm9vdC5yZXBsYWNlKC9cXC8rJC8sICcnKSArICcvJyArIGFQYXRoKTtcblxuICAgIGlmIChhUm9vdFVybCkge1xuICAgICAgYVJvb3RVcmwucGF0aCA9IGpvaW5lZDtcbiAgICAgIHJldHVybiB1cmxHZW5lcmF0ZShhUm9vdFVybCk7XG4gICAgfVxuICAgIHJldHVybiBqb2luZWQ7XG4gIH1cbiAgZXhwb3J0cy5qb2luID0gam9pbjtcblxuICAvKipcbiAgICogTWFrZSBhIHBhdGggcmVsYXRpdmUgdG8gYSBVUkwgb3IgYW5vdGhlciBwYXRoLlxuICAgKlxuICAgKiBAcGFyYW0gYVJvb3QgVGhlIHJvb3QgcGF0aCBvciBVUkwuXG4gICAqIEBwYXJhbSBhUGF0aCBUaGUgcGF0aCBvciBVUkwgdG8gYmUgbWFkZSByZWxhdGl2ZSB0byBhUm9vdC5cbiAgICovXG4gIGZ1bmN0aW9uIHJlbGF0aXZlKGFSb290LCBhUGF0aCkge1xuICAgIGlmIChhUm9vdCA9PT0gXCJcIikge1xuICAgICAgYVJvb3QgPSBcIi5cIjtcbiAgICB9XG5cbiAgICBhUm9vdCA9IGFSb290LnJlcGxhY2UoL1xcLyQvLCAnJyk7XG5cbiAgICAvLyBYWFg6IEl0IGlzIHBvc3NpYmxlIHRvIHJlbW92ZSB0aGlzIGJsb2NrLCBhbmQgdGhlIHRlc3RzIHN0aWxsIHBhc3MhXG4gICAgdmFyIHVybCA9IHVybFBhcnNlKGFSb290KTtcbiAgICBpZiAoYVBhdGguY2hhckF0KDApID09IFwiL1wiICYmIHVybCAmJiB1cmwucGF0aCA9PSBcIi9cIikge1xuICAgICAgcmV0dXJuIGFQYXRoLnNsaWNlKDEpO1xuICAgIH1cblxuICAgIHJldHVybiBhUGF0aC5pbmRleE9mKGFSb290ICsgJy8nKSA9PT0gMFxuICAgICAgPyBhUGF0aC5zdWJzdHIoYVJvb3QubGVuZ3RoICsgMSlcbiAgICAgIDogYVBhdGg7XG4gIH1cbiAgZXhwb3J0cy5yZWxhdGl2ZSA9IHJlbGF0aXZlO1xuXG4gIC8qKlxuICAgKiBCZWNhdXNlIGJlaGF2aW9yIGdvZXMgd2Fja3kgd2hlbiB5b3Ugc2V0IGBfX3Byb3RvX19gIG9uIG9iamVjdHMsIHdlXG4gICAqIGhhdmUgdG8gcHJlZml4IGFsbCB0aGUgc3RyaW5ncyBpbiBvdXIgc2V0IHdpdGggYW4gYXJiaXRyYXJ5IGNoYXJhY3Rlci5cbiAgICpcbiAgICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL3NvdXJjZS1tYXAvcHVsbC8zMSBhbmRcbiAgICogaHR0cHM6Ly9naXRodWIuY29tL21vemlsbGEvc291cmNlLW1hcC9pc3N1ZXMvMzBcbiAgICpcbiAgICogQHBhcmFtIFN0cmluZyBhU3RyXG4gICAqL1xuICBmdW5jdGlvbiB0b1NldFN0cmluZyhhU3RyKSB7XG4gICAgcmV0dXJuICckJyArIGFTdHI7XG4gIH1cbiAgZXhwb3J0cy50b1NldFN0cmluZyA9IHRvU2V0U3RyaW5nO1xuXG4gIGZ1bmN0aW9uIGZyb21TZXRTdHJpbmcoYVN0cikge1xuICAgIHJldHVybiBhU3RyLnN1YnN0cigxKTtcbiAgfVxuICBleHBvcnRzLmZyb21TZXRTdHJpbmcgPSBmcm9tU2V0U3RyaW5nO1xuXG4gIGZ1bmN0aW9uIHN0cmNtcChhU3RyMSwgYVN0cjIpIHtcbiAgICB2YXIgczEgPSBhU3RyMSB8fCBcIlwiO1xuICAgIHZhciBzMiA9IGFTdHIyIHx8IFwiXCI7XG4gICAgcmV0dXJuIChzMSA+IHMyKSAtIChzMSA8IHMyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wYXJhdG9yIGJldHdlZW4gdHdvIG1hcHBpbmdzIHdoZXJlIHRoZSBvcmlnaW5hbCBwb3NpdGlvbnMgYXJlIGNvbXBhcmVkLlxuICAgKlxuICAgKiBPcHRpb25hbGx5IHBhc3MgaW4gYHRydWVgIGFzIGBvbmx5Q29tcGFyZUdlbmVyYXRlZGAgdG8gY29uc2lkZXIgdHdvXG4gICAqIG1hcHBpbmdzIHdpdGggdGhlIHNhbWUgb3JpZ2luYWwgc291cmNlL2xpbmUvY29sdW1uLCBidXQgZGlmZmVyZW50IGdlbmVyYXRlZFxuICAgKiBsaW5lIGFuZCBjb2x1bW4gdGhlIHNhbWUuIFVzZWZ1bCB3aGVuIHNlYXJjaGluZyBmb3IgYSBtYXBwaW5nIHdpdGggYVxuICAgKiBzdHViYmVkIG91dCBtYXBwaW5nLlxuICAgKi9cbiAgZnVuY3Rpb24gY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMobWFwcGluZ0EsIG1hcHBpbmdCLCBvbmx5Q29tcGFyZU9yaWdpbmFsKSB7XG4gICAgdmFyIGNtcDtcblxuICAgIGNtcCA9IHN0cmNtcChtYXBwaW5nQS5zb3VyY2UsIG1hcHBpbmdCLnNvdXJjZSk7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5vcmlnaW5hbExpbmUgLSBtYXBwaW5nQi5vcmlnaW5hbExpbmU7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5vcmlnaW5hbENvbHVtbiAtIG1hcHBpbmdCLm9yaWdpbmFsQ29sdW1uO1xuICAgIGlmIChjbXAgfHwgb25seUNvbXBhcmVPcmlnaW5hbCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBzdHJjbXAobWFwcGluZ0EubmFtZSwgbWFwcGluZ0IubmFtZSk7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5nZW5lcmF0ZWRMaW5lIC0gbWFwcGluZ0IuZ2VuZXJhdGVkTGluZTtcbiAgICBpZiAoY21wKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIHJldHVybiBtYXBwaW5nQS5nZW5lcmF0ZWRDb2x1bW4gLSBtYXBwaW5nQi5nZW5lcmF0ZWRDb2x1bW47XG4gIH07XG4gIGV4cG9ydHMuY29tcGFyZUJ5T3JpZ2luYWxQb3NpdGlvbnMgPSBjb21wYXJlQnlPcmlnaW5hbFBvc2l0aW9ucztcblxuICAvKipcbiAgICogQ29tcGFyYXRvciBiZXR3ZWVuIHR3byBtYXBwaW5ncyB3aGVyZSB0aGUgZ2VuZXJhdGVkIHBvc2l0aW9ucyBhcmVcbiAgICogY29tcGFyZWQuXG4gICAqXG4gICAqIE9wdGlvbmFsbHkgcGFzcyBpbiBgdHJ1ZWAgYXMgYG9ubHlDb21wYXJlR2VuZXJhdGVkYCB0byBjb25zaWRlciB0d29cbiAgICogbWFwcGluZ3Mgd2l0aCB0aGUgc2FtZSBnZW5lcmF0ZWQgbGluZSBhbmQgY29sdW1uLCBidXQgZGlmZmVyZW50XG4gICAqIHNvdXJjZS9uYW1lL29yaWdpbmFsIGxpbmUgYW5kIGNvbHVtbiB0aGUgc2FtZS4gVXNlZnVsIHdoZW4gc2VhcmNoaW5nIGZvciBhXG4gICAqIG1hcHBpbmcgd2l0aCBhIHN0dWJiZWQgb3V0IG1hcHBpbmcuXG4gICAqL1xuICBmdW5jdGlvbiBjb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMobWFwcGluZ0EsIG1hcHBpbmdCLCBvbmx5Q29tcGFyZUdlbmVyYXRlZCkge1xuICAgIHZhciBjbXA7XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5nZW5lcmF0ZWRMaW5lIC0gbWFwcGluZ0IuZ2VuZXJhdGVkTGluZTtcbiAgICBpZiAoY21wKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IG1hcHBpbmdBLmdlbmVyYXRlZENvbHVtbiAtIG1hcHBpbmdCLmdlbmVyYXRlZENvbHVtbjtcbiAgICBpZiAoY21wIHx8IG9ubHlDb21wYXJlR2VuZXJhdGVkKSB7XG4gICAgICByZXR1cm4gY21wO1xuICAgIH1cblxuICAgIGNtcCA9IHN0cmNtcChtYXBwaW5nQS5zb3VyY2UsIG1hcHBpbmdCLnNvdXJjZSk7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5vcmlnaW5hbExpbmUgLSBtYXBwaW5nQi5vcmlnaW5hbExpbmU7XG4gICAgaWYgKGNtcCkge1xuICAgICAgcmV0dXJuIGNtcDtcbiAgICB9XG5cbiAgICBjbXAgPSBtYXBwaW5nQS5vcmlnaW5hbENvbHVtbiAtIG1hcHBpbmdCLm9yaWdpbmFsQ29sdW1uO1xuICAgIGlmIChjbXApIHtcbiAgICAgIHJldHVybiBjbXA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmNtcChtYXBwaW5nQS5uYW1lLCBtYXBwaW5nQi5uYW1lKTtcbiAgfTtcbiAgZXhwb3J0cy5jb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnMgPSBjb21wYXJlQnlHZW5lcmF0ZWRQb3NpdGlvbnM7XG5cbn0pO1xuIiwiLyoqIHZpbTogZXQ6dHM9NDpzdz00OnN0cz00XG4gKiBAbGljZW5zZSBhbWRlZmluZSAxLjAuMCBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxNSwgVGhlIERvam8gRm91bmRhdGlvbiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICogQXZhaWxhYmxlIHZpYSB0aGUgTUlUIG9yIG5ldyBCU0QgbGljZW5zZS5cbiAqIHNlZTogaHR0cDovL2dpdGh1Yi5jb20vanJidXJrZS9hbWRlZmluZSBmb3IgZGV0YWlsc1xuICovXG5cbi8qanNsaW50IG5vZGU6IHRydWUgKi9cbi8qZ2xvYmFsIG1vZHVsZSwgcHJvY2VzcyAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBkZWZpbmUgZm9yIG5vZGUuXG4gKiBAcGFyYW0ge09iamVjdH0gbW9kdWxlIHRoZSBcIm1vZHVsZVwiIG9iamVjdCB0aGF0IGlzIGRlZmluZWQgYnkgTm9kZSBmb3IgdGhlXG4gKiBjdXJyZW50IG1vZHVsZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtyZXF1aXJlRm5dLiBOb2RlJ3MgcmVxdWlyZSBmdW5jdGlvbiBmb3IgdGhlIGN1cnJlbnQgbW9kdWxlLlxuICogSXQgb25seSBuZWVkcyB0byBiZSBwYXNzZWQgaW4gTm9kZSB2ZXJzaW9ucyBiZWZvcmUgMC41LCB3aGVuIG1vZHVsZS5yZXF1aXJlXG4gKiBkaWQgbm90IGV4aXN0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBhIGRlZmluZSBmdW5jdGlvbiB0aGF0IGlzIHVzYWJsZSBmb3IgdGhlIGN1cnJlbnQgbm9kZVxuICogbW9kdWxlLlxuICovXG5mdW5jdGlvbiBhbWRlZmluZShtb2R1bGUsIHJlcXVpcmVGbikge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICB2YXIgZGVmaW5lQ2FjaGUgPSB7fSxcbiAgICAgICAgbG9hZGVyQ2FjaGUgPSB7fSxcbiAgICAgICAgYWxyZWFkeUNhbGxlZCA9IGZhbHNlLFxuICAgICAgICBwYXRoID0gcmVxdWlyZSgncGF0aCcpLFxuICAgICAgICBtYWtlUmVxdWlyZSwgc3RyaW5nUmVxdWlyZTtcblxuICAgIC8qKlxuICAgICAqIFRyaW1zIHRoZSAuIGFuZCAuLiBmcm9tIGFuIGFycmF5IG9mIHBhdGggc2VnbWVudHMuXG4gICAgICogSXQgd2lsbCBrZWVwIGEgbGVhZGluZyBwYXRoIHNlZ21lbnQgaWYgYSAuLiB3aWxsIGJlY29tZVxuICAgICAqIHRoZSBmaXJzdCBwYXRoIHNlZ21lbnQsIHRvIGhlbHAgd2l0aCBtb2R1bGUgbmFtZSBsb29rdXBzLFxuICAgICAqIHdoaWNoIGFjdCBsaWtlIHBhdGhzLCBidXQgY2FuIGJlIHJlbWFwcGVkLiBCdXQgdGhlIGVuZCByZXN1bHQsXG4gICAgICogYWxsIHBhdGhzIHRoYXQgdXNlIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGxvb2sgbm9ybWFsaXplZC5cbiAgICAgKiBOT1RFOiB0aGlzIG1ldGhvZCBNT0RJRklFUyB0aGUgaW5wdXQgYXJyYXkuXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJ5IHRoZSBhcnJheSBvZiBwYXRoIHNlZ21lbnRzLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHRyaW1Eb3RzKGFyeSkge1xuICAgICAgICB2YXIgaSwgcGFydDtcbiAgICAgICAgZm9yIChpID0gMDsgYXJ5W2ldOyBpKz0gMSkge1xuICAgICAgICAgICAgcGFydCA9IGFyeVtpXTtcbiAgICAgICAgICAgIGlmIChwYXJ0ID09PSAnLicpIHtcbiAgICAgICAgICAgICAgICBhcnkuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGkgLT0gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFydCA9PT0gJy4uJykge1xuICAgICAgICAgICAgICAgIGlmIChpID09PSAxICYmIChhcnlbMl0gPT09ICcuLicgfHwgYXJ5WzBdID09PSAnLi4nKSkge1xuICAgICAgICAgICAgICAgICAgICAvL0VuZCBvZiB0aGUgbGluZS4gS2VlcCBhdCBsZWFzdCBvbmUgbm9uLWRvdFxuICAgICAgICAgICAgICAgICAgICAvL3BhdGggc2VnbWVudCBhdCB0aGUgZnJvbnQgc28gaXQgY2FuIGJlIG1hcHBlZFxuICAgICAgICAgICAgICAgICAgICAvL2NvcnJlY3RseSB0byBkaXNrLiBPdGhlcndpc2UsIHRoZXJlIGlzIGxpa2VseVxuICAgICAgICAgICAgICAgICAgICAvL25vIHBhdGggbWFwcGluZyBmb3IgYSBwYXRoIHN0YXJ0aW5nIHdpdGggJy4uJy5cbiAgICAgICAgICAgICAgICAgICAgLy9UaGlzIGNhbiBzdGlsbCBmYWlsLCBidXQgY2F0Y2hlcyB0aGUgbW9zdCByZWFzb25hYmxlXG4gICAgICAgICAgICAgICAgICAgIC8vdXNlcyBvZiAuLlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyeS5zcGxpY2UoaSAtIDEsIDIpO1xuICAgICAgICAgICAgICAgICAgICBpIC09IDI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbm9ybWFsaXplKG5hbWUsIGJhc2VOYW1lKSB7XG4gICAgICAgIHZhciBiYXNlUGFydHM7XG5cbiAgICAgICAgLy9BZGp1c3QgYW55IHJlbGF0aXZlIHBhdGhzLlxuICAgICAgICBpZiAobmFtZSAmJiBuYW1lLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgICAgICAvL0lmIGhhdmUgYSBiYXNlIG5hbWUsIHRyeSB0byBub3JtYWxpemUgYWdhaW5zdCBpdCxcbiAgICAgICAgICAgIC8vb3RoZXJ3aXNlLCBhc3N1bWUgaXQgaXMgYSB0b3AtbGV2ZWwgcmVxdWlyZSB0aGF0IHdpbGxcbiAgICAgICAgICAgIC8vYmUgcmVsYXRpdmUgdG8gYmFzZVVybCBpbiB0aGUgZW5kLlxuICAgICAgICAgICAgaWYgKGJhc2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgYmFzZVBhcnRzID0gYmFzZU5hbWUuc3BsaXQoJy8nKTtcbiAgICAgICAgICAgICAgICBiYXNlUGFydHMgPSBiYXNlUGFydHMuc2xpY2UoMCwgYmFzZVBhcnRzLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIGJhc2VQYXJ0cyA9IGJhc2VQYXJ0cy5jb25jYXQobmFtZS5zcGxpdCgnLycpKTtcbiAgICAgICAgICAgICAgICB0cmltRG90cyhiYXNlUGFydHMpO1xuICAgICAgICAgICAgICAgIG5hbWUgPSBiYXNlUGFydHMuam9pbignLycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHRoZSBub3JtYWxpemUoKSBmdW5jdGlvbiBwYXNzZWQgdG8gYSBsb2FkZXIgcGx1Z2luJ3NcbiAgICAgKiBub3JtYWxpemUgbWV0aG9kLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1ha2VOb3JtYWxpemUocmVsTmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBub3JtYWxpemUobmFtZSwgcmVsTmFtZSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWFrZUxvYWQoaWQpIHtcbiAgICAgICAgZnVuY3Rpb24gbG9hZCh2YWx1ZSkge1xuICAgICAgICAgICAgbG9hZGVyQ2FjaGVbaWRdID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBsb2FkLmZyb21UZXh0ID0gZnVuY3Rpb24gKGlkLCB0ZXh0KSB7XG4gICAgICAgICAgICAvL1RoaXMgb25lIGlzIGRpZmZpY3VsdCBiZWNhdXNlIHRoZSB0ZXh0IGNhbi9wcm9iYWJseSB1c2VzXG4gICAgICAgICAgICAvL2RlZmluZSwgYW5kIGFueSByZWxhdGl2ZSBwYXRocyBhbmQgcmVxdWlyZXMgc2hvdWxkIGJlIHJlbGF0aXZlXG4gICAgICAgICAgICAvL3RvIHRoYXQgaWQgd2FzIGl0IHdvdWxkIGJlIGZvdW5kIG9uIGRpc2suIEJ1dCB0aGlzIHdvdWxkIHJlcXVpcmVcbiAgICAgICAgICAgIC8vYm9vdHN0cmFwcGluZyBhIG1vZHVsZS9yZXF1aXJlIGZhaXJseSBkZWVwbHkgZnJvbSBub2RlIGNvcmUuXG4gICAgICAgICAgICAvL05vdCBzdXJlIGhvdyBiZXN0IHRvIGdvIGFib3V0IHRoYXQgeWV0LlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhbWRlZmluZSBkb2VzIG5vdCBpbXBsZW1lbnQgbG9hZC5mcm9tVGV4dCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBsb2FkO1xuICAgIH1cblxuICAgIG1ha2VSZXF1aXJlID0gZnVuY3Rpb24gKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgcmVsSWQpIHtcbiAgICAgICAgZnVuY3Rpb24gYW1kUmVxdWlyZShkZXBzLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBkZXBzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIC8vU3luY2hyb25vdXMsIHNpbmdsZSBtb2R1bGUgcmVxdWlyZSgnJylcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyaW5nUmVxdWlyZShzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIGRlcHMsIHJlbElkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9BcnJheSBvZiBkZXBlbmRlbmNpZXMgd2l0aCBhIGNhbGxiYWNrLlxuXG4gICAgICAgICAgICAgICAgLy9Db252ZXJ0IHRoZSBkZXBlbmRlbmNpZXMgdG8gbW9kdWxlcy5cbiAgICAgICAgICAgICAgICBkZXBzID0gZGVwcy5tYXAoZnVuY3Rpb24gKGRlcE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1JlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCBkZXBOYW1lLCByZWxJZCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvL1dhaXQgZm9yIG5leHQgdGljayB0byBjYWxsIGJhY2sgdGhlIHJlcXVpcmUgY2FsbC5cbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBkZXBzKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYW1kUmVxdWlyZS50b1VybCA9IGZ1bmN0aW9uIChmaWxlUGF0aCkge1xuICAgICAgICAgICAgaWYgKGZpbGVQYXRoLmluZGV4T2YoJy4nKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBub3JtYWxpemUoZmlsZVBhdGgsIHBhdGguZGlybmFtZShtb2R1bGUuZmlsZW5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBhbWRSZXF1aXJlO1xuICAgIH07XG5cbiAgICAvL0Zhdm9yIGV4cGxpY2l0IHZhbHVlLCBwYXNzZWQgaW4gaWYgdGhlIG1vZHVsZSB3YW50cyB0byBzdXBwb3J0IE5vZGUgMC40LlxuICAgIHJlcXVpcmVGbiA9IHJlcXVpcmVGbiB8fCBmdW5jdGlvbiByZXEoKSB7XG4gICAgICAgIHJldHVybiBtb2R1bGUucmVxdWlyZS5hcHBseShtb2R1bGUsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJ1bkZhY3RvcnkoaWQsIGRlcHMsIGZhY3RvcnkpIHtcbiAgICAgICAgdmFyIHIsIGUsIG0sIHJlc3VsdDtcblxuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgIGUgPSBsb2FkZXJDYWNoZVtpZF0gPSB7fTtcbiAgICAgICAgICAgIG0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgICAgIHVyaTogX19maWxlbmFtZSxcbiAgICAgICAgICAgICAgICBleHBvcnRzOiBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgciA9IG1ha2VSZXF1aXJlKHJlcXVpcmVGbiwgZSwgbSwgaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9Pbmx5IHN1cHBvcnQgb25lIGRlZmluZSBjYWxsIHBlciBmaWxlXG4gICAgICAgICAgICBpZiAoYWxyZWFkeUNhbGxlZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYW1kZWZpbmUgd2l0aCBubyBtb2R1bGUgSUQgY2Fubm90IGJlIGNhbGxlZCBtb3JlIHRoYW4gb25jZSBwZXIgZmlsZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFscmVhZHlDYWxsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvL1VzZSB0aGUgcmVhbCB2YXJpYWJsZXMgZnJvbSBub2RlXG4gICAgICAgICAgICAvL1VzZSBtb2R1bGUuZXhwb3J0cyBmb3IgZXhwb3J0cywgc2luY2VcbiAgICAgICAgICAgIC8vdGhlIGV4cG9ydHMgaW4gaGVyZSBpcyBhbWRlZmluZSBleHBvcnRzLlxuICAgICAgICAgICAgZSA9IG1vZHVsZS5leHBvcnRzO1xuICAgICAgICAgICAgbSA9IG1vZHVsZTtcbiAgICAgICAgICAgIHIgPSBtYWtlUmVxdWlyZShyZXF1aXJlRm4sIGUsIG0sIG1vZHVsZS5pZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvL0lmIHRoZXJlIGFyZSBkZXBlbmRlbmNpZXMsIHRoZXkgYXJlIHN0cmluZ3MsIHNvIG5lZWRcbiAgICAgICAgLy90byBjb252ZXJ0IHRoZW0gdG8gZGVwZW5kZW5jeSB2YWx1ZXMuXG4gICAgICAgIGlmIChkZXBzKSB7XG4gICAgICAgICAgICBkZXBzID0gZGVwcy5tYXAoZnVuY3Rpb24gKGRlcE5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcihkZXBOYW1lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9DYWxsIHRoZSBmYWN0b3J5IHdpdGggdGhlIHJpZ2h0IGRlcGVuZGVuY2llcy5cbiAgICAgICAgaWYgKHR5cGVvZiBmYWN0b3J5ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBmYWN0b3J5LmFwcGx5KG0uZXhwb3J0cywgZGVwcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSBmYWN0b3J5O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBtLmV4cG9ydHMgPSByZXN1bHQ7XG4gICAgICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJDYWNoZVtpZF0gPSBtLmV4cG9ydHM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdHJpbmdSZXF1aXJlID0gZnVuY3Rpb24gKHN5c3RlbVJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSwgaWQsIHJlbElkKSB7XG4gICAgICAgIC8vU3BsaXQgdGhlIElEIGJ5IGEgISBzbyB0aGF0XG4gICAgICAgIHZhciBpbmRleCA9IGlkLmluZGV4T2YoJyEnKSxcbiAgICAgICAgICAgIG9yaWdpbmFsSWQgPSBpZCxcbiAgICAgICAgICAgIHByZWZpeCwgcGx1Z2luO1xuXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIGlkID0gbm9ybWFsaXplKGlkLCByZWxJZCk7XG5cbiAgICAgICAgICAgIC8vU3RyYWlnaHQgbW9kdWxlIGxvb2t1cC4gSWYgaXQgaXMgb25lIG9mIHRoZSBzcGVjaWFsIGRlcGVuZGVuY2llcyxcbiAgICAgICAgICAgIC8vZGVhbCB3aXRoIGl0LCBvdGhlcndpc2UsIGRlbGVnYXRlIHRvIG5vZGUuXG4gICAgICAgICAgICBpZiAoaWQgPT09ICdyZXF1aXJlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBtYWtlUmVxdWlyZShzeXN0ZW1SZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUsIHJlbElkKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaWQgPT09ICdleHBvcnRzJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBleHBvcnRzO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpZCA9PT0gJ21vZHVsZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kdWxlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChsb2FkZXJDYWNoZS5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZGVyQ2FjaGVbaWRdO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWZpbmVDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgICAgICBydW5GYWN0b3J5LmFwcGx5KG51bGwsIGRlZmluZUNhY2hlW2lkXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYoc3lzdGVtUmVxdWlyZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3lzdGVtUmVxdWlyZShvcmlnaW5hbElkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1vZHVsZSB3aXRoIElEOiAnICsgaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vVGhlcmUgaXMgYSBwbHVnaW4gaW4gcGxheS5cbiAgICAgICAgICAgIHByZWZpeCA9IGlkLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgICAgICBpZCA9IGlkLnN1YnN0cmluZyhpbmRleCArIDEsIGlkLmxlbmd0aCk7XG5cbiAgICAgICAgICAgIHBsdWdpbiA9IHN0cmluZ1JlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCBwcmVmaXgsIHJlbElkKTtcblxuICAgICAgICAgICAgaWYgKHBsdWdpbi5ub3JtYWxpemUpIHtcbiAgICAgICAgICAgICAgICBpZCA9IHBsdWdpbi5ub3JtYWxpemUoaWQsIG1ha2VOb3JtYWxpemUocmVsSWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9Ob3JtYWxpemUgdGhlIElEIG5vcm1hbGx5LlxuICAgICAgICAgICAgICAgIGlkID0gbm9ybWFsaXplKGlkLCByZWxJZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsb2FkZXJDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZGVyQ2FjaGVbaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwbHVnaW4ubG9hZChpZCwgbWFrZVJlcXVpcmUoc3lzdGVtUmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlLCByZWxJZCksIG1ha2VMb2FkKGlkKSwge30pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvL0NyZWF0ZSBhIGRlZmluZSBmdW5jdGlvbiBzcGVjaWZpYyB0byB0aGUgbW9kdWxlIGFza2luZyBmb3IgYW1kZWZpbmUuXG4gICAgZnVuY3Rpb24gZGVmaW5lKGlkLCBkZXBzLCBmYWN0b3J5KSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGlkKSkge1xuICAgICAgICAgICAgZmFjdG9yeSA9IGRlcHM7XG4gICAgICAgICAgICBkZXBzID0gaWQ7XG4gICAgICAgICAgICBpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBmYWN0b3J5ID0gaWQ7XG4gICAgICAgICAgICBpZCA9IGRlcHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwcyAmJiAhQXJyYXkuaXNBcnJheShkZXBzKSkge1xuICAgICAgICAgICAgZmFjdG9yeSA9IGRlcHM7XG4gICAgICAgICAgICBkZXBzID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkZXBzKSB7XG4gICAgICAgICAgICBkZXBzID0gWydyZXF1aXJlJywgJ2V4cG9ydHMnLCAnbW9kdWxlJ107XG4gICAgICAgIH1cblxuICAgICAgICAvL1NldCB1cCBwcm9wZXJ0aWVzIGZvciB0aGlzIG1vZHVsZS4gSWYgYW4gSUQsIHRoZW4gdXNlXG4gICAgICAgIC8vaW50ZXJuYWwgY2FjaGUuIElmIG5vIElELCB0aGVuIHVzZSB0aGUgZXh0ZXJuYWwgdmFyaWFibGVzXG4gICAgICAgIC8vZm9yIHRoaXMgbm9kZSBtb2R1bGUuXG4gICAgICAgIGlmIChpZCkge1xuICAgICAgICAgICAgLy9QdXQgdGhlIG1vZHVsZSBpbiBkZWVwIGZyZWV6ZSB1bnRpbCB0aGVyZSBpcyBhXG4gICAgICAgICAgICAvL3JlcXVpcmUgY2FsbCBmb3IgaXQuXG4gICAgICAgICAgICBkZWZpbmVDYWNoZVtpZF0gPSBbaWQsIGRlcHMsIGZhY3RvcnldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcnVuRmFjdG9yeShpZCwgZGVwcywgZmFjdG9yeSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvL2RlZmluZS5yZXF1aXJlLCB3aGljaCBoYXMgYWNjZXNzIHRvIGFsbCB0aGUgdmFsdWVzIGluIHRoZVxuICAgIC8vY2FjaGUuIFVzZWZ1bCBmb3IgQU1EIG1vZHVsZXMgdGhhdCBhbGwgaGF2ZSBJRHMgaW4gdGhlIGZpbGUsXG4gICAgLy9idXQgbmVlZCB0byBmaW5hbGx5IGV4cG9ydCBhIHZhbHVlIHRvIG5vZGUgYmFzZWQgb24gb25lIG9mIHRob3NlXG4gICAgLy9JRHMuXG4gICAgZGVmaW5lLnJlcXVpcmUgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgaWYgKGxvYWRlckNhY2hlW2lkXSkge1xuICAgICAgICAgICAgcmV0dXJuIGxvYWRlckNhY2hlW2lkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZWZpbmVDYWNoZVtpZF0pIHtcbiAgICAgICAgICAgIHJ1bkZhY3RvcnkuYXBwbHkobnVsbCwgZGVmaW5lQ2FjaGVbaWRdKTtcbiAgICAgICAgICAgIHJldHVybiBsb2FkZXJDYWNoZVtpZF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lLmFtZCA9IHt9O1xuXG4gICAgcmV0dXJuIGRlZmluZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhbWRlZmluZTtcbiIsIi8vIENvcHlyaWdodCAyMDE0IFNpbW9uIEx5ZGVsbFxyXG4vLyBYMTEgKOKAnE1JVOKAnSkgTGljZW5zZWQuIChTZWUgTElDRU5TRS4pXHJcblxyXG52YXIgcGF0aCA9IHJlcXVpcmUoXCJwYXRoXCIpXHJcblxyXG5cInVzZSBzdHJpY3RcIlxyXG5cclxuZnVuY3Rpb24gdXJpeChhUGF0aCkge1xyXG4gIGlmIChwYXRoLnNlcCA9PT0gXCJcXFxcXCIpIHtcclxuICAgIHJldHVybiBhUGF0aFxyXG4gICAgICAucmVwbGFjZSgvXFxcXC9nLCBcIi9cIilcclxuICAgICAgLnJlcGxhY2UoL15bYS16XTpcXC8/L2ksIFwiL1wiKVxyXG4gIH1cclxuICByZXR1cm4gYVBhdGhcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB1cml4XHJcbiIsIihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGZhY3RvcnkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJvb3QuZGVlcG1lcmdlID0gZmFjdG9yeSgpO1xuICAgIH1cbn0odGhpcywgZnVuY3Rpb24gKCkge1xuXG5yZXR1cm4gZnVuY3Rpb24gZGVlcG1lcmdlKHRhcmdldCwgc3JjKSB7XG4gICAgdmFyIGFycmF5ID0gQXJyYXkuaXNBcnJheShzcmMpO1xuICAgIHZhciBkc3QgPSBhcnJheSAmJiBbXSB8fCB7fTtcblxuICAgIGlmIChhcnJheSkge1xuICAgICAgICB0YXJnZXQgPSB0YXJnZXQgfHwgW107XG4gICAgICAgIGRzdCA9IGRzdC5jb25jYXQodGFyZ2V0KTtcbiAgICAgICAgc3JjLmZvckVhY2goZnVuY3Rpb24oZSwgaSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBkc3RbaV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgZHN0W2ldID0gZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgZHN0W2ldID0gZGVlcG1lcmdlKHRhcmdldFtpXSwgZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaW5kZXhPZihlKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZHN0LnB1c2goZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGFyZ2V0ICYmIHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0YXJnZXQpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIGRzdFtrZXldID0gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5rZXlzKHNyYykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNyY1trZXldICE9PSAnb2JqZWN0JyB8fCAhc3JjW2tleV0pIHtcbiAgICAgICAgICAgICAgICBkc3Rba2V5XSA9IHNyY1trZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRba2V5XSkge1xuICAgICAgICAgICAgICAgICAgICBkc3Rba2V5XSA9IHNyY1trZXldO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRzdFtrZXldID0gZGVlcG1lcmdlKHRhcmdldFtrZXldLCBzcmNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZHN0O1xufVxuXG59KSk7XG4iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyByZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggYXJyYXkgd2l0aCBkaXJlY3RvcnkgbmFtZXMgdGhlcmVcbi8vIG11c3QgYmUgbm8gc2xhc2hlcywgZW1wdHkgZWxlbWVudHMsIG9yIGRldmljZSBuYW1lcyAoYzpcXCkgaW4gdGhlIGFycmF5XG4vLyAoc28gYWxzbyBubyBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaGVzIC0gaXQgZG9lcyBub3QgZGlzdGluZ3Vpc2hcbi8vIHJlbGF0aXZlIGFuZCBhYnNvbHV0ZSBwYXRocylcbmZ1bmN0aW9uIG5vcm1hbGl6ZUFycmF5KHBhcnRzLCBhbGxvd0Fib3ZlUm9vdCkge1xuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gcGFydHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICB2YXIgbGFzdCA9IHBhcnRzW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmIChhbGxvd0Fib3ZlUm9vdCkge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgcGFydHMudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFydHM7XG59XG5cbi8vIFNwbGl0IGEgZmlsZW5hbWUgaW50byBbcm9vdCwgZGlyLCBiYXNlbmFtZSwgZXh0XSwgdW5peCB2ZXJzaW9uXG4vLyAncm9vdCcgaXMganVzdCBhIHNsYXNoLCBvciBub3RoaW5nLlxudmFyIHNwbGl0UGF0aFJlID1cbiAgICAvXihcXC8/fCkoW1xcc1xcU10qPykoKD86XFwuezEsMn18W15cXC9dKz98KShcXC5bXi5cXC9dKnwpKSg/OltcXC9dKikkLztcbnZhciBzcGxpdFBhdGggPSBmdW5jdGlvbihmaWxlbmFtZSkge1xuICByZXR1cm4gc3BsaXRQYXRoUmUuZXhlYyhmaWxlbmFtZSkuc2xpY2UoMSk7XG59O1xuXG4vLyBwYXRoLnJlc29sdmUoW2Zyb20gLi4uXSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJlc29sdmVkUGF0aCA9ICcnLFxuICAgICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+PSAtMSAmJiAhcmVzb2x2ZWRBYnNvbHV0ZTsgaS0tKSB7XG4gICAgdmFyIHBhdGggPSAoaSA+PSAwKSA/IGFyZ3VtZW50c1tpXSA6IHByb2Nlc3MuY3dkKCk7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGFuZCBpbnZhbGlkIGVudHJpZXNcbiAgICBpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5yZXNvbHZlIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH0gZWxzZSBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJlc29sdmVkUGF0aCA9IHBhdGggKyAnLycgKyByZXNvbHZlZFBhdGg7XG4gICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IHBhdGguY2hhckF0KDApID09PSAnLyc7XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50IHRoZSBwYXRoIHNob3VsZCBiZSByZXNvbHZlZCB0byBhIGZ1bGwgYWJzb2x1dGUgcGF0aCwgYnV0XG4gIC8vIGhhbmRsZSByZWxhdGl2ZSBwYXRocyB0byBiZSBzYWZlIChtaWdodCBoYXBwZW4gd2hlbiBwcm9jZXNzLmN3ZCgpIGZhaWxzKVxuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICByZXNvbHZlZFBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocmVzb2x2ZWRQYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIXJlc29sdmVkQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICByZXR1cm4gKChyZXNvbHZlZEFic29sdXRlID8gJy8nIDogJycpICsgcmVzb2x2ZWRQYXRoKSB8fCAnLic7XG59O1xuXG4vLyBwYXRoLm5vcm1hbGl6ZShwYXRoKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5ub3JtYWxpemUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciBpc0Fic29sdXRlID0gZXhwb3J0cy5pc0Fic29sdXRlKHBhdGgpLFxuICAgICAgdHJhaWxpbmdTbGFzaCA9IHN1YnN0cihwYXRoLCAtMSkgPT09ICcvJztcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihwYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIWlzQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICBpZiAoIXBhdGggJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBwYXRoID0gJy4nO1xuICB9XG4gIGlmIChwYXRoICYmIHRyYWlsaW5nU2xhc2gpIHtcbiAgICBwYXRoICs9ICcvJztcbiAgfVxuXG4gIHJldHVybiAoaXNBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHBhdGg7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmlzQWJzb2x1dGUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5qb2luID0gZnVuY3Rpb24oKSB7XG4gIHZhciBwYXRocyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gIHJldHVybiBleHBvcnRzLm5vcm1hbGl6ZShmaWx0ZXIocGF0aHMsIGZ1bmN0aW9uKHAsIGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBwICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGguam9pbiBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH0pLmpvaW4oJy8nKSk7XG59O1xuXG5cbi8vIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlbGF0aXZlID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgZnJvbSA9IGV4cG9ydHMucmVzb2x2ZShmcm9tKS5zdWJzdHIoMSk7XG4gIHRvID0gZXhwb3J0cy5yZXNvbHZlKHRvKS5zdWJzdHIoMSk7XG5cbiAgZnVuY3Rpb24gdHJpbShhcnIpIHtcbiAgICB2YXIgc3RhcnQgPSAwO1xuICAgIGZvciAoOyBzdGFydCA8IGFyci5sZW5ndGg7IHN0YXJ0KyspIHtcbiAgICAgIGlmIChhcnJbc3RhcnRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgdmFyIGVuZCA9IGFyci5sZW5ndGggLSAxO1xuICAgIGZvciAoOyBlbmQgPj0gMDsgZW5kLS0pIHtcbiAgICAgIGlmIChhcnJbZW5kXSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChzdGFydCA+IGVuZCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBhcnIuc2xpY2Uoc3RhcnQsIGVuZCAtIHN0YXJ0ICsgMSk7XG4gIH1cblxuICB2YXIgZnJvbVBhcnRzID0gdHJpbShmcm9tLnNwbGl0KCcvJykpO1xuICB2YXIgdG9QYXJ0cyA9IHRyaW0odG8uc3BsaXQoJy8nKSk7XG5cbiAgdmFyIGxlbmd0aCA9IE1hdGgubWluKGZyb21QYXJ0cy5sZW5ndGgsIHRvUGFydHMubGVuZ3RoKTtcbiAgdmFyIHNhbWVQYXJ0c0xlbmd0aCA9IGxlbmd0aDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmIChmcm9tUGFydHNbaV0gIT09IHRvUGFydHNbaV0pIHtcbiAgICAgIHNhbWVQYXJ0c0xlbmd0aCA9IGk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2YXIgb3V0cHV0UGFydHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IHNhbWVQYXJ0c0xlbmd0aDsgaSA8IGZyb21QYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIG91dHB1dFBhcnRzLnB1c2goJy4uJyk7XG4gIH1cblxuICBvdXRwdXRQYXJ0cyA9IG91dHB1dFBhcnRzLmNvbmNhdCh0b1BhcnRzLnNsaWNlKHNhbWVQYXJ0c0xlbmd0aCkpO1xuXG4gIHJldHVybiBvdXRwdXRQYXJ0cy5qb2luKCcvJyk7XG59O1xuXG5leHBvcnRzLnNlcCA9ICcvJztcbmV4cG9ydHMuZGVsaW1pdGVyID0gJzonO1xuXG5leHBvcnRzLmRpcm5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciByZXN1bHQgPSBzcGxpdFBhdGgocGF0aCksXG4gICAgICByb290ID0gcmVzdWx0WzBdLFxuICAgICAgZGlyID0gcmVzdWx0WzFdO1xuXG4gIGlmICghcm9vdCAmJiAhZGlyKSB7XG4gICAgLy8gTm8gZGlybmFtZSB3aGF0c29ldmVyXG4gICAgcmV0dXJuICcuJztcbiAgfVxuXG4gIGlmIChkaXIpIHtcbiAgICAvLyBJdCBoYXMgYSBkaXJuYW1lLCBzdHJpcCB0cmFpbGluZyBzbGFzaFxuICAgIGRpciA9IGRpci5zdWJzdHIoMCwgZGlyLmxlbmd0aCAtIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJvb3QgKyBkaXI7XG59O1xuXG5cbmV4cG9ydHMuYmFzZW5hbWUgPSBmdW5jdGlvbihwYXRoLCBleHQpIHtcbiAgdmFyIGYgPSBzcGxpdFBhdGgocGF0aClbMl07XG4gIC8vIFRPRE86IG1ha2UgdGhpcyBjb21wYXJpc29uIGNhc2UtaW5zZW5zaXRpdmUgb24gd2luZG93cz9cbiAgaWYgKGV4dCAmJiBmLnN1YnN0cigtMSAqIGV4dC5sZW5ndGgpID09PSBleHQpIHtcbiAgICBmID0gZi5zdWJzdHIoMCwgZi5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgfVxuICByZXR1cm4gZjtcbn07XG5cblxuZXhwb3J0cy5leHRuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gc3BsaXRQYXRoKHBhdGgpWzNdO1xufTtcblxuZnVuY3Rpb24gZmlsdGVyICh4cywgZikge1xuICAgIGlmICh4cy5maWx0ZXIpIHJldHVybiB4cy5maWx0ZXIoZik7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGYoeHNbaV0sIGksIHhzKSkgcmVzLnB1c2goeHNbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufVxuXG4vLyBTdHJpbmcucHJvdG90eXBlLnN1YnN0ciAtIG5lZ2F0aXZlIGluZGV4IGRvbid0IHdvcmsgaW4gSUU4XG52YXIgc3Vic3RyID0gJ2FiJy5zdWJzdHIoLTEpID09PSAnYidcbiAgICA/IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHsgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbikgfVxuICAgIDogZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikge1xuICAgICAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IHN0ci5sZW5ndGggKyBzdGFydDtcbiAgICAgICAgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbik7XG4gICAgfVxuO1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKlxuICogQ29weXJpZ2h0IChDKSAyMDA3LTIwMTUgRGllZ28gUGVyaW5pXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIG53bWF0Y2hlci5qcyAtIEEgZmFzdCBDU1Mgc2VsZWN0b3IgZW5naW5lIGFuZCBtYXRjaGVyXG4gKlxuICogQXV0aG9yOiBEaWVnbyBQZXJpbmkgPGRpZWdvLnBlcmluaSBhdCBnbWFpbCBjb20+XG4gKiBWZXJzaW9uOiAxLjMuN1xuICogQ3JlYXRlZDogMjAwNzA3MjJcbiAqIFJlbGVhc2U6IDIwMTUxMTIwXG4gKlxuICogTGljZW5zZTpcbiAqICBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vTldNYXRjaGVyL01JVC1MSUNFTlNFXG4gKiBEb3dubG9hZDpcbiAqICBodHRwOi8vamF2YXNjcmlwdC5ud2JveC5jb20vTldNYXRjaGVyL253bWF0Y2hlci5qc1xuICovXG5cbihmdW5jdGlvbihnbG9iYWwsIGZhY3RvcnkpIHtcblxuICBpZiAodHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0Jykge1xuICAgIC8vIGluIGEgTm9kZS5qcyBlbnZpcm9ubWVudCwgdGhlIG53bWF0Y2hlciBmdW5jdGlvbnMgd2lsbCBvcGVyYXRlIG9uXG4gICAgLy8gdGhlIHBhc3NlZCBcImJyb3dzZXJHbG9iYWxcIiBhbmQgd2lsbCBiZSByZXR1cm5lZCBpbiBhbiBvYmplY3RcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChicm93c2VyR2xvYmFsKSB7XG4gICAgICAvLyBwYXNzZWQgZ2xvYmFsIGRvZXMgbm90IGNvbnRhaW5cbiAgICAgIC8vIHJlZmVyZW5jZXMgdG8gbmF0aXZlIG9iamVjdHNcbiAgICAgIGJyb3dzZXJHbG9iYWwuY29uc29sZSA9IGNvbnNvbGU7XG4gICAgICBicm93c2VyR2xvYmFsLnBhcnNlSW50ID0gcGFyc2VJbnQ7XG4gICAgICBicm93c2VyR2xvYmFsLkZ1bmN0aW9uID0gRnVuY3Rpb247XG4gICAgICBicm93c2VyR2xvYmFsLkJvb2xlYW4gPSBCb29sZWFuO1xuICAgICAgYnJvd3Nlckdsb2JhbC5OdW1iZXIgPSBOdW1iZXI7XG4gICAgICBicm93c2VyR2xvYmFsLlJlZ0V4cCA9IFJlZ0V4cDtcbiAgICAgIGJyb3dzZXJHbG9iYWwuU3RyaW5nID0gU3RyaW5nO1xuICAgICAgYnJvd3Nlckdsb2JhbC5PYmplY3QgPSBPYmplY3Q7XG4gICAgICBicm93c2VyR2xvYmFsLkFycmF5ID0gQXJyYXk7XG4gICAgICBicm93c2VyR2xvYmFsLkVycm9yID0gRXJyb3I7XG4gICAgICBicm93c2VyR2xvYmFsLkRhdGUgPSBEYXRlO1xuICAgICAgYnJvd3Nlckdsb2JhbC5NYXRoID0gTWF0aDtcbiAgICAgIHZhciBleHBvcnRzID0gYnJvd3Nlckdsb2JhbC5PYmplY3QoKTtcbiAgICAgIGZhY3RvcnkoYnJvd3Nlckdsb2JhbCwgZXhwb3J0cyk7XG4gICAgICByZXR1cm4gZXhwb3J0cztcbiAgICB9O1xuICAgIG1vZHVsZS5mYWN0b3J5ID0gZmFjdG9yeTtcbiAgfSBlbHNlIHtcbiAgICAvLyBpbiBhIGJyb3dzZXIgZW52aXJvbm1lbnQsIHRoZSBud21hdGNoZXIgZnVuY3Rpb25zIHdpbGwgb3BlcmF0ZSBvblxuICAgIC8vIHRoZSBcImdsb2JhbFwiIGxvYWRpbmcgdGhlbSBhbmQgYmUgYXR0YWNoZWQgdG8gXCJnbG9iYWwuTlcuRG9tXCJcbiAgICBmYWN0b3J5KGdsb2JhbCxcbiAgICAgIChnbG9iYWwuTlcgfHwgKGdsb2JhbC5OVyA9IGdsb2JhbC5PYmplY3QoKSkpICYmXG4gICAgICAoZ2xvYmFsLk5XLkRvbSB8fCAoZ2xvYmFsLk5XLkRvbSA9IGdsb2JhbC5PYmplY3QoKSkpKTtcbiAgICBnbG9iYWwuTlcuRG9tLmZhY3RvcnkgPSBmYWN0b3J5O1xuICB9XG5cbn0pKHRoaXMsIGZ1bmN0aW9uKGdsb2JhbCwgZXhwb3J0cykge1xuXG4gIHZhciB2ZXJzaW9uID0gJ253bWF0Y2hlci0xLjMuNycsXG5cbiAgRG9tID0gZXhwb3J0cyxcblxuICAvLyBwcm9jZXNzaW5nIGNvbnRleHQgJiByb290IGVsZW1lbnRcbiAgZG9jID0gZ2xvYmFsLmRvY3VtZW50LFxuICByb290ID0gZG9jLmRvY3VtZW50RWxlbWVudCxcblxuICAvLyBzYXZlIHV0aWxpdHkgbWV0aG9kcyByZWZlcmVuY2VzXG4gIHNsaWNlID0gZ2xvYmFsLkFycmF5LnByb3RvdHlwZS5zbGljZSxcbiAgc3RyaW5nID0gZ2xvYmFsLk9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsXG5cbiAgLy8gcGVyc2lzdCBwcmV2aW91cyBwYXJzZWQgZGF0YVxuICBpc1NpbmdsZU1hdGNoLFxuICBpc1NpbmdsZVNlbGVjdCxcblxuICBsYXN0U2xpY2UsXG4gIGxhc3RDb250ZXh0LFxuICBsYXN0UG9zaXRpb24sXG5cbiAgbGFzdE1hdGNoZXIsXG4gIGxhc3RTZWxlY3RvcixcblxuICBsYXN0UGFydHNNYXRjaCxcbiAgbGFzdFBhcnRzU2VsZWN0LFxuXG4gIC8vIGFjY2VwdGVkIHByZWZpeCBpZGVudGlmaWVyc1xuICAvLyAoaWQsIGNsYXNzICYgcHNldWRvLWNsYXNzKVxuICBwcmVmaXhlcyA9ICdbIy46XT8nLFxuXG4gIC8vIGFjY2VwdGVkIGF0dHJpYnV0ZSBvcGVyYXRvcnNcbiAgb3BlcmF0b3JzID0gJyhbfipeJHwhXT89ezF9KScsXG5cbiAgLy8gYWNjZXB0ZWQgd2hpdGVzcGFjZSBjaGFyYWN0ZXJzXG4gIHdoaXRlc3BhY2UgPSAnW1xcXFx4MjBcXFxcdFxcXFxuXFxcXHJcXFxcZl0qJyxcblxuICAvLyA0IGNvbWJpbmF0b3JzIEYgRSwgRj5FLCBGK0UsIEZ+RVxuICBjb21iaW5hdG9ycyA9ICdbXFxcXHgyMF18Wz4rfl0oPz1bXj4rfl0pJyxcblxuICAvLyBhbitiIGZvcm1hdCBwYXJhbXMgZm9yIHBzZXVkby1jbGFzc2VzXG4gIHBzZXVkb3Bhcm1zID0gJyg/OlstK10/XFxcXGQqbik/Wy0rXT9cXFxcZConLFxuXG4gIC8vIENTUyBxdW90ZWQgc3RyaW5nIHZhbHVlc1xuICBxdW90ZWR2YWx1ZSA9ICdcIlteXCJcXFxcXFxcXF0qKD86XFxcXFxcXFwuW15cIlxcXFxcXFxcXSopKlwiJyArIFwifCdbXidcXFxcXFxcXF0qKD86XFxcXFxcXFwuW14nXFxcXFxcXFxdKikqJ1wiLFxuXG4gIC8vIHNraXAgcm91bmQgYnJhY2tldHMgZ3JvdXBzXG4gIHNraXByb3VuZCA9ICdcXFxcKFteKCldK1xcXFwpfFxcXFwoLipcXFxcKScsXG4gIC8vIHNraXAgY3VybHkgYnJhY2tldHMgZ3JvdXBzXG4gIHNraXBjdXJseSA9ICdcXFxce1tee31dK1xcXFx9fFxcXFx7LipcXFxcfScsXG4gIC8vIHNraXAgc3F1YXJlIGJyYWNrZXRzIGdyb3Vwc1xuICBza2lwc3F1YXJlID0gJ1xcXFxbW15bXFxcXF1dKlxcXFxdfFxcXFxbLipcXFxcXScsXG5cbiAgLy8gc2tpcCBbIF0sICggKSwgeyB9IGJyYWNrZXRzIGdyb3Vwc1xuICBza2lwZ3JvdXAgPSAnXFxcXFsuKlxcXFxdfFxcXFwoLipcXFxcKXxcXFxcey4qXFxcXH0nLFxuXG4gIC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtc3ludGF4LyNjaGFyYWN0ZXJzXG4gIC8vIHVuaWNvZGUvSVNPIDEwNjQ2IGNoYXJhY3RlcnMgMTYxIGFuZCBoaWdoZXJcbiAgLy8gTk9URTogU2FmYXJpIDIuMC54IGNyYXNoZXMgd2l0aCBlc2NhcGVkIChcXFxcKVxuICAvLyBVbmljb2RlIHJhbmdlcyBpbiByZWd1bGFyIGV4cHJlc3Npb25zIHNvIHdlXG4gIC8vIHVzZSBhIG5lZ2F0ZWQgY2hhcmFjdGVyIHJhbmdlIGNsYXNzIGluc3RlYWRcbiAgZW5jb2RpbmcgPSAnKD86Wy1cXFxcd118W15cXFxceDAwLVxcXFx4YTBdfFxcXFxcXFxcLiknLFxuXG4gIC8vIENTUyBpZGVudGlmaWVyIHN5bnRheFxuICBpZGVudGlmaWVyID0gJyg/Oi0/W19hLXpBLVpdezF9Wy1cXFxcd10qfFteXFxcXHgwMC1cXFxceGEwXSt8XFxcXFxcXFwuKykrJyxcblxuICAvLyBidWlsZCBhdHRyaWJ1dGUgc3RyaW5nXG4gIGF0dHJjaGVjayA9ICcoJyArIHF1b3RlZHZhbHVlICsgJ3wnICsgaWRlbnRpZmllciArICcpJyxcbiAgYXR0cmlidXRlcyA9IHdoaXRlc3BhY2UgKyAnKCcgKyBlbmNvZGluZyArICcqOj8nICsgZW5jb2RpbmcgKyAnKyknICtcbiAgICB3aGl0ZXNwYWNlICsgJyg/OicgKyBvcGVyYXRvcnMgKyB3aGl0ZXNwYWNlICsgYXR0cmNoZWNrICsgJyk/JyArIHdoaXRlc3BhY2UsXG4gIGF0dHJtYXRjaGVyID0gYXR0cmlidXRlcy5yZXBsYWNlKGF0dHJjaGVjaywgJyhbXFxcXHgyMlxcXFx4MjddKikoKD86XFxcXFxcXFw/LikqPylcXFxcMycpLFxuXG4gIC8vIGJ1aWxkIHBzZXVkb2NsYXNzIHN0cmluZ1xuICBwc2V1ZG9jbGFzcyA9ICcoKD86JyArXG4gICAgLy8gYW4rYiBwYXJhbWV0ZXJzIG9yIHF1b3RlZCBzdHJpbmdcbiAgICBwc2V1ZG9wYXJtcyArICd8JyArIHF1b3RlZHZhbHVlICsgJ3wnICtcbiAgICAvLyBpZCwgY2xhc3MsIHBzZXVkby1jbGFzcyBzZWxlY3RvclxuICAgIHByZWZpeGVzICsgJ3wnICsgZW5jb2RpbmcgKyAnK3wnICtcbiAgICAvLyBuZXN0ZWQgSFRNTCBhdHRyaWJ1dGUgc2VsZWN0b3JcbiAgICAnXFxcXFsnICsgYXR0cmlidXRlcyArICdcXFxcXXwnICtcbiAgICAvLyBuZXN0ZWQgcHNldWRvLWNsYXNzIHNlbGVjdG9yXG4gICAgJ1xcXFwoLitcXFxcKXwnICsgd2hpdGVzcGFjZSArICd8JyArXG4gICAgLy8gbmVzdGVkIHBzZXVkb3Mvc2VwYXJhdG9yc1xuICAgICcsKSspJyxcblxuICAvLyBwbGFjZWhvbGRlciBmb3IgZXh0ZW5zaW9uc1xuICBleHRlbnNpb25zID0gJy4rJyxcblxuICAvLyBDU1MzOiBzeW50YXggc2Nhbm5lciBhbmRcbiAgLy8gb25lIHBhc3MgdmFsaWRhdGlvbiBvbmx5XG4gIC8vIHVzaW5nIHJlZ3VsYXIgZXhwcmVzc2lvblxuICBzdGFuZGFyZFZhbGlkYXRvciA9XG4gICAgLy8gZGlzY2FyZCBzdGFydFxuICAgICcoPz1bXFxcXHgyMFxcXFx0XFxcXG5cXFxcclxcXFxmXSpbXj4rfigpe308Pl0pJyArXG4gICAgLy8gb3BlbiBtYXRjaCBncm91cFxuICAgICcoJyArXG4gICAgLy91bml2ZXJzYWwgc2VsZWN0b3JcbiAgICAnXFxcXConICtcbiAgICAvLyBpZC9jbGFzcy90YWcvcHNldWRvLWNsYXNzIGlkZW50aWZpZXJcbiAgICAnfCg/OicgKyBwcmVmaXhlcyArIGlkZW50aWZpZXIgKyAnKScgK1xuICAgIC8vIGNvbWJpbmF0b3Igc2VsZWN0b3JcbiAgICAnfCcgKyBjb21iaW5hdG9ycyArXG4gICAgLy8gSFRNTCBhdHRyaWJ1dGUgc2VsZWN0b3JcbiAgICAnfFxcXFxbJyArIGF0dHJpYnV0ZXMgKyAnXFxcXF0nICtcbiAgICAvLyBwc2V1ZG8tY2xhc3NlcyBwYXJhbWV0ZXJzXG4gICAgJ3xcXFxcKCcgKyBwc2V1ZG9jbGFzcyArICdcXFxcKScgK1xuICAgIC8vIGRvbSBwcm9wZXJ0aWVzIHNlbGVjdG9yIChleHRlbnNpb24pXG4gICAgJ3xcXFxceycgKyBleHRlbnNpb25zICsgJ1xcXFx9JyArXG4gICAgLy8gc2VsZWN0b3IgZ3JvdXAgc2VwYXJhdG9yIChjb21tYSlcbiAgICAnfCg/Oix8JyArIHdoaXRlc3BhY2UgKyAnKScgK1xuICAgIC8vIGNsb3NlIG1hdGNoIGdyb3VwXG4gICAgJykrJyxcblxuICAvLyB2YWxpZGF0b3IgZm9yIGNvbXBsZXggc2VsZWN0b3JzIGluICc6bm90KCknIHBzZXVkby1jbGFzc2VzXG4gIGV4dGVuZGVkVmFsaWRhdG9yID0gc3RhbmRhcmRWYWxpZGF0b3IucmVwbGFjZShwc2V1ZG9jbGFzcywgJy4qJyksXG5cbiAgLy8gdmFsaWRhdG9yIGZvciBzdGFuZGFyZCBzZWxlY3RvcnMgYXMgZGVmYXVsdFxuICByZVZhbGlkYXRvciA9IG5ldyBnbG9iYWwuUmVnRXhwKHN0YW5kYXJkVmFsaWRhdG9yKSxcblxuICAvLyB3aGl0ZXNwYWNlIGlzIGFueSBjb21iaW5hdGlvbiBvZiB0aGVzZSA1IGNoYXJhY3RlciBbXFx4MjBcXHRcXG5cXHJcXGZdXG4gIC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtc2VsZWN0b3JzLyNzZWxlY3Rvci1zeW50YXhcbiAgcmVUcmltU3BhY2VzID0gbmV3IGdsb2JhbC5SZWdFeHAoJ14nICtcbiAgICB3aGl0ZXNwYWNlICsgJ3wnICsgd2hpdGVzcGFjZSArICckJywgJ2cnKSxcblxuICAvLyBvbmx5IGFsbG93IHNpbXBsZSBzZWxlY3RvcnMgbmVzdGVkIGluICc6bm90KCknIHBzZXVkby1jbGFzc2VzXG4gIHJlU2ltcGxlTm90ID0gbmV3IGdsb2JhbC5SZWdFeHAoJ14oJyArXG4gICAgJyg/ITpub3QpJyArXG4gICAgJygnICsgcHJlZml4ZXMgK1xuICAgICd8JyArIGlkZW50aWZpZXIgK1xuICAgICd8XFxcXChbXigpXSpcXFxcKSkrJyArXG4gICAgJ3xcXFxcWycgKyBhdHRyaWJ1dGVzICsgJ1xcXFxdJyArXG4gICAgJykkJyksXG5cbiAgLy8gc3BsaXQgY29tbWEgZ3JvdXBzLCBleGNsdWRlIGNvbW1hcyBmcm9tXG4gIC8vIHF1b3RlcyAnJyBcIlwiIGFuZCBmcm9tIGJyYWNrZXRzICgpIFtdIHt9XG4gIHJlU3BsaXRHcm91cCA9IG5ldyBnbG9iYWwuUmVnRXhwKCcoJyArXG4gICAgJ1teLFxcXFxcXFxcKClbXFxcXF1dKycgK1xuICAgICd8JyArIHNraXBzcXVhcmUgK1xuICAgICd8JyArIHNraXByb3VuZCArXG4gICAgJ3wnICsgc2tpcGN1cmx5ICtcbiAgICAnfFxcXFxcXFxcLicgK1xuICAgICcpKycsICdnJyksXG5cbiAgLy8gc3BsaXQgbGFzdCwgcmlnaHQgbW9zdCwgc2VsZWN0b3IgZ3JvdXAgdG9rZW5cbiAgcmVTcGxpdFRva2VuID0gbmV3IGdsb2JhbC5SZWdFeHAoJygnICtcbiAgICAnXFxcXFsnICsgYXR0cmlidXRlcyArICdcXFxcXXwnICtcbiAgICAnXFxcXCgnICsgcHNldWRvY2xhc3MgKyAnXFxcXCl8JyArXG4gICAgJ1xcXFxcXFxcLnxbXlxcXFx4MjBcXFxcdFxcXFxyXFxcXG5cXFxcZj4rfl0pKycsICdnJyksXG5cbiAgLy8gZm9yIGluIGV4Y2VzcyB3aGl0ZXNwYWNlIHJlbW92YWxcbiAgcmVXaGl0ZVNwYWNlID0gL1tcXHgyMFxcdFxcblxcclxcZl0rL2csXG5cbiAgcmVPcHRpbWl6ZVNlbGVjdG9yID0gbmV3IGdsb2JhbC5SZWdFeHAoaWRlbnRpZmllciArICd8XiQnKSxcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIEZFQVRVUkUgVEVTVElORyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBkZXRlY3QgbmF0aXZlIG1ldGhvZHNcbiAgaXNOYXRpdmUgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlID0gLyBcXHcrXFwoLyxcbiAgICBpc25hdGl2ZSA9IFN0cmluZyhPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nKS5yZXBsYWNlKHJlLCAnICgnKTtcbiAgICByZXR1cm4gZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgICByZXR1cm4gbWV0aG9kICYmIHR5cGVvZiBtZXRob2QgIT0gJ3N0cmluZycgJiZcbiAgICAgICAgaXNuYXRpdmUgPT0gU3RyaW5nKG1ldGhvZCkucmVwbGFjZShyZSwgJyAoJyk7XG4gICAgfTtcbiAgfSkoKSxcblxuICAvLyBOQVRJVkVfWFhYWFggdHJ1ZSBpZiBtZXRob2QgZXhpc3QgYW5kIGlzIGNhbGxhYmxlXG4gIC8vIGRldGVjdCBpZiBET00gbWV0aG9kcyBhcmUgbmF0aXZlIGluIGJyb3dzZXJzXG4gIE5BVElWRV9GT0NVUyA9IGlzTmF0aXZlKGRvYy5oYXNGb2N1cyksXG4gIE5BVElWRV9RU0FQSSA9IGlzTmF0aXZlKGRvYy5xdWVyeVNlbGVjdG9yKSxcbiAgTkFUSVZFX0dFQklEID0gaXNOYXRpdmUoZG9jLmdldEVsZW1lbnRCeUlkKSxcbiAgTkFUSVZFX0dFQlROID0gaXNOYXRpdmUocm9vdC5nZXRFbGVtZW50c0J5VGFnTmFtZSksXG4gIE5BVElWRV9HRUJDTiA9IGlzTmF0aXZlKHJvb3QuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSksXG5cbiAgLy8gZGV0ZWN0IG5hdGl2ZSBnZXRBdHRyaWJ1dGUvaGFzQXR0cmlidXRlIG1ldGhvZHMsXG4gIC8vIGZyYW1ld29ya3MgZXh0ZW5kIHRoZXNlIHRvIGVsZW1lbnRzLCBidXQgaXQgc2VlbXNcbiAgLy8gdGhpcyBkb2VzIG5vdCB3b3JrIGZvciBYTUwgbmFtZXNwYWNlZCBhdHRyaWJ1dGVzLFxuICAvLyB1c2VkIHRvIGNoZWNrIGJvdGggZ2V0QXR0cmlidXRlL2hhc0F0dHJpYnV0ZSBpbiBJRVxuICBOQVRJVkVfR0VUX0FUVFJJQlVURSA9IGlzTmF0aXZlKHJvb3QuZ2V0QXR0cmlidXRlKSxcbiAgTkFUSVZFX0hBU19BVFRSSUJVVEUgPSBpc05hdGl2ZShyb290Lmhhc0F0dHJpYnV0ZSksXG5cbiAgLy8gY2hlY2sgaWYgc2xpY2UoKSBjYW4gY29udmVydCBub2RlbGlzdCB0byBhcnJheVxuICAvLyBzZWUgaHR0cDovL3l1cmEudGhpbmt3ZWIyLmNvbS9jZnQvXG4gIE5BVElWRV9TTElDRV9QUk9UTyA9XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlzQnVnZ3kgPSBmYWxzZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlzQnVnZ3kgPSAhIXNsaWNlLmNhbGwoZG9jLmNoaWxkTm9kZXMsIDApWzBdO1xuICAgICAgfSBjYXRjaChlKSB7IH1cbiAgICAgIHJldHVybiBpc0J1Z2d5O1xuICAgIH0pKCksXG5cbiAgLy8gc3VwcG9ydHMgdGhlIG5ldyB0cmF2ZXJzYWwgQVBJXG4gIE5BVElWRV9UUkFWRVJTQUxfQVBJID1cbiAgICAnbmV4dEVsZW1lbnRTaWJsaW5nJyBpbiByb290ICYmICdwcmV2aW91c0VsZW1lbnRTaWJsaW5nJyBpbiByb290LFxuXG4gIC8vIEJVR0dZX1hYWFhYIHRydWUgaWYgbWV0aG9kIGlzIGZlYXR1cmUgdGVzdGVkIGFuZCBoYXMga25vd24gYnVnc1xuICAvLyBkZXRlY3QgYnVnZ3kgZ0VCSURcbiAgQlVHR1lfR0VCSUQgPSBOQVRJVkVfR0VCSUQgP1xuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpc0J1Z2d5ID0gdHJ1ZSwgeCA9ICd4JyArIGdsb2JhbC5TdHJpbmcoK25ldyBnbG9iYWwuRGF0ZSksXG4gICAgICAgIGEgPSBkb2MuY3JlYXRlRWxlbWVudE5TID8gJ2EnIDogJzxhIG5hbWU9XCInICsgeCArICdcIj4nO1xuICAgICAgKGEgPSBkb2MuY3JlYXRlRWxlbWVudChhKSkubmFtZSA9IHg7XG4gICAgICByb290Lmluc2VydEJlZm9yZShhLCByb290LmZpcnN0Q2hpbGQpO1xuICAgICAgaXNCdWdneSA9ICEhZG9jLmdldEVsZW1lbnRCeUlkKHgpO1xuICAgICAgcm9vdC5yZW1vdmVDaGlsZChhKTtcbiAgICAgIHJldHVybiBpc0J1Z2d5O1xuICAgIH0pKCkgOlxuICAgIHRydWUsXG5cbiAgLy8gZGV0ZWN0IElFIGdFQlROIGNvbW1lbnQgbm9kZXMgYnVnXG4gIEJVR0dZX0dFQlROID0gTkFUSVZFX0dFQlROID9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGl2ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgZGl2LmFwcGVuZENoaWxkKGRvYy5jcmVhdGVDb21tZW50KCcnKSk7XG4gICAgICByZXR1cm4gISFkaXYuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJyonKVswXTtcbiAgICB9KSgpIDpcbiAgICB0cnVlLFxuXG4gIC8vIGRldGVjdCBPcGVyYSBnRUJDTiBzZWNvbmQgY2xhc3MgYW5kL29yIFVURjggYnVncyBhcyB3ZWxsIGFzIFNhZmFyaSAzLjJcbiAgLy8gY2FjaGluZyBjbGFzcyBuYW1lIHJlc3VsdHMgYW5kIG5vdCBkZXRlY3Rpbmcgd2hlbiBjaGFuZ2VkLFxuICAvLyB0ZXN0cyBhcmUgYmFzZWQgb24gdGhlIGpRdWVyeSBzZWxlY3RvciB0ZXN0IHN1aXRlXG4gIEJVR0dZX0dFQkNOID0gTkFUSVZFX0dFQkNOID9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaXNCdWdneSwgZGl2ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpLCB0ZXN0ID0gJ1xcdTUzZjBcXHU1MzE3JztcblxuICAgICAgLy8gT3BlcmEgdGVzdHNcbiAgICAgIGRpdi5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpKS5cbiAgICAgICAgc2V0QXR0cmlidXRlKCdjbGFzcycsIHRlc3QgKyAnYWJjICcgKyB0ZXN0KTtcbiAgICAgIGRpdi5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpKS5cbiAgICAgICAgc2V0QXR0cmlidXRlKCdjbGFzcycsICd4Jyk7XG5cbiAgICAgIGlzQnVnZ3kgPSAhZGl2LmdldEVsZW1lbnRzQnlDbGFzc05hbWUodGVzdClbMF07XG5cbiAgICAgIC8vIFNhZmFyaSB0ZXN0XG4gICAgICBkaXYubGFzdENoaWxkLmNsYXNzTmFtZSA9IHRlc3Q7XG4gICAgICByZXR1cm4gaXNCdWdneSB8fCBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSh0ZXN0KS5sZW5ndGggIT0gMjtcbiAgICB9KSgpIDpcbiAgICB0cnVlLFxuXG4gIC8vIGRldGVjdCBJRSBidWcgd2l0aCBkeW5hbWljIGF0dHJpYnV0ZXNcbiAgQlVHR1lfR0VUX0FUVFJJQlVURSA9IE5BVElWRV9HRVRfQVRUUklCVVRFID9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaW5wdXQgPSBkb2MuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgIGlucHV0LnNldEF0dHJpYnV0ZSgndmFsdWUnLCA1KTtcbiAgICAgIHJldHVybiBpbnB1dC5kZWZhdWx0VmFsdWUgIT0gNTtcbiAgICB9KSgpIDpcbiAgICB0cnVlLFxuXG4gIC8vIGRldGVjdCBJRSBidWcgd2l0aCBub24tc3RhbmRhcmQgYm9vbGVhbiBhdHRyaWJ1dGVzXG4gIEJVR0dZX0hBU19BVFRSSUJVVEUgPSBOQVRJVkVfSEFTX0FUVFJJQlVURSA/XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9wdGlvbiA9IGRvYy5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgIG9wdGlvbi5zZXRBdHRyaWJ1dGUoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XG4gICAgICByZXR1cm4gIW9wdGlvbi5oYXNBdHRyaWJ1dGUoJ3NlbGVjdGVkJyk7XG4gICAgfSkoKSA6XG4gICAgdHJ1ZSxcblxuICAvLyBkZXRlY3QgU2FmYXJpIGJ1ZyB3aXRoIHNlbGVjdGVkIG9wdGlvbiBlbGVtZW50c1xuICBCVUdHWV9TRUxFQ1RFRCA9XG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGVjdCA9IGRvYy5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgIHNlbGVjdC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnb3B0aW9uJykpO1xuICAgICAgcmV0dXJuICFzZWxlY3QuZmlyc3RDaGlsZC5zZWxlY3RlZDtcbiAgICB9KSgpLFxuXG4gIC8vIGluaXRpYWxpemVkIHdpdGggdGhlIGxvYWRpbmcgY29udGV4dFxuICAvLyBhbmQgcmVzZXQgZm9yIGVhY2ggZGlmZmVyZW50IGNvbnRleHRcbiAgQlVHR1lfUVVJUktTX0dFQkNOLFxuICBCVUdHWV9RVUlSS1NfUVNBUEksXG5cbiAgUVVJUktTX01PREUsXG4gIFhNTF9ET0NVTUVOVCxcblxuICAvLyBkZXRlY3QgT3BlcmEgYnJvd3NlclxuICBPUEVSQSA9IC9vcGVyYS9pLnRlc3Qoc3RyaW5nLmNhbGwoZ2xvYmFsLm9wZXJhKSksXG5cbiAgLy8gc2tpcCBzaW1wbGUgc2VsZWN0b3Igb3B0aW1pemF0aW9ucyBmb3IgT3BlcmEgPj0gMTFcbiAgT1BFUkFfUVNBUEkgPSBPUEVSQSAmJiBnbG9iYWwucGFyc2VGbG9hdChnbG9iYWwub3BlcmEudmVyc2lvbigpKSA+PSAxMSxcblxuICAvLyBjaGVjayBTZWxlY3RvciBBUEkgaW1wbGVtZW50YXRpb25zXG4gIFJFX0JVR0dZX1FTQVBJID0gTkFUSVZFX1FTQVBJID9cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGF0dGVybiA9IG5ldyBnbG9iYWwuQXJyYXkoKSwgY29udGV4dCwgZWxlbWVudCxcblxuICAgICAgZXhwZWN0ID0gZnVuY3Rpb24oc2VsZWN0b3IsIGVsZW1lbnQsIG4pIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgICBjb250ZXh0LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuICAgICAgICB0cnkgeyByZXN1bHQgPSBjb250ZXh0LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpLmxlbmd0aCA9PSBuOyB9IGNhdGNoKGUpIHsgfVxuICAgICAgICB3aGlsZSAoY29udGV4dC5maXJzdENoaWxkKSB7IGNvbnRleHQucmVtb3ZlQ2hpbGQoY29udGV4dC5maXJzdENoaWxkKTsgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgLy8gY2VydGFpbiBidWdzIGNhbiBvbmx5IGJlIGRldGVjdGVkIGluIHN0YW5kYXJkIGRvY3VtZW50c1xuICAgICAgLy8gdG8gYXZvaWQgd3JpdGluZyBhIGxpdmUgbG9hZGluZyBkb2N1bWVudCBjcmVhdGUgYSBmYWtlIG9uZVxuICAgICAgaWYgKGRvYy5pbXBsZW1lbnRhdGlvbiAmJiBkb2MuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQpIHtcbiAgICAgICAgLy8gdXNlIGEgc2hhZG93IGRvY3VtZW50IGJvZHkgYXMgY29udGV4dFxuICAgICAgICBjb250ZXh0ID0gZG9jLmltcGxlbWVudGF0aW9uLmNyZWF0ZURvY3VtZW50KCcnLCAnJywgbnVsbCkuXG4gICAgICAgICAgYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2h0bWwnKSkuXG4gICAgICAgICAgYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2hlYWQnKSkucGFyZW50Tm9kZS5cbiAgICAgICAgICBhcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYm9keScpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVzZSBhbiB1bmF0dGFjaGVkIGRpdiBub2RlIGFzIGNvbnRleHRcbiAgICAgICAgY29udGV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIH1cblxuICAgICAgLy8gZml4IGZvciBTYWZhcmkgOC54IGFuZCBvdGhlciBlbmdpbmVzIHRoYXRcbiAgICAgIC8vIGZhaWwgcXVlcnlpbmcgZmlsdGVyZWQgc2libGluZyBjb21iaW5hdG9yc1xuICAgICAgZWxlbWVudCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGVsZW1lbnQuaW5uZXJIVE1MID0gJzxwIGlkPVwiYVwiPjwvcD48YnI+JztcbiAgICAgIGV4cGVjdCgncCNhKyonLCBlbGVtZW50LCAwKSAmJlxuICAgICAgICBwYXR0ZXJuLnB1c2goJ1xcXFx3KyNcXFxcdysuKlsrfl0nKTtcblxuICAgICAgLy8gXj0gJD0gKj0gb3BlcmF0b3JzIGJ1Z3Mgd2l0aCBlbXB0eSB2YWx1ZXMgKE9wZXJhIDEwIC8gSUU4KVxuICAgICAgZWxlbWVudCA9IGRvYy5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnJyk7XG4gICAgICBleHBlY3QoJ1tjbGFzc149XCJcIl0nLCBlbGVtZW50LCAxKSAmJlxuICAgICAgICBwYXR0ZXJuLnB1c2goJ1sqXiRdPVtcXFxceDIwXFxcXHRcXFxcblxcXFxyXFxcXGZdKig/OlwiXCJ8JyArIFwiJycpXCIpO1xuXG4gICAgICAvLyA6Y2hlY2tlZCBidWcgd2l0aCBvcHRpb24gZWxlbWVudHMgKEZpcmVmb3ggMy42LngpXG4gICAgICAvLyBpdCB3cm9uZ2x5IGluY2x1ZGVzICdzZWxlY3RlZCcgb3B0aW9ucyBlbGVtZW50c1xuICAgICAgLy8gSFRNTDUgcnVsZXMgc2F5cyBzZWxlY3RlZCBvcHRpb25zIGFsc28gbWF0Y2hcbiAgICAgIGVsZW1lbnQgPSBkb2MuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcbiAgICAgIGV4cGVjdCgnOmNoZWNrZWQnLCBlbGVtZW50LCAwKSAmJlxuICAgICAgICBwYXR0ZXJuLnB1c2goJzpjaGVja2VkJyk7XG5cbiAgICAgIC8vIDplbmFibGVkIDpkaXNhYmxlZCBidWdzIHdpdGggaGlkZGVuIGZpZWxkcyAoRmlyZWZveCAzLjUpXG4gICAgICAvLyBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9saW5rcy5odG1sI3NlbGVjdG9yLWVuYWJsZWRcbiAgICAgIC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtc2VsZWN0b3JzLyNlbmFibGVkZGlzYWJsZWRcbiAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgYnkgSUU4IFF1ZXJ5IFNlbGVjdG9yXG4gICAgICBlbGVtZW50ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgndHlwZScsICdoaWRkZW4nKTtcbiAgICAgIGV4cGVjdCgnOmVuYWJsZWQnLCBlbGVtZW50LCAwKSAmJlxuICAgICAgICBwYXR0ZXJuLnB1c2goJzplbmFibGVkJywgJzpkaXNhYmxlZCcpO1xuXG4gICAgICAvLyA6bGluayBidWdzIHdpdGggaHlwZXJsaW5rcyBtYXRjaGluZyAoRmlyZWZveC9TYWZhcmkpXG4gICAgICBlbGVtZW50ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdocmVmJywgJ3gnKTtcbiAgICAgIGV4cGVjdCgnOmxpbmsnLCBlbGVtZW50LCAxKSB8fFxuICAgICAgICBwYXR0ZXJuLnB1c2goJzpsaW5rJyk7XG5cbiAgICAgIC8vIGF2b2lkIGF0dHJpYnV0ZSBzZWxlY3RvcnMgZm9yIElFIFFTQVxuICAgICAgaWYgKEJVR0dZX0hBU19BVFRSSUJVVEUpIHtcbiAgICAgICAgLy8gSUUgZmFpbHMgaW4gcmVhZGluZzpcbiAgICAgICAgLy8gLSBvcmlnaW5hbCB2YWx1ZXMgZm9yIGlucHV0L3RleHRhcmVhXG4gICAgICAgIC8vIC0gb3JpZ2luYWwgYm9vbGVhbiB2YWx1ZXMgZm9yIGNvbnRyb2xzXG4gICAgICAgIHBhdHRlcm4ucHVzaCgnXFxcXFtbXFxcXHgyMFxcXFx0XFxcXG5cXFxcclxcXFxmXSooPzpjaGVja2VkfGRpc2FibGVkfGlzbWFwfG11bHRpcGxlfHJlYWRvbmx5fHNlbGVjdGVkfHZhbHVlKScpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGF0dGVybi5sZW5ndGggP1xuICAgICAgICBuZXcgZ2xvYmFsLlJlZ0V4cChwYXR0ZXJuLmpvaW4oJ3wnKSkgOlxuICAgICAgICB7ICd0ZXN0JzogZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZTsgfSB9O1xuXG4gICAgfSkoKSA6XG4gICAgdHJ1ZSxcblxuICAvLyBtYXRjaGVzIGNsYXNzIHNlbGVjdG9yc1xuICBSRV9DTEFTUyA9IG5ldyBnbG9iYWwuUmVnRXhwKCcoPzpcXFxcW1tcXFxceDIwXFxcXHRcXFxcblxcXFxyXFxcXGZdKmNsYXNzXFxcXGJ8XFxcXC4nICsgaWRlbnRpZmllciArICcpJyksXG5cbiAgLy8gbWF0Y2hlcyBzaW1wbGUgaWQsIHRhZyAmIGNsYXNzIHNlbGVjdG9yc1xuICBSRV9TSU1QTEVfU0VMRUNUT1IgPSBuZXcgZ2xvYmFsLlJlZ0V4cChcbiAgICBCVUdHWV9HRUJUTiAmJiBCVUdHWV9HRUJDTiB8fCBPUEVSQSA/XG4gICAgICAnXiM/LT9bX2EtekEtWl17MX0nICsgZW5jb2RpbmcgKyAnKiQnIDogQlVHR1lfR0VCVE4gP1xuICAgICAgJ15bLiNdPy0/W19hLXpBLVpdezF9JyArIGVuY29kaW5nICsgJyokJyA6IEJVR0dZX0dFQkNOID9cbiAgICAgICdeKD86XFxcXCp8Iy0/W19hLXpBLVpdezF9JyArIGVuY29kaW5nICsgJyopJCcgOlxuICAgICAgJ14oPzpcXFxcKnxbLiNdPy0/W19hLXpBLVpdezF9JyArIGVuY29kaW5nICsgJyopJCcpLFxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gTE9PS1VQIE9CSkVDVFMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIExJTktfTk9ERVMgPSBuZXcgZ2xvYmFsLk9iamVjdCh7ICdhJzogMSwgJ0EnOiAxLCAnYXJlYSc6IDEsICdBUkVBJzogMSwgJ2xpbmsnOiAxLCAnTElOSyc6IDEgfSksXG5cbiAgLy8gYm9vbGVhbiBhdHRyaWJ1dGVzIHNob3VsZCByZXR1cm4gYXR0cmlidXRlIG5hbWUgaW5zdGVhZCBvZiB0cnVlL2ZhbHNlXG4gIEFUVFJfQk9PTEVBTiA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICAnY2hlY2tlZCc6IDEsICdkaXNhYmxlZCc6IDEsICdpc21hcCc6IDEsXG4gICAgJ211bHRpcGxlJzogMSwgJ3JlYWRvbmx5JzogMSwgJ3NlbGVjdGVkJzogMVxuICB9KSxcblxuICAvLyBkeW5hbWljIGF0dHJpYnV0ZXMgdGhhdCBuZWVkcyB0byBiZSBjaGVja2VkIGFnYWluc3Qgb3JpZ2luYWwgSFRNTCB2YWx1ZVxuICBBVFRSX0RFRkFVTFQgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgJ3ZhbHVlJzogJ2RlZmF1bHRWYWx1ZScsXG4gICAgJ2NoZWNrZWQnOiAnZGVmYXVsdENoZWNrZWQnLFxuICAgICdzZWxlY3RlZCc6ICdkZWZhdWx0U2VsZWN0ZWQnXG4gIH0pLFxuXG4gIC8vIGF0dHJpYnV0ZXMgcmVmZXJlbmNpbmcgVVJJIGRhdGEgdmFsdWVzIG5lZWQgc3BlY2lhbCB0cmVhdG1lbnQgaW4gSUVcbiAgQVRUUl9VUklEQVRBID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgICdhY3Rpb24nOiAyLCAnY2l0ZSc6IDIsICdjb2RlYmFzZSc6IDIsICdkYXRhJzogMiwgJ2hyZWYnOiAyLFxuICAgICdsb25nZGVzYyc6IDIsICdsb3dzcmMnOiAyLCAnc3JjJzogMiwgJ3VzZW1hcCc6IDJcbiAgfSksXG5cbiAgLy8gSFRNTCA1IGRyYWZ0IHNwZWNpZmljYXRpb25zXG4gIC8vIGh0dHA6Ly93d3cud2hhdHdnLm9yZy9zcGVjcy93ZWItYXBwcy9jdXJyZW50LXdvcmsvI3NlbGVjdG9yc1xuICBIVE1MX1RBQkxFID0gbmV3IGdsb2JhbC5PYmplY3Qoe1xuICAgIC8vIGNsYXNzIGF0dHJpYnV0ZSBtdXN0IGJlIHRyZWF0ZWQgY2FzZS1pbnNlbnNpdGl2ZSBpbiBIVE1MIHF1aXJrcyBtb2RlXG4gICAgLy8gaW5pdGlhbGl6ZWQgYnkgZGVmYXVsdCB0byBTdGFuZGFyZCBNb2RlIChjYXNlLXNlbnNpdGl2ZSksXG4gICAgLy8gc2V0IGR5bmFtaWNhbGx5IGJ5IHRoZSBhdHRyaWJ1dGUgcmVzb2x2ZXJcbiAgICAnY2xhc3MnOiAwLFxuICAgICdhY2NlcHQnOiAxLCAnYWNjZXB0LWNoYXJzZXQnOiAxLCAnYWxpZ24nOiAxLCAnYWxpbmsnOiAxLCAnYXhpcyc6IDEsXG4gICAgJ2JnY29sb3InOiAxLCAnY2hhcnNldCc6IDEsICdjaGVja2VkJzogMSwgJ2NsZWFyJzogMSwgJ2NvZGV0eXBlJzogMSwgJ2NvbG9yJzogMSxcbiAgICAnY29tcGFjdCc6IDEsICdkZWNsYXJlJzogMSwgJ2RlZmVyJzogMSwgJ2Rpcic6IDEsICdkaXJlY3Rpb24nOiAxLCAnZGlzYWJsZWQnOiAxLFxuICAgICdlbmN0eXBlJzogMSwgJ2ZhY2UnOiAxLCAnZnJhbWUnOiAxLCAnaHJlZmxhbmcnOiAxLCAnaHR0cC1lcXVpdic6IDEsICdsYW5nJzogMSxcbiAgICAnbGFuZ3VhZ2UnOiAxLCAnbGluayc6IDEsICdtZWRpYSc6IDEsICdtZXRob2QnOiAxLCAnbXVsdGlwbGUnOiAxLCAnbm9ocmVmJzogMSxcbiAgICAnbm9yZXNpemUnOiAxLCAnbm9zaGFkZSc6IDEsICdub3dyYXAnOiAxLCAncmVhZG9ubHknOiAxLCAncmVsJzogMSwgJ3Jldic6IDEsXG4gICAgJ3J1bGVzJzogMSwgJ3Njb3BlJzogMSwgJ3Njcm9sbGluZyc6IDEsICdzZWxlY3RlZCc6IDEsICdzaGFwZSc6IDEsICd0YXJnZXQnOiAxLFxuICAgICd0ZXh0JzogMSwgJ3R5cGUnOiAxLCAndmFsaWduJzogMSwgJ3ZhbHVldHlwZSc6IDEsICd2bGluayc6IDFcbiAgfSksXG5cbiAgLy8gdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzIG11c3QgYmUgdHJlYXRlZCBjYXNlLWluc2Vuc2l0aXZlIGluIFhIVE1MIG1vZGVcbiAgLy8gTmllbHMgTGVlbmhlZXIgaHR0cDovL3Jha2F6Lm5sL2l0ZW0vY3NzX3NlbGVjdG9yX2J1Z3NfY2FzZV9zZW5zaXRpdml0eVxuICBYSFRNTF9UQUJMRSA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICAnYWNjZXB0JzogMSwgJ2FjY2VwdC1jaGFyc2V0JzogMSwgJ2FsaW5rJzogMSwgJ2F4aXMnOiAxLFxuICAgICdiZ2NvbG9yJzogMSwgJ2NoYXJzZXQnOiAxLCAnY29kZXR5cGUnOiAxLCAnY29sb3InOiAxLFxuICAgICdlbmN0eXBlJzogMSwgJ2ZhY2UnOiAxLCAnaHJlZmxhbmcnOiAxLCAnaHR0cC1lcXVpdic6IDEsXG4gICAgJ2xhbmcnOiAxLCAnbGFuZ3VhZ2UnOiAxLCAnbGluayc6IDEsICdtZWRpYSc6IDEsICdyZWwnOiAxLFxuICAgICdyZXYnOiAxLCAndGFyZ2V0JzogMSwgJ3RleHQnOiAxLCAndHlwZSc6IDEsICd2bGluayc6IDFcbiAgfSksXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBSRUdVTEFSIEVYUFJFU1NJT05TIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gcGxhY2Vob2xkZXIgdG8gYWRkIGZ1bmN0aW9uYWxpdGllc1xuICBTZWxlY3RvcnMgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgLy8gYXMgYSBzaW1wbGUgZXhhbXBsZSB0aGlzIHdpbGwgY2hlY2tcbiAgICAvLyBmb3IgY2hhcnMgbm90IGluIHN0YW5kYXJkIGFzY2lpIHRhYmxlXG4gICAgLy9cbiAgICAvLyAnbXlTcGVjaWFsU2VsZWN0b3InOiB7XG4gICAgLy8gICdFeHByZXNzaW9uJzogL1xcdTAwODAtXFx1ZmZmZi8sXG4gICAgLy8gICdDYWxsYmFjayc6IG15U2VsZWN0b3JDYWxsYmFja1xuICAgIC8vIH1cbiAgICAvL1xuICAgIC8vICdteVNlbGVjdG9yQ2FsbGJhY2snIHdpbGwgYmUgaW52b2tlZFxuICAgIC8vIG9ubHkgYWZ0ZXIgcGFzc2luZyBhbGwgb3RoZXIgc3RhbmRhcmRcbiAgICAvLyBjaGVja3MgYW5kIG9ubHkgaWYgbm9uZSBvZiB0aGVtIHdvcmtlZFxuICB9KSxcblxuICAvLyBhdHRyaWJ1dGUgb3BlcmF0b3JzXG4gIE9wZXJhdG9ycyA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICAgJz0nOiBcIm49PSclbSdcIixcbiAgICAnXj0nOiBcIm4uaW5kZXhPZignJW0nKT09MFwiLFxuICAgICcqPSc6IFwibi5pbmRleE9mKCclbScpPi0xXCIsXG4gICAgJ3w9JzogXCIobisnLScpLmluZGV4T2YoJyVtLScpPT0wXCIsXG4gICAgJ349JzogXCIoJyAnK24rJyAnKS5pbmRleE9mKCcgJW0gJyk+LTFcIixcbiAgICAnJD0nOiBcIm4uc3Vic3RyKG4ubGVuZ3RoLSclbScubGVuZ3RoKT09JyVtJ1wiXG4gIH0pLFxuXG4gIC8vIG9wdGltaXphdGlvbiBleHByZXNzaW9uc1xuICBPcHRpbWl6ZSA9IG5ldyBnbG9iYWwuT2JqZWN0KHtcbiAgICBJRDogbmV3IGdsb2JhbC5SZWdFeHAoJ15cXFxcKj8jKCcgKyBlbmNvZGluZyArICcrKXwnICsgc2tpcGdyb3VwKSxcbiAgICBUQUc6IG5ldyBnbG9iYWwuUmVnRXhwKCdeKCcgKyBlbmNvZGluZyArICcrKXwnICsgc2tpcGdyb3VwKSxcbiAgICBDTEFTUzogbmV3IGdsb2JhbC5SZWdFeHAoJ15cXFxcKj9cXFxcLignICsgZW5jb2RpbmcgKyAnKyQpfCcgKyBza2lwZ3JvdXApXG4gIH0pLFxuXG4gIC8vIHByZWNvbXBpbGVkIFJlZ3VsYXIgRXhwcmVzc2lvbnNcbiAgUGF0dGVybnMgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgLy8gc3RydWN0dXJhbCBwc2V1ZG8tY2xhc3NlcyBhbmQgY2hpbGQgc2VsZWN0b3JzXG4gICAgc3BzZXVkb3M6IC9eXFw6KHJvb3R8ZW1wdHl8KD86Zmlyc3R8bGFzdHxvbmx5KSg/Oi1jaGlsZHwtb2YtdHlwZSl8bnRoKD86LWxhc3QpPyg/Oi1jaGlsZHwtb2YtdHlwZSlcXChcXHMqKGV2ZW58b2RkfCg/OlstK117MCwxfVxcZCpuXFxzKik/Wy0rXXswLDF9XFxzKlxcZCopXFxzKlxcKSk/KC4qKS9pLFxuICAgIC8vIHVpc3RhdGVzICsgZHluYW1pYyArIG5lZ2F0aW9uIHBzZXVkby1jbGFzc2VzXG4gICAgZHBzZXVkb3M6IC9eXFw6KGxpbmt8dmlzaXRlZHx0YXJnZXR8YWN0aXZlfGZvY3VzfGhvdmVyfGNoZWNrZWR8ZGlzYWJsZWR8ZW5hYmxlZHxzZWxlY3RlZHxsYW5nXFwoKFstXFx3XXsyLH0pXFwpfG5vdFxcKChbXigpXSp8LiopXFwpKT8oLiopL2ksXG4gICAgLy8gZWxlbWVudCBhdHRyaWJ1dGUgbWF0Y2hlclxuICAgIGF0dHJpYnV0ZTogbmV3IGdsb2JhbC5SZWdFeHAoJ15cXFxcWycgKyBhdHRybWF0Y2hlciArICdcXFxcXSguKiknKSxcbiAgICAvLyBFID4gRlxuICAgIGNoaWxkcmVuOiAvXltcXHgyMFxcdFxcblxcclxcZl0qXFw+W1xceDIwXFx0XFxuXFxyXFxmXSooLiopLyxcbiAgICAvLyBFICsgRlxuICAgIGFkamFjZW50OiAvXltcXHgyMFxcdFxcblxcclxcZl0qXFwrW1xceDIwXFx0XFxuXFxyXFxmXSooLiopLyxcbiAgICAvLyBFIH4gRlxuICAgIHJlbGF0aXZlOiAvXltcXHgyMFxcdFxcblxcclxcZl0qXFx+W1xceDIwXFx0XFxuXFxyXFxmXSooLiopLyxcbiAgICAvLyBFIEZcbiAgICBhbmNlc3RvcjogL15bXFx4MjBcXHRcXG5cXHJcXGZdKyguKikvLFxuICAgIC8vIGFsbFxuICAgIHVuaXZlcnNhbDogL15cXCooLiopLyxcbiAgICAvLyBpZFxuICAgIGlkOiBuZXcgZ2xvYmFsLlJlZ0V4cCgnXiMoJyArIGVuY29kaW5nICsgJyspKC4qKScpLFxuICAgIC8vIHRhZ1xuICAgIHRhZ05hbWU6IG5ldyBnbG9iYWwuUmVnRXhwKCdeKCcgKyBlbmNvZGluZyArICcrKSguKiknKSxcbiAgICAvLyBjbGFzc1xuICAgIGNsYXNzTmFtZTogbmV3IGdsb2JhbC5SZWdFeHAoJ15cXFxcLignICsgZW5jb2RpbmcgKyAnKykoLiopJylcbiAgfSksXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gVVRJTCBNRVRIT0RTIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gY29uY2F0IGVsZW1lbnRzIHRvIGRhdGFcbiAgY29uY2F0TGlzdCA9XG4gICAgZnVuY3Rpb24oZGF0YSwgZWxlbWVudHMpIHtcbiAgICAgIHZhciBpID0gLTEsIGVsZW1lbnQ7XG4gICAgICBpZiAoIWRhdGEubGVuZ3RoICYmIGdsb2JhbC5BcnJheS5zbGljZSlcbiAgICAgICAgcmV0dXJuIGdsb2JhbC5BcnJheS5zbGljZShlbGVtZW50cyk7XG4gICAgICB3aGlsZSAoKGVsZW1lbnQgPSBlbGVtZW50c1srK2ldKSlcbiAgICAgICAgZGF0YVtkYXRhLmxlbmd0aF0gPSBlbGVtZW50O1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAvLyBjb25jYXQgZWxlbWVudHMgdG8gZGF0YSBhbmQgY2FsbGJhY2tcbiAgY29uY2F0Q2FsbCA9XG4gICAgZnVuY3Rpb24oZGF0YSwgZWxlbWVudHMsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgaSA9IC0xLCBlbGVtZW50O1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudHNbKytpXSkpIHtcbiAgICAgICAgaWYgKGZhbHNlID09PSBjYWxsYmFjayhkYXRhW2RhdGEubGVuZ3RoXSA9IGVsZW1lbnQpKSB7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuXG4gIC8vIGNoYW5nZSBjb250ZXh0IHNwZWNpZmljIHZhcmlhYmxlc1xuICBzd2l0Y2hDb250ZXh0ID1cbiAgICBmdW5jdGlvbihmcm9tLCBmb3JjZSkge1xuICAgICAgdmFyIGRpdiwgb2xkRG9jID0gZG9jO1xuICAgICAgLy8gc2F2ZSBwYXNzZWQgY29udGV4dFxuICAgICAgbGFzdENvbnRleHQgPSBmcm9tO1xuICAgICAgLy8gc2V0IG5ldyBjb250ZXh0IGRvY3VtZW50XG4gICAgICBkb2MgPSBmcm9tLm93bmVyRG9jdW1lbnQgfHwgZnJvbTtcbiAgICAgIGlmIChmb3JjZSB8fCBvbGREb2MgIT09IGRvYykge1xuICAgICAgICAvLyBzZXQgZG9jdW1lbnQgcm9vdFxuICAgICAgICByb290ID0gZG9jLmRvY3VtZW50RWxlbWVudDtcbiAgICAgICAgLy8gc2V0IGhvc3QgZW52aXJvbm1lbnQgZmxhZ3NcbiAgICAgICAgWE1MX0RPQ1VNRU5UID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ0RpVicpLm5vZGVOYW1lID09ICdEaVYnO1xuXG4gICAgICAgIC8vIEluIHF1aXJrcyBtb2RlIGNzcyBjbGFzcyBuYW1lcyBhcmUgY2FzZSBpbnNlbnNpdGl2ZS5cbiAgICAgICAgLy8gSW4gc3RhbmRhcmRzIG1vZGUgdGhleSBhcmUgY2FzZSBzZW5zaXRpdmUuIFNlZSBkb2NzOlxuICAgICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9Nb3ppbGxhX1F1aXJrc19Nb2RlX0JlaGF2aW9yXG4gICAgICAgIC8vIGh0dHA6Ly93d3cud2hhdHdnLm9yZy9zcGVjcy93ZWItYXBwcy9jdXJyZW50LXdvcmsvI3NlbGVjdG9yc1xuICAgICAgICBRVUlSS1NfTU9ERSA9ICFYTUxfRE9DVU1FTlQgJiZcbiAgICAgICAgICB0eXBlb2YgZG9jLmNvbXBhdE1vZGUgPT0gJ3N0cmluZycgP1xuICAgICAgICAgIGRvYy5jb21wYXRNb2RlLmluZGV4T2YoJ0NTUycpIDwgMCA6XG4gICAgICAgICAgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIHN0eWxlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpLnN0eWxlO1xuICAgICAgICAgICAgcmV0dXJuIHN0eWxlICYmIChzdHlsZS53aWR0aCA9IDEpICYmIHN0eWxlLndpZHRoID09ICcxcHgnO1xuICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgZGl2ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ3AnKSkuc2V0QXR0cmlidXRlKCdjbGFzcycsICd4WHgnKTtcbiAgICAgICAgZGl2LmFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdwJykpLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAneHh4Jyk7XG5cbiAgICAgICAgLy8gR0VCQ04gYnVnZ3kgaW4gcXVpcmtzIG1vZGUsIG1hdGNoIGNvdW50IGlzOlxuICAgICAgICAvLyBGaXJlZm94IDMuMCsgW3h4eCA9IDEsIHhYeCA9IDFdXG4gICAgICAgIC8vIE9wZXJhIDEwLjYzKyBbeHh4ID0gMCwgeFh4ID0gMl1cbiAgICAgICAgQlVHR1lfUVVJUktTX0dFQkNOID1cbiAgICAgICAgICAhWE1MX0RPQ1VNRU5UICYmIE5BVElWRV9HRUJDTiAmJiBRVUlSS1NfTU9ERSAmJlxuICAgICAgICAgIChkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgneHh4JykubGVuZ3RoICE9IDIgfHxcbiAgICAgICAgICBkaXYuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgneFh4JykubGVuZ3RoICE9IDIpO1xuXG4gICAgICAgIC8vIFFTQVBJIGJ1Z2d5IGluIHF1aXJrcyBtb2RlLCBtYXRjaCBjb3VudCBpczpcbiAgICAgICAgLy8gQXQgbGVhc3QgQ2hyb21lIDQrLCBGaXJlZm94IDMuNSssIE9wZXJhIDEwLngrLCBTYWZhcmkgNCsgW3h4eCA9IDEsIHhYeCA9IDJdXG4gICAgICAgIC8vIFNhZmFyaSAzLjIgUVNBIGRvZXNuJ3Qgd29yayB3aXRoIG1peGVkY2FzZSBpbiBxdWlya3Ntb2RlIFt4eHggPSAxLCB4WHggPSAwXVxuICAgICAgICAvLyBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTkwNDdcbiAgICAgICAgLy8gbXVzdCB0ZXN0IHRoZSBhdHRyaWJ1dGUgc2VsZWN0b3IgJ1tjbGFzc349eHh4XSdcbiAgICAgICAgLy8gYmVmb3JlICcueFh4JyBvciB0aGUgYnVnIG1heSBub3QgcHJlc2VudCBpdHNlbGZcbiAgICAgICAgQlVHR1lfUVVJUktTX1FTQVBJID1cbiAgICAgICAgICAhWE1MX0RPQ1VNRU5UICYmIE5BVElWRV9RU0FQSSAmJiBRVUlSS1NfTU9ERSAmJlxuICAgICAgICAgIChkaXYucXVlcnlTZWxlY3RvckFsbCgnW2NsYXNzfj14eHhdJykubGVuZ3RoICE9IDIgfHxcbiAgICAgICAgICBkaXYucXVlcnlTZWxlY3RvckFsbCgnLnhYeCcpLmxlbmd0aCAhPSAyKTtcblxuICAgICAgICBDb25maWcuQ0FDSElORyAmJiBEb20uc2V0Q2FjaGUodHJ1ZSwgZG9jKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gIC8vIGNvbnZlcnQgYSBDU1Mgc3RyaW5nIG9yIGlkZW50aWZpZXIgY29udGFpbmluZyBlc2NhcGUgc2VxdWVuY2UgdG8gYVxuICAvLyBqYXZhc2NyaXB0IHN0cmluZyB3aXRoIGphdmFzY3JpcHQgZXNjYXBlIHNlcXVlbmNlc1xuICBjb252ZXJ0RXNjYXBlcyA9XG4gICAgZnVuY3Rpb24oc3RyKSB7XG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xcXFwoWzAtOWEtZkEtRl17MSw2fVxceDIwP3wuKXwoW1xceDIyXFx4MjddKS9nLCBmdW5jdGlvbihzdWJzdHJpbmcsIHAxLCBwMikge1xuICAgICAgICB2YXIgY29kZVBvaW50LCBoaWdoSGV4LCBoaWdoU3Vycm9nYXRlLCBsb3dIZXgsIGxvd1N1cnJvZ2F0ZTtcblxuICAgICAgICBpZiAocDIpIHtcbiAgICAgICAgICAvLyB1bmVzY2FwZWQgXCIgb3IgJ1xuICAgICAgICAgIHJldHVybiAnXFxcXCcgKyBwMjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgvXlswLTlhLWZBLUZdLy50ZXN0KHAxKSkge1xuICAgICAgICAgIC8vIFxcMWYyM1xuICAgICAgICAgIGNvZGVQb2ludCA9IHBhcnNlSW50KHAxLCAxNik7XG5cbiAgICAgICAgICBpZiAoY29kZVBvaW50IDwgMCB8fCBjb2RlUG9pbnQgPiAweDEwZmZmZikge1xuICAgICAgICAgICAgLy8gdGhlIHJlcGxhY2VtZW50IGNoYXJhY3RlclxuICAgICAgICAgICAgcmV0dXJuICdcXFxcdWZmZmQnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGphdmFzY3JpcHQgc3RyaW5ncyBhcmUgaW4gVVRGLTE2XG4gICAgICAgICAgaWYgKGNvZGVQb2ludCA8PSAweGZmZmYpIHtcbiAgICAgICAgICAgIC8vIEJhc2ljXG4gICAgICAgICAgICBsb3dIZXggPSAnMDAwJyArIGNvZGVQb2ludC50b1N0cmluZygxNik7XG4gICAgICAgICAgICByZXR1cm4gJ1xcXFx1JyArIGxvd0hleC5zdWJzdHIobG93SGV4Lmxlbmd0aCAtIDQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFN1cHBsZW1lbnRhcnlcbiAgICAgICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMDtcbiAgICAgICAgICBoaWdoU3Vycm9nYXRlID0gKGNvZGVQb2ludCA+PiAxMCkgKyAweGQ4MDA7XG4gICAgICAgICAgbG93U3Vycm9nYXRlID0gKGNvZGVQb2ludCAlIDB4NDAwKSArIDB4ZGMwMDtcbiAgICAgICAgICBoaWdoSGV4ID0gJzAwMCcgKyBoaWdoU3Vycm9nYXRlLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICBsb3dIZXggPSAnMDAwJyArIGxvd1N1cnJvZ2F0ZS50b1N0cmluZygxNik7XG5cbiAgICAgICAgICByZXR1cm4gJ1xcXFx1JyArIGhpZ2hIZXguc3Vic3RyKGhpZ2hIZXgubGVuZ3RoIC0gNCkgK1xuICAgICAgICAgICAgJ1xcXFx1JyArIGxvd0hleC5zdWJzdHIobG93SGV4Lmxlbmd0aCAtIDQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKC9eW1xcXFxcXHgyMlxceDI3XS8udGVzdChwMSkpIHtcbiAgICAgICAgICAvLyBcXCcgXFxcIlxuICAgICAgICAgIHJldHVybiBzdWJzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBcXGcgXFxoIFxcLiBcXCMgZXRjXG4gICAgICAgIHJldHVybiBwMTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gRE9NIE1FVEhPRFMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZWxlbWVudCBieSBpZCAocmF3KVxuICAvLyBAcmV0dXJuIHJlZmVyZW5jZSBvciBudWxsXG4gIGJ5SWRSYXcgPVxuICAgIGZ1bmN0aW9uKGlkLCBlbGVtZW50cykge1xuICAgICAgdmFyIGkgPSAtMSwgZWxlbWVudCA9IG51bGw7XG4gICAgICB3aGlsZSAoKGVsZW1lbnQgPSBlbGVtZW50c1srK2ldKSkge1xuICAgICAgICBpZiAoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2lkJykgPT0gaWQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSxcblxuICAvLyBlbGVtZW50IGJ5IGlkXG4gIC8vIEByZXR1cm4gcmVmZXJlbmNlIG9yIG51bGxcbiAgX2J5SWQgPSAhQlVHR1lfR0VCSUQgP1xuICAgIGZ1bmN0aW9uKGlkLCBmcm9tKSB7XG4gICAgICBpZCA9IGlkLnJlcGxhY2UoL1xcXFwoW15cXFxcXXsxfSkvZywgJyQxJyk7XG4gICAgICByZXR1cm4gZnJvbS5nZXRFbGVtZW50QnlJZCAmJiBmcm9tLmdldEVsZW1lbnRCeUlkKGlkKSB8fFxuICAgICAgICBieUlkUmF3KGlkLCBmcm9tLmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJykpO1xuICAgIH0gOlxuICAgIGZ1bmN0aW9uKGlkLCBmcm9tKSB7XG4gICAgICB2YXIgZWxlbWVudCA9IG51bGw7XG4gICAgICBpZCA9IGlkLnJlcGxhY2UoL1xcXFwoW15cXFxcXXsxfSkvZywgJyQxJyk7XG4gICAgICBpZiAoWE1MX0RPQ1VNRU5UIHx8IGZyb20ubm9kZVR5cGUgIT0gOSkge1xuICAgICAgICByZXR1cm4gYnlJZFJhdyhpZCwgZnJvbS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnKicpKTtcbiAgICAgIH1cbiAgICAgIGlmICgoZWxlbWVudCA9IGZyb20uZ2V0RWxlbWVudEJ5SWQoaWQpKSAmJlxuICAgICAgICBlbGVtZW50Lm5hbWUgPT0gaWQgJiYgZnJvbS5nZXRFbGVtZW50c0J5TmFtZSkge1xuICAgICAgICByZXR1cm4gYnlJZFJhdyhpZCwgZnJvbS5nZXRFbGVtZW50c0J5TmFtZShpZCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfSxcblxuICAvLyBwdWJsaWNseSBleHBvc2VkIGJ5SWRcbiAgLy8gQHJldHVybiByZWZlcmVuY2Ugb3IgbnVsbFxuICBieUlkID1cbiAgICBmdW5jdGlvbihpZCwgZnJvbSkge1xuICAgICAgZnJvbSB8fCAoZnJvbSA9IGRvYyk7XG4gICAgICBpZiAobGFzdENvbnRleHQgIT09IGZyb20pIHsgc3dpdGNoQ29udGV4dChmcm9tKTsgfVxuICAgICAgcmV0dXJuIF9ieUlkKGlkLCBmcm9tKTtcbiAgICB9LFxuXG4gIC8vIGVsZW1lbnRzIGJ5IHRhZyAocmF3KVxuICAvLyBAcmV0dXJuIGFycmF5XG4gIGJ5VGFnUmF3ID1cbiAgICBmdW5jdGlvbih0YWcsIGZyb20pIHtcbiAgICAgIHZhciBhbnkgPSB0YWcgPT0gJyonLCBlbGVtZW50ID0gZnJvbSwgZWxlbWVudHMgPSBuZXcgZ2xvYmFsLkFycmF5KCksIG5leHQgPSBlbGVtZW50LmZpcnN0Q2hpbGQ7XG4gICAgICBhbnkgfHwgKHRhZyA9IHRhZy50b1VwcGVyQ2FzZSgpKTtcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IG5leHQpKSB7XG4gICAgICAgIGlmIChlbGVtZW50LnRhZ05hbWUgPiAnQCcgJiYgKGFueSB8fCBlbGVtZW50LnRhZ05hbWUudG9VcHBlckNhc2UoKSA9PSB0YWcpKSB7XG4gICAgICAgICAgZWxlbWVudHNbZWxlbWVudHMubGVuZ3RoXSA9IGVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChuZXh0ID0gZWxlbWVudC5maXJzdENoaWxkIHx8IGVsZW1lbnQubmV4dFNpYmxpbmcpKSBjb250aW51ZTtcbiAgICAgICAgd2hpbGUgKCFuZXh0ICYmIChlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlKSAmJiBlbGVtZW50ICE9PSBmcm9tKSB7XG4gICAgICAgICAgbmV4dCA9IGVsZW1lbnQubmV4dFNpYmxpbmc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtZW50cztcbiAgICB9LFxuXG4gIC8vIGVsZW1lbnRzIGJ5IHRhZ1xuICAvLyBAcmV0dXJuIGFycmF5XG4gIF9ieVRhZyA9ICFCVUdHWV9HRUJUTiAmJiBOQVRJVkVfU0xJQ0VfUFJPVE8gP1xuICAgIGZ1bmN0aW9uKHRhZywgZnJvbSkge1xuICAgICAgcmV0dXJuIFhNTF9ET0NVTUVOVCB8fCBmcm9tLm5vZGVUeXBlID09IDExID8gYnlUYWdSYXcodGFnLCBmcm9tKSA6XG4gICAgICAgIHNsaWNlLmNhbGwoZnJvbS5nZXRFbGVtZW50c0J5VGFnTmFtZSh0YWcpLCAwKTtcbiAgICB9IDpcbiAgICBmdW5jdGlvbih0YWcsIGZyb20pIHtcbiAgICAgIHZhciBpID0gLTEsIGogPSBpLCBkYXRhID0gbmV3IGdsb2JhbC5BcnJheSgpLFxuICAgICAgICBlbGVtZW50LCBlbGVtZW50cyA9IGZyb20uZ2V0RWxlbWVudHNCeVRhZ05hbWUodGFnKTtcbiAgICAgIGlmICh0YWcgPT0gJyonKSB7XG4gICAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnRzWysraV0pKSB7XG4gICAgICAgICAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPiAnQCcpXG4gICAgICAgICAgICBkYXRhWysral0gPSBlbGVtZW50O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aGlsZSAoKGVsZW1lbnQgPSBlbGVtZW50c1srK2ldKSkge1xuICAgICAgICAgIGRhdGFbaV0gPSBlbGVtZW50O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuXG4gIC8vIHB1YmxpY2x5IGV4cG9zZWQgYnlUYWdcbiAgLy8gQHJldHVybiBhcnJheVxuICBieVRhZyA9XG4gICAgZnVuY3Rpb24odGFnLCBmcm9tKSB7XG4gICAgICBmcm9tIHx8IChmcm9tID0gZG9jKTtcbiAgICAgIGlmIChsYXN0Q29udGV4dCAhPT0gZnJvbSkgeyBzd2l0Y2hDb250ZXh0KGZyb20pOyB9XG4gICAgICByZXR1cm4gX2J5VGFnKHRhZywgZnJvbSk7XG4gICAgfSxcblxuICAvLyBwdWJsaWNseSBleHBvc2VkIGJ5TmFtZVxuICAvLyBAcmV0dXJuIGFycmF5XG4gIGJ5TmFtZSA9XG4gICAgZnVuY3Rpb24obmFtZSwgZnJvbSkge1xuICAgICAgcmV0dXJuIHNlbGVjdCgnW25hbWU9XCInICsgbmFtZS5yZXBsYWNlKC9cXFxcKFteXFxcXF17MX0pL2csICckMScpICsgJ1wiXScsIGZyb20pO1xuICAgIH0sXG5cbiAgLy8gZWxlbWVudHMgYnkgY2xhc3MgKHJhdylcbiAgLy8gQHJldHVybiBhcnJheVxuICBieUNsYXNzUmF3ID1cbiAgICBmdW5jdGlvbihuYW1lLCBmcm9tKSB7XG4gICAgICB2YXIgaSA9IC0xLCBqID0gaSwgZGF0YSA9IG5ldyBnbG9iYWwuQXJyYXkoKSwgZWxlbWVudCwgZWxlbWVudHMgPSBfYnlUYWcoJyonLCBmcm9tKSwgbjtcbiAgICAgIG5hbWUgPSAnICcgKyAoUVVJUktTX01PREUgPyBuYW1lLnRvTG93ZXJDYXNlKCkgOiBuYW1lKS5yZXBsYWNlKC9cXFxcKFteXFxcXF17MX0pL2csICckMScpICsgJyAnO1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudHNbKytpXSkpIHtcbiAgICAgICAgbiA9IFhNTF9ET0NVTUVOVCA/IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdjbGFzcycpIDogZWxlbWVudC5jbGFzc05hbWU7XG4gICAgICAgIGlmIChuICYmIG4ubGVuZ3RoICYmICgnICcgKyAoUVVJUktTX01PREUgPyBuLnRvTG93ZXJDYXNlKCkgOiBuKS5cbiAgICAgICAgICByZXBsYWNlKHJlV2hpdGVTcGFjZSwgJyAnKSArICcgJykuaW5kZXhPZihuYW1lKSA+IC0xKSB7XG4gICAgICAgICAgZGF0YVsrK2pdID0gZWxlbWVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcblxuICAvLyBlbGVtZW50cyBieSBjbGFzc1xuICAvLyBAcmV0dXJuIGFycmF5XG4gIF9ieUNsYXNzID1cbiAgICBmdW5jdGlvbihuYW1lLCBmcm9tKSB7XG4gICAgICByZXR1cm4gKEJVR0dZX0dFQkNOIHx8IEJVR0dZX1FVSVJLU19HRUJDTiB8fCBYTUxfRE9DVU1FTlQgfHwgIWZyb20uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSkgP1xuICAgICAgICBieUNsYXNzUmF3KG5hbWUsIGZyb20pIDogc2xpY2UuY2FsbChmcm9tLmdldEVsZW1lbnRzQnlDbGFzc05hbWUobmFtZS5yZXBsYWNlKC9cXFxcKFteXFxcXF17MX0pL2csICckMScpKSwgMCk7XG4gICAgfSxcblxuICAvLyBwdWJsaWNseSBleHBvc2VkIGJ5Q2xhc3NcbiAgLy8gQHJldHVybiBhcnJheVxuICBieUNsYXNzID1cbiAgICBmdW5jdGlvbihuYW1lLCBmcm9tKSB7XG4gICAgICBmcm9tIHx8IChmcm9tID0gZG9jKTtcbiAgICAgIGlmIChsYXN0Q29udGV4dCAhPT0gZnJvbSkgeyBzd2l0Y2hDb250ZXh0KGZyb20pOyB9XG4gICAgICByZXR1cm4gX2J5Q2xhc3MobmFtZSwgZnJvbSk7XG4gICAgfSxcblxuICAvLyBjaGVjayBlbGVtZW50IGlzIGRlc2NlbmRhbnQgb2YgY29udGFpbmVyXG4gIC8vIEByZXR1cm4gYm9vbGVhblxuICBjb250YWlucyA9ICdjb21wYXJlRG9jdW1lbnRQb3NpdGlvbicgaW4gcm9vdCA/XG4gICAgZnVuY3Rpb24oY29udGFpbmVyLCBlbGVtZW50KSB7XG4gICAgICByZXR1cm4gKGNvbnRhaW5lci5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihlbGVtZW50KSAmIDE2KSA9PSAxNjtcbiAgICB9IDogJ2NvbnRhaW5zJyBpbiByb290ID9cbiAgICBmdW5jdGlvbihjb250YWluZXIsIGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBjb250YWluZXIgIT09IGVsZW1lbnQgJiYgY29udGFpbmVyLmNvbnRhaW5zKGVsZW1lbnQpO1xuICAgIH0gOlxuICAgIGZ1bmN0aW9uKGNvbnRhaW5lciwgZWxlbWVudCkge1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlKSkge1xuICAgICAgICBpZiAoZWxlbWVudCA9PT0gY29udGFpbmVyKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gIC8vIGF0dHJpYnV0ZSB2YWx1ZVxuICAvLyBAcmV0dXJuIHN0cmluZ1xuICBnZXRBdHRyaWJ1dGUgPSAhQlVHR1lfR0VUX0FUVFJJQlVURSA/XG4gICAgZnVuY3Rpb24obm9kZSwgYXR0cmlidXRlKSB7XG4gICAgICByZXR1cm4gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0cmlidXRlKTtcbiAgICB9IDpcbiAgICBmdW5jdGlvbihub2RlLCBhdHRyaWJ1dGUpIHtcbiAgICAgIGF0dHJpYnV0ZSA9IGF0dHJpYnV0ZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKHR5cGVvZiBub2RlW2F0dHJpYnV0ZV0gPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUuYXR0cmlidXRlc1thdHRyaWJ1dGVdICYmXG4gICAgICAgICAgbm9kZS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZV0udmFsdWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gKFxuICAgICAgICAvLyAndHlwZScgY2FuIG9ubHkgYmUgcmVhZCBieSB1c2luZyBuYXRpdmUgZ2V0QXR0cmlidXRlXG4gICAgICAgIGF0dHJpYnV0ZSA9PSAndHlwZScgPyBub2RlLmdldEF0dHJpYnV0ZShhdHRyaWJ1dGUpIDpcbiAgICAgICAgLy8gc3BlY2lmaWMgVVJJIGRhdGEgYXR0cmlidXRlcyAocGFyYW1ldGVyIDIgdG8gZml4IElFIGJ1ZylcbiAgICAgICAgQVRUUl9VUklEQVRBW2F0dHJpYnV0ZV0gPyBub2RlLmdldEF0dHJpYnV0ZShhdHRyaWJ1dGUsIDIpIDpcbiAgICAgICAgLy8gYm9vbGVhbiBhdHRyaWJ1dGVzIHNob3VsZCByZXR1cm4gbmFtZSBpbnN0ZWFkIG9mIHRydWUvZmFsc2VcbiAgICAgICAgQVRUUl9CT09MRUFOW2F0dHJpYnV0ZV0gPyBub2RlLmdldEF0dHJpYnV0ZShhdHRyaWJ1dGUpID8gYXR0cmlidXRlIDogJ2ZhbHNlJyA6XG4gICAgICAgICAgKG5vZGUgPSBub2RlLmdldEF0dHJpYnV0ZU5vZGUoYXR0cmlidXRlKSkgJiYgbm9kZS52YWx1ZSk7XG4gICAgfSxcblxuICAvLyBhdHRyaWJ1dGUgcHJlc2VuY2VcbiAgLy8gQHJldHVybiBib29sZWFuXG4gIGhhc0F0dHJpYnV0ZSA9ICFCVUdHWV9IQVNfQVRUUklCVVRFID9cbiAgICBmdW5jdGlvbihub2RlLCBhdHRyaWJ1dGUpIHtcbiAgICAgIHJldHVybiBYTUxfRE9DVU1FTlQgP1xuICAgICAgICAhIW5vZGUuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZSkgOlxuICAgICAgICBub2RlLmhhc0F0dHJpYnV0ZShhdHRyaWJ1dGUpO1xuICAgIH0gOlxuICAgIGZ1bmN0aW9uKG5vZGUsIGF0dHJpYnV0ZSkge1xuICAgICAgLy8gcmVhZCB0aGUgbm9kZSBhdHRyaWJ1dGUgb2JqZWN0XG4gICAgICB2YXIgb2JqID0gbm9kZS5nZXRBdHRyaWJ1dGVOb2RlKGF0dHJpYnV0ZSA9IGF0dHJpYnV0ZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgIHJldHVybiBBVFRSX0RFRkFVTFRbYXR0cmlidXRlXSAmJiBhdHRyaWJ1dGUgIT0gJ3ZhbHVlJyA/XG4gICAgICAgIG5vZGVbQVRUUl9ERUZBVUxUW2F0dHJpYnV0ZV1dIDogb2JqICYmIG9iai5zcGVjaWZpZWQ7XG4gICAgfSxcblxuICAvLyBjaGVjayBub2RlIGVtcHR5bmVzc1xuICAvLyBAcmV0dXJuIGJvb2xlYW5cbiAgaXNFbXB0eSA9XG4gICAgZnVuY3Rpb24obm9kZSkge1xuICAgICAgbm9kZSA9IG5vZGUuZmlyc3RDaGlsZDtcbiAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09IDMgfHwgbm9kZS5ub2RlTmFtZSA+ICdAJykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBub2RlID0gbm9kZS5uZXh0U2libGluZztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgLy8gY2hlY2sgaWYgZWxlbWVudCBtYXRjaGVzIHRoZSA6bGluayBwc2V1ZG9cbiAgLy8gQHJldHVybiBib29sZWFuXG4gIGlzTGluayA9XG4gICAgZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGhhc0F0dHJpYnV0ZShlbGVtZW50LCdocmVmJykgJiYgTElOS19OT0RFU1tlbGVtZW50Lm5vZGVOYW1lXTtcbiAgICB9LFxuXG4gIC8vIGNoaWxkIHBvc2l0aW9uIGJ5IG5vZGVUeXBlXG4gIC8vIEByZXR1cm4gbnVtYmVyXG4gIG50aEVsZW1lbnQgPVxuICAgIGZ1bmN0aW9uKGVsZW1lbnQsIGxhc3QpIHtcbiAgICAgIHZhciBjb3VudCA9IDEsIHN1Y2MgPSBsYXN0ID8gJ25leHRTaWJsaW5nJyA6ICdwcmV2aW91c1NpYmxpbmcnO1xuICAgICAgd2hpbGUgKChlbGVtZW50ID0gZWxlbWVudFtzdWNjXSkpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPiAnQCcpICsrY291bnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAvLyBjaGlsZCBwb3NpdGlvbiBieSBub2RlTmFtZVxuICAvLyBAcmV0dXJuIG51bWJlclxuICBudGhPZlR5cGUgPVxuICAgIGZ1bmN0aW9uKGVsZW1lbnQsIGxhc3QpIHtcbiAgICAgIHZhciBjb3VudCA9IDEsIHN1Y2MgPSBsYXN0ID8gJ25leHRTaWJsaW5nJyA6ICdwcmV2aW91c1NpYmxpbmcnLCB0eXBlID0gZWxlbWVudC5ub2RlTmFtZTtcbiAgICAgIHdoaWxlICgoZWxlbWVudCA9IGVsZW1lbnRbc3VjY10pKSB7XG4gICAgICAgIGlmIChlbGVtZW50Lm5vZGVOYW1lID09IHR5cGUpICsrY291bnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gY291bnQ7XG4gICAgfSxcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gREVCVUdHSU5HIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBnZXQvc2V0IChzdHJpbmcvb2JqZWN0KSB3b3JraW5nIG1vZGVzXG4gIGNvbmZpZ3VyZSA9XG4gICAgZnVuY3Rpb24ob3B0aW9uKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJykgeyByZXR1cm4gQ29uZmlnW29wdGlvbl0gfHwgQ29uZmlnOyB9XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbiAhPSAnb2JqZWN0JykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgIGZvciAodmFyIGkgaW4gb3B0aW9uKSB7XG4gICAgICAgIENvbmZpZ1tpXSA9ICEhb3B0aW9uW2ldO1xuICAgICAgICBpZiAoaSA9PSAnU0lNUExFTk9UJykge1xuICAgICAgICAgIG1hdGNoQ29udGV4dHMgPSBuZXcgZ2xvYmFsLk9iamVjdCgpO1xuICAgICAgICAgIG1hdGNoUmVzb2x2ZXJzID0gbmV3IGdsb2JhbC5PYmplY3QoKTtcbiAgICAgICAgICBzZWxlY3RDb250ZXh0cyA9IG5ldyBnbG9iYWwuT2JqZWN0KCk7XG4gICAgICAgICAgc2VsZWN0UmVzb2x2ZXJzID0gbmV3IGdsb2JhbC5PYmplY3QoKTtcbiAgICAgICAgICBpZiAoIUNvbmZpZ1tpXSkgeyBDb25maWdbJ1VTRV9RU0FQSSddID0gZmFsc2U7IH1cbiAgICAgICAgfSBlbHNlIGlmIChpID09ICdVU0VfUVNBUEknKSB7XG4gICAgICAgICAgQ29uZmlnW2ldID0gISFvcHRpb25baV0gJiYgTkFUSVZFX1FTQVBJO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZVZhbGlkYXRvciA9IG5ldyBnbG9iYWwuUmVnRXhwKENvbmZpZy5TSU1QTEVOT1QgP1xuICAgICAgICBzdGFuZGFyZFZhbGlkYXRvciA6IGV4dGVuZGVkVmFsaWRhdG9yKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgLy8gY29udHJvbCB1c2VyIG5vdGlmaWNhdGlvbnNcbiAgZW1pdCA9XG4gICAgZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgaWYgKENvbmZpZy5WRVJCT1NJVFkpIHsgdGhyb3cgbmV3IGdsb2JhbC5FcnJvcihtZXNzYWdlKTsgfVxuICAgICAgaWYgKGdsb2JhbC5jb25zb2xlICYmIGdsb2JhbC5jb25zb2xlLmxvZykge1xuICAgICAgICBnbG9iYWwuY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAgICB9XG4gICAgfSxcblxuICBDb25maWcgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG5cbiAgICAvLyB1c2VkIHRvIGVuYWJsZS9kaXNhYmxlIGNhY2hpbmcgb2YgcmVzdWx0IHNldHNcbiAgICBDQUNISU5HOiBmYWxzZSxcblxuICAgIC8vIGJ5IGRlZmF1bHQgZG8gbm90IGFkZCBtaXNzaW5nIGxlZnQvcmlnaHQgY29udGV4dFxuICAgIC8vIHRvIHNlbGVjdG9yIHN0cmluZyBzaG9ydGN1dHMgbGlrZSBcIitkaXZcIiBvciBcInVsPlwiXG4gICAgLy8gY2FsbGFibGUgRG9tLnNob3J0Y3V0cyBtZXRob2QgaGFzIHRvIGJlIGF2YWlsYWJsZVxuICAgIFNIT1JUQ1VUUzogZmFsc2UsXG5cbiAgICAvLyBieSBkZWZhdWx0IGRpc2FibGUgY29tcGxleCBzZWxlY3RvcnMgbmVzdGVkIGluXG4gICAgLy8gJzpub3QoKScgcHNldWRvLWNsYXNzZXMsIGFzIGZvciBzcGVjaWZpY2F0aW9uc1xuICAgIFNJTVBMRU5PVDogdHJ1ZSxcblxuICAgIC8vIHN0cmljdCBRU0EgbWF0Y2ggYWxsIG5vbi11bmlxdWUgSURzIChmYWxzZSlcbiAgICAvLyBzcGVlZCAmIGxpYnMgY29tcGF0IG1hdGNoIHVuaXF1ZSBJRCAodHJ1ZSlcbiAgICBVTklRVUVfSUQ6IHRydWUsXG5cbiAgICAvLyBIVE1MNSBoYW5kbGluZyBmb3IgdGhlIFwiOmNoZWNrZWRcIiBwc2V1ZG8tY2xhc3NcbiAgICBVU0VfSFRNTDU6IHRydWUsXG5cbiAgICAvLyBjb250cm9scyBlbmFibGluZyB0aGUgUXVlcnkgU2VsZWN0b3IgQVBJIGJyYW5jaFxuICAgIFVTRV9RU0FQSTogTkFUSVZFX1FTQVBJLFxuXG4gICAgLy8gY29udHJvbHMgdGhlIGVuZ2luZSBlcnJvci93YXJuaW5nIG5vdGlmaWNhdGlvbnNcbiAgICBWRVJCT1NJVFk6IHRydWVcblxuICB9KSxcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQ09NUElMRVIgTUVUSE9EUyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBjb2RlIHN0cmluZyByZXVzZWQgdG8gYnVpbGQgY29tcGlsZWQgZnVuY3Rpb25zXG4gIEFDQ0VQVF9OT0RFID0gJ3Jbci5sZW5ndGhdPWNba107aWYoZiYmZmFsc2U9PT1mKGNba10pKWJyZWFrIG1haW47ZWxzZSBjb250aW51ZSBtYWluOycsXG5cbiAgLy8gY29tcGlsZSBhIGNvbW1hIHNlcGFyYXRlZCBncm91cCBvZiBzZWxlY3RvclxuICAvLyBAbW9kZSBib29sZWFuIHRydWUgZm9yIHNlbGVjdCwgZmFsc2UgZm9yIG1hdGNoXG4gIC8vIHJldHVybiBhIGNvbXBpbGVkIGZ1bmN0aW9uXG4gIGNvbXBpbGUgPVxuICAgIGZ1bmN0aW9uKHNlbGVjdG9yLCBzb3VyY2UsIG1vZGUpIHtcblxuICAgICAgdmFyIHBhcnRzID0gdHlwZW9mIHNlbGVjdG9yID09ICdzdHJpbmcnID8gc2VsZWN0b3IubWF0Y2gocmVTcGxpdEdyb3VwKSA6IHNlbGVjdG9yO1xuXG4gICAgICAvLyBlbnN1cmVzIHRoYXQgc291cmNlIGlzIGEgc3RyaW5nXG4gICAgICB0eXBlb2Ygc291cmNlID09ICdzdHJpbmcnIHx8IChzb3VyY2UgPSAnJyk7XG5cbiAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT0gMSkge1xuICAgICAgICBzb3VyY2UgKz0gY29tcGlsZVNlbGVjdG9yKHBhcnRzWzBdLCBtb2RlID8gQUNDRVBUX05PREUgOiAnZiYmZihrKTtyZXR1cm4gdHJ1ZTsnLCBtb2RlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGZvciBlYWNoIHNlbGVjdG9yIGluIHRoZSBncm91cFxuICAgICAgICB2YXIgaSA9IC0xLCBzZWVuID0gbmV3IGdsb2JhbC5PYmplY3QoKSwgdG9rZW47XG4gICAgICAgIHdoaWxlICgodG9rZW4gPSBwYXJ0c1srK2ldKSkge1xuICAgICAgICAgIHRva2VuID0gdG9rZW4ucmVwbGFjZShyZVRyaW1TcGFjZXMsICcnKTtcbiAgICAgICAgICAvLyBhdm9pZCByZXBlYXRpbmcgdGhlIHNhbWUgdG9rZW5cbiAgICAgICAgICAvLyBpbiBjb21tYSBzZXBhcmF0ZWQgZ3JvdXAgKHAsIHApXG4gICAgICAgICAgaWYgKCFzZWVuW3Rva2VuXSAmJiAoc2Vlblt0b2tlbl0gPSB0cnVlKSkge1xuICAgICAgICAgICAgc291cmNlICs9IGNvbXBpbGVTZWxlY3Rvcih0b2tlbiwgbW9kZSA/IEFDQ0VQVF9OT0RFIDogJ2YmJmYoayk7cmV0dXJuIHRydWU7JywgbW9kZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChtb2RlKSB7XG4gICAgICAgIC8vIGZvciBzZWxlY3QgbWV0aG9kXG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLkZ1bmN0aW9uKCdjLHMscixkLGgsZyxmLHYnLFxuICAgICAgICAgICd2YXIgTixuLHg9MCxrPS0xLGU7bWFpbjp3aGlsZSgoZT1jWysra10pKXsnICsgc291cmNlICsgJ31yZXR1cm4gcjsnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGZvciBtYXRjaCBtZXRob2RcbiAgICAgICAgcmV0dXJuIG5ldyBnbG9iYWwuRnVuY3Rpb24oJ2UscyxyLGQsaCxnLGYsdicsXG4gICAgICAgICAgJ3ZhciBOLG4seD0wLGs9ZTsnICsgc291cmNlICsgJ3JldHVybiBmYWxzZTsnKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gIC8vIGFsbG93cyB0byBjYWNoZSBhbHJlYWR5IHZpc2l0ZWQgbm9kZXNcbiAgRklMVEVSID1cbiAgICAndmFyIHo9dltAXXx8KHZbQF09W10pLGw9ei5sZW5ndGgtMTsnICtcbiAgICAnd2hpbGUobD49MCYmeltsXSE9PWUpLS1sOycgK1xuICAgICdpZihsIT09LTEpe2JyZWFrO30nICtcbiAgICAnelt6Lmxlbmd0aF09ZTsnLFxuXG4gIC8vIGNvbXBpbGUgYSBDU1MzIHN0cmluZyBzZWxlY3RvciBpbnRvIGFkLWhvYyBqYXZhc2NyaXB0IG1hdGNoaW5nIGZ1bmN0aW9uXG4gIC8vIEByZXR1cm4gc3RyaW5nICh0byBiZSBjb21waWxlZClcbiAgY29tcGlsZVNlbGVjdG9yID1cbiAgICBmdW5jdGlvbihzZWxlY3Rvciwgc291cmNlLCBtb2RlKSB7XG5cbiAgICAgIHZhciBhLCBiLCBuLCBrID0gMCwgZXhwciwgbWF0Y2gsIHJlc3VsdCwgc3RhdHVzLCB0ZXN0LCB0eXBlO1xuXG4gICAgICB3aGlsZSAoc2VsZWN0b3IpIHtcblxuICAgICAgICBrKys7XG5cbiAgICAgICAgLy8gKioqIFVuaXZlcnNhbCBzZWxlY3RvclxuICAgICAgICAvLyAqIG1hdGNoIGFsbCAoZW1wdHkgYmxvY2ssIGRvIG5vdCByZW1vdmUpXG4gICAgICAgIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy51bml2ZXJzYWwpKSkge1xuICAgICAgICAgIC8vIGRvIG5vdGhpbmcsIGhhbmRsZWQgaW4gdGhlIGNvbXBpbGVyIHdoZXJlXG4gICAgICAgICAgLy8gQlVHR1lfR0VCVE4gcmV0dXJuIGNvbW1lbnQgbm9kZXMgKGV4OiBJRSlcbiAgICAgICAgICBleHByID0gJyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogSUQgc2VsZWN0b3JcbiAgICAgICAgLy8gI0ZvbyBJZCBjYXNlIHNlbnNpdGl2ZVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5pZCkpKSB7XG4gICAgICAgICAgLy8gZG9jdW1lbnQgY2FuIGNvbnRhaW4gY29uZmxpY3RpbmcgZWxlbWVudHMgKGlkL25hbWUpXG4gICAgICAgICAgLy8gcHJvdG90eXBlIHNlbGVjdG9yIHVuaXQgbmVlZCB0aGlzIG1ldGhvZCB0byByZWNvdmVyIGJhZCBIVE1MIGZvcm1zXG4gICAgICAgICAgc291cmNlID0gJ2lmKCcgKyAoWE1MX0RPQ1VNRU5UID9cbiAgICAgICAgICAgICdzLmdldEF0dHJpYnV0ZShlLFwiaWRcIiknIDpcbiAgICAgICAgICAgICcoZS5zdWJtaXQ/cy5nZXRBdHRyaWJ1dGUoZSxcImlkXCIpOmUuaWQpJykgK1xuICAgICAgICAgICAgJz09XCInICsgbWF0Y2hbMV0gKyAnXCInICtcbiAgICAgICAgICAgICcpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogVHlwZSBzZWxlY3RvclxuICAgICAgICAvLyBGb28gVGFnIChjYXNlIGluc2Vuc2l0aXZlKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy50YWdOYW1lKSkpIHtcbiAgICAgICAgICAvLyBib3RoIHRhZ05hbWUgYW5kIG5vZGVOYW1lIHByb3BlcnRpZXMgbWF5IGJlIHVwcGVyL2xvd2VyIGNhc2VcbiAgICAgICAgICAvLyBkZXBlbmRpbmcgb24gdGhlaXIgY3JlYXRpb24gTkFNRVNQQUNFIGluIGNyZWF0ZUVsZW1lbnROUygpXG4gICAgICAgICAgc291cmNlID0gJ2lmKGUubm9kZU5hbWUnICsgKFhNTF9ET0NVTUVOVCA/XG4gICAgICAgICAgICAnPT1cIicgKyBtYXRjaFsxXSArICdcIicgOiAnLnRvVXBwZXJDYXNlKCknICtcbiAgICAgICAgICAgICc9PVwiJyArIG1hdGNoWzFdLnRvVXBwZXJDYXNlKCkgKyAnXCInKSArXG4gICAgICAgICAgICAnKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIENsYXNzIHNlbGVjdG9yXG4gICAgICAgIC8vIC5Gb28gQ2xhc3MgKGNhc2Ugc2Vuc2l0aXZlKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5jbGFzc05hbWUpKSkge1xuICAgICAgICAgIC8vIFczQyBDU1MzIHNwZWNzOiBlbGVtZW50IHdob3NlIFwiY2xhc3NcIiBhdHRyaWJ1dGUgaGFzIGJlZW4gYXNzaWduZWQgYVxuICAgICAgICAgIC8vIGxpc3Qgb2Ygd2hpdGVzcGFjZS1zZXBhcmF0ZWQgdmFsdWVzLCBzZWUgc2VjdGlvbiA2LjQgQ2xhc3Mgc2VsZWN0b3JzXG4gICAgICAgICAgLy8gYW5kIG5vdGVzIGF0IHRoZSBib3R0b207IGV4cGxpY2l0bHkgbm9uLW5vcm1hdGl2ZSBpbiB0aGlzIHNwZWNpZmljYXRpb24uXG4gICAgICAgICAgc291cmNlID0gJ2lmKChuPScgKyAoWE1MX0RPQ1VNRU5UID9cbiAgICAgICAgICAgICdzLmdldEF0dHJpYnV0ZShlLFwiY2xhc3NcIiknIDogJ2UuY2xhc3NOYW1lJykgK1xuICAgICAgICAgICAgJykmJm4ubGVuZ3RoJiYoXCIgXCIrJyArIChRVUlSS1NfTU9ERSA/ICduLnRvTG93ZXJDYXNlKCknIDogJ24nKSArXG4gICAgICAgICAgICAnLnJlcGxhY2UoJyArIHJlV2hpdGVTcGFjZSArICcsXCIgXCIpK1wiIFwiKS5pbmRleE9mKFwiICcgK1xuICAgICAgICAgICAgKFFVSVJLU19NT0RFID8gbWF0Y2hbMV0udG9Mb3dlckNhc2UoKSA6IG1hdGNoWzFdKSArICcgXCIpPi0xJyArXG4gICAgICAgICAgICAnKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIEF0dHJpYnV0ZSBzZWxlY3RvclxuICAgICAgICAvLyBbYXR0cl0gW2F0dHI9dmFsdWVdIFthdHRyPVwidmFsdWVcIl0gW2F0dHI9J3ZhbHVlJ10gYW5kICE9LCAqPSwgfj0sIHw9LCBePSwgJD1cbiAgICAgICAgLy8gY2FzZSBzZW5zaXRpdml0eSBpcyB0cmVhdGVkIGRpZmZlcmVudGx5IGRlcGVuZGluZyBvbiB0aGUgZG9jdW1lbnQgdHlwZSAoc2VlIG1hcClcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuYXR0cmlidXRlKSkpIHtcblxuICAgICAgICAgIC8vIHhtbCBuYW1lc3BhY2VkIGF0dHJpYnV0ZSA/XG4gICAgICAgICAgZXhwciA9IG1hdGNoWzFdLnNwbGl0KCc6Jyk7XG4gICAgICAgICAgZXhwciA9IGV4cHIubGVuZ3RoID09IDIgPyBleHByWzFdIDogZXhwclswXSArICcnO1xuXG4gICAgICAgICAgaWYgKG1hdGNoWzJdICYmICFPcGVyYXRvcnNbbWF0Y2hbMl1dKSB7XG4gICAgICAgICAgICBlbWl0KCdVbnN1cHBvcnRlZCBvcGVyYXRvciBpbiBhdHRyaWJ1dGUgc2VsZWN0b3JzIFwiJyArIHNlbGVjdG9yICsgJ1wiJyk7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGVzdCA9ICdmYWxzZSc7XG5cbiAgICAgICAgICAvLyByZXBsYWNlIE9wZXJhdG9ycyBwYXJhbWV0ZXIgaWYgbmVlZGVkXG4gICAgICAgICAgaWYgKG1hdGNoWzJdICYmIG1hdGNoWzRdICYmICh0ZXN0ID0gT3BlcmF0b3JzW21hdGNoWzJdXSkpIHtcbiAgICAgICAgICAgIG1hdGNoWzRdID0gY29udmVydEVzY2FwZXMobWF0Y2hbNF0pO1xuICAgICAgICAgICAgLy8gY2FzZSB0cmVhdG1lbnQgZGVwZW5kcyBvbiBkb2N1bWVudFxuICAgICAgICAgICAgSFRNTF9UQUJMRVsnY2xhc3MnXSA9IFFVSVJLU19NT0RFID8gMSA6IDA7XG4gICAgICAgICAgICB0eXBlID0gKFhNTF9ET0NVTUVOVCA/IFhIVE1MX1RBQkxFIDogSFRNTF9UQUJMRSlbZXhwci50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgICAgIHRlc3QgPSB0ZXN0LnJlcGxhY2UoL1xcJW0vZywgdHlwZSA/IG1hdGNoWzRdLnRvTG93ZXJDYXNlKCkgOiBtYXRjaFs0XSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChtYXRjaFsyXSA9PSAnIT0nIHx8IG1hdGNoWzJdID09ICc9Jykge1xuICAgICAgICAgICAgdGVzdCA9ICduJyArIG1hdGNoWzJdICsgJz1cIlwiJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzb3VyY2UgPSAnaWYobj1zLmhhc0F0dHJpYnV0ZShlLFwiJyArIG1hdGNoWzFdICsgJ1wiKSl7JyArXG4gICAgICAgICAgICAobWF0Y2hbMl0gPyAnbj1zLmdldEF0dHJpYnV0ZShlLFwiJyArIG1hdGNoWzFdICsgJ1wiKScgOiAnJykgK1xuICAgICAgICAgICAgKHR5cGUgJiYgbWF0Y2hbMl0gPyAnLnRvTG93ZXJDYXNlKCk7JyA6ICc7JykgK1xuICAgICAgICAgICAgJ2lmKCcgKyAobWF0Y2hbMl0gPyB0ZXN0IDogJ24nKSArICcpeycgKyBzb3VyY2UgKyAnfX0nO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogQWRqYWNlbnQgc2libGluZyBjb21iaW5hdG9yXG4gICAgICAgIC8vIEUgKyBGIChGIGFkaWFjZW50IHNpYmxpbmcgb2YgRSlcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuYWRqYWNlbnQpKSkge1xuICAgICAgICAgIHNvdXJjZSA9IChtb2RlID8gJycgOiBGSUxURVIucmVwbGFjZSgvQC9nLCBrKSkgKyBzb3VyY2U7XG4gICAgICAgICAgc291cmNlID0gTkFUSVZFX1RSQVZFUlNBTF9BUEkgP1xuICAgICAgICAgICAgJ3ZhciBOJyArIGsgKyAnPWU7d2hpbGUoZSYmKGU9ZS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nKSl7JyArIHNvdXJjZSArICdicmVhazt9ZT1OJyArIGsgKyAnOycgOlxuICAgICAgICAgICAgJ3ZhciBOJyArIGsgKyAnPWU7d2hpbGUoZSYmKGU9ZS5wcmV2aW91c1NpYmxpbmcpKXtpZihlLm5vZGVOYW1lPlwiQFwiKXsnICsgc291cmNlICsgJ2JyZWFrO319ZT1OJyArIGsgKyAnOyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogR2VuZXJhbCBzaWJsaW5nIGNvbWJpbmF0b3JcbiAgICAgICAgLy8gRSB+IEYgKEYgcmVsYXRpdmUgc2libGluZyBvZiBFKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5yZWxhdGl2ZSkpKSB7XG4gICAgICAgICAgc291cmNlID0gKG1vZGUgPyAnJyA6IEZJTFRFUi5yZXBsYWNlKC9AL2csIGspKSArIHNvdXJjZTtcbiAgICAgICAgICBzb3VyY2UgPSBOQVRJVkVfVFJBVkVSU0FMX0FQSSA/XG4gICAgICAgICAgICAoJ3ZhciBOJyArIGsgKyAnPWU7ZT1lLnBhcmVudE5vZGUuZmlyc3RFbGVtZW50Q2hpbGQ7JyArXG4gICAgICAgICAgICAnd2hpbGUoZSYmZSE9PU4nICsgayArICcpeycgKyBzb3VyY2UgKyAnZT1lLm5leHRFbGVtZW50U2libGluZzt9ZT1OJyArIGsgKyAnOycpIDpcbiAgICAgICAgICAgICgndmFyIE4nICsgayArICc9ZTtlPWUucGFyZW50Tm9kZS5maXJzdENoaWxkOycgK1xuICAgICAgICAgICAgJ3doaWxlKGUmJmUhPT1OJyArIGsgKyAnKXtpZihlLm5vZGVOYW1lPlwiQFwiKXsnICsgc291cmNlICsgJ31lPWUubmV4dFNpYmxpbmc7fWU9TicgKyBrICsgJzsnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICoqKiBDaGlsZCBjb21iaW5hdG9yXG4gICAgICAgIC8vIEUgPiBGIChGIGNoaWxkcmVuIG9mIEUpXG4gICAgICAgIGVsc2UgaWYgKChtYXRjaCA9IHNlbGVjdG9yLm1hdGNoKFBhdHRlcm5zLmNoaWxkcmVuKSkpIHtcbiAgICAgICAgICBzb3VyY2UgPSAobW9kZSA/ICcnIDogRklMVEVSLnJlcGxhY2UoL0AvZywgaykpICsgc291cmNlO1xuICAgICAgICAgIHNvdXJjZSA9ICd2YXIgTicgKyBrICsgJz1lO3doaWxlKGUmJmUhPT1oJiZlIT09ZyYmKGU9ZS5wYXJlbnROb2RlKSl7JyArIHNvdXJjZSArICdicmVhazt9ZT1OJyArIGsgKyAnOyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAqKiogRGVzY2VuZGFudCBjb21iaW5hdG9yXG4gICAgICAgIC8vIEUgRiAoRSBhbmNlc3RvciBvZiBGKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5hbmNlc3RvcikpKSB7XG4gICAgICAgICAgc291cmNlID0gKG1vZGUgPyAnJyA6IEZJTFRFUi5yZXBsYWNlKC9AL2csIGspKSArIHNvdXJjZTtcbiAgICAgICAgICBzb3VyY2UgPSAndmFyIE4nICsgayArICc9ZTt3aGlsZShlJiZlIT09aCYmZSE9PWcmJihlPWUucGFyZW50Tm9kZSkpeycgKyBzb3VyY2UgKyAnfWU9TicgKyBrICsgJzsnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIFN0cnVjdHVyYWwgcHNldWRvLWNsYXNzZXNcbiAgICAgICAgLy8gOnJvb3QsIDplbXB0eSxcbiAgICAgICAgLy8gOmZpcnN0LWNoaWxkLCA6bGFzdC1jaGlsZCwgOm9ubHktY2hpbGQsXG4gICAgICAgIC8vIDpmaXJzdC1vZi10eXBlLCA6bGFzdC1vZi10eXBlLCA6b25seS1vZi10eXBlLFxuICAgICAgICAvLyA6bnRoLWNoaWxkKCksIDpudGgtbGFzdC1jaGlsZCgpLCA6bnRoLW9mLXR5cGUoKSwgOm50aC1sYXN0LW9mLXR5cGUoKVxuICAgICAgICBlbHNlIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChQYXR0ZXJucy5zcHNldWRvcykpICYmIG1hdGNoWzFdKSB7XG5cbiAgICAgICAgICBzd2l0Y2ggKG1hdGNoWzFdKSB7XG4gICAgICAgICAgICBjYXNlICdyb290JzpcbiAgICAgICAgICAgICAgLy8gZWxlbWVudCByb290IG9mIHRoZSBkb2N1bWVudFxuICAgICAgICAgICAgICBpZiAobWF0Y2hbM10pIHtcbiAgICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoZT09PWh8fHMuY29udGFpbnMoaCxlKSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoZT09PWgpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ2VtcHR5JzpcbiAgICAgICAgICAgICAgLy8gZWxlbWVudCB0aGF0IGhhcyBubyBjaGlsZHJlblxuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYocy5pc0VtcHR5KGUpKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgaWYgKG1hdGNoWzFdICYmIG1hdGNoWzJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoWzJdID09ICduJykge1xuICAgICAgICAgICAgICAgICAgc291cmNlID0gJ2lmKGUhPT1oKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRjaFsyXSA9PSAnZXZlbicpIHtcbiAgICAgICAgICAgICAgICAgIGEgPSAyO1xuICAgICAgICAgICAgICAgICAgYiA9IDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRjaFsyXSA9PSAnb2RkJykge1xuICAgICAgICAgICAgICAgICAgYSA9IDI7XG4gICAgICAgICAgICAgICAgICBiID0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gYXNzdW1lcyBjb3JyZWN0IFwiYW4rYlwiIGZvcm1hdCwgXCJiXCIgYmVmb3JlIFwiYVwiIHRvIGtlZXAgXCJuXCIgdmFsdWVzXG4gICAgICAgICAgICAgICAgICBiID0gKChuID0gbWF0Y2hbMl0ubWF0Y2goLygtP1xcZCspJC8pKSA/IGdsb2JhbC5wYXJzZUludChuWzFdLCAxMCkgOiAwKTtcbiAgICAgICAgICAgICAgICAgIGEgPSAoKG4gPSBtYXRjaFsyXS5tYXRjaCgvKC0/XFxkKiluL2kpKSA/IGdsb2JhbC5wYXJzZUludChuWzFdLCAxMCkgOiAwKTtcbiAgICAgICAgICAgICAgICAgIGlmIChuICYmIG5bMV0gPT0gJy0nKSBhID0gLTE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYnVpbGQgdGVzdCBleHByZXNzaW9uIG91dCBvZiBzdHJ1Y3R1cmFsIHBzZXVkbyAoYW4rYikgcGFyYW1ldGVyc1xuICAgICAgICAgICAgICAgIC8vIHNlZSBoZXJlOiBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3MzLXNlbGVjdG9ycy8jbnRoLWNoaWxkLXBzZXVkb1xuICAgICAgICAgICAgICAgIHRlc3QgPSBhID4gMSA/XG4gICAgICAgICAgICAgICAgICAoL2xhc3QvaS50ZXN0KG1hdGNoWzFdKSkgPyAnKG4tKCcgKyBiICsgJykpJScgKyBhICsgJz09MCcgOlxuICAgICAgICAgICAgICAgICAgJ24+PScgKyBiICsgJyYmKG4tKCcgKyBiICsgJykpJScgKyBhICsgJz09MCcgOiBhIDwgLTEgP1xuICAgICAgICAgICAgICAgICAgKC9sYXN0L2kudGVzdChtYXRjaFsxXSkpID8gJyhuLSgnICsgYiArICcpKSUnICsgYSArICc9PTAnIDpcbiAgICAgICAgICAgICAgICAgICduPD0nICsgYiArICcmJihuLSgnICsgYiArICcpKSUnICsgYSArICc9PTAnIDogYSA9PT0gMCA/XG4gICAgICAgICAgICAgICAgICAnbj09JyArIGIgOiBhID09IC0xID8gJ248PScgKyBiIDogJ24+PScgKyBiO1xuXG4gICAgICAgICAgICAgICAgLy8gNCBjYXNlczogMSAobnRoKSB4IDQgKGNoaWxkLCBvZi10eXBlLCBsYXN0LWNoaWxkLCBsYXN0LW9mLXR5cGUpXG4gICAgICAgICAgICAgICAgc291cmNlID1cbiAgICAgICAgICAgICAgICAgICdpZihlIT09aCl7JyArXG4gICAgICAgICAgICAgICAgICAgICduPXNbJyArICgvLW9mLXR5cGUvaS50ZXN0KG1hdGNoWzFdKSA/ICdcIm50aE9mVHlwZVwiJyA6ICdcIm50aEVsZW1lbnRcIicpICsgJ10nICtcbiAgICAgICAgICAgICAgICAgICAgICAnKGUsJyArICgvbGFzdC9pLnRlc3QobWF0Y2hbMV0pID8gJ3RydWUnIDogJ2ZhbHNlJykgKyAnKTsnICtcbiAgICAgICAgICAgICAgICAgICAgJ2lmKCcgKyB0ZXN0ICsgJyl7JyArIHNvdXJjZSArICd9JyArXG4gICAgICAgICAgICAgICAgICAnfSc7XG5cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyA2IGNhc2VzOiAzIChmaXJzdCwgbGFzdCwgb25seSkgeCAxIChjaGlsZCkgeCAyICgtb2YtdHlwZSlcbiAgICAgICAgICAgICAgICBhID0gL2ZpcnN0L2kudGVzdChtYXRjaFsxXSkgPyAncHJldmlvdXMnIDogJ25leHQnO1xuICAgICAgICAgICAgICAgIG4gPSAvb25seS9pLnRlc3QobWF0Y2hbMV0pID8gJ3ByZXZpb3VzJyA6ICduZXh0JztcbiAgICAgICAgICAgICAgICBiID0gL2ZpcnN0fGxhc3QvaS50ZXN0KG1hdGNoWzFdKTtcblxuICAgICAgICAgICAgICAgIHR5cGUgPSAvLW9mLXR5cGUvaS50ZXN0KG1hdGNoWzFdKSA/ICcmJm4ubm9kZU5hbWUhPWUubm9kZU5hbWUnIDogJyYmbi5ub2RlTmFtZTxcIkBcIic7XG5cbiAgICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoZSE9PWgpeycgK1xuICAgICAgICAgICAgICAgICAgKCAnbj1lO3doaWxlKChuPW4uJyArIGEgKyAnU2libGluZyknICsgdHlwZSArICcpO2lmKCFuKXsnICsgKGIgPyBzb3VyY2UgOlxuICAgICAgICAgICAgICAgICAgICAnbj1lO3doaWxlKChuPW4uJyArIG4gKyAnU2libGluZyknICsgdHlwZSArICcpO2lmKCFuKXsnICsgc291cmNlICsgJ30nKSArICd9JyApICsgJ30nO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gKioqIG5lZ2F0aW9uLCB1c2VyIGFjdGlvbiBhbmQgdGFyZ2V0IHBzZXVkby1jbGFzc2VzXG4gICAgICAgIC8vICoqKiBVSSBlbGVtZW50IHN0YXRlcyBhbmQgZHluYW1pYyBwc2V1ZG8tY2xhc3Nlc1xuICAgICAgICAvLyBDU1MzIDpub3QsIDpjaGVja2VkLCA6ZW5hYmxlZCwgOmRpc2FibGVkLCA6dGFyZ2V0XG4gICAgICAgIC8vIENTUzMgOmFjdGl2ZSwgOmhvdmVyLCA6Zm9jdXNcbiAgICAgICAgLy8gQ1NTMyA6bGluaywgOnZpc2l0ZWRcbiAgICAgICAgZWxzZSBpZiAoKG1hdGNoID0gc2VsZWN0b3IubWF0Y2goUGF0dGVybnMuZHBzZXVkb3MpKSAmJiBtYXRjaFsxXSkge1xuXG4gICAgICAgICAgc3dpdGNoIChtYXRjaFsxXS5tYXRjaCgvXlxcdysvKVswXSkge1xuICAgICAgICAgICAgLy8gQ1NTMyBuZWdhdGlvbiBwc2V1ZG8tY2xhc3NcbiAgICAgICAgICAgIGNhc2UgJ25vdCc6XG4gICAgICAgICAgICAgIC8vIGNvbXBpbGUgbmVzdGVkIHNlbGVjdG9ycywgRE8gTk9UIHBhc3MgdGhlIGNhbGxiYWNrIHBhcmFtZXRlclxuICAgICAgICAgICAgICAvLyBTSU1QTEVOT1QgYWxsb3cgZGlzYWJsaW5nIGNvbXBsZXggc2VsZWN0b3JzIG5lc3RlZFxuICAgICAgICAgICAgICAvLyBpbiAnOm5vdCgpJyBwc2V1ZG8tY2xhc3NlcywgYnJlYWtzIHNvbWUgdGVzdCB1bml0c1xuICAgICAgICAgICAgICBleHByID0gbWF0Y2hbM10ucmVwbGFjZShyZVRyaW1TcGFjZXMsICcnKTtcblxuICAgICAgICAgICAgICBpZiAoQ29uZmlnLlNJTVBMRU5PVCAmJiAhcmVTaW1wbGVOb3QudGVzdChleHByKSkge1xuICAgICAgICAgICAgICAgIC8vIHNlZSBhYm92ZSwgbG9nIGVycm9yIGJ1dCBjb250aW51ZSBleGVjdXRpb25cbiAgICAgICAgICAgICAgICBlbWl0KCdOZWdhdGlvbiBwc2V1ZG8tY2xhc3Mgb25seSBhY2NlcHRzIHNpbXBsZSBzZWxlY3RvcnMgXCInICsgc2VsZWN0b3IgKyAnXCInKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCdjb21wYXRNb2RlJyBpbiBkb2MpIHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZSA9ICdpZighJyArIGNvbXBpbGUoZXhwciwgJycsIGZhbHNlKSArICcoZSxzLHIsZCxoLGcpKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoIXMubWF0Y2goZSwgXCInICsgZXhwci5yZXBsYWNlKC9cXHgyMi9nLCAnXFxcXFwiJykgKyAnXCIsZykpeycgKyBzb3VyY2UgKyd9JztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIC8vIENTUzMgVUkgZWxlbWVudCBzdGF0ZXNcbiAgICAgICAgICAgIGNhc2UgJ2NoZWNrZWQnOlxuICAgICAgICAgICAgICAvLyBmb3IgcmFkaW8gYnV0dG9ucyBjaGVja2JveGVzIChIVE1MNCkgYW5kIG9wdGlvbnMgKEhUTUw1KVxuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoKHR5cGVvZiBlLmZvcm0hPT1cInVuZGVmaW5lZFwiJiYoL14oPzpyYWRpb3xjaGVja2JveCkkL2kpLnRlc3QoZS50eXBlKSYmZS5jaGVja2VkKScgK1xuICAgICAgICAgICAgICAgIChDb25maWcuVVNFX0hUTUw1ID8gJ3x8KC9eb3B0aW9uJC9pLnRlc3QoZS5ub2RlTmFtZSkmJihlLnNlbGVjdGVkfHxlLmNoZWNrZWQpKScgOiAnJykgK1xuICAgICAgICAgICAgICAgICcpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZGlzYWJsZWQnOlxuICAgICAgICAgICAgICAvLyBkb2VzIG5vdCBjb25zaWRlciBoaWRkZW4gaW5wdXQgZmllbGRzXG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZigoKHR5cGVvZiBlLmZvcm0hPT1cInVuZGVmaW5lZFwiJyArXG4gICAgICAgICAgICAgICAgKENvbmZpZy5VU0VfSFRNTDUgPyAnJyA6ICcmJiEoL15oaWRkZW4kL2kpLnRlc3QoZS50eXBlKScpICtcbiAgICAgICAgICAgICAgICAnKXx8cy5pc0xpbmsoZSkpJiZlLmRpc2FibGVkPT09dHJ1ZSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdlbmFibGVkJzpcbiAgICAgICAgICAgICAgLy8gZG9lcyBub3QgY29uc2lkZXIgaGlkZGVuIGlucHV0IGZpZWxkc1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoKCh0eXBlb2YgZS5mb3JtIT09XCJ1bmRlZmluZWRcIicgK1xuICAgICAgICAgICAgICAgIChDb25maWcuVVNFX0hUTUw1ID8gJycgOiAnJiYhKC9eaGlkZGVuJC9pKS50ZXN0KGUudHlwZSknKSArXG4gICAgICAgICAgICAgICAgJyl8fHMuaXNMaW5rKGUpKSYmZS5kaXNhYmxlZD09PWZhbHNlKXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gQ1NTMyBsYW5nIHBzZXVkby1jbGFzc1xuICAgICAgICAgICAgY2FzZSAnbGFuZyc6XG4gICAgICAgICAgICAgIHRlc3QgPSAnJztcbiAgICAgICAgICAgICAgaWYgKG1hdGNoWzJdKSB0ZXN0ID0gbWF0Y2hbMl0uc3Vic3RyKDAsIDIpICsgJy0nO1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnZG97KG49ZS5sYW5nfHxcIlwiKS50b0xvd2VyQ2FzZSgpOycgK1xuICAgICAgICAgICAgICAgICdpZigobj09XCJcIiYmaC5sYW5nPT1cIicgKyBtYXRjaFsyXS50b0xvd2VyQ2FzZSgpICsgJ1wiKXx8JyArXG4gICAgICAgICAgICAgICAgJyhuJiYobj09XCInICsgbWF0Y2hbMl0udG9Mb3dlckNhc2UoKSArXG4gICAgICAgICAgICAgICAgJ1wifHxuLnN1YnN0cigwLDMpPT1cIicgKyB0ZXN0LnRvTG93ZXJDYXNlKCkgKyAnXCIpKSknICtcbiAgICAgICAgICAgICAgICAneycgKyBzb3VyY2UgKyAnYnJlYWs7fX13aGlsZSgoZT1lLnBhcmVudE5vZGUpJiZlIT09Zyk7JztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIC8vIENTUzMgdGFyZ2V0IHBzZXVkby1jbGFzc1xuICAgICAgICAgICAgY2FzZSAndGFyZ2V0JzpcbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKGUuaWQ9PWQubG9jYXRpb24uaGFzaC5zbGljZSgxKSl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIC8vIENTUzMgZHluYW1pYyBwc2V1ZG8tY2xhc3Nlc1xuICAgICAgICAgICAgY2FzZSAnbGluayc6XG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihzLmlzTGluayhlKSYmIWUudmlzaXRlZCl7JyArIHNvdXJjZSArICd9JztcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd2aXNpdGVkJzpcbiAgICAgICAgICAgICAgc291cmNlID0gJ2lmKHMuaXNMaW5rKGUpJiZlLnZpc2l0ZWQpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBDU1MzIHVzZXIgYWN0aW9uIHBzZXVkby1jbGFzc2VzIElFICYgRkYzIGhhdmUgbmF0aXZlIHN1cHBvcnRcbiAgICAgICAgICAgIC8vIHRoZXNlIGNhcGFiaWxpdGllcyBtYXkgYmUgZW11bGF0ZWQgYnkgc29tZSBldmVudCBtYW5hZ2Vyc1xuICAgICAgICAgICAgY2FzZSAnYWN0aXZlJzpcbiAgICAgICAgICAgICAgaWYgKFhNTF9ET0NVTUVOVCkgYnJlYWs7XG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihlPT09ZC5hY3RpdmVFbGVtZW50KXsnICsgc291cmNlICsgJ30nO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2hvdmVyJzpcbiAgICAgICAgICAgICAgaWYgKFhNTF9ET0NVTUVOVCkgYnJlYWs7XG4gICAgICAgICAgICAgIHNvdXJjZSA9ICdpZihlPT09ZC5ob3ZlckVsZW1lbnQpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZm9jdXMnOlxuICAgICAgICAgICAgICBpZiAoWE1MX0RPQ1VNRU5UKSBicmVhaztcbiAgICAgICAgICAgICAgc291cmNlID0gTkFUSVZFX0ZPQ1VTID9cbiAgICAgICAgICAgICAgICAnaWYoZT09PWQuYWN0aXZlRWxlbWVudCYmZC5oYXNGb2N1cygpJiYoZS50eXBlfHxlLmhyZWZ8fHR5cGVvZiBlLnRhYkluZGV4PT1cIm51bWJlclwiKSl7JyArIHNvdXJjZSArICd9JyA6XG4gICAgICAgICAgICAgICAgJ2lmKGU9PT1kLmFjdGl2ZUVsZW1lbnQmJihlLnR5cGV8fGUuaHJlZikpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBDU1MyIHNlbGVjdGVkIHBzZXVkby1jbGFzc2VzLCBub3QgcGFydCBvZiBjdXJyZW50IENTUzMgZHJhZnRzXG4gICAgICAgICAgICAvLyB0aGUgJ3NlbGVjdGVkJyBwcm9wZXJ0eSBpcyBvbmx5IGF2YWlsYWJsZSBmb3Igb3B0aW9uIGVsZW1lbnRzXG4gICAgICAgICAgICBjYXNlICdzZWxlY3RlZCc6XG4gICAgICAgICAgICAgIC8vIGZpeCBTYWZhcmkgc2VsZWN0ZWRJbmRleCBwcm9wZXJ0eSBidWdcbiAgICAgICAgICAgICAgZXhwciA9IEJVR0dZX1NFTEVDVEVEID8gJ3x8KG49ZS5wYXJlbnROb2RlKSYmbi5vcHRpb25zW24uc2VsZWN0ZWRJbmRleF09PT1lJyA6ICcnO1xuICAgICAgICAgICAgICBzb3VyY2UgPSAnaWYoL15vcHRpb24kL2kudGVzdChlLm5vZGVOYW1lKSYmKGUuc2VsZWN0ZWR8fGUuY2hlY2tlZCcgKyBleHByICsgJykpeycgKyBzb3VyY2UgKyAnfSc7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGVsc2Uge1xuXG4gICAgICAgICAgLy8gdGhpcyBpcyB3aGVyZSBleHRlcm5hbCBleHRlbnNpb25zIGFyZVxuICAgICAgICAgIC8vIGludm9rZWQgaWYgZXhwcmVzc2lvbnMgbWF0Y2ggc2VsZWN0b3JzXG4gICAgICAgICAgZXhwciA9IGZhbHNlO1xuICAgICAgICAgIHN0YXR1cyA9IGZhbHNlO1xuICAgICAgICAgIGZvciAoZXhwciBpbiBTZWxlY3RvcnMpIHtcbiAgICAgICAgICAgIGlmICgobWF0Y2ggPSBzZWxlY3Rvci5tYXRjaChTZWxlY3RvcnNbZXhwcl0uRXhwcmVzc2lvbikpICYmIG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgIHJlc3VsdCA9IFNlbGVjdG9yc1tleHByXS5DYWxsYmFjayhtYXRjaCwgc291cmNlKTtcbiAgICAgICAgICAgICAgc291cmNlID0gcmVzdWx0LnNvdXJjZTtcbiAgICAgICAgICAgICAgc3RhdHVzID0gcmVzdWx0LnN0YXR1cztcbiAgICAgICAgICAgICAgaWYgKHN0YXR1cykgeyBicmVhazsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGlmIGFuIGV4dGVuc2lvbiBmYWlscyB0byBwYXJzZSB0aGUgc2VsZWN0b3JcbiAgICAgICAgICAvLyBpdCBtdXN0IHJldHVybiBhIGZhbHNlIGJvb2xlYW4gaW4gXCJzdGF0dXNcIlxuICAgICAgICAgIGlmICghc3RhdHVzKSB7XG4gICAgICAgICAgICAvLyBsb2cgZXJyb3IgYnV0IGNvbnRpbnVlIGV4ZWN1dGlvbiwgZG9uJ3QgdGhyb3cgcmVhbCBleGNlcHRpb25zXG4gICAgICAgICAgICAvLyBiZWNhdXNlIGJsb2NraW5nIGZvbGxvd2luZyBwcm9jZXNzZXMgbWF5YmUgaXMgbm90IGEgZ29vZCBpZGVhXG4gICAgICAgICAgICBlbWl0KCdVbmtub3duIHBzZXVkby1jbGFzcyBzZWxlY3RvciBcIicgKyBzZWxlY3RvciArICdcIicpO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghZXhwcikge1xuICAgICAgICAgICAgLy8gc2VlIGFib3ZlLCBsb2cgZXJyb3IgYnV0IGNvbnRpbnVlIGV4ZWN1dGlvblxuICAgICAgICAgICAgZW1pdCgnVW5rbm93biB0b2tlbiBpbiBzZWxlY3RvciBcIicgKyBzZWxlY3RvciArICdcIicpO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXJyb3IgaWYgbm8gbWF0Y2hlcyBmb3VuZCBieSB0aGUgcGF0dGVybiBzY2FuXG4gICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICBlbWl0KCdJbnZhbGlkIHN5bnRheCBpbiBzZWxlY3RvciBcIicgKyBzZWxlY3RvciArICdcIicpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuc3VyZSBcIm1hdGNoXCIgaXMgbm90IG51bGwgb3IgZW1wdHkgc2luY2VcbiAgICAgICAgLy8gd2UgZG8gbm90IHRocm93IHJlYWwgRE9NRXhjZXB0aW9ucyBhYm92ZVxuICAgICAgICBzZWxlY3RvciA9IG1hdGNoICYmIG1hdGNoW21hdGNoLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc291cmNlO1xuICAgIH0sXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBRVUVSWSBNRVRIT0RTIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gbWF0Y2ggZWxlbWVudCB3aXRoIHNlbGVjdG9yXG4gIC8vIEByZXR1cm4gYm9vbGVhblxuICBtYXRjaCA9XG4gICAgZnVuY3Rpb24oZWxlbWVudCwgc2VsZWN0b3IsIGZyb20sIGNhbGxiYWNrKSB7XG5cbiAgICAgIHZhciBwYXJ0cztcblxuICAgICAgaWYgKCEoZWxlbWVudCAmJiBlbGVtZW50Lm5vZGVUeXBlID09IDEpKSB7XG4gICAgICAgIGVtaXQoJ0ludmFsaWQgZWxlbWVudCBhcmd1bWVudCcpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxlY3RvciAhPSAnc3RyaW5nJykge1xuICAgICAgICBlbWl0KCdJbnZhbGlkIHNlbGVjdG9yIGFyZ3VtZW50Jyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoZnJvbSAmJiBmcm9tLm5vZGVUeXBlID09IDEgJiYgIWNvbnRhaW5zKGZyb20sIGVsZW1lbnQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdENvbnRleHQgIT09IGZyb20pIHtcbiAgICAgICAgLy8gcmVzZXQgY29udGV4dCBkYXRhIHdoZW4gaXQgY2hhbmdlc1xuICAgICAgICAvLyBhbmQgZW5zdXJlIGNvbnRleHQgaXMgc2V0IHRvIGEgZGVmYXVsdFxuICAgICAgICBzd2l0Y2hDb250ZXh0KGZyb20gfHwgKGZyb20gPSBlbGVtZW50Lm93bmVyRG9jdW1lbnQpKTtcbiAgICAgIH1cblxuICAgICAgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKHJlVHJpbVNwYWNlcywgJycpO1xuXG4gICAgICBDb25maWcuU0hPUlRDVVRTICYmIChzZWxlY3RvciA9IERvbS5zaG9ydGN1dHMoc2VsZWN0b3IsIGVsZW1lbnQsIGZyb20pKTtcblxuICAgICAgaWYgKGxhc3RNYXRjaGVyICE9IHNlbGVjdG9yKSB7XG4gICAgICAgIC8vIHByb2Nlc3MgdmFsaWQgc2VsZWN0b3Igc3RyaW5nc1xuICAgICAgICBpZiAoKHBhcnRzID0gc2VsZWN0b3IubWF0Y2gocmVWYWxpZGF0b3IpKSAmJiBwYXJ0c1swXSA9PSBzZWxlY3Rvcikge1xuICAgICAgICAgIGlzU2luZ2xlTWF0Y2ggPSAocGFydHMgPSBzZWxlY3Rvci5tYXRjaChyZVNwbGl0R3JvdXApKS5sZW5ndGggPCAyO1xuICAgICAgICAgIC8vIHNhdmUgcGFzc2VkIHNlbGVjdG9yXG4gICAgICAgICAgbGFzdE1hdGNoZXIgPSBzZWxlY3RvcjtcbiAgICAgICAgICBsYXN0UGFydHNNYXRjaCA9IHBhcnRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVtaXQoJ1RoZSBzdHJpbmcgXCInICsgc2VsZWN0b3IgKyAnXCIsIGlzIG5vdCBhIHZhbGlkIENTUyBzZWxlY3RvcicpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHBhcnRzID0gbGFzdFBhcnRzTWF0Y2g7XG5cbiAgICAgIC8vIGNvbXBpbGUgbWF0Y2hlciByZXNvbHZlcnMgaWYgbmVjZXNzYXJ5XG4gICAgICBpZiAoIW1hdGNoUmVzb2x2ZXJzW3NlbGVjdG9yXSB8fCBtYXRjaENvbnRleHRzW3NlbGVjdG9yXSAhPT0gZnJvbSkge1xuICAgICAgICBtYXRjaFJlc29sdmVyc1tzZWxlY3Rvcl0gPSBjb21waWxlKGlzU2luZ2xlTWF0Y2ggPyBbc2VsZWN0b3JdIDogcGFydHMsICcnLCBmYWxzZSk7XG4gICAgICAgIG1hdGNoQ29udGV4dHNbc2VsZWN0b3JdID0gZnJvbTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1hdGNoUmVzb2x2ZXJzW3NlbGVjdG9yXShlbGVtZW50LCBTbmFwc2hvdCwgWyBdLCBkb2MsIHJvb3QsIGZyb20sIGNhbGxiYWNrLCBuZXcgZ2xvYmFsLk9iamVjdCgpKTtcbiAgICB9LFxuXG4gIC8vIHNlbGVjdCBvbmx5IHRoZSBmaXJzdCBlbGVtZW50XG4gIC8vIG1hdGNoaW5nIHNlbGVjdG9yIChkb2N1bWVudCBvcmRlcmVkKVxuICBmaXJzdCA9XG4gICAgZnVuY3Rpb24oc2VsZWN0b3IsIGZyb20pIHtcbiAgICAgIHJldHVybiBzZWxlY3Qoc2VsZWN0b3IsIGZyb20sIGZ1bmN0aW9uKCkgeyByZXR1cm4gZmFsc2U7IH0pWzBdIHx8IG51bGw7XG4gICAgfSxcblxuICAvLyBzZWxlY3QgZWxlbWVudHMgbWF0Y2hpbmcgc2VsZWN0b3JcbiAgLy8gdXNpbmcgbmV3IFF1ZXJ5IFNlbGVjdG9yIEFQSVxuICAvLyBvciBjcm9zcy1icm93c2VyIGNsaWVudCBBUElcbiAgLy8gQHJldHVybiBhcnJheVxuICBzZWxlY3QgPVxuICAgIGZ1bmN0aW9uKHNlbGVjdG9yLCBmcm9tLCBjYWxsYmFjaykge1xuXG4gICAgICB2YXIgaSwgY2hhbmdlZCwgZWxlbWVudCwgZWxlbWVudHMsIHBhcnRzLCB0b2tlbiwgb3JpZ2luYWwgPSBzZWxlY3RvcjtcblxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZW1pdCgnTm90IGVub3VnaCBhcmd1bWVudHMnKTtcbiAgICAgICAgcmV0dXJuIFsgXTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGVjdG9yICE9ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBbIF07XG4gICAgICB9IGVsc2UgaWYgKGZyb20gJiYgISgvMXw5fDExLykudGVzdChmcm9tLm5vZGVUeXBlKSkge1xuICAgICAgICBlbWl0KCdJbnZhbGlkIG9yIGlsbGVnYWwgY29udGV4dCBlbGVtZW50Jyk7XG4gICAgICAgIHJldHVybiBbIF07XG4gICAgICB9IGVsc2UgaWYgKGxhc3RDb250ZXh0ICE9PSBmcm9tKSB7XG4gICAgICAgIC8vIHJlc2V0IGNvbnRleHQgZGF0YSB3aGVuIGl0IGNoYW5nZXNcbiAgICAgICAgLy8gYW5kIGVuc3VyZSBjb250ZXh0IGlzIHNldCB0byBhIGRlZmF1bHRcbiAgICAgICAgc3dpdGNoQ29udGV4dChmcm9tIHx8IChmcm9tID0gZG9jKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChDb25maWcuQ0FDSElORyAmJiAoZWxlbWVudHMgPSBEb20ubG9hZFJlc3VsdHMob3JpZ2luYWwsIGZyb20sIGRvYywgcm9vdCkpKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayA/IGNvbmNhdENhbGwoWyBdLCBlbGVtZW50cywgY2FsbGJhY2spIDogZWxlbWVudHM7XG4gICAgICB9XG5cbiAgICAgIGlmICghT1BFUkFfUVNBUEkgJiYgUkVfU0lNUExFX1NFTEVDVE9SLnRlc3Qoc2VsZWN0b3IpKSB7XG4gICAgICAgIHN3aXRjaCAoc2VsZWN0b3IuY2hhckF0KDApKSB7XG4gICAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgICAgICBpZiAoQ29uZmlnLlVOSVFVRV9JRCkge1xuICAgICAgICAgICAgICBlbGVtZW50cyA9IChlbGVtZW50ID0gX2J5SWQoc2VsZWN0b3Iuc2xpY2UoMSksIGZyb20pKSA/IFsgZWxlbWVudCBdIDogWyBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnLic6XG4gICAgICAgICAgICBlbGVtZW50cyA9IF9ieUNsYXNzKHNlbGVjdG9yLnNsaWNlKDEpLCBmcm9tKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBlbGVtZW50cyA9IF9ieVRhZyhzZWxlY3RvciwgZnJvbSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlbHNlIGlmICghWE1MX0RPQ1VNRU5UICYmIENvbmZpZy5VU0VfUVNBUEkgJiZcbiAgICAgICAgIShCVUdHWV9RVUlSS1NfUVNBUEkgJiYgUkVfQ0xBU1MudGVzdChzZWxlY3RvcikpICYmXG4gICAgICAgICFSRV9CVUdHWV9RU0FQSS50ZXN0KHNlbGVjdG9yKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGVsZW1lbnRzID0gZnJvbS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgICAgfSBjYXRjaChlKSB7IH1cbiAgICAgIH1cblxuICAgICAgaWYgKGVsZW1lbnRzKSB7XG4gICAgICAgIGVsZW1lbnRzID0gY2FsbGJhY2sgPyBjb25jYXRDYWxsKFsgXSwgZWxlbWVudHMsIGNhbGxiYWNrKSA6XG4gICAgICAgICAgTkFUSVZFX1NMSUNFX1BST1RPID8gc2xpY2UuY2FsbChlbGVtZW50cykgOiBjb25jYXRMaXN0KFsgXSwgZWxlbWVudHMpO1xuICAgICAgICBDb25maWcuQ0FDSElORyAmJiBEb20uc2F2ZVJlc3VsdHMob3JpZ2luYWwsIGZyb20sIGRvYywgZWxlbWVudHMpO1xuICAgICAgICByZXR1cm4gZWxlbWVudHM7XG4gICAgICB9XG5cbiAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IucmVwbGFjZShyZVRyaW1TcGFjZXMsICcnKTtcblxuICAgICAgQ29uZmlnLlNIT1JUQ1VUUyAmJiAoc2VsZWN0b3IgPSBEb20uc2hvcnRjdXRzKHNlbGVjdG9yLCBmcm9tKSk7XG5cbiAgICAgIGlmICgoY2hhbmdlZCA9IGxhc3RTZWxlY3RvciAhPSBzZWxlY3RvcikpIHtcbiAgICAgICAgLy8gcHJvY2VzcyB2YWxpZCBzZWxlY3RvciBzdHJpbmdzXG4gICAgICAgIGlmICgocGFydHMgPSBzZWxlY3Rvci5tYXRjaChyZVZhbGlkYXRvcikpICYmIHBhcnRzWzBdID09IHNlbGVjdG9yKSB7XG4gICAgICAgICAgaXNTaW5nbGVTZWxlY3QgPSAocGFydHMgPSBzZWxlY3Rvci5tYXRjaChyZVNwbGl0R3JvdXApKS5sZW5ndGggPCAyO1xuICAgICAgICAgIC8vIHNhdmUgcGFzc2VkIHNlbGVjdG9yXG4gICAgICAgICAgbGFzdFNlbGVjdG9yID0gc2VsZWN0b3I7XG4gICAgICAgICAgbGFzdFBhcnRzU2VsZWN0ID0gcGFydHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW1pdCgnVGhlIHN0cmluZyBcIicgKyBzZWxlY3RvciArICdcIiwgaXMgbm90IGEgdmFsaWQgQ1NTIHNlbGVjdG9yJyk7XG4gICAgICAgICAgcmV0dXJuIFsgXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHBhcnRzID0gbGFzdFBhcnRzU2VsZWN0O1xuXG4gICAgICAvLyBjb21tYXMgc2VwYXJhdG9ycyBhcmUgdHJlYXRlZCBzZXF1ZW50aWFsbHkgdG8gbWFpbnRhaW4gb3JkZXJcbiAgICAgIGlmIChmcm9tLm5vZGVUeXBlID09IDExKSB7XG5cbiAgICAgICAgZWxlbWVudHMgPSBieVRhZ1JhdygnKicsIGZyb20pO1xuXG4gICAgICB9IGVsc2UgaWYgKCFYTUxfRE9DVU1FTlQgJiYgaXNTaW5nbGVTZWxlY3QpIHtcblxuICAgICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICAgIC8vIGdldCByaWdodCBtb3N0IHNlbGVjdG9yIHRva2VuXG4gICAgICAgICAgcGFydHMgPSBzZWxlY3Rvci5tYXRjaChyZVNwbGl0VG9rZW4pO1xuICAgICAgICAgIHRva2VuID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV07XG5cbiAgICAgICAgICAvLyBvbmx5IGxhc3Qgc2xpY2UgYmVmb3JlIDpub3QgcnVsZXNcbiAgICAgICAgICBsYXN0U2xpY2UgPSB0b2tlbi5zcGxpdCgnOm5vdCcpWzBdO1xuXG4gICAgICAgICAgLy8gcG9zaXRpb24gd2hlcmUgdG9rZW4gd2FzIGZvdW5kXG4gICAgICAgICAgbGFzdFBvc2l0aW9uID0gc2VsZWN0b3IubGVuZ3RoIC0gdG9rZW4ubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSUQgb3B0aW1pemF0aW9uIFJUTCwgdG8gcmVkdWNlIG51bWJlciBvZiBlbGVtZW50cyB0byB2aXNpdFxuICAgICAgICBpZiAoQ29uZmlnLlVOSVFVRV9JRCAmJiAocGFydHMgPSBsYXN0U2xpY2UubWF0Y2goT3B0aW1pemUuSUQpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnQgPSBfYnlJZCh0b2tlbiwgZnJvbSkpKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2goZWxlbWVudCwgc2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKGVsZW1lbnQpO1xuICAgICAgICAgICAgICBlbGVtZW50cyA9IG5ldyBnbG9iYWwuQXJyYXkoZWxlbWVudCk7XG4gICAgICAgICAgICB9IGVsc2UgZWxlbWVudHMgPSBuZXcgZ2xvYmFsLkFycmF5KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSUQgb3B0aW1pemF0aW9uIExUUiwgdG8gcmVkdWNlIHNlbGVjdGlvbiBjb250ZXh0IHNlYXJjaGVzXG4gICAgICAgIGVsc2UgaWYgKENvbmZpZy5VTklRVUVfSUQgJiYgKHBhcnRzID0gc2VsZWN0b3IubWF0Y2goT3B0aW1pemUuSUQpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnQgPSBfYnlJZCh0b2tlbiwgZG9jKSkpIHtcbiAgICAgICAgICAgIGlmICgnIycgKyB0b2tlbiA9PSBzZWxlY3Rvcikge1xuICAgICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlbGVtZW50KTtcbiAgICAgICAgICAgICAgZWxlbWVudHMgPSBuZXcgZ2xvYmFsLkFycmF5KGVsZW1lbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgvWz4rfl0vLnRlc3Qoc2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgIGZyb20gPSBlbGVtZW50LnBhcmVudE5vZGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmcm9tID0gZWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgZWxlbWVudHMgPSBuZXcgZ2xvYmFsLkFycmF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZWxlbWVudHMpIHtcbiAgICAgICAgICBDb25maWcuQ0FDSElORyAmJiBEb20uc2F2ZVJlc3VsdHMob3JpZ2luYWwsIGZyb20sIGRvYywgZWxlbWVudHMpO1xuICAgICAgICAgIHJldHVybiBlbGVtZW50cztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghTkFUSVZFX0dFQkNOICYmIChwYXJ0cyA9IGxhc3RTbGljZS5tYXRjaChPcHRpbWl6ZS5UQUcpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnRzID0gX2J5VGFnKHRva2VuLCBmcm9tKSkubGVuZ3RoID09PSAwKSB7IHJldHVybiBbIF07IH1cbiAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UodG9rZW4sICcqJyk7XG4gICAgICAgIH1cblxuICAgICAgICBlbHNlIGlmICgocGFydHMgPSBsYXN0U2xpY2UubWF0Y2goT3B0aW1pemUuQ0xBU1MpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnRzID0gX2J5Q2xhc3ModG9rZW4sIGZyb20pKS5sZW5ndGggPT09IDApIHsgcmV0dXJuIFsgXTsgfVxuICAgICAgICAgIGlmIChyZU9wdGltaXplU2VsZWN0b3IudGVzdChzZWxlY3Rvci5jaGFyQXQoc2VsZWN0b3IuaW5kZXhPZih0b2tlbikgLSAxKSkpIHtcbiAgICAgICAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3Iuc2xpY2UoMCwgbGFzdFBvc2l0aW9uKSArIHNlbGVjdG9yLnNsaWNlKGxhc3RQb3NpdGlvbikucmVwbGFjZSgnLicgKyB0b2tlbiwgJycpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UoJy4nICsgdG9rZW4sICcqJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSBpZiAoKHBhcnRzID0gc2VsZWN0b3IubWF0Y2goT3B0aW1pemUuQ0xBU1MpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnRzID0gX2J5Q2xhc3ModG9rZW4sIGZyb20pKS5sZW5ndGggPT09IDApIHsgcmV0dXJuIFsgXTsgfVxuICAgICAgICAgIGZvciAoaSA9IDAsIGVscyA9IG5ldyBnbG9iYWwuQXJyYXkoKTsgZWxlbWVudHMubGVuZ3RoID4gaTsgKytpKSB7XG4gICAgICAgICAgICBlbHMgPSBjb25jYXRMaXN0KGVscywgZWxlbWVudHNbaV0uZ2V0RWxlbWVudHNCeVRhZ05hbWUoJyonKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsZW1lbnRzID0gZWxzO1xuICAgICAgICAgIGlmIChyZU9wdGltaXplU2VsZWN0b3IudGVzdChzZWxlY3Rvci5jaGFyQXQoc2VsZWN0b3IuaW5kZXhPZih0b2tlbikgLSAxKSkpIHtcbiAgICAgICAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3Iuc2xpY2UoMCwgbGFzdFBvc2l0aW9uKSArIHNlbGVjdG9yLnNsaWNlKGxhc3RQb3NpdGlvbikucmVwbGFjZSgnLicgKyB0b2tlbiwgJycpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UoJy4nICsgdG9rZW4sICcqJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZWxzZSBpZiAoTkFUSVZFX0dFQkNOICYmIChwYXJ0cyA9IGxhc3RTbGljZS5tYXRjaChPcHRpbWl6ZS5UQUcpKSAmJiAodG9rZW4gPSBwYXJ0c1sxXSkpIHtcbiAgICAgICAgICBpZiAoKGVsZW1lbnRzID0gX2J5VGFnKHRva2VuLCBmcm9tKSkubGVuZ3RoID09PSAwKSB7IHJldHVybiBbIF07IH1cbiAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yLnNsaWNlKDAsIGxhc3RQb3NpdGlvbikgKyBzZWxlY3Rvci5zbGljZShsYXN0UG9zaXRpb24pLnJlcGxhY2UodG9rZW4sICcqJyk7XG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnRzKSB7XG4gICAgICAgIGVsZW1lbnRzID0gL14oPzphcHBsZXR8b2JqZWN0KSQvaS50ZXN0KGZyb20ubm9kZU5hbWUpID8gZnJvbS5jaGlsZE5vZGVzIDogX2J5VGFnKCcqJywgZnJvbSk7XG4gICAgICB9XG4gICAgICAvLyBlbmQgb2YgcHJlZmlsdGVyaW5nIHBhc3NcblxuICAgICAgLy8gY29tcGlsZSBzZWxlY3RvciByZXNvbHZlciBpZiBuZWNlc3NhcnlcbiAgICAgIGlmICghc2VsZWN0UmVzb2x2ZXJzW3NlbGVjdG9yXSB8fCBzZWxlY3RDb250ZXh0c1tzZWxlY3Rvcl0gIT09IGZyb20pIHtcbiAgICAgICAgc2VsZWN0UmVzb2x2ZXJzW3NlbGVjdG9yXSA9IGNvbXBpbGUoaXNTaW5nbGVTZWxlY3QgPyBbc2VsZWN0b3JdIDogcGFydHMsICcnLCB0cnVlKTtcbiAgICAgICAgc2VsZWN0Q29udGV4dHNbc2VsZWN0b3JdID0gZnJvbTtcbiAgICAgIH1cblxuICAgICAgZWxlbWVudHMgPSBzZWxlY3RSZXNvbHZlcnNbc2VsZWN0b3JdKGVsZW1lbnRzLCBTbmFwc2hvdCwgWyBdLCBkb2MsIHJvb3QsIGZyb20sIGNhbGxiYWNrLCBuZXcgZ2xvYmFsLk9iamVjdCgpKTtcblxuICAgICAgQ29uZmlnLkNBQ0hJTkcgJiYgRG9tLnNhdmVSZXN1bHRzKG9yaWdpbmFsLCBmcm9tLCBkb2MsIGVsZW1lbnRzKTtcblxuICAgICAgcmV0dXJuIGVsZW1lbnRzO1xuICAgIH0sXG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBTVE9SQUdFIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gZW1wdHkgZnVuY3Rpb24gaGFuZGxlclxuICBGTiA9IGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHg7IH0sXG5cbiAgLy8gY29tcGlsZWQgbWF0Y2ggZnVuY3Rpb25zIHJldHVybmluZyBib29sZWFuc1xuICBtYXRjaENvbnRleHRzID0gbmV3IGdsb2JhbC5PYmplY3QoKSxcbiAgbWF0Y2hSZXNvbHZlcnMgPSBuZXcgZ2xvYmFsLk9iamVjdCgpLFxuXG4gIC8vIGNvbXBpbGVkIHNlbGVjdCBmdW5jdGlvbnMgcmV0dXJuaW5nIGNvbGxlY3Rpb25zXG4gIHNlbGVjdENvbnRleHRzID0gbmV3IGdsb2JhbC5PYmplY3QoKSxcbiAgc2VsZWN0UmVzb2x2ZXJzID0gbmV3IGdsb2JhbC5PYmplY3QoKSxcblxuICAvLyB1c2VkIHRvIHBhc3MgbWV0aG9kcyB0byBjb21waWxlZCBmdW5jdGlvbnNcbiAgU25hcHNob3QgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG5cbiAgICAvLyBlbGVtZW50IGluZGV4aW5nIG1ldGhvZHNcbiAgICBudGhFbGVtZW50OiBudGhFbGVtZW50LFxuICAgIG50aE9mVHlwZTogbnRoT2ZUeXBlLFxuXG4gICAgLy8gZWxlbWVudCBpbnNwZWN0aW9uIG1ldGhvZHNcbiAgICBnZXRBdHRyaWJ1dGU6IGdldEF0dHJpYnV0ZSxcbiAgICBoYXNBdHRyaWJ1dGU6IGhhc0F0dHJpYnV0ZSxcblxuICAgIC8vIGVsZW1lbnQgc2VsZWN0aW9uIG1ldGhvZHNcbiAgICBieUNsYXNzOiBfYnlDbGFzcyxcbiAgICBieU5hbWU6IGJ5TmFtZSxcbiAgICBieVRhZzogX2J5VGFnLFxuICAgIGJ5SWQ6IF9ieUlkLFxuXG4gICAgLy8gaGVscGVyL2NoZWNrIG1ldGhvZHNcbiAgICBjb250YWluczogY29udGFpbnMsXG4gICAgaXNFbXB0eTogaXNFbXB0eSxcbiAgICBpc0xpbms6IGlzTGluayxcblxuICAgIC8vIHNlbGVjdGlvbi9tYXRjaGluZ1xuICAgIHNlbGVjdDogc2VsZWN0LFxuICAgIG1hdGNoOiBtYXRjaFxuICB9KSxcblxuICBUb2tlbnMgPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgcHJlZml4ZXM6IHByZWZpeGVzLFxuICAgIGVuY29kaW5nOiBlbmNvZGluZyxcbiAgICBvcGVyYXRvcnM6IG9wZXJhdG9ycyxcbiAgICB3aGl0ZXNwYWNlOiB3aGl0ZXNwYWNlLFxuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIsXG4gICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcbiAgICBjb21iaW5hdG9yczogY29tYmluYXRvcnMsXG4gICAgcHNldWRvY2xhc3M6IHBzZXVkb2NsYXNzLFxuICAgIHBzZXVkb3Bhcm1zOiBwc2V1ZG9wYXJtcyxcbiAgICBxdW90ZWR2YWx1ZTogcXVvdGVkdmFsdWVcbiAgfSk7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFBVQkxJQyBBUEkgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLy8gY29kZSByZWZlcmVuY2VkIGJ5IGV4dGVuc2lvbnNcbiAgRG9tLkFDQ0VQVF9OT0RFID0gQUNDRVBUX05PREU7XG5cbiAgLy8gcmV0cmlldmUgZWxlbWVudCBieSBpZCBhdHRyXG4gIERvbS5ieUlkID0gYnlJZDtcblxuICAvLyByZXRyaWV2ZSBlbGVtZW50cyBieSB0YWcgbmFtZVxuICBEb20uYnlUYWcgPSBieVRhZztcblxuICAvLyByZXRyaWV2ZSBlbGVtZW50cyBieSBuYW1lIGF0dHJcbiAgRG9tLmJ5TmFtZSA9IGJ5TmFtZTtcblxuICAvLyByZXRyaWV2ZSBlbGVtZW50cyBieSBjbGFzcyBuYW1lXG4gIERvbS5ieUNsYXNzID0gYnlDbGFzcztcblxuICAvLyByZWFkIHRoZSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlXG4gIC8vIGFzIHdhcyBpbiB0aGUgb3JpZ2luYWwgSFRNTCBjb2RlXG4gIERvbS5nZXRBdHRyaWJ1dGUgPSBnZXRBdHRyaWJ1dGU7XG5cbiAgLy8gY2hlY2sgZm9yIHRoZSBhdHRyaWJ1dGUgcHJlc2VuY2VcbiAgLy8gYXMgd2FzIGluIHRoZSBvcmlnaW5hbCBIVE1MIGNvZGVcbiAgRG9tLmhhc0F0dHJpYnV0ZSA9IGhhc0F0dHJpYnV0ZTtcblxuICAvLyBlbGVtZW50IG1hdGNoIHNlbGVjdG9yLCByZXR1cm4gYm9vbGVhbiB0cnVlL2ZhbHNlXG4gIERvbS5tYXRjaCA9IG1hdGNoO1xuXG4gIC8vIGZpcnN0IGVsZW1lbnQgbWF0Y2ggb25seSwgcmV0dXJuIGVsZW1lbnQgb3IgbnVsbFxuICBEb20uZmlyc3QgPSBmaXJzdDtcblxuICAvLyBlbGVtZW50cyBtYXRjaGluZyBzZWxlY3Rvciwgc3RhcnRpbmcgZnJvbSBlbGVtZW50XG4gIERvbS5zZWxlY3QgPSBzZWxlY3Q7XG5cbiAgLy8gY29tcGlsZSBzZWxlY3RvciBpbnRvIGFkLWhvYyBqYXZhc2NyaXB0IHJlc29sdmVyXG4gIERvbS5jb21waWxlID0gY29tcGlsZTtcblxuICAvLyBjaGVjayB0aGF0IHR3byBlbGVtZW50cyBhcmUgYW5jZXN0b3IvZGVzY2VuZGFudFxuICBEb20uY29udGFpbnMgPSBjb250YWlucztcblxuICAvLyBoYW5kbGUgc2VsZWN0b3IgZW5naW5lIGNvbmZpZ3VyYXRpb24gc2V0dGluZ3NcbiAgRG9tLmNvbmZpZ3VyZSA9IGNvbmZpZ3VyZTtcblxuICAvLyBpbml0aWFsaXplIGNhY2hpbmcgZm9yIGVhY2ggZG9jdW1lbnRcbiAgRG9tLnNldENhY2hlID0gRk47XG5cbiAgLy8gbG9hZCBwcmV2aW91c2x5IGNvbGxlY3RlZCByZXN1bHQgc2V0XG4gIERvbS5sb2FkUmVzdWx0cyA9IEZOO1xuXG4gIC8vIHNhdmUgcHJldmlvdXNseSBjb2xsZWN0ZWQgcmVzdWx0IHNldFxuICBEb20uc2F2ZVJlc3VsdHMgPSBGTjtcblxuICAvLyBoYW5kbGUgbWlzc2luZyBjb250ZXh0IGluIHNlbGVjdG9yIHN0cmluZ3NcbiAgRG9tLnNob3J0Y3V0cyA9IEZOO1xuXG4gIC8vIGxvZyByZXNvbHZlcnMgZXJyb3JzL3dhcm5pbmdzXG4gIERvbS5lbWl0ID0gZW1pdDtcblxuICAvLyBvcHRpb25zIGVuYWJpbmcgc3BlY2lmaWMgZW5naW5lIGZ1bmN0aW9uYWxpdHlcbiAgRG9tLkNvbmZpZyA9IENvbmZpZztcblxuICAvLyBwYXNzIG1ldGhvZHMgcmVmZXJlbmNlcyB0byBjb21waWxlZCByZXNvbHZlcnNcbiAgRG9tLlNuYXBzaG90ID0gU25hcHNob3Q7XG5cbiAgLy8gb3BlcmF0b3JzIGRlc2NyaXB0b3JcbiAgLy8gZm9yIGF0dHJpYnV0ZSBvcGVyYXRvcnMgZXh0ZW5zaW9uc1xuICBEb20uT3BlcmF0b3JzID0gT3BlcmF0b3JzO1xuXG4gIC8vIHNlbGVjdG9ycyBkZXNjcmlwdG9yXG4gIC8vIGZvciBwc2V1ZG8tY2xhc3Mgc2VsZWN0b3JzIGV4dGVuc2lvbnNcbiAgRG9tLlNlbGVjdG9ycyA9IFNlbGVjdG9ycztcblxuICAvLyBleHBvcnQgc3RyaW5nIHBhdHRlcm5zXG4gIERvbS5Ub2tlbnMgPSBUb2tlbnM7XG5cbiAgLy8gZXhwb3J0IHZlcnNpb24gc3RyaW5nXG4gIERvbS5WZXJzaW9uID0gdmVyc2lvbjtcblxuICAvLyBhZGQgb3Igb3ZlcndyaXRlIHVzZXIgZGVmaW5lZCBvcGVyYXRvcnNcbiAgRG9tLnJlZ2lzdGVyT3BlcmF0b3IgPVxuICAgIGZ1bmN0aW9uKHN5bWJvbCwgcmVzb2x2ZXIpIHtcbiAgICAgIE9wZXJhdG9yc1tzeW1ib2xdIHx8IChPcGVyYXRvcnNbc3ltYm9sXSA9IHJlc29sdmVyKTtcbiAgICB9O1xuXG4gIC8vIGFkZCBzZWxlY3RvciBwYXR0ZXJucyBmb3IgdXNlciBkZWZpbmVkIGNhbGxiYWNrc1xuICBEb20ucmVnaXN0ZXJTZWxlY3RvciA9XG4gICAgZnVuY3Rpb24obmFtZSwgcmV4cCwgZnVuYykge1xuICAgICAgU2VsZWN0b3JzW25hbWVdIHx8IChTZWxlY3RvcnNbbmFtZV0gPSBuZXcgZ2xvYmFsLk9iamVjdCh7XG4gICAgICAgIEV4cHJlc3Npb246IHJleHAsXG4gICAgICAgIENhbGxiYWNrOiBmdW5jXG4gICAgICB9KSk7XG4gICAgfTtcblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gSU5JVCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvLyBpbml0IGNvbnRleHQgc3BlY2lmaWMgdmFyaWFibGVzXG4gIHN3aXRjaENvbnRleHQoZG9jLCB0cnVlKTtcblxufSk7XG4iLCJmdW5jdGlvbiBjb3VudChzZWxmLCBzdWJzdHIpIHtcbiAgdmFyIGNvdW50ID0gMFxuICB2YXIgcG9zID0gc2VsZi5pbmRleE9mKHN1YnN0cilcblxuICB3aGlsZSAocG9zID49IDApIHtcbiAgICBjb3VudCArPSAxXG4gICAgcG9zID0gc2VsZi5pbmRleE9mKHN1YnN0ciwgcG9zICsgMSlcbiAgfVxuXG4gIHJldHVybiBjb3VudFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvdW50IiwiZnVuY3Rpb24gc3BsaXRMZWZ0KHNlbGYsIHNlcCwgbWF4U3BsaXQsIGxpbWl0KSB7XG5cbiAgaWYgKHR5cGVvZiBtYXhTcGxpdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB2YXIgbWF4U3BsaXQgPSAtMTtcbiAgfVxuXG4gIHZhciBzcGxpdFJlc3VsdCA9IHNlbGYuc3BsaXQoc2VwKTtcbiAgdmFyIHNwbGl0UGFydDEgPSBzcGxpdFJlc3VsdC5zbGljZSgwLCBtYXhTcGxpdCk7XG4gIHZhciBzcGxpdFBhcnQyID0gc3BsaXRSZXN1bHQuc2xpY2UobWF4U3BsaXQpO1xuXG4gIGlmIChzcGxpdFBhcnQyLmxlbmd0aCA9PT0gMCkge1xuICAgIHNwbGl0UmVzdWx0ID0gc3BsaXRQYXJ0MTtcbiAgfSBlbHNlIHtcbiAgICBzcGxpdFJlc3VsdCA9IHNwbGl0UGFydDEuY29uY2F0KHNwbGl0UGFydDIuam9pbihzZXApKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgbGltaXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIHNwbGl0UmVzdWx0O1xuICB9IGVsc2UgaWYgKGxpbWl0IDwgMCkge1xuICAgIHJldHVybiBzcGxpdFJlc3VsdC5zbGljZShsaW1pdCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHNwbGl0UmVzdWx0LnNsaWNlKDAsIGxpbWl0KTtcbiAgfVxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3BsaXRMZWZ0O1xuIiwiZnVuY3Rpb24gc3BsaXRSaWdodChzZWxmLCBzZXAsIG1heFNwbGl0LCBsaW1pdCkge1xuXG4gIGlmICh0eXBlb2YgbWF4U3BsaXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIG1heFNwbGl0ID0gLTE7XG4gIH1cbiAgaWYgKHR5cGVvZiBsaW1pdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB2YXIgbGltaXQgPSAwO1xuICB9XG5cbiAgdmFyIHNwbGl0UmVzdWx0ID0gW3NlbGZdO1xuXG4gIGZvciAodmFyIGkgPSBzZWxmLmxlbmd0aC0xOyBpID49IDA7IGktLSkge1xuXG4gICAgaWYgKFxuICAgICAgc3BsaXRSZXN1bHRbMF0uc2xpY2UoaSkuaW5kZXhPZihzZXApID09PSAwICYmXG4gICAgICAoc3BsaXRSZXN1bHQubGVuZ3RoIDw9IG1heFNwbGl0IHx8IG1heFNwbGl0ID09PSAtMSlcbiAgICApIHtcbiAgICAgIHNwbGl0UmVzdWx0LnNwbGljZSgxLCAwLCBzcGxpdFJlc3VsdFswXS5zbGljZShpK3NlcC5sZW5ndGgpKTsgLy8gaW5zZXJ0XG4gICAgICBzcGxpdFJlc3VsdFswXSA9IHNwbGl0UmVzdWx0WzBdLnNsaWNlKDAsIGkpXG4gICAgfVxuICB9XG5cbiAgaWYgKGxpbWl0ID49IDApIHtcbiAgICByZXR1cm4gc3BsaXRSZXN1bHQuc2xpY2UoLWxpbWl0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3BsaXRSZXN1bHQuc2xpY2UoMCwgLWxpbWl0KTtcbiAgfVxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3BsaXRSaWdodDtcbiIsIi8qXG5zdHJpbmcuanMgLSBDb3B5cmlnaHQgKEMpIDIwMTItMjAxNCwgSlAgUmljaGFyZHNvbiA8anByaWNoYXJkc29uQGdtYWlsLmNvbT5cbiovXG5cbiEoZnVuY3Rpb24oKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBWRVJTSU9OID0gJzMuMy4xJztcblxuICB2YXIgRU5USVRJRVMgPSB7fTtcblxuICAvLyBmcm9tIGh0dHA6Ly9zZW1wbGljZXdlYnNpdGVzLmNvbS9yZW1vdmluZy1hY2NlbnRzLWphdmFzY3JpcHRcbiAgdmFyIGxhdGluX21hcD17XCLDgVwiOlwiQVwiLFwixIJcIjpcIkFcIixcIuG6rlwiOlwiQVwiLFwi4bq2XCI6XCJBXCIsXCLhurBcIjpcIkFcIixcIuG6slwiOlwiQVwiLFwi4bq0XCI6XCJBXCIsXCLHjVwiOlwiQVwiLFwiw4JcIjpcIkFcIixcIuG6pFwiOlwiQVwiLFwi4bqsXCI6XCJBXCIsXCLhuqZcIjpcIkFcIixcIuG6qFwiOlwiQVwiLFwi4bqqXCI6XCJBXCIsXCLDhFwiOlwiQVwiLFwix55cIjpcIkFcIixcIsimXCI6XCJBXCIsXCLHoFwiOlwiQVwiLFwi4bqgXCI6XCJBXCIsXCLIgFwiOlwiQVwiLFwiw4BcIjpcIkFcIixcIuG6olwiOlwiQVwiLFwiyIJcIjpcIkFcIixcIsSAXCI6XCJBXCIsXCLEhFwiOlwiQVwiLFwiw4VcIjpcIkFcIixcIse6XCI6XCJBXCIsXCLhuIBcIjpcIkFcIixcIsi6XCI6XCJBXCIsXCLDg1wiOlwiQVwiLFwi6pyyXCI6XCJBQVwiLFwiw4ZcIjpcIkFFXCIsXCLHvFwiOlwiQUVcIixcIseiXCI6XCJBRVwiLFwi6py0XCI6XCJBT1wiLFwi6py2XCI6XCJBVVwiLFwi6py4XCI6XCJBVlwiLFwi6py6XCI6XCJBVlwiLFwi6py8XCI6XCJBWVwiLFwi4biCXCI6XCJCXCIsXCLhuIRcIjpcIkJcIixcIsaBXCI6XCJCXCIsXCLhuIZcIjpcIkJcIixcIsmDXCI6XCJCXCIsXCLGglwiOlwiQlwiLFwixIZcIjpcIkNcIixcIsSMXCI6XCJDXCIsXCLDh1wiOlwiQ1wiLFwi4biIXCI6XCJDXCIsXCLEiFwiOlwiQ1wiLFwixIpcIjpcIkNcIixcIsaHXCI6XCJDXCIsXCLIu1wiOlwiQ1wiLFwixI5cIjpcIkRcIixcIuG4kFwiOlwiRFwiLFwi4biSXCI6XCJEXCIsXCLhuIpcIjpcIkRcIixcIuG4jFwiOlwiRFwiLFwixopcIjpcIkRcIixcIuG4jlwiOlwiRFwiLFwix7JcIjpcIkRcIixcIseFXCI6XCJEXCIsXCLEkFwiOlwiRFwiLFwixotcIjpcIkRcIixcIsexXCI6XCJEWlwiLFwix4RcIjpcIkRaXCIsXCLDiVwiOlwiRVwiLFwixJRcIjpcIkVcIixcIsSaXCI6XCJFXCIsXCLIqFwiOlwiRVwiLFwi4bicXCI6XCJFXCIsXCLDilwiOlwiRVwiLFwi4bq+XCI6XCJFXCIsXCLhu4ZcIjpcIkVcIixcIuG7gFwiOlwiRVwiLFwi4buCXCI6XCJFXCIsXCLhu4RcIjpcIkVcIixcIuG4mFwiOlwiRVwiLFwiw4tcIjpcIkVcIixcIsSWXCI6XCJFXCIsXCLhurhcIjpcIkVcIixcIsiEXCI6XCJFXCIsXCLDiFwiOlwiRVwiLFwi4bq6XCI6XCJFXCIsXCLIhlwiOlwiRVwiLFwixJJcIjpcIkVcIixcIuG4llwiOlwiRVwiLFwi4biUXCI6XCJFXCIsXCLEmFwiOlwiRVwiLFwiyYZcIjpcIkVcIixcIuG6vFwiOlwiRVwiLFwi4biaXCI6XCJFXCIsXCLqnapcIjpcIkVUXCIsXCLhuJ5cIjpcIkZcIixcIsaRXCI6XCJGXCIsXCLHtFwiOlwiR1wiLFwixJ5cIjpcIkdcIixcIsemXCI6XCJHXCIsXCLEolwiOlwiR1wiLFwixJxcIjpcIkdcIixcIsSgXCI6XCJHXCIsXCLGk1wiOlwiR1wiLFwi4bigXCI6XCJHXCIsXCLHpFwiOlwiR1wiLFwi4biqXCI6XCJIXCIsXCLInlwiOlwiSFwiLFwi4bioXCI6XCJIXCIsXCLEpFwiOlwiSFwiLFwi4rGnXCI6XCJIXCIsXCLhuKZcIjpcIkhcIixcIuG4olwiOlwiSFwiLFwi4bikXCI6XCJIXCIsXCLEplwiOlwiSFwiLFwiw41cIjpcIklcIixcIsSsXCI6XCJJXCIsXCLHj1wiOlwiSVwiLFwiw45cIjpcIklcIixcIsOPXCI6XCJJXCIsXCLhuK5cIjpcIklcIixcIsSwXCI6XCJJXCIsXCLhu4pcIjpcIklcIixcIsiIXCI6XCJJXCIsXCLDjFwiOlwiSVwiLFwi4buIXCI6XCJJXCIsXCLIilwiOlwiSVwiLFwixKpcIjpcIklcIixcIsSuXCI6XCJJXCIsXCLGl1wiOlwiSVwiLFwixKhcIjpcIklcIixcIuG4rFwiOlwiSVwiLFwi6p25XCI6XCJEXCIsXCLqnbtcIjpcIkZcIixcIuqdvVwiOlwiR1wiLFwi6p6CXCI6XCJSXCIsXCLqnoRcIjpcIlNcIixcIuqehlwiOlwiVFwiLFwi6p2sXCI6XCJJU1wiLFwixLRcIjpcIkpcIixcIsmIXCI6XCJKXCIsXCLhuLBcIjpcIktcIixcIseoXCI6XCJLXCIsXCLEtlwiOlwiS1wiLFwi4rGpXCI6XCJLXCIsXCLqnYJcIjpcIktcIixcIuG4slwiOlwiS1wiLFwixphcIjpcIktcIixcIuG4tFwiOlwiS1wiLFwi6p2AXCI6XCJLXCIsXCLqnYRcIjpcIktcIixcIsS5XCI6XCJMXCIsXCLIvVwiOlwiTFwiLFwixL1cIjpcIkxcIixcIsS7XCI6XCJMXCIsXCLhuLxcIjpcIkxcIixcIuG4tlwiOlwiTFwiLFwi4bi4XCI6XCJMXCIsXCLisaBcIjpcIkxcIixcIuqdiFwiOlwiTFwiLFwi4bi6XCI6XCJMXCIsXCLEv1wiOlwiTFwiLFwi4rGiXCI6XCJMXCIsXCLHiFwiOlwiTFwiLFwixYFcIjpcIkxcIixcIseHXCI6XCJMSlwiLFwi4bi+XCI6XCJNXCIsXCLhuYBcIjpcIk1cIixcIuG5glwiOlwiTVwiLFwi4rGuXCI6XCJNXCIsXCLFg1wiOlwiTlwiLFwixYdcIjpcIk5cIixcIsWFXCI6XCJOXCIsXCLhuYpcIjpcIk5cIixcIuG5hFwiOlwiTlwiLFwi4bmGXCI6XCJOXCIsXCLHuFwiOlwiTlwiLFwixp1cIjpcIk5cIixcIuG5iFwiOlwiTlwiLFwiyKBcIjpcIk5cIixcIseLXCI6XCJOXCIsXCLDkVwiOlwiTlwiLFwix4pcIjpcIk5KXCIsXCLDk1wiOlwiT1wiLFwixY5cIjpcIk9cIixcIseRXCI6XCJPXCIsXCLDlFwiOlwiT1wiLFwi4buQXCI6XCJPXCIsXCLhu5hcIjpcIk9cIixcIuG7klwiOlwiT1wiLFwi4buUXCI6XCJPXCIsXCLhu5ZcIjpcIk9cIixcIsOWXCI6XCJPXCIsXCLIqlwiOlwiT1wiLFwiyK5cIjpcIk9cIixcIsiwXCI6XCJPXCIsXCLhu4xcIjpcIk9cIixcIsWQXCI6XCJPXCIsXCLIjFwiOlwiT1wiLFwiw5JcIjpcIk9cIixcIuG7jlwiOlwiT1wiLFwixqBcIjpcIk9cIixcIuG7mlwiOlwiT1wiLFwi4buiXCI6XCJPXCIsXCLhu5xcIjpcIk9cIixcIuG7nlwiOlwiT1wiLFwi4bugXCI6XCJPXCIsXCLIjlwiOlwiT1wiLFwi6p2KXCI6XCJPXCIsXCLqnYxcIjpcIk9cIixcIsWMXCI6XCJPXCIsXCLhuZJcIjpcIk9cIixcIuG5kFwiOlwiT1wiLFwixp9cIjpcIk9cIixcIseqXCI6XCJPXCIsXCLHrFwiOlwiT1wiLFwiw5hcIjpcIk9cIixcIse+XCI6XCJPXCIsXCLDlVwiOlwiT1wiLFwi4bmMXCI6XCJPXCIsXCLhuY5cIjpcIk9cIixcIsisXCI6XCJPXCIsXCLGolwiOlwiT0lcIixcIuqdjlwiOlwiT09cIixcIsaQXCI6XCJFXCIsXCLGhlwiOlwiT1wiLFwiyKJcIjpcIk9VXCIsXCLhuZRcIjpcIlBcIixcIuG5llwiOlwiUFwiLFwi6p2SXCI6XCJQXCIsXCLGpFwiOlwiUFwiLFwi6p2UXCI6XCJQXCIsXCLisaNcIjpcIlBcIixcIuqdkFwiOlwiUFwiLFwi6p2YXCI6XCJRXCIsXCLqnZZcIjpcIlFcIixcIsWUXCI6XCJSXCIsXCLFmFwiOlwiUlwiLFwixZZcIjpcIlJcIixcIuG5mFwiOlwiUlwiLFwi4bmaXCI6XCJSXCIsXCLhuZxcIjpcIlJcIixcIsiQXCI6XCJSXCIsXCLIklwiOlwiUlwiLFwi4bmeXCI6XCJSXCIsXCLJjFwiOlwiUlwiLFwi4rGkXCI6XCJSXCIsXCLqnL5cIjpcIkNcIixcIsaOXCI6XCJFXCIsXCLFmlwiOlwiU1wiLFwi4bmkXCI6XCJTXCIsXCLFoFwiOlwiU1wiLFwi4bmmXCI6XCJTXCIsXCLFnlwiOlwiU1wiLFwixZxcIjpcIlNcIixcIsiYXCI6XCJTXCIsXCLhuaBcIjpcIlNcIixcIuG5olwiOlwiU1wiLFwi4bmoXCI6XCJTXCIsXCLhup5cIjpcIlNTXCIsXCLFpFwiOlwiVFwiLFwixaJcIjpcIlRcIixcIuG5sFwiOlwiVFwiLFwiyJpcIjpcIlRcIixcIsi+XCI6XCJUXCIsXCLhuapcIjpcIlRcIixcIuG5rFwiOlwiVFwiLFwixqxcIjpcIlRcIixcIuG5rlwiOlwiVFwiLFwixq5cIjpcIlRcIixcIsWmXCI6XCJUXCIsXCLisa9cIjpcIkFcIixcIuqegFwiOlwiTFwiLFwixpxcIjpcIk1cIixcIsmFXCI6XCJWXCIsXCLqnKhcIjpcIlRaXCIsXCLDmlwiOlwiVVwiLFwixaxcIjpcIlVcIixcIseTXCI6XCJVXCIsXCLDm1wiOlwiVVwiLFwi4bm2XCI6XCJVXCIsXCLDnFwiOlwiVVwiLFwix5dcIjpcIlVcIixcIseZXCI6XCJVXCIsXCLHm1wiOlwiVVwiLFwix5VcIjpcIlVcIixcIuG5slwiOlwiVVwiLFwi4bukXCI6XCJVXCIsXCLFsFwiOlwiVVwiLFwiyJRcIjpcIlVcIixcIsOZXCI6XCJVXCIsXCLhu6ZcIjpcIlVcIixcIsavXCI6XCJVXCIsXCLhu6hcIjpcIlVcIixcIuG7sFwiOlwiVVwiLFwi4buqXCI6XCJVXCIsXCLhu6xcIjpcIlVcIixcIuG7rlwiOlwiVVwiLFwiyJZcIjpcIlVcIixcIsWqXCI6XCJVXCIsXCLhubpcIjpcIlVcIixcIsWyXCI6XCJVXCIsXCLFrlwiOlwiVVwiLFwixahcIjpcIlVcIixcIuG5uFwiOlwiVVwiLFwi4bm0XCI6XCJVXCIsXCLqnZ5cIjpcIlZcIixcIuG5vlwiOlwiVlwiLFwixrJcIjpcIlZcIixcIuG5vFwiOlwiVlwiLFwi6p2gXCI6XCJWWVwiLFwi4bqCXCI6XCJXXCIsXCLFtFwiOlwiV1wiLFwi4bqEXCI6XCJXXCIsXCLhuoZcIjpcIldcIixcIuG6iFwiOlwiV1wiLFwi4bqAXCI6XCJXXCIsXCLisbJcIjpcIldcIixcIuG6jFwiOlwiWFwiLFwi4bqKXCI6XCJYXCIsXCLDnVwiOlwiWVwiLFwixbZcIjpcIllcIixcIsW4XCI6XCJZXCIsXCLhuo5cIjpcIllcIixcIuG7tFwiOlwiWVwiLFwi4buyXCI6XCJZXCIsXCLGs1wiOlwiWVwiLFwi4bu2XCI6XCJZXCIsXCLhu75cIjpcIllcIixcIsiyXCI6XCJZXCIsXCLJjlwiOlwiWVwiLFwi4bu4XCI6XCJZXCIsXCLFuVwiOlwiWlwiLFwixb1cIjpcIlpcIixcIuG6kFwiOlwiWlwiLFwi4rGrXCI6XCJaXCIsXCLFu1wiOlwiWlwiLFwi4bqSXCI6XCJaXCIsXCLIpFwiOlwiWlwiLFwi4bqUXCI6XCJaXCIsXCLGtVwiOlwiWlwiLFwixLJcIjpcIklKXCIsXCLFklwiOlwiT0VcIixcIuG0gFwiOlwiQVwiLFwi4bSBXCI6XCJBRVwiLFwiyplcIjpcIkJcIixcIuG0g1wiOlwiQlwiLFwi4bSEXCI6XCJDXCIsXCLhtIVcIjpcIkRcIixcIuG0h1wiOlwiRVwiLFwi6pywXCI6XCJGXCIsXCLJolwiOlwiR1wiLFwiyptcIjpcIkdcIixcIsqcXCI6XCJIXCIsXCLJqlwiOlwiSVwiLFwiyoFcIjpcIlJcIixcIuG0ilwiOlwiSlwiLFwi4bSLXCI6XCJLXCIsXCLKn1wiOlwiTFwiLFwi4bSMXCI6XCJMXCIsXCLhtI1cIjpcIk1cIixcIsm0XCI6XCJOXCIsXCLhtI9cIjpcIk9cIixcIsm2XCI6XCJPRVwiLFwi4bSQXCI6XCJPXCIsXCLhtJVcIjpcIk9VXCIsXCLhtJhcIjpcIlBcIixcIsqAXCI6XCJSXCIsXCLhtI5cIjpcIk5cIixcIuG0mVwiOlwiUlwiLFwi6pyxXCI6XCJTXCIsXCLhtJtcIjpcIlRcIixcIuKxu1wiOlwiRVwiLFwi4bSaXCI6XCJSXCIsXCLhtJxcIjpcIlVcIixcIuG0oFwiOlwiVlwiLFwi4bShXCI6XCJXXCIsXCLKj1wiOlwiWVwiLFwi4bSiXCI6XCJaXCIsXCLDoVwiOlwiYVwiLFwixINcIjpcImFcIixcIuG6r1wiOlwiYVwiLFwi4bq3XCI6XCJhXCIsXCLhurFcIjpcImFcIixcIuG6s1wiOlwiYVwiLFwi4bq1XCI6XCJhXCIsXCLHjlwiOlwiYVwiLFwiw6JcIjpcImFcIixcIuG6pVwiOlwiYVwiLFwi4bqtXCI6XCJhXCIsXCLhuqdcIjpcImFcIixcIuG6qVwiOlwiYVwiLFwi4bqrXCI6XCJhXCIsXCLDpFwiOlwiYVwiLFwix59cIjpcImFcIixcIsinXCI6XCJhXCIsXCLHoVwiOlwiYVwiLFwi4bqhXCI6XCJhXCIsXCLIgVwiOlwiYVwiLFwiw6BcIjpcImFcIixcIuG6o1wiOlwiYVwiLFwiyINcIjpcImFcIixcIsSBXCI6XCJhXCIsXCLEhVwiOlwiYVwiLFwi4baPXCI6XCJhXCIsXCLhuppcIjpcImFcIixcIsOlXCI6XCJhXCIsXCLHu1wiOlwiYVwiLFwi4biBXCI6XCJhXCIsXCLisaVcIjpcImFcIixcIsOjXCI6XCJhXCIsXCLqnLNcIjpcImFhXCIsXCLDplwiOlwiYWVcIixcIse9XCI6XCJhZVwiLFwix6NcIjpcImFlXCIsXCLqnLVcIjpcImFvXCIsXCLqnLdcIjpcImF1XCIsXCLqnLlcIjpcImF2XCIsXCLqnLtcIjpcImF2XCIsXCLqnL1cIjpcImF5XCIsXCLhuINcIjpcImJcIixcIuG4hVwiOlwiYlwiLFwiyZNcIjpcImJcIixcIuG4h1wiOlwiYlwiLFwi4bWsXCI6XCJiXCIsXCLhtoBcIjpcImJcIixcIsaAXCI6XCJiXCIsXCLGg1wiOlwiYlwiLFwiybVcIjpcIm9cIixcIsSHXCI6XCJjXCIsXCLEjVwiOlwiY1wiLFwiw6dcIjpcImNcIixcIuG4iVwiOlwiY1wiLFwixIlcIjpcImNcIixcIsmVXCI6XCJjXCIsXCLEi1wiOlwiY1wiLFwixohcIjpcImNcIixcIsi8XCI6XCJjXCIsXCLEj1wiOlwiZFwiLFwi4biRXCI6XCJkXCIsXCLhuJNcIjpcImRcIixcIsihXCI6XCJkXCIsXCLhuItcIjpcImRcIixcIuG4jVwiOlwiZFwiLFwiyZdcIjpcImRcIixcIuG2kVwiOlwiZFwiLFwi4biPXCI6XCJkXCIsXCLhta1cIjpcImRcIixcIuG2gVwiOlwiZFwiLFwixJFcIjpcImRcIixcIsmWXCI6XCJkXCIsXCLGjFwiOlwiZFwiLFwixLFcIjpcImlcIixcIsi3XCI6XCJqXCIsXCLJn1wiOlwialwiLFwiyoRcIjpcImpcIixcIsezXCI6XCJkelwiLFwix4ZcIjpcImR6XCIsXCLDqVwiOlwiZVwiLFwixJVcIjpcImVcIixcIsSbXCI6XCJlXCIsXCLIqVwiOlwiZVwiLFwi4bidXCI6XCJlXCIsXCLDqlwiOlwiZVwiLFwi4bq/XCI6XCJlXCIsXCLhu4dcIjpcImVcIixcIuG7gVwiOlwiZVwiLFwi4buDXCI6XCJlXCIsXCLhu4VcIjpcImVcIixcIuG4mVwiOlwiZVwiLFwiw6tcIjpcImVcIixcIsSXXCI6XCJlXCIsXCLhurlcIjpcImVcIixcIsiFXCI6XCJlXCIsXCLDqFwiOlwiZVwiLFwi4bq7XCI6XCJlXCIsXCLIh1wiOlwiZVwiLFwixJNcIjpcImVcIixcIuG4l1wiOlwiZVwiLFwi4biVXCI6XCJlXCIsXCLisbhcIjpcImVcIixcIsSZXCI6XCJlXCIsXCLhtpJcIjpcImVcIixcIsmHXCI6XCJlXCIsXCLhur1cIjpcImVcIixcIuG4m1wiOlwiZVwiLFwi6p2rXCI6XCJldFwiLFwi4bifXCI6XCJmXCIsXCLGklwiOlwiZlwiLFwi4bWuXCI6XCJmXCIsXCLhtoJcIjpcImZcIixcIse1XCI6XCJnXCIsXCLEn1wiOlwiZ1wiLFwix6dcIjpcImdcIixcIsSjXCI6XCJnXCIsXCLEnVwiOlwiZ1wiLFwixKFcIjpcImdcIixcIsmgXCI6XCJnXCIsXCLhuKFcIjpcImdcIixcIuG2g1wiOlwiZ1wiLFwix6VcIjpcImdcIixcIuG4q1wiOlwiaFwiLFwiyJ9cIjpcImhcIixcIuG4qVwiOlwiaFwiLFwixKVcIjpcImhcIixcIuKxqFwiOlwiaFwiLFwi4binXCI6XCJoXCIsXCLhuKNcIjpcImhcIixcIuG4pVwiOlwiaFwiLFwiyaZcIjpcImhcIixcIuG6llwiOlwiaFwiLFwixKdcIjpcImhcIixcIsaVXCI6XCJodlwiLFwiw61cIjpcImlcIixcIsStXCI6XCJpXCIsXCLHkFwiOlwiaVwiLFwiw65cIjpcImlcIixcIsOvXCI6XCJpXCIsXCLhuK9cIjpcImlcIixcIuG7i1wiOlwiaVwiLFwiyIlcIjpcImlcIixcIsOsXCI6XCJpXCIsXCLhu4lcIjpcImlcIixcIsiLXCI6XCJpXCIsXCLEq1wiOlwiaVwiLFwixK9cIjpcImlcIixcIuG2llwiOlwiaVwiLFwiyahcIjpcImlcIixcIsSpXCI6XCJpXCIsXCLhuK1cIjpcImlcIixcIuqdulwiOlwiZFwiLFwi6p28XCI6XCJmXCIsXCLhtblcIjpcImdcIixcIuqeg1wiOlwiclwiLFwi6p6FXCI6XCJzXCIsXCLqnodcIjpcInRcIixcIuqdrVwiOlwiaXNcIixcIsewXCI6XCJqXCIsXCLEtVwiOlwialwiLFwiyp1cIjpcImpcIixcIsmJXCI6XCJqXCIsXCLhuLFcIjpcImtcIixcIsepXCI6XCJrXCIsXCLEt1wiOlwia1wiLFwi4rGqXCI6XCJrXCIsXCLqnYNcIjpcImtcIixcIuG4s1wiOlwia1wiLFwixplcIjpcImtcIixcIuG4tVwiOlwia1wiLFwi4baEXCI6XCJrXCIsXCLqnYFcIjpcImtcIixcIuqdhVwiOlwia1wiLFwixLpcIjpcImxcIixcIsaaXCI6XCJsXCIsXCLJrFwiOlwibFwiLFwixL5cIjpcImxcIixcIsS8XCI6XCJsXCIsXCLhuL1cIjpcImxcIixcIsi0XCI6XCJsXCIsXCLhuLdcIjpcImxcIixcIuG4uVwiOlwibFwiLFwi4rGhXCI6XCJsXCIsXCLqnYlcIjpcImxcIixcIuG4u1wiOlwibFwiLFwixYBcIjpcImxcIixcIsmrXCI6XCJsXCIsXCLhtoVcIjpcImxcIixcIsmtXCI6XCJsXCIsXCLFglwiOlwibFwiLFwix4lcIjpcImxqXCIsXCLFv1wiOlwic1wiLFwi4bqcXCI6XCJzXCIsXCLhuptcIjpcInNcIixcIuG6nVwiOlwic1wiLFwi4bi/XCI6XCJtXCIsXCLhuYFcIjpcIm1cIixcIuG5g1wiOlwibVwiLFwiybFcIjpcIm1cIixcIuG1r1wiOlwibVwiLFwi4baGXCI6XCJtXCIsXCLFhFwiOlwiblwiLFwixYhcIjpcIm5cIixcIsWGXCI6XCJuXCIsXCLhuYtcIjpcIm5cIixcIsi1XCI6XCJuXCIsXCLhuYVcIjpcIm5cIixcIuG5h1wiOlwiblwiLFwix7lcIjpcIm5cIixcIsmyXCI6XCJuXCIsXCLhuYlcIjpcIm5cIixcIsaeXCI6XCJuXCIsXCLhtbBcIjpcIm5cIixcIuG2h1wiOlwiblwiLFwiybNcIjpcIm5cIixcIsOxXCI6XCJuXCIsXCLHjFwiOlwibmpcIixcIsOzXCI6XCJvXCIsXCLFj1wiOlwib1wiLFwix5JcIjpcIm9cIixcIsO0XCI6XCJvXCIsXCLhu5FcIjpcIm9cIixcIuG7mVwiOlwib1wiLFwi4buTXCI6XCJvXCIsXCLhu5VcIjpcIm9cIixcIuG7l1wiOlwib1wiLFwiw7ZcIjpcIm9cIixcIsirXCI6XCJvXCIsXCLIr1wiOlwib1wiLFwiyLFcIjpcIm9cIixcIuG7jVwiOlwib1wiLFwixZFcIjpcIm9cIixcIsiNXCI6XCJvXCIsXCLDslwiOlwib1wiLFwi4buPXCI6XCJvXCIsXCLGoVwiOlwib1wiLFwi4bubXCI6XCJvXCIsXCLhu6NcIjpcIm9cIixcIuG7nVwiOlwib1wiLFwi4bufXCI6XCJvXCIsXCLhu6FcIjpcIm9cIixcIsiPXCI6XCJvXCIsXCLqnYtcIjpcIm9cIixcIuqdjVwiOlwib1wiLFwi4rG6XCI6XCJvXCIsXCLFjVwiOlwib1wiLFwi4bmTXCI6XCJvXCIsXCLhuZFcIjpcIm9cIixcIserXCI6XCJvXCIsXCLHrVwiOlwib1wiLFwiw7hcIjpcIm9cIixcIse/XCI6XCJvXCIsXCLDtVwiOlwib1wiLFwi4bmNXCI6XCJvXCIsXCLhuY9cIjpcIm9cIixcIsitXCI6XCJvXCIsXCLGo1wiOlwib2lcIixcIuqdj1wiOlwib29cIixcIsmbXCI6XCJlXCIsXCLhtpNcIjpcImVcIixcIsmUXCI6XCJvXCIsXCLhtpdcIjpcIm9cIixcIsijXCI6XCJvdVwiLFwi4bmVXCI6XCJwXCIsXCLhuZdcIjpcInBcIixcIuqdk1wiOlwicFwiLFwixqVcIjpcInBcIixcIuG1sVwiOlwicFwiLFwi4baIXCI6XCJwXCIsXCLqnZVcIjpcInBcIixcIuG1vVwiOlwicFwiLFwi6p2RXCI6XCJwXCIsXCLqnZlcIjpcInFcIixcIsqgXCI6XCJxXCIsXCLJi1wiOlwicVwiLFwi6p2XXCI6XCJxXCIsXCLFlVwiOlwiclwiLFwixZlcIjpcInJcIixcIsWXXCI6XCJyXCIsXCLhuZlcIjpcInJcIixcIuG5m1wiOlwiclwiLFwi4bmdXCI6XCJyXCIsXCLIkVwiOlwiclwiLFwiyb5cIjpcInJcIixcIuG1s1wiOlwiclwiLFwiyJNcIjpcInJcIixcIuG5n1wiOlwiclwiLFwiybxcIjpcInJcIixcIuG1slwiOlwiclwiLFwi4baJXCI6XCJyXCIsXCLJjVwiOlwiclwiLFwiyb1cIjpcInJcIixcIuKGhFwiOlwiY1wiLFwi6py/XCI6XCJjXCIsXCLJmFwiOlwiZVwiLFwiyb9cIjpcInJcIixcIsWbXCI6XCJzXCIsXCLhuaVcIjpcInNcIixcIsWhXCI6XCJzXCIsXCLhuadcIjpcInNcIixcIsWfXCI6XCJzXCIsXCLFnVwiOlwic1wiLFwiyJlcIjpcInNcIixcIuG5oVwiOlwic1wiLFwi4bmjXCI6XCJzXCIsXCLhualcIjpcInNcIixcIsqCXCI6XCJzXCIsXCLhtbRcIjpcInNcIixcIuG2ilwiOlwic1wiLFwiyL9cIjpcInNcIixcIsmhXCI6XCJnXCIsXCLDn1wiOlwic3NcIixcIuG0kVwiOlwib1wiLFwi4bSTXCI6XCJvXCIsXCLhtJ1cIjpcInVcIixcIsWlXCI6XCJ0XCIsXCLFo1wiOlwidFwiLFwi4bmxXCI6XCJ0XCIsXCLIm1wiOlwidFwiLFwiyLZcIjpcInRcIixcIuG6l1wiOlwidFwiLFwi4rGmXCI6XCJ0XCIsXCLhuatcIjpcInRcIixcIuG5rVwiOlwidFwiLFwixq1cIjpcInRcIixcIuG5r1wiOlwidFwiLFwi4bW1XCI6XCJ0XCIsXCLGq1wiOlwidFwiLFwiyohcIjpcInRcIixcIsWnXCI6XCJ0XCIsXCLhtbpcIjpcInRoXCIsXCLJkFwiOlwiYVwiLFwi4bSCXCI6XCJhZVwiLFwix51cIjpcImVcIixcIuG1t1wiOlwiZ1wiLFwiyaVcIjpcImhcIixcIsquXCI6XCJoXCIsXCLKr1wiOlwiaFwiLFwi4bSJXCI6XCJpXCIsXCLKnlwiOlwia1wiLFwi6p6BXCI6XCJsXCIsXCLJr1wiOlwibVwiLFwiybBcIjpcIm1cIixcIuG0lFwiOlwib2VcIixcIsm5XCI6XCJyXCIsXCLJu1wiOlwiclwiLFwiybpcIjpcInJcIixcIuKxuVwiOlwiclwiLFwiyodcIjpcInRcIixcIsqMXCI6XCJ2XCIsXCLKjVwiOlwid1wiLFwiyo5cIjpcInlcIixcIuqcqVwiOlwidHpcIixcIsO6XCI6XCJ1XCIsXCLFrVwiOlwidVwiLFwix5RcIjpcInVcIixcIsO7XCI6XCJ1XCIsXCLhubdcIjpcInVcIixcIsO8XCI6XCJ1XCIsXCLHmFwiOlwidVwiLFwix5pcIjpcInVcIixcIsecXCI6XCJ1XCIsXCLHllwiOlwidVwiLFwi4bmzXCI6XCJ1XCIsXCLhu6VcIjpcInVcIixcIsWxXCI6XCJ1XCIsXCLIlVwiOlwidVwiLFwiw7lcIjpcInVcIixcIuG7p1wiOlwidVwiLFwixrBcIjpcInVcIixcIuG7qVwiOlwidVwiLFwi4buxXCI6XCJ1XCIsXCLhu6tcIjpcInVcIixcIuG7rVwiOlwidVwiLFwi4buvXCI6XCJ1XCIsXCLIl1wiOlwidVwiLFwixatcIjpcInVcIixcIuG5u1wiOlwidVwiLFwixbNcIjpcInVcIixcIuG2mVwiOlwidVwiLFwixa9cIjpcInVcIixcIsWpXCI6XCJ1XCIsXCLhublcIjpcInVcIixcIuG5tVwiOlwidVwiLFwi4bWrXCI6XCJ1ZVwiLFwi6p24XCI6XCJ1bVwiLFwi4rG0XCI6XCJ2XCIsXCLqnZ9cIjpcInZcIixcIuG5v1wiOlwidlwiLFwiyotcIjpcInZcIixcIuG2jFwiOlwidlwiLFwi4rGxXCI6XCJ2XCIsXCLhub1cIjpcInZcIixcIuqdoVwiOlwidnlcIixcIuG6g1wiOlwid1wiLFwixbVcIjpcIndcIixcIuG6hVwiOlwid1wiLFwi4bqHXCI6XCJ3XCIsXCLhuolcIjpcIndcIixcIuG6gVwiOlwid1wiLFwi4rGzXCI6XCJ3XCIsXCLhuphcIjpcIndcIixcIuG6jVwiOlwieFwiLFwi4bqLXCI6XCJ4XCIsXCLhto1cIjpcInhcIixcIsO9XCI6XCJ5XCIsXCLFt1wiOlwieVwiLFwiw79cIjpcInlcIixcIuG6j1wiOlwieVwiLFwi4bu1XCI6XCJ5XCIsXCLhu7NcIjpcInlcIixcIsa0XCI6XCJ5XCIsXCLhu7dcIjpcInlcIixcIuG7v1wiOlwieVwiLFwiyLNcIjpcInlcIixcIuG6mVwiOlwieVwiLFwiyY9cIjpcInlcIixcIuG7uVwiOlwieVwiLFwixbpcIjpcInpcIixcIsW+XCI6XCJ6XCIsXCLhupFcIjpcInpcIixcIsqRXCI6XCJ6XCIsXCLisaxcIjpcInpcIixcIsW8XCI6XCJ6XCIsXCLhupNcIjpcInpcIixcIsilXCI6XCJ6XCIsXCLhupVcIjpcInpcIixcIuG1tlwiOlwielwiLFwi4baOXCI6XCJ6XCIsXCLKkFwiOlwielwiLFwixrZcIjpcInpcIixcIsmAXCI6XCJ6XCIsXCLvrIBcIjpcImZmXCIsXCLvrINcIjpcImZmaVwiLFwi76yEXCI6XCJmZmxcIixcIu+sgVwiOlwiZmlcIixcIu+sglwiOlwiZmxcIixcIsSzXCI6XCJpalwiLFwixZNcIjpcIm9lXCIsXCLvrIZcIjpcInN0XCIsXCLigpBcIjpcImFcIixcIuKCkVwiOlwiZVwiLFwi4bWiXCI6XCJpXCIsXCLisbxcIjpcImpcIixcIuKCklwiOlwib1wiLFwi4bWjXCI6XCJyXCIsXCLhtaRcIjpcInVcIixcIuG1pVwiOlwidlwiLFwi4oKTXCI6XCJ4XCJ9O1xuXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuLy8gQWRkZWQgYW4gaW5pdGlhbGl6ZSBmdW5jdGlvbiB3aGljaCBpcyBlc3NlbnRpYWxseSB0aGUgY29kZSBmcm9tIHRoZSBTXG4vLyBjb25zdHJ1Y3Rvci4gIE5vdywgdGhlIFMgY29uc3RydWN0b3IgY2FsbHMgdGhpcyBhbmQgYSBuZXcgbWV0aG9kIG5hbWVkXG4vLyBzZXRWYWx1ZSBjYWxscyBpdCBhcyB3ZWxsLiAgVGhlIHNldFZhbHVlIGZ1bmN0aW9uIGFsbG93cyBjb25zdHJ1Y3RvcnMgZm9yXG4vLyBtb2R1bGVzIHRoYXQgZXh0ZW5kIHN0cmluZy5qcyB0byBzZXQgdGhlIGluaXRpYWwgdmFsdWUgb2YgYW4gb2JqZWN0IHdpdGhvdXRcbi8vIGtub3dpbmcgdGhlIGludGVybmFsIHdvcmtpbmdzIG9mIHN0cmluZy5qcy5cbi8vXG4vLyBBbHNvLCBhbGwgbWV0aG9kcyB3aGljaCByZXR1cm4gYSBuZXcgUyBvYmplY3Qgbm93IGNhbGw6XG4vL1xuLy8gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4vL1xuLy8gaW5zdGVhZCBvZjpcbi8vXG4vLyAgICAgIHJldHVybiBuZXcgUyhzKTtcbi8vXG4vLyBUaGlzIGFsbG93cyBleHRlbmRlZCBvYmplY3RzIHRvIGtlZXAgdGhlaXIgcHJvcGVyIGluc3RhbmNlT2YgYW5kIGNvbnN0cnVjdG9yLlxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblxuICBmdW5jdGlvbiBpbml0aWFsaXplIChvYmplY3QsIHMpIHtcbiAgICBpZiAocyAhPT0gbnVsbCAmJiBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgcyA9PT0gJ3N0cmluZycpXG4gICAgICAgIG9iamVjdC5zID0gcztcbiAgICAgIGVsc2VcbiAgICAgICAgb2JqZWN0LnMgPSBzLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9iamVjdC5zID0gczsgLy9udWxsIG9yIHVuZGVmaW5lZFxuICAgIH1cblxuICAgIG9iamVjdC5vcmlnID0gczsgLy9vcmlnaW5hbCBvYmplY3QsIGN1cnJlbnRseSBvbmx5IHVzZWQgYnkgdG9DU1YoKSBhbmQgdG9Cb29sZWFuKClcblxuICAgIGlmIChzICE9PSBudWxsICYmIHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKG9iamVjdC5fX2RlZmluZUdldHRlcl9fKSB7XG4gICAgICAgIG9iamVjdC5fX2RlZmluZUdldHRlcl9fKCdsZW5ndGgnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gb2JqZWN0LnMubGVuZ3RoO1xuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0Lmxlbmd0aCA9IHMubGVuZ3RoO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3QubGVuZ3RoID0gLTE7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gUyhzKSB7XG4gIFx0aW5pdGlhbGl6ZSh0aGlzLCBzKTtcbiAgfVxuXG4gIHZhciBfX25zcCA9IFN0cmluZy5wcm90b3R5cGU7XG4gIHZhciBfX3NwID0gUy5wcm90b3R5cGUgPSB7XG5cbiAgICBiZXR3ZWVuOiBmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICB2YXIgc3RhcnRQb3MgPSBzLmluZGV4T2YobGVmdCk7XG4gICAgICB2YXIgZW5kUG9zID0gcy5pbmRleE9mKHJpZ2h0LCBzdGFydFBvcyArIGxlZnQubGVuZ3RoKTtcbiAgICAgIGlmIChlbmRQb3MgPT0gLTEgJiYgcmlnaHQgIT0gbnVsbClcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKCcnKVxuICAgICAgZWxzZSBpZiAoZW5kUG9zID09IC0xICYmIHJpZ2h0ID09IG51bGwpXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzLnN1YnN0cmluZyhzdGFydFBvcyArIGxlZnQubGVuZ3RoKSlcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMuc2xpY2Uoc3RhcnRQb3MgKyBsZWZ0Lmxlbmd0aCwgZW5kUG9zKSk7XG4gICAgfSxcblxuICAgIC8vIyBtb2RpZmllZCBzbGlnaHRseSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9lcGVsaS91bmRlcnNjb3JlLnN0cmluZ1xuICAgIGNhbWVsaXplOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzID0gdGhpcy50cmltKCkucy5yZXBsYWNlKC8oXFwtfF98XFxzKSsoLik/L2csIGZ1bmN0aW9uKG1hdGhjLCBzZXAsIGMpIHtcbiAgICAgICAgcmV0dXJuIChjID8gYy50b1VwcGVyQ2FzZSgpIDogJycpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIGNhcGl0YWxpemU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucy5zdWJzdHIoMCwgMSkudG9VcHBlckNhc2UoKSArIHRoaXMucy5zdWJzdHJpbmcoMSkudG9Mb3dlckNhc2UoKSk7XG4gICAgfSxcblxuICAgIGNoYXJBdDogZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgIHJldHVybiB0aGlzLnMuY2hhckF0KGluZGV4KTtcbiAgICB9LFxuXG4gICAgY2hvbXBMZWZ0OiBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zO1xuICAgICAgaWYgKHMuaW5kZXhPZihwcmVmaXgpID09PSAwKSB7XG4gICAgICAgICBzID0gcy5zbGljZShwcmVmaXgubGVuZ3RoKTtcbiAgICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjaG9tcFJpZ2h0OiBmdW5jdGlvbihzdWZmaXgpIHtcbiAgICAgIGlmICh0aGlzLmVuZHNXaXRoKHN1ZmZpeCkpIHtcbiAgICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICAgIHMgPSBzLnNsaWNlKDAsIHMubGVuZ3RoIC0gc3VmZml4Lmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyN0aGFua3MgR29vZ2xlXG4gICAgY29sbGFwc2VXaGl0ZXNwYWNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zLnJlcGxhY2UoL1tcXHNcXHhhMF0rL2csICcgJykucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICBjb250YWluczogZnVuY3Rpb24oc3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnMuaW5kZXhPZihzcykgPj0gMDtcbiAgICB9LFxuXG4gICAgY291bnQ6IGZ1bmN0aW9uKHNzKSB7XG4gICAgICByZXR1cm4gcmVxdWlyZSgnLi9fY291bnQnKSh0aGlzLnMsIHNzKVxuICAgIH0sXG5cbiAgICAvLyNtb2RpZmllZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9lcGVsaS91bmRlcnNjb3JlLnN0cmluZ1xuICAgIGRhc2hlcml6ZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcyA9IHRoaXMudHJpbSgpLnMucmVwbGFjZSgvW19cXHNdKy9nLCAnLScpLnJlcGxhY2UoLyhbQS1aXSkvZywgJy0kMScpLnJlcGxhY2UoLy0rL2csICctJykudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgbGF0aW5pc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnJlcGxhY2UoL1teQS1aYS16MC05XFxbXFxdIF0vZywgZnVuY3Rpb24oeCkgeyByZXR1cm4gbGF0aW5fbWFwW3hdIHx8IHg7IH0pO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgIH0sXG5cbiAgICBkZWNvZGVIdG1sRW50aXRpZXM6IGZ1bmN0aW9uKCkgeyAvL2h0dHBzOi8vZ2l0aHViLmNvbS9zdWJzdGFjay9ub2RlLWVudC9ibG9iL21hc3Rlci9pbmRleC5qc1xuICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICBzID0gcy5yZXBsYWNlKC8mIyhcXGQrKTs/L2csIGZ1bmN0aW9uIChfLCBjb2RlKSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xuICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKC8mI1t4WF0oW0EtRmEtZjAtOV0rKTs/L2csIGZ1bmN0aW9uIChfLCBoZXgpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoaGV4LCAxNikpO1xuICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKC8mKFteO1xcV10rOz8pL2csIGZ1bmN0aW9uIChtLCBlKSB7XG4gICAgICAgIHZhciBlZSA9IGUucmVwbGFjZSgvOyQvLCAnJyk7XG4gICAgICAgIHZhciB0YXJnZXQgPSBFTlRJVElFU1tlXSB8fCAoZS5tYXRjaCgvOyQvKSAmJiBFTlRJVElFU1tlZV0pO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRhcmdldCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIGVuZHNXaXRoOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzdWZmaXhlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1ZmZpeGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBsICA9IHRoaXMucy5sZW5ndGggLSBzdWZmaXhlc1tpXS5sZW5ndGg7XG4gICAgICAgIGlmIChsID49IDAgJiYgdGhpcy5zLmluZGV4T2Yoc3VmZml4ZXNbaV0sIGwpID09PSBsKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgZXNjYXBlSFRNTDogZnVuY3Rpb24oKSB7IC8vZnJvbSB1bmRlcnNjb3JlLnN0cmluZ1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucy5yZXBsYWNlKC9bJjw+XCInXS9nLCBmdW5jdGlvbihtKXsgcmV0dXJuICcmJyArIHJldmVyc2VkRXNjYXBlQ2hhcnNbbV0gKyAnOyc7IH0pKTtcbiAgICB9LFxuXG4gICAgZW5zdXJlTGVmdDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICB2YXIgcyA9IHRoaXMucztcbiAgICAgIGlmIChzLmluZGV4T2YocHJlZml4KSA9PT0gMCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihwcmVmaXggKyBzKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZW5zdXJlUmlnaHQ6IGZ1bmN0aW9uKHN1ZmZpeCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICBpZiAodGhpcy5lbmRzV2l0aChzdWZmaXgpKSAge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzICsgc3VmZml4KTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgaHVtYW5pemU6IGZ1bmN0aW9uKCkgeyAvL21vZGlmaWVkIGZyb20gdW5kZXJzY29yZS5zdHJpbmdcbiAgICAgIGlmICh0aGlzLnMgPT09IG51bGwgfHwgdGhpcy5zID09PSB1bmRlZmluZWQpXG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcignJylcbiAgICAgIHZhciBzID0gdGhpcy51bmRlcnNjb3JlKCkucmVwbGFjZSgvX2lkJC8sJycpLnJlcGxhY2UoL18vZywgJyAnKS50cmltKCkuY2FwaXRhbGl6ZSgpXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IocylcbiAgICB9LFxuXG4gICAgaXNBbHBoYTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIS9bXmEtelxceERGLVxceEZGXXxeJC8udGVzdCh0aGlzLnMudG9Mb3dlckNhc2UoKSk7XG4gICAgfSxcblxuICAgIGlzQWxwaGFOdW1lcmljOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAhL1teMC05YS16XFx4REYtXFx4RkZdLy50ZXN0KHRoaXMucy50b0xvd2VyQ2FzZSgpKTtcbiAgICB9LFxuXG4gICAgaXNFbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zID09PSBudWxsIHx8IHRoaXMucyA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IC9eW1xcc1xceGEwXSokLy50ZXN0KHRoaXMucyk7XG4gICAgfSxcblxuICAgIGlzTG93ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuaXNBbHBoYSgpICYmIHRoaXMucy50b0xvd2VyQ2FzZSgpID09PSB0aGlzLnM7XG4gICAgfSxcblxuICAgIGlzTnVtZXJpYzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gIS9bXjAtOV0vLnRlc3QodGhpcy5zKTtcbiAgICB9LFxuXG4gICAgaXNVcHBlcjogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc0FscGhhKCkgJiYgdGhpcy5zLnRvVXBwZXJDYXNlKCkgPT09IHRoaXMucztcbiAgICB9LFxuXG4gICAgbGVmdDogZnVuY3Rpb24oTikge1xuICAgICAgaWYgKE4gPj0gMCkge1xuICAgICAgICB2YXIgcyA9IHRoaXMucy5zdWJzdHIoMCwgTik7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJpZ2h0KC1OKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgbGluZXM6IGZ1bmN0aW9uKCkgeyAvL2NvbnZlcnQgd2luZG93cyBuZXdsaW5lcyB0byB1bml4IG5ld2xpbmVzIHRoZW4gY29udmVydCB0byBhbiBBcnJheSBvZiBsaW5lc1xuICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZUFsbCgnXFxyXFxuJywgJ1xcbicpLnMuc3BsaXQoJ1xcbicpO1xuICAgIH0sXG5cbiAgICBwYWQ6IGZ1bmN0aW9uKGxlbiwgY2gpIHsgLy9odHRwczovL2dpdGh1Yi5jb20vY29tcG9uZW50L3BhZFxuICAgICAgaWYgKGNoID09IG51bGwpIGNoID0gJyAnO1xuICAgICAgaWYgKHRoaXMucy5sZW5ndGggPj0gbGVuKSByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5zKTtcbiAgICAgIGxlbiA9IGxlbiAtIHRoaXMucy5sZW5ndGg7XG4gICAgICB2YXIgbGVmdCA9IEFycmF5KE1hdGguY2VpbChsZW4gLyAyKSArIDEpLmpvaW4oY2gpO1xuICAgICAgdmFyIHJpZ2h0ID0gQXJyYXkoTWF0aC5mbG9vcihsZW4gLyAyKSArIDEpLmpvaW4oY2gpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKGxlZnQgKyB0aGlzLnMgKyByaWdodCk7XG4gICAgfSxcblxuICAgIHBhZExlZnQ6IGZ1bmN0aW9uKGxlbiwgY2gpIHsgLy9odHRwczovL2dpdGh1Yi5jb20vY29tcG9uZW50L3BhZFxuICAgICAgaWYgKGNoID09IG51bGwpIGNoID0gJyAnO1xuICAgICAgaWYgKHRoaXMucy5sZW5ndGggPj0gbGVuKSByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5zKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihBcnJheShsZW4gLSB0aGlzLnMubGVuZ3RoICsgMSkuam9pbihjaCkgKyB0aGlzLnMpO1xuICAgIH0sXG5cbiAgICBwYWRSaWdodDogZnVuY3Rpb24obGVuLCBjaCkgeyAvL2h0dHBzOi8vZ2l0aHViLmNvbS9jb21wb25lbnQvcGFkXG4gICAgICBpZiAoY2ggPT0gbnVsbCkgY2ggPSAnICc7XG4gICAgICBpZiAodGhpcy5zLmxlbmd0aCA+PSBsZW4pIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnMpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucyArIEFycmF5KGxlbiAtIHRoaXMucy5sZW5ndGggKyAxKS5qb2luKGNoKSk7XG4gICAgfSxcblxuICAgIHBhcnNlQ1NWOiBmdW5jdGlvbihkZWxpbWl0ZXIsIHF1YWxpZmllciwgZXNjYXBlLCBsaW5lRGVsaW1pdGVyKSB7IC8vdHJ5IHRvIHBhcnNlIG5vIG1hdHRlciB3aGF0XG4gICAgICBkZWxpbWl0ZXIgPSBkZWxpbWl0ZXIgfHwgJywnO1xuICAgICAgZXNjYXBlID0gZXNjYXBlIHx8ICdcXFxcJ1xuICAgICAgaWYgKHR5cGVvZiBxdWFsaWZpZXIgPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHF1YWxpZmllciA9ICdcIic7XG5cbiAgICAgIHZhciBpID0gMCwgZmllbGRCdWZmZXIgPSBbXSwgZmllbGRzID0gW10sIGxlbiA9IHRoaXMucy5sZW5ndGgsIGluRmllbGQgPSBmYWxzZSwgaW5VbnF1YWxpZmllZFN0cmluZyA9IGZhbHNlLCBzZWxmID0gdGhpcztcbiAgICAgIHZhciBjYSA9IGZ1bmN0aW9uKGkpe3JldHVybiBzZWxmLnMuY2hhckF0KGkpfTtcbiAgICAgIGlmICh0eXBlb2YgbGluZURlbGltaXRlciAhPT0gJ3VuZGVmaW5lZCcpIHZhciByb3dzID0gW107XG5cbiAgICAgIGlmICghcXVhbGlmaWVyKVxuICAgICAgICBpbkZpZWxkID0gdHJ1ZTtcblxuICAgICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBjYShpKTtcbiAgICAgICAgc3dpdGNoIChjdXJyZW50KSB7XG4gICAgICAgICAgY2FzZSBlc2NhcGU6XG4gICAgICAgICAgICAvL2ZpeCBmb3IgaXNzdWVzICMzMiBhbmQgIzM1XG4gICAgICAgICAgICBpZiAoaW5GaWVsZCAmJiAoKGVzY2FwZSAhPT0gcXVhbGlmaWVyKSB8fCBjYShpKzEpID09PSBxdWFsaWZpZXIpKSB7XG4gICAgICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICAgICAgZmllbGRCdWZmZXIucHVzaChjYShpKSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGVzY2FwZSAhPT0gcXVhbGlmaWVyKSBicmVhaztcbiAgICAgICAgICBjYXNlIHF1YWxpZmllcjpcbiAgICAgICAgICAgIGluRmllbGQgPSAhaW5GaWVsZDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgZGVsaW1pdGVyOlxuICAgICAgICAgICAgaWYoaW5VbnF1YWxpZmllZFN0cmluZykge1xuICAgICAgICAgICAgICBpbkZpZWxkPWZhbHNlO1xuICAgICAgICAgICAgICBpblVucXVhbGlmaWVkU3RyaW5nPWZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGluRmllbGQgJiYgcXVhbGlmaWVyKVxuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGZpZWxkQnVmZmVyLmpvaW4oJycpKVxuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5sZW5ndGggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBsaW5lRGVsaW1pdGVyOlxuICAgICAgICAgICAgaWYoaW5VbnF1YWxpZmllZFN0cmluZykge1xuICAgICAgICAgICAgICBpbkZpZWxkPWZhbHNlO1xuICAgICAgICAgICAgICBpblVucXVhbGlmaWVkU3RyaW5nPWZhbHNlO1xuICAgICAgICAgICAgICBmaWVsZHMucHVzaChmaWVsZEJ1ZmZlci5qb2luKCcnKSlcbiAgICAgICAgICAgICAgcm93cy5wdXNoKGZpZWxkcyk7XG4gICAgICAgICAgICAgIGZpZWxkcyA9IFtdO1xuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5sZW5ndGggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaW5GaWVsZCkge1xuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKHJvd3MpIHtcbiAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChmaWVsZEJ1ZmZlci5qb2luKCcnKSlcbiAgICAgICAgICAgICAgICByb3dzLnB1c2goZmllbGRzKTtcbiAgICAgICAgICAgICAgICBmaWVsZHMgPSBbXTtcbiAgICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICcgJzpcbiAgICAgICAgICAgIGlmIChpbkZpZWxkKVxuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGlmIChpbkZpZWxkKVxuICAgICAgICAgICAgICBmaWVsZEJ1ZmZlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgZWxzZSBpZihjdXJyZW50IT09cXVhbGlmaWVyKSB7XG4gICAgICAgICAgICAgIGZpZWxkQnVmZmVyLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICAgIGluRmllbGQ9dHJ1ZTtcbiAgICAgICAgICAgICAgaW5VbnF1YWxpZmllZFN0cmluZz10cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaSArPSAxO1xuICAgICAgfVxuXG4gICAgICBmaWVsZHMucHVzaChmaWVsZEJ1ZmZlci5qb2luKCcnKSk7XG4gICAgICBpZiAocm93cykge1xuICAgICAgICByb3dzLnB1c2goZmllbGRzKTtcbiAgICAgICAgcmV0dXJuIHJvd3M7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmllbGRzO1xuICAgIH0sXG5cbiAgICByZXBsYWNlQWxsOiBmdW5jdGlvbihzcywgcikge1xuICAgICAgLy92YXIgcyA9IHRoaXMucy5yZXBsYWNlKG5ldyBSZWdFeHAoc3MsICdnJyksIHIpO1xuICAgICAgdmFyIHMgPSB0aGlzLnMuc3BsaXQoc3MpLmpvaW4ocilcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgc3BsaXRMZWZ0OiBmdW5jdGlvbihzZXAsIG1heFNwbGl0LCBsaW1pdCkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUoJy4vX3NwbGl0TGVmdCcpKHRoaXMucywgc2VwLCBtYXhTcGxpdCwgbGltaXQpXG4gICAgfSxcblxuICAgIHNwbGl0UmlnaHQ6IGZ1bmN0aW9uKHNlcCwgbWF4U3BsaXQsIGxpbWl0KSB7XG4gICAgICByZXR1cm4gcmVxdWlyZSgnLi9fc3BsaXRSaWdodCcpKHRoaXMucywgc2VwLCBtYXhTcGxpdCwgbGltaXQpXG4gICAgfSxcblxuICAgIHN0cmlwOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzcyA9IHRoaXMucztcbiAgICAgIGZvcih2YXIgaT0gMCwgbj1hcmd1bWVudHMubGVuZ3RoOyBpPG47IGkrKykge1xuICAgICAgICBzcyA9IHNzLnNwbGl0KGFyZ3VtZW50c1tpXSkuam9pbignJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Ioc3MpO1xuICAgIH0sXG5cbiAgICBzdHJpcExlZnQ6IGZ1bmN0aW9uIChjaGFycykge1xuICAgICAgdmFyIHJlZ2V4O1xuICAgICAgdmFyIHBhdHRlcm47XG4gICAgICB2YXIgc3MgPSBlbnN1cmVTdHJpbmcodGhpcy5zKTtcblxuICAgICAgaWYgKGNoYXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcGF0dGVybiA9IC9eXFxzKy9nO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJlZ2V4ID0gZXNjYXBlUmVnRXhwKGNoYXJzKTtcbiAgICAgICAgcGF0dGVybiA9IG5ldyBSZWdFeHAoXCJeW1wiICsgcmVnZXggKyBcIl0rXCIsIFwiZ1wiKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHNzLnJlcGxhY2UocGF0dGVybiwgXCJcIikpO1xuICAgIH0sXG5cbiAgICBzdHJpcFJpZ2h0OiBmdW5jdGlvbiAoY2hhcnMpIHtcbiAgICAgIHZhciByZWdleDtcbiAgICAgIHZhciBwYXR0ZXJuO1xuICAgICAgdmFyIHNzID0gZW5zdXJlU3RyaW5nKHRoaXMucyk7XG5cbiAgICAgIGlmIChjaGFycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBhdHRlcm4gPSAvXFxzKyQvZztcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZWdleCA9IGVzY2FwZVJlZ0V4cChjaGFycyk7XG4gICAgICAgIHBhdHRlcm4gPSBuZXcgUmVnRXhwKFwiW1wiICsgcmVnZXggKyBcIl0rJFwiLCBcImdcIik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcihzcy5yZXBsYWNlKHBhdHRlcm4sIFwiXCIpKTtcbiAgICB9LFxuXG4gICAgcmlnaHQ6IGZ1bmN0aW9uKE4pIHtcbiAgICAgIGlmIChOID49IDApIHtcbiAgICAgICAgdmFyIHMgPSB0aGlzLnMuc3Vic3RyKHRoaXMucy5sZW5ndGggLSBOLCBOKTtcbiAgICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGVmdCgtTik7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbiAocykge1xuXHQgIGluaXRpYWxpemUodGhpcywgcyk7XG5cdCAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNsdWdpZnk6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNsID0gKG5ldyBTKG5ldyBTKHRoaXMucykubGF0aW5pc2UoKS5zLnJlcGxhY2UoL1teXFx3XFxzLV0vZywgJycpLnRvTG93ZXJDYXNlKCkpKS5kYXNoZXJpemUoKS5zO1xuICAgICAgaWYgKHNsLmNoYXJBdCgwKSA9PT0gJy0nKVxuICAgICAgICBzbCA9IHNsLnN1YnN0cigxKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzbCk7XG4gICAgfSxcblxuICAgIHN0YXJ0c1dpdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHByZWZpeGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJlZml4ZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKHRoaXMucy5sYXN0SW5kZXhPZihwcmVmaXhlc1tpXSwgMCkgPT09IDApIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICBzdHJpcFB1bmN0dWF0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgIC8vcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucy5yZXBsYWNlKC9bXFwuLC1cXC8jISQlXFxeJlxcKjs6e309XFwtX2B+KCldL2csXCJcIikpO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMucy5yZXBsYWNlKC9bXlxcd1xcc118Xy9nLCBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKSk7XG4gICAgfSxcblxuICAgIHN0cmlwVGFnczogZnVuY3Rpb24oKSB7IC8vZnJvbSBzdWdhci5qc1xuICAgICAgdmFyIHMgPSB0aGlzLnMsIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoID4gMCA/IGFyZ3VtZW50cyA6IFsnJ107XG4gICAgICBtdWx0aUFyZ3MoYXJncywgZnVuY3Rpb24odGFnKSB7XG4gICAgICAgIHMgPSBzLnJlcGxhY2UoUmVnRXhwKCc8XFwvPycgKyB0YWcgKyAnW148Pl0qPicsICdnaScpLCAnJyk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgdGVtcGxhdGU6IGZ1bmN0aW9uKHZhbHVlcywgb3BlbmluZywgY2xvc2luZykge1xuICAgICAgdmFyIHMgPSB0aGlzLnNcbiAgICAgIHZhciBvcGVuaW5nID0gb3BlbmluZyB8fCBFeHBvcnQuVE1QTF9PUEVOXG4gICAgICB2YXIgY2xvc2luZyA9IGNsb3NpbmcgfHwgRXhwb3J0LlRNUExfQ0xPU0VcblxuICAgICAgdmFyIG9wZW4gPSBvcGVuaW5nLnJlcGxhY2UoL1stW1xcXSgpKlxcc10vZywgXCJcXFxcJCZcIikucmVwbGFjZSgvXFwkL2csICdcXFxcJCcpXG4gICAgICB2YXIgY2xvc2UgPSBjbG9zaW5nLnJlcGxhY2UoL1stW1xcXSgpKlxcc10vZywgXCJcXFxcJCZcIikucmVwbGFjZSgvXFwkL2csICdcXFxcJCcpXG4gICAgICB2YXIgciA9IG5ldyBSZWdFeHAob3BlbiArICcoLis/KScgKyBjbG9zZSwgJ2cnKVxuICAgICAgICAvLywgciA9IC9cXHtcXHsoLis/KVxcfVxcfS9nXG4gICAgICB2YXIgbWF0Y2hlcyA9IHMubWF0Y2gocikgfHwgW107XG5cbiAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbihtYXRjaCkge1xuICAgICAgICB2YXIga2V5ID0gbWF0Y2guc3Vic3RyaW5nKG9wZW5pbmcubGVuZ3RoLCBtYXRjaC5sZW5ndGggLSBjbG9zaW5nLmxlbmd0aCkudHJpbSgpOy8vY2hvcCB7eyBhbmQgfX1cbiAgICAgICAgdmFyIHZhbHVlID0gdHlwZW9mIHZhbHVlc1trZXldID09ICd1bmRlZmluZWQnID8gJycgOiB2YWx1ZXNba2V5XTtcbiAgICAgICAgcyA9IHMucmVwbGFjZShtYXRjaCwgdmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRpbWVzOiBmdW5jdGlvbihuKSB7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IobmV3IEFycmF5KG4gKyAxKS5qb2luKHRoaXMucykpO1xuICAgIH0sXG5cbiAgICB0aXRsZUNhc2U6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHMgPSB0aGlzLnM7XG4gICAgICBpZiAocykge1xuICAgICAgICBzID0gcy5yZXBsYWNlKC8oXlthLXpdfCBbYS16XXwtW2Etel18X1thLXpdKS9nLFxuICAgICAgICAgIGZ1bmN0aW9uKCQxKXtcbiAgICAgICAgICAgIHJldHVybiAkMS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgdG9Cb29sZWFuOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgcyA9IHRoaXMucy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICByZXR1cm4gcyA9PT0gJ3RydWUnIHx8IHMgPT09ICd5ZXMnIHx8IHMgPT09ICdvbicgfHwgcyA9PT0gJzEnO1xuICAgICAgfSBlbHNlXG4gICAgICAgIHJldHVybiB0aGlzLm9yaWcgPT09IHRydWUgfHwgdGhpcy5vcmlnID09PSAxO1xuICAgIH0sXG5cbiAgICB0b0Zsb2F0OiBmdW5jdGlvbihwcmVjaXNpb24pIHtcbiAgICAgIHZhciBudW0gPSBwYXJzZUZsb2F0KHRoaXMucylcbiAgICAgIGlmIChwcmVjaXNpb24pXG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KG51bS50b0ZpeGVkKHByZWNpc2lvbikpXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBudW1cbiAgICB9LFxuXG4gICAgdG9JbnQ6IGZ1bmN0aW9uKCkgeyAvL3RoYW5rcyBHb29nbGVcbiAgICAgIC8vIElmIHRoZSBzdHJpbmcgc3RhcnRzIHdpdGggJzB4JyBvciAnLTB4JywgcGFyc2UgYXMgaGV4LlxuICAgICAgcmV0dXJuIC9eXFxzKi0/MHgvaS50ZXN0KHRoaXMucykgPyBwYXJzZUludCh0aGlzLnMsIDE2KSA6IHBhcnNlSW50KHRoaXMucywgMTApXG4gICAgfSxcblxuICAgIHRyaW06IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHM7XG4gICAgICBpZiAodHlwZW9mIF9fbnNwLnRyaW0gPT09ICd1bmRlZmluZWQnKVxuICAgICAgICBzID0gdGhpcy5zLnJlcGxhY2UoLyheXFxzKnxcXHMqJCkvZywgJycpXG4gICAgICBlbHNlXG4gICAgICAgIHMgPSB0aGlzLnMudHJpbSgpXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRyaW1MZWZ0OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzO1xuICAgICAgaWYgKF9fbnNwLnRyaW1MZWZ0KVxuICAgICAgICBzID0gdGhpcy5zLnRyaW1MZWZ0KCk7XG4gICAgICBlbHNlXG4gICAgICAgIHMgPSB0aGlzLnMucmVwbGFjZSgvKF5cXHMqKS9nLCAnJyk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRyaW1SaWdodDogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcztcbiAgICAgIGlmIChfX25zcC50cmltUmlnaHQpXG4gICAgICAgIHMgPSB0aGlzLnMudHJpbVJpZ2h0KCk7XG4gICAgICBlbHNlXG4gICAgICAgIHMgPSB0aGlzLnMucmVwbGFjZSgvXFxzKyQvLCAnJyk7XG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3Iocyk7XG4gICAgfSxcblxuICAgIHRydW5jYXRlOiBmdW5jdGlvbihsZW5ndGgsIHBydW5lU3RyKSB7IC8vZnJvbSB1bmRlcnNjb3JlLnN0cmluZywgYXV0aG9yOiBnaXRodWIuY29tL3J3elxuICAgICAgdmFyIHN0ciA9IHRoaXMucztcblxuICAgICAgbGVuZ3RoID0gfn5sZW5ndGg7XG4gICAgICBwcnVuZVN0ciA9IHBydW5lU3RyIHx8ICcuLi4nO1xuXG4gICAgICBpZiAoc3RyLmxlbmd0aCA8PSBsZW5ndGgpIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzdHIpO1xuXG4gICAgICB2YXIgdG1wbCA9IGZ1bmN0aW9uKGMpeyByZXR1cm4gYy50b1VwcGVyQ2FzZSgpICE9PSBjLnRvTG93ZXJDYXNlKCkgPyAnQScgOiAnICc7IH0sXG4gICAgICAgIHRlbXBsYXRlID0gc3RyLnNsaWNlKDAsIGxlbmd0aCsxKS5yZXBsYWNlKC8uKD89XFxXKlxcdyokKS9nLCB0bXBsKTsgLy8gJ0hlbGxvLCB3b3JsZCcgLT4gJ0hlbGxBQSBBQUFBQSdcblxuICAgICAgaWYgKHRlbXBsYXRlLnNsaWNlKHRlbXBsYXRlLmxlbmd0aC0yKS5tYXRjaCgvXFx3XFx3LykpXG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgvXFxzKlxcUyskLywgJycpO1xuICAgICAgZWxzZVxuICAgICAgICB0ZW1wbGF0ZSA9IG5ldyBTKHRlbXBsYXRlLnNsaWNlKDAsIHRlbXBsYXRlLmxlbmd0aC0xKSkudHJpbVJpZ2h0KCkucztcblxuICAgICAgcmV0dXJuICh0ZW1wbGF0ZStwcnVuZVN0cikubGVuZ3RoID4gc3RyLmxlbmd0aCA/IG5ldyBTKHN0cikgOiBuZXcgUyhzdHIuc2xpY2UoMCwgdGVtcGxhdGUubGVuZ3RoKStwcnVuZVN0cik7XG4gICAgfSxcblxuICAgIHRvQ1NWOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkZWxpbSA9ICcsJywgcXVhbGlmaWVyID0gJ1wiJywgZXNjYXBlID0gJ1xcXFwnLCBlbmNsb3NlTnVtYmVycyA9IHRydWUsIGtleXMgPSBmYWxzZTtcbiAgICAgIHZhciBkYXRhQXJyYXkgPSBbXTtcblxuICAgICAgZnVuY3Rpb24gaGFzVmFsKGl0KSB7XG4gICAgICAgIHJldHVybiBpdCAhPT0gbnVsbCAmJiBpdCAhPT0gJyc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzBdID09PSAnb2JqZWN0Jykge1xuICAgICAgICBkZWxpbSA9IGFyZ3VtZW50c1swXS5kZWxpbWl0ZXIgfHwgZGVsaW07XG4gICAgICAgIGRlbGltID0gYXJndW1lbnRzWzBdLnNlcGFyYXRvciB8fCBkZWxpbTtcbiAgICAgICAgcXVhbGlmaWVyID0gYXJndW1lbnRzWzBdLnF1YWxpZmllciB8fCBxdWFsaWZpZXI7XG4gICAgICAgIGVuY2xvc2VOdW1iZXJzID0gISFhcmd1bWVudHNbMF0uZW5jbG9zZU51bWJlcnM7XG4gICAgICAgIGVzY2FwZSA9IGFyZ3VtZW50c1swXS5lc2NhcGUgfHwgZXNjYXBlO1xuICAgICAgICBrZXlzID0gISFhcmd1bWVudHNbMF0ua2V5cztcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZ3VtZW50c1swXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZGVsaW0gPSBhcmd1bWVudHNbMF07XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgYXJndW1lbnRzWzFdID09PSAnc3RyaW5nJylcbiAgICAgICAgcXVhbGlmaWVyID0gYXJndW1lbnRzWzFdO1xuXG4gICAgICBpZiAoYXJndW1lbnRzWzFdID09PSBudWxsKVxuICAgICAgICBxdWFsaWZpZXIgPSBudWxsO1xuXG4gICAgICAgaWYgKHRoaXMub3JpZyBpbnN0YW5jZW9mIEFycmF5KVxuICAgICAgICBkYXRhQXJyYXkgID0gdGhpcy5vcmlnO1xuICAgICAgZWxzZSB7IC8vb2JqZWN0XG4gICAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLm9yaWcpXG4gICAgICAgICAgaWYgKHRoaXMub3JpZy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgaWYgKGtleXMpXG4gICAgICAgICAgICAgIGRhdGFBcnJheS5wdXNoKGtleSk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGRhdGFBcnJheS5wdXNoKHRoaXMub3JpZ1trZXldKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlcCA9IGVzY2FwZSArIHF1YWxpZmllcjtcbiAgICAgIHZhciBidWlsZFN0cmluZyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhQXJyYXkubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHNob3VsZFF1YWxpZnkgPSBoYXNWYWwocXVhbGlmaWVyKVxuICAgICAgICBpZiAodHlwZW9mIGRhdGFBcnJheVtpXSA9PSAnbnVtYmVyJylcbiAgICAgICAgICBzaG91bGRRdWFsaWZ5ICY9IGVuY2xvc2VOdW1iZXJzO1xuXG4gICAgICAgIGlmIChzaG91bGRRdWFsaWZ5KVxuICAgICAgICAgIGJ1aWxkU3RyaW5nLnB1c2gocXVhbGlmaWVyKTtcblxuICAgICAgICBpZiAoZGF0YUFycmF5W2ldICE9PSBudWxsICYmIGRhdGFBcnJheVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFyIGQgPSBuZXcgUyhkYXRhQXJyYXlbaV0pLnJlcGxhY2VBbGwocXVhbGlmaWVyLCByZXApLnM7XG4gICAgICAgICAgYnVpbGRTdHJpbmcucHVzaChkKTtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgICAgYnVpbGRTdHJpbmcucHVzaCgnJylcblxuICAgICAgICBpZiAoc2hvdWxkUXVhbGlmeSlcbiAgICAgICAgICBidWlsZFN0cmluZy5wdXNoKHF1YWxpZmllcik7XG5cbiAgICAgICAgaWYgKGRlbGltKVxuICAgICAgICAgIGJ1aWxkU3RyaW5nLnB1c2goZGVsaW0pO1xuICAgICAgfVxuXG4gICAgICAvL2Nob3AgbGFzdCBkZWxpbVxuICAgICAgLy9jb25zb2xlLmxvZyhidWlsZFN0cmluZy5sZW5ndGgpXG4gICAgICBidWlsZFN0cmluZy5sZW5ndGggPSBidWlsZFN0cmluZy5sZW5ndGggLSAxO1xuICAgICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKGJ1aWxkU3RyaW5nLmpvaW4oJycpKTtcbiAgICB9LFxuXG4gICAgdG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMucztcbiAgICB9LFxuXG4gICAgLy8jbW9kaWZpZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZXBlbGkvdW5kZXJzY29yZS5zdHJpbmdcbiAgICB1bmRlcnNjb3JlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzID0gdGhpcy50cmltKCkucy5yZXBsYWNlKC8oW2EtelxcZF0pKFtBLVpdKykvZywgJyQxXyQyJykucmVwbGFjZSgvKFtBLVpcXGRdKykoW0EtWl1bYS16XSkvZywnJDFfJDInKS5yZXBsYWNlKC9bLVxcc10rL2csICdfJykudG9Mb3dlckNhc2UoKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9LFxuXG4gICAgdW5lc2NhcGVIVE1MOiBmdW5jdGlvbigpIHsgLy9mcm9tIHVuZGVyc2NvcmUuc3RyaW5nXG4gICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5zLnJlcGxhY2UoL1xcJihbXjtdKyk7L2csIGZ1bmN0aW9uKGVudGl0eSwgZW50aXR5Q29kZSl7XG4gICAgICAgIHZhciBtYXRjaDtcblxuICAgICAgICBpZiAoZW50aXR5Q29kZSBpbiBlc2NhcGVDaGFycykge1xuICAgICAgICAgIHJldHVybiBlc2NhcGVDaGFyc1tlbnRpdHlDb2RlXTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXRjaCA9IGVudGl0eUNvZGUubWF0Y2goL14jeChbXFxkYS1mQS1GXSspJC8pKSB7XG4gICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQobWF0Y2hbMV0sIDE2KSk7XG4gICAgICAgIH0gZWxzZSBpZiAobWF0Y2ggPSBlbnRpdHlDb2RlLm1hdGNoKC9eIyhcXGQrKSQvKSkge1xuICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKH5+bWF0Y2hbMV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBlbnRpdHk7XG4gICAgICAgIH1cbiAgICAgIH0pKTtcbiAgICB9LFxuXG4gICAgdmFsdWVPZjogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5zLnZhbHVlT2YoKTtcbiAgICB9LFxuXG4gICAgLy8jQWRkZWQgYSBOZXcgRnVuY3Rpb24gY2FsbGVkIHdyYXBIVE1MLlxuICAgIHdyYXBIVE1MOiBmdW5jdGlvbiAodGFnTmFtZSwgdGFnQXR0cnMpIHtcbiAgICAgIHZhciBzID0gdGhpcy5zLCBlbCA9ICh0YWdOYW1lID09IG51bGwpID8gJ3NwYW4nIDogdGFnTmFtZSwgZWxBdHRyID0gJycsIHdyYXBwZWQgPSAnJztcbiAgICAgIGlmKHR5cGVvZiB0YWdBdHRycyA9PSAnb2JqZWN0JykgZm9yKHZhciBwcm9wIGluIHRhZ0F0dHJzKSBlbEF0dHIgKz0gJyAnICsgcHJvcCArICc9XCInICsobmV3IHRoaXMuY29uc3RydWN0b3IodGFnQXR0cnNbcHJvcF0pKS5lc2NhcGVIVE1MKCkgKyAnXCInO1xuICAgICAgcyA9IHdyYXBwZWQuY29uY2F0KCc8JywgZWwsIGVsQXR0ciwgJz4nLCB0aGlzLCAnPC8nLCBlbCwgJz4nKTtcbiAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzKTtcbiAgICB9XG4gIH1cblxuICB2YXIgbWV0aG9kc0FkZGVkID0gW107XG4gIGZ1bmN0aW9uIGV4dGVuZFByb3RvdHlwZSgpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIF9fc3ApIHtcbiAgICAgIChmdW5jdGlvbihuYW1lKXtcbiAgICAgICAgdmFyIGZ1bmMgPSBfX3NwW25hbWVdO1xuICAgICAgICBpZiAoIV9fbnNwLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgbWV0aG9kc0FkZGVkLnB1c2gobmFtZSk7XG4gICAgICAgICAgX19uc3BbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIFN0cmluZy5wcm90b3R5cGUucyA9IHRoaXM7XG4gICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSkobmFtZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzdG9yZVByb3RvdHlwZSgpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1ldGhvZHNBZGRlZC5sZW5ndGg7ICsraSlcbiAgICAgIGRlbGV0ZSBTdHJpbmcucHJvdG90eXBlW21ldGhvZHNBZGRlZFtpXV07XG4gICAgbWV0aG9kc0FkZGVkLmxlbmd0aCA9IDA7XG4gIH1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuLyogQXR0YWNoIE5hdGl2ZSBKYXZhU2NyaXB0IFN0cmluZyBQcm9wZXJ0aWVzXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICB2YXIgbmF0aXZlUHJvcGVydGllcyA9IGdldE5hdGl2ZVN0cmluZ1Byb3BlcnRpZXMoKTtcbiAgZm9yICh2YXIgbmFtZSBpbiBuYXRpdmVQcm9wZXJ0aWVzKSB7XG4gICAgKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBzdHJpbmdQcm9wID0gX19uc3BbbmFtZV07XG4gICAgICBpZiAodHlwZW9mIHN0cmluZ1Byb3AgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvL2NvbnNvbGUubG9nKHN0cmluZ1Byb3ApXG4gICAgICAgIGlmICghX19zcFtuYW1lXSkge1xuICAgICAgICAgIGlmIChuYXRpdmVQcm9wZXJ0aWVzW25hbWVdID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgX19zcFtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKG5hbWUpXG4gICAgICAgICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihzdHJpbmdQcm9wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfX3NwW25hbWVdID0gc3RyaW5nUHJvcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KShuYW1lKTtcbiAgfVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4vKiBGdW5jdGlvbiBBbGlhc2VzXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICBfX3NwLnJlcGVhdCA9IF9fc3AudGltZXM7XG4gIF9fc3AuaW5jbHVkZSA9IF9fc3AuY29udGFpbnM7XG4gIF9fc3AudG9JbnRlZ2VyID0gX19zcC50b0ludDtcbiAgX19zcC50b0Jvb2wgPSBfX3NwLnRvQm9vbGVhbjtcbiAgX19zcC5kZWNvZGVIVE1MRW50aXRpZXMgPSBfX3NwLmRlY29kZUh0bWxFbnRpdGllcyAvL2Vuc3VyZSBjb25zaXN0ZW50IGNhc2luZyBzY2hlbWUgb2YgJ0hUTUwnXG5cblxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbi8vIFNldCB0aGUgY29uc3RydWN0b3IuICBXaXRob3V0IHRoaXMsIHN0cmluZy5qcyBvYmplY3RzIGFyZSBpbnN0YW5jZXMgb2Zcbi8vIE9iamVjdCBpbnN0ZWFkIG9mIFMuXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXG4gIF9fc3AuY29uc3RydWN0b3IgPSBTO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4vKiBQcml2YXRlIEZ1bmN0aW9uc1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgZnVuY3Rpb24gZ2V0TmF0aXZlU3RyaW5nUHJvcGVydGllcygpIHtcbiAgICB2YXIgbmFtZXMgPSBnZXROYXRpdmVTdHJpbmdQcm9wZXJ0eU5hbWVzKCk7XG4gICAgdmFyIHJldE9iaiA9IHt9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIG5hbWUgPSBuYW1lc1tpXTtcbiAgICAgIGlmIChuYW1lID09PSAndG8nIHx8IG5hbWUgPT09ICd0b0VuZCcpIGNvbnRpbnVlOyAgICAgICAvLyBnZXQgcmlkIG9mIHRoZSBzaGVsbGpzIHByb3RvdHlwZSBtZXNzdXBcbiAgICAgIHZhciBmdW5jID0gX19uc3BbbmFtZV07XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgdHlwZSA9IHR5cGVvZiBmdW5jLmFwcGx5KCd0ZXN0c3RyaW5nJyk7XG4gICAgICAgIHJldE9ialtuYW1lXSA9IHR5cGU7XG4gICAgICB9IGNhdGNoIChlKSB7fVxuICAgIH1cbiAgICByZXR1cm4gcmV0T2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TmF0aXZlU3RyaW5nUHJvcGVydHlOYW1lcygpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcykge1xuICAgICAgcmVzdWx0cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKF9fbnNwKTtcbiAgICAgIHJlc3VsdHMuc3BsaWNlKHJlc3VsdHMuaW5kZXhPZigndmFsdWVPZicpLCAxKTtcbiAgICAgIHJlc3VsdHMuc3BsaWNlKHJlc3VsdHMuaW5kZXhPZigndG9TdHJpbmcnKSwgMSk7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9IGVsc2UgeyAvL21lYW50IGZvciBsZWdhY3kgY3J1ZnQsIHRoaXMgY291bGQgcHJvYmFibHkgYmUgbWFkZSBtb3JlIGVmZmljaWVudFxuICAgICAgdmFyIHN0cmluZ05hbWVzID0ge307XG4gICAgICB2YXIgb2JqZWN0TmFtZXMgPSBbXTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gU3RyaW5nLnByb3RvdHlwZSlcbiAgICAgICAgc3RyaW5nTmFtZXNbbmFtZV0gPSBuYW1lO1xuXG4gICAgICBmb3IgKHZhciBuYW1lIGluIE9iamVjdC5wcm90b3R5cGUpXG4gICAgICAgIGRlbGV0ZSBzdHJpbmdOYW1lc1tuYW1lXTtcblxuICAgICAgLy9zdHJpbmdOYW1lc1sndG9TdHJpbmcnXSA9ICd0b1N0cmluZyc7IC8vdGhpcyB3YXMgZGVsZXRlZCB3aXRoIHRoZSByZXN0IG9mIHRoZSBvYmplY3QgbmFtZXNcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gc3RyaW5nTmFtZXMpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKG5hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRXhwb3J0KHN0cikge1xuICAgIHJldHVybiBuZXcgUyhzdHIpO1xuICB9O1xuXG4gIC8vYXR0YWNoIGV4cG9ydHMgdG8gU3RyaW5nSlNXcmFwcGVyXG4gIEV4cG9ydC5leHRlbmRQcm90b3R5cGUgPSBleHRlbmRQcm90b3R5cGU7XG4gIEV4cG9ydC5yZXN0b3JlUHJvdG90eXBlID0gcmVzdG9yZVByb3RvdHlwZTtcbiAgRXhwb3J0LlZFUlNJT04gPSBWRVJTSU9OO1xuICBFeHBvcnQuVE1QTF9PUEVOID0gJ3t7JztcbiAgRXhwb3J0LlRNUExfQ0xPU0UgPSAnfX0nO1xuICBFeHBvcnQuRU5USVRJRVMgPSBFTlRJVElFUztcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4vKiBFeHBvcnRzXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEV4cG9ydDtcblxuICB9IGVsc2Uge1xuXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBFeHBvcnQ7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LlMgPSBFeHBvcnQ7XG4gICAgfVxuICB9XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbi8qIDNyZCBQYXJ0eSBQcml2YXRlIEZ1bmN0aW9uc1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgLy9mcm9tIHN1Z2FyLmpzXG4gIGZ1bmN0aW9uIG11bHRpQXJncyhhcmdzLCBmbikge1xuICAgIHZhciByZXN1bHQgPSBbXSwgaTtcbiAgICBmb3IoaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQucHVzaChhcmdzW2ldKTtcbiAgICAgIGlmKGZuKSBmbi5jYWxsKGFyZ3MsIGFyZ3NbaV0sIGkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy9mcm9tIHVuZGVyc2NvcmUuc3RyaW5nXG4gIHZhciBlc2NhcGVDaGFycyA9IHtcbiAgICBsdDogJzwnLFxuICAgIGd0OiAnPicsXG4gICAgcXVvdDogJ1wiJyxcbiAgICBhcG9zOiBcIidcIixcbiAgICBhbXA6ICcmJ1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCAocykge1xuICAgIC8vIG1vc3QgcGFydCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9za3VscHQvc2t1bHB0L2Jsb2IvZWNhZjc1ZTY5YzJlNTM5ZWZmMTI0YjJhYjQ1ZGYwYjAxZWFmMjI5NS9zcmMvc3RyLmpzI0wyNDJcbiAgICB2YXIgYztcbiAgICB2YXIgaTtcbiAgICB2YXIgcmV0ID0gW107XG4gICAgdmFyIHJlID0gL15bQS1aYS16MC05XSskLztcbiAgICBzID0gZW5zdXJlU3RyaW5nKHMpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjID0gcy5jaGFyQXQoaSk7XG5cbiAgICAgIGlmIChyZS50ZXN0KGMpKSB7XG4gICAgICAgIHJldC5wdXNoKGMpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChjID09PSBcIlxcXFwwMDBcIikge1xuICAgICAgICAgIHJldC5wdXNoKFwiXFxcXDAwMFwiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXQucHVzaChcIlxcXFxcIiArIGMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQuam9pbihcIlwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuc3VyZVN0cmluZyhzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nID09IG51bGwgPyAnJyA6ICcnICsgc3RyaW5nO1xuICB9XG5cbiAgLy9mcm9tIHVuZGVyc2NvcmUuc3RyaW5nXG4gIHZhciByZXZlcnNlZEVzY2FwZUNoYXJzID0ge307XG4gIGZvcih2YXIga2V5IGluIGVzY2FwZUNoYXJzKXsgcmV2ZXJzZWRFc2NhcGVDaGFyc1tlc2NhcGVDaGFyc1trZXldXSA9IGtleTsgfVxuXG4gIEVOVElUSUVTID0ge1xuICAgIFwiYW1wXCIgOiBcIiZcIixcbiAgICBcImd0XCIgOiBcIj5cIixcbiAgICBcImx0XCIgOiBcIjxcIixcbiAgICBcInF1b3RcIiA6IFwiXFxcIlwiLFxuICAgIFwiYXBvc1wiIDogXCInXCIsXG4gICAgXCJBRWxpZ1wiIDogMTk4LFxuICAgIFwiQWFjdXRlXCIgOiAxOTMsXG4gICAgXCJBY2lyY1wiIDogMTk0LFxuICAgIFwiQWdyYXZlXCIgOiAxOTIsXG4gICAgXCJBcmluZ1wiIDogMTk3LFxuICAgIFwiQXRpbGRlXCIgOiAxOTUsXG4gICAgXCJBdW1sXCIgOiAxOTYsXG4gICAgXCJDY2VkaWxcIiA6IDE5OSxcbiAgICBcIkVUSFwiIDogMjA4LFxuICAgIFwiRWFjdXRlXCIgOiAyMDEsXG4gICAgXCJFY2lyY1wiIDogMjAyLFxuICAgIFwiRWdyYXZlXCIgOiAyMDAsXG4gICAgXCJFdW1sXCIgOiAyMDMsXG4gICAgXCJJYWN1dGVcIiA6IDIwNSxcbiAgICBcIkljaXJjXCIgOiAyMDYsXG4gICAgXCJJZ3JhdmVcIiA6IDIwNCxcbiAgICBcIkl1bWxcIiA6IDIwNyxcbiAgICBcIk50aWxkZVwiIDogMjA5LFxuICAgIFwiT2FjdXRlXCIgOiAyMTEsXG4gICAgXCJPY2lyY1wiIDogMjEyLFxuICAgIFwiT2dyYXZlXCIgOiAyMTAsXG4gICAgXCJPc2xhc2hcIiA6IDIxNixcbiAgICBcIk90aWxkZVwiIDogMjEzLFxuICAgIFwiT3VtbFwiIDogMjE0LFxuICAgIFwiVEhPUk5cIiA6IDIyMixcbiAgICBcIlVhY3V0ZVwiIDogMjE4LFxuICAgIFwiVWNpcmNcIiA6IDIxOSxcbiAgICBcIlVncmF2ZVwiIDogMjE3LFxuICAgIFwiVXVtbFwiIDogMjIwLFxuICAgIFwiWWFjdXRlXCIgOiAyMjEsXG4gICAgXCJhYWN1dGVcIiA6IDIyNSxcbiAgICBcImFjaXJjXCIgOiAyMjYsXG4gICAgXCJhZWxpZ1wiIDogMjMwLFxuICAgIFwiYWdyYXZlXCIgOiAyMjQsXG4gICAgXCJhcmluZ1wiIDogMjI5LFxuICAgIFwiYXRpbGRlXCIgOiAyMjcsXG4gICAgXCJhdW1sXCIgOiAyMjgsXG4gICAgXCJjY2VkaWxcIiA6IDIzMSxcbiAgICBcImVhY3V0ZVwiIDogMjMzLFxuICAgIFwiZWNpcmNcIiA6IDIzNCxcbiAgICBcImVncmF2ZVwiIDogMjMyLFxuICAgIFwiZXRoXCIgOiAyNDAsXG4gICAgXCJldW1sXCIgOiAyMzUsXG4gICAgXCJpYWN1dGVcIiA6IDIzNyxcbiAgICBcImljaXJjXCIgOiAyMzgsXG4gICAgXCJpZ3JhdmVcIiA6IDIzNixcbiAgICBcIml1bWxcIiA6IDIzOSxcbiAgICBcIm50aWxkZVwiIDogMjQxLFxuICAgIFwib2FjdXRlXCIgOiAyNDMsXG4gICAgXCJvY2lyY1wiIDogMjQ0LFxuICAgIFwib2dyYXZlXCIgOiAyNDIsXG4gICAgXCJvc2xhc2hcIiA6IDI0OCxcbiAgICBcIm90aWxkZVwiIDogMjQ1LFxuICAgIFwib3VtbFwiIDogMjQ2LFxuICAgIFwic3psaWdcIiA6IDIyMyxcbiAgICBcInRob3JuXCIgOiAyNTQsXG4gICAgXCJ1YWN1dGVcIiA6IDI1MCxcbiAgICBcInVjaXJjXCIgOiAyNTEsXG4gICAgXCJ1Z3JhdmVcIiA6IDI0OSxcbiAgICBcInV1bWxcIiA6IDI1MixcbiAgICBcInlhY3V0ZVwiIDogMjUzLFxuICAgIFwieXVtbFwiIDogMjU1LFxuICAgIFwiY29weVwiIDogMTY5LFxuICAgIFwicmVnXCIgOiAxNzQsXG4gICAgXCJuYnNwXCIgOiAxNjAsXG4gICAgXCJpZXhjbFwiIDogMTYxLFxuICAgIFwiY2VudFwiIDogMTYyLFxuICAgIFwicG91bmRcIiA6IDE2MyxcbiAgICBcImN1cnJlblwiIDogMTY0LFxuICAgIFwieWVuXCIgOiAxNjUsXG4gICAgXCJicnZiYXJcIiA6IDE2NixcbiAgICBcInNlY3RcIiA6IDE2NyxcbiAgICBcInVtbFwiIDogMTY4LFxuICAgIFwib3JkZlwiIDogMTcwLFxuICAgIFwibGFxdW9cIiA6IDE3MSxcbiAgICBcIm5vdFwiIDogMTcyLFxuICAgIFwic2h5XCIgOiAxNzMsXG4gICAgXCJtYWNyXCIgOiAxNzUsXG4gICAgXCJkZWdcIiA6IDE3NixcbiAgICBcInBsdXNtblwiIDogMTc3LFxuICAgIFwic3VwMVwiIDogMTg1LFxuICAgIFwic3VwMlwiIDogMTc4LFxuICAgIFwic3VwM1wiIDogMTc5LFxuICAgIFwiYWN1dGVcIiA6IDE4MCxcbiAgICBcIm1pY3JvXCIgOiAxODEsXG4gICAgXCJwYXJhXCIgOiAxODIsXG4gICAgXCJtaWRkb3RcIiA6IDE4MyxcbiAgICBcImNlZGlsXCIgOiAxODQsXG4gICAgXCJvcmRtXCIgOiAxODYsXG4gICAgXCJyYXF1b1wiIDogMTg3LFxuICAgIFwiZnJhYzE0XCIgOiAxODgsXG4gICAgXCJmcmFjMTJcIiA6IDE4OSxcbiAgICBcImZyYWMzNFwiIDogMTkwLFxuICAgIFwiaXF1ZXN0XCIgOiAxOTEsXG4gICAgXCJ0aW1lc1wiIDogMjE1LFxuICAgIFwiZGl2aWRlXCIgOiAyNDcsXG4gICAgXCJPRWxpZztcIiA6IDMzOCxcbiAgICBcIm9lbGlnO1wiIDogMzM5LFxuICAgIFwiU2Nhcm9uO1wiIDogMzUyLFxuICAgIFwic2Nhcm9uO1wiIDogMzUzLFxuICAgIFwiWXVtbDtcIiA6IDM3NixcbiAgICBcImZub2Y7XCIgOiA0MDIsXG4gICAgXCJjaXJjO1wiIDogNzEwLFxuICAgIFwidGlsZGU7XCIgOiA3MzIsXG4gICAgXCJBbHBoYTtcIiA6IDkxMyxcbiAgICBcIkJldGE7XCIgOiA5MTQsXG4gICAgXCJHYW1tYTtcIiA6IDkxNSxcbiAgICBcIkRlbHRhO1wiIDogOTE2LFxuICAgIFwiRXBzaWxvbjtcIiA6IDkxNyxcbiAgICBcIlpldGE7XCIgOiA5MTgsXG4gICAgXCJFdGE7XCIgOiA5MTksXG4gICAgXCJUaGV0YTtcIiA6IDkyMCxcbiAgICBcIklvdGE7XCIgOiA5MjEsXG4gICAgXCJLYXBwYTtcIiA6IDkyMixcbiAgICBcIkxhbWJkYTtcIiA6IDkyMyxcbiAgICBcIk11O1wiIDogOTI0LFxuICAgIFwiTnU7XCIgOiA5MjUsXG4gICAgXCJYaTtcIiA6IDkyNixcbiAgICBcIk9taWNyb247XCIgOiA5MjcsXG4gICAgXCJQaTtcIiA6IDkyOCxcbiAgICBcIlJobztcIiA6IDkyOSxcbiAgICBcIlNpZ21hO1wiIDogOTMxLFxuICAgIFwiVGF1O1wiIDogOTMyLFxuICAgIFwiVXBzaWxvbjtcIiA6IDkzMyxcbiAgICBcIlBoaTtcIiA6IDkzNCxcbiAgICBcIkNoaTtcIiA6IDkzNSxcbiAgICBcIlBzaTtcIiA6IDkzNixcbiAgICBcIk9tZWdhO1wiIDogOTM3LFxuICAgIFwiYWxwaGE7XCIgOiA5NDUsXG4gICAgXCJiZXRhO1wiIDogOTQ2LFxuICAgIFwiZ2FtbWE7XCIgOiA5NDcsXG4gICAgXCJkZWx0YTtcIiA6IDk0OCxcbiAgICBcImVwc2lsb247XCIgOiA5NDksXG4gICAgXCJ6ZXRhO1wiIDogOTUwLFxuICAgIFwiZXRhO1wiIDogOTUxLFxuICAgIFwidGhldGE7XCIgOiA5NTIsXG4gICAgXCJpb3RhO1wiIDogOTUzLFxuICAgIFwia2FwcGE7XCIgOiA5NTQsXG4gICAgXCJsYW1iZGE7XCIgOiA5NTUsXG4gICAgXCJtdTtcIiA6IDk1NixcbiAgICBcIm51O1wiIDogOTU3LFxuICAgIFwieGk7XCIgOiA5NTgsXG4gICAgXCJvbWljcm9uO1wiIDogOTU5LFxuICAgIFwicGk7XCIgOiA5NjAsXG4gICAgXCJyaG87XCIgOiA5NjEsXG4gICAgXCJzaWdtYWY7XCIgOiA5NjIsXG4gICAgXCJzaWdtYTtcIiA6IDk2MyxcbiAgICBcInRhdTtcIiA6IDk2NCxcbiAgICBcInVwc2lsb247XCIgOiA5NjUsXG4gICAgXCJwaGk7XCIgOiA5NjYsXG4gICAgXCJjaGk7XCIgOiA5NjcsXG4gICAgXCJwc2k7XCIgOiA5NjgsXG4gICAgXCJvbWVnYTtcIiA6IDk2OSxcbiAgICBcInRoZXRhc3ltO1wiIDogOTc3LFxuICAgIFwidXBzaWg7XCIgOiA5NzgsXG4gICAgXCJwaXY7XCIgOiA5ODIsXG4gICAgXCJlbnNwO1wiIDogODE5NCxcbiAgICBcImVtc3A7XCIgOiA4MTk1LFxuICAgIFwidGhpbnNwO1wiIDogODIwMSxcbiAgICBcInp3bmo7XCIgOiA4MjA0LFxuICAgIFwiendqO1wiIDogODIwNSxcbiAgICBcImxybTtcIiA6IDgyMDYsXG4gICAgXCJybG07XCIgOiA4MjA3LFxuICAgIFwibmRhc2g7XCIgOiA4MjExLFxuICAgIFwibWRhc2g7XCIgOiA4MjEyLFxuICAgIFwibHNxdW87XCIgOiA4MjE2LFxuICAgIFwicnNxdW87XCIgOiA4MjE3LFxuICAgIFwic2JxdW87XCIgOiA4MjE4LFxuICAgIFwibGRxdW87XCIgOiA4MjIwLFxuICAgIFwicmRxdW87XCIgOiA4MjIxLFxuICAgIFwiYmRxdW87XCIgOiA4MjIyLFxuICAgIFwiZGFnZ2VyO1wiIDogODIyNCxcbiAgICBcIkRhZ2dlcjtcIiA6IDgyMjUsXG4gICAgXCJidWxsO1wiIDogODIyNixcbiAgICBcImhlbGxpcDtcIiA6IDgyMzAsXG4gICAgXCJwZXJtaWw7XCIgOiA4MjQwLFxuICAgIFwicHJpbWU7XCIgOiA4MjQyLFxuICAgIFwiUHJpbWU7XCIgOiA4MjQzLFxuICAgIFwibHNhcXVvO1wiIDogODI0OSxcbiAgICBcInJzYXF1bztcIiA6IDgyNTAsXG4gICAgXCJvbGluZTtcIiA6IDgyNTQsXG4gICAgXCJmcmFzbDtcIiA6IDgyNjAsXG4gICAgXCJldXJvO1wiIDogODM2NCxcbiAgICBcImltYWdlO1wiIDogODQ2NSxcbiAgICBcIndlaWVycDtcIiA6IDg0NzIsXG4gICAgXCJyZWFsO1wiIDogODQ3NixcbiAgICBcInRyYWRlO1wiIDogODQ4MixcbiAgICBcImFsZWZzeW07XCIgOiA4NTAxLFxuICAgIFwibGFycjtcIiA6IDg1OTIsXG4gICAgXCJ1YXJyO1wiIDogODU5MyxcbiAgICBcInJhcnI7XCIgOiA4NTk0LFxuICAgIFwiZGFycjtcIiA6IDg1OTUsXG4gICAgXCJoYXJyO1wiIDogODU5NixcbiAgICBcImNyYXJyO1wiIDogODYyOSxcbiAgICBcImxBcnI7XCIgOiA4NjU2LFxuICAgIFwidUFycjtcIiA6IDg2NTcsXG4gICAgXCJyQXJyO1wiIDogODY1OCxcbiAgICBcImRBcnI7XCIgOiA4NjU5LFxuICAgIFwiaEFycjtcIiA6IDg2NjAsXG4gICAgXCJmb3JhbGw7XCIgOiA4NzA0LFxuICAgIFwicGFydDtcIiA6IDg3MDYsXG4gICAgXCJleGlzdDtcIiA6IDg3MDcsXG4gICAgXCJlbXB0eTtcIiA6IDg3MDksXG4gICAgXCJuYWJsYTtcIiA6IDg3MTEsXG4gICAgXCJpc2luO1wiIDogODcxMixcbiAgICBcIm5vdGluO1wiIDogODcxMyxcbiAgICBcIm5pO1wiIDogODcxNSxcbiAgICBcInByb2Q7XCIgOiA4NzE5LFxuICAgIFwic3VtO1wiIDogODcyMSxcbiAgICBcIm1pbnVzO1wiIDogODcyMixcbiAgICBcImxvd2FzdDtcIiA6IDg3MjcsXG4gICAgXCJyYWRpYztcIiA6IDg3MzAsXG4gICAgXCJwcm9wO1wiIDogODczMyxcbiAgICBcImluZmluO1wiIDogODczNCxcbiAgICBcImFuZztcIiA6IDg3MzYsXG4gICAgXCJhbmQ7XCIgOiA4NzQzLFxuICAgIFwib3I7XCIgOiA4NzQ0LFxuICAgIFwiY2FwO1wiIDogODc0NSxcbiAgICBcImN1cDtcIiA6IDg3NDYsXG4gICAgXCJpbnQ7XCIgOiA4NzQ3LFxuICAgIFwidGhlcmU0O1wiIDogODc1NixcbiAgICBcInNpbTtcIiA6IDg3NjQsXG4gICAgXCJjb25nO1wiIDogODc3MyxcbiAgICBcImFzeW1wO1wiIDogODc3NixcbiAgICBcIm5lO1wiIDogODgwMCxcbiAgICBcImVxdWl2O1wiIDogODgwMSxcbiAgICBcImxlO1wiIDogODgwNCxcbiAgICBcImdlO1wiIDogODgwNSxcbiAgICBcInN1YjtcIiA6IDg4MzQsXG4gICAgXCJzdXA7XCIgOiA4ODM1LFxuICAgIFwibnN1YjtcIiA6IDg4MzYsXG4gICAgXCJzdWJlO1wiIDogODgzOCxcbiAgICBcInN1cGU7XCIgOiA4ODM5LFxuICAgIFwib3BsdXM7XCIgOiA4ODUzLFxuICAgIFwib3RpbWVzO1wiIDogODg1NSxcbiAgICBcInBlcnA7XCIgOiA4ODY5LFxuICAgIFwic2RvdDtcIiA6IDg5MDEsXG4gICAgXCJsY2VpbDtcIiA6IDg5NjgsXG4gICAgXCJyY2VpbDtcIiA6IDg5NjksXG4gICAgXCJsZmxvb3I7XCIgOiA4OTcwLFxuICAgIFwicmZsb29yO1wiIDogODk3MSxcbiAgICBcImxhbmc7XCIgOiA5MDAxLFxuICAgIFwicmFuZztcIiA6IDkwMDIsXG4gICAgXCJsb3o7XCIgOiA5Njc0LFxuICAgIFwic3BhZGVzO1wiIDogOTgyNCxcbiAgICBcImNsdWJzO1wiIDogOTgyNyxcbiAgICBcImhlYXJ0cztcIiA6IDk4MjksXG4gICAgXCJkaWFtcztcIiA6IDk4MzBcbiAgfVxuXG5cbn0pLmNhbGwodGhpcyk7XG4iLCJ2YXIgWENTU01hdHJpeCA9IHJlcXVpcmUoJy4vbGliL1hDU1NNYXRyaXguanMnKTtcbm1vZHVsZS5leHBvcnRzID0gWENTU01hdHJpeDtcbiIsInZhciB2ZWN0b3IgPSByZXF1aXJlKCcuL3V0aWxzL3ZlY3RvcicpO1xubW9kdWxlLmV4cG9ydHMgPSBWZWN0b3I0O1xuXG4vKipcbiAqIEEgNCBkaW1lbnNpb25hbCB2ZWN0b3JcbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBWZWN0b3I0KHgsIHksIHosIHcpIHtcbiAgdGhpcy54ID0geDtcbiAgdGhpcy55ID0geTtcbiAgdGhpcy56ID0gejtcbiAgdGhpcy53ID0gdztcbiAgdGhpcy5jaGVja1ZhbHVlcygpO1xufVxuXG4vKipcbiAqIEVuc3VyZSB0aGF0IHZhbHVlcyBhcmUgbm90IHVuZGVmaW5lZFxuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMgbnVsbFxuICovXG5cblZlY3RvcjQucHJvdG90eXBlLmNoZWNrVmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMueCA9IHRoaXMueCB8fCAwO1xuICB0aGlzLnkgPSB0aGlzLnkgfHwgMDtcbiAgdGhpcy56ID0gdGhpcy56IHx8IDA7XG4gIHRoaXMudyA9IHRoaXMudyB8fCAwO1xufTtcblxuLyoqXG4gKiBHZXQgdGhlIGxlbmd0aCBvZiB0aGUgdmVjdG9yXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7ZmxvYXR9XG4gKi9cblxuVmVjdG9yNC5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuY2hlY2tWYWx1ZXMoKTtcbiAgcmV0dXJuIHZlY3Rvci5sZW5ndGgodGhpcyk7XG59O1xuXG5cbi8qKlxuICogR2V0IGEgbm9ybWFsaXNlZCByZXByZXNlbnRhdGlvbiBvZiB0aGUgdmVjdG9yXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7VmVjdG9yNH1cbiAqL1xuXG5WZWN0b3I0LnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHZlY3Rvci5ub3JtYWxpemUodGhpcyk7XG59O1xuXG5cbi8qKlxuICogVmVjdG9yIERvdC1Qcm9kdWN0XG4gKiBAcGFyYW0ge1ZlY3RvcjR9IHYgVGhlIHNlY29uZCB2ZWN0b3IgdG8gYXBwbHkgdGhlIHByb2R1Y3QgdG9cbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIHtmbG9hdH0gVGhlIERvdC1Qcm9kdWN0IG9mIHRoaXMgYW5kIHYuXG4gKi9cblxuVmVjdG9yNC5wcm90b3R5cGUuZG90ID0gZnVuY3Rpb24odikge1xuICByZXR1cm4gdmVjdG9yLmRvdCh0aGlzLCB2KTtcbn07XG5cblxuLyoqXG4gKiBWZWN0b3IgQ3Jvc3MtUHJvZHVjdFxuICogQHBhcmFtIHtWZWN0b3I0fSB2IFRoZSBzZWNvbmQgdmVjdG9yIHRvIGFwcGx5IHRoZSBwcm9kdWN0IHRvXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7VmVjdG9yNH0gVGhlIENyb3NzLVByb2R1Y3Qgb2YgdGhpcyBhbmQgdi5cbiAqL1xuXG5WZWN0b3I0LnByb3RvdHlwZS5jcm9zcyA9IGZ1bmN0aW9uKHYpIHtcbiAgcmV0dXJuIHZlY3Rvci5jcm9zcyh0aGlzLCB2KTtcbn07XG5cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gcmVxdWlyZWQgZm9yIG1hdHJpeCBkZWNvbXBvc2l0aW9uXG4gKiBBIEphdmFzY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgcHNldWRvIGNvZGUgYXZhaWxhYmxlIGZyb20gaHR0cDovL3d3dy53My5vcmcvVFIvY3NzMy0yZC10cmFuc2Zvcm1zLyNtYXRyaXgtZGVjb21wb3NpdGlvblxuICogQHBhcmFtIHtWZWN0b3I0fSBhUG9pbnQgQSAzRCBwb2ludFxuICogQHBhcmFtIHtmbG9hdH0gYXNjbFxuICogQHBhcmFtIHtmbG9hdH0gYnNjbFxuICogQGF1dGhvciBKb2UgTGFtYmVydFxuICogQHJldHVybnMge1ZlY3RvcjR9XG4gKi9cblxuVmVjdG9yNC5wcm90b3R5cGUuY29tYmluZSA9IGZ1bmN0aW9uKGJQb2ludCwgYXNjbCwgYnNjbCkge1xuICByZXR1cm4gdmVjdG9yLmNvbWJpbmUodGhpcywgYlBvaW50LCBhc2NsLCBic2NsKTtcbn07XG5cblZlY3RvcjQucHJvdG90eXBlLm11bHRpcGx5QnlNYXRyaXggPSBmdW5jdGlvbiAobWF0cml4KSB7XG4gIHJldHVybiB2ZWN0b3IubXVsdGlwbHlCeU1hdHJpeCh0aGlzLCBtYXRyaXgpO1xufTtcbiIsInZhciB1dGlscyA9IHtcbiAgICBhbmdsZXM6IHJlcXVpcmUoJy4vdXRpbHMvYW5nbGUnKSxcbiAgICBtYXRyaXg6IHJlcXVpcmUoJy4vdXRpbHMvbWF0cml4JyksXG4gICAgdHJhbnNwOiByZXF1aXJlKCcuL3V0aWxzL2Nzc1RyYW5zZm9ybVN0cmluZycpLFxuICAgIGZ1bmNzOiB7XG4gICAgICAgIC8vIEdpdmVuIGEgZnVuY3Rpb24gYGZuYCwgcmV0dXJuIGEgZnVuY3Rpb24gd2hpY2ggY2FsbHMgYGZuYCB3aXRoIG9ubHkgMVxuICAgICAgICAvLyAgIGFyZ3VtZW50LCBubyBtYXR0ZXIgaG93IG1hbnkgYXJlIGdpdmVuLlxuICAgICAgICAvLyBNb3N0IHVzZWZ1bCB3aGVyZSB5b3Ugb25seSB3YW50IHRoZSBmaXJzdCB2YWx1ZSBmcm9tIGEgbWFwL2ZvcmVhY2gvZXRjXG4gICAgICAgIG9ubHlGaXJzdEFyZzogZnVuY3Rpb24gKGZuLCBjb250ZXh0KSB7XG4gICAgICAgICAgICBjb250ZXh0ID0gY29udGV4dCB8fCB0aGlzO1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGZpcnN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLmNhbGwoY29udGV4dCwgZmlyc3QpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxuLyoqXG4gKiAgR2l2ZW4gYSBDU1MgdHJhbnNmb3JtIHN0cmluZyAobGlrZSBgcm90YXRlKDNyYWQpYCwgb3JcbiAqICAgIGBtYXRyaXgoMSwgMCwgMCwgMCwgMSwgMClgKSwgcmV0dXJuIGFuIGluc3RhbmNlIGNvbXBhdGlibGUgd2l0aFxuICogICAgW2BXZWJLaXRDU1NNYXRyaXhgXShodHRwOi8vZGV2ZWxvcGVyLmFwcGxlLmNvbS9saWJyYXJ5L3NhZmFyaS9kb2N1bWVudGF0aW9uL0F1ZGlvVmlkZW8vUmVmZXJlbmNlL1dlYktpdENTU01hdHJpeENsYXNzUmVmZXJlbmNlL1dlYktpdENTU01hdHJpeC9XZWJLaXRDU1NNYXRyaXguaHRtbClcbiAqICBAY29uc3RydWN0b3JcbiAqICBAcGFyYW0ge3N0cmluZ30gZG9tc3RyIC0gYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgYSAyRCBvciAzRCB0cmFuc2Zvcm0gbWF0cml4XG4gKiAgICBpbiB0aGUgZm9ybSBnaXZlbiBieSB0aGUgQ1NTIHRyYW5zZm9ybSBwcm9wZXJ0eSwgaS5lLiBqdXN0IGxpa2UgdGhlXG4gKiAgICBvdXRwdXQgZnJvbSBbW0BsaW5rI3RvU3RyaW5nXV0uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBhIC0gVGhlIGZpcnN0IDJEIHZlY3RvciB2YWx1ZS5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IGIgLSBUaGUgc2Vjb25kIDJEIHZlY3RvciB2YWx1ZS5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IGMgLSBUaGUgdGhpcmQgMkQgdmVjdG9yIHZhbHVlLlxuICogIEBtZW1iZXIge251bWJlcn0gZCAtIFRoZSBmb3VydGggMkQgdmVjdG9yIHZhbHVlLlxuICogIEBtZW1iZXIge251bWJlcn0gZSAtIFRoZSBmaWZ0aCAyRCB2ZWN0b3IgdmFsdWUuXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBmIC0gVGhlIHNpeHRoIDJEIHZlY3RvciB2YWx1ZS5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0xMSAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIGZpcnN0IHJvdyBhbmQgZmlyc3QgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTEyIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZmlyc3Qgcm93IGFuZCBzZWNvbmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTEzIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZmlyc3Qgcm93IGFuZCB0aGlyZCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMTQgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBmaXJzdCByb3cgYW5kIGZvdXJ0aCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMjEgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBzZWNvbmQgcm93IGFuZCBmaXJzdCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMjIgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBzZWNvbmQgcm93IGFuZCBzZWNvbmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTIzIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgc2Vjb25kIHJvdyBhbmQgdGhpcmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTI0IC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgc2Vjb25kIHJvdyBhbmQgZm91cnRoIGNvbHVtbi5cbiAqICBAbWVtYmVyIHtudW1iZXJ9IG0zMSAtIFRoZSAzRCBtYXRyaXggdmFsdWUgaW4gdGhlIHRoaXJkIHJvdyBhbmQgZmlyc3QgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTMyIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgdGhpcmQgcm93IGFuZCBzZWNvbmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTMzIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgdGhpcmQgcm93IGFuZCB0aGlyZCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtMzQgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSB0aGlyZCByb3cgYW5kIGZvdXJ0aCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtNDEgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBmb3VydGggcm93IGFuZCBmaXJzdCBjb2x1bW4uXG4gKiAgQG1lbWJlciB7bnVtYmVyfSBtNDIgLSBUaGUgM0QgbWF0cml4IHZhbHVlIGluIHRoZSBmb3VydGggcm93IGFuZCBzZWNvbmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTQzIC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZm91cnRoIHJvdyBhbmQgdGhpcmQgY29sdW1uLlxuICogIEBtZW1iZXIge251bWJlcn0gbTQ0IC0gVGhlIDNEIG1hdHJpeCB2YWx1ZSBpbiB0aGUgZm91cnRoIHJvdyBhbmQgZm91cnRoIGNvbHVtbi5cbiAqICBAcmV0dXJucyB7WENTU01hdHJpeH0gbWF0cml4XG4gKi9cbmZ1bmN0aW9uIFhDU1NNYXRyaXgoZG9tc3RyKSB7XG4gICAgdGhpcy5tMTEgPSB0aGlzLm0yMiA9IHRoaXMubTMzID0gdGhpcy5tNDQgPSAxO1xuXG4gICAgICAgICAgICAgICB0aGlzLm0xMiA9IHRoaXMubTEzID0gdGhpcy5tMTQgPVxuICAgIHRoaXMubTIxID0gICAgICAgICAgICB0aGlzLm0yMyA9IHRoaXMubTI0ID1cbiAgICB0aGlzLm0zMSA9IHRoaXMubTMyID0gICAgICAgICAgICB0aGlzLm0zNCA9XG4gICAgdGhpcy5tNDEgPSB0aGlzLm00MiA9IHRoaXMubTQzICAgICAgICAgICAgPSAwO1xuXG4gICAgaWYgKHR5cGVvZiBkb21zdHIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuc2V0TWF0cml4VmFsdWUoZG9tc3RyKTtcbiAgICB9XG59XG5cbi8qKlxuICogIFhDU1NNYXRyaXguZGlzcGxheU5hbWUgPSAnWENTU01hdHJpeCdcbiAqL1xuWENTU01hdHJpeC5kaXNwbGF5TmFtZSA9ICdYQ1NTTWF0cml4JztcblxudmFyIHBvaW50czJkID0gWydhJywgJ2InLCAnYycsICdkJywgJ2UnLCAnZiddO1xudmFyIHBvaW50czNkID0gW1xuICAgICdtMTEnLCAnbTEyJywgJ20xMycsICdtMTQnLFxuICAgICdtMjEnLCAnbTIyJywgJ20yMycsICdtMjQnLFxuICAgICdtMzEnLCAnbTMyJywgJ20zMycsICdtMzQnLFxuICAgICdtNDEnLCAnbTQyJywgJ200MycsICdtNDQnXG5dO1xuXG4oW1xuICAgIFsnbTExJywgJ2EnXSxcbiAgICBbJ20xMicsICdiJ10sXG4gICAgWydtMjEnLCAnYyddLFxuICAgIFsnbTIyJywgJ2QnXSxcbiAgICBbJ200MScsICdlJ10sXG4gICAgWydtNDInLCAnZiddXG5dKS5mb3JFYWNoKGZ1bmN0aW9uIChwYWlyKSB7XG4gICAgdmFyIGtleTNkID0gcGFpclswXSwga2V5MmQgPSBwYWlyWzFdO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFhDU1NNYXRyaXgucHJvdG90eXBlLCBrZXkyZCwge1xuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgICAgIHRoaXNba2V5M2RdID0gdmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNba2V5M2RdO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZVxuICAgIH0pO1xufSk7XG5cblxuLyoqXG4gKiAgTXVsdGlwbHkgb25lIG1hdHJpeCBieSBhbm90aGVyXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcGFyYW0ge1hDU1NNYXRyaXh9IG90aGVyTWF0cml4IC0gVGhlIG1hdHJpeCB0byBtdWx0aXBseSB0aGlzIG9uZSBieS5cbiAqL1xuWENTU01hdHJpeC5wcm90b3R5cGUubXVsdGlwbHkgPSBmdW5jdGlvbiAob3RoZXJNYXRyaXgpIHtcbiAgICByZXR1cm4gdXRpbHMubWF0cml4Lm11bHRpcGx5KHRoaXMsIG90aGVyTWF0cml4KTtcbn07XG5cbi8qKlxuICogIElmIHRoZSBtYXRyaXggaXMgaW52ZXJ0aWJsZSwgcmV0dXJucyBpdHMgaW52ZXJzZSwgb3RoZXJ3aXNlIHJldHVybnMgbnVsbC5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlclxuICogIEByZXR1cm5zIHtYQ1NTTWF0cml4fG51bGx9XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLmludmVyc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHV0aWxzLm1hdHJpeC5pbnZlcnNlKHRoaXMpO1xufTtcblxuLyoqXG4gKiAgUmV0dXJucyB0aGUgcmVzdWx0IG9mIHJvdGF0aW5nIHRoZSBtYXRyaXggYnkgYSBnaXZlbiB2ZWN0b3IuXG4gKlxuICogIElmIG9ubHkgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIHByb3ZpZGVkLCB0aGUgbWF0cml4IGlzIG9ubHkgcm90YXRlZCBhYm91dFxuICogIHRoZSB6IGF4aXMuXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcGFyYW0ge251bWJlcn0gcm90WCAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHggYXhpcy5cbiAqICBAcGFyYW0ge251bWJlcn0gcm90WSAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHkgYXhpcy4gSWYgdW5kZWZpbmVkLCB0aGUgeCBjb21wb25lbnQgaXMgdXNlZC5cbiAqICBAcGFyYW0ge251bWJlcn0gcm90WiAtIFRoZSByb3RhdGlvbiBhcm91bmQgdGhlIHogYXhpcy4gSWYgdW5kZWZpbmVkLCB0aGUgeCBjb21wb25lbnQgaXMgdXNlZC5cbiAqICBAcmV0dXJucyBYQ1NTTWF0cml4XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnJvdGF0ZSA9IGZ1bmN0aW9uIChyeCwgcnksIHJ6KSB7XG5cbiAgICBpZiAodHlwZW9mIHJ4ICE9PSAnbnVtYmVyJyB8fCBpc05hTihyeCkpIHJ4ID0gMDtcblxuICAgIGlmICgodHlwZW9mIHJ5ICE9PSAnbnVtYmVyJyB8fCBpc05hTihyeSkpICYmXG4gICAgICAgICh0eXBlb2YgcnogIT09ICdudW1iZXInIHx8IGlzTmFOKHJ6KSkpIHtcbiAgICAgICAgcnogPSByeDtcbiAgICAgICAgcnggPSAwO1xuICAgICAgICByeSA9IDA7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiByeSAhPT0gJ251bWJlcicgfHwgaXNOYU4ocnkpKSByeSA9IDA7XG4gICAgaWYgKHR5cGVvZiByeiAhPT0gJ251bWJlcicgfHwgaXNOYU4ocnopKSByeiA9IDA7XG5cbiAgICByeCA9IHV0aWxzLmFuZ2xlcy5kZWcycmFkKHJ4KTtcbiAgICByeSA9IHV0aWxzLmFuZ2xlcy5kZWcycmFkKHJ5KTtcbiAgICByeiA9IHV0aWxzLmFuZ2xlcy5kZWcycmFkKHJ6KTtcblxuICAgIHZhciB0eCA9IG5ldyBYQ1NTTWF0cml4KCksXG4gICAgICAgIHR5ID0gbmV3IFhDU1NNYXRyaXgoKSxcbiAgICAgICAgdHogPSBuZXcgWENTU01hdHJpeCgpLFxuICAgICAgICBzaW5BLCBjb3NBLCBzcTtcblxuICAgIHJ6IC89IDI7XG4gICAgc2luQSAgPSBNYXRoLnNpbihyeik7XG4gICAgY29zQSAgPSBNYXRoLmNvcyhyeik7XG4gICAgc3EgPSBzaW5BICogc2luQTtcblxuICAgIC8vIE1hdHJpY2VzIGFyZSBpZGVudGl0eSBvdXRzaWRlIHRoZSBhc3NpZ25lZCB2YWx1ZXNcbiAgICB0ei5tMTEgPSB0ei5tMjIgPSAxIC0gMiAqIHNxO1xuICAgIHR6Lm0xMiA9IHR6Lm0yMSA9IDIgKiBzaW5BICogY29zQTtcbiAgICB0ei5tMjEgKj0gLTE7XG5cbiAgICByeSAvPSAyO1xuICAgIHNpbkEgID0gTWF0aC5zaW4ocnkpO1xuICAgIGNvc0EgID0gTWF0aC5jb3MocnkpO1xuICAgIHNxID0gc2luQSAqIHNpbkE7XG5cbiAgICB0eS5tMTEgPSB0eS5tMzMgPSAxIC0gMiAqIHNxO1xuICAgIHR5Lm0xMyA9IHR5Lm0zMSA9IDIgKiBzaW5BICogY29zQTtcbiAgICB0eS5tMTMgKj0gLTE7XG5cbiAgICByeCAvPSAyO1xuICAgIHNpbkEgPSBNYXRoLnNpbihyeCk7XG4gICAgY29zQSA9IE1hdGguY29zKHJ4KTtcbiAgICBzcSA9IHNpbkEgKiBzaW5BO1xuXG4gICAgdHgubTIyID0gdHgubTMzID0gMSAtIDIgKiBzcTtcbiAgICB0eC5tMjMgPSB0eC5tMzIgPSAyICogc2luQSAqIGNvc0E7XG4gICAgdHgubTMyICo9IC0xO1xuXG4gICAgdmFyIGlkZW50aXR5TWF0cml4ID0gbmV3IFhDU1NNYXRyaXgoKTsgLy8gcmV0dXJucyBpZGVudGl0eSBtYXRyaXggYnkgZGVmYXVsdFxuICAgIHZhciBpc0lkZW50aXR5ICAgICA9IHRoaXMudG9TdHJpbmcoKSA9PT0gaWRlbnRpdHlNYXRyaXgudG9TdHJpbmcoKTtcbiAgICB2YXIgcm90YXRlZE1hdHJpeCAgPSBpc0lkZW50aXR5ID9cbiAgICAgICAgICAgIHR6Lm11bHRpcGx5KHR5KS5tdWx0aXBseSh0eCkgOlxuICAgICAgICAgICAgdGhpcy5tdWx0aXBseSh0eCkubXVsdGlwbHkodHkpLm11bHRpcGx5KHR6KTtcblxuICAgIHJldHVybiByb3RhdGVkTWF0cml4O1xufTtcblxuLyoqXG4gKiAgUmV0dXJucyB0aGUgcmVzdWx0IG9mIHJvdGF0aW5nIHRoZSBtYXRyaXggYXJvdW5kIGEgZ2l2ZW4gdmVjdG9yIGJ5IGEgZ2l2ZW5cbiAqICBhbmdsZS5cbiAqXG4gKiAgSWYgdGhlIGdpdmVuIHZlY3RvciBpcyB0aGUgb3JpZ2luIHZlY3RvciB0aGVuIHRoZSBtYXRyaXggaXMgcm90YXRlZCBieSB0aGVcbiAqICBnaXZlbiBhbmdsZSBhcm91bmQgdGhlIHogYXhpcy5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlclxuICogIEBwYXJhbSB7bnVtYmVyfSByb3RYIC0gVGhlIHJvdGF0aW9uIGFyb3VuZCB0aGUgeCBheGlzLlxuICogIEBwYXJhbSB7bnVtYmVyfSByb3RZIC0gVGhlIHJvdGF0aW9uIGFyb3VuZCB0aGUgeSBheGlzLiBJZiB1bmRlZmluZWQsIHRoZSB4IGNvbXBvbmVudCBpcyB1c2VkLlxuICogIEBwYXJhbSB7bnVtYmVyfSByb3RaIC0gVGhlIHJvdGF0aW9uIGFyb3VuZCB0aGUgeiBheGlzLiBJZiB1bmRlZmluZWQsIHRoZSB4IGNvbXBvbmVudCBpcyB1c2VkLlxuICogIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIFRoZSBhbmdsZSBvZiByb3RhdGlvbiBhYm91dCB0aGUgYXhpcyB2ZWN0b3IsIGluIGRlZ3JlZXMuXG4gKiAgQHJldHVybnMgWENTU01hdHJpeFxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5yb3RhdGVBeGlzQW5nbGUgPSBmdW5jdGlvbiAoeCwgeSwgeiwgYSkge1xuICAgIGlmICh0eXBlb2YgeCAhPT0gJ251bWJlcicgfHwgaXNOYU4oeCkpIHggPSAwO1xuICAgIGlmICh0eXBlb2YgeSAhPT0gJ251bWJlcicgfHwgaXNOYU4oeSkpIHkgPSAwO1xuICAgIGlmICh0eXBlb2YgeiAhPT0gJ251bWJlcicgfHwgaXNOYU4oeikpIHogPSAwO1xuICAgIGlmICh0eXBlb2YgYSAhPT0gJ251bWJlcicgfHwgaXNOYU4oYSkpIGEgPSAwO1xuICAgIGlmICh4ID09PSAwICYmIHkgPT09IDAgJiYgeiA9PT0gMCkgeiA9IDE7XG4gICAgYSA9ICh1dGlscy5hbmdsZXMuZGVnMnJhZChhKSB8fCAwKSAvIDI7XG4gICAgdmFyIHQgICAgICAgICA9IG5ldyBYQ1NTTWF0cml4KCksXG4gICAgICAgIGxlbiAgICAgICA9IE1hdGguc3FydCh4ICogeCArIHkgKiB5ICsgeiAqIHopLFxuICAgICAgICBjb3NBICAgICAgPSBNYXRoLmNvcyhhKSxcbiAgICAgICAgc2luQSAgICAgID0gTWF0aC5zaW4oYSksXG4gICAgICAgIHNxICAgICAgICA9IHNpbkEgKiBzaW5BLFxuICAgICAgICBzYyAgICAgICAgPSBzaW5BICogY29zQSxcbiAgICAgICAgcHJlY2lzaW9uID0gZnVuY3Rpb24odikgeyByZXR1cm4gcGFyc2VGbG9hdCgodikudG9GaXhlZCg2KSk7IH0sXG4gICAgICAgIHgyLCB5MiwgejI7XG5cbiAgICAvLyBCYWQgdmVjdG9yLCB1c2Ugc29tZXRoaW5nIHNlbnNpYmxlXG4gICAgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICB4ID0gMDtcbiAgICAgICAgeSA9IDA7XG4gICAgICAgIHogPSAxO1xuICAgIH0gZWxzZSBpZiAobGVuICE9PSAxKSB7XG4gICAgICAgIHggLz0gbGVuO1xuICAgICAgICB5IC89IGxlbjtcbiAgICAgICAgeiAvPSBsZW47XG4gICAgfVxuXG4gICAgLy8gT3B0aW1pc2UgY2FzZXMgd2hlcmUgYXhpcyBpcyBhbG9uZyBtYWpvciBheGlzXG4gICAgaWYgKHggPT09IDEgJiYgeSA9PT0gMCAmJiB6ID09PSAwKSB7XG4gICAgICAgIHQubTIyID0gdC5tMzMgPSAxIC0gMiAqIHNxO1xuICAgICAgICB0Lm0yMyA9IHQubTMyID0gMiAqIHNjO1xuICAgICAgICB0Lm0zMiAqPSAtMTtcbiAgICB9IGVsc2UgaWYgKHggPT09IDAgJiYgeSA9PT0gMSAmJiB6ID09PSAwKSB7XG4gICAgICAgIHQubTExID0gdC5tMzMgPSAxIC0gMiAqIHNxO1xuICAgICAgICB0Lm0xMyA9IHQubTMxID0gMiAqIHNjO1xuICAgICAgICB0Lm0xMyAqPSAtMTtcbiAgICB9IGVsc2UgaWYgKHggPT09IDAgJiYgeSA9PT0gMCAmJiB6ID09PSAxKSB7XG4gICAgICAgIHQubTExID0gdC5tMjIgPSAxIC0gMiAqIHNxO1xuICAgICAgICB0Lm0xMiA9IHQubTIxID0gMiAqIHNjO1xuICAgICAgICB0Lm0yMSAqPSAtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB4MiAgPSB4ICogeDtcbiAgICAgICAgeTIgID0geSAqIHk7XG4gICAgICAgIHoyICA9IHogKiB6O1xuICAgICAgICAvLyBodHRwOi8vZGV2LnczLm9yZy9jc3N3Zy9jc3MtdHJhbnNmb3Jtcy8jbWF0aGVtYXRpY2FsLWRlc2NyaXB0aW9uXG4gICAgICAgIHQubTExID0gcHJlY2lzaW9uKDEgLSAyICogKHkyICsgejIpICogc3EpO1xuICAgICAgICB0Lm0xMiA9IHByZWNpc2lvbigyICogKHggKiB5ICogc3EgKyB6ICogc2MpKTtcbiAgICAgICAgdC5tMTMgPSBwcmVjaXNpb24oMiAqICh4ICogeiAqIHNxIC0geSAqIHNjKSk7XG4gICAgICAgIHQubTIxID0gcHJlY2lzaW9uKDIgKiAoeCAqIHkgKiBzcSAtIHogKiBzYykpO1xuICAgICAgICB0Lm0yMiA9IHByZWNpc2lvbigxIC0gMiAqICh4MiArIHoyKSAqIHNxKTtcbiAgICAgICAgdC5tMjMgPSBwcmVjaXNpb24oMiAqICh5ICogeiAqIHNxICsgeCAqIHNjKSk7XG4gICAgICAgIHQubTMxID0gcHJlY2lzaW9uKDIgKiAoeCAqIHogKiBzcSArIHkgKiBzYykpO1xuICAgICAgICB0Lm0zMiA9IHByZWNpc2lvbigyICogKHkgKiB6ICogc3EgLSB4ICogc2MpKTtcbiAgICAgICAgdC5tMzMgPSBwcmVjaXNpb24oMSAtIDIgKiAoeDIgKyB5MikgKiBzcSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkodCk7XG59O1xuXG4vKipcbiAqICBSZXR1cm5zIHRoZSByZXN1bHQgb2Ygc2NhbGluZyB0aGUgbWF0cml4IGJ5IGEgZ2l2ZW4gdmVjdG9yLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHNjYWxlWCAtIHRoZSBzY2FsaW5nIGZhY3RvciBpbiB0aGUgeCBheGlzLlxuICogIEBwYXJhbSB7bnVtYmVyfSBzY2FsZVkgLSB0aGUgc2NhbGluZyBmYWN0b3IgaW4gdGhlIHkgYXhpcy4gSWYgdW5kZWZpbmVkLCB0aGUgeCBjb21wb25lbnQgaXMgdXNlZC5cbiAqICBAcGFyYW0ge251bWJlcn0gc2NhbGVaIC0gdGhlIHNjYWxpbmcgZmFjdG9yIGluIHRoZSB6IGF4aXMuIElmIHVuZGVmaW5lZCwgMSBpcyB1c2VkLlxuICogIEByZXR1cm5zIFhDU1NNYXRyaXhcbiAqL1xuWENTU01hdHJpeC5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbiAoc2NhbGVYLCBzY2FsZVksIHNjYWxlWikge1xuICAgIHZhciB0cmFuc2Zvcm0gPSBuZXcgWENTU01hdHJpeCgpO1xuXG4gICAgaWYgKHR5cGVvZiBzY2FsZVggIT09ICdudW1iZXInIHx8IGlzTmFOKHNjYWxlWCkpIHNjYWxlWCA9IDE7XG4gICAgaWYgKHR5cGVvZiBzY2FsZVkgIT09ICdudW1iZXInIHx8IGlzTmFOKHNjYWxlWSkpIHNjYWxlWSA9IHNjYWxlWDtcbiAgICBpZiAodHlwZW9mIHNjYWxlWiAhPT0gJ251bWJlcicgfHwgaXNOYU4oc2NhbGVaKSkgc2NhbGVaID0gMTtcblxuICAgIHRyYW5zZm9ybS5tMTEgPSBzY2FsZVg7XG4gICAgdHJhbnNmb3JtLm0yMiA9IHNjYWxlWTtcbiAgICB0cmFuc2Zvcm0ubTMzID0gc2NhbGVaO1xuXG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkodHJhbnNmb3JtKTtcbn07XG5cbi8qKlxuICogIFJldHVybnMgdGhlIHJlc3VsdCBvZiBza2V3aW5nIHRoZSBtYXRyaXggYnkgYSBnaXZlbiB2ZWN0b3IuXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcGFyYW0ge251bWJlcn0gc2tld1ggLSBUaGUgc2NhbGluZyBmYWN0b3IgaW4gdGhlIHggYXhpcy5cbiAqICBAcmV0dXJucyBYQ1NTTWF0cml4XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnNrZXdYID0gZnVuY3Rpb24gKGRlZ3JlZXMpIHtcbiAgICB2YXIgcmFkaWFucyAgID0gdXRpbHMuYW5nbGVzLmRlZzJyYWQoZGVncmVlcyk7XG4gICAgdmFyIHRyYW5zZm9ybSA9IG5ldyBYQ1NTTWF0cml4KCk7XG5cbiAgICB0cmFuc2Zvcm0uYyA9IE1hdGgudGFuKHJhZGlhbnMpO1xuXG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkodHJhbnNmb3JtKTtcbn07XG5cbi8qKlxuICogIFJldHVybnMgdGhlIHJlc3VsdCBvZiBza2V3aW5nIHRoZSBtYXRyaXggYnkgYSBnaXZlbiB2ZWN0b3IuXG4gKiAgQG1ldGhvZFxuICogIEBtZW1iZXJcbiAqICBAcGFyYW0ge251bWJlcn0gc2tld1kgLSB0aGUgc2NhbGluZyBmYWN0b3IgaW4gdGhlIHggYXhpcy5cbiAqICBAcmV0dXJucyBYQ1NTTWF0cml4XG4gKi9cblhDU1NNYXRyaXgucHJvdG90eXBlLnNrZXdZID0gZnVuY3Rpb24gKGRlZ3JlZXMpIHtcbiAgICB2YXIgcmFkaWFucyAgID0gdXRpbHMuYW5nbGVzLmRlZzJyYWQoZGVncmVlcyk7XG4gICAgdmFyIHRyYW5zZm9ybSA9IG5ldyBYQ1NTTWF0cml4KCk7XG5cbiAgICB0cmFuc2Zvcm0uYiA9IE1hdGgudGFuKHJhZGlhbnMpO1xuXG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkodHJhbnNmb3JtKTtcbn07XG5cbi8qKlxuICogIFJldHVybnMgdGhlIHJlc3VsdCBvZiB0cmFuc2xhdGluZyB0aGUgbWF0cml4IGJ5IGEgZ2l2ZW4gdmVjdG9yLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAqICBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICogIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHogY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuIElmIHVuZGVmaW5lZCwgMCBpcyB1c2VkLlxuICogIEByZXR1cm5zIFhDU1NNYXRyaXhcbiAqL1xuWENTU01hdHJpeC5wcm90b3R5cGUudHJhbnNsYXRlID0gZnVuY3Rpb24gKHgsIHksIHopIHtcbiAgICB2YXIgdCA9IG5ldyBYQ1NTTWF0cml4KCk7XG5cbiAgICBpZiAodHlwZW9mIHggIT09ICdudW1iZXInIHx8IGlzTmFOKHgpKSB4ID0gMDtcbiAgICBpZiAodHlwZW9mIHkgIT09ICdudW1iZXInIHx8IGlzTmFOKHkpKSB5ID0gMDtcbiAgICBpZiAodHlwZW9mIHogIT09ICdudW1iZXInIHx8IGlzTmFOKHopKSB6ID0gMDtcblxuICAgIHQubTQxID0geDtcbiAgICB0Lm00MiA9IHk7XG4gICAgdC5tNDMgPSB6O1xuXG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkodCk7XG59O1xuXG4vKipcbiAqICBTZXRzIHRoZSBtYXRyaXggdmFsdWVzIHVzaW5nIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uLCBzdWNoIGFzIHRoYXQgcHJvZHVjZWRcbiAqICBieSB0aGUgW1tYQ1NTTWF0cml4I3RvU3RyaW5nXV0gbWV0aG9kLlxuICogIEBtZXRob2RcbiAqICBAbWVtYmVyXG4gKiAgQHBhcmFtcyB7c3RyaW5nfSBkb21zdHIgLSBBIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIDJEIG9yIDNEIHRyYW5zZm9ybSBtYXRyaXhcbiAqICAgIGluIHRoZSBmb3JtIGdpdmVuIGJ5IHRoZSBDU1MgdHJhbnNmb3JtIHByb3BlcnR5LCBpLmUuIGp1c3QgbGlrZSB0aGVcbiAqICAgIG91dHB1dCBmcm9tIFtbWENTU01hdHJpeCN0b1N0cmluZ11dLlxuICogIEByZXR1cm5zIHVuZGVmaW5lZFxuICovXG5YQ1NTTWF0cml4LnByb3RvdHlwZS5zZXRNYXRyaXhWYWx1ZSA9IGZ1bmN0aW9uIChkb21zdHIpIHtcblxuICAgIHZhciBtYXRyaXhTdHJpbmcgPSB0b01hdHJpeFN0cmluZyhkb21zdHIudHJpbSgpKTtcbiAgICB2YXIgbWF0cml4T2JqZWN0ID0gdXRpbHMudHJhbnNwLnN0YXRlbWVudFRvT2JqZWN0KG1hdHJpeFN0cmluZyk7XG5cbiAgICBpZiAoIW1hdHJpeE9iamVjdCkgcmV0dXJuO1xuXG4gICAgdmFyIGlzM2QgICA9IG1hdHJpeE9iamVjdC5rZXkgPT09IHV0aWxzLnRyYW5zcC5tYXRyaXhGbjNkO1xuICAgIHZhciBrZXlnZW4gPSBpczNkID8gaW5kZXh0b0tleTNkIDogaW5kZXh0b0tleTJkO1xuICAgIHZhciB2YWx1ZXMgPSBtYXRyaXhPYmplY3QudmFsdWU7XG4gICAgdmFyIGNvdW50ICA9IHZhbHVlcy5sZW5ndGg7XG5cbiAgICBpZiAoKGlzM2QgJiYgY291bnQgIT09IDE2KSB8fCAhKGlzM2QgfHwgY291bnQgPT09IDYpKSByZXR1cm47XG5cbiAgICB2YWx1ZXMuZm9yRWFjaChmdW5jdGlvbiAob2JqLCBpKSB7XG4gICAgICAgIHZhciBrZXkgPSBrZXlnZW4oaSk7XG4gICAgICAgIHRoaXNba2V5XSA9IG9iai52YWx1ZTtcbiAgICB9LCB0aGlzKTtcbn07XG5cbmZ1bmN0aW9uIGluZGV4dG9LZXkyZCAoaW5kZXgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShpbmRleCArIDk3KTsgLy8gQVNDSUkgY2hhciA5NyA9PSAnYSdcbn1cblxuZnVuY3Rpb24gaW5kZXh0b0tleTNkIChpbmRleCkge1xuICAgIHJldHVybiAoJ20nICsgKE1hdGguZmxvb3IoaW5kZXggLyA0KSArIDEpKSArIChpbmRleCAlIDQgKyAxKTtcbn1cbi8qKlxuICogIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG1hdHJpeC5cbiAqICBAbWV0aG9kXG4gKiAgQG1lbWJlcm9mIFhDU1NNYXRyaXhcbiAqICBAcmV0dXJucyB7c3RyaW5nfSBtYXRyaXhTdHJpbmcgLSBhIHN0cmluZyBsaWtlIGBtYXRyaXgoMS4wMDAwMDAsIDAuMDAwMDAwLCAwLjAwMDAwMCwgMS4wMDAwMDAsIDAuMDAwMDAwLCAwLjAwMDAwMClgXG4gKlxuICoqL1xuWENTU01hdHJpeC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHBvaW50cywgcHJlZml4O1xuXG4gICAgaWYgKHV0aWxzLm1hdHJpeC5pc0FmZmluZSh0aGlzKSkge1xuICAgICAgICBwcmVmaXggPSB1dGlscy50cmFuc3AubWF0cml4Rm4yZDtcbiAgICAgICAgcG9pbnRzID0gcG9pbnRzMmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJlZml4ID0gdXRpbHMudHJhbnNwLm1hdHJpeEZuM2Q7XG4gICAgICAgIHBvaW50cyA9IHBvaW50czNkO1xuICAgIH1cblxuICAgIHJldHVybiBwcmVmaXggKyAnKCcgK1xuICAgICAgICBwb2ludHMubWFwKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1twXS50b0ZpeGVkKDYpO1xuICAgICAgICB9LCB0aGlzKSAuam9pbignLCAnKSArXG4gICAgICAgICcpJztcbn07XG5cbi8vID09PT09PSB0b01hdHJpeFN0cmluZyA9PT09PT0gLy9cbnZhciBqc0Z1bmN0aW9ucyA9IHtcbiAgICBtYXRyaXg6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHZhciBtMiA9IG5ldyBYQ1NTTWF0cml4KG8udW5wYXJzZWQpO1xuXG4gICAgICAgIHJldHVybiBtLm11bHRpcGx5KG0yKTtcbiAgICB9LFxuICAgIG1hdHJpeDNkOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICB2YXIgbTIgPSBuZXcgWENTU01hdHJpeChvLnVucGFyc2VkKTtcblxuICAgICAgICByZXR1cm4gbS5tdWx0aXBseShtMik7XG4gICAgfSxcblxuICAgIHBlcnNwZWN0aXZlOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICB2YXIgbTIgPSBuZXcgWENTU01hdHJpeCgpO1xuICAgICAgICBtMi5tMzQgLT0gMSAvIG8udmFsdWVbMF0udmFsdWU7XG5cbiAgICAgICAgcmV0dXJuIG0ubXVsdGlwbHkobTIpO1xuICAgIH0sXG5cbiAgICByb3RhdGU6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnJvdGF0ZS5hcHBseShtLCBvLnZhbHVlLm1hcChvYmplY3RWYWx1ZXMpKTtcbiAgICB9LFxuICAgIHJvdGF0ZTNkOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5yb3RhdGVBeGlzQW5nbGUuYXBwbHkobSwgby52YWx1ZS5tYXAob2JqZWN0VmFsdWVzKSk7XG4gICAgfSxcbiAgICByb3RhdGVYOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5yb3RhdGUuYXBwbHkobSwgW28udmFsdWVbMF0udmFsdWUsIDAsIDBdKTtcbiAgICB9LFxuICAgIHJvdGF0ZVk6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnJvdGF0ZS5hcHBseShtLCBbMCwgby52YWx1ZVswXS52YWx1ZSwgMF0pO1xuICAgIH0sXG4gICAgcm90YXRlWjogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0ucm90YXRlLmFwcGx5KG0sIFswLCAwLCBvLnZhbHVlWzBdLnZhbHVlXSk7XG4gICAgfSxcblxuICAgIHNjYWxlOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5zY2FsZS5hcHBseShtLCBvLnZhbHVlLm1hcChvYmplY3RWYWx1ZXMpKTtcbiAgICB9LFxuICAgIHNjYWxlM2Q6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnNjYWxlLmFwcGx5KG0sIG8udmFsdWUubWFwKG9iamVjdFZhbHVlcykpO1xuICAgIH0sXG4gICAgc2NhbGVYOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS5zY2FsZS5hcHBseShtLCBvLnZhbHVlLm1hcChvYmplY3RWYWx1ZXMpKTtcbiAgICB9LFxuICAgIHNjYWxlWTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0uc2NhbGUuYXBwbHkobSwgWzAsIG8udmFsdWVbMF0udmFsdWUsIDBdKTtcbiAgICB9LFxuICAgIHNjYWxlWjogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0uc2NhbGUuYXBwbHkobSwgWzAsIDAsIG8udmFsdWVbMF0udmFsdWVdKTtcbiAgICB9LFxuXG4gICAgc2tldzogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgdmFyIG1YID0gbmV3IFhDU1NNYXRyaXgoJ3NrZXdYKCcgKyBvLnZhbHVlWzBdLnVucGFyc2VkICsgJyknKTtcbiAgICAgICAgdmFyIG1ZID0gbmV3IFhDU1NNYXRyaXgoJ3NrZXdZKCcgKyAoby52YWx1ZVsxXSYmby52YWx1ZVsxXS51bnBhcnNlZCB8fCAwKSArICcpJyk7XG4gICAgICAgIHZhciBzTSA9ICdtYXRyaXgoMS4wMDAwMCwgJysgbVkuYiArJywgJysgbVguYyArJywgMS4wMDAwMDAsIDAuMDAwMDAwLCAwLjAwMDAwMCknO1xuICAgICAgICB2YXIgbTIgPSBuZXcgWENTU01hdHJpeChzTSk7XG5cbiAgICAgICAgcmV0dXJuIG0ubXVsdGlwbHkobTIpO1xuICAgIH0sXG4gICAgc2tld1g6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnNrZXdYLmFwcGx5KG0sIFtvLnZhbHVlWzBdLnZhbHVlXSk7XG4gICAgfSxcbiAgICBza2V3WTogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0uc2tld1kuYXBwbHkobSwgW28udmFsdWVbMF0udmFsdWVdKTtcbiAgICB9LFxuXG4gICAgdHJhbnNsYXRlOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS50cmFuc2xhdGUuYXBwbHkobSwgby52YWx1ZS5tYXAob2JqZWN0VmFsdWVzKSk7XG4gICAgfSxcbiAgICB0cmFuc2xhdGUzZDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0udHJhbnNsYXRlLmFwcGx5KG0sIG8udmFsdWUubWFwKG9iamVjdFZhbHVlcykpO1xuICAgIH0sXG4gICAgdHJhbnNsYXRlWDogZnVuY3Rpb24gKG0sIG8pIHtcbiAgICAgICAgcmV0dXJuIG0udHJhbnNsYXRlLmFwcGx5KG0sIFtvLnZhbHVlWzBdLnZhbHVlLCAwLCAwXSk7XG4gICAgfSxcbiAgICB0cmFuc2xhdGVZOiBmdW5jdGlvbiAobSwgbykge1xuICAgICAgICByZXR1cm4gbS50cmFuc2xhdGUuYXBwbHkobSwgWzAsIG8udmFsdWVbMF0udmFsdWUsIDBdKTtcbiAgICB9LFxuICAgIHRyYW5zbGF0ZVo6IGZ1bmN0aW9uIChtLCBvKSB7XG4gICAgICAgIHJldHVybiBtLnRyYW5zbGF0ZS5hcHBseShtLCBbMCwgMCwgby52YWx1ZVswXS52YWx1ZV0pO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG9iamVjdFZhbHVlcyhvYmopIHtcbiAgICByZXR1cm4gb2JqLnZhbHVlO1xufVxuXG5mdW5jdGlvbiBjc3NGdW5jdGlvblRvSnNGdW5jdGlvbihjc3NGdW5jdGlvbk5hbWUpIHtcbiAgICByZXR1cm4ganNGdW5jdGlvbnNbY3NzRnVuY3Rpb25OYW1lXTtcbn1cblxuZnVuY3Rpb24gcGFyc2VkVG9EZWdyZWVzKHBhcnNlZCkge1xuICAgIGlmIChwYXJzZWQudW5pdHMgPT09ICdyYWQnKSB7XG4gICAgICAgIHBhcnNlZC52YWx1ZSA9IHV0aWxzLmFuZ2xlcy5yYWQyZGVnKHBhcnNlZC52YWx1ZSk7XG4gICAgICAgIHBhcnNlZC51bml0cyA9ICdkZWcnO1xuICAgIH1cbiAgICBlbHNlIGlmIChwYXJzZWQudW5pdHMgPT09ICdncmFkJykge1xuICAgICAgICBwYXJzZWQudmFsdWUgPSB1dGlscy5hbmdsZXMuZ3JhZDJkZWcocGFyc2VkLnZhbHVlKTtcbiAgICAgICAgcGFyc2VkLnVuaXRzID0gJ2RlZyc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlZDtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtTWF0cml4KG1hdHJpeCwgb3BlcmF0aW9uKSB7XG4gICAgLy8gY29udmVydCB0byBkZWdyZWVzIGJlY2F1c2UgYWxsIENTU01hdHJpeCBtZXRob2RzIGV4cGVjdCBkZWdyZWVzXG4gICAgb3BlcmF0aW9uLnZhbHVlID0gb3BlcmF0aW9uLnZhbHVlLm1hcChwYXJzZWRUb0RlZ3JlZXMpO1xuXG4gICAgdmFyIGpzRnVuY3Rpb24gPSBjc3NGdW5jdGlvblRvSnNGdW5jdGlvbihvcGVyYXRpb24ua2V5KTtcbiAgICB2YXIgcmVzdWx0ICAgICA9IGpzRnVuY3Rpb24obWF0cml4LCBvcGVyYXRpb24pO1xuXG4gICAgcmV0dXJuIHJlc3VsdCB8fCBtYXRyaXg7XG59XG5cbi8qKlxuICogIFRyYW5mb3JtcyBhIGBlbC5zdHlsZS5XZWJraXRUcmFuc2Zvcm1gLXN0eWxlIHN0cmluZ1xuICogIChsaWtlIGByb3RhdGUoMThyYWQpIHRyYW5zbGF0ZTNkKDUwcHgsIDEwMHB4LCAxMHB4KWApXG4gKiAgaW50byBhIGBnZXRDb21wdXRlZFN0eWxlKGVsKWAtc3R5bGUgbWF0cml4IHN0cmluZ1xuICogIChsaWtlIGBtYXRyaXgzZCgwLjY2MDMxNiwgLTAuNzUwOTg3LCAwLCAwLCAwLjc1MDk4NywgMC42NjAzMTYsIDAsIDAsIDAsIDAsIDEsIDAsIDEwOC4xMTQ1NjAsIDI4LjQ4MjMwOCwgMTAsIDEpYClcbiAqICBAcHJpdmF0ZVxuICogIEBtZXRob2RcbiAqICBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtU3RyaW5nIC0gYGVsLnN0eWxlLldlYmtpdFRyYW5zZm9ybWAtc3R5bGUgc3RyaW5nIChsaWtlIGByb3RhdGUoMThyYWQpIHRyYW5zbGF0ZTNkKDUwcHgsIDEwMHB4LCAxMHB4KWApXG4gKi9cbmZ1bmN0aW9uIHRvTWF0cml4U3RyaW5nKHRyYW5zZm9ybVN0cmluZykge1xuICAgIHZhciBzdGF0ZW1lbnRzID0gdXRpbHMudHJhbnNwLnN0cmluZ1RvU3RhdGVtZW50cyh0cmFuc2Zvcm1TdHJpbmcpO1xuXG4gICAgaWYgKHN0YXRlbWVudHMubGVuZ3RoID09PSAxICYmICgvXm1hdHJpeC8pLnRlc3QodHJhbnNmb3JtU3RyaW5nKSkge1xuICAgICAgICByZXR1cm4gdHJhbnNmb3JtU3RyaW5nO1xuICAgIH1cblxuICAgIC8vIFdlIG9ubHkgd2FudCB0aGUgc3RhdGVtZW50IHRvIHBhc3MgdG8gYHV0aWxzLnRyYW5zcC5zdGF0ZW1lbnRUb09iamVjdGBcbiAgICAvLyAgIG5vdCB0aGUgb3RoZXIgdmFsdWVzIChpbmRleCwgbGlzdCkgZnJvbSBgbWFwYFxuICAgIHZhciBzdGF0ZW1lbnRUb09iamVjdCA9IHV0aWxzLmZ1bmNzLm9ubHlGaXJzdEFyZyh1dGlscy50cmFuc3Auc3RhdGVtZW50VG9PYmplY3QpO1xuICAgIHZhciBvcGVyYXRpb25zICAgICAgICA9IHN0YXRlbWVudHMubWFwKHN0YXRlbWVudFRvT2JqZWN0KTtcbiAgICB2YXIgc3RhcnRpbmdNYXRyaXggICAgPSBuZXcgWENTU01hdHJpeCgpO1xuICAgIHZhciB0cmFuc2Zvcm1lZE1hdHJpeCA9IG9wZXJhdGlvbnMucmVkdWNlKHRyYW5zZm9ybU1hdHJpeCwgc3RhcnRpbmdNYXRyaXgpO1xuICAgIHZhciBtYXRyaXhTdHJpbmcgICAgICA9IHRyYW5zZm9ybWVkTWF0cml4LnRvU3RyaW5nKCk7XG5cbiAgICByZXR1cm4gbWF0cml4U3RyaW5nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFhDU1NNYXRyaXg7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGVnMnJhZDogZGVnMnJhZCxcbiAgcmFkMmRlZzogcmFkMmRlZyxcbiAgZ3JhZDJkZWc6IGdyYWQyZGVnXG59O1xuXG4vKipcbiAqICBDb252ZXJ0cyBhbmdsZXMgaW4gZGVncmVlcywgd2hpY2ggYXJlIHVzZWQgYnkgdGhlIGV4dGVybmFsIEFQSSwgdG8gYW5nbGVzXG4gKiAgaW4gcmFkaWFucyB1c2VkIGluIGludGVybmFsIGNhbGN1bGF0aW9ucy5cbiAqICBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBBbiBhbmdsZSBpbiBkZWdyZWVzLlxuICogIEByZXR1cm5zIHtudW1iZXJ9IHJhZGlhbnNcbiAqL1xuZnVuY3Rpb24gZGVnMnJhZChhbmdsZSkge1xuICAgIHJldHVybiBhbmdsZSAqIE1hdGguUEkgLyAxODA7XG59XG5cbmZ1bmN0aW9uIHJhZDJkZWcocmFkaWFucykge1xuICAgIHJldHVybiByYWRpYW5zICogKDE4MCAvIE1hdGguUEkpO1xufVxuXG5mdW5jdGlvbiBncmFkMmRlZyhncmFkaWFucykge1xuICAgIC8vIDQwMCBncmFkaWFucyBpbiAzNjAgZGVncmVlc1xuICAgIHJldHVybiBncmFkaWFucyAvICg0MDAgLyAzNjApO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgbWF0cml4Rm4yZDogJ21hdHJpeCcsXG4gICAgbWF0cml4Rm4zZDogJ21hdHJpeDNkJyxcbiAgICB2YWx1ZVRvT2JqZWN0OiB2YWx1ZVRvT2JqZWN0LFxuICAgIHN0YXRlbWVudFRvT2JqZWN0OiBzdGF0ZW1lbnRUb09iamVjdCxcbiAgICBzdHJpbmdUb1N0YXRlbWVudHM6IHN0cmluZ1RvU3RhdGVtZW50c1xufTtcblxuZnVuY3Rpb24gdmFsdWVUb09iamVjdCh2YWx1ZSkge1xuICAgIHZhciB1bml0cyA9IC8oW1xcLVxcK10/WzAtOV0rW1xcLjAtOV0qKShkZWd8cmFkfGdyYWR8cHh8JSkqLztcbiAgICB2YXIgcGFydHMgPSB2YWx1ZS5tYXRjaCh1bml0cykgfHwgW107XG5cbiAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogcGFyc2VGbG9hdChwYXJ0c1sxXSksXG4gICAgICAgIHVuaXRzOiBwYXJ0c1syXSxcbiAgICAgICAgdW5wYXJzZWQ6IHZhbHVlXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gc3RhdGVtZW50VG9PYmplY3Qoc3RhdGVtZW50LCBza2lwVmFsdWVzKSB7XG4gICAgdmFyIG5hbWVBbmRBcmdzICAgID0gLyhcXHcrKVxcKChbXlxcKV0rKVxcKS9pO1xuICAgIHZhciBzdGF0ZW1lbnRQYXJ0cyA9IHN0YXRlbWVudC50b1N0cmluZygpLm1hdGNoKG5hbWVBbmRBcmdzKS5zbGljZSgxKTtcbiAgICB2YXIgZnVuY3Rpb25OYW1lICAgPSBzdGF0ZW1lbnRQYXJ0c1swXTtcbiAgICB2YXIgc3RyaW5nVmFsdWVzICAgPSBzdGF0ZW1lbnRQYXJ0c1sxXS5zcGxpdCgvLCA/Lyk7XG4gICAgdmFyIHBhcnNlZFZhbHVlcyAgID0gIXNraXBWYWx1ZXMgJiYgc3RyaW5nVmFsdWVzLm1hcCh2YWx1ZVRvT2JqZWN0KTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGtleTogZnVuY3Rpb25OYW1lLFxuICAgICAgICB2YWx1ZTogcGFyc2VkVmFsdWVzIHx8IHN0cmluZ1ZhbHVlcyxcbiAgICAgICAgdW5wYXJzZWQ6IHN0YXRlbWVudFxuICAgIH07XG59XG5cbmZ1bmN0aW9uIHN0cmluZ1RvU3RhdGVtZW50cyh0cmFuc2Zvcm1TdHJpbmcpIHtcbiAgICB2YXIgZnVuY3Rpb25TaWduYXR1cmUgICA9IC8oXFx3KylcXChbXlxcKV0rXFwpL2lnO1xuICAgIHZhciB0cmFuc2Zvcm1TdGF0ZW1lbnRzID0gdHJhbnNmb3JtU3RyaW5nLm1hdGNoKGZ1bmN0aW9uU2lnbmF0dXJlKSB8fCBbXTtcblxuICAgIHJldHVybiB0cmFuc2Zvcm1TdGF0ZW1lbnRzO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRldGVybWluYW50MngyOiBkZXRlcm1pbmFudDJ4MixcbiAgZGV0ZXJtaW5hbnQzeDM6IGRldGVybWluYW50M3gzLFxuICBkZXRlcm1pbmFudDR4NDogZGV0ZXJtaW5hbnQ0eDQsXG4gIGlzQWZmaW5lOiBpc0FmZmluZSxcbiAgaXNJZGVudGl0eU9yVHJhbnNsYXRpb246IGlzSWRlbnRpdHlPclRyYW5zbGF0aW9uLFxuICBhZGpvaW50OiBhZGpvaW50LFxuICBpbnZlcnNlOiBpbnZlcnNlLFxuICBtdWx0aXBseTogbXVsdGlwbHksXG4gIGRlY29tcG9zZTogZGVjb21wb3NlXG59O1xuXG4vKipcbiAqICBDYWxjdWxhdGVzIHRoZSBkZXRlcm1pbmFudCBvZiBhIDJ4MiBtYXRyaXguXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGEgLSBUb3AtbGVmdCB2YWx1ZSBvZiB0aGUgbWF0cml4LlxuICogIEBwYXJhbSB7bnVtYmVyfSBiIC0gVG9wLXJpZ2h0IHZhbHVlIG9mIHRoZSBtYXRyaXguXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGMgLSBCb3R0b20tbGVmdCB2YWx1ZSBvZiB0aGUgbWF0cml4LlxuICogIEBwYXJhbSB7bnVtYmVyfSBkIC0gQm90dG9tLXJpZ2h0IHZhbHVlIG9mIHRoZSBtYXRyaXguXG4gKiAgQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gZGV0ZXJtaW5hbnQyeDIoYSwgYiwgYywgZCkge1xuICAgIHJldHVybiBhICogZCAtIGIgKiBjO1xufVxuXG4vKipcbiAqICBDYWxjdWxhdGVzIHRoZSBkZXRlcm1pbmFudCBvZiBhIDN4MyBtYXRyaXguXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGExIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFsxLCAxXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYTIgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzEsIDJdLlxuICogIEBwYXJhbSB7bnVtYmVyfSBhMyAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMSwgM10uXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGIxIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFsyLCAxXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYjIgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzIsIDJdLlxuICogIEBwYXJhbSB7bnVtYmVyfSBiMyAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMiwgM10uXG4gKiAgQHBhcmFtIHtudW1iZXJ9IGMxIC0gTWF0cml4IHZhbHVlIGluIHBvc2l0aW9uIFszLCAxXS5cbiAqICBAcGFyYW0ge251bWJlcn0gYzIgLSBNYXRyaXggdmFsdWUgaW4gcG9zaXRpb24gWzMsIDJdLlxuICogIEBwYXJhbSB7bnVtYmVyfSBjMyAtIE1hdHJpeCB2YWx1ZSBpbiBwb3NpdGlvbiBbMywgM10uXG4gKiAgQHJldHVybnMge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gZGV0ZXJtaW5hbnQzeDMoYTEsIGEyLCBhMywgYjEsIGIyLCBiMywgYzEsIGMyLCBjMykge1xuXG4gICAgcmV0dXJuIGExICogZGV0ZXJtaW5hbnQyeDIoYjIsIGIzLCBjMiwgYzMpIC1cbiAgICAgICAgICAgYjEgKiBkZXRlcm1pbmFudDJ4MihhMiwgYTMsIGMyLCBjMykgK1xuICAgICAgICAgICBjMSAqIGRldGVybWluYW50MngyKGEyLCBhMywgYjIsIGIzKTtcbn1cblxuLyoqXG4gKiAgQ2FsY3VsYXRlcyB0aGUgZGV0ZXJtaW5hbnQgb2YgYSA0eDQgbWF0cml4LlxuICogIEBwYXJhbSB7WENTU01hdHJpeH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byBjYWxjdWxhdGUgdGhlIGRldGVybWluYW50IG9mLlxuICogIEByZXR1cm5zIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGRldGVybWluYW50NHg0KG1hdHJpeCkge1xuICAgIHZhclxuICAgICAgICBtID0gbWF0cml4LFxuICAgICAgICAvLyBBc3NpZ24gdG8gaW5kaXZpZHVhbCB2YXJpYWJsZSBuYW1lcyB0byBhaWQgc2VsZWN0aW5nIGNvcnJlY3QgZWxlbWVudHNcbiAgICAgICAgYTEgPSBtLm0xMSwgYjEgPSBtLm0yMSwgYzEgPSBtLm0zMSwgZDEgPSBtLm00MSxcbiAgICAgICAgYTIgPSBtLm0xMiwgYjIgPSBtLm0yMiwgYzIgPSBtLm0zMiwgZDIgPSBtLm00MixcbiAgICAgICAgYTMgPSBtLm0xMywgYjMgPSBtLm0yMywgYzMgPSBtLm0zMywgZDMgPSBtLm00MyxcbiAgICAgICAgYTQgPSBtLm0xNCwgYjQgPSBtLm0yNCwgYzQgPSBtLm0zNCwgZDQgPSBtLm00NDtcblxuICAgIHJldHVybiBhMSAqIGRldGVybWluYW50M3gzKGIyLCBiMywgYjQsIGMyLCBjMywgYzQsIGQyLCBkMywgZDQpIC1cbiAgICAgICAgICAgYjEgKiBkZXRlcm1pbmFudDN4MyhhMiwgYTMsIGE0LCBjMiwgYzMsIGM0LCBkMiwgZDMsIGQ0KSArXG4gICAgICAgICAgIGMxICogZGV0ZXJtaW5hbnQzeDMoYTIsIGEzLCBhNCwgYjIsIGIzLCBiNCwgZDIsIGQzLCBkNCkgLVxuICAgICAgICAgICBkMSAqIGRldGVybWluYW50M3gzKGEyLCBhMywgYTQsIGIyLCBiMywgYjQsIGMyLCBjMywgYzQpO1xufVxuXG4vKipcbiAqICBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG1hdHJpeCBpcyBhZmZpbmUuXG4gKiAgQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGlzQWZmaW5lKG1hdHJpeCkge1xuICAgIHJldHVybiBtYXRyaXgubTEzID09PSAwICYmIG1hdHJpeC5tMTQgPT09IDAgJiZcbiAgICAgICAgICAgbWF0cml4Lm0yMyA9PT0gMCAmJiBtYXRyaXgubTI0ID09PSAwICYmXG4gICAgICAgICAgIG1hdHJpeC5tMzEgPT09IDAgJiYgbWF0cml4Lm0zMiA9PT0gMCAmJlxuICAgICAgICAgICBtYXRyaXgubTMzID09PSAxICYmIG1hdHJpeC5tMzQgPT09IDAgJiZcbiAgICAgICAgICAgbWF0cml4Lm00MyA9PT0gMCAmJiBtYXRyaXgubTQ0ID09PSAxO1xufVxuXG4vKipcbiAqICBSZXR1cm5zIHdoZXRoZXIgdGhlIG1hdHJpeCBpcyB0aGUgaWRlbnRpdHkgbWF0cml4IG9yIGEgdHJhbnNsYXRpb24gbWF0cml4LlxuICogIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIGlzSWRlbnRpdHlPclRyYW5zbGF0aW9uKG1hdHJpeCkge1xuICAgIHZhciBtID0gbWF0cml4O1xuXG4gICAgcmV0dXJuIG0ubTExID09PSAxICYmIG0ubTEyID09PSAwICYmIG0ubTEzID09PSAwICYmIG0ubTE0ID09PSAwICYmXG4gICAgICAgICAgIG0ubTIxID09PSAwICYmIG0ubTIyID09PSAxICYmIG0ubTIzID09PSAwICYmIG0ubTI0ID09PSAwICYmXG4gICAgICAgICAgIG0ubTMxID09PSAwICYmIG0ubTMxID09PSAwICYmIG0ubTMzID09PSAxICYmIG0ubTM0ID09PSAwICYmXG4gICAgLyogbTQxLCBtNDIgYW5kIG00MyBhcmUgdGhlIHRyYW5zbGF0aW9uIHBvaW50cyAqLyAgIG0ubTQ0ID09PSAxO1xufVxuXG4vKipcbiAqICBSZXR1cm5zIHRoZSBhZGpvaW50IG1hdHJpeC5cbiAqICBAcmV0dXJuIHtYQ1NTTWF0cml4fVxuICovXG5mdW5jdGlvbiBhZGpvaW50KG1hdHJpeCkge1xuICAgIHZhciBtID0gbWF0cml4LFxuICAgICAgICAvLyBtYWtlIGByZXN1bHRgIHRoZSBzYW1lIHR5cGUgYXMgdGhlIGdpdmVuIG1ldHJpY1xuICAgICAgICByZXN1bHQgPSBuZXcgbWF0cml4LmNvbnN0cnVjdG9yKCksXG5cbiAgICAgICAgYTEgPSBtLm0xMSwgYjEgPSBtLm0xMiwgYzEgPSBtLm0xMywgZDEgPSBtLm0xNCxcbiAgICAgICAgYTIgPSBtLm0yMSwgYjIgPSBtLm0yMiwgYzIgPSBtLm0yMywgZDIgPSBtLm0yNCxcbiAgICAgICAgYTMgPSBtLm0zMSwgYjMgPSBtLm0zMiwgYzMgPSBtLm0zMywgZDMgPSBtLm0zNCxcbiAgICAgICAgYTQgPSBtLm00MSwgYjQgPSBtLm00MiwgYzQgPSBtLm00MywgZDQgPSBtLm00NDtcblxuICAgIC8vIFJvdyBjb2x1bW4gbGFiZWxpbmcgcmV2ZXJzZWQgc2luY2Ugd2UgdHJhbnNwb3NlIHJvd3MgJiBjb2x1bW5zXG4gICAgcmVzdWx0Lm0xMSA9ICBkZXRlcm1pbmFudDN4MyhiMiwgYjMsIGI0LCBjMiwgYzMsIGM0LCBkMiwgZDMsIGQ0KTtcbiAgICByZXN1bHQubTIxID0gLWRldGVybWluYW50M3gzKGEyLCBhMywgYTQsIGMyLCBjMywgYzQsIGQyLCBkMywgZDQpO1xuICAgIHJlc3VsdC5tMzEgPSAgZGV0ZXJtaW5hbnQzeDMoYTIsIGEzLCBhNCwgYjIsIGIzLCBiNCwgZDIsIGQzLCBkNCk7XG4gICAgcmVzdWx0Lm00MSA9IC1kZXRlcm1pbmFudDN4MyhhMiwgYTMsIGE0LCBiMiwgYjMsIGI0LCBjMiwgYzMsIGM0KTtcblxuICAgIHJlc3VsdC5tMTIgPSAtZGV0ZXJtaW5hbnQzeDMoYjEsIGIzLCBiNCwgYzEsIGMzLCBjNCwgZDEsIGQzLCBkNCk7XG4gICAgcmVzdWx0Lm0yMiA9ICBkZXRlcm1pbmFudDN4MyhhMSwgYTMsIGE0LCBjMSwgYzMsIGM0LCBkMSwgZDMsIGQ0KTtcbiAgICByZXN1bHQubTMyID0gLWRldGVybWluYW50M3gzKGExLCBhMywgYTQsIGIxLCBiMywgYjQsIGQxLCBkMywgZDQpO1xuICAgIHJlc3VsdC5tNDIgPSAgZGV0ZXJtaW5hbnQzeDMoYTEsIGEzLCBhNCwgYjEsIGIzLCBiNCwgYzEsIGMzLCBjNCk7XG5cbiAgICByZXN1bHQubTEzID0gIGRldGVybWluYW50M3gzKGIxLCBiMiwgYjQsIGMxLCBjMiwgYzQsIGQxLCBkMiwgZDQpO1xuICAgIHJlc3VsdC5tMjMgPSAtZGV0ZXJtaW5hbnQzeDMoYTEsIGEyLCBhNCwgYzEsIGMyLCBjNCwgZDEsIGQyLCBkNCk7XG4gICAgcmVzdWx0Lm0zMyA9ICBkZXRlcm1pbmFudDN4MyhhMSwgYTIsIGE0LCBiMSwgYjIsIGI0LCBkMSwgZDIsIGQ0KTtcbiAgICByZXN1bHQubTQzID0gLWRldGVybWluYW50M3gzKGExLCBhMiwgYTQsIGIxLCBiMiwgYjQsIGMxLCBjMiwgYzQpO1xuXG4gICAgcmVzdWx0Lm0xNCA9IC1kZXRlcm1pbmFudDN4MyhiMSwgYjIsIGIzLCBjMSwgYzIsIGMzLCBkMSwgZDIsIGQzKTtcbiAgICByZXN1bHQubTI0ID0gIGRldGVybWluYW50M3gzKGExLCBhMiwgYTMsIGMxLCBjMiwgYzMsIGQxLCBkMiwgZDMpO1xuICAgIHJlc3VsdC5tMzQgPSAtZGV0ZXJtaW5hbnQzeDMoYTEsIGEyLCBhMywgYjEsIGIyLCBiMywgZDEsIGQyLCBkMyk7XG4gICAgcmVzdWx0Lm00NCA9ICBkZXRlcm1pbmFudDN4MyhhMSwgYTIsIGEzLCBiMSwgYjIsIGIzLCBjMSwgYzIsIGMzKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGludmVyc2UobWF0cml4KSB7XG4gIHZhciBpbnY7XG5cbiAgaWYgKGlzSWRlbnRpdHlPclRyYW5zbGF0aW9uKG1hdHJpeCkpIHtcbiAgICAgIGludiA9IG5ldyBtYXRyaXguY29uc3RydWN0b3IoKTtcblxuICAgICAgaWYgKCEobWF0cml4Lm00MSA9PT0gMCAmJiBtYXRyaXgubTQyID09PSAwICYmIG1hdHJpeC5tNDMgPT09IDApKSB7XG4gICAgICAgICAgaW52Lm00MSA9IC1tYXRyaXgubTQxO1xuICAgICAgICAgIGludi5tNDIgPSAtbWF0cml4Lm00MjtcbiAgICAgICAgICBpbnYubTQzID0gLW1hdHJpeC5tNDM7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBpbnY7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGFkam9pbnQgbWF0cml4XG4gIHZhciByZXN1bHQgPSBhZGpvaW50KG1hdHJpeCk7XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSA0eDQgZGV0ZXJtaW5hbnRcbiAgdmFyIGRldCA9IGRldGVybWluYW50NHg0KG1hdHJpeCk7XG5cbiAgLy8gSWYgdGhlIGRldGVybWluYW50IGlzIHplcm8sIHRoZW4gdGhlIGludmVyc2UgbWF0cml4IGlzIG5vdCB1bmlxdWVcbiAgaWYgKE1hdGguYWJzKGRldCkgPCAxZS04KSByZXR1cm4gbnVsbDtcblxuICAvLyBTY2FsZSB0aGUgYWRqb2ludCBtYXRyaXggdG8gZ2V0IHRoZSBpbnZlcnNlXG4gIGZvciAodmFyIGkgPSAxOyBpIDwgNTsgaSsrKSB7XG4gICAgICBmb3IgKHZhciBqID0gMTsgaiA8IDU7IGorKykge1xuICAgICAgICAgIHJlc3VsdFsoJ20nICsgaSkgKyBqXSAvPSBkZXQ7XG4gICAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBtdWx0aXBseShtYXRyaXgsIG90aGVyTWF0cml4KSB7XG4gIGlmICghb3RoZXJNYXRyaXgpIHJldHVybiBudWxsO1xuXG4gIHZhciBhID0gb3RoZXJNYXRyaXgsXG4gICAgICBiID0gbWF0cml4LFxuICAgICAgYyA9IG5ldyBtYXRyaXguY29uc3RydWN0b3IoKTtcblxuICBjLm0xMSA9IGEubTExICogYi5tMTEgKyBhLm0xMiAqIGIubTIxICsgYS5tMTMgKiBiLm0zMSArIGEubTE0ICogYi5tNDE7XG4gIGMubTEyID0gYS5tMTEgKiBiLm0xMiArIGEubTEyICogYi5tMjIgKyBhLm0xMyAqIGIubTMyICsgYS5tMTQgKiBiLm00MjtcbiAgYy5tMTMgPSBhLm0xMSAqIGIubTEzICsgYS5tMTIgKiBiLm0yMyArIGEubTEzICogYi5tMzMgKyBhLm0xNCAqIGIubTQzO1xuICBjLm0xNCA9IGEubTExICogYi5tMTQgKyBhLm0xMiAqIGIubTI0ICsgYS5tMTMgKiBiLm0zNCArIGEubTE0ICogYi5tNDQ7XG5cbiAgYy5tMjEgPSBhLm0yMSAqIGIubTExICsgYS5tMjIgKiBiLm0yMSArIGEubTIzICogYi5tMzEgKyBhLm0yNCAqIGIubTQxO1xuICBjLm0yMiA9IGEubTIxICogYi5tMTIgKyBhLm0yMiAqIGIubTIyICsgYS5tMjMgKiBiLm0zMiArIGEubTI0ICogYi5tNDI7XG4gIGMubTIzID0gYS5tMjEgKiBiLm0xMyArIGEubTIyICogYi5tMjMgKyBhLm0yMyAqIGIubTMzICsgYS5tMjQgKiBiLm00MztcbiAgYy5tMjQgPSBhLm0yMSAqIGIubTE0ICsgYS5tMjIgKiBiLm0yNCArIGEubTIzICogYi5tMzQgKyBhLm0yNCAqIGIubTQ0O1xuXG4gIGMubTMxID0gYS5tMzEgKiBiLm0xMSArIGEubTMyICogYi5tMjEgKyBhLm0zMyAqIGIubTMxICsgYS5tMzQgKiBiLm00MTtcbiAgYy5tMzIgPSBhLm0zMSAqIGIubTEyICsgYS5tMzIgKiBiLm0yMiArIGEubTMzICogYi5tMzIgKyBhLm0zNCAqIGIubTQyO1xuICBjLm0zMyA9IGEubTMxICogYi5tMTMgKyBhLm0zMiAqIGIubTIzICsgYS5tMzMgKiBiLm0zMyArIGEubTM0ICogYi5tNDM7XG4gIGMubTM0ID0gYS5tMzEgKiBiLm0xNCArIGEubTMyICogYi5tMjQgKyBhLm0zMyAqIGIubTM0ICsgYS5tMzQgKiBiLm00NDtcblxuICBjLm00MSA9IGEubTQxICogYi5tMTEgKyBhLm00MiAqIGIubTIxICsgYS5tNDMgKiBiLm0zMSArIGEubTQ0ICogYi5tNDE7XG4gIGMubTQyID0gYS5tNDEgKiBiLm0xMiArIGEubTQyICogYi5tMjIgKyBhLm00MyAqIGIubTMyICsgYS5tNDQgKiBiLm00MjtcbiAgYy5tNDMgPSBhLm00MSAqIGIubTEzICsgYS5tNDIgKiBiLm0yMyArIGEubTQzICogYi5tMzMgKyBhLm00NCAqIGIubTQzO1xuICBjLm00NCA9IGEubTQxICogYi5tMTQgKyBhLm00MiAqIGIubTI0ICsgYS5tNDMgKiBiLm0zNCArIGEubTQ0ICogYi5tNDQ7XG5cbiAgcmV0dXJuIGM7XG59XG5cbmZ1bmN0aW9uIHRyYW5zcG9zZShtYXRyaXgpIHtcbiAgdmFyIHJlc3VsdCA9IG5ldyBtYXRyaXguY29uc3RydWN0b3IoKTtcbiAgdmFyIHJvd3MgPSA0LCBjb2xzID0gNDtcbiAgdmFyIGkgPSBjb2xzLCBqO1xuICB3aGlsZSAoaSkge1xuICAgIGogPSByb3dzO1xuICAgIHdoaWxlIChqKSB7XG4gICAgICByZXN1bHRbJ20nICsgaSArIGpdID0gbWF0cml4WydtJysgaiArIGldO1xuICAgICAgai0tO1xuICAgIH1cbiAgICBpLS07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLypcbiAgSW5wdXQ6ICBtYXRyaXggICAgICA7IGEgNHg0IG1hdHJpeFxuICBPdXRwdXQ6IHRyYW5zbGF0aW9uIDsgYSAzIGNvbXBvbmVudCB2ZWN0b3JcbiAgICAgICAgICBzY2FsZSAgICAgICA7IGEgMyBjb21wb25lbnQgdmVjdG9yXG4gICAgICAgICAgc2tldyAgICAgICAgOyBza2V3IGZhY3RvcnMgWFksWFosWVogcmVwcmVzZW50ZWQgYXMgYSAzIGNvbXBvbmVudCB2ZWN0b3JcbiAgICAgICAgICBwZXJzcGVjdGl2ZSA7IGEgNCBjb21wb25lbnQgdmVjdG9yXG4gICAgICAgICAgcm90YXRlICA7IGEgNCBjb21wb25lbnQgdmVjdG9yXG4gIFJldHVybnMgZmFsc2UgaWYgdGhlIG1hdHJpeCBjYW5ub3QgYmUgZGVjb21wb3NlZCwgdHJ1ZSBpZiBpdCBjYW5cbiovXG52YXIgVmVjdG9yNCA9IHJlcXVpcmUoJy4uL1ZlY3RvcjQuanMnKTtcbmZ1bmN0aW9uIGRlY29tcG9zZShtYXRyaXgpIHtcbiAgdmFyIHBlcnNwZWN0aXZlTWF0cml4LCByaWdodEhhbmRTaWRlLCBpbnZlcnNlUGVyc3BlY3RpdmVNYXRyaXgsIHRyYW5zcG9zZWRJbnZlcnNlUGVyc3BlY3RpdmVNYXRyaXgsXG4gICAgICBwZXJzcGVjdGl2ZSwgdHJhbnNsYXRlLCByb3csIGksIGxlbiwgc2NhbGUsIHNrZXcsIHBkdW0zLCByb3RhdGU7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBtYXRyaXguXG4gIGlmIChtYXRyaXgubTMzID09IDApIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgZm9yIChpID0gMTsgaSA8PSA0OyBpKyspIHtcbiAgICBmb3IgKGogPSAxOyBqIDwgNDsgaisrKSB7XG4gICAgICBtYXRyaXhbJ20nK2kral0gLz0gbWF0cml4Lm00NDtcbiAgICB9XG4gIH1cblxuICAvLyBwZXJzcGVjdGl2ZU1hdHJpeCBpcyB1c2VkIHRvIHNvbHZlIGZvciBwZXJzcGVjdGl2ZSwgYnV0IGl0IGFsc28gcHJvdmlkZXNcbiAgLy8gYW4gZWFzeSB3YXkgdG8gdGVzdCBmb3Igc2luZ3VsYXJpdHkgb2YgdGhlIHVwcGVyIDN4MyBjb21wb25lbnQuXG4gIHBlcnNwZWN0aXZlTWF0cml4ID0gbWF0cml4O1xuICBwZXJzcGVjdGl2ZU1hdHJpeC5tMTQgPSAwO1xuICBwZXJzcGVjdGl2ZU1hdHJpeC5tMjQgPSAwO1xuICBwZXJzcGVjdGl2ZU1hdHJpeC5tMzQgPSAwO1xuICBwZXJzcGVjdGl2ZU1hdHJpeC5tNDQgPSAxO1xuXG4gIGlmIChkZXRlcm1pbmFudDR4NChwZXJzcGVjdGl2ZU1hdHJpeCkgPT0gMCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEZpcnN0LCBpc29sYXRlIHBlcnNwZWN0aXZlLlxuICBpZiAobWF0cml4Lm0xNCAhPSAwIHx8IG1hdHJpeC5tMjQgIT0gMCB8fCBtYXRyaXgubTM0ICE9IDApIHtcbiAgICAvLyByaWdodEhhbmRTaWRlIGlzIHRoZSByaWdodCBoYW5kIHNpZGUgb2YgdGhlIGVxdWF0aW9uLlxuICAgIHJpZ2h0SGFuZFNpZGUgPSBuZXcgVmVjdG9yNChtYXRyaXgubTE0LCBtYXRyaXgubTI0LCBtYXRyaXgubTM0LCBtYXRyaXgubTQ0KTtcblxuICAgIC8vIFNvbHZlIHRoZSBlcXVhdGlvbiBieSBpbnZlcnRpbmcgcGVyc3BlY3RpdmVNYXRyaXggYW5kIG11bHRpcGx5aW5nXG4gICAgLy8gcmlnaHRIYW5kU2lkZSBieSB0aGUgaW52ZXJzZS5cbiAgICBpbnZlcnNlUGVyc3BlY3RpdmVNYXRyaXggPSBpbnZlcnNlKHBlcnNwZWN0aXZlTWF0cml4KTtcbiAgICB0cmFuc3Bvc2VkSW52ZXJzZVBlcnNwZWN0aXZlTWF0cml4ID0gdHJhbnNwb3NlKGludmVyc2VQZXJzcGVjdGl2ZU1hdHJpeCk7XG4gICAgcGVyc3BlY3RpdmUgPSByaWdodEhhbmRTaWRlLm11bHRpcGx5QnlNYXRyaXgodHJhbnNwb3NlZEludmVyc2VQZXJzcGVjdGl2ZU1hdHJpeCk7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gTm8gcGVyc3BlY3RpdmUuXG4gICAgcGVyc3BlY3RpdmUgPSBuZXcgVmVjdG9yNCgwLCAwLCAwLCAxKTtcbiAgfVxuXG4gIC8vIE5leHQgdGFrZSBjYXJlIG9mIHRyYW5zbGF0aW9uXG4gIHRyYW5zbGF0ZSA9IG5ldyBWZWN0b3I0KG1hdHJpeC5tNDEsIG1hdHJpeC5tNDIsIG1hdHJpeC5tNDMpO1xuXG4gIC8vIE5vdyBnZXQgc2NhbGUgYW5kIHNoZWFyLiAncm93JyBpcyBhIDMgZWxlbWVudCBhcnJheSBvZiAzIGNvbXBvbmVudCB2ZWN0b3JzXG4gIHJvdyA9IFsgbmV3IFZlY3RvcjQoKSwgbmV3IFZlY3RvcjQoKSwgbmV3IFZlY3RvcjQoKSBdO1xuICBmb3IgKGkgPSAxLCBsZW4gPSByb3cubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICByb3dbaS0xXS54ID0gbWF0cml4WydtJytpKycxJ107XG4gICAgcm93W2ktMV0ueSA9IG1hdHJpeFsnbScraSsnMiddO1xuICAgIHJvd1tpLTFdLnogPSBtYXRyaXhbJ20nK2krJzMnXTtcbiAgfVxuXG4gIC8vIENvbXB1dGUgWCBzY2FsZSBmYWN0b3IgYW5kIG5vcm1hbGl6ZSBmaXJzdCByb3cuXG4gIHNjYWxlID0gbmV3IFZlY3RvcjQoKTtcbiAgc2tldyA9IG5ldyBWZWN0b3I0KCk7XG5cbiAgc2NhbGUueCA9IHJvd1swXS5sZW5ndGgoKTtcbiAgcm93WzBdID0gcm93WzBdLm5vcm1hbGl6ZSgpO1xuXG4gIC8vIENvbXB1dGUgWFkgc2hlYXIgZmFjdG9yIGFuZCBtYWtlIDJuZCByb3cgb3J0aG9nb25hbCB0byAxc3QuXG4gIHNrZXcueCA9IHJvd1swXS5kb3Qocm93WzFdKTtcbiAgcm93WzFdID0gcm93WzFdLmNvbWJpbmUocm93WzBdLCAxLjAsIC1za2V3LngpO1xuXG4gIC8vIE5vdywgY29tcHV0ZSBZIHNjYWxlIGFuZCBub3JtYWxpemUgMm5kIHJvdy5cbiAgc2NhbGUueSA9IHJvd1sxXS5sZW5ndGgoKTtcbiAgcm93WzFdID0gcm93WzFdLm5vcm1hbGl6ZSgpO1xuICBza2V3LnggLz0gc2NhbGUueTtcblxuICAvLyBDb21wdXRlIFhaIGFuZCBZWiBzaGVhcnMsIG9ydGhvZ29uYWxpemUgM3JkIHJvd1xuICBza2V3LnkgPSByb3dbMF0uZG90KHJvd1syXSk7XG4gIHJvd1syXSA9IHJvd1syXS5jb21iaW5lKHJvd1swXSwgMS4wLCAtc2tldy55KTtcbiAgc2tldy56ID0gcm93WzFdLmRvdChyb3dbMl0pO1xuICByb3dbMl0gPSByb3dbMl0uY29tYmluZShyb3dbMV0sIDEuMCwgLXNrZXcueik7XG5cbiAgLy8gTmV4dCwgZ2V0IFogc2NhbGUgYW5kIG5vcm1hbGl6ZSAzcmQgcm93LlxuICBzY2FsZS56ID0gcm93WzJdLmxlbmd0aCgpO1xuICByb3dbMl0gPSByb3dbMl0ubm9ybWFsaXplKCk7XG4gIHNrZXcueSA9IChza2V3LnkgLyBzY2FsZS56KSB8fCAwO1xuICBza2V3LnogPSAoc2tldy56IC8gc2NhbGUueikgfHwgMDtcblxuICAvLyBBdCB0aGlzIHBvaW50LCB0aGUgbWF0cml4IChpbiByb3dzKSBpcyBvcnRob25vcm1hbC5cbiAgLy8gQ2hlY2sgZm9yIGEgY29vcmRpbmF0ZSBzeXN0ZW0gZmxpcC4gIElmIHRoZSBkZXRlcm1pbmFudFxuICAvLyBpcyAtMSwgdGhlbiBuZWdhdGUgdGhlIG1hdHJpeCBhbmQgdGhlIHNjYWxpbmcgZmFjdG9ycy5cbiAgcGR1bTMgPSByb3dbMV0uY3Jvc3Mocm93WzJdKTtcbiAgaWYgKHJvd1swXS5kb3QocGR1bTMpIDwgMCkge1xuICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgIHNjYWxlLnggKj0gLTE7XG4gICAgICByb3dbaV0ueCAqPSAtMTtcbiAgICAgIHJvd1tpXS55ICo9IC0xO1xuICAgICAgcm93W2ldLnogKj0gLTE7XG4gICAgfVxuICB9XG5cbiAgLy8gTm93LCBnZXQgdGhlIHJvdGF0aW9ucyBvdXRcbiAgLy8gRlJPTSBXM0NcbiAgcm90YXRlID0gbmV3IFZlY3RvcjQoKTtcbiAgcm90YXRlLnggPSAwLjUgKiBNYXRoLnNxcnQoTWF0aC5tYXgoMSArIHJvd1swXS54IC0gcm93WzFdLnkgLSByb3dbMl0ueiwgMCkpO1xuICByb3RhdGUueSA9IDAuNSAqIE1hdGguc3FydChNYXRoLm1heCgxIC0gcm93WzBdLnggKyByb3dbMV0ueSAtIHJvd1syXS56LCAwKSk7XG4gIHJvdGF0ZS56ID0gMC41ICogTWF0aC5zcXJ0KE1hdGgubWF4KDEgLSByb3dbMF0ueCAtIHJvd1sxXS55ICsgcm93WzJdLnosIDApKTtcbiAgcm90YXRlLncgPSAwLjUgKiBNYXRoLnNxcnQoTWF0aC5tYXgoMSArIHJvd1swXS54ICsgcm93WzFdLnkgKyByb3dbMl0ueiwgMCkpO1xuXG4gIC8vIGlmIChyb3dbMl0ueSA+IHJvd1sxXS56KSByb3RhdGVbMF0gPSAtcm90YXRlWzBdO1xuICAvLyBpZiAocm93WzBdLnogPiByb3dbMl0ueCkgcm90YXRlWzFdID0gLXJvdGF0ZVsxXTtcbiAgLy8gaWYgKHJvd1sxXS54ID4gcm93WzBdLnkpIHJvdGF0ZVsyXSA9IC1yb3RhdGVbMl07XG5cbiAgLy8gRlJPTSBNT1JGLkpTXG4gIHJvdGF0ZS55ID0gTWF0aC5hc2luKC1yb3dbMF0ueik7XG4gIGlmIChNYXRoLmNvcyhyb3RhdGUueSkgIT0gMCkge1xuICAgIHJvdGF0ZS54ID0gTWF0aC5hdGFuMihyb3dbMV0ueiwgcm93WzJdLnopO1xuICAgIHJvdGF0ZS56ID0gTWF0aC5hdGFuMihyb3dbMF0ueSwgcm93WzBdLngpO1xuICB9IGVsc2Uge1xuICAgIHJvdGF0ZS54ID0gTWF0aC5hdGFuMigtcm93WzJdLngsIHJvd1sxXS55KTtcbiAgICByb3RhdGUueiA9IDA7XG4gIH1cblxuICAvLyBGUk9NIGh0dHA6Ly9ibG9nLmJ3aGl0aW5nLmNvLnVrLz9wPTI2XG4gIC8vIHNjYWxlLngyID0gTWF0aC5zcXJ0KG1hdHJpeC5tMTEqbWF0cml4Lm0xMSArIG1hdHJpeC5tMjEqbWF0cml4Lm0yMSArIG1hdHJpeC5tMzEqbWF0cml4Lm0zMSk7XG4gIC8vIHNjYWxlLnkyID0gTWF0aC5zcXJ0KG1hdHJpeC5tMTIqbWF0cml4Lm0xMiArIG1hdHJpeC5tMjIqbWF0cml4Lm0yMiArIG1hdHJpeC5tMzIqbWF0cml4Lm0zMik7XG4gIC8vIHNjYWxlLnoyID0gTWF0aC5zcXJ0KG1hdHJpeC5tMTMqbWF0cml4Lm0xMyArIG1hdHJpeC5tMjMqbWF0cml4Lm0yMyArIG1hdHJpeC5tMzMqbWF0cml4Lm0zMyk7XG5cbiAgLy8gcm90YXRlLngyID0gTWF0aC5hdGFuMihtYXRyaXgubTIzL3NjYWxlLnoyLCBtYXRyaXgubTMzL3NjYWxlLnoyKTtcbiAgLy8gcm90YXRlLnkyID0gLU1hdGguYXNpbihtYXRyaXgubTEzL3NjYWxlLnoyKTtcbiAgLy8gcm90YXRlLnoyID0gTWF0aC5hdGFuMihtYXRyaXgubTEyL3NjYWxlLnkyLCBtYXRyaXgubTExL3NjYWxlLngyKTtcblxuICByZXR1cm4ge1xuICAgIHBlcnNwZWN0aXZlIDogcGVyc3BlY3RpdmUsXG4gICAgdHJhbnNsYXRlICAgOiB0cmFuc2xhdGUsXG4gICAgc2tldyAgICAgICAgOiBza2V3LFxuICAgIHNjYWxlICAgICAgIDogc2NhbGUsXG4gICAgcm90YXRlICAgICAgOiByb3RhdGVcbiAgfTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBsZW5ndGggICAgICAgICAgIDogbGVuZ3RoLFxuICBub3JtYWxpemUgICAgICAgIDogbm9ybWFsaXplLFxuICBkb3QgICAgICAgICAgICAgIDogZG90LFxuICBjcm9zcyAgICAgICAgICAgIDogY3Jvc3MsXG4gIGNvbWJpbmUgICAgICAgICAgOiBjb21iaW5lLFxuICBtdWx0aXBseUJ5TWF0cml4IDogbXVsdGlwbHlCeU1hdHJpeFxufTtcblxuLyoqXG4gKiBHZXQgdGhlIGxlbmd0aCBvZiB0aGUgdmVjdG9yXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7ZmxvYXR9XG4gKi9cblxuZnVuY3Rpb24gbGVuZ3RoKHZlY3Rvcikge1xuICByZXR1cm4gTWF0aC5zcXJ0KHZlY3Rvci54KnZlY3Rvci54ICsgdmVjdG9yLnkqdmVjdG9yLnkgKyB2ZWN0b3Iueip2ZWN0b3Iueik7XG59XG5cblxuLyoqXG4gKiBHZXQgYSBub3JtYWxpemVkIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB2ZWN0b3JcbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIHtWZWN0b3I0fVxuICovXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZSh2ZWN0b3IpIHtcbiAgdmFyIGxlbiA9IGxlbmd0aCh2ZWN0b3IpLFxuICAgIHYgPSBuZXcgdmVjdG9yLmNvbnN0cnVjdG9yKHZlY3Rvci54IC8gbGVuLCB2ZWN0b3IueSAvIGxlbiwgdmVjdG9yLnogLyBsZW4pO1xuXG4gIHJldHVybiB2O1xufVxuXG5cbi8qKlxuICogVmVjdG9yIERvdC1Qcm9kdWN0XG4gKiBAcGFyYW0ge1ZlY3RvcjR9IHYgVGhlIHNlY29uZCB2ZWN0b3IgdG8gYXBwbHkgdGhlIHByb2R1Y3QgdG9cbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIHtmbG9hdH0gVGhlIERvdC1Qcm9kdWN0IG9mIGEgYW5kIGIuXG4gKi9cblxuZnVuY3Rpb24gZG90KGEsIGIpIHtcbiAgcmV0dXJuIGEueCpiLnggKyBhLnkqYi55ICsgYS56KmIueiArIGEudypiLnc7XG59XG5cblxuLyoqXG4gKiBWZWN0b3IgQ3Jvc3MtUHJvZHVjdFxuICogQHBhcmFtIHtWZWN0b3I0fSB2IFRoZSBzZWNvbmQgdmVjdG9yIHRvIGFwcGx5IHRoZSBwcm9kdWN0IHRvXG4gKiBAYXV0aG9yIEpvZSBMYW1iZXJ0XG4gKiBAcmV0dXJucyB7VmVjdG9yNH0gVGhlIENyb3NzLVByb2R1Y3Qgb2YgYSBhbmQgYi5cbiAqL1xuXG5mdW5jdGlvbiBjcm9zcyhhLCBiKSB7XG4gIHJldHVybiBuZXcgYS5jb25zdHJ1Y3RvcihcbiAgICAoYS55ICogYi56KSAtIChhLnogKiBiLnkpLFxuICAgIChhLnogKiBiLngpIC0gKGEueCAqIGIueiksXG4gICAgKGEueCAqIGIueSkgLSAoYS55ICogYi54KVxuICApO1xufVxuXG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHJlcXVpcmVkIGZvciBtYXRyaXggZGVjb21wb3NpdGlvblxuICogQSBKYXZhc2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHBzZXVkbyBjb2RlIGF2YWlsYWJsZSBmcm9tIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtMmQtdHJhbnNmb3Jtcy8jbWF0cml4LWRlY29tcG9zaXRpb25cbiAqIEBwYXJhbSB7VmVjdG9yNH0gYVBvaW50IEEgM0QgcG9pbnRcbiAqIEBwYXJhbSB7ZmxvYXR9IGFzY2xcbiAqIEBwYXJhbSB7ZmxvYXR9IGJzY2xcbiAqIEBhdXRob3IgSm9lIExhbWJlcnRcbiAqIEByZXR1cm5zIHtWZWN0b3I0fVxuICovXG5cbmZ1bmN0aW9uIGNvbWJpbmUoYVBvaW50LCBiUG9pbnQsIGFzY2wsIGJzY2wpIHtcbiAgcmV0dXJuIG5ldyBhUG9pbnQuY29uc3RydWN0b3IoXG4gICAgKGFzY2wgKiBhUG9pbnQueCkgKyAoYnNjbCAqIGJQb2ludC54KSxcbiAgICAoYXNjbCAqIGFQb2ludC55KSArIChic2NsICogYlBvaW50LnkpLFxuICAgIChhc2NsICogYVBvaW50LnopICsgKGJzY2wgKiBiUG9pbnQueilcbiAgKTtcbn1cblxuZnVuY3Rpb24gbXVsdGlwbHlCeU1hdHJpeCh2ZWN0b3IsIG1hdHJpeCkge1xuICByZXR1cm4gbmV3IHZlY3Rvci5jb25zdHJ1Y3RvcihcbiAgICAobWF0cml4Lm0xMSAqIHZlY3Rvci54KSArIChtYXRyaXgubTEyICogdmVjdG9yLnkpICsgKG1hdHJpeC5tMTMgKiB2ZWN0b3IueiksXG4gICAgKG1hdHJpeC5tMjEgKiB2ZWN0b3IueCkgKyAobWF0cml4Lm0yMiAqIHZlY3Rvci55KSArIChtYXRyaXgubTIzICogdmVjdG9yLnopLFxuICAgIChtYXRyaXgubTMxICogdmVjdG9yLngpICsgKG1hdHJpeC5tMzIgKiB2ZWN0b3IueSkgKyAobWF0cml4Lm0zMyAqIHZlY3Rvci56KVxuICApO1xufVxuIiwiZnVuY3Rpb24gRE9NUGFyc2VyKG9wdGlvbnMpe1xyXG5cdHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHx7bG9jYXRvcjp7fX07XHJcblx0XHJcbn1cclxuRE9NUGFyc2VyLnByb3RvdHlwZS5wYXJzZUZyb21TdHJpbmcgPSBmdW5jdGlvbihzb3VyY2UsbWltZVR5cGUpe1x0XHJcblx0dmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XHJcblx0dmFyIHNheCA9ICBuZXcgWE1MUmVhZGVyKCk7XHJcblx0dmFyIGRvbUJ1aWxkZXIgPSBvcHRpb25zLmRvbUJ1aWxkZXIgfHwgbmV3IERPTUhhbmRsZXIoKTsvL2NvbnRlbnRIYW5kbGVyIGFuZCBMZXhpY2FsSGFuZGxlclxyXG5cdHZhciBlcnJvckhhbmRsZXIgPSBvcHRpb25zLmVycm9ySGFuZGxlcjtcclxuXHR2YXIgbG9jYXRvciA9IG9wdGlvbnMubG9jYXRvcjtcclxuXHR2YXIgZGVmYXVsdE5TTWFwID0gb3B0aW9ucy54bWxuc3x8e307XHJcblx0dmFyIGVudGl0eU1hcCA9IHsnbHQnOic8JywnZ3QnOic+JywnYW1wJzonJicsJ3F1b3QnOidcIicsJ2Fwb3MnOlwiJ1wifVxyXG5cdGlmKGxvY2F0b3Ipe1xyXG5cdFx0ZG9tQnVpbGRlci5zZXREb2N1bWVudExvY2F0b3IobG9jYXRvcilcclxuXHR9XHJcblx0XHJcblx0c2F4LmVycm9ySGFuZGxlciA9IGJ1aWxkRXJyb3JIYW5kbGVyKGVycm9ySGFuZGxlcixkb21CdWlsZGVyLGxvY2F0b3IpO1xyXG5cdHNheC5kb21CdWlsZGVyID0gb3B0aW9ucy5kb21CdWlsZGVyIHx8IGRvbUJ1aWxkZXI7XHJcblx0aWYoL1xcL3g/aHRtbD8kLy50ZXN0KG1pbWVUeXBlKSl7XHJcblx0XHRlbnRpdHlNYXAubmJzcCA9ICdcXHhhMCc7XHJcblx0XHRlbnRpdHlNYXAuY29weSA9ICdcXHhhOSc7XHJcblx0XHRkZWZhdWx0TlNNYXBbJyddPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc7XHJcblx0fVxyXG5cdGRlZmF1bHROU01hcC54bWwgPSBkZWZhdWx0TlNNYXAueG1sIHx8ICdodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2UnO1xyXG5cdGlmKHNvdXJjZSl7XHJcblx0XHRzYXgucGFyc2Uoc291cmNlLGRlZmF1bHROU01hcCxlbnRpdHlNYXApO1xyXG5cdH1lbHNle1xyXG5cdFx0c2F4LmVycm9ySGFuZGxlci5lcnJvcihcImludmFsaWQgZG9jdW1lbnQgc291cmNlXCIpO1xyXG5cdH1cclxuXHRyZXR1cm4gZG9tQnVpbGRlci5kb2N1bWVudDtcclxufVxyXG5mdW5jdGlvbiBidWlsZEVycm9ySGFuZGxlcihlcnJvckltcGwsZG9tQnVpbGRlcixsb2NhdG9yKXtcclxuXHRpZighZXJyb3JJbXBsKXtcclxuXHRcdGlmKGRvbUJ1aWxkZXIgaW5zdGFuY2VvZiBET01IYW5kbGVyKXtcclxuXHRcdFx0cmV0dXJuIGRvbUJ1aWxkZXI7XHJcblx0XHR9XHJcblx0XHRlcnJvckltcGwgPSBkb21CdWlsZGVyIDtcclxuXHR9XHJcblx0dmFyIGVycm9ySGFuZGxlciA9IHt9XHJcblx0dmFyIGlzQ2FsbGJhY2sgPSBlcnJvckltcGwgaW5zdGFuY2VvZiBGdW5jdGlvbjtcclxuXHRsb2NhdG9yID0gbG9jYXRvcnx8e31cclxuXHRmdW5jdGlvbiBidWlsZChrZXkpe1xyXG5cdFx0dmFyIGZuID0gZXJyb3JJbXBsW2tleV07XHJcblx0XHRpZighZm4gJiYgaXNDYWxsYmFjayl7XHJcblx0XHRcdGZuID0gZXJyb3JJbXBsLmxlbmd0aCA9PSAyP2Z1bmN0aW9uKG1zZyl7ZXJyb3JJbXBsKGtleSxtc2cpfTplcnJvckltcGw7XHJcblx0XHR9XHJcblx0XHRlcnJvckhhbmRsZXJba2V5XSA9IGZuICYmIGZ1bmN0aW9uKG1zZyl7XHJcblx0XHRcdGZuKCdbeG1sZG9tICcra2V5KyddXFx0Jyttc2crX2xvY2F0b3IobG9jYXRvcikpO1xyXG5cdFx0fXx8ZnVuY3Rpb24oKXt9O1xyXG5cdH1cclxuXHRidWlsZCgnd2FybmluZycpO1xyXG5cdGJ1aWxkKCdlcnJvcicpO1xyXG5cdGJ1aWxkKCdmYXRhbEVycm9yJyk7XHJcblx0cmV0dXJuIGVycm9ySGFuZGxlcjtcclxufVxyXG5cclxuLy9jb25zb2xlLmxvZygnI1xcblxcblxcblxcblxcblxcblxcbiMjIyMnKVxyXG4vKipcclxuICogK0NvbnRlbnRIYW5kbGVyK0Vycm9ySGFuZGxlclxyXG4gKiArTGV4aWNhbEhhbmRsZXIrRW50aXR5UmVzb2x2ZXIyXHJcbiAqIC1EZWNsSGFuZGxlci1EVERIYW5kbGVyIFxyXG4gKiBcclxuICogRGVmYXVsdEhhbmRsZXI6RW50aXR5UmVzb2x2ZXIsIERUREhhbmRsZXIsIENvbnRlbnRIYW5kbGVyLCBFcnJvckhhbmRsZXJcclxuICogRGVmYXVsdEhhbmRsZXIyOkRlZmF1bHRIYW5kbGVyLExleGljYWxIYW5kbGVyLCBEZWNsSGFuZGxlciwgRW50aXR5UmVzb2x2ZXIyXHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L2hlbHBlcnMvRGVmYXVsdEhhbmRsZXIuaHRtbFxyXG4gKi9cclxuZnVuY3Rpb24gRE9NSGFuZGxlcigpIHtcclxuICAgIHRoaXMuY2RhdGEgPSBmYWxzZTtcclxufVxyXG5mdW5jdGlvbiBwb3NpdGlvbihsb2NhdG9yLG5vZGUpe1xyXG5cdG5vZGUubGluZU51bWJlciA9IGxvY2F0b3IubGluZU51bWJlcjtcclxuXHRub2RlLmNvbHVtbk51bWJlciA9IGxvY2F0b3IuY29sdW1uTnVtYmVyO1xyXG59XHJcbi8qKlxyXG4gKiBAc2VlIG9yZy54bWwuc2F4LkNvbnRlbnRIYW5kbGVyI3N0YXJ0RG9jdW1lbnRcclxuICogQGxpbmsgaHR0cDovL3d3dy5zYXhwcm9qZWN0Lm9yZy9hcGlkb2Mvb3JnL3htbC9zYXgvQ29udGVudEhhbmRsZXIuaHRtbFxyXG4gKi8gXHJcbkRPTUhhbmRsZXIucHJvdG90eXBlID0ge1xyXG5cdHN0YXJ0RG9jdW1lbnQgOiBmdW5jdGlvbigpIHtcclxuICAgIFx0dGhpcy5kb2N1bWVudCA9IG5ldyBET01JbXBsZW1lbnRhdGlvbigpLmNyZWF0ZURvY3VtZW50KG51bGwsIG51bGwsIG51bGwpO1xyXG4gICAgXHRpZiAodGhpcy5sb2NhdG9yKSB7XHJcbiAgICAgICAgXHR0aGlzLmRvY3VtZW50LmRvY3VtZW50VVJJID0gdGhpcy5sb2NhdG9yLnN5c3RlbUlkO1xyXG4gICAgXHR9XHJcblx0fSxcclxuXHRzdGFydEVsZW1lbnQ6ZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUsIHFOYW1lLCBhdHRycykge1xyXG5cdFx0dmFyIGRvYyA9IHRoaXMuZG9jdW1lbnQ7XHJcblx0ICAgIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlVVJJLCBxTmFtZXx8bG9jYWxOYW1lKTtcclxuXHQgICAgdmFyIGxlbiA9IGF0dHJzLmxlbmd0aDtcclxuXHQgICAgYXBwZW5kRWxlbWVudCh0aGlzLCBlbCk7XHJcblx0ICAgIHRoaXMuY3VycmVudEVsZW1lbnQgPSBlbDtcclxuXHQgICAgXHJcblx0XHR0aGlzLmxvY2F0b3IgJiYgcG9zaXRpb24odGhpcy5sb2NhdG9yLGVsKVxyXG5cdCAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBsZW47IGkrKykge1xyXG5cdCAgICAgICAgdmFyIG5hbWVzcGFjZVVSSSA9IGF0dHJzLmdldFVSSShpKTtcclxuXHQgICAgICAgIHZhciB2YWx1ZSA9IGF0dHJzLmdldFZhbHVlKGkpO1xyXG5cdCAgICAgICAgdmFyIHFOYW1lID0gYXR0cnMuZ2V0UU5hbWUoaSk7XHJcblx0XHRcdHZhciBhdHRyID0gZG9jLmNyZWF0ZUF0dHJpYnV0ZU5TKG5hbWVzcGFjZVVSSSwgcU5hbWUpO1xyXG5cdFx0XHRpZiggYXR0ci5nZXRPZmZzZXQpe1xyXG5cdFx0XHRcdHBvc2l0aW9uKGF0dHIuZ2V0T2Zmc2V0KDEpLGF0dHIpXHJcblx0XHRcdH1cclxuXHRcdFx0YXR0ci52YWx1ZSA9IGF0dHIubm9kZVZhbHVlID0gdmFsdWU7XHJcblx0XHRcdGVsLnNldEF0dHJpYnV0ZU5vZGUoYXR0cilcclxuXHQgICAgfVxyXG5cdH0sXHJcblx0ZW5kRWxlbWVudDpmdW5jdGlvbihuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSwgcU5hbWUpIHtcclxuXHRcdHZhciBjdXJyZW50ID0gdGhpcy5jdXJyZW50RWxlbWVudFxyXG5cdCAgICB2YXIgdGFnTmFtZSA9IGN1cnJlbnQudGFnTmFtZTtcclxuXHQgICAgdGhpcy5jdXJyZW50RWxlbWVudCA9IGN1cnJlbnQucGFyZW50Tm9kZTtcclxuXHR9LFxyXG5cdHN0YXJ0UHJlZml4TWFwcGluZzpmdW5jdGlvbihwcmVmaXgsIHVyaSkge1xyXG5cdH0sXHJcblx0ZW5kUHJlZml4TWFwcGluZzpmdW5jdGlvbihwcmVmaXgpIHtcclxuXHR9LFxyXG5cdHByb2Nlc3NpbmdJbnN0cnVjdGlvbjpmdW5jdGlvbih0YXJnZXQsIGRhdGEpIHtcclxuXHQgICAgdmFyIGlucyA9IHRoaXMuZG9jdW1lbnQuY3JlYXRlUHJvY2Vzc2luZ0luc3RydWN0aW9uKHRhcmdldCwgZGF0YSk7XHJcblx0ICAgIHRoaXMubG9jYXRvciAmJiBwb3NpdGlvbih0aGlzLmxvY2F0b3IsaW5zKVxyXG5cdCAgICBhcHBlbmRFbGVtZW50KHRoaXMsIGlucyk7XHJcblx0fSxcclxuXHRpZ25vcmFibGVXaGl0ZXNwYWNlOmZ1bmN0aW9uKGNoLCBzdGFydCwgbGVuZ3RoKSB7XHJcblx0fSxcclxuXHRjaGFyYWN0ZXJzOmZ1bmN0aW9uKGNoYXJzLCBzdGFydCwgbGVuZ3RoKSB7XHJcblx0XHRjaGFycyA9IF90b1N0cmluZy5hcHBseSh0aGlzLGFyZ3VtZW50cylcclxuXHRcdC8vY29uc29sZS5sb2coY2hhcnMpXHJcblx0XHRpZih0aGlzLmN1cnJlbnRFbGVtZW50ICYmIGNoYXJzKXtcclxuXHRcdFx0aWYgKHRoaXMuY2RhdGEpIHtcclxuXHRcdFx0XHR2YXIgY2hhck5vZGUgPSB0aGlzLmRvY3VtZW50LmNyZWF0ZUNEQVRBU2VjdGlvbihjaGFycyk7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RWxlbWVudC5hcHBlbmRDaGlsZChjaGFyTm9kZSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGNoYXJOb2RlID0gdGhpcy5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGFycyk7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RWxlbWVudC5hcHBlbmRDaGlsZChjaGFyTm9kZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5sb2NhdG9yICYmIHBvc2l0aW9uKHRoaXMubG9jYXRvcixjaGFyTm9kZSlcclxuXHRcdH1cclxuXHR9LFxyXG5cdHNraXBwZWRFbnRpdHk6ZnVuY3Rpb24obmFtZSkge1xyXG5cdH0sXHJcblx0ZW5kRG9jdW1lbnQ6ZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLmRvY3VtZW50Lm5vcm1hbGl6ZSgpO1xyXG5cdH0sXHJcblx0c2V0RG9jdW1lbnRMb2NhdG9yOmZ1bmN0aW9uIChsb2NhdG9yKSB7XHJcblx0ICAgIGlmKHRoaXMubG9jYXRvciA9IGxvY2F0b3Ipey8vICYmICEoJ2xpbmVOdW1iZXInIGluIGxvY2F0b3IpKXtcclxuXHQgICAgXHRsb2NhdG9yLmxpbmVOdW1iZXIgPSAwO1xyXG5cdCAgICB9XHJcblx0fSxcclxuXHQvL0xleGljYWxIYW5kbGVyXHJcblx0Y29tbWVudDpmdW5jdGlvbihjaGFycywgc3RhcnQsIGxlbmd0aCkge1xyXG5cdFx0Y2hhcnMgPSBfdG9TdHJpbmcuYXBwbHkodGhpcyxhcmd1bWVudHMpXHJcblx0ICAgIHZhciBjb21tID0gdGhpcy5kb2N1bWVudC5jcmVhdGVDb21tZW50KGNoYXJzKTtcclxuXHQgICAgdGhpcy5sb2NhdG9yICYmIHBvc2l0aW9uKHRoaXMubG9jYXRvcixjb21tKVxyXG5cdCAgICBhcHBlbmRFbGVtZW50KHRoaXMsIGNvbW0pO1xyXG5cdH0sXHJcblx0XHJcblx0c3RhcnRDREFUQTpmdW5jdGlvbigpIHtcclxuXHQgICAgLy91c2VkIGluIGNoYXJhY3RlcnMoKSBtZXRob2RzXHJcblx0ICAgIHRoaXMuY2RhdGEgPSB0cnVlO1xyXG5cdH0sXHJcblx0ZW5kQ0RBVEE6ZnVuY3Rpb24oKSB7XHJcblx0ICAgIHRoaXMuY2RhdGEgPSBmYWxzZTtcclxuXHR9LFxyXG5cdFxyXG5cdHN0YXJ0RFREOmZ1bmN0aW9uKG5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZCkge1xyXG5cdFx0dmFyIGltcGwgPSB0aGlzLmRvY3VtZW50LmltcGxlbWVudGF0aW9uO1xyXG5cdCAgICBpZiAoaW1wbCAmJiBpbXBsLmNyZWF0ZURvY3VtZW50VHlwZSkge1xyXG5cdCAgICAgICAgdmFyIGR0ID0gaW1wbC5jcmVhdGVEb2N1bWVudFR5cGUobmFtZSwgcHVibGljSWQsIHN5c3RlbUlkKTtcclxuXHQgICAgICAgIHRoaXMubG9jYXRvciAmJiBwb3NpdGlvbih0aGlzLmxvY2F0b3IsZHQpXHJcblx0ICAgICAgICBhcHBlbmRFbGVtZW50KHRoaXMsIGR0KTtcclxuXHQgICAgfVxyXG5cdH0sXHJcblx0LyoqXHJcblx0ICogQHNlZSBvcmcueG1sLnNheC5FcnJvckhhbmRsZXJcclxuXHQgKiBAbGluayBodHRwOi8vd3d3LnNheHByb2plY3Qub3JnL2FwaWRvYy9vcmcveG1sL3NheC9FcnJvckhhbmRsZXIuaHRtbFxyXG5cdCAqL1xyXG5cdHdhcm5pbmc6ZnVuY3Rpb24oZXJyb3IpIHtcclxuXHRcdGNvbnNvbGUud2FybignW3htbGRvbSB3YXJuaW5nXVxcdCcrZXJyb3IsX2xvY2F0b3IodGhpcy5sb2NhdG9yKSk7XHJcblx0fSxcclxuXHRlcnJvcjpmdW5jdGlvbihlcnJvcikge1xyXG5cdFx0Y29uc29sZS5lcnJvcignW3htbGRvbSBlcnJvcl1cXHQnK2Vycm9yLF9sb2NhdG9yKHRoaXMubG9jYXRvcikpO1xyXG5cdH0sXHJcblx0ZmF0YWxFcnJvcjpmdW5jdGlvbihlcnJvcikge1xyXG5cdFx0Y29uc29sZS5lcnJvcignW3htbGRvbSBmYXRhbEVycm9yXVxcdCcrZXJyb3IsX2xvY2F0b3IodGhpcy5sb2NhdG9yKSk7XHJcblx0ICAgIHRocm93IGVycm9yO1xyXG5cdH1cclxufVxyXG5mdW5jdGlvbiBfbG9jYXRvcihsKXtcclxuXHRpZihsKXtcclxuXHRcdHJldHVybiAnXFxuQCcrKGwuc3lzdGVtSWQgfHwnJykrJyNbbGluZTonK2wubGluZU51bWJlcisnLGNvbDonK2wuY29sdW1uTnVtYmVyKyddJ1xyXG5cdH1cclxufVxyXG5mdW5jdGlvbiBfdG9TdHJpbmcoY2hhcnMsc3RhcnQsbGVuZ3RoKXtcclxuXHRpZih0eXBlb2YgY2hhcnMgPT0gJ3N0cmluZycpe1xyXG5cdFx0cmV0dXJuIGNoYXJzLnN1YnN0cihzdGFydCxsZW5ndGgpXHJcblx0fWVsc2V7Ly9qYXZhIHNheCBjb25uZWN0IHdpZHRoIHhtbGRvbSBvbiByaGlubyh3aGF0IGFib3V0OiBcIj8gJiYgIShjaGFycyBpbnN0YW5jZW9mIFN0cmluZylcIilcclxuXHRcdGlmKGNoYXJzLmxlbmd0aCA+PSBzdGFydCtsZW5ndGggfHwgc3RhcnQpe1xyXG5cdFx0XHRyZXR1cm4gbmV3IGphdmEubGFuZy5TdHJpbmcoY2hhcnMsc3RhcnQsbGVuZ3RoKSsnJztcclxuXHRcdH1cclxuXHRcdHJldHVybiBjaGFycztcclxuXHR9XHJcbn1cclxuXHJcbi8qXHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L2V4dC9MZXhpY2FsSGFuZGxlci5odG1sXHJcbiAqIHVzZWQgbWV0aG9kIG9mIG9yZy54bWwuc2F4LmV4dC5MZXhpY2FsSGFuZGxlcjpcclxuICogICNjb21tZW50KGNoYXJzLCBzdGFydCwgbGVuZ3RoKVxyXG4gKiAgI3N0YXJ0Q0RBVEEoKVxyXG4gKiAgI2VuZENEQVRBKClcclxuICogICNzdGFydERURChuYW1lLCBwdWJsaWNJZCwgc3lzdGVtSWQpXHJcbiAqXHJcbiAqXHJcbiAqIElHTk9SRUQgbWV0aG9kIG9mIG9yZy54bWwuc2F4LmV4dC5MZXhpY2FsSGFuZGxlcjpcclxuICogICNlbmREVEQoKVxyXG4gKiAgI3N0YXJ0RW50aXR5KG5hbWUpXHJcbiAqICAjZW5kRW50aXR5KG5hbWUpXHJcbiAqXHJcbiAqXHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L2V4dC9EZWNsSGFuZGxlci5odG1sXHJcbiAqIElHTk9SRUQgbWV0aG9kIG9mIG9yZy54bWwuc2F4LmV4dC5EZWNsSGFuZGxlclxyXG4gKiBcdCNhdHRyaWJ1dGVEZWNsKGVOYW1lLCBhTmFtZSwgdHlwZSwgbW9kZSwgdmFsdWUpXHJcbiAqICAjZWxlbWVudERlY2wobmFtZSwgbW9kZWwpXHJcbiAqICAjZXh0ZXJuYWxFbnRpdHlEZWNsKG5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZClcclxuICogICNpbnRlcm5hbEVudGl0eURlY2wobmFtZSwgdmFsdWUpXHJcbiAqIEBsaW5rIGh0dHA6Ly93d3cuc2F4cHJvamVjdC5vcmcvYXBpZG9jL29yZy94bWwvc2F4L2V4dC9FbnRpdHlSZXNvbHZlcjIuaHRtbFxyXG4gKiBJR05PUkVEIG1ldGhvZCBvZiBvcmcueG1sLnNheC5FbnRpdHlSZXNvbHZlcjJcclxuICogICNyZXNvbHZlRW50aXR5KFN0cmluZyBuYW1lLFN0cmluZyBwdWJsaWNJZCxTdHJpbmcgYmFzZVVSSSxTdHJpbmcgc3lzdGVtSWQpXHJcbiAqICAjcmVzb2x2ZUVudGl0eShwdWJsaWNJZCwgc3lzdGVtSWQpXHJcbiAqICAjZ2V0RXh0ZXJuYWxTdWJzZXQobmFtZSwgYmFzZVVSSSlcclxuICogQGxpbmsgaHR0cDovL3d3dy5zYXhwcm9qZWN0Lm9yZy9hcGlkb2Mvb3JnL3htbC9zYXgvRFRESGFuZGxlci5odG1sXHJcbiAqIElHTk9SRUQgbWV0aG9kIG9mIG9yZy54bWwuc2F4LkRUREhhbmRsZXJcclxuICogICNub3RhdGlvbkRlY2wobmFtZSwgcHVibGljSWQsIHN5c3RlbUlkKSB7fTtcclxuICogICN1bnBhcnNlZEVudGl0eURlY2wobmFtZSwgcHVibGljSWQsIHN5c3RlbUlkLCBub3RhdGlvbk5hbWUpIHt9O1xyXG4gKi9cclxuXCJlbmREVEQsc3RhcnRFbnRpdHksZW5kRW50aXR5LGF0dHJpYnV0ZURlY2wsZWxlbWVudERlY2wsZXh0ZXJuYWxFbnRpdHlEZWNsLGludGVybmFsRW50aXR5RGVjbCxyZXNvbHZlRW50aXR5LGdldEV4dGVybmFsU3Vic2V0LG5vdGF0aW9uRGVjbCx1bnBhcnNlZEVudGl0eURlY2xcIi5yZXBsYWNlKC9cXHcrL2csZnVuY3Rpb24oa2V5KXtcclxuXHRET01IYW5kbGVyLnByb3RvdHlwZVtrZXldID0gZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH1cclxufSlcclxuXHJcbi8qIFByaXZhdGUgc3RhdGljIGhlbHBlcnMgdHJlYXRlZCBiZWxvdyBhcyBwcml2YXRlIGluc3RhbmNlIG1ldGhvZHMsIHNvIGRvbid0IG5lZWQgdG8gYWRkIHRoZXNlIHRvIHRoZSBwdWJsaWMgQVBJOyB3ZSBtaWdodCB1c2UgYSBSZWxhdG9yIHRvIGFsc28gZ2V0IHJpZCBvZiBub24tc3RhbmRhcmQgcHVibGljIHByb3BlcnRpZXMgKi9cclxuZnVuY3Rpb24gYXBwZW5kRWxlbWVudCAoaGFuZGVyLG5vZGUpIHtcclxuICAgIGlmICghaGFuZGVyLmN1cnJlbnRFbGVtZW50KSB7XHJcbiAgICAgICAgaGFuZGVyLmRvY3VtZW50LmFwcGVuZENoaWxkKG5vZGUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBoYW5kZXIuY3VycmVudEVsZW1lbnQuYXBwZW5kQ2hpbGQobm9kZSk7XHJcbiAgICB9XHJcbn0vL2FwcGVuZENoaWxkIGFuZCBzZXRBdHRyaWJ1dGVOUyBhcmUgcHJlZm9ybWFuY2Uga2V5XHJcblxyXG5pZih0eXBlb2YgcmVxdWlyZSA9PSAnZnVuY3Rpb24nKXtcclxuXHR2YXIgWE1MUmVhZGVyID0gcmVxdWlyZSgnLi9zYXgnKS5YTUxSZWFkZXI7XHJcblx0dmFyIERPTUltcGxlbWVudGF0aW9uID0gZXhwb3J0cy5ET01JbXBsZW1lbnRhdGlvbiA9IHJlcXVpcmUoJy4vZG9tJykuRE9NSW1wbGVtZW50YXRpb247XHJcblx0ZXhwb3J0cy5YTUxTZXJpYWxpemVyID0gcmVxdWlyZSgnLi9kb20nKS5YTUxTZXJpYWxpemVyIDtcclxuXHRleHBvcnRzLkRPTVBhcnNlciA9IERPTVBhcnNlcjtcclxufVxyXG4iLCIvKlxuICogRE9NIExldmVsIDJcbiAqIE9iamVjdCBET01FeGNlcHRpb25cbiAqIEBzZWUgaHR0cDovL3d3dy53My5vcmcvVFIvUkVDLURPTS1MZXZlbC0xL2VjbWEtc2NyaXB0LWxhbmd1YWdlLWJpbmRpbmcuaHRtbFxuICogQHNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi8yMDAwL1JFQy1ET00tTGV2ZWwtMi1Db3JlLTIwMDAxMTEzL2VjbWEtc2NyaXB0LWJpbmRpbmcuaHRtbFxuICovXG5cbmZ1bmN0aW9uIGNvcHkoc3JjLGRlc3Qpe1xuXHRmb3IodmFyIHAgaW4gc3JjKXtcblx0XHRkZXN0W3BdID0gc3JjW3BdO1xuXHR9XG59XG4vKipcbl5cXHcrXFwucHJvdG90eXBlXFwuKFtfXFx3XSspXFxzKj1cXHMqKCg/Oi4qXFx7XFxzKj9bXFxyXFxuXVtcXHNcXFNdKj9efSl8XFxTLio/KD89WztcXHJcXG5dKSk7P1xuXlxcdytcXC5wcm90b3R5cGVcXC4oW19cXHddKylcXHMqPVxccyooXFxTLio/KD89WztcXHJcXG5dKSk7P1xuICovXG5mdW5jdGlvbiBfZXh0ZW5kcyhDbGFzcyxTdXBlcil7XG5cdHZhciBwdCA9IENsYXNzLnByb3RvdHlwZTtcblx0aWYoT2JqZWN0LmNyZWF0ZSl7XG5cdFx0dmFyIHBwdCA9IE9iamVjdC5jcmVhdGUoU3VwZXIucHJvdG90eXBlKVxuXHRcdHB0Ll9fcHJvdG9fXyA9IHBwdDtcblx0fVxuXHRpZighKHB0IGluc3RhbmNlb2YgU3VwZXIpKXtcblx0XHRmdW5jdGlvbiB0KCl7fTtcblx0XHR0LnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcblx0XHR0ID0gbmV3IHQoKTtcblx0XHRjb3B5KHB0LHQpO1xuXHRcdENsYXNzLnByb3RvdHlwZSA9IHB0ID0gdDtcblx0fVxuXHRpZihwdC5jb25zdHJ1Y3RvciAhPSBDbGFzcyl7XG5cdFx0aWYodHlwZW9mIENsYXNzICE9ICdmdW5jdGlvbicpe1xuXHRcdFx0Y29uc29sZS5lcnJvcihcInVua25vdyBDbGFzczpcIitDbGFzcylcblx0XHR9XG5cdFx0cHQuY29uc3RydWN0b3IgPSBDbGFzc1xuXHR9XG59XG52YXIgaHRtbG5zID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnIDtcbi8vIE5vZGUgVHlwZXNcbnZhciBOb2RlVHlwZSA9IHt9XG52YXIgRUxFTUVOVF9OT0RFICAgICAgICAgICAgICAgID0gTm9kZVR5cGUuRUxFTUVOVF9OT0RFICAgICAgICAgICAgICAgID0gMTtcbnZhciBBVFRSSUJVVEVfTk9ERSAgICAgICAgICAgICAgPSBOb2RlVHlwZS5BVFRSSUJVVEVfTk9ERSAgICAgICAgICAgICAgPSAyO1xudmFyIFRFWFRfTk9ERSAgICAgICAgICAgICAgICAgICA9IE5vZGVUeXBlLlRFWFRfTk9ERSAgICAgICAgICAgICAgICAgICA9IDM7XG52YXIgQ0RBVEFfU0VDVElPTl9OT0RFICAgICAgICAgID0gTm9kZVR5cGUuQ0RBVEFfU0VDVElPTl9OT0RFICAgICAgICAgID0gNDtcbnZhciBFTlRJVFlfUkVGRVJFTkNFX05PREUgICAgICAgPSBOb2RlVHlwZS5FTlRJVFlfUkVGRVJFTkNFX05PREUgICAgICAgPSA1O1xudmFyIEVOVElUWV9OT0RFICAgICAgICAgICAgICAgICA9IE5vZGVUeXBlLkVOVElUWV9OT0RFICAgICAgICAgICAgICAgICA9IDY7XG52YXIgUFJPQ0VTU0lOR19JTlNUUlVDVElPTl9OT0RFID0gTm9kZVR5cGUuUFJPQ0VTU0lOR19JTlNUUlVDVElPTl9OT0RFID0gNztcbnZhciBDT01NRU5UX05PREUgICAgICAgICAgICAgICAgPSBOb2RlVHlwZS5DT01NRU5UX05PREUgICAgICAgICAgICAgICAgPSA4O1xudmFyIERPQ1VNRU5UX05PREUgICAgICAgICAgICAgICA9IE5vZGVUeXBlLkRPQ1VNRU5UX05PREUgICAgICAgICAgICAgICA9IDk7XG52YXIgRE9DVU1FTlRfVFlQRV9OT0RFICAgICAgICAgID0gTm9kZVR5cGUuRE9DVU1FTlRfVFlQRV9OT0RFICAgICAgICAgID0gMTA7XG52YXIgRE9DVU1FTlRfRlJBR01FTlRfTk9ERSAgICAgID0gTm9kZVR5cGUuRE9DVU1FTlRfRlJBR01FTlRfTk9ERSAgICAgID0gMTE7XG52YXIgTk9UQVRJT05fTk9ERSAgICAgICAgICAgICAgID0gTm9kZVR5cGUuTk9UQVRJT05fTk9ERSAgICAgICAgICAgICAgID0gMTI7XG5cbi8vIEV4Y2VwdGlvbkNvZGVcbnZhciBFeGNlcHRpb25Db2RlID0ge31cbnZhciBFeGNlcHRpb25NZXNzYWdlID0ge307XG52YXIgSU5ERVhfU0laRV9FUlIgICAgICAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5JTkRFWF9TSVpFX0VSUiAgICAgICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMV09XCJJbmRleCBzaXplIGVycm9yXCIpLDEpO1xudmFyIERPTVNUUklOR19TSVpFX0VSUiAgICAgICAgICA9IEV4Y2VwdGlvbkNvZGUuRE9NU1RSSU5HX1NJWkVfRVJSICAgICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzJdPVwiRE9NU3RyaW5nIHNpemUgZXJyb3JcIiksMik7XG52YXIgSElFUkFSQ0hZX1JFUVVFU1RfRVJSICAgICAgID0gRXhjZXB0aW9uQ29kZS5ISUVSQVJDSFlfUkVRVUVTVF9FUlIgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbM109XCJIaWVyYXJjaHkgcmVxdWVzdCBlcnJvclwiKSwzKTtcbnZhciBXUk9OR19ET0NVTUVOVF9FUlIgICAgICAgICAgPSBFeGNlcHRpb25Db2RlLldST05HX0RPQ1VNRU5UX0VSUiAgICAgICAgICA9ICgoRXhjZXB0aW9uTWVzc2FnZVs0XT1cIldyb25nIGRvY3VtZW50XCIpLDQpO1xudmFyIElOVkFMSURfQ0hBUkFDVEVSX0VSUiAgICAgICA9IEV4Y2VwdGlvbkNvZGUuSU5WQUxJRF9DSEFSQUNURVJfRVJSICAgICAgID0gKChFeGNlcHRpb25NZXNzYWdlWzVdPVwiSW52YWxpZCBjaGFyYWN0ZXJcIiksNSk7XG52YXIgTk9fREFUQV9BTExPV0VEX0VSUiAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5OT19EQVRBX0FMTE9XRURfRVJSICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbNl09XCJObyBkYXRhIGFsbG93ZWRcIiksNik7XG52YXIgTk9fTU9ESUZJQ0FUSU9OX0FMTE9XRURfRVJSID0gRXhjZXB0aW9uQ29kZS5OT19NT0RJRklDQVRJT05fQUxMT1dFRF9FUlIgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbN109XCJObyBtb2RpZmljYXRpb24gYWxsb3dlZFwiKSw3KTtcbnZhciBOT1RfRk9VTkRfRVJSICAgICAgICAgICAgICAgPSBFeGNlcHRpb25Db2RlLk5PVF9GT1VORF9FUlIgICAgICAgICAgICAgICA9ICgoRXhjZXB0aW9uTWVzc2FnZVs4XT1cIk5vdCBmb3VuZFwiKSw4KTtcbnZhciBOT1RfU1VQUE9SVEVEX0VSUiAgICAgICAgICAgPSBFeGNlcHRpb25Db2RlLk5PVF9TVVBQT1JURURfRVJSICAgICAgICAgICA9ICgoRXhjZXB0aW9uTWVzc2FnZVs5XT1cIk5vdCBzdXBwb3J0ZWRcIiksOSk7XG52YXIgSU5VU0VfQVRUUklCVVRFX0VSUiAgICAgICAgID0gRXhjZXB0aW9uQ29kZS5JTlVTRV9BVFRSSUJVVEVfRVJSICAgICAgICAgPSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMTBdPVwiQXR0cmlidXRlIGluIHVzZVwiKSwxMCk7XG4vL2xldmVsMlxudmFyIElOVkFMSURfU1RBVEVfRVJSICAgICAgICBcdD0gRXhjZXB0aW9uQ29kZS5JTlZBTElEX1NUQVRFX0VSUiAgICAgICAgXHQ9ICgoRXhjZXB0aW9uTWVzc2FnZVsxMV09XCJJbnZhbGlkIHN0YXRlXCIpLDExKTtcbnZhciBTWU5UQVhfRVJSICAgICAgICAgICAgICAgXHQ9IEV4Y2VwdGlvbkNvZGUuU1lOVEFYX0VSUiAgICAgICAgICAgICAgIFx0PSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMTJdPVwiU3ludGF4IGVycm9yXCIpLDEyKTtcbnZhciBJTlZBTElEX01PRElGSUNBVElPTl9FUlIgXHQ9IEV4Y2VwdGlvbkNvZGUuSU5WQUxJRF9NT0RJRklDQVRJT05fRVJSIFx0PSAoKEV4Y2VwdGlvbk1lc3NhZ2VbMTNdPVwiSW52YWxpZCBtb2RpZmljYXRpb25cIiksMTMpO1xudmFyIE5BTUVTUEFDRV9FUlIgICAgICAgICAgICBcdD0gRXhjZXB0aW9uQ29kZS5OQU1FU1BBQ0VfRVJSICAgICAgICAgICBcdD0gKChFeGNlcHRpb25NZXNzYWdlWzE0XT1cIkludmFsaWQgbmFtZXNwYWNlXCIpLDE0KTtcbnZhciBJTlZBTElEX0FDQ0VTU19FUlIgICAgICAgXHQ9IEV4Y2VwdGlvbkNvZGUuSU5WQUxJRF9BQ0NFU1NfRVJSICAgICAgXHQ9ICgoRXhjZXB0aW9uTWVzc2FnZVsxNV09XCJJbnZhbGlkIGFjY2Vzc1wiKSwxNSk7XG5cblxuZnVuY3Rpb24gRE9NRXhjZXB0aW9uKGNvZGUsIG1lc3NhZ2UpIHtcblx0aWYobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKXtcblx0XHR2YXIgZXJyb3IgPSBtZXNzYWdlO1xuXHR9ZWxzZXtcblx0XHRlcnJvciA9IHRoaXM7XG5cdFx0RXJyb3IuY2FsbCh0aGlzLCBFeGNlcHRpb25NZXNzYWdlW2NvZGVdKTtcblx0XHR0aGlzLm1lc3NhZ2UgPSBFeGNlcHRpb25NZXNzYWdlW2NvZGVdO1xuXHRcdGlmKEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKSBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBET01FeGNlcHRpb24pO1xuXHR9XG5cdGVycm9yLmNvZGUgPSBjb2RlO1xuXHRpZihtZXNzYWdlKSB0aGlzLm1lc3NhZ2UgPSB0aGlzLm1lc3NhZ2UgKyBcIjogXCIgKyBtZXNzYWdlO1xuXHRyZXR1cm4gZXJyb3I7XG59O1xuRE9NRXhjZXB0aW9uLnByb3RvdHlwZSA9IEVycm9yLnByb3RvdHlwZTtcbmNvcHkoRXhjZXB0aW9uQ29kZSxET01FeGNlcHRpb24pXG4vKipcbiAqIEBzZWUgaHR0cDovL3d3dy53My5vcmcvVFIvMjAwMC9SRUMtRE9NLUxldmVsLTItQ29yZS0yMDAwMTExMy9jb3JlLmh0bWwjSUQtNTM2Mjk3MTc3XG4gKiBUaGUgTm9kZUxpc3QgaW50ZXJmYWNlIHByb3ZpZGVzIHRoZSBhYnN0cmFjdGlvbiBvZiBhbiBvcmRlcmVkIGNvbGxlY3Rpb24gb2Ygbm9kZXMsIHdpdGhvdXQgZGVmaW5pbmcgb3IgY29uc3RyYWluaW5nIGhvdyB0aGlzIGNvbGxlY3Rpb24gaXMgaW1wbGVtZW50ZWQuIE5vZGVMaXN0IG9iamVjdHMgaW4gdGhlIERPTSBhcmUgbGl2ZS5cbiAqIFRoZSBpdGVtcyBpbiB0aGUgTm9kZUxpc3QgYXJlIGFjY2Vzc2libGUgdmlhIGFuIGludGVncmFsIGluZGV4LCBzdGFydGluZyBmcm9tIDAuXG4gKi9cbmZ1bmN0aW9uIE5vZGVMaXN0KCkge1xufTtcbk5vZGVMaXN0LnByb3RvdHlwZSA9IHtcblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2Ygbm9kZXMgaW4gdGhlIGxpc3QuIFRoZSByYW5nZSBvZiB2YWxpZCBjaGlsZCBub2RlIGluZGljZXMgaXMgMCB0byBsZW5ndGgtMSBpbmNsdXNpdmUuXG5cdCAqIEBzdGFuZGFyZCBsZXZlbDFcblx0ICovXG5cdGxlbmd0aDowLCBcblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGluZGV4dGggaXRlbSBpbiB0aGUgY29sbGVjdGlvbi4gSWYgaW5kZXggaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIHRoZSBudW1iZXIgb2Ygbm9kZXMgaW4gdGhlIGxpc3QsIHRoaXMgcmV0dXJucyBudWxsLlxuXHQgKiBAc3RhbmRhcmQgbGV2ZWwxXG5cdCAqIEBwYXJhbSBpbmRleCAgdW5zaWduZWQgbG9uZyBcblx0ICogICBJbmRleCBpbnRvIHRoZSBjb2xsZWN0aW9uLlxuXHQgKiBAcmV0dXJuIE5vZGVcblx0ICogXHRUaGUgbm9kZSBhdCB0aGUgaW5kZXh0aCBwb3NpdGlvbiBpbiB0aGUgTm9kZUxpc3QsIG9yIG51bGwgaWYgdGhhdCBpcyBub3QgYSB2YWxpZCBpbmRleC4gXG5cdCAqL1xuXHRpdGVtOiBmdW5jdGlvbihpbmRleCkge1xuXHRcdHJldHVybiB0aGlzW2luZGV4XSB8fCBudWxsO1xuXHR9LFxuXHR0b1N0cmluZzpmdW5jdGlvbigpe1xuXHRcdGZvcih2YXIgYnVmID0gW10sIGkgPSAwO2k8dGhpcy5sZW5ndGg7aSsrKXtcblx0XHRcdHNlcmlhbGl6ZVRvU3RyaW5nKHRoaXNbaV0sYnVmKTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1Zi5qb2luKCcnKTtcblx0fVxufTtcbmZ1bmN0aW9uIExpdmVOb2RlTGlzdChub2RlLHJlZnJlc2gpe1xuXHR0aGlzLl9ub2RlID0gbm9kZTtcblx0dGhpcy5fcmVmcmVzaCA9IHJlZnJlc2hcblx0X3VwZGF0ZUxpdmVMaXN0KHRoaXMpO1xufVxuZnVuY3Rpb24gX3VwZGF0ZUxpdmVMaXN0KGxpc3Qpe1xuXHR2YXIgaW5jID0gbGlzdC5fbm9kZS5faW5jIHx8IGxpc3QuX25vZGUub3duZXJEb2N1bWVudC5faW5jO1xuXHRpZihsaXN0Ll9pbmMgIT0gaW5jKXtcblx0XHR2YXIgbHMgPSBsaXN0Ll9yZWZyZXNoKGxpc3QuX25vZGUpO1xuXHRcdC8vY29uc29sZS5sb2cobHMubGVuZ3RoKVxuXHRcdF9fc2V0X18obGlzdCwnbGVuZ3RoJyxscy5sZW5ndGgpO1xuXHRcdGNvcHkobHMsbGlzdCk7XG5cdFx0bGlzdC5faW5jID0gaW5jO1xuXHR9XG59XG5MaXZlTm9kZUxpc3QucHJvdG90eXBlLml0ZW0gPSBmdW5jdGlvbihpKXtcblx0X3VwZGF0ZUxpdmVMaXN0KHRoaXMpO1xuXHRyZXR1cm4gdGhpc1tpXTtcbn1cblxuX2V4dGVuZHMoTGl2ZU5vZGVMaXN0LE5vZGVMaXN0KTtcbi8qKlxuICogXG4gKiBPYmplY3RzIGltcGxlbWVudGluZyB0aGUgTmFtZWROb2RlTWFwIGludGVyZmFjZSBhcmUgdXNlZCB0byByZXByZXNlbnQgY29sbGVjdGlvbnMgb2Ygbm9kZXMgdGhhdCBjYW4gYmUgYWNjZXNzZWQgYnkgbmFtZS4gTm90ZSB0aGF0IE5hbWVkTm9kZU1hcCBkb2VzIG5vdCBpbmhlcml0IGZyb20gTm9kZUxpc3Q7IE5hbWVkTm9kZU1hcHMgYXJlIG5vdCBtYWludGFpbmVkIGluIGFueSBwYXJ0aWN1bGFyIG9yZGVyLiBPYmplY3RzIGNvbnRhaW5lZCBpbiBhbiBvYmplY3QgaW1wbGVtZW50aW5nIE5hbWVkTm9kZU1hcCBtYXkgYWxzbyBiZSBhY2Nlc3NlZCBieSBhbiBvcmRpbmFsIGluZGV4LCBidXQgdGhpcyBpcyBzaW1wbHkgdG8gYWxsb3cgY29udmVuaWVudCBlbnVtZXJhdGlvbiBvZiB0aGUgY29udGVudHMgb2YgYSBOYW1lZE5vZGVNYXAsIGFuZCBkb2VzIG5vdCBpbXBseSB0aGF0IHRoZSBET00gc3BlY2lmaWVzIGFuIG9yZGVyIHRvIHRoZXNlIE5vZGVzLlxuICogTmFtZWROb2RlTWFwIG9iamVjdHMgaW4gdGhlIERPTSBhcmUgbGl2ZS5cbiAqIHVzZWQgZm9yIGF0dHJpYnV0ZXMgb3IgRG9jdW1lbnRUeXBlIGVudGl0aWVzIFxuICovXG5mdW5jdGlvbiBOYW1lZE5vZGVNYXAoKSB7XG59O1xuXG5mdW5jdGlvbiBfZmluZE5vZGVJbmRleChsaXN0LG5vZGUpe1xuXHR2YXIgaSA9IGxpc3QubGVuZ3RoO1xuXHR3aGlsZShpLS0pe1xuXHRcdGlmKGxpc3RbaV0gPT09IG5vZGUpe3JldHVybiBpfVxuXHR9XG59XG5cbmZ1bmN0aW9uIF9hZGROYW1lZE5vZGUoZWwsbGlzdCxuZXdBdHRyLG9sZEF0dHIpe1xuXHRpZihvbGRBdHRyKXtcblx0XHRsaXN0W19maW5kTm9kZUluZGV4KGxpc3Qsb2xkQXR0cildID0gbmV3QXR0cjtcblx0fWVsc2V7XG5cdFx0bGlzdFtsaXN0Lmxlbmd0aCsrXSA9IG5ld0F0dHI7XG5cdH1cblx0aWYoZWwpe1xuXHRcdG5ld0F0dHIub3duZXJFbGVtZW50ID0gZWw7XG5cdFx0dmFyIGRvYyA9IGVsLm93bmVyRG9jdW1lbnQ7XG5cdFx0aWYoZG9jKXtcblx0XHRcdG9sZEF0dHIgJiYgX29uUmVtb3ZlQXR0cmlidXRlKGRvYyxlbCxvbGRBdHRyKTtcblx0XHRcdF9vbkFkZEF0dHJpYnV0ZShkb2MsZWwsbmV3QXR0cik7XG5cdFx0fVxuXHR9XG59XG5mdW5jdGlvbiBfcmVtb3ZlTmFtZWROb2RlKGVsLGxpc3QsYXR0cil7XG5cdHZhciBpID0gX2ZpbmROb2RlSW5kZXgobGlzdCxhdHRyKTtcblx0aWYoaT49MCl7XG5cdFx0dmFyIGxhc3RJbmRleCA9IGxpc3QubGVuZ3RoLTFcblx0XHR3aGlsZShpPGxhc3RJbmRleCl7XG5cdFx0XHRsaXN0W2ldID0gbGlzdFsrK2ldXG5cdFx0fVxuXHRcdGxpc3QubGVuZ3RoID0gbGFzdEluZGV4O1xuXHRcdGlmKGVsKXtcblx0XHRcdHZhciBkb2MgPSBlbC5vd25lckRvY3VtZW50O1xuXHRcdFx0aWYoZG9jKXtcblx0XHRcdFx0X29uUmVtb3ZlQXR0cmlidXRlKGRvYyxlbCxhdHRyKTtcblx0XHRcdFx0YXR0ci5vd25lckVsZW1lbnQgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0fWVsc2V7XG5cdFx0dGhyb3cgRE9NRXhjZXB0aW9uKE5PVF9GT1VORF9FUlIsbmV3IEVycm9yKCkpXG5cdH1cbn1cbk5hbWVkTm9kZU1hcC5wcm90b3R5cGUgPSB7XG5cdGxlbmd0aDowLFxuXHRpdGVtOk5vZGVMaXN0LnByb3RvdHlwZS5pdGVtLFxuXHRnZXROYW1lZEl0ZW06IGZ1bmN0aW9uKGtleSkge1xuLy9cdFx0aWYoa2V5LmluZGV4T2YoJzonKT4wIHx8IGtleSA9PSAneG1sbnMnKXtcbi8vXHRcdFx0cmV0dXJuIG51bGw7XG4vL1x0XHR9XG5cdFx0dmFyIGkgPSB0aGlzLmxlbmd0aDtcblx0XHR3aGlsZShpLS0pe1xuXHRcdFx0dmFyIGF0dHIgPSB0aGlzW2ldO1xuXHRcdFx0aWYoYXR0ci5ub2RlTmFtZSA9PSBrZXkpe1xuXHRcdFx0XHRyZXR1cm4gYXR0cjtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdHNldE5hbWVkSXRlbTogZnVuY3Rpb24oYXR0cikge1xuXHRcdHZhciBlbCA9IGF0dHIub3duZXJFbGVtZW50O1xuXHRcdGlmKGVsICYmIGVsIT10aGlzLl9vd25lckVsZW1lbnQpe1xuXHRcdFx0dGhyb3cgbmV3IERPTUV4Y2VwdGlvbihJTlVTRV9BVFRSSUJVVEVfRVJSKTtcblx0XHR9XG5cdFx0dmFyIG9sZEF0dHIgPSB0aGlzLmdldE5hbWVkSXRlbShhdHRyLm5vZGVOYW1lKTtcblx0XHRfYWRkTmFtZWROb2RlKHRoaXMuX293bmVyRWxlbWVudCx0aGlzLGF0dHIsb2xkQXR0cik7XG5cdFx0cmV0dXJuIG9sZEF0dHI7XG5cdH0sXG5cdC8qIHJldHVybnMgTm9kZSAqL1xuXHRzZXROYW1lZEl0ZW1OUzogZnVuY3Rpb24oYXR0cikgey8vIHJhaXNlczogV1JPTkdfRE9DVU1FTlRfRVJSLE5PX01PRElGSUNBVElPTl9BTExPV0VEX0VSUixJTlVTRV9BVFRSSUJVVEVfRVJSXG5cdFx0dmFyIGVsID0gYXR0ci5vd25lckVsZW1lbnQsIG9sZEF0dHI7XG5cdFx0aWYoZWwgJiYgZWwhPXRoaXMuX293bmVyRWxlbWVudCl7XG5cdFx0XHR0aHJvdyBuZXcgRE9NRXhjZXB0aW9uKElOVVNFX0FUVFJJQlVURV9FUlIpO1xuXHRcdH1cblx0XHRvbGRBdHRyID0gdGhpcy5nZXROYW1lZEl0ZW1OUyhhdHRyLm5hbWVzcGFjZVVSSSxhdHRyLmxvY2FsTmFtZSk7XG5cdFx0X2FkZE5hbWVkTm9kZSh0aGlzLl9vd25lckVsZW1lbnQsdGhpcyxhdHRyLG9sZEF0dHIpO1xuXHRcdHJldHVybiBvbGRBdHRyO1xuXHR9LFxuXG5cdC8qIHJldHVybnMgTm9kZSAqL1xuXHRyZW1vdmVOYW1lZEl0ZW06IGZ1bmN0aW9uKGtleSkge1xuXHRcdHZhciBhdHRyID0gdGhpcy5nZXROYW1lZEl0ZW0oa2V5KTtcblx0XHRfcmVtb3ZlTmFtZWROb2RlKHRoaXMuX293bmVyRWxlbWVudCx0aGlzLGF0dHIpO1xuXHRcdHJldHVybiBhdHRyO1xuXHRcdFxuXHRcdFxuXHR9LC8vIHJhaXNlczogTk9UX0ZPVU5EX0VSUixOT19NT0RJRklDQVRJT05fQUxMT1dFRF9FUlJcblx0XG5cdC8vZm9yIGxldmVsMlxuXHRyZW1vdmVOYW1lZEl0ZW1OUzpmdW5jdGlvbihuYW1lc3BhY2VVUkksbG9jYWxOYW1lKXtcblx0XHR2YXIgYXR0ciA9IHRoaXMuZ2V0TmFtZWRJdGVtTlMobmFtZXNwYWNlVVJJLGxvY2FsTmFtZSk7XG5cdFx0X3JlbW92ZU5hbWVkTm9kZSh0aGlzLl9vd25lckVsZW1lbnQsdGhpcyxhdHRyKTtcblx0XHRyZXR1cm4gYXR0cjtcblx0fSxcblx0Z2V0TmFtZWRJdGVtTlM6IGZ1bmN0aW9uKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKSB7XG5cdFx0dmFyIGkgPSB0aGlzLmxlbmd0aDtcblx0XHR3aGlsZShpLS0pe1xuXHRcdFx0dmFyIG5vZGUgPSB0aGlzW2ldO1xuXHRcdFx0aWYobm9kZS5sb2NhbE5hbWUgPT0gbG9jYWxOYW1lICYmIG5vZGUubmFtZXNwYWNlVVJJID09IG5hbWVzcGFjZVVSSSl7XG5cdFx0XHRcdHJldHVybiBub2RlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufTtcbi8qKlxuICogQHNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9SRUMtRE9NLUxldmVsLTEvbGV2ZWwtb25lLWNvcmUuaHRtbCNJRC0xMDIxNjE0OTBcbiAqL1xuZnVuY3Rpb24gRE9NSW1wbGVtZW50YXRpb24oLyogT2JqZWN0ICovIGZlYXR1cmVzKSB7XG5cdHRoaXMuX2ZlYXR1cmVzID0ge307XG5cdGlmIChmZWF0dXJlcykge1xuXHRcdGZvciAodmFyIGZlYXR1cmUgaW4gZmVhdHVyZXMpIHtcblx0XHRcdCB0aGlzLl9mZWF0dXJlcyA9IGZlYXR1cmVzW2ZlYXR1cmVdO1xuXHRcdH1cblx0fVxufTtcblxuRE9NSW1wbGVtZW50YXRpb24ucHJvdG90eXBlID0ge1xuXHRoYXNGZWF0dXJlOiBmdW5jdGlvbigvKiBzdHJpbmcgKi8gZmVhdHVyZSwgLyogc3RyaW5nICovIHZlcnNpb24pIHtcblx0XHR2YXIgdmVyc2lvbnMgPSB0aGlzLl9mZWF0dXJlc1tmZWF0dXJlLnRvTG93ZXJDYXNlKCldO1xuXHRcdGlmICh2ZXJzaW9ucyAmJiAoIXZlcnNpb24gfHwgdmVyc2lvbiBpbiB2ZXJzaW9ucykpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9LFxuXHQvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuXHRjcmVhdGVEb2N1bWVudDpmdW5jdGlvbihuYW1lc3BhY2VVUkksICBxdWFsaWZpZWROYW1lLCBkb2N0eXBlKXsvLyByYWlzZXM6SU5WQUxJRF9DSEFSQUNURVJfRVJSLE5BTUVTUEFDRV9FUlIsV1JPTkdfRE9DVU1FTlRfRVJSXG5cdFx0dmFyIGRvYyA9IG5ldyBEb2N1bWVudCgpO1xuXHRcdGRvYy5pbXBsZW1lbnRhdGlvbiA9IHRoaXM7XG5cdFx0ZG9jLmNoaWxkTm9kZXMgPSBuZXcgTm9kZUxpc3QoKTtcblx0XHRkb2MuZG9jdHlwZSA9IGRvY3R5cGU7XG5cdFx0aWYoZG9jdHlwZSl7XG5cdFx0XHRkb2MuYXBwZW5kQ2hpbGQoZG9jdHlwZSk7XG5cdFx0fVxuXHRcdGlmKHF1YWxpZmllZE5hbWUpe1xuXHRcdFx0dmFyIHJvb3QgPSBkb2MuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSxxdWFsaWZpZWROYW1lKTtcblx0XHRcdGRvYy5hcHBlbmRDaGlsZChyb290KTtcblx0XHR9XG5cdFx0cmV0dXJuIGRvYztcblx0fSxcblx0Ly8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcblx0Y3JlYXRlRG9jdW1lbnRUeXBlOmZ1bmN0aW9uKHF1YWxpZmllZE5hbWUsIHB1YmxpY0lkLCBzeXN0ZW1JZCl7Ly8gcmFpc2VzOklOVkFMSURfQ0hBUkFDVEVSX0VSUixOQU1FU1BBQ0VfRVJSXG5cdFx0dmFyIG5vZGUgPSBuZXcgRG9jdW1lbnRUeXBlKCk7XG5cdFx0bm9kZS5uYW1lID0gcXVhbGlmaWVkTmFtZTtcblx0XHRub2RlLm5vZGVOYW1lID0gcXVhbGlmaWVkTmFtZTtcblx0XHRub2RlLnB1YmxpY0lkID0gcHVibGljSWQ7XG5cdFx0bm9kZS5zeXN0ZW1JZCA9IHN5c3RlbUlkO1xuXHRcdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdFx0Ly9yZWFkb25seSBhdHRyaWJ1dGUgRE9NU3RyaW5nICAgICAgICBpbnRlcm5hbFN1YnNldDtcblx0XHRcblx0XHQvL1RPRE86Li5cblx0XHQvLyAgcmVhZG9ubHkgYXR0cmlidXRlIE5hbWVkTm9kZU1hcCAgICAgZW50aXRpZXM7XG5cdFx0Ly8gIHJlYWRvbmx5IGF0dHJpYnV0ZSBOYW1lZE5vZGVNYXAgICAgIG5vdGF0aW9ucztcblx0XHRyZXR1cm4gbm9kZTtcblx0fVxufTtcblxuXG4vKipcbiAqIEBzZWUgaHR0cDovL3d3dy53My5vcmcvVFIvMjAwMC9SRUMtRE9NLUxldmVsLTItQ29yZS0yMDAwMTExMy9jb3JlLmh0bWwjSUQtMTk1MDY0MTI0N1xuICovXG5cbmZ1bmN0aW9uIE5vZGUoKSB7XG59O1xuXG5Ob2RlLnByb3RvdHlwZSA9IHtcblx0Zmlyc3RDaGlsZCA6IG51bGwsXG5cdGxhc3RDaGlsZCA6IG51bGwsXG5cdHByZXZpb3VzU2libGluZyA6IG51bGwsXG5cdG5leHRTaWJsaW5nIDogbnVsbCxcblx0YXR0cmlidXRlcyA6IG51bGwsXG5cdHBhcmVudE5vZGUgOiBudWxsLFxuXHRjaGlsZE5vZGVzIDogbnVsbCxcblx0b3duZXJEb2N1bWVudCA6IG51bGwsXG5cdG5vZGVWYWx1ZSA6IG51bGwsXG5cdG5hbWVzcGFjZVVSSSA6IG51bGwsXG5cdHByZWZpeCA6IG51bGwsXG5cdGxvY2FsTmFtZSA6IG51bGwsXG5cdC8vIE1vZGlmaWVkIGluIERPTSBMZXZlbCAyOlxuXHRpbnNlcnRCZWZvcmU6ZnVuY3Rpb24obmV3Q2hpbGQsIHJlZkNoaWxkKXsvL3JhaXNlcyBcblx0XHRyZXR1cm4gX2luc2VydEJlZm9yZSh0aGlzLG5ld0NoaWxkLHJlZkNoaWxkKTtcblx0fSxcblx0cmVwbGFjZUNoaWxkOmZ1bmN0aW9uKG5ld0NoaWxkLCBvbGRDaGlsZCl7Ly9yYWlzZXMgXG5cdFx0dGhpcy5pbnNlcnRCZWZvcmUobmV3Q2hpbGQsb2xkQ2hpbGQpO1xuXHRcdGlmKG9sZENoaWxkKXtcblx0XHRcdHRoaXMucmVtb3ZlQ2hpbGQob2xkQ2hpbGQpO1xuXHRcdH1cblx0fSxcblx0cmVtb3ZlQ2hpbGQ6ZnVuY3Rpb24ob2xkQ2hpbGQpe1xuXHRcdHJldHVybiBfcmVtb3ZlQ2hpbGQodGhpcyxvbGRDaGlsZCk7XG5cdH0sXG5cdGFwcGVuZENoaWxkOmZ1bmN0aW9uKG5ld0NoaWxkKXtcblx0XHRyZXR1cm4gdGhpcy5pbnNlcnRCZWZvcmUobmV3Q2hpbGQsbnVsbCk7XG5cdH0sXG5cdGhhc0NoaWxkTm9kZXM6ZnVuY3Rpb24oKXtcblx0XHRyZXR1cm4gdGhpcy5maXJzdENoaWxkICE9IG51bGw7XG5cdH0sXG5cdGNsb25lTm9kZTpmdW5jdGlvbihkZWVwKXtcblx0XHRyZXR1cm4gY2xvbmVOb2RlKHRoaXMub3duZXJEb2N1bWVudHx8dGhpcyx0aGlzLGRlZXApO1xuXHR9LFxuXHQvLyBNb2RpZmllZCBpbiBET00gTGV2ZWwgMjpcblx0bm9ybWFsaXplOmZ1bmN0aW9uKCl7XG5cdFx0dmFyIGNoaWxkID0gdGhpcy5maXJzdENoaWxkO1xuXHRcdHdoaWxlKGNoaWxkKXtcblx0XHRcdHZhciBuZXh0ID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdFx0XHRpZihuZXh0ICYmIG5leHQubm9kZVR5cGUgPT0gVEVYVF9OT0RFICYmIGNoaWxkLm5vZGVUeXBlID09IFRFWFRfTk9ERSl7XG5cdFx0XHRcdHRoaXMucmVtb3ZlQ2hpbGQobmV4dCk7XG5cdFx0XHRcdGNoaWxkLmFwcGVuZERhdGEobmV4dC5kYXRhKTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjaGlsZC5ub3JtYWxpemUoKTtcblx0XHRcdFx0Y2hpbGQgPSBuZXh0O1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcbiAgXHQvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuXHRpc1N1cHBvcnRlZDpmdW5jdGlvbihmZWF0dXJlLCB2ZXJzaW9uKXtcblx0XHRyZXR1cm4gdGhpcy5vd25lckRvY3VtZW50LmltcGxlbWVudGF0aW9uLmhhc0ZlYXR1cmUoZmVhdHVyZSx2ZXJzaW9uKTtcblx0fSxcbiAgICAvLyBJbnRyb2R1Y2VkIGluIERPTSBMZXZlbCAyOlxuICAgIGhhc0F0dHJpYnV0ZXM6ZnVuY3Rpb24oKXtcbiAgICBcdHJldHVybiB0aGlzLmF0dHJpYnV0ZXMubGVuZ3RoPjA7XG4gICAgfSxcbiAgICBsb29rdXBQcmVmaXg6ZnVuY3Rpb24obmFtZXNwYWNlVVJJKXtcbiAgICBcdHZhciBlbCA9IHRoaXM7XG4gICAgXHR3aGlsZShlbCl7XG4gICAgXHRcdHZhciBtYXAgPSBlbC5fbnNNYXA7XG4gICAgXHRcdC8vY29uc29sZS5kaXIobWFwKVxuICAgIFx0XHRpZihtYXApe1xuICAgIFx0XHRcdGZvcih2YXIgbiBpbiBtYXApe1xuICAgIFx0XHRcdFx0aWYobWFwW25dID09IG5hbWVzcGFjZVVSSSl7XG4gICAgXHRcdFx0XHRcdHJldHVybiBuO1xuICAgIFx0XHRcdFx0fVxuICAgIFx0XHRcdH1cbiAgICBcdFx0fVxuICAgIFx0XHRlbCA9IGVsLm5vZGVUeXBlID09IDI/ZWwub3duZXJEb2N1bWVudCA6IGVsLnBhcmVudE5vZGU7XG4gICAgXHR9XG4gICAgXHRyZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDM6XG4gICAgbG9va3VwTmFtZXNwYWNlVVJJOmZ1bmN0aW9uKHByZWZpeCl7XG4gICAgXHR2YXIgZWwgPSB0aGlzO1xuICAgIFx0d2hpbGUoZWwpe1xuICAgIFx0XHR2YXIgbWFwID0gZWwuX25zTWFwO1xuICAgIFx0XHQvL2NvbnNvbGUuZGlyKG1hcClcbiAgICBcdFx0aWYobWFwKXtcbiAgICBcdFx0XHRpZihwcmVmaXggaW4gbWFwKXtcbiAgICBcdFx0XHRcdHJldHVybiBtYXBbcHJlZml4XSA7XG4gICAgXHRcdFx0fVxuICAgIFx0XHR9XG4gICAgXHRcdGVsID0gZWwubm9kZVR5cGUgPT0gMj9lbC5vd25lckRvY3VtZW50IDogZWwucGFyZW50Tm9kZTtcbiAgICBcdH1cbiAgICBcdHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLy8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMzpcbiAgICBpc0RlZmF1bHROYW1lc3BhY2U6ZnVuY3Rpb24obmFtZXNwYWNlVVJJKXtcbiAgICBcdHZhciBwcmVmaXggPSB0aGlzLmxvb2t1cFByZWZpeChuYW1lc3BhY2VVUkkpO1xuICAgIFx0cmV0dXJuIHByZWZpeCA9PSBudWxsO1xuICAgIH1cbn07XG5cblxuZnVuY3Rpb24gX3htbEVuY29kZXIoYyl7XG5cdHJldHVybiBjID09ICc8JyAmJiAnJmx0OycgfHxcbiAgICAgICAgIGMgPT0gJz4nICYmICcmZ3Q7JyB8fFxuICAgICAgICAgYyA9PSAnJicgJiYgJyZhbXA7JyB8fFxuICAgICAgICAgYyA9PSAnXCInICYmICcmcXVvdDsnIHx8XG4gICAgICAgICAnJiMnK2MuY2hhckNvZGVBdCgpKyc7J1xufVxuXG5cbmNvcHkoTm9kZVR5cGUsTm9kZSk7XG5jb3B5KE5vZGVUeXBlLE5vZGUucHJvdG90eXBlKTtcblxuLyoqXG4gKiBAcGFyYW0gY2FsbGJhY2sgcmV0dXJuIHRydWUgZm9yIGNvbnRpbnVlLGZhbHNlIGZvciBicmVha1xuICogQHJldHVybiBib29sZWFuIHRydWU6IGJyZWFrIHZpc2l0O1xuICovXG5mdW5jdGlvbiBfdmlzaXROb2RlKG5vZGUsY2FsbGJhY2spe1xuXHRpZihjYWxsYmFjayhub2RlKSl7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0aWYobm9kZSA9IG5vZGUuZmlyc3RDaGlsZCl7XG5cdFx0ZG97XG5cdFx0XHRpZihfdmlzaXROb2RlKG5vZGUsY2FsbGJhY2spKXtyZXR1cm4gdHJ1ZX1cbiAgICAgICAgfXdoaWxlKG5vZGU9bm9kZS5uZXh0U2libGluZylcbiAgICB9XG59XG5cblxuXG5mdW5jdGlvbiBEb2N1bWVudCgpe1xufVxuZnVuY3Rpb24gX29uQWRkQXR0cmlidXRlKGRvYyxlbCxuZXdBdHRyKXtcblx0ZG9jICYmIGRvYy5faW5jKys7XG5cdHZhciBucyA9IG5ld0F0dHIubmFtZXNwYWNlVVJJIDtcblx0aWYobnMgPT0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAveG1sbnMvJyl7XG5cdFx0Ly91cGRhdGUgbmFtZXNwYWNlXG5cdFx0ZWwuX25zTWFwW25ld0F0dHIucHJlZml4P25ld0F0dHIubG9jYWxOYW1lOicnXSA9IG5ld0F0dHIudmFsdWVcblx0fVxufVxuZnVuY3Rpb24gX29uUmVtb3ZlQXR0cmlidXRlKGRvYyxlbCxuZXdBdHRyLHJlbW92ZSl7XG5cdGRvYyAmJiBkb2MuX2luYysrO1xuXHR2YXIgbnMgPSBuZXdBdHRyLm5hbWVzcGFjZVVSSSA7XG5cdGlmKG5zID09ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3htbG5zLycpe1xuXHRcdC8vdXBkYXRlIG5hbWVzcGFjZVxuXHRcdGRlbGV0ZSBlbC5fbnNNYXBbbmV3QXR0ci5wcmVmaXg/bmV3QXR0ci5sb2NhbE5hbWU6JyddXG5cdH1cbn1cbmZ1bmN0aW9uIF9vblVwZGF0ZUNoaWxkKGRvYyxlbCxuZXdDaGlsZCl7XG5cdGlmKGRvYyAmJiBkb2MuX2luYyl7XG5cdFx0ZG9jLl9pbmMrKztcblx0XHQvL3VwZGF0ZSBjaGlsZE5vZGVzXG5cdFx0dmFyIGNzID0gZWwuY2hpbGROb2Rlcztcblx0XHRpZihuZXdDaGlsZCl7XG5cdFx0XHRjc1tjcy5sZW5ndGgrK10gPSBuZXdDaGlsZDtcblx0XHR9ZWxzZXtcblx0XHRcdC8vY29uc29sZS5sb2coMSlcblx0XHRcdHZhciBjaGlsZCA9IGVsLmZpcnN0Q2hpbGQ7XG5cdFx0XHR2YXIgaSA9IDA7XG5cdFx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRcdGNzW2krK10gPSBjaGlsZDtcblx0XHRcdFx0Y2hpbGQgPWNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdFx0fVxuXHRcdFx0Y3MubGVuZ3RoID0gaTtcblx0XHR9XG5cdH1cbn1cblxuLyoqXG4gKiBhdHRyaWJ1dGVzO1xuICogY2hpbGRyZW47XG4gKiBcbiAqIHdyaXRlYWJsZSBwcm9wZXJ0aWVzOlxuICogbm9kZVZhbHVlLEF0dHI6dmFsdWUsQ2hhcmFjdGVyRGF0YTpkYXRhXG4gKiBwcmVmaXhcbiAqL1xuZnVuY3Rpb24gX3JlbW92ZUNoaWxkKHBhcmVudE5vZGUsY2hpbGQpe1xuXHR2YXIgcHJldmlvdXMgPSBjaGlsZC5wcmV2aW91c1NpYmxpbmc7XG5cdHZhciBuZXh0ID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdGlmKHByZXZpb3VzKXtcblx0XHRwcmV2aW91cy5uZXh0U2libGluZyA9IG5leHQ7XG5cdH1lbHNle1xuXHRcdHBhcmVudE5vZGUuZmlyc3RDaGlsZCA9IG5leHRcblx0fVxuXHRpZihuZXh0KXtcblx0XHRuZXh0LnByZXZpb3VzU2libGluZyA9IHByZXZpb3VzO1xuXHR9ZWxzZXtcblx0XHRwYXJlbnROb2RlLmxhc3RDaGlsZCA9IHByZXZpb3VzO1xuXHR9XG5cdF9vblVwZGF0ZUNoaWxkKHBhcmVudE5vZGUub3duZXJEb2N1bWVudCxwYXJlbnROb2RlKTtcblx0cmV0dXJuIGNoaWxkO1xufVxuLyoqXG4gKiBwcmVmb3JtYW5jZSBrZXkocmVmQ2hpbGQgPT0gbnVsbClcbiAqL1xuZnVuY3Rpb24gX2luc2VydEJlZm9yZShwYXJlbnROb2RlLG5ld0NoaWxkLG5leHRDaGlsZCl7XG5cdHZhciBjcCA9IG5ld0NoaWxkLnBhcmVudE5vZGU7XG5cdGlmKGNwKXtcblx0XHRjcC5yZW1vdmVDaGlsZChuZXdDaGlsZCk7Ly9yZW1vdmUgYW5kIHVwZGF0ZVxuXHR9XG5cdGlmKG5ld0NoaWxkLm5vZGVUeXBlID09PSBET0NVTUVOVF9GUkFHTUVOVF9OT0RFKXtcblx0XHR2YXIgbmV3Rmlyc3QgPSBuZXdDaGlsZC5maXJzdENoaWxkO1xuXHRcdGlmIChuZXdGaXJzdCA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gbmV3Q2hpbGQ7XG5cdFx0fVxuXHRcdHZhciBuZXdMYXN0ID0gbmV3Q2hpbGQubGFzdENoaWxkO1xuXHR9ZWxzZXtcblx0XHRuZXdGaXJzdCA9IG5ld0xhc3QgPSBuZXdDaGlsZDtcblx0fVxuXHR2YXIgcHJlID0gbmV4dENoaWxkID8gbmV4dENoaWxkLnByZXZpb3VzU2libGluZyA6IHBhcmVudE5vZGUubGFzdENoaWxkO1xuXG5cdG5ld0ZpcnN0LnByZXZpb3VzU2libGluZyA9IHByZTtcblx0bmV3TGFzdC5uZXh0U2libGluZyA9IG5leHRDaGlsZDtcblx0XG5cdFxuXHRpZihwcmUpe1xuXHRcdHByZS5uZXh0U2libGluZyA9IG5ld0ZpcnN0O1xuXHR9ZWxzZXtcblx0XHRwYXJlbnROb2RlLmZpcnN0Q2hpbGQgPSBuZXdGaXJzdDtcblx0fVxuXHRpZihuZXh0Q2hpbGQgPT0gbnVsbCl7XG5cdFx0cGFyZW50Tm9kZS5sYXN0Q2hpbGQgPSBuZXdMYXN0O1xuXHR9ZWxzZXtcblx0XHRuZXh0Q2hpbGQucHJldmlvdXNTaWJsaW5nID0gbmV3TGFzdDtcblx0fVxuXHRkb3tcblx0XHRuZXdGaXJzdC5wYXJlbnROb2RlID0gcGFyZW50Tm9kZTtcblx0fXdoaWxlKG5ld0ZpcnN0ICE9PSBuZXdMYXN0ICYmIChuZXdGaXJzdD0gbmV3Rmlyc3QubmV4dFNpYmxpbmcpKVxuXHRfb25VcGRhdGVDaGlsZChwYXJlbnROb2RlLm93bmVyRG9jdW1lbnR8fHBhcmVudE5vZGUscGFyZW50Tm9kZSk7XG5cdC8vY29uc29sZS5sb2cocGFyZW50Tm9kZS5sYXN0Q2hpbGQubmV4dFNpYmxpbmcgPT0gbnVsbClcblx0aWYgKG5ld0NoaWxkLm5vZGVUeXBlID09IERPQ1VNRU5UX0ZSQUdNRU5UX05PREUpIHtcblx0XHRuZXdDaGlsZC5maXJzdENoaWxkID0gbmV3Q2hpbGQubGFzdENoaWxkID0gbnVsbDtcblx0fVxuXHRyZXR1cm4gbmV3Q2hpbGQ7XG59XG5mdW5jdGlvbiBfYXBwZW5kU2luZ2xlQ2hpbGQocGFyZW50Tm9kZSxuZXdDaGlsZCl7XG5cdHZhciBjcCA9IG5ld0NoaWxkLnBhcmVudE5vZGU7XG5cdGlmKGNwKXtcblx0XHR2YXIgcHJlID0gcGFyZW50Tm9kZS5sYXN0Q2hpbGQ7XG5cdFx0Y3AucmVtb3ZlQ2hpbGQobmV3Q2hpbGQpOy8vcmVtb3ZlIGFuZCB1cGRhdGVcblx0XHR2YXIgcHJlID0gcGFyZW50Tm9kZS5sYXN0Q2hpbGQ7XG5cdH1cblx0dmFyIHByZSA9IHBhcmVudE5vZGUubGFzdENoaWxkO1xuXHRuZXdDaGlsZC5wYXJlbnROb2RlID0gcGFyZW50Tm9kZTtcblx0bmV3Q2hpbGQucHJldmlvdXNTaWJsaW5nID0gcHJlO1xuXHRuZXdDaGlsZC5uZXh0U2libGluZyA9IG51bGw7XG5cdGlmKHByZSl7XG5cdFx0cHJlLm5leHRTaWJsaW5nID0gbmV3Q2hpbGQ7XG5cdH1lbHNle1xuXHRcdHBhcmVudE5vZGUuZmlyc3RDaGlsZCA9IG5ld0NoaWxkO1xuXHR9XG5cdHBhcmVudE5vZGUubGFzdENoaWxkID0gbmV3Q2hpbGQ7XG5cdF9vblVwZGF0ZUNoaWxkKHBhcmVudE5vZGUub3duZXJEb2N1bWVudCxwYXJlbnROb2RlLG5ld0NoaWxkKTtcblx0cmV0dXJuIG5ld0NoaWxkO1xuXHQvL2NvbnNvbGUubG9nKFwiX19hYVwiLHBhcmVudE5vZGUubGFzdENoaWxkLm5leHRTaWJsaW5nID09IG51bGwpXG59XG5Eb2N1bWVudC5wcm90b3R5cGUgPSB7XG5cdC8vaW1wbGVtZW50YXRpb24gOiBudWxsLFxuXHRub2RlTmFtZSA6ICAnI2RvY3VtZW50Jyxcblx0bm9kZVR5cGUgOiAgRE9DVU1FTlRfTk9ERSxcblx0ZG9jdHlwZSA6ICBudWxsLFxuXHRkb2N1bWVudEVsZW1lbnQgOiAgbnVsbCxcblx0X2luYyA6IDEsXG5cdFxuXHRpbnNlcnRCZWZvcmUgOiAgZnVuY3Rpb24obmV3Q2hpbGQsIHJlZkNoaWxkKXsvL3JhaXNlcyBcblx0XHRpZihuZXdDaGlsZC5ub2RlVHlwZSA9PSBET0NVTUVOVF9GUkFHTUVOVF9OT0RFKXtcblx0XHRcdHZhciBjaGlsZCA9IG5ld0NoaWxkLmZpcnN0Q2hpbGQ7XG5cdFx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRcdHZhciBuZXh0ID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdFx0XHRcdHRoaXMuaW5zZXJ0QmVmb3JlKGNoaWxkLHJlZkNoaWxkKTtcblx0XHRcdFx0Y2hpbGQgPSBuZXh0O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ld0NoaWxkO1xuXHRcdH1cblx0XHRpZih0aGlzLmRvY3VtZW50RWxlbWVudCA9PSBudWxsICYmIG5ld0NoaWxkLm5vZGVUeXBlID09IDEpe1xuXHRcdFx0dGhpcy5kb2N1bWVudEVsZW1lbnQgPSBuZXdDaGlsZDtcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIF9pbnNlcnRCZWZvcmUodGhpcyxuZXdDaGlsZCxyZWZDaGlsZCksKG5ld0NoaWxkLm93bmVyRG9jdW1lbnQgPSB0aGlzKSxuZXdDaGlsZDtcblx0fSxcblx0cmVtb3ZlQ2hpbGQgOiAgZnVuY3Rpb24ob2xkQ2hpbGQpe1xuXHRcdGlmKHRoaXMuZG9jdW1lbnRFbGVtZW50ID09IG9sZENoaWxkKXtcblx0XHRcdHRoaXMuZG9jdW1lbnRFbGVtZW50ID0gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIF9yZW1vdmVDaGlsZCh0aGlzLG9sZENoaWxkKTtcblx0fSxcblx0Ly8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcblx0aW1wb3J0Tm9kZSA6IGZ1bmN0aW9uKGltcG9ydGVkTm9kZSxkZWVwKXtcblx0XHRyZXR1cm4gaW1wb3J0Tm9kZSh0aGlzLGltcG9ydGVkTm9kZSxkZWVwKTtcblx0fSxcblx0Ly8gSW50cm9kdWNlZCBpbiBET00gTGV2ZWwgMjpcblx0Z2V0RWxlbWVudEJ5SWQgOlx0ZnVuY3Rpb24oaWQpe1xuXHRcdHZhciBydHYgPSBudWxsO1xuXHRcdF92aXNpdE5vZGUodGhpcy5kb2N1bWVudEVsZW1lbnQsZnVuY3Rpb24obm9kZSl7XG5cdFx0XHRpZihub2RlLm5vZGVUeXBlID09IDEpe1xuXHRcdFx0XHRpZihub2RlLmdldEF0dHJpYnV0ZSgnaWQnKSA9PSBpZCl7XG5cdFx0XHRcdFx0cnR2ID0gbm9kZTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pXG5cdFx0cmV0dXJuIHJ0djtcblx0fSxcblx0XG5cdC8vZG9jdW1lbnQgZmFjdG9yeSBtZXRob2Q6XG5cdGNyZWF0ZUVsZW1lbnQgOlx0ZnVuY3Rpb24odGFnTmFtZSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgRWxlbWVudCgpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudCA9IHRoaXM7XG5cdFx0bm9kZS5ub2RlTmFtZSA9IHRhZ05hbWU7XG5cdFx0bm9kZS50YWdOYW1lID0gdGFnTmFtZTtcblx0XHRub2RlLmNoaWxkTm9kZXMgPSBuZXcgTm9kZUxpc3QoKTtcblx0XHR2YXIgYXR0cnNcdD0gbm9kZS5hdHRyaWJ1dGVzID0gbmV3IE5hbWVkTm9kZU1hcCgpO1xuXHRcdGF0dHJzLl9vd25lckVsZW1lbnQgPSBub2RlO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVEb2N1bWVudEZyYWdtZW50IDpcdGZ1bmN0aW9uKCl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudCA9IHRoaXM7XG5cdFx0bm9kZS5jaGlsZE5vZGVzID0gbmV3IE5vZGVMaXN0KCk7XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdGNyZWF0ZVRleHROb2RlIDpcdGZ1bmN0aW9uKGRhdGEpe1xuXHRcdHZhciBub2RlID0gbmV3IFRleHQoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUuYXBwZW5kRGF0YShkYXRhKVxuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVDb21tZW50IDpcdGZ1bmN0aW9uKGRhdGEpe1xuXHRcdHZhciBub2RlID0gbmV3IENvbW1lbnQoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUuYXBwZW5kRGF0YShkYXRhKVxuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVDREFUQVNlY3Rpb24gOlx0ZnVuY3Rpb24oZGF0YSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgQ0RBVEFTZWN0aW9uKCk7XG5cdFx0bm9kZS5vd25lckRvY3VtZW50ID0gdGhpcztcblx0XHRub2RlLmFwcGVuZERhdGEoZGF0YSlcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0Y3JlYXRlUHJvY2Vzc2luZ0luc3RydWN0aW9uIDpcdGZ1bmN0aW9uKHRhcmdldCxkYXRhKXtcblx0XHR2YXIgbm9kZSA9IG5ldyBQcm9jZXNzaW5nSW5zdHJ1Y3Rpb24oKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnQgPSB0aGlzO1xuXHRcdG5vZGUudGFnTmFtZSA9IG5vZGUudGFyZ2V0ID0gdGFyZ2V0O1xuXHRcdG5vZGUubm9kZVZhbHVlPSBub2RlLmRhdGEgPSBkYXRhO1xuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRjcmVhdGVBdHRyaWJ1dGUgOlx0ZnVuY3Rpb24obmFtZSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgQXR0cigpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudFx0PSB0aGlzO1xuXHRcdG5vZGUubmFtZSA9IG5hbWU7XG5cdFx0bm9kZS5ub2RlTmFtZVx0PSBuYW1lO1xuXHRcdG5vZGUubG9jYWxOYW1lID0gbmFtZTtcblx0XHRub2RlLnNwZWNpZmllZCA9IHRydWU7XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdGNyZWF0ZUVudGl0eVJlZmVyZW5jZSA6XHRmdW5jdGlvbihuYW1lKXtcblx0XHR2YXIgbm9kZSA9IG5ldyBFbnRpdHlSZWZlcmVuY2UoKTtcblx0XHRub2RlLm93bmVyRG9jdW1lbnRcdD0gdGhpcztcblx0XHRub2RlLm5vZGVOYW1lXHQ9IG5hbWU7XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdGNyZWF0ZUVsZW1lbnROUyA6XHRmdW5jdGlvbihuYW1lc3BhY2VVUkkscXVhbGlmaWVkTmFtZSl7XG5cdFx0dmFyIG5vZGUgPSBuZXcgRWxlbWVudCgpO1xuXHRcdHZhciBwbCA9IHF1YWxpZmllZE5hbWUuc3BsaXQoJzonKTtcblx0XHR2YXIgYXR0cnNcdD0gbm9kZS5hdHRyaWJ1dGVzID0gbmV3IE5hbWVkTm9kZU1hcCgpO1xuXHRcdG5vZGUuY2hpbGROb2RlcyA9IG5ldyBOb2RlTGlzdCgpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudCA9IHRoaXM7XG5cdFx0bm9kZS5ub2RlTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS50YWdOYW1lID0gcXVhbGlmaWVkTmFtZTtcblx0XHRub2RlLm5hbWVzcGFjZVVSSSA9IG5hbWVzcGFjZVVSSTtcblx0XHRpZihwbC5sZW5ndGggPT0gMil7XG5cdFx0XHRub2RlLnByZWZpeCA9IHBsWzBdO1xuXHRcdFx0bm9kZS5sb2NhbE5hbWUgPSBwbFsxXTtcblx0XHR9ZWxzZXtcblx0XHRcdC8vZWwucHJlZml4ID0gbnVsbDtcblx0XHRcdG5vZGUubG9jYWxOYW1lID0gcXVhbGlmaWVkTmFtZTtcblx0XHR9XG5cdFx0YXR0cnMuX293bmVyRWxlbWVudCA9IG5vZGU7XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdC8vIEludHJvZHVjZWQgaW4gRE9NIExldmVsIDI6XG5cdGNyZWF0ZUF0dHJpYnV0ZU5TIDpcdGZ1bmN0aW9uKG5hbWVzcGFjZVVSSSxxdWFsaWZpZWROYW1lKXtcblx0XHR2YXIgbm9kZSA9IG5ldyBBdHRyKCk7XG5cdFx0dmFyIHBsID0gcXVhbGlmaWVkTmFtZS5zcGxpdCgnOicpO1xuXHRcdG5vZGUub3duZXJEb2N1bWVudCA9IHRoaXM7XG5cdFx0bm9kZS5ub2RlTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0bm9kZS5uYW1lID0gcXVhbGlmaWVkTmFtZTtcblx0XHRub2RlLm5hbWVzcGFjZVVSSSA9IG5hbWVzcGFjZVVSSTtcblx0XHRub2RlLnNwZWNpZmllZCA9IHRydWU7XG5cdFx0aWYocGwubGVuZ3RoID09IDIpe1xuXHRcdFx0bm9kZS5wcmVmaXggPSBwbFswXTtcblx0XHRcdG5vZGUubG9jYWxOYW1lID0gcGxbMV07XG5cdFx0fWVsc2V7XG5cdFx0XHQvL2VsLnByZWZpeCA9IG51bGw7XG5cdFx0XHRub2RlLmxvY2FsTmFtZSA9IHF1YWxpZmllZE5hbWU7XG5cdFx0fVxuXHRcdHJldHVybiBub2RlO1xuXHR9XG59O1xuX2V4dGVuZHMoRG9jdW1lbnQsTm9kZSk7XG5cblxuZnVuY3Rpb24gRWxlbWVudCgpIHtcblx0dGhpcy5fbnNNYXAgPSB7fTtcbn07XG5FbGVtZW50LnByb3RvdHlwZSA9IHtcblx0bm9kZVR5cGUgOiBFTEVNRU5UX05PREUsXG5cdGhhc0F0dHJpYnV0ZSA6IGZ1bmN0aW9uKG5hbWUpe1xuXHRcdHJldHVybiB0aGlzLmdldEF0dHJpYnV0ZU5vZGUobmFtZSkhPW51bGw7XG5cdH0sXG5cdGdldEF0dHJpYnV0ZSA6IGZ1bmN0aW9uKG5hbWUpe1xuXHRcdHZhciBhdHRyID0gdGhpcy5nZXRBdHRyaWJ1dGVOb2RlKG5hbWUpO1xuXHRcdHJldHVybiBhdHRyICYmIGF0dHIudmFsdWUgfHwgJyc7XG5cdH0sXG5cdGdldEF0dHJpYnV0ZU5vZGUgOiBmdW5jdGlvbihuYW1lKXtcblx0XHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShuYW1lKTtcblx0fSxcblx0c2V0QXR0cmlidXRlIDogZnVuY3Rpb24obmFtZSwgdmFsdWUpe1xuXHRcdHZhciBhdHRyID0gdGhpcy5vd25lckRvY3VtZW50LmNyZWF0ZUF0dHJpYnV0ZShuYW1lKTtcblx0XHRhdHRyLnZhbHVlID0gYXR0ci5ub2RlVmFsdWUgPSBcIlwiICsgdmFsdWU7XG5cdFx0dGhpcy5zZXRBdHRyaWJ1dGVOb2RlKGF0dHIpXG5cdH0sXG5cdHJlbW92ZUF0dHJpYnV0ZSA6IGZ1bmN0aW9uKG5hbWUpe1xuXHRcdHZhciBhdHRyID0gdGhpcy5nZXRBdHRyaWJ1dGVOb2RlKG5hbWUpXG5cdFx0YXR0ciAmJiB0aGlzLnJlbW92ZUF0dHJpYnV0ZU5vZGUoYXR0cik7XG5cdH0sXG5cdFxuXHQvL2ZvdXIgcmVhbCBvcGVhcnRpb24gbWV0aG9kXG5cdGFwcGVuZENoaWxkOmZ1bmN0aW9uKG5ld0NoaWxkKXtcblx0XHRpZihuZXdDaGlsZC5ub2RlVHlwZSA9PT0gRE9DVU1FTlRfRlJBR01FTlRfTk9ERSl7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnNlcnRCZWZvcmUobmV3Q2hpbGQsbnVsbCk7XG5cdFx0fWVsc2V7XG5cdFx0XHRyZXR1cm4gX2FwcGVuZFNpbmdsZUNoaWxkKHRoaXMsbmV3Q2hpbGQpO1xuXHRcdH1cblx0fSxcblx0c2V0QXR0cmlidXRlTm9kZSA6IGZ1bmN0aW9uKG5ld0F0dHIpe1xuXHRcdHJldHVybiB0aGlzLmF0dHJpYnV0ZXMuc2V0TmFtZWRJdGVtKG5ld0F0dHIpO1xuXHR9LFxuXHRzZXRBdHRyaWJ1dGVOb2RlTlMgOiBmdW5jdGlvbihuZXdBdHRyKXtcblx0XHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLnNldE5hbWVkSXRlbU5TKG5ld0F0dHIpO1xuXHR9LFxuXHRyZW1vdmVBdHRyaWJ1dGVOb2RlIDogZnVuY3Rpb24ob2xkQXR0cil7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlcy5yZW1vdmVOYW1lZEl0ZW0ob2xkQXR0ci5ub2RlTmFtZSk7XG5cdH0sXG5cdC8vZ2V0IHJlYWwgYXR0cmlidXRlIG5hbWUsYW5kIHJlbW92ZSBpdCBieSByZW1vdmVBdHRyaWJ1dGVOb2RlXG5cdHJlbW92ZUF0dHJpYnV0ZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpe1xuXHRcdHZhciBvbGQgPSB0aGlzLmdldEF0dHJpYnV0ZU5vZGVOUyhuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSk7XG5cdFx0b2xkICYmIHRoaXMucmVtb3ZlQXR0cmlidXRlTm9kZShvbGQpO1xuXHR9LFxuXHRcblx0aGFzQXR0cmlidXRlTlMgOiBmdW5jdGlvbihuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSl7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlTm9kZU5TKG5hbWVzcGFjZVVSSSwgbG9jYWxOYW1lKSE9bnVsbDtcblx0fSxcblx0Z2V0QXR0cmlidXRlTlMgOiBmdW5jdGlvbihuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSl7XG5cdFx0dmFyIGF0dHIgPSB0aGlzLmdldEF0dHJpYnV0ZU5vZGVOUyhuYW1lc3BhY2VVUkksIGxvY2FsTmFtZSk7XG5cdFx0cmV0dXJuIGF0dHIgJiYgYXR0ci52YWx1ZSB8fCAnJztcblx0fSxcblx0c2V0QXR0cmlidXRlTlMgOiBmdW5jdGlvbihuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUsIHZhbHVlKXtcblx0XHR2YXIgYXR0ciA9IHRoaXMub3duZXJEb2N1bWVudC5jcmVhdGVBdHRyaWJ1dGVOUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpO1xuXHRcdGF0dHIudmFsdWUgPSBhdHRyLm5vZGVWYWx1ZSA9IFwiXCIgKyB2YWx1ZTtcblx0XHR0aGlzLnNldEF0dHJpYnV0ZU5vZGUoYXR0cilcblx0fSxcblx0Z2V0QXR0cmlidXRlTm9kZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpe1xuXHRcdHJldHVybiB0aGlzLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtTlMobmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpO1xuXHR9LFxuXHRcblx0Z2V0RWxlbWVudHNCeVRhZ05hbWUgOiBmdW5jdGlvbih0YWdOYW1lKXtcblx0XHRyZXR1cm4gbmV3IExpdmVOb2RlTGlzdCh0aGlzLGZ1bmN0aW9uKGJhc2Upe1xuXHRcdFx0dmFyIGxzID0gW107XG5cdFx0XHRfdmlzaXROb2RlKGJhc2UsZnVuY3Rpb24obm9kZSl7XG5cdFx0XHRcdGlmKG5vZGUgIT09IGJhc2UgJiYgbm9kZS5ub2RlVHlwZSA9PSBFTEVNRU5UX05PREUgJiYgKHRhZ05hbWUgPT09ICcqJyB8fCBub2RlLnRhZ05hbWUgPT0gdGFnTmFtZSkpe1xuXHRcdFx0XHRcdGxzLnB1c2gobm9kZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGxzO1xuXHRcdH0pO1xuXHR9LFxuXHRnZXRFbGVtZW50c0J5VGFnTmFtZU5TIDogZnVuY3Rpb24obmFtZXNwYWNlVVJJLCBsb2NhbE5hbWUpe1xuXHRcdHJldHVybiBuZXcgTGl2ZU5vZGVMaXN0KHRoaXMsZnVuY3Rpb24oYmFzZSl7XG5cdFx0XHR2YXIgbHMgPSBbXTtcblx0XHRcdF92aXNpdE5vZGUoYmFzZSxmdW5jdGlvbihub2RlKXtcblx0XHRcdFx0aWYobm9kZSAhPT0gYmFzZSAmJiBub2RlLm5vZGVUeXBlID09PSBFTEVNRU5UX05PREUgJiYgKG5hbWVzcGFjZVVSSSA9PT0gJyonIHx8IG5vZGUubmFtZXNwYWNlVVJJID09PSBuYW1lc3BhY2VVUkkpICYmIChsb2NhbE5hbWUgPT09ICcqJyB8fCBub2RlLmxvY2FsTmFtZSA9PSBsb2NhbE5hbWUpKXtcblx0XHRcdFx0XHRscy5wdXNoKG5vZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBscztcblx0XHR9KTtcblx0fVxufTtcbkRvY3VtZW50LnByb3RvdHlwZS5nZXRFbGVtZW50c0J5VGFnTmFtZSA9IEVsZW1lbnQucHJvdG90eXBlLmdldEVsZW1lbnRzQnlUYWdOYW1lO1xuRG9jdW1lbnQucHJvdG90eXBlLmdldEVsZW1lbnRzQnlUYWdOYW1lTlMgPSBFbGVtZW50LnByb3RvdHlwZS5nZXRFbGVtZW50c0J5VGFnTmFtZU5TO1xuXG5cbl9leHRlbmRzKEVsZW1lbnQsTm9kZSk7XG5mdW5jdGlvbiBBdHRyKCkge1xufTtcbkF0dHIucHJvdG90eXBlLm5vZGVUeXBlID0gQVRUUklCVVRFX05PREU7XG5fZXh0ZW5kcyhBdHRyLE5vZGUpO1xuXG5cbmZ1bmN0aW9uIENoYXJhY3RlckRhdGEoKSB7XG59O1xuQ2hhcmFjdGVyRGF0YS5wcm90b3R5cGUgPSB7XG5cdGRhdGEgOiAnJyxcblx0c3Vic3RyaW5nRGF0YSA6IGZ1bmN0aW9uKG9mZnNldCwgY291bnQpIHtcblx0XHRyZXR1cm4gdGhpcy5kYXRhLnN1YnN0cmluZyhvZmZzZXQsIG9mZnNldCtjb3VudCk7XG5cdH0sXG5cdGFwcGVuZERhdGE6IGZ1bmN0aW9uKHRleHQpIHtcblx0XHR0ZXh0ID0gdGhpcy5kYXRhK3RleHQ7XG5cdFx0dGhpcy5ub2RlVmFsdWUgPSB0aGlzLmRhdGEgPSB0ZXh0O1xuXHRcdHRoaXMubGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdH0sXG5cdGluc2VydERhdGE6IGZ1bmN0aW9uKG9mZnNldCx0ZXh0KSB7XG5cdFx0dGhpcy5yZXBsYWNlRGF0YShvZmZzZXQsMCx0ZXh0KTtcblx0XG5cdH0sXG5cdGFwcGVuZENoaWxkOmZ1bmN0aW9uKG5ld0NoaWxkKXtcblx0XHQvL2lmKCEobmV3Q2hpbGQgaW5zdGFuY2VvZiBDaGFyYWN0ZXJEYXRhKSl7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoRXhjZXB0aW9uTWVzc2FnZVszXSlcblx0XHQvL31cblx0XHRyZXR1cm4gTm9kZS5wcm90b3R5cGUuYXBwZW5kQ2hpbGQuYXBwbHkodGhpcyxhcmd1bWVudHMpXG5cdH0sXG5cdGRlbGV0ZURhdGE6IGZ1bmN0aW9uKG9mZnNldCwgY291bnQpIHtcblx0XHR0aGlzLnJlcGxhY2VEYXRhKG9mZnNldCxjb3VudCxcIlwiKTtcblx0fSxcblx0cmVwbGFjZURhdGE6IGZ1bmN0aW9uKG9mZnNldCwgY291bnQsIHRleHQpIHtcblx0XHR2YXIgc3RhcnQgPSB0aGlzLmRhdGEuc3Vic3RyaW5nKDAsb2Zmc2V0KTtcblx0XHR2YXIgZW5kID0gdGhpcy5kYXRhLnN1YnN0cmluZyhvZmZzZXQrY291bnQpO1xuXHRcdHRleHQgPSBzdGFydCArIHRleHQgKyBlbmQ7XG5cdFx0dGhpcy5ub2RlVmFsdWUgPSB0aGlzLmRhdGEgPSB0ZXh0O1xuXHRcdHRoaXMubGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdH1cbn1cbl9leHRlbmRzKENoYXJhY3RlckRhdGEsTm9kZSk7XG5mdW5jdGlvbiBUZXh0KCkge1xufTtcblRleHQucHJvdG90eXBlID0ge1xuXHRub2RlTmFtZSA6IFwiI3RleHRcIixcblx0bm9kZVR5cGUgOiBURVhUX05PREUsXG5cdHNwbGl0VGV4dCA6IGZ1bmN0aW9uKG9mZnNldCkge1xuXHRcdHZhciB0ZXh0ID0gdGhpcy5kYXRhO1xuXHRcdHZhciBuZXdUZXh0ID0gdGV4dC5zdWJzdHJpbmcob2Zmc2V0KTtcblx0XHR0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgb2Zmc2V0KTtcblx0XHR0aGlzLmRhdGEgPSB0aGlzLm5vZGVWYWx1ZSA9IHRleHQ7XG5cdFx0dGhpcy5sZW5ndGggPSB0ZXh0Lmxlbmd0aDtcblx0XHR2YXIgbmV3Tm9kZSA9IHRoaXMub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShuZXdUZXh0KTtcblx0XHRpZih0aGlzLnBhcmVudE5vZGUpe1xuXHRcdFx0dGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCB0aGlzLm5leHRTaWJsaW5nKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ld05vZGU7XG5cdH1cbn1cbl9leHRlbmRzKFRleHQsQ2hhcmFjdGVyRGF0YSk7XG5mdW5jdGlvbiBDb21tZW50KCkge1xufTtcbkNvbW1lbnQucHJvdG90eXBlID0ge1xuXHRub2RlTmFtZSA6IFwiI2NvbW1lbnRcIixcblx0bm9kZVR5cGUgOiBDT01NRU5UX05PREVcbn1cbl9leHRlbmRzKENvbW1lbnQsQ2hhcmFjdGVyRGF0YSk7XG5cbmZ1bmN0aW9uIENEQVRBU2VjdGlvbigpIHtcbn07XG5DREFUQVNlY3Rpb24ucHJvdG90eXBlID0ge1xuXHRub2RlTmFtZSA6IFwiI2NkYXRhLXNlY3Rpb25cIixcblx0bm9kZVR5cGUgOiBDREFUQV9TRUNUSU9OX05PREVcbn1cbl9leHRlbmRzKENEQVRBU2VjdGlvbixDaGFyYWN0ZXJEYXRhKTtcblxuXG5mdW5jdGlvbiBEb2N1bWVudFR5cGUoKSB7XG59O1xuRG9jdW1lbnRUeXBlLnByb3RvdHlwZS5ub2RlVHlwZSA9IERPQ1VNRU5UX1RZUEVfTk9ERTtcbl9leHRlbmRzKERvY3VtZW50VHlwZSxOb2RlKTtcblxuZnVuY3Rpb24gTm90YXRpb24oKSB7XG59O1xuTm90YXRpb24ucHJvdG90eXBlLm5vZGVUeXBlID0gTk9UQVRJT05fTk9ERTtcbl9leHRlbmRzKE5vdGF0aW9uLE5vZGUpO1xuXG5mdW5jdGlvbiBFbnRpdHkoKSB7XG59O1xuRW50aXR5LnByb3RvdHlwZS5ub2RlVHlwZSA9IEVOVElUWV9OT0RFO1xuX2V4dGVuZHMoRW50aXR5LE5vZGUpO1xuXG5mdW5jdGlvbiBFbnRpdHlSZWZlcmVuY2UoKSB7XG59O1xuRW50aXR5UmVmZXJlbmNlLnByb3RvdHlwZS5ub2RlVHlwZSA9IEVOVElUWV9SRUZFUkVOQ0VfTk9ERTtcbl9leHRlbmRzKEVudGl0eVJlZmVyZW5jZSxOb2RlKTtcblxuZnVuY3Rpb24gRG9jdW1lbnRGcmFnbWVudCgpIHtcbn07XG5Eb2N1bWVudEZyYWdtZW50LnByb3RvdHlwZS5ub2RlTmFtZSA9XHRcIiNkb2N1bWVudC1mcmFnbWVudFwiO1xuRG9jdW1lbnRGcmFnbWVudC5wcm90b3R5cGUubm9kZVR5cGUgPVx0RE9DVU1FTlRfRlJBR01FTlRfTk9ERTtcbl9leHRlbmRzKERvY3VtZW50RnJhZ21lbnQsTm9kZSk7XG5cblxuZnVuY3Rpb24gUHJvY2Vzc2luZ0luc3RydWN0aW9uKCkge1xufVxuUHJvY2Vzc2luZ0luc3RydWN0aW9uLnByb3RvdHlwZS5ub2RlVHlwZSA9IFBST0NFU1NJTkdfSU5TVFJVQ1RJT05fTk9ERTtcbl9leHRlbmRzKFByb2Nlc3NpbmdJbnN0cnVjdGlvbixOb2RlKTtcbmZ1bmN0aW9uIFhNTFNlcmlhbGl6ZXIoKXt9XG5YTUxTZXJpYWxpemVyLnByb3RvdHlwZS5zZXJpYWxpemVUb1N0cmluZyA9IGZ1bmN0aW9uKG5vZGUsYXR0cmlidXRlU29ydGVyKXtcblx0cmV0dXJuIG5vZGUudG9TdHJpbmcoYXR0cmlidXRlU29ydGVyKTtcbn1cbk5vZGUucHJvdG90eXBlLnRvU3RyaW5nID1mdW5jdGlvbihhdHRyaWJ1dGVTb3J0ZXIpe1xuXHR2YXIgYnVmID0gW107XG5cdHNlcmlhbGl6ZVRvU3RyaW5nKHRoaXMsYnVmLGF0dHJpYnV0ZVNvcnRlcik7XG5cdHJldHVybiBidWYuam9pbignJyk7XG59XG5mdW5jdGlvbiBzZXJpYWxpemVUb1N0cmluZyhub2RlLGJ1ZixhdHRyaWJ1dGVTb3J0ZXIsaXNIVE1MKXtcblx0c3dpdGNoKG5vZGUubm9kZVR5cGUpe1xuXHRjYXNlIEVMRU1FTlRfTk9ERTpcblx0XHR2YXIgYXR0cnMgPSBub2RlLmF0dHJpYnV0ZXM7XG5cdFx0dmFyIGxlbiA9IGF0dHJzLmxlbmd0aDtcblx0XHR2YXIgY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7XG5cdFx0dmFyIG5vZGVOYW1lID0gbm9kZS50YWdOYW1lO1xuXHRcdGlzSFRNTCA9ICAoaHRtbG5zID09PSBub2RlLm5hbWVzcGFjZVVSSSkgfHxpc0hUTUwgXG5cdFx0YnVmLnB1c2goJzwnLG5vZGVOYW1lKTtcblx0XHRpZihhdHRyaWJ1dGVTb3J0ZXIpe1xuXHRcdFx0YnVmLnNvcnQuYXBwbHkoYXR0cnMsIGF0dHJpYnV0ZVNvcnRlcik7XG5cdFx0fVxuXHRcdGZvcih2YXIgaT0wO2k8bGVuO2krKyl7XG5cdFx0XHRzZXJpYWxpemVUb1N0cmluZyhhdHRycy5pdGVtKGkpLGJ1ZixhdHRyaWJ1dGVTb3J0ZXIsaXNIVE1MKTtcblx0XHR9XG5cdFx0aWYoY2hpbGQgfHwgaXNIVE1MICYmICEvXig/Om1ldGF8bGlua3xpbWd8YnJ8aHJ8aW5wdXR8YnV0dG9uKSQvaS50ZXN0KG5vZGVOYW1lKSl7XG5cdFx0XHRidWYucHVzaCgnPicpO1xuXHRcdFx0Ly9pZiBpcyBjZGF0YSBjaGlsZCBub2RlXG5cdFx0XHRpZihpc0hUTUwgJiYgL15zY3JpcHQkL2kudGVzdChub2RlTmFtZSkpe1xuXHRcdFx0XHRpZihjaGlsZCl7XG5cdFx0XHRcdFx0YnVmLnB1c2goY2hpbGQuZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1lbHNle1xuXHRcdFx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRcdFx0c2VyaWFsaXplVG9TdHJpbmcoY2hpbGQsYnVmLGF0dHJpYnV0ZVNvcnRlcixpc0hUTUwpO1xuXHRcdFx0XHRcdGNoaWxkID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGJ1Zi5wdXNoKCc8Lycsbm9kZU5hbWUsJz4nKTtcblx0XHR9ZWxzZXtcblx0XHRcdGJ1Zi5wdXNoKCcvPicpO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdGNhc2UgRE9DVU1FTlRfTk9ERTpcblx0Y2FzZSBET0NVTUVOVF9GUkFHTUVOVF9OT0RFOlxuXHRcdHZhciBjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcblx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRzZXJpYWxpemVUb1N0cmluZyhjaGlsZCxidWYsYXR0cmlidXRlU29ydGVyLGlzSFRNTCk7XG5cdFx0XHRjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdGNhc2UgQVRUUklCVVRFX05PREU6XG5cdFx0cmV0dXJuIGJ1Zi5wdXNoKCcgJyxub2RlLm5hbWUsJz1cIicsbm9kZS52YWx1ZS5yZXBsYWNlKC9bPCZcIl0vZyxfeG1sRW5jb2RlciksJ1wiJyk7XG5cdGNhc2UgVEVYVF9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaChub2RlLmRhdGEucmVwbGFjZSgvWzwmXS9nLF94bWxFbmNvZGVyKSk7XG5cdGNhc2UgQ0RBVEFfU0VDVElPTl9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaCggJzwhW0NEQVRBWycsbm9kZS5kYXRhLCddXT4nKTtcblx0Y2FzZSBDT01NRU5UX05PREU6XG5cdFx0cmV0dXJuIGJ1Zi5wdXNoKCBcIjwhLS1cIixub2RlLmRhdGEsXCItLT5cIik7XG5cdGNhc2UgRE9DVU1FTlRfVFlQRV9OT0RFOlxuXHRcdHZhciBwdWJpZCA9IG5vZGUucHVibGljSWQ7XG5cdFx0dmFyIHN5c2lkID0gbm9kZS5zeXN0ZW1JZDtcblx0XHRidWYucHVzaCgnPCFET0NUWVBFICcsbm9kZS5uYW1lKTtcblx0XHRpZihwdWJpZCl7XG5cdFx0XHRidWYucHVzaCgnIFBVQkxJQyBcIicscHViaWQpO1xuXHRcdFx0aWYgKHN5c2lkICYmIHN5c2lkIT0nLicpIHtcblx0XHRcdFx0YnVmLnB1c2goICdcIiBcIicsc3lzaWQpO1xuXHRcdFx0fVxuXHRcdFx0YnVmLnB1c2goJ1wiPicpO1xuXHRcdH1lbHNlIGlmKHN5c2lkICYmIHN5c2lkIT0nLicpe1xuXHRcdFx0YnVmLnB1c2goJyBTWVNURU0gXCInLHN5c2lkLCdcIj4nKTtcblx0XHR9ZWxzZXtcblx0XHRcdHZhciBzdWIgPSBub2RlLmludGVybmFsU3Vic2V0O1xuXHRcdFx0aWYoc3ViKXtcblx0XHRcdFx0YnVmLnB1c2goXCIgW1wiLHN1YixcIl1cIik7XG5cdFx0XHR9XG5cdFx0XHRidWYucHVzaChcIj5cIik7XG5cdFx0fVxuXHRcdHJldHVybjtcblx0Y2FzZSBQUk9DRVNTSU5HX0lOU1RSVUNUSU9OX05PREU6XG5cdFx0cmV0dXJuIGJ1Zi5wdXNoKCBcIjw/XCIsbm9kZS50YXJnZXQsXCIgXCIsbm9kZS5kYXRhLFwiPz5cIik7XG5cdGNhc2UgRU5USVRZX1JFRkVSRU5DRV9OT0RFOlxuXHRcdHJldHVybiBidWYucHVzaCggJyYnLG5vZGUubm9kZU5hbWUsJzsnKTtcblx0Ly9jYXNlIEVOVElUWV9OT0RFOlxuXHQvL2Nhc2UgTk9UQVRJT05fTk9ERTpcblx0ZGVmYXVsdDpcblx0XHRidWYucHVzaCgnPz8nLG5vZGUubm9kZU5hbWUpO1xuXHR9XG59XG5mdW5jdGlvbiBpbXBvcnROb2RlKGRvYyxub2RlLGRlZXApe1xuXHR2YXIgbm9kZTI7XG5cdHN3aXRjaCAobm9kZS5ub2RlVHlwZSkge1xuXHRjYXNlIEVMRU1FTlRfTk9ERTpcblx0XHRub2RlMiA9IG5vZGUuY2xvbmVOb2RlKGZhbHNlKTtcblx0XHRub2RlMi5vd25lckRvY3VtZW50ID0gZG9jO1xuXHRcdC8vdmFyIGF0dHJzID0gbm9kZTIuYXR0cmlidXRlcztcblx0XHQvL3ZhciBsZW4gPSBhdHRycy5sZW5ndGg7XG5cdFx0Ly9mb3IodmFyIGk9MDtpPGxlbjtpKyspe1xuXHRcdFx0Ly9ub2RlMi5zZXRBdHRyaWJ1dGVOb2RlTlMoaW1wb3J0Tm9kZShkb2MsYXR0cnMuaXRlbShpKSxkZWVwKSk7XG5cdFx0Ly99XG5cdGNhc2UgRE9DVU1FTlRfRlJBR01FTlRfTk9ERTpcblx0XHRicmVhaztcblx0Y2FzZSBBVFRSSUJVVEVfTk9ERTpcblx0XHRkZWVwID0gdHJ1ZTtcblx0XHRicmVhaztcblx0Ly9jYXNlIEVOVElUWV9SRUZFUkVOQ0VfTk9ERTpcblx0Ly9jYXNlIFBST0NFU1NJTkdfSU5TVFJVQ1RJT05fTk9ERTpcblx0Ly8vL2Nhc2UgVEVYVF9OT0RFOlxuXHQvL2Nhc2UgQ0RBVEFfU0VDVElPTl9OT0RFOlxuXHQvL2Nhc2UgQ09NTUVOVF9OT0RFOlxuXHQvL1x0ZGVlcCA9IGZhbHNlO1xuXHQvL1x0YnJlYWs7XG5cdC8vY2FzZSBET0NVTUVOVF9OT0RFOlxuXHQvL2Nhc2UgRE9DVU1FTlRfVFlQRV9OT0RFOlxuXHQvL2Nhbm5vdCBiZSBpbXBvcnRlZC5cblx0Ly9jYXNlIEVOVElUWV9OT0RFOlxuXHQvL2Nhc2UgTk9UQVRJT05fTk9ERe+8mlxuXHQvL2NhbiBub3QgaGl0IGluIGxldmVsM1xuXHQvL2RlZmF1bHQ6dGhyb3cgZTtcblx0fVxuXHRpZighbm9kZTIpe1xuXHRcdG5vZGUyID0gbm9kZS5jbG9uZU5vZGUoZmFsc2UpOy8vZmFsc2Vcblx0fVxuXHRub2RlMi5vd25lckRvY3VtZW50ID0gZG9jO1xuXHRub2RlMi5wYXJlbnROb2RlID0gbnVsbDtcblx0aWYoZGVlcCl7XG5cdFx0dmFyIGNoaWxkID0gbm9kZS5maXJzdENoaWxkO1xuXHRcdHdoaWxlKGNoaWxkKXtcblx0XHRcdG5vZGUyLmFwcGVuZENoaWxkKGltcG9ydE5vZGUoZG9jLGNoaWxkLGRlZXApKTtcblx0XHRcdGNoaWxkID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBub2RlMjtcbn1cbi8vXG4vL3ZhciBfcmVsYXRpb25NYXAgPSB7Zmlyc3RDaGlsZDoxLGxhc3RDaGlsZDoxLHByZXZpb3VzU2libGluZzoxLG5leHRTaWJsaW5nOjEsXG4vL1x0XHRcdFx0XHRhdHRyaWJ1dGVzOjEsY2hpbGROb2RlczoxLHBhcmVudE5vZGU6MSxkb2N1bWVudEVsZW1lbnQ6MSxkb2N0eXBlLH07XG5mdW5jdGlvbiBjbG9uZU5vZGUoZG9jLG5vZGUsZGVlcCl7XG5cdHZhciBub2RlMiA9IG5ldyBub2RlLmNvbnN0cnVjdG9yKCk7XG5cdGZvcih2YXIgbiBpbiBub2RlKXtcblx0XHR2YXIgdiA9IG5vZGVbbl07XG5cdFx0aWYodHlwZW9mIHYgIT0gJ29iamVjdCcgKXtcblx0XHRcdGlmKHYgIT0gbm9kZTJbbl0pe1xuXHRcdFx0XHRub2RlMltuXSA9IHY7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGlmKG5vZGUuY2hpbGROb2Rlcyl7XG5cdFx0bm9kZTIuY2hpbGROb2RlcyA9IG5ldyBOb2RlTGlzdCgpO1xuXHR9XG5cdG5vZGUyLm93bmVyRG9jdW1lbnQgPSBkb2M7XG5cdHN3aXRjaCAobm9kZTIubm9kZVR5cGUpIHtcblx0Y2FzZSBFTEVNRU5UX05PREU6XG5cdFx0dmFyIGF0dHJzXHQ9IG5vZGUuYXR0cmlidXRlcztcblx0XHR2YXIgYXR0cnMyXHQ9IG5vZGUyLmF0dHJpYnV0ZXMgPSBuZXcgTmFtZWROb2RlTWFwKCk7XG5cdFx0dmFyIGxlbiA9IGF0dHJzLmxlbmd0aFxuXHRcdGF0dHJzMi5fb3duZXJFbGVtZW50ID0gbm9kZTI7XG5cdFx0Zm9yKHZhciBpPTA7aTxsZW47aSsrKXtcblx0XHRcdG5vZGUyLnNldEF0dHJpYnV0ZU5vZGUoY2xvbmVOb2RlKGRvYyxhdHRycy5pdGVtKGkpLHRydWUpKTtcblx0XHR9XG5cdFx0YnJlYWs7O1xuXHRjYXNlIEFUVFJJQlVURV9OT0RFOlxuXHRcdGRlZXAgPSB0cnVlO1xuXHR9XG5cdGlmKGRlZXApe1xuXHRcdHZhciBjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZDtcblx0XHR3aGlsZShjaGlsZCl7XG5cdFx0XHRub2RlMi5hcHBlbmRDaGlsZChjbG9uZU5vZGUoZG9jLGNoaWxkLGRlZXApKTtcblx0XHRcdGNoaWxkID0gY2hpbGQubmV4dFNpYmxpbmc7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBub2RlMjtcbn1cblxuZnVuY3Rpb24gX19zZXRfXyhvYmplY3Qsa2V5LHZhbHVlKXtcblx0b2JqZWN0W2tleV0gPSB2YWx1ZVxufVxuLy9kbyBkeW5hbWljXG50cnl7XG5cdGlmKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSl7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KExpdmVOb2RlTGlzdC5wcm90b3R5cGUsJ2xlbmd0aCcse1xuXHRcdFx0Z2V0OmZ1bmN0aW9uKCl7XG5cdFx0XHRcdF91cGRhdGVMaXZlTGlzdCh0aGlzKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuJCRsZW5ndGg7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KE5vZGUucHJvdG90eXBlLCd0ZXh0Q29udGVudCcse1xuXHRcdFx0Z2V0OmZ1bmN0aW9uKCl7XG5cdFx0XHRcdHJldHVybiBnZXRUZXh0Q29udGVudCh0aGlzKTtcblx0XHRcdH0sXG5cdFx0XHRzZXQ6ZnVuY3Rpb24oZGF0YSl7XG5cdFx0XHRcdHN3aXRjaCh0aGlzLm5vZGVUeXBlKXtcblx0XHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRjYXNlIDExOlxuXHRcdFx0XHRcdHdoaWxlKHRoaXMuZmlyc3RDaGlsZCl7XG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUNoaWxkKHRoaXMuZmlyc3RDaGlsZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKGRhdGEgfHwgU3RyaW5nKGRhdGEpKXtcblx0XHRcdFx0XHRcdHRoaXMuYXBwZW5kQ2hpbGQodGhpcy5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGRhdGEpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0Ly9UT0RPOlxuXHRcdFx0XHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdHRoaXMubm9kZVZhbHVlID0gZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pXG5cdFx0XG5cdFx0ZnVuY3Rpb24gZ2V0VGV4dENvbnRlbnQobm9kZSl7XG5cdFx0XHRzd2l0Y2gobm9kZS5ub2RlVHlwZSl7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRjYXNlIDExOlxuXHRcdFx0XHR2YXIgYnVmID0gW107XG5cdFx0XHRcdG5vZGUgPSBub2RlLmZpcnN0Q2hpbGQ7XG5cdFx0XHRcdHdoaWxlKG5vZGUpe1xuXHRcdFx0XHRcdGlmKG5vZGUubm9kZVR5cGUhPT03ICYmIG5vZGUubm9kZVR5cGUgIT09OCl7XG5cdFx0XHRcdFx0XHRidWYucHVzaChnZXRUZXh0Q29udGVudChub2RlKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5vZGUgPSBub2RlLm5leHRTaWJsaW5nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBidWYuam9pbignJyk7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gbm9kZS5ub2RlVmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdF9fc2V0X18gPSBmdW5jdGlvbihvYmplY3Qsa2V5LHZhbHVlKXtcblx0XHRcdC8vY29uc29sZS5sb2codmFsdWUpXG5cdFx0XHRvYmplY3RbJyQkJytrZXldID0gdmFsdWVcblx0XHR9XG5cdH1cbn1jYXRjaChlKXsvL2llOFxufVxuXG5pZih0eXBlb2YgcmVxdWlyZSA9PSAnZnVuY3Rpb24nKXtcblx0ZXhwb3J0cy5ET01JbXBsZW1lbnRhdGlvbiA9IERPTUltcGxlbWVudGF0aW9uO1xuXHRleHBvcnRzLlhNTFNlcmlhbGl6ZXIgPSBYTUxTZXJpYWxpemVyO1xufVxuIiwiLy9bNF0gICBcdE5hbWVTdGFydENoYXJcdCAgIDo6PSAgIFx0XCI6XCIgfCBbQS1aXSB8IFwiX1wiIHwgW2Etel0gfCBbI3hDMC0jeEQ2XSB8IFsjeEQ4LSN4RjZdIHwgWyN4RjgtI3gyRkZdIHwgWyN4MzcwLSN4MzdEXSB8IFsjeDM3Ri0jeDFGRkZdIHwgWyN4MjAwQy0jeDIwMERdIHwgWyN4MjA3MC0jeDIxOEZdIHwgWyN4MkMwMC0jeDJGRUZdIHwgWyN4MzAwMS0jeEQ3RkZdIHwgWyN4RjkwMC0jeEZEQ0ZdIHwgWyN4RkRGMC0jeEZGRkRdIHwgWyN4MTAwMDAtI3hFRkZGRl1cclxuLy9bNGFdICAgXHROYW1lQ2hhclx0ICAgOjo9ICAgXHROYW1lU3RhcnRDaGFyIHwgXCItXCIgfCBcIi5cIiB8IFswLTldIHwgI3hCNyB8IFsjeDAzMDAtI3gwMzZGXSB8IFsjeDIwM0YtI3gyMDQwXVxyXG4vL1s1XSAgIFx0TmFtZVx0ICAgOjo9ICAgXHROYW1lU3RhcnRDaGFyIChOYW1lQ2hhcikqXHJcbnZhciBuYW1lU3RhcnRDaGFyID0gL1tBLVpfYS16XFx4QzAtXFx4RDZcXHhEOC1cXHhGNlxcdTAwRjgtXFx1MDJGRlxcdTAzNzAtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMEMtXFx1MjAwRFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRF0vLy9cXHUxMDAwMC1cXHVFRkZGRlxyXG52YXIgbmFtZUNoYXIgPSBuZXcgUmVnRXhwKFwiW1xcXFwtXFxcXC4wLTlcIituYW1lU3RhcnRDaGFyLnNvdXJjZS5zbGljZSgxLC0xKStcIlxcdTAwQjdcXHUwMzAwLVxcdTAzNkZcXFxcdTIwM0YtXFx1MjA0MF1cIik7XHJcbnZhciB0YWdOYW1lUGF0dGVybiA9IG5ldyBSZWdFeHAoJ14nK25hbWVTdGFydENoYXIuc291cmNlK25hbWVDaGFyLnNvdXJjZSsnKig/OlxcOicrbmFtZVN0YXJ0Q2hhci5zb3VyY2UrbmFtZUNoYXIuc291cmNlKycqKT8kJyk7XHJcbi8vdmFyIHRhZ05hbWVQYXR0ZXJuID0gL15bYS16QS1aX11bXFx3XFwtXFwuXSooPzpcXDpbYS16QS1aX11bXFx3XFwtXFwuXSopPyQvXHJcbi8vdmFyIGhhbmRsZXJzID0gJ3Jlc29sdmVFbnRpdHksZ2V0RXh0ZXJuYWxTdWJzZXQsY2hhcmFjdGVycyxlbmREb2N1bWVudCxlbmRFbGVtZW50LGVuZFByZWZpeE1hcHBpbmcsaWdub3JhYmxlV2hpdGVzcGFjZSxwcm9jZXNzaW5nSW5zdHJ1Y3Rpb24sc2V0RG9jdW1lbnRMb2NhdG9yLHNraXBwZWRFbnRpdHksc3RhcnREb2N1bWVudCxzdGFydEVsZW1lbnQsc3RhcnRQcmVmaXhNYXBwaW5nLG5vdGF0aW9uRGVjbCx1bnBhcnNlZEVudGl0eURlY2wsZXJyb3IsZmF0YWxFcnJvcix3YXJuaW5nLGF0dHJpYnV0ZURlY2wsZWxlbWVudERlY2wsZXh0ZXJuYWxFbnRpdHlEZWNsLGludGVybmFsRW50aXR5RGVjbCxjb21tZW50LGVuZENEQVRBLGVuZERURCxlbmRFbnRpdHksc3RhcnRDREFUQSxzdGFydERURCxzdGFydEVudGl0eScuc3BsaXQoJywnKVxyXG5cclxuLy9TX1RBRyxcdFNfQVRUUixcdFNfRVEsXHRTX1ZcclxuLy9TX0FUVFJfUyxcdFNfRSxcdFNfUyxcdFNfQ1xyXG52YXIgU19UQUcgPSAwOy8vdGFnIG5hbWUgb2ZmZXJyaW5nXHJcbnZhciBTX0FUVFIgPSAxOy8vYXR0ciBuYW1lIG9mZmVycmluZyBcclxudmFyIFNfQVRUUl9TPTI7Ly9hdHRyIG5hbWUgZW5kIGFuZCBzcGFjZSBvZmZlclxyXG52YXIgU19FUSA9IDM7Ly89c3BhY2U/XHJcbnZhciBTX1YgPSA0Oy8vYXR0ciB2YWx1ZShubyBxdW90IHZhbHVlIG9ubHkpXHJcbnZhciBTX0UgPSA1Oy8vYXR0ciB2YWx1ZSBlbmQgYW5kIG5vIHNwYWNlKHF1b3QgZW5kKVxyXG52YXIgU19TID0gNjsvLyhhdHRyIHZhbHVlIGVuZCB8fCB0YWcgZW5kICkgJiYgKHNwYWNlIG9mZmVyKVxyXG52YXIgU19DID0gNzsvL2Nsb3NlZCBlbDxlbCAvPlxyXG5cclxuZnVuY3Rpb24gWE1MUmVhZGVyKCl7XHJcblx0XHJcbn1cclxuXHJcblhNTFJlYWRlci5wcm90b3R5cGUgPSB7XHJcblx0cGFyc2U6ZnVuY3Rpb24oc291cmNlLGRlZmF1bHROU01hcCxlbnRpdHlNYXApe1xyXG5cdFx0dmFyIGRvbUJ1aWxkZXIgPSB0aGlzLmRvbUJ1aWxkZXI7XHJcblx0XHRkb21CdWlsZGVyLnN0YXJ0RG9jdW1lbnQoKTtcclxuXHRcdF9jb3B5KGRlZmF1bHROU01hcCAsZGVmYXVsdE5TTWFwID0ge30pXHJcblx0XHRwYXJzZShzb3VyY2UsZGVmYXVsdE5TTWFwLGVudGl0eU1hcCxcclxuXHRcdFx0XHRkb21CdWlsZGVyLHRoaXMuZXJyb3JIYW5kbGVyKTtcclxuXHRcdGRvbUJ1aWxkZXIuZW5kRG9jdW1lbnQoKTtcclxuXHR9XHJcbn1cclxuZnVuY3Rpb24gcGFyc2Uoc291cmNlLGRlZmF1bHROU01hcENvcHksZW50aXR5TWFwLGRvbUJ1aWxkZXIsZXJyb3JIYW5kbGVyKXtcclxuICBmdW5jdGlvbiBmaXhlZEZyb21DaGFyQ29kZShjb2RlKSB7XHJcblx0XHQvLyBTdHJpbmcucHJvdG90eXBlLmZyb21DaGFyQ29kZSBkb2VzIG5vdCBzdXBwb3J0c1xyXG5cdFx0Ly8gPiAyIGJ5dGVzIHVuaWNvZGUgY2hhcnMgZGlyZWN0bHlcclxuXHRcdGlmIChjb2RlID4gMHhmZmZmKSB7XHJcblx0XHRcdGNvZGUgLT0gMHgxMDAwMDtcclxuXHRcdFx0dmFyIHN1cnJvZ2F0ZTEgPSAweGQ4MDAgKyAoY29kZSA+PiAxMClcclxuXHRcdFx0XHQsIHN1cnJvZ2F0ZTIgPSAweGRjMDAgKyAoY29kZSAmIDB4M2ZmKTtcclxuXHJcblx0XHRcdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHN1cnJvZ2F0ZTEsIHN1cnJvZ2F0ZTIpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSk7XHJcblx0XHR9XHJcblx0fVxyXG5cdGZ1bmN0aW9uIGVudGl0eVJlcGxhY2VyKGEpe1xyXG5cdFx0dmFyIGsgPSBhLnNsaWNlKDEsLTEpO1xyXG5cdFx0aWYoayBpbiBlbnRpdHlNYXApe1xyXG5cdFx0XHRyZXR1cm4gZW50aXR5TWFwW2tdOyBcclxuXHRcdH1lbHNlIGlmKGsuY2hhckF0KDApID09PSAnIycpe1xyXG5cdFx0XHRyZXR1cm4gZml4ZWRGcm9tQ2hhckNvZGUocGFyc2VJbnQoay5zdWJzdHIoMSkucmVwbGFjZSgneCcsJzB4JykpKVxyXG5cdFx0fWVsc2V7XHJcblx0XHRcdGVycm9ySGFuZGxlci5lcnJvcignZW50aXR5IG5vdCBmb3VuZDonK2EpO1xyXG5cdFx0XHRyZXR1cm4gYTtcclxuXHRcdH1cclxuXHR9XHJcblx0ZnVuY3Rpb24gYXBwZW5kVGV4dChlbmQpey8vaGFzIHNvbWUgYnVnc1xyXG5cdFx0aWYoZW5kPnN0YXJ0KXtcclxuXHRcdFx0dmFyIHh0ID0gc291cmNlLnN1YnN0cmluZyhzdGFydCxlbmQpLnJlcGxhY2UoLyYjP1xcdys7L2csZW50aXR5UmVwbGFjZXIpO1xyXG5cdFx0XHRsb2NhdG9yJiZwb3NpdGlvbihzdGFydCk7XHJcblx0XHRcdGRvbUJ1aWxkZXIuY2hhcmFjdGVycyh4dCwwLGVuZC1zdGFydCk7XHJcblx0XHRcdHN0YXJ0ID0gZW5kXHJcblx0XHR9XHJcblx0fVxyXG5cdGZ1bmN0aW9uIHBvc2l0aW9uKHAsbSl7XHJcblx0XHR3aGlsZShwPj1saW5lRW5kICYmIChtID0gbGluZVBhdHRlcm4uZXhlYyhzb3VyY2UpKSl7XHJcblx0XHRcdGxpbmVTdGFydCA9IG0uaW5kZXg7XHJcblx0XHRcdGxpbmVFbmQgPSBsaW5lU3RhcnQgKyBtWzBdLmxlbmd0aDtcclxuXHRcdFx0bG9jYXRvci5saW5lTnVtYmVyKys7XHJcblx0XHRcdC8vY29uc29sZS5sb2coJ2xpbmUrKzonLGxvY2F0b3Isc3RhcnRQb3MsZW5kUG9zKVxyXG5cdFx0fVxyXG5cdFx0bG9jYXRvci5jb2x1bW5OdW1iZXIgPSBwLWxpbmVTdGFydCsxO1xyXG5cdH1cclxuXHR2YXIgbGluZVN0YXJ0ID0gMDtcclxuXHR2YXIgbGluZUVuZCA9IDA7XHJcblx0dmFyIGxpbmVQYXR0ZXJuID0gLy4rKD86XFxyXFxuP3xcXG4pfC4qJC9nXHJcblx0dmFyIGxvY2F0b3IgPSBkb21CdWlsZGVyLmxvY2F0b3I7XHJcblx0XHJcblx0dmFyIHBhcnNlU3RhY2sgPSBbe2N1cnJlbnROU01hcDpkZWZhdWx0TlNNYXBDb3B5fV1cclxuXHR2YXIgY2xvc2VNYXAgPSB7fTtcclxuXHR2YXIgc3RhcnQgPSAwO1xyXG5cdHdoaWxlKHRydWUpe1xyXG5cdFx0dHJ5e1xyXG5cdFx0XHR2YXIgdGFnU3RhcnQgPSBzb3VyY2UuaW5kZXhPZignPCcsc3RhcnQpO1xyXG5cdFx0XHRpZih0YWdTdGFydDwwKXtcclxuXHRcdFx0XHRpZighc291cmNlLnN1YnN0cihzdGFydCkubWF0Y2goL15cXHMqJC8pKXtcclxuXHRcdFx0XHRcdHZhciBkb2MgPSBkb21CdWlsZGVyLmRvY3VtZW50O1xyXG5cdCAgICBcdFx0XHR2YXIgdGV4dCA9IGRvYy5jcmVhdGVUZXh0Tm9kZShzb3VyY2Uuc3Vic3RyKHN0YXJ0KSk7XHJcblx0ICAgIFx0XHRcdGRvYy5hcHBlbmRDaGlsZCh0ZXh0KTtcclxuXHQgICAgXHRcdFx0ZG9tQnVpbGRlci5jdXJyZW50RWxlbWVudCA9IHRleHQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZih0YWdTdGFydD5zdGFydCl7XHJcblx0XHRcdFx0YXBwZW5kVGV4dCh0YWdTdGFydCk7XHJcblx0XHRcdH1cclxuXHRcdFx0c3dpdGNoKHNvdXJjZS5jaGFyQXQodGFnU3RhcnQrMSkpe1xyXG5cdFx0XHRjYXNlICcvJzpcclxuXHRcdFx0XHR2YXIgZW5kID0gc291cmNlLmluZGV4T2YoJz4nLHRhZ1N0YXJ0KzMpO1xyXG5cdFx0XHRcdHZhciB0YWdOYW1lID0gc291cmNlLnN1YnN0cmluZyh0YWdTdGFydCsyLGVuZCk7XHJcblx0XHRcdFx0dmFyIGNvbmZpZyA9IHBhcnNlU3RhY2sucG9wKCk7XHJcblx0XHRcdFx0dmFyIGxvY2FsTlNNYXAgPSBjb25maWcubG9jYWxOU01hcDtcclxuXHRcdCAgICAgICAgaWYoY29uZmlnLnRhZ05hbWUgIT0gdGFnTmFtZSl7XHJcblx0XHQgICAgICAgICAgICBlcnJvckhhbmRsZXIuZmF0YWxFcnJvcihcImVuZCB0YWcgbmFtZTogXCIrdGFnTmFtZSsnIGlzIG5vdCBtYXRjaCB0aGUgY3VycmVudCBzdGFydCB0YWdOYW1lOicrY29uZmlnLnRhZ05hbWUgKTtcclxuXHRcdCAgICAgICAgfVxyXG5cdFx0XHRcdGRvbUJ1aWxkZXIuZW5kRWxlbWVudChjb25maWcudXJpLGNvbmZpZy5sb2NhbE5hbWUsdGFnTmFtZSk7XHJcblx0XHRcdFx0aWYobG9jYWxOU01hcCl7XHJcblx0XHRcdFx0XHRmb3IodmFyIHByZWZpeCBpbiBsb2NhbE5TTWFwKXtcclxuXHRcdFx0XHRcdFx0ZG9tQnVpbGRlci5lbmRQcmVmaXhNYXBwaW5nKHByZWZpeCkgO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbmQrKztcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHQvLyBlbmQgZWxtZW50XHJcblx0XHRcdGNhc2UgJz8nOi8vIDw/Li4uPz5cclxuXHRcdFx0XHRsb2NhdG9yJiZwb3NpdGlvbih0YWdTdGFydCk7XHJcblx0XHRcdFx0ZW5kID0gcGFyc2VJbnN0cnVjdGlvbihzb3VyY2UsdGFnU3RhcnQsZG9tQnVpbGRlcik7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJyEnOi8vIDwhZG9jdHlwZSw8IVtDREFUQSw8IS0tXHJcblx0XHRcdFx0bG9jYXRvciYmcG9zaXRpb24odGFnU3RhcnQpO1xyXG5cdFx0XHRcdGVuZCA9IHBhcnNlRENDKHNvdXJjZSx0YWdTdGFydCxkb21CdWlsZGVyLGVycm9ySGFuZGxlcik7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFxyXG5cdFx0XHRcdGxvY2F0b3ImJnBvc2l0aW9uKHRhZ1N0YXJ0KTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR2YXIgZWwgPSBuZXcgRWxlbWVudEF0dHJpYnV0ZXMoKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHQvL2VsU3RhcnRFbmRcclxuXHRcdFx0XHR2YXIgZW5kID0gcGFyc2VFbGVtZW50U3RhcnRQYXJ0KHNvdXJjZSx0YWdTdGFydCxlbCxlbnRpdHlSZXBsYWNlcixlcnJvckhhbmRsZXIpO1xyXG5cdFx0XHRcdHZhciBsZW4gPSBlbC5sZW5ndGg7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYobG9jYXRvcil7XHJcblx0XHRcdFx0XHRpZihsZW4pe1xyXG5cdFx0XHRcdFx0XHQvL2F0dHJpYnV0ZSBwb3NpdGlvbiBmaXhlZFxyXG5cdFx0XHRcdFx0XHRmb3IodmFyIGkgPSAwO2k8bGVuO2krKyl7XHJcblx0XHRcdFx0XHRcdFx0dmFyIGEgPSBlbFtpXTtcclxuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbihhLm9mZnNldCk7XHJcblx0XHRcdFx0XHRcdFx0YS5vZmZzZXQgPSBjb3B5TG9jYXRvcihsb2NhdG9yLHt9KTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cG9zaXRpb24oZW5kKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYoIWVsLmNsb3NlZCAmJiBmaXhTZWxmQ2xvc2VkKHNvdXJjZSxlbmQsZWwudGFnTmFtZSxjbG9zZU1hcCkpe1xyXG5cdFx0XHRcdFx0ZWwuY2xvc2VkID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGlmKCFlbnRpdHlNYXAubmJzcCl7XHJcblx0XHRcdFx0XHRcdGVycm9ySGFuZGxlci53YXJuaW5nKCd1bmNsb3NlZCB4bWwgYXR0cmlidXRlJyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGFwcGVuZEVsZW1lbnQoZWwsZG9tQnVpbGRlcixwYXJzZVN0YWNrKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZihlbC51cmkgPT09ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sJyAmJiAhZWwuY2xvc2VkKXtcclxuXHRcdFx0XHRcdGVuZCA9IHBhcnNlSHRtbFNwZWNpYWxDb250ZW50KHNvdXJjZSxlbmQsZWwudGFnTmFtZSxlbnRpdHlSZXBsYWNlcixkb21CdWlsZGVyKVxyXG5cdFx0XHRcdH1lbHNle1xyXG5cdFx0XHRcdFx0ZW5kKys7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9Y2F0Y2goZSl7XHJcblx0XHRcdGVycm9ySGFuZGxlci5lcnJvcignZWxlbWVudCBwYXJzZSBlcnJvcjogJytlKTtcclxuXHRcdFx0ZW5kID0gLTE7XHJcblx0XHR9XHJcblx0XHRpZihlbmQ+c3RhcnQpe1xyXG5cdFx0XHRzdGFydCA9IGVuZDtcclxuXHRcdH1lbHNle1xyXG5cdFx0XHQvL1RPRE86IOi/memHjOacieWPr+iDvXNheOWbnumAgO+8jOacieS9jee9rumUmeivr+mjjumZqVxyXG5cdFx0XHRhcHBlbmRUZXh0KE1hdGgubWF4KHRhZ1N0YXJ0LHN0YXJ0KSsxKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuZnVuY3Rpb24gY29weUxvY2F0b3IoZix0KXtcclxuXHR0LmxpbmVOdW1iZXIgPSBmLmxpbmVOdW1iZXI7XHJcblx0dC5jb2x1bW5OdW1iZXIgPSBmLmNvbHVtbk51bWJlcjtcclxuXHRyZXR1cm4gdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBzZWUgI2FwcGVuZEVsZW1lbnQoc291cmNlLGVsU3RhcnRFbmQsZWwsc2VsZkNsb3NlZCxlbnRpdHlSZXBsYWNlcixkb21CdWlsZGVyLHBhcnNlU3RhY2spO1xyXG4gKiBAcmV0dXJuIGVuZCBvZiB0aGUgZWxlbWVudFN0YXJ0UGFydChlbmQgb2YgZWxlbWVudEVuZFBhcnQgZm9yIHNlbGZDbG9zZWQgZWwpXHJcbiAqL1xyXG5mdW5jdGlvbiBwYXJzZUVsZW1lbnRTdGFydFBhcnQoc291cmNlLHN0YXJ0LGVsLGVudGl0eVJlcGxhY2VyLGVycm9ySGFuZGxlcil7XHJcblx0dmFyIGF0dHJOYW1lO1xyXG5cdHZhciB2YWx1ZTtcclxuXHR2YXIgcCA9ICsrc3RhcnQ7XHJcblx0dmFyIHMgPSBTX1RBRzsvL3N0YXR1c1xyXG5cdHdoaWxlKHRydWUpe1xyXG5cdFx0dmFyIGMgPSBzb3VyY2UuY2hhckF0KHApO1xyXG5cdFx0c3dpdGNoKGMpe1xyXG5cdFx0Y2FzZSAnPSc6XHJcblx0XHRcdGlmKHMgPT09IFNfQVRUUil7Ly9hdHRyTmFtZVxyXG5cdFx0XHRcdGF0dHJOYW1lID0gc291cmNlLnNsaWNlKHN0YXJ0LHApO1xyXG5cdFx0XHRcdHMgPSBTX0VRO1xyXG5cdFx0XHR9ZWxzZSBpZihzID09PSBTX0FUVFJfUyl7XHJcblx0XHRcdFx0cyA9IFNfRVE7XHJcblx0XHRcdH1lbHNle1xyXG5cdFx0XHRcdC8vZmF0YWxFcnJvcjogZXF1YWwgbXVzdCBhZnRlciBhdHRyTmFtZSBvciBzcGFjZSBhZnRlciBhdHRyTmFtZVxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignYXR0cmlidXRlIGVxdWFsIG11c3QgYWZ0ZXIgYXR0ck5hbWUnKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1xcJyc6XHJcblx0XHRjYXNlICdcIic6XHJcblx0XHRcdGlmKHMgPT09IFNfRVEpey8vZXF1YWxcclxuXHRcdFx0XHRzdGFydCA9IHArMTtcclxuXHRcdFx0XHRwID0gc291cmNlLmluZGV4T2YoYyxzdGFydClcclxuXHRcdFx0XHRpZihwPjApe1xyXG5cdFx0XHRcdFx0dmFsdWUgPSBzb3VyY2Uuc2xpY2Uoc3RhcnQscCkucmVwbGFjZSgvJiM/XFx3KzsvZyxlbnRpdHlSZXBsYWNlcik7XHJcblx0XHRcdFx0XHRlbC5hZGQoYXR0ck5hbWUsdmFsdWUsc3RhcnQtMSk7XHJcblx0XHRcdFx0XHRzID0gU19FO1xyXG5cdFx0XHRcdH1lbHNle1xyXG5cdFx0XHRcdFx0Ly9mYXRhbEVycm9yOiBubyBlbmQgcXVvdCBtYXRjaFxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdhdHRyaWJ1dGUgdmFsdWUgbm8gZW5kIFxcJycrYysnXFwnIG1hdGNoJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ZWxzZSBpZihzID09IFNfVil7XHJcblx0XHRcdFx0dmFsdWUgPSBzb3VyY2Uuc2xpY2Uoc3RhcnQscCkucmVwbGFjZSgvJiM/XFx3KzsvZyxlbnRpdHlSZXBsYWNlcik7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyhhdHRyTmFtZSx2YWx1ZSxzdGFydCxwKVxyXG5cdFx0XHRcdGVsLmFkZChhdHRyTmFtZSx2YWx1ZSxzdGFydCk7XHJcblx0XHRcdFx0Ly9jb25zb2xlLmRpcihlbClcclxuXHRcdFx0XHRlcnJvckhhbmRsZXIud2FybmluZygnYXR0cmlidXRlIFwiJythdHRyTmFtZSsnXCIgbWlzc2VkIHN0YXJ0IHF1b3QoJytjKycpISEnKTtcclxuXHRcdFx0XHRzdGFydCA9IHArMTtcclxuXHRcdFx0XHRzID0gU19FXHJcblx0XHRcdH1lbHNle1xyXG5cdFx0XHRcdC8vZmF0YWxFcnJvcjogbm8gZXF1YWwgYmVmb3JlXHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdhdHRyaWJ1dGUgdmFsdWUgbXVzdCBhZnRlciBcIj1cIicpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnLyc6XHJcblx0XHRcdHN3aXRjaChzKXtcclxuXHRcdFx0Y2FzZSBTX1RBRzpcclxuXHRcdFx0XHRlbC5zZXRUYWdOYW1lKHNvdXJjZS5zbGljZShzdGFydCxwKSk7XHJcblx0XHRcdGNhc2UgU19FOlxyXG5cdFx0XHRjYXNlIFNfUzpcclxuXHRcdFx0Y2FzZSBTX0M6XHJcblx0XHRcdFx0cyA9IFNfQztcclxuXHRcdFx0XHRlbC5jbG9zZWQgPSB0cnVlO1xyXG5cdFx0XHRjYXNlIFNfVjpcclxuXHRcdFx0Y2FzZSBTX0FUVFI6XHJcblx0XHRcdGNhc2UgU19BVFRSX1M6XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdC8vY2FzZSBTX0VROlxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcImF0dHJpYnV0ZSBpbnZhbGlkIGNsb3NlIGNoYXIoJy8nKVwiKVxyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnJzovL2VuZCBkb2N1bWVudFxyXG5cdFx0XHQvL3Rocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCBlbmQgb2YgaW5wdXQnKVxyXG5cdFx0XHRlcnJvckhhbmRsZXIuZXJyb3IoJ3VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0Jyk7XHJcblx0XHRjYXNlICc+JzpcclxuXHRcdFx0c3dpdGNoKHMpe1xyXG5cdFx0XHRjYXNlIFNfVEFHOlxyXG5cdFx0XHRcdGVsLnNldFRhZ05hbWUoc291cmNlLnNsaWNlKHN0YXJ0LHApKTtcclxuXHRcdFx0Y2FzZSBTX0U6XHJcblx0XHRcdGNhc2UgU19TOlxyXG5cdFx0XHRjYXNlIFNfQzpcclxuXHRcdFx0XHRicmVhazsvL25vcm1hbFxyXG5cdFx0XHRjYXNlIFNfVjovL0NvbXBhdGlibGUgc3RhdGVcclxuXHRcdFx0Y2FzZSBTX0FUVFI6XHJcblx0XHRcdFx0dmFsdWUgPSBzb3VyY2Uuc2xpY2Uoc3RhcnQscCk7XHJcblx0XHRcdFx0aWYodmFsdWUuc2xpY2UoLTEpID09PSAnLycpe1xyXG5cdFx0XHRcdFx0ZWwuY2xvc2VkICA9IHRydWU7XHJcblx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnNsaWNlKDAsLTEpXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRjYXNlIFNfQVRUUl9TOlxyXG5cdFx0XHRcdGlmKHMgPT09IFNfQVRUUl9TKXtcclxuXHRcdFx0XHRcdHZhbHVlID0gYXR0ck5hbWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmKHMgPT0gU19WKXtcclxuXHRcdFx0XHRcdGVycm9ySGFuZGxlci53YXJuaW5nKCdhdHRyaWJ1dGUgXCInK3ZhbHVlKydcIiBtaXNzZWQgcXVvdChcIikhIScpO1xyXG5cdFx0XHRcdFx0ZWwuYWRkKGF0dHJOYW1lLHZhbHVlLnJlcGxhY2UoLyYjP1xcdys7L2csZW50aXR5UmVwbGFjZXIpLHN0YXJ0KVxyXG5cdFx0XHRcdH1lbHNle1xyXG5cdFx0XHRcdFx0ZXJyb3JIYW5kbGVyLndhcm5pbmcoJ2F0dHJpYnV0ZSBcIicrdmFsdWUrJ1wiIG1pc3NlZCB2YWx1ZSEhIFwiJyt2YWx1ZSsnXCIgaW5zdGVhZCEhJylcclxuXHRcdFx0XHRcdGVsLmFkZCh2YWx1ZSx2YWx1ZSxzdGFydClcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgU19FUTpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2F0dHJpYnV0ZSB2YWx1ZSBtaXNzZWQhIScpO1xyXG5cdFx0XHR9XHJcbi8vXHRcdFx0Y29uc29sZS5sb2codGFnTmFtZSx0YWdOYW1lUGF0dGVybix0YWdOYW1lUGF0dGVybi50ZXN0KHRhZ05hbWUpKVxyXG5cdFx0XHRyZXR1cm4gcDtcclxuXHRcdC8qeG1sIHNwYWNlICdcXHgyMCcgfCAjeDkgfCAjeEQgfCAjeEE7ICovXHJcblx0XHRjYXNlICdcXHUwMDgwJzpcclxuXHRcdFx0YyA9ICcgJztcclxuXHRcdGRlZmF1bHQ6XHJcblx0XHRcdGlmKGM8PSAnICcpey8vc3BhY2VcclxuXHRcdFx0XHRzd2l0Y2gocyl7XHJcblx0XHRcdFx0Y2FzZSBTX1RBRzpcclxuXHRcdFx0XHRcdGVsLnNldFRhZ05hbWUoc291cmNlLnNsaWNlKHN0YXJ0LHApKTsvL3RhZ05hbWVcclxuXHRcdFx0XHRcdHMgPSBTX1M7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIFNfQVRUUjpcclxuXHRcdFx0XHRcdGF0dHJOYW1lID0gc291cmNlLnNsaWNlKHN0YXJ0LHApXHJcblx0XHRcdFx0XHRzID0gU19BVFRSX1M7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIFNfVjpcclxuXHRcdFx0XHRcdHZhciB2YWx1ZSA9IHNvdXJjZS5zbGljZShzdGFydCxwKS5yZXBsYWNlKC8mIz9cXHcrOy9nLGVudGl0eVJlcGxhY2VyKTtcclxuXHRcdFx0XHRcdGVycm9ySGFuZGxlci53YXJuaW5nKCdhdHRyaWJ1dGUgXCInK3ZhbHVlKydcIiBtaXNzZWQgcXVvdChcIikhIScpO1xyXG5cdFx0XHRcdFx0ZWwuYWRkKGF0dHJOYW1lLHZhbHVlLHN0YXJ0KVxyXG5cdFx0XHRcdGNhc2UgU19FOlxyXG5cdFx0XHRcdFx0cyA9IFNfUztcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdC8vY2FzZSBTX1M6XHJcblx0XHRcdFx0Ly9jYXNlIFNfRVE6XHJcblx0XHRcdFx0Ly9jYXNlIFNfQVRUUl9TOlxyXG5cdFx0XHRcdC8vXHR2b2lkKCk7YnJlYWs7XHJcblx0XHRcdFx0Ly9jYXNlIFNfQzpcclxuXHRcdFx0XHRcdC8vaWdub3JlIHdhcm5pbmdcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1lbHNley8vbm90IHNwYWNlXHJcbi8vU19UQUcsXHRTX0FUVFIsXHRTX0VRLFx0U19WXHJcbi8vU19BVFRSX1MsXHRTX0UsXHRTX1MsXHRTX0NcclxuXHRcdFx0XHRzd2l0Y2gocyl7XHJcblx0XHRcdFx0Ly9jYXNlIFNfVEFHOnZvaWQoKTticmVhaztcclxuXHRcdFx0XHQvL2Nhc2UgU19BVFRSOnZvaWQoKTticmVhaztcclxuXHRcdFx0XHQvL2Nhc2UgU19WOnZvaWQoKTticmVhaztcclxuXHRcdFx0XHRjYXNlIFNfQVRUUl9TOlxyXG5cdFx0XHRcdFx0ZXJyb3JIYW5kbGVyLndhcm5pbmcoJ2F0dHJpYnV0ZSBcIicrYXR0ck5hbWUrJ1wiIG1pc3NlZCB2YWx1ZSEhIFwiJythdHRyTmFtZSsnXCIgaW5zdGVhZCEhJylcclxuXHRcdFx0XHRcdGVsLmFkZChhdHRyTmFtZSxhdHRyTmFtZSxzdGFydCk7XHJcblx0XHRcdFx0XHRzdGFydCA9IHA7XHJcblx0XHRcdFx0XHRzID0gU19BVFRSO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX0U6XHJcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIud2FybmluZygnYXR0cmlidXRlIHNwYWNlIGlzIHJlcXVpcmVkXCInK2F0dHJOYW1lKydcIiEhJylcclxuXHRcdFx0XHRjYXNlIFNfUzpcclxuXHRcdFx0XHRcdHMgPSBTX0FUVFI7XHJcblx0XHRcdFx0XHRzdGFydCA9IHA7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlIFNfRVE6XHJcblx0XHRcdFx0XHRzID0gU19WO1xyXG5cdFx0XHRcdFx0c3RhcnQgPSBwO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSBTX0M6XHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJlbGVtZW50cyBjbG9zZWQgY2hhcmFjdGVyICcvJyBhbmQgJz4nIG11c3QgYmUgY29ubmVjdGVkIHRvXCIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cCsrO1xyXG5cdH1cclxufVxyXG4vKipcclxuICogQHJldHVybiBlbmQgb2YgdGhlIGVsZW1lbnRTdGFydFBhcnQoZW5kIG9mIGVsZW1lbnRFbmRQYXJ0IGZvciBzZWxmQ2xvc2VkIGVsKVxyXG4gKi9cclxuZnVuY3Rpb24gYXBwZW5kRWxlbWVudChlbCxkb21CdWlsZGVyLHBhcnNlU3RhY2spe1xyXG5cdHZhciB0YWdOYW1lID0gZWwudGFnTmFtZTtcclxuXHR2YXIgbG9jYWxOU01hcCA9IG51bGw7XHJcblx0dmFyIGN1cnJlbnROU01hcCA9IHBhcnNlU3RhY2tbcGFyc2VTdGFjay5sZW5ndGgtMV0uY3VycmVudE5TTWFwO1xyXG5cdHZhciBpID0gZWwubGVuZ3RoO1xyXG5cdHdoaWxlKGktLSl7XHJcblx0XHR2YXIgYSA9IGVsW2ldO1xyXG5cdFx0dmFyIHFOYW1lID0gYS5xTmFtZTtcclxuXHRcdHZhciB2YWx1ZSA9IGEudmFsdWU7XHJcblx0XHR2YXIgbnNwID0gcU5hbWUuaW5kZXhPZignOicpO1xyXG5cdFx0aWYobnNwPjApe1xyXG5cdFx0XHR2YXIgcHJlZml4ID0gYS5wcmVmaXggPSBxTmFtZS5zbGljZSgwLG5zcCk7XHJcblx0XHRcdHZhciBsb2NhbE5hbWUgPSBxTmFtZS5zbGljZShuc3ArMSk7XHJcblx0XHRcdHZhciBuc1ByZWZpeCA9IHByZWZpeCA9PT0gJ3htbG5zJyAmJiBsb2NhbE5hbWVcclxuXHRcdH1lbHNle1xyXG5cdFx0XHRsb2NhbE5hbWUgPSBxTmFtZTtcclxuXHRcdFx0cHJlZml4ID0gbnVsbFxyXG5cdFx0XHRuc1ByZWZpeCA9IHFOYW1lID09PSAneG1sbnMnICYmICcnXHJcblx0XHR9XHJcblx0XHQvL2NhbiBub3Qgc2V0IHByZWZpeCxiZWNhdXNlIHByZWZpeCAhPT0gJydcclxuXHRcdGEubG9jYWxOYW1lID0gbG9jYWxOYW1lIDtcclxuXHRcdC8vcHJlZml4ID09IG51bGwgZm9yIG5vIG5zIHByZWZpeCBhdHRyaWJ1dGUgXHJcblx0XHRpZihuc1ByZWZpeCAhPT0gZmFsc2Upey8vaGFjayEhXHJcblx0XHRcdGlmKGxvY2FsTlNNYXAgPT0gbnVsbCl7XHJcblx0XHRcdFx0bG9jYWxOU01hcCA9IHt9XHJcblx0XHRcdFx0Ly9jb25zb2xlLmxvZyhjdXJyZW50TlNNYXAsMClcclxuXHRcdFx0XHRfY29weShjdXJyZW50TlNNYXAsY3VycmVudE5TTWFwPXt9KVxyXG5cdFx0XHRcdC8vY29uc29sZS5sb2coY3VycmVudE5TTWFwLDEpXHJcblx0XHRcdH1cclxuXHRcdFx0Y3VycmVudE5TTWFwW25zUHJlZml4XSA9IGxvY2FsTlNNYXBbbnNQcmVmaXhdID0gdmFsdWU7XHJcblx0XHRcdGEudXJpID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAveG1sbnMvJ1xyXG5cdFx0XHRkb21CdWlsZGVyLnN0YXJ0UHJlZml4TWFwcGluZyhuc1ByZWZpeCwgdmFsdWUpIFxyXG5cdFx0fVxyXG5cdH1cclxuXHR2YXIgaSA9IGVsLmxlbmd0aDtcclxuXHR3aGlsZShpLS0pe1xyXG5cdFx0YSA9IGVsW2ldO1xyXG5cdFx0dmFyIHByZWZpeCA9IGEucHJlZml4O1xyXG5cdFx0aWYocHJlZml4KXsvL25vIHByZWZpeCBhdHRyaWJ1dGUgaGFzIG5vIG5hbWVzcGFjZVxyXG5cdFx0XHRpZihwcmVmaXggPT09ICd4bWwnKXtcclxuXHRcdFx0XHRhLnVyaSA9ICdodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2UnO1xyXG5cdFx0XHR9aWYocHJlZml4ICE9PSAneG1sbnMnKXtcclxuXHRcdFx0XHRhLnVyaSA9IGN1cnJlbnROU01hcFtwcmVmaXhdXHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Ly97Y29uc29sZS5sb2coJyMjIycrYS5xTmFtZSxkb21CdWlsZGVyLmxvY2F0b3Iuc3lzdGVtSWQrJycsY3VycmVudE5TTWFwLGEudXJpKX1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHR2YXIgbnNwID0gdGFnTmFtZS5pbmRleE9mKCc6Jyk7XHJcblx0aWYobnNwPjApe1xyXG5cdFx0cHJlZml4ID0gZWwucHJlZml4ID0gdGFnTmFtZS5zbGljZSgwLG5zcCk7XHJcblx0XHRsb2NhbE5hbWUgPSBlbC5sb2NhbE5hbWUgPSB0YWdOYW1lLnNsaWNlKG5zcCsxKTtcclxuXHR9ZWxzZXtcclxuXHRcdHByZWZpeCA9IG51bGw7Ly9pbXBvcnRhbnQhIVxyXG5cdFx0bG9jYWxOYW1lID0gZWwubG9jYWxOYW1lID0gdGFnTmFtZTtcclxuXHR9XHJcblx0Ly9ubyBwcmVmaXggZWxlbWVudCBoYXMgZGVmYXVsdCBuYW1lc3BhY2VcclxuXHR2YXIgbnMgPSBlbC51cmkgPSBjdXJyZW50TlNNYXBbcHJlZml4IHx8ICcnXTtcclxuXHRkb21CdWlsZGVyLnN0YXJ0RWxlbWVudChucyxsb2NhbE5hbWUsdGFnTmFtZSxlbCk7XHJcblx0Ly9lbmRQcmVmaXhNYXBwaW5nIGFuZCBzdGFydFByZWZpeE1hcHBpbmcgaGF2ZSBub3QgYW55IGhlbHAgZm9yIGRvbSBidWlsZGVyXHJcblx0Ly9sb2NhbE5TTWFwID0gbnVsbFxyXG5cdGlmKGVsLmNsb3NlZCl7XHJcblx0XHRkb21CdWlsZGVyLmVuZEVsZW1lbnQobnMsbG9jYWxOYW1lLHRhZ05hbWUpO1xyXG5cdFx0aWYobG9jYWxOU01hcCl7XHJcblx0XHRcdGZvcihwcmVmaXggaW4gbG9jYWxOU01hcCl7XHJcblx0XHRcdFx0ZG9tQnVpbGRlci5lbmRQcmVmaXhNYXBwaW5nKHByZWZpeCkgXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ZWxzZXtcclxuXHRcdGVsLmN1cnJlbnROU01hcCA9IGN1cnJlbnROU01hcDtcclxuXHRcdGVsLmxvY2FsTlNNYXAgPSBsb2NhbE5TTWFwO1xyXG5cdFx0cGFyc2VTdGFjay5wdXNoKGVsKTtcclxuXHR9XHJcbn1cclxuZnVuY3Rpb24gcGFyc2VIdG1sU3BlY2lhbENvbnRlbnQoc291cmNlLGVsU3RhcnRFbmQsdGFnTmFtZSxlbnRpdHlSZXBsYWNlcixkb21CdWlsZGVyKXtcclxuXHRpZigvXig/OnNjcmlwdHx0ZXh0YXJlYSkkL2kudGVzdCh0YWdOYW1lKSl7XHJcblx0XHR2YXIgZWxFbmRTdGFydCA9ICBzb3VyY2UuaW5kZXhPZignPC8nK3RhZ05hbWUrJz4nLGVsU3RhcnRFbmQpO1xyXG5cdFx0dmFyIHRleHQgPSBzb3VyY2Uuc3Vic3RyaW5nKGVsU3RhcnRFbmQrMSxlbEVuZFN0YXJ0KTtcclxuXHRcdGlmKC9bJjxdLy50ZXN0KHRleHQpKXtcclxuXHRcdFx0aWYoL15zY3JpcHQkL2kudGVzdCh0YWdOYW1lKSl7XHJcblx0XHRcdFx0Ly9pZighL1xcXVxcXT4vLnRlc3QodGV4dCkpe1xyXG5cdFx0XHRcdFx0Ly9sZXhIYW5kbGVyLnN0YXJ0Q0RBVEEoKTtcclxuXHRcdFx0XHRcdGRvbUJ1aWxkZXIuY2hhcmFjdGVycyh0ZXh0LDAsdGV4dC5sZW5ndGgpO1xyXG5cdFx0XHRcdFx0Ly9sZXhIYW5kbGVyLmVuZENEQVRBKCk7XHJcblx0XHRcdFx0XHRyZXR1cm4gZWxFbmRTdGFydDtcclxuXHRcdFx0XHQvL31cclxuXHRcdFx0fS8vfWVsc2V7Ly90ZXh0IGFyZWFcclxuXHRcdFx0XHR0ZXh0ID0gdGV4dC5yZXBsYWNlKC8mIz9cXHcrOy9nLGVudGl0eVJlcGxhY2VyKTtcclxuXHRcdFx0XHRkb21CdWlsZGVyLmNoYXJhY3RlcnModGV4dCwwLHRleHQubGVuZ3RoKTtcclxuXHRcdFx0XHRyZXR1cm4gZWxFbmRTdGFydDtcclxuXHRcdFx0Ly99XHJcblx0XHRcdFxyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gZWxTdGFydEVuZCsxO1xyXG59XHJcbmZ1bmN0aW9uIGZpeFNlbGZDbG9zZWQoc291cmNlLGVsU3RhcnRFbmQsdGFnTmFtZSxjbG9zZU1hcCl7XHJcblx0Ly9pZih0YWdOYW1lIGluIGNsb3NlTWFwKXtcclxuXHR2YXIgcG9zID0gY2xvc2VNYXBbdGFnTmFtZV07XHJcblx0aWYocG9zID09IG51bGwpe1xyXG5cdFx0Ly9jb25zb2xlLmxvZyh0YWdOYW1lKVxyXG5cdFx0cG9zID0gY2xvc2VNYXBbdGFnTmFtZV0gPSBzb3VyY2UubGFzdEluZGV4T2YoJzwvJyt0YWdOYW1lKyc+JylcclxuXHR9XHJcblx0cmV0dXJuIHBvczxlbFN0YXJ0RW5kO1xyXG5cdC8vfSBcclxufVxyXG5mdW5jdGlvbiBfY29weShzb3VyY2UsdGFyZ2V0KXtcclxuXHRmb3IodmFyIG4gaW4gc291cmNlKXt0YXJnZXRbbl0gPSBzb3VyY2Vbbl19XHJcbn1cclxuZnVuY3Rpb24gcGFyc2VEQ0Moc291cmNlLHN0YXJ0LGRvbUJ1aWxkZXIsZXJyb3JIYW5kbGVyKXsvL3N1cmUgc3RhcnQgd2l0aCAnPCEnXHJcblx0dmFyIG5leHQ9IHNvdXJjZS5jaGFyQXQoc3RhcnQrMilcclxuXHRzd2l0Y2gobmV4dCl7XHJcblx0Y2FzZSAnLSc6XHJcblx0XHRpZihzb3VyY2UuY2hhckF0KHN0YXJ0ICsgMykgPT09ICctJyl7XHJcblx0XHRcdHZhciBlbmQgPSBzb3VyY2UuaW5kZXhPZignLS0+JyxzdGFydCs0KTtcclxuXHRcdFx0Ly9hcHBlbmQgY29tbWVudCBzb3VyY2Uuc3Vic3RyaW5nKDQsZW5kKS8vPCEtLVxyXG5cdFx0XHRpZihlbmQ+c3RhcnQpe1xyXG5cdFx0XHRcdGRvbUJ1aWxkZXIuY29tbWVudChzb3VyY2Usc3RhcnQrNCxlbmQtc3RhcnQtNCk7XHJcblx0XHRcdFx0cmV0dXJuIGVuZCszO1xyXG5cdFx0XHR9ZWxzZXtcclxuXHRcdFx0XHRlcnJvckhhbmRsZXIuZXJyb3IoXCJVbmNsb3NlZCBjb21tZW50XCIpO1xyXG5cdFx0XHRcdHJldHVybiAtMTtcclxuXHRcdFx0fVxyXG5cdFx0fWVsc2V7XHJcblx0XHRcdC8vZXJyb3JcclxuXHRcdFx0cmV0dXJuIC0xO1xyXG5cdFx0fVxyXG5cdGRlZmF1bHQ6XHJcblx0XHRpZihzb3VyY2Uuc3Vic3RyKHN0YXJ0KzMsNikgPT0gJ0NEQVRBWycpe1xyXG5cdFx0XHR2YXIgZW5kID0gc291cmNlLmluZGV4T2YoJ11dPicsc3RhcnQrOSk7XHJcblx0XHRcdGRvbUJ1aWxkZXIuc3RhcnRDREFUQSgpO1xyXG5cdFx0XHRkb21CdWlsZGVyLmNoYXJhY3RlcnMoc291cmNlLHN0YXJ0KzksZW5kLXN0YXJ0LTkpO1xyXG5cdFx0XHRkb21CdWlsZGVyLmVuZENEQVRBKCkgXHJcblx0XHRcdHJldHVybiBlbmQrMztcclxuXHRcdH1cclxuXHRcdC8vPCFET0NUWVBFXHJcblx0XHQvL3N0YXJ0RFREKGphdmEubGFuZy5TdHJpbmcgbmFtZSwgamF2YS5sYW5nLlN0cmluZyBwdWJsaWNJZCwgamF2YS5sYW5nLlN0cmluZyBzeXN0ZW1JZCkgXHJcblx0XHR2YXIgbWF0Y2hzID0gc3BsaXQoc291cmNlLHN0YXJ0KTtcclxuXHRcdHZhciBsZW4gPSBtYXRjaHMubGVuZ3RoO1xyXG5cdFx0aWYobGVuPjEgJiYgLyFkb2N0eXBlL2kudGVzdChtYXRjaHNbMF1bMF0pKXtcclxuXHRcdFx0dmFyIG5hbWUgPSBtYXRjaHNbMV1bMF07XHJcblx0XHRcdHZhciBwdWJpZCA9IGxlbj4zICYmIC9ecHVibGljJC9pLnRlc3QobWF0Y2hzWzJdWzBdKSAmJiBtYXRjaHNbM11bMF1cclxuXHRcdFx0dmFyIHN5c2lkID0gbGVuPjQgJiYgbWF0Y2hzWzRdWzBdO1xyXG5cdFx0XHR2YXIgbGFzdE1hdGNoID0gbWF0Y2hzW2xlbi0xXVxyXG5cdFx0XHRkb21CdWlsZGVyLnN0YXJ0RFREKG5hbWUscHViaWQgJiYgcHViaWQucmVwbGFjZSgvXihbJ1wiXSkoLio/KVxcMSQvLCckMicpLFxyXG5cdFx0XHRcdFx0c3lzaWQgJiYgc3lzaWQucmVwbGFjZSgvXihbJ1wiXSkoLio/KVxcMSQvLCckMicpKTtcclxuXHRcdFx0ZG9tQnVpbGRlci5lbmREVEQoKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBsYXN0TWF0Y2guaW5kZXgrbGFzdE1hdGNoWzBdLmxlbmd0aFxyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gLTE7XHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gcGFyc2VJbnN0cnVjdGlvbihzb3VyY2Usc3RhcnQsZG9tQnVpbGRlcil7XHJcblx0dmFyIGVuZCA9IHNvdXJjZS5pbmRleE9mKCc/Picsc3RhcnQpO1xyXG5cdGlmKGVuZCl7XHJcblx0XHR2YXIgbWF0Y2ggPSBzb3VyY2Uuc3Vic3RyaW5nKHN0YXJ0LGVuZCkubWF0Y2goL148XFw/KFxcUyopXFxzKihbXFxzXFxTXSo/KVxccyokLyk7XHJcblx0XHRpZihtYXRjaCl7XHJcblx0XHRcdHZhciBsZW4gPSBtYXRjaFswXS5sZW5ndGg7XHJcblx0XHRcdGRvbUJ1aWxkZXIucHJvY2Vzc2luZ0luc3RydWN0aW9uKG1hdGNoWzFdLCBtYXRjaFsyXSkgO1xyXG5cdFx0XHRyZXR1cm4gZW5kKzI7XHJcblx0XHR9ZWxzZXsvL2Vycm9yXHJcblx0XHRcdHJldHVybiAtMTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIC0xO1xyXG59XHJcblxyXG4vKipcclxuICogQHBhcmFtIHNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gRWxlbWVudEF0dHJpYnV0ZXMoc291cmNlKXtcclxuXHRcclxufVxyXG5FbGVtZW50QXR0cmlidXRlcy5wcm90b3R5cGUgPSB7XHJcblx0c2V0VGFnTmFtZTpmdW5jdGlvbih0YWdOYW1lKXtcclxuXHRcdGlmKCF0YWdOYW1lUGF0dGVybi50ZXN0KHRhZ05hbWUpKXtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHRhZ05hbWU6Jyt0YWdOYW1lKVxyXG5cdFx0fVxyXG5cdFx0dGhpcy50YWdOYW1lID0gdGFnTmFtZVxyXG5cdH0sXHJcblx0YWRkOmZ1bmN0aW9uKHFOYW1lLHZhbHVlLG9mZnNldCl7XHJcblx0XHRpZighdGFnTmFtZVBhdHRlcm4udGVzdChxTmFtZSkpe1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgYXR0cmlidXRlOicrcU5hbWUpXHJcblx0XHR9XHJcblx0XHR0aGlzW3RoaXMubGVuZ3RoKytdID0ge3FOYW1lOnFOYW1lLHZhbHVlOnZhbHVlLG9mZnNldDpvZmZzZXR9XHJcblx0fSxcclxuXHRsZW5ndGg6MCxcclxuXHRnZXRMb2NhbE5hbWU6ZnVuY3Rpb24oaSl7cmV0dXJuIHRoaXNbaV0ubG9jYWxOYW1lfSxcclxuXHRnZXRPZmZzZXQ6ZnVuY3Rpb24oaSl7cmV0dXJuIHRoaXNbaV0ub2Zmc2V0fSxcclxuXHRnZXRRTmFtZTpmdW5jdGlvbihpKXtyZXR1cm4gdGhpc1tpXS5xTmFtZX0sXHJcblx0Z2V0VVJJOmZ1bmN0aW9uKGkpe3JldHVybiB0aGlzW2ldLnVyaX0sXHJcblx0Z2V0VmFsdWU6ZnVuY3Rpb24oaSl7cmV0dXJuIHRoaXNbaV0udmFsdWV9XHJcbi8vXHQsZ2V0SW5kZXg6ZnVuY3Rpb24odXJpLCBsb2NhbE5hbWUpKXtcclxuLy9cdFx0aWYobG9jYWxOYW1lKXtcclxuLy9cdFx0XHRcclxuLy9cdFx0fWVsc2V7XHJcbi8vXHRcdFx0dmFyIHFOYW1lID0gdXJpXHJcbi8vXHRcdH1cclxuLy9cdH0sXHJcbi8vXHRnZXRWYWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmdldFZhbHVlKHRoaXMuZ2V0SW5kZXguYXBwbHkodGhpcyxhcmd1bWVudHMpKX0sXHJcbi8vXHRnZXRUeXBlOmZ1bmN0aW9uKHVyaSxsb2NhbE5hbWUpe31cclxuLy9cdGdldFR5cGU6ZnVuY3Rpb24oaSl7fSxcclxufVxyXG5cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gX3NldF9wcm90b18odGhpeixwYXJlbnQpe1xyXG5cdHRoaXouX19wcm90b19fID0gcGFyZW50O1xyXG5cdHJldHVybiB0aGl6O1xyXG59XHJcbmlmKCEoX3NldF9wcm90b18oe30sX3NldF9wcm90b18ucHJvdG90eXBlKSBpbnN0YW5jZW9mIF9zZXRfcHJvdG9fKSl7XHJcblx0X3NldF9wcm90b18gPSBmdW5jdGlvbih0aGl6LHBhcmVudCl7XHJcblx0XHRmdW5jdGlvbiBwKCl7fTtcclxuXHRcdHAucHJvdG90eXBlID0gcGFyZW50O1xyXG5cdFx0cCA9IG5ldyBwKCk7XHJcblx0XHRmb3IocGFyZW50IGluIHRoaXope1xyXG5cdFx0XHRwW3BhcmVudF0gPSB0aGl6W3BhcmVudF07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gcDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNwbGl0KHNvdXJjZSxzdGFydCl7XHJcblx0dmFyIG1hdGNoO1xyXG5cdHZhciBidWYgPSBbXTtcclxuXHR2YXIgcmVnID0gLydbXiddKyd8XCJbXlwiXStcInxbXlxcczw+XFwvPV0rPT98KFxcLz9cXHMqPnw8KS9nO1xyXG5cdHJlZy5sYXN0SW5kZXggPSBzdGFydDtcclxuXHRyZWcuZXhlYyhzb3VyY2UpOy8vc2tpcCA8XHJcblx0d2hpbGUobWF0Y2ggPSByZWcuZXhlYyhzb3VyY2UpKXtcclxuXHRcdGJ1Zi5wdXNoKG1hdGNoKTtcclxuXHRcdGlmKG1hdGNoWzFdKXJldHVybiBidWY7XHJcblx0fVxyXG59XHJcblxyXG5pZih0eXBlb2YgcmVxdWlyZSA9PSAnZnVuY3Rpb24nKXtcclxuXHRleHBvcnRzLlhNTFJlYWRlciA9IFhNTFJlYWRlcjtcclxufVxyXG5cclxuIiwidmFyXG4gIG1lcmdlID0gcmVxdWlyZSgnZGVlcG1lcmdlJyksXG4gIHhtbGRvbSA9IHJlcXVpcmUoJ3htbGRvbScpLFxuICBud21hdGNoZXIgPSByZXF1aXJlKCdud21hdGNoZXInKTtcbiAgXG5pZiAoIXByb2Nlc3MuYnJvd3Nlcikge1xuICAvLyBFeHRlbmQgeG1sZG9tXG4gIHZhciBEb2N1bWVudCA9IChuZXcgeG1sZG9tLkRPTUltcGxlbWVudGF0aW9uKCkpLmNyZWF0ZURvY3VtZW50KCkuY29uc3RydWN0b3I7XG4gIERvY3VtZW50LnByb3RvdHlwZS5xdWVyeVNlbGVjdG9yQWxsID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICB2YXIgbncgPSBud21hdGNoZXIoe2RvY3VtZW50OiB0aGlzfSk7XG4gICAgcmV0dXJuIG53LnNlbGVjdCggc2VsZWN0b3IsIHRoaXMuZG9jdW1lbnRFbGVtZW50ICk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2UoeG1sZG9tLCB7XG4gIERvY3VtZW50OiBEb2N1bWVudFxufSk7IiwidmFyXG4gIFhDU1NNYXRyaXggPSByZXF1aXJlKCd4Y3NzbWF0cml4Jyk7XG5cbi8vIFBhcnRpYWwgaW1wbGVtZW50YXRpb25cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9TVkdTVkdFbGVtZW50XG5cblxuXG5cbmZ1bmN0aW9uIFNWR01hdHJpeCgpIHtcbiAgdGhpcy5hID0gdGhpcy5kID0gMTtcbiAgdGhpcy5iID0gdGhpcy5jID0gdGhpcy5lID0gdGhpcy5mID0gMDtcbn1cblxuLy9TVkdNYXRyaXgucHJvdG90eXBlID0gbmV3IFhDU1NNYXRyaXgoKTtcbi8qXG5nZXQgYSgpeyByZXR1cm4gdGhpcy5tMTE7IH0sXG5cbiAgZ2V0IGIoKXsgcmV0dXJuIHRoaXMubTIxOyB9LFxuXG4gIGdldCBjKCl7IHJldHVybiB0aGlzLm0xMjsgfSxcblxuICBnZXQgZCgpeyByZXR1cm4gdGhpcy5tMjI7IH0sXG5cbiAgZ2V0IGUoKXsgcmV0dXJuIHRoaXMubTEzOyB9LFxuXG4gIGdldCBmKCl7IHJldHVybiB0aGlzLm0yMzsgfSxcbiovXG5cbi8qXG50cmFuc2Zvcm06IGZ1bmN0aW9uKGEyLCBiMiwgYzIsIGQyLCBlMiwgZjIpIHtcblxuICAgIHZhciBtZSA9IHRoaXMsXG4gICAgICBhMSA9IG1lLmEsXG4gICAgICBiMSA9IG1lLmIsXG4gICAgICBjMSA9IG1lLmMsXG4gICAgICBkMSA9IG1lLmQsXG4gICAgICBlMSA9IG1lLmUsXG4gICAgICBmMSA9IG1lLmY7XG5cbiAgICBtZS5hID0gYTEgKiBhMiArIGMxICogYjI7XG4gICAgbWUuYiA9IGIxICogYTIgKyBkMSAqIGIyO1xuICAgIG1lLmMgPSBhMSAqIGMyICsgYzEgKiBkMjtcbiAgICBtZS5kID0gYjEgKiBjMiArIGQxICogZDI7XG4gICAgbWUuZSA9IGExICogZTIgKyBjMSAqIGYyICsgZTE7XG4gICAgbWUuZiA9IGIxICogZTIgKyBkMSAqIGYyICsgZjE7XG5cbiAgICByZXR1cm4gbWUuX3goKVxuICB9XG4gICovXG4gIFxuLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8yNzIwNTAxOC9tdWx0aXBseS0yLW1hdHJpY2VzLWluLWphdmFzY3JpcHRcblNWR01hdHJpeC5wcm90b3R5cGUubXVsdGlwbHkgPSBmdW5jdGlvbihtYXRyaXgpIHtcbiAgdmFyXG4gICAgX3RoaXMgPSB0aGlzO1xuICBcbiAgdmFyIGEgPSB0aGlzO1xuICB2YXIgYiA9IG1hdHJpeDtcbiAvKlxuICBhLmEgPSBhLmEqYi5hICsgYS5jKmIuYiArIGEuZTtcbiAgYS5iID0gYS5iKmIuYSArIGEuZCpiLmIgKyBhLmY7XG4gIGEuYyA9IGEuYSpiLmMgKyBhLmMqYi5kICsgYS5lO1xuICBhLmQgPSBhLmIqYi5jICsgYS5kKmIuZCArIGEuZjtcbiAgYS5lID0gYS5hKmIuZSArIGEuYypiLmYgKyBhLmU7XG4gIGEuZiA9IGEuYipiLmUgKyBhLmQqYi5mICsgYS5mO1xuICAqL1xuICBhLmEgPSB0aGlzLmEgKiBtYXRyaXguYSArIHRoaXMuYyAqIG1hdHJpeC5iO1xuICBhLmIgPSB0aGlzLmIgKiBtYXRyaXguYSArIHRoaXMuZCAqIG1hdHJpeC5iO1xuICBhLmMgPSB0aGlzLmEgKiBtYXRyaXguYyArIHRoaXMuYyAqIG1hdHJpeC5kO1xuICBhLmQgPSB0aGlzLmIgKiBtYXRyaXguYyArIHRoaXMuZCAqIG1hdHJpeC5kO1xuICBhLmUgPSB0aGlzLmEgKiBtYXRyaXguZSArIHRoaXMuYyAqIG1hdHJpeC5mICsgdGhpcy5lO1xuICBhLmYgPSB0aGlzLmIgKiBtYXRyaXguZSArIHRoaXMuZCAqIG1hdHJpeC5mICsgdGhpcy5mO1xuICByZXR1cm4gdGhpcztcbn07XG4vKlxuXG5bJ20xMScsICdhJ10sXG4gICAgWydtMTInLCAnYiddLFxuICAgIFsnbTIxJywgJ2MnXSxcbiAgICBbJ20yMicsICdkJ10sXG4gICAgWydtNDEnLCAnZSddLFxuICAgIFsnbTQyJywgJ2YnXVxuKi9cblNWR01hdHJpeC5wcm90b3R5cGUudHJhbnNsYXRlID0gZnVuY3Rpb24oeCwgeSkge1xuICB4ID0gcGFyc2VGbG9hdCh4KTtcbiAgeSA9IHBhcnNlRmxvYXQoeSk7XG4gIHZhciBtID0gbmV3IFNWR01hdHJpeCgpO1xuICBtLmUgPSB4O1xuICBtLmYgPSB5O1xuICAvKnZhciBtID0gY2xvbmUodGhpcyk7XG4gIG0uZSA9IG0uYSAqIHggKyBtLmIgKiB5ICsgbS5lO1xuICBtLmYgPSBtLmMgKiB4ICsgbS5kICogeSArIG0uZjsqL1xuICByZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbn07XG5cblNWR01hdHJpeC5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbihzY2FsZSkge1xuICByZXR1cm4gdGhpcy5zY2FsZU5vblVuaWZvcm0oc2NhbGUsIHNjYWxlKTtcbn07XG5cblNWR01hdHJpeC5wcm90b3R5cGUuc2NhbGVOb25Vbmlmb3JtID0gZnVuY3Rpb24oc2NhbGVYLCBzY2FsZVkpIHtcbiAgc2NhbGVYID0gcGFyc2VGbG9hdChzY2FsZVgpO1xuICBzY2FsZVkgPSBwYXJzZUZsb2F0KHNjYWxlWSkgfHwgcGFyc2VGbG9hdChzY2FsZVgpO1xuICB0aGlzLmEgKj0gc2NhbGVYO1xuICB0aGlzLmMgKj0gc2NhbGVZO1xuICB0aGlzLmIgKj0gc2NhbGVYO1xuICB0aGlzLmQgKj0gc2NhbGVZO1xuICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uIGNsb25lKG1hdHJpeCkge1xuICB2YXIgbWF0cml4ID0gbmV3IFNWR01hdHJpeCgpO1xuICBmb3IgKHZhciBwcm9wIGluIG1hdHJpeCkge1xuICAgIGlmICh0eXBlb2YgbWF0cml4W3Byb3BdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBtYXRyaXhbcHJvcF0gPSBtYXRyaXhbcHJvcF07XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXRyaXg7XG59XG5cblNWR01hdHJpeC5wcm90b3R5cGUuc2tld1ggPSBmdW5jdGlvbihhbmdsZSkge1xuICB2YXIgbSA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgbS5jID0gTWF0aC50YW4oIHBhcnNlRmxvYXQoYW5nbGUpICogTWF0aC5QSSAvIDE4MCApO1xuICByZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbn07XG5cblNWR01hdHJpeC5wcm90b3R5cGUuc2tld1kgPSBmdW5jdGlvbihhbmdsZSkge1xuICB2YXIgbSA9IG5ldyBTVkdNYXRyaXgoKTtcbiAgbS5iID0gTWF0aC50YW4oIHBhcnNlRmxvYXQoYW5nbGUpICogTWF0aC5QSSAvIDE4MCApO1xuICByZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbn07XG5cblNWR01hdHJpeC5wcm90b3R5cGUucm90YXRlID0gZnVuY3Rpb24oYW5nbGUpIHtcbiAgdmFyIGNvcyA9IE1hdGguY29zKGFuZ2xlICogTWF0aC5QSSAvIDE4MCksXG4gICAgc2luID0gTWF0aC5zaW4oYW5nbGUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgdmFyIG0gPSB0aGlzO1xuICBtLmEgPSBjb3M7XG4gIG0uYiA9IHNpbjtcbiAgbS5jID0gLXNpbjtcbiAgbS5kID0gY29zO1xuICBtLmUgPSAwO1xuICBtLmYgPSAwO1xuICByZXR1cm4gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tdWx0aXBseShtKTtcbiAgICBcbiAgICBcbiAgICBcbiAgICBcbiAgLypcbiAgdmFyIGMwID0gTWF0aC5jb3MoMCAqIE1hdGguUEkgLyAxODApLCBcbiAgICBzMCA9IE1hdGguc2luKDAgKiBNYXRoLlBJIC8gMTgwKTtcbiAgXG4gIHZhciBjID0gTWF0aC5jb3MoYW5nbGUgKiBNYXRoLlBJIC8gMTgwKSwgXG4gICAgcyA9IE1hdGguc2luKGFuZ2xlICogTWF0aC5QSSAvIDE4MCksXG4gICAgbSA9IHRoaXM7XG4gICAgLy9tID0gdGhpcztcbiAgICBcbiAgICBtLmEgPSBjMCAqIHRoaXMuYSAtIHMwICogdGhpcy5lO1xuICAgIG0uYiA9IGMwICogdGhpcy5iIC0gczAgKiB0aGlzLmY7XG4gICAgXG4gICAgbS5jID0gYyAqIHRoaXMuYyArIHMgKiB0aGlzLmU7XG4gICAgbS5kID0gYyAqIHRoaXMuZCArIHMgKiB0aGlzLmY7XG5cbiAgICBtLmUgPSBjICogdGhpcy5lIC0gcyAqIHRoaXMuYztcbiAgICBtLmYgPSBjICogdGhpcy5mIC0gcyAqIHRoaXMuZDtcblxuICAgIC8vcmV0dXJuIHRoaXMubXVsdGlwbHkobSk7XG4gICAgXG4gICAgcmV0dXJuIHRoaXM7XG4gICAgKi9cbiAgIC8qXG4gICB2YXIgZGVnID0gYW5nbGU7XG4gICAgdmFyIHJhZCA9IHBhcnNlRmxvYXQoZGVnKSAqIChNYXRoLlBJLzE4MCksXG4gICAgICAgIGNvc3RoZXRhID0gTWF0aC5jb3MocmFkKSxcbiAgICAgICAgc2ludGhldGEgPSBNYXRoLnNpbihyYWQpO1xuICBcbiAgICB2YXJcbiAgICAgIG0gPSBuZXcgU1ZHTWF0cml4KCk7XG4gICAgICBcbiAgICAgbS5hID0gY29zdGhldGEsXG4gICAgIG0uYiA9IHNpbnRoZXRhLFxuICAgICBtLmMgPSAtc2ludGhldGEsXG4gICAgIG0uZCA9IGNvc3RoZXRhO1xuKi9cblxuICB2YXJcbiAgIHJ4ID0gcGFyc2VGbG9hdChhbmdsZSkgKiAoTWF0aC5QSS8xODApLFxuICAgbSA9IG5ldyBTVkdNYXRyaXgoKSxcbiAgICAgICAgc2luQSwgY29zQSwgc3E7XG5cbiAgICByeCAvPSAyO1xuICAgIHNpbkEgID0gTWF0aC5zaW4ocngpO1xuICAgIGNvc0EgID0gTWF0aC5jb3MocngpO1xuICAgIHNxID0gc2luQSAqIHNpbkE7XG5cbiAgICAvLyBNYXRyaWNlcyBhcmUgaWRlbnRpdHkgb3V0c2lkZSB0aGUgYXNzaWduZWQgdmFsdWVzXG4gICAgbS5hID0gbS5kID0gMSAtIDIgKiBzcTtcbiAgICBtLmIgPSBtLmMgPSAyICogc2luQSAqIGNvc0E7XG4gICAgbS5jICo9IC0xO1xuICAgIFxuICAgIC8vcmV0dXJuIHRoaXM7XG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHkobSk7XG4gIH0sXG5cblxuU1ZHTWF0cml4LnBhcnNlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICB2YXJcbiAgICBzdGF0ZW1lbnRzID0gWydtYXRyaXgnLCAncm90YXRlJywgJ3NrZXdYJywgJ3NrZXdZJywgJ3NjYWxlJywgJ3RyYW5zbGF0ZSddLFxuICAgIHRyYW5zZm9ybXMgPSB7fSxcbiAgICB0ID0gbnVsbCxcbiAgICBtYXRyaXggPSBuZXcgU1ZHTWF0cml4KCksXG4gICAgcmUgPSAvKFxcdyspXFxzKlxcKFxccyooW15cXCldKilcXHMqXFwpL2csXG4gICAgbSwgc3QsIGFyZ3MsIHAgPSBTVkdNYXRyaXgucHJvdG90eXBlLCBtZXRob2Q7XG4gIHdoaWxlIChtID0gcmUuZXhlYyhzdHJpbmcpKSB7XG4gICAgaWYgKG0pIHtcbiAgICAgIHN0ID0gbVsxXTtcbiAgICAgIGFyZ3MgPSBtWzJdLnNwbGl0KC8sfFxccysvKTtcbiAgICAgIGlmIChzdGF0ZW1lbnRzLmluZGV4T2Yoc3QpID49IDApIHtcbiAgICAgICAgY29uc29sZS5pbmZvKCd2YWxpZCcpO1xuICAgICAgICB0cmFuc2Zvcm1zW3N0XSA9IHtcbiAgICAgICAgICBhcmdzOiBhcmdzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHN0YXRlbWVudHMuZmlsdGVyKGZ1bmN0aW9uKHN0KSB7XG4gICAgcmV0dXJuIHRyYW5zZm9ybXNbc3RdO1xuICB9KS5mb3JFYWNoKGZ1bmN0aW9uKHN0KSB7XG4gICAgbWV0aG9kID0gc3QgPT09ICdzY2FsZScgPyAnc2NhbGVOb25Vbmlmb3JtJyA6IHN0O1xuICAgIG1hdHJpeCA9IHBbbWV0aG9kXS5hcHBseShtYXRyaXgsIHRyYW5zZm9ybXNbc3RdLmFyZ3MpO1xuICB9KTtcbiAgXG4gIHJldHVybiBtYXRyaXg7XG59O1xuXG5cblxuZnVuY3Rpb24gU1ZHUG9pbnQoeCwgeSkge1xuICB0aGlzLnggPSBwYXJzZUZsb2F0KHgpO1xuICB0aGlzLnkgPSBwYXJzZUZsb2F0KHkpO1xufVxuXG5TVkdQb2ludC5wcm90b3R5cGUubWF0cml4VHJhbnNmb3JtID0gZnVuY3Rpb24obWF0cml4KSB7XG4gIGNvbnNvbGUubG9nKFwidHJhbnNmb3JtIHBvaW50OiBcIiwgbWF0cml4LmUsIG1hdHJpeC5mKTtcbiAgdmFyIHB4ID0gdGhpcy54ICogbWF0cml4LmEgKyB0aGlzLnkgKiBtYXRyaXguYyArIG1hdHJpeC5lO1xuICB2YXIgcHkgPSB0aGlzLnggKiBtYXRyaXguYiArIHRoaXMueSAqIG1hdHJpeC5kICsgbWF0cml4LmY7XG4gIHJldHVybiBuZXcgU1ZHUG9pbnQocHgsIHB5KTtcbn07XG5cblxuZnVuY3Rpb24gU1ZHUmVjdCh4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG4gIHRoaXMueCA9IHBhcnNlRmxvYXQoeCk7XG4gIHRoaXMueSA9IHBhcnNlRmxvYXQoeSk7XG4gIHRoaXMud2lkdGggPSBwYXJzZUZsb2F0KHdpZHRoKTtcbiAgdGhpcy5oZWlnaHQgPSBwYXJzZUZsb2F0KGhlaWdodCk7XG59XG5cbmZ1bmN0aW9uIFNWR1NWR0VsZW1lbnQoKSB7XG4gIFxufVxuXG5TVkdTVkdFbGVtZW50LnByb3RvdHlwZS5jcmVhdGVTVkdNYXRyaXggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBTVkdNYXRyaXgoKTtcbn07XG5cblNWR1NWR0VsZW1lbnQucHJvdG90eXBlLmNyZWF0ZVNWR1BvaW50ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgU1ZHUG9pbnQoMCwgMCk7XG59O1xuXG5cblxuXG5cblNWR1NWR0VsZW1lbnQucHJvdG90eXBlLmdldEJCb3ggPSAoZnVuY3Rpb24oKSB7XG4gIFxuICB2YXIgY3VycmVudFRleHRQb3NpdGlvbiA9IG51bGw7XG4gIFxuICBmdW5jdGlvbiBnZXRQb2ludHMobm9kZSkge1xuICAgIFxuICAgIHZhciBwb2ludHMgPSBbXTtcbiAgICBcbiAgICAvLyBTaGFwZXNcbiAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ2xpbmUnKSB7XG4gICAgICB2YXIgeDEgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCd4MScpKTtcbiAgICAgIHZhciB5MSA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3kxJykpO1xuICAgICAgdmFyIHgyID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgneDInKSk7XG4gICAgICB2YXIgeTIgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCd5MicpKTtcbiAgICAgIHBvaW50cy5wdXNoKG5ldyBTVkdQb2ludCh4MSwgeTEpLCBuZXcgU1ZHUG9pbnQoeDIsIHkyKSk7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdyZWN0Jykge1xuICAgICAgdmFyIHgxID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgneCcpKTtcbiAgICAgIHZhciB5MSA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3knKSk7XG4gICAgICB2YXIgeDIgPSB4MSArIHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ3dpZHRoJykpO1xuICAgICAgdmFyIHkyID0geTEgKyBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCdoZWlnaHQnKSk7XG4gICAgICBwb2ludHMucHVzaChuZXcgU1ZHUG9pbnQoeDEsIHkxKSwgbmV3IFNWR1BvaW50KHgyLCB5MSksIG5ldyBTVkdQb2ludCh4MiwgeTIpLCBuZXcgU1ZHUG9pbnQoeDEsIHkyKSk7XG4gICAgfVxuICAgIFxuICAgIGlmIChub2RlLm5vZGVOYW1lID09PSAnY2lyY2xlJykge1xuICAgICAgdmFyIGN4ID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgnY3gnKSk7XG4gICAgICB2YXIgY3kgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCdjeScpKTtcbiAgICAgIHZhciByID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgncicpKTtcbiAgICAgIHZhciBsID0gTWF0aC5mbG9vcihNYXRoLlBJICogMiAqIHIpO1xuICAgICAgdmFyIHQgPSBNYXRoLlBJICogMiAvIHI7XG4gICAgICBwb2ludHMgPSBwb2ludHMuY29uY2F0KEFycmF5LmFwcGx5KG51bGwsIEFycmF5KGwpKS5tYXAoZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBhID0gdCAqIGluZGV4O1xuICAgICAgICB2YXIgeCA9IGN4ICsgTWF0aC5jb3MoYSkgKiByO1xuICAgICAgICB2YXIgeSA9IGN5ICsgTWF0aC5zaW4oYSkgKiByO1xuICAgICAgICByZXR1cm4gbmV3IFNWR1BvaW50KHgsIHkpO1xuICAgICAgfSkpO1xuICAgICAgcG9pbnRzLnB1c2gobmV3IFNWR1BvaW50KGN4LCBjeSAtIHIpLCBuZXcgU1ZHUG9pbnQoY3ggKyByLCBjeSksIG5ldyBTVkdQb2ludChjeCwgY3kgKyByKSwgbmV3IFNWR1BvaW50KGN4IC0gciwgY3kpKTtcbiAgICB9XG5cbiAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ2VsbGlwc2UnKSB7XG4gICAgICB2YXIgY3ggPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCdjeCcpKTtcbiAgICAgIHZhciBjeSA9IHBhcnNlRmxvYXQobm9kZS5nZXRBdHRyaWJ1dGUoJ2N5JykpO1xuICAgICAgdmFyIHJ4ID0gcGFyc2VGbG9hdChub2RlLmdldEF0dHJpYnV0ZSgncngnKSk7XG4gICAgICB2YXIgcnkgPSBwYXJzZUZsb2F0KG5vZGUuZ2V0QXR0cmlidXRlKCdyeScpKTtcbiAgICAgIHZhciBsID0gTWF0aC5mbG9vcihNYXRoLlBJICogMiAqIE1hdGguc3FydCgocnggKiByeCkgKyAocnkgKyByeSkpKTtcbiAgICAgIHZhciB0ID0gTWF0aC5QSSAqIDIgLyBsO1xuICAgICAgcG9pbnRzID0gcG9pbnRzLmNvbmNhdChBcnJheS5hcHBseShudWxsLCBBcnJheShsKSkubWFwKGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICB2YXIgYSA9IHQgKiBpbmRleDtcbiAgICAgICAgdmFyIHggPSBjeCArIE1hdGguY29zKGEpICogcng7XG4gICAgICAgIHZhciB5ID0gY3kgKyBNYXRoLnNpbihhKSAqIHJ5O1xuICAgICAgICByZXR1cm4gbmV3IFNWR1BvaW50KHgsIHkpO1xuICAgICAgfSkpO1xuICAgIH1cbiAgICBcbiAgICBpZiAobm9kZS5ub2RlTmFtZSA9PT0gJ3RleHQnKSB7XG4gICAgICBjdXJyZW50VGV4dFBvc2l0aW9uID0gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDMgJiYgbm9kZS5kYXRhLnRyaW0oKSkge1xuICAgICAgY29uc29sZS5sb2coXCJmb3VuZCB0ZXh0IG5vZGU6IFwiLCBub2RlKTtcbiAgICAgIHZhciBlbGVtLCB4ID0gTmFOLCB5ID0gTmFOLCBkeCA9IE5hTiwgZHkgPSBOYU47XG4gICAgICBcbiAgICAgIC8vIEdldCBhYnNvbHV0ZSBwb3NpdGlvblxuICAgICAgZWxlbSA9IG5vZGU7XG4gICAgICB3aGlsZSAoKGVsZW0gPSBlbGVtLnBhcmVudE5vZGUpICYmIChlbGVtLm5vZGVOYW1lID09PSAndGV4dCcgfHwgZWxlbS5ub2RlTmFtZSA9PT0gJ3RzcGFuJykgJiYgKGlzTmFOKHgpIHx8IGlzTmFOKHkpKSkge1xuICAgICAgICBpZiAoZWxlbS5ub2RlTmFtZSA9PT0gJ3RleHQnICYmIGN1cnJlbnRUZXh0UG9zaXRpb24pIHtcbiAgICAgICAgICBpZiAoaXNOYU4oeCkpIHtcbiAgICAgICAgICAgIHggPSBjdXJyZW50VGV4dFBvc2l0aW9uLng7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpc05hTih5KSkge1xuICAgICAgICAgICAgeSA9IGN1cnJlbnRUZXh0UG9zaXRpb24ueTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgeCA9IGlzTmFOKHgpID8gcGFyc2VGbG9hdChlbGVtLmdldEF0dHJpYnV0ZSgneCcpKSA6IHg7XG4gICAgICAgIHkgPSBpc05hTih5KSA/IHBhcnNlRmxvYXQoZWxlbS5nZXRBdHRyaWJ1dGUoJ3knKSkgOiB5O1xuICAgICAgfVxuICAgICAgeCA9IGlzTmFOKHgpID8gMCA6IHg7XG4gICAgICB5ID0gaXNOYU4oeSkgPyAwIDogeTtcbiAgICAgIFxuICAgICAgLy8gU2hpZnQgYnkgcmVsYXRpdmUgcG9zaXRpb25cbiAgICAgIGVsZW0gPSBub2RlO1xuICAgICAgd2hpbGUgKChlbGVtID0gZWxlbS5wYXJlbnROb2RlKSAmJiAoZWxlbS5ub2RlTmFtZSA9PT0gJ3RleHQnIHx8IGVsZW0ubm9kZU5hbWUgPT09ICd0c3BhbicpICYmIChpc05hTihkeCkgfHwgaXNOYU4oZHkpKSkge1xuICAgICAgICBkeCA9IGlzTmFOKGR4KSA/IHBhcnNlRmxvYXQoZWxlbS5nZXRBdHRyaWJ1dGUoJ2R4JykpIDogZHg7XG4gICAgICAgIGR5ID0gaXNOYU4oZHkpID8gcGFyc2VGbG9hdChlbGVtLmdldEF0dHJpYnV0ZSgnZHknKSkgOiBkeTtcbiAgICAgIH1cbiAgICAgIGR4ID0gaXNOYU4oZHgpID8gMCA6IGR4O1xuICAgICAgZHkgPSBpc05hTihkeSkgPyAwIDogZHk7XG4gICAgICBcbiAgICAgIHgrPSBkeDtcbiAgICAgIHkrPSBkeTtcbiAgICAgIFxuICAgICAgLy8gQ2FsY3VsYXRlIHRleHQgZGltZW5zaW9uc1xuICAgICAgdmFyIGVsZW0gPSBub2RlLnBhcmVudE5vZGU7XG4gICAgICB2YXIgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsZW0pO1xuICAgICAgdmFyIGZvbnRTaXplID0gcGFyc2VGbG9hdChzdHlsZS5mb250U2l6ZSk7XG4gICAgICB2YXIgdyA9IGVsZW0uZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICB2YXIgaCA9IGZvbnRTaXplO1xuXG4gICAgICAvLyBBZGQgYm91bmRpbmcgcG9pbnRzXG4gICAgICBwb2ludHMucHVzaChuZXcgU1ZHUG9pbnQoeCwgeSksIG5ldyBTVkdQb2ludCh4ICsgdywgeSksIG5ldyBTVkdQb2ludCh4ICsgdywgeSAtIGgpLCBuZXcgU1ZHUG9pbnQoeCwgeSAtIGgpKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIGN1cnJlbnQgdGV4dCBwb3NpdGlvblxuICAgICAgY3VycmVudFRleHRQb3NpdGlvbiA9IG5ldyBTVkdQb2ludCh4ICsgdywgeSk7XG4gICAgfVxuICAgIFxuICAgIC8vIFByb2Nlc3MgY2hpbGRyZW5cbiAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gbm9kZS5jaGlsZE5vZGVzW2ldO1xuICAgICAgICB2YXIgY2hpbGRQb2ludHMgPSBnZXRQb2ludHMoY2hpbGQpO1xuICAgICAgICB2YXIgbWF0cml4ID0gbnVsbDtcbiAgICAgICAgaWYgKGNoaWxkLm5vZGVUeXBlID09PSAxKSB7XG4gICAgICAgICAgaWYgKFsnZyddLmluZGV4T2YoY2hpbGQubm9kZU5hbWUpID49IDApIHtcbiAgICAgICAgICAgIC8vIEFwcGx5IHRyYW5zZm9ybWF0aW9uc1xuICAgICAgICAgICAgdmFyXG4gICAgICAgICAgICAgIHRyYW5zZm9ybSA9IGNoaWxkLmdldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgICAgICAgICAgIG1hdHJpeCA9IFNWR01hdHJpeC5wYXJzZSh0cmFuc2Zvcm0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwb2ludHMgPSBwb2ludHMuY29uY2F0KGNoaWxkUG9pbnRzLm1hcChmdW5jdGlvbihwb2ludCkge1xuICAgICAgICAgIHJldHVybiBtYXRyaXggJiYgcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeCkgfHwgcG9pbnQ7XG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gUmVzZXQgY3VycmVudCB0ZXh0IHBvc2l0aW9uXG4gICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICd0ZXh0Jykge1xuICAgICAgY3VycmVudFRleHRQb3NpdGlvbiA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBwb2ludHM7XG4gIH1cbiAgICAgICAgXG4gIHJldHVybiBmdW5jdGlvbiBnZXRCQm94KCkge1xuICAgIC8vIFRPRE86IFRocm93IGV4Y2VwdGlvbiB3aGVuIG5vdCBhZGRlZCB0byB2aWV3XG4gICAgXG4gICAgdmFyIGVsZW0gPSB0aGlzO1xuICAgIHZhciBwb2ludHMgPSBnZXRQb2ludHMoZWxlbSk7XG4gICAgICAgIFxuICAgIHZhciB4MSwgeTEsIHgyLCB5MjtcbiAgICBwb2ludHMuZm9yRWFjaChmdW5jdGlvbihwb2ludCkge1xuICAgICAgeDEgPSB0eXBlb2YgeDEgPT09ICd1bmRlZmluZWQnID8gcG9pbnQueCA6IE1hdGgubWluKHBvaW50LngsIHgxKTtcbiAgICAgIHkxID0gdHlwZW9mIHkxID09PSAndW5kZWZpbmVkJyA/IHBvaW50LnkgOiBNYXRoLm1pbihwb2ludC55LCB5MSk7XG4gICAgICB4MiA9IHR5cGVvZiB4MiA9PT0gJ3VuZGVmaW5lZCcgPyBwb2ludC54IDogTWF0aC5tYXgocG9pbnQueCwgeDIpO1xuICAgICAgeTIgPSB0eXBlb2YgeTIgPT09ICd1bmRlZmluZWQnID8gcG9pbnQueSA6IE1hdGgubWF4KHBvaW50LnksIHkyKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gbmV3IFNWR1JlY3QoXG4gICAgICB4MSB8fCAwLFxuICAgICAgeTEgfHwgMCxcbiAgICAgICh4MiAtIHgxKSB8fCAwLFxuICAgICAgKHkyIC0geTEpIHx8IDBcbiAgICApO1xuXG4gIH07XG4gIFxufSkoKTtcblxuU1ZHU1ZHRWxlbWVudC5wcm90b3R5cGUuZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gIGNvbnNvbGUubG9nKFwiZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKClcIiwgdGhpcyk7XG4gIHJldHVybiAwO1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ1NWR1NWR0VsZW1lbnQnOiBTVkdTVkdFbGVtZW50XG59O1xuIiwidmFyXG4gIG1lcmdlID0gcmVxdWlyZSgnZGVlcG1lcmdlJyksXG4gIC8vIEluaXQgRE9NIEltcGxlbWVudGF0aW9uXG4gIGRvbSA9IHByb2Nlc3MuYnJvd3NlciA/IHtcbiAgICBET01JbXBsZW1lbnRhdGlvbjogd2luZG93LkRPTUltcGxlbWVudGF0aW9uLFxuICAgIFhNTFNlcmlhbGl6ZXI6IHdpbmRvdy5YTUxTZXJpYWxpemVyLFxuICAgIERPTVBhcnNlcjogd2luZG93LkRPTVBhcnNlcixcbiAgICBEb2N1bWVudDogd2luZG93LkRvY3VtZW50XG4gIH0gOiByZXF1aXJlKCcuL2RvbScpLFxuICBcbiAgc3ZnID0gcmVxdWlyZSgnLi9zdmcnKTtcbiAgXG5cbm1vZHVsZS5leHBvcnRzID0gbWVyZ2UobWVyZ2UoZG9tLCBzdmcpLCB7XG4gIC8vIEFkZCBtb3JlIG1ldGhvZHMgaGVyZVxuICBcbn0pOyIsIi8qKlxuICogUm91bmRzIGEgbnVtYmVyIG9yIG51bWVyaWNhbCBtZW1iZXJzIG9mIGFuIG9iamVjdCB0byBwcmVjaXNpb25cbiAqLyBcbmZ1bmN0aW9uIHJvdW5kKG51bSwgZGlnaXRzKSB7XG4gIGRpZ2l0cyA9IHR5cGVvZiBkaWdpdHMgPT09ICdudW1iZXInID8gZGlnaXRzIDogMTtcbiAgaWYgKHR5cGVvZiBudW0gPT09ICdvYmplY3QnKSB7XG4gICAgLy8gT2JqZWN0XG4gICAgZm9yICh2YXIgeCBpbiBudW0pIHtcbiAgICAgIG51bVt4XSA9IHJvdW5kKG51bVt4XSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEFjdHVhbGx5IHJvdW5kIG51bWJlclxuICAgIHZhciB2YWx1ZSA9IHBhcnNlRmxvYXQobnVtKTtcbiAgICBpZiAoIWlzTmFOKHZhbHVlKSAmJiBuZXcgU3RyaW5nKHZhbHVlKS5sZW5ndGggPT09IG5ldyBTdHJpbmcobnVtKS5sZW5ndGgpIHtcbiAgICAgIHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZS50b0ZpeGVkKGRpZ2l0cykpO1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVtO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByb3VuZDsiLCJ2YXIgWFNTTWF0cml4ID0gcmVxdWlyZSgneGNzc21hdHJpeCcpO1xuXG5mdW5jdGlvbiBTVkdQb2ludCh4LCB5KSB7XG4gIHRoaXMueCA9IHg7XG4gIHRoaXMueSA9IHk7XG59XG5cblNWR1BvaW50LnByb3RvdHlwZS5tYXRyaXhUcmFuc2Zvcm0gPSBmdW5jdGlvbihtYXRyaXgpIHtcbiAgcmV0dXJuIG1hdHJpeC50cmFuc2Zvcm1WZWN0b3IodmVjdG9yKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU1ZHUG9pbnQ7XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKCdkZWVwbWVyZ2UnKTtcbi8vIERvbSBpbXBsZW1lbnRhdGlvblxuLyp2YXIgZG9tID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB7XG4gIERPTUltcGxlbWVudGF0aW9uOiB3aW5kb3cuRE9NSW1wbGVtZW50YXRpb24sXG4gIFhNTFNlcmlhbGl6ZXI6IHdpbmRvdy5YTUxTZXJpYWxpemVyLFxuICBET01QYXJzZXI6IHdpbmRvdy5ET01QYXJzZXJcbn0gOiByZXF1aXJlKCd4bWxkb20nKTtcbiovXG4vL3ZhciBpbXBsID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiByZXF1aXJlKCcuL2ltcGwvd2luZG93Jyk7XG52YXIgaW1wbCA9IHJlcXVpcmUoJy4vaW1wbC93aW5kb3cnKTtcbmNvbnNvbGUubG9nKFwiKioqIElNUExFTUVOVEFUSU9OOiBcIiwgaW1wbCk7XG5cbi8qXG4gKiBcbmNvbnNvbGUubG9nKFwiZG9tOiBcIiwgZG9tKTtcbnZhciBET01JbXBsZW1lbnRhdGlvbiA9IGRvbS5ET01JbXBsZW1lbnRhdGlvbjtcbnZhciBYTUxTZXJpYWxpemVyID0gZG9tLlhNTFNlcmlhbGl6ZXI7XG52YXIgRE9NUGFyc2VyID0gZG9tLkRPTVBhcnNlcjtcbiovXG52YXIgcm91bmQgPSByZXF1aXJlKCcuL2xpYi9yb3VuZCcpO1xuLy92YXIgaHlwaGVuYXRlID0gcmVxdWlyZSgnLi9saWIvaHlwaGVuYXRlJyk7XG52YXIgY3NzID0gcmVxdWlyZSgnY3NzJyk7XG52YXIgUyA9IHJlcXVpcmUoJ3N0cmluZycpO1xuLy92YXIgZm9udGtpdCA9IHJlcXVpcmUoJ2ZvbnRraXQnKTtcbi8vdmFyIGpzZG9tID0gcmVxdWlyZShcImpzZG9tXCIpO1xudmFyIFhDU1NNYXRyaXggPSByZXF1aXJlKCd4Y3NzbWF0cml4Jyk7XG52YXIgU1ZHUG9pbnQgPSByZXF1aXJlKCcuL2xpYi9zdmdwb2ludCcpO1xuXG5cbiAgdmFyIFxuICAgIFNWR19OQU1FU1BBQ0VfVVJJID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLFxuICAgIE1BVEggPSBNYXRoLFxuICAgIFBJID0gTUFUSC5QSSxcbiAgICBjb3MgPSBNQVRILmNvcyxcbiAgICBzaW4gPSBNQVRILnNpbixcbiAgICBzcXJ0ID0gTUFUSC5zcXJ0LFxuICAgIHBvdyA9IE1BVEgucG93LFxuICAgIGZsb29yID0gTUFUSC5mbG9vcixcbiAgICBmb250RmFjZSA9IHt9LFxuICAgIC8qKlxuICAgICAqIEdldHMgYSBwYWlyIG9mIGJlemllciBjb250cm9sIHBvaW50c1xuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0XG4gICAgICovXG4gICAgZ2V0Q29udHJvbFBvaW50cyA9IGZ1bmN0aW9uKCB4MCwgeTAsIHgxLCB5MSwgeDIsIHkyLCB0ICkge1xuICAgICAgdCA9IHR5cGVvZiB0ID09PSAnbnVtYmVyJyA/IHQgOiAwLjU7XG4gICAgICB2YXJcbiAgICAgICAgZDAxID0gc3FydCggcG93KCB4MSAtIHgwLCAyICkgKyBwb3coIHkxIC0geTAsIDIgKSApLFxuICAgICAgICBkMTIgPSBzcXJ0KCBwb3coIHgyIC0geDEsIDIgKSArIHBvdyggeTIgLSB5MSwgMiApICksXG4gICAgICAgIGZhID0gdCAqIGQwMSAvICggZDAxICsgZDEyICksICAgLy8gc2NhbGluZyBmYWN0b3IgZm9yIHRyaWFuZ2xlIFRhXG4gICAgICAgIGZiID0gdCAqIGQxMiAvICggZDAxICsgZDEyICksICAgLy8gZGl0dG8gZm9yIFRiLCBzaW1wbGlmaWVzIHRvIGZiPXQtZmFcbiAgICAgICAgcDF4ID0geDEgLSBmYSAqICggeDIgLSB4MCApLCAgICAvLyB4Mi14MCBpcyB0aGUgd2lkdGggb2YgdHJpYW5nbGUgVFxuICAgICAgICBwMXkgPSB5MSAtIGZhICogKCB5MiAtIHkwICksICAgIC8vIHkyLXkwIGlzIHRoZSBoZWlnaHQgb2YgVFxuICAgICAgICBwMnggPSB4MSArIGZiICogKCB4MiAtIHgwICksXG4gICAgICAgIHAyeSA9IHkxICsgZmIgKiAoIHkyIC0geTAgKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHAxOiB7eDogcDF4LCB5OiBwMXl9LCBcbiAgICAgICAgcDI6IHt4OiBwMngsIHk6IHAyeX1cbiAgICAgIH07XG4gICAgfSxcbiAgICAvKlxuICAgIGdldEZvbnQgPSBmdW5jdGlvbihmb250RmFtaWx5KSB7XG4gICAgICB2YXIgZm9udEZhbWlseSA9IGZvbnRGYW1pbHkgfHwgJ0FyaWFsJztcbiAgICAgIHZhciBmaWxlID0gJy9MaWJyYXJ5L0ZvbnRzLycgKyBmb250RmFtaWx5ICsgJy50dGYnO1xuICAgICAgLy8gb3BlbiBhIGZvbnQgc3luY2hyb25vdXNseSBcbiAgICAgIHZhciBmb250ID0gZm9udEZhY2VbZm9udEZhbWlseV0gPSBmb250RmFjZVtmb250RmFtaWx5XSB8fCBmb250a2l0Lm9wZW5TeW5jKGZpbGUpO1xuICAgICAgcmV0dXJuIGZvbnQ7XG4gICAgfSxcbiAgICAqL1xuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgY29tcHV0ZWQgdGV4dCBsZW5ndGggb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBpZiBhdmFpbGFibGUuXG4gICAgICovXG4gICAgY29tcHV0ZWRUZXh0TGVuZ3RoID0gZnVuY3Rpb24oZWxlbSwgc3R5bGUpIHtcbiAgICAgIHJldHVybiAxMDA7XG4gICAgICBlbGVtID0gX3YoZWxlbSk7XG4gICAgICBzdHlsZSA9IHN0eWxlIHx8IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW1bMF0pIHx8IGVsZW0uc3R5bGUoKTtcbiAgICAgIFxuICAgICAgaWYgKGVsZW0ubGVuZ3RoID4gMCkge1xuICAgICAgICB2YXIgbDtcbiAgICAgICAgdmFyIHRleHQgPSBlbGVtWzBdLmZpcnN0Q2hpbGQgJiYgZWxlbVswXS5maXJzdENoaWxkLmRhdGE7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXRleHQpIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGVsZW1bMF0uZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKSB7XG4gICAgICAgICAgbCA9IGVsZW1bMF0uZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICAgICAgcmV0dXJuIGw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBmb250ID0gZ2V0Rm9udChzdHlsZS5mb250RmFtaWx5KTtcbiAgICAgICAgdmFyIGZvbnRTaXplID0gcGFyc2VGbG9hdChzdHlsZS5mb250U2l6ZSkgfHwgMTY7XG4gICAgICAgIHZhciBmYWN0b3IgPSBmb250U2l6ZSAvIGZvbnQudW5pdHNQZXJFbTtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImFzY2VudDogXCIsIGZvbnQuZGVzY2VudCAqIGZhY3RvciwgKGZvbnQuYXNjZW50IC8gZm9udC51bml0c1BlckVtKSAqIGZvbnRTaXplKTtcbiAgICAgICAgLy8gbGF5b3V0IGEgc3RyaW5nLCB1c2luZyBkZWZhdWx0IHNoYXBpbmcgZmVhdHVyZXMuIFxuICAgICAgICAvLyByZXR1cm5zIGEgR2x5cGhSdW4sIGRlc2NyaWJpbmcgZ2x5cGhzIGFuZCBwb3NpdGlvbnMuIFxuICAgICAgICB2YXIgcnVuID0gZm9udC5sYXlvdXQodGV4dCk7XG4gICAgICAgIC8vIGdldCBhbiBTVkcgcGF0aCBmb3IgYSBnbHlwaCBcbiAgICAgICAgdmFyIHBhdGggPSBydW4uZ2x5cGhzWzBdLnBhdGg7XG4gICAgICAgIHZhciB3aWR0aCA9IHJ1bi5nbHlwaHMubWFwKGZ1bmN0aW9uKGdseXBoKSB7XG4gICAgICAgICAgcmV0dXJuIGdseXBoLmFkdmFuY2VXaWR0aDtcbiAgICAgICAgfSkucmVkdWNlKGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICByZXR1cm4gYSArIGI7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gd2lkdGggKiBmYWN0b3I7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuICAgIFxuICAgIFxuICAvKipcbiAgICogVmlzdWFsaXN0IENsYXNzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICAgKi9cblxuICBmdW5jdGlvbiBWaXN1YWxpc3QoZWxlbWVudCkge1xuICAgIHZhciBzZXQgPSBudWxsLCBlbGVtZW50LCByZXN1bHQsIGksIHN2ZztcbiAgICAvLyBDb2xsZWN0IGNvbnN0cnVjdG9yIGFyZ3NcbiAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdvYmplY3QnICYmIGVsZW1lbnQubmFtZXNwYWNlVVJJID09PSBTVkdfTkFNRVNQQUNFX1VSSSkge1xuICAgICAgLy8gRXhpc3RpbmcgRWxlbWVudFxuICAgICAgc2V0ID0gW2VsZW1lbnRdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBUT0RPOiBJbXBsZW1lbnQgcGFyc2VyXG4gICAgICAvLyBUT0RPOiBRdWVyeSBTZWxlY3RvclxuICAgICAgXG4gICAgfVxuICAgIGlmICghc2V0KSB7XG4gICAgICBzdHJpbmcgPSAnPHN2ZyB2ZXJzaW9uPVwiMS4xXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiIHhtbDpzcGFjZT1cInByZXNlcnZlXCI+IDwvc3ZnPic7XG4gICAgICAvLyBOb2RlOlxuICAgICAgLy9zdHJpbmcgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwidXRmLThcIj8+PCFET0NUWVBFIHN2ZyBQVUJMSUMgXCItLy9XM0MvL0RURCBTVkcgMS4xLy9FTlwiIFwiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkXCI+JyArIHN0cmluZztcbiAgICAgIC8vdmFyIGRvY3VtZW50ID0ganNkb20uanNkb20oc3RyaW5nKTtcbiAgICAgIHZhciBkb2MgPSAobmV3IGltcGwuRE9NUGFyc2VyKCkpLnBhcnNlRnJvbVN0cmluZyhzdHJpbmcsICd0ZXh0L3htbCcpO1xuICAgICAgLy92YXIgZWxlbSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5xdWVyeVNlbGVjdG9yKCdzdmcnKTtcbiAgICAgIC8qc3ZnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0VfVVJJLCAnc3ZnJyk7XG4gICAgICBzdmcuc2V0QXR0cmlidXRlKFwieG1sbnNcIiwgU1ZHX05BTUVTUEFDRV9VUkkpOyovXG4gICAgICBzZXQgPSBbZG9jLmRvY3VtZW50RWxlbWVudF07XG4gICAgfVxuICAgIHRoaXMucHVzaC5hcHBseSh0aGlzLCBzZXQgfHwgW10pO1xuICB9XG4gIFxuICBWaXN1YWxpc3QucHJvdG90eXBlID0gW107XG4gIFxuICAvKipcbiAgICogVmlzdWFsaXN0IGNvbnN0cnVjdG9yXG4gICAqL1xuICB2YXIgX3YgPSBmdW5jdGlvbihlbGVtZW50LCB3aWR0aCwgaGVpZ2h0LCBhdHRycykge1xuICAgIHZhciBhcmcsIGksIF9lbGVtZW50LCBfd2lkdGgsIF9oZWlnaHQsIF9hdHRycyA9IHt9LCBzZXQ7XG4gICAgZm9yIChpID0gMCwgYXJnOyBhcmcgPSBhcmd1bWVudHNbaV07IGkrKykge1xuICAgICAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8IHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnICYmICFpc05hTihwYXJzZUZsb2F0KGFyZykpKSB7XG4gICAgICAgIC8vIE51bWVyaWNcbiAgICAgICAgYXJnID0gdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgPyBwYXJzZUZsb2F0KGFyZykgKyBcInB4XCIgOiBhcmc7XG4gICAgICAgIGlmICh0eXBlb2YgX3dpZHRoICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIF9oZWlnaHQgPSBhcmc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX3dpZHRoID0gYXJnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZy5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgIC8vIFBsYWluIG9iamVjdFxuICAgICAgICBfYXR0cnMgPSBhcmc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBFdmVyeXRoaW5nIGVsc2UgbWF5IGJlIGFuIGVsZW1lbnQgb3Igc2VsZWN0b3JcbiAgICAgICAgX2VsZW1lbnQgPSBhcmc7XG4gICAgICB9XG4gICAgfVxuICAgIGF0dHJzID0gX2F0dHJzIHx8IHt9O1xuICAgIC8vIE1lcmdlIHdpZHRoIGFuZCBoZWlnaHQgYXJndW1lbnRzIHdpdGhzIGF0dHJzXG4gICAgaWYgKHR5cGVvZiBfd2lkdGggIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBhdHRycy53aWR0aCA9IF93aWR0aDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBfaGVpZ2h0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgYXR0cnMuaGVpZ2h0ID0gX2hlaWdodDtcbiAgICB9XG4gICAgLy8gUmV1c2Ugb3IgY3JlYXRlIGluc3RhbmNlXG4gICAgc2V0ID0gX2VsZW1lbnQgaW5zdGFuY2VvZiBWaXN1YWxpc3QgPyBfZWxlbWVudCA6IG5ldyBWaXN1YWxpc3QoX2VsZW1lbnQpO1xuICAgIHNldC5hdHRyKGF0dHJzKTtcbiAgICByZXR1cm4gc2V0O1xuICB9O1xuICBcbiAgXG4gIC8vIFBsdWdpbiBBUElcbiAgX3YuZm4gPSBWaXN1YWxpc3QucHJvdG90eXBlO1xuICBcbiAgLyoqXG4gICAqIEV4dGVuZHMgdmlzdWFsaXN0IHByb3RvdHlwZVxuICAgKiBAcGFyYW0ge0FycmF5fSBtZXRob2RzXG4gICAqL1xuICBfdi5mbi5leHRlbmQgPSBmdW5jdGlvbiggbWV0aG9kcyApIHtcbiAgICBmb3IgKHZhciB4IGluIG1ldGhvZHMpIHtcbiAgICAgIFZpc3VhbGlzdC5wcm90b3R5cGVbeF0gPSBtZXRob2RzW3hdO1xuICAgIH1cbiAgfTtcbiAgXG4gIC8vIFByaXZhdGUgQ29tcG9uZW50c1xuICBcbiAgLyoqXG4gICAqIERyYXcgYmFzaWMgc2hhcGVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWdOYW1lXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXNcbiAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGNoaWxkcmVuIFxuICAgKi9cbiAgXG4gIGZ1bmN0aW9uIHNoYXBlKHRhZ05hbWUsIGF0dHJzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICB2YXIgY2hpbGQgPSBzZWxmLmNyZWF0ZSh0YWdOYW1lLCBhdHRycyk7XG4gICAgICBfdihlbGVtKS5hcHBlbmQoY2hpbGQpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIFxuICAvLyBQdWJsaWMgQ29tcG9uZW50c1xuICBcbiAgX3YuZm4uZXh0ZW5kKHtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZSBmb3IgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzIG9yIHNldCBvbmUgb3IgbW9yZSBhdHRyaWJ1dGVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBhdHRyOiBmdW5jdGlvbiggbmFtZSwgdmFsdWUgKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwic2V0IGF0dHI6IFwiLCBuYW1lLCB2YWx1ZSk7XG4gICAgICB2YXJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xuICAgICAgaWYgKG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgLy8gU2V0XG4gICAgICAgIHZhciBhdHRycyA9IHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyA/IG5hbWUgOiAoZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICAgICAgICB2YXIgYXR0cnMgPSB7fTtcbiAgICAgICAgICBhdHRyc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgIHJldHVybiBhdHRycztcbiAgICAgICAgfSkobmFtZSwgdmFsdWUpO1xuICAgICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgIHZhbHVlID0gYXR0cnNbbmFtZV07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgLy8gUm91bmQgdmFsdWU6XG4gICAgICAgICAgICAgIHZhbHVlID0gcm91bmQodmFsdWUpO1xuICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShTKG5hbWUpLmRhc2hlcml6ZSgpLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuc3R5bGUodmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFRPRE86IGRhdGEtYXR0cmlidXRlc1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIGlmIChuYW1lKSB7XG4gICAgICAgIC8vIEdldFxuICAgICAgICBpZiAodGhpcy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gdGhpc1swXS5nZXRBdHRyaWJ1dGUobmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIFxuICAgIGNzczogZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIioqKiBnZXQgY3NzOiBcIiwgbmFtZSwgdmFsdWUpO1xuICAgICAgdmFyIHN0eWxlcyA9IHt9O1xuICAgICAgdmFyIGVsZW0gPSB0aGlzWzBdO1xuICAgICAgdmFyIHdpbmRvdyA9IGVsZW0ub3duZXJEb2N1bWVudC5kZWZhdWx0VmlldztcbiAgICAgIHN0eWxlcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW0pO1xuICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHN0eWxlc1tuYW1lXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHlsZXM7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGFuIGlubGluZSBzdHlsZSBmb3IgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzIG9yIHNldCBvbmUgb3IgbW9yZSBpbmxpbmUgc3R5bGVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBzdHlsZTogZnVuY3Rpb24oIG5hbWUsIHZhbHVlICkge1xuICAgICAgXG4gICAgICBpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIgcHJvcHMgPSB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgPyBuYW1lIDogKGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICAgICAgdmFyIHByb3BzID0ge307XG4gICAgICAgICAgcHJvcHNbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICByZXR1cm4gcHJvcHM7XG4gICAgICAgIH0pKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgICBcbiAgICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgICAvLyBTZXRcbiAgICAgICAgICB2YXIgc3R5bGVzID0ge307XG4gICAgICAgICAgY29uc29sZS5sb2coXCJnZXQgY3NzIHRleHRcIiwgZWxlbSk7XG4gICAgICAgICAgdmFyIGNzc1RleHQgPSBlbGVtLmdldEF0dHJpYnV0ZSgnc3R5bGUnKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImdldCBjc3MgdGV4dFwiLCBjc3NUZXh0KTtcbiAgICAgICAgICBpZiAoY3NzVGV4dCkge1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNzcy5wYXJzZSgnZWxlbWVudCB7ICcgKyBjc3NUZXh0ICsgJyB9Jyk7XG4gICAgICAgICAgICBvYmouc3R5bGVzaGVldC5ydWxlc1swXS5kZWNsYXJhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihydWxlKSB7XG4gICAgICAgICAgICAgIGlmICghcHJvcHMuaGFzT3duUHJvcGVydHkocnVsZS5wcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICBzdHlsZXNbUyhydWxlLnByb3BlcnR5KS5jYW1lbGl6ZSgpXSA9IHJ1bGUudmFsdWU7IFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUmVtb3ZlIGVtcHR5IHN0eWxlc1xuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZTtcbiAgICAgICAgICAgIGlmICghcHJvcHNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgZGVsZXRlIHN0eWxlc1tuYW1lXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gcHJvcHNbbmFtZV07XG4gICAgICAgICAgICAgIHN0eWxlc1tuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjc3NUZXh0ID0gT2JqZWN0LmtleXMoc3R5bGVzKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIFMobmFtZSkuZGFzaGVyaXplKCkgKyBcIjogXCIgKyBzdHlsZXNbbmFtZV07XG4gICAgICAgICAgfSkuam9pbihcIjsgXCIpO1xuICAgICAgICAgIFxuICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKCdzdHlsZScsIGNzc1RleHQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEdldFxuICAgICAgICBpZiAodGhpcy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgZWxlbSA9IHRoaXNbMF07XG4gICAgICAgICAgdmFyIHN0eWxlcyA9IHt9O1xuICAgICAgICAgIHZhciBjc3NUZXh0ID0gZWxlbS5nZXRBdHRyaWJ1dGUoJ3N0eWxlJyk7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJjc3NUZXh0IFwiLCBjc3NUZXh0KTtcbiAgICAgICAgICBpZiAoY3NzVGV4dCkge1xuICAgICAgICAgICAgdmFyIG9iaiA9IGNzcy5wYXJzZSgnZWxlbWVudC5zdHlsZSB7ICcgKyBjc3NUZXh0ICsgJyB9Jyk7XG4gICAgICAgICAgICBvYmouc3R5bGVzaGVldC5ydWxlc1swXS5kZWNsYXJhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihydWxlKSB7XG4gICAgICAgICAgICAgIHN0eWxlc1tTKHJ1bGUucHJvcGVydHkpLmNhbWVsaXplKCldID0gcnVsZS52YWx1ZTsgXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG5hbWUgPyBzdHlsZXNbbmFtZV0gOiBzdHlsZXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIFxuICAgIHN2ZzogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gXCJcIjtcbiAgICAgIC8vdmFyIHhtbFNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImVsZW06IFwiLCBlbGVtLm91dGVySFRNTCk7XG4gICAgICAgIC8vcmVzdWx0Kz0gZWxlbS5vdXRlckhUTUw7XG4gICAgICAgIGlmICh0eXBlb2YgZWxlbS5vdXRlckhUTUwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmVzdWx0Kz0gZWxlbS5vdXRlckhUTUw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0Kz0gKG5ldyBpbXBsLlhNTFNlcmlhbGl6ZXIoKSkuc2VyaWFsaXplVG9TdHJpbmcoZWxlbSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZWxlbWVudCB3aXRoIHRoZSBzcGVjaWZlZCB0YWduYW1lLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0YWdOYW1lXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbiggdGFnTmFtZSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gX3YoKHRoaXNbMF0gJiYgdGhpc1swXS5vd25lckRvY3VtZW50IHx8IGRvY3VtZW50KS5jcmVhdGVFbGVtZW50TlModGhpc1swXSAmJiB0aGlzWzBdLm5hbWVzcGFjZVVSSSB8fCBTVkdfTkFNRVNQQUNFX1VSSSwgdGFnTmFtZSkpLmF0dHIoYXR0cnMpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogQXBwZW5kcyB0aGUgc3BlY2lmaWVkIGNoaWxkIHRvIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgYXBwZW5kOiBmdW5jdGlvbiggY2hpbGQgKSB7XG4gICAgICBpZiAodGhpcy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIlNUUklORzogXCIsIGNoaWxkKTtcbiAgICAgICAgICBjaGlsZCA9IHRoaXNbMF0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpc1swXS5hcHBlbmRDaGlsZChjaGlsZFswXSB8fCBjaGlsZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIFxuICAgIHByZXBlbmQ6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIGlmICh0aGlzLmxlbmd0aCkge1xuICAgICAgICB0aGlzWzBdLmluc2VydEJlZm9yZShfdihjaGlsZClbMF0sIHRoaXNbMF0uZmlyc3RDaGlsZCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBlbGVtZW50cyBpbiB0aGUgc2V0IG9yIHJlbW92ZXMgdGhlIHNwZWNpZmllZCBjaGlsZCBmcm9tIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cy5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICByZW1vdmU6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgIGVsZW0ucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW0ucGFyZW50Tm9kZSkge1xuICAgICAgICAgIGVsZW0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIFxuICAgIHBhcmVudDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gX3YodGhpc1swXSAmJiB0aGlzWzBdLnBhcmVudE5vZGUpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogVGhlIGFyYygpIG1ldGhvZCBjcmVhdGVzIGFuIGFyYy9jdXJ2ZSAodXNlZCB0byBjcmVhdGUgY2lyY2xlcywgb3IgcGFydHMgb2YgY2lyY2xlcykuIFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBzQW5nbGVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZUFuZ2xlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgYXJjOiBmdW5jdGlvbihjeCwgY3ksIHIsIHNBbmdsZSwgZUFuZ2xlLCBjb3VudGVyY2xvY2t3aXNlLCBhdHRycykge1xuICAgICAgY291bnRlcmNsb2Nrd2lzZSA9IHR5cGVvZiBjb3VudGVyY2xvY2t3aXNlID09PSAnYm9vbGVhbicgPyBjb3VudGVyY2xvY2t3aXNlIDogZmFsc2U7XG4gICAgICB2YXJcbiAgICAgICAgZCA9ICdNICcgKyByb3VuZChjeCkgKyAnLCAnICsgcm91bmQoY3kpLFxuICAgICAgICBjeHMsXG4gICAgICAgIGN5cyxcbiAgICAgICAgY3hlLFxuICAgICAgICBjeWU7XG4gICAgICBpZiAoZUFuZ2xlIC0gc0FuZ2xlID09PSBNYXRoLlBJICogMikge1xuICAgICAgICAvLyBDaXJjbGVcbiAgICAgICAgZCs9ICcgbSAtJyArIHIgKyAnLCAwIGEgJyArIHIgKyAnLCcgKyByICsgJyAwIDEsMCAnICsgKHIgKiAyKSArICcsMCBhICcgKyByICsgJywnICsgciArICcgMCAxLDAgLScgKyAociAqIDIpICsgJywwJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN4cyA9IHJvdW5kKGN4ICsgY29zKHNBbmdsZSkgKiByKTtcbiAgICAgICAgY3lzID0gcm91bmQoY3kgKyBzaW4oc0FuZ2xlKSAqIHIpO1xuICAgICAgICBjeGUgPSByb3VuZChjeCArIGNvcyhlQW5nbGUpICogcik7XG4gICAgICAgIGN5ZSA9IHJvdW5kKGN5ICsgc2luKGVBbmdsZSkgKiByKTtcbiAgICAgICAgZCs9IFwiIExcIiArIGN4cyArIFwiLFwiICsgY3lzICtcbiAgICAgICAgICBcIiBBXCIgKyByICsgXCIsXCIgKyByICsgXCIgMCBcIiArIChlQW5nbGUgLSBzQW5nbGUgPiBQSSA/IDEgOiAwKSArIFwiLFwiICsgKGNvdW50ZXJjbG9ja3dpc2UgPyAwIDogMSkgK1xuICAgICAgICAgIFwiIFwiICsgY3hlICsgXCIsXCIgKyBjeWUgKyBcIiBaXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInBhdGhcIiwgbWVyZ2Uoe1xuICAgICAgICBkOiBkXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBjaXJjbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY2lyY2xlOiBmdW5jdGlvbiggY3gsIGN5LCByLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiY2lyY2xlXCIsIG1lcmdlKHtcbiAgICAgICAgY3g6IGN4LCBcbiAgICAgICAgY3k6IGN5LCBcbiAgICAgICAgcjogclxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIERyYXdzIGFuIGVsbGlwc2Ugb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGVsbGlwc2U6IGZ1bmN0aW9uKCBjeCwgY3ksIHJ4LCByeSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImVsbGlwc2VcIiwgbWVyZ2Uoe1xuICAgICAgICBjeDogY3gsIFxuICAgICAgICBjeTogY3ksIFxuICAgICAgICByeDogcngsXG4gICAgICAgIHJ5OiByeVxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcmVjdGFuZ2xlIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHJlY3Q6IGZ1bmN0aW9uKCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwicmVjdFwiLCBtZXJnZSh7XG4gICAgICAgIHg6IHgsIFxuICAgICAgICB5OiB5LCBcbiAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgbGluZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgbGluZTogZnVuY3Rpb24oIHgxLCB5MSwgeDIsIHkyLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwibGluZVwiLCBtZXJnZSh7XG4gICAgICAgIHgxOiB4MSxcbiAgICAgICAgeTE6IHkxLFxuICAgICAgICB4MjogeDIsXG4gICAgICAgIHkyOiB5MlxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlnb246IGZ1bmN0aW9uKCBwb2ludHMsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BvbHlnb24nLCBtZXJnZSh7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyB8fCB7fSkpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBwb2x5Z29uIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9pbnRzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcG9seWxpbmU6IGZ1bmN0aW9uKCBwb2ludHMsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BvbHlsaW5lJywgbWVyZ2Uoe1xuICAgICAgICBwb2ludHM6IGdldFBhdGgocG9pbnRzKVxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcGF0aCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbiggZCwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncGF0aCcsIG1lcmdlKHtcbiAgICAgICAgZDogZFxuICAgICAgfSwgYXR0cnMgfHwge30pKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgdGV4dCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICB0ZXh0OiBmdW5jdGlvbiggeCwgeSwgc3RyaW5nLCBhdHRycyApIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiKioqIHRleHQ6IFwiLCB4LCB5LCBzdHJpbmcsIGF0dHJzKTtcbiAgICAgIHZhciBlbGVtID0gdGhpcy5jcmVhdGUoJ3RleHQnLCBtZXJnZShhdHRycyB8fCB7fSwge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeVxuICAgICAgfSkpO1xuICAgICAgdGhpcy5hcHBlbmQoZWxlbSk7XG4gICAgICBlbGVtLmFwcGVuZChbKHRoaXNbMF0gJiYgdGhpc1swXS5vd25lckRvY3VtZW50IHx8IGRvY3VtZW50KS5jcmVhdGVUZXh0Tm9kZShzdHJpbmcpXSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSBncm91cCBsYXllciBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZzogZnVuY3Rpb24oIGF0dHJzICkge1xuICAgICAgdmFyIGcgPSB0aGlzLmNyZWF0ZSgnZycsIGF0dHJzKTtcbiAgICAgIF92KHRoaXNbMF0pLmFwcGVuZChnKTtcbiAgICAgIHJldHVybiBnO1xuICAgIH0sXG4gICAgXG4gICAgYmJveDogZnVuY3Rpb24oKSB7XG4gICAgICAvLyBUT0RPOiBDaGVjayB3aGV0aGVyIGFkZGVkIHRvIGRvY3VtZW50IHZpZXdcbiAgICAgIGNvbnNvbGUubG9nKFwiLS0tLS0tLS0tIEJCT1g6IFwiLCB0aGlzWzBdLm5vZGVOYW1lKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBpbXBsLlNWR1NWR0VsZW1lbnQucHJvdG90eXBlLmdldEJCb3guYXBwbHkodGhpc1swXSwgYXJndW1lbnRzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhclxuICAgICAgICB4ID0gMCxcbiAgICAgICAgeSA9IDAsXG4gICAgICAgIHdpZHRoID0gMCxcbiAgICAgICAgaGVpZ2h0ID0gMCxcbiAgICAgICAgZWxlbSA9IHRoaXNbMF0sXG4gICAgICAgIHgxLCB5MSwgeDIsIHkyO1xuICAgICAgXG4gICAgICBpZiAoZWxlbS5ub2RlTmFtZSA9PT0gJ3RleHQnKSB7XG4gICAgICAgIHggPSBwYXJzZUZsb2F0KHRoaXMuYXR0cigneCcpKTtcbiAgICAgICAgeSA9IHBhcnNlRmxvYXQodGhpcy5hdHRyKCd5JykpO1xuICAgICAgICAvL3dpZHRoID0gcGFyc2VGbG9hdCh0aGlzLmF0dHIoJ3dpZHRoJykpO1xuICAgICAgICAvL2hlaWdodCA9IHBhcnNlRmxvYXQodGhpcy5hdHRyKCdoZWlnaHQnKSk7XG4gICAgICB9ICBcbiAgICAgIFxuICAgICAgdmFyIGMgPSBjb21wdXRlZFRleHRMZW5ndGgoZWxlbSk7XG4gICAgICB2YXIgc3R5bGUgPSB0aGlzLnN0eWxlKCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKFwicmVjdDogXCIsIHJlY3QpO1xuICAgICAgIFxuICAgICAgaWYgKGVsZW0pIHtcbiAgICAgICAgXG4gICAgICAgIHZhclxuICAgICAgICAgIGZvbnRTaXplID0gcGFyc2VGbG9hdChzdHlsZS5mb250U2l6ZSksXG4gICAgICAgICAgcmVjdCA9IHt9O1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coXCJlbGVtIGJib3g6IFwiLCBlbGVtLm5vZGVOYW1lLCBlbGVtLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCBjLCBmb250U2l6ZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGlsZHJlblxuICAgICAgICB2YXIgY2hpbGRyZW4gPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuYXBwbHkoZWxlbS5jaGlsZE5vZGVzKS5maWx0ZXIoZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICByZXR1cm4gY2hpbGQubm9kZVR5cGUgPT09IDE7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICBcbiAgICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICB2YXJcbiAgICAgICAgICAgICAgX2NoaWxkID0gX3YoY2hpbGQpLFxuICAgICAgICAgICAgICBib3VuZHMgPSBfY2hpbGQuYmJveCgpLFxuICAgICAgICAgICAgICB0cmFuc2Zvcm0gPSBfY2hpbGQuYXR0cigndHJhbnNmb3JtJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBtYXRyaXggPSBuZXcgWENTU01hdHJpeCh0cmFuc2Zvcm0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHgxID0gdHlwZW9mIHgxID09PSAnbnVtYmVyJyA/IE1hdGgubWluKGJvdW5kcy54LCB4MSkgOiBib3VuZHMueDtcbiAgICAgICAgICAgIHkxID0gdHlwZW9mIHkxID09PSAnbnVtYmVyJyA/IE1hdGgubWluKGJvdW5kcy55LCB5MSkgOiBib3VuZHMueTtcbiAgICAgICAgICAgIHgyID0gdHlwZW9mIHgyID09PSAnbnVtYmVyJyA/IE1hdGgubWF4KGJvdW5kcy54ICsgYm91bmRzLndpZHRoLCB4MikgOiBib3VuZHMueCArIGJvdW5kcy53aWR0aDtcbiAgICAgICAgICAgIHkyID0gdHlwZW9mIHkyID09PSAnbnVtYmVyJyA/IE1hdGgubWF4KGJvdW5kcy55ICsgYm91bmRzLmhlaWdodCwgeTIpIDogYm91bmRzLnkgKyBib3VuZHMuaGVpZ2h0O1xuICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiIyMjIyBjaGlsZDogXCIsIGJvdW5kcywgeDEsIHkxLCB4MiwgeTIsIG1hdHJpeC50b1N0cmluZygpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXggJiYgeDEgIT09IDApIHtcbiAgICAgICAgICAgIHggPSB4MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCF5ICYmIHkxICE9PSAwKSB7XG4gICAgICAgICAgICB5ID0geTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHdpZHRoID0geDIgLSB4MTtcbiAgICAgICAgICBoZWlnaHQgPSB5MiAtIHkxO1xuICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBURVhUOlxuICAgICAgICBpZiAoZWxlbS5ub2RlTmFtZSA9PT0gJ3RleHQnKSB7XG4gICAgICAgICAgd2lkdGggPSBNYXRoLm1heChjb21wdXRlZFRleHRMZW5ndGgodGhpcyksIHdpZHRoKTtcbiAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heChmb250U2l6ZSwgaGVpZ2h0KTtcbiAgICAgICAgICAvKnZhciBmb250ID0gZ2V0Rm9udChzdHlsZS5mb250RmFtaWx5KTtcbiAgICAgICAgICB2YXIgZmFjdG9yID0gZm9udFNpemUgLyBmb250LnVuaXRzUGVyRW07XG4gICAgICAgICAgdmFyIG9mZnNldCA9IGZvbnRTaXplIC0gKGZvbnQuYXNjZW50IC8gZm9udC51bml0c1BlckVtKSAqIGZvbnRTaXplO1xuICAgICAgICAgIGhlaWdodCA9IChmb250LmFzY2VudCAtIGZvbnQuZGVzY2VudCkgLyBmb250LnVuaXRzUGVyRW0gKiBmb250U2l6ZTtcbiAgICAgICAgICBcbiAgICAgICAgICB5ID0geSAtIGZvbnRTaXplICsgb2Zmc2V0OyovXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJlY3QueCA9IHg7XG4gICAgICAgIHJlY3QueSA9IHk7XG4gICAgICAgIHJlY3Qud2lkdGggPSB3aWR0aDtcbiAgICAgICAgcmVjdC5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhcIioqKiBlbGVtIGJib3ggcmVzdWx0OiBcIiwgeCwgeSwgd2lkdGgsIGhlaWdodCwgcmVjdCk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVjdDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGEgc21vb3RoIGdyYXBoIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9pbnRzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKi9cbiAgICBncmFwaDogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMsIG9wdGlvbnMgKSB7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBvcHRzID0gbWVyZ2Uoe1xuICAgICAgICAgICAgc21vb3RoOiB0cnVlLCBcbiAgICAgICAgICAgIHRlbnNpb246IDAuNCxcbiAgICAgICAgICAgIGFwcHJveGltYXRlOiB0cnVlXG4gICAgICAgICAgfSwgb3B0aW9ucyB8fCB7fSksXG4gICAgICAgICAgdCA9ICFpc05hTiggb3B0cy50ZW5zaW9uICkgPyBvcHRzLnRlbnNpb24gOiAwLjUsXG4gICAgICAgICAgZWwgPSBfdihlbGVtKSwgXG4gICAgICAgICAgcCxcbiAgICAgICAgICBpLFxuICAgICAgICAgIGMsXG4gICAgICAgICAgZCxcbiAgICAgICAgICBwMSxcbiAgICAgICAgICBwMixcbiAgICAgICAgICBjcHMsXG4gICAgICAgICAgcGF0aCA9IGVsLmNyZWF0ZSgncGF0aCcsIGF0dHJzKSxcbiAgICAgICAgICBwYXRoU3RyID0gXCJcIjtcbiAgICAgICAgICBcbiAgICAgICAgZWwuYXBwZW5kKHBhdGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFvcHRzLnNtb290aCkge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgcGF0aFN0cis9IGkgPiAwID8gXCJMXCIgOiBcIk1cIjtcbiAgICAgICAgICAgIHBhdGhTdHIrPSByb3VuZChwLngpICsgXCIgXCIgKyByb3VuZChwLnkpICsgXCIgXCI7XG4gICAgICAgICAgfSBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBTbW9vdGhcbiAgICAgICAgICBpZiAob3B0cy5hcHByb3hpbWF0ZSkge1xuICAgICAgICAgICAgcCA9IHBvaW50c1swXTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIk1cIiArIHJvdW5kKHAueCkgKyBcIiBcIiArIHJvdW5kKHAueSkgKyBcIiBcIjtcbiAgICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYyA9IChwb2ludHNbaV0ueCArIHBvaW50c1tpICsgMV0ueCkgLyAyO1xuICAgICAgICAgICAgICAgIGQgPSAocG9pbnRzW2ldLnkgKyBwb2ludHNbaSArIDFdLnkpIC8gMjtcbiAgICAgICAgICAgICAgICBwYXRoU3RyKz0gXCJRXCIgKyByb3VuZChwb2ludHNbaV0ueCkgKyBcIiBcIiArIHJvdW5kKHBvaW50c1tpXS55KSArIFwiIFwiICsgYyArIFwiIFwiICsgZCArIFwiIFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGF0aFN0cis9IFwiVFwiICsgcm91bmQocG9pbnRzW2ldLngpICsgXCIgXCIgKyByb3VuZChwb2ludHNbaV0ueSkgKyBcIiBcIjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcCA9IHBvaW50c1swXTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIk1cIiArIHAueCArIFwiIFwiICsgcC55ICsgXCIgXCI7XG4gICAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrPTEpIHtcbiAgICAgICAgICAgICAgcCA9IHBvaW50c1tpIC0gMV07XG4gICAgICAgICAgICAgIHAxID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgICBwMiA9IHBvaW50c1tpICsgMV07XG4gICAgICAgICAgICAgIGNwcyA9IGdldENvbnRyb2xQb2ludHMocC54LCBwLnksIHAxLngsIHAxLnksIHAyLngsIHAyLnksIHQpO1xuICAgICAgICAgICAgICBwYXRoU3RyKz0gXCJDXCIgKyByb3VuZChjcHMucDEueCkgKyBcIiBcIiArIHJvdW5kKGNwcy5wMS55KSArIFwiIFwiICsgcm91bmQoY3BzLnAyLngpICsgXCIgXCIgKyByb3VuZChjcHMucDIueSkgKyBcIiBcIiArIHJvdW5kKHAyLngpICsgXCIgXCIgKyByb3VuZChwMi55KSArIFwiIFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGF0aFN0cis9IFwiVFwiICsgcm91bmQocG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS54KSArIFwiIFwiICsgcm91bmQocG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS55KSArIFwiIFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZGVsZXRlIG9wdHMuc21vb3RoO1xuICAgICAgICBkZWxldGUgb3B0cy50ZW5zaW9uO1xuICAgICAgICBkZWxldGUgb3B0cy5hcHByb3hpbWF0ZTtcbiAgICAgICAgcGF0aC5hdHRyKG1lcmdlKHtcbiAgICAgICAgICBmaWxsOiAnbm9uZSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGQ6IHBhdGhTdHJcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogUmVuZGVycyB0ZXh0IGludG8gYSBib3VuZGluZyBib3ggYnkgd3JhcHBpbmcgbGluZXMgYXQgc3BhY2VzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB4XG4gICAgICogQHBhcmFtIHtPYmplY3R9IHlcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gd2lkdGhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaGVpZ2h0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IHN0cmluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHRleHRib3g6IGZ1bmN0aW9uKCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCBzdHJpbmcsIGF0dHJzICkge1xuICAgICAgXG4gICAgICB2YXIgXG4gICAgICAgIHNlbGYgPSB0aGlzO1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICB2YXJcbiAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICBsaW5lcyA9IHdpZHRoID8gW10gOiBbc3RyaW5nXSwgXG4gICAgICAgICAgbGluZSA9IFtdLFxuICAgICAgICAgIHRleHRMZW5ndGggPSAwLFxuICAgICAgICAgIHdvcmRzID0gd2lkdGggPyBzdHJpbmcuc3BsaXQoL1xccysvKSA6IFtdLFxuICAgICAgICAgIHRleHQgPSBzZWxmLmNyZWF0ZSgndGV4dCcsIG1lcmdlKGF0dHJzIHx8IHt9LCB7XG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeVxuICAgICAgICAgIH0pKSxcbiAgICAgICAgICB0ZXh0Tm9kZSxcbiAgICAgICAgICBzdHlsZSA9IHRleHQuc3R5bGUoKSxcbiAgICAgICAgICBmb250U2l6ZSA9IHBhcnNlRmxvYXQoc3R5bGUuZm9udFNpemUpIHx8IDE2LFxuICAgICAgICAgIGxpbmVIZWlnaHQgPSBmb250U2l6ZSAqIDEuNCxcbiAgICAgICAgICB0ZXh0QWxpZ24gPSAoc3R5bGUudGV4dEFsaWduID09PSAnZW5kJyB8fCBzdHlsZS50ZXh0QWxpZ24gPT09ICdyaWdodCcgPyAxIDogc3R5bGUudGV4dEFsaWduID09PSAnY2VudGVyJyB8fCBzdHlsZS50ZXh0QWxpZ24gPT09ICdtaWRkbGUnID8gMC41IDogMCk7XG4gICAgICAgICAgdHkgPSAwO1xuICAgICAgICBcbiAgICAgICAgX3ZlbGVtLmFwcGVuZCh0ZXh0KTtcblxuICAgICAgICBpZiAod2lkdGgpIHtcbiAgICAgICAgICAvLyBCcmVhayBsaW5lc1xuICAgICAgICAgIHRleHROb2RlID0gZWxlbS5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICAgICAgICAgIHRleHQuYXBwZW5kKHRleHROb2RlKTtcbiAgICAgICAgICB3b3Jkcy5mb3JFYWNoKGZ1bmN0aW9uKHdvcmQsIGluZGV4KSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5kYXRhID0gbGluZS5qb2luKCcgJykgKyAnICcgKyB3b3JkO1xuICAgICAgICAgICAgdGV4dExlbmd0aCA9IGNvbXB1dGVkVGV4dExlbmd0aCh0ZXh0LCBzdHlsZSk7XG4gICAgICAgICAgICBpZiAodGV4dExlbmd0aCA+IHdpZHRoKSB7XG4gICAgICAgICAgICAgIC8vIEJyZWFrIGxpbmVcbiAgICAgICAgICAgICAgbGluZXMucHVzaCh7bGVuZ3RoOiBsaW5lTGVuZ3RoLCB0ZXh0OiBsaW5lLmpvaW4oJyAnKX0pO1xuICAgICAgICAgICAgICBsaW5lTGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgbGluZSA9IFt3b3JkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEFkZCB3b3JkIHRvIGxpbmVcbiAgICAgICAgICAgICAgbGluZUxlbmd0aCA9IHRleHRMZW5ndGg7XG4gICAgICAgICAgICAgIGxpbmUucHVzaCh3b3JkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gd29yZHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKHtsZW5ndGg6IGxpbmVMZW5ndGgsIHRleHQ6IGxpbmUuam9pbignICcpfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGV4dC5yZW1vdmUodGV4dE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZW5kZXIgbGluZXNcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbihsaW5lLCBpbmRleCkge1xuICAgICAgICAgIHZhciB0c3BhbiwgZHk7XG4gICAgICAgICAgaWYgKCFoZWlnaHQgfHwgdHkgKyBwYXJzZUZsb2F0KGxpbmVIZWlnaHQpIDwgaGVpZ2h0KSB7XG4gICAgICAgICAgICBkeSA9IGluZGV4ID4gMCA/IGxpbmVIZWlnaHQgOiBmb250U2l6ZSAtIDI7XG4gICAgICAgICAgICB0eSs9IGR5O1xuICAgICAgICAgICAgdHNwYW4gPSBzZWxmLmNyZWF0ZSgndHNwYW4nLCB7ZHk6IGR5fSk7XG4gICAgICAgICAgICB0ZXh0LmFwcGVuZCh0c3Bhbik7XG4gICAgICAgICAgICB0c3BhblxuICAgICAgICAgICAgICAuYXBwZW5kKGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lLnRleHQpKTtcbiAgICAgICAgICAgIHRzcGFuLmF0dHIoJ3gnLCBwYXJzZUludCh0ZXh0LmF0dHIoJ3gnKSwgdW5kZWZpbmVkKSArICh3aWR0aCAtIGxpbmUubGVuZ3RoKSAqIHRleHRBbGlnbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIFxuICB9KTtcbm1vZHVsZS5leHBvcnRzID0gX3Y7Il19
