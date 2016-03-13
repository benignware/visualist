/**
 * Camelize a string
 * @param {String} string
 */ 
var camelize = (function() {
  var cache = {};
  return function camelize(string) {
    return cache[string] = cache[string] || (function() {
      return string.replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','');});
    })();
  };
})();
module.exports = camelize;