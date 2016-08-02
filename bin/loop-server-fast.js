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

var sessionData;




if(process.argv[2]){
  var loopServerConfig = process.argv[2];
} else {
  
  console.log("Usage: node loop-server-fast.js config/path/config.json [-production]");
  exit(0);
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


function cleanData(str)
{
	//TODO clean for database requests
	return str;
}

function readSession(sessionId, cb)
{
	
		/*     	$sql = "SELECT * FROM php_session WHERE session_id='" .clean_data($session_id) ."'";
        $result = dbquery($sql)  or die("Unable to execute query $sql " . dberror());
		while($row = db_fetch_array($result))
		{
          	$fieldarray[] = $row;
        }
        

        
        if (isset($fieldarray[0]['session_data'])) {
            $this->fieldarray = $fieldarray[0];
             
            return $fieldarray[0]['session_data'];
        } else {
            
            return '';  // return an empty string
        } // if
        */
        var keyValues = {};
        
        
        connection.query("SELECT * FROM php_session WHERE session_id=" + cleanData(sessionId), function(err, rows, fields) {
        	
        	if (err) throw err;
        	
        	if((rows[0])&&(rows[0].session_data)) {
        		var params = rows[0].session_data.split(";");
				foreach(params as param) {
					var paramData = param.split("|");
					if(paramData[1]) {
						//There is some data about this param
						var paramValues = paramData[1].split(":");
						var paramValue = paramValues[2];
						
						keyValues.paramData[0] = paramValue;
					} 		
				}
			}
			
			cb(keyValues);
		});

}






var layer = 3;
var ip = "1.2.3.4";
var userCheck = "";
var initialRecords = 50;


//Get the session data
readSession('sgo3vosp1ej150sln9cvdslqm0', function(session) {
	console.log("Finished. Logged user:");
	console.log(session['logged-user']);


});



			
connection.query("SELECT * FROM tbl_ssshout WHERE int_layer_id = " + layer + " AND enm_active = 'true' AND (var_whisper_to = '' OR ISNULL(var_whisper_to) OR var_whisper_to ='" + ip + "' OR var_ip = '" + ip + "' " + userCheck + ") ORDER BY int_ssshout_id DESC LIMIT " + initialRecords, function(err, rows, fields) {
  
  
  if (err) throw err;
  
  console.log(rows[0].var_shouted);

  
  connection.end();
});
 