#!/usr/bin/env node
/*

Fast Loop-Server reader - runs an http server which accepts requests like the PHP software, and quickly reads the results ready for display on-screen.
To be used in the most common cases only (i.e. it doesn't handle bulk message downloads etc.)

The loop-server config.json contains the settings for this server.
Usage:  node loop-server-fast.js config/path/config.json [-production]


Testing https connection:    
openssl s_client -CApath /etc/ssl/certs -connect yourdomain.com:5566

*/



var multiparty = require('multiparty');
var http = require('http');
var https = require('https');
var util = require('util');
var path = require("path");
require("date-format-lite");
var mv = require('mv');
var fs = require('fs');
var exec = require('child_process').exec;
var drivelist = require('drivelist');
var uuid = require('node-uuid');
var fsExtra = require('fs-extra');
var request = require("request");
var needle = require('needle');
var readChunk = require('read-chunk'); // npm install read-chunk 
var imageType = require('image-type');
var shredfile = require('shredfile')();
var async = require('async');
var mysql = require('mysql');
var os = require('os');


if(process.argv[2]){
  var loopServerConfig = process.argv[2];
} else {
  
  console.log("Usage: node loop-server-fast.js config/path/config.json [-production]");
}




var config = JSON.parse(fs.readFileSync(loopServerConfig));

if((process.argv[3]) && (process.argv[3] == '-production')){
  var cnf = config.production;
} else {
  var cnf = config.staging;
}
 


var connection = mysql.createConnection({
  host     : cnf.db.hosts[0],
  user     : cnf.db.user,
  password : cnf.db.pass,
  database : cnf.db.name
});
 
connection.connect();


var layer = 3;
var ip = "1.2.3.4";
var userCheck = "";
var initialRecords = 50;

			
connection.query("SELECT * FROM tbl_ssshout WHERE int_layer_id = " + layer + " AND enm_active = 'true' AND (var_whisper_to = '' OR ISNULL(var_whisper_to) OR var_whisper_to ='" + ip + "' OR var_ip = '" + ip + "' " + userCheck + ") ORDER BY int_ssshout_id DESC LIMIT " + initialRecords, function(err, rows, fields) {
  
  
  if (err) throw err;
  
  console.log(rows[0].var_shouted);

  
  connection.end();
});
 