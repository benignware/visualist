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
    
    toArray = function(obj) {
      
      //return obj && (obj.length && [].slice.call(obj) || [obj]);
      
      if (typeof obj === "undefined") {
        return [];
      }
      
      var l = obj && obj.length || 0, i, result = [];
      for (i = 0; i < l; i++) {
        if (obj[i]) {
          result.push(obj[i]);
        }
      }
      
      return result.length && result || [obj];
    },
    
    // DOM Manipulation
    
    /**
     * 
     */
    
    parent = function(elem) {
      return elem.parentNode;
    },
    
    append = function( parent, child ) {
      parent = parent[0] || parent;
      toArray(child).forEach(function(child) {
        parent.appendChild(child);
      });
    },
    
    prepend = function( parent, child ) {
      parent = parent[0] || parent;
      toArray(child).forEach(function(child) {
        parent.insertBefore(child, parent.firstChild);
      });
    },
    
    remove = function( elem, child ) {
      if (child) {
        toArray(child).forEach(function(child) {
          elem.removeChild(child);
        });
      } else if (elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    },
    
    html = function(elem, string) {
      if (string) {
        elem.innerHTML = string;
      }
      return elem.innerHTML;
    },
    
    text = function(elem) {
      return elem.textContent;
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
      return result;
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
        return null;
      }
      return elem.style[name] || window.getComputedStyle(elem, null).getPropertyValue(name);
    },
    
    addClass = function(elem, className) {
      elem.classList.add(className);
    },
    
    hasClass = function(elem, className) {
      return elem.classList.contains(className);
    },
    
    removeClass = function(elem, className) {
      elem.classList.remove(className);
    },
    
    toggleClass = function(elem, className) {
      elem.classList.toggle(className);
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
    
    size: function() {
      return this.length;
    },
    
    toArray: function() {
      return toArray(this);
    },
    
    get: function( index ) {
      return typeof index !== 'undefined' ? index < 0 ? this[this.length - index] : this[index] : this.toArray();
    },
    
    index: function() {
      return this[0] && toArray(this[0].parentNode.children).indexOf(this[0]) || -1;
    },
    
    /**
     * Appends the specified child to the first element in the set.
     * @param {Object} child
     */
    append: function( child ) {
      if (this[0]) {
        append(this[0], child);
      }
      return this;
    },
    /**
     * Appends the current set of elements to the specified parent
     * @param {Object} child
     */
    appendTo: function( parent ) {
      this.forEach(function(elem) {
        append(parent, elem);
      });
      return this;
    },
    /**
     * Prepends the specified child to the first element in the set.
     * @param {Object} child
     */
    prepend: function( child ) {
      if (this[0]) {
        prepend(this[0], child);
      }
      return this;
    },
    /**
     * Prepends the current set of elements to the specified parent
     * @param {Object} child
     */
    prependTo: function( parent ) {
      this.forEach(function(elem) {
        prepend(parent, elem);
      });
      return this;
    },
    /**
     * Removes all elements in the set or removes the specified child from the set of matched elements.
     * @param {Object} child
     */
    remove: function( child ) {
      this.forEach(function(elem) {
        remove(elem, child);
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
      return this;
    },
    /**
     * Returns the parent node of the first element in the set.
     */
    parent: function() {
      return this[0] && parent(this[0]);
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
        if (ret !== null) {
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
        if (ret !== null) {
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
      //console.warn("deprecated");
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
      //console.warn("deprecated");
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
    g: function( attrs ) {
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
            smooth: false, 
            tension: 0.4,
            approximate: false
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
        
        path.attr(extend({
          fill: 'none'
        }, opts, {
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
    arc: function(cx, cy, r, sAngle, eAngle, counterclockwise, attrs) {
      counterclockwise = typeof counterclockwise === 'boolean' ? counterclockwise : false;
      var d = 'M ' + cx + ' ' + cy;
      if (eAngle - sAngle === Math.PI * 2) {
        // Circle
        d+= ' m -' + r + ', 0 a ' + r + ',' + r + ' 0 1,0 ' + (r * 2) + ',0 a ' + r + ',' + r + ' 0 1,0 -' + (r * 2) + ',0';
      } else {
        d+= " L" + (cx + cos(sAngle) * r) + "," + (cy + sin(sAngle) * r) +
          " A" + r + "," + r + " 0 " + (eAngle - sAngle > PI ? 1 : 0) + "," + (counterclockwise ? 0 : 1) +
          " " + (cx + cos(eAngle) * r) + "," + (cy + sin(eAngle) * r) + " Z";
      }
      return shape.call(this, "path", {
        d: d
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
      
      items = toArray(items).map(function(item) {
        return typeof item === 'string' ? {label: item} : item;
      });
      
      options = options || {};
      
      options = extend({}, {
        horizontal: false,
        bullet: {
          shape: 'circle'
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
            itemLayer = _velem.g(),
            lineHeight = parseFloat(_velem.css('line-height')),
            fontSize = parseFloat(_velem.css('font-size')),
            bulletSize = fontSize * 0.65,
            spacing = lineHeight * 0.2,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgX3YgPSAoZnVuY3Rpb24oKSB7XG4gIFxuICBcbiAgdmFyIFxuICAgIFNWR19OQU1FU1BBQ0VfVVJJID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLFxuICAgIE1BVEggPSBNYXRoLFxuICAgIFBJID0gTUFUSC5QSSxcbiAgICBjb3MgPSBNQVRILmNvcyxcbiAgICBzaW4gPSBNQVRILnNpbixcbiAgICBzcXJ0ID0gTUFUSC5zcXJ0LFxuICAgIHBvdyA9IE1BVEgucG93LFxuICAgIGZsb29yID0gTUFUSC5mbG9vcixcbiAgXG4gICAgLyoqXG4gICAgICogQ2FtZWxpemUgYSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nXG4gICAgICovIFxuICAgIGNhbWVsaXplID0gKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNhY2hlID0ge307XG4gICAgICByZXR1cm4gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBjYWNoZVtzdHJpbmddID0gY2FjaGVbc3RyaW5nXSB8fCAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC8oXFwtW2Etel0pL2csIGZ1bmN0aW9uKCQxKXtyZXR1cm4gJDEudG9VcHBlckNhc2UoKS5yZXBsYWNlKCctJywnJyk7fSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gIFxuICAgIC8qKlxuICAgICAqIEh5cGhlbmF0ZSBhIHN0cmluZ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKi9cbiAgICBoeXBoZW5hdGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlW3N0cmluZ10gPSBjYWNoZVtzdHJpbmddIHx8IChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLyhbQS1aXSkvZywgZnVuY3Rpb24oJDEpe3JldHVybiBcIi1cIiskMS50b0xvd2VyQ2FzZSgpO30pO1xuICAgICAgICB9KSgpO1xuICAgICAgfTtcbiAgICB9KSgpLFxuICBcbiAgICAvKipcbiAgICAgKiBFeHRlbmRzIGFuIG9iamVjdFxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gdHJ1ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXN0aW5hdGlvblxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2VcbiAgICAgKi9cbiAgICBleHRlbmQgPSBmdW5jdGlvbihkZWVwLCBkZXN0aW5hdGlvbiwgc291cmNlKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cywgaSA9IHR5cGVvZiBkZWVwID09PSAnYm9vbGVhbicgPyAyIDogMSwgZGVzdCA9IGFyZ3VtZW50c1tpIC0gMV0sIHNyYywgcHJvcCwgdmFsdWU7XG4gICAgICBmb3IgKDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3JjID0gYXJnc1tpXTtcbiAgICAgICAgZm9yIChwcm9wIGluIHNyYykge1xuICAgICAgICAgIHZhbHVlID0gc3JjW3Byb3BdO1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICAgIGRlc3RbcHJvcF0gPSBkZXN0W3Byb3BdIHx8IHt9O1xuICAgICAgICAgICAgICBpZiAoZGVlcCkge1xuICAgICAgICAgICAgICAgIGV4dGVuZCh0cnVlLCBkZXN0W3Byb3BdLCB2YWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRlc3RbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkZXN0O1xuICAgIH0sXG4gICAgXG4gICAgdG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgXG4gICAgICAvL3JldHVybiBvYmogJiYgKG9iai5sZW5ndGggJiYgW10uc2xpY2UuY2FsbChvYmopIHx8IFtvYmpdKTtcbiAgICAgIFxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbCA9IG9iaiAmJiBvYmoubGVuZ3RoIHx8IDAsIGksIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAob2JqW2ldKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2gob2JqW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0Lmxlbmd0aCAmJiByZXN1bHQgfHwgW29ial07XG4gICAgfSxcbiAgICBcbiAgICAvLyBET00gTWFuaXB1bGF0aW9uXG4gICAgXG4gICAgLyoqXG4gICAgICogXG4gICAgICovXG4gICAgXG4gICAgcGFyZW50ID0gZnVuY3Rpb24oZWxlbSkge1xuICAgICAgcmV0dXJuIGVsZW0ucGFyZW50Tm9kZTtcbiAgICB9LFxuICAgIFxuICAgIGFwcGVuZCA9IGZ1bmN0aW9uKCBwYXJlbnQsIGNoaWxkICkge1xuICAgICAgcGFyZW50ID0gcGFyZW50WzBdIHx8IHBhcmVudDtcbiAgICAgIHRvQXJyYXkoY2hpbGQpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgXG4gICAgcHJlcGVuZCA9IGZ1bmN0aW9uKCBwYXJlbnQsIGNoaWxkICkge1xuICAgICAgcGFyZW50ID0gcGFyZW50WzBdIHx8IHBhcmVudDtcbiAgICAgIHRvQXJyYXkoY2hpbGQpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShjaGlsZCwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBcbiAgICByZW1vdmUgPSBmdW5jdGlvbiggZWxlbSwgY2hpbGQgKSB7XG4gICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgdG9BcnJheShjaGlsZCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAgIGVsZW0ucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoZWxlbS5wYXJlbnROb2RlKSB7XG4gICAgICAgIGVsZW0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbGVtKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIGh0bWwgPSBmdW5jdGlvbihlbGVtLCBzdHJpbmcpIHtcbiAgICAgIGlmIChzdHJpbmcpIHtcbiAgICAgICAgZWxlbS5pbm5lckhUTUwgPSBzdHJpbmc7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWxlbS5pbm5lckhUTUw7XG4gICAgfSxcbiAgICBcbiAgICB0ZXh0ID0gZnVuY3Rpb24oZWxlbSkge1xuICAgICAgcmV0dXJuIGVsZW0udGV4dENvbnRlbnQ7XG4gICAgfSxcbiAgICBcbiAgICBhdHRyID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gbnVsbCwgb2JqID0ge30sIHByb3A7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG9iaiA9IG5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYW1lICE9PSAndW5kZWZpbmVkJyl7XG4gICAgICAgIG9ialtuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgZnVuY3Rpb24gbWFwU3R5bGVzKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGh5cGhlbmF0ZShuYW1lKSArIFwiOiBcIiArIHZhbHVlW25hbWVdO1xuICAgICAgfVxuICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoKSB7XG4gICAgICAgIGZvciAobmFtZSBpbiBvYmopIHtcbiAgICAgICAgICBwcm9wID0gdHlwZW9mIGVsZW1bY2FtZWxpemUobmFtZSldICE9PSAndW5kZWZpbmVkJyA/IGNhbWVsaXplKG5hbWUpIDogaHlwaGVuYXRlKG5hbWUpO1xuICAgICAgICAgIHZhbHVlID0gb2JqW25hbWVdO1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAvLyBTZXRcbiAgICAgICAgICAgIGlmIChuYW1lID09PSAnc3R5bGUnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKG1hcFN0eWxlcykuam9pbihcIjsgXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShwcm9wLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAvLyBHZXRcbiAgICAgICAgICAgIHJlc3VsdCA9IGVsZW0uZ2V0QXR0cmlidXRlKHByb3ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICBcbiAgICBjc3MgPSBmdW5jdGlvbihlbGVtLCBuYW1lLCB2YWx1ZSkge1xuICAgICAgdmFyIG1hcCA9IHt9LCBjc3NUZXh0ID0gbnVsbDtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgbWFwID0gbmFtZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIG1hcFtuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgY3NzVGV4dCA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGh5cGhlbmF0ZShuYW1lKSArIFwiOiBcIiArIG1hcFtuYW1lXTtcbiAgICAgIH0pLmpvaW4oXCI7IFwiKTtcbiAgICAgIGlmIChjc3NUZXh0ICYmIGNzc1RleHQubGVuZ3RoKSB7XG4gICAgICAgIGVsZW0uc3R5bGUuY3NzVGV4dCA9IGVsZW0uc3R5bGUuY3NzVGV4dCArIGNzc1RleHQ7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW0uc3R5bGVbbmFtZV0gfHwgd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZShuYW1lKTtcbiAgICB9LFxuICAgIFxuICAgIGFkZENsYXNzID0gZnVuY3Rpb24oZWxlbSwgY2xhc3NOYW1lKSB7XG4gICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9LFxuICAgIFxuICAgIGhhc0NsYXNzID0gZnVuY3Rpb24oZWxlbSwgY2xhc3NOYW1lKSB7XG4gICAgICByZXR1cm4gZWxlbS5jbGFzc0xpc3QuY29udGFpbnMoY2xhc3NOYW1lKTtcbiAgICB9LFxuICAgIFxuICAgIHJlbW92ZUNsYXNzID0gZnVuY3Rpb24oZWxlbSwgY2xhc3NOYW1lKSB7XG4gICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICB9LFxuICAgIFxuICAgIHRvZ2dsZUNsYXNzID0gZnVuY3Rpb24oZWxlbSwgY2xhc3NOYW1lKSB7XG4gICAgICBlbGVtLmNsYXNzTGlzdC50b2dnbGUoY2xhc3NOYW1lKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIEdldHMgYSBwYWlyIG9mIGJlemllciBjb250cm9sIHBvaW50c1xuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB0XG4gICAgICovXG4gICAgZ2V0Q29udHJvbFBvaW50cyA9IGZ1bmN0aW9uKCB4MCwgeTAsIHgxLCB5MSwgeDIsIHkyLCB0ICkge1xuICAgICAgdCA9IHR5cGVvZiB0ID09PSAnbnVtYmVyJyA/IHQgOiAwLjU7XG4gICAgICB2YXJcbiAgICAgICAgZDAxID0gc3FydCggcG93KCB4MSAtIHgwLCAyICkgKyBwb3coIHkxIC0geTAsIDIgKSApLFxuICAgICAgICBkMTIgPSBzcXJ0KCBwb3coIHgyIC0geDEsIDIgKSArIHBvdyggeTIgLSB5MSwgMiApICksXG4gICAgICAgIGZhID0gdCAqIGQwMSAvICggZDAxICsgZDEyICksICAgLy8gc2NhbGluZyBmYWN0b3IgZm9yIHRyaWFuZ2xlIFRhXG4gICAgICAgIGZiID0gdCAqIGQxMiAvICggZDAxICsgZDEyICksICAgLy8gZGl0dG8gZm9yIFRiLCBzaW1wbGlmaWVzIHRvIGZiPXQtZmFcbiAgICAgICAgcDF4ID0geDEgLSBmYSAqICggeDIgLSB4MCApLCAgICAvLyB4Mi14MCBpcyB0aGUgd2lkdGggb2YgdHJpYW5nbGUgVFxuICAgICAgICBwMXkgPSB5MSAtIGZhICogKCB5MiAtIHkwICksICAgIC8vIHkyLXkwIGlzIHRoZSBoZWlnaHQgb2YgVFxuICAgICAgICBwMnggPSB4MSArIGZiICogKCB4MiAtIHgwICksXG4gICAgICAgIHAyeSA9IHkxICsgZmIgKiAoIHkyIC0geTAgKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHAxOiB7eDogcDF4LCB5OiBwMXl9LCBcbiAgICAgICAgcDI6IHt4OiBwMngsIHk6IHAyeX1cbiAgICAgIH07XG4gICAgfSxcbiAgXG4gICAgLyoqXG4gICAgICogU2VyaWFsaXplcyBwb2ludHMgYXMgc3ZnIHBhdGggZGVmaW5pdGlvblxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBvaW50c1xuICAgICAqL1xuICAgIGdldFBhdGggPSBmdW5jdGlvbiggcG9pbnRzICkge1xuICAgICAgcmV0dXJuIHBvaW50cy5tYXAoZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHBvaW50LnggKyBcIixcIiArIHBvaW50Lnk7XG4gICAgICB9KS5qb2luKFwiIFwiKTtcbiAgICB9LFxuICBcbiAgXG4gICAgLyoqXG4gICAgICogVmlzdWFsaXN0IHF1ZXJ5IGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgX3YgPSBmdW5jdGlvbihzZWxlY3Rvciwgd2lkdGgsIGhlaWdodCwgYXR0cnMpIHtcbiAgICAgIHZhciBhcmcsIGksIHMsIHcsIGgsIGEsIHNldDtcbiAgICAgIGZvciAoaSA9IDAsIGFyZzsgYXJnID0gYXJndW1lbnRzW2ldOyBpKyspIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8IHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnICYmICFpc05hTihwYXJzZUZsb2F0KGFyZykpKSB7XG4gICAgICAgICAgLy8gTnVtZXJpY1xuICAgICAgICAgIGFyZyA9IHR5cGVvZiBhcmcgPT09ICdudW1iZXInID8gcGFyc2VGbG9hdChhcmcpICsgXCJweFwiIDogYXJnO1xuICAgICAgICAgIGlmICh0eXBlb2YgdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGggPSBhcmc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHcgPSBhcmc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZy5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgLy8gUGxhaW4gb2JqZWN0XG4gICAgICAgICAgYSA9IGFyZztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBFdmVyeXRoaW5nIGVsc2UgbWF5IGJlIGEgc2VsZWN0b3JcbiAgICAgICAgICBzID0gYXJnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzZXQgPSBzIGluc3RhbmNlb2YgVmlzdWFsaXN0ID8gcyA6IG5ldyBWaXN1YWxpc3Qocyk7XG4gICAgICBzZXQuYXR0cihleHRlbmQodHJ1ZSwgYSB8fCB7fSwge1xuICAgICAgICB3aWR0aDogdywgXG4gICAgICAgIGhlaWdodDogaFxuICAgICAgfSkpO1xuICAgICAgcmV0dXJuIHNldDtcbiAgICB9O1xuXG4gIC8qKlxuICAgKiBWaXN1YWxpc3QgQ2xhc3NcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yXG4gICAqL1xuXG4gIGZ1bmN0aW9uIFZpc3VhbGlzdChzZWxlY3Rvcikge1xuICAgIHZhciBzZXQgPSBudWxsLCBlbGVtLCByZXN1bHQsIGksIHN2ZztcbiAgICAvLyBDb2xsZWN0IGNvbnN0cnVjdG9yIGFyZ3NcbiAgICBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnb2JqZWN0JyAmJiBzZWxlY3Rvci5uYW1lc3BhY2VVUkkgPT09IFNWR19OQU1FU1BBQ0VfVVJJKSB7XG4gICAgICAvLyBFeGlzdGluZyBFbGVtZW50XG4gICAgICBzZXQgPSBbc2VsZWN0b3JdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gU2VsZWN0b3JcbiAgICAgIHJlc3VsdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgZm9yIChpID0gMCwgZWxlbTsgZWxlbSA9IHJlc3VsdFtpXTsgaSsrKSB7XG4gICAgICAgIGlmIChlbGVtLm5hbWVzcGFjZVVSSSA9PT0gU1ZHX05BTUVTUEFDRV9VUkkgKSB7XG4gICAgICAgICAgc2V0ID0gc2V0IHx8IFtdO1xuICAgICAgICAgIHNldC5wdXNoKGVsZW0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghc2V0KSB7XG4gICAgICBzdmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05BTUVTUEFDRV9VUkksICdzdmcnKTtcbiAgICAgIHN2Zy5zZXRBdHRyaWJ1dGUoXCJ4bWxuc1wiLCBTVkdfTkFNRVNQQUNFX1VSSSk7XG4gICAgICBzZXQgPSBbc3ZnXTtcbiAgICB9XG4gICAgdGhpcy5wdXNoLmFwcGx5KHRoaXMsIHNldCB8fCBbXSk7XG4gIH1cbiAgXG4gIFZpc3VhbGlzdC5wcm90b3R5cGUgPSBbXTtcbiAgXG4gIC8vIFN0YXRpYyBtZXRob2RzXG4gIF92LmV4dGVuZCA9IGV4dGVuZDtcbiAgX3YuYXR0ciA9IGF0dHI7XG4gIF92LmNzcyA9IGNzcztcbiAgXG4gIC8vIFBsdWdpbiBBUElcbiAgX3YuZm4gPSBWaXN1YWxpc3QucHJvdG90eXBlO1xuICBcbiAgLyoqXG4gICAqIEV4dGVuZHMgdmlzdWFsaXN0IHByb3RvdHlwZVxuICAgKiBAcGFyYW0ge0FycmF5fSBtZXRob2RzXG4gICAqL1xuICBfdi5mbi5leHRlbmQgPSBmdW5jdGlvbiggbWV0aG9kcyApIHtcbiAgICBmb3IgKHZhciB4IGluIG1ldGhvZHMpIHtcbiAgICAgIFZpc3VhbGlzdC5wcm90b3R5cGVbeF0gPSBtZXRob2RzW3hdO1xuICAgIH1cbiAgfTtcbiAgXG4gIC8vIFByaXZhdGUgQ29tcG9uZW50c1xuICBcbiAgLyoqXG4gICAqIERyYXcgYmFzaWMgc2hhcGVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0YWdOYW1lXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXNcbiAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAqIEBwYXJhbSB7QXJyYXl9IGNoaWxkcmVuIFxuICAgKi9cbiAgZnVuY3Rpb24gc2hhcGUodGFnTmFtZSwgcGFyYW1zLCBhdHRycywgY2hpbGRyZW4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIF92KGVsZW0pLmFwcGVuZChzZWxmLmNyZWF0ZSh0YWdOYW1lLCBleHRlbmQodHJ1ZSwge30sIGF0dHJzLCBwYXJhbXMpKS5hcHBlbmQoY2hpbGRyZW4pKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBcbiAgLy8gUHVibGljIENvbXBvbmVudHNcbiAgXG4gIF92LmZuLmV4dGVuZCh7XG4gICAgXG4gICAgc2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5sZW5ndGg7XG4gICAgfSxcbiAgICBcbiAgICB0b0FycmF5OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0b0FycmF5KHRoaXMpO1xuICAgIH0sXG4gICAgXG4gICAgZ2V0OiBmdW5jdGlvbiggaW5kZXggKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIGluZGV4ICE9PSAndW5kZWZpbmVkJyA/IGluZGV4IDwgMCA/IHRoaXNbdGhpcy5sZW5ndGggLSBpbmRleF0gOiB0aGlzW2luZGV4XSA6IHRoaXMudG9BcnJheSgpO1xuICAgIH0sXG4gICAgXG4gICAgaW5kZXg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdG9BcnJheSh0aGlzWzBdLnBhcmVudE5vZGUuY2hpbGRyZW4pLmluZGV4T2YodGhpc1swXSkgfHwgLTE7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBBcHBlbmRzIHRoZSBzcGVjaWZpZWQgY2hpbGQgdG8gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBhcHBlbmQ6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIGlmICh0aGlzWzBdKSB7XG4gICAgICAgIGFwcGVuZCh0aGlzWzBdLCBjaGlsZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEFwcGVuZHMgdGhlIGN1cnJlbnQgc2V0IG9mIGVsZW1lbnRzIHRvIHRoZSBzcGVjaWZpZWQgcGFyZW50XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgYXBwZW5kVG86IGZ1bmN0aW9uKCBwYXJlbnQgKSB7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBhcHBlbmQocGFyZW50LCBlbGVtKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQcmVwZW5kcyB0aGUgc3BlY2lmaWVkIGNoaWxkIHRvIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgcHJlcGVuZDogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgaWYgKHRoaXNbMF0pIHtcbiAgICAgICAgcHJlcGVuZCh0aGlzWzBdLCBjaGlsZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFByZXBlbmRzIHRoZSBjdXJyZW50IHNldCBvZiBlbGVtZW50cyB0byB0aGUgc3BlY2lmaWVkIHBhcmVudFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIHByZXBlbmRUbzogZnVuY3Rpb24oIHBhcmVudCApIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHByZXBlbmQocGFyZW50LCBlbGVtKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBlbGVtZW50cyBpbiB0aGUgc2V0IG9yIHJlbW92ZXMgdGhlIHNwZWNpZmllZCBjaGlsZCBmcm9tIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cy5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICByZW1vdmU6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHJlbW92ZShlbGVtLCBjaGlsZCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBjaGlsZHJlbiBmcm9tIGVsZW1lbnRzIGluIHRoZSBzZXRcbiAgICAgKi9cbiAgICBjbGVhcjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW0uY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGVsZW0ucmVtb3ZlQ2hpbGQoZWxlbS5jaGlsZE5vZGVzW2ldKTtcbiAgICAgICAgICBpLS07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBwYXJlbnQgbm9kZSBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqL1xuICAgIHBhcmVudDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpc1swXSAmJiBwYXJlbnQodGhpc1swXSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGFuIGF0dHJpYnV0ZSBmb3IgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzIG9yIHNldCBvbmUgb3IgbW9yZSBhdHRyaWJ1dGVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBhdHRyOiBmdW5jdGlvbiggbmFtZSwgdmFsdWUgKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gdGhpcztcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHZhciByZXQgPSBhdHRyKGVsZW0sIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgaWYgKHJldCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IHJldDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB2YWx1ZSBvZiBhIGNvbXB1dGVkIHN0eWxlIHByb3BlcnR5IGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIENTUyBwcm9wZXJ0aWVzIGZvciBldmVyeSBtYXRjaGVkIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAgICAgKi9cbiAgICBjc3M6IGZ1bmN0aW9uKCBuYW1lLCB2YWx1ZSApIHtcbiAgICAgIHZhciByZXN1bHQgPSB0aGlzO1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgdmFyIHJldCA9IGNzcyhlbGVtLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmIChyZXQgIT09IG51bGwpIHtcbiAgICAgICAgICByZXN1bHQgPSByZXQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgZWxlbWVudCB3aXRoIHRoZSBzcGVjaWZlZCB0YWduYW1lLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0YWdOYW1lXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbiggdGFnTmFtZSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gX3YoKHRoaXNbMF0gJiYgdGhpc1swXS5vd25lckRvY3VtZW50IHx8IGRvY3VtZW50KS5jcmVhdGVFbGVtZW50TlModGhpc1swXSAmJiB0aGlzWzBdLm5hbWVzcGFjZVVSSSB8fCBTVkdfTkFNRVNQQUNFX1VSSSwgdGFnTmFtZSkpLmF0dHIoYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSB3aWR0aCBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoXG4gICAgICovXG4gICAgd2lkdGg6IGZ1bmN0aW9uKCB3aWR0aCApIHtcbiAgICAgIC8vY29uc29sZS53YXJuKFwiZGVwcmVjYXRlZFwiKTtcbiAgICAgIGlmICh0eXBlb2Ygd2lkdGggPT09ICd1bmRlZmluZWQnICYmIHRoaXNbMF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XG4gICAgICB9XG4gICAgICB0aGlzLmF0dHIoJ3dpZHRoJywgd2lkdGgpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXRzIG9yIHNldHMgdGhlIGhlaWdodCBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodFxuICAgICAqL1xuICAgIGhlaWdodDogZnVuY3Rpb24oIGhlaWdodCApIHtcbiAgICAgIC8vY29uc29sZS53YXJuKFwiZGVwcmVjYXRlZFwiKTtcbiAgICAgIGlmICh0eXBlb2YgaGVpZ2h0ID09PSAndW5kZWZpbmVkJyAmJiB0aGlzWzBdKSB7XG4gICAgICAgIHJldHVybiB0aGlzWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0cignaGVpZ2h0JywgaGVpZ2h0KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBib3VuZGluZyBib3ggb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKi9cbiAgICBiYm94OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHRoaXNbMF0uZ2V0QkJveCgpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb21wdXRlZCB0ZXh0IGxlbmd0aCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IGlmIGFwcGxpY2FibGUuXG4gICAgICovXG4gICAgY29tcHV0ZWRUZXh0TGVuZ3RoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHRoaXNbMF0uZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZXR1cm5zIGEgZ3JvdXAgbGF5ZXIgb24gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGc6IGZ1bmN0aW9uKCBhdHRycyApIHtcbiAgICAgIHZhciBnID0gdGhpcy5jcmVhdGUoJ2cnLCBhdHRycyk7XG4gICAgICBfdih0aGlzWzBdKS5hcHBlbmQoZyk7XG4gICAgICByZXR1cm4gZztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgY2lyY2xlIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3hcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3lcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGNpcmNsZTogZnVuY3Rpb24oIGN4LCBjeSwgciwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImNpcmNsZVwiLCB7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHI6IHJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGFuIGVsbGlwc2Ugb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGVsbGlwc2U6IGZ1bmN0aW9uKCBjeCwgY3ksIHJ4LCByeSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImVsbGlwc2VcIiwge1xuICAgICAgICBjeDogY3gsIFxuICAgICAgICBjeTogY3ksIFxuICAgICAgICByeDogcngsXG4gICAgICAgIHJ5OiByeVxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSByZWN0YW5nbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcmVjdDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJyZWN0XCIsIHtcbiAgICAgICAgeDogeCwgXG4gICAgICAgIHk6IHksIFxuICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGxpbmUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGxpbmU6IGZ1bmN0aW9uKCB4MSwgeTEsIHgyLCB5MiwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImxpbmVcIiwge1xuICAgICAgICB4MTogeDEsXG4gICAgICAgIHkxOiB5MSxcbiAgICAgICAgeDI6IHgyLFxuICAgICAgICB5MjogeTJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlnb246IGZ1bmN0aW9uKCBwb2ludHMsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BvbHlnb24nLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBvbHlnb24gb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwb2x5bGluZTogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWxpbmUnLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBhdGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oIGQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BhdGgnLCB7ZDogZH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgdGV4dCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICB0ZXh0OiBmdW5jdGlvbiggeCwgeSwgc3RyaW5nLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICd0ZXh0Jywge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeVxuICAgICAgfSwgYXR0cnMsIFsodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZVRleHROb2RlKHN0cmluZyldKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBzbW9vdGggZ3JhcGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuICAgIGdyYXBoOiBmdW5jdGlvbiggcG9pbnRzLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyXG4gICAgICAgICAgb3B0cyA9IGV4dGVuZCh7XG4gICAgICAgICAgICBzbW9vdGg6IGZhbHNlLCBcbiAgICAgICAgICAgIHRlbnNpb246IDAuNCxcbiAgICAgICAgICAgIGFwcHJveGltYXRlOiBmYWxzZVxuICAgICAgICAgIH0sIG9wdGlvbnMpLFxuICAgICAgICAgIHQgPSAhaXNOYU4oIG9wdHMudGVuc2lvbiApID8gb3B0cy50ZW5zaW9uIDogMC41LFxuICAgICAgICAgIGVsID0gX3YoZWxlbSksIFxuICAgICAgICAgIHAsXG4gICAgICAgICAgaSxcbiAgICAgICAgICBjLFxuICAgICAgICAgIGQsXG4gICAgICAgICAgcDEsXG4gICAgICAgICAgcDIsXG4gICAgICAgICAgY3BzLFxuICAgICAgICAgIHBhdGggPSBlbC5jcmVhdGUoJ3BhdGgnKSxcbiAgICAgICAgICBwYXRoU3RyID0gXCJcIjtcbiAgICAgICAgICBcbiAgICAgICAgZWwuYXBwZW5kKHBhdGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFvcHRzLnNtb290aCkge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgcGF0aFN0cis9IGkgPiAwID8gXCJMXCIgOiBcIk1cIjtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBwLnggKyBcIiBcIiArIHAueSArIFwiIFwiO1xuICAgICAgICAgIH0gXG4gICAgICAgIH0gZWxzZSBpZiAob3B0cy5hcHByb3hpbWF0ZSkge1xuICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICBjID0gKHBvaW50c1tpXS54ICsgcG9pbnRzW2kgKyAxXS54KSAvIDI7XG4gICAgICAgICAgICAgIGQgPSAocG9pbnRzW2ldLnkgKyBwb2ludHNbaSArIDFdLnkpIC8gMjtcbiAgICAgICAgICAgICAgcGF0aFN0cis9IFwiUVwiICsgcG9pbnRzW2ldLnggKyBcIiBcIiArIHBvaW50c1tpXS55ICsgXCIgXCIgKyBjICsgXCIgXCIgKyBkICsgXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHBvaW50c1tpXS54ICsgXCIgXCIgKyBwb2ludHNbaV0ueSArIFwiIFwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrPTEpIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbaSAtIDFdO1xuICAgICAgICAgICAgcDEgPSBwb2ludHNbaV07XG4gICAgICAgICAgICBwMiA9IHBvaW50c1tpICsgMV07XG4gICAgICAgICAgICBjcHMgPSBnZXRDb250cm9sUG9pbnRzKHAueCwgcC55LCBwMS54LCBwMS55LCBwMi54LCBwMi55LCB0KTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIkNcIiArIGNwcy5wMS54ICsgXCIgXCIgKyBjcHMucDEueSArIFwiIFwiICsgY3BzLnAyLnggKyBcIiBcIiArIGNwcy5wMi55ICsgXCIgXCIgKyBwMi54ICsgXCIgXCIgKyBwMi55ICsgXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0ueCArIFwiIFwiICsgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS55ICsgXCIgXCI7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGRlbGV0ZSBvcHRzLnNtb290aDtcbiAgICAgICAgZGVsZXRlIG9wdHMudGVuc2lvbjtcbiAgICAgICAgZGVsZXRlIG9wdHMuYXBwcm94aW1hdGU7XG4gICAgICAgIFxuICAgICAgICBwYXRoLmF0dHIoZXh0ZW5kKHtcbiAgICAgICAgICBmaWxsOiAnbm9uZSdcbiAgICAgICAgfSwgb3B0cywge1xuICAgICAgICAgIGQ6IHBhdGhTdHJcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVGhlIGFyYygpIG1ldGhvZCBjcmVhdGVzIGFuIGFyYy9jdXJ2ZSAodXNlZCB0byBjcmVhdGUgY2lyY2xlcywgb3IgcGFydHMgb2YgY2lyY2xlcykuIFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBzQW5nbGVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZUFuZ2xlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgYXJjOiBmdW5jdGlvbihjeCwgY3ksIHIsIHNBbmdsZSwgZUFuZ2xlLCBjb3VudGVyY2xvY2t3aXNlLCBhdHRycykge1xuICAgICAgY291bnRlcmNsb2Nrd2lzZSA9IHR5cGVvZiBjb3VudGVyY2xvY2t3aXNlID09PSAnYm9vbGVhbicgPyBjb3VudGVyY2xvY2t3aXNlIDogZmFsc2U7XG4gICAgICB2YXIgZCA9ICdNICcgKyBjeCArICcgJyArIGN5O1xuICAgICAgaWYgKGVBbmdsZSAtIHNBbmdsZSA9PT0gTWF0aC5QSSAqIDIpIHtcbiAgICAgICAgLy8gQ2lyY2xlXG4gICAgICAgIGQrPSAnIG0gLScgKyByICsgJywgMCBhICcgKyByICsgJywnICsgciArICcgMCAxLDAgJyArIChyICogMikgKyAnLDAgYSAnICsgciArICcsJyArIHIgKyAnIDAgMSwwIC0nICsgKHIgKiAyKSArICcsMCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkKz0gXCIgTFwiICsgKGN4ICsgY29zKHNBbmdsZSkgKiByKSArIFwiLFwiICsgKGN5ICsgc2luKHNBbmdsZSkgKiByKSArXG4gICAgICAgICAgXCIgQVwiICsgciArIFwiLFwiICsgciArIFwiIDAgXCIgKyAoZUFuZ2xlIC0gc0FuZ2xlID4gUEkgPyAxIDogMCkgKyBcIixcIiArIChjb3VudGVyY2xvY2t3aXNlID8gMCA6IDEpICtcbiAgICAgICAgICBcIiBcIiArIChjeCArIGNvcyhlQW5nbGUpICogcikgKyBcIixcIiArIChjeSArIHNpbihlQW5nbGUpICogcikgKyBcIiBaXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInBhdGhcIiwge1xuICAgICAgICBkOiBkXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIHRleHQgaW50byBhIGJvdW5kaW5nIGJveCBieSB3cmFwcGluZyBsaW5lcyBhdCBzcGFjZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0geVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB3aWR0aFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RyaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgdGV4dGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIHN0cmluZywgYXR0cnMgKSB7XG4gICAgICBcbiAgICAgIHZhciBcbiAgICAgICAgc2VsZiA9IHRoaXM7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICBsaW5lcyA9IHdpZHRoID8gW10gOiBbc3RyaW5nXSwgXG4gICAgICAgICAgbGluZSA9IFtdLFxuICAgICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgICAgd29yZHMgPSB3aWR0aCA/IHN0cmluZy5zcGxpdCgvXFxzKy8pIDogW10sXG4gICAgICAgICAgdGV4dCA9IHNlbGYuY3JlYXRlKCd0ZXh0JywgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywge1xuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHlcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgdGV4dE5vZGUsXG4gICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICB0ZXh0QWxpZ24gPSB0ZXh0LmNzcygndGV4dC1hbGlnbicpLFxuICAgICAgICAgIHR5ID0gMDtcbiAgICAgICAgXG4gICAgICAgIF92ZWxlbS5hcHBlbmQodGV4dCk7XG4gICAgICAgIFxuICAgICAgICBcbiAgICAgICAgaWYgKHdpZHRoKSB7XG4gICAgICAgICAgLy8gQnJlYWsgbGluZXNcbiAgICAgICAgICB0ZXh0Tm9kZSA9IGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgICB0ZXh0LmFwcGVuZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgd29yZHMuZm9yRWFjaChmdW5jdGlvbih3b3JkLCBpbmRleCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGxpbmUuam9pbignICcpICsgJyAnICsgd29yZDtcbiAgICAgICAgICAgIGxlbmd0aCA9IHRleHQuY29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICAgIGxpbmUgPSBbd29yZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lLnB1c2god29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5kZXggPT09IHdvcmRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGV4dC5yZW1vdmUodGV4dE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZW5kZXIgbGluZXNcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbihsaW5lLCBpbmRleCkge1xuICAgICAgICAgIHZhciB0c3BhbiwgZHk7XG4gICAgICAgICAgaWYgKCFoZWlnaHQgfHwgdHkgKyBwYXJzZUZsb2F0KGxpbmVIZWlnaHQpIDwgaGVpZ2h0KSB7XG4gICAgICAgICAgICBkeSA9IGluZGV4ID4gMCA/IGxpbmVIZWlnaHQgOiBmb250U2l6ZSAtIDI7XG4gICAgICAgICAgICB0eSs9IGR5O1xuICAgICAgICAgICAgdHNwYW4gPSBzZWxmLmNyZWF0ZSgndHNwYW4nLCB7ZHk6IGR5fSk7XG4gICAgICAgICAgICB0ZXh0LmFwcGVuZCh0c3Bhbik7XG4gICAgICAgICAgICB0c3BhblxuICAgICAgICAgICAgICAuYXBwZW5kKGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lKSlcbiAgICAgICAgICAgICAgLmF0dHIoJ3gnLCBwYXJzZUludCh0ZXh0LmF0dHIoJ3gnKSwgdW5kZWZpbmVkKSArICh3aWR0aCAtIHRzcGFuLmNvbXB1dGVkVGV4dExlbmd0aCgpKSAqICh0ZXh0QWxpZ24gPT09ICdlbmQnIHx8IHRleHRBbGlnbiA9PT0gJ3JpZ2h0JyA/IDEgOiB0ZXh0QWxpZ24gPT09ICdjZW50ZXInIHx8IHRleHRBbGlnbiA9PT0gJ21pZGRsZScgPyAwLjUgOiAwKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdDogZnVuY3Rpb24oIHgsIHksIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGJveCh4LCB5LCAwLCAwLCBpdGVtcywgb3B0aW9ucyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0IGludG8gdGhlIHNwZWNpZmllZCBib3VuZHMuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICBpdGVtcyA9IHRvQXJyYXkoaXRlbXMpLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycgPyB7bGFiZWw6IGl0ZW19IDogaXRlbTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIFxuICAgICAgb3B0aW9ucyA9IGV4dGVuZCh7fSwge1xuICAgICAgICBob3Jpem9udGFsOiBmYWxzZSxcbiAgICAgICAgYnVsbGV0OiB7XG4gICAgICAgICAgc2hhcGU6ICdjaXJjbGUnXG4gICAgICAgIH1cbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyIHRvcCA9IHk7XG4gICAgICAgIFxuICAgICAgICBpdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgXG4gICAgICAgICAgdmFyXG4gICAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICAgIGl0ZW1PcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRpb25zLCBpdGVtKSxcbiAgICAgICAgICAgIGhvcml6b250YWwgPSBpdGVtT3B0cy5ob3Jpem9udGFsLFxuICAgICAgICAgICAgc2hhcGUgPSBpdGVtT3B0cy5idWxsZXQuc2hhcGUsXG4gICAgICAgICAgICBsYWJlbCA9IGl0ZW1PcHRzLmxhYmVsLFxuICAgICAgICAgICAgYnVsbGV0QXR0cnMsXG4gICAgICAgICAgICBpdGVtTGF5ZXIgPSBfdmVsZW0uZygpLFxuICAgICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgICBmb250U2l6ZSA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnZm9udC1zaXplJykpLFxuICAgICAgICAgICAgYnVsbGV0U2l6ZSA9IGZvbnRTaXplICogMC42NSxcbiAgICAgICAgICAgIHNwYWNpbmcgPSBsaW5lSGVpZ2h0ICogMC4yLFxuICAgICAgICAgICAgaXRlbVdpZHRoLFxuICAgICAgICAgICAgaXRlbUhlaWdodDtcbiAgICAgICAgICBcbiAgICAgICAgICBkZWxldGUgaXRlbU9wdHMuYnVsbGV0LnNoYXBlO1xuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5ob3Jpem9udGFsO1xuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5sYWJlbDtcbiAgICAgICAgICBcbiAgICAgICAgICBidWxsZXRBdHRycyA9IGV4dGVuZCh0cnVlLCB7fSwgaXRlbU9wdHMsIGl0ZW1PcHRzLmJ1bGxldCk7IFxuICAgICAgICAgIFxuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5idWxsZXQ7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGhlaWdodCAmJiB5ICsgZm9udFNpemUgPiB0b3AgKyBoZWlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUmVuZGVyIGJ1bGxldFxuICAgICAgICAgIGlmIChzaGFwZSA9PT0gJ2NpcmNsZScpIHtcbiAgICAgICAgICAgIGl0ZW1MYXllci5jaXJjbGUoeCArIGJ1bGxldFNpemUgKiAwLjUsIGZsb29yKHkpICsgKGZvbnRTaXplIC0gYnVsbGV0U2l6ZSkgKiAwLjUgKyBidWxsZXRTaXplICogMC41LCBidWxsZXRTaXplICogMC41LCBidWxsZXRBdHRycyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ZW1MYXllci5yZWN0KHgsIE1hdGguZmxvb3IoeSkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAqIDAuNSwgYnVsbGV0U2l6ZSwgYnVsbGV0U2l6ZSwgYnVsbGV0QXR0cnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW5kZXIgbGFiZWxcbiAgICAgICAgICBpdGVtTGF5ZXIudGV4dGJveCh4ICsgYnVsbGV0U2l6ZSArIHNwYWNpbmcsIGZsb29yKHkpLCB3aWR0aCA/IHdpZHRoIC0gYnVsbGV0U2l6ZSAtIHNwYWNpbmcgOiAwLCBoZWlnaHQgPyB0b3AgKyBoZWlnaHQgLSB5IDogMCwgbGFiZWwsIGl0ZW1PcHRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpdGVtV2lkdGggPSBmbG9vcihpdGVtTGF5ZXIuYmJveCgpLndpZHRoKTtcbiAgICAgICAgICBpdGVtSGVpZ2h0ID0gZmxvb3IoaXRlbUxheWVyLmJib3goKS5oZWlnaHQgKyAobGluZUhlaWdodCAtIGZvbnRTaXplKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGhvcml6b250YWwpIHtcbiAgICAgICAgICAgIHgrPSBpdGVtV2lkdGggKyBmb250U2l6ZTtcbiAgICAgICAgICAgIGlmICh3aWR0aCAmJiB4ID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgeSs9IGl0ZW1IZWlnaHQ7XG4gICAgICAgICAgICAgIHggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5Kz0gaXRlbUhlaWdodDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfSk7XG4gIFxuICByZXR1cm4gX3Y7XG4gIFxufSgpKTtcblxubW9kdWxlLmV4cG9ydHMgPSBfdjsiXX0=
