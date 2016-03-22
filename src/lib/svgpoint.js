var XSSMatrix = require('xcssmatrix');

function SVGPoint(x, y) {
  this.x = x;
  this.y = y;
}

SVGPoint.prototype.matrixTransform = function(matrix) {
  return matrix.transformVector(vector);
};

module.exports = SVGPoint;
