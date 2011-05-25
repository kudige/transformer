#!/usr/bin/env node

var Jstest = require('./jstest'),
Util = require('util'),
FS = require('fs'),
Transformer = require('transformer')

//View.debug.enable()

var Tests = function() {
	Jstest.call(this)
	this.transformer = new Transformer;

}
Util.inherits(Tests, Jstest)

Tests.prototype.init = function() {
	Jstest.prototype.init.call(this)
}

Tests.prototype.finish = function() {
	console.log("All finished")
	Jstest.prototype.finish.call(this)
}

/* --------------- simple var tests --------------- */

// Variable rendering
Tests.prototype.testvars = function() {
	// Simple var substitution
	var vars = {a: "A",
				b: "BBB",
				c: "C",
				n: 8}
	var input = 'abcd {abc\n {$ a}\n} {$ b} {$ c} {$ a} {$ n*4 - n/2}'
	var verify = 'abcd {abc\n A\n} BBB C A 28'
	var ins = this.transformer.compile(input)
	var output = this.transformer.execute(ins, vars)

	this.assertEquals('testvars.1', output, verify, 'output', 'verify')

	// Field substitution
	vars = {var1: {field1: 'V1_F1',
					   field2: 'V1_F2',
					   field3: {subfield1: "V1_F3_S1",
								subfield2: "V1_F3_S1"}},
				var2: 'V2'}

	input = "Some data {$var1.field1} and {$var2} with {unchanged} some {$var1.field3.subfield1} with unmatched {$var3} with unmatched {$var3.xyz}"
	verify = "Some data V1_F1 and V2 with {unchanged} some V1_F3_S1 with unmatched  with unmatched "
	var verify2 = "Some data V1_F1 and V2 with  some V1_F3_S1 with unmatched  with unmatched "
	ins = this.transformer.compile(input)
	output = this.transformer.execute(ins, vars)
	this.assertEquals('testvars.unknown_macro', output, verify, 'output', 'verify')
	
	this.transformer.ignoreUnknownMacros = true
	output = this.transformer.execute(ins, vars)
	this.assertEquals('testvars.ignore_unknown_macro', output, verify2, 'output', 'verify2')
	this.transformer.ignoreUnknownMacros = false

	// Function substitution
	vars = {}
	vars['var1'] = {field1: ['V1_F1_1', {name: 'V1_F1_name'}, 'V1_F1_3'],
					field2: 'V1_F2',
					field3: {subfield1: "V1_F3_S1",
							 subfield2: "V1_F3_S1"}}
	vars['var2'] = function(){return "Hurray"}

	var input = "Some data {$var1.field1[2]} and {$var2()} with  some {$var1.field1[1].name} with unmatched {$var3} with unmatched {$var3.xyz}"
	var verify = "Some data V1_F1_3 and Hurray with  some V1_F1_name with unmatched  with unmatched "
	var ins = this.transformer.compile(input)
	var output = this.transformer.execute(ins, vars)

	this.assertEquals('testvars.3', output, verify, 'output', 'verify')
	this.next()
}

// Macro tests
Tests.prototype.testmacro = function() {
	// Basic macro
	this.transformer.addMacro('simple_macro1', function() {
		return 'SIMPLE'
	})
	var vars = {
		var1: 'VAR1',
		var2: {field1: 'VAR2_F1'}
	}
	var input  = "This substitutes macro {simple_macro1} along with variable {$var1} and {$var2.field1}"
	var verify = "This substitutes macro SIMPLE along with variable VAR1 and VAR2_F1"
	var ins = this.transformer.compile(input)
	var output = this.transformer.execute(ins, vars)
	this.assertEquals('testmacro.basic', output, verify, 'output', 'verify')
	
	// Macro with params
	this.transformer.addMacro('simple_macro2', function(context) {
		return context.params.a + "::" + context.params.b
	})

	input  = "This substitutes macro {simple_macro2 a=123 b='Hello there'} along with variable {$var1} and {$var2.field1}"
	verify = "This substitutes macro 123::Hello there along with variable VAR1 and VAR2_F1"
	ins = this.transformer.compile(input)
	output = this.transformer.execute(ins, vars)
	this.assertEquals('testmacro.params', output, verify, 'output', 'verify')

	// Macro with vars for fields with undefined vars
	this.transformer.addMacro('simple_macro3', function(context) {
		var params = context.params
		return params.a + "::" + params.b + '::' + params.c
	})
	input  = "This substitutes macro {simple_macro3 a=`var1` b=`var2.field1` c=`var3.field3.xyz`} along with variable {$var1} and {$var2.field1}"
	verify = "This substitutes macro VAR1::VAR2_F1:: along with variable VAR1 and VAR2_F1"
	ins = this.transformer.compile(input)
	output = this.transformer.execute(ins, vars)
	this.assertEquals('testmacro.paramvars', output, verify, 'output', 'verify')

	// Undefined macro
	input  = "Some macro {simple_macro1} along with {unknown_macro} too"
	verify = "Some macro SIMPLE along with {unknown_macro} too"
	ins = this.transformer.compile(input)
	output = this.transformer.execute(ins, vars)
	this.assertEquals('testmacro.undefined', output, verify, 'output', 'verify')

	this.next()
}

// Basic HTML transformation
var HtmlTransformer = function() {
	Transformer.call(this)
	this.addMacro('script', function(context) {
		var params = context.params
		return "<script src='%s' type='%s'></script>".format(params.src, params.type || 'text/javascript')
	})

	this.addMacro('form', function(context) {
		var params = context.params
		return "<form mathod='POST' action='%s'>".format(params.action)
	})

	this.addMacro('formend', function(context) {
		var params = context.params
		return "</form>".format(params.action)
	})

	this.addMacro('input', function(context) {
		var params = context.params
		return "<input name='%s' value='%s' type='%s'>".format(params.name, params.value||'', params.type || 'text')
	})

}
Util.inherits(HtmlTransformer, Transformer)

Tests.prototype.testhtml =function() {
	var data = ''+FS.readFileSync(__dirname + '/data/template1.html')
	var verify = ''+FS.readFileSync(__dirname + '/data/template1_verify.html')
	var transformer = new HtmlTransformer
	var instructions = transformer.compile(data)

	var vars = {title: "Template Test", defaults: {age: 40}}
	var processed = transformer.execute(instructions, vars)
	this.assertEquals('testhtml', processed, verify, 'processed', 'verify')
	this.next()
}

// Compiled code persistance
Tests.prototype.testpersistance =function() {
	var data = ''+FS.readFileSync(__dirname + '/data/template1.html')
	var verify = ''+FS.readFileSync(__dirname + '/data/template1_verify.html')

	// Use one instance of transformer to compile
	var transformer1 = new HtmlTransformer
	var instructions = transformer1.compile(data)
	// Save the compiled file
	FS.writeFileSync('/tmp/template1.xfrm', JSON.stringify(instructions))

	// Load back the compiled file
	var loadback = JSON.parse(''+FS.readFileSync('/tmp/template1.xfrm'))
	// Use another instance of tranformer for execution
	var transformer2 = new HtmlTransformer
	// Execute the compiled code
	var vars = {title: "Template Test", defaults: {age: 40}}
	var output = transformer2.execute(loadback, vars)
	this.assertEquals('testpersistance', output, verify, 'output', 'verify')
	this.next()
}

Tests.prototype.testblocks =function() {
	var input = 'Start here {loop count=3}This is repeated {$$transformer.loop_counter} times with var1 = {$var1}\n{/loop}'
	var verify = 'Start here This is repeated 0 times with var1 = VAR1\n' + 
		'This is repeated 1 times with var1 = VAR1\n' + 
		'This is repeated 2 times with var1 = VAR1\n';

	var vars= {var1 : 'VAR1',
			   var2 : 'VAR2'}
	var transformer = new Transformer
	transformer.addBlockMacro('loop', function(context, i) {
		if (i < parseInt(context.params.count))
			return true
	})
	var ins = transformer.compile(input)
	//transformer.dumpInstruction(ins)
	var output = transformer.execute(ins, vars)
	this.assertEquals('testblock.basic', output, verify, 'output', 'verify')
	this.next()
}

/* ----------- Filter test cases -----------*/
Tests.prototype.testfilter = function() {
	// builting filter
	var input = 'The name is {$name|upper}'
	var verify = 'The name is JAMES BOND'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {name: 'james Bond'})
	this.assertEquals('testspecial.filter', output, verify, 'output', 'verify')
	
	// userdefined
	var myfilter = function(a) { return a.length }
	this.transformer.addFilter('upper', myfilter)
	output = this.transformer.execute(code, {name: 'james Bond'})
	var verify = 'The name is 10'
	this.assertEquals('testspecial.filter2', output, verify, 'output', 'verify')

	this.next()
}

/* ----------- BlockContext test cases -----------*/
Tests.prototype.testbc = function() {
	var bc1 = new Transformer.BlockContext('BC1')
	var bc2 = new Transformer.BlockContext('BC2', bc1)
	var bc2a = new Transformer.BlockContext('BC2', bc1)
	var bc3 = new Transformer.BlockContext('BC3')
	var bc4 = new Transformer.BlockContext('BC4')
	bc1.addChild(bc3)
	bc2.addChild(bc4)
	var bc2b = new Transformer.BlockContext('BC2', bc1)
	var bcx  = new Transformer.BlockContext('BCX', bc3)
	var bc3a = new Transformer.BlockContext('BC3', bcx)
	var bc3b = new Transformer.BlockContext('BC3', bc3a)
	var bcx2 = new Transformer.BlockContext('BCX', bc3b)
	var bc3c = new Transformer.BlockContext('BC3', bcx2)
	
	this.assertEquals('testbc.name', bc1.name, 'BC1', 'bc1.name')
	this.assertEquals('testbc.name', bc2.name, 'BC2', 'bc2.name')
	this.assertEquals('testbc.name', bc3.name, 'BC3', 'bc3.name')
	this.assertEquals('testbc.name', bc4.name, 'BC4', 'bc4.name')

	this.assertEquals('testbc.children', bc1.children.length, 4, 'bc1.children.length')
	this.assertEquals('testbc.children', bc2.children.length, 1, 'bc2.children.length')
	this.assertEquals('testbc.children', bc3.children.length, 1, 'bc3.children.length')
	this.assertEquals('testbc.children', bc4.children.length, 0, 'bc4.children.length')

	this.assertEquals('testbc.child', bc1.child(0), bc2, 'bc1.child(0)', 'bc2')
	this.assertEquals('testbc.child', bc1.child(1), bc2a, 'bc1.child(1)', 'bc2a')
	this.assertEquals('testbc.child', bc1.child(2), bc3, 'bc1.child(2)', 'bc3')
	this.assertEquals('testbc.child', bc1.child(3), bc2b, 'bc1.child(3)', 'bc2b')
	this.assertEquals('testbc.child', bc1.child(4), null, 'bc1.child(2)', '[null]')
	this.assertEquals('testbc.child', bc2.child(0), bc4, 'bc2.child(0)', 'bc4')

	this.assertEquals('testbc.child', bc1.child(0, 'BC3'), bc3, "bc1.child(0, 'BC3')", 'bc3')
	this.assertEquals('testbc.child', bc1.child(0, 'BC2'), bc2, "bc1.child(0, 'BC2')", 'bc2')

	this.assertEquals('testbc.parent', bc3c.parent(), bcx2, "bc3c.parent()", 'bcx2')
	this.assertEquals('testbc.parent', bc3c.parent('BC3'), bc3b, "bc3c.parent('BC3')", 'bc3b')
	this.assertEquals('testbc.parent', bc3c.parent(3), bc3a, "bc3c.parent(3)", 'bc3a')
	this.assertEquals('testbc.parent', bc3c.parent(3, 'BC3'), bc3, "bc3c.parent(3, 'BC3')", 'bc3')
	this.assertEquals('testbc.parent', bc3c.parent(1, 'BCX'), bcx2, "bc3c.parent(1, 'BCX')", 'bcx2')
	this.assertEquals('testbc.parent', bc3c.parent(2, 'BCX'), bcx , "bc3c.parent(2, 'BCX')", 'bcx')

	this.next()
}

/* ----------- Inbuild special blocks -----------*/
Tests.prototype.testspecial = function() {
	// {set key1=value1}
	var input = 'Testing set {set key1=value1} and use it here {$key1} like this, and reset it {set key1=VALUE2} and reuse it like {$key1} this'
	var verify = 'Testing set  and use it here value1 like this, and reset it  and reuse it like VALUE2 this'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code)
	this.assertEquals('testspecial.set', output, verify, 'output', 'verify')

	// simple if
	input = 'Prefix {if var1 < var2}Well {=var1} is less than {=var2}{/if}{if var1 == var2}Well {=var1} is equal to {=var2}{/if}{if var1 > var2}Well {=var1} is greater than {=var2}{/if} Suffix'
	verify1 = 'Prefix Well 3 is greater than 1 Suffix'
	verify2 = 'Prefix Well 3 is less than 5 Suffix'
	verify3 = 'Prefix Well 3 is equal to 3 Suffix'
	
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {var1: 3, var2: 1})
	this.assertEquals('testspecial.if1', output, verify1, 'output', 'verify1')
	output = this.transformer.execute(code, {var1: 3, var2: 5})
	this.assertEquals('testspecial.if2', output, verify2, 'output', 'verify2')
	output = this.transformer.execute(code, {var1: 3, var2: 3})
	this.assertEquals('testspecial.if3', output, verify3, 'output', 'verify3')

	// simple if/else
	input = 'Prefix {if var1 < var2}LESS{else}GREATER{/if} Suffix'
	verify1 = 'Prefix LESS Suffix'
	verify2 = 'Prefix GREATER Suffix'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {var1: 3, var2: 1})
	this.assertEquals('testspecial.ifelse1', output, verify2, 'output', 'verify2')

	output = this.transformer.execute(code, {var1: 1, var2: 3})
	this.assertEquals('testspecial.ifelse1', output, verify1, 'output', 'verify1')


	// Nested if
	input = 'Prefix {if var1 < var2}{=var1} is less than {=var2} {if var1 < 2*var2}and {=var1} is less than {=2*var2} {if var1 < 3*var2}and {=var1} is less than {=3*var2}{/if} Suffix'
	verify = 'Prefix 1 is less than 10 and 1 is less than 20 and 1 is less than 30 Suffix'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {var1: 1, var2: 10})
	this.assertEquals('testspecial.nested_if1', output, verify, 'output', 'verify')

	// simple while
	input = 'Prefix {while $transformer.loop_counter<2}This time var1 = {$$transformer.loop_counter}.{/while} Suffix'
	verify = 'Prefix This time var1 = 0.This time var1 = 1. Suffix'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code)
	this.assertEquals('testspecial.while', output, verify, 'output', 'verify')

	// while with sets
	input = 'Prefix {while var1<6}This time var1 = {$var1}.{set x=y var1=`var1+4`}{/while} Suffix'
	verify = 'Prefix This time var1 = 1.This time var1 = 5. Suffix'
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {var1: 1})
	this.assertEquals('testspecial.while2', output, verify, 'output', 'verify')

	// simple foreach
	input = 'This is the order: {foreach from=orders item=order key=index}{$index} ITEM: {$order.name} PRICE: {$order.price}\n{/foreach} thats all'
	verify = 'This is the order: 0 ITEM: iPad PRICE: 20\n1 ITEM: iPhone PRICE: 10\n thats all'
	verify2 = 'This is the order:  thats all'
	var orders = [{name: 'iPad', price: 20}, {name: 'iPhone', price:10}]
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {orders: orders})
	this.assertEquals('testspecial.foreach1', output, verify, 'output', 'verify')
	// foreach with empty data
	output = this.transformer.execute(code, {orders: []})
	this.assertEquals('testspecial.foreach2', output, verify2, 'output', 'verify2')
	// foreach with undefined var
	output = this.transformer.execute(code, {})
	this.assertEquals('testspecial.foreach3', output, verify2, 'output', 'verify2')

	// foreachelse
	input = 'This is the order: {foreach from=orders item=order key=index}{$index} ITEM: {$order.name} PRICE: {$order.price}\n{foreachelse}No data found{/foreach} thats all'
	verify = 'This is the order: 0 ITEM: iPad PRICE: 20\n1 ITEM: iPhone PRICE: 10\n thats all'
	verify2 = 'This is the order: No data found thats all'
	orders = [{name: 'iPad', price: 20}, {name: 'iPhone', price:10}]
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {orders: orders})
	this.assertEquals('testspecial.foreachelse', output, verify, 'output', 'verify')
	// foreachelse with empty data
	output = this.transformer.execute(code, {orders: []})
	this.assertEquals('testspecial.foreachelse2', output, verify2, 'output', 'verify2')
	// foreachelse with undefined var
	output = this.transformer.execute(code, {})
	this.assertEquals('testspecial.foreachelse3', output, verify2, 'output', 'verify2')

	// ldelim and rdelim
	input = "This is a left brace {ldelim} and this is right brace {rdelim} too"
	verify = "This is a left brace { and this is right brace } too" 
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {orders: orders})
	this.assertEquals('testspecial.delims1', output, verify, 'output', 'verify')

	// escaping macro
	input = "This is to escape delims {ldelim}ldelim{rdelim} and {ldelim}rdelim{rdelim}"
	verify = "This is to escape delims {ldelim} and {rdelim}"
	code = this.transformer.compile(input)
	output = this.transformer.execute(code, {orders: orders})
	this.assertEquals('testspecial.delims2', output, verify, 'output', 'verify')

	// Todo: include

	// Todo: Literals
	//input = "This is a literal {xliteral}{ldelim}{/xxxxliteral} xyz"
	//code = this.transformer.compile(input)
	//output = this.transformer.execute(code, {orders: orders})
	//this.assertEquals('testspecial.literal', output, verify, 'output', 'verify')

	// TODO FILTERS

	// Todo Assign = set

	// Todo: section

	// Todo: strip

	// Todo: cycle

	// {debug} ??

	// Todo {eval} - dynamic nested templates

	// {fetch file=''}

	// {textformat wrap=40}

	this.next()
}

// Capture
Tests.prototype.testspecial2 = function() {
	var input = "This tests capturing {capture name=somevar1}Hello there {$name} {set var1=0 var2=1} {while $transformer.loop_counter < 5}Next number is {$$transformer.loop_counter} xxx {/while} and some other stuff{/capture} Xyz"
	var verify = 'This tests capturing  Xyz'	
	var verify2 = 'Hello there Optimus  Next number is 0 xxx Next number is 1 xxx Next number is 2 xxx Next number is 3 xxx Next number is 4 xxx  and some other stuff'
	var vars = {name: 'Optimus'}
	var code = this.transformer.compile(input)
	var output = this.transformer.execute(code, vars)
	this.assertEquals('testspecial2.capture1', output, verify, 'output', 'verify')
	this.assertEquals('testspecial2.capture1var', vars.somevar1, verify2, 'vars.somevar1', 'verify2')
	this.next()
}

// HTML extensions
Tests.prototype.test_extensions = function() {
	var MyExtension = function() {
	}
	MyExtension.prototype.macro_thing = function(context) {
		return "I am thing " + context.params.name
	}
	var transformer1 = new Transformer
	var transformer2 = new Transformer
	var transformer3 = new Transformer
	var extension1 = new MyExtension
	var extension2 = new MyExtension
	extension2.namespace = 'dog'
	transformer1.addExtension(extension1)
	transformer2.addExtension(extension1, 'cat')
	transformer3.addExtension(extension2)

	var input = "Test extension {thing name=1} {cat:thing name=2} {dog:thing name=3}"
	var verify1 = "Test extension I am thing 1 {cat:thing name=2} {dog:thing name=3}"
	var verify2 = "Test extension {thing name=1} I am thing 2 {dog:thing name=3}"
	var verify3 = "Test extension {thing name=1} {cat:thing name=2} I am thing 3"
	var output1 = transformer1.execute(transformer1.compile(input))
	var output2 = transformer2.execute(transformer2.compile(input))
	var output3 = transformer3.execute(transformer3.compile(input))

	this.assertEquals('test_extensions.basic', output1, verify1, 'output1', 'verify11')
	this.assertEquals('test_extensions.namespace1', output2, verify2, 'output2', 'verify12')
	this.assertEquals('test_extensions.namespace2', output3, verify3, 'output3', 'verify13')

	this.next()
}

Tests.prototype.test_html_extensions = function() {
//	var extension = require('../libs/html_extension')
	var transformer = new Transformer
	transformer.enableExtension('html')
	var input = "Testing form {html:form} abcd {/html:form}"
	var verify = "Testing form <form method=POST action=''> abcd </form>"
	var code = transformer.compile(input)
	var output = transformer.execute(code)
	this.assertEquals("testextensions.htmlform", output, verify, 'output', 'verify')

	transformer = new Transformer
	transformer.enableExtension('html', '')
	input = "Testing form {form} abcd {input name=username} {input name=passwd type=password} {/form}"
	verify = "Testing form <form method=POST action=''> abcd <div class='field'><label for='username'>Username</label> <input name='username'></input></div> <div class='field'><label for='passwd'>Passwd</label> <input name='passwd' type='password'></input></div> </form>"
	code = transformer.compile(input)
	output = transformer.execute(code)
	this.assertEquals("testextensions.htmlform2", output, verify, 'output', 'verify')

	this.next()
}

/* Test namespaces */
Tests.prototype.test_namespace1 = function() {
	var self = this
	this.nstransformer = new Transformer
	var MyExtension1 = function() {
	}
	MyExtension1.prototype.extend({
		macro_thing: function(context) {
			return "I am thing " + context.params.name
		},
		filter_some: function(a) {
			return 'xyz '+a
		},
		block_myblock: function(context, i) {
			if (i>0) {
				context.append('>>')
				return false
			}
			context.prepend('<<')
			return true
		}
	})

	var MyExtension2 = function() {
	}
	MyExtension2.prototype.extend({
		macro_thing: function(context) {
			return "I am another thing " + context.params.name
		},
		filter_some: function(a) {
			return a + ' abc'
		},
		block_myblock: function(context, i) {
			if (i>0) {
				context.append(']]')
				return false
			}
			context.prepend('[[')
			return true
		}

	})

	this.nstransformer.addExtension(new MyExtension1, 'ext1')
	this.nstransformer.addExtension(new MyExtension2, 'ext2')
	var transformer = this.nstransformer
	var input = "Testing namespaces {ext1:thing name=hello} and another {ext2:thing name=hello}, Var1 {=myfield|ext1:some} Var2 {=myfield|ext2:some}, Block {ext1:myblock}some text{/ext1:myblock} and {ext2:myblock}some text{/ext2:myblock}"
	var verify = "Testing namespaces I am thing hello and another I am another thing hello, Var1 xyz VARIABLE Var2 VARIABLE abc, Block <<some text>> and [[some text]]"
	transformer.applyTemplate(input, {myfield: 'VARIABLE'}, null, function(output) {
		self.assertEquals('namespace1.1', output, verify, 'output', 'verify')
		self.next()
	})
}

Tests.prototype.test_namespace2 = function() {
	var self = this
	var transformer = this.nstransformer
	var input = "Testing namespaces {thing name=hello} and another {ext2:thing name=hello}, Var1 {=myfield|some} Var2 {=myfield|ext2:some}, Block {myblock}some text{/myblock} and {ext2:myblock}some text{/ext2:myblock}"
	var verify = "Testing namespaces I am thing hello and another I am another thing hello, Var1 xyz VARIABLE Var2 VARIABLE abc, Block <<some text>> and [[some text]]"
	transformer.applyTemplate(input, {myfield: 'VARIABLE'}, null, function(output) {
		self.assertEquals('namespace2.2', output, verify, 'output', 'verify')
		self.next()
	}, 'ext1')
}

Tests.prototype.test_namespace3 = function() {
	var self = this
	var transformer = this.nstransformer
	var input = "Testing namespaces {ext1:thing name=hello} and another {thing name=hello}, Var1 {=myfield|ext1:some} Var2 {=myfield|some}, Block {ext1:myblock}some text{/ext1:myblock} and {myblock}some text{/myblock}"
	var verify = "Testing namespaces I am thing hello and another I am another thing hello, Var1 xyz VARIABLE Var2 VARIABLE abc, Block <<some text>> and [[some text]]"
	transformer.applyTemplate(input, {myfield: 'VARIABLE'}, null, function(output) {
		self.assertEquals('namespace3.2', output, verify, 'output', 'verify')
		self.next()
	}, 'ext2')
}


/* -----------bootstrapping the testcases --------*/
process.argv.shift()
process.argv.shift()
//Transformer.debug.enable('info')
var tests = new Tests()
//tests.showPass = true
tests.start(process.argv)

if (!tests.finished)
	sleepUntil(tests, 'finish')

