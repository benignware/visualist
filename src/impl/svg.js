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
