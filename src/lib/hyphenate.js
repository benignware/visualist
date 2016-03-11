hyphenate = (function() {
  var cache = {};
  return function(string) {
    return cache[string] = cache[string] || (function() {
      return string.replace(/([A-Z])/g, function($1){return "-"+$1.toLowerCase();});
    })();
  };
})();
module.exports = hyphenate;