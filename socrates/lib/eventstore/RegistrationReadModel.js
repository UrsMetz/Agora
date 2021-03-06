/*eslint no-underscore-dangle: 0*/
'use strict';

var R = require('ramda');
var moment = require('moment-timezone');

var beans = require('simple-configure').get('beans');
var e = beans.get('eventConstants');
var socratesConstants = beans.get('socratesConstants');
var roomOptions = beans.get('roomOptions');

var earliestValidRegistrationTime = moment.tz().subtract(socratesConstants.registrationPeriodinMinutes, 'minutes');

var processReservationsBySessionId = function (reservationsBySessionId, event) {
  if (event.event === e.RESERVATION_WAS_ISSUED && moment(event.joinedSoCraTes).isAfter(earliestValidRegistrationTime)) {
    reservationsBySessionId[event.sessionId] = event;
  }
  if (event.event === e.PARTICIPANT_WAS_REGISTERED) {
    delete reservationsBySessionId[event.sessionId];
  }
  return reservationsBySessionId;
};

var processParticipantsByMemberId = function (participantsByMemberId, event) {
  if (event.event === e.PARTICIPANT_WAS_REGISTERED
    || event.event === e.ROOM_TYPE_WAS_CHANGED
    || event.event === e.DURATION_WAS_CHANGED
    || event.event === e.REGISTERED_PARTICIPANT_FROM_WAITINGLIST) {
    participantsByMemberId[event.memberId] = event;
  }
  if (event.event === e.PARTICIPANT_WAS_REMOVED) {
    delete participantsByMemberId[event.memberId];
  }
  return participantsByMemberId;
};

var processWaitinglistReservationsBySessionId = function (waitinglistReservationsBySessionId, event) {
  if (event.event === e.WAITINGLIST_RESERVATION_WAS_ISSUED && moment(event.joinedWaitinglist).isAfter(earliestValidRegistrationTime)) {
    waitinglistReservationsBySessionId[event.sessionId] = event;
  }
  if (event.event === e.WAITINGLIST_PARTICIPANT_WAS_REGISTERED || event.event === e.PARTICIPANT_WAS_REGISTERED) {
    delete waitinglistReservationsBySessionId[event.sessionId];
  }
  return waitinglistReservationsBySessionId;
};

var processWaitinglistParticipantsByMemberId = function (waitinglistParticipantsByMemberId, event) {
  if (event.event === e.WAITINGLIST_PARTICIPANT_WAS_REGISTERED || event.event === e.DESIRED_ROOM_TYPES_WERE_CHANGED) {
    waitinglistParticipantsByMemberId[event.memberId] = event;
  }
  if (event.event === e.WAITINGLIST_PARTICIPANT_WAS_REMOVED) {
    delete waitinglistParticipantsByMemberId[event.memberId];
  }
  if (event.event === e.REGISTERED_PARTICIPANT_FROM_WAITINGLIST) {
    delete waitinglistParticipantsByMemberId[event.memberId];
  }
  return waitinglistParticipantsByMemberId;
};

function RegistrationReadModel(eventStore, soCraTesReadModel) {
  this._soCraTesReadModel = soCraTesReadModel;

  // read model state:
  this._reservationsBySessionId = {};
  this._participantsByMemberId = {};
  this._waitinglistReservationsBySessionId = {};
  this._waitinglistParticipantsByMemberId = {};

  this._reservationsBySessionIdFor = {};
  this._participantsByMemberIdFor = {};
  this._reservationsAndParticipantsFor = {};
  this._waitinglistReservationsBySessionIdFor = {};
  this._waitinglistParticipantsByMemberIdFor = {};
  this._durations = [];

  this.update(eventStore.events());
}

RegistrationReadModel.prototype.update = function (events) {
  // core data:
  this._reservationsBySessionId = R.reduce(processReservationsBySessionId, this._reservationsBySessionId, events);
  this._participantsByMemberId = R.reduce(processParticipantsByMemberId, this._participantsByMemberId, events);
  this._waitinglistReservationsBySessionId = R.reduce(processWaitinglistReservationsBySessionId, this._waitinglistReservationsBySessionId, events);
  this._waitinglistParticipantsByMemberId = R.reduce(processWaitinglistParticipantsByMemberId, this._waitinglistParticipantsByMemberId, events);

  // derived data:
  roomOptions.allIds().forEach(roomType => {
    this._reservationsBySessionIdFor[roomType] = R.filter(function (event) { return event.roomType === roomType; }, this.reservationsBySessionId());
    this._participantsByMemberIdFor[roomType] = R.filter(function (event) { return event.roomType === roomType; }, this.participantsByMemberId());
    this._reservationsAndParticipantsFor[roomType] = R.concat(R.values(this.reservationsBySessionIdFor(roomType)), R.values(this.participantsByMemberIdFor(roomType)));
    this._waitinglistReservationsBySessionIdFor[roomType] = R.filter(function (event) { return R.contains(roomType, event.desiredRoomTypes); }, this.waitinglistReservationsBySessionId());
    this._waitinglistParticipantsByMemberIdFor[roomType] = R.filter(function (event) { return R.contains(roomType, event.desiredRoomTypes); }, this.waitinglistParticipantsByMemberId());
  });

  this._durations = R.pipe(
    R.values, // only the events
    R.pluck('duration'), // pull out each duration
    R.groupBy(R.identity), // group same durations
    R.mapObjIndexed(function (value, key) { return {count: value.length, duration: roomOptions.endOfStayFor(key)}; })
  )(this.participantsByMemberId());

};

RegistrationReadModel.prototype.reservationsBySessionId = function () {
  return this._reservationsBySessionId;
};

RegistrationReadModel.prototype.reservationsBySessionIdFor = function (roomType) {
  return this._reservationsBySessionIdFor[roomType];
};

RegistrationReadModel.prototype.participantsByMemberId = function () {
  return this._participantsByMemberId;
};

RegistrationReadModel.prototype.participantsByMemberIdFor = function (roomType) {
  return this._participantsByMemberIdFor[roomType];
};

RegistrationReadModel.prototype.participantCountFor = function (roomType) {
  return this.allParticipantsIn(roomType).length;
};

RegistrationReadModel.prototype.participantEventFor = function (memberId) {
  return this.participantsByMemberId()[memberId];
};

RegistrationReadModel.prototype.durationFor = function (memberId) {
  return roomOptions.endOfStayFor(this.participantEventFor(memberId).duration);
};

RegistrationReadModel.prototype.durations = function () {
  return this._durations;
};

RegistrationReadModel.prototype.joinedSoCraTesAt = function (memberId) {
  return moment(this.participantEventFor(memberId).joinedSoCraTes);
};

RegistrationReadModel.prototype.joinedWaitinglistAt = function (memberId) {
  return moment(this.waitinglistParticipantEventFor(memberId).joinedWaitinglist);
};

RegistrationReadModel.prototype.isAlreadyRegistered = function (memberId) {
  return !!this.participantEventFor(memberId);
};

RegistrationReadModel.prototype.isAlreadyRegisteredFor = function (memberId, roomType) {
  const event = this.participantEventFor(memberId);
  return event && event.roomType === roomType;
};

RegistrationReadModel.prototype.isAlreadyOnWaitinglistFor = function (memberId, roomType) {
  const event = this.waitinglistParticipantEventFor(memberId);
  return event && R.contains(roomType, event.desiredRoomTypes);
};

RegistrationReadModel.prototype.allParticipantsIn = function (roomType) {
  return R.keys(this.participantsByMemberIdFor(roomType));
};

RegistrationReadModel.prototype.reservationsAndParticipantsFor = function (roomType) {
  return this._reservationsAndParticipantsFor[roomType];
};

RegistrationReadModel.prototype.waitinglistReservationsBySessionId = function () {
  return this._waitinglistReservationsBySessionId;
};

RegistrationReadModel.prototype.waitinglistReservationsBySessionIdFor = function (roomType) {
  return this._waitinglistReservationsBySessionIdFor[roomType];
};

RegistrationReadModel.prototype.waitinglistParticipantsByMemberId = function () {
  return this._waitinglistParticipantsByMemberId;
};

RegistrationReadModel.prototype.allWaitinglistParticipantsIn = function (roomType) {
  return R.keys(this.waitinglistParticipantsByMemberIdFor(roomType));
};

RegistrationReadModel.prototype.waitinglistParticipantCountFor = function (roomType) {
  return this.allWaitinglistParticipantsIn(roomType).length;
};

RegistrationReadModel.prototype.waitinglistParticipantsByMemberIdFor = function (roomType) {
  return this._waitinglistParticipantsByMemberIdFor[roomType];
};

RegistrationReadModel.prototype.isFull = function (roomType) {
  return this._soCraTesReadModel.quotaFor(roomType) <= this.reservationsAndParticipantsFor(roomType).length;
};

RegistrationReadModel.prototype._reservationOrWaitinglistReservationEventFor = function (sessionId) {
  return this.reservationsBySessionId()[sessionId] || this.waitinglistReservationsBySessionId()[sessionId];
};

function expirationTimeOf(event) {
  var joinedAt = event.joinedSoCraTes || event.joinedWaitinglist;
  return joinedAt ? moment(joinedAt).add(socratesConstants.registrationPeriodinMinutes, 'minutes') : undefined;
}

RegistrationReadModel.prototype.reservationExpiration = function (sessionId) {
  var event = this._reservationOrWaitinglistReservationEventFor(sessionId);
  return event && expirationTimeOf(event);
};

RegistrationReadModel.prototype.hasValidReservationFor = function (sessionId) {
  return !!this._reservationOrWaitinglistReservationEventFor(sessionId);
};

RegistrationReadModel.prototype.registeredInRoomType = function (memberID) {
  var participantEvent = this.participantEventFor(memberID);
  if (participantEvent) {
    return participantEvent.roomType;
  }
  return null;
};

RegistrationReadModel.prototype.waitinglistParticipantEventFor = function (memberId) {
  return this.waitinglistParticipantsByMemberId()[memberId];
};

RegistrationReadModel.prototype.isAlreadyOnWaitinglist = function (memberId) {
  return !!this.waitinglistParticipantEventFor(memberId);
};

RegistrationReadModel.prototype.selectedOptionsFor = function (memberID) {
  var options = [];
  var participantEvent = this.participantEventFor(memberID);
  if (participantEvent) {
    options.push(participantEvent.roomType + ',' + participantEvent.duration);
  }

  var waitinglistParticipantEvent = this.waitinglistParticipantEventFor(memberID);
  if (waitinglistParticipantEvent) {
    waitinglistParticipantEvent.desiredRoomTypes.forEach(roomType => options.push(roomType + ',waitinglist'));
  }
  return options.join(';');
};

RegistrationReadModel.prototype.roomTypesOf = function (memberId) {
  var participantEvent = this.participantEventFor(memberId);
  if (participantEvent) {
    return [participantEvent.roomType];
  }

  var waitinglistParticipantEvent = this.waitinglistParticipantEventFor(memberId);
  if (waitinglistParticipantEvent) {
    return waitinglistParticipantEvent.desiredRoomTypes;
  }
  return [];
};

// TODO this is currently for tests only...:
RegistrationReadModel.prototype.waitinglistReservationsAndParticipantsFor = function (roomType) {
  return R.concat(R.values(this.waitinglistReservationsBySessionIdFor(roomType)), R.values(this.waitinglistParticipantsByMemberIdFor(roomType)));
};

module.exports = RegistrationReadModel;
