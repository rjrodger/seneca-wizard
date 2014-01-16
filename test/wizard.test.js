/* Copyright (c) 2010-2013 Richard Rodger */
"use strict";

// mocha project.test.js


var seneca  = require('seneca')

var assert  = require('chai').assert

var _      = require('underscore')
var async  = require('async')





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
var accountpin  = si.pin({role:'account',cmd:'*'})
var userpin     = si.pin({role:'user',cmd:'*'})

var memstorepin = si.pin({role:'mem-store',cmd:'*'})

var accountent = si.make$('sys/account')


function dump(fin,err) {
  memstorepin.dump({},cberr(function(dump){
    console.log(dump)
    fin(err)
  }))
}


describe('wizard', function() {

  var tmp = {}
  
  it('setup', function(fin) {
    console.log('SETUP')

    userpin.register({nick:'u1'}, cberr(function(out){

      wizardpin.save({user:out.user,name:'foo'}, cberr(function(out){
        var wizard = out.wizard
        tmp.wiz1id = wizard.id

        //return dump(fin)

        // steps and items
        async.map(
          [
            {title:'AAA',index:0,items:[
              {label:'a1',kind:'zig',index:0},
              {label:'a2',kind:'zig',index:1},
              {label:'a3',kind:'zag',index:2},
            ]},

            {title:'BBB',index:1,items:[
              {label:'b1',kind:'zag',index:0},
              {label:'b2',kind:'zag',index:1},
            ]},

            {title:'CCC',index:2,items:[
              {label:'c1',kind:'zog',index:0},
            ]}
          ],

          function(step,stepdone) {
            step.wizard = wizard.id
            var items = step.items
            delete step.items

            wizardpin.savestep( step, cberr(function(out){

              async.map( 
                items, 
                function(item,itemdone){
                  item.wizard  = wizard.id
                  item.wizstep = out.wizstep.id
                  wizardpin.saveitem(item, itemdone)
                },
                stepdone
              )
            }))
          },

          function(err){
            console.log('END SETUP')
            console.log(tmp)
            fin()
            //dump(fin,err)
          }
        )

      }))
    }))
  })  


  it('run',function(fin){
    console.log('RUN')
    wizardpin.open({wizard:tmp.wiz1id,tag:'jan'}, cberr(function(out){
      tmp.run1 = out.run
      
      wizardpin.next({wizrun:tmp.run1},cberr(function(out){
        console.log(out)

        dump(fin)
      }))
    }))
  })


})

