#!/bin/bash
cd "$(npm prefix -global)/lib/node_modules/loop-server-fast/"; 
pm2 start npm --name "loop-server-fast" -- start