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
	  "readPort" : 3277,								[can be a different port]
	  "readURL" : "http://yoururl.com:3277",			[for wider compatiblity you should use a standard port URL that points at this port. See 'Ports' section below]					
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
	  "readPort" : 3277								[can be a different port]
	  "readURL" : "http://yoururl.com:3277",								[for wider compatiblity you should use a standard port URL that points at this port. See 'Ports' section below]
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

If you use a non-standard port number in a URL e.g. 3277, some machines behind proxy servers, particularly corporates, or some public PCs may filter the URL out when trying to read from it. The best practice here is to use the standard port 80 for http and 443 for https. Alternatively, if this port is not available on the machine you are using (for example, typically Apache would be using both already for the Loop Server), you can also either use an .htaccess redirect in the Apache settings, or a load balancer address rewiring in a load balancer from, say, a subdomain.

An .htaccess redirect might look something like this:
```
RewriteRule ^loop-server-fast$ http://mycompany.com:3277 [L,PT]
```


A subdomain switcher within haproxy load balancer might do this:
```
INPUT:        https://loop-server-fast.mycompany.com    [note: uses standard port 443]
CONVERT TO:   https://mycompany.com:3277
```

with a command like this:

```
frontend https-in
	#Standard https in
    bind *:443 
	option tcplog
	mode tcp    

    tcp-request inspect-delay 5s
  	tcp-request content accept               if { req_ssl_hello_type 1 }
    #Search for the subdomain to redirect
    use_backend loop-server-fast if { req_ssl_sni -i loop-server-fast.mycompany.com }

    default_backend loop-server
    
backend loop-server-fast
    mode tcp
    balance leastconn
	option ssl-hello-chk   
	#Redirect to the precise server ip and the loop-server-fast's port (3277) 
	server node-loop-server-fast 12.34.56.23:3277 check    
```


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
