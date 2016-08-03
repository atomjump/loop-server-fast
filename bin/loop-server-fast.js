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
const querystring = require('querystring');


var httpsFlag = false;				//whether we are serving up https (= true) or http (= false)
var serverOptions = {};				//default https server options (see nodejs https module)
var listenPort = 3277;				//default listen port. Will get from the config readPort if it is set there
var msg = {};
var lang;
var units = [];			//time units


if((process.argv)&&(process.argv[2])){
  var loopServerConfig = process.argv[2];
} else {
  
  console.log("Usage: node loop-server-fast.js config/path/config.json config/path/messages.json [-production]");
  process.exit(0);
}




var config = JSON.parse(fs.readFileSync(loopServerConfig));



if((process.argv)&&(process.argv[3])){
  //Get the messages and ago constants
  var loopServerMessages = process.argv[3];
  msg = JSON.parse(fs.readFileSync(loopServerMessages));
  lang = msg.defaultLanguage;
  
  
  var time = msg.msgs[lang].time;
  units = [
    { name: time.second, plural: time.seconds, limit: 60, in_seconds: 1 },
    { name: time.minute, plural: time.minutes, limit: 3600, in_seconds: 60 },
    { name: time.hour, plural: time.hours, limit: 86400, in_seconds: 3600  },
    { name: time.day, plural: time.days, limit: 604800, in_seconds: 86400 },
    { name: time.week, plural: time.weeks, limit: 2629743, in_seconds: 604800  },
    { name: time.month, plural: time.months, limit: 31556926, in_seconds: 2629743 },
    { name: time.year, plural: time.years, limit: null, in_seconds: 31556926 }
  ];
  
  
} else {
   console.log("Usage: node loop-server-fast.js config/path/config.json config/path/messages.json [-production]");
  process.exit(0);
}


if((process.argv[4]) && (process.argv[4] == '-production')){
  var cnf = config.production;
} else {
  var cnf = config.staging;
}

//Use the port specified in the config
if(cnf.readPort) {
	listenPort = cnf.readPort;
}

//Create an https server if we specify a key and cert file
if(cnf.httpsKey) {
	//httpsKey should point to the key .pem file
	httpsFlag = true;
	if(!serverOptions.key) {
		serverOptions.key = fs.readFileSync(cnf.httpsKey);
		console.log("https key loaded");
	}
 }
			 
 if(cnf.httpsCert) {
	//httpsCert should point to the cert .pem file
	httpsFlag = true;
	if(!serverOptions.cert) {
		serverOptions.cert = fs.readFileSync(cnf.httpsCert);
		console.log("https cert loaded");
	}
	
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


function trimChar(string, charToRemove) {
    while(string.substring(0,1) == charToRemove) {
        string = string.substring(1);
    }

    while(string.slice(-1) == charToRemove) {
        string = string.slice(0, -1); 
    }

    return string;
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
        
        Sample session record
        | sgo3vosp1ej150sln9cvdslqm0 | 736     | 2016-06-09 16:04:03 | 2016-06-26 16:40:54 | view-count|i:1;logged-user|i:736;user-ip|s:15:"128.199.221.111";layer-group-user|s:0:"";authenticated-layer|s:3:"181";temp-user-name|s:7:"Anon 11";lat|i:51;lon|i:0; 
        */
        var keyValues = {};
        
        
        connection.query("SELECT * FROM php_session WHERE session_id='" + cleanData(sessionId) + "'", function(err, rows, fields) {
        	
        	if (err) throw err;
        	
        	if((rows[0])&&(rows[0].session_data)) {
        		var params = rows[0].session_data.split(";");
				for(var cnt=0; cnt< params.length; cnt++) {
				
					var paramData = params[cnt].split("|");
					if(paramData[1]) {
						//There is some data about this param
						var paramValues = paramData[1].split(":");
						if(paramValues[0] == 'i') {
							//An integer - value proceeds
							var paramValue = paramValues[1];
						} else {
							//A string, [1] is the string length, [2] is the string itself
							var paramValue = trimChar(paramValues[2], '"');
						}
						
						keyValues[paramData[0]] = paramValue;
						console.log("Key:" + paramData[0] + " = " + paramValue);
					} 		
				}
			}
			
			cb(keyValues);
		});

}



function httpHttpsCreateServer(options) {
	if(httpsFlag == true) {
		console.log("Starting https server.");
		https.createServer(options, handleServer).listen(listenPort);
		
		
	} else {
		console.log("Starting http server.");
		http.createServer(handleServer).listen(listenPort);
	}
	
}





function handleServer(_req, _res) {
	
	var req = _req;
	var res = _res;
	var body = [];
	
	//Start ordinary error handling
	req.on('error', function(err) {
	  // This prints the error message and stack trace to `stderr`.
	  console.error(err.stack);
	  
	  res.statusCode = 400;			//Error during transmission - tell the app about it
	  res.end();
	});
	
	req.on('data', function(chunk) {
		body.push(chunk);
	});

	req.on('end', function() {


		//A get request to pull from the server
		// show a file upload form
		console.log("Requesting: " + req.url);
		
		//It must include search-chat.php or it is ignored.
		if(req.url.indexOf("search-chat.php?") < 0) {
			res.writeHead(200, {'content-type': 'text/plain'});  
			res.end("Not available");
			return;
		}	
			
		var url = req.url.substring(req.url.indexOf("search-chat.php?") + 16);   //15 is length of 'search-chat.php'. We want the url as all the params after this. search-chat.php
		//is the current standard request entry point
		
		console.log("Parsed to query string:" + url);
		var params = querystring.parse(url);
		console.log("Query params = " + JSON.stringify(params));
		
		var cookies = parseCookies(req);
		params.sessionId = cookies.ses;		//This is our custom cookie. The other option would be PHPSESSID
		
		var jsonData = searchProcess(params, function(err, data) {
			if(err) {
				console.log(err);
				res.statusCode = 400;
				res.end();
			}
			
			//Prepare the result set for the jsonp result
			var strData = params.callback + "(" + JSON.stringify( data ) + ")"; 
			
			res.on('error', function(err){
				//Handle the errors here
				res.statusCode = 400;
				res.end();
			})

			  res.writeHead(200, {'content-type': 'text/plain'});  
	  
	  
			  res.end(strData, function(err) {
				  //Wait until finished sending, then delete locally
				  if(err) {
					 console.log(err);
				  } else {
					//success, do nothing
			
				   }
			  });
		});		//End of process
		
	});  //End of req end
	
}
	    
	  
function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}


function ago(mysqlTimeStr) {
   //Time ago
   // Split timestamp into [ Y, M, D, h, m, s ]
   //console.log(JSON.stringify(mysqlTimeStr));
   var recTime = new Date(mysqlTimeStr);
   console.log("recTime: " + JSON.stringify(recTime));
   var recTimeSecs = recTime.getTime();
   console.log("Rectimesecs = " + recTimeSecs);
  //Get diff in seconds 
  
   var nowSecs = new Date().getTime();
   var diff = (nowSecs - recTimeSecs) / 1000;
  
  var i = 0;
  var unit = {};
  while (unit = units[i++]) {
    if (diff < unit.limit || !unit.limit){
      var diff =  Math.floor(diff / unit.in_seconds);
      return diff + " " + (diff>1 ? unit.plural : unit.name);
    }
  }



}

function searchProcess(params, cb) {

	//Get the session data
	readSession(params.sessionId, function(session) {			//eg. 'sgo3vosp1ej150sln9cvdslqm0'
		console.log("Finished getting session data. Logged user:" + session['logged-user']);




		if((session['logged-user'])&&(session['logged-user'] != '')) {
			//Already logged in, but check if we know the ip address
			if((!session['user-ip'])||(session['user-ip'] == '')) {
				//No ip. - TODO will have to revert back to the PHP version
			} else {
			
				//We're good to make a db request
				
				//TODO increment and write the view-count session var.
				
				
				var layer = 3;
				var ip = "1.2.3.4";
				var userCheck = "";
				var initialRecords = 100;
				var outputJSON = {};
				var debug = false;

	
				//PHP
				//TODO: date_default_timezone_set($server_timezone);

				if((params.passcode) && (params.passcode != '')||((params.reading) && (params.reading != ''))) { 
				//TODO: forward to PHP
				/*$layer_info = $ly->get_layer_id($_REQUEST['passcode'], $_REQUEST['reading']);
				if($layer_info) {
					$layer = $layer_info['int_layer_id'];
				} else {
					//Create a new layer - TODO: don't allow layers so easily
					$layer = $ly->new_layer($_REQUEST['passcode'], 'public'); 
					
					//Given this is a new layer - the first user is the correct user
					$lg = new cls_login();
					$lg->update_subscriptions(clean_data($_REQUEST['whisper_site']), $layer);	
					
				}*/
				
				} else {	//End of passcode not = ''

					if(session['authenticated-layer']) {
						layer = session['authenticated-layer'];
					} else {
						layer = 1;		//Default to about layer
					}
				}

				if((params.units) && (params.units != '')) {
					units = params.units;
				}

				if((params.dbg) && (params.dbg == 'true')) {
					debug = true;
				} else {
					debug = false;
				}
			
				if(session['logged-user']) {
					userCheck = " OR int_author_id = " + session['logged-user'] + " OR int_whisper_to_id = " + session['logged-user']; 
			
				}
			
				if(session['logged-group-user']) {
					userChech = userCheck + " OR int_author_id = " + session['logged-group-user'] + " OR int_whisper_to_id = " + session['logged-group-user']; 
			
				}
			
				if((params.records) && (params.records < 100)) {
					initialRecords = 100;	//min this can be - needs to be about 4 to 1 of private to public to start reducing the number of public messages visible
				} else {
					if(params.records) {
						initialRecords = params.records;
					}
				}
			
			


				//TODO: $ip = $ly->getRealIpAddr();
				
			
			
				var sql = "SELECT * FROM tbl_ssshout WHERE int_layer_id = " + layer + " AND enm_active = 'true' AND (var_whisper_to = '' OR ISNULL(var_whisper_to) OR var_whisper_to ='" + ip + "' OR var_ip = '" + ip + "' " + userCheck + ") ORDER BY int_ssshout_id DESC LIMIT " + initialRecords;
				console.log("Query: " + sql);
			
				connection.query(sql, function(err, rows, fields) {
  
  
				  if (err) throw err;
  
				  //console.log(rows[0].var_shouted);

				  outputJSON.res = [];
				  outputJSON.ses = params.sessionId;
				  
				  
				  var mymaxResults = rows.length;
				  if(mymaxResults > params.records) {
					 mymaxResults = params.records;	//limit number to records requested
					 var more = true;   //show more flag for
				  }
				  var actualCnt = 0;
				  
				  
				
				  
				  for(var cnt = 0; cnt< rows.length; cnt++) {
				  
				  	  var whisper = true;		//default
				      var authorIP = rows[cnt].var_ip;
					  var authorUserID = rows[cnt].int_author_id;
					  var combinedAuthor = authorIP;
						if(authorUserID) {
							combinedAuthor = combinedAuthor +  ":" + authorUserID;
						}
				
						var whisperToIP = rows[cnt].var_whisper_to;
						var whisperToUserID = rows[cnt].int_whisper_to_id;
			
			
			
					//If no whispering, or are whispering but to the viewer's ip address, or from the viewer's own ip
					if((whisperToIP == '')||		//ie. public
					   ((whisperToIP == ip)&&(whisperToUserID == null))||	//private but no user id known
					   (whisperToUserID == session['logged-user'])||  //talk direct to owner
					   ((authorIP == ip)&&(authorUserID == null))||  				//authored by this ip no user known of author
					   (authorUserID == session['logged-user'])||						//authored by this viewer
					   ((session['logged-group-user'] != "")&&(whisperToUserID != "") && (whisperToUserID == session['logged-group-user']))) {				//private message to group
	
						//Right actually going to include message - now decide if whispering or public
						
						if(((whisperToIP == ip) && (whisperToUserID == null))||		//if it was a whisper intended for our ip but unknown user
								(whisperToUserID == session['logged-user'])||				//or a whisper specifically for us
						   ((authorIP == ip) && ((whisperToIP != '')||(whisperToUserID)))||  //or def a whisper by viewer
						   (authorUserID == session['logged-user'] && ((whisperToIP != '')|| (whisperToUserID)))) { //or a whisper by viewer logged in
							//This is a whisper to you or from you, use 1/3 font size
							whisper = true;
						} else {
							//A shout
							whisper = false;
						}
						
						if(session['logged-group-user']) {
							if(whisperToUserID == session['logged-group-user']) {
								whisper = true;
						
							}
						}
					
						if(!session['logged-user']) {
							//Force a blank user to see only public requests, until he has actually commented. 
							whisper = false;		
					
						}
						 
	
		
						var shade = rows[cnt].int_ssshout_id %2;
						if(layer == 0) {
							//Public layer
							if(shade == 0) {
								bgcolor = "public-light";  
							} else {
								bgcolor = "public-dark"; 
							}
						} else {
							//Private layer - different colours
							if(shade == 0) {
								bgcolor = "private-light"; 
							} else {
								bgcolor = "private-dark"; 
							}
		
						}
		
						//TODO: date_default_timezone_set($server_timezone); //E.g. "UTC" GMT"
						
						
						if(actualCnt <= mymaxResults) {			
				  
				  
				  
				  	
				  			var newEntry = {
				  				'text': rows[cnt].var_shouted_processed,
				  				'lat': rows[cnt].latitude,
				  				'lon': rows[cnt].longtiude,
				  				'dist': rows[cnt].dist,
				  				'ago': ago(rows[cnt].date_when_shouted),
				  				'whisper': whisper
				  			
				  			}
				  	
				  			outputJSON.res.push(newEntry);
				  			
				  			actualCnt ++;		//Increment the actual result count
				  		}
				  		
				  		
				  	}	//End of valid message					  
				  
				  }		//End of for loop

				  cb(null, outputJSON);			//No errors

				   	

  
				  //connection.end();

				
				});	//End of query
			}	//End of do have an ip
			
			
		} else {
			//Not logged in - TODO will have to revert back to the PHP version
			cb("Not logged in", null);
		
		}  
	
	
	});		//End of readSession


}







//Run at server startup
httpHttpsCreateServer(serverOptions);  

 