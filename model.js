var mongoose = require('mongoose');
var mongooseApiQuery = require('./lib/mongoose-api-query');

mongoose.set('debug', true);

var monsterSchema = new mongoose.Schema({
  name: String,
  title: {
    type: String,
    required: false
  },
  tax_identification_no: {
    type: Number,
    required: false
  },
  monster_identification_no: Number,
  monster_object_id: mongoose.Schema.ObjectId,
  eats_humans: Boolean,
  foods: [ new mongoose.Schema({
    name: String,
    vegetarian: Boolean,
    calories: Number
  })],
  vegetarian: {
    type: Boolean,
    required: false
  },
  vegan_since: {
    type: Date,
    required: false
  },
  loc: Array,
  data: {}
});

monsterSchema.index({'loc':'2d'});
monsterSchema.plugin(mongooseApiQuery);

module.exports = mongoose.model('Monster', monsterSchema);