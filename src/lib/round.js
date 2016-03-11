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