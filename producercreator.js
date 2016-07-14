function createProduceLink (execlib) {
  'use strict';

  var lib = execlib.lib,
    eventEmitterHandling = require('./eventemitterhandlingcreator')(execlib);


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
  // checkers end

  //parsers
  function instanceFromString (eb, str) {
    return str === '.' ? eb : eb.elements.get(str);
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
          console.error('target could not be found from', ta[0]);
        }
      }
    }
    return null;
  }
  //parsers end


  // producers
  function produceEvent2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, '!', ':'), name;
    if (pes) {
      addLink(eb, desc.name, pes.s.attachListener(pes.sr, pes.t.set.bind(pes.t, pes.tr)), pes);
    }
  }
  function produceProperty2PropertyLink (eb, desc) {
    var pes = parsedEventString(eb, desc, ':', ':'), name;
    if (pes) {
      addLink(eb, desc.name, pes.s.attachListener(pes.sr, pes.t.set.bind(pes.t, pes.tr)), pes);
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
      }
    }
    if (isPropertySource(desc)) {
      if (isPropertyTarget(desc)) {
        produceProperty2PropertyLink(eb, desc);
        return;
      }
      if (isEventTarget(desc)) {
        produceProperty2EventLink(eb, desc);
      }
    }
  }

  return produceLink;
}

module.exports = createProduceLink;
