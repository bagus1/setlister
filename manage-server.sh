#!/bin/bash

# Simple script to run the management tool on the server
# Usage: ./manage-server.sh [command]

# Set the correct Node.js path and project directory
NODE_PATH="/opt/alt/alt-nodejs20/root/usr/bin/node"
PROJECT_DIR="/home/bagus1/repositories/setlister"

# Check if Node.js exists
if [ ! -f "$NODE_PATH" ]; then
    echo "Error: Node.js not found at $NODE_PATH"
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR" || {
    echo "Error: Cannot change to project directory $PROJECT_DIR"
    exit 1
}

# Run the management script
if [ $# -eq 0 ]; then
    # Interactive mode
    $NODE_PATH manage.js
else
    # Command line mode
    $NODE_PATH manage.js "$@"
fi 