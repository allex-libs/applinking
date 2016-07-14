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
