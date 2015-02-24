visualist
=========

> Minimalist svg dom library


### Constructor

#### _v(selector, width, height, [attrs]);

*Create from an existing selector*
```js
_v("svg", 400, 300);
```

*Create a new svg canvas and append to body*
```js
_v(400, 300).prependTo(document.body);
```

### Components

#### append( child )
Appends the specified child to the first element in the set.

#### arc( x, y, r, sAngle, eAngle, counterclockwise, [attrs] )
The arc() method creates an arc/curve (used to create circles, or parts of circles).

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

#### ellipse( cx, cy, rx, ry, [attrs])
Draws an ellipse on every element in the set.

```js
_v('#ellipse', 500, 140)
  .ellipse(200, 80, 100, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});
```

#### graph( points, [options] )
Renders a smooth graph on every element in the set.

```js
_v('#graph', 500, 210)
  .graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
```

#### group( [attrs] )
Creates and returns a group layer on the first element in the set

#### line( x1, y1, x2, y2, [attrs] )
Draws a line on every element in the set.

```js
_v('#line', 500, 210)
  .line(0, 0, 200, 200, {style: "stroke:rgb(255,0,0);stroke-width:2"});
```

#### list( x, y, items, [options] )
Renders an unordered list.

```js
_v('#list', 200, 100)
  .list(10, 10, [{label: "Item 1"}, {label: "Item 2"}]);
```

#### listbox( x, y, width, height, items, [options] ) {
Renders an unordered list into the specified bounds.

```js
_v('#listbox', 200, 240)
  .rect(0, 0, 200, 240, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
  .listbox(10, 10, 180, 220, ["Lorem ipsum dolor sit amet", "Consectetuer adipiscing elit", "Aenean commodo ligula eget dolor. Aenean massa.", "Cum sociis natoque penatibus et magnis dis parturient montes"], {fill: "ghostwhite"});
```

#### path( d, [attrs] )
Draws a path on every element in the set.

```js
_v('#path', 400, 200)
  .path("M150 0 L75 200 L225 200 Z");
```

#### polygon( points, [attrs])
Draws a polygon on every element in the set.

```js
_v('#polygon', 500, 210)
  .polygon([{x: 200, y: 10}, {x: 250, y: 190}, {x: 160, y: 210}], {style: "fill:lime;stroke:purple;stroke-width:1"});
```

#### polyline( points, [attrs])
Draws a polyline on every element in the set.

```js
_v('#polyline', 500, 210)
  .polyline([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
```

#### rectangle( x, y, width, height [attrs] )
Draws a rectangle on every element in the set.

```js
_v('#rectangle', 400, 110)
  .rect(0, 0, 300, 100, {style: "fill:rgb(0,0,255);stroke-width:3;stroke:rgb(0,0,0)"});
```

#### remove( [child] )
Removes all elements in the set or removes the specified child from the set of matched elements.

#### text( x, y, string, attrs )
Renders text on every element in the set.

```js
_v('#text', 200, 30)
  .text(0, 15, "I love SVG!", {fill: 'red'});
```

#### textbox( x, y, width, height, string, [attrs] ) {
Renders text into a bounding box by wrapping lines at spaces.

```js
_v('#textbox', 200, 100)
  .rect(0, 0, 200, 100, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
  .textbox(10, 10, 180, 80, "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem.", {fill: 'ghostwhite'});
```