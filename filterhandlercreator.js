function createFilterHandler (execlib) {
  'use strict';

  var lib = execlib.lib;

  function FilterHandler (filter, cb, applytype) {
    this.filter = null;
    this.cb = cb;
    this.applytype = !!applytype;
    if (lib.isFunction(filter)) {
      this.filter = filter;
    }
  }
  FilterHandler.prototype.destroy = function () {
    this.applytype = null;
    this.cb = null;
    this.filter = null;
  };
  FilterHandler.prototype.processInput = function () {
    var intermediate;
    if (this.filter) {
      intermediate = this.filter.apply(null, arguments);
      if (intermediate && lib.isFunction(intermediate.then)) {
        intermediate.then(this.applyToCb.bind(this));
        return;
      }
      return this.applyToCb(intermediate);
    }
    if (this.applytype) {
      return this.cb.apply(null, arguments[0]);
    }
    if (this.cb) {
      return this.cb.apply(null, arguments);
    }
  };
  FilterHandler.prototype.applyToCb = function (arg) {
    if (this.applytype) {
      return this.cb.apply(null, arg);
    }
    if (this.cb) {
      return this.cb(arg);
    }
  };

  return FilterHandler;
}

module.exports = createFilterHandler;
