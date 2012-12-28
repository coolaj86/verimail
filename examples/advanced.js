/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true undef:true unused:true*/
(function () {
  "use strict";

  require('remedial');

  var Verimail = require('../lib/verimail')
    , path = require('path')
    , connect = require('connect')
    , mailer = require('./config').mailer
    , verimail
    ;

  verimail = Verimail.create({
      dbfile: __dirname + '/var/verimail.json'
    , mailer: mailer
      /*
      {
          "service": "Gmail"
        , "auth": {
              "user": "john.doe@gmail.com"
            , "pass": "super_secret"
          }
      }
      */
    , formatMessage: function (next, id, state) {
        var msg = "Hello {name},\n"
              + "\n"
              + "To complete your registration, please confirm your email address:\n{link}\n"
              + "\n"
              + "If you have been registered by mistake, please unsubscribe:\n{unsub}\n"
          ;

        msg = msg.supplant(state);

        next(null, { subject: "Please Verify Your Email", body: msg, html: undefined });
      }
    , callback: function (next, id, state) {
        // Now you can retrieve by the id
        console.log(state);
        setTimeout(function () {
          verimail.mail({
              from: mailer.auth.user
            , to: state.email
            , subject: "You've been assimilated! W00T!"
            , body: ("Hey {name},\n"
                + "I saw that you just joined our site and I wanted to say 'hi' and 'thanks'.\n\nSo... \nHi!\nAnd Thanks!\n"
                + "Enjoy,\n"
                + "{rep}").supplant(state)
          }, next);
        }, /*16 * 60 * 1000 +*/ 32 * 1000);
      }
  });

  connect.createServer()
    .use(connect.static(path.join(__dirname, 'public-advanced')))
    .use(connect.json())
    .use('/verimail', function (req, res, next) {
        var formData = req.body
          , id
          , stat
          , db = verimail._db // use the verimail db for all user data
          ;

        // TODO verify that this at least looks like an e-mail address
        id = verimail.hash(formData.email);
        stat = db.get(id) || {};
        stat.name = req.body.name || stat.name;
        db.set(id, stat);

        // continues on to verimail handler
        next();
      })

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
