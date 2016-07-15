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
  function isEventSource(desc) {
    return desc && isEvent(desc.source);
  }
  function isPropertySource(desc) {
    return desc && isProperty(desc.source);
  }
  function isEventTarget(desc) {
    return desc && isEvent(desc.target);
  }
  function isPropertyTarget(desc) {
    return desc && isProperty(desc.target);
  }
  function isFunctionTarget(desc) {
    return desc && isFunction(desc.target);
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
        return q.all([q(s), q(t)]).spread(function (s, t) {
          var ret = {
            s: s,
            sr: sa[1],
            t: t,
            tr: ta[1]
          };
          sa = null;
          ta = null;
          return ret;
        });
      } else {
        if (!s) {
          console.error('source could not be found from', sa[0]);
        }
        if (!t) {
          console.error('target could not be found from', ta[0]);
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
  function doProduceEvent2PropertyLink (eb, desc, pes) {
    var fh, ehctor, eh;
    console.log('pes', pes);
    ehctor = applinkinglib.eventEmitterHandlingRegistry.resolve({emitter:pes.s, name:pes.sr});
    if (ehctor) {
      eh = new ehctor(pes.s, pes.sr);
      fh = new FilterHandler(desc.filter, pes.t.set.bind(pes.t, pes.tr));
      addLink(eb, desc.name, new LinkingResult([eh.listenToEvent(fh.processInput.bind(fh)), eh, fh]), pes);
    }
  }
  function produceEvent2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, '!', ':');
    if (pes) {
      pes.then(doProduceEvent2PropertyLink.bind(null, eb, desc));
    }
  }
  function doProduceEvent2FunctionLink (eb, desc, pes) {
    var fh, ehctor, eh, func;
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
  function produceEvent2FunctionLink (eb, desc) {
    var pes = parsedEventString(eb, desc, '!', '>');
    if (pes) {
      pes.then(doProduceEvent2FunctionLink.bind(null, eb, desc));
    }
  }
  function doProduceProperty2PropertyLink (eb, desc, pes) {
    var fh, phctor, ph, pc;
    phctor = applinkinglib.propertyTargetHandlingRegistry.resolve({carrier: pes.t, name: pes.tr});
    if (!phctor) {
      return;
    }
    ph = new phctor(pes.t, pes.tr);
    fh = new FilterHandler(desc.filter, ph.handle.bind(ph));
    pc = pes.s.attachListener.length;
    if (pc === 2) {
      addLink(eb, desc.name, new LinkingResult([pes.s.attachListener(pes.sr, fh.processInput.bind(fh)), fh, ph]), pes);
      return;
    }
    if (pc ===3) {
      addLink(eb, desc.name, new LinkingResult([pes.s.attachListener('changed', pes.sr, fh.processInput.bind(fh)), fh, ph]), pes);
    }
  }
  function produceProperty2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, ':', ':');
    if (pes) {
      pes.then(doProduceProperty2PropertyLink.bind(null, eb, desc));
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
