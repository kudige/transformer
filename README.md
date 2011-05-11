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

# Sample template

To give an idea of how the transformer template looks, I have included a small example:
<pre><code>
<h1>{=page.title}
<h2>Order List</h2>

{set total=0}
<table>
<tr><th>Product</th><th>Price</th><Quantity</th></tr>
<tr>
{foreach from=orders item=order}
<tr>
<td>{=order.name}</td> <td> {= order.price|currency} </td> <td>{order.qty}</td>
</tr>
{set total=`order.price*order.qty+total`}
{/foreach}
<p>
Total price: {=total|currency}
</p>
</code></pre>


## License 
As described in LICENSE
