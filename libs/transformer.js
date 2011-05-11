var VM = require('vm'),
Util = require('./myutils'),
Debug = require('./debug')

var Transformer = function() {
	this.filters = {
		upper : function(a) {return a.toString().toUpperCase()},
		lower :  function(a) {return a.toString().toLowerCase()},
		dummy: function(a) { return 'DUMMY'}
	}
	this.macros = {
	}
	this.blockMacros = {
	}
	this.ignoreUnknownMacros = false
	this.specialBlocks = {}
	this.initBuiltins()
	this.autodetect()
}

Transformer.prototype.autodetect = function() {
	this.constructor.prototype.each(function(name, fn) {
		if (name.match(/(macro|block|special)([A-Z][A-Z0-9]*)/)) {
			console.log(''+name)
		}
	})
}

Transformer.prototype.initBuiltins = function() {
	var self = this
	this.addMacro('ldelim', function() {
		return '{'
	})
	this.addMacro('rdelim', function() {
		return '}'
	})
	this.addBlockMacro('if', {freeform: true}, function(params, i) {
		if (i === 0) {
			this.$transformer.context.conditonal = !(!VM.runInNewContext(params, this))
			return true
		} else {
			return false
		}
	}, function(ifcode) {
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
	})

	this.addBlockMacro('iftrue', function(params, i) {
		if (i > 0)
			return false

		var ifcontext = this.$transformer.context.parent('if')
		return ifcontext.conditonal
	})

	this.addBlockMacro('else', {freeform: true, autoclose : true}, function(params, i) {
		if (params.match(/[^\s]+/)) {
			Transformer.debug.error("{else} does not expect params")
			return false
		}

		if (i > 0)
			return false

		var ifcontext = this.$transformer.context.parent('if')
		return !ifcontext.conditonal
	})

	this.addBlockMacro('foreach', {required: {from:true, item:true}}, function(params, i) {
		if (i == 0) {
			// Setup the loop vars
			this.$transformer.context.params = params
			this.$transformer.context.from = this[params.from]
			var kvlist = []
			try {
				this[params.from].each(function(k,v, kvlist1) {
					kvlist.push({key: k, value: v})
				}, kvlist)
			} catch(e) {
				this.$transformer.context.error = e.message
			}
			this.$transformer.context.kvlist = kvlist
			return true
		}
		return false
	}, function(code) {
		// Post compile callback
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
	})

	this.addBlockMacro('foreachbody', {}, function(params, i) {
		var context = this.$transformer.context.parent('foreach')
		if (context.error)
			return false
		params = context.params
		if (i < context.kvlist.length) {
			this[params.item] = context.kvlist[i].value
			if (params.key)
				this[params.key] = context.kvlist[i].key
			return true
		}
		return false
	})

	this.addBlockMacro('foreachelse', {autoclose: true}, function(params, i) {
		if (i > 0)
			return false
		var context = this.$transformer.context.parent('foreach')
		return !(!(context.error)) || !context.kvlist.length
	})

	this.addBlockMacro('while', {freeform: true}, function(params, i) {
		return !(!VM.runInNewContext(params, this))
	})

	this.addBlockMacro('repeat', function(params, i) {
		if (i < parseInt(params.count))
			return true
	})

	this.addBlockMacro('capture', function(params, i) {
		if (!i) {
			return true
		}
		this[params.name] = this.$transformer.block_content
		this.$transformer.block_content = ''
	})

	this.addMacro('set', function(params) {
		var vars = this
		params.each(function(key) {
			var value = params[key]
			vars[key] = value
		})
		return ''
	})
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
Transformer.prototype.tryCompileVar = function(str) {
	if (str.match(/^[=\$]([^|]+)(?:\|([a-zA-Z_0-9]+))?$/)) {
		return {op: 'var', param: {name: RegExp.$1, filter: RegExp.$2 || null}}
	}
}

// Detect and process a block close element
Transformer.prototype.tryCompileClose = function(str) {
	if (str.match(/^\/([a-zA-Z_0-9]+)$/)) {
		return {op: 'close', param: RegExp.$1}
	}
}

// Detect and process a macro or block element
Transformer.prototype.tryCompileMacro = function(macro) {
	var self = this
	if (macro.match(/^([a-zA-Z_0-9]+)\s*(.*)/)) {
		var macro  = RegExp.$1
		var params = RegExp.$2

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
			while (params.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(?:([$.\[\]\(\)a-zA-Z0-9_]+)|\'([^\'\}]*)\'|(\`[^\`\}]*\`)|\"([^\"\}]*)\")\s*(.*)/)) { 
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

Transformer.prototype.invokeMacro = function(macro, params, vars) {
	Transformer.debug.api('invokeMacro: ' + macro)
	var macro_fn = this.macros[macro]
	if (!macro_fn) {
		Transformer.debug.warn('invokeMacro: '+ "%s not found".format(macro) )
		return ''
	}
	return macro_fn.call(vars, params)
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
Transformer.prototype.op_macro = function(param, vars, children) {
	var self = this
	var macro = param.macro
	var params = this.evalParams(param.params, vars)
	return this.invokeMacro(macro, params, vars)
}

// Handle a block element
Transformer.prototype.op_block = function(param, vars, children) {
	var self = this
	var macro = param.macro
	Transformer.debug.info("op_block macro = %s".format(macro))
	var macro_fn = this.blockMacros[macro].callback
	if (!macro_fn) {
		Transformer.debug.warn("Block macro %s not found".format(macro))
		return ''
	}

	var loop_count=0
	vars.$transformer.block_content = ''
	var newContext = new BlockContext(macro)
	vars.$transformer.context.addChild(newContext)
	vars.$transformer.context  = newContext
	
	while (1) {
		vars.$transformer.loop_counter = loop_count
		var params = param.params
		if (!param.freeform)
			params = this.evalParams(param.params, vars)
		var result = macro_fn.call(vars, params, loop_count)
		if (result !== true) {
			break
		}
		vars.$transformer.block_content = vars.$transformer.block_content + this.op_composite(param, vars, children)
		loop_count++
	}
	vars.$transformer.context = vars.$transformer.context.parent()
	return vars.$transformer.block_content
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
Transformer.prototype.op_composite = function(param, vars, children) {
	var self = this
	var result = ''
	for (var i=0; i<children.length; i++) {
		var instr = children[i]
		result = result + self.executeInstruction(instr, vars)
	}
	return result
}

// Execute an instruction, including any subinstructions
Transformer.prototype.executeInstruction = function(instruction, vars) {
	if (this['op_' + instruction.op]) {

		return this['op_' + instruction.op](instruction.param, vars, instruction.children)
	}

	Transformer.debug.error("Invalid instruction: " + instruction.op)
	console.log(instruction)
	return ''
}

// Execute a top level instruction set
Transformer.prototype.execute = function(code, vars) {
	vars = this.initVars(vars)
	
	return this.executeInstruction(code, vars)
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
		return this.blockMacros[ptr.param.macro].onClose(ptr)
	}
	return ptr.parent
}

Transformer.prototype.findParent = function(ptr, operation) {
	while (ptr) {
		while (ptr && ptr.op !== 'block') {
			ptr = ptr.parent
		}
		if (ptr) {
			if (ptr.param.macro === operation.param)
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

// Compile a template into set of instructions
Transformer.prototype.compile = function(data) {
	var self=this
	var re = /{([^\}]+)}/g 
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
			operation = this.tryCompileVar(field)
			if (!operation)
				operation = this.tryCompileMacro(field)
			if (!operation) {
				operation = this.tryCompileClose(field)
				if (operation) {
					var info = this.findParent(ptr, operation)
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

Transformer.prototype.applyTemplate = function(data, vars, directives, callback) {
	var self = this
	vars = vars || {}
	data = ''+data
	Transformer.debug.api('applyTemplate')
	var code = this.compile(data)
	setTimeout(function() {
		data = self.execute(code, vars)
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
					Transformer.debug.debug('BlockContext.parent(%s, %d) found'.format(name, level))
					return prnt
				}
			}
			prnt = prnt._parent
		}
		Transformer.debug.warn('BlockContext.parent(%s, %d) not found'.format(name, level))
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
		Transformer.debug.warn('BlockContext.child(%s, %d) not found'.format(name, index))
		return null
	}
}


Transformer.BlockContext = BlockContext


//Transformer.debug.enable()
module.exports = Transformer
