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
