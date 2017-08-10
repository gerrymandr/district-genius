const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  geo: Object,
  text: String,
  created: Date,
  updated: Date,
  user: String,
  user_id: String,
  mapID: String
});

module.exports = mongoose.model('Comment', commentSchema);
