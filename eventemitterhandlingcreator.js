function createEventEmitterHandling (execlib) {
  'use strict';

  var lib = execlib.lib;

  function EventEmitterHandler (eventemitter) {
    this.emitter = eventemitter;
  }
  EventEmitterHandler.prototype.destroy = function () {
    this.emitter = null;
  };

  function EventEmitterConsumer (eventemitter, eventname) {
    EventEmitterHandler.call(this, eventemitter);
  }
  lib.inherit(EventEmitterConsumer, EventEmitterHandler);

  return {
    EventEmitterConsumer: EventEmitterConsumer
  };
}

module.exports = createEventEmitterHandling;
