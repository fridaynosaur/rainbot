/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

//check main entry point path
if (!global.BOT_DIR) throw new Error('Wrong entry point! No \'BOT_DIR\' defined!');
if (!global.LIBS_DIR) throw new Error('Wrong entry point! No \'LIBS_DIR\' defined!');
if (!global.MODULES_DIR) throw new Error('Wrong entry point! No \'MODULES_DIR\' defined!');

var MODULE = require(LIBS_DIR + '/module').Module;
var logger = require(LIBS_DIR + '/logger');

function ModuleManager(dispatcher, config) {
	this._modules = {};
	if (typeof dispatcher === 'object') {
		this.dispatcher = dispatcher;
	} else {
		throw new Error('No dispatcher given!');
	}
	if (typeof config === 'object') {
		this.config = config;
	} else {
		throw new Error('No config given!');
	}

	this._protected_modules = {};
}

ModuleManager.prototype.getModules = function() {
	return Object.keys(this._modules); //return loaded module names
};

ModuleManager.prototype.exists = ModuleManager.prototype.has = ModuleManager.prototype.contains = function(name) {
	if (name instanceof MODULE) {
		name = name.name;
	} else if (typeof name !== 'string' || name === '') {
		return false;
	}
	return this._modules[name] !== undefined;
};

ModuleManager.prototype.get = ModuleManager.prototype.find = function(name) {
	if (name instanceof MODULE) {
		return name;
	} else if (typeof name !== 'string' || name === '') {
		return null;
	}
	if (this._modules[name] !== undefined) {
		return this._modules[name];
	}
	return null;
};

ModuleManager.prototype.load = ModuleManager.prototype.enable = function(name, callback) {
	var error = null;
	var module = null;
	if (typeof name !== 'string' || name === '') {
		error = new Error('Please enter a name!');
	} else if (this.exists(name)) {
		error = new Error('Module \'' + name + '\' is already loaded!');
	} else {
		if (typeof this[name] !== 'undefined') {
			error = new Error('Reserved module name \'' + name + '\'! Please rename your module!');
		} else {
			try {
				module = new MODULE(name);
			} catch (e) {
				error = new Error('Error happened during module \'' + name + '\' construction: ' + e.message);
				module = null;
			}
			if (module instanceof MODULE) {
				if (typeof module.injectModuleManager === 'function') module.injectModuleManager(this);
				if (typeof module.injectConfig === 'function') module.injectConfig(this.config);
				if (typeof module.injectDispatcher === 'function') module.injectDispatcher(this.dispatcher);

				try {
					if (typeof module.init === 'function') module.init();
				} catch (e) {
					error = new Error('Error happened during module \'' + name + '\' initialization: ' + e.message);
					module = null;
				}

				if (!error) {
					this._modules[name] = module;

					//add as property for quick access
					Object.defineProperty(this, name, {
						configurable: true,
						enumerable: false,
						writable: false,
						value: module
					});

					//emit this joyfull event for others
					this.dispatcher.emit('load', name, this, module);
				}
			} else {
				error = new Error('Cannot load \'' + name + '\' module!');
				module = null;
			}
		}
	}

	logger.debug('Load of \'' + name + '\' module' + (error ? ' failed' : ' is success') + '.');

	if (callback) callback(error, name, this);
	else if (error) throw error;
	return this;
};

ModuleManager.prototype.unload = ModuleManager.prototype.disable = function(name, callback) {
	var error = null;
	if (name instanceof MODULE) {
		name = name.name;
	}
	if (typeof name !== 'string' || name === '') {
		error = new Error('Please enter a name!');
	} else {
		if (typeof this._protected_modules[name] !== 'undefined' && this._protected_modules[name] === true) {
			error = new Error('Module \'' + name + '\' is protected!');
		} else if (this.exists(name)) {
			var module = this.get(name);

			//disable event binding on halt with uncatched exception so users gets kicked in face
			if (typeof module.dispatcher === 'object') {
				module.dispatcher.on = module.dispatcher.once = module.dispatcher.addListener = function() {
					throw new Error('You cannot bind events on module \'' + name + '\' halt!');
				};
			}

			try {
				if (typeof module.halt === 'function') module.halt();
			} catch (e) {
				//ignore all exceptions in halt
				//just note it
				logger.warn('Got error in module \'' + name + '\' halt: ' + e);
			}

			//puff it
			delete this._modules[name];
			if (this[name] === module) delete this[name];

			//emit this tragic event for others
			this.dispatcher.emit('unload', name, this, module);
		} else {
			error = new Error('Module \'' + name + '\' is not loaded!');
		}
	}

	logger.debug('Unload of \'' + name + '\' module' + (error ? ' failed' : ' is success') + '.');

	if (callback) callback(error, name, this);
	else if (error) throw error;
	return this;
};

//reload module context
ModuleManager.prototype.reload = function(name, callback) {
	var mm = this;
	var error = null;

	var module = this.find(name);

	if (module) {
		try {
			if (typeof module.reload === 'function') {
				module.reload(function(err) {
					if (err) throw err;
					mm.dispatcher.emit('reload-load', name, mm, module);
				}, function(err) {
					if (err) throw err;
					mm.dispatcher.emit('reload-unload', name, mm, module);
				}); //reload with new config
			}
		} catch (e) {
			error = new Error('Error happened during module \'' + name + '\' reload: ' + e.message);
		}
	} else {
		error = new Error('Module \'' + name + '\' is not loaded!');
	}

	if (!error) {
		//emit this somewhat sympatic event for others
		this.dispatcher.emit('reload', name, this, module);
	}

	logger.debug('Reload of \'' + name + '\' module' + (error ? ' failed' : ' is success') + '.');

	if (callback) callback(error, name, this);
	else if (error) throw error;

	return this;
};

ModuleManager.prototype.require = function(name) {
	if (typeof name !== 'string' || name === '') {
		throw new Error('Please enter a name!');
	} else if (!this.exists(name)) {
		this.load(name);
	}

	return this.get(name);
};

ModuleManager.prototype.protect = function(name, prot) {
	if (typeof name !== 'string' || name === '') {
		throw new Error('Please enter a name!');
	}

	if (typeof prot === 'undefined') { //emtpy == true
		prot = true;
	}

	this._protected_modules[name] = prot ? true : false;

	return this;
};

module.exports.ModuleManager = ModuleManager;
module.exports.create = function(dispatcher) {
	return new ModuleManager(dispatcher);
};