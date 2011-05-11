#	Transformer Template System

## Usage:
<pre><code>
var Transformer = require('transformer')
var transformer = new Transformer
var myvars = {var1 : "Value1", var2: {field1: "Value 2"}}
var code = transformer.compile(input_text)
var output_text = transformer.execute(code, myvars)
</code></pre>

## Samples 
Samples are present in the file tests/tests.js which shows how to use various features of Transformer.
You can run the samples either by:
<pre><code>
node tests/tests.js OR
npm test transformer
</code></pre>

## License 
As described in LICENSE
