/**
 * DOM Tests
 */
test("size", function(assert) {
  
  assert.equal(
    _v('#get > *').size(),
    $('#get > *').size(),
    'Result should match jquery'
  );
  
});

test("get", function(assert) {
  
  assert.domEqual(
    _v('#get > *').get(1),
    $('#get > *').get(1),
    'Result should match jquery'
  );
  
});

test("toArray", function(assert) {
  
  assert.deepEqual(
    _v('#get > *').toArray(),
    $('#get > *').toArray(),
    'Result should match jquery'
  );
  
});

test("index", function(assert) {
  assert.equal(
    _v("#get > circle[fill='blue']").index(),
    $("#get > circle[fill='blue']").index(),
    'Result should match jquery'
  );
});

test("attr", function(assert) {

  assert.domEqual(
    _v("#attr circle").attr('fill', 'yellow'),
    $('<circle fill="yellow" r="100" cy="100" cx="100"></circle>'),
    'Markup should match the expected results'
  );
  
});

test("css", function(assert) {
  
  assert.domEqual(
    _v("#css").css('background-color', 'yellow'),
    $('<svg style="background-color: yellow;" id="css" xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>'),
    'Markup should match the expected results'
  );
});

test("create", function(assert) {
  
  assert.domEqual(
    _v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'}),
    $('<circle fill="blue" r="50" cy="100" cx="100"></circle>'),
    'Markup should match the expected results'
  );
  
});

test("append", function(assert) {
  
  var svg = _v('#append', 200, 200)
    .append(_v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'}));
  
  assert.domEqual(
    $('#append'),
    $('<svg height="200px" width="200px" id="append" xmlns="http://www.w3.org/2000/svg"><circle fill="blue" r="50" cy="100" cx="100"></circle></svg>'),
    'Markup should match the expected results'
  );
  
});

test("appendTo", function(assert) {
  
  _v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'}).appendTo(_v('#append-to', 200, 200));
  
  assert.domEqual(
    $('#append-to'),
    $('<svg height="200px" width="200px" id="append-to" xmlns="http://www.w3.org/2000/svg"><circle fill="blue" r="50" cy="100" cx="100"></circle></svg>'),
    'Markup should match the expected results'
  );
  
});

test("prepend", function(assert) {
  
  _v('#prepend', 200, 200)
    .append(_v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'}))
    .prepend(_v().create("circle", {cx: 100, cy: 100, r: 100, fill: 'orange'}));
  
  assert.domEqual(
    $('#prepend'),
    $('<svg height="200px" width="200px" id="prepend" xmlns="http://www.w3.org/2000/svg"><circle fill="orange" r="100" cy="100" cx="100"></circle><circle fill="blue" r="50" cy="100" cx="100"></circle></svg>'),
    'Markup should match the expected results'
  );
  
});

test("prependTo", function(assert) {
  
  _v('#prepend-to', 200, 200)
    .append(_v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'}));
    
  _v().create("circle", {cx: 100, cy: 100, r: 100, fill: 'orange'}).prependTo(_v('#prepend-to'));
  
  assert.domEqual(
    $('#prepend-to'),
    $('<svg height="200px" width="200px" id="prepend-to" xmlns="http://www.w3.org/2000/svg"><circle fill="orange" r="100" cy="100" cx="100"></circle><circle fill="blue" r="50" cy="100" cx="100"></circle></svg>'),
    'Markup should match the expected results'
  );
  
});

test("remove", function(assert) {
  
  var circle1 = _v().create("circle", {cx: 100, cy: 100, r: 50, fill: 'blue'});
  var circle2 = _v().create("circle", {cx: 100, cy: 100, r: 100, fill: 'orange'});
  
  var svg = _v('#remove', 200, 200)
    .append(circle1)
    .append(circle2);
    
  circle1.remove();
  svg.remove(circle2);
  
  assert.domEqual(
    $('#remove'),
    $('<svg height="200px" width="200px" id="remove" xmlns="http://www.w3.org/2000/svg"></svg>'),
    'Markup should match the expected results'
  );
  
});


/**
 * SVG Shapes
 */
test("rect", function(assert) {
  
  _v('#rect', 400, 110)
    .rect(0, 0, 300, 100, {style: "fill:rgb(0,0,255);stroke-width:3;stroke:rgb(0,0,0)"});
    
  assert.domEqual(
    $('#rect'),
    $('<svg height="110px" id="rect" width="400px" xmlns="http://www.w3.org/2000/svg"><rect height="100" style="fill:rgb(0,0,255);stroke-width:3;stroke:rgb(0,0,0)" width="300" x="0" y="0"></rect></svg>'),
    'Markup should match the expected results'
  );
  
});

test("circle", function(assert) {
  
  _v('#circle', 100, 100)
    .circle(50, 50, 40, {stroke: 'green', strokeWidth: 4, fill: 'yellow'});
  
  assert.domEqual(
    $('#circle'), 
    $('<svg height="100px" id="circle" width="100px" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" fill="yellow" r="40" stroke="green" stroke-width="4"></circle></svg>'),
    'Markup should match the expected results'
  );

});

test("ellipse", function(assert) {
  
  _v('#ellipse', 500, 140)
    .ellipse(200, 80, 100, 50, {style: "fill:yellow;stroke:purple;stroke-width:2"});
    
  assert.domEqual(
    $('#ellipse'), 
    $('<svg height="140px" id="ellipse" width="500px" xmlns="http://www.w3.org/2000/svg"><ellipse cx="200" cy="80" rx="100" ry="50" style="fill:yellow;stroke:purple;stroke-width:2"></ellipse></svg>'),
    'Markup should match the expected results'
  );

});

test("line", function(assert) {
  
  _v('#line', 500, 210)
    .line(0, 0, 200, 200, {style: "stroke:rgb(255,0,0);stroke-width:2"});
  
  assert.domEqual(
    $('#line'), 
    $('<svg height="210px" id="line" width="500px" xmlns="http://www.w3.org/2000/svg"><line style="stroke:rgb(255,0,0);stroke-width:2" x1="0" x2="200" y1="0" y2="200"></line></svg>'),
    'Markup should match the expected results'
  );

});

test("polygon", function(assert) {
  
  _v('#polygon', 500, 210)
    .polygon([{x: 200, y: 10}, {x: 250, y: 190}, {x: 160, y: 210}], {style: "fill:lime;stroke:purple;stroke-width:1"});
  
  assert.domEqual(
    $('#polygon'), 
    $('<svg height="210px" id="polygon" width="500px" xmlns="http://www.w3.org/2000/svg"><polygon points="200,10 250,190 160,210" style="fill:lime;stroke:purple;stroke-width:1"></polygon></svg>'),
    'Markup should match the expected results'
  );

});

test("polyline", function(assert) {
  
  _v('#polyline', 500, 210)
    .polyline([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
  
  assert.domEqual(
    $('#polyline'), 
    $('<svg height="210px" id="polyline" width="500px" xmlns="http://www.w3.org/2000/svg"><polyline points="20,20 40,25 60,40 80,120 120,140 200,180" style="fill:none;stroke:black;stroke-width:3"></polyline></svg>'),
    'Markup should match the expected results'
  );

});

test("path", function(assert) {
  
  _v('#path', 400, 200)
    .path("M150 0 L75 200 L225 200 Z");
  
  assert.domEqual(
    $('#path'), 
    $('<svg height="200px" id="path" width="400px" xmlns="http://www.w3.org/2000/svg"><path d="M150 0 L75 200 L225 200 Z"></path></svg>'),
    'Markup should match the expected results'
  );

});

test("text", function(assert) {
  
  _v('#text', 200, 30)
    .text(0, 15, "I love SVG!", {fill: 'red'});
  
  assert.domEqual(
    $('#text'), 
    $('<svg height="30px" id="text" width="200px" xmlns="http://www.w3.org/2000/svg"><text fill="red" x="0" y="15">I love SVG!</text></svg>'),
    'Markup should match the expected results'
  );

});

test("g", function(assert) {
  
  _v('#g', 400, 110)
    .g();
  
  assert.domEqual(
    $('#g'),
    $('<svg height="110px" width="400px" id="g" xmlns="http://www.w3.org/2000/svg"><g></g></svg>'),
    'Markup should match the expected results'
  );
  
});

test("arc", function(assert) {
  
  _v('#arc', 200, 200)
    .arc(100, 100, 80, Math.PI * 0.25, Math.PI * 1.75, 1, {fill: 'blue'});
console.log("$('#arc'): ", $('#arc').html());
  assert.domEqual(
    $('#arc'),
    $('<svg height=\"200px\" id=\"arc\" width=\"200px\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 100, 100 L156.57,156.57 A80,80 0 1,1 156.57,43.43 Z\" fill=\"blue\"></path></svg>'),    
    'Markup should match the expected results'
  );
  
});

test("graph", function(assert) {
  
  _v('#graph', 500, 210)
    .graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
  
  assert.domEqual(
    $('#graph'), 
    $('<svg height=\"210px\" id=\"graph\" width=\"500px\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M20 20 L40 25 L60 40 L80 120 L120 140 L200 180 \" fill=\"none\" style=\"fill:none;stroke:black;stroke-width:3\"></path></svg>'),
    'Markup should match the expected results'
  );
  
});

test("textbox", function(assert) {
  
  _v('#textbox', 200, 100)
    .rect(0, 0, 200, 100, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
    .textbox(10, 10, 180, 80, "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem.", {fill: 'ghostwhite'});
    
  
  assert.domEqual(
    $('#textbox'),
    $('<svg height="100px" width="200px" id="textbox" xmlns="http://www.w3.org/2000/svg"><rect height="100" width="200" y="0" x="0" style="fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"></rect><text y="10" x="10" fill="ghostwhite"><tspan x="10" dy="12">Lorem ipsum dolor sit amet,</tspan><tspan x="10" dy="20">consectetuer adipiscing elit.</tspan><tspan x="10" dy="20">Aenean commodo ligula</tspan><tspan x="10" dy="20">eget dolor. Aenean massa.</tspan></text></svg>'),
        'Markup should match the expected results'
  );
  
});

test("list", function(assert) {
  
  _v('#list', 200, 100)
    .list(10, 10, [{label: "Item 1"}, {label: "Item 2"}]);
  
  assert.domEqual(
    $('#list'),
    $('<svg height=\"100px\" id=\"list\" width=\"200px\" xmlns=\"http://www.w3.org/2000/svg\"><g><circle cx=\"14.55\" cy=\"17\" r=\"4.55\"></circle><text x=\"23.1\" y=\"10\"><tspan dy=\"12\" x=\"23\">Item 1</tspan></text></g><g><circle cx=\"14.55\" cy=\"39\" r=\"4.55\"></circle><text x=\"23.1\" y=\"32\"><tspan dy=\"12\" x=\"23\">Item 2</tspan></text></g></svg>'),
    'Markup should match the expected results'
  );
  
});


test("listbox", function(assert) {
  
 _v('#listbox', 200, 100)
    .rect(0, 0, 200, 100, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
    .listbox(10, 10, 180, 80, ["Lorem ipsum dolor sit amet", "Consectetuer adipiscing elit"], {fill: "ghostwhite"});
  
  assert.domEqual(
    $('#listbox'),
    $('<svg height=\"100px\" id=\"listbox\" width=\"200px\" xmlns=\"http://www.w3.org/2000/svg\"><rect height=\"100\" style=\"fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)\" width=\"200\" x=\"0\" y=\"0\"></rect><g><circle cx=\"14.55\" cy=\"17\" fill=\"ghostwhite\" r=\"4.55\"></circle><text fill=\"ghostwhite\" x=\"23.1\" y=\"10\"><tspan dy=\"12\" x=\"23\">Lorem ipsum dolor sit</tspan><tspan dy=\"20\" x=\"23\">amet</tspan></text></g><g><circle cx=\"14.55\" cy=\"59\" fill=\"ghostwhite\" r=\"4.55\"></circle><text fill=\"ghostwhite\" x=\"23.1\" y=\"52\"><tspan dy=\"12\" x=\"23\">Consectetuer adipiscing</tspan><tspan dy=\"20\" x=\"23\">elit</tspan></text></g></svg>'),
    'Markup should match the expected results'
  );
  
});
