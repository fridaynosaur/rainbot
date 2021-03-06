/* jslint node: true */
/* global BOT_DIR, LIBS_DIR, MODULES_DIR */
'use strict';

//set main entry point path
global.BOT_DIR = require('path').resolve(__dirname, '..');
global.LIBS_DIR = require('path').resolve(BOT_DIR, 'libs');
global.MODULES_DIR = require('path').resolve(BOT_DIR, 'modules');

var vows = require('vows'),
	assert = require('assert');

var suite = vows.describe('Bot class');

var BOT = require(LIBS_DIR + '/bot').Bot;
var FS = require('fs');

//disable logger
require(LIBS_DIR + '/logger').enabled = false;

//isError assert
assert.isError = function(val) {
	assert.isObject(val);
	assert.instanceOf(val, Error);
};

suite.addBatch({
	'When i require bot': {
		topic: function() {
			return new BOT();
		},
		'then i get Bot instance': function(bot) {
			assert.isObject(bot);
			assert.instanceOf(bot, BOT);
		},
		'and \'BOT_DIR\' has app.js': function() {
			assert.isTrue(FS.existsSync(BOT_DIR + '/app.js'));
		}
	},
	'When i load config with': {
		'not existing config': {
			topic: function() {
				var bot = new BOT();
				bot.loadConfig('not-exist-config.json', this.callback);
				bot.config.bot.autosave = false; //disable autosaving
			},
			'then i get error': function(err, config) {
				assert.isError(err);
			},
			'and empty config': function(err, config) {
				assert.lengthOf(config, 1); //the bot part is default so 1
			}
		},
		'default config': {
			topic: function() {
				var bot = new BOT();
				bot.loadConfig('example-config.json', this.callback);
				bot.config.bot.autosave = false; //disable autosaving
			},
			'then i get config object': function(err, config) {
				assert.isNull(err);
				assert.isObject(config);
			},
			'with bot name': function(error, config) {
				assert.isObject(config.bot);
				assert.isString(config.bot.name);
			},
			'and module file': function(error, config) {
				assert.isObject(config.bot);
				assert.isString(config.bot.modules);
			}
		},
		'manual custom object': {
			topic: function() {
				var bot = new BOT();
				bot.loadConfig({
					'test': 'ok'
				}, this.callback);
				bot.config.bot.autosave = false; //disable autosaving
			},
			'then il get custom config': function(err, config) {
				assert.isObject(config);
				assert.equal(config.test, 'ok');
			},
			'with bot name': function(error, config) {
				assert.isObject(config.bot);
				assert.isString(config.bot.name);
			},
			'and module file': function(error, config) {
				assert.isObject(config.bot);
				assert.isString(config.bot.modules);
			}
		},
		'manual custom object with twist': {
			topic: function() {
				var bot = new BOT();
				bot.loadConfig({
					'bot': {
						'name': 'Dash',
						'modules': 'dashing.json'
					}
				}, this.callback);
				bot.config.bot.autosave = false; //disable autosaving
			},
			'with custom bot name \'Dash\'': function(error, config) {
				assert.isObject(config.bot);
				assert.equal(config.bot.name, 'Dash');
			},
			'and custom module file \'dashing.json\'': function(error, config) {
				assert.isObject(config.bot);
				assert.equal(config.bot.modules, 'dashing.json');
			}
		}
	}
});


suite.export(module);