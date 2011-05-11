var Emitter = require('events').EventEmitter,
Assert = require('assert'),
Util = require('util')

var Jstest = function() {
	Emitter.call(this)
	this.passCount=0
	this.failCount=0
	this.setCount=0
	this.showPass=false
	this.finished=false
	this.testcases = []
}
Util.inherits(Jstest, Emitter)

Jstest.prototype.start = function(prefixes) {
	if (!prefixes.length)
		prefixes = ['test']
	this.init()
	for (var a in this) {
		for (var i=0; i< prefixes.length; i++) {
			var prefix = prefixes[i]
			if (a.indexOf(prefix) == 0 && typeof(this[a]) === 'function') {
				this.testcases.push(a)
				break
			}
		}
	}
	this.next()
}

Jstest.prototype.next = function() {
	var self = this
	if (this.testcases.length) {
		this.setCount++
		var a = this.testcases.shift()
		//console.log('  Testing ' + a)
		self[a]()
	} else {
		this.finish()
	}
}

Jstest.prototype.init = function() {
	this.emit('init', this)
}

Jstest.prototype.finish = function() {
	console.log("==============================================")
	console.log("       SETS: " + this.setCount)
	console.log("     PASSED: " + this.passCount)
	console.log("     FAILED: " + this.failCount)
	console.log("==============================================")
	this.finished = true
	this.emit('finish', this)
}

Jstest.prototype.assertFail = function(routine, msg) {
	this.failCount++
	console.log("!FAIL " + routine + " : " +
				msg)

	this.emit('fail', routine, msg)
}

Jstest.prototype.assertPass = function(routine, msg) {
	this.passCount++
	if (this.showPass) {
		console.log("=PASS " + routine + " : " +
					msg)
	}
	this.emit('pass', routine, msg)
}

Jstest.prototype.assertEquals = function(routine, a, b, label1, label2) {
	if (a !== b) {
		var message = (label1 || '') +  ' [' + a + '] != ' + (label2 || '') + ' [' + b + ']'
		this.assertFail(routine, message)
	} else {
		var message = (label1 || a) + ' == ' + (label2 || b)
		this.assertPass(routine, message)
	}
}

Jstest.prototype.assertEquals2 = function(routine, lhs, rhs) {
	return this.assertEquals(routine, eval(lhs), eval(rhs), lhs, rhs)
}

module.exports = Jstest
