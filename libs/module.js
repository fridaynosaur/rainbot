/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

//check main entry point path
if (!global.BOT_DIR) throw new Error('Wrong entry point! No \'BOT_DIR\' defined!');
if (!global.LIBS_DIR) throw new Error('Wrong entry point! No \'LIBS_DIR\' defined!');
if (!global.MODULES_DIR) throw new Error('Wrong entry point! No \'MODULES_DIR\' defined!');

var logger = require(LIBS_DIR + '/logger');

function Module(name) {
	if (typeof name !== 'string' || name === '') {
		throw new Error('You need to specifify module name!');
	}

	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');

	this.name = name;
	this.fileName = name + '.js';
	this.loaded = false;
	this.reloading = false;
	this.context = null;
	try {
		this.fullPath = this._resolvePath();
	} catch (e) {
		throw new Error('Module \'' + name + '\' does not exists in MODULE_DIR!');
	}
}

//internal file path resolving
Module.prototype._resolvePath = function() {
	return require.resolve(MODULES_DIR + '/' + this.fileName);
};

//called on load
Module.prototype.init = function init(callback) {
	var error = null;

	if (typeof this.dispatcher !== 'object') error = new Error('No dispatcher given!');
	if (typeof this.config !== 'object') error = new Error('No config given!');

	if (error) {
		if (callback) callback(error, this);
		else throw error;
	}

	try {
		this.context = require(this.fullPath);
		this.loaded = true;
	} catch (e) {
		error = new Error('Failed loading context of \'' + this.name + '\' module! ' + e.message);
	}

	if (this.loaded) {
		//init the context
		try {
			if (typeof this.context.init === 'function') this.context.init.call(this, false);
		} catch (e) {
			error = new Error('Failed initiating context of \'' + this.name + '\' module! ' + e.message);
		}
	}

	logger.debug('Init of \'' + this.name + '\' module' + (error ? ' failed' : ' is success') + '.');

	if (callback) callback(error, this);
	else if (error) throw error;

	return this;
};

//called on unload
Module.prototype.halt = function halt(callback) {
	try {
		if (this.loaded && typeof this.context.halt === 'function') this.context.halt.call(this, false);
	} catch (e) {
		logger.warn('Got error at halting context of \'' + this.name + '\' module! ' + e.message);
	}

	//remove from node require cache
	if (this.loaded) {
		var module = require.cache[this.fullPath];

		module.children.forEach(function(m) {
			delete require.cache[m.filename];
		});
		delete require.cache[this.fullPath];
	}

	//reset
	this.loaded = false;
	this.context = null;

	//and remove all listeners
	if (this.dispatcher && this.dispatcher.clearEvents) this.dispatcher.clearEvents();

	logger.debug('Halt of \'' + this.name + '\' module.');

	//callback
	if (callback) callback(null, this);

	return this;
};

Module.prototype.reload = function reload(callback, hollaback) {
	var error = null;
	if (this.loaded) {
		this.reloading = true;

		try {
			if (typeof this.context.halt === 'function') this.context.halt.call(this, true);
		} catch (e) {
			logger.warn('Got error at halting context of \'' + this.name + '\' module! ' + e.message);
		}

		var module = require.cache[this.fullPath];
		module.children.forEach(function(m) {
			delete require.cache[m.filename];
		});
		delete require.cache[this.fullPath];

		this.loaded = false;

		if (this.dispatcher && this.dispatcher.clearEvents) this.dispatcher.clearEvents();

		if (hollaback) hollaback(error, this);

		try {
			this.context = require(this.fullPath);
			this.loaded = true;
		} catch (e) {
			error = new Error('Failed loading context of \'' + this.name + '\' module! ' + e.message);
		}
		if (this.loaded) {
			try {
				if (typeof this.context.init === 'function') this.context.init.call(this, true);
			} catch (e) {
				error = new Error('Failed initiating context of \'' + this.name + '\' module! ' + e.message);
			}
		}

		this.reloading = false;
	} else {
		error = new Error('Context of module \'' + this.name + '\' is not loaded!');
	}

	if (callback) callback(error, this);
	else if (error) throw error;

	return this;
};

Module.prototype.injectConfig = function(config, callback) {
	Object.defineProperty(this, 'config', {
		configurable: false,
		enumerable: true,
		get: function() {
			if (typeof config[this.name] !== 'object') config[this.name] = {};
			return config[this.name];
		}
	});

	if (callback) callback(null, this);

	logger.debug('Module \'' + this.name + '\' Config inject.');

	return this;
};

Module.prototype.injectModuleManager = function(mm, callback) {
	this.require = mm.require.bind(mm);

	if (callback) callback(null, this);

	logger.debug('Module \'' + this.name + '\' MM inject.');

	return this;
};

Module.prototype.injectDispatcher = function(dispatchBase, callback) {
	var error = null;
	if (typeof dispatchBase !== 'object' || dispatchBase === null) {
		error = new Error('Wrong dispatcher type for \'' + this.name + '\' module injected!');
	} else {
		var events = [];
		var module = this;
		this.dispatcher = {
			on: function(event, listener) {
				events.push({
					event: event,
					listener: listener
				});
				dispatchBase.on(event, listener);
				return this;
			},
			once: function(event, listener) {
				events.push({
					event: event,
					listener: listener
				});
				dispatchBase.once(event, listener);
				return this;
			},
			addListener: function(event, listener) {
				events.push({
					event: event,
					listener: listener
				});
				dispatchBase.addListener(event, listener);
				return this;
			},
			off: function(event, listener) {
				events.some(function(obj, i) {
					if (obj.event == event && obj.listener == listener) {
						events.splice(i, 1);
						return true;
					}
					return false;
				});
				dispatchBase.removeListener(event, listener);
				return this;
			},
			removeListener: function(event, listener) {
				events.some(function(obj, i) {
					if (obj.event == event && obj.listener == listener) {
						events.splice(i, 1);
						return true;
					}
					return false;
				});
				dispatchBase.removeListener(event, listener);
				return this;
			},
			emit: function(event) {
				var args = [];
				//all emited events needs to be prefixed by module name
				if (!((new RegExp('^' + module.name + '/')).test(event))) {
					event = module.name + '/' + event;
					arguments[0] = event;
				}
				try {
					dispatchBase.emit.apply(dispatchBase, arguments);
				} catch (e) {
					dispatchBase.emit.call(dispatchBase, 'dispatchError', event, e, module);
				}
				return this;
			},
			clearEvents: function() {
				events.forEach(function(event) {
					dispatchBase.removeListener(event.event, event.listener);
				});
				events = [];
				return this;
			}
		};
	}

	logger.debug('Module \'' + this.name + '\' dispatcher inject.');

	if (callback) callback(error, this.dispatcher, this);
	else if (error) throw error;

	return this;
};

Module.prototype.valueOf = Module.prototype.toString = function() {
	return this.name;
};

module.exports.Module = Module;
module.exports.create = function(name) {
	return new Module(name);
};