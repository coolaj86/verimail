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
  , callback: function (next, id, state) {
      // Now you can retrieve by the id
      console.log(state);

      // NOTE: If you fail to call next then the
      // item will be put back in the queue every time
      // the server is restarted.
      next();
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

# RESTful(ish) API

  * `GET /verimail`
  * `POST /verimail { email: "john.doe@mail.com" }`
  * `GET /verimail/:id`
  * `GET /verimail/:id/unsubscribe`

# Internal API

The API is kinda big because, well, you can replace any part of it.

As stated at the beginning, this is more of a wireframe with defaults.

Look at `examples/advanced.js` for a better picture of how it can work for you.

  * `Verimail.create(opts)`
    * `opts.host` the `host` protocol, name, and port, such as `https://example.com:3000`
    * `opts.mailer` the config options for node-mailer
    * `opts.prefix` to append to the http route instead of `/verimail`
  * `Verimail#hash` the default "cipher"
  * `Verimail#secret` for using the built-in sha1-based hasher. Chosen at random on first run (and stored in db) if not specified.
  * `Verimail#cipher(email, fn)` overrides the default sha1-based hasher
  * `Verimail#decipher(id, fn)` usually not needed, see details below
  * `Verimail#query(email, fn)` sends a verification message to the email
  * `Verimail#confirm(id, fn)` confirms an id without going through verimail.route
  * `Verimail#_db` overrides the default storage engine
  * `Verimail#_mailman` if you provide your own mail implementation

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

With verimail (and a known secret), he notices that the confirmation link
looks an aweful lot like a sha1sum so he sha1sums the email and, sure enough,
he can now generate verification links for any e-mail he wishes.

With verimail (and a secret secret), he can't figure out how the sha1sum is
generated and eventually gives up and moves on to another site.
