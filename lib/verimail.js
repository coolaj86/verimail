/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true, unused:true, undef:true*/
(function () {
  "use strict";

  var path = require('path')
    , crypto = require('crypto')
    , connect = require('connect')
    , router = require('connect_router')
    , nodemailer = require('nodemailer')
    , DomStorage = require('dom-storage')
    , JsonStorage = require('json-storage')
    ;

  function Verimail(opts) {
    if (!(this instanceof Verimail)) {
      throw new Error("Call Verimail.create(opts)");
      //return new Verimail(opts);
    }

    // prefix, db, redirect, failRedirect, predirect) {
    var me = this
      ;

    this._dbfile = opts.dbfile;
    this._domDb = DomStorage.create(this._dbfile);
    this._db = JsonStorage.create(this._domDb, 'e'); // email verifications
    this._secretDb = JsonStorage.create(this._domDb, 's'); // secret
    this._secret = this._secretDb.get('secret');
    this._mailer = opts.mailer;
    this._mailman = nodemailer.createTransport(opts.mailer.protocol || "SMTP", opts.mailer);
    this.callback = opts.callback || function () { }; // doesn't delete by default
    // TODO This is actually the HOST, not the URL
    this._baseUrl = opts.baseUrl;

    if (!this._secret) {
      // Note: There's an *extremely* small chance that _secret
      // could be used before it exists on the very first ever run.
      // Whatever.
      crypto.randomBytes((192 / 8), function (err, buf) {
        if (err) {
          throw err;
        }
        me._secret = opts.secret || buf.toString('base64');
        me._secretDb.set('secret', me._secret);
      });
    }

    me._prefix = opts.prefix || '/verimail';

    this.route = router(function (app) {
      // TODO how to allow for mounting of /my-app/verimail as /verimail?
      app.post(path.resolve('/', me._prefix + '/:id'), function (req, res) {
        me.confirm(req.params.id, function (err, stat) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (err) {
            res.end(JSON.stringify({ success: false, errors: [ { message: String(err) } ] }));
          } else {
            res.end(JSON.stringify({ success: true, result: { from: stat.from } }));
          }
        });
      });

      app.get(path.resolve('/', me._prefix + '/:id'), function (req, res) {
        me.confirm(req.params.id, function (err) {
          var result
            ;

          if (err) {
            result = '#failure:' + err;
          } else {
            result = '#success';
          }

          res.statusCode = 302;
          res.setHeader('Location', '/verify.html' + result);
          res.setHeader('Content-Length', '0');
          res.end();
        });
      });
    });

    this.demoRoutes = connect.createServer()
      .use(connect.static(__dirname + '/demo'))
      .use(connect.json())
      .use(router(function (app) {
          app.post(path.resolve('/', me._prefix), function (req, res) {
            function respond(err) {
              var result
                ;

              if (err) {
                result = { success: false, errors: [ { message: String(err) } ] };
              } else {
                result = { success: true, result: "Good Jorb, Homestar!" };
              }

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(result));
              console.log(req);
            }

            // TODO ensure that the email looks valid
            if (!req.body.force) {
              me.query(req.body.email, respond);
              return;
            }

            if (!me._baseUrl) {
              me._baseUrl = 'http'
                + (req.connection.encrypted ? 's' : '')
                + '://'
                + req.headers.host
                ;
            }

            me.cipher(req.body.email, function (err, id) {
              me._db.remove(id);
              me.query(req.body.email, respond);
            });
          });
        }))
      ;
  }

  Verimail.prototype.hash = function (email) {
    if (!this._secret) {
      throw new Error('You got right to business quicker than the secret could be generated');
    }
    return crypto.createHash('sha1').update(this._secret + email).digest('hex');
  };

  Verimail.prototype.cipher = function (email, cb) {
    var id = this.hash(email)
      , stat = this._db.get(id)
      ;

    if (!stat || !stat.email || !stat.createdAt) {
      stat = stat || {};
      stat.email = stat.email || email;
      stat.createdAt = stat.createdAt || Date.now();
      this._db.set(id, stat);
    }

    cb(null, id);
  };

  Verimail.prototype.decipher = function (id, cb) {
    var stat = this._db.get(id)
      , err = null
      ;

    if (!stat) {
      err = new Error('Could not decipher ' + id);
    }

    cb(err, stat);
  };

  Verimail.prototype.query = function (email, cb) {
    var me = this
      ;

    me.cipher(email, function (err, id) {
      var link = me._baseUrl + me._prefix + "/" + id
        , stat
        ;

      function sendIt() {
        stat.from = me._mailer.auth.user;
        me._mailman.sendMail({
            from: me._mailer.auth.user
          , to: email
          //, cc
          //, bcc
          //, replyTo
          , subject: "Confirm your e-mail address"
          , body: "" + link
          //, html
          //, attachments
        }, function (err) {
          if (!err) {
            stat.sentConfirmationAt = Date.now();
            me._db.set(id, stat);
          }
          cb(err);
        });
      }

      if (err) {
        cb(err);
        return;
      }

      stat = me._db.get(id);
      // TODO some way to overwrite this
      if (stat.sentConfirmationAt) {
        cb(new Error('Your confirmation e-mail was already sent. Look for a message from ' + stat.from));
        return;
      }

      if (me.formatMessage) {
        me.formatMessage(sendIt, stat);
      } else {
        sendIt();
      }

    });
  };

  Verimail.prototype.confirm = function (id, cb) {
    var stat = this._db.get(id)
      , err = null
      ;

    if (!stat) {
      cb(new Error('invalid id'));
      return;
    }

    if (stat.verifiedAt) {
      err = new Error('already verified');
      cb(err, stat);
      return;
    }

    // TODO check for staleness
    // if Date.now() - stat.createdAt < me.staleTimeout  err = new Error('')
    stat.verifiedAt = Date.now();
    this._db.set(id, stat);
    // this first callback is for the connect response
    cb(null /*, stat*/);
    // this second callback is for handling positive confirmations only
    this._callback(id, stat);
  };

  Verimail.prototype._callback = function (id, stat) {
    var me = this
      ;

    console.log('Calling callback for', id, stat);
    this.callback(function () {
      me._db.remove(id);
    }, id, stat);
  };

  Verimail.create = function (opts) {
    return new Verimail(opts);
  };

  module.exports = Verimail;
}());
