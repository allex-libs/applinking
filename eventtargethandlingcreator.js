function createEventTargetHandler (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    AppLinkingRegistryBase = applinkinglib.AppLinkingRegistryBase;

  function EventTargetHandler (eventemitter, eventname) {
    this.emitter = eventemitter;
    this.name = eventname;
  }
  EventTargetHandler.prototype.destroy = function () {
    this.name = null;
    this.emitter = null;
  };
  EventTargetHandler.prototype.handle = function (val) {
    throw new lib.Error('NOT_IMPLEMENTED', 'handle is not implemented on EventTargetHandler base');
  };

  function AllexEventTargetHandler (eventemitter, eventname) {
    EventTargetHandler.call(this, eventemitter, eventname);
    this.emitter = this.emitter.set.bind(this.emitter, this.name);
  }
  lib.inherit(AllexEventTargetHandler, EventTargetHandler);
  AllexEventTargetHandler.prototype.handle = function (val) {
    this.emitter(val);
  };
  AllexEventTargetHandler.recognizer = function (emitterwithname) {
    if (emitterwithname &&
      emitterwithname.emitter &&
      emitterwithname.emitter[emitterwithname.name] &&
      emitterwithname.emitter[emitterwithname.name] instanceof lib.HookCollection) {
      return AllexEventTargetHandler;
    }
  };

  var ret = new AppLinkingRegistryBase();
  ret.EventTargetHandler = EventTargetHandler;
  ret.register(AllexEventTargetHandler.recognizer);

  return ret;
}

module.exports = createEventTargetHandler;
