#!/bin/bash

handler()
{
    kill -s SIGINT $PID
}

cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"; 
sudo npm run start &
PID=$!

trap handler SIGINT

wait $PID

#The exec passes on signals directly to the new process
