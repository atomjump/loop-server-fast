#!/bin/bash

exec cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"; sudo npm run start
#The exec passes on signals directly to the new process
