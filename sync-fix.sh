#!/bin/bash

echo "=== DATABASE SYNC FIX ==="
echo "This script will sync your local database with production"
echo "WARNING: This will modify your local database"
echo
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 0
fi

echo
echo "Step 1: Reset local migration state to match production"
echo "======================================================="

# Get list of applied migrations from production
echo "Getting production migration state..."
ssh bagus1@bagus.org "cd /home/bagus1/repositories/setlister && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma migrate status" > prod_migration_status.txt

# Show what we found
echo "Production migration status:"
cat prod_migration_status.txt
echo

echo "Step 2: Mark all existing migrations as applied locally"
echo "======================================================"
for migration in prisma/migrations/*/; do
    if [ -d "$migration" ]; then
        migration_name=$(basename "$migration")
        echo "Marking $migration_name as applied..."
        npx prisma migrate resolve --applied "$migration_name" || echo "Failed to mark $migration_name as applied"
    fi
done

echo
echo "Step 3: Check sync status"
echo "========================"
npx prisma migrate status

echo
echo "Step 4: Regenerate Prisma client"
echo "================================"
npx prisma generate

echo
echo "=== SYNC FIX COMPLETE ==="
echo "Local database should now be in sync with production"
echo "You can run ./sync-check.sh to verify"

# Cleanup
rm -f prod_migration_status.txt
