test("arc", function(assert) {
  
  _v('#arc', 200, 200)
    .arc(100, 100, 80, Math.PI * 0.25, Math.PI * 1.75, 1, {fill: 'blue'});
  
  assert.domEqual(
    $('#arc'),
    $('<svg height="200px" width="200px" id="arc" xmlns="http://www.w3.org/2000/svg"><path d="M100,100 L156.5685424949238,156.5685424949238 A80,80 0 1,1 156.5685424949238,43.43145750507618 Z" fill="blue"></path></svg>',
    'Markup should match the expected results')
  );
  
});

test("graph", function(assert) {
  
  _v('#graph', 500, 210)
    .graph([{x: 20, y: 20}, {x: 40, y: 25}, {x: 60, y: 40}, {x: 80, y: 120}, {x: 120, y: 140}, {x: 200, y: 180}], {style: "fill:none;stroke:black;stroke-width:3"});
  
  assert.domEqual(
    $('#graph'), 
    $('<svg height="210px" width="500px" id="graph" xmlns="http://www.w3.org/2000/svg"><path d="M20 20 Q40 25 50 32.5 Q60 40 70 80 Q80 120 100 130 Q120 140 160 160 T200 180 " style="fill:none;stroke:black;stroke-width:3"></path></svg>'),
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
    $('<svg height="100px" width="200px" id="list" xmlns="http://www.w3.org/2000/svg"><g><rect height="9.1" width="9.1" y="12.45" x="10"></rect><text y="10" x="24.1"><tspan x="24" dy="12">Item 1</tspan></text></g><g><rect height="9.1" width="9.1" y="34.45" x="10"></rect><text y="32" x="24.1"><tspan x="24" dy="12">Item 2</tspan></text></g></svg>'),
    'Markup should match the expected results'
  );
  
});


test("listbox", function(assert) {
  
 _v('#listbox', 200, 240)
    .rect(0, 0, 200, 240, {style: "fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"})
    .listbox(10, 10, 180, 220, ["Lorem ipsum dolor sit amet", "Consectetuer adipiscing elit", "Aenean commodo ligula eget dolor. Aenean massa.", "Cum sociis natoque penatibus et magnis dis parturient montes"], {fill: "ghostwhite"});
  
  assert.domEqual(
    $('#listbox'),
    $('<svg height="240px" width="200px" id="listbox" xmlns="http://www.w3.org/2000/svg"><rect height="240" width="200" y="0" x="0" style="fill:darkgray;stroke-width:1;stroke:rgb(0,0,0)"></rect><g><rect height="9.1" width="9.1" y="12.45" x="10" fill="ghostwhite"></rect><text y="10" x="24.1" fill="ghostwhite"><tspan x="24" dy="12">Lorem ipsum dolor sit</tspan><tspan x="24" dy="20">amet</tspan></text></g><g><rect height="9.1" width="9.1" y="54.45" x="10" fill="ghostwhite"></rect><text y="52" x="24.1" fill="ghostwhite"><tspan x="24" dy="12">Consectetuer adipiscing</tspan><tspan x="24" dy="20">elit</tspan></text></g><g><rect height="9.1" width="9.1" y="96.45" x="10" fill="ghostwhite"></rect><text y="94" x="24.1" fill="ghostwhite"><tspan x="24" dy="12">Aenean commodo ligula</tspan><tspan x="24" dy="20">eget dolor. Aenean</tspan><tspan x="24" dy="20">massa.</tspan></text></g><g><rect height="9.1" width="9.1" y="158.45" x="10" fill="ghostwhite"></rect><text y="156" x="24.1" fill="ghostwhite"><tspan x="24" dy="12">Cum sociis natoque</tspan><tspan x="24" dy="20">penatibus et magnis dis</tspan><tspan x="24" dy="20">parturient montes</tspan></text></g></svg>'),
    'Markup should match the expected results'
  );
  
});
