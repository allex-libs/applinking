function createAppLinkingLib (execlib) {
  'use strict';

  var ret = {
    AppLinkingRegistryBase: require('./registrycreator')(execlib)
  };
  ret.eventEmitterHandlingRegistry = require('./eventemitterhandlingcreator')(execlib, ret);
  ret.propertyTargetHandlingRegistry = require('./propertytargethandlingcreator')(execlib, ret);
  ret.LinkingEnvironment = require('./producercreator')(execlib, ret);
  ret.errorMessages = null;

  return ret;
}

module.exports = createAppLinkingLib;
