#!/usr/bin/env node

var dest = 'svg/';

var _v = require('./src/visualist.js');
var fs = require('fs');

// Circle
var circle = _v(800, 600)
circle.circle(200, 80, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});
console.log("circle: ", circle[0].ownerDocument.querySelectorAll('circle').length);
console.log("circle.svg(): ", circle.svg());
fs.writeFileSync(dest + 'circle.svg', circle.svg());


/*
// Logo
var logo = _v(800, 600, {style: 'font-size: 20px;'});
// skewX(-45) skewY(-10) 
var layer = logo.g({transform: 'translate(40, 90) rotate(0,0,0) ', style: 'font-size: 20px;'})
  //.rect(10, 20, 245, 50, {fill: '#c2f'})
var text = layer.create('text', {x: 150, y: 150, style: {fontSize: '30px', fontFamily: 'Arial', fill: 'black'}});
text.append('Visualist');
//layer.append(text);
layer.append(text);
var bbox = layer.bbox();
console.log("bbox: ", bbox);
var rect = logo.create('rect', {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, fill: 'blue'});
logo.prepend(rect);

console.log("--->", logo.svg());
fs.writeFileSync(dest + 'logo.svg', logo.svg());
*/
/*
// Ellipse
var ellipse = _v(500, 140)
ellipse.ellipse(200, 80, 100, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});
fs.writeFileSync(dest + 'ellipse.svg', ellipse.svg());

// Arc
var arc = _v(200, 200);
arc.arc(100, 100, 80, Math.PI * 0.25, Math.PI * 1.75, 1, {fill: 'blue'});
fs.writeFileSync(dest + 'arc.svg', arc.svg());

// Graph
var graph = _v(500, 210);
graph.graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {stroke: 'red', strokeWidth: 3});
fs.writeFileSync(dest + 'graph.svg', graph.svg());


// Textbox
var
  textbox = _v(350, 400);
textbox.rect(0, 0, 250, 200, {style: { fill: 'darkgray', strokeWidth: 1, stroke: 'rgb(0,0,0)'}});
textbox.textbox(10, 10, 230, 180, "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem.", {style: {textAlign: 'right', fontFamily: 'Verdana', fontSize: '14px', fill: 'black'}});
fs.writeFileSync(dest + 'textbox.svg', textbox.svg());
*/