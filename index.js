function createAppLinkingLib (execlib) {
  'use strict';

  var produceLink = require('./producercreator')(execlib);

  return produceLink;
}

module.exports = createAppLinkingLib;
