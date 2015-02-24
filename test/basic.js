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