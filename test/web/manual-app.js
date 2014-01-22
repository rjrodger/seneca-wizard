
// run with: node manual-app.js --seneca.log=plugin:wizard

var seneca = require('seneca')()
seneca.use( 'mem-store', {web:{dump:true}} )
seneca.use( 'user' )
seneca.use( 'auth' )
seneca.use( 'account' )
seneca.use( 'project' )
seneca.use( '../..',{web:true})
seneca.use( 'data-editor' )
seneca.use( 'admin', {user:{password:'admin'}} )

var connect = require('connect')
app = connect()
app.use( connect.query() )
app.use( connect.json() )
app.use( seneca.export('web'))
app.use( connect.static("./public"))
app.listen(3333)


seneca.ready(function(err){
  if(err) return process.exit(!console.error(err));

  seneca.act({role:'user',cmd:'register',nick:'a1',password:'a1',admin:true}, function(err,out){
    if(err) return console.error(err);
    var adminuser = out.user

    seneca.act({role:'user',cmd:'register',nick:'u1',password:'u1'}, function(err,out){
      if(err) return console.error(err);

      seneca.act({
        role:'wizard',
        cmd:'setup',
        user:adminuser,
        tag:'t1',
        name:'Survey One',
        spec:[

          { title:'Page One',
            desc:'Rate these items!',
            items:[
              {label:'Apples',  kind:'ten'},
              {label:'Oranges', kind:'ten'},
              {label:'Pears',   kind:'ten'},
            ]
          },

          { title:'Page Two',
            desc:'Yes or No?',
            items:[
              {label:'Carrots', kind:'yesno'},
              {label:'Peas',    kind:'yesno'},
              {label:'Onions',  kind:'yesno'},
            ]
          },
          
          { title:'Page Three',
            desc:'Describe in your own words:',
            items:[
              {label:'Java',    kind:'text'},
              {label:'Ruby',    kind:'text'},
              {label:'Python',  kind:'text'},
            ]}
        ]
      }, function(err){
        if(err) return console.error(err);

        seneca.act({role:'mem-store',cmd:'dump'},function(err,dump){
          if(err) return console.error(err);

          console.log( JSON.stringify(dump,null,"  ")
                       .replace(/\n        +/g," ")
                       .replace(/\n      +\}/g,"}") 
                       .replace(/"([^"]*)": "([^"]*)"/g,"$1=$2") 
                     )

        })
      })
    })
  })
})
