/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

//set main entry point path
global.BOT_DIR = require('path').resolve(__dirname, '..');
global.LIBS_DIR = require('path').resolve(BOT_DIR, 'libs');
global.MODULES_DIR = require('path').resolve(BOT_DIR, 'modules');

var logger = require(LIBS_DIR + '/logger');
var helpers = require(LIBS_DIR + '/helpers');

process.setMaxListeners(0); //fix the possible memory leak warning, by unlimiting listeners

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

	//set to true if halting the bot
	this.halting = false;

	//bind to exit event of main process
	var bot = this;
	process.on('exit', function() {
		if (!bot.halting) bot.emit('halt', bot);
		bot.unloadModules();
	});

	//shutdown on ctrl+c gracefully
	process.on('SIGINT', function() {
		bot.halting = true;
		logger.info(':SIGINT Received, Exiting ...');
		bot.emit('halt', bot);
		setTimeout(process.exit, 1000);
	});

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

Bot.prototype.loadConfig = function loadConfig(config, callback) {
	var bot = this;

	var error = null;
	if (typeof config === 'function' && typeof callback === 'undefined') {
		callback = config;
		config = undefined;
	}

	if (bot._configWatch) { //stop watching config
		bot._configWatch.close();
		bot._configWatch = null;
	}

	if (typeof config === 'string') {
		try {
			require.cache[BOT_DIR + '/' + config] = null;
			bot.config.extend(require(BOT_DIR + '/' + config));
			bot._configWatch = require('fs').watch(BOT_DIR + '/' + config, {
				persistent: false
			}, function(event, filename) {
				if (event === 'change') {
					bot.loadConfig(filename);
				}
			});
		} catch (e) {
			logger.error('Cannot load config!');
			error = new Error('Cannot load config!');
		}
	} else if (config instanceof Object) {
		bot.config.extend(config);
	} else {
		try {
			require.cache[BOT_DIR + '/config.json'] = null;
			bot.config.extend(require(BOT_DIR + '/config.json'));
			bot._configWatch = require('fs').watch(BOT_DIR + '/config.json', {
				persistent: false
			}, function(event, filename) {
				if (event === 'change') {
					bot.loadConfig(filename);
				}
			});
		} catch (e) {
			logger.error('Cannot load config!');
			error = new Error('Cannot load config!');
		}
	}

	//make sure we have important values
	if (typeof bot.config.bot === 'undefined') {
		bot.config.bot = {
			'name': 'IRC-PONY',
			'modules': 'modules.json'
		};
	} else {
		if (typeof bot.config.bot.name === 'undefined') {
			bot.config.bot.name = 'IRC-PONY';
		}
		if (typeof bot.config.bot.modules === 'undefined') {
			bot.config.bot.modules = 'modules.json';
		}
	}

	if (callback) callback(error, bot.config);
	else if (error) throw error;

	logger.info('Config loaded!');

	if (logger) {
		logger.debugging = bot.config.bot.debug ? true : false;
	}

	return bot;
};

Bot.prototype.loadModules = function loadModules(modules, callback) {
	var bot = this;

	if (typeof modules === 'function' && typeof callback === 'undefined') {
		callback = modules;
		modules = {};
	}

	if (typeof bot.config.bot === 'undefined') { //we need atleast empty bot config
		bot.config.bot = {
			'modules': 'modules.json'
		};
	}

	var error = null;
	if (typeof modules === 'string') {
		bot.config.bot.modules = modules;
		modules = {};
	} else if (typeof modules === 'object' && modules instanceof Array) {
		var tmp = modules.slice(0);
		modules = {};
		for (var i = 0; i < tmp.length; i++) {
			modules[tmp[i]] = true;
		}

	} else if (typeof modules !== 'object' && typeof bot.config.bot.modules === 'string') {
		modules = {};
	} else if (typeof modules !== 'object') {
		logger.error('Modules was nor Object nor Array nor String! Trying to load default \'modules.json\'.');
		error = new Error('Modules was nor Object nor Array nor String! Trying to load default \'modules.json\'.');

		modules = {};
	}

	//first load core modules
	bot._core_modules.forEach(function(name) {
		bot.modules.load(name);
	});

	//then custom modules
	if (Object.keys(modules).length <= 0) {
		try {
			modules = require(BOT_DIR + '/' + bot.config.bot.modules);
		} catch (e) {
			modules = {};
			logger.error('Cannot load modules file \'' + bot.config.bot.modules + '\'!');
			error = new Error('Cannot load modules file \'' + bot.config.bot.modules + '\'!');
		}
	}

	var keys = Object.keys(modules);
	if (keys.length > 0) {
		keys.forEach(function(name) {
			if (modules[name] === true) {
				bot.modules.load(name);
			}
		});
	}

	if (callback) callback(error, bot.modules);
	else if (error) throw error;

	logger.info('Modules loaded!');
	return bot;
};

Bot.prototype.unloadModules = function() {
	var bot = this;
	//unprotect core modules
	bot._core_modules.forEach(function(name) {
		bot.modules.protect(name, false);
	});
	//unload all modules
	bot.modules.getModules().reverse().forEach(function(m) {
		try {
			bot.modules.unload(m);
		} catch (e) {
			//ignore all errors
			//just note them
			logger.warn('Caught error on module \'' + m + '\' unload: ' + e);
		}
	});
	logger.info('Modules unloaded!');
};

Bot.prototype.load = function load(names, callback) {
	var bot = this;

	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, module, mm) {
			callback(err, module, mm, bot);
		} : undefined;

	names.forEach(function(name) {
		bot.modules.load(name, recallback);
	});

	return bot;
};

Bot.prototype.unload = function unload(names, callback) {
	var bot = this;

	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, mm) {
			callback(err, mm, bot);
		} : undefined;

	names.forEach(function(name) {
		bot.modules.unload(name, recallback);
	});

	return bot;
};

Bot.prototype.reload = function reload(names, callback) {
	var bot = this;

	if (!(names instanceof Array)) {
		names = [names];
	}

	var recallback = callback ? function(err, mm) {
			callback(err, mm, bot);
		} : undefined;

	names.forEach(function(name) {
		bot.modules.reload(name, recallback);
	});

	return bot;
};

Bot.prototype.run = Bot.prototype.start = function run() {
	logger.info('Bot initialization starting...');
	this.emit('init', this);
	return this;
};

Bot.prototype.end = Bot.prototype.stop = function end() {
	this.halting = true;
	this.emit('halt', this);
	logger.info('Exiting ...');
	setTimeout(process.exit, 1000);
};

module.exports.Bot = Bot;
module.exports.create = function() {
	return new Bot();
};