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
  ret.propertyTargetHandlingRegistry = require('./propertytargethandlingcreator')(execlib, ret);
  ret.produceLinks = require('./producercreator')(execlib, ret);

  return ret;
}

module.exports = createAppLinkingLib;

},{"./eventemitterhandlingcreator":2,"./producercreator":5,"./propertytargethandlingcreator":6,"./registrycreator":7}],5:[function(require,module,exports){
function createProduceLink (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    FilterHandler = require('./filterhandlercreator')(execlib);

  // checkers
  function isEvent(subdesc) {
    return lib.isString(subdesc) && subdesc.indexOf('!') > 0;
  }
  function isProperty(subdesc) {
    return lib.isString(subdesc) && subdesc.indexOf(':') > 0;
  }
  function isFunction(subdesc) {
    return lib.isString(subdesc) && subdesc.indexOf('>') > 0;
  }
  // checkers end

  //parsers
  function instanceFromString (eb, str) {
    return str === '.' ? eb : eb.getElement(str);
  }
  function parseEventElementString(eb, desc, delim) {
    var ea = desc.split(delim), i;
    if (ea.length === 2) {
      i = instanceFromString(eb, ea[0]);
      if (i) {
        return q(i).then(function (i) {
          var ret = {
            instance: i,
            reference: ea[1]
          };
          ea = null;
          return ret;
        });
      }
    } else {
      return q.reject(new lib.Error('INVALID_LINK_ELEMENT_STRING', 'Invalid link element string: '+desc));
    }
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
  function produceEventSource(pe) {
    var ehctor, eh;
    ehctor = applinkinglib.eventEmitterHandlingRegistry.resolve({emitter:pe.instance, name:pe.reference});
    if (ehctor) {
      eh = new ehctor(pe.instance, pe.reference);
      return q([eh.listenToEvent.bind(eh), eh]);
    } else {
      return q.reject(new lib.Error('EVENT_EMITTER_NOT_RECOGNIZED', 'EventEmitter not recognized by eventEmitterHandlingRegistry'));
    }
  }

  function producePropertySource(pe) {
    var pc;
    if (!(pe && pe.instance && pe.instance.attachListener)) {
      return q.reject(new lib.Error('NOT_A_PROPERTY_SOURCE', 'Found an instance that has not got a method `attachListener`'));
    }
    pc = pe.instance.attachListener.length;
    if (pc === 2) {
      var ret = pe.instance.attachListener.bind(pe.instance, pe.reference);
      return q([ret]);
    }
    if (pc ===3) {
      return q([pe.instance.attachListener.bind(pe.instance, 'changed', pe.reference), pe]);
    }
  }
  function produceSource (eb, sourcedesc) {
    if (!sourcedesc) {
      return q.reject(new lib.Error('INVALID_SOURCE_DESCRIPTOR', sourcedesc+' is an invalid particular source descriptor'));
    }
    sourcedesc = sourcedesc.trim();
    if (isEvent(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, '!').then(
        produceEventSource
      );
    }
    if (isProperty(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, ':').then(
        producePropertySource
      );
    }
    if (isFunction(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, '>').then(
        produceFunctionSource
      );
    }
    return q.reject(new lib.Error('UNRECOGNIZED_LINK_SOURCE', 'Not a recognized source descriptor: '+sourcedesc));
  }

  function combineSources(sources) {
    var lm, la, retobj, ret;
    if (sources.length ===1) {
      return sources[0];
    }
    lm = new lib.ListenableMap();
    la = sources.map(function (s, index) {
      var ret = index+'';
      s[0](lm.replace.bind(lm, ret));
      return ret;
    });
    retobj = Object.create({
      destroy: function () {if (lm) {lm.destroy();} lm = null; la = null},
      attach: function (cb) {lm.spread(la, cb, true);}
    });
    return [retobj.attach, retobj];
  }

  function produceSourceComposite(eb, sourcedesc) {
    var ret = q.all(sourcedesc.split(',').map(produceSource.bind(null, eb))).then(combineSources);
    eb = null;
    return ret;
  }
  // producers end

  // adders
  function addLink(be, name, l, pes) {
    be.addAppLink(name, l, pes);
  }
  // adders end


  function onEventTarget(eb, name, filter, source, pe) {
    return pe;
  }
  function onPropertyTarget(eb, name, filter, source, pe) {
    var fh, phctor, ph;
    phctor = applinkinglib.propertyTargetHandlingRegistry.resolve({carrier: pe.instance, name: pe.reference});
    if (phctor) {
      ph = new phctor(pe.instance, pe.reference);
      fh = new FilterHandler(filter, ph.handle.bind(ph));
      source[0] = source[0](fh.processInput.bind(fh));
      source.push(ph);
      source.push(fh);
      addLink(eb, name, new LinkingResult(source));
    }
    return pe;
  }
  function onFunctionTarget(eb, name, filter, source, pe) {
    if (!(pe && pe.instance && pe.reference)) {
      console.log('invalid function target pack', pe);
      return;
    }
    var func = pe.instance[pe.reference], fh;
    if (!lib.isFunction(func)) {
      console.error(pe.reference, 'is not a method of', pe.instance);
      return;
    }
    fh = new FilterHandler(filter, func.bind(pe.instance));
    source[0] = source[0](fh.processInput.bind(fh));
    source.push(fh);
    addLink(eb, name, new LinkingResult(source));
    return pe;
  }
  function produceTarget(eb, name, filter, targetdesc, source) {
    if (isEvent(targetdesc)) {
      return parseEventElementString(eb, targetdesc, '!').then(
        onEventTarget.bind(null, eb, name, filter, source)
      );
    }
    if (isProperty(targetdesc)) {
      return parseEventElementString(eb, targetdesc, ':').then(
        onPropertyTarget.bind(null, eb, name, filter, source)
      );
    }
    if (isFunction(targetdesc)) {
      return parseEventElementString(eb, targetdesc, '>').then(
        onFunctionTarget.bind(null, eb, name, filter, source)
      );
    }

    console.error(targetdesc+' could not be recognized as a target descriptor');
    return q.reject(new lib.Error('TARGET_DESCRIPTOR_NOT_RECOGNIZED', targetdesc+' could not be recognized as a target descriptor'));
  }

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
    produceSourceComposite(eb, desc.source.trim()).then(
      produceTarget.bind(null, eb, desc.name, desc.filter, desc.target.trim())
    );
    eb = null;
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
function createPropertyTargetHandler (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    AppLinkingRegistryBase = applinkinglib.AppLinkingRegistryBase;

  function findFinalCarrier (pth) {
    var pa = pth.name.split('.'), i=1;
    while(i<pa.length) {
      pth.carrier = pth.carrier[pa[i-1]];
      pth.name = pa[i];
      i++;
    }
  }


  function PropertyTargetHandler (propertycarrier, propertyname) {
    this.carrier = propertycarrier;
    this.name = propertyname;
  }
  PropertyTargetHandler.prototype.destroy = function () {
    this.name = null;
    this.carrier = null;
  };
  PropertyTargetHandler.prototype.handle = function (val) {
    throw new lib.Error('NOT_IMPLEMENTED', 'handle is not implemented on PropertyTargetHandler base');
  };
  PropertyTargetHandler.findFinalCarrier = findFinalCarrier;

  function AllexPropertyTargetHandler (propertycarrier, propertyname) {
    PropertyTargetHandler.call(this, propertycarrier, propertyname);
    this.carrier = this.carrier.set.bind(this.carrier, this.name);
  }
  lib.inherit(AllexPropertyTargetHandler, PropertyTargetHandler);
  AllexPropertyTargetHandler.prototype.handle = function (val) {
    this.carrier(val);
  };
  AllexPropertyTargetHandler.recognizer = function (propertycarrierwithname) {
    if (propertycarrierwithname &&
      propertycarrierwithname.carrier &&
      isAllexPropertyCarrier(propertycarrierwithname.carrier)) {
      return AllexPropertyTargetHandler;
    }
  };

  function isAllexPropertyCarrier(carrier) {
    return carrier && 
      lib.isFunction(carrier.set) &&
      ( carrier.set === lib.Settable.prototype.set ||
        carrier.set === lib.Changeable.prototype.set );
  }

  var ret = new AppLinkingRegistryBase();
  ret.PropertyTargetHandler = PropertyTargetHandler;
  ret.register(AllexPropertyTargetHandler.recognizer);

  return ret;
}

module.exports = createPropertyTargetHandler;

},{}],7:[function(require,module,exports){
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
