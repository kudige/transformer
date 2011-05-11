	Transformer Template System
	===========================

Usage:
var Transformer = require('transformer')
var transformer = new Transformer
var myvars = {var1 : "Value1", var2: {field1: "Value 2"}}
var code = transformer.compile(input_text)
var output_text = transformer.execute(code, myvars)

Testcases are present at tests/tests.js which shows how to use various features of Transformer.
You can run tests either by:
node tests/tests.js OR
npm test transformer

License for this software is described in the file named LICENSE
