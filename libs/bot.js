/**
 * Rainbot main file
 */

/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

//check main entry point path
if (!global.BOT_DIR) global.BOT_DIR = require('path').resolve(__dirname, '..');
if (!global.LIBS_DIR) global.LIBS_DIR = require('path').resolve(BOT_DIR, 'libs');
if (!global.MODULES_DIR) global.MODULES_DIR = require('path').resolve(BOT_DIR, 'modules');

var logger = require(LIBS_DIR + '/logger');
var helpers = require(LIBS_DIR + '/helpers');

function Bot() {
	//events
	var dispatcher = new(require('events').EventEmitter)();
	dispatcher.setMaxListeners(0); //remove listener limit
	//add empty config
	var config = new(require(LIBS_DIR + '/config').Config)();
	//add MM
	var moduleManager = new(require(LIBS_DIR + '/moduleManager').ModuleManager)(dispatcher, config);

	//load module on new listener
	dispatcher.on('newListener', function(event, listener) {
		var i, name;
		if (((i = event.indexOf('/')) + 1) && (name = event.substr(0, i))) {
			if (!moduleManager.exists(name)) {
				//better to not load modules automagically
				//moduleManager.load(name);
				logger.warn('Added new listener (' + event + ') for not loaded module!');
			}
		}
	});

	//bot config
	this.config = config;
	this._configWatch = null;
	this._configFile = '';
	//bot MM
	this.modules = moduleManager;
	//dispatcher
	this.dispatcher = dispatcher;

	//list of core modules
	this._core_modules = ['irc', 'controls'];

	//protect the core modules from unload
	this._core_modules.forEach(function(m) {
		moduleManager.protect(m, true);
	});

	//set to true if running
	this.__running = false;
	//set to true if halting the bot
	this.__halting = false;

	//bind to exit event of main process
	var bot = this;
	process.on('exit', function() {
		if (bot.__abort) return; //do nothing on abort
		if (!bot.__halting) {
			bot.__halting = true;
			bot.emit('halt', bot);
		}
		bot.unloadModules();
		if (bot.config.bot && bot.config.bot.autosave && bot._configFile) bot.saveConfig(bot._configFile);
	});

	//shutdown on ctrl+c gracefully
	process.on('SIGINT', this.end.bind(this));

	// This will override SIGTSTP and prevent the program from going to the background.
	process.on('SIGTSTP', function() {});
}

Bot.prototype.addListener = function() {
	this.dispatcher.addListener.apply(this.dispatcher, arguments);
	return this;
};

Bot.prototype.on = function() {
	this.dispatcher.on.apply(this.dispatcher, arguments);
	return this;
};

Bot.prototype.off = Bot.prototype.removeListener = function() {
	this.dispatcher.removeListener.apply(this.dispatcher, arguments);
	return this;
};

Bot.prototype.once = function() {
	this.dispatcher.once.apply(this.dispatcher, arguments);
	return this;
};

Bot.prototype.emit = function() {
	this.dispatcher.emit.apply(this.dispatcher, arguments);
	return this;
};

Bot.prototype._setConfigWatch = function(file) {
	var fs = require('fs');

	if (!fs.existsSync(BOT_DIR + '/' + file)) {
		return false;
	}

	var bot = this;
	this._configWatch = fs.watch(BOT_DIR + '/' + file, {
		persistent: false
	}, function(event) {
		if (event === 'change') {
			try {
				bot.loadConfig(file);
			} catch (e) {
				//none
			}
		}
	});

	return true;
};

Bot.prototype.loadConfig = function loadConfig(config, callback) {
	var error = null;

	if (typeof config === 'function' && typeof callback === 'undefined') {
		callback = config;
		config = undefined;
	}

	if (typeof config === 'string') {
		this._configFile = require('path').basename(config);
	} else if (config instanceof Object) {
		this._configFile = '';
	} else {
		this._configFile = 'config.json';
	}

	if (this._configWatch) { //stop watching config
		this._configWatch.close();
		this._configWatch = null;
	}

	try {
		if (this._configFile) {
			require.cache[BOT_DIR + '/' + this._configFile] = null;
			config = require(BOT_DIR + '/' + this._configFile);
			this._setConfigWatch(this._configFile);
		}

		this.config.clear(); //throw out old config
		this.config.load(config); //load new config
	} catch (e) {
		error = new Error('Cannot load config! ' + e);
	}

	//make sure we have important values
	if (typeof this.config.bot === 'undefined') {
		this.config.bot = {
			'name': 'Rainbot',
			'modules': 'modules.json',
			'debug': false,
			'autosave': true
		};
	} else {
		if (typeof this.config.bot.name !== 'string') {
			this.config.bot.name = 'Rainbot';
		}
		if (typeof this.config.bot.modules === 'undefined') {
			this.config.bot.modules = 'modules.json';
		}
		if (typeof this.config.bot.debug !== 'boolean') {
			this.config.bot.debug = false;
		}
		if (typeof this.config.bot.autosave !== 'boolean') {
			this.config.bot.autosave = true;
		}
	}

	if (callback) callback(error, this.config, this);

	if (error) {
		logger.error(error);
		logger.info('Empty config loaded!');
	} else {
		logger.info('Config loaded!');
	}

	if (logger) {
		logger.debugging = this.config.bot.debug ? true : false;
	}

	return this;
};

Bot.prototype.saveConfig = function(savefile) {
	var fs = require('fs');

	//get only basename
	savefile = require('path').basename(savefile);

	//blocking write
	try {
		fs.writeFileSync(BOT_DIR + '/' + savefile, JSON.stringify(this.config, null, 4));
		logger.info('Config saved to \'' + savefile + '\'.');
	} catch (err) {
		logger.error('Failed to save config with error: ' + err);
	}
};

Bot.prototype.loadModules = function loadModules(modules, callback) {
	var error = null;
	if (this.__running) {
		error = new Error('Bot is already running, please load the modules before issuing \'run\'!');
		if (callback) callback(error, null, this);
		logger.error(error);
		this.abort(error);
		return this;
	}

	if (typeof modules === 'function' && typeof callback === 'undefined') {
		callback = modules;
		modules = {};
	}

	if (typeof this.config.bot === 'undefined') { //we need atleast empty bot config
		this.config.bot = {
			'modules': 'modules.json'
		};
	}

	if (typeof modules === 'string') {
		this.config.bot.modules = modules;
		modules = {};
	} else if (typeof modules !== 'object' && typeof this.config.bot.modules === 'object') {
		modules = this.config.bot.modules;
	} else if (typeof modules !== 'object' && typeof this.config.bot.modules === 'string') {
		modules = {};
	} else if (typeof modules !== 'object') {
		modules = {};
		error = new Error('Modules was nor Object nor Array nor String! Trying to load default \'modules.json\'.');
	}

	if (modules instanceof Array) {
		var tmp = modules.slice(0);
		modules = {};
		for (var i = 0; i < tmp.length; i++) {
			modules[tmp[i]] = true;
		}
	}

	if (error) { //abort
		if (callback) callback(error, null, this);
		logger.error(error);
		this.abort(error);
		return this;
	}

	//load the file
	if (Object.keys(modules).length <= 0) {
		try {
			modules = require(BOT_DIR + '/' + this.config.bot.modules);
		} catch (e) {
			modules = {};
			error = new Error('Cannot load modules file \'' + this.config.bot.modules + '\'!');
		}
	}

	//start the load of core modules
	try {
		this._core_modules.forEach(function(name) {
			this.modules.load(name);
		}, this);
	} catch (e) {
		error = e;
	}

	if (error) { //imediate abort on failure
		if (callback) callback(error, null, this);
		logger.error(error);
		this.abort(error);
		return this;
	}

	//start the load of other modules
	var catchBack = function(err) {
		if (err) {
			logger.error(err);
			error = new Error('Failed loading some modules!');
		}
	};

	var keys = Object.keys(modules);
	if (keys.length > 0) {
		keys.forEach(function(name) {
			if (modules[name] === true) {
				this.modules.load(name, catchBack);
			}
		}, this);
	}

	if (callback) callback(error, this.modules, this);

	logger.info('Modules loaded!');

	if (error) logger.warn(error);

	return this;
};

Bot.prototype.unloadModules = function() {
	//unprotect core modules
	this._core_modules.forEach(function(name) {
		this.modules.protect(name, false);
	}, this);
	//unload all modules
	this.modules.getModules().reverse().forEach(function(m) {
		try {
			this.modules.unload(m);
		} catch (e) {
			//ignore all errors
			//just note them
			logger.warn('Caught error on module \'' + m + '\' unload: ' + e);
		}
	}, this);
	logger.info('Modules unloaded!');
	return this;
};

Bot.prototype.load = function load(names, callback) {
	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, module, mm) {
			callback(err, module, mm, this);
		}.bind(this) : undefined;

	names.forEach(function(name) {
		this.modules.load(name, recallback);
	}, this);

	return this;
};

Bot.prototype.unload = function unload(names, callback) {
	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, mm) {
			callback(err, mm, this);
		}.bind(this) : undefined;

	names.forEach(function(name) {
		this.modules.unload(name, recallback);
	}, this);

	return this;
};

Bot.prototype.reload = function reload(names, callback) {
	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, mm) {
			callback(err, mm, this);
		}.bind(this) : undefined;

	names.forEach(function(name) {
		this.modules.reload(name, recallback);
	}, this);

	return this;
};

Bot.prototype.run = Bot.prototype.start = function run() {
	if (this.__running) {
		return this;
	}

	logger.info('Bot initialization starting...');
	this.emit('init', this);

	this.__running = true;

	return this;
};

Bot.prototype.end = Bot.prototype.stop = function end() {
	if (!this.__halting) {
		this.__halting = true;
		this.emit('halt', this);
		logger.info('Exiting ...');
		setTimeout(process.exit, 1000); //delay it for a sec
	}

	return this;
};

Bot.prototype.abort = function(error) {
	this.__abort = true;
	process.exit(1);
	return this;
};

module.exports.Bot = Bot;
module.exports.create = function() {
	return new Bot();
};