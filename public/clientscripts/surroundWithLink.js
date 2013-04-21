/* global $, document*/
"use strict";

var surroundWithLink = function (text) {
  // shamelessly stolen from http://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
  var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlRegex, function (url) {
    return "<a href=\"" + url + "\">" + url + "</a>";
  });
};

var surroundTwitterName = function (twittername) {
  return "<a href=\"http://twitter.com/" + twittername + "\">@" + twittername + "</a>";
};

var surroundEmail = function (email) {
  return "<a href=\"mailto:" + email + "\">" + email + "</a>";
};

$(document).ready(function () {
  $('.urlify').each(function () {
    $(this).html(surroundWithLink(this.innerHTML));
  });

  $('.twitterify').each(function () {
    $(this).html(surroundTwitterName(this.innerHTML));
  });

  $('.mailtoify').each(function () {
    $(this).html(surroundEmail(this.innerHTML));
  });
})
