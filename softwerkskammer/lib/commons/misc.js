const _ = require('lodash');
const express = require('express');
const path = require('path');
const conf = require('simple-configure');
const mimetypes = require('mime-types');

const imageExtensions = _(mimetypes.extensions)
  .filter((value, key) => key.match(/^image/))
  .flatten().value();

function regexEscape(string) {
  return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function asWholeWordEscaped(string) {
  return '^' + regexEscape(string) + '$';
}

module.exports = {
  toObject: function toObject(Constructor, callback, err, jsobject) {
    if (err) {return callback(err); }
    if (jsobject) { return callback(null, new Constructor(jsobject)); }
    callback(null, null);
  },

  toObjectList: function toObjectList(Constructor, callback, err, jsobjects) {
    if (err) { return callback(err); }
    callback(null, _.map(jsobjects, function (each) { return new Constructor(each); }));
  },

  toArray: function toArray(elem) {
    if (!elem) { return []; }
    if (elem instanceof Array) { return elem; }
    if (typeof elem === 'string') { return elem.split(','); }
    return [elem];
  },

  toLowerCaseRegExp: function toLowerCaseRegExp(string) {
    return new RegExp(asWholeWordEscaped(string), 'i');
  },

  arrayToLowerCaseRegExp: function arrayToLowerCaseRegExp(stringsArray) {
    return new RegExp(_(stringsArray).compact().map(asWholeWordEscaped).join('|'), 'i');
  },

  arraysAreEqual: function arraysAreEqual(array1, array2) {
    return array1.length === array2.length && array1.every((v, i)=> v === array2[i]);
  },

  differenceCaseInsensitive: function differenceCaseInsensitive(strings, stringsToReduce) {
    function prepare(strs) {
      return _(strs).compact().invokeMap('toLowerCase').value();
    }

    return _.difference(prepare(strings), prepare(stringsToReduce));
  },

  toFullQualifiedUrl: function toFullQualifiedUrl(prefix, localUrl) {
    function trimLeadingAndTrailingSlash(string) {
      return string.replace(/(^\/)|(\/$)/g, '');
    }

    return conf.get('publicUrlPrefix') + '/' + trimLeadingAndTrailingSlash(prefix) + '/' + trimLeadingAndTrailingSlash(localUrl);
  },

  betweenBraces: function betweenBraces(string) {
    const replaced = string.replace(/^.* \(/, '');
    return replaced === string ? string : replaced.replace(/\)$/, '');
  },

  expressAppIn: function expressAppIn(directory) {
    const app = express();
    app.set('views', path.join(directory, 'views'));
    app.set('view engine', 'pug');
    return app;
  },

  validate: function validate(currentValue, previousValue, validator, callback) {
    if (currentValue) { currentValue = currentValue.trim(); }
    if (previousValue) { previousValue = previousValue.trim(); }

    if (previousValue === currentValue) {
      return callback('true');
    }
    validator(currentValue, (err, result) => {
      if (err) { return callback('false'); }
      callback(result.toString());
    });
  },

  representsImage: function representsImage(filenameOrExtension) {
    const extension = filenameOrExtension.indexOf('.') < 1 ? filenameOrExtension : path.extname(filenameOrExtension);
    return imageExtensions.includes(extension.replace(/\./, ''));
  },

  regexEscape: regexEscape
};

