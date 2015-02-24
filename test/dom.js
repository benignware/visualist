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
  
  assert.domEqual(
    _v("#get > circle[fill='blue']").index(),
    $("#get > circle[fill='blue']").index(),
    'Result should match jquery'
  );
  
});

test("html", function(assert) {
  
  assert.domEqual(
    _v("#get").html(),
    $("#get").html(),
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
    _v("#css").css('background', 'yellow'),
    $('<svg style="background: none repeat scroll 0% 0% yellow;" id="css" xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>'),
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