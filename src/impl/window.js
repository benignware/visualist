var
  merge = require('deepmerge'),
  // Init DOM Implementation
  dom = process.browser ? {
    DOMImplementation: window.DOMImplementation,
    XMLSerializer: window.XMLSerializer,
    DOMParser: window.DOMParser,
    Document: window.Document
  } : require('./dom'),
  
  svg = require('./svg');
  

module.exports = merge(merge(dom, svg), {
  // Add more methods here
  
});