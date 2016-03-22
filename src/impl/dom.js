var
  merge = require('deepmerge'),
  xmldom = require('xmldom'),
  nwmatcher = require('nwmatcher');
  
if (!process.browser) {
  // Extend xmldom
  var Document = (new xmldom.DOMImplementation()).createDocument().constructor;
  Document.prototype.querySelectorAll = function(selector) {
    var nw = nwmatcher({document: this});
    return nw.select( selector, this.documentElement );
  };
}

module.exports = merge(xmldom, {
  Document: Document
});