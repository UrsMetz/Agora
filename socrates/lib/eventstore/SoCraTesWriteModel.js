/*eslint no-underscore-dangle: 0*/
'use strict';



function SoCraTesWriteModel(eventStore) {
  this._eventStore = eventStore;
}

SoCraTesWriteModel.prototype.eventStore = function () {
  // persistence needs an id:
  this._eventStore.setId();
  return this._eventStore;
};

module.exports = SoCraTesWriteModel;
