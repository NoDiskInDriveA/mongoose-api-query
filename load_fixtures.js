var fs = require('fs')
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/mongoose-api-query', {useNewUrlParser: true});
var Monster = require('./model');
var monsters = require('./fixtures');

console.log(monsters)

Monster.collection.remove({});

var addMonsters = function (monsters) {
  var n = new Monster(monsters.shift());
  n.save(function(){
    if (monsters.length === 0) {
      process.exit()
    } else {
      addMonsters(monsters);
    }
  });
}

addMonsters(monsters);