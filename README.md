<img src="https://atomjump.com/images/logo80.png">

# loop-server-fast

A faster NodeJS reader plugin to complement the AtomJump Loop Server (see http://atomjump.com).
This speeds up the core of the AtomJump Loop Server PHP scripts, to allow for 
a large increase in the number of simultaneous users, with the same hardware.



# Requirements

* NodeJS >= 4.x
* AtomJump Loop Server >= 1.5.5
* Linux server (or any machine with NodeJS) 


# Server Setup

Follow the instructions to set up the Loop Server as a PHP script. 


Then to install the daemon:

```
sudo npm install pm2@latest -g
sudo npm install loop-server-fast -g
npm config set loop-server-fast:configFile /path/to/your/loop-server/config/config.json
npm config set loop-server-fast:messagesFile /path/to/your/loop-server/config/messages.json
```

To your Loop Server's config/config.json, add the following
```javascript
{
   "staging": {
		...
		"readPort" : 3277,						[can be a different port]
		"readURL" : "http://yoururl.com:3277",			[for wider compatiblity you could use a proxy. See 'Ports' section below]					
		"httpsKey" : "/path/to/your/https.key",			[optional, for https only]
		"httpsCert": "/path/to/your/https.crt",			[optional, for https only]
		...	  
	}
}
```

(note, remove the [comments in square brackets above])

Now run and set up the script to run after a server reboot.
```
cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/" 
pm2 start npm --name "loop-server-fast" -- start; cd ~
pm2 save
pm2 startup     	#and run the command it outputs, to get autostart at boot-up.
```

Open your firewall e.g. on Ubuntu (also see further details at https://www.digitalocean.com/community/tutorials/how-to-setup-a-firewall-with-ufw-on-an-ubuntu-and-debian-cloud-server)

```
sudo ufw allow 3277/tcp
```
Now run your staging installation interface in a browser. It should continue as normal,
but your NodeJS server is handling most read requests.


# Starting and stopping

```
pm2 start loop-server-fast
pm2 stop loop-server-fast
```


# Going live

Then, to your Loop Server's config/config.json, add the following
```javascript
{
   "production": {
		...
		"readPort" : 3277						[can be a different port]
		"readURL" : "http://yoururl.com:3277",			[for wider compatiblity you could use a proxy. See 'Ports' section below]
		"httpsKey" : "/path/to/your/https.key",			[optional, for https only]
		"httpsCert": "/path/to/your/https.crt",			[optional, for https only]
		...	  
	}
}
```

(note, remove the [comments in square brackets above])

Switch the NodeJS server to the Loop Server's production settings with:

```
npm config set loop-server-fast:production true
pm2 restart loop-server-fast
```

(or back to staging with 'false')


# Ports

If you use a non-standard port number in a URL e.g. 3277, some machines behind proxy servers, particularly corporates, or some public PCs may filter the URL out when trying to read from it. One approach here, at a slight loss of speed, is to use the standard port 80 for http and 443 for https, and ProxyPass in Apache: http://stackoverflow.com/questions/9831594/apache-and-node-js-on-the-same-server

"
With the ProxyPass directive in the Apache httpd.conf you can pipe all requests on a particular URL to the Node.JS application.

```
ProxyPass /node http://yourcompany.com:3277/
```
Also, make sure the following lines are NOT commented out so you get the right proxy and submodule to reroute http requests:

```
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

Which would allow your readURL to be e.g.
```
http://yourcompany.com/node
```
"


# Troubleshooting

You can track logs with
```
pm2 logs
```

To switch on verbose messages
```
npm config set loop-server-fast:verbose true
pm2 restart loop-server-fast
```

and to switch back off again
```
npm config set loop-server-fast:verbose false
pm2 restart loop-server-fast
```

If, you are on a small machine (e.g. 512MB RAM), and the install fails, try this

```
sudo npm install loop-server-fast -g -production 
```


# Upgrading

One convenient line, to minimise downtime (although you will have a few seconds down):

```
pm2 delete loop-server-fast; sudo npm install loop-server-fast -g; cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"; pm2 start npm --name "loop-server-fast" -- start; cd ~
```
