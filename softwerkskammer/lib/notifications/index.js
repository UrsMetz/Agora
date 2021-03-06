/* eslint no-underscore-dangle: 0 */
'use strict';

var _ = require('lodash');
var async = require('async');
var conf = require('simple-configure');

var beans = conf.get('beans');
var groupsAndMembers = beans.get('groupsAndMembersService');
var memberstore = beans.get('memberstore');
var Member = beans.get('member');
var sendBulkMail = beans.get('mailtransport').sendBulkMail;
var logger = require('winston').loggers.get('transactions');
var pug = require('pug');
var path = require('path');

var defaultRenderingOptions = {
  pretty: true, // makes the generated html nicer, in case someone looks at the mail body
  url: conf.get('publicUrlPrefix')
};

function sendMail(emailAddresses, subject, html, callback) {
  var fromName = conf.get('sender-name') || 'Softwerkskammer Benachrichtigungen';
  sendBulkMail(emailAddresses, subject, html, fromName, conf.get('sender-address'), callback);
}

function activityParticipation(activity, visitorID, ressourceName, content, type, callback) {
  async.parallel(
    {
      group: function (cb) { groupsAndMembers.getGroupAndMembersForList(activity.assignedGroup(), cb); },
      owner: function (cb) { memberstore.getMemberForId(activity.owner(), cb); },
      visitor: function (cb) { memberstore.getMemberForId(visitorID, cb); }
    },

    function (err, results) {
      if (err) { return logger.error(err); }
      var organizers = _.filter(results.group.members, function (member) { return _.includes(results.group.organizers, member.id()); });
      var organizersEmails = _.map(organizers, function (member) { return member.email(); });
      if (results.owner) {
        organizersEmails.push(results.owner.email());
      }
      if (_.isEmpty(organizersEmails)) { return; }
      var renderingOptions = {
        activity: activity,
        ressourceName: ressourceName,
        content: content,
        count: activity.resourceNamed(ressourceName).registeredMembers().length,
        totalcount: activity.allRegisteredMembers().length,
        visitor: results.visitor
      };
      _.defaults(renderingOptions, defaultRenderingOptions);
      var filename = path.join(__dirname, 'pug/activitytemplate.pug');
      sendMail(organizersEmails, type, pug.renderFile(filename, renderingOptions), callback);
    }
  );
}

module.exports.visitorRegistration = function (activity, visitorID, resourceName, callback) {
  activityParticipation(activity, visitorID, resourceName, 'hat sich ein neuer Besucher angemeldet', 'Neue Anmeldung für Aktivität', callback);
};

module.exports.visitorUnregistration = function (activity, visitorID, resourceName, callback) {
  activityParticipation(activity, visitorID, resourceName, 'hat sich ein Besucher abgemeldet', 'Abmeldung für Aktivität', callback);
};

module.exports.waitinglistAddition = function (activity, visitorID, resourceName, callback) {
  activityParticipation(activity, visitorID, resourceName, 'hat sich jemand auf die Warteliste eingetragen', 'Zugang auf Warteliste', callback);
};

module.exports.waitinglistRemoval = function (activity, visitorID, resourceName, callback) {
  activityParticipation(activity, visitorID, resourceName, 'hat sich jemand von der Warteliste entfernt', 'Streichung aus Warteliste', callback);
};

module.exports.wikiChanges = function (changes, callback) {
  memberstore.allMembers(function (err, members) {
    if (err) { return callback(err); }
    var renderingOptions = {
      directories: _.sortBy(changes, 'dir')
    };
    _.defaults(renderingOptions, defaultRenderingOptions);
    var filename = path.join(__dirname, 'pug/wikichangetemplate.pug');
    var receivers = _.union(Member.superuserEmails(members), Member.wikiNotificationMembers(members));
    sendMail(receivers, 'Wiki Änderungen', pug.renderFile(filename, renderingOptions), callback);
  });
};

module.exports.newMemberRegistered = function (member, subscriptions) {
  memberstore.allMembers(function (err, members) {
    if (err) { return; }
    var renderingOptions = {
      member: member,
      groups: subscriptions,
      count: members.length
    };
    _.defaults(renderingOptions, defaultRenderingOptions);
    var filename = path.join(__dirname, 'pug/newmembertemplate.pug');
    var receivers = Member.superuserEmails(members);
    sendMail(receivers, 'Neues Mitglied', pug.renderFile(filename, renderingOptions));
  });
};
