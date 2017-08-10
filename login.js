const crypto = require('crypto');

// Passport login modules
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// my user model
const User = require('./models/user');

// via https://gist.github.com/skeggse/52672ddee97c8efec269

var config = {
  // size of the generated hash
  hashBytes: 32,
  // larger salt means hashed passwords are more resistant to rainbow table, but
  // you get diminishing returns pretty fast
  saltBytes: 16,
  // more iterations means an attacker has to take longer to brute force an
  // individual password, so larger is better. however, larger also means longer
  // to hash the password. tune so that hashing the password takes about a
  // second
  iterations: 872791
};

function hashPassword(password, callback) {
  // generate a salt for pbkdf2
  crypto.randomBytes(config.saltBytes, function(err, salt) {
    if (err) {
      return callback(err);
    }

    crypto.pbkdf2(password, salt, config.iterations, config.hashBytes, 'sha512', function(err, hash) {

      if (err) {
        return callback(err);
      }

      var combined = new Buffer(hash.length + salt.length + 8);

      // include the size of the salt so that we can, during verification,
      // figure out how much of the hash is salt
      combined.writeUInt32BE(salt.length, 0, true);
      // similarly, include the iteration count
      combined.writeUInt32BE(config.iterations, 4, true);

      salt.copy(combined, 8);
      hash.copy(combined, salt.length + 8);
      callback(null, combined);
    });
  });
}

function verifyPassword(password, combined, callback) {
  // extract the salt and hash from the combined buffer
  var saltBytes = combined.readUInt32BE(0);
  var hashBytes = combined.length - saltBytes - 8;
  var iterations = combined.readUInt32BE(4);
  var salt = combined.slice(8, saltBytes + 8);
  var hash = combined.toString('hex', saltBytes + 8);

  // verify the salt and hash against the password
  crypto.pbkdf2(password, salt, iterations, hashBytes, 'sha512', function(err, verify) {
    if (err) {
      return callback(err, false);
    }
    callback(null, (verify.toString('hex') === hash));
  });
}

function userSetup(app, middleware) {
  // Passport module setup
  app.use(passport.initialize());
  app.use(passport.session());

  if (typeof global.it === 'function') {
    /* in a test */
  }

  passport.use(new LocalStrategy(function(username, password, cb) {
    User.findOne({ username: username.toLowerCase() }, (err, user) => {
      if (err) {
        return cb(err);
      }
      if (!user) {
        return cb(null, false);
      }

      verifyPassword(password, Buffer.from(user.localpass, 'hex'), (err, verified) => {
        if (err) {
          return cb(err);
        }
        if (!verified) {
          return cb(null, false);
        }
        return cb(null, user);
      });
    });
  }));

  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  passport.deserializeUser(function(obj, done) {
    done(null, obj);
  });

  // user registration form
  app.get('/register', middleware, (req, res) => {
    res.render('register', {
      user: req.user,
      csrfToken: req.csrfToken()
    });
  });

  // user login form
  app.get('/login', middleware, (req, res) => {
    res.render('login', {
      csrfToken: req.csrfToken()
    });
  });

  app.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), middleware, (req, res) => {
    res.redirect('/');
  });

  app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/?loggedout');
  });

  // respond to user POST
  app.post('/register', middleware, (req, res) => {
    User.findOne({ name: req.body.username.toLowerCase() }, (err, user) => {
      if (err) {
        return res.json(err);
      }
      if (user) {
        return res.json({ error: 'user already exists with that name' });
      }

      hashPassword(req.body.password, (err, combined) => {
        if (err) {
          return res.json(err);
        }

        var u = new User({
          username: req.body.username.toLowerCase().replace(/\s/g, ''),
          localpass: combined.toString('hex'),
          test: false,
          state: req.body.state,
          foreign: (req.body.foreign === 'on'),
          gerrymandered: req.body.gerrymander
        });
        u.save(function (err) {
          if (err) {
            return printError(err, res);
          }
          res.redirect('/login?user=' + u.username);
        });
      });
    });
  });

  // local oauth test
  app.post('/auth/local', passport.authenticate('local', { failureRedirect: '/login?fail=true' }), (req, res) => {
    if (req.user.name === 'unset') {
      res.redirect('/register');
    } else {
      res.redirect('/');
    }
  });
}

module.exports = userSetup;
