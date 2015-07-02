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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdmlzdWFsaXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBfdiA9IChmdW5jdGlvbigpIHtcbiAgXG4gIFxuICB2YXIgXG4gICAgU1ZHX05BTUVTUEFDRV9VUkkgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsXG4gICAgTUFUSCA9IE1hdGgsXG4gICAgUEkgPSBNQVRILlBJLFxuICAgIGNvcyA9IE1BVEguY29zLFxuICAgIHNpbiA9IE1BVEguc2luLFxuICAgIHNxcnQgPSBNQVRILnNxcnQsXG4gICAgcG93ID0gTUFUSC5wb3csXG4gICAgZmxvb3IgPSBNQVRILmZsb29yLFxuICBcbiAgICAvKipcbiAgICAgKiBDYW1lbGl6ZSBhIHN0cmluZ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKi8gXG4gICAgY2FtZWxpemUgPSAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2FjaGUgPSB7fTtcbiAgICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlW3N0cmluZ10gPSBjYWNoZVtzdHJpbmddIHx8IChmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoLyhcXC1bYS16XSkvZywgZnVuY3Rpb24oJDEpe3JldHVybiAkMS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoJy0nLCcnKTt9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH07XG4gICAgfSkoKSxcbiAgXG4gICAgLyoqXG4gICAgICogSHlwaGVuYXRlIGEgc3RyaW5nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xuICAgICAqL1xuICAgIGh5cGhlbmF0ZSA9IChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjYWNoZSA9IHt9O1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICByZXR1cm4gY2FjaGVbc3RyaW5nXSA9IGNhY2hlW3N0cmluZ10gfHwgKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvKFtBLVpdKS9nLCBmdW5jdGlvbigkMSl7cmV0dXJuIFwiLVwiKyQxLnRvTG93ZXJDYXNlKCk7fSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9O1xuICAgIH0pKCksXG4gIFxuICAgIC8qKlxuICAgICAqIEV4dGVuZHMgYW4gb2JqZWN0XG4gICAgICogQHBhcmFtIHtCb29sZWFufSB0cnVlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRlc3RpbmF0aW9uXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZVxuICAgICAqL1xuICAgIGV4dGVuZCA9IGZ1bmN0aW9uKGRlZXAsIGRlc3RpbmF0aW9uLCBzb3VyY2UpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLCBpID0gdHlwZW9mIGRlZXAgPT09ICdib29sZWFuJyA/IDIgOiAxLCBkZXN0ID0gYXJndW1lbnRzW2kgLSAxXSwgc3JjLCBwcm9wLCB2YWx1ZTtcbiAgICAgIGZvciAoOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzcmMgPSBhcmdzW2ldO1xuICAgICAgICBmb3IgKHByb3AgaW4gc3JjKSB7XG4gICAgICAgICAgdmFsdWUgPSBzcmNbcHJvcF07XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgICAgZGVzdFtwcm9wXSA9IGRlc3RbcHJvcF0gfHwge307XG4gICAgICAgICAgICAgIGlmIChkZWVwKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5kKHRydWUsIGRlc3RbcHJvcF0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGVzdFtwcm9wXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRlc3Q7XG4gICAgfSxcbiAgICBcbiAgICB0b0FycmF5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICBcbiAgICAgIC8vcmV0dXJuIG9iaiAmJiAob2JqLmxlbmd0aCAmJiBbXS5zbGljZS5jYWxsKG9iaikgfHwgW29ial0pO1xuICAgICAgXG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhciBsID0gb2JqICYmIG9iai5sZW5ndGggfHwgMCwgaSwgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmIChvYmpbaV0pIHtcbiAgICAgICAgICByZXN1bHQucHVzaChvYmpbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiByZXN1bHQubGVuZ3RoICYmIHJlc3VsdCB8fCBbb2JqXTtcbiAgICB9LFxuICAgIFxuICAgIC8vIERPTSBNYW5pcHVsYXRpb25cbiAgICBcbiAgICAvKipcbiAgICAgKiBcbiAgICAgKi9cbiAgICBcbiAgICBwYXJlbnQgPSBmdW5jdGlvbihlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS5wYXJlbnROb2RlO1xuICAgIH0sXG4gICAgXG4gICAgYXBwZW5kID0gZnVuY3Rpb24oIHBhcmVudCwgY2hpbGQgKSB7XG4gICAgICBwYXJlbnQgPSBwYXJlbnRbMF0gfHwgcGFyZW50O1xuICAgICAgdG9BcnJheShjaGlsZCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBcbiAgICBwcmVwZW5kID0gZnVuY3Rpb24oIHBhcmVudCwgY2hpbGQgKSB7XG4gICAgICBwYXJlbnQgPSBwYXJlbnRbMF0gfHwgcGFyZW50O1xuICAgICAgdG9BcnJheShjaGlsZCkuZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGNoaWxkLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFxuICAgIHJlbW92ZSA9IGZ1bmN0aW9uKCBlbGVtLCBjaGlsZCApIHtcbiAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICB0b0FycmF5KGNoaWxkKS5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChlbGVtLnBhcmVudE5vZGUpIHtcbiAgICAgICAgZWxlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsZW0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgaHRtbCA9IGZ1bmN0aW9uKGVsZW0sIHN0cmluZykge1xuICAgICAgaWYgKHN0cmluZykge1xuICAgICAgICBlbGVtLmlubmVySFRNTCA9IHN0cmluZztcbiAgICAgIH1cbiAgICAgIHJldHVybiBlbGVtLmlubmVySFRNTDtcbiAgICB9LFxuICAgIFxuICAgIHRleHQgPSBmdW5jdGlvbihlbGVtKSB7XG4gICAgICByZXR1cm4gZWxlbS50ZXh0Q29udGVudDtcbiAgICB9LFxuICAgIFxuICAgIGF0dHIgPSBmdW5jdGlvbiAoZWxlbSwgbmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciByZXN1bHQgPSBudWxsLCBvYmogPSB7fSwgcHJvcDtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgb2JqID0gbmFtZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hbWUgIT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgb2JqW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBtYXBTdHlsZXMobmFtZSkge1xuICAgICAgICByZXR1cm4gaHlwaGVuYXRlKG5hbWUpICsgXCI6IFwiICsgdmFsdWVbbmFtZV07XG4gICAgICB9XG4gICAgICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChuYW1lIGluIG9iaikge1xuICAgICAgICAgIHByb3AgPSB0eXBlb2YgZWxlbVtjYW1lbGl6ZShuYW1lKV0gIT09ICd1bmRlZmluZWQnID8gY2FtZWxpemUobmFtZSkgOiBoeXBoZW5hdGUobmFtZSk7XG4gICAgICAgICAgdmFsdWUgPSBvYmpbbmFtZV07XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIC8vIFNldFxuICAgICAgICAgICAgaWYgKG5hbWUgPT09ICdzdHlsZScgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICB2YWx1ZSA9IE9iamVjdC5rZXlzKHZhbHVlKS5tYXAobWFwU3R5bGVzKS5qb2luKFwiOyBcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKHByb3AsIHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIEdldFxuICAgICAgICAgICAgcmVzdWx0ID0gZWxlbS5nZXRBdHRyaWJ1dGUocHJvcCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gIFxuICAgIGNzcyA9IGZ1bmN0aW9uKGVsZW0sIG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIgbWFwID0ge30sIGNzc1RleHQgPSBudWxsO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICBtYXAgPSBuYW1lO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgbWFwW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBjc3NUZXh0ID0gT2JqZWN0LmtleXMobWFwKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gaHlwaGVuYXRlKG5hbWUpICsgXCI6IFwiICsgbWFwW25hbWVdO1xuICAgICAgfSkuam9pbihcIjsgXCIpO1xuICAgICAgaWYgKGNzc1RleHQgJiYgY3NzVGV4dC5sZW5ndGgpIHtcbiAgICAgICAgZWxlbS5zdHlsZS5jc3NUZXh0ID0gZWxlbS5zdHlsZS5jc3NUZXh0ICsgY3NzVGV4dDtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWxlbS5zdHlsZVtuYW1lXSB8fCB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKG5hbWUpO1xuICAgIH0sXG4gICAgXG4gICAgYWRkQ2xhc3MgPSBmdW5jdGlvbihlbGVtLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgIH0sXG4gICAgXG4gICAgaGFzQ2xhc3MgPSBmdW5jdGlvbihlbGVtLCBjbGFzc05hbWUpIHtcbiAgICAgIHJldHVybiBlbGVtLmNsYXNzTGlzdC5jb250YWlucyhjbGFzc05hbWUpO1xuICAgIH0sXG4gICAgXG4gICAgcmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbihlbGVtLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsZW0uY2xhc3NMaXN0LnJlbW92ZShjbGFzc05hbWUpO1xuICAgIH0sXG4gICAgXG4gICAgdG9nZ2xlQ2xhc3MgPSBmdW5jdGlvbihlbGVtLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsZW0uY2xhc3NMaXN0LnRvZ2dsZShjbGFzc05hbWUpO1xuICAgIH0sXG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0cyBhIHBhaXIgb2YgYmV6aWVyIGNvbnRyb2wgcG9pbnRzXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkwXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkxXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHgyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRcbiAgICAgKi9cbiAgICBnZXRDb250cm9sUG9pbnRzID0gZnVuY3Rpb24oIHgwLCB5MCwgeDEsIHkxLCB4MiwgeTIsIHQgKSB7XG4gICAgICB0ID0gdHlwZW9mIHQgPT09ICdudW1iZXInID8gdCA6IDAuNTtcbiAgICAgIHZhclxuICAgICAgICBkMDEgPSBzcXJ0KCBwb3coIHgxIC0geDAsIDIgKSArIHBvdyggeTEgLSB5MCwgMiApICksXG4gICAgICAgIGQxMiA9IHNxcnQoIHBvdyggeDIgLSB4MSwgMiApICsgcG93KCB5MiAtIHkxLCAyICkgKSxcbiAgICAgICAgZmEgPSB0ICogZDAxIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBzY2FsaW5nIGZhY3RvciBmb3IgdHJpYW5nbGUgVGFcbiAgICAgICAgZmIgPSB0ICogZDEyIC8gKCBkMDEgKyBkMTIgKSwgICAvLyBkaXR0byBmb3IgVGIsIHNpbXBsaWZpZXMgdG8gZmI9dC1mYVxuICAgICAgICBwMXggPSB4MSAtIGZhICogKCB4MiAtIHgwICksICAgIC8vIHgyLXgwIGlzIHRoZSB3aWR0aCBvZiB0cmlhbmdsZSBUXG4gICAgICAgIHAxeSA9IHkxIC0gZmEgKiAoIHkyIC0geTAgKSwgICAgLy8geTIteTAgaXMgdGhlIGhlaWdodCBvZiBUXG4gICAgICAgIHAyeCA9IHgxICsgZmIgKiAoIHgyIC0geDAgKSxcbiAgICAgICAgcDJ5ID0geTEgKyBmYiAqICggeTIgLSB5MCApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcDE6IHt4OiBwMXgsIHk6IHAxeX0sIFxuICAgICAgICBwMjoge3g6IHAyeCwgeTogcDJ5fVxuICAgICAgfTtcbiAgICB9LFxuICBcbiAgICAvKipcbiAgICAgKiBTZXJpYWxpemVzIHBvaW50cyBhcyBzdmcgcGF0aCBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHtBcnJheX0gcG9pbnRzXG4gICAgICovXG4gICAgZ2V0UGF0aCA9IGZ1bmN0aW9uKCBwb2ludHMgKSB7XG4gICAgICByZXR1cm4gcG9pbnRzLm1hcChmdW5jdGlvbihwb2ludCkge1xuICAgICAgICByZXR1cm4gcG9pbnQueCArIFwiLFwiICsgcG9pbnQueTtcbiAgICAgIH0pLmpvaW4oXCIgXCIpO1xuICAgIH0sXG4gIFxuICBcbiAgICAvKipcbiAgICAgKiBWaXN1YWxpc3QgcXVlcnkgY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBfdiA9IGZ1bmN0aW9uKHNlbGVjdG9yLCB3aWR0aCwgaGVpZ2h0LCBhdHRycykge1xuICAgICAgdmFyIGFyZywgaSwgcywgdywgaCwgYSwgc2V0O1xuICAgICAgZm9yIChpID0gMCwgYXJnOyBhcmcgPSBhcmd1bWVudHNbaV07IGkrKykge1xuICAgICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgJiYgIWlzTmFOKHBhcnNlRmxvYXQoYXJnKSkpIHtcbiAgICAgICAgICAvLyBOdW1lcmljXG4gICAgICAgICAgYXJnID0gdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgPyBwYXJzZUZsb2F0KGFyZykgKyBcInB4XCIgOiBhcmc7XG4gICAgICAgICAgaWYgKHR5cGVvZiB3ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaCA9IGFyZztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdyA9IGFyZztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAvLyBQbGFpbiBvYmplY3RcbiAgICAgICAgICBhID0gYXJnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEV2ZXJ5dGhpbmcgZWxzZSBtYXkgYmUgYSBzZWxlY3RvclxuICAgICAgICAgIHMgPSBhcmc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNldCA9IHMgaW5zdGFuY2VvZiBWaXN1YWxpc3QgPyBzIDogbmV3IFZpc3VhbGlzdChzKTtcbiAgICAgIHNldC5hdHRyKGV4dGVuZCh0cnVlLCBhIHx8IHt9LCB7XG4gICAgICAgIHdpZHRoOiB3LCBcbiAgICAgICAgaGVpZ2h0OiBoXG4gICAgICB9KSk7XG4gICAgICByZXR1cm4gc2V0O1xuICAgIH07XG5cbiAgLyoqXG4gICAqIFZpc3VhbGlzdCBDbGFzc1xuICAgKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gVmlzdWFsaXN0KHNlbGVjdG9yKSB7XG4gICAgdmFyIHNldCA9IG51bGwsIGVsZW0sIHJlc3VsdCwgaSwgc3ZnO1xuICAgIC8vIENvbGxlY3QgY29uc3RydWN0b3IgYXJnc1xuICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdvYmplY3QnICYmIHNlbGVjdG9yLm5hbWVzcGFjZVVSSSA9PT0gU1ZHX05BTUVTUEFDRV9VUkkpIHtcbiAgICAgIC8vIEV4aXN0aW5nIEVsZW1lbnRcbiAgICAgIHNldCA9IFtzZWxlY3Rvcl07XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBTZWxlY3RvclxuICAgICAgcmVzdWx0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICBmb3IgKGkgPSAwLCBlbGVtOyBlbGVtID0gcmVzdWx0W2ldOyBpKyspIHtcbiAgICAgICAgaWYgKGVsZW0ubmFtZXNwYWNlVVJJID09PSBTVkdfTkFNRVNQQUNFX1VSSSApIHtcbiAgICAgICAgICBzZXQgPSBzZXQgfHwgW107XG4gICAgICAgICAgc2V0LnB1c2goZWxlbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFzZXQpIHtcbiAgICAgIHN2ZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTkFNRVNQQUNFX1VSSSwgJ3N2ZycpO1xuICAgICAgc3ZnLnNldEF0dHJpYnV0ZShcInhtbG5zXCIsIFNWR19OQU1FU1BBQ0VfVVJJKTtcbiAgICAgIHNldCA9IFtzdmddO1xuICAgIH1cbiAgICB0aGlzLnB1c2guYXBwbHkodGhpcywgc2V0IHx8IFtdKTtcbiAgfVxuICBcbiAgVmlzdWFsaXN0LnByb3RvdHlwZSA9IFtdO1xuICBcbiAgLy8gU3RhdGljIG1ldGhvZHNcbiAgX3YuZXh0ZW5kID0gZXh0ZW5kO1xuICBfdi5hdHRyID0gYXR0cjtcbiAgX3YuY3NzID0gY3NzO1xuICBcbiAgLy8gUGx1Z2luIEFQSVxuICBfdi5mbiA9IFZpc3VhbGlzdC5wcm90b3R5cGU7XG4gIFxuICAvKipcbiAgICogRXh0ZW5kcyB2aXN1YWxpc3QgcHJvdG90eXBlXG4gICAqIEBwYXJhbSB7QXJyYXl9IG1ldGhvZHNcbiAgICovXG4gIF92LmZuLmV4dGVuZCA9IGZ1bmN0aW9uKCBtZXRob2RzICkge1xuICAgIGZvciAodmFyIHggaW4gbWV0aG9kcykge1xuICAgICAgVmlzdWFsaXN0LnByb3RvdHlwZVt4XSA9IG1ldGhvZHNbeF07XG4gICAgfVxuICB9O1xuICBcbiAgLy8gUHJpdmF0ZSBDb21wb25lbnRzXG4gIFxuICAvKipcbiAgICogRHJhdyBiYXNpYyBzaGFwZXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtc1xuICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICogQHBhcmFtIHtBcnJheX0gY2hpbGRyZW4gXG4gICAqL1xuICBmdW5jdGlvbiBzaGFwZSh0YWdOYW1lLCBwYXJhbXMsIGF0dHJzLCBjaGlsZHJlbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgX3YoZWxlbSkuYXBwZW5kKHNlbGYuY3JlYXRlKHRhZ05hbWUsIGV4dGVuZCh0cnVlLCB7fSwgYXR0cnMsIHBhcmFtcykpLmFwcGVuZChjaGlsZHJlbikpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIFxuICAvLyBQdWJsaWMgQ29tcG9uZW50c1xuICBcbiAgX3YuZm4uZXh0ZW5kKHtcbiAgICBcbiAgICBzaXplOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmxlbmd0aDtcbiAgICB9LFxuICAgIFxuICAgIHRvQXJyYXk6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRvQXJyYXkodGhpcyk7XG4gICAgfSxcbiAgICBcbiAgICBnZXQ6IGZ1bmN0aW9uKCBpbmRleCApIHtcbiAgICAgIHJldHVybiB0eXBlb2YgaW5kZXggIT09ICd1bmRlZmluZWQnID8gaW5kZXggPCAwID8gdGhpc1t0aGlzLmxlbmd0aCAtIGluZGV4XSA6IHRoaXNbaW5kZXhdIDogdGhpcy50b0FycmF5KCk7XG4gICAgfSxcbiAgICBcbiAgICBpbmRleDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpc1swXSAmJiB0b0FycmF5KHRoaXNbMF0ucGFyZW50Tm9kZS5jaGlsZHJlbikuaW5kZXhPZih0aGlzWzBdKSB8fCAtMTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIEFwcGVuZHMgdGhlIHNwZWNpZmllZCBjaGlsZCB0byB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIGFwcGVuZDogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgaWYgKHRoaXNbMF0pIHtcbiAgICAgICAgYXBwZW5kKHRoaXNbMF0sIGNoaWxkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQXBwZW5kcyB0aGUgY3VycmVudCBzZXQgb2YgZWxlbWVudHMgdG8gdGhlIHNwZWNpZmllZCBwYXJlbnRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBhcHBlbmRUbzogZnVuY3Rpb24oIHBhcmVudCApIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGFwcGVuZChwYXJlbnQsIGVsZW0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFByZXBlbmRzIHRoZSBzcGVjaWZpZWQgY2hpbGQgdG8gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAgICAgKi9cbiAgICBwcmVwZW5kOiBmdW5jdGlvbiggY2hpbGQgKSB7XG4gICAgICBpZiAodGhpc1swXSkge1xuICAgICAgICBwcmVwZW5kKHRoaXNbMF0sIGNoaWxkKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUHJlcGVuZHMgdGhlIGN1cnJlbnQgc2V0IG9mIGVsZW1lbnRzIHRvIHRoZSBzcGVjaWZpZWQgcGFyZW50XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gICAgICovXG4gICAgcHJlcGVuZFRvOiBmdW5jdGlvbiggcGFyZW50ICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgcHJlcGVuZChwYXJlbnQsIGVsZW0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGVsZW1lbnRzIGluIHRoZSBzZXQgb3IgcmVtb3ZlcyB0aGUgc3BlY2lmaWVkIGNoaWxkIGZyb20gdGhlIHNldCBvZiBtYXRjaGVkIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjaGlsZFxuICAgICAqL1xuICAgIHJlbW92ZTogZnVuY3Rpb24oIGNoaWxkICkge1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgcmVtb3ZlKGVsZW0sIGNoaWxkKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGNoaWxkcmVuIGZyb20gZWxlbWVudHMgaW4gdGhlIHNldFxuICAgICAqL1xuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxlbS5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZWxlbS5yZW1vdmVDaGlsZChlbGVtLmNoaWxkTm9kZXNbaV0pO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBhcmVudCBub2RlIG9mIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICovXG4gICAgcGFyZW50OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHBhcmVudCh0aGlzWzBdKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2YgYW4gYXR0cmlidXRlIGZvciB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IG9mIG1hdGNoZWQgZWxlbWVudHMgb3Igc2V0IG9uZSBvciBtb3JlIGF0dHJpYnV0ZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIGF0dHI6IGZ1bmN0aW9uKCBuYW1lLCB2YWx1ZSApIHtcbiAgICAgIHZhciByZXN1bHQgPSB0aGlzO1xuICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgICAgdmFyIHJldCA9IGF0dHIoZWxlbSwgbmFtZSwgdmFsdWUpO1xuICAgICAgICBpZiAocmV0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0ID0gcmV0O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIGEgY29tcHV0ZWQgc3R5bGUgcHJvcGVydHkgZm9yIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXQgb2YgbWF0Y2hlZCBlbGVtZW50cyBvciBzZXQgb25lIG9yIG1vcmUgQ1NTIHByb3BlcnRpZXMgZm9yIGV2ZXJ5IG1hdGNoZWQgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICAgICAqL1xuICAgIGNzczogZnVuY3Rpb24oIG5hbWUsIHZhbHVlICkge1xuICAgICAgdmFyIHJlc3VsdCA9IHRoaXM7XG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICB2YXIgcmV0ID0gY3NzKGVsZW0sIG5hbWUsIHZhbHVlKTtcbiAgICAgICAgaWYgKHJldCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IHJldDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBlbGVtZW50IHdpdGggdGhlIHNwZWNpZmVkIHRhZ25hbWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRhZ05hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uKCB0YWdOYW1lLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBfdigodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZUVsZW1lbnROUyh0aGlzWzBdICYmIHRoaXNbMF0ubmFtZXNwYWNlVVJJIHx8IFNWR19OQU1FU1BBQ0VfVVJJLCB0YWdOYW1lKSkuYXR0cihhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXRzIG9yIHNldHMgdGhlIHdpZHRoIG9uIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKi9cbiAgICB3aWR0aDogZnVuY3Rpb24oIHdpZHRoICkge1xuICAgICAgLy9jb25zb2xlLndhcm4oXCJkZXByZWNhdGVkXCIpO1xuICAgICAgaWYgKHR5cGVvZiB3aWR0aCA9PT0gJ3VuZGVmaW5lZCcgJiYgdGhpc1swXSkge1xuICAgICAgICByZXR1cm4gdGhpc1swXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcbiAgICAgIH1cbiAgICAgIHRoaXMuYXR0cignd2lkdGgnLCB3aWR0aCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldHMgb3Igc2V0cyB0aGUgaGVpZ2h0IG9uIHRoZSBmaXJzdCBlbGVtZW50IGluIHRoZSBzZXRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICovXG4gICAgaGVpZ2h0OiBmdW5jdGlvbiggaGVpZ2h0ICkge1xuICAgICAgLy9jb25zb2xlLndhcm4oXCJkZXByZWNhdGVkXCIpO1xuICAgICAgaWYgKHR5cGVvZiBoZWlnaHQgPT09ICd1bmRlZmluZWQnICYmIHRoaXNbMF0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgICAgfVxuICAgICAgdGhpcy5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqL1xuICAgIGJib3g6IGZ1bmN0aW9uKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHRoaXNbMF0gJiYgdGhpc1swXS5nZXRCQm94KCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB7d2lkdGg6IDAsIGhlaWdodDogMH07XG4gICAgICB9IFxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb21wdXRlZCB0ZXh0IGxlbmd0aCBvZiB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgc2V0IGlmIGFwcGxpY2FibGUuXG4gICAgICovXG4gICAgY29tcHV0ZWRUZXh0TGVuZ3RoOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzWzBdICYmIHRoaXNbMF0uZ2V0Q29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuZCByZXR1cm5zIGEgZ3JvdXAgbGF5ZXIgb24gdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhlIHNldFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGc6IGZ1bmN0aW9uKCBhdHRycyApIHtcbiAgICAgIHZhciBnID0gdGhpcy5jcmVhdGUoJ2cnLCBhdHRycyk7XG4gICAgICBfdih0aGlzWzBdKS5hcHBlbmQoZyk7XG4gICAgICByZXR1cm4gZztcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgY2lyY2xlIG9uIGV2ZXJ5IGVsZW1lbnQgaW4gdGhlIHNldC5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3hcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY3lcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGNpcmNsZTogZnVuY3Rpb24oIGN4LCBjeSwgciwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImNpcmNsZVwiLCB7XG4gICAgICAgIGN4OiBjeCwgXG4gICAgICAgIGN5OiBjeSwgXG4gICAgICAgIHI6IHJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGFuIGVsbGlwc2Ugb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBjeVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSByeVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGVsbGlwc2U6IGZ1bmN0aW9uKCBjeCwgY3ksIHJ4LCByeSwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImVsbGlwc2VcIiwge1xuICAgICAgICBjeDogY3gsIFxuICAgICAgICBjeTogY3ksIFxuICAgICAgICByeDogcngsXG4gICAgICAgIHJ5OiByeVxuICAgICAgfSwgYXR0cnMpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSByZWN0YW5nbGUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gd2lkdGhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcmVjdDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgXCJyZWN0XCIsIHtcbiAgICAgICAgeDogeCwgXG4gICAgICAgIHk6IHksIFxuICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGxpbmUgb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4MlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5MlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIGxpbmU6IGZ1bmN0aW9uKCB4MSwgeTEsIHgyLCB5MiwgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcImxpbmVcIiwge1xuICAgICAgICB4MTogeDEsXG4gICAgICAgIHkxOiB5MSxcbiAgICAgICAgeDI6IHgyLFxuICAgICAgICB5MjogeTJcbiAgICAgIH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgcG9seWdvbiBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvaW50c1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAqL1xuICAgIHBvbHlnb246IGZ1bmN0aW9uKCBwb2ludHMsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BvbHlnb24nLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBvbHlnb24gb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICBwb2x5bGluZTogZnVuY3Rpb24oIHBvaW50cywgYXR0cnMgKSB7XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCAncG9seWxpbmUnLCB7XG4gICAgICAgIHBvaW50czogZ2V0UGF0aChwb2ludHMpXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHBhdGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgcGF0aDogZnVuY3Rpb24oIGQsIGF0dHJzICkge1xuICAgICAgcmV0dXJuIHNoYXBlLmNhbGwodGhpcywgJ3BhdGgnLCB7ZDogZH0sIGF0dHJzKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgdGV4dCBvbiBldmVyeSBlbGVtZW50IGluIHRoZSBzZXQuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYXR0cnNcbiAgICAgKi9cbiAgICB0ZXh0OiBmdW5jdGlvbiggeCwgeSwgc3RyaW5nLCBhdHRycyApIHtcbiAgICAgIHJldHVybiBzaGFwZS5jYWxsKHRoaXMsICd0ZXh0Jywge1xuICAgICAgICB4OiB4LCBcbiAgICAgICAgeTogeVxuICAgICAgfSwgYXR0cnMsIFsodGhpc1swXSAmJiB0aGlzWzBdLm93bmVyRG9jdW1lbnQgfHwgZG9jdW1lbnQpLmNyZWF0ZVRleHROb2RlKHN0cmluZyldKTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBzbW9vdGggZ3JhcGggb24gZXZlcnkgZWxlbWVudCBpbiB0aGUgc2V0LlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludHNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuICAgIGdyYXBoOiBmdW5jdGlvbiggcG9pbnRzLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyXG4gICAgICAgICAgb3B0cyA9IGV4dGVuZCh7XG4gICAgICAgICAgICBzbW9vdGg6IGZhbHNlLCBcbiAgICAgICAgICAgIHRlbnNpb246IDAuNCxcbiAgICAgICAgICAgIGFwcHJveGltYXRlOiBmYWxzZVxuICAgICAgICAgIH0sIG9wdGlvbnMpLFxuICAgICAgICAgIHQgPSAhaXNOYU4oIG9wdHMudGVuc2lvbiApID8gb3B0cy50ZW5zaW9uIDogMC41LFxuICAgICAgICAgIGVsID0gX3YoZWxlbSksIFxuICAgICAgICAgIHAsXG4gICAgICAgICAgaSxcbiAgICAgICAgICBjLFxuICAgICAgICAgIGQsXG4gICAgICAgICAgcDEsXG4gICAgICAgICAgcDIsXG4gICAgICAgICAgY3BzLFxuICAgICAgICAgIHBhdGggPSBlbC5jcmVhdGUoJ3BhdGgnKSxcbiAgICAgICAgICBwYXRoU3RyID0gXCJcIjtcbiAgICAgICAgICBcbiAgICAgICAgZWwuYXBwZW5kKHBhdGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFvcHRzLnNtb290aCkge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgICAgICBwID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgcGF0aFN0cis9IGkgPiAwID8gXCJMXCIgOiBcIk1cIjtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBwLnggKyBcIiBcIiArIHAueSArIFwiIFwiO1xuICAgICAgICAgIH0gXG4gICAgICAgIH0gZWxzZSBpZiAob3B0cy5hcHByb3hpbWF0ZSkge1xuICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICBjID0gKHBvaW50c1tpXS54ICsgcG9pbnRzW2kgKyAxXS54KSAvIDI7XG4gICAgICAgICAgICAgIGQgPSAocG9pbnRzW2ldLnkgKyBwb2ludHNbaSArIDFdLnkpIC8gMjtcbiAgICAgICAgICAgICAgcGF0aFN0cis9IFwiUVwiICsgcG9pbnRzW2ldLnggKyBcIiBcIiArIHBvaW50c1tpXS55ICsgXCIgXCIgKyBjICsgXCIgXCIgKyBkICsgXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHBvaW50c1tpXS54ICsgXCIgXCIgKyBwb2ludHNbaV0ueSArIFwiIFwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHAgPSBwb2ludHNbMF07XG4gICAgICAgICAgcGF0aFN0cis9IFwiTVwiICsgcC54ICsgXCIgXCIgKyBwLnkgKyBcIiBcIjtcbiAgICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrPTEpIHtcbiAgICAgICAgICAgIHAgPSBwb2ludHNbaSAtIDFdO1xuICAgICAgICAgICAgcDEgPSBwb2ludHNbaV07XG4gICAgICAgICAgICBwMiA9IHBvaW50c1tpICsgMV07XG4gICAgICAgICAgICBjcHMgPSBnZXRDb250cm9sUG9pbnRzKHAueCwgcC55LCBwMS54LCBwMS55LCBwMi54LCBwMi55LCB0KTtcbiAgICAgICAgICAgIHBhdGhTdHIrPSBcIkNcIiArIGNwcy5wMS54ICsgXCIgXCIgKyBjcHMucDEueSArIFwiIFwiICsgY3BzLnAyLnggKyBcIiBcIiArIGNwcy5wMi55ICsgXCIgXCIgKyBwMi54ICsgXCIgXCIgKyBwMi55ICsgXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhdGhTdHIrPSBcIlRcIiArIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0ueCArIFwiIFwiICsgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXS55ICsgXCIgXCI7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGRlbGV0ZSBvcHRzLnNtb290aDtcbiAgICAgICAgZGVsZXRlIG9wdHMudGVuc2lvbjtcbiAgICAgICAgZGVsZXRlIG9wdHMuYXBwcm94aW1hdGU7XG4gICAgICAgIFxuICAgICAgICBwYXRoLmF0dHIoZXh0ZW5kKHtcbiAgICAgICAgICBmaWxsOiAnbm9uZSdcbiAgICAgICAgfSwgb3B0cywge1xuICAgICAgICAgIGQ6IHBhdGhTdHJcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogVGhlIGFyYygpIG1ldGhvZCBjcmVhdGVzIGFuIGFyYy9jdXJ2ZSAodXNlZCB0byBjcmVhdGUgY2lyY2xlcywgb3IgcGFydHMgb2YgY2lyY2xlcykuIFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBzQW5nbGVcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZUFuZ2xlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgYXJjOiBmdW5jdGlvbihjeCwgY3ksIHIsIHNBbmdsZSwgZUFuZ2xlLCBjb3VudGVyY2xvY2t3aXNlLCBhdHRycykge1xuICAgICAgY291bnRlcmNsb2Nrd2lzZSA9IHR5cGVvZiBjb3VudGVyY2xvY2t3aXNlID09PSAnYm9vbGVhbicgPyBjb3VudGVyY2xvY2t3aXNlIDogZmFsc2U7XG4gICAgICB2YXIgZCA9ICdNICcgKyBjeCArICcgJyArIGN5O1xuICAgICAgaWYgKGVBbmdsZSAtIHNBbmdsZSA9PT0gTWF0aC5QSSAqIDIpIHtcbiAgICAgICAgLy8gQ2lyY2xlXG4gICAgICAgIGQrPSAnIG0gLScgKyByICsgJywgMCBhICcgKyByICsgJywnICsgciArICcgMCAxLDAgJyArIChyICogMikgKyAnLDAgYSAnICsgciArICcsJyArIHIgKyAnIDAgMSwwIC0nICsgKHIgKiAyKSArICcsMCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkKz0gXCIgTFwiICsgKGN4ICsgY29zKHNBbmdsZSkgKiByKSArIFwiLFwiICsgKGN5ICsgc2luKHNBbmdsZSkgKiByKSArXG4gICAgICAgICAgXCIgQVwiICsgciArIFwiLFwiICsgciArIFwiIDAgXCIgKyAoZUFuZ2xlIC0gc0FuZ2xlID4gUEkgPyAxIDogMCkgKyBcIixcIiArIChjb3VudGVyY2xvY2t3aXNlID8gMCA6IDEpICtcbiAgICAgICAgICBcIiBcIiArIChjeCArIGNvcyhlQW5nbGUpICogcikgKyBcIixcIiArIChjeSArIHNpbihlQW5nbGUpICogcikgKyBcIiBaXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhcGUuY2FsbCh0aGlzLCBcInBhdGhcIiwge1xuICAgICAgICBkOiBkXG4gICAgICB9LCBhdHRycyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIHRleHQgaW50byBhIGJvdW5kaW5nIGJveCBieSB3cmFwcGluZyBsaW5lcyBhdCBzcGFjZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHhcbiAgICAgKiBAcGFyYW0ge09iamVjdH0geVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB3aWR0aFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc3RyaW5nXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGF0dHJzXG4gICAgICovXG4gICAgdGV4dGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIHN0cmluZywgYXR0cnMgKSB7XG4gICAgICBcbiAgICAgIHZhciBcbiAgICAgICAgc2VsZiA9IHRoaXM7XG4gICAgICBcbiAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIFxuICAgICAgICB2YXJcbiAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICBsaW5lcyA9IHdpZHRoID8gW10gOiBbc3RyaW5nXSwgXG4gICAgICAgICAgbGluZSA9IFtdLFxuICAgICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgICAgd29yZHMgPSB3aWR0aCA/IHN0cmluZy5zcGxpdCgvXFxzKy8pIDogW10sXG4gICAgICAgICAgdGV4dCA9IHNlbGYuY3JlYXRlKCd0ZXh0JywgZXh0ZW5kKHRydWUsIHt9LCBhdHRycywge1xuICAgICAgICAgICAgeDogeCxcbiAgICAgICAgICAgIHk6IHlcbiAgICAgICAgICB9KSksXG4gICAgICAgICAgdGV4dE5vZGUsXG4gICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgZm9udFNpemUgPSBwYXJzZUZsb2F0KF92ZWxlbS5jc3MoJ2ZvbnQtc2l6ZScpKSxcbiAgICAgICAgICB0ZXh0QWxpZ24gPSB0ZXh0LmNzcygndGV4dC1hbGlnbicpLFxuICAgICAgICAgIHR5ID0gMDtcbiAgICAgICAgXG4gICAgICAgIF92ZWxlbS5hcHBlbmQodGV4dCk7XG4gICAgICAgIFxuICAgICAgICBcbiAgICAgICAgaWYgKHdpZHRoKSB7XG4gICAgICAgICAgLy8gQnJlYWsgbGluZXNcbiAgICAgICAgICB0ZXh0Tm9kZSA9IGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIlwiKTtcbiAgICAgICAgICB0ZXh0LmFwcGVuZCh0ZXh0Tm9kZSk7XG4gICAgICAgICAgd29yZHMuZm9yRWFjaChmdW5jdGlvbih3b3JkLCBpbmRleCkge1xuICAgICAgICAgICAgdGV4dE5vZGUuZGF0YSA9IGxpbmUuam9pbignICcpICsgJyAnICsgd29yZDtcbiAgICAgICAgICAgIGxlbmd0aCA9IHRleHQuY29tcHV0ZWRUZXh0TGVuZ3RoKCk7XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICAgIGxpbmUgPSBbd29yZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsaW5lLnB1c2god29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5kZXggPT09IHdvcmRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgbGluZXMucHVzaChsaW5lLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGV4dC5yZW1vdmUodGV4dE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBSZW5kZXIgbGluZXNcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbihsaW5lLCBpbmRleCkge1xuICAgICAgICAgIHZhciB0c3BhbiwgZHk7XG4gICAgICAgICAgaWYgKCFoZWlnaHQgfHwgdHkgKyBwYXJzZUZsb2F0KGxpbmVIZWlnaHQpIDwgaGVpZ2h0KSB7XG4gICAgICAgICAgICBkeSA9IGluZGV4ID4gMCA/IGxpbmVIZWlnaHQgOiBmb250U2l6ZSAtIDI7XG4gICAgICAgICAgICB0eSs9IGR5O1xuICAgICAgICAgICAgdHNwYW4gPSBzZWxmLmNyZWF0ZSgndHNwYW4nLCB7ZHk6IGR5fSk7XG4gICAgICAgICAgICB0ZXh0LmFwcGVuZCh0c3Bhbik7XG4gICAgICAgICAgICB0c3BhblxuICAgICAgICAgICAgICAuYXBwZW5kKGVsZW0ub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShsaW5lKSlcbiAgICAgICAgICAgICAgLmF0dHIoJ3gnLCBwYXJzZUludCh0ZXh0LmF0dHIoJ3gnKSwgdW5kZWZpbmVkKSArICh3aWR0aCAtIHRzcGFuLmNvbXB1dGVkVGV4dExlbmd0aCgpKSAqICh0ZXh0QWxpZ24gPT09ICdlbmQnIHx8IHRleHRBbGlnbiA9PT0gJ3JpZ2h0JyA/IDEgOiB0ZXh0QWxpZ24gPT09ICdjZW50ZXInIHx8IHRleHRBbGlnbiA9PT0gJ21pZGRsZScgPyAwLjUgOiAwKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0LlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHlcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdDogZnVuY3Rpb24oIHgsIHksIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGJveCh4LCB5LCAwLCAwLCBpdGVtcywgb3B0aW9ucyk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIHVub3JkZXJlZCBsaXN0IGludG8gdGhlIHNwZWNpZmllZCBib3VuZHMuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHhcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBoZWlnaHRcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgbGlzdGJveDogZnVuY3Rpb24oIHgsIHksIHdpZHRoLCBoZWlnaHQsIGl0ZW1zLCBvcHRpb25zICkge1xuICAgICAgXG4gICAgICBpdGVtcyA9IHRvQXJyYXkoaXRlbXMpLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycgPyB7bGFiZWw6IGl0ZW19IDogaXRlbTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIFxuICAgICAgb3B0aW9ucyA9IGV4dGVuZCh7fSwge1xuICAgICAgICBob3Jpem9udGFsOiBmYWxzZSxcbiAgICAgICAgYnVsbGV0OiB7XG4gICAgICAgICAgc2hhcGU6ICdjaXJjbGUnXG4gICAgICAgIH1cbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgXG4gICAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24oZWxlbSkge1xuICAgICAgICBcbiAgICAgICAgdmFyIHRvcCA9IHk7XG4gICAgICAgIFxuICAgICAgICBpdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgXG4gICAgICAgICAgdmFyXG4gICAgICAgICAgICBfdmVsZW0gPSBfdihlbGVtKSxcbiAgICAgICAgICAgIGl0ZW1PcHRzID0gZXh0ZW5kKHRydWUsIHt9LCBvcHRpb25zLCBpdGVtKSxcbiAgICAgICAgICAgIGhvcml6b250YWwgPSBpdGVtT3B0cy5ob3Jpem9udGFsLFxuICAgICAgICAgICAgc2hhcGUgPSBpdGVtT3B0cy5idWxsZXQuc2hhcGUsXG4gICAgICAgICAgICBsYWJlbCA9IGl0ZW1PcHRzLmxhYmVsLFxuICAgICAgICAgICAgYnVsbGV0QXR0cnMsXG4gICAgICAgICAgICBpdGVtTGF5ZXIgPSBfdmVsZW0uZygpLFxuICAgICAgICAgICAgbGluZUhlaWdodCA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnbGluZS1oZWlnaHQnKSksXG4gICAgICAgICAgICBmb250U2l6ZSA9IHBhcnNlRmxvYXQoX3ZlbGVtLmNzcygnZm9udC1zaXplJykpLFxuICAgICAgICAgICAgYnVsbGV0U2l6ZSA9IGZvbnRTaXplICogMC42NSxcbiAgICAgICAgICAgIHNwYWNpbmcgPSBsaW5lSGVpZ2h0ICogMC4yLFxuICAgICAgICAgICAgaXRlbVdpZHRoLFxuICAgICAgICAgICAgaXRlbUhlaWdodDtcbiAgICAgICAgICBcbiAgICAgICAgICBkZWxldGUgaXRlbU9wdHMuYnVsbGV0LnNoYXBlO1xuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5ob3Jpem9udGFsO1xuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5sYWJlbDtcbiAgICAgICAgICBcbiAgICAgICAgICBidWxsZXRBdHRycyA9IGV4dGVuZCh0cnVlLCB7fSwgaXRlbU9wdHMsIGl0ZW1PcHRzLmJ1bGxldCk7IFxuICAgICAgICAgIFxuICAgICAgICAgIGRlbGV0ZSBpdGVtT3B0cy5idWxsZXQ7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGhlaWdodCAmJiB5ICsgZm9udFNpemUgPiB0b3AgKyBoZWlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUmVuZGVyIGJ1bGxldFxuICAgICAgICAgIGlmIChzaGFwZSA9PT0gJ2NpcmNsZScpIHtcbiAgICAgICAgICAgIGl0ZW1MYXllci5jaXJjbGUoeCArIGJ1bGxldFNpemUgKiAwLjUsIGZsb29yKHkpICsgKGZvbnRTaXplIC0gYnVsbGV0U2l6ZSkgKiAwLjUgKyBidWxsZXRTaXplICogMC41LCBidWxsZXRTaXplICogMC41LCBidWxsZXRBdHRycyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGl0ZW1MYXllci5yZWN0KHgsIE1hdGguZmxvb3IoeSkgKyAoZm9udFNpemUgLSBidWxsZXRTaXplKSAqIDAuNSwgYnVsbGV0U2l6ZSwgYnVsbGV0U2l6ZSwgYnVsbGV0QXR0cnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBSZW5kZXIgbGFiZWxcbiAgICAgICAgICBpdGVtTGF5ZXIudGV4dGJveCh4ICsgYnVsbGV0U2l6ZSArIHNwYWNpbmcsIGZsb29yKHkpLCB3aWR0aCA/IHdpZHRoIC0gYnVsbGV0U2l6ZSAtIHNwYWNpbmcgOiAwLCBoZWlnaHQgPyB0b3AgKyBoZWlnaHQgLSB5IDogMCwgbGFiZWwsIGl0ZW1PcHRzKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpdGVtV2lkdGggPSBmbG9vcihpdGVtTGF5ZXIuYmJveCgpLndpZHRoKTtcbiAgICAgICAgICBpdGVtSGVpZ2h0ID0gZmxvb3IoaXRlbUxheWVyLmJib3goKS5oZWlnaHQgKyAobGluZUhlaWdodCAtIGZvbnRTaXplKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGhvcml6b250YWwpIHtcbiAgICAgICAgICAgIHgrPSBpdGVtV2lkdGggKyBmb250U2l6ZTtcbiAgICAgICAgICAgIGlmICh3aWR0aCAmJiB4ID4gd2lkdGgpIHtcbiAgICAgICAgICAgICAgeSs9IGl0ZW1IZWlnaHQ7XG4gICAgICAgICAgICAgIHggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB5Kz0gaXRlbUhlaWdodDtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfSk7XG4gIFxuICByZXR1cm4gX3Y7XG4gIFxufSgpKTtcblxubW9kdWxlLmV4cG9ydHMgPSBfdjsiXX0=
