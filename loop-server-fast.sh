#!/bin/bash
_int() { 
  echo "Caught SIGINT signal!" 
  kill -INT "$child" 2>/dev/null
}

trap _int SIGINT

cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"
sudo npm run start &

child=$! 
wait "$child"
