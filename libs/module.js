module.exports = function Module(name, dispatchBase) {
	'use strict';

	name = name.replace(/[^a-zA-Z0-9_\-]+/g, '');

	this.name = name;
	this.fileName = name + ".js";
	this.fullPath = require.resolve(BOT_PATH + "/modules/" + this.fileName);

	var events = [];
	this.dispatcher = {
		on: function(event, listener) {
			events.push({
				event: event,
				listener: listener
			});
			dispatchBase.on(event, listener);
		},
		once: function(event, listener) {
			events.push({
				event: event,
				listener: listener
			});
			dispatchBase.once(event, listener);
		},
		addListener: function(event, listener) {
			events.push({
				event: event,
				listener: listener
			});
			dispatchBase.addListener(event, listener);
		},
		off: function(event, listener) {
			events.some(function(obj, i) {
				if(obj.event == event && obj.listener == listener) {
					events.splice(i, 1);
					return true;
				}
				return false;
			});
			dispatchBase.removeListener(event, listener);
		},
		removeListener: function(event, listener) {
			events.some(function(obj, i) {
				if(obj.event == event && obj.listener == listener) {
					events.splice(i, 1);
					return true;
				}
				return false;
			});
			dispatchBase.removeListener(event, listener);
		},
		emit: function(event) {
			try {
				dispatchBase.emit.apply(dispatchBase, arguments);
			} catch(e) {
				dispatchBase.emit.call(dispatchBase, "dispatchError", event, e);
			}
		}
	};

	//called on load
	this.init = function init() {};

	//called on unload
	this.halt = function halt() {
		//remove from node require cache
		delete require.cache[this.fullPath];

		//and remove all listeners
		events.forEach(function(event) {
			dispatchBase.removeListener(event.event, event.listener);
		});
	};
};