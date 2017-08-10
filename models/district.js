const mongoose = require('mongoose');

const districtSchema = mongoose.Schema({
  geo: Object,
  text: String,
  created: Date,
  updated: Date,
  user: String,
  user_id: String
});

module.exports = mongoose.model('District', districtSchema);
