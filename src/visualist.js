var merge = require('deepmerge');
var xmldom = require('xmldom');
var DOMImplementation = xmldom.DOMImplementation;
var XMLSerializer = xmldom.XMLSerializer;
var document = (new  DOMImplementation()).createDocument();
var round = require('./lib/round');
var hyphenate = require('./lib/hyphenate');
var css = require('css');
var S = require('string');
var fontkit = require('fontkit');

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
    
    /**
     * Retrieves the computed text length of the first element in the set if available.
     */
    computedTextLength = function(elem, style) {
      elem = _v(elem);
      style = style || typeof window !== 'undefined' && window.getComputedStyle(elem[0]) || elem.style();
      
      if (elem.length > 0) {
        var l;
        var text = elem[0].firstChild && elem[0].firstChild.data;
        
        if (elem[0].getComputedTextLength) {
          l = elem[0].getComputedTextLength();
          return l;
        }
        
        var fontFamily = style.fontFamily || 'Arial';
        var file = '/Library/Fonts/' + fontFamily + '.ttf';
        var fontSize = parseFloat(style.fontSize) || 16;
        
        // open a font synchronously 
        var font = fontFace[fontFamily] = fontFace[fontFamily] || fontkit.openSync(file);
        var factor = fontSize / font.unitsPerEm;
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
      svg = document.createElementNS(SVG_NAMESPACE_URI, 'svg');
      svg.setAttribute("xmlns", SVG_NAMESPACE_URI);
      set = [svg];
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
      var child = self.create(tagName, merge(attrs, attrs));
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
          var cssText = elem.getAttribute('style');
          
          var obj = css.parse('element.style { ' + cssText + ' }');
          obj.stylesheet.rules[0].declarations.forEach(function(rule) {
            if (!props.hasOwnProperty(rule.property)) {
              styles[S(rule.property).camelize()] = rule.value; 
            }
          });
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
          var obj = css.parse('element.style { ' + cssText + ' }');
          obj.stylesheet.rules[0].declarations.forEach(function(rule) {
            styles[S(rule.property).camelize()] = rule.value; 
          });
          return name ? styles[name] : styles;
        }
        return null;
      }
      return this;
    },
    
    svg: function() {
      var result = "";
      var xmlSerializer = new XMLSerializer();
      this.forEach(function(elem) {
        result+= xmlSerializer.serializeToString(elem);
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
        this[0].appendChild(child[0] || child);
      }
      return this;
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
      }, attrs));
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
      }, attrs));
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
      }, attrs));
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
      }, attrs));
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
      }, attrs));
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polygon: function( points, attrs ) {
      return shape.call(this, 'polygon', merge({
        points: getPath(points)
      }, attrs));
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polyline: function( points, attrs ) {
      return shape.call(this, 'polyline', merge({
        points: getPath(points)
      }, attrs));
    },
    
    /**
     * Draws a path on every element in the set.
     * @param {String} d
     * @param {Object} attrs
     */
    path: function( d, attrs ) {
      return shape.call(this, 'path', {d: d}, attrs);
    },
    
    /**
     * Renders text on every element in the set.
     * @param {Number} x
     * @param {Number} y
     * @param {String} string
     * @param {Object} attrs
     */
    text: function( x, y, string, attrs ) {
      var elem = this.create('text', merge(attrs, {
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