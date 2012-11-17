/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";

  var path = require('path')
    , crypto = require('crypto')
    , connect = require('connect')
    , router = require('connect_router')
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

    this._dbfile = opts.filename;
    this._domDb = DomStorage.create(this._dbfile);
    this._db = JsonStorage.create(this._domDb, 'e'); // email verifications
    this._secretDb = JsonStorage.create(this._domDb, 's'); // secret
    this._secret = this._secretDb.get('secret');

    if (!this._secret) {
      // there's an extremely small chance that _secret is used
      // before it exists the very first run. Whatever.
      crypto.randomBytes((192 / 8), function (buf) {
        this._secret = opts.secret || buf.toString('base64');
        this._secretDb.set('secret', this._secret);
      });
    }

    me._prefix = opts.prefix || '/verimail';

    this.route = router(function (app) {
      // TODO how to allow for mounting of /my-app/verimail as /verimail?
      app.post(path.resolve('/', me._prefix + '/:id'), function (req, res) {
        me.confirm(req.params.id, function (err) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (err) {
            res.end(JSON.stringify({ success: false, errors: [ err ] }));
          } else {
            res.end(JSON.stringify({ success: true, result: "Good Jorb, Homestar!" }));
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
      /*
      .use(router(function (app) {
          app.get(path.resolve('/', me._prefix), function (req, res) {
          
          });
        }))
      */
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
      ;

    if (!this.db.get(id)) {
      this.db.set(id, {
          email: email
        , createdAt: Date.now()
      });
    }
    cb(null, id);
  };

  Verimail.prototype.decipher = function (id, cb) {
    var stat = this.db.get(id)
      , err = null
      ;

    if (!stat) {
      err = new Error('Could not decipher ' + id);
    }

    cb(err, stat);
  };

  Verimail.prototype.query = function (email, cb) {
    this._mailman.send();
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

    this.callback(function () {
      me._db.remove(id);
    }, id, stat);
  };

  Verimail.create = function (opts) {
    return new Verimail(opts);
  };

  module.exports = Verimail;
}());
