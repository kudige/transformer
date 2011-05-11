var Debug = function(facility) {
	this.levels = {error: true}
	this.facility = facility
}

Debug.prototype.writeln = function(level, message) {
	if (this.levels.all || this.levels[level]) {
		console.log(this.facility + ' ' + level.toUpperCase() + ' : ' + message)
	}
}

Debug.prototype.enable = function() {
	if (!arguments.length) 
		this.levels.all = true
	else {
		for (var a in arguments) {
			this.levels[arguments[a]] = true
		}
	}
}

Debug.prototype.disable = function() {
	if (!arguments.length) 
		this.levels = {}
	else {
		for (var a in arguments) {
			this.levels[arguments[a]] = false
		}
	}
}

/* ------- handy shortcuts --------- */
Debug.prototype.api = function(message) {
	return this.writeln('api', message)
}

Debug.prototype.debug = function(message) {
	return this.writeln('debug', message)
}

Debug.prototype.info = function(message) {
	return this.writeln('info', message)
}

Debug.prototype.error = function(message) {
	return this.writeln('error', message)
}

Debug.prototype.warn = function(message) {
	return this.writeln('warn', message)
}

Debug.prototype.event = function(message) {
	return this.writeln('event', message)
}

module.exports = Debug
