var Transformer = require('./transformer'),
    VM = require('vm'),
    Util = require('./myutils')

var HtmlExtension = function(namespace) {
	this.namespace = (namespace === undefined)?'html':'namespace'
}

function lastField(fullfield) {
	var fields = fullfield.split('.')
	return fields[fields.length-1]
}

HtmlExtension.prototype.block_form = function(context, i) {
	if (i == 0) {
		context.prepend("<form method=POST action=''>")
		return true
	}
	context.append('</form>')
	return false;
}

HtmlExtension.prototype.macro_input = function(context) {
	var node = new Node('input')
	try {
		if (!context.params.value && context.params.name) {
			var value = VM.runInNewContext(context.params.name, context.viewvars)
			if (value !== undefined)
				context.params.value = ''+value
		}
	} catch(e) {
	}
	if (!context.params.label && context.params.name)
		context.params.label = lastField(context.params.name).toCapCase()

	context.params.each(function(name,val) {
		if (name !== 'label')
			node.set(name, val)
	})
	if (context.params.type === 'hidden')
		context.params.label = null
	if (context.params.label) {
		var labelnode = new Node('label')
		labelnode.set('for', context.params.name)
		labelnode.value = context.params.label
		return "<div class='field'>" + labelnode.toString() + ' ' + node.toString() + "</div>"
	} 
	return "<div class='field'>" + node.toString() + "</div>"
}

HtmlExtension.prototype.macro_submit = function(context) {
	var node = new Node('input')
	node.set('type', 'submit')
	node.set('value', context.params.label || "Submit")
	return node.toString()
}

var Node = function(tag) {
	this._tag = tag
	this._args = {}
	this.value = ''
}

Node.prototype.set = function(name, val) {
	this._args[name] = val
}

Node.prototype.toString = function() {
	var args = ''
	this._args.each(function(name, val) {
		args = args+" %s='%s'".format(name, val)
	})
	
	return "<%s%s>%s</%s>".format(this._tag, args, this.value, this._tag)
}

module.exports = new HtmlExtension

