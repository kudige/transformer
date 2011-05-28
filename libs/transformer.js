var VM = require('vm'),
Util = require('./myutils'),
FS = require('fs'),
Path = require('path'),
Debug = require('./debug')

var Transformer = function() {
	this.filters = {}
	this.macros = {}
	this.blockMacros = {}
	this.specialBlocks = {}
	this.ignoreUnknownMacros = false
	this.includePaths = {}

	// Auto detect builtins
	this.autodetect()

	// Special flags
	this.blockMacros['else'].autoclose = true
	this.blockMacros['foreachelse'].autoclose = true
}

Transformer.prototype.enableExtension = function(ext, namespace) {
	var extension = require('./%s_extension'.format(ext))
	this.addExtension(extension, namespace)
}

Transformer.prototype.addExtension = function(extension, namespace) {
	if (namespace === undefined)
		namespace = extension.namespace
	if (namespace === undefined)
		namespace = ''
	this.autodetect(extension, namespace)
}

Transformer.prototype.autodetect = function(handler, namespace) {
	handler = handler || this
	for (var fnname in handler.constructor.prototype) {
		if (fnname.match(/(macro|block|special|filter)_([A-Za-z0-9]+)/)) {
			var type = RegExp.$1, name = RegExp.$2.toLowerCase()
			var options = {}
			if (namespace)
				name = namespace+':'+name
			if (typeof(handler['postcompile_'+name]) == 'function') {
				options.onClose = handler['postcompile_'+name].bind(handler)
			}
			if (type === 'macro') {
				this.addMacro(name, handler[fnname].bind(handler))
 			} else if (RegExp.$1 === 'block') {
				this.addBlockMacro(name, options, handler[fnname].bind(handler))
			} else if (RegExp.$1 === 'special') {
				options.freeform = true
				this.addBlockMacro(name, options, handler[fnname].bind(handler))
			} else if (RegExp.$1 === 'filter') {
				this.addFilter(name, handler[fnname].bind(handler))
			}
		}
	}
}

/* Builtin filters */
Transformer.prototype.filter_upper = function(a) {
	return a.toString().toUpperCase()
}

Transformer.prototype.filter_lower =  function(a) {
	return a.toString().toLowerCase()
}

Transformer.prototype.filter_caps =  function(a) {
	return a.toString().toCapCase()
}

Transformer.prototype.filter_date = function(a) {
        return (new Date(parseInt(a))).toDateString()
}

Transformer.prototype.filter_encode = function(a) {
        return encodeURIComponent(a)
}

Transformer.prototype.macro_ldelim = function() {
	return '{'
}

Transformer.prototype.macro_rdelim = function() {
	return '}'
}

/* Builtin macros */
Transformer.prototype.macro_set = function(context) {
	var vars = context.viewvars
	context.params.each(function(key) {
		var value = context.params[key]
		vars[key] = value
	})
	return ''
}

Transformer.prototype.macro_include = function(context) {
	var self = this
	var options = context.options || {}
	var name = context.params.name
	var namespace = options.namespace || 'default'

	if (name.match(/^(.*?):(.*)/)) {
		name = RegExp.$2
		namespace = RegExp.$1
	}

	var paths = options.include_path || this.includePaths[namespace] || ['.']
	var found = null
	paths.each(function(i, path) {
		var fullpath = Path.resolve(path, name + '.html')
		try {
			var data = FS.readFileSync(fullpath)
			if (data) {
				var vars = context.viewvars
				var $tsaved = vars.$transformer
				vars.$transformer = null
				found = self.process(''+data, vars, options)
				vars.$transformer = $tsaved
			}
		} catch(e) {
		}
	})
	if (found === null) {
		found = "%s not found".format(context.params.name)
	}
	return found
}

Transformer.prototype.special_while = function(context, i) {
	return !(!VM.runInNewContext(context.params, context.viewvars))
}

Transformer.prototype.block_repeat = function(context, i) {
	if (i < parseInt(context.params.count))
		return true
}

Transformer.prototype.block_capture = function(context, i) {
	if (!i) {
		return true
	}
	context.viewvars[context.params.name] = context.block_content
	context.block_content = ''
}


Transformer.prototype.special_if = function(context, i) {
	if (i === 0) {
		context.conditonal = !(!VM.runInNewContext(context.params, context.viewvars))
		return true
	} else {
		return false
	}
}

Transformer.prototype.postcompile_if = function(ifcode) {
	var self = this
	// Post compile callback
	var iftrue = self.makeBlockInstruction('iftrue')
	var ifelse = null
	ifcode.children.each(function(i, child) {
		if (child.op === 'block' && child.param.macro === 'else') {
			ifelse= child
		} else {
			self.pushOperation(iftrue, child)
		}
	})
	ifcode.children = []
	self.pushOperation(ifcode, iftrue)
	if (ifelse)
		self.pushOperation(ifcode, ifelse)

	return ifcode.parent
}

Transformer.prototype.block_iftrue = function(context, i) {
	if (i > 0)
		return false
	
	var ifcontext = context.parent('if')
	return ifcontext.conditonal
}

Transformer.prototype.special_else = function(context, i) {
	if (context.params.match(/[^\s]+/)) {
		Transformer.debug.error("{else} does not expect params")
		return false
	}
	if (i > 0)
		return false

	var ifcontext = context.parent('if')
	return !ifcontext.conditonal
}

Transformer.prototype.block_foreach = function(context, i) {
	if (i == 0) {
		// Setup the loop vars
		//context.params = params
		context.from = context.viewvars[context.params.from]
		var kvlist = []
		try {
			context.viewvars[context.params.from].each(function(k,v, kvlist1) {
				kvlist.push({key: k, value: v})
			}, kvlist)
		} catch(e) {
			context.error = e.message
		}
		context.kvlist = kvlist
		return true
	}
	return false
}

Transformer.prototype.postcompile_foreach = function(code) {
	// Post compile callback
	var self = this
	var febody = self.makeBlockInstruction('foreachbody')
	var feelse = null
	code.children.each(function(i, child) {
		if (child.op === 'block' && child.param.macro === 'foreachelse') {
			feelse= child
		} else {
			self.pushOperation(febody, child)
		}
	})
	code.children = []
	self.pushOperation(code, febody)
	if (feelse)
		self.pushOperation(code, feelse)

	return code.parent
}

Transformer.prototype.block_foreachbody = function(context, i) {
	var context = context.parent('foreach')
	if (context.error)
		return false
	var params = context.params
	if (i < context.kvlist.length) {
		context.viewvars[params.item] = context.kvlist[i].value
		if (params.key)
			context.viewvars[params.key] = context.kvlist[i].key
		return true
	}
	return false
}

Transformer.prototype.block_foreachelse = function(context, i) {
	if (i > 0)
		return false
	var context = context.parent('foreach')
	return !(!(context.error)) || !context.kvlist.length
}

Transformer.debug = new Debug('DummyTemplate')

// API: Add a filter
Transformer.prototype.addFilter = function(name, filter) {
	this.filters[name] = filter
}

// API: Add a regular macro
Transformer.prototype.addMacro = function(name, callback) {
	this.macros[name] = callback
}

// API: Add a block macro
Transformer.prototype.addBlockMacro = function(name, options, callback, postcompile_callback) {
	if (typeof(callback) === 'undefined' && typeof(options) === 'function') {
		callback = options
		options = {}
	}
	options.callback = callback
	if (postcompile_callback)
		options.onClose = postcompile_callback
	this.blockMacros[name] = options
}

// Is inline variable
Transformer.prototype.isInlineVar = function(str) {
	if (str.match(/^`(.+?)`$/)) {
		return {op: 'var', param: {name: RegExp.$1, filter: null}}
	}
}

// Detect and compile a variable element
Transformer.prototype.tryCompileVar = function(str, defaultNamespace) {
	defaultNamespace = defaultNamespace  || ''
	if (str.match(/^[=\$]([^|]+)(?:\|([a-zA-Z_0-9:]+))?$/)) {
		var name = RegExp.$1
		var filter = RegExp.$2
		if (filter) {
			var deffilter = '%s:%s'.format(defaultNamespace, filter)
			if (this.filters[deffilter])
				filter = deffilter
		}
		return {op: 'var', param: {name: name, filter: filter || null}}
	}
}

// Detect and process a block close element
Transformer.prototype.tryCompileClose = function(str) {
	if (str.match(/^\/([:a-zA-Z_0-9]+)$/)) {
		return {op: 'close', param: RegExp.$1}
	}
}

// Detect and process a macro or block element
Transformer.prototype.tryCompileMacro = function(macro, defaultNamespace) {
	var self = this
	defaultNamespace = defaultNamespace || ''
	if (macro.match(/^([:a-zA-Z_0-9]+)\s*(.*)/)) {
		var macro  = RegExp.$1
		var params = RegExp.$2
		var defmacro = '%s:%s'.format(defaultNamespace, macro)
		if (this.specialBlocks[defmacro] ||
			this.macros[defmacro] ||
			this.blockMacros[defmacro]) {
			macro = defmacro
		}

		// Handle builtin special macros
		if (this.specialBlocks[macro]) {
			return {op: macro, param: params, children: []}
		}

		if (!this.macros[macro] && !this.blockMacros[macro]) {
			Transformer.debug.warn('* Macro not found: ' + macro)
			return null
		}

		var param = {macro: macro, params:{}}

		if (this.blockMacros[macro] && this.blockMacros[macro].freeform) {
			// Free form macro, notmuch to do
			param.params = params
			param.freeform = true
		} else {
			// Parse macro arguments
			while (params.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(?:([$:.\[\]\(\)a-zA-Z0-9_]+)|\'([^\'\}]*)\'|(\`[^\`\}]*\`)|\"([^\"\}]*)\")\s*(.*)/)) { 
				var param_name = RegExp.$1
				params = RegExp.$6
				var value = RegExp.$2 || RegExp.$3 || RegExp.$4 || RegExp.$5
				param.params[param_name] = value
			}
			if (params) {
				return null
			}
		}
		if (this.blockMacros[macro])
			return result = {op:'block', param: param, children: []}

		return result = {op:'macro', param: param}

    }
}

Transformer.prototype.invokeMacro = function(macro, params, vars, options) {
	Transformer.debug.api('invokeMacro: ' + macro)
	var macro_fn = this.macros[macro]
	if (!macro_fn) {
		Transformer.debug.warn('invokeMacro: '+ "%s not found".format(macro) )
		return ''
	}
	var context = {params: params, viewvars: vars, options:options}
	return macro_fn(context)
}

// Evaluate params in a sandbox and replace all variable occurances with actual values
Transformer.prototype.evalParams = function(orgparams, vars) {
	var self = this
	var params = {}

	orgparams.each(function(v) {
		var varinstr = self.isInlineVar(orgparams[v])
		if (varinstr)
			params[v] = self.executeInstruction(varinstr, vars)
		else
			params[v] = orgparams[v]
	})
	return params
}

// Handle a literal element
Transformer.prototype.op_literal = function(param) {
	return param
}

// Handle an unknown element according to ignoreUnknownMacros flag
Transformer.prototype.op_unknown = function(param) {
	if (!this.ignoreUnknownMacros)
		return param
	return ''
}

// Handle a var element
Transformer.prototype.op_var = function(param, vars) {
	var varname = param.name
	var filter = param.filter
	var fn = (varname && this.filters[filter]) || function(a){return a}
	try {
		// Uncomment next line if you want to return unmatched {} unchanged
		//return fn(eval('vars.' + varname) || varname)
		var result = fn(VM.runInNewContext(varname, vars))
		if (typeof(result) === 'undefined')
			result = ''
		return result
	} catch(e) {
		return ''
	}
}


// Handle a macro element
Transformer.prototype.op_macro = function(param, vars, children, options) {
	var self = this
	var macro = param.macro
	var params = this.evalParams(param.params, vars)
	return this.invokeMacro(macro, params, vars, options)
}

// Handle a block element
Transformer.prototype.op_block = function(param, vars, children, options) {
	var self = this
	var macro = param.macro
	Transformer.debug.info("op_block macro = %s options %s".format(macro, JSON.stringify(options)))
	var macro_fn = this.blockMacros[macro].callback
	if (!macro_fn) {
		Transformer.debug.warn("Block macro %s not found".format(macro))
		return ''
	}

	var loop_count=0
	var newContext = new BlockContext(macro)
	newContext.params = param.params
	newContext.viewvars = vars
	newContext.block_content = ''
	vars.$transformer.context.addChild(newContext)
	vars.$transformer.context  = newContext
	
	while (1) {
		vars.$transformer.loop_counter = loop_count
		var params = param.params
		if (!param.freeform)
			params = this.evalParams(param.params, vars)
		var result = macro_fn(newContext, loop_count)
		if (result !== true) {
			break
		}
		newContext.block_content = newContext.block_content + this.op_composite(param, vars, children, options)
		loop_count++
	}
	vars.$transformer.context = vars.$transformer.context.parent()
	return newContext.block_content
}

/*
 * Builtin blocks
 */
/*
Transformer.prototype.op_while = function(param, vars, children) {
	vars = vars || {}
	
	Transformer.debug.debug("while (%s)".format(param))

	var loop_count = 0
	var content = ''
	while (1) {
		vars.$transformer.loop_counter = loop_count
		vars.$transformer.block_content = content
		var conditional = VM.runInNewContext(param, vars)
		if (!conditional)
			break
		content = content + this.op_composite(param, vars, children)
		loop_count++
	}

	return content
}
*/

// Run a sequence of instructions and concat the results
Transformer.prototype.op_composite = function(param, vars, children, options) {
	var self = this
	var result = ''
	Transformer.debug.info('op_composite # children %s options %s'.format(children.length), JSON.stringify(options))
	for (var i=0; i<children.length; i++) {
		var instr = children[i]
		result = result + self.executeInstruction(instr, vars, options)
	}
	return result
}

// Execute an instruction, including any subinstructions
Transformer.prototype.executeInstruction = function(instruction, vars, options) {
	Transformer.debug.info('executeInstruction op %s options %s'.format(instruction.op, JSON.stringify(options)))
	if (this['op_' + instruction.op]) {
		return this['op_' + instruction.op].call(this, instruction.param, vars, instruction.children, options)
	}

	Transformer.debug.error("Invalid instruction: " + instruction.op)
	console.log(instruction)
	return ''
}

// Execute a top level instruction set
Transformer.prototype.execute = function(code, vars, options) {
	vars = this.initVars(vars)
	
	return this.executeInstruction(code, vars, options)
}

Transformer.prototype.initVars = function(vars) {
	vars = vars || {}
	vars.$transformer = {capture: {}, context: new BlockContext('root')}
	return vars
}

// Add a sub-instruction to a parent instruction
Transformer.prototype.pushOperation = function(parent, operation) {
	operation.parent = parent
	parent.children.push(operation)
}

// Remove an backreferences in an instruction set
Transformer.prototype.cleanupInstruction = function(instruction, vars) {
	instruction.parent = null
	if (instruction.children)  {
		for (var i=0; i<instruction.children.length; i++) {
			this.cleanupInstruction(instruction.children[i])
		}
	}
	return instruction
}

Transformer.prototype.closeScope = function(ptr) {
	if (ptr.realParent) {
		var realParent = ptr.realParent
		while (ptr && ptr != realParent) {
			if (this.blockMacros[ptr.param.macro] && this.blockMacros[ptr.param.macro].onClose) {
				return this.blockMacros[ptr.param.macro].onClose(ptr)
			}
			ptr = ptr.parent
		}
	}
	if (this.blockMacros[ptr.param.macro] && this.blockMacros[ptr.param.macro].onClose) {
		return this.blockMacros[ptr.param.macro].onClose.call(this, ptr)
	}
	return ptr.parent
}

Transformer.prototype.findParent = function(ptr, operation, defaultNamespace) {
	var macro = operation.param
	var defmacro = '%s:%s'.format(defaultNamespace, operation.param)
	while (ptr) {
		while (ptr && ptr.op !== 'block') {
			ptr = ptr.parent
		}
		if (ptr) {
			if (ptr.param.macro === macro ||
				ptr.param.macro === defmacro)
				return ptr
			if (!this.blockMacros[ptr.param.macro].autoclose) 
				break
			ptr = ptr.parent
		}
	}
}

Transformer.prototype.makeInstruction = function(op, param) {
	if (param === undefined)
		param = {}
	return {op: op, param: param}
}

Transformer.prototype.makeBlockInstruction = function(macro, params) {
	params = params || {}
	var instr = this.makeInstruction('block', {macro: macro, params: params})
	instr.children = []
	return instr
}

Transformer.prototype.include = function(paths, namespace) {
	var self = this
	namespace = namespace || 'default'
	if (!Array.isArray(paths))
		paths = [paths]
	if (this.includePaths[namespace] === undefined) {
		this.includePaths[namespace] = paths
	} else {
		paths.each(function(i, path) {
			self.includePaths[namespace].push(path)
		})
	}
}

// Compile a template into set of instructions
Transformer.prototype.compile = function(data, defaultNamespace) {
	var self=this
	var re = /{([^\}\n]+)}/g 
	var segments = root.ReSplit(data, re)
	var instructions_root = this.makeInstruction('composite', [])
	instructions_root.children = []
	var ptr = instructions_root;
	for (var i=0; i<segments.length; i++) {
		var operation = this.makeInstruction('literal', segments[i].prefix)
		this.pushOperation(ptr, operation)
		if (segments[i].match) {
			operation = null
			var field = segments[i].match.fields[0]
			operation = this.tryCompileVar(field, defaultNamespace)
			if (!operation)
				operation = this.tryCompileMacro(field, defaultNamespace)
			if (!operation) {
				operation = this.tryCompileClose(field)
				if (operation) {
					var info = this.findParent(ptr, operation, defaultNamespace)
					if (!info) {
						Transformer.debug.error("Unexpected close tag %s" 
												.format(operation.param))
						operation = this.makeInstruction('unknown',segments[i].match.full)
					} else {
						if (info !== ptr) {
							ptr.realParent = info
						}
					}
				}
			}
			if (!operation)
				operation = this.makeInstruction('unknown', segments[i].match.full)
			if (operation.op !== 'close') {
				this.pushOperation(ptr, operation)
				if (operation.children) {
					ptr = operation
				}
			} else {
				ptr = this.closeScope(ptr)
			}
		}
	}
	return this.cleanupInstruction(instructions_root)
}

Transformer.prototype.process = function(tpldata, vars, options) {
	options = options || {}
	return this.execute(this.compile(tpldata, options.defaultNamespace),vars, options)
}

// Dump instructions in human readable format
Transformer.prototype.dumpInstruction = function(instr, offset) {
	offset = offset || 0
	console.log('  '.dup(offset) + instr.op + ' ' + Util.inspect(instr.param))
	if (instr.children) {
		for (var i=0; i < instr.children.length; i++) {
			this.dumpInstruction(instr.children[i], offset+1)
		}
	}
}

Transformer.prototype.applyTemplate = function(data, vars, directives, callback, options) {
	var self = this
	options = options || {}
	var defaultNamespace = options.namespace
	vars = vars || {}
	data = ''+data
	Transformer.debug.api('applyTemplate')
	var code = this.compile(data, defaultNamespace)
	//this.dumpInstruction(code)
	setTimeout(function() {
		data = self.execute(code, vars, options)
		callback(data)
	}, 100)
}


var BlockContext = function(name, parent) {
	this.name = name
	this.children = []
	this._parent = parent
	if (parent)
		parent.addChild(this)
}

BlockContext.prototype = {
	addChild: function(childContext) {
		this.children.push(childContext)
		childContext._parent = this
		return childContext
	},

	parent: function(level, name) {
		if (typeof(name) === 'undefined' && typeof(level) === 'undefined')
			return this._parent
		if (typeof(level) === typeof('') && typeof(name) === 'undefined') {
			name = level
			level = 1
		}
			
		level = level || 0
		var prnt = this._parent
		var foundLevel = 0
		while (prnt) {
			if (!name || prnt.name === name) {
				foundLevel++
				if (foundLevel === level) {
					Transformer.debug.debug('BlockContext.parent(%s, %s) found'.format(name, level))
					return prnt
				}
			}
			prnt = prnt._parent
		}
		Transformer.debug.warn('BlockContext.parent(%s, %s) not found'.format(name, level))
		return null
	},

	child: function(index, name) {
		index = index || 0
		var foundIndex = 0
		for (var i=0; i<this.children.length; i++) {
			var child = this.children[i]
			if (!name || child.name === name) {
				if (foundIndex === index)
					return child
				foundIndex++
			}
		}
		Transformer.debug.warn('BlockContext.child(%s, %s) not found'.format(name, index))
		return null
	},

	prepend: function(data) {
		this.block_content = data + this.block_content
	},

	append: function(data) {
		this.block_content = this.block_content + data
	}

}


Transformer.BlockContext = BlockContext
//Transformer.debug.enable()

//Transformer.debug.enable()
module.exports = Transformer
