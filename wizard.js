/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')


module.exports = function( options ) {
  var seneca = this
  var plugin   = 'wizard'

  seneca.depends(plugin,['project'])


  options = seneca.util.deepextend({
    prefix:     '/wizard',
    kindprefix: 'wizard-',
    web:        true,
  },options)
  

  if( options.web ) {
    seneca.depends(plugin,['auth'])
  }



  var userent    = seneca.make$('sys/user')

  // defines a wizard - a wizard is a "project"
  var projectent = seneca.make$('sys/project')

  // individual instance of wizard run-through
  var wizrunent  = seneca.make$('sys/wizrun')

  // wizard steps for each wizard
  var wizstepent = seneca.make$('sys/wizstep')

  // wizard items for each step
  var wizitement = seneca.make$('sys/wizitem')


  seneca.add({role:plugin,cmd:'save'},          cmd_save)
  seneca.add({role:plugin,cmd:'load'},          cmd_load)
  seneca.add({role:plugin,cmd:'savestep'},      make_savesub(wizstepent,'wizstep',projectent,'wizard'))
  seneca.add({role:plugin,cmd:'loadstep'},      make_loadsub(wizstepent,'wizstep','wizard'))
  seneca.add({role:plugin,cmd:'saveitem'},      make_savesub(wizitement,'wizitem',wizstepent,'wizstep'))
  seneca.add({role:plugin,cmd:'loaditem'},      make_loadsub(wizitement,'wizitem','wizstep'))
  seneca.add({role:plugin,cmd:'saverun'},       make_savesub(wizrunent,'wizrun',projectent,'wizard'))
  seneca.add({role:plugin,cmd:'loadrun'},       make_loadsub(wizrunent,'wizrun','wizard'))


  seneca.add({role:plugin,cmd:'open'},       cmd_open)
  seneca.add({role:plugin,cmd:'step'},       cmd_step)
  seneca.add({role:plugin,cmd:'close'},      cmd_close)



  seneca.act({
    role:'util',
    cmd:'ensure_entity',
    pin:{role:plugin,cmd:'*'},
    entmap:{
      wizard:projectent,
      wizstep:wizstepent,
      wizitem:wizitement,
      wizrun:wizrunent,
      user:userent,
    }
  })




  function cmd_save( args, done ) {

    // new wizard
    if( null == args.id ) {

      // prefix kind to avoid namespace conflicts with other kinds of projects
      args.kind = options.kindprefix + (null == args.code ? 'primary' : args.code)

      // mark this as a wizard for query convenience
      args.wiz  = true
    }

    this.prior( args, providewizard(done) )
  }



  function cmd_load( args, done ) {
    args.project = args.wizard
    this.prior( args, providewizard(done) )
  }



  function cmd_open( args, done ) {
    var wizard = args.wizard
    var wizrun = args.wizrun

    if( null == wizrun ) {
      wizrun = wizrunent.make$({step:-1})
    }

    wizrun.state  = 'open' 
    wizrun.opened = new Date().toISOString() 

    if( args.user ) {
      wizrun.user = args.user.id
    }

    wizrun.save$(function(err,wizrun){
      done(err,{ok:!err,run:wizrun})
    })
  }



  function cmd_close( args, done ) {
    var wizrun = args.wizrun

    wizrun.state  = 'closed' 
    wizrun.closed = new Date().toISOString() 

    wizrun.save$(function(err,wizrun){
      done(err,{ok:!err,run:wizrun})
    })
  }



  function cmd_next( args, done ) {
    var seneca = this
    var wizrun = args.wizrun

    var step     = args.step
    var stepdata = args.stepdata

    this.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:args.step},function(err,out){
      if( err ) return done(err);
      if( !out.ok ) return done(null,out);

      this.act(_.extend({},args.stepdata,{role:plugin,cmd:'setrunstep',wizrunstep:out.wizrunstep}),function(err,out){
        if( err ) return done(err);
        if( !out.ok ) return done(null,out);

        wizrun.step += 1
        var first = 0 == wizrun.step
        var last  = wizrun.step >= out.wizard.wizsteps.length

        if( last ) {
          wizrun.step -= 1
        }

        this.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:wizrun.step},function(err,out){
          if( err ) return done(err);
          if( !out.ok ) return done(null,out);

          wizrun.save$( function(err, wizrun) {
            if( err ) return done(err);
            out.wizrun = wizrun
            out.first = first
            out.last   = last
            done(null,out)
          })
        })
      })
    })
  }


  function cmd_prev( args, done ) {
    var seneca = this
    var wizrun = args.wizrun

    wizrun.step -= 1
    var first = 0 <= wizrun.step
    var last  = wizrun.step >= out.wizard.wizsteps.length

    if( first ) {
      wizrun.step = 0
    }

    this.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:wizrun.step},function(err,out){
      if( err ) return done(err);
      if( !out.ok ) return done(null,out);

      wizrun.save$( function(err, wizrun) {
        if( err ) return done(err);
        out.wizrun = wizrun
        out.first = first
        out.last   = last
        done(null,out)
      })
    })
  }


  function cmd_getrunstep( args, done ) {
    var seneca = this
    var wizrun = args.wizrun

    projectent.load$( wizrun.wizard, function(err,wizard) {
      if( err ) return done(err);
      if( !sub ) return done( seneca.fail('no-wizard',{wizrun:wizrun}));

      var wizstepid = wizard.wizsteps[args.step]
      if( null == wizstepid ) return done( seneca.fail('no-wizstep',{wizard:wizard,step:args.step}));

      wizstepent.load$( wizstepid, function(err,wizstep) {
        if( err ) return done(err);
        if( !wizstep ) return done( seneca.fail('no-wizstep',{id:wizstepid}));
        
        wizrunstepent.load$( {wizrun:wizrun.id,wizstep:wizstep.id}, function(err,wizrunstep) {
          if( err ) return done(err);

          if( !wizrunstep ) {
            wizrunstep = wizrunstep.make$({
              wizrun:wizrun.id,
              wizstep:wizstep.id,
              step:args.step,
              state:'open',
              opened:new Date().toISOString()
            })
          }
        
          wizitemsent.list$({wizstep:wizstep.id},function(err,wizitems){
            if( err ) return done(err);

            done(null,{
              ok:true,
              wizard:wizard,
              wizstep:wizstep,
              wizitems:wizitems,
              wizrun:wizrun,
              wizrunstep:wizrunstep,
              step:args.step})
          })
        })
      })
    })
  }


  function cmd_setrunstep( args, done ) {
    var seneca = this

    var winrunstep = args.wizrunstep

    var controlled = {
      wizrun:wizrunstep.wizrun,
      wizstep:wizrunstep.wizstep,
      step:wizrunstep.wizstep,
      opened:wizrunstep.opened,
      closed:wizrunstep.closed
    }

    var fields = seneca.util.argprops(
      // default values
      {}, 
          
      // caller specified values, overrides defaults
      args, 

      // controlled values, can't be overridden
      controlled,

      // invalid properties, will be deleted
      'id, role, cmd, user')

    wizrunstep.data$(fields).save$( function( err, wizrunstep ) {
      done(err,{ok:!err,wizrunstep:wizrunstep})
    })
    
  }





  function providewizard( done ) {
    return function(err,out) {
      if( out ) {
        out.wizard = out.project
        delete out.project
      }
      return done(err,out)
    }
  }



  function make_loadsub( subent, name, parent ) {
    return function( args, done ) {
      var subid = args.id

      var idreflist = args[parent] && args[parent][name+'s']
      if( null == subid && idreflist && -1 < args[name] ) {
        subid = idreflist[args[name]]
      }

      return subent.load$(subid,function(err,sub) {
        done(err,{ok:!err,name:sub})
      })
    }
  }



  function make_savesub( subent, name, parentent, parent ) {
    return function( args, done ) {
      var seneca = this

      var parentent = args[parent]
      var subid     = args.id 
      
      var index = args.index
      if( null == index || index < 0 ) return done( seneca.fail('bad-'+name+'-index');

      if( null == subid ) {
        update( subent.make$() )
      }
      else {
        subent.load$(subid,function(err,sub){
          if( err ) return done(err);
          if( !sub ) return done( seneca.fail('no-'+name);
        
          update(sub)
        })
      }

      function update(sub) {
        var controlled = {}
        controlled[parent] = parentent.id

        var fields = seneca.util.argprops(
          // default values
          {}, 
          
          // caller specified values, overrides defaults
          args, 

          // controlled values, can't be overridden
          controlled,

          // invalid properties, will be deleted
          'id, role, cmd, user')

        sub.data$(fields).save$( function( err, sub ) {
          if( err ) return done(err);

          parentent[name+'s'][index] = sub.id

          parentent.save$( function(err,parentent) {
            if( err ) return done(err);

            var out = {ok:true}
            out[name]   = sub
            out[parent] = parentent
            done(null,out)
          })
        })
      }
    }
  }











  /*
  function loadstep( args, done ) {
    var stepid = args.id

    if( null == stepid && args.wizard && args.wizard.steps && -1 < args.step ) {
      stepid = args.wizard.steps[args.step]
    }

    return wizstepent.load$(stepid,function(err,wizstep) {
      done(err,{ok:!err,step:wizstep})
    })
  }


  function savestep( args, done ) {
    var index = args.step
    if( null == index || index < 0 ) return done( seneca.fail('bad-step-index');

    var wizard = args.wizard
    var wizstepid = wizard.steps[index]
      
    if( null == wizstepid ) {
      wizstep = wizstepent.make$()
      update(wizstep)
    }
    else {
      wizstepent.load$(wizstepid,function(err,wizstep){
        if( err ) return done(err);
        if( !wizstep ) return done( seneca.fail('no-step');
        
        update(wizstep)
      })
    }

    function update(wizstep) {
      var fields = seneca.util.argprops(

        // default values
        {}, 

        // caller specified values, overrides defaults
        args, 

        // controlled values, can't be overridden
        {
          wizard:args.wizard.id,
        }, 

        // invalid properties, will be deleted
        'id, role, cmd, user')

      wizstep.data$(fields).save$( function( err, wizstep ) {
        if( err ) return done(err);

        wizard.steps[index] = wizstep.id

        wizard.save$( function(err,wizard) {
          if( err ) return done(err);

          done(null,{wizard:wizard,wizstep:wizstep})
        })
      })
    }
  }



  function loaditem( args, done ) {
    var itemid = args.id

    if( null == itemid && args.wizstep && args.wizstep.items && -1 < args.item ) {
      itemid = args.wizstep.items[args.item]
    }

    return wizitement.load$(itemid,function(err,wizitem) {
      done(err,{ok:!err,item:wizitem})
    })
  }



  function saveitem( args, done ) {
    var index = args.item
    if( null == index || index < 0 ) return done( seneca.fail('bad-item-index');

    var wizstep = args.wizstep
    var wizitemid = wizstep.items[index]
      
    if( null == wizitemid ) {
      wizitem = wizitement.make$()
      update(wizitem)
    }
    else {
      wizitement.load$(wizitemid,function(err,wizitem){
        if( err ) return done(err);
        if( !wizitem ) return done( seneca.fail('no-step');
        
        update(wizitem)
      })
    }

    function update(wizitem) {
      var fields = seneca.util.argprops(

        // default values
        {}, 

        // caller specified values, overrides defaults
        args, 

        // controlled values, can't be overridden
        {
          wizstep:args.wizstep.id,
        }, 

        // invalid properties, will be deleted
        'id, role, cmd, user')

      wizitem.data$(fields).save$( function( err, wizitem ) {
        if( err ) return done(err);

        wizstep.items[index] = wizitem.id

        wizstep.save$( function(err,wizstep) {
          if( err ) return done(err);

          done(null,{wizstep:wizstep,wizitem:wizitem})
        })
      })
    }
  }
  */



   */

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


  // define sys/account entity
  seneca.add({init:plugin}, function( args, done ){
    seneca.act('role:util, cmd:define_sys_entity', {list:[wizitement.canon$(),wizrunent.canon$()]})
    done()
  })


  return {
    name: plugin
  }
}
