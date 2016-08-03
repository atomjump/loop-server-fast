<img src="https://atomjump.com/images/logo80.png">

# loop-server-fast
A faster NodeJS reader plugin to complement the AtomJump Loop Server.
This speeds up the core of the AtomJump Loop Server PHP scripts, to allow for 
a large increase in the number of simultaneous users, with the same hardware.



# Requirements

NodeJS >= 4.x
AtomJump Loop Server >= 0.5.22
Linux server (or any machine with NodeJS) 


# Server Setup

Follow the instructions to set up the Loop Server as a PHP script.

```
sudo npm install pm2@latest -g
sudo npm install loop-server-fast -g
sudo npm config set loop-server-fast:loopServerConfigFile /path/to/your/loop/server/config.json
sudo npm config set loop-server-fast:loopServerMessagesFile /path/to/your/loop/server/messages.json
pm2 start "$(npm prefix -global)/lib/node_modules/loop-server-fast/bin/start.sh"
pm2 save
pm2 startup     	#and run the command it outputs, to get autostart at boot-up.
```

