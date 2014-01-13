/* Copyright (c) 2010-2013 Richard Rodger */
"use strict";

// mocha project.test.js


var seneca  = require('seneca')

var assert  = require('chai').assert

var _      = require('underscore')





function cberr(win){
  return function(err){
    if(err) {
      assert.fail(err, 'callback error')
    }
    else {
      win.apply(this,Array.prototype.slice.call(arguments,1))
    }
  }
}




var si = seneca()
si.use( 'user' )
si.use( 'auth' )
si.use( 'account' )
si.use( 'project' )
si.use( '..' )



var wizardpin   = si.pin({role:'wizard',cmd:'*'})
var projectpin  = si.pin({role:'project',cmd:'*'})
var userpin     = si.pin({role:'user',cmd:'*'})

var projectent = si.make$('sys','project')
var userent    = si.make$('sys','user')


describe('wizard', function() {

  var tmp = {}
  
  it('start', function(fin) {
    fin()
  })
  
})

