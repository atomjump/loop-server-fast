var mysql = require('mysql');

var connection = mysql.createConnection({
  host : 'localhost',
  user     : cnf.db.user,
  password : cnf.db.pass,
  ssl  : {
    ca : fs.readFileSync(__dirname + '/mysql-ca.crt')
  }
});


