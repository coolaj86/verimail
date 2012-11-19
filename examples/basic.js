/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true undef:true unused:true*/
(function () {
  "use strict";

  var Verimail = require('../lib/verimail')
    , connect = require('connect')
    , verimail
    ;

  verimail = Verimail.create({
      dbfile: __dirname + '/var/verimail.json'
    , mailer: require('./config').mailer
      /*
      {
          "service": "Gmail"
        , "auth": {
              "user": "john.doe@gmail.com"
            , "pass": "super_secret"
          }
      }
      */
    , callback: function (cb, id, state) {
        // Now you can retrieve by the id
        console.log(state);

        // Calling the callback deletes the id
        // which means that it could verify again and again
        //cb();
      }
  });

  connect.createServer()
    // GET `/verimail/:id` verifies :id
    .use(verimail.route)

    // GET `/verimail` serves the Demo form
    // POST `/verimail` handles the Demo form
    .use(verimail.demoRoutes)

    .listen(3000, function () {
        console.log('Listening on http://0.0.0.0:3000');
      })
    ;

}());
