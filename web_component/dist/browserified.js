(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
ALLEX.execSuite.libRegistry.register('allex_applinkinglib',require('./index')(ALLEX));
ALLEX.WEB_COMPONENTS.allex_applinkinglib = ALLEX.execSuite.libRegistry.get('allex_applinkinglib');

},{"./index":4}],2:[function(require,module,exports){
function createEventEmitterHandling (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    AppLinkingRegistryBase = applinkinglib.AppLinkingRegistryBase;


  function EventEmitterHandler (eventemitter, eventname) {
    this.emitter = eventemitter;
  }
  EventEmitterHandler.prototype.destroy = function () {
    this.emitter = null;
  };
  EventEmitterHandler.prototype.raiseEvent = function () {
    throw new lib.Error('NOT_IMPLEMENTED', 'raiseEvent is not implemented');
  };
  EventEmitterHandler.prototype.listenToEvent = function (cb) {
    throw new lib.Error('NOT_IMPLEMENTED', 'listenToEvent is not implemented');
  };

  function AllexEventEmitterHandler (eventemitter, eventname) {
    EventEmitterHandler.call(this, eventemitter, eventname);
    this.emitter = eventemitter[eventname];
    this.listener = null;
  }
  lib.inherit(AllexEventEmitterHandler, EventEmitterHandler);
  AllexEventEmitterHandler.prototype.destroy = function () {
    if (this.listener) {
      this.listener.destroy();
    }
    this.listener = null;
    EventEmitterHandler.prototype.destroy.call(this);
  };
  AllexEventEmitterHandler.prototype.raiseEvent = function () {
    if (this.emitter) {
      this.emitter.apply(this.emitter, Array.prototype.slice.call(arguments));
    }
  };
  AllexEventEmitterHandler.prototype.listenToEvent = function (cb) {
    if (!this.listener) {
      this.listener = this.emitter.attach(cb);
    }
    return this.listener;
  };
  AllexEventEmitterHandler.recognizer = function (emitterwithname) {
    if (emitterwithname && 
      emitterwithname.emitter && 
      emitterwithname.name && 
      emitterwithname.emitter[emitterwithname.name] instanceof lib.HookCollection) {
      return AllexEventEmitterHandler;
    }
  };

  function NodeEventEmitterHandler (eventemitter, eventname) {
    EventEmitterHandler.call(this, eventemitter, eventname);
    this.name = eventname;
    this.listener = null;
  }
  lib.inherit(NodeEventEmitterHandler, EventEmitterHandler);
  NodeEventEmitterHandler.prototype.destroy = function () {
    if (this.listener) {
      this.emitter.removeListener(this.name, this.listener);
    }
    this.listener = null;
    this.name = null;
    EventEmitterHandler.prototype.destroy.call(this);
  };
  NodeEventEmitterHandler.prototype.raiseEvent = function () {
    var args = [this.name].concat(Array.prototype.slice.call(arguments));
    this.emitter.emit.apply(this.emitter, args);
  };
  NodeEventEmitterHandler.prototype.listenToEvent = function (cb) {
    if (!this.listener) {
      this.listener = cb;
      this.emitter.on(this.name, cb);
      return this;
    }
  };
  NodeEventEmitterHandler.recognizer = function (emitterwithname) {
    if (emitterwithname &&
      emitterwithname.emitter &&
      lib.isFunction(emitterwithname.emitter.on) &&
      lib.isFunction(emitterwithname.emitter.emit) &&
      lib.isFunction(emitterwithname.emitter.removeListener)) {
      return NodeEventEmitterHandler;
    }
  };


  var ret = new AppLinkingRegistryBase();
  ret.EventEmitterHandler = EventEmitterHandler;
  ret.register(AllexEventEmitterHandler.recognizer);
  ret.register(NodeEventEmitterHandler.recognizer);

  return ret;
}

module.exports = createEventEmitterHandling;

},{}],3:[function(require,module,exports){
function createFilterHandler (execlib) {
  'use strict';

  var lib = execlib.lib;

  function FilterHandler (filter, cb) {
    this.filter = null;
    this.cb = cb;
    if (lib.isFunction(filter)) {
      this.filter = filter;
    }
  }
  FilterHandler.prototype.destroy = function () {
    this.cb = null;
    this.filter = null;
  };
  FilterHandler.prototype.processInput = function () {
    var intermediate;
    if (this.filter) {
      intermediate = this.filter.apply(null, arguments);
      if (intermediate && lib.isFunction(intermediate.then)) {
        intermediate.then(this.cb);
        return;
      }
      this.cb(intermediate);
      return;
    }
    this.cb.apply(null, arguments);
  };

  return FilterHandler;
}

module.exports = createFilterHandler;

},{}],4:[function(require,module,exports){
function createAppLinkingLib (execlib) {
  'use strict';

  var ret = {
    AppLinkingRegistryBase: require('./registrycreator')(execlib)
  };
  ret.eventEmitterHandlingRegistry = require('./eventemitterhandlingcreator')(execlib, ret);
  ret.produceLinks = require('./producercreator')(execlib, ret);

  return ret;
}

module.exports = createAppLinkingLib;

},{"./eventemitterhandlingcreator":2,"./producercreator":5,"./registrycreator":6}],5:[function(require,module,exports){
function createProduceLink (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    FilterHandler = require('./filterhandlercreator')(execlib);

  // checkers
  function isEventSource(desc) {
    return desc && desc.source && desc.source.indexOf('!') > 0;
  }
  function isPropertySource(desc) {
    return desc && desc.source && desc.source.indexOf(':') > 0;
  }
  function isEventTarget(desc) {
    return desc && desc.target && desc.target.indexOf('!') > 0;
  }
  function isPropertyTarget(desc) {
    return desc && desc.target && desc.target.indexOf(':') > 0;
  }
  function isFunctionTarget(desc) {
    return desc && desc.target && desc.target.indexOf('>') > 0;
  }
  // checkers end

  //parsers
  function instanceFromString (eb, str) {
    return str === '.' ? eb : eb.getElement(str);
  }
  function parsedEventString(eb, desc, sourcedelim, targetdelim) {
    var sa = desc.source.split(sourcedelim),
      ta = desc.target.split(targetdelim),
      s, t;
    if (sa.length === 2 && ta.length===2) {
      s = instanceFromString(eb, sa[0]);
      t = instanceFromString(eb, ta[0]);
      if (s && t) {
        return {
          s: s,
          sr: sa[1],
          t: t,
          tr: ta[1]
        };
      } else {
        if (!s) {
          console.error('source could not be found from', sa[0]);
        }
        if (!t) {
          console.error('target could not be found from', ta[0], 'on', eb);
        }
      }
    }
    return null;
  }
  //parsers end

  function LinkingResult(destroyables) {
    this.destroyables = destroyables;
  }
  LinkingResult.prototype.destroy = function () {
    if (lib.isArray(this.destroyables)) {
      lib.arryDestroyAll(this.destroyables);
    }
    this.destroyables = null;
  };

  // producers
  function produceEvent2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, '!', ':'), fh, ehctor, eh;
    if (pes) {
      ehctor = applinkinglib.eventEmitterHandlingRegistry.resolve({emitter:pes.s, name:pes.sr});
      if (ehctor) {
        eh = new ehctor(pes.s, pes.sr);
        fh = new FilterHandler(desc.filter, pes.t.set.bind(pes.t, pes.tr));
        addLink(eb, desc.name, new LinkingResult([eh.listenToEvent(fh.processInput.bind(fh)), eh, fh]), pes);
      }
    }
  }
  function produceEvent2FunctionLink (eb, desc) {
    var pes = parsedEventString(eb, desc, '!', '>'), fh, ehctor, eh, func;
    if (pes) {
      func = pes.t[pes.tr];
      if (!lib.isFunction(func)) {
        console.error(pes.tr, 'is not a method of', pes.t);
        return;
      }
      ehctor = applinkinglib.eventEmitterHandlingRegistry.resolve({emitter:pes.s, name:pes.sr});
      if (ehctor) {
        eh = new ehctor(pes.s, pes.sr);
        fh = new FilterHandler(desc.filter, func.bind(pes.t));
        addLink(eb, desc.name, new LinkingResult([eh.listenToEvent(fh.processInput.bind(fh)), eh, fh]), pes);
      }
    }
  }
  function produceProperty2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, ':', ':'), fh;
    if (pes) {
      fh = new FilterHandler(desc.filter, pes.t.set.bind(pes.t, pes.tr));
      addLink(eb, desc.name, new LinkingResult([pes.s.attachListener(pes.sr, fh.processInput.bind(fh))]), pes);
    }
  }
  // producers end

  // adders (problematic part) 
  function addLink(be, name, l, pes) {
    be.addAppLink(name, l, pes);
  }
  // adders end

  function produceLink (eb, desc) {
    if (!desc) {
      throw new lib.Error('NO_LINK_DESCRIPTOR', 'No link descriptor');
    }
    if (!desc.source) {
      throw new lib.JSONizingError('NO_SOURCE_IN_LINK_DESCRIPTOR', desc, 'No source in');
    }
    if (!desc.target) {
      throw new lib.JSONizingError('NO_TARGET_IN_LINK_DESCRIPTOR', desc, 'No target in');
    }
    if (isEventSource(desc)) {
      if (isPropertyTarget(desc)) {
        produceEvent2PropertyLink(eb, desc);
        return;
      }
      if (isEventTarget(desc)) {
        produceEvent2EventLink(eb, desc);
        return;
      }
      if (isFunctionTarget(desc)) {
        produceEvent2FunctionLink(eb, desc);
      }
    }
    if (isPropertySource(desc)) {
      if (isPropertyTarget(desc)) {
        produceProperty2PropertyLink(eb, desc);
        return;
      }
      if (isEventTarget(desc)) {
        produceProperty2EventLink(eb, desc);
        return;
      }
      if (isFunctionTarget(desc)) {
        produceProperty2FunctionLink(eb, desc);
      }
    }
  }

  function produceLinks (eb, links) {
    if (lib.isArray(links)) {
      links.forEach(produceLink.bind(null, eb));
      eb = null;
    }
  }

  return produceLinks;
}

module.exports = createProduceLink;

},{"./filterhandlercreator":3}],6:[function(require,module,exports){
function createRegistry (execlib) {
  'use strict';

  var lib = execlib.lib;

  function AppLinkingRegistryBase () {
    this.recognizers = new lib.DList();
  }
  AppLinkingRegistryBase.prototype.destroy = function () {
    if (this.recognizers) {
      this.recognizers.destroy();
    }
    this.recognizers = null;
  };
  function recognizer(reference, recognizerfunc) {
    return recognizerfunc(reference);
  }
  AppLinkingRegistryBase.prototype.resolve = function (reference) {
    var ret = this.recognizers.traverseConditionally(recognizer.bind(null, reference));
    if (!ret) {
      console.error('Not recognized:', reference);
    }
    reference = null;
    return ret;
  };
  AppLinkingRegistryBase.prototype.register = function (recognizerfunc) {
    return this.recognizers.push(recognizerfunc);
  };

  return AppLinkingRegistryBase;
}

module.exports = createRegistry;

},{}]},{},[1]);
