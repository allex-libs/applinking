function createFilterHandler (execlib) {
  'use strict';

  var lib = execlib.lib;

  function FilterHandler (filter, cb) {
    this.filter = null;
    this.cb = cb;
    if (lib.isFunction(filter)) {
      this.filter = filter;
    }
  }
  FilterHandler.prototype.destroy = function () {
    this.cb = null;
    this.filter = null;
  };
  FilterHandler.prototype.processInput = function () {
    var intermediate;
    if (this.filter) {
      intermediate = this.filter.apply(null, arguments);
      if (intermediate && lib.isFunction(intermediate.then)) {
        intermediate.then(this.cb);
        return;
      }
      this.cb(intermediate);
      return;
    }
    this.cb.apply(null, arguments);
  };

  return FilterHandler;
}

module.exports = createFilterHandler;
