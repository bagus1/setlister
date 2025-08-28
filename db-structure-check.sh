#!/bin/bash

echo "=== DATABASE STRUCTURE COMPARISON ==="
echo

echo "LOCAL Database Tables:"
echo "====================="
psql $DATABASE_URL -c "\dt" 2>/dev/null || echo "Could not connect to local database"
echo

echo "PRODUCTION Database Tables:"
echo "=========================="
ssh bagus1@bagus.org "cd /home/bagus1/repositories/setlister && export \$(cat .env | xargs) && psql \$DATABASE_URL -c '\\dt'"
echo

echo "LOCAL Songs Table Structure:"
echo "==========================="
psql $DATABASE_URL -c "\d songs" 2>/dev/null || echo "Could not connect to local database"
echo

echo "PRODUCTION Songs Table Structure:"
echo "================================"
ssh bagus1@bagus.org "cd /home/bagus1/repositories/setlister && export \$(cat .env | xargs) && psql \$DATABASE_URL -c '\\d songs'"
echo

echo "LOCAL Whitelist Tables:"
echo "======================"
psql $DATABASE_URL -c "\d whitelist_requests; \d whitelist_domains" 2>/dev/null || echo "Could not connect to local database"
echo

echo "PRODUCTION Whitelist Tables:"
echo "==========================="
ssh bagus1@bagus.org "cd /home/bagus1/repositories/setlister && export \$(cat .env | xargs) && psql \$DATABASE_URL -c '\\d whitelist_requests; \\d whitelist_domains'"
echo

echo "=== STRUCTURE CHECK COMPLETE ==="
