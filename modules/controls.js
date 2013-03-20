var logger = require(LIBS_DIR + '/logger');

var Command = require('./controls/command').Command;
var Action = require('./controls/action').Action;

//trim some strings
if (!String.prototype.trim) {
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, '');
	};
}

function Controls(irc, actions, commands) {
	this._irc = irc;
	this.actions = actions;
	this.commands = commands;
	this.commandDelimiter = '.';
}

Controls.prototype.addCommand = function(name, action, access) {
	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');
	if (typeof this.commands[name] !== 'undefined') {
		throw new Error('Defined command \'' + name + '\' already exists!');
	}
	this.commands[name] = new Command(name, action, access);
	return this;
};

Controls.prototype.addAction = function(name, action, regexp, access) {
	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');
	if (typeof this.actions[name] !== 'undefined') {
		throw new Error('Defined action \'' + name + '\' already exists!');
	}
	this.actions[name] = new Action(name, action, regexp, access);
	return this;
};

Controls.prototype.removeCommand = function(name) {
	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');
	if (typeof this.commands[name] !== 'undefined') {
		delete this.commands[name];
	} else {
		throw new Error('Command \'' + name + '\' does not exists!');
	}
	return this;
};

Controls.prototype.removeAction = function(name) {
	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');
	if (typeof this.actions[name] !== 'undefined') {
		delete this.actions[name];
	} else {
		throw new Error('Action \'' + name + '\' does not exists!');
	}
	return this;
};

Controls.prototype.removeActions = function(list) {
	if (!(list instanceof Array)) {
		throw new Error('You need to pass Array as first argument!');
	}
	list.forEach(function(name) {
		this.removeAction(name);
	}, this);
	return this;
};

Controls.prototype.removeCommands = function(list) {
	if (!(list instanceof Array)) {
		throw new Error('You need to pass Array as first argument!');
	}
	list.forEach(function(name) {
		this.removeCommand(name);
	}, this);
	return this;
};

Controls.prototype.parse = function(source, text) {
	if (typeof text !== 'string' || text.length <= 0) return;

	if (!source.channel) { //itz direct message
		this.processAction(source, text.trim());
	} else if (source.channel && text.substr(0, this.commandDelimiter.length) === this.commandDelimiter) { //itz command in channel
		//remove the delimiter
		text = text.substr(this.commandDelimiter.length);

		this.processCommand(source, text.trim());
	} else if (text.substr(0, this._irc.currentNick.length + 1).search(new RegExp(this._irc.currentNick + '[ ,;:]')) !== -1) { //itz higlight in channel
		//remove the trigger
		text = text.substr(this._irc.currentNick.length + 1);

		this.processAction(source, text.trim());
	}
};

Controls.prototype.processCommand = function(source, text) {
	var args = text.match(/[^\s\"\']+|\"([^\"]*)\"|\'([^\']*)\'/g).map(function(v) {
		return v.replace(/\"|\'/g, '');
	});
	var command = args.shift();
	//execute the command
	Object.keys(this.commands).some(function(name) {
		if (command == this.commands[name].name) { //use == to not check type
			logger.debug('Processing Command \'' + name + '\'');
			this.commands[name].action(source, args, text);
			return true;
		}
		return false;
	}, this);
};

Controls.prototype.processAction = function(source, text) {
	//proces all actions that triggers rule
	Object.keys(this.actions).forEach(function(name) {
		var args = text.match(this.actions[name].rule);
		if (args !== null) {
			logger.debug('Processing Action \'' + name + '\'');
			this.actions[name].action(source, args, text);
		}
	}, this);
};

module.exports.init = function(reload) {
	if (!reload) {
		this.actions = {};
		this.commands = {};
	}

	this.controls = new Controls(this.require('irc'), this.actions, this.commands);

	if (typeof this.config.commandDelimiter === 'string') {
		this.controls.commandDelimiter = this.config.commandDelimiter;
	}

	var module = this;

	if (!reload) {
		Object.defineProperty(this, 'commandDelimiter', {
			enumerable: true,
			get: function() {
				return module.controls.commandDelimiter;
			}
		});
	}

	//export some functions from Controls
	require(LIBS_DIR + '/helpers').export(this, this.controls, ['addCommand', 'addAction', 'removeCommand', 'removeAction', 'removeCommands', 'removeActions']);

	//bind
	this.dispatcher.on('irc/PRIVMSG', this.controls.parse.bind(this.controls)).on('irc/NOTICE', this.controls.parse.bind(this.controls));
};