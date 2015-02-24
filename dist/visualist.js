(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g._v = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _v = (function() {
  
  
  var 
    SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg",
    MATH = Math,
    PI = MATH.PI,
    cos = MATH.cos,
    sin = MATH.sin,
    sqrt = MATH.sqrt,
    pow = MATH.pow,
    floor = MATH.floor,
  
    /**
     * Camelize a string
     * @param {String} string
     */ 
    camelize = (function() {
      var cache = {};
      return function(string) {
        return cache[string] = cache[string] || (function() {
          return string.replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','');});
        })();
      };
    })(),
  
    /**
     * Hyphenate a string
     * @param {String} string
     */
    hyphenate = (function() {
      var cache = {};
      return function(string) {
        return cache[string] = cache[string] || (function() {
          return string.replace(/([A-Z])/g, function($1){return "-"+$1.toLowerCase();});
        })();
      };
    })(),
  
    /**
     * Extends an object
     * @param {Boolean} true
     * @param {Object} destination
     * @param {Object} source
     */
    extend = function(deep, destination, source) {
      var args = arguments, i = typeof deep === 'boolean' ? 2 : 1, dest = arguments[i - 1], src, prop, value;
      for (; i < args.length; i++) {
        src = args[i];
        for (prop in src) {
          value = src[prop];
          if (typeof value !== 'undefined' && value !== null) {
            if (typeof value === 'object' && value.constructor === Object) {
              dest[prop] = dest[prop] || {};
              if (deep) {
                extend(true, dest[prop], value);
              }
            } else {
              dest[prop] = value;
            }
          }
        }
      }
      return dest;
    },
  
    css = function(elem, name, value) {
      var map = {}, cssText = null;
      if (typeof name === 'object') {
        map = name;
      } else if (typeof value !== "undefined") {
        map[name] = value;
      }
      cssText = Object.keys(map).map(function(name) {
        return hyphenate(name) + ": " + map[name];
      }).join("; ");
      if (cssText && cssText.length) {
        elem.style.cssText = elem.style.cssText + cssText;
        return this;
      }
      return elem.style[name] || window.getComputedStyle(elem, null).getPropertyValue(name);
    },
  
    attr = function (elem, name, value) {
      var result = null, obj = {}, prop;
      if (typeof name === 'object') {
        obj = name;
      } else if (typeof name !== 'undefined'){
        obj[name] = value;
      }
      function mapStyles(name) {
        return hyphenate(name) + ": " + value[name];
      }
      if (Object.keys(obj).length) {
        for (name in obj) {
          prop = typeof elem[camelize(name)] !== 'undefined' ? camelize(name) : hyphenate(name);
          value = obj[name];
          if (typeof value !== 'undefined') {
            // Set
            if (name === 'style' && typeof value === 'object') {
              value = Object.keys(value).map(mapStyles).join("; ");
            }
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
              elem.setAttribute(prop, value);
            }
          } else if (!result) {
            // Get
            result = elem.getAttribute(prop);
          }
        }
      }
      return result || elem;
    },
    
    
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
     * Serializes points as svg path definition
     * @param {Array} points
     */
    getPath = function( points ) {
      return points.map(function(point) {
        return point.x + "," + point.y;
      }).join(" ");
    },
  
  
    /**
     * Visualist query constructor
     */
    _v = function(selector, width, height, attrs) {
      var arg, i, s, w, h, a, set;
      for (i = 0, arg; arg = arguments[i]; i++) {
        if (typeof arg === 'number' || typeof arg === 'string' && !isNaN(parseFloat(arg))) {
          // Numeric
          arg = typeof arg === 'number' ? parseFloat(arg) + "px" : arg;
          if (typeof w !== 'undefined') {
            h = arg;
          } else {
            w = arg;
          }
        } else if (typeof arg === 'object' && arg.constructor === Object) {
          // Plain object
          a = arg;
        } else {
          // Everything else may be a selector
          s = arg;
        }
      }
      set = s instanceof Visualist ? s : new Visualist(s);
      set.attr(extend(true, a || {}, {
        width: w, 
        height: h
      }));
      return set;
    };

  /**
   * Visualist Class
   * @param {String} selector
   */

  function Visualist(selector) {
    var set = null, elem, result, i, svg;
    // Collect constructor args
    if (typeof selector === 'object' && selector.namespaceURI === SVG_NAMESPACE_URI) {
      // Existing Element
      set = [selector];
    } else if (typeof selector === 'string') {
      // Selector
      result = document.querySelectorAll(selector);
      for (i = 0, elem; elem = result[i]; i++) {
        if (elem.namespaceURI === SVG_NAMESPACE_URI ) {
          set = set || [];
          set.push(elem);
        }
      }
    }
    if (!set) {
      svg = document.createElementNS(SVG_NAMESPACE_URI, 'svg');
      svg.setAttribute("xmlns", SVG_NAMESPACE_URI);
      set = [svg];
    }
    this.push.apply(this, set || []);
  }
  
  Visualist.prototype = [];
  
  // Static methods
  _v.extend = extend;
  _v.attr = attr;
  _v.css = css;
  
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
  function shape(tagName, params, attrs, children) {
    var self = this;
    this.forEach(function(elem) {
      _v(elem).append(self.create(tagName, extend(true, {}, attrs, params)).append(children));
    });
    return this;
  }
  
  // Public Components
  
  _v.fn.extend({
    /**
     * Appends the specified child to the first element in the set.
     * @param {Object} child
     */
    append: function( child ) {
      var self = this, children = child instanceof Array ? child : [child];
      if (self[0] && child) {
        children.forEach(function(child) {
          self[0].appendChild(child.nodeType === 3 ? child : _v(child)[0]);
        });
      }
      return this;
    },
    /**
     * Removes all elements in the set or removes the specified child from the set of matched elements.
     * @param {Object} child
     */
    remove: function( child ) {
      var self = this, children = typeof child !== 'undefined' ? child instanceof Array ? child : [child] : null;
      this.forEach(function(elem) {
        if (children) {
          children.forEach(function(child) {
            elem.removeChild(child);
          });
        } else if (elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      });
      return this;
    },
    /**
     * Removes children from elements in the set
     */
    clear: function() {
      this.forEach(function(elem) {
        for (var i = 0; i < elem.childNodes.length; i++) {
          elem.removeChild(elem.childNodes[i]);
          i--;
        }
      });
    },
    /**
     * Get the value of an attribute for the first element in the set of matched elements or set one or more attributes for every matched element.
     * @param {String} name
     * @param {Object} value
     */
    attr: function( name, value ) {
      var result = this;
      this.forEach(function(elem) {
        var ret = attr(elem, name, value);
        if (ret !== elem) {
          result = ret;
        }
      });
      return result;
    },
    /**
     * Get the value of a computed style property for the first element in the set of matched elements or set one or more CSS properties for every matched element.
     * @param {String} name
     * @param {Object} value
     */
    css: function( name, value ) {
      var result = this;
      this.forEach(function(elem) {
        var ret = css(elem, name, value);
        if (ret !== elem) {
          result = ret;
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
     * Gets or sets the width on the first element in the set
     * @param {Number} width
     */
    width: function( width ) {
      console.warn("deprecated");
      if (typeof width === 'undefined' && this[0]) {
        return this[0].getBoundingClientRect().width;
      }
      this.attr('width', width);
      return this;
    },
    /**
     * Gets or sets the height on the first element in the set
     * @param {Number} height
     */
    height: function( height ) {
      console.warn("deprecated");
      if (typeof height === 'undefined' && this[0]) {
        return this[0].getBoundingClientRect().height;
      }
      this.attr('height', height);
      return this;
    },
    /**
     * Retrieves the bounding box of the first element in the set.
     */
    bbox: function() {
      return this[0] && this[0].getBBox();
    },
    /**
     * Retrieves the computed text length of the first element in the set if applicable.
     */
    computedTextLength: function() {
      return this[0] && this[0].getComputedTextLength();
    },
    /**
     * Creates and returns a group layer on the first element in the set
     * @param {Object} attrs
     */
    group: function( attrs ) {
      var g = this.create('g', attrs);
      _v(this[0]).append(g);
      return g;
    },
    /**
     * Draws a circle on every element in the set.
     * @param {Number} cx
     * @param {Number} cy
     * @param {Number} r
     * @param {Object} attrs
     */
    circle: function( cx, cy, r, attrs ) {
      return shape.call(this, "circle", {
        cx: cx, 
        cy: cy, 
        r: r
      }, attrs);
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
      return shape.call(this, "ellipse", {
        cx: cx, 
        cy: cy, 
        rx: rx,
        ry: ry
      }, attrs);
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
      return shape.call(this, "rect", {
        x: x, 
        y: y, 
        width: width,
        height: height
      }, attrs);
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
      return shape.call(this, "line", {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2
      }, attrs);
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polygon: function( points, attrs ) {
      return shape.call(this, 'polygon', {
        points: getPath(points)
      }, attrs);
    },
    /**
     * Draws a polygon on every element in the set.
     * @param {Object} points
     * @param {Object} attrs
     */
    polyline: function( points, attrs ) {
      return shape.call(this, 'polyline', {
        points: getPath(points)
      }, attrs);
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
      return shape.call(this, 'text', {
        x: x, 
        y: y
      }, attrs, [(this[0] && this[0].ownerDocument || document).createTextNode(string)]);
    },
    /**
     * Renders a smooth graph on every element in the set.
     * @param {Object} points
     * @param {Object} options
     */
    graph: function( points, options ) {
      
      this.forEach(function(elem) {
        
        var
          opts = extend({
            smooth: true, 
            tension: 0.4,
            approximate: true
          }, options),
          t = !isNaN( opts.tension ) ? opts.tension : 0.5,
          el = _v(elem), 
          p,
          i,
          c,
          d,
          p1,
          p2,
          cps,
          path = el.create('path'),
          pathStr = "";
          
        el.append(path);
        
        if (!opts.smooth) {
          for (i = 0; i < points.length; i++ ) {
            p = points[i];
            pathStr+= i > 0 ? "L" : "M";
            pathStr+= p.x + " " + p.y + " ";
          } 
        } else if (opts.approximate) {
          p = points[0];
          pathStr+= "M" + p.x + " " + p.y + " ";
          for (i = 1; i < points.length - 1; i++) {
              c = (points[i].x + points[i + 1].x) / 2;
              d = (points[i].y + points[i + 1].y) / 2;
              pathStr+= "Q" + points[i].x + " " + points[i].y + " " + c + " " + d + " ";
          }
          pathStr+= "T" + points[i].x + " " + points[i].y + " ";
        } else {
          p = points[0];
          pathStr+= "M" + p.x + " " + p.y + " ";
          for (i = 1; i < points.length - 1; i+=1) {
            p = points[i - 1];
            p1 = points[i];
            p2 = points[i + 1];
            cps = getControlPoints(p.x, p.y, p1.x, p1.y, p2.x, p2.y, t);
            pathStr+= "C" + cps.p1.x + " " + cps.p1.y + " " + cps.p2.x + " " + cps.p2.y + " " + p2.x + " " + p2.y + " ";
          }
          pathStr+= "T" + points[points.length - 1].x + " " + points[points.length - 1].y + " ";
        }
        
        delete opts.smooth;
        delete opts.tension;
        delete opts.approximate;
        
        path.attr(extend(opts, {
          d: pathStr
        }));
        
      });
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
    arc: function(x, y, r, sAngle, eAngle, counterclockwise, attrs) {
      counterclockwise = typeof counterclockwise === 'boolean' ? counterclockwise : false;
      return shape.call(this, "path", {
        d: "M" + x + "," + y + 
          " L" + (x + cos(sAngle) * r) + "," + (y + sin(sAngle) * r) +
          " A" + r + "," + r + " 0 " + (eAngle - sAngle > PI ? 1 : 0) + "," + (counterclockwise ? 0 : 1) +
          " " + (x + cos(eAngle) * r) + "," + (y + sin(eAngle) * r) + " Z"
      }, attrs);
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
          length = 0,
          words = width ? string.split(/\s+/) : [],
          text = self.create('text', extend(true, {}, attrs, {
            x: x,
            y: y
          })),
          textNode,
          lineHeight = parseFloat(_velem.css('line-height')),
          fontSize = parseFloat(_velem.css('font-size')),
          textAlign = text.css('text-align'),
          ty = 0;
        
        _velem.append(text);
        
        
        if (width) {
          // Break lines
          textNode = elem.ownerDocument.createTextNode("");
          text.append(textNode);
          words.forEach(function(word, index) {
            textNode.data = line.join(' ') + ' ' + word;
            length = text.computedTextLength();
            if (length > width) {
              lines.push(line.join(' '));
              line = [word];
            } else {
              line.push(word);
            }
            if (index === words.length - 1) {
              lines.push(line.join(' '));
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
              .append(elem.ownerDocument.createTextNode(line))
              .attr('x', parseInt(text.attr('x'), undefined) + (width - tspan.computedTextLength()) * (textAlign === 'end' || textAlign === 'right' ? 1 : textAlign === 'center' || textAlign === 'middle' ? 0.5 : 0));
          }
        });
      });
      return this;
    },
    /**
     * Renders an unordered list.
     * @param {Number} x
     * @param {Number} y
     * @param {Array} items
     * @param {Object} options
     */
    list: function( x, y, items, options ) {
      return this.listbox(x, y, 0, 0, items, options);
    },
    /**
     * Renders an unordered list into the specified bounds.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} width
     * @param {Number} height
     * @param {Array} items
     * @param {Object} options
     */
    listbox: function( x, y, width, height, items, options ) {
      
      items = (items || []).map(function(item) {
        return typeof item === 'string' ? {label: item} : item;
      });
      
      options = options || {};
      
      options = extend({}, {
        horizontal: false,
        bullet: {
          shape: 'rect'
        }
      }, options);
      
      this.forEach(function(elem) {
        
        var top = y;
        
        items.forEach(function(item, index) {
          
          var
            _velem = _v(elem),
            itemOpts = extend(true, {}, options, item),
            horizontal = itemOpts.horizontal,
            shape = itemOpts.bullet.shape,
            label = itemOpts.label,
            bulletAttrs,
            itemLayer = _velem.group(),
            lineHeight = parseFloat(_velem.css('line-height')),
            fontSize = parseFloat(_velem.css('font-size')),
            bulletSize = fontSize * 0.65,
            spacing = lineHeight * 0.25,
            itemWidth,
            itemHeight;
          
          delete itemOpts.bullet.shape;
          delete itemOpts.horizontal;
          delete itemOpts.label;
          
          bulletAttrs = extend(true, {}, itemOpts, itemOpts.bullet); 
          
          delete itemOpts.bullet;
          
          if (height && y + fontSize > top + height) {
            return;
          }
          
          // Render bullet
          if (shape === 'circle') {
            itemLayer.circle(x + bulletSize * 0.5, floor(y) + (fontSize - bulletSize) * 0.5 + bulletSize * 0.5, bulletSize * 0.5, bulletAttrs);
          } else {
            itemLayer.rect(x, Math.floor(y) + (fontSize - bulletSize) * 0.5, bulletSize, bulletSize, bulletAttrs);
          }
          
          // Render label
          itemLayer.textbox(x + bulletSize + spacing, floor(y), width ? width - bulletSize - spacing : 0, height ? top + height - y : 0, label, itemOpts);
          
          itemWidth = floor(itemLayer.bbox().width);
          itemHeight = floor(itemLayer.bbox().height + (lineHeight - fontSize));
          
          if (horizontal) {
            x+= itemWidth + fontSize;
            if (width && x > width) {
              y+= itemHeight;
              x = 0;
            }
          } else {
            y+= itemHeight;
          }
          
        });
    
      });
      
      return this;
    }
  });
  
  return _v;
  
}());

module.exports = _v;
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIF92ID0gKGZ1bmN0aW9uKCkge1xuICBcbiAgXG4gIHZhciBcbiAgICBTVkdfTkFNRVNQQUNFX1VSSSA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIixcbiAgICBNQVRIID0gTWF0aCxcbiAgICBQSSA9IE1BVEguUEksXG4gICAgY29zID0gTUFUSC5jb3MsXG4gICAgc2luID0gTUFUSC5zaW4sXG4gICAgc3FydCA9IE1BVEguc3FydCxcbiAgICBwb3cgPSBNQVRILnBvdyxcbiAgICBmbG9vciA9IE1BVEguZmxvb3IsXG4gIFxuICAgIC8qKlxuICAgICAqIENhbWVsaXplIGEgc3RyaW5nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqLyBcbiAgICBjYW1lbGl6ZSA9IChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjYWNoZSA9IHt9O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICByZXR1cm4gY2FjaGVbc3RyaW5nXSA9IGNhY2hlW3N0cmluZ10gfHwgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvKFxcLVthLXpdKS9nLCBmdW5jdGlvbigkMSl7cmV0dXJuICQxLnRvVXBwZXJDYXNlKCkucmVwbGFjZSgnLScsJycpO30pO1xuICAgICAgICB9KSgpO1xuICAgICAgfTtcbiAgICB9KSgpLFxuICBcbiAgICAvKipcbiAgICAgKiBIeXBoZW5hdGUgYSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nXG4gICAgICovXG4gICAgaHlwaGVuYXRlID0gKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNhY2hlID0ge307XG4gICAgICByZXR1cm4gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBjYWNoZVtzdHJpbmddID0gY2FjaGVbc3RyaW5nXSB8fCAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC8oW0EtWl0pL2csIGZ1bmN0aW9uKCQxKXtyZXR1cm4gXCItXCIrJDEudG9Mb3dlckNhc2UoKTt9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH07XG4gICAgfSkoKSxcbiAgXG4gICAgLyoqXG4gICAgICogRXh0ZW5kcyBhbiBvYmplY3RcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IHRydWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGVzdGluYXRpb25cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc291cmNlXG4gICAgICovXG4gICAgZXh0ZW5kID0gZnVuY3Rpb24oZGVlcCwgZGVzdGluYXRpb24sIHNvdXJjZSkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsIGkgPSB0eXBlb2YgZGVlcCA9PT0gJ2Jvb2xlYW4nID8gMiA6IDEsIGRlc3QgPSBhcmd1bWVudHNbaSAtIDFdLCBzcmMsIHByb3AsIHZhbHVlO1xuICAgICAgZm9yICg7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNyYyA9IGFyZ3NbaV07XG4gICAgICAgIGZvciAocHJvcCBpbiBzcmMpIHtcbiAgICAgICAgICB2YWx1ZSA9IHNyY1twcm9wXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgICAgICBkZXN0W3Byb3BdID0gZGVzdFtwcm9wXSB8fCB7fTtcbiAgICAgICAgICAgICAgaWYgKGRlZXApIHtcbiAgICAgICAgICAgICAgICBleHRlbmQodHJ1ZSwgZGVzdFtwcm9wXSwgdmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBkZXN0W3Byb3BdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVzdDtcbiAgICB9LFxuICBcbiAgICBjc3MgPSBmdW5jdGlvbihlbGVtLCBuYW1lLCB2YWx1ZSkge1xuICAgICAgdmFyIG1hcCA9IHt9LCBjc3NUZXh0ID0gbnVsbDtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgbWFwID0gbmFtZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIG1hcFtuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgY3NzVGV4dCA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGh5cGhlbmF0ZShuYW1lKSArIFwiOiBcIiArIG1hcFtuYW1lXTtcbiAgICAgIH0pLmpvaW4oXCI7IFwiKTtcbiAgICAgIGlmIChjc3NUZXh0ICYmIGNzc1RleHQubGVuZ3RoKSB7XG4gICAgICAgIGVsZW0uc3R5bGUuY3NzVGV4dCA9IGVsZW0uc3R5bGUuY3NzVGV4dCArIGNzc1RleHQ7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW0uc3R5bGVbbmFtZV0gfHwgd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZShuYW1lKTtcbiAgICB9LFxuICBcbiAgICBhdHRyID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gbnVsbCwgb2JqID0ge30sIHByb3A7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9iaiA9IG5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYW1lICE9PSAndW5kZWZpbmVkJyl7XG4gICAgICAgIG9ialtuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gbWFwU3R5bGVzKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGh5cGhlbmF0ZShuYW1lKSArIFwiOiBcIiArIHZhbHVlW25hbWVdO1xuICAgICAgfVxuICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoKSB7XG4gICAgICAgIGZvciAobmFtZSBpbiBvYmopIHtcbiAgICAgICAgICBwcm9wID0gdHlwZW9mIGVsZW1bY2FtZWxpemUobmFtZSldICE9PSAndW5kZWZpbmVkJyA/IGNhbWVsaXplKG5hbWUpIDogaHlwaGVuYXRlKG5hbWUpO1xuICAgICAgICAgIHZhbHVlID0gb2JqW25hbWVdO1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAvLyBTZXRcbiAgICAgICAgICAgIGlmIChuYW1lID09PSAnc3R5bGUnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKG1hcFN0eWxlcykuam9pbihcIjsgXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShwcm9wLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAvLyBHZXRcbiAgICAgICAgICAgIHJlc3VsdCA9IGVsZW0uZ2V0QXR0cmlidXRlKHByb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdCB8fCBlbGVtO1xuICAgIH0sXG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0cyBhIHBhaXIgb2YgYmV6aWVyIGNvbnRyb2wgcG9pbnRzXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRcbiAgICAgKi9cbiAgICBnZXRDb250cm9sUG9pbnRzID0gZnVuY3Rpb24oIHgwLCB5MCwgeDEsIHkxLCB4MiwgeTIsIHQgKSB7XG4gICAgICB0ID0gdHlwZW9mIHQgPT09ICdudW1iZXInID8gdCA6IDAuNTtcbiAgICAgIHZhclxuICAgICAgICBkMDEgPSBzcXJ0KCBwb3coIHgxIC0geDAsIDIgKSArIHBvdyggeTEgLSB5MCwgMiApICksXG4gICAgICAgIGQxMiA9IHNxcnQoIHBvdyggeDIgLSB4MSwgMiApICsgcG93KCB5MiAtIHkxLCAyICkgKSxcbiAgICAgICAgZmEgPSB0ICogZDAxIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBzY2FsaW5nIGZhY3RvciBmb3IgdHJpYW5nbGUgVGFcbiAgICAgICAgZmIgPSB0ICogZDEyIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBkaXR0byBmb3IgVGIsIHNpbXBsaWZpZXMgdG8gZmI9dC1mYVxuICAgICAgICBwMXggPSB4MSAtIGZhICogKCB4MiAtIHgwICksICAgIC8vIHgyLXgwIGlzIHRoZSB3aWR0aCBvZiB0cmlhbmdsZSBUXG4gICAgICAgIHAxeSA9IHkxIC0gZmEgKiAoIHkyIC0geTAgKSwgICAgLy8geTIteTAgaXMgdGhlIGhlaWdodCBvZiBUXG4gICAgICAgIHAyeCA9IHgxICsgZmIgKiAoIHgyIC0geDAgKSxcbiAgICAgICAgcDJ5ID0geTEgKyBmYiAqICggeTIgLSB5MCApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcDE6IHt4OiBwMXgsIHk6IHAxeX0sIFxuICAgICAgICBwMjoge3g6IHAyeCwgeTogcDJ5fVxuICAgICAgfTtcbiAgICB9LFxuICBcbiAgICAvKipcbiAgICAgKiBTZXJpYWxpemVzIHBvaW50cyBhcyBzdmcgcGF0aCBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHtBcnJheX0gcG9pbnRzXG4gICAgICovXG4gICAgZ2V0UGF0aCA9IGZ1bmN0aW9uKCBwb2ludHMgKSB7XG4gICAgICByZXR1cm4gcG9pbnRzLm1hcChmdW5jdGlvbihwb2ludCkge1xuICAgICAgICByZXR1cm4gcG9pbnQueCArIFwiLFwiICsgcG9pbnQueTtcbiAgICAgIH0pLmpvaW4oXCIgXCIpO1xuICAgIH0sXG4gIFxuICBcbiAgICAvKipcbiAgICAgKiBWaXN1YWxpc3QgcXVlcnkgY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBfdiA9IGZ1bmN0aW9uKHNlbGVjdG9yLCB3aWR0aCwgaGVpZ2h0LCBhdHRycykge1xuICAgICAgdmFyIGFyZywgaSwgcywgdywgaCwgYSwgc2V0O1xuICAgICAgZm9yIChpID0gMCwgYXJnOyBhcmcgPSBhcmd1bWVudHNbaV07IGkrKykge1xuICAgICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgJiYgIWlzTmFOKHBhcnNlRmxvYXQoYXJnKSkpIHtcbiAgICAgICAgICAvLyBOdW1lcmljXG4gICAgICAgICAgYXJnID0gdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgPyBwYXJzZUZsb2F0KGFyZykgKyBcInB4XCIgOiBhcmc7XG4gICAgICAgICAgaWYgKHR5cGVvZiB3ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaCA9IGFyZztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdyA9IGFyZztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAvLyBQbGFpbiBvYmplY3RcbiAgICAgICAgICBhID0gYXJnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEV2ZXJ5dGhpbmcgZWxzZSBtYXkgYmUgYSBzZWxlY3RvclxuICAgICAgICAgIHMgPSBhcmc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNldCA9IHMgaW5zdGFuY2VvZiBWaXN1YWxpc3QgPyBzIDogbmV3IFZpc3VhbGlzdChzKTtcbiAgICAgIHNldC5hdHRyKGV4dGVuZCh0cnVlLCBhIHx8IHt9LCB7XG4gICAgICAgIHdpZHRoOiB3LCBcbiAgICAgICAgaGVpZ2h0OiBoXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4gc2V0O1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFZpc3VhbGlzdCBDbGFzc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gVmlzdWFsaXN0KHNlbGVjdG9yKSB7XG4gICAgdmFyIHNldCA9IG51bGwsIGVsZW0sIHJlc3VsdCwgaSwgc3ZnO1xuICAgIC8vIENvbGxlY3QgY29uc3RydWN0b3IgYXJnc1xuICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdvYmplY3QnICYmIHNlbGVjdG9yLm5hbWVzcGFjZVVSSSA9PT0gU1ZHX05BTUVTUEFDRV9VUkkpIHtcbiAgICAgIC8vIEV4aXN0aW5nIEVsZW1lbnRcbiAgICAgIHNldCA9IFtzZWxlY3Rvcl07XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBTZWxlY3RvclxuICAgICAgcmVzdWx0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICBmb3IgKGkgPSAwLCBlbGVtOyBlbGVtID0gcmVzdWx0W2ldOyBpKyspIHtcbiAgICAgICAgaWYgKGVsZW0ubmFtZXNwYWNlVVJJID09PSBTVkdfTkFNRVNQQUNFX1VSSSApIHtcbiAgICAgICAgICBzZXQgPSBzZXQgfHwgW107XG4gICAgICAgICAgc2V0LnB1c2goZWxlbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzZXQpIHtcbiAgICAgIHN2ZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTkFNRVNQQUNFX1VSSSwgJ3N2ZycpO1xuICAgICAgc3ZnLnNldEF0dHJpYnV0ZShcInhtbG5zXCIsIFNWR19OQU1FU1BBQ0VfVVJJKTtcbiAgICAgIHNldCA9IFtzdmddO1xuICAgIH1cbiAgICB0aGlzLnB1c2guYXBwbHkodGhpcywgc2V0IHx8IFtdKTtcbiAgfVxuICBcbiAgVmlzdWFsaXN0LnByb3RvdHlwZSA9IFtdO1xuICBcbiAgLy8gU3RhdGljIG1ldGhvZHNcbiAgX3YuZXh0ZW5kID0gZXh0ZW5kO1xuICBfdi5hdHRyID0gYXR0cjtcbiAgX3YuY3NzID0gY3NzO1xuICBcbiAgLy8gUGx1Z2luIEFQSVxuICBfdi5mbiA9IFZpc3VhbGlzdC5wcm90b3R5cGU7XG4gIFxuICAvKipcbiAgICogRXh0ZW5kcyB2aXN1YWxpc3QgcHJvdG90eXBlXG4gICAqIEBwYXJhbSB7QXJyYXl9IG1ldGhvZHNcbiAgICovXG4gIF92LmZuLmV4dGVuZCA9IGZ1bmN0aW9uKCBtZXRob2RzICkge1xuICAgIGZvciAodmFyIHggaW4gbWV0aG9kcykge1xuICAgICAgVmlzdWFsaXN0LnByb3RvdHlwZVt4XSA9IG1ldGhvZHNbeF07XG4gICAgfVxuICB9O1xuICBcbiAgLy8gUHJpdmF0ZSBDb21wb25lbnRzXG4gIFxuICAvKipcbiAgICogRHJhdyBiYXNpYyBzaGFwZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtc1xuICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICogQHBhcmFtIHtBcnJheX0gY2hpbGRyZW4gXG4gICAqL1xuICBmdW5jdGlvbiBzaGFwZSh0YWdOYW1lLCBwYXJhbXMsIGF0dHJzLCBjaGlsZHJlbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgX3YoZWxlbSkuYXBwZW5kKHNlbGYuY3JlYXRlKHRhZ05hbWUsIGV4dGVuZCh0cnVlLCB7fSwgYXR0cnMsIHBhcmFtcykpLmFwcGVuZChjaGlsZHJlbikpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIFxuICAvLyBQdWJsaWMgQ29tcG9uZW50c1xuICBcbiAgX3YuZm4uZXh0ZW5kKHtcbiAgICAvKipcbiAgICAgKiBBcHBlbmRzIHRoZSBzcGVjaWZpZWQgY2hpbGQgdG8gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBhcHBlbmQ6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcywgY2hpbGRyZW4gPSBjaGlsZCBpbnN0YW5jZW9mIEFycmF5ID8gY2hpbGQgOiBbY2hpbGRdO1xuICAgICAgaWYgKHNlbGZbMF0gJiYgY2hpbGQpIHtcbiAgICAgICAgY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAgIHNlbGZbMF0uYXBwZW5kQ2hpbGQoY2hpbGQubm9kZVR5cGUgPT09IDMgPyBjaGlsZCA6IF92KGNoaWxkKVswXSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBlbGVtZW50cyBpbiB0aGUgc2V0IG9yIHJlbW92ZXMgdGhlIHNwZWNpZmllZCBjaGlsZCBmcm9tIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cy5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICByZW1vdmU6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcywgY2hpbGRyZW4gPSB0eXBlb2YgY2hpbGQgIT09ICd1bmRlZmluZWQnID8gY2hpbGQgaW5zdGFuY2VvZiBBcnJheSA/IGNoaWxkIDogW2NoaWxkXSA6IG51bGw7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBpZiAoY2hpbGRyZW4pIHtcbiAgICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBlbGVtLnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICBlbGVtLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWxlbSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNoaWxkcmVuIGZyb20gZWxlbWVudHMgaW4gdGhlIHNldFxuICAgICAqL1xuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChlbGVtLmNoaWxkTm9kZXNbaV0pO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZSBmb3IgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzIG9yIHNldCBvbmUgb3IgbW9yZSBhdHRyaWJ1dGVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBhdHRyOiBmdW5jdGlvbiggbmFtZSwgdmFsdWUgKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gdGhpcztcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHZhciByZXQgPSBhdHRyKGVsZW0sIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgaWYgKHJldCAhPT0gZWxlbSkge1xuICAgICAgICAgIHJlc3VsdCA9IHJldDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB2YWx1ZSBvZiBhIGNvbXB1dGVkIHN0eWxlIHByb3BlcnR5IGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIENTUyBwcm9wZXJ0aWVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBjc3M6IGZ1bmN0aW9uKCBuYW1lLCB2YWx1ZSApIHtcbiAgICAgIHZhciByZXN1bHQgPSB0aGlzO1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgdmFyIHJldCA9IGNzcyhlbGVtLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmIChyZXQgIT09IGVsZW0pIHtcbiAgICAgICAgICByZXN1bHQgPSByZXQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZWxlbWVudCB3aXRoIHRoZSBzcGVjaWZlZCB0YWduYW1lLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0YWdOYW1lXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbiggdGFnTmFtZSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gX3YoKHRoaXNbMF0gJiYgdGhpc1swXS5vd25lckRvY3VtZW50IHx8IGRvY3VtZW50KS5jcmVhdGVFbGVtZW50TlModGhpc1swXSAmJiB0aGlzWzBdLm5hbWVzcGFjZVVSSSB8fCBTVkdfTkFNRVNQQUNFX1VSSSwgdGFnTmFtZSkpLmF0dHIoYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSB3aWR0aCBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoXG4gICAgICovXG4gICAgd2lkdGg6IGZ1bmN0aW9uKCB3aWR0aCApIHtcbiAgICAgIGNvbnNvbGUud2FybihcImRlcHJlY2F0ZWRcIik7XG4gICAgICBpZiAodHlwZW9mIHdpZHRoID09PSAndW5kZWZpbmVkJyAmJiB0aGlzWzBdKSB7XG4gICAgICAgIHJldHVybiB0aGlzWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRyKCd3aWR0aCcsIHdpZHRoKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSBoZWlnaHQgb24gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKi9cbiAgICBoZWlnaHQ6IGZ1bmN0aW9uKCBoZWlnaHQgKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCJkZXByZWNhdGVkXCIpO1xuICAgICAgaWYgKHR5cGVvZiBoZWlnaHQgPT09ICd1bmRlZmluZWQnICYmIHRoaXNbMF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqL1xuICAgIGJib3g6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdGhpc1swXS5nZXRCQm94KCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbXB1dGVkIHRleHQgbGVuZ3RoIG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgaWYgYXBwbGljYWJsZS5cbiAgICAgKi9cbiAgICBjb21wdXRlZFRleHRMZW5ndGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdGhpc1swXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSBncm91cCBsYXllciBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZ3JvdXA6IGZ1bmN0aW9uKCBhdHRycyApIHtcbiAgICAgIHZhciBnID0gdGhpcy5jcmVhdGUoJ2cnLCBhdHRycyk7XG4gICAgICBfdih0aGlzWzBdKS5hcHBlbmQoZyk7XG4gICAgICByZXR1cm4gZztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgY2lyY2xlIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3hcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3lcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGNpcmNsZTogZnVuY3Rpb24oIGN4LCBjeSwgciwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImNpcmNsZVwiLCB7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHI6IHJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGFuIGVsbGlwc2Ugb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGVsbGlwc2U6IGZ1bmN0aW9uKCBjeCwgY3ksIHJ4LCByeSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImVsbGlwc2VcIiwge1xuICAgICAgICBjeDogY3gsIFxuICAgICAgICBjeTogY3ksIFxuICAgICAgICByeDogcngsXG4gICAgICAgIHJ5OiByeVxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSByZWN0YW5nbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcmVjdDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJyZWN0XCIsIHtcbiAgICAgICAgeDogeCwgXG4gICAgICAgIHk6IHksIFxuICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGxpbmUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGxpbmU6IGZ1bmN0aW9uKCB4MSwgeTEsIHgyLCB5MiwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImxpbmVcIiwge1xuICAgICAgICB4MTogeDEsXG4gICAgICAgIHkxOiB5MSxcbiAgICAgICAgeDI6IHgyLFxuICAgICAgICB5MjogeTJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlnb246IGZ1bmN0aW9uKCBwb2ludHMsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BvbHlnb24nLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBvbHlnb24gb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwb2x5bGluZTogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWxpbmUnLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBhdGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oIGQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BhdGgnLCB7ZDogZH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgdGV4dCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICB0ZXh0OiBmdW5jdGlvbiggeCwgeSwgc3RyaW5nLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICd0ZXh0Jywge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeVxuICAgICAgfSwgYXR0cnMsIFsodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZVRleHROb2RlKHN0cmluZyldKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBzbW9vdGggZ3JhcGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuICAgIGdyYXBoOiBmdW5jdGlvbiggcG9pbnRzLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyXG4gICAgICAgICAgb3B0cyA9IGV4dGVuZCh7XG4gICAgICAgICAgICBzbW9vdGg6IHRydWUsIFxuICAgICAgICAgICAgdGVuc2lvbjogMC40LFxuICAgICAgICAgICAgYXBwcm94aW1hdGU6IHRydWVcbiAgICAgICAgICB9LCBvcHRpb25zKSxcbiAgICAgICAgICB0ID0gIWlzTmFOKCBvcHRzLnRlbnNpb24gKSA/IG9wdHMudGVuc2lvbiA6IDAuNSxcbiAgICAgICAgICBlbCA9IF92KGVsZW0pLCBcbiAgICAgICAgICBwLFxuICAgICAgICAgIGksXG4gICAgICAgICAgYyxcbiAgICAgICAgICBkLFxuICAgICAgICAgIHAxLFxuICAgICAgICAgIHAyLFxuICAgICAgICAgIGNwcyxcbiAgICAgICAgICBwYXRoID0gZWwuY3JlYXRlKCdwYXRoJyksXG4gICAgICAgICAgcGF0aFN0ciA9IFwiXCI7XG4gICAgICAgICAgXG4gICAgICAgIGVsLmFwcGVuZChwYXRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghb3B0cy5zbW9vdGgpIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgcCA9IHBvaW50c1tpXTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBpID4gMCA/IFwiTFwiIDogXCJNXCI7XG4gICAgICAgICAgICBwYXRoU3RyKz0gcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICB9IFxuICAgICAgICB9IGVsc2UgaWYgKG9wdHMuYXBwcm94aW1hdGUpIHtcbiAgICAgICAgICBwID0gcG9pbnRzWzBdO1xuICAgICAgICAgIHBhdGhTdHIrPSBcIk1cIiArIHAueCArIFwiIFwiICsgcC55ICsgXCIgXCI7XG4gICAgICAgICAgZm9yIChpID0gMTsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgYyA9IChwb2ludHNbaV0ueCArIHBvaW50c1tpICsgMV0ueCkgLyAyO1xuICAgICAgICAgICAgICBkID0gKHBvaW50c1tpXS55ICsgcG9pbnRzW2kgKyAxXS55KSAvIDI7XG4gICAgICAgICAgICAgIHBhdGhTdHIrPSBcIlFcIiArIHBvaW50c1tpXS54ICsgXCIgXCIgKyBwb2ludHNbaV0ueSArIFwiIFwiICsgYyArIFwiIFwiICsgZCArIFwiIFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXRoU3RyKz0gXCJUXCIgKyBwb2ludHNbaV0ueCArIFwiIFwiICsgcG9pbnRzW2ldLnkgKyBcIiBcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwID0gcG9pbnRzWzBdO1xuICAgICAgICAgIHBhdGhTdHIrPSBcIk1cIiArIHAueCArIFwiIFwiICsgcC55ICsgXCIgXCI7XG4gICAgICAgICAgZm9yIChpID0gMTsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKz0xKSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzW2kgLSAxXTtcbiAgICAgICAgICAgIHAxID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgcDIgPSBwb2ludHNbaSArIDFdO1xuICAgICAgICAgICAgY3BzID0gZ2V0Q29udHJvbFBvaW50cyhwLngsIHAueSwgcDEueCwgcDEueSwgcDIueCwgcDIueSwgdCk7XG4gICAgICAgICAgICBwYXRoU3RyKz0gXCJDXCIgKyBjcHMucDEueCArIFwiIFwiICsgY3BzLnAxLnkgKyBcIiBcIiArIGNwcy5wMi54ICsgXCIgXCIgKyBjcHMucDIueSArIFwiIFwiICsgcDIueCArIFwiIFwiICsgcDIueSArIFwiIFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXRoU3RyKz0gXCJUXCIgKyBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLnggKyBcIiBcIiArIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0ueSArIFwiIFwiO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBkZWxldGUgb3B0cy5zbW9vdGg7XG4gICAgICAgIGRlbGV0ZSBvcHRzLnRlbnNpb247XG4gICAgICAgIGRlbGV0ZSBvcHRzLmFwcHJveGltYXRlO1xuICAgICAgICBcbiAgICAgICAgcGF0aC5hdHRyKGV4dGVuZChvcHRzLCB7XG4gICAgICAgICAgZDogcGF0aFN0clxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBUaGUgYXJjKCkgbWV0aG9kIGNyZWF0ZXMgYW4gYXJjL2N1cnZlICh1c2VkIHRvIGNyZWF0ZSBjaXJjbGVzLCBvciBwYXJ0cyBvZiBjaXJjbGVzKS4gXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHNBbmdsZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBlQW5nbGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNvdW50ZXJjbG9ja3dpc2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBhcmM6IGZ1bmN0aW9uKHgsIHksIHIsIHNBbmdsZSwgZUFuZ2xlLCBjb3VudGVyY2xvY2t3aXNlLCBhdHRycykge1xuICAgICAgY291bnRlcmNsb2Nrd2lzZSA9IHR5cGVvZiBjb3VudGVyY2xvY2t3aXNlID09PSAnYm9vbGVhbicgPyBjb3VudGVyY2xvY2t3aXNlIDogZmFsc2U7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInBhdGhcIiwge1xuICAgICAgICBkOiBcIk1cIiArIHggKyBcIixcIiArIHkgKyBcbiAgICAgICAgICBcIiBMXCIgKyAoeCArIGNvcyhzQW5nbGUpICogcikgKyBcIixcIiArICh5ICsgc2luKHNBbmdsZSkgKiByKSArXG4gICAgICAgICAgXCIgQVwiICsgciArIFwiLFwiICsgciArIFwiIDAgXCIgKyAoZUFuZ2xlIC0gc0FuZ2xlID4gUEkgPyAxIDogMCkgKyBcIixcIiArIChjb3VudGVyY2xvY2t3aXNlID8gMCA6IDEpICtcbiAgICAgICAgICBcIiBcIiArICh4ICsgY29zKGVBbmdsZSkgKiByKSArIFwiLFwiICsgKHkgKyBzaW4oZUFuZ2xlKSAqIHIpICsgXCIgWlwiXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIHRleHQgaW50byBhIGJvdW5kaW5nIGJveCBieSB3cmFwcGluZyBsaW5lcyBhdCBzcGFjZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0geVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB3aWR0aFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RyaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgdGV4dGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIHN0cmluZywgYXR0cnMgKSB7XG4gICAgICBcbiAgICAgIHZhciBcbiAgICAgICAgc2VsZiA9IHRoaXM7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICBsaW5lcyA9IHdpZHRoID8gW10gOiBbc3RyaW5nXSwgXG4gICAgICAgICAgbGluZSA9IFtdLFxuICAgICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgICAgd29yZHMgPSB3aWR0aCA/IHN0cmluZy5zcGxpdCgvXFxzKy8pIDogW10sXG4gICAgICAgICAgdGV4dCA9IHNlbGYuY3JlYXRlKCd0ZXh0JywgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywge1xuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHlcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgdGV4dE5vZGUsXG4gICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICB0ZXh0QWxpZ24gPSB0ZXh0LmNzcygndGV4dC1hbGlnbicpLFxuICAgICAgICAgIHR5ID0gMDtcbiAgICAgICAgXG4gICAgICAgIF92ZWxlbS5hcHBlbmQodGV4dCk7XG4gICAgICAgIFxuICAgICAgICBcbiAgICAgICAgaWYgKHdpZHRoKSB7XG4gICAgICAgICAgLy8gQnJlYWsgbGluZXNcbiAgICAgICAgICB0ZXh0Tm9kZSA9IGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgICB0ZXh0LmFwcGVuZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgd29yZHMuZm9yRWFjaChmdW5jdGlvbih3b3JkLCBpbmRleCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGxpbmUuam9pbignICcpICsgJyAnICsgd29yZDtcbiAgICAgICAgICAgIGxlbmd0aCA9IHRleHQuY29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICAgIGxpbmUgPSBbd29yZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lLnB1c2god29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5kZXggPT09IHdvcmRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGV4dC5yZW1vdmUodGV4dE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZW5kZXIgbGluZXNcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbihsaW5lLCBpbmRleCkge1xuICAgICAgICAgIHZhciB0c3BhbiwgZHk7XG4gICAgICAgICAgaWYgKCFoZWlnaHQgfHwgdHkgKyBwYXJzZUZsb2F0KGxpbmVIZWlnaHQpIDwgaGVpZ2h0KSB7XG4gICAgICAgICAgICBkeSA9IGluZGV4ID4gMCA/IGxpbmVIZWlnaHQgOiBmb250U2l6ZSAtIDI7XG4gICAgICAgICAgICB0eSs9IGR5O1xuICAgICAgICAgICAgdHNwYW4gPSBzZWxmLmNyZWF0ZSgndHNwYW4nLCB7ZHk6IGR5fSk7XG4gICAgICAgICAgICB0ZXh0LmFwcGVuZCh0c3Bhbik7XG4gICAgICAgICAgICB0c3BhblxuICAgICAgICAgICAgICAuYXBwZW5kKGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lKSlcbiAgICAgICAgICAgICAgLmF0dHIoJ3gnLCBwYXJzZUludCh0ZXh0LmF0dHIoJ3gnKSwgdW5kZWZpbmVkKSArICh3aWR0aCAtIHRzcGFuLmNvbXB1dGVkVGV4dExlbmd0aCgpKSAqICh0ZXh0QWxpZ24gPT09ICdlbmQnIHx8IHRleHRBbGlnbiA9PT0gJ3JpZ2h0JyA/IDEgOiB0ZXh0QWxpZ24gPT09ICdjZW50ZXInIHx8IHRleHRBbGlnbiA9PT0gJ21pZGRsZScgPyAwLjUgOiAwKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdDogZnVuY3Rpb24oIHgsIHksIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGJveCh4LCB5LCAwLCAwLCBpdGVtcywgb3B0aW9ucyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0IGludG8gdGhlIHNwZWNpZmllZCBib3VuZHMuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICBpdGVtcyA9IChpdGVtcyB8fCBbXSkubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJyA/IHtsYWJlbDogaXRlbX0gOiBpdGVtO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgXG4gICAgICBvcHRpb25zID0gZXh0ZW5kKHt9LCB7XG4gICAgICAgIGhvcml6b250YWw6IGZhbHNlLFxuICAgICAgICBidWxsZXQ6IHtcbiAgICAgICAgICBzaGFwZTogJ3JlY3QnXG4gICAgICAgIH1cbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyIHRvcCA9IHk7XG4gICAgICAgIFxuICAgICAgICBpdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgXG4gICAgICAgICAgdmFyXG4gICAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICAgIGl0ZW1PcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRpb25zLCBpdGVtKSxcbiAgICAgICAgICAgIGhvcml6b250YWwgPSBpdGVtT3B0cy5ob3Jpem9udGFsLFxuICAgICAgICAgICAgc2hhcGUgPSBpdGVtT3B0cy5idWxsZXQuc2hhcGUsXG4gICAgICAgICAgICBsYWJlbCA9IGl0ZW1PcHRzLmxhYmVsLFxuICAgICAgICAgICAgYnVsbGV0QXR0cnMsXG4gICAgICAgICAgICBpdGVtTGF5ZXIgPSBfdmVsZW0uZ3JvdXAoKSxcbiAgICAgICAgICAgIGxpbmVIZWlnaHQgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2xpbmUtaGVpZ2h0JykpLFxuICAgICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICAgIGJ1bGxldFNpemUgPSBmb250U2l6ZSAqIDAuNjUsXG4gICAgICAgICAgICBzcGFjaW5nID0gbGluZUhlaWdodCAqIDAuMjUsXG4gICAgICAgICAgICBpdGVtV2lkdGgsXG4gICAgICAgICAgICBpdGVtSGVpZ2h0O1xuICAgICAgICAgIFxuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5idWxsZXQuc2hhcGU7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmhvcml6b250YWw7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmxhYmVsO1xuICAgICAgICAgIFxuICAgICAgICAgIGJ1bGxldEF0dHJzID0gZXh0ZW5kKHRydWUsIHt9LCBpdGVtT3B0cywgaXRlbU9wdHMuYnVsbGV0KTsgXG4gICAgICAgICAgXG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmJ1bGxldDtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaGVpZ2h0ICYmIHkgKyBmb250U2l6ZSA+IHRvcCArIGhlaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW5kZXIgYnVsbGV0XG4gICAgICAgICAgaWYgKHNoYXBlID09PSAnY2lyY2xlJykge1xuICAgICAgICAgICAgaXRlbUxheWVyLmNpcmNsZSh4ICsgYnVsbGV0U2l6ZSAqIDAuNSwgZmxvb3IoeSkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAqIDAuNSArIGJ1bGxldFNpemUgKiAwLjUsIGJ1bGxldFNpemUgKiAwLjUsIGJ1bGxldEF0dHJzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlbUxheWVyLnJlY3QoeCwgTWF0aC5mbG9vcih5KSArIChmb250U2l6ZSAtIGJ1bGxldFNpemUpICogMC41LCBidWxsZXRTaXplLCBidWxsZXRTaXplLCBidWxsZXRBdHRycyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIFJlbmRlciBsYWJlbFxuICAgICAgICAgIGl0ZW1MYXllci50ZXh0Ym94KHggKyBidWxsZXRTaXplICsgc3BhY2luZywgZmxvb3IoeSksIHdpZHRoID8gd2lkdGggLSBidWxsZXRTaXplIC0gc3BhY2luZyA6IDAsIGhlaWdodCA/IHRvcCArIGhlaWdodCAtIHkgOiAwLCBsYWJlbCwgaXRlbU9wdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIGl0ZW1XaWR0aCA9IGZsb29yKGl0ZW1MYXllci5iYm94KCkud2lkdGgpO1xuICAgICAgICAgIGl0ZW1IZWlnaHQgPSBmbG9vcihpdGVtTGF5ZXIuYmJveCgpLmhlaWdodCArIChsaW5lSGVpZ2h0IC0gZm9udFNpemUpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgeCs9IGl0ZW1XaWR0aCArIGZvbnRTaXplO1xuICAgICAgICAgICAgaWYgKHdpZHRoICYmIHggPiB3aWR0aCkge1xuICAgICAgICAgICAgICB5Kz0gaXRlbUhlaWdodDtcbiAgICAgICAgICAgICAgeCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHkrPSBpdGVtSGVpZ2h0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9KTtcbiAgXG4gIHJldHVybiBfdjtcbiAgXG59KCkpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IF92OyJdfQ==
