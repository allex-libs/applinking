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
      ehctor = applinkinglib.EventEmitterHandlingRegistry.resolve({emitter:pes.s, name:pes.sr});
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
    var pes = parsedEventString(eb, desc, ':', ':'), fh, phctor, ph;
    if (pes) {
      phctor = applinkinglib.propertyTargetHandlingRegistry.resolve({carrier: pes.t, name: pes.tr});
      if (!phctor) {
        return;
      }
      ph = new phctor(pes.t, pes.tr);
      fh = new FilterHandler(desc.filter, ph.handle.bind(ph));
      addLink(eb, desc.name, new LinkingResult([pes.s.attachListener(pes.sr, fh.processInput.bind(fh)), fh, ph]), pes);
    }
  }
  // producers end

  // adders
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
