/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";


var _     = require('underscore')
var async = require('async')


module.exports = function( options ) {
  var seneca = this
  var plugin   = 'wizard'

  seneca.depends(plugin,['project'])


  options = seneca.util.deepextend({
    loadlimit:  3,
    prefix:     '/wizard',
    kindprefix: 'wizard-',
    web:        true,
  },options)
  

  if( options.web ) {
    seneca.depends(plugin,['auth'])
  }



  var userent = seneca.make$('sys/user')


  // defines a wizard - a wizard is a "project"
  var projectent = seneca.make$('sys/project')

  // wizard steps for each wizard
  var wizstepent = seneca.make$('sys/wizstep')

  // wizard items for each step
  var wizitement = seneca.make$('sys/wizitem')


  // individual instance of wizard run-through
  var wizrunent  = seneca.make$('sys/wizrun')

  // wizard run-through step
  var wizrunstepent  = seneca.make$('sys/wizrunstep')

  // wizard run-through step item
  var wizrunitement  = seneca.make$('sys/wizrunitem')



  seneca.add({role:plugin,cmd:'save'},          
             {required$:'user'},
             cmd_save)

  seneca.add({role:plugin,cmd:'load'},          cmd_load)
  seneca.add({role:plugin,cmd:'savestep'},      make_savesub(wizstepent,'wizstep',projectent,'wizard'))
  seneca.add({role:plugin,cmd:'loadstep'},      make_loadsub(wizstepent,'wizstep','wizard'))
  seneca.add({role:plugin,cmd:'saveitem'},      make_savesub(wizitement,'wizitem',wizstepent,'wizstep'))
  seneca.add({role:plugin,cmd:'loaditem'},      make_loadsub(wizitement,'wizitem','wizstep'))

  seneca.add({role:plugin,cmd:'saverun'},       make_savesub(wizrunent,'wizrun',projectent,'wizard'))
  seneca.add({role:plugin,cmd:'loadrun'},       make_loadsub(wizrunent,'wizrun','wizard'))
  seneca.add({role:plugin,cmd:'saverunstep'},   make_savesub(wizrunstepent,'wizrunstep',wizrunent,'wizrun'))
  seneca.add({role:plugin,cmd:'loadrunstep'},   make_loadsub(wizrunstepent,'wizrunstep','wizrun'))
  seneca.add({role:plugin,cmd:'saverunitem'},   make_savesub(wizrunitement,'wizrunitem',wizrunstepent,'wizrunstep'))
  seneca.add({role:plugin,cmd:'loadrunitem'},   make_loadsub(wizrunitement,'wizrunitem','wizrunstep'))


  seneca.add({role:plugin,cmd:'open'},       cmd_open)
  seneca.add({role:plugin,cmd:'next'},       cmd_next)
  seneca.add({role:plugin,cmd:'prev'},       cmd_prev)
  seneca.add({role:plugin,cmd:'close'},      cmd_close)

  seneca.add({role:plugin,cmd:'getrunstep'}, cmd_getrunstep)
  seneca.add({role:plugin,cmd:'setrunstep'}, cmd_setrunstep)

  seneca.add({role:plugin,cmd:'setup'}, cmd_setup)


  seneca.act({
    role:'util',
    cmd:'ensure_entity',
    pin:[
      {role:plugin,cmd:'open'},
      {role:plugin,cmd:'next'},
      {role:plugin,cmd:'prev'},
      {role:plugin,cmd:'close'},
      {role:plugin,cmd:'getrunstep'},
      {role:plugin,cmd:'setrunstep'},
    ],
    entmap:{
      wizard:projectent,
      wizstep:wizstepent,
      wizitem:wizitement,
      wizrun:wizrunent,
      user:userent,
    }
  })




  function cmd_setup( args, done ) {
    var seneca = this

    var q = {wizard:true}
    if( null != args.tag ) { q.tag = args.tag }
    projectent.load$(q,function(err,wizard){
      if( err ) return done(err);

      if( wizard && !args.force ) return done(null,wizard)

      var wizardid = wizard ? wizard.id : null 
      seneca.act({role:plugin,cmd:'save',id:wizardid,id$:args.id$,name:args.name,tag:args.tag,user:args.user},function(err,out){
        if( err ) return done(err);
        var wizard = out.wizard

        var stepI = 0
        async.mapSeries(
          args.spec,

          function(step,stepdone) {
            step.role   = plugin
            step.cmd    = 'savestep'
            step.index  = stepI++
            step.wizard = wizard.id

            var items = step.items
            delete step.items

            //console.dir(step)
            seneca.act( step, function(err,out){
              if( err ) return done(err);

              var itemI = 0
              async.mapSeries( 
                items, 

                function(item,itemdone){
                  item.index   = itemI++
                  item.role    = plugin
                  item.cmd     = 'saveitem'
                  item.wizard  = wizard.id
                  item.wizstep = out.wizstep.id

                  seneca.act( item, itemdone)
                },
                stepdone
              )
            })
          },

          function(err){
            if( err ) return done(err);
            return done(null,wizard)
          }
        )
      })
    })
  }



  function cmd_save( args, done ) {

    // new wizard
    if( null == args.id ) {

      // prefix kind to avoid namespace conflicts with other kinds of projects
      args.kind = options.kindprefix + (null == args.code ? 'primary' : args.kind)

      // mark this as a wizard for query convenience
      args.wizard  = true
    }

    args.role = 'project'
    args.cmd  = 'save'
    args.account = args.user.accounts[0]

    this.act( args, providewizard(done) )
  }



  function cmd_load( args, done ) {
    args.project = args.wizard
    args.role = 'project'
    args.cmd  = 'load'
    this.act( args, providewizard(done) )
  }



  function cmd_open( args, done ) {
    var wizard = args.wizard
    var wizrun = args.wizrun

    if( null == wizrun ) {
      wizrun = wizrunent.make$({step:-1})
      wizrun.step = -1
    }

    var fields = seneca.util.argprops(
      // default values
      { tag: 'default' }, 
          
      // caller specified values, overrides defaults
      args, 

      // controlled values, can't be overridden
      {
        step:   wizrun.step,
        wizard: wizard.id,
        state:  'open',
        opened: new Date().toISOString() 
      },

      // invalid properties, will be deleted
      'id, role, cmd, user')

    wizrun.data$(fields)

    if( args.user ) {
      wizrun.user = args.user.id
    }

    wizrun.save$(function(err,wizrun){
      console.dir(wizrun)
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

    projectent.load$(wizrun.wizard,function(err,wizard){
      if(err) return done(wizard);
      if( !wizard ) return done( seneca.fail('no-wizard',{wizrun:wizrun}));
      
      var step = null == args.step ? wizrun.step : args.step

      function nextstep() {
        //console.log('NEXTSTEP')
        wizrun.step += 1

        var first = 0 == wizrun.step
        var last  = wizrun.step >= wizard.wizsteps.length

        if( last ) {
          wizrun.step -= 1
        }

        seneca.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:wizrun.step},function(err,out){
          if( err ) return done(err);
          if( !out.ok ) return done(null,out);

          wizrun.save$( function(err, wizrun) {
            if( err ) return done(err);

            //console.log(wizrun)

            out.wizrun = wizrun
            out.first = first
            out.last   = last

            done(null,out)
          })
        })
      }

      if( step < 0 ) {
        return nextstep()
      }
      else {
        seneca.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:step},function(err,out){
          if( err ) return done(err);
          if( !out.ok ) return done(null,out);

          var setargs = _.extend({},args,{role:plugin,cmd:'setrunstep',wizrunstep:out.wizrunstep,tag:wizrun.tag,state:'closed'})
          //console.log(setargs)

          seneca.act(setargs,function(err,out){
            if( err ) return done(err);
            if( !out.ok ) return done(null,out);

            return nextstep()
          })
        })
      }
    })
  }



  function cmd_prev( args, done ) {
    var seneca = this
    var wizrun = args.wizrun

    projectent.load$(wizrun.wizard,function(err,wizard){
      if(err) return done(wizard);
      if( !wizard ) return done( seneca.fail('no-wizard',{wizrun:wizrun}));

      wizrun.step -= 1
      var first = 0 <= wizrun.step
      var last  = wizrun.step >= wizard.wizsteps.length

      if( first ) {
        wizrun.step = 0
      }

      seneca.act({role:plugin,cmd:'getrunstep',wizrun:wizrun,step:wizrun.step},function(err,out){
        if( err ) return done(err);
        if( !out.ok ) return done(null,out);

        wizrunitement.list$({wizrun:wizrun.id,sort$:{index:1}},function(err,items){
          if( err ) return done(err);

          out.items = items

          out.wizrunstep.data$({state:'open'}).save$(function(err,wizrunstep){

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
    })
  }


  function cmd_getrunstep( args, done ) {
    //console.log('GETRUNSTEP')
    var seneca = this
    var wizrun = args.wizrun

    projectent.load$( wizrun.wizard, function(err,wizard) {
      if( err ) return done(err);
      if( !wizard ) return done( seneca.fail('no-wizard',{wizrun:wizrun}));

      var wizstepid = wizard.wizsteps[args.step]
      if( null == wizstepid ) return done( seneca.fail('no-wizstep',{wizard:wizard,step:args.step}));

      wizstepent.load$( wizstepid, function(err,wizstep) {
        if( err ) return done(err);
        if( !wizstep ) return done( seneca.fail('no-wizstep',{id:wizstepid}));
        
        wizrunstepent.load$( {wizrun:wizrun.id,wizstep:wizstep.id}, function(err,wizrunstep) {
          if( err ) return done(err);

          //console.log('GRS wizrun='+wizrun.id+' wizstep='+wizstep.id+' wizrunstep='+wizrunstep)

          if( !wizrunstep ) {
            wizrunstep = wizrunstepent.make$({
              wizrun:wizrun.id,
              wizstep:wizstep.id,
              step:args.step,
              state:'open',
              opened:new Date().toISOString(),
              tag:wizrun.tag,
              wizitems:wizstep.wizitems
            })
          }
        
          wizrunstep.save$( function(err,wizrunstep){
            if( err ) return done(err);

            wizitement.list$({wizstep:wizstep.id},function(err,wizitems){
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
    })
  }


  function cmd_setrunstep( args, done ) {
    //console.log('SETRUNSTEP')
    var seneca = this

    var wizrunstep = args.wizrunstep

    var items = args.items
    delete args.items
    for( var i = 0; i < items.length; i++ ) {
      items[i].index = i 
    }

    var controlled = {
      wizrun:wizrunstep.wizrun,
      wizstep:wizrunstep.wizstep,
      step:wizrunstep.step,
      opened:wizrunstep.opened,
      closed:new Date().toISOString(),
      tag:wizrunstep.tag,
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

    wizrunstep.data$(fields)

    wizrunstep.save$( function( err, wizrunstep ) {
      if(err) return done(err);

      //console.log(items)

      // save the items
      async.mapLimit(items,options.loadlimit,function(item,done){
        var fields = seneca.util.argprops(
          {}, 
          item,
          {
            tag:     wizrunstep.tag,
            wizrun:  wizrunstep.wizrun,
            wizrunstep:  wizrunstep.id,
            wizstep: wizrunstep.wizstep,
            wizitem: wizrunstep.wizitems[item.index],
            step:    wizrunstep.step,
          },
          'id, role, cmd, user')

        var wizrunitem = wizrunitement.make$(fields)
        wizrunitem.save$(fields,done)

      }, function(err,res){
        if(err) return done(err);
        done(err,{ok:!err,wizrunstep:wizrunstep})
      })
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



  function make_savesub( subent, name, parentent, parentname ) {
    return function( args, done ) {
      var seneca = this

      var parentid  = args[parentname]
      var subid     = args.id 
      
      var index = args.index
      if( null == index || index < 0 ) return done( seneca.fail('bad-'+name+'-index'));

      if( null == subid ) {
        update( subent.make$() )
      }
      else {
        subent.load$(subid,function(err,sub){
          if( err ) return done(err);
          if( !sub ) return done( seneca.fail('no-'+name));
        
          update(sub)
        })
      }

      function update(sub) {
        var controlled = {}
        controlled[parentname] = parentid

        var fields = seneca.util.argprops(
          // default values
          {}, 
          
          // caller specified values, overrides defaults
          args, 

          // controlled values, can't be overridden
          controlled,

          // invalid properties, will be deleted
          'id, role, cmd, user')

        parentent.load$(parentid, function(err,parent){
          if( err ) return done(err);
          if( !parent ) return done( seneca.fail('no-'+parentname) );

          sub.data$(fields).save$( function( err, sub ) {
            if( err ) return done(err);

            parent[name+'s'] = parent[name+'s'] || []
            parent[name+'s'][index] = sub.id

            parent.save$( function(err,parent) {
              if( err ) return done(err);

              var out = {ok:true}
              out[name]   = sub
              out[parent] = parent
              done(null,out)
            })
          })
        })
      }
    }
  }




  function buildcontext( req, res, args, act, respond ) {
    var user = req.seneca && req.seneca.user

    if( user ) {
      args.user = user
    }
    else return seneca.fail({code:'user-required'},respond);

    act(args,respond)
  }



  // web interface
  seneca.act_if(options.web, {role:'web', use:{
    prefix:options.prefix,
    pin:{role:plugin,cmd:'*'},
    map:{
      open:   { POST:buildcontext },
      next:   { POST:buildcontext },
      prev:   { POST:buildcontext },
      close:  { POST:buildcontext }
    }
  }})




  // define sys/account entity
  seneca.add({init:plugin}, function( args, done ){
    seneca.act('role:util, cmd:define_sys_entity', {list:[
      wizstepent.canon$(),
      wizitement.canon$(),
      wizrunent.canon$(),
      wizrunstepent.canon$(),
      wizrunitement.canon$()
    ]})
    done()
  })


  return {
    name: plugin
  }
}
