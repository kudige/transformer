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
&lt;h1&gt;{=page.title}&lt;/h1&gt;
&lt;h2&gt;Order List&lt;/h2&gt;

{set total=0}
&lt;table&gt;
&lt;tr&gt;&lt;th&gt;Product&lt;/th&gt;&lt;th&gt;Price&lt;/th&gt;&lt;Quantity&lt;/th&gt;&lt;/tr&gt;
&lt;tr&gt;
{foreach from=orders item=order}
&lt;tr&gt;
&lt;td&gt;{=order.name}&lt;/td&gt; &lt;td&gt; {= order.price|currency} &lt;/td&gt; &lt;td&gt;{order.qty}&lt;/td&gt;
&lt;/tr&gt;
{set total=`order.price*order.qty+total`}
{/foreach}
&lt;p&gt;
Total price: {=total|currency}
&lt;/p&gt;
</code></pre>


## License 
As described in LICENSE
