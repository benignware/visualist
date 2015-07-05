visualist
=========

> Minimalist svg dom library

[Demo](http://benignware.github.io/visualist)

## Usage

Add the library to your stack:

```html
<script src="visualist.min.js"></script>
```

Provide an empty svg element in the document:

```html
<svg id="example" xmlns="http://www.w3.org/2000/svg"></svg>
```

Use visualist to render svg:
```js
_v('#example', 375, 100)
  .g({transform: 'skewX(-45) skewY(-10) translate(90, 40)'})
    .rect(10,20,245,50, {fill: '#c2f'})
    .text(20, 55, "visualist", {fontSize: 42, fontFamily: 'Courier New', fill: '#fff'});
```

## API

### Constructor

#### _v(selector, width, height, [attrs]);

*Create from an existing selector*
```js
_v("#svg", 400, 300);
```

*Create a new svg canvas and append to container*
```js
var div = document.createElement('div');
_v(400, 300).appendTo(div);
```

### Components

#### append( child )
Appends the specified child to the first element in the set.

#### appendTo( parent )
Appends the current set of elements to the specified parent

#### arc( x, y, r, sAngle, eAngle, counterclockwise, [attrs] )
The arc() method creates an arc/curve (used to create circles, or parts of circles).

```html
<svg id="arc" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#arc', 200, 200)
  .arc(100, 100, 80, Math.PI * 0.25, Math.PI * 1.75, 1, {fill: 'blue'});
```

#### attr( name, [value] )
Get the value of an attribute for the first element in the set of matched elements or set one or more attributes for every matched element.

#### bbox()
Retrieves the bounding box of the first element in the set.

#### clear()
Removes all children from every element in the set.

#### circle( cx, cy, r, [attrs])
Draws a circle on every element in the set.

```html
<svg id="circle" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#circle', 100, 100)
  .circle(50, 50, 40, {stroke: 'green', strokeWidth: 4, fill: 'yellow'});
```

#### computedTextLength()
Retrieves the computed text length of the first element in the set if applicable and the element has been rendered.

#### create( tagName, [attrs] )
Creates and returns a new element with the specifed tagname.

#### css( name, [value] )
Get the value of a computed style property for the first element in the set of matched elements or set one or more CSS properties for every matched element.

#### ellipse( cx, cy, rx, ry, [attrs] )
Draws an ellipse on every element in the set.

```html
<svg id="ellipse" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#ellipse', 500, 140)
  .ellipse(200, 80, 100, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});
```

#### g( [attrs] )
Creates and returns a group layer on the first element in the set

#### graph( points, [options] )
Renders a graph on every element in the set. Set option `smooth` to true to render a curved graph. You can also provide a `tension`-option as floating point and a bool-flag `approximate`-options to control smoothiness.

```html
<svg id="graph" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#graph', 500, 210)
  .graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
```

#### get( [index] )
Retrieve one or all elements in the set.

#### index()
Search for a given element from among the matched elements.

#### line( x1, y1, x2, y2, [attrs] )
Draws a line on every element in the set.

```html
<svg id="line" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#line', 500, 210)
  .line(0, 0, 200, 200, {style: "stroke:rgb(255,0,0);stroke-width:2"});
```

#### list( x, y, items, [options] )
Renders an unordered list.

```html
<svg id="list" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#list', 200, 100)
  .list(10, 10, [{label: "Item 1"}, {label: "Item 2"}]);
```

#### listbox( x, y, width, height, items, [options] ) {
Renders an unordered list into the specified bounds.

```html
<svg id="listbox" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#listbox', 200, 240)
  .rect(0, 0, 200, 240, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
  .listbox(10, 10, 180, 220, ["Lorem ipsum dolor sit amet", "Consectetuer adipiscing elit", "Aenean commodo ligula eget dolor. Aenean massa.", "Cum sociis natoque penatibus et magnis dis parturient montes"], {fill: "ghostwhite"});
```

#### parent()
Returns the parent node of the first element in the set.

#### path( d, [attrs] )
Draws a path on every element in the set.

```html
<svg id="path" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#path', 400, 200)
  .path("M150 0 L75 200 L225 200 Z");
```

#### polygon( points, [attrs] )
Draws a polygon on every element in the set.

```html
<svg id="polygon" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#polygon', 500, 210)
  .polygon([{x: 200, y: 10}, {x: 250, y: 190}, {x: 160, y: 210}], {style: "fill:lime;stroke:purple;stroke-width:1"});
```

#### polyline( points, [attrs] )
Draws a polyline on every element in the set.

```html
<svg id="polyline" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#polyline', 500, 210)
  .polyline([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
```

#### prepend( child )
Prepends the specified child to the first element in the set.

#### prependTo( parent )
Prepends the current set of elements to the specified parent.

#### rectangle( x, y, width, height [attrs] )
Draws a rectangle on every element in the set.

```html
<svg id="rectangle" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#rectangle', 400, 110)
  .rect(0, 0, 300, 100, {style: "fill:rgb(0,0,255);stroke-width:3;stroke:rgb(0,0,0)"});
```

#### remove( [child] )
Removes all elements in the set or removes the specified child from the set of matched elements.

#### size()
Return the number of elements in the set.

#### text( x, y, string, attrs )
Renders text on every element in the set.

```html
<svg id="text" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#text', 200, 30)
  .text(0, 15, "I love SVG!", {fill: 'red'});
```

#### textbox( x, y, width, height, string, [attrs] ) {
Renders text into a bounding box by wrapping lines at spaces.

```html
<svg id="textbox" xmlns="http://www.w3.org/2000/svg"></svg>
```

```js
_v('#textbox', 350, 200)
  .rect(0, 0, 350, 200, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
  .textbox(10, 10, 330, 180, "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem.", {fill: 'ghostwhite'});
```

#### toArray()
Retrieve all the elements contained in the set as an array.

## Changelog

* v0.0.3 - Fixed bbox null pointer
* v0.0.2 - Added bower.json
* v0.0.1 - Initial Release
