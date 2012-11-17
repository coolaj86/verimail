# Verimail

Verimail is a wireframe for handling e-mail verification with reasonable defaults.

  * You provide an interaction which requires an e-mail address
  * The client interacts, you get the email
  * You send the client a message "Click this link to verify your email" with some sort of grace period
  * The client clicks the (non-guessable) link
  * The cilent is given a success (or failure) message
  * You handle the completion

It is intended to deter crackers from using simple forms on your site to send spam.

It is also very handy to verify that legitimate users have entered in their email properly.

Note: The default configuration is intended for applications where in-memory storage is enough,
the db file is created exclusively to persist across reboots, not for optimization.

## Extremely Basic Example

If you specify nothing other than your **gmail credentials**,  a **secret**, and **plug it into connect**, it works.

    npm install -S verimail

```javascript
var Verimail = require('verimail')
  , connect = require('connect')
  ;

verimail = Verimail.create({
  , secret: "any string you like, just make it long"
  , mailer: {
    }
  , callback: function (id, state) {
      // Now you can retrieve by the id
      console.log(state);

      // Calling the callback deletes the id
      cb();
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
```

# API

The API is kinda big because, well, you can replace any part of it.

As stated at the beginning, this is more of a wireframe with defaults.

  * `Verimail.create()`
  * `Verimail#hash` the default "cipher"
  * `Verimail#prefix` to append to the http route instead of `/verimail`
  * `Verimail#secret` for using the built-in sha1-based hasher
  * `Verimail#mailer` the config options for node-mailer
  * `Verimail#db` overrides the default storage engine
  * `Verimail#cipher(email, fn)` overrides the default sha1-based hasher
  * `Verimail#decipher(id, fn)` usually not needed, see details below
  * `Verimail#mailman` if you provide your own mail implementation
  * `Verimail#query(email, fn)` sends a verification message to the email
  * `Verimail#confirm(id, fn)` confirms an id without going through verimail.route

## prefix

The default prefix is `/verimail`. The default route is `/verimail/:id`.

## secret

This is used to salt the email addresses so that the sha1sum is difficult to predictable.

Here's the no-joke scenario:

Vladimir is being paid to spam links to body part size-enhancing drugs.

He finds a small, rarely used website with a form for sales support which
sends a confirmation message to the supplied e-mail address including the
contents of the form.

Without verimail, he can easily script a bot that will send confirmation
messages with links to these drugs.

With verimail (but an empty secret), he notices that the confirmation link
looks an aweful lot like a sha1sum so he sha1sums the email and, sure enough,
he can now generate verification links for any e-mail he wishes.

With verimail (and a secret), he can't figure out how the sha1sum is generated
and eventually gives up and moves on to another site.

```javascript
verimail.create({
      prefix: '/verimail'
    , secret: "any string you like, just make it long"
    , db: verifications
      // this is used by verimail to get the id from the email
    , cipher: function (cb, email) {
        // email = email.toLowerCase().replace(/\+.*@gmail/ig, '@gmail').replace(/\./ig, '')
        var hash = crypto.createHash('sha1').update(this.secret + email).digest('hex')
          ;

        this.db.set(hash, email);
        cb(null, hash);
      }
      // this is used by verimail to get the payload associated with the id
    , decipher: function (cb, id) {
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

connect.createServer()
  // GET `/verimail/:id` verifies :id
  .use(verimail.route)

  // Create your own route like-a so
  .use('/signup', function (req, res) {
    var email = (req.body||{}).email // 'john.doe@example.com'
      ;

    verimail.query(email, function (err, id, state) {
      if (err) {
        res.end('Error sending mail to ' + email + '. Please check your address and try again.');
        return;
      }

      // You should store the id somehow... (it's a one-way hash)
      console.log(id === Verimail.encode(email));
      console.log(state);
      res.end('Great, now go check your e-mail for verification');
    })
  })
  ;
```
