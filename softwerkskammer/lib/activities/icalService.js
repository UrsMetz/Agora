'use strict';

var _ = require('lodash');
var icalendar = require('icalendar');

var beans = require('simple-configure').get('beans');
var misc = beans.get('misc');

function activityAsICal(activity) {
  var event = new icalendar.VEvent(activity.url());
  event.setSummary(activity.title());
  event.setDescription(activity.description().replace(/\r\n/g, '\n'));
  event.addProperty('LOCATION', activity.location().replace(/\r\n/g, '\n'));
  event.addProperty('URL', misc.toFullQualifiedUrl('activities', encodeURIComponent(activity.url())));
  event.setDate(activity.startMoment().toDate(), activity.endMoment().toDate());
  return event;
}

module.exports = {
  activityAsICal: activityAsICal,

  icalForActivities: function (activities) {
    /* eslint new-cap: 0 */
    var ical = new icalendar.iCalendar();
    _.each(activities, function (activity) {
      ical.addComponent(activityAsICal(activity));
    });
    return ical;
  }
};
