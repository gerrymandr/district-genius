// express setup
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const compression = require('compression');
const mongoose = require('mongoose');
const request = require('request');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// data models
const User = require('./models/user');
const Comment = require('./models/comment');
const Map = require('./models/map');

// MongoDB connection
console.log('Connecting to MongoDB (required)');
mongoose.connect(process.env.MONGOLAB_URI || process.env.MONGODB_URI || 'localhost');

// more Express server setup
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
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
  Comment.find({ mapID: '598dbcf59f755e00117f9c3d' }, (err, comments) => {
    res.render('index', {
      csrfToken: req.csrfToken(),
      currentUser: (req.user || {}),
      comments: comments,
      map: { _id: '598dbcf59f755e00117f9c3d', state: 'PA', district: 1 }
    });
  });
});

app.post('/find', middleware, (req, res) => {
  request("https://www.googleapis.com/civicinfo/v2/voterinfo?electionId=2000&key=" + process.env.API_KEY + "&address=" + req.body.address, (err, resp, body) => {
    if (err) {
      return res.json(err);
    }
    var jbod = JSON.parse(body);
    if (!jbod.contests || !jbod.contests.length) {
      return res.json({ error: 'I don\'t know that address.' });
    }
    try {
      for (var c = 0; c < jbod.contests.length; c++) {
        if (jbod.contests[c].roles[0] === 'legislatorLowerBody') {
          var code = jbod.contests[c].district.id.split('/');
          var state = code[2].split(':')[1];
          var dnum = (code.length === 3) ? 0 : code[3].split(':')[1];
          return res.redirect('/map/' + state.toUpperCase() + '-' + dnum);
        }
      }
    } catch(e){ }
    return res.json({ error: 'I understand that address, but it might not be specific enough to know your Representative. Please try again with: house number, street, city, state.' });
  });
});

app.get('/map/:mapid', middleware, (req, res) => {
  var finder = {};
  if (req.params.mapid.indexOf('-') > -1) {
    // STATE-DISTRICT num, PA-1, AK-0
    finder.state = req.params.mapid.split('-')[0].toUpperCase();
    finder.district = req.params.mapid.split('-')[1] * 1;
  } else {
    // direct finder
    finder._id = req.params.mapid;
  }
  Map.findOne(finder, (err, map) => {
    if (err) {
      return res.json(err);
    }
    if (!map) {
      if (req.params.mapid.indexOf('-') > -1) {
        // just make the standard district map
        var m = new Map({
          name: req.params.mapid.toUpperCase(),
          locality: req.params.mapid.toUpperCase(),
          organizer: 'MGGG',
          created: new Date(),
          updated: new Date(),
          test: false,
          state: finder.state,
          district: finder.district
        });
        m.save((err) => {
          if (err) {
            return res.json(err);
          }
          res.redirect('/map/' + req.params.mapid + '')
        });
        return;
      }
      return res.json({ error: 'no such map' });
    }
    Comment.find({ mapID: map._id }, (err, comments) => {
      if (err) {
        return res.json(err);
      }

      res.render('index', {
        csrfToken: req.csrfToken(),
        currentUser: (req.user || {}),
        comments: comments,
        map: map
      });
    });
  });
});

// list of recent comments
app.get('/comments', (req, res) => {
  Comment.find({}).select('text user mapID created').sort('-created').limit(10).exec((err, comments) => {
    return res.json(err || comments);
  });
});

// saving a comment (for known users)
app.post('/comment', middleware, (req, res) => {
  function madeComment(user) {
    // make a district item
    var d = new Comment({
      geo: JSON.parse(req.body.district),
      text: req.body.text,
      user: user.username,
      user_id: req.body.user_id,
      created: new Date(),
      updated: new Date(),
      test: false,
      mapID: req.body.mapID
    });
    d.save((err) => {
      if (err) {
        return res.json(err);
      }
      res.json(d);
    });
  }

  if (req.user) {
    User.findById(req.body.user_id, (err, user) => {
      if (err) {
        return res.json(err);
      }
      if (!user) {
        return res.json({ error: 'no user' });
      }
      madeComment(user);
    });
  } else {
    madeComment({ username: 'anonymous' });
  }
});

// admin upload of files concept
var admins = ['aaa', 'mapmeld'];
app.get('/upload', middleware, (req, res) => {
  if (admins.indexOf(req.user.username) === -1) {
    return res.json({ error: 'user is not admin - work in progress' });
  }
  res.render('upload', {
    csrfToken: req.csrfToken()
  });
});

app.post('/upload', middleware, (req, res) => {
  if (admins.indexOf(req.user.username) === -1) {
    return res.json({ error: 'user is not admin - work in progress' });
  }
  var m = new Map({
    name: 'Test',
    locality: 'Philadelphia',
    organizer: 'MGGG',
    created: new Date(),
    updated: new Date(),
    files: 'dunno',
    test: false
  });
  m.save((err) => {
    if (err) {
      return res.json(err);
    }
    res.redirect('/comments/' + m._id);
  });
});

// start the server
app.listen(process.env.PORT || 8080, () => {
  console.log('app is running');
});

module.exports = app;
