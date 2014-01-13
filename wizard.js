/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')


module.exports = function( options ) {
  var seneca = this
  var plugin   = 'wizard'

  seneca.depends(plugin,['project'])


  options = seneca.util.deepextend({
    prefix: '/wizard',
    web:true,
  },options)
  

  if( options.web ) {
    seneca.depends(plugin,['auth'])
  }



  var userent    = seneca.make$('sys/user')
  var projectent = seneca.make$('sys/project')


  seneca.add({role:plugin,cmd:'start'},          start_wizard)
  seneca.add({role:plugin,cmd:'open'},           open_wizard)
  seneca.add({role:plugin,cmd:'step'},           step_wizard)
  seneca.add({role:plugin,cmd:'complete'},       complete_wizard)


  seneca.act({
    role:'util',
    cmd:'ensure_entity',
    pin:{role:plugin,cmd:'*'},
    entmap:{
      project:projectent,
      user:userent,
    }
  })



  function start_wizard( args, done ) {
    done()
  }

  function open_wizard( args, done ) {
    done()
  }

  function step_wizard( args, done ) {
    done()
  }

  function complete_wizard( args, done ) {
    done()
  }


/*
  
  function buildcontext( req, res, args, act, respond ) {
    var user = req.seneca && req.seneca.user

    if( user ) {
      args.user = user

      if( args.account && !_.contains(args.user.accounts,args.account) ) {
        return seneca.fail({code:'invalid-account'},respond)
      }
      else {
        args.account = args.user.accounts[0]
      }
    }
    else return seneca.fail({code:'user-required'},respond);

    act(args,respond)
  }



  // web interface
  seneca.act_if(options.web, {role:'web', use:{
    prefix:options.prefix,
    pin:{role:plugin,cmd:'*'},
    map:{
      'user_wizards': { GET:buildcontext },
      'load':  { GET:buildcontext, alias:'load/:wizard' },
      'save':  { POST:buildcontext },
      'start': { POST:buildcontext },
      'stop':  { POST:buildcontext }
    }
  }})

*/


  return {
    name: plugin
  }
}
