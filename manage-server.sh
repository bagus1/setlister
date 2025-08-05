#!/bin/bash

# Simple script to run the management tool on the server
# Usage: ./manage-server.sh [command]

# Set the correct Node.js path
NODE_PATH="/opt/alt/alt-nodejs20/root/usr/bin/node"

# Check if Node.js exists
if [ ! -f "$NODE_PATH" ]; then
    echo "Error: Node.js not found at $NODE_PATH"
    exit 1
fi

# Run the management script
if [ $# -eq 0 ]; then
    # Interactive mode
    $NODE_PATH manage.js
else
    # Command line mode
    $NODE_PATH manage.js "$@"
fi 