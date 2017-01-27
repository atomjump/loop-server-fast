#!/usr/bin/env node
/*

Fast Loop-Server reader - runs an http server which accepts requests like the PHP software, and quickly reads the results ready for display on-screen.
To be used in the most common cases only (i.e. it doesn't handle bulk message downloads etc.)

The loop-server config.json contains the settings for this server.
Usage:  node loop-server-fast.js config/path/config.json [-production]


Testing https connection:    
openssl s_client -CApath /etc/ssl/certs -connect yourdomain.com:5566


Possible future project:
Implement a mysql connection pool ala:
https://codeforgeek.com/2015/01/nodejs-mysql-tutorial/

However, this may not be necessary - we already have multi-core handled by pm2, and we are one connection per
database, but the requests are async. 

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
var fsExtra = require('fs-extra');
var request = require("request");
var needle = require('needle');
var readChunk = require('read-chunk'); // npm install read-chunk 
var async = require('async');
var mysql = require('mysql');
var os = require('os');
const querystring = require('querystring');
var crypto = require('crypto');
var get_ip = require('ipware')().get_ip;


var httpsFlag = false;				//whether we are serving up https (= true) or http (= false)
var serverOptions = {};				//default https server options (see nodejs https module)
var listenPort = 3277;				//default listen port. Will get from the config readPort if it is set there
var msg = {};
var lang;
var timeUnits;			//time units
var verbose = false;
var currentDbServer = [];
currentDbServer[0] = 0;
var usage = "Usage: node loop-server-fast.js config/path/config.json config/path/messages.json [-production]\n\nOr:\n\nnpm config set loop-server-fast:configFile /path/to/your/loop/server/config.json\nnpm config set loop-server-fast:messagesFile /path/to/your/loop/server/messages.json\n[npm config set loop-server-fast:production true]\nnpm run start\n\n";
var defaultPHPScript = "search-chat.php?";
var defaultPHPScriptLen = defaultPHPScript.length;


if((process.argv)&&(process.argv[2])){
  var loopServerConfig = process.argv[2];
} else {
  if(process.env.npm_package_config_configFile) {
  	 var loopServerConfig = process.env.npm_package_config_configFile;
  } else {
  
  		console.log(usage);
  		process.exit(0);
  }
}




var config = JSON.parse(fs.readFileSync(loopServerConfig));
if(!config) {
     console.log("Couldn't find config file " + loopServerConfig);
  	 process.exit(0);
}


if(((process.argv)&&(process.argv[3]))||(process.env.npm_package_config_messagesFile)){
  //Get the messages and ago constants
  if(process.argv[3]) {
  	var loopServerMessages = process.argv[3];
  } else {
  	//Get from the npm config
  	var loopServerMessages = process.env.npm_package_config_messagesFile;
  }
  msg = JSON.parse(fs.readFileSync(loopServerMessages));
  if(!msg) {
     console.log("Couldn't find messages file " + loopServerMessages);
  	 process.exit(0);
  }
  lang = msg.defaultLanguage;
  
  
  var time = msg.msgs[lang].time;
  timeUnits = [
    { name: time.second, plural: time.seconds, limit: 60, in_seconds: 1 },
    { name: time.minute, plural: time.minutes, limit: 3600, in_seconds: 60 },
    { name: time.hour, plural: time.hours, limit: 86400, in_seconds: 3600  },
    { name: time.day, plural: time.days, limit: 604800, in_seconds: 86400 },
    { name: time.week, plural: time.weeks, limit: 2629743, in_seconds: 604800  },
    { name: time.month, plural: time.months, limit: 31556926, in_seconds: 2629743 },
    { name: time.year, plural: time.years, limit: null, in_seconds: 31556926 }
  ];
  
  
} else {
   console.log(usage);
  process.exit(0);
}


if((process.argv[4]) && (process.argv[4] == '-production')){
  var cnf = config.production;
} else {
  if(process.env.npm_package_config_production) {
  	if(process.env.npm_package_config_production == 'true') {
  		var cnf = config.production;
  	} else {
  		var cnf = config.staging;
  	}
  
  } else {
  	var cnf = config.staging;
  }
}

//Configurable verbose variable
if(process.env.npm_package_config_verbose) {
	if(process.env.npm_package_config_verbose == 'true') {
		verbose = true;
	} else {
		verbose = false;
	}
	
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
 
 var connections = [];
 
 
 function handleDisconnect() {
 
 	//Check for a different database
 	/*
 			if((isset($db_cnf['scaleUp']))&&(isset($layer_name))) {	
			//We are scaling up
			for($cnt = 0; $cnt< count($db_cnf['scaleUp']); $cnt ++) {	
				if(preg_match($db_cnf['scaleUp'][$cnt]['labelRegExp'],$layer_name, $matches) == true) {
					//Override with this database					
					$db_cnf = $db_cnf['scaleUp'][$cnt];
					return;
				}

			}
		}
 	*/
 	
 	
 
 	//Reconnect to all db hosts
 	connections[0] = {};
	for(var cnt = 0; cnt< cnf.db.hosts.length; cnt++) {

		connections[0][cnt] = mysql.createConnection({
		  host     : cnf.db.hosts[cnt],
		  user     : cnf.db.user,
		  password : cnf.db.pass,
		  database : cnf.db.name
		});
 
		//connections[cnt].connect();
		connections[0][cnt].connect(function(err) {              // The server is either down
			if(err) {                                     // or restarting (takes a while sometimes).
			  console.log('error when connecting to db:', err);
			  setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
			}                                     // to avoid a hot loop, and to allow our node script to
		  });                                     // process asynchronous requests in the meantime.
											  // If you're also serving http, display a 503 error.
		 connections[0][cnt].on('error', function(err) {
			console.log('db error: ', err);
			if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
			  //Close and restart all the connections
			  for(var ccnt = 0; ccnt< cnf.db.hosts.length; ccnt++) {
			  		connections[0][ccnt].end();
			  }
			  
			  handleDisconnect();                         // lost due to either server restart, or a
			} else {                                      // connnection idle timeout (the wait_timeout
			  throw err;                                  // server variable configures this)
			}
		  });


	}
	
	if(cnf.db.scaleUp) {
		//Create more connections
 		for(var scaleCnt = 0; scaleCnt< cnf.db.scaleUp.length; scaleCnt++) {
 		
 			connections[scaleCnt+1] = {};
 			dbCnf = cnf.db.scaleUp[scaleCnt];
 		
			for(var cnt = 0; cnt< dbCnf.hosts.length; cnt++) {

				connections[scaleCnt+1][cnt] = mysql.createConnection({
				  host     : dbCnf.hosts[cnt],
				  user     : dbCnf.user,
				  password : dbCnf.pass,
				  database : dbCnf.name
				});
 
				//connections[cnt].connect();
				connections[scaleCnt+1][cnt].connect(function(err) {              // The server is either down
					if(err) {                                     // or restarting (takes a while sometimes).
					  console.log('error when connecting to db:', err);
					  setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
					}                                     // to avoid a hot loop, and to allow our node script to
				  });                                     // process asynchronous requests in the meantime.
													  // If you're also serving http, display a 503 error.
				 connections[scaleCnt+1][cnt].on('error', function(err) {
					console.log('db error: ', err);
					if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
					  //Close and restart all the connections
					  for(var ccnt = 0; ccnt< cnf.db.hosts.length; ccnt++) {
							connections[scaleCnt+1][ccnt].end();
					  }
			  
					  handleDisconnect();                         // lost due to either server restart, or a
					} else {                                      // connnection idle timeout (the wait_timeout
					  throw err;                                  // server variable configures this)
					}
				  });


			}
		}
 		
 	}

 
}
 
handleDisconnect();

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}


function cleanData(str)
{
	//Clean for database requests
	return escapeRegExp(str);
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




function readSession(params, cb)
{
	
		/* 
        
        Sample session record
        | sgo3vosp1ej150sln9cvdslqm0 | 736     | 2016-06-09 16:04:03 | 2016-06-26 16:40:54 | view-count|i:1;logged-user|i:736;user-ip|s:15:"128.199.221.111";layer-group-user|s:0:"";authenticated-layer|s:3:"181";temp-user-name|s:7:"Anon 11";lat|i:51;lon|i:0; 
        */
        var keyValues = {};
        
        if(verbose == true) console.log("SessionID" + cleanData(params.sessionId));
        
        params.connection.query("SELECT * FROM php_session WHERE session_id='" + cleanData(params.sessionId) + "'", function(err, rows, fields) {
        	
        	if (err) {
        		console.log("Database error:" + err);
        		cb(null);
        	} else {
        		
        	
				if((rows[0])&&(rows[0].session_data)) {
				
					if(verbose == true) console.log("Session data:" + rows[0].session_data);
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
							if(verbose == true) console.log("Key:" + paramData[0] + " = " + paramValue);
						} 		
					}
				}
			
				cb(keyValues);
			}
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
		if(verbose == true) console.log("Requesting: " + req.url);
		
		//It must include search-chat.php or it is ignored.
		if(req.url.indexOf(defaultPHPScript) < 0) {
			res.writeHead(200, {'content-type': 'text/html'});  
			res.end("Not available");
			return;
		}	
			
		var url = req.url.substring(req.url.indexOf(defaultPHPScript) + defaultPHPScriptLen);   //16 is length of 'search-chat.php'. We want the url as all the params after this. search-chat.php
		//is the current standard request entry point
		
		if(verbose == true) console.log("Parsed to query string:" + url);
		var params = querystring.parse(url);
		if(verbose == true) console.log("Query params = " + JSON.stringify(params));
		
		var cookies = parseCookies(req);
		params.sessionId = cookies.PHPSESSID;		//This is our custom cookie. 
		if(!params.sessionId) {
			res.statusCode = 400;			//Error - tell the app about it
	  		res.end();
			console.log("Error: You must include a PHP Session ID");
			return;
			
		}
		
		params.ip = getFakeIpAddress(params.sessionId);
		
		//Choose a random db connection
		params.connection = connections[0][currentDbServer];
		
		//Round robin the connection
		currentDbServer[0] ++;
		if(currentDbServer >= cnf.db.hosts.length) currentDbServer[0] = 0;
		
		//Double up on this
		var myres = res;
		
		var jsonData = searchProcess(params, function(err, data) {
			if(err) {
				if(err == 'PHP') {
					//Call the PHP version of this script
					
					var fullUrl = cnf.webRoot + '/' + defaultPHPScript + url;  
					if(verbose == true) console.log("Webroot:" + cnf.webRoot + "  Default PHP script:" + defaultPHPScript + " Url:" + url + " fullUrl:" + fullUrl);
					callPHP(fullUrl, myres);
					return;
				}
			
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

			  res.writeHead(200, {'content-type': 'text/html'});  
	  
	  
			  res.end(strData, function(err) {
				  //Wait until finished sending, then delete locally
				  if(err) {
					 console.log(err);
				  } else {
					//success, do nothing
					process.stdout.write(".");  	//Show successful pings
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


function ago(timeStr) {
    
   
   
   //console.log(JSON.stringify(mysqlTimeStr));
   var recTime = new Date(timeStr);
   var recTimeSecs = recTime.getTime();
  //Get diff in seconds 
  
   var nowSecs = new Date().getTime();
   var diff = (nowSecs - recTimeSecs) / 1000;
  
  var i = 0;
  var unit = {};
  while (unit = timeUnits[i]) {
    if ((diff < unit.limit) || (!unit.limit)){
      var diff =  Math.round(diff / unit.in_seconds);		//was floor
      var timeOut = diff + " " + (diff>1 ? unit.plural : unit.name) + " ago";
      return timeOut;
    }
    i++;
  }
  
  return "Unknown";



}

function md5(data) {

	return crypto.createHash('md5').update(data).digest("hex");
}


function getFakeIpAddress(sessionId) {
	//This is a copy of the PHP version - it creates an ip with 192.a.b.c where
	//a = ASCII value of sessionId's first character
	//b = ASCII value of sessionId's second character
	//c = ASCII value of sessionId's third character
    
    if(sessionId) {
		var ip = "192." + parseInt(sessionId.charCodeAt(0)) + "." +
						parseInt(sessionId.charCodeAt(1)) + "." +
						parseInt(sessionId.charCodeAt(2));
		return ip;
	} else {
		//OK, so we don't have a session id - use a fixed random ip
		return "192.168.10.10";	
	}
}

function getRealIpAddress(req) {

	var ip_info = get_ip(req);

	return ip_info.clientIp.replace(/^[0-9.,]+$/,"");
}





function callPHP(url, res) {
	//Reads in from the PHP script url for a .jsonp response (plain text)
	//and write it out to the requester
        if(verbose == true) console.log("Redirecting to " + url);
        
	res.writeHead(302, {
	  'Location': url
	  //add other headers here...
	});
	res.end();
	

}



function foundLayer(params,
					 session, 
					 layer, 
					 ip, 
					 userCheck, 
					 initialRecords, 
					 outputJSON, 
					 debug, 
					 cb)  {

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
			userCheck = userCheck + " OR int_author_id = " + session['logged-group-user'] + " OR int_whisper_to_id = " + session['logged-group-user']; 
	
		}
	
		if((params.records) && (params.records < 100)) {
			initialRecords = 100;	//min this can be - needs to be about 4 to 1 of private to public to start reducing the number of public messages visible
		} else {
			if(params.records) {
				initialRecords = params.records;
			}
		}
	
	


		
		
	
	
		var sql = "SELECT * FROM tbl_ssshout WHERE int_layer_id = " + layer + " AND enm_active = 'true' AND (var_whisper_to = '' OR ISNULL(var_whisper_to) OR var_whisper_to ='" + ip + "' OR var_ip = '" + ip + "' " + userCheck + ") ORDER BY date_when_shouted DESC LIMIT " + initialRecords;
		if(verbose == true) console.log("Query: " + sql);
	
		params.connection.query(sql, function(err, rows, fields) {


		  if (err) {
		  
		  	console.log("Database query error:" + err);
		  	cb(err, null);
		  	return;
		  }


		  outputJSON.res = [];
		  outputJSON.ses = params.sessionId;
		  
		  
		  var mymaxResults = rows.length;
		  if(mymaxResults > params.records) {
			 mymaxResults = params.records;	//limit number to records requested
			 var more = true;   //show more flag for
		  }
		  var actualCnt = 0;
		  
		  //Exit early with no results on no layer access
		  if((session['access-layer-granted'])&&(session['access-layer-granted'] !== "true")
		  		&&(session['access-layer-granted'] != true)) {
		  	if((session['access-layer-granted'] == 'false') || (session['access-layer-granted'] != layer)) {
		  		outputJSON.res = [];		//No results
		  		cb(null, outputJSON);			//No errors
		  		return;
		  	}
		  }
		  
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

				//In PHP here? date_default_timezone_set($server_timezone); //E.g. "UTC" GMT"
				
				
				if(actualCnt <= mymaxResults) {			
		  
		  
		  
			
					var newEntry = {
						'id': rows[cnt].int_ssshout_id,
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

		
		});	//End of query


}


function checkScaleupHorizontally(layerName, params) {

	console.log("Layer Name:" + layerName);

	if(cnf.db.scaleUp) {
		//Create more connections
 		for(var scaleCnt = 0; scaleCnt< cnf.db.scaleUp.length; scaleCnt++) {
			if(layerName.search(cnf.db.scaleUp[scaleCnt].labelRegExp) >= 0) {
				//OK switch over to this db connection
				//Choose a random db connection
				params.connection = connections[scaleCnt+1][currentDbServer];
		
				console.log("Connections Scaled to:" + scaleCnt);
		
				//Round robin the connection
				currentDbServer[scaleCnt+1] ++;
				if(currentDbServer >= cnf.db.scaleUp[scaleCnt].hosts.length) currentDbServer[scaleCnt+1] = 0;
				return;
			}
		}
 	}
 	
 	return;
}



function searchProcess(params, cb) {

	//Get the session data
	readSession(params, function(session) {			//eg. 'sgo3vosp1ej150sln9cvdslqm0'
		if(verbose == true) console.log("Finished getting session data. Logged user:" + session['logged-user']);




		if((session)&&(session['logged-user'])&&(session['logged-user'] != '')) {
			//Already logged in, but check if we know the ip address
			if((!session['user-ip'])||(session['user-ip'] == '')) {
				//No ip. Will have to revert back to the PHP version
				console.log('No ip. Going to PHP');
				cb("PHP", null);
				return;
			} else {
			
				//We're good to make a db request
				
				//If this is the first request this session, we need to use the PHP
				//version to ensure we have registered the count
				if(session['view-count'] == 0) {
					console.log("view-count = " + session['view-count'] + " Going to PHP");
					cb("PHP", null);
					return;
				}
				
				var layer = 1;
				var ip = params.ip;
				var userCheck = "";
				var initialRecords = 100;
				var outputJSON = {};
				var debug = false;

	
				if((params.passcode) && (params.passcode != '')||((params.reading) && (params.reading != ''))) { 
					
					//See if we need to switch to a different db connection based off the layer name
					checkScaleupHorizontally(params.passcode, params);
					
					var sql = "SELECT int_layer_id FROM tbl_layer WHERE passcode = '" + md5(params.passcode) + "'";
					
					params.connection.query(sql, function(err, rows, fields) {
					
						if(err) {
							console.log("Database error: " + err);
							return;
						} else {
							if((rows)&&(rows[0])) {
								layer = rows[0].int_layer_id;
								
								foundLayer(params, session, layer, ip, userCheck, initialRecords, outputJSON, debug, cb);
							} else {
								console.log("No layer " + md5(params.passcode) + " - likely new. Going to PHP");
								cb("PHP", null);
								return;
								//Unknown or new layer - head back to PHP
								
							
							}
						}
					});
					
					
					

					
				
				} else {	//End of passcode not = ''

					if(session['authenticated-layer']) {
						layer = session['authenticated-layer'];
					} else {
						layer = 1;		//Default to about layer
					}
					
					foundLayer(params, session, layer, ip, userCheck, initialRecords, outputJSON, debug, cb);
				}
	
				
			}	//End of do have an ip
			
			
		} else {
			//Not logged in - revert back to the PHP version
			console.log("Not logged in - back to PHP version");
			cb("PHP", null);
			return;
		
		}  
	
	
	});		//End of readSession


}







//Run at server startup
httpHttpsCreateServer(serverOptions);  

 
