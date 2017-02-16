#!/bin/bash
_int() { 
  echo "Caught SIGINT signal!" 
  sudo npm run stop
}

trap _int SIGINT

cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"
sudo npm run start

child=$! 
wait "$child"
