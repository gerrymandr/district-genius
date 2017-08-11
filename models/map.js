const mongoose = require('mongoose');

const mapSchema = mongoose.Schema({
  name: String,
  locality: String,
  organizer: String,
  created: Date,
  updated: Date,
  files: String,
  test: Boolean,
  state: String,
  district: Number
});

module.exports = mongoose.model('Map', mapSchema);
