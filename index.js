#!/usr/bin/env node

var dest = 'svg/';

var _v = require('./src/visualist_node.js');
var fs = require('fs');

var logo = _v(375, 100);
logo.g({transform: 'skewX(-45) skewY(-10) translate(90, 40)'})
  .rect(10, 20, 245, 50, {fill: '#c2f'})
  .text(20, 55, "visualist", {fontSize: 42, fontFamily: 'Courier New', fill: '#fff'});
    
fs.writeFileSync(dest + 'logo.svg', logo.svg());


var ellipse = _v(500, 140)
ellipse.ellipse(200, 80, 100, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});

fs.writeFileSync(dest + 'ellipse.svg', ellipse.svg());

console.log("ellipse: ", ellipse.svg());



var arc = _v(200, 200);
arc.arc(100, 100, 80, Math.PI * 0.25, Math.PI * 1.75, 1, {fill: 'blue'});

fs.writeFileSync(dest + 'arc.svg', arc.svg());

console.log("arc: ", arc.svg());


var graph = _v(500, 210);
graph.graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {stroke: 'red', strokeWidth: 3});
fs.writeFileSync(dest + 'graph.svg', graph.svg());
console.log("graph: ", graph.svg());