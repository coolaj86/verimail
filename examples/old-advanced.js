/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true unused:true undef:true*/
(function (){
  "use strict";

  require('http-json')(require('http'));
  require('remedial');

  var fs = require('fs')
    //, steve = require('./steve')
    , connect = require('connect')
    , config = require('./config')
    , emailer = require('./mailer').create(config.mailer)
    , contacts = require('./db').contacts
    , verifications = require('./db').verifications
    , crypto = require('crypto')
    , googleAnalytics = '?'
        // http://support.google.com/analytics/bin/answer.py?hl=en&answer=1033867&rd=1
        + 'utm_source=verify-email' // referrer: google, citysearch, newsletter4
        + '&'
        + 'utm_medium=email' // marketing medium: cpc, banner, email
        + '&'
        + 'utm_campaign=demo' // campaign name: some sort of product, promo code, slogan
        // utm_term=term // paid keywords
        // utm_content=content // name of experiment in the case of A B trials
    , sendMessage = emailer.createEmailHandler()
    //, UUID = require('node-uuid')
      // TODO maybe make the hash human-readable at some point
    , Verimail = require('./lib/verimail')
    , verimail

    , server
    , app
    , port = process.argv[2]
    ;

  connect.router = require('connect_router');

  function secondVerification(cb, id, email) {
    var contact = contacts.get(id)
      ;

    if (!contact) {
      cb(new Error('Something went wrong on the server side and our system lost your information. Please try contacting us again.'));
      return;
    }

    if (contact.verifiedAt) {
      cb(new Error('You\'ve already verified'));
      return;
    }
    
    if (contact.contactedAt) {
      cb(new Error('You\'ve already verified this address'));
      return;
    }

    contact.verifiedAt = Date.now();
    contacts.set(contact.email, contact);

    cb(null);
  }

  function onVerificationComplete(id, email) {
    // id is computed by verimail
    var contact = contacts.get(id)
      ;

    /*
    if (err) {
      res.error(err);
      res.json();
      return;
    }
    */

    contact.lastContacted = Date.now();
    contacts.set(id, contact);
    //res.json();
  }

  function prepareVerifyEmail(cb, id, data) {
    ///*jshint validthis:true*/
    var emailBody = {}
    //, me = this
      ;
    //, postReceive: function (cb, id, email, link) {

    emailBody.to = data.email;
    emailBody.toName = data.name;
    emailBody.date = new Date().toString();
    emailBody.subject = 'ACME - Verify your Email';
    emailBody.originalSubject = 'Contact Request';

    emailBody.from = 'noreply@acme.com';
    emailBody.fromName = 'ACME';

    fs.readFile(__dirname + '/../var/verify-address.txt', 'utf8', function (err, txt) {
      data.uuid = verimail.idEncode(data.email);

      verimail.db.set(id, {
          email: data.email
        , created: Date.now()
      });

      contacts.set(id, data);

      // template
      emailBody.body = txt.supplant(data).supplant(emailBody);
      cb(emailBody); // email stuff
    });
  }

  function confirmEmail(req, res) {
    console.log('uuid is', req.params.uuid);
    var id = req.params.uuid
      , sendAfter = 13 * 60 * 1000 + 16 * 1000
      //, sendAfter = 10 * 1000
      , contact
      , verification
      ;

    // Send the human-looking message 13min 16 seconds after the confirmation
    setTimeout(function () {
      sendReContactRequest(function (err) {
        // TODO we try later
        if (err) {
          console.error(err);
          return;
        }

        contact.contactedAt = Date.now();
        contacts.set(id, contact);
      }, contact);
    }, sendAfter);
  }

  function merge(target, extras) {
    Object.keys(extras).forEach(function (key) {
      if (extras[key]) {
        target[key] = extras[key];
      }
    });
  }

  function getSignature(rep, data) {
    if ('jack.sparrow' === rep) {
      data.fromName = 'Jack Sparrow';
      data.from = 'jack.sparrow@acme.com';
      data.replyTo = 'jack.sparrow@acme.com';
      data.signature = [
          '--'
        , 'Jane Doe'
        , 'Business Development'
        , ''
        , 'ACME'
      ].join('\n');
    } else if ('jane.doe' === rep) {
      data.fromName = 'Jane Doe';
      data.from = 'jane.doe@acme.com';
      data.replyTo = 'jane.doe@acme.com';
      data.signature = 'Jane Doe\n';
      data.signature = [
          '--'
        , 'Jane Doe'
        , ''
        , 'ACME'
      ].join('\n');
    } else {
      data.fromName = 'John Doe';
      data.from = 'john.doe@acme.com';
      data.replyTo = 'john.doe@acme.com';
      data.signature = [
          '--'
        , 'John Doe'
        , 'CEO'
        , ''
        , 'ACME'
      ].join('\n');
    }
  }

  // This is sent about 15 minutes after confirmation
  // and is meant to look as if from Brad
  function sendReContactRequest(cb, data) {
    data.to = data.email;
    data.toName = data.name;
    data.subject = 'RE: Contact Request';
    data.originalSubject = 'Contact Request';

    if (/east/.test(data.from)) {
      getSignature('jack.sparrow', data);
    } else if (/mountain|central/.test(data.location)) {
      getSignature('jane.doe', data);
    } else if (/pacific|west/.test(data.location)) {
      getSignature('jane.doe', data);
    } else {
      getSignature('john.doe', data);
    }

    fs.readFile(__dirname + '/../var/contact-request.txt', 'utf8', function (err, txt) {
      data.body = txt.supplant(data);
      sendMessage(cb, data);
    });
  }

  function handleRoutes(route) {
    route.post('/email/general', function (req, res) {
      var stuff = req.body
        , doing
        ;

      if (!/^\S*@\S*\.\S*$/.test(stuff.email) || !stuff.name) {
        res.error('I think you are spam');
        res.json();
        return;
      }

      stuff.date = new Date().toString();
      stuff.subject = 'RE: Contact Request';

      verimail.verify(stuff.email);
      verimail.on('sendmailStuff', function (cb, id) {
        stuff.id = id;
        prepareVerifyEmail(cb, stuff);
      });
      verimail.on('verify', function () {
        confirmEmail();
      });
    });
    route.get('/email/verify/:uuid', confirmEmail);
  }

  verimail = Verimail.create({
      prefix: '/verimail'
    , secret: "Ain't no thang but a chicken wing, baby"
    , db: verifications
      // this is used by verimail to get the id from the email
    , idEncode: function (cb, email) {
        // email = email.toLowerCase().replace(/\+.*@gmail/ig, '@gmail').replace(/\./ig, '')
        var hash = crypto.createHash('sha1').update(this.secret + email).digest('hex')
          ;

        this.db.set(hash, email);
        cb(null, hash);
      }
      // this is used by verimail to get the payload associated with the id
    , idDecode: function (cb, id) {
        var verification = this.db.get(id)
          ;

        if (!verification) {
          cb(id + ' is not a valid verification code (may be expired).', null);
          return;
        }

        cb(null, verification);
      }
      // this is used by verimail to get the payload associated with the id
      // This is where verimail does its verification
    , firstVerification: function (cb, id) {
        //this.idDecode(function (err, email) {
        var verification = this.db.get(id)
          ;

        if (!verification.email) {
          cb('Something went wrong on the server side and our system lost your information. Please try contacting us again.', null);
          return;
        }
        //}, email);
      }
    , secondVerification: secondVerification
      // This is sent directly to the new contact
      // and is meant to look as an automated response
      // default can be pretty lame or awome
    , postReceive: function (cb, id, email, link) {
        // defaultSendVerificationEmailPreparer
      }
    , sendmail: sendMessage
    , successDirect: '/verify.html' + googleAnalytics + '#success'
    , failureDirect: '/verify.html' + googleAnalytics + '#failure:{verifail}'
    , verificationHandler: function (req, res, next) {
        if (this.predirect) {
          req.url = '/verify.html' + (req.verifail ? '#failure:' + req.verifail : '#success');
        } else {
          /*
          res.statusCode = 302;
          res.setHeader('Location', '/verify.html' + googleAnalytics + '#success');
          res.setHeader('Content-Length', '0');
          res.end();
          */

          res.redirect('/verify.html' + (req.verifail ? '#failure:' + req.verifail : '#success'));
        }
      }
      // No need to send a second e-mail
    , onVerificationComplete: onVerificationComplete
    , predirect: false
  });

  app = connect.createServer()
    //.use(steve)
    //.use(connect.redirect())
    .use(connect.static(__dirname + '/../' + 'public'))
    .use(connect.bodyParser())
    .use(verimail)
    .use(connect.router(handleRoutes))
    ;

  module.exports = app;

  if (module === require.main) {
    server = app.listen(port, function () {
      console.log(server.address());
    });
  }
}());
