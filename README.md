<img src="https://atomjump.com/images/logo80.png">

# loop-server-fast

A faster NodeJS reader plugin to complement the AtomJump Loop Server (see http://atomjump.com).
This speeds up the core of the AtomJump Loop Server PHP scripts, to allow for 
a large increase in the number of simultaneous users, with the same hardware.



# Requirements

* NodeJS >= 4.x
* AtomJump Loop Server >= 0.5.22
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
`code()`
{
   "staging": {
	  ...
	  "readPort" : "3277",								[you can choose a port number here]
      "httpsKey" : "/path/to/your/https.key",			[optional, for https only]
      "httpsCert": "/path/to/your/https.crt",			[optional, for https only]
	  ...	  
	}
}
`code()`

(note, remove the [comments in square brackets above])

Now run and set up the script to run after a server reboot.
```
pm2 start "$(npm prefix -global)/lib/node_modules/loop-server-fast/loop-server-fast.sh"
pm2 save
pm2 startup     	#and run the command it outputs, to get autostart at boot-up.
```

Open your firewall e.g. on Ubuntu (also see further details at https://www.digitalocean.com/community/tutorials/how-to-setup-a-firewall-with-ufw-on-an-ubuntu-and-debian-cloud-server)

```
sudo ufw allow 3277/tcp
```




# Going live

Then, to your Loop Server's config/config.json, add the following
```
{
   "production": {
	  ...
	  "readPort" : "3277",								[you can choose a port number here]
      "httpsKey" : "/path/to/your/https.key",			[optional, for https only]
      "httpsCert": "/path/to/your/https.crt",			[optional, for https only]
	  ...	  
	}
}
```

(note, remove the [comments in square brackets above])

Switch the NodeJS server to the production settings with:

```
npm config set loop-server-fast:production true
pm2 restart loop-server-fast
```

(or back to staging with 'false')

You can track logs with
```
pm2 logs
```




