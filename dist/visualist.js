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
     * Rounds a number to precision
     */ 
    round = function(num, digits) {
      digits = typeof digits === 'number' ? digits : 1;
      if (typeof num === 'object') {
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
    },
  
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
    
    /**
     * Converts to Array
     * @param {Boolean} true
     * @param {Object} destination
     * @param {Object} source
     */
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
    
    parent = function(elem) {
      return elem.parentNode;
    },
    
    append = function( parent, child ) {
      parent = parent && parent[0] || parent;
      if (parent && parent.appendChild) {
        toArray(child).forEach(function(child) {
          if (child) {
            parent.appendChild(child);
          }
        });
      }
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
      var result = null, obj = {}, prop, px = ['x', 'y', 'dx', 'dy', 'cx', 'cy'];
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
              value = px.indexOf(prop) >= 0 ? round(value) : value;
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
      _v(elem).append(self.create(tagName, extend(true, {}, attrs, round(params))).append(children));
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
        if (parent) {
          append(parent, elem);
        }
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
      try {
        var b = this[0] && this[0].getBBox();
        b = {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height
        };
        return b;
      } catch (e) {
        return {x: 0, y: 0, width: 0, height: 0};
      } 
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
            bulletSize = round(fontSize * 0.65),
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
            itemLayer.circle(x + bulletSize / 2, y + (fontSize - bulletSize) / 2 + bulletSize / 2, bulletSize / 2, bulletAttrs);
          } else {
            itemLayer.rect(x, round(y) + (fontSize - bulletSize) / 2, bulletSize, bulletSize, bulletAttrs);
          }
          
          // Render label
          itemLayer.textbox(x + bulletSize + spacing, y, width ? width - bulletSize - spacing : 0, height ? top + height - y : 0, label, itemOpts);
          
          itemWidth = Math.ceil(itemLayer.bbox().width + fontSize);
          itemHeight = Math.round(itemLayer.bbox().height + (lineHeight - fontSize));
          
          if (horizontal) {
            x+= itemWidth;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgX3YgPSAoZnVuY3Rpb24oKSB7XG4gIFxuICBcbiAgdmFyIFxuICAgIFNWR19OQU1FU1BBQ0VfVVJJID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLFxuICAgIE1BVEggPSBNYXRoLFxuICAgIFBJID0gTUFUSC5QSSxcbiAgICBjb3MgPSBNQVRILmNvcyxcbiAgICBzaW4gPSBNQVRILnNpbixcbiAgICBzcXJ0ID0gTUFUSC5zcXJ0LFxuICAgIHBvdyA9IE1BVEgucG93LFxuICAgIGZsb29yID0gTUFUSC5mbG9vcixcbiAgXG4gICAgLyoqXG4gICAgICogUm91bmRzIGEgbnVtYmVyIHRvIHByZWNpc2lvblxuICAgICAqLyBcbiAgICByb3VuZCA9IGZ1bmN0aW9uKG51bSwgZGlnaXRzKSB7XG4gICAgICBkaWdpdHMgPSB0eXBlb2YgZGlnaXRzID09PSAnbnVtYmVyJyA/IGRpZ2l0cyA6IDE7XG4gICAgICBpZiAodHlwZW9mIG51bSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZm9yICh2YXIgeCBpbiBudW0pIHtcbiAgICAgICAgICBudW1beF0gPSByb3VuZChudW1beF0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBY3R1YWxseSByb3VuZCBudW1iZXJcbiAgICAgICAgdmFyIHZhbHVlID0gcGFyc2VGbG9hdChudW0pO1xuICAgICAgICBpZiAoIWlzTmFOKHZhbHVlKSAmJiBuZXcgU3RyaW5nKHZhbHVlKS5sZW5ndGggPT09IG5ldyBTdHJpbmcobnVtKS5sZW5ndGgpIHtcbiAgICAgICAgICB2YWx1ZSA9IHBhcnNlRmxvYXQodmFsdWUudG9GaXhlZChkaWdpdHMpKTtcbiAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBudW07XG4gICAgfSxcbiAgXG4gICAgLyoqXG4gICAgICogQ2FtZWxpemUgYSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nXG4gICAgICovIFxuICAgIGNhbWVsaXplID0gKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNhY2hlID0ge307XG4gICAgICByZXR1cm4gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBjYWNoZVtzdHJpbmddID0gY2FjaGVbc3RyaW5nXSB8fCAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC8oXFwtW2Etel0pL2csIGZ1bmN0aW9uKCQxKXtyZXR1cm4gJDEudG9VcHBlckNhc2UoKS5yZXBsYWNlKCctJywnJyk7fSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gIFxuICAgIC8qKlxuICAgICAqIEh5cGhlbmF0ZSBhIHN0cmluZ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKi9cbiAgICBoeXBoZW5hdGUgPSAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlW3N0cmluZ10gPSBjYWNoZVtzdHJpbmddIHx8IChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLyhbQS1aXSkvZywgZnVuY3Rpb24oJDEpe3JldHVybiBcIi1cIiskMS50b0xvd2VyQ2FzZSgpO30pO1xuICAgICAgICB9KSgpO1xuICAgICAgfTtcbiAgICB9KSgpLFxuICBcbiAgICAvKipcbiAgICAgKiBFeHRlbmRzIGFuIG9iamVjdFxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gdHJ1ZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkZXN0aW5hdGlvblxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2VcbiAgICAgKi9cbiAgICBleHRlbmQgPSBmdW5jdGlvbihkZWVwLCBkZXN0aW5hdGlvbiwgc291cmNlKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cywgaSA9IHR5cGVvZiBkZWVwID09PSAnYm9vbGVhbicgPyAyIDogMSwgZGVzdCA9IGFyZ3VtZW50c1tpIC0gMV0sIHNyYywgcHJvcCwgdmFsdWU7XG4gICAgICBmb3IgKDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3JjID0gYXJnc1tpXTtcbiAgICAgICAgZm9yIChwcm9wIGluIHNyYykge1xuICAgICAgICAgIHZhbHVlID0gc3JjW3Byb3BdO1xuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICAgIGRlc3RbcHJvcF0gPSBkZXN0W3Byb3BdIHx8IHt9O1xuICAgICAgICAgICAgICBpZiAoZGVlcCkge1xuICAgICAgICAgICAgICAgIGV4dGVuZCh0cnVlLCBkZXN0W3Byb3BdLCB2YWx1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRlc3RbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkZXN0O1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdG8gQXJyYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IHRydWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGVzdGluYXRpb25cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc291cmNlXG4gICAgICovXG4gICAgdG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgXG4gICAgICAvL3JldHVybiBvYmogJiYgKG9iai5sZW5ndGggJiYgW10uc2xpY2UuY2FsbChvYmopIHx8IFtvYmpdKTtcbiAgICAgIFxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbCA9IG9iaiAmJiBvYmoubGVuZ3RoIHx8IDAsIGksIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAob2JqW2ldKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2gob2JqW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0Lmxlbmd0aCAmJiByZXN1bHQgfHwgW29ial07XG4gICAgfSxcbiAgICBcbiAgICAvLyBET00gTWFuaXB1bGF0aW9uXG4gICAgXG4gICAgcGFyZW50ID0gZnVuY3Rpb24oZWxlbSkge1xuICAgICAgcmV0dXJuIGVsZW0ucGFyZW50Tm9kZTtcbiAgICB9LFxuICAgIFxuICAgIGFwcGVuZCA9IGZ1bmN0aW9uKCBwYXJlbnQsIGNoaWxkICkge1xuICAgICAgcGFyZW50ID0gcGFyZW50ICYmIHBhcmVudFswXSB8fCBwYXJlbnQ7XG4gICAgICBpZiAocGFyZW50ICYmIHBhcmVudC5hcHBlbmRDaGlsZCkge1xuICAgICAgICB0b0FycmF5KGNoaWxkKS5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBcbiAgICBwcmVwZW5kID0gZnVuY3Rpb24oIHBhcmVudCwgY2hpbGQgKSB7XG4gICAgICBwYXJlbnQgPSBwYXJlbnRbMF0gfHwgcGFyZW50O1xuICAgICAgdG9BcnJheShjaGlsZCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGNoaWxkLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFxuICAgIHJlbW92ZSA9IGZ1bmN0aW9uKCBlbGVtLCBjaGlsZCApIHtcbiAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICB0b0FycmF5KGNoaWxkKS5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChlbGVtLnBhcmVudE5vZGUpIHtcbiAgICAgICAgZWxlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsZW0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgaHRtbCA9IGZ1bmN0aW9uKGVsZW0sIHN0cmluZykge1xuICAgICAgaWYgKHN0cmluZykge1xuICAgICAgICBlbGVtLmlubmVySFRNTCA9IHN0cmluZztcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtLmlubmVySFRNTDtcbiAgICB9LFxuICAgIFxuICAgIHRleHQgPSBmdW5jdGlvbihlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS50ZXh0Q29udGVudDtcbiAgICB9LFxuICAgIFxuICAgIGF0dHIgPSBmdW5jdGlvbiAoZWxlbSwgbmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciByZXN1bHQgPSBudWxsLCBvYmogPSB7fSwgcHJvcCwgcHggPSBbJ3gnLCAneScsICdkeCcsICdkeScsICdjeCcsICdjeSddO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgICBvYmpbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIG1hcFN0eWxlcyhuYW1lKSB7XG4gICAgICAgIHJldHVybiBoeXBoZW5hdGUobmFtZSkgKyBcIjogXCIgKyB2YWx1ZVtuYW1lXTtcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhvYmopLmxlbmd0aCkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gb2JqKSB7XG4gICAgICAgICAgcHJvcCA9IHR5cGVvZiBlbGVtW2NhbWVsaXplKG5hbWUpXSAhPT0gJ3VuZGVmaW5lZCcgPyBjYW1lbGl6ZShuYW1lKSA6IGh5cGhlbmF0ZShuYW1lKTtcbiAgICAgICAgICB2YWx1ZSA9IG9ialtuYW1lXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gU2V0XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gJ3N0eWxlJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChtYXBTdHlsZXMpLmpvaW4oXCI7IFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBweC5pbmRleE9mKHByb3ApID49IDAgPyByb3VuZCh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUocHJvcCwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgLy8gR2V0XG4gICAgICAgICAgICByZXN1bHQgPSBlbGVtLmdldEF0dHJpYnV0ZShwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgXG4gICAgY3NzID0gZnVuY3Rpb24oZWxlbSwgbmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciBtYXAgPSB7fSwgY3NzVGV4dCA9IG51bGw7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG1hcCA9IG5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBtYXBbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGNzc1RleHQgPSBPYmplY3Qua2V5cyhtYXApLm1hcChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBoeXBoZW5hdGUobmFtZSkgKyBcIjogXCIgKyBtYXBbbmFtZV07XG4gICAgICB9KS5qb2luKFwiOyBcIik7XG4gICAgICBpZiAoY3NzVGV4dCAmJiBjc3NUZXh0Lmxlbmd0aCkge1xuICAgICAgICBlbGVtLnN0eWxlLmNzc1RleHQgPSBlbGVtLnN0eWxlLmNzc1RleHQgKyBjc3NUZXh0O1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtLnN0eWxlW25hbWVdIHx8IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW0sIG51bGwpLmdldFByb3BlcnR5VmFsdWUobmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICBhZGRDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICBoYXNDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgcmV0dXJuIGVsZW0uY2xhc3NMaXN0LmNvbnRhaW5zKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICByZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICB0b2dnbGVDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXRzIGEgcGFpciBvZiBiZXppZXIgY29udHJvbCBwb2ludHNcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDBcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTBcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdFxuICAgICAqL1xuICAgIGdldENvbnRyb2xQb2ludHMgPSBmdW5jdGlvbiggeDAsIHkwLCB4MSwgeTEsIHgyLCB5MiwgdCApIHtcbiAgICAgIHQgPSB0eXBlb2YgdCA9PT0gJ251bWJlcicgPyB0IDogMC41O1xuICAgICAgdmFyXG4gICAgICAgIGQwMSA9IHNxcnQoIHBvdyggeDEgLSB4MCwgMiApICsgcG93KCB5MSAtIHkwLCAyICkgKSxcbiAgICAgICAgZDEyID0gc3FydCggcG93KCB4MiAtIHgxLCAyICkgKyBwb3coIHkyIC0geTEsIDIgKSApLFxuICAgICAgICBmYSA9IHQgKiBkMDEgLyAoIGQwMSArIGQxMiApLCAgIC8vIHNjYWxpbmcgZmFjdG9yIGZvciB0cmlhbmdsZSBUYVxuICAgICAgICBmYiA9IHQgKiBkMTIgLyAoIGQwMSArIGQxMiApLCAgIC8vIGRpdHRvIGZvciBUYiwgc2ltcGxpZmllcyB0byBmYj10LWZhXG4gICAgICAgIHAxeCA9IHgxIC0gZmEgKiAoIHgyIC0geDAgKSwgICAgLy8geDIteDAgaXMgdGhlIHdpZHRoIG9mIHRyaWFuZ2xlIFRcbiAgICAgICAgcDF5ID0geTEgLSBmYSAqICggeTIgLSB5MCApLCAgICAvLyB5Mi15MCBpcyB0aGUgaGVpZ2h0IG9mIFRcbiAgICAgICAgcDJ4ID0geDEgKyBmYiAqICggeDIgLSB4MCApLFxuICAgICAgICBwMnkgPSB5MSArIGZiICogKCB5MiAtIHkwICk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwMToge3g6IHAxeCwgeTogcDF5fSwgXG4gICAgICAgIHAyOiB7eDogcDJ4LCB5OiBwMnl9XG4gICAgICB9O1xuICAgIH0sXG4gIFxuICAgIC8qKlxuICAgICAqIFNlcmlhbGl6ZXMgcG9pbnRzIGFzIHN2ZyBwYXRoIGRlZmluaXRpb25cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBwb2ludHNcbiAgICAgKi9cbiAgICBnZXRQYXRoID0gZnVuY3Rpb24oIHBvaW50cyApIHtcbiAgICAgIHJldHVybiBwb2ludHMubWFwKGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHJldHVybiBwb2ludC54ICsgXCIsXCIgKyBwb2ludC55O1xuICAgICAgfSkuam9pbihcIiBcIik7XG4gICAgfSxcbiAgXG4gIFxuICAgIC8qKlxuICAgICAqIFZpc3VhbGlzdCBxdWVyeSBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIF92ID0gZnVuY3Rpb24oc2VsZWN0b3IsIHdpZHRoLCBoZWlnaHQsIGF0dHJzKSB7XG4gICAgICB2YXIgYXJnLCBpLCBzLCB3LCBoLCBhLCBzZXQ7XG4gICAgICBmb3IgKGkgPSAwLCBhcmc7IGFyZyA9IGFyZ3VtZW50c1tpXTsgaSsrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyAmJiAhaXNOYU4ocGFyc2VGbG9hdChhcmcpKSkge1xuICAgICAgICAgIC8vIE51bWVyaWNcbiAgICAgICAgICBhcmcgPSB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyA/IHBhcnNlRmxvYXQoYXJnKSArIFwicHhcIiA6IGFyZztcbiAgICAgICAgICBpZiAodHlwZW9mIHcgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBoID0gYXJnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ID0gYXJnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgIC8vIFBsYWluIG9iamVjdFxuICAgICAgICAgIGEgPSBhcmc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRXZlcnl0aGluZyBlbHNlIG1heSBiZSBhIHNlbGVjdG9yXG4gICAgICAgICAgcyA9IGFyZztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2V0ID0gcyBpbnN0YW5jZW9mIFZpc3VhbGlzdCA/IHMgOiBuZXcgVmlzdWFsaXN0KHMpO1xuICAgICAgc2V0LmF0dHIoZXh0ZW5kKHRydWUsIGEgfHwge30sIHtcbiAgICAgICAgd2lkdGg6IHcsIFxuICAgICAgICBoZWlnaHQ6IGhcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybiBzZXQ7XG4gICAgfTtcblxuICAvKipcbiAgICogVmlzdWFsaXN0IENsYXNzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICAgKi9cblxuICBmdW5jdGlvbiBWaXN1YWxpc3Qoc2VsZWN0b3IpIHtcbiAgICB2YXIgc2V0ID0gbnVsbCwgZWxlbSwgcmVzdWx0LCBpLCBzdmc7XG4gICAgLy8gQ29sbGVjdCBjb25zdHJ1Y3RvciBhcmdzXG4gICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ29iamVjdCcgJiYgc2VsZWN0b3IubmFtZXNwYWNlVVJJID09PSBTVkdfTkFNRVNQQUNFX1VSSSkge1xuICAgICAgLy8gRXhpc3RpbmcgRWxlbWVudFxuICAgICAgc2V0ID0gW3NlbGVjdG9yXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFNlbGVjdG9yXG4gICAgICByZXN1bHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIGZvciAoaSA9IDAsIGVsZW07IGVsZW0gPSByZXN1bHRbaV07IGkrKykge1xuICAgICAgICBpZiAoZWxlbS5uYW1lc3BhY2VVUkkgPT09IFNWR19OQU1FU1BBQ0VfVVJJICkge1xuICAgICAgICAgIHNldCA9IHNldCB8fCBbXTtcbiAgICAgICAgICBzZXQucHVzaChlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXNldCkge1xuICAgICAgc3ZnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0VfVVJJLCAnc3ZnJyk7XG4gICAgICBzdmcuc2V0QXR0cmlidXRlKFwieG1sbnNcIiwgU1ZHX05BTUVTUEFDRV9VUkkpO1xuICAgICAgc2V0ID0gW3N2Z107XG4gICAgfVxuICAgIHRoaXMucHVzaC5hcHBseSh0aGlzLCBzZXQgfHwgW10pO1xuICB9XG4gIFxuICBWaXN1YWxpc3QucHJvdG90eXBlID0gW107XG4gIFxuICAvLyBTdGF0aWMgbWV0aG9kc1xuICBfdi5leHRlbmQgPSBleHRlbmQ7XG4gIF92LmF0dHIgPSBhdHRyO1xuICBfdi5jc3MgPSBjc3M7XG4gIFxuICAvLyBQbHVnaW4gQVBJXG4gIF92LmZuID0gVmlzdWFsaXN0LnByb3RvdHlwZTtcbiAgXG4gIC8qKlxuICAgKiBFeHRlbmRzIHZpc3VhbGlzdCBwcm90b3R5cGVcbiAgICogQHBhcmFtIHtBcnJheX0gbWV0aG9kc1xuICAgKi9cbiAgX3YuZm4uZXh0ZW5kID0gZnVuY3Rpb24oIG1ldGhvZHMgKSB7XG4gICAgZm9yICh2YXIgeCBpbiBtZXRob2RzKSB7XG4gICAgICBWaXN1YWxpc3QucHJvdG90eXBlW3hdID0gbWV0aG9kc1t4XTtcbiAgICB9XG4gIH07XG4gIFxuICAvLyBQcml2YXRlIENvbXBvbmVudHNcbiAgXG4gIC8qKlxuICAgKiBEcmF3IGJhc2ljIHNoYXBlc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnTmFtZVxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgKiBAcGFyYW0ge0FycmF5fSBjaGlsZHJlbiBcbiAgICovXG4gIGZ1bmN0aW9uIHNoYXBlKHRhZ05hbWUsIHBhcmFtcywgYXR0cnMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICBfdihlbGVtKS5hcHBlbmQoc2VsZi5jcmVhdGUodGFnTmFtZSwgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywgcm91bmQocGFyYW1zKSkpLmFwcGVuZChjaGlsZHJlbikpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIFxuICAvLyBQdWJsaWMgQ29tcG9uZW50c1xuICBcbiAgX3YuZm4uZXh0ZW5kKHtcbiAgICBcbiAgICBzaXplOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICB9LFxuICAgIFxuICAgIHRvQXJyYXk6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRvQXJyYXkodGhpcyk7XG4gICAgfSxcbiAgICBcbiAgICBnZXQ6IGZ1bmN0aW9uKCBpbmRleCApIHtcbiAgICAgIHJldHVybiB0eXBlb2YgaW5kZXggIT09ICd1bmRlZmluZWQnID8gaW5kZXggPCAwID8gdGhpc1t0aGlzLmxlbmd0aCAtIGluZGV4XSA6IHRoaXNbaW5kZXhdIDogdGhpcy50b0FycmF5KCk7XG4gICAgfSxcbiAgICBcbiAgICBpbmRleDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpc1swXSAmJiB0b0FycmF5KHRoaXNbMF0ucGFyZW50Tm9kZS5jaGlsZHJlbikuaW5kZXhPZih0aGlzWzBdKSB8fCAtMTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIEFwcGVuZHMgdGhlIHNwZWNpZmllZCBjaGlsZCB0byB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIGFwcGVuZDogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgaWYgKHRoaXNbMF0pIHtcbiAgICAgICAgYXBwZW5kKHRoaXNbMF0sIGNoaWxkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQXBwZW5kcyB0aGUgY3VycmVudCBzZXQgb2YgZWxlbWVudHMgdG8gdGhlIHNwZWNpZmllZCBwYXJlbnRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBhcHBlbmRUbzogZnVuY3Rpb24oIHBhcmVudCApIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICBhcHBlbmQocGFyZW50LCBlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFByZXBlbmRzIHRoZSBzcGVjaWZpZWQgY2hpbGQgdG8gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBwcmVwZW5kOiBmdW5jdGlvbiggY2hpbGQgKSB7XG4gICAgICBpZiAodGhpc1swXSkge1xuICAgICAgICBwcmVwZW5kKHRoaXNbMF0sIGNoaWxkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUHJlcGVuZHMgdGhlIGN1cnJlbnQgc2V0IG9mIGVsZW1lbnRzIHRvIHRoZSBzcGVjaWZpZWQgcGFyZW50XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgcHJlcGVuZFRvOiBmdW5jdGlvbiggcGFyZW50ICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgcHJlcGVuZChwYXJlbnQsIGVsZW0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGVsZW1lbnRzIGluIHRoZSBzZXQgb3IgcmVtb3ZlcyB0aGUgc3BlY2lmaWVkIGNoaWxkIGZyb20gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIHJlbW92ZTogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgcmVtb3ZlKGVsZW0sIGNoaWxkKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNoaWxkcmVuIGZyb20gZWxlbWVudHMgaW4gdGhlIHNldFxuICAgICAqL1xuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChlbGVtLmNoaWxkTm9kZXNbaV0pO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBhcmVudCBub2RlIG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICovXG4gICAgcGFyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHBhcmVudCh0aGlzWzBdKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2YgYW4gYXR0cmlidXRlIGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIGF0dHJpYnV0ZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIGF0dHI6IGZ1bmN0aW9uKCBuYW1lLCB2YWx1ZSApIHtcbiAgICAgIHZhciByZXN1bHQgPSB0aGlzO1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgdmFyIHJldCA9IGF0dHIoZWxlbSwgbmFtZSwgdmFsdWUpO1xuICAgICAgICBpZiAocmV0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0ID0gcmV0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGEgY29tcHV0ZWQgc3R5bGUgcHJvcGVydHkgZm9yIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cyBvciBzZXQgb25lIG9yIG1vcmUgQ1NTIHByb3BlcnRpZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIGNzczogZnVuY3Rpb24oIG5hbWUsIHZhbHVlICkge1xuICAgICAgdmFyIHJlc3VsdCA9IHRoaXM7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICB2YXIgcmV0ID0gY3NzKGVsZW0sIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgaWYgKHJldCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IHJldDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBlbGVtZW50IHdpdGggdGhlIHNwZWNpZmVkIHRhZ25hbWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uKCB0YWdOYW1lLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBfdigodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZUVsZW1lbnROUyh0aGlzWzBdICYmIHRoaXNbMF0ubmFtZXNwYWNlVVJJIHx8IFNWR19OQU1FU1BBQ0VfVVJJLCB0YWdOYW1lKSkuYXR0cihhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXRzIG9yIHNldHMgdGhlIHdpZHRoIG9uIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKi9cbiAgICB3aWR0aDogZnVuY3Rpb24oIHdpZHRoICkge1xuICAgICAgLy9jb25zb2xlLndhcm4oXCJkZXByZWNhdGVkXCIpO1xuICAgICAgaWYgKHR5cGVvZiB3aWR0aCA9PT0gJ3VuZGVmaW5lZCcgJiYgdGhpc1swXSkge1xuICAgICAgICByZXR1cm4gdGhpc1swXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0cignd2lkdGgnLCB3aWR0aCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldHMgb3Igc2V0cyB0aGUgaGVpZ2h0IG9uIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICovXG4gICAgaGVpZ2h0OiBmdW5jdGlvbiggaGVpZ2h0ICkge1xuICAgICAgLy9jb25zb2xlLndhcm4oXCJkZXByZWNhdGVkXCIpO1xuICAgICAgaWYgKHR5cGVvZiBoZWlnaHQgPT09ICd1bmRlZmluZWQnICYmIHRoaXNbMF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqL1xuICAgIGJib3g6IGZ1bmN0aW9uKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIGIgPSB0aGlzWzBdICYmIHRoaXNbMF0uZ2V0QkJveCgpO1xuICAgICAgICBiID0ge1xuICAgICAgICAgIHg6IGIueCxcbiAgICAgICAgICB5OiBiLnksXG4gICAgICAgICAgd2lkdGg6IGIud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0OiBiLmhlaWdodFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gYjtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHt4OiAwLCB5OiAwLCB3aWR0aDogMCwgaGVpZ2h0OiAwfTtcbiAgICAgIH0gXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbXB1dGVkIHRleHQgbGVuZ3RoIG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgaWYgYXBwbGljYWJsZS5cbiAgICAgKi9cbiAgICBjb21wdXRlZFRleHRMZW5ndGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdGhpc1swXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSBncm91cCBsYXllciBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZzogZnVuY3Rpb24oIGF0dHJzICkge1xuICAgICAgdmFyIGcgPSB0aGlzLmNyZWF0ZSgnZycsIGF0dHJzKTtcbiAgICAgIF92KHRoaXNbMF0pLmFwcGVuZChnKTtcbiAgICAgIHJldHVybiBnO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBjaXJjbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY2lyY2xlOiBmdW5jdGlvbiggY3gsIGN5LCByLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiY2lyY2xlXCIsIHtcbiAgICAgICAgY3g6IGN4LCBcbiAgICAgICAgY3k6IGN5LCBcbiAgICAgICAgcjogclxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYW4gZWxsaXBzZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ5XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZWxsaXBzZTogZnVuY3Rpb24oIGN4LCBjeSwgcngsIHJ5LCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiZWxsaXBzZVwiLCB7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHJ4OiByeCxcbiAgICAgICAgcnk6IHJ5XG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHJlY3RhbmdsZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICByZWN0OiBmdW5jdGlvbiggeCwgeSwgd2lkdGgsIGhlaWdodCwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInJlY3RcIiwge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeSwgXG4gICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgbGluZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgbGluZTogZnVuY3Rpb24oIHgxLCB5MSwgeDIsIHkyLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwibGluZVwiLCB7XG4gICAgICAgIHgxOiB4MSxcbiAgICAgICAgeTE6IHkxLFxuICAgICAgICB4MjogeDIsXG4gICAgICAgIHkyOiB5MlxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBwb2x5Z29uIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9pbnRzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcG9seWdvbjogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWdvbicsIHtcbiAgICAgICAgcG9pbnRzOiBnZXRQYXRoKHBvaW50cylcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlsaW5lOiBmdW5jdGlvbiggcG9pbnRzLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICdwb2x5bGluZScsIHtcbiAgICAgICAgcG9pbnRzOiBnZXRQYXRoKHBvaW50cylcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcGF0aCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbiggZCwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncGF0aCcsIHtkOiBkfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVuZGVycyB0ZXh0IG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHRleHQ6IGZ1bmN0aW9uKCB4LCB5LCBzdHJpbmcsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3RleHQnLCB7XG4gICAgICAgIHg6IHgsIFxuICAgICAgICB5OiB5XG4gICAgICB9LCBhdHRycywgWyh0aGlzWzBdICYmIHRoaXNbMF0ub3duZXJEb2N1bWVudCB8fCBkb2N1bWVudCkuY3JlYXRlVGV4dE5vZGUoc3RyaW5nKV0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhIHNtb290aCBncmFwaCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKCBwb2ludHMsIG9wdGlvbnMgKSB7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBvcHRzID0gZXh0ZW5kKHtcbiAgICAgICAgICAgIHNtb290aDogZmFsc2UsIFxuICAgICAgICAgICAgdGVuc2lvbjogMC40LFxuICAgICAgICAgICAgYXBwcm94aW1hdGU6IHRydWVcbiAgICAgICAgICB9LCBvcHRpb25zKSxcbiAgICAgICAgICB0ID0gIWlzTmFOKCBvcHRzLnRlbnNpb24gKSA/IG9wdHMudGVuc2lvbiA6IDAuNSxcbiAgICAgICAgICBlbCA9IF92KGVsZW0pLCBcbiAgICAgICAgICBwLFxuICAgICAgICAgIGksXG4gICAgICAgICAgYyxcbiAgICAgICAgICBkLFxuICAgICAgICAgIHAxLFxuICAgICAgICAgIHAyLFxuICAgICAgICAgIGNwcyxcbiAgICAgICAgICBwYXRoID0gZWwuY3JlYXRlKCdwYXRoJyksXG4gICAgICAgICAgcGF0aFN0ciA9IFwiXCI7XG4gICAgICAgICAgXG4gICAgICAgIGVsLmFwcGVuZChwYXRoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghb3B0cy5zbW9vdGgpIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgcCA9IHBvaW50c1tpXTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBpID4gMCA/IFwiTFwiIDogXCJNXCI7XG4gICAgICAgICAgICBwYXRoU3RyKz0gcm91bmQocC54KSArIFwiIFwiICsgcm91bmQocC55KSArIFwiIFwiO1xuICAgICAgICAgIH0gXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gU21vb3RoXG4gICAgICAgICAgaWYgKG9wdHMuYXBwcm94aW1hdGUpIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgICBwYXRoU3RyKz0gXCJNXCIgKyByb3VuZChwLngpICsgXCIgXCIgKyByb3VuZChwLnkpICsgXCIgXCI7XG4gICAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgIGMgPSAocG9pbnRzW2ldLnggKyBwb2ludHNbaSArIDFdLngpIC8gMjtcbiAgICAgICAgICAgICAgICBkID0gKHBvaW50c1tpXS55ICsgcG9pbnRzW2kgKyAxXS55KSAvIDI7XG4gICAgICAgICAgICAgICAgcGF0aFN0cis9IFwiUVwiICsgcm91bmQocG9pbnRzW2ldLngpICsgXCIgXCIgKyByb3VuZChwb2ludHNbaV0ueSkgKyBcIiBcIiArIGMgKyBcIiBcIiArIGQgKyBcIiBcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHJvdW5kKHBvaW50c1tpXS54KSArIFwiIFwiICsgcm91bmQocG9pbnRzW2ldLnkpICsgXCIgXCI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgICBwYXRoU3RyKz0gXCJNXCIgKyBwLnggKyBcIiBcIiArIHAueSArIFwiIFwiO1xuICAgICAgICAgICAgZm9yIChpID0gMTsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKz0xKSB7XG4gICAgICAgICAgICAgIHAgPSBwb2ludHNbaSAtIDFdO1xuICAgICAgICAgICAgICBwMSA9IHBvaW50c1tpXTtcbiAgICAgICAgICAgICAgcDIgPSBwb2ludHNbaSArIDFdO1xuICAgICAgICAgICAgICBjcHMgPSBnZXRDb250cm9sUG9pbnRzKHAueCwgcC55LCBwMS54LCBwMS55LCBwMi54LCBwMi55LCB0KTtcbiAgICAgICAgICAgICAgcGF0aFN0cis9IFwiQ1wiICsgcm91bmQoY3BzLnAxLngpICsgXCIgXCIgKyByb3VuZChjcHMucDEueSkgKyBcIiBcIiArIHJvdW5kKGNwcy5wMi54KSArIFwiIFwiICsgcm91bmQoY3BzLnAyLnkpICsgXCIgXCIgKyByb3VuZChwMi54KSArIFwiIFwiICsgcm91bmQocDIueSkgKyBcIiBcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHJvdW5kKHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0ueCkgKyBcIiBcIiArIHJvdW5kKHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0ueSkgKyBcIiBcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGRlbGV0ZSBvcHRzLnNtb290aDtcbiAgICAgICAgZGVsZXRlIG9wdHMudGVuc2lvbjtcbiAgICAgICAgZGVsZXRlIG9wdHMuYXBwcm94aW1hdGU7XG4gICAgICAgIFxuICAgICAgICBwYXRoLmF0dHIoZXh0ZW5kKHtcbiAgICAgICAgICBmaWxsOiAnbm9uZSdcbiAgICAgICAgfSwgb3B0cywge1xuICAgICAgICAgIGQ6IHBhdGhTdHJcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVGhlIGFyYygpIG1ldGhvZCBjcmVhdGVzIGFuIGFyYy9jdXJ2ZSAodXNlZCB0byBjcmVhdGUgY2lyY2xlcywgb3IgcGFydHMgb2YgY2lyY2xlcykuIFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBzQW5nbGVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZUFuZ2xlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgYXJjOiBmdW5jdGlvbihjeCwgY3ksIHIsIHNBbmdsZSwgZUFuZ2xlLCBjb3VudGVyY2xvY2t3aXNlLCBhdHRycykge1xuICAgICAgY291bnRlcmNsb2Nrd2lzZSA9IHR5cGVvZiBjb3VudGVyY2xvY2t3aXNlID09PSAnYm9vbGVhbicgPyBjb3VudGVyY2xvY2t3aXNlIDogZmFsc2U7XG4gICAgICB2YXJcbiAgICAgICAgZCA9ICdNICcgKyByb3VuZChjeCkgKyAnLCAnICsgcm91bmQoY3kpLFxuICAgICAgICBjeHMsXG4gICAgICAgIGN5cyxcbiAgICAgICAgY3hlLFxuICAgICAgICBjeWU7XG4gICAgICBpZiAoZUFuZ2xlIC0gc0FuZ2xlID09PSBNYXRoLlBJICogMikge1xuICAgICAgICAvLyBDaXJjbGVcbiAgICAgICAgZCs9ICcgbSAtJyArIHIgKyAnLCAwIGEgJyArIHIgKyAnLCcgKyByICsgJyAwIDEsMCAnICsgKHIgKiAyKSArICcsMCBhICcgKyByICsgJywnICsgciArICcgMCAxLDAgLScgKyAociAqIDIpICsgJywwJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN4cyA9IHJvdW5kKGN4ICsgY29zKHNBbmdsZSkgKiByKTtcbiAgICAgICAgY3lzID0gcm91bmQoY3kgKyBzaW4oc0FuZ2xlKSAqIHIpO1xuICAgICAgICBjeGUgPSByb3VuZChjeCArIGNvcyhlQW5nbGUpICogcik7XG4gICAgICAgIGN5ZSA9IHJvdW5kKGN5ICsgc2luKGVBbmdsZSkgKiByKTtcbiAgICAgICAgZCs9IFwiIExcIiArIGN4cyArIFwiLFwiICsgY3lzICtcbiAgICAgICAgICBcIiBBXCIgKyByICsgXCIsXCIgKyByICsgXCIgMCBcIiArIChlQW5nbGUgLSBzQW5nbGUgPiBQSSA/IDEgOiAwKSArIFwiLFwiICsgKGNvdW50ZXJjbG9ja3dpc2UgPyAwIDogMSkgK1xuICAgICAgICAgIFwiIFwiICsgY3hlICsgXCIsXCIgKyBjeWUgKyBcIiBaXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInBhdGhcIiwge1xuICAgICAgICBkOiBkXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIHRleHQgaW50byBhIGJvdW5kaW5nIGJveCBieSB3cmFwcGluZyBsaW5lcyBhdCBzcGFjZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0geVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB3aWR0aFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RyaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgdGV4dGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIHN0cmluZywgYXR0cnMgKSB7XG4gICAgICBcbiAgICAgIHZhciBcbiAgICAgICAgc2VsZiA9IHRoaXM7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICBsaW5lcyA9IHdpZHRoID8gW10gOiBbc3RyaW5nXSwgXG4gICAgICAgICAgbGluZSA9IFtdLFxuICAgICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgICAgd29yZHMgPSB3aWR0aCA/IHN0cmluZy5zcGxpdCgvXFxzKy8pIDogW10sXG4gICAgICAgICAgdGV4dCA9IHNlbGYuY3JlYXRlKCd0ZXh0JywgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywge1xuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHlcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgdGV4dE5vZGUsXG4gICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICB0ZXh0QWxpZ24gPSB0ZXh0LmNzcygndGV4dC1hbGlnbicpLFxuICAgICAgICAgIHR5ID0gMDtcbiAgICAgICAgXG4gICAgICAgIF92ZWxlbS5hcHBlbmQodGV4dCk7XG4gICAgICAgIFxuICAgICAgICBcbiAgICAgICAgaWYgKHdpZHRoKSB7XG4gICAgICAgICAgLy8gQnJlYWsgbGluZXNcbiAgICAgICAgICB0ZXh0Tm9kZSA9IGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgICB0ZXh0LmFwcGVuZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgd29yZHMuZm9yRWFjaChmdW5jdGlvbih3b3JkLCBpbmRleCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGxpbmUuam9pbignICcpICsgJyAnICsgd29yZDtcbiAgICAgICAgICAgIGxlbmd0aCA9IHRleHQuY29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICAgIGxpbmUgPSBbd29yZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lLnB1c2god29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5kZXggPT09IHdvcmRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGV4dC5yZW1vdmUodGV4dE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZW5kZXIgbGluZXNcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbihsaW5lLCBpbmRleCkge1xuICAgICAgICAgIHZhciB0c3BhbiwgZHk7XG4gICAgICAgICAgaWYgKCFoZWlnaHQgfHwgdHkgKyBwYXJzZUZsb2F0KGxpbmVIZWlnaHQpIDwgaGVpZ2h0KSB7XG4gICAgICAgICAgICBkeSA9IGluZGV4ID4gMCA/IGxpbmVIZWlnaHQgOiBmb250U2l6ZSAtIDI7XG4gICAgICAgICAgICB0eSs9IGR5O1xuICAgICAgICAgICAgdHNwYW4gPSBzZWxmLmNyZWF0ZSgndHNwYW4nLCB7ZHk6IGR5fSk7XG4gICAgICAgICAgICB0ZXh0LmFwcGVuZCh0c3Bhbik7XG4gICAgICAgICAgICB0c3BhblxuICAgICAgICAgICAgICAuYXBwZW5kKGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lKSlcbiAgICAgICAgICAgICAgLmF0dHIoJ3gnLCBwYXJzZUludCh0ZXh0LmF0dHIoJ3gnKSwgdW5kZWZpbmVkKSArICh3aWR0aCAtIHRzcGFuLmNvbXB1dGVkVGV4dExlbmd0aCgpKSAqICh0ZXh0QWxpZ24gPT09ICdlbmQnIHx8IHRleHRBbGlnbiA9PT0gJ3JpZ2h0JyA/IDEgOiB0ZXh0QWxpZ24gPT09ICdjZW50ZXInIHx8IHRleHRBbGlnbiA9PT0gJ21pZGRsZScgPyAwLjUgOiAwKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdDogZnVuY3Rpb24oIHgsIHksIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGJveCh4LCB5LCAwLCAwLCBpdGVtcywgb3B0aW9ucyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0IGludG8gdGhlIHNwZWNpZmllZCBib3VuZHMuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgaXRlbXMgPSB0b0FycmF5KGl0ZW1zKS5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnID8ge2xhYmVsOiBpdGVtfSA6IGl0ZW07XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICBcbiAgICAgIG9wdGlvbnMgPSBleHRlbmQoe30sIHtcbiAgICAgICAgaG9yaXpvbnRhbDogZmFsc2UsXG4gICAgICAgIGJ1bGxldDoge1xuICAgICAgICAgIHNoYXBlOiAnY2lyY2xlJ1xuICAgICAgICB9XG4gICAgICB9LCBvcHRpb25zKTtcbiAgICAgIFxuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgXG4gICAgICAgIHZhciB0b3AgPSB5O1xuICAgICAgICBcbiAgICAgICAgaXRlbXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCkge1xuICAgICAgICAgIFxuICAgICAgICAgIHZhclxuICAgICAgICAgICAgX3ZlbGVtID0gX3YoZWxlbSksXG4gICAgICAgICAgICBpdGVtT3B0cyA9IGV4dGVuZCh0cnVlLCB7fSwgb3B0aW9ucywgaXRlbSksXG4gICAgICAgICAgICBob3Jpem9udGFsID0gaXRlbU9wdHMuaG9yaXpvbnRhbCxcbiAgICAgICAgICAgIHNoYXBlID0gaXRlbU9wdHMuYnVsbGV0LnNoYXBlLFxuICAgICAgICAgICAgbGFiZWwgPSBpdGVtT3B0cy5sYWJlbCxcbiAgICAgICAgICAgIGJ1bGxldEF0dHJzLFxuICAgICAgICAgICAgaXRlbUxheWVyID0gX3ZlbGVtLmcoKSxcbiAgICAgICAgICAgIGxpbmVIZWlnaHQgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2xpbmUtaGVpZ2h0JykpLFxuICAgICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICAgIGJ1bGxldFNpemUgPSByb3VuZChmb250U2l6ZSAqIDAuNjUpLFxuICAgICAgICAgICAgc3BhY2luZyA9IGxpbmVIZWlnaHQgKiAwLjIsXG4gICAgICAgICAgICBpdGVtV2lkdGgsXG4gICAgICAgICAgICBpdGVtSGVpZ2h0O1xuICAgICAgICAgIFxuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5idWxsZXQuc2hhcGU7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmhvcml6b250YWw7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmxhYmVsO1xuICAgICAgICAgIFxuICAgICAgICAgIGJ1bGxldEF0dHJzID0gZXh0ZW5kKHRydWUsIHt9LCBpdGVtT3B0cywgaXRlbU9wdHMuYnVsbGV0KTsgXG4gICAgICAgICAgXG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmJ1bGxldDtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaGVpZ2h0ICYmIHkgKyBmb250U2l6ZSA+IHRvcCArIGhlaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW5kZXIgYnVsbGV0XG4gICAgICAgICAgaWYgKHNoYXBlID09PSAnY2lyY2xlJykge1xuICAgICAgICAgICAgaXRlbUxheWVyLmNpcmNsZSh4ICsgYnVsbGV0U2l6ZSAvIDIsIHkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAvIDIgKyBidWxsZXRTaXplIC8gMiwgYnVsbGV0U2l6ZSAvIDIsIGJ1bGxldEF0dHJzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlbUxheWVyLnJlY3QoeCwgcm91bmQoeSkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAvIDIsIGJ1bGxldFNpemUsIGJ1bGxldFNpemUsIGJ1bGxldEF0dHJzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUmVuZGVyIGxhYmVsXG4gICAgICAgICAgaXRlbUxheWVyLnRleHRib3goeCArIGJ1bGxldFNpemUgKyBzcGFjaW5nLCB5LCB3aWR0aCA/IHdpZHRoIC0gYnVsbGV0U2l6ZSAtIHNwYWNpbmcgOiAwLCBoZWlnaHQgPyB0b3AgKyBoZWlnaHQgLSB5IDogMCwgbGFiZWwsIGl0ZW1PcHRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpdGVtV2lkdGggPSBNYXRoLmNlaWwoaXRlbUxheWVyLmJib3goKS53aWR0aCArIGZvbnRTaXplKTtcbiAgICAgICAgICBpdGVtSGVpZ2h0ID0gTWF0aC5yb3VuZChpdGVtTGF5ZXIuYmJveCgpLmhlaWdodCArIChsaW5lSGVpZ2h0IC0gZm9udFNpemUpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgeCs9IGl0ZW1XaWR0aDtcbiAgICAgICAgICAgIGlmICh3aWR0aCAmJiB4ID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgeSs9IGl0ZW1IZWlnaHQ7XG4gICAgICAgICAgICAgIHggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5Kz0gaXRlbUhlaWdodDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfSk7XG4gIFxuICByZXR1cm4gX3Y7XG4gIFxufSgpKTtcblxubW9kdWxlLmV4cG9ydHMgPSBfdjsiXX0=
