const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  geo: Object,
  text: String,
  created: Date,
  updated: Date,
  user: String,
  user_id: String,
  mapID: String,
  test: Boolean
});

module.exports = mongoose.model('Comment', commentSchema);
