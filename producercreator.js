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
      return q(null);
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
