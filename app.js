// express setup
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const compression = require('compression');
const mongoose = require('mongoose');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// data models
const User = require('./models/user.js');
const Comment = require('./models/comment.js');

// MongoDB connection
console.log('Connecting to MongoDB (required)');
mongoose.connect(process.env.MONGOLAB_URI || process.env.MONGODB_URI || 'localhost');

// more Express server setup
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express['static'](__dirname + '/static'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());
app.use(cookieParser());
app.use(session({
  store: new MongoStore({
    mongooseConnection: mongoose.connection
  }),
  secret: process.env.SESSION || 'fj23f90jfoijfl2mfp293i019eoijdoiqwj129',
  resave: false,
  saveUninitialized: false
}));

/* for use in testing only */
function passThrough(req, res, next) {
  if (typeof global.it === 'function') {
    if (req.method === 'POST') {
      next();
    } else {
      return csrfProtection(req, res, next);
    }
  } else {
    throw 'passThrough happening in production';
  }
}
const middleware = ((typeof global.it === 'function') ? passThrough : csrfProtection);

// user registration and management
require('./login')(app, middleware);

// main page / maps page
app.get('/', middleware, (req, res) => {
  res.render('index', {
    csrfToken: req.csrfToken(),
    currentUser: (req.user || {}),
    comments: []
  });
});

app.get('/comments', middleware, (req, res) => {
  Comment.find({}, (err, comments) => {
    res.render('index', {
      csrfToken: req.csrfToken(),
      currentUser: (req.user || {}),
      comments: comments
    });
  });
});

app.get('/comments/:mapid', middleware, (req, res) => {
  Map.findById(req.params.mapid, (err, map) => {
    if (err) {
      return res.json(err);
    }
    if (!map) {
      return res.json({ error: 'no such map' });
    }
    Comment.find({ mapID: req.params.mapid }, (err, comments) => {
      if (err) {
        return res.json(err);
      }

      res.render('index', {
        csrfToken: req.csrfToken(),
        currentUser: (req.user || {}),
        comments: comments
      });
    });
  });
});


// saving a comment (for known users)
app.post('/comment', middleware, (req, res) => {
  User.findById(req.body.user_id, (err, user) => {
    if (err) {
      return res.json(err);
    }
    if (!user) {
      return res.json({ error: 'no user' });
    }

    // make a district item
    var d = new Comment({
      geo: JSON.parse(req.body.district),
      text: req.body.text,
      user: user.username,
      user_id: req.body.user_id,
      created: new Date(),
      updated: new Date()
    });
    d.save((err) => {
      if (err) {
        return res.json(err);
      }
      res.json(d);
    });
  });
});

// start the server
app.listen(process.env.PORT || 8080, () => {
  console.log('app is running');
});

module.exports = app;
