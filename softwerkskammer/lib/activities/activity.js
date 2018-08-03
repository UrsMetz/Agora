'use strict';

const moment = require('moment-timezone');

const conf = require('simple-configure');
const beans = conf.get('beans');
const Resources = beans.get('resources');
const fieldHelpers = beans.get('fieldHelpers');
const Renderer = beans.get('renderer');

const standardName = 'Veranstaltung';

class Activity {
  /* eslint no-underscore-dangle: 0 */
  constructor(object) {
    this.state = object ? object : {};

    if (!this.state.resources) {
      this.state.resources = {};
      this.state.resources[standardName] = {_registeredMembers: [], _registrationOpen: true};
    }
  }

  id() {
    return this.state.id;
  }

  url() {
    return this.state.url ? this.state.url.trim() : undefined;
  }

  fullyQualifiedUrl() {
    return this.url() ? conf.get('publicUrlPrefix') + '/activities/' + encodeURIComponent(this.url()) : undefined;
  }

  title() {
    return this.state.title;
  }

  description() {
    return this.state.description;
  }

  location() {
    return this.state.location;
  }

  direction() {
    return this.state.direction;
  }

  startUnix() {
    return this.state.startUnix || moment().unix();
  }

  endUnix() {
    return this.state.endUnix || moment().add(2, 'hours').unix();
  }

  assignedGroup() {
    return this.state.assignedGroup;
  }

  owner() {
    return this.state.owner;
  }

  editorIds() {
    return this.state.editorIds || [];
  }

  clonedFromMeetup() {
    return !!this.state.clonedFromMeetup;
  }

  meetupRSVPCount() {
    return this.state.meetupRSVPCount || 0;
  }

  fillFromUI(object, editorIds) {
    this.state.url = object.url;

    this.state.editorIds = editorIds;

    this.state.title = object.title;
    this.state.description = object.description;
    this.state.assignedGroup = object.assignedGroup;
    this.state.location = object.location;
    this.state.direction = object.direction;
    // currently we only support MEZ/MESZ for events
    this.state.startUnix = fieldHelpers.parseToUnixUsingDefaultTimezone(object.startDate, object.startTime);
    this.state.endUnix = fieldHelpers.parseToUnixUsingDefaultTimezone(object.endDate, object.endTime);

    this.state.clonedFromMeetup = object.clonedFromMeetup;
    this.state.meetupRSVPCount = object.meetupRSVPCount;

    if (!this.id() || this.id() === 'undefined') {
      this.state.id = fieldHelpers.createLinkFrom([this.assignedGroup(), this.title(), this.startMoment()]);
    }

    // these are the resource definitions in the edit page:
    if (object.resources) {
      this.resources().fillFromUI(object.resources);
    }

    this.state.isSoCraTes = object.isSoCraTes;

    return this;
  }

  resetForClone() {
    let result = new Activity();
    result.state.editorIds = this.editorIds();
    result.state.title = this.title();
    result.state.description = this.description();
    result.state.assignedGroup = this.assignedGroup();
    result.state.location = this.location();
    result.state.direction = this.direction();
    result.state.startUnix = this.startUnix();
    result.state.endUnix = this.endUnix();

    result.state.resources = {};
    result.resources().copyFrom(this.resources());
    return result;
  }

  isSoCraTes() {
    return this.state.isSoCraTes;
  }

  descriptionHTML() {
    return Renderer.render(this.description(), this.assignedGroup());
  }

  descriptionPlain() {
    return this.descriptionHTML().replace(/<(?:\S|\s)*?>/gm, '');
  }

  hasDirection() {
    return fieldHelpers.isFilled(this.direction());
  }

  directionHTML() {
    return Renderer.render(this.direction(), this.assignedGroup());
  }

  groupName() {
    return this.group ? this.group.longName : '';
  }

  groupFrom(groups) {
    this.group = groups.find(group => group.id === this.assignedGroup());
  }

  blogEntryUrl() {
    return `${this.assignedGroup()}/blog_${this.startMoment().format('YYYY-MM-DD')}_${Renderer.normalize(this.title())}`;
  }

  // Resources

  resources() {
    return new Resources(this.state.resources);
  }

  veranstaltung() {
    return this.resources().veranstaltung();
  }

  resourceNamed() {
    return this.veranstaltung();
  }

  resourceNames() {
    return [standardName];
  }

  addMemberId(memberId, momentOfRegistration) {
    return this.resources().veranstaltung().addMemberId(memberId, momentOfRegistration);
  }

  removeMemberId(memberId) {
    this.resources().veranstaltung().removeMemberId(memberId);
  }

  allRegisteredMembers() {
    return this.resources().allRegisteredMembers();
  }

  isAlreadyRegistered(memberID) {
    return this.allRegisteredMembers().indexOf(memberID) > -1;
  }

  // Waitinglist stuff
  isAlreadyOnWaitinglist(memberID) {
    return this.allWaitinglistEntries().find(entry => entry.registrantId() === memberID);
  }

  allWaitinglistEntries() {
    return this.resources().allWaitinglistEntries();
  }

  addToWaitinglist(memberId, momentOfRegistration) {
    this.resources().veranstaltung().addToWaitinglist(memberId, momentOfRegistration);
  }

  removeFromWaitinglist(memberId) {
    this.resources().veranstaltung().removeFromWaitinglist(memberId);
  }

  waitinglistEntryFor(memberId) {
    return this.resources().veranstaltung().waitinglistEntryFor(memberId);
  }

  hasWaitinglist() {
    return this.resources().veranstaltung().hasWaitinglist();
  }

  // Display Dates and Times

  isMultiDay() {
    return this.endMoment().dayOfYear() !== this.startMoment().dayOfYear();
  }

  startMoment() {
    return moment.unix(this.startUnix()).tz(fieldHelpers.defaultTimezone());
  }

  endMoment() {
    return moment.unix(this.endUnix()).tz(fieldHelpers.defaultTimezone());
  }

  month() {
    return this.startMoment().month();
  }

  year() {
    return this.startMoment().year();
  }

  colorFrom(groupsColors) {
    return groupsColors && groupsColors[this.assignedGroup()] ? groupsColors[this.assignedGroup()] : '#353535';
  }

  // Helper functions for non-persistent information
  participantsOf(resourceName) {
    if (!this.participants) { return []; }
    const resource = this.resourceNamed(resourceName);
    const memberIds = resource.registeredMembers();
    return this.participants
      .filter(participant => memberIds.some(memberId => memberId === participant.id()))
      .map(member => {
        member.registeredAt = resource.registrationDateOf(member.id());
        return member;
      });
  }
}

module.exports = Activity;
