function createAppLinkingLib (execlib) {
  'use strict';

  var ret = {
    AppLinkingRegistryBase: require('./registrycreator')(execlib)
  };
  ret.EventEmitterHandlingRegistry = require('./eventemitterhandlingcreator')(execlib, ret);
  ret.produceLinks = require('./producercreator')(execlib, ret);

  return ret;
}

module.exports = createAppLinkingLib;
