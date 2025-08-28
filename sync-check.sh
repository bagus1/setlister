#!/bin/bash

echo "=== DATABASE SYNC CHECK ==="
echo

echo "LOCAL Migration Status:"
echo "======================="
npx prisma migrate status
echo

echo "PRODUCTION Migration Status:"
echo "============================"
ssh bagus1@bagus.org "cd /home/bagus1/repositories/setlister && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma migrate status"
echo

echo "LOCAL Migrations List:"
echo "====================="
ls -la prisma/migrations/ 2>/dev/null || echo "No migrations directory"
echo

echo "PRODUCTION Migrations List:"
echo "=========================="
ssh bagus1@bagus.org "ls -la /home/bagus1/repositories/setlister/prisma/migrations/ 2>/dev/null || echo 'No migrations directory'"
echo

echo "LOCAL Schema Checksum:"
echo "===================="
md5sum prisma/schema.prisma
echo

echo "PRODUCTION Schema Checksum:"
echo "=========================="
ssh bagus1@bagus.org "md5sum /home/bagus1/repositories/setlister/prisma/schema.prisma"
echo

echo "=== SYNC CHECK COMPLETE ==="
