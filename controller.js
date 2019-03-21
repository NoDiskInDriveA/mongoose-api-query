var Monster = require('./model');

module.exports = function(req, res){
console.log(req.query)
Monster.apiQuery(req.query).exec(function(err, monsters) {
  res.send(monsters);
});

};