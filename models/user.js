const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: String,
  localpass: String,
  state: String,
  foreign: Boolean,
  gerrymandered: String,
  test: Boolean
});

module.exports = mongoose.model('DistUser', userSchema);
