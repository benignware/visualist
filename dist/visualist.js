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
        return this[0] && this[0].getBBox();
      } catch (e) {
        return {width: 0, height: 0};
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBfdiA9IChmdW5jdGlvbigpIHtcbiAgXG4gIFxuICB2YXIgXG4gICAgU1ZHX05BTUVTUEFDRV9VUkkgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsXG4gICAgTUFUSCA9IE1hdGgsXG4gICAgUEkgPSBNQVRILlBJLFxuICAgIGNvcyA9IE1BVEguY29zLFxuICAgIHNpbiA9IE1BVEguc2luLFxuICAgIHNxcnQgPSBNQVRILnNxcnQsXG4gICAgcG93ID0gTUFUSC5wb3csXG4gICAgZmxvb3IgPSBNQVRILmZsb29yLFxuICBcbiAgICAvKipcbiAgICAgKiBDYW1lbGl6ZSBhIHN0cmluZ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKi8gXG4gICAgY2FtZWxpemUgPSAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlW3N0cmluZ10gPSBjYWNoZVtzdHJpbmddIHx8IChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLyhcXC1bYS16XSkvZywgZnVuY3Rpb24oJDEpe3JldHVybiAkMS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoJy0nLCcnKTt9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH07XG4gICAgfSkoKSxcbiAgXG4gICAgLyoqXG4gICAgICogSHlwaGVuYXRlIGEgc3RyaW5nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqL1xuICAgIGh5cGhlbmF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjYWNoZSA9IHt9O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICByZXR1cm4gY2FjaGVbc3RyaW5nXSA9IGNhY2hlW3N0cmluZ10gfHwgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvKFtBLVpdKS9nLCBmdW5jdGlvbigkMSl7cmV0dXJuIFwiLVwiKyQxLnRvTG93ZXJDYXNlKCk7fSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gIFxuICAgIC8qKlxuICAgICAqIEV4dGVuZHMgYW4gb2JqZWN0XG4gICAgICogQHBhcmFtIHtCb29sZWFufSB0cnVlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRlc3RpbmF0aW9uXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZVxuICAgICAqL1xuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGRlZXAsIGRlc3RpbmF0aW9uLCBzb3VyY2UpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLCBpID0gdHlwZW9mIGRlZXAgPT09ICdib29sZWFuJyA/IDIgOiAxLCBkZXN0ID0gYXJndW1lbnRzW2kgLSAxXSwgc3JjLCBwcm9wLCB2YWx1ZTtcbiAgICAgIGZvciAoOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzcmMgPSBhcmdzW2ldO1xuICAgICAgICBmb3IgKHByb3AgaW4gc3JjKSB7XG4gICAgICAgICAgdmFsdWUgPSBzcmNbcHJvcF07XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgICAgZGVzdFtwcm9wXSA9IGRlc3RbcHJvcF0gfHwge307XG4gICAgICAgICAgICAgIGlmIChkZWVwKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5kKHRydWUsIGRlc3RbcHJvcF0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGVzdFtwcm9wXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgfSxcbiAgICBcbiAgICB0b0FycmF5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICBcbiAgICAgIC8vcmV0dXJuIG9iaiAmJiAob2JqLmxlbmd0aCAmJiBbXS5zbGljZS5jYWxsKG9iaikgfHwgW29ial0pO1xuICAgICAgXG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhciBsID0gb2JqICYmIG9iai5sZW5ndGggfHwgMCwgaSwgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmIChvYmpbaV0pIHtcbiAgICAgICAgICByZXN1bHQucHVzaChvYmpbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiByZXN1bHQubGVuZ3RoICYmIHJlc3VsdCB8fCBbb2JqXTtcbiAgICB9LFxuICAgIFxuICAgIC8vIERPTSBNYW5pcHVsYXRpb25cbiAgICBcbiAgICAvKipcbiAgICAgKiBcbiAgICAgKi9cbiAgICBcbiAgICBwYXJlbnQgPSBmdW5jdGlvbihlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS5wYXJlbnROb2RlO1xuICAgIH0sXG4gICAgXG4gICAgYXBwZW5kID0gZnVuY3Rpb24oIHBhcmVudCwgY2hpbGQgKSB7XG4gICAgICBwYXJlbnQgPSBwYXJlbnQgJiYgcGFyZW50WzBdIHx8IHBhcmVudDtcbiAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50LmFwcGVuZENoaWxkKSB7XG4gICAgICAgIHRvQXJyYXkoY2hpbGQpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICAgIHBhcmVudC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIFxuICAgIHByZXBlbmQgPSBmdW5jdGlvbiggcGFyZW50LCBjaGlsZCApIHtcbiAgICAgIHBhcmVudCA9IHBhcmVudFswXSB8fCBwYXJlbnQ7XG4gICAgICB0b0FycmF5KGNoaWxkKS5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoY2hpbGQsIHBhcmVudC5maXJzdENoaWxkKTtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgXG4gICAgcmVtb3ZlID0gZnVuY3Rpb24oIGVsZW0sIGNoaWxkICkge1xuICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgIHRvQXJyYXkoY2hpbGQpLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICBlbGVtLnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGVsZW0ucGFyZW50Tm9kZSkge1xuICAgICAgICBlbGVtLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWxlbSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBcbiAgICBodG1sID0gZnVuY3Rpb24oZWxlbSwgc3RyaW5nKSB7XG4gICAgICBpZiAoc3RyaW5nKSB7XG4gICAgICAgIGVsZW0uaW5uZXJIVE1MID0gc3RyaW5nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW0uaW5uZXJIVE1MO1xuICAgIH0sXG4gICAgXG4gICAgdGV4dCA9IGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIHJldHVybiBlbGVtLnRleHRDb250ZW50O1xuICAgIH0sXG4gICAgXG4gICAgYXR0ciA9IGZ1bmN0aW9uIChlbGVtLCBuYW1lLCB2YWx1ZSkge1xuICAgICAgdmFyIHJlc3VsdCA9IG51bGwsIG9iaiA9IHt9LCBwcm9wO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICBvYmogPSBuYW1lO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgICBvYmpbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIG1hcFN0eWxlcyhuYW1lKSB7XG4gICAgICAgIHJldHVybiBoeXBoZW5hdGUobmFtZSkgKyBcIjogXCIgKyB2YWx1ZVtuYW1lXTtcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhvYmopLmxlbmd0aCkge1xuICAgICAgICBmb3IgKG5hbWUgaW4gb2JqKSB7XG4gICAgICAgICAgcHJvcCA9IHR5cGVvZiBlbGVtW2NhbWVsaXplKG5hbWUpXSAhPT0gJ3VuZGVmaW5lZCcgPyBjYW1lbGl6ZShuYW1lKSA6IGh5cGhlbmF0ZShuYW1lKTtcbiAgICAgICAgICB2YWx1ZSA9IG9ialtuYW1lXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gU2V0XG4gICAgICAgICAgICBpZiAobmFtZSA9PT0gJ3N0eWxlJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gT2JqZWN0LmtleXModmFsdWUpLm1hcChtYXBTdHlsZXMpLmpvaW4oXCI7IFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUocHJvcCwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgLy8gR2V0XG4gICAgICAgICAgICByZXN1bHQgPSBlbGVtLmdldEF0dHJpYnV0ZShwcm9wKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgXG4gICAgY3NzID0gZnVuY3Rpb24oZWxlbSwgbmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciBtYXAgPSB7fSwgY3NzVGV4dCA9IG51bGw7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIG1hcCA9IG5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBtYXBbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGNzc1RleHQgPSBPYmplY3Qua2V5cyhtYXApLm1hcChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBoeXBoZW5hdGUobmFtZSkgKyBcIjogXCIgKyBtYXBbbmFtZV07XG4gICAgICB9KS5qb2luKFwiOyBcIik7XG4gICAgICBpZiAoY3NzVGV4dCAmJiBjc3NUZXh0Lmxlbmd0aCkge1xuICAgICAgICBlbGVtLnN0eWxlLmNzc1RleHQgPSBlbGVtLnN0eWxlLmNzc1RleHQgKyBjc3NUZXh0O1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtLnN0eWxlW25hbWVdIHx8IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsZW0sIG51bGwpLmdldFByb3BlcnR5VmFsdWUobmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICBhZGRDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICBoYXNDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgcmV0dXJuIGVsZW0uY2xhc3NMaXN0LmNvbnRhaW5zKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICByZW1vdmVDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICB0b2dnbGVDbGFzcyA9IGZ1bmN0aW9uKGVsZW0sIGNsYXNzTmFtZSkge1xuICAgICAgZWxlbS5jbGFzc0xpc3QudG9nZ2xlKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXRzIGEgcGFpciBvZiBiZXppZXIgY29udHJvbCBwb2ludHNcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDBcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTBcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTFcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geDJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geTJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdFxuICAgICAqL1xuICAgIGdldENvbnRyb2xQb2ludHMgPSBmdW5jdGlvbiggeDAsIHkwLCB4MSwgeTEsIHgyLCB5MiwgdCApIHtcbiAgICAgIHQgPSB0eXBlb2YgdCA9PT0gJ251bWJlcicgPyB0IDogMC41O1xuICAgICAgdmFyXG4gICAgICAgIGQwMSA9IHNxcnQoIHBvdyggeDEgLSB4MCwgMiApICsgcG93KCB5MSAtIHkwLCAyICkgKSxcbiAgICAgICAgZDEyID0gc3FydCggcG93KCB4MiAtIHgxLCAyICkgKyBwb3coIHkyIC0geTEsIDIgKSApLFxuICAgICAgICBmYSA9IHQgKiBkMDEgLyAoIGQwMSArIGQxMiApLCAgIC8vIHNjYWxpbmcgZmFjdG9yIGZvciB0cmlhbmdsZSBUYVxuICAgICAgICBmYiA9IHQgKiBkMTIgLyAoIGQwMSArIGQxMiApLCAgIC8vIGRpdHRvIGZvciBUYiwgc2ltcGxpZmllcyB0byBmYj10LWZhXG4gICAgICAgIHAxeCA9IHgxIC0gZmEgKiAoIHgyIC0geDAgKSwgICAgLy8geDIteDAgaXMgdGhlIHdpZHRoIG9mIHRyaWFuZ2xlIFRcbiAgICAgICAgcDF5ID0geTEgLSBmYSAqICggeTIgLSB5MCApLCAgICAvLyB5Mi15MCBpcyB0aGUgaGVpZ2h0IG9mIFRcbiAgICAgICAgcDJ4ID0geDEgKyBmYiAqICggeDIgLSB4MCApLFxuICAgICAgICBwMnkgPSB5MSArIGZiICogKCB5MiAtIHkwICk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBwMToge3g6IHAxeCwgeTogcDF5fSwgXG4gICAgICAgIHAyOiB7eDogcDJ4LCB5OiBwMnl9XG4gICAgICB9O1xuICAgIH0sXG4gIFxuICAgIC8qKlxuICAgICAqIFNlcmlhbGl6ZXMgcG9pbnRzIGFzIHN2ZyBwYXRoIGRlZmluaXRpb25cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBwb2ludHNcbiAgICAgKi9cbiAgICBnZXRQYXRoID0gZnVuY3Rpb24oIHBvaW50cyApIHtcbiAgICAgIHJldHVybiBwb2ludHMubWFwKGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHJldHVybiBwb2ludC54ICsgXCIsXCIgKyBwb2ludC55O1xuICAgICAgfSkuam9pbihcIiBcIik7XG4gICAgfSxcbiAgXG4gIFxuICAgIC8qKlxuICAgICAqIFZpc3VhbGlzdCBxdWVyeSBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIF92ID0gZnVuY3Rpb24oc2VsZWN0b3IsIHdpZHRoLCBoZWlnaHQsIGF0dHJzKSB7XG4gICAgICB2YXIgYXJnLCBpLCBzLCB3LCBoLCBhLCBzZXQ7XG4gICAgICBmb3IgKGkgPSAwLCBhcmc7IGFyZyA9IGFyZ3VtZW50c1tpXTsgaSsrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyAmJiAhaXNOYU4ocGFyc2VGbG9hdChhcmcpKSkge1xuICAgICAgICAgIC8vIE51bWVyaWNcbiAgICAgICAgICBhcmcgPSB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyA/IHBhcnNlRmxvYXQoYXJnKSArIFwicHhcIiA6IGFyZztcbiAgICAgICAgICBpZiAodHlwZW9mIHcgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBoID0gYXJnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3ID0gYXJnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgIC8vIFBsYWluIG9iamVjdFxuICAgICAgICAgIGEgPSBhcmc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gRXZlcnl0aGluZyBlbHNlIG1heSBiZSBhIHNlbGVjdG9yXG4gICAgICAgICAgcyA9IGFyZztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2V0ID0gcyBpbnN0YW5jZW9mIFZpc3VhbGlzdCA/IHMgOiBuZXcgVmlzdWFsaXN0KHMpO1xuICAgICAgc2V0LmF0dHIoZXh0ZW5kKHRydWUsIGEgfHwge30sIHtcbiAgICAgICAgd2lkdGg6IHcsIFxuICAgICAgICBoZWlnaHQ6IGhcbiAgICAgIH0pKTtcbiAgICAgIHJldHVybiBzZXQ7XG4gICAgfTtcblxuICAvKipcbiAgICogVmlzdWFsaXN0IENsYXNzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICAgKi9cblxuICBmdW5jdGlvbiBWaXN1YWxpc3Qoc2VsZWN0b3IpIHtcbiAgICB2YXIgc2V0ID0gbnVsbCwgZWxlbSwgcmVzdWx0LCBpLCBzdmc7XG4gICAgLy8gQ29sbGVjdCBjb25zdHJ1Y3RvciBhcmdzXG4gICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ29iamVjdCcgJiYgc2VsZWN0b3IubmFtZXNwYWNlVVJJID09PSBTVkdfTkFNRVNQQUNFX1VSSSkge1xuICAgICAgLy8gRXhpc3RpbmcgRWxlbWVudFxuICAgICAgc2V0ID0gW3NlbGVjdG9yXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFNlbGVjdG9yXG4gICAgICByZXN1bHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIGZvciAoaSA9IDAsIGVsZW07IGVsZW0gPSByZXN1bHRbaV07IGkrKykge1xuICAgICAgICBpZiAoZWxlbS5uYW1lc3BhY2VVUkkgPT09IFNWR19OQU1FU1BBQ0VfVVJJICkge1xuICAgICAgICAgIHNldCA9IHNldCB8fCBbXTtcbiAgICAgICAgICBzZXQucHVzaChlbGVtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXNldCkge1xuICAgICAgc3ZnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OQU1FU1BBQ0VfVVJJLCAnc3ZnJyk7XG4gICAgICBzdmcuc2V0QXR0cmlidXRlKFwieG1sbnNcIiwgU1ZHX05BTUVTUEFDRV9VUkkpO1xuICAgICAgc2V0ID0gW3N2Z107XG4gICAgfVxuICAgIHRoaXMucHVzaC5hcHBseSh0aGlzLCBzZXQgfHwgW10pO1xuICB9XG4gIFxuICBWaXN1YWxpc3QucHJvdG90eXBlID0gW107XG4gIFxuICAvLyBTdGF0aWMgbWV0aG9kc1xuICBfdi5leHRlbmQgPSBleHRlbmQ7XG4gIF92LmF0dHIgPSBhdHRyO1xuICBfdi5jc3MgPSBjc3M7XG4gIFxuICAvLyBQbHVnaW4gQVBJXG4gIF92LmZuID0gVmlzdWFsaXN0LnByb3RvdHlwZTtcbiAgXG4gIC8qKlxuICAgKiBFeHRlbmRzIHZpc3VhbGlzdCBwcm90b3R5cGVcbiAgICogQHBhcmFtIHtBcnJheX0gbWV0aG9kc1xuICAgKi9cbiAgX3YuZm4uZXh0ZW5kID0gZnVuY3Rpb24oIG1ldGhvZHMgKSB7XG4gICAgZm9yICh2YXIgeCBpbiBtZXRob2RzKSB7XG4gICAgICBWaXN1YWxpc3QucHJvdG90eXBlW3hdID0gbWV0aG9kc1t4XTtcbiAgICB9XG4gIH07XG4gIFxuICAvLyBQcml2YXRlIENvbXBvbmVudHNcbiAgXG4gIC8qKlxuICAgKiBEcmF3IGJhc2ljIHNoYXBlc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnTmFtZVxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgKiBAcGFyYW0ge0FycmF5fSBjaGlsZHJlbiBcbiAgICovXG4gIGZ1bmN0aW9uIHNoYXBlKHRhZ05hbWUsIHBhcmFtcywgYXR0cnMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICBfdihlbGVtKS5hcHBlbmQoc2VsZi5jcmVhdGUodGFnTmFtZSwgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywgcGFyYW1zKSkuYXBwZW5kKGNoaWxkcmVuKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgXG4gIC8vIFB1YmxpYyBDb21wb25lbnRzXG4gIFxuICBfdi5mbi5leHRlbmQoe1xuICAgIFxuICAgIHNpemU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMubGVuZ3RoO1xuICAgIH0sXG4gICAgXG4gICAgdG9BcnJheTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdG9BcnJheSh0aGlzKTtcbiAgICB9LFxuICAgIFxuICAgIGdldDogZnVuY3Rpb24oIGluZGV4ICkge1xuICAgICAgcmV0dXJuIHR5cGVvZiBpbmRleCAhPT0gJ3VuZGVmaW5lZCcgPyBpbmRleCA8IDAgPyB0aGlzW3RoaXMubGVuZ3RoIC0gaW5kZXhdIDogdGhpc1tpbmRleF0gOiB0aGlzLnRvQXJyYXkoKTtcbiAgICB9LFxuICAgIFxuICAgIGluZGV4OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHRvQXJyYXkodGhpc1swXS5wYXJlbnROb2RlLmNoaWxkcmVuKS5pbmRleE9mKHRoaXNbMF0pIHx8IC0xO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogQXBwZW5kcyB0aGUgc3BlY2lmaWVkIGNoaWxkIHRvIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgYXBwZW5kOiBmdW5jdGlvbiggY2hpbGQgKSB7XG4gICAgICBpZiAodGhpc1swXSkge1xuICAgICAgICBhcHBlbmQodGhpc1swXSwgY2hpbGQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBBcHBlbmRzIHRoZSBjdXJyZW50IHNldCBvZiBlbGVtZW50cyB0byB0aGUgc3BlY2lmaWVkIHBhcmVudFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIGFwcGVuZFRvOiBmdW5jdGlvbiggcGFyZW50ICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgIGFwcGVuZChwYXJlbnQsIGVsZW0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUHJlcGVuZHMgdGhlIHNwZWNpZmllZCBjaGlsZCB0byB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIHByZXBlbmQ6IGZ1bmN0aW9uKCBjaGlsZCApIHtcbiAgICAgIGlmICh0aGlzWzBdKSB7XG4gICAgICAgIHByZXBlbmQodGhpc1swXSwgY2hpbGQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBQcmVwZW5kcyB0aGUgY3VycmVudCBzZXQgb2YgZWxlbWVudHMgdG8gdGhlIHNwZWNpZmllZCBwYXJlbnRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBwcmVwZW5kVG86IGZ1bmN0aW9uKCBwYXJlbnQgKSB7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBwcmVwZW5kKHBhcmVudCwgZWxlbSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgZWxlbWVudHMgaW4gdGhlIHNldCBvciByZW1vdmVzIHRoZSBzcGVjaWZpZWQgY2hpbGQgZnJvbSB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgcmVtb3ZlOiBmdW5jdGlvbiggY2hpbGQgKSB7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICByZW1vdmUoZWxlbSwgY2hpbGQpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgY2hpbGRyZW4gZnJvbSBlbGVtZW50cyBpbiB0aGUgc2V0XG4gICAgICovXG4gICAgY2xlYXI6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBlbGVtLnJlbW92ZUNoaWxkKGVsZW0uY2hpbGROb2Rlc1tpXSk7XG4gICAgICAgICAgaS0tO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcGFyZW50IG5vZGUgb2YgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKi9cbiAgICBwYXJlbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgcGFyZW50KHRoaXNbMF0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB2YWx1ZSBvZiBhbiBhdHRyaWJ1dGUgZm9yIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cyBvciBzZXQgb25lIG9yIG1vcmUgYXR0cmlidXRlcyBmb3IgZXZlcnkgbWF0Y2hlZCBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gICAgICovXG4gICAgYXR0cjogZnVuY3Rpb24oIG5hbWUsIHZhbHVlICkge1xuICAgICAgdmFyIHJlc3VsdCA9IHRoaXM7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICB2YXIgcmV0ID0gYXR0cihlbGVtLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmIChyZXQgIT09IG51bGwpIHtcbiAgICAgICAgICByZXN1bHQgPSByZXQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2YgYSBjb21wdXRlZCBzdHlsZSBwcm9wZXJ0eSBmb3IgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzIG9yIHNldCBvbmUgb3IgbW9yZSBDU1MgcHJvcGVydGllcyBmb3IgZXZlcnkgbWF0Y2hlZCBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gICAgICovXG4gICAgY3NzOiBmdW5jdGlvbiggbmFtZSwgdmFsdWUgKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gdGhpcztcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHZhciByZXQgPSBjc3MoZWxlbSwgbmFtZSwgdmFsdWUpO1xuICAgICAgICBpZiAocmV0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0ID0gcmV0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IGVsZW1lbnQgd2l0aCB0aGUgc3BlY2lmZWQgdGFnbmFtZS5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGFnTmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGNyZWF0ZTogZnVuY3Rpb24oIHRhZ05hbWUsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIF92KCh0aGlzWzBdICYmIHRoaXNbMF0ub3duZXJEb2N1bWVudCB8fCBkb2N1bWVudCkuY3JlYXRlRWxlbWVudE5TKHRoaXNbMF0gJiYgdGhpc1swXS5uYW1lc3BhY2VVUkkgfHwgU1ZHX05BTUVTUEFDRV9VUkksIHRhZ05hbWUpKS5hdHRyKGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldHMgb3Igc2V0cyB0aGUgd2lkdGggb24gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqL1xuICAgIHdpZHRoOiBmdW5jdGlvbiggd2lkdGggKSB7XG4gICAgICAvL2NvbnNvbGUud2FybihcImRlcHJlY2F0ZWRcIik7XG4gICAgICBpZiAodHlwZW9mIHdpZHRoID09PSAndW5kZWZpbmVkJyAmJiB0aGlzWzBdKSB7XG4gICAgICAgIHJldHVybiB0aGlzWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRyKCd3aWR0aCcsIHdpZHRoKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSBoZWlnaHQgb24gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKi9cbiAgICBoZWlnaHQ6IGZ1bmN0aW9uKCBoZWlnaHQgKSB7XG4gICAgICAvL2NvbnNvbGUud2FybihcImRlcHJlY2F0ZWRcIik7XG4gICAgICBpZiAodHlwZW9mIGhlaWdodCA9PT0gJ3VuZGVmaW5lZCcgJiYgdGhpc1swXSkge1xuICAgICAgICByZXR1cm4gdGhpc1swXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG4gICAgICB9XG4gICAgICB0aGlzLmF0dHIoJ2hlaWdodCcsIGhlaWdodCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgYm91bmRpbmcgYm94IG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICovXG4gICAgYmJveDogZnVuY3Rpb24oKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpc1swXSAmJiB0aGlzWzBdLmdldEJCb3goKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHt3aWR0aDogMCwgaGVpZ2h0OiAwfTtcbiAgICAgIH0gXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbXB1dGVkIHRleHQgbGVuZ3RoIG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgaWYgYXBwbGljYWJsZS5cbiAgICAgKi9cbiAgICBjb21wdXRlZFRleHRMZW5ndGg6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdGhpc1swXS5nZXRDb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSBncm91cCBsYXllciBvbiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZzogZnVuY3Rpb24oIGF0dHJzICkge1xuICAgICAgdmFyIGcgPSB0aGlzLmNyZWF0ZSgnZycsIGF0dHJzKTtcbiAgICAgIF92KHRoaXNbMF0pLmFwcGVuZChnKTtcbiAgICAgIHJldHVybiBnO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBjaXJjbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgY2lyY2xlOiBmdW5jdGlvbiggY3gsIGN5LCByLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiY2lyY2xlXCIsIHtcbiAgICAgICAgY3g6IGN4LCBcbiAgICAgICAgY3k6IGN5LCBcbiAgICAgICAgcjogclxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYW4gZWxsaXBzZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGN5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHJ5XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgZWxsaXBzZTogZnVuY3Rpb24oIGN4LCBjeSwgcngsIHJ5LCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwiZWxsaXBzZVwiLCB7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHJ4OiByeCxcbiAgICAgICAgcnk6IHJ5XG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHJlY3RhbmdsZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICByZWN0OiBmdW5jdGlvbiggeCwgeSwgd2lkdGgsIGhlaWdodCwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInJlY3RcIiwge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeSwgXG4gICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgbGluZSBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgbGluZTogZnVuY3Rpb24oIHgxLCB5MSwgeDIsIHkyLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwibGluZVwiLCB7XG4gICAgICAgIHgxOiB4MSxcbiAgICAgICAgeTE6IHkxLFxuICAgICAgICB4MjogeDIsXG4gICAgICAgIHkyOiB5MlxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBwb2x5Z29uIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9pbnRzXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcG9seWdvbjogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWdvbicsIHtcbiAgICAgICAgcG9pbnRzOiBnZXRQYXRoKHBvaW50cylcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlsaW5lOiBmdW5jdGlvbiggcG9pbnRzLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICdwb2x5bGluZScsIHtcbiAgICAgICAgcG9pbnRzOiBnZXRQYXRoKHBvaW50cylcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcGF0aCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwYXRoOiBmdW5jdGlvbiggZCwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncGF0aCcsIHtkOiBkfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVuZGVycyB0ZXh0IG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHRleHQ6IGZ1bmN0aW9uKCB4LCB5LCBzdHJpbmcsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3RleHQnLCB7XG4gICAgICAgIHg6IHgsIFxuICAgICAgICB5OiB5XG4gICAgICB9LCBhdHRycywgWyh0aGlzWzBdICYmIHRoaXNbMF0ub3duZXJEb2N1bWVudCB8fCBkb2N1bWVudCkuY3JlYXRlVGV4dE5vZGUoc3RyaW5nKV0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhIHNtb290aCBncmFwaCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgZ3JhcGg6IGZ1bmN0aW9uKCBwb2ludHMsIG9wdGlvbnMgKSB7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBvcHRzID0gZXh0ZW5kKHtcbiAgICAgICAgICAgIHNtb290aDogZmFsc2UsIFxuICAgICAgICAgICAgdGVuc2lvbjogMC40LFxuICAgICAgICAgICAgYXBwcm94aW1hdGU6IGZhbHNlXG4gICAgICAgICAgfSwgb3B0aW9ucyksXG4gICAgICAgICAgdCA9ICFpc05hTiggb3B0cy50ZW5zaW9uICkgPyBvcHRzLnRlbnNpb24gOiAwLjUsXG4gICAgICAgICAgZWwgPSBfdihlbGVtKSwgXG4gICAgICAgICAgcCxcbiAgICAgICAgICBpLFxuICAgICAgICAgIGMsXG4gICAgICAgICAgZCxcbiAgICAgICAgICBwMSxcbiAgICAgICAgICBwMixcbiAgICAgICAgICBjcHMsXG4gICAgICAgICAgcGF0aCA9IGVsLmNyZWF0ZSgncGF0aCcpLFxuICAgICAgICAgIHBhdGhTdHIgPSBcIlwiO1xuICAgICAgICAgIFxuICAgICAgICBlbC5hcHBlbmQocGF0aCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIW9wdHMuc21vb3RoKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbaV07XG4gICAgICAgICAgICBwYXRoU3RyKz0gaSA+IDAgPyBcIkxcIiA6IFwiTVwiO1xuICAgICAgICAgICAgcGF0aFN0cis9IHAueCArIFwiIFwiICsgcC55ICsgXCIgXCI7XG4gICAgICAgICAgfSBcbiAgICAgICAgfSBlbHNlIGlmIChvcHRzLmFwcHJveGltYXRlKSB7XG4gICAgICAgICAgcCA9IHBvaW50c1swXTtcbiAgICAgICAgICBwYXRoU3RyKz0gXCJNXCIgKyBwLnggKyBcIiBcIiArIHAueSArIFwiIFwiO1xuICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgIGMgPSAocG9pbnRzW2ldLnggKyBwb2ludHNbaSArIDFdLngpIC8gMjtcbiAgICAgICAgICAgICAgZCA9IChwb2ludHNbaV0ueSArIHBvaW50c1tpICsgMV0ueSkgLyAyO1xuICAgICAgICAgICAgICBwYXRoU3RyKz0gXCJRXCIgKyBwb2ludHNbaV0ueCArIFwiIFwiICsgcG9pbnRzW2ldLnkgKyBcIiBcIiArIGMgKyBcIiBcIiArIGQgKyBcIiBcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGF0aFN0cis9IFwiVFwiICsgcG9pbnRzW2ldLnggKyBcIiBcIiArIHBvaW50c1tpXS55ICsgXCIgXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcCA9IHBvaW50c1swXTtcbiAgICAgICAgICBwYXRoU3RyKz0gXCJNXCIgKyBwLnggKyBcIiBcIiArIHAueSArIFwiIFwiO1xuICAgICAgICAgIGZvciAoaSA9IDE7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSs9MSkge1xuICAgICAgICAgICAgcCA9IHBvaW50c1tpIC0gMV07XG4gICAgICAgICAgICBwMSA9IHBvaW50c1tpXTtcbiAgICAgICAgICAgIHAyID0gcG9pbnRzW2kgKyAxXTtcbiAgICAgICAgICAgIGNwcyA9IGdldENvbnRyb2xQb2ludHMocC54LCBwLnksIHAxLngsIHAxLnksIHAyLngsIHAyLnksIHQpO1xuICAgICAgICAgICAgcGF0aFN0cis9IFwiQ1wiICsgY3BzLnAxLnggKyBcIiBcIiArIGNwcy5wMS55ICsgXCIgXCIgKyBjcHMucDIueCArIFwiIFwiICsgY3BzLnAyLnkgKyBcIiBcIiArIHAyLnggKyBcIiBcIiArIHAyLnkgKyBcIiBcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGF0aFN0cis9IFwiVFwiICsgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS54ICsgXCIgXCIgKyBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdLnkgKyBcIiBcIjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZGVsZXRlIG9wdHMuc21vb3RoO1xuICAgICAgICBkZWxldGUgb3B0cy50ZW5zaW9uO1xuICAgICAgICBkZWxldGUgb3B0cy5hcHByb3hpbWF0ZTtcbiAgICAgICAgXG4gICAgICAgIHBhdGguYXR0cihleHRlbmQoe1xuICAgICAgICAgIGZpbGw6ICdub25lJ1xuICAgICAgICB9LCBvcHRzLCB7XG4gICAgICAgICAgZDogcGF0aFN0clxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgfSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBUaGUgYXJjKCkgbWV0aG9kIGNyZWF0ZXMgYW4gYXJjL2N1cnZlICh1c2VkIHRvIGNyZWF0ZSBjaXJjbGVzLCBvciBwYXJ0cyBvZiBjaXJjbGVzKS4gXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHNBbmdsZVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBlQW5nbGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNvdW50ZXJjbG9ja3dpc2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBhcmM6IGZ1bmN0aW9uKGN4LCBjeSwgciwgc0FuZ2xlLCBlQW5nbGUsIGNvdW50ZXJjbG9ja3dpc2UsIGF0dHJzKSB7XG4gICAgICBjb3VudGVyY2xvY2t3aXNlID0gdHlwZW9mIGNvdW50ZXJjbG9ja3dpc2UgPT09ICdib29sZWFuJyA/IGNvdW50ZXJjbG9ja3dpc2UgOiBmYWxzZTtcbiAgICAgIHZhciBkID0gJ00gJyArIGN4ICsgJyAnICsgY3k7XG4gICAgICBpZiAoZUFuZ2xlIC0gc0FuZ2xlID09PSBNYXRoLlBJICogMikge1xuICAgICAgICAvLyBDaXJjbGVcbiAgICAgICAgZCs9ICcgbSAtJyArIHIgKyAnLCAwIGEgJyArIHIgKyAnLCcgKyByICsgJyAwIDEsMCAnICsgKHIgKiAyKSArICcsMCBhICcgKyByICsgJywnICsgciArICcgMCAxLDAgLScgKyAociAqIDIpICsgJywwJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGQrPSBcIiBMXCIgKyAoY3ggKyBjb3Moc0FuZ2xlKSAqIHIpICsgXCIsXCIgKyAoY3kgKyBzaW4oc0FuZ2xlKSAqIHIpICtcbiAgICAgICAgICBcIiBBXCIgKyByICsgXCIsXCIgKyByICsgXCIgMCBcIiArIChlQW5nbGUgLSBzQW5nbGUgPiBQSSA/IDEgOiAwKSArIFwiLFwiICsgKGNvdW50ZXJjbG9ja3dpc2UgPyAwIDogMSkgK1xuICAgICAgICAgIFwiIFwiICsgKGN4ICsgY29zKGVBbmdsZSkgKiByKSArIFwiLFwiICsgKGN5ICsgc2luKGVBbmdsZSkgKiByKSArIFwiIFpcIjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsIFwicGF0aFwiLCB7XG4gICAgICAgIGQ6IGRcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgdGV4dCBpbnRvIGEgYm91bmRpbmcgYm94IGJ5IHdyYXBwaW5nIGxpbmVzIGF0IHNwYWNlcy5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0geFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB5XG4gICAgICogQHBhcmFtIHtPYmplY3R9IHdpZHRoXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGhlaWdodFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICB0ZXh0Ym94OiBmdW5jdGlvbiggeCwgeSwgd2lkdGgsIGhlaWdodCwgc3RyaW5nLCBhdHRycyApIHtcbiAgICAgIFxuICAgICAgdmFyIFxuICAgICAgICBzZWxmID0gdGhpcztcbiAgICAgIFxuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgXG4gICAgICAgIHZhclxuICAgICAgICAgIF92ZWxlbSA9IF92KGVsZW0pLFxuICAgICAgICAgIGxpbmVzID0gd2lkdGggPyBbXSA6IFtzdHJpbmddLCBcbiAgICAgICAgICBsaW5lID0gW10sXG4gICAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgICB3b3JkcyA9IHdpZHRoID8gc3RyaW5nLnNwbGl0KC9cXHMrLykgOiBbXSxcbiAgICAgICAgICB0ZXh0ID0gc2VsZi5jcmVhdGUoJ3RleHQnLCBleHRlbmQodHJ1ZSwge30sIGF0dHJzLCB7XG4gICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgeTogeVxuICAgICAgICAgIH0pKSxcbiAgICAgICAgICB0ZXh0Tm9kZSxcbiAgICAgICAgICBsaW5lSGVpZ2h0ID0gcGFyc2VGbG9hdChfdmVsZW0uY3NzKCdsaW5lLWhlaWdodCcpKSxcbiAgICAgICAgICBmb250U2l6ZSA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnZm9udC1zaXplJykpLFxuICAgICAgICAgIHRleHRBbGlnbiA9IHRleHQuY3NzKCd0ZXh0LWFsaWduJyksXG4gICAgICAgICAgdHkgPSAwO1xuICAgICAgICBcbiAgICAgICAgX3ZlbGVtLmFwcGVuZCh0ZXh0KTtcbiAgICAgICAgXG4gICAgICAgIFxuICAgICAgICBpZiAod2lkdGgpIHtcbiAgICAgICAgICAvLyBCcmVhayBsaW5lc1xuICAgICAgICAgIHRleHROb2RlID0gZWxlbS5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiXCIpO1xuICAgICAgICAgIHRleHQuYXBwZW5kKHRleHROb2RlKTtcbiAgICAgICAgICB3b3Jkcy5mb3JFYWNoKGZ1bmN0aW9uKHdvcmQsIGluZGV4KSB7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5kYXRhID0gbGluZS5qb2luKCcgJykgKyAnICcgKyB3b3JkO1xuICAgICAgICAgICAgbGVuZ3RoID0gdGV4dC5jb21wdXRlZFRleHRMZW5ndGgoKTtcbiAgICAgICAgICAgIGlmIChsZW5ndGggPiB3aWR0aCkge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKGxpbmUuam9pbignICcpKTtcbiAgICAgICAgICAgICAgbGluZSA9IFt3b3JkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxpbmUucHVzaCh3b3JkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gd29yZHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICBsaW5lcy5wdXNoKGxpbmUuam9pbignICcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0ZXh0LnJlbW92ZSh0ZXh0Tm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFJlbmRlciBsaW5lc1xuICAgICAgICBsaW5lcy5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUsIGluZGV4KSB7XG4gICAgICAgICAgdmFyIHRzcGFuLCBkeTtcbiAgICAgICAgICBpZiAoIWhlaWdodCB8fCB0eSArIHBhcnNlRmxvYXQobGluZUhlaWdodCkgPCBoZWlnaHQpIHtcbiAgICAgICAgICAgIGR5ID0gaW5kZXggPiAwID8gbGluZUhlaWdodCA6IGZvbnRTaXplIC0gMjtcbiAgICAgICAgICAgIHR5Kz0gZHk7XG4gICAgICAgICAgICB0c3BhbiA9IHNlbGYuY3JlYXRlKCd0c3BhbicsIHtkeTogZHl9KTtcbiAgICAgICAgICAgIHRleHQuYXBwZW5kKHRzcGFuKTtcbiAgICAgICAgICAgIHRzcGFuXG4gICAgICAgICAgICAgIC5hcHBlbmQoZWxlbS5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGxpbmUpKVxuICAgICAgICAgICAgICAuYXR0cigneCcsIHBhcnNlSW50KHRleHQuYXR0cigneCcpLCB1bmRlZmluZWQpICsgKHdpZHRoIC0gdHNwYW4uY29tcHV0ZWRUZXh0TGVuZ3RoKCkpICogKHRleHRBbGlnbiA9PT0gJ2VuZCcgfHwgdGV4dEFsaWduID09PSAncmlnaHQnID8gMSA6IHRleHRBbGlnbiA9PT0gJ2NlbnRlcicgfHwgdGV4dEFsaWduID09PSAnbWlkZGxlJyA/IDAuNSA6IDApKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gdW5vcmRlcmVkIGxpc3QuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZW1zXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKi9cbiAgICBsaXN0OiBmdW5jdGlvbiggeCwgeSwgaXRlbXMsIG9wdGlvbnMgKSB7XG4gICAgICByZXR1cm4gdGhpcy5saXN0Ym94KHgsIHksIDAsIDAsIGl0ZW1zLCBvcHRpb25zKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gdW5vcmRlcmVkIGxpc3QgaW50byB0aGUgc3BlY2lmaWVkIGJvdW5kcy5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0geFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodFxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGl0ZW1zXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKi9cbiAgICBsaXN0Ym94OiBmdW5jdGlvbiggeCwgeSwgd2lkdGgsIGhlaWdodCwgaXRlbXMsIG9wdGlvbnMgKSB7XG4gICAgICBcbiAgICAgIGl0ZW1zID0gdG9BcnJheShpdGVtcykubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJyA/IHtsYWJlbDogaXRlbX0gOiBpdGVtO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgXG4gICAgICBvcHRpb25zID0gZXh0ZW5kKHt9LCB7XG4gICAgICAgIGhvcml6b250YWw6IGZhbHNlLFxuICAgICAgICBidWxsZXQ6IHtcbiAgICAgICAgICBzaGFwZTogJ2NpcmNsZSdcbiAgICAgICAgfVxuICAgICAgfSwgb3B0aW9ucyk7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXIgdG9wID0geTtcbiAgICAgICAgXG4gICAgICAgIGl0ZW1zLmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgpIHtcbiAgICAgICAgICBcbiAgICAgICAgICB2YXJcbiAgICAgICAgICAgIF92ZWxlbSA9IF92KGVsZW0pLFxuICAgICAgICAgICAgaXRlbU9wdHMgPSBleHRlbmQodHJ1ZSwge30sIG9wdGlvbnMsIGl0ZW0pLFxuICAgICAgICAgICAgaG9yaXpvbnRhbCA9IGl0ZW1PcHRzLmhvcml6b250YWwsXG4gICAgICAgICAgICBzaGFwZSA9IGl0ZW1PcHRzLmJ1bGxldC5zaGFwZSxcbiAgICAgICAgICAgIGxhYmVsID0gaXRlbU9wdHMubGFiZWwsXG4gICAgICAgICAgICBidWxsZXRBdHRycyxcbiAgICAgICAgICAgIGl0ZW1MYXllciA9IF92ZWxlbS5nKCksXG4gICAgICAgICAgICBsaW5lSGVpZ2h0ID0gcGFyc2VGbG9hdChfdmVsZW0uY3NzKCdsaW5lLWhlaWdodCcpKSxcbiAgICAgICAgICAgIGZvbnRTaXplID0gcGFyc2VGbG9hdChfdmVsZW0uY3NzKCdmb250LXNpemUnKSksXG4gICAgICAgICAgICBidWxsZXRTaXplID0gZm9udFNpemUgKiAwLjY1LFxuICAgICAgICAgICAgc3BhY2luZyA9IGxpbmVIZWlnaHQgKiAwLjIsXG4gICAgICAgICAgICBpdGVtV2lkdGgsXG4gICAgICAgICAgICBpdGVtSGVpZ2h0O1xuICAgICAgICAgIFxuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5idWxsZXQuc2hhcGU7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmhvcml6b250YWw7XG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmxhYmVsO1xuICAgICAgICAgIFxuICAgICAgICAgIGJ1bGxldEF0dHJzID0gZXh0ZW5kKHRydWUsIHt9LCBpdGVtT3B0cywgaXRlbU9wdHMuYnVsbGV0KTsgXG4gICAgICAgICAgXG4gICAgICAgICAgZGVsZXRlIGl0ZW1PcHRzLmJ1bGxldDtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaGVpZ2h0ICYmIHkgKyBmb250U2l6ZSA+IHRvcCArIGhlaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW5kZXIgYnVsbGV0XG4gICAgICAgICAgaWYgKHNoYXBlID09PSAnY2lyY2xlJykge1xuICAgICAgICAgICAgaXRlbUxheWVyLmNpcmNsZSh4ICsgYnVsbGV0U2l6ZSAqIDAuNSwgZmxvb3IoeSkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAqIDAuNSArIGJ1bGxldFNpemUgKiAwLjUsIGJ1bGxldFNpemUgKiAwLjUsIGJ1bGxldEF0dHJzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlbUxheWVyLnJlY3QoeCwgTWF0aC5mbG9vcih5KSArIChmb250U2l6ZSAtIGJ1bGxldFNpemUpICogMC41LCBidWxsZXRTaXplLCBidWxsZXRTaXplLCBidWxsZXRBdHRycyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIFJlbmRlciBsYWJlbFxuICAgICAgICAgIGl0ZW1MYXllci50ZXh0Ym94KHggKyBidWxsZXRTaXplICsgc3BhY2luZywgZmxvb3IoeSksIHdpZHRoID8gd2lkdGggLSBidWxsZXRTaXplIC0gc3BhY2luZyA6IDAsIGhlaWdodCA/IHRvcCArIGhlaWdodCAtIHkgOiAwLCBsYWJlbCwgaXRlbU9wdHMpO1xuICAgICAgICAgIFxuICAgICAgICAgIGl0ZW1XaWR0aCA9IGZsb29yKGl0ZW1MYXllci5iYm94KCkud2lkdGgpO1xuICAgICAgICAgIGl0ZW1IZWlnaHQgPSBmbG9vcihpdGVtTGF5ZXIuYmJveCgpLmhlaWdodCArIChsaW5lSGVpZ2h0IC0gZm9udFNpemUpKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoaG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgeCs9IGl0ZW1XaWR0aCArIGZvbnRTaXplO1xuICAgICAgICAgICAgaWYgKHdpZHRoICYmIHggPiB3aWR0aCkge1xuICAgICAgICAgICAgICB5Kz0gaXRlbUhlaWdodDtcbiAgICAgICAgICAgICAgeCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHkrPSBpdGVtSGVpZ2h0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgfSk7XG4gICAgXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9KTtcbiAgXG4gIHJldHVybiBfdjtcbiAgXG59KCkpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IF92OyJdfQ==
