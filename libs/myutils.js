var Util = require('util')

Object.prototype.each = function(callback, context) {
	for (var i in this) {
		if (typeof(this.constructor.prototype[i]) === 'undefined')
			context = callback(i, this[i], context)
	}	
	return context
}

// Lame - get a better one
Object.prototype.extend = function(more) {
	var self = this
	more.each(function(k, v) {
		self[k] = v
	})
}

Object.prototype.clone = function() {
  var newObj = (this instanceof Array) ? [] : {};
  for (i in this) {
    if (i == 'clone') continue;
    if (this[i] && typeof this[i] == "object") {
      newObj[i] = this[i].clone();
    } else newObj[i] = this[i]
  } return newObj;
}

String.prototype.toCapCase = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.format = function(etc) {
	var format = this
    var arg = arguments;
    var i = 0;
    return format.replace(/%((%)|s)/g, function (m) { return m[2] || arg[i++] })
}

String.prototype.dup = function(n) {
	n = n || 0
	var result = ''
	for (var i=0; i<n; i++) {
		result = result + this
	}
	return result
}

root.ReSplit = function(str, regex) {
	var prev_offset=0, last=str
	var result = []
	str.replace(regex, function() {
		// Extract variable args for the callback
		var index=0;
		var current = arguments[index++]
		var nmatches = arguments.length - 3
		var matches = []
		while (nmatches-->0) {
			matches.push(arguments[index++])
		}
		var offset = arguments[index++]
		var fullstr = arguments[index++]

		//console.log([current, matches, offset, remaining])

		var prefix = fullstr.substring(prev_offset,offset)
		var match = {full: current, fields: matches}
		prev_offset = offset+current.length
		last = fullstr.substring(prev_offset)
		result.push({prefix:prefix, match: match})
	})
	if (last) {
		result.push({prefix:last})
	}
	return result
}

root.sprintf = function(format, etc) {
    var arg = arguments;
    var i = 1;
    return format.replace(/%((%)|s)/g, function (m) { return m[2] || arg[i++] })
}


root.sleepUntil = function(emitter, event) {
	var tid = setTimeout(function(){}, 10000000)
	try {
		emitter.on(event, function() {
			clearTimeout(tid)
		})
	} catch(e) {
	}
}

root.MakeController = function(filename, mod) {
	var MyController = function() {
		Controller.call(this, filename, mod)
	}
	Util.inherits(MyController, Controller)
	return MyController
}

root.Util = Util
module.exports = Util