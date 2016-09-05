function createProduceLink (execlib, applinkinglib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    ChangeableListenable = lib.ChangeableListenable,
    FilterHandler = require('./filterhandlercreator')(execlib);

  function FunctionWaiter (instance, methodname) {
    ChangeableListenable.call(this);
    this.data = {result: null, progress: null, error: null, running: false};
    this.instance = instance;
    this.methodname = methodname;
  }
  ChangeableListenable.addMethods(FunctionWaiter);
  lib.inherit(FunctionWaiter, ChangeableListenable);
  FunctionWaiter.prototype.destroy = function () {
    this.methodname = null;
    this.instance = null;
    this.data = null;
    ChangeableListenable.prototype.destroy.call(this);
  };
  FunctionWaiter.prototype.activate = function (cb) {
    var res = cb.apply(null, Array.prototype.slice.call(arguments, 1));
    if (res && lib.isFunction(res.then)) {
      this.set('data', lib.extend({}, this.data, {running: true}));
      res.then(
        this.setResult.bind(this),
        this.setError.bind(this),
        this.setProgress.bind(this)
      );
      return;
    }
    this.set('data', res);
  };
  FunctionWaiter.prototype.setResult = function (result) {
    //console.log('result', result);
    this.set('data', lib.extend({}, this.data, {result: result, running: false}));
  };
  FunctionWaiter.prototype.setError = function (error) {
    //console.log('error', error);
    this.set('data', lib.extend({}, this.data, {error: error, running: false}));
  };
  FunctionWaiter.prototype.setProgress = function (progress) {
    //console.log('progress', progress, '=>', lib.extend({}, this.data, {progress: progress}));
    var d = lib.extend({}, this.data);
    d.progress = progress;
    this.set('data', d);
  };

  function functionWaiterFinder(findobj, fw) {
    if (findobj.instance === fw.instance && findobj.methodname === fw.methodname) {
      return fw;
    }
  }

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
    return str === '.' ? eb.holder : eb.holder.getElement(str);
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
    ehctor = pe && applinkinglib.eventEmitterHandlingRegistry.resolve({emitter:pe.instance, name:pe.reference});
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
      return q([pe.instance.attachListener.bind(pe.instance, pe.reference), pe]);
    }
    if (pc ===3) {
      return q([pe.instance.attachListener.bind(pe.instance, 'changed', pe.reference), pe]);
    }
  }

  function produceFunctionSource(eb, pe) {
    if (!pe) {
      return; //parsing failed
    }
    var fw = eb.findOrCreateFunctionWaiter(pe);
    return producePropertySource({instance: fw, reference: 'data'});
  }

  function parseChecker (eb, sourcedesc, caption, pe) {
    if (!pe) {
      console.error(sourcedesc, 'did not yield a', caption, 'on', eb.holder);
      return q.reject('UNRECOGNIZABLE_PARSE', sourcedesc+' did not yield a '+caption);
    }
    return pe;
  }

  function produceSource (eb, sourcedesc) {
    if (!sourcedesc) {
      return q.reject(new lib.Error('INVALID_SOURCE_DESCRIPTOR', sourcedesc+' is an invalid particular source descriptor'));
    }
    sourcedesc = sourcedesc.trim();
    if (isEvent(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, '!').then(
        parseChecker.bind(null, eb, sourcedesc, 'EventEmitter')
      ).then(
        produceEventSource
      );
    }
    if (isProperty(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, ':').then(
        parseChecker.bind(null, eb, sourcedesc, 'PropertySource')
      ).then(
        producePropertySource
      );
    }
    if (isFunction(sourcedesc)) {
      return parseEventElementString(eb, sourcedesc, '>').then(
        parseChecker.bind(null, eb, sourcedesc, 'FunctionSource')
      ).then(
        produceFunctionSource.bind(null, eb)
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
    return [pe];
  }
  function onPropertyTarget(eb, name, filter, source, pe) {
    var fh, phctor, ph, s;
    phctor = applinkinglib.propertyTargetHandlingRegistry.resolve({carrier: pe.instance, name: pe.reference});
    if (phctor) {
      ph = new phctor(pe.instance, pe.reference);
      fh = new FilterHandler(filter, ph.handle.bind(ph));
      s = [source[0](fh.processInput.bind(fh)), ph, fh];
      addLink(eb, name, new LinkingResult(s));
    }
    return [pe, s];
  }
  function onFunctionTarget(eb, name, filter, source, pe) {
    if (!(pe && pe.instance && pe.reference)) {
      console.log('invalid function target pack', pe);
      return null;
    }
    var func = pe.instance[pe.reference], fh, fw, s;
    if (!lib.isFunction(func)) {
      if (lib.isFunction(pe.instance.getMethodByName)) {
        func = pe.instance.getMethodByName(pe.reference);
      }
    }
    if (!lib.isFunction(func)) {
      console.error(pe.reference, 'is not a method of', pe.instance);
      return null;
    }
    fw = eb.findOrCreateFunctionWaiter(pe);
    fh = new FilterHandler(filter, fw.activate.bind(fw, func.bind(pe.instance)));
    s = [source[0](fh.processInput.bind(fh)), fh];
    addLink(eb, name, new LinkingResult(s));
    return [pe, s];
  }
  function produceTargetSingle(eb, name, filter, source, targetdesc) {
    return produceTarget(eb, name, filter, targetdesc, source);
  }
  function produceTarget(eb, name, filter, targetdesc, source) {
    var targetdescs;
    targetdesc = targetdesc.trim();
    targetdescs = targetdesc.split(',');
    if (targetdescs.length>1) {
      return q.all(targetdescs.map(produceTargetSingle.bind(null, eb, name, filter, source)));
    }
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

  function ident (thingy) {
    return thingy;
  }

  function produceReference (eb, refdesc) {
    var ret = [ident];
    refdesc = refdesc.trim();
    if (isFunction(refdesc)) {
      return parseEventElementString(eb, refdesc, '>').then(
        //produceFunctionSource.bind (null, eb)
        onFunctionTarget.bind(null, eb, refdesc.name, null, ret)
      ).then(function (result) {
        /*
        var _ret = ret[0];
        ret = null;
        return _ret;
        */
        return result[1][0];
      });
    }
    if (refdesc === '.') {
      return q(eb.holder);
    }
    return q(eb.holder.getElement(refdesc));
  }

  function produceReferenceComposite(eb, sourcedesc) {
    var ret = q.all(sourcedesc.split(',').map(produceReference.bind(null, eb)));
    eb = null;
    return ret;
  }

  function LogicWorker (handler, references) {
    this.handler = handler;
    this.references = references;
  }
  LogicWorker.prototype.destroy = function () {
    this.references = null;
    this.handler = null;
  }
  LogicWorker.prototype.exec = function () {
    var args = (this.references || []).concat(Array.prototype.slice.call(arguments));
    this.handler.apply(null, args);
  };

  function produceLogicFinally (eb, name, handler, references, triggersource) {
    var lw = new LogicWorker(handler, references);
    triggersource.push(lw);
    return onFunctionTarget(eb, name, void 0, triggersource, {instance: lw, reference: 'exec'});
  }

  function produceSourceCompositeForLogic (eb, name, triggersdesc, handler, references) {
    produceSourceComposite(eb, triggersdesc).then(
      produceLogicFinally.bind(null, eb, name, handler, references)
    );
  }

  function produceLogic (eb, desc) {
    if (!desc) {
      throw new lib.Error('NO_LOGIC_DESCRIPTOR', 'No link descriptor');
    }
    if (!desc.references) {
      throw new lib.JSONizingError('NO_REFERENCES_IN_LOGIC_DESCRIPTOR', desc, 'No references in');
    }
    if (!desc.triggers) {
      throw new lib.JSONizingError('NO_TRIGGERS_IN_LOGIC_DESCRIPTOR', desc, 'No triggers in');
    }
    if (!lib.isFunction(desc.handler)) {
      throw new lib.JSONizingError('NO_HANDLER_IN_LOGIC_DESCRIPTOR', desc, 'No handler function in');
    }
    if (lib.isArray(desc.triggers)) {
      desc.triggers.forEach(produceSingleLogic.bind(null, eb, desc));
    } else {
      produceSingleLogic(eb, desc, desc.triggers);
    }
  }
  function produceSingleLogic (eb, desc, triggers) {
    produceReferenceComposite(eb, desc.references.trim()).then(
      produceSourceCompositeForLogic.bind(null, eb, desc.name, triggers.trim(), desc.handler)
    );
    eb = null;
  }

  function produceLogics (eb, links) {
    if (lib.isArray(links)) {
      links.forEach(produceLogic.bind(null, eb));
      eb = null;
    }
  }


  function LinkingEnvironment (holder) {
    this.holder = holder;
    this.functionWaiters = new lib.DList();
  }
  LinkingEnvironment.prototype.destroy = function () {
    if (this.functionWaiters) {
      lib.containerDestroyAll(this.functionWaiters);
    }
    this.functionWaiters.destroy();
    this.functionWaiters = null;
    this.holder = null;
  };
  LinkingEnvironment.prototype.produceLinks = function (links) {
    produceLinks(this, links);
  };
  LinkingEnvironment.prototype.produceLogic = function (logics) {
    produceLogics(this, logics);
  };
  LinkingEnvironment.prototype.findOrCreateFunctionWaiter = function (pe) {
    var fw = this.functionWaiters.traverseConditionally(functionWaiterFinder.bind(null, {instance: pe.instance, methodname: pe.reference}));
    if (!fw) {
      fw = new FunctionWaiter(pe.instance, pe.reference);
      this.functionWaiters.push(fw);
    }
    return fw;
  }
  LinkingEnvironment.prototype.addAppLink = function () {
  };


  return LinkingEnvironment;
}

module.exports = createProduceLink;
