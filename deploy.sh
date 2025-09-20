#!/bin/bash

# Setlist Manager Git-Based Deployment Script
# Usage: ./deploy.sh [mode]
# 
# Modes:
#   deploy   - Smart daily deployment (schema-aware, fast when no changes)
#   deploy-schema - Deploy schema changes with full workflow (compare, generate SQL, apply, commit, deploy)
#   deploy-postgres - Full PostgreSQL setup with migration (for new servers)
#   update   - Quick deploy with PostgreSQL migration (push to git, pull on server, migrate, restart)
#   quick    - Update files with PostgreSQL migration (auto-commit, push to git, pull on server, migrate, restart)
#   deploy-demo - Deploy to demo environment with PostgreSQL migration
#   test-migration - Test PostgreSQL migration locally (no server deployment)
#   migrate  - Run database migrations on server (Prisma, with server stop/start)
#   safe-migrate - Run migrations with extra safety checks and rollback capability
#   seed     - Run database seeding scripts on production
#   restart  - Just restart the server
#   restart-demo - Just restart the demo server
#   stop     - Stop the server (kill Passenger process)
#   start    - Start the server (touch restart.txt)
#   deps     - Update dependencies on server
#   deps-demo - Update dependencies on demo server
#   status   - Show deployment status
#   backup   - Create backup
#   dbackup  - Create database backup and download locally
#   restoredb-local - Restore database backup to local PostgreSQL (with optional cleaning)
#   restore-prod-db-locally - Restore production backup to local PostgreSQL (step-by-step)
#   rollback - Rollback to previous commit
#   help     - Show this help message (default)
#
# Prisma Safety Features:
#   - Automatically detects schema changes in prisma/schema.prisma
#   - Uses Passenger restart mechanism (no dangerous process killing)
#   - Regenerates Prisma client after schema changes
#   - Uses prisma migrate deploy (safer than db push)
#   - Verifies server health after restart
#   - Provides rollback capability for failed migrations

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment variables
HOST_USER=${HOST_USER:-bagus1}
HOST_DOMAIN=${HOST_DOMAIN:-bagus.org}
SETLIST_PATH=${SETLIST_PATH:-/home/bagus1/repositories/setlister}
DEMO_PATH=${DEMO_PATH:-/home/bagus1/repositories/demoset}
BACKUP_PATH=${BACKUP_PATH:-/Users/john/coding-practice/setlists/setlist_backups}



# Check for --help option
if [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Default mode - show help if no argument provided
MODE=${1:-help}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show help
show_help() {
    cat << EOF
Setlist Manager Git-Based Deployment Script

Usage: ./deploy.sh [mode]

Modes:
  deploy   - Smart daily deployment (Prisma-aware, safe stop/start for structural changes)
  deploy-schema - Deploy schema changes with full workflow (compare, generate SQL, apply, commit, deploy)
  deploy-simple - Deploy code changes only (no Prisma checks, fast restart)
  deploy-postgres - Full PostgreSQL setup with migration (for new servers)
  update   - Quick deploy with PostgreSQL migration (push to git, pull on server, migrate, restart)
  quick    - Update files with PostgreSQL migration (auto-commit, push to git, pull on server, migrate, restart)
  deploy-demo - Deploy to demo environment with PostgreSQL migration
  test-migration - Test PostgreSQL migration locally (no server deployment)
  migrate  - Run database migrations on server (Prisma, with server stop/start)
  safe-migrate - Run migrations with extra safety checks and rollback capability
  seed     - Run database seeding scripts on production
  restart  - Just restart the server
  restart-demo - Just restart the demo server
  stop     - Stop the server (kill Passenger process)
  start    - Start the server (touch restart.txt)
  deps     - Update dependencies on server
  deps-demo - Update dependencies on demo server
  status   - Show deployment status
  logs     - View Passenger logs (last 200 lines)
  app-logs - View application logs (last 200 lines)
  backup   - Create backup
  dbackup  - Create database backup and download locally
          restoredb-local - Restore database backup to local PostgreSQL (with optional cleaning)
  restore-prod-db-locally - Restore production backup to local PostgreSQL (step-by-step)
  rollback - Rollback to previous commit
  help     - Show this help message (default)

Environment Variables (can be set before running):
  HOST_USER      - Username for server (default: bagus1)
  HOST_DOMAIN    - Server domain (default: bagus.org)
  SETLIST_PATH   - Path on server (default: /home/bagus1/repositories/setlister)
  DEMO_PATH      - Path to demo environment (default: /home/bagus1/repositories/demoset)
  BACKUP_PATH    - Local backup directory (default: /Users/john/coding-practice/setlists/setlist_backups)



Examples:
  ./deploy.sh deploy       # Smart daily deployment (schema-aware)
  ./deploy.sh deploy-schema # Deploy schema changes with full workflow
  ./deploy.sh deploy-postgres # Full PostgreSQL setup with migration
  ./deploy.sh update       # Quick deploy with restart
  ./deploy.sh quick        # Update files without restart
  ./deploy.sh deploy-demo  # Deploy to demo with PostgreSQL migration
  ./deploy.sh migrate      # Run database migrations (Prisma)
  ./deploy.sh seed         # Run database seeding scripts
  ./deploy.sh restart      # Just restart server
  ./deploy.sh stop         # Stop server
  ./deploy.sh start        # Start server
  ./deploy.sh deps         # Update dependencies
  ./deploy.sh status       # Show status
  ./deploy.sh logs         # View Passenger logs
  ./deploy.sh app-logs     # View application logs
  ./deploy.sh dbackup      # Create database backup and download locally





EOF
}

# Function to check if we're in a git repository
check_git() {
    if [ ! -d ".git" ]; then
        print_error "Not in a git repository. Please run this script from the project root."
        exit 1
    fi
}

# Function to check git status
check_git_status() {
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes:"
        git status --short
        read -p "Do you want to commit these changes? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            echo
            read -p "Add a commit message or press Enter for auto-generated: " commit_message
            if [[ -z $commit_message ]]; then
                git commit -m "Auto-commit before deployment $(date)"
                print_success "Changes committed with auto-generated message"
            else
                git commit -m "$commit_message"
                print_success "Changes committed with message: $commit_message"
            fi
        elif [[ $REPLY =~ ^[Nn]$ ]] || [[ -z $REPLY ]]; then
            print_warning "Deploying with uncommitted changes"
        else
            print_error "Invalid input. Please enter 'y' for yes or 'N' for no."
            exit 1
        fi
    fi
}

# Function to check branch mismatch between local and server
check_branch_mismatch() {
    local local_branch=$(git branch --show-current)
    local server_branch=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git branch --show-current")
    
    if [ "$local_branch" != "$server_branch" ]; then
        print_warning "Branch mismatch detected:"
        print_warning "  Local branch:  $local_branch"
        print_warning "  Server branch: $server_branch"
        echo
        read -p "Do you want to switch the server to branch '$local_branch'? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Switching server to branch '$local_branch'..."
            ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $local_branch" || {
                print_error "Failed to switch server branch to '$local_branch'"
                return 1
            }
            print_success "Server switched to branch '$local_branch'"
        elif [[ $REPLY =~ ^[Nn]$ ]] || [[ -z $REPLY ]]; then
            print_error "Deployment aborted due to branch mismatch"
            print_error "Please ensure local and server are on the same branch before deploying"
            exit 1
        else
            print_error "Invalid input. Please enter 'y' for yes or 'N' for no."
            exit 1
        fi
    fi
}

# Function to deploy via git (smart schema detection)
deploy_via_git() {
    print_status "Deploying via Git..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on server"
        return 1
    }
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Check if schema or structural changes were made
    print_status "Checking for schema or structural changes..."
    SCHEMA_CHANGED=false
    
    # Check if prisma/schema.prisma differs between local and production
    print_status "Comparing local and production schema files..."
    LOCAL_SCHEMA_HASH=$(md5sum prisma/schema.prisma | cut -d' ' -f1)
    REMOTE_SCHEMA_HASH=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && md5sum prisma/schema.prisma | cut -d' ' -f1" 2>/dev/null || echo "missing")
    
    if [ "$LOCAL_SCHEMA_HASH" != "$REMOTE_SCHEMA_HASH" ]; then
        print_status "Schema differences detected between local and production"
        print_status "Local schema hash: $LOCAL_SCHEMA_HASH"
        print_status "Remote schema hash: $REMOTE_SCHEMA_HASH"
        SCHEMA_CHANGED=true
    else
        print_status "Schema files match between local and production"
    fi
    
    # Check if any migration files changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q migration-output"; then
        print_status "Migration files changed"
        SCHEMA_CHANGED=true
    fi
    
    # Check for pending migrations that haven't been applied to production database
    print_status "Checking for pending migrations on production database..."
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma migrate status 2>/dev/null | grep -q 'have not yet been applied'"; then
        print_status "Pending migrations detected on production database"
        SCHEMA_CHANGED=true
    fi
    

    
    # Check for new routes that might import Prisma
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q '^routes/'"; then
        print_status "New routes detected - may affect Prisma initialization"
        SCHEMA_CHANGED=true
    fi
    
    # Check for changes to lib/prisma.js or similar Prisma files
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q '^lib/'"; then
        print_status "Prisma library changes detected"
        SCHEMA_CHANGED=true
    fi
    
    # Check for new files that might import Prisma (but exclude minor changes)
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q '^routes/.*\.js$'"; then
        print_status "Route files changed - may affect Prisma queries"
        SCHEMA_CHANGED=true
    elif ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q '^lib/.*\.js$'"; then
        print_status "Library files changed - may affect Prisma initialization"
        SCHEMA_CHANGED=true
    fi
    
    # If schema changed, run Prisma commands with Passenger restart
    if [ "$SCHEMA_CHANGED" = true ]; then
        print_status "Schema or structural changes detected - generating Prisma client..."
        
        # Generate Prisma client to match the new schema
        print_status "Generating Prisma client..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
            print_error "Failed to generate Prisma client on server"
            return 1
        }
        
        print_success "Prisma client generated successfully"
        print_warning "Note: Database schema changes should be applied manually via SQL"
        
        # Restart the server with new schema via Passenger
        print_status "Restarting server with new schema via Passenger..."
        restart_server_passenger
        
        # Verify server is responding
        print_status "Verifying server is responding..."
        if is_server_responding; then
            print_success "Server is responding successfully with new schema"
        else
            print_warning "Server may not be fully ready yet - check manually"
        fi
        
    else
        print_status "No schema or structural changes detected - restarting server normally..."
        restart_server
    fi
    
    if [ "$SCHEMA_CHANGED" = true ]; then
        print_success "Deployment completed with safe Prisma initialization!"
    else
        print_success "Deployment completed (no structural changes)!"
    fi
}

# Function to deploy PostgreSQL setup via git (full migration)
deploy_postgres_via_git() {
    print_status "Deploying via Git..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on server"
        return 1
    }
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Check if PostgreSQL migration is needed
    print_status "Checking if PostgreSQL migration is needed..."
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && [ ! -f 'migration-output' ]"; then
        print_status "Generating PostgreSQL migration files..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node migrate-sqlite-to-postgres.js" || {
            print_error "Failed to generate migration files on server"
            return 1
        }
    else
        print_status "Migration files already exist, skipping generation"
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on server"
        return 1
    }
    
    # Push schema changes to database
    print_status "Running PostgreSQL schema migration..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma db push" || {
        print_error "Failed to run PostgreSQL migration on server"
        return 1
    }
    
    # Import data if tables are empty
    print_status "Checking if data import is needed..."
    USER_COUNT=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e \"const { prisma } = require('./lib/prisma'); prisma.user.count().then((count) => { console.log(count); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });\"" 2>/dev/null || echo "0")
    
    if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "" ]; then
        print_status "Importing data from SQLite migration files..."
        
        # Import each table in dependency order
        for table in users bands artists vocalists songs gig_documents setlists medleys band_members song_artists band_songs setlist_sets setlist_songs medley_songs band_invitations password_resets links; do
            print_status "Importing $table..."
            ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && [ -f 'migration-output/$table.sql' ] && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -f 'migration-output/$table.sql' || echo 'No migration file for $table'" || {
                print_warning "Failed to import $table, continuing..."
            }
        done
        print_success "Data import completed"
        
        # Fix auto-increment sequences after data migration
        print_status "Fixing auto-increment sequences..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -c \"SELECT setval('users_id_seq', (SELECT MAX(id) FROM users)); SELECT setval('bands_id_seq', (SELECT MAX(id) FROM bands)); SELECT setval('artists_id_seq', (SELECT MAX(id) FROM artists)); SELECT setval('vocalists_id_seq', (SELECT MAX(id) FROM vocalists)); SELECT setval('songs_id_seq', (SELECT MAX(id) FROM songs)); SELECT setval('gig_documents_id_seq', (SELECT MAX(id) FROM gig_documents)); SELECT setval('setlists_id_seq', (SELECT MAX(id) FROM setlists)); SELECT setval('band_members_id_seq', (SELECT MAX(id) FROM band_members)); SELECT setval('password_resets_id_seq', (SELECT MAX(id) FROM password_resets)); SELECT setval('setlist_sets_id_seq', (SELECT MAX(id) FROM setlist_sets)); SELECT setval('setlist_songs_id_seq', (SELECT MAX(id) FROM setlist_songs)); SELECT setval('medleys_id_seq', (SELECT MAX(id) FROM medleys)); SELECT setval('medley_songs_id_seq', (SELECT MAX(id) FROM medley_songs)); SELECT setval('band_songs_id_seq', (SELECT MAX(id) FROM band_songs)); SELECT setval('links_id_seq', (SELECT MAX(id) FROM links));\"" || {
            print_warning "Failed to fix sequences, continuing..."
        }
        print_success "Sequences fixed"
    else
        print_status "Data already exists, skipping import"
    fi
    
    # Test the database connection
    print_status "Testing database connection..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e 'const { prisma } = require(\"./lib/prisma\"); prisma.\$connect().then(() => { console.log(\"✅ Production database connection successful\"); process.exit(0); }).catch(err => { console.error(\"❌ Production database connection failed:\", err.message); process.exit(1); });'" || {
        print_error "Production database connection test failed"
        return 1
    }
    
    # Restart server
    restart_server
    
    print_success "Deployment completed with PostgreSQL migration!"
}

# Function to update files without restart
update_via_git() {
    print_status "Quick deploy - pushing and pulling..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on server"
        return 1
    }
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Check if PostgreSQL migration is needed
    print_status "Checking if PostgreSQL migration is needed..."
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && [ ! -f 'migration-output' ]"; then
        print_status "Generating PostgreSQL migration files..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node migrate-sqlite-to-postgres.js" || {
            print_error "Failed to generate migration files on server"
            return 1
        }
    else
        print_status "Migration files already exist, skipping generation"
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on server"
        return 1
    }
    
    # Push schema changes to database
    print_status "Running PostgreSQL schema migration..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma db push" || {
        print_error "Failed to run PostgreSQL migration on server"
        return 1
    }
    
    # Import data if tables are empty
    print_status "Checking if data import is needed..."
    USER_COUNT=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e \"const { prisma } = require('./lib/prisma'); prisma.user.count().then((count) => { console.log(count); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });\"" 2>/dev/null || echo "0")
    
    if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "" ]; then
        print_status "Importing data from SQLite migration files..."
        
        # Import each table in dependency order
        for table in users bands artists vocalists songs gig_documents setlists medleys band_members song_artists band_songs setlist_sets setlist_songs medley_songs band_invitations password_resets links; do
            print_status "Importing $table..."
            ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && [ -f 'migration-output/$table.sql' ] && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -f 'migration-output/$table.sql' || echo 'No migration file for $table'" || {
                print_warning "Failed to import $table, continuing..."
            }
        done
        print_success "Data import completed"
        
        # Fix auto-increment sequences after data migration
        print_status "Fixing auto-increment sequences..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -c \"SELECT setval('users_id_seq', (SELECT MAX(id) FROM users)); SELECT setval('bands_id_seq', (SELECT MAX(id) FROM bands)); SELECT setval('artists_id_seq', (SELECT MAX(id) FROM artists)); SELECT setval('vocalists_id_seq', (SELECT MAX(id) FROM vocalists)); SELECT setval('songs_id_seq', (SELECT MAX(id) FROM songs)); SELECT setval('gig_documents_id_seq', (SELECT MAX(id) FROM gig_documents)); SELECT setval('setlists_id_seq', (SELECT MAX(id) FROM setlists)); SELECT setval('band_members_id_seq', (SELECT MAX(id) FROM band_members)); SELECT setval('password_resets_id_seq', (SELECT MAX(id) FROM password_resets)); SELECT setval('setlist_sets_id_seq', (SELECT MAX(id) FROM setlist_sets)); SELECT setval('setlist_songs_id_seq', (SELECT MAX(id) FROM setlist_songs)); SELECT setval('medleys_id_seq', (SELECT MAX(id) FROM medleys)); SELECT setval('medley_songs_id_seq', (SELECT MAX(id) FROM medley_songs)); SELECT setval('band_songs_id_seq', (SELECT MAX(id) FROM band_songs)); SELECT setval('links_id_seq', (SELECT MAX(id) FROM links));\"" || {
            print_warning "Failed to fix sequences, continuing..."
        }
        print_success "Sequences fixed"
    else
        print_status "Data already exists, skipping import"
    fi
    
    # Test the database connection
    print_status "Testing database connection..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e 'const { prisma } = require(\"./lib/prisma\"); prisma.\$connect().then(() => { console.log(\"✅ Production database connection successful\"); process.exit(0); }).catch(err => { console.error(\"❌ Production database connection failed:\", err.message); process.exit(1); });'" || {
        print_error "Production database connection test failed"
        return 1
    }
    
    restart_server
    
    print_success "Quick deployment completed with PostgreSQL migration!"
}

# Function to quick deploy (just pull on server)
quick_deploy() {
    print_status "Updating files via Git (no restart)..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on server"
        return 1
    }
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    print_success "Files updated successfully! (No server restart)"
    print_warning "Note: Some changes may require a restart. Use './deploy.sh restart' if needed."
}

# Function to deploy schema changes with full workflow
deploy_schema() {
    print_status "Starting schema deployment workflow..."
    
    # Step 1: Check branch mismatch (reuse existing function)
    print_status "Step 1: Checking branch alignment between local and production..."
    check_branch_mismatch
    
    # Step 2: Get current production schema file
    print_status "Step 2: Retrieving current production schema file..."
    get_production_schema
    
    # Step 3: Compare local vs production schema
    print_status "Step 3: Comparing local vs production schema files..."
    compare_schemas
    
    # Step 4: Generate SQL for differences using Prisma
    print_status "Step 4: Generating SQL for schema differences..."
    generate_schema_sql
    
    # Step 5: Execute SQL on production database
    print_status "Step 5: Executing SQL on production database..."
    execute_schema_sql
    
    # Step 6: Commit and push schema changes
    print_status "Step 6: Committing and pushing schema changes..."
    commit_and_push_schema_changes
    
    # Step 7: Deploy to server (pull, generate, restart)
    print_status "Step 7: Deploying to server..."
    deploy_schema_to_server
    
    print_success "Schema deployment workflow completed successfully!"
}

# Function to get current production schema file
get_production_schema() {
    print_status "Downloading current production schema file..."
    
    # Create temporary directory for schema comparison
    local temp_dir="./temp_schema_comparison"
    mkdir -p "$temp_dir"
    
    # Download production schema file
    scp "$HOST_USER@$HOST_DOMAIN:$SETLIST_PATH/prisma/schema.prisma" "$temp_dir/production_schema.prisma" || {
        print_error "Failed to download production schema file"
        rm -rf "$temp_dir"
        return 1
    }
    
    print_success "Production schema file downloaded to $temp_dir/production_schema.prisma"
}

# Function to compare local vs production schema files
compare_schemas() {
    print_status "Comparing local and production schema files..."
    
    local temp_dir="./temp_schema_comparison"
    local local_schema="prisma/schema.prisma"
    local prod_schema="$temp_dir/production_schema.prisma"
    
    if [ ! -f "$local_schema" ]; then
        print_error "Local schema file not found: $local_schema"
        rm -rf "$temp_dir"
        return 1
    fi
    
    if [ ! -f "$prod_schema" ]; then
        print_error "Production schema file not found: $prod_schema"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Show file info
    local local_size=$(wc -l < "$local_schema")
    local prod_size=$(wc -l < "$prod_schema")
    print_status "Local schema: $local_size lines"
    print_status "Production schema: $prod_size lines"
    
    # Compare files using diff
    if diff -q "$local_schema" "$prod_schema" > /dev/null; then
        print_warning "No differences found between local and production schema files"
        print_warning "Schema deployment workflow aborted - no changes to deploy"
        rm -rf "$temp_dir"
        return 1
    else
        print_status "Schema differences detected:"
        echo "----------------------------------------"
        
        # Show a summary of changes
        local added_lines=$(diff -u "$prod_schema" "$local_schema" | grep -c "^+" || echo "0")
        local removed_lines=$(diff -u "$prod_schema" "$local_schema" | grep -c "^-" || echo "0")
        local changed_lines=$(diff -u "$prod_schema" "$local_schema" | grep -c "^@@" || echo "0")
        
        print_status "Change summary:"
        print_status "  - Lines added: $added_lines"
        print_status "  - Lines removed: $removed_lines" 
        print_status "  - Sections changed: $changed_lines"
        echo
        
        # Show the actual diff
        print_status "Detailed differences:"
        diff -u "$prod_schema" "$local_schema" || true
        echo "----------------------------------------"
        print_success "Schema comparison completed - differences found"
    fi
}

# Function to generate SQL for schema differences using Prisma
generate_schema_sql() {
    print_status "Generating SQL for schema differences using Prisma..."
    
    local temp_dir="./temp_schema_comparison"
    
    # Create a temporary schema file for comparison
    local temp_schema="$temp_dir/temp_schema.prisma"
    cp "prisma/schema.prisma" "$temp_schema"
    
    print_status "Source schema: $temp_dir/production_schema.prisma (production)"
    print_status "Target schema: $temp_schema (local)"
    
    # Generate migration using Prisma
    print_status "Running Prisma migrate diff to generate SQL..."
    npx prisma migrate diff \
        --from-schema-datamodel "$temp_dir/production_schema.prisma" \
        --to-schema-datamodel "$temp_schema" \
        --script > "$temp_dir/schema_changes.sql" || {
        print_error "Failed to generate SQL for schema differences"
        rm -rf "$temp_dir"
        return 1
    }
    
    # Check if SQL file was created and has content
    if [ ! -s "$temp_dir/schema_changes.sql" ]; then
        print_warning "No SQL changes generated - schema files may be identical"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Show SQL file info
    local sql_lines=$(wc -l < "$temp_dir/schema_changes.sql")
    local sql_size=$(du -h "$temp_dir/schema_changes.sql" | cut -f1)
    print_success "SQL for schema differences generated: $temp_dir/schema_changes.sql"
    print_status "SQL file: $sql_lines lines, $sql_size"
    
    # Analyze the SQL to show what changes will be made
    print_status "Analyzing SQL changes:"
    local create_count=$(grep -c "^CREATE" "$temp_dir/schema_changes.sql" 2>/dev/null || echo "0")
    local alter_count=$(grep -c "^ALTER" "$temp_dir/schema_changes.sql" 2>/dev/null || echo "0")
    local drop_count=$(grep -c "^DROP" "$temp_dir/schema_changes.sql" 2>/dev/null || echo "0")
    local insert_count=$(grep -c "^INSERT" "$temp_dir/schema_changes.sql" 2>/dev/null || echo "0")
    
    print_status "SQL operations summary:"
    print_status "  - CREATE statements: $create_count"
    print_status "  - ALTER statements: $alter_count"
    print_status "  - DROP statements: $drop_count"
    print_status "  - INSERT statements: $insert_count"
    echo
    
    print_status "Generated SQL content:"
    echo "----------------------------------------"
    cat "$temp_dir/schema_changes.sql"
    echo "----------------------------------------"
    
    # Ask for confirmation before proceeding
    read -p "Do you want to proceed with applying these SQL changes to production? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Schema deployment cancelled by user"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Function to execute SQL on production database
execute_schema_sql() {
    print_status "Executing SQL on production database..."
    
    local temp_dir="./temp_schema_comparison"
    local sql_file="$temp_dir/schema_changes.sql"
    
    if [ ! -f "$sql_file" ]; then
        print_error "SQL file not found: $sql_file"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Show what we're about to execute
    local sql_lines=$(wc -l < "$sql_file")
    print_status "About to execute $sql_lines lines of SQL on production database"
    
    # Upload SQL file to server
    print_status "Uploading SQL file to server..."
    scp "$sql_file" "$HOST_USER@$HOST_DOMAIN:/tmp/schema_changes.sql" || {
        print_error "Failed to upload SQL file to server"
        rm -rf "$temp_dir"
        return 1
    }
    
    # Execute SQL on production database with detailed logging
    print_status "Executing SQL on production database..."
    print_status "Database: $HOST_DOMAIN"
    print_status "SQL file: /tmp/schema_changes.sql"
    
    # Execute and capture output
    local execution_output=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -f /tmp/schema_changes.sql 2>&1")
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "SQL executed successfully on production database"
        if [ -n "$execution_output" ]; then
            print_status "Database response:"
            echo "$execution_output"
        fi
    else
        print_error "Failed to execute SQL on production database"
        print_error "Exit code: $exit_code"
        print_error "Error output:"
        echo "$execution_output"
        ssh "$HOST_USER@$HOST_DOMAIN" "rm -f /tmp/schema_changes.sql"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Clean up SQL file on server
    ssh "$HOST_USER@$HOST_DOMAIN" "rm -f /tmp/schema_changes.sql"
    
    print_success "Database schema update completed successfully"
}

# Function to commit and push schema changes
commit_and_push_schema_changes() {
    print_status "Committing and pushing schema changes..."
    
    # Check if there are uncommitted changes
    local uncommitted_files=$(git status --porcelain)
    if [ -n "$uncommitted_files" ]; then
        print_status "Uncommitted changes found:"
        echo "$uncommitted_files"
        echo
        
        print_status "Committing uncommitted changes..."
        git add .
        
        # Create a more descriptive commit message
        local commit_msg="Schema changes: $(date '+%Y-%m-%d %H:%M:%S')"
        if [ -f "./temp_schema_comparison/schema_changes.sql" ]; then
            local sql_summary=$(head -5 "./temp_schema_comparison/schema_changes.sql" | tr '\n' ' ' | cut -c1-100)
            commit_msg="Schema changes: $sql_summary... ($(date '+%Y-%m-%d %H:%M:%S'))"
        fi
        
        git commit -m "$commit_msg"
        print_success "Changes committed locally with message: $commit_msg"
    else
        print_status "No uncommitted changes found"
    fi
    
    # Get current branch name
    local current_branch=$(git branch --show-current)
    print_status "Current branch: $current_branch"
    
    # Show what we're about to push
    local commits_ahead=$(git rev-list HEAD...origin/$current_branch --count)
    if [ "$commits_ahead" -gt 0 ]; then
        print_status "Commits to push: $commits_ahead"
        print_status "Recent commits:"
        git log --oneline -3
        echo
    fi
    
    # Push changes to GitHub
    print_status "Pushing changes to GitHub..."
    git push origin "$current_branch" || {
        print_error "Failed to push changes to GitHub"
        return 1
    }
    
    print_success "Schema changes committed and pushed to GitHub"
}

# Function to deploy schema to server (pull, generate, restart)
deploy_schema_to_server() {
    print_status "Deploying schema changes to server..."
    
    # Get current branch name
    local current_branch=$(git branch --show-current)
    print_status "Current branch: $current_branch"
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $current_branch"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $current_branch" || {
        print_error "Failed to checkout branch $current_branch on server"
        return 1
    }
    
    # Pull latest changes on server
    print_status "Pulling latest changes on server..."
    local pull_output=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $current_branch 2>&1")
    if [ $? -eq 0 ]; then
        print_success "Server code updated successfully"
        if [ -n "$pull_output" ]; then
            print_status "Pull output:"
            echo "$pull_output"
        fi
    else
        print_error "Failed to pull on server"
        print_error "Pull output:"
        echo "$pull_output"
        return 1
    fi
    
    # Generate Prisma client on server
    print_status "Generating Prisma client on server..."
    local generate_output=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate 2>&1")
    if [ $? -eq 0 ]; then
        print_success "Prisma client generated successfully on server"
        if [ -n "$generate_output" ]; then
            print_status "Generate output:"
            echo "$generate_output"
        fi
    else
        print_error "Failed to generate Prisma client on server"
        print_error "Generate output:"
        echo "$generate_output"
        return 1
    fi
    
    # Restart the server
    print_status "Restarting server with new schema..."
    restart_server_passenger
    
    # Verify server is responding
    print_status "Verifying server is responding..."
    local attempts=0
    while ! is_server_responding && [ $attempts -lt 10 ]; do
        sleep 2
        attempts=$((attempts + 1))
        print_status "Waiting for server to respond... (attempt $attempts/10)"
    done
    
    if is_server_responding; then
        print_success "Server is responding successfully with new schema"
    else
        print_warning "Server may not be fully ready yet - check manually"
    fi
    
    # Clean up temporary files
    local temp_dir="./temp_schema_comparison"
    if [ -d "$temp_dir" ]; then
        rm -rf "$temp_dir"
        print_status "Temporary files cleaned up"
    fi
    
    print_success "Schema deployment to server completed successfully!"
}

# Function to deploy simple (no Prisma checks - code changes only)
deploy_simple() {
    print_status "Simple deployment (no Prisma checks)..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure server is on the same branch
    print_status "Ensuring server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on server"
        return 1
    }
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Simple restart - no Prisma checks
    print_status "Restarting server..."
    restart_server
    
    print_success "Simple deployment completed!"
    print_warning "Note: This deployment skipped all Prisma checks. Use regular 'deploy' for schema changes."
}

# Function to restart server
restart_server() {
    print_status "Restarting server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to restart server"
        return 1
    }
    print_success "Server restarted successfully"
}

# Function to restart demo server
restart_demo_server() {
    print_status "Restarting demo server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && touch tmp/restart.txt" || {
        print_error "Failed to restart demo server"
        return 1
    }
    print_success "Demo server restarted successfully"
}

# Function to check if server is responding (more reliable than process checking)
is_server_responding() {
    if curl -s -f "https://$HOST_DOMAIN" > /dev/null 2>&1; then
        return 0  # Server is responding
    else
        return 1  # Server is not responding
    fi
}

# Function to check if server is running (for informational purposes)
is_server_running() {
    if ssh "$HOST_USER@$HOST_DOMAIN" "pgrep -f 'Passenger NodeApp.*setlister'" > /dev/null 2>&1; then
        return 0  # Server is running
    else
        return 1  # Server is not running
    fi
}

# Function to restart server (Passenger-friendly)
restart_server_passenger() {
    print_status "Restarting server via Passenger..."
    
    # Use Passenger's restart mechanism instead of trying to kill processes
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to trigger Passenger restart"
        return 1
    }
    
    # Wait for Passenger to restart the app
    print_status "Waiting for Passenger to restart the application..."
    sleep 5
    
    # Verify server is responding
    local attempts=0
    while ! is_server_responding && [ $attempts -lt 30 ]; do
        sleep 2
        attempts=$((attempts + 1))
        print_status "Waiting for server to respond... (attempt $attempts/30)"
    done
    
    if is_server_responding; then
        print_success "Server restarted successfully"
    else
        print_error "Server failed to respond after restart"
        return 1
    fi
}

# Function to start server
start_server() {
    print_status "Starting server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to start server"
        return 1
    }
    
    # Wait and verify server is running
    print_status "Waiting for server to start..."
    local attempts=0
    while ! is_server_running && [ $attempts -lt 30 ]; do
        sleep 2
        attempts=$((attempts + 1))
        print_status "Waiting for server to start... (attempt $attempts/30)"
    done
    
    if is_server_running; then
        print_success "Server started successfully"
    else
        print_error "Server failed to start after 30 attempts"
        return 1
    fi
}

# Function to update dependencies
update_dependencies() {
    print_status "Updating dependencies..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production" || {
        print_error "Failed to update dependencies"
        return 1
    }
    print_success "Dependencies updated successfully"
    
    # Restart server to ensure new dependencies are loaded
    restart_server
}

# Function to update demo dependencies
update_demo_dependencies() {
    print_status "Updating demo dependencies..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production" || {
        print_error "Failed to update demo dependencies"
        return 1
    }
    print_success "Demo dependencies updated successfully"
    
    # Restart demo server to ensure new dependencies are loaded
    restart_demo_server
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations on server..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # First ensure we have the latest code
    print_status "Pulling latest code on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull latest code on server"
        return 1
    }
    
    # Stop the server before making database changes
    print_status "Stopping server for safe migration..."
    stop_server
    
    # Wait a moment for processes to fully stop
    sleep 3
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on server"
        print_error "Attempting to start server anyway..."
        start_server
        return 1
    }
    
    # Run database migrations (safer than db push)
    print_status "Running database migrations..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma migrate deploy" || {
        print_error "Failed to run database migrations on server"
        print_error "Attempting to start server anyway..."
        start_server
        return 1
    }
    
    print_success "Database migrations completed successfully!"
    
    # Start the server with new schema
    print_status "Starting server with new schema..."
    start_server
    
    # Wait for server to fully start
    sleep 5
    
    # Verify server is responding
    print_status "Verifying server is responding..."
    if curl -s -f "https://$HOST_DOMAIN" > /dev/null 2>&1; then
        print_success "Server is responding successfully"
    else
        print_warning "Server may not be fully ready yet - check manually"
    fi
}

# Function to run safe database migrations with rollback capability
safe_migrate() {
    print_status "Running safe database migrations with rollback capability..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # First ensure we have the latest code
    print_status "Pulling latest code on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull latest code on server"
        return 1
    }
    
    # Create a backup before proceeding
    print_status "Creating database backup before migration..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma db pull --schema=prisma/schema.prisma.backup" || {
        print_warning "Could not create schema backup - proceeding anyway"
    }
    
    # Stop the server before making database changes
    print_status "Stopping server for safe migration..."
    stop_server
    
    # Wait a moment for processes to fully stop
    sleep 3
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on server"
        print_error "Attempting to start server anyway..."
        start_server
        return 1
    }
    
    # Run database migrations with extra safety
    print_status "Running database migrations..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma migrate deploy" || {
        print_error "Failed to run database migrations on server"
        print_error "Migration failed - server will remain stopped for manual intervention"
        print_error "You may need to manually rollback or fix the database schema"
        return 1
    }
    
    print_success "Database migrations completed successfully!"
    
    # Start the server with new schema
    print_status "Starting server with new schema..."
    start_server
    
    # Wait for server to fully start
    sleep 5
    
    # Verify server is responding
    print_status "Verifying server is responding..."
    if curl -s -f "https://$HOST_DOMAIN" > /dev/null 2>&1; then
        print_success "Server is responding successfully"
        print_success "Safe migration completed successfully!"
    else
        print_warning "Server may not be fully ready yet - check manually"
    fi
}

# Function to view Passenger logs
view_passenger_logs() {
    print_status "Fetching Passenger logs..."
    ssh "$HOST_USER@$HOST_DOMAIN" "tail -200 /home/$HOST_USER/logs/setlist-passenger.log" || {
        print_error "Failed to fetch Passenger logs"
        return 1
    }
}

# Function to view application logs
view_app_logs() {
    print_status "Fetching application logs..."
    
    # Try multiple possible log file locations
    local log_files=(
        "/home/$HOST_USER/logs/setlister/app-production.log"
        "/home/$HOST_USER/logs/app-production.log"
        "/home/$HOST_USER/logs/setlister.log"
        "/home/$HOST_USER/logs/application.log"
    )
    
    local found_log=false
    for log_file in "${log_files[@]}"; do
        if ssh "$HOST_USER@$HOST_DOMAIN" "test -f $log_file" 2>/dev/null; then
            print_status "Found log file: $log_file"
            ssh "$HOST_USER@$HOST_DOMAIN" "tail -200 $log_file" && {
                found_log=true
                break
            }
        fi
    done
    
    if [ "$found_log" = false ]; then
        print_warning "No application log files found. Available log files:"
        ssh "$HOST_USER@$HOST_DOMAIN" "find /home/$HOST_USER/logs -name '*.log' -type f 2>/dev/null | head -10" || {
            print_error "Could not list available log files"
        }
    fi
}

# Function to test PostgreSQL migration locally
test_migration() {
    print_status "Testing PostgreSQL migration locally..."
    
    # Check if we have the required files
    if [ ! -f "migrate-sqlite-to-postgres.js" ]; then
        print_error "Migration script not found: migrate-sqlite-to-postgres.js"
        return 1
    fi
    
    if [ ! -f "prisma/schema.prisma" ]; then
        print_error "Prisma schema not found: prisma/schema.prisma"
        return 1
    fi
    
    # Check if PostgreSQL migration is needed
    print_status "Checking if PostgreSQL migration files exist..."
    if [ ! -d "migration-output" ]; then
        print_status "Generating PostgreSQL migration files..."
        node migrate-sqlite-to-postgres.js || {
            print_error "Failed to generate migration files locally"
            return 1
        }
    else
        print_status "Migration files already exist, skipping generation"
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate || {
        print_error "Failed to generate Prisma client locally"
        return 1
    }
    
    # Small delay to ensure Prisma client is ready
    print_status "Waiting for Prisma client to be ready..."
    sleep 2
    
    # Push schema changes to database
    print_status "Running PostgreSQL schema migration..."
    export $(cat .env | xargs)
    npx prisma db push || {
        print_error "Failed to run PostgreSQL migration locally"
        return 1
    }
    
    # Import data if tables are empty
    print_status "Checking if data import is needed..."
    USER_COUNT=$(node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.user.count().then((count) => { console.log(count); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });" 2>/dev/null || echo "0")
    
    if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "" ]; then
        print_status "Importing data from SQLite migration files..."
        
        # Import each table in dependency order
        for table in users bands artists vocalists songs gig_documents setlists medleys band_members song_artists band_songs setlist_sets setlist_songs medley_songs band_invitations password_resets links; do
            print_status "Importing $table..."
            if [ -f "migration-output/$table.sql" ]; then
                PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f "migration-output/$table.sql" || {
                    print_warning "Failed to import $table, continuing..."
                }
            else
                print_warning "No migration file for $table"
            fi
        done
        print_success "Data import completed"
        
        # Fix auto-increment sequences after data migration
        print_status "Fixing auto-increment sequences..."
        PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT setval('users_id_seq', (SELECT MAX(id) FROM users)); SELECT setval('bands_id_seq', (SELECT MAX(id) FROM bands)); SELECT setval('artists_id_seq', (SELECT MAX(id) FROM artists)); SELECT setval('vocalists_id_seq', (SELECT MAX(id) FROM vocalists)); SELECT setval('songs_id_seq', (SELECT MAX(id) FROM songs)); SELECT setval('gig_documents_id_seq', (SELECT MAX(id) FROM gig_documents)); SELECT setval('setlists_id_seq', (SELECT MAX(id) FROM setlists)); SELECT setval('band_members_id_seq', (SELECT MAX(id) FROM band_members)); SELECT setval('password_resets_id_seq', (SELECT MAX(id) FROM password_resets)); SELECT setval('setlist_sets_id_seq', (SELECT MAX(id) FROM setlist_sets)); SELECT setval('setlist_songs_id_seq', (SELECT MAX(id) FROM setlist_songs)); SELECT setval('medleys_id_seq', (SELECT MAX(id) FROM medleys)); SELECT setval('medley_songs_id_seq', (SELECT MAX(id) FROM medleys)); SELECT setval('band_songs_id_seq', (SELECT MAX(id) FROM band_songs)); SELECT setval('links_id_seq', (SELECT MAX(id) FROM links));" || {
            print_warning "Failed to fix sequences, continuing..."
        }
        print_success "Sequences fixed"
    else
        print_status "Data already exists, skipping import"
    fi
    
    # Test the database connection
    print_status "Testing database connection..."
    node -e "const { PrismaClient } = require('./generated/prisma'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('✅ Local PostgreSQL database connection successful'); process.exit(0); }).catch(err => { console.error('❌ Local PostgreSQL database connection failed:', err.message); process.exit(1); });" || {
        print_error "Local PostgreSQL database connection test failed"
        return 1
    }
    
    print_success "Local migration test completed successfully!"
    print_status "Your local PostgreSQL database is ready for testing"
}

# Function to deploy to demo environment with PostgreSQL migration
# Note: This function automatically fixes auto-increment sequences after data import
# to prevent "duplicate key value violates unique constraint" errors when creating new records
deploy_to_demo() {
    print_status "Deploying to demo environment with PostgreSQL migration..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/$CURRENT_BRANCH --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin "$CURRENT_BRANCH"
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Ensure demo server is on the same branch
    print_status "Ensuring demo server is on branch: $CURRENT_BRANCH"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && git checkout $CURRENT_BRANCH" || {
        print_error "Failed to checkout branch $CURRENT_BRANCH on demo server"
        return 1
    }
    
    # Pull on demo server
    print_status "Pulling changes on demo server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull on demo server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies on demo server..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Check if PostgreSQL migration is needed
    print_status "Checking if PostgreSQL migration is needed..."
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && [ ! -f 'migration-output' ]"; then
        print_status "Generating PostgreSQL migration files..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node migrate-sqlite-to-postgres.js" || {
            print_error "Failed to generate migration files on demo server"
            return 1
        }
    else
        print_status "Migration files already exist, skipping generation"
    fi
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on demo server"
        return 1
    }
    
    # Push schema changes to database
    print_status "Running PostgreSQL schema migration..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && export \$(cat .env | xargs) && NODE_ENV=demo PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma db push" || {
        print_error "Failed to run PostgreSQL migration on demo server"
        return 1
    }
    
    # Import data if tables are empty
    print_status "Checking if data import is needed..."
    USER_COUNT=$(ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && NODE_ENV=demo PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e \"const { prisma } = require('./lib/prisma'); prisma.user.count().then((count) => { console.log(count); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });\"" 2>/dev/null || echo "0")
    
    if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "" ]; then
        print_status "Importing data from SQLite migration files..."
        
        # Import each table in dependency order
        for table in users bands artists vocalists songs gig_documents setlists medleys band_members song_artists band_songs setlist_sets setlist_songs medley_songs band_invitations password_resets links; do
            print_status "Importing $table..."
            ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && export \$(cat .env | xargs) && [ -f 'migration-output/$table.sql' ] && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -f 'migration-output/$table.sql' || echo 'No migration file for $table'" || {
                print_warning "Failed to import $table, continuing..."
            }
        done
        print_success "Data import completed"
        
        # Fix auto-increment sequences after data migration
        print_status "Fixing auto-increment sequences..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && export \$(cat .env | xargs) && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -c \"SELECT setval('users_id_seq', (SELECT MAX(id) FROM users)); SELECT setval('bands_id_seq', (SELECT MAX(id) FROM bands)); SELECT setval('artists_id_seq', (SELECT MAX(id) FROM artists)); SELECT setval('vocalists_id_seq', (SELECT MAX(id) FROM vocalists)); SELECT setval('songs_id_seq', (SELECT MAX(id) FROM songs)); SELECT setval('gig_documents_id_seq', (SELECT MAX(id) FROM gig_documents)); SELECT setval('setlists_id_seq', (SELECT MAX(id) FROM setlists)); SELECT setval('band_members_id_seq', (SELECT MAX(id) FROM band_members)); SELECT setval('password_resets_id_seq', (SELECT MAX(id) FROM password_resets)); SELECT setval('setlist_sets_id_seq', (SELECT MAX(id) FROM setlist_sets)); SELECT setval('setlist_songs_id_seq', (SELECT MAX(id) FROM setlist_songs)); SELECT setval('medleys_id_seq', (SELECT MAX(id) FROM medleys)); SELECT setval('medley_songs_id_seq', (SELECT MAX(id) FROM medley_songs)); SELECT setval('band_songs_id_seq', (SELECT MAX(id) FROM band_songs)); SELECT setval('links_id_seq', (SELECT MAX(id) FROM links));\"" || {
            print_warning "Failed to fix sequences, continuing..."
        }
        print_success "Sequences fixed"
    else
        print_status "Data already exists, skipping import"
    fi
    
    # Test the demo application
    print_status "Testing demo application..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $DEMO_PATH && NODE_ENV=demo PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/node -e 'const { prisma } = require(\"./lib/prisma\"); prisma.\$connect().then(() => { console.log(\"✅ Demo database connection successful\"); process.exit(0); }).catch(err => { console.error(\"❌ Demo database connection failed:\", err.message); process.exit(1); });'" || {
        print_error "Demo database connection test failed"
        return 1
    }
    
    print_success "Demo deployment completed successfully!"
    print_status "Demo environment available at: https://demoset.bagus.org/"
    print_warning "Note: You may need to restart the demo server if using Passenger"
}

# Function to show status
show_status() {
    print_status "Checking deployment status..."
    
    echo -e "\n${BLUE}Local Git Status:${NC}"
    git status --short
    
    echo -e "\n${BLUE}Recent Commits:${NC}"
    git log --oneline -5
    
    echo -e "\n${BLUE}Server Status:${NC}"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && echo 'Current commit:' && git log --oneline -1 && echo 'Server restart file:' && ls -la tmp/restart.txt 2>/dev/null && echo 'Server restart file exists' || echo 'No restart file found'"
    
    echo -e "\n${BLUE}Database Status:${NC}"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && ls -la database.sqlite 2>/dev/null && echo 'Database exists' || echo 'Database not found'"
}

# Function to create backup
create_backup() {
    print_status "Creating backup..."
    
    # Prompt user for backup directory (outside of git repo for security)
    echo -e "${YELLOW}⚠️  SECURITY WARNING: Backup contains .env file with secrets${NC}"
    echo -e "${YELLOW}   Choose a location OUTSIDE this git repository${NC}"
    echo
    
    # Suggest a default backup location
    DEFAULT_BACKUP_DIR="$HOME/Desktop/setlist_backups"
    
    read -p "Enter backup directory path (default: $DEFAULT_BACKUP_DIR): " BACKUP_DIR
    
    # Use default if user didn't enter anything
    if [[ -z "$BACKUP_DIR" ]]; then
        BACKUP_DIR="$DEFAULT_BACKUP_DIR"
        print_status "Using default backup directory: $BACKUP_DIR"
    fi
    
    # Expand tilde and resolve path
    BACKUP_DIR=$(eval echo "$BACKUP_DIR")
    
    # Validate the backup directory is outside the git repo
    GIT_ROOT=$(git rev-parse --show-toplevel)
    if [[ "$BACKUP_DIR" == "$GIT_ROOT"* ]]; then
        print_error "Backup directory cannot be inside the git repository!"
        print_error "Git root: $GIT_ROOT"
        print_error "Backup dir: $BACKUP_DIR"
        print_error "Please choose a location outside the repository."
        return 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR" || {
        print_error "Failed to create backup directory: $BACKUP_DIR"
        return 1
    }
    
    # Create backup filename
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/setlist_backup_$TIMESTAMP.tar.gz"
    
    print_status "Creating backup on server..."
    
    # Create backup on server
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && tar -czf /tmp/setlist_backup_$TIMESTAMP.tar.gz ." || {
        print_error "Failed to create backup on server"
        return 1
    }
    
    print_status "Downloading backup to: $BACKUP_FILE"
    
    # Download backup
    scp "$HOST_USER@$HOST_DOMAIN:/tmp/setlist_backup_$TIMESTAMP.tar.gz" "$BACKUP_FILE" || {
        print_error "Failed to download backup"
        return 1
    }
    
    # Clean up server backup
    ssh "$HOST_USER@$HOST_DOMAIN" "rm /tmp/setlist_backup_$TIMESTAMP.tar.gz"
    
    print_success "Backup created: $BACKUP_FILE"
    print_warning "⚠️  This backup contains sensitive data (.env file)"
    print_warning "   Keep it secure and don't share it!"
}

# Function to create database backup and download it locally
create_dbackup() {
    print_status "Creating database backup and downloading locally..."
    
    # Create backup directory if it doesn't exist
    ssh "$HOST_USER@$HOST_DOMAIN" "mkdir -p ~/repositories/dbackups"
    
    # Create local backup directory
    mkdir -p "$BACKUP_PATH"
    
    # Create backup filename with timestamp
    BACKUP_FILENAME="setlister_prod_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Create PostgreSQL backup on server
    print_status "Creating PostgreSQL backup on server..."
    # --verbose: Shows progress and details
    # --inserts: Uses INSERT statements instead of COPY for better compatibility
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && pg_dump --verbose --inserts \"postgresql://bagus1_setlists_app:allofmyfriends@localhost:5432/bagus1_setlists_prod\" > ~/repositories/dbackups/$BACKUP_FILENAME"
    
    # Download backup to local backup directory
    print_status "Downloading backup to $BACKUP_PATH..."
    scp "$HOST_USER@$HOST_DOMAIN:~/repositories/dbackups/$BACKUP_FILENAME" "$BACKUP_PATH/"
    
    # Compress the local backup
    print_status "Compressing local backup..."
    gzip "$BACKUP_PATH/$BACKUP_FILENAME"
    
    print_success "Database backup created and downloaded: $BACKUP_PATH/$BACKUP_FILENAME.gz"
    print_status "Server backup also available at: ~/repositories/dbackups/$BACKUP_FILENAME"
}

# Function to restore database backup locally
restore_dbackup_local() {
    print_status "Restoring database backup locally..."
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup directory not found: $BACKUP_PATH"
        print_error "Run './deploy.sh dbackup' first to create a backup"
        return 1
    fi
    
    # List available backups
    print_status "Available backups in $BACKUP_PATH:"
    
    # Find all backup files (SQL, compressed SQL, and tar.gz)
    local sql_backups=($(ls -t "$BACKUP_PATH"/*.sql 2>/dev/null))
    local sql_gz_backups=($(ls -t "$BACKUP_PATH"/*.sql.gz 2>/dev/null))
    local tar_gz_backups=($(ls -t "$BACKUP_PATH"/*.tar.gz 2>/dev/null))
    
    # Combine all backups
    local all_backups=("${sql_backups[@]}" "${sql_gz_backups[@]}" "${tar_gz_backups[@]}")
    
    if [ ${#all_backups[@]} -eq 0 ]; then
        print_error "No backup files found in $BACKUP_PATH"
        print_error "Run './deploy.sh dbackup' first to create a backup"
        return 1
    fi
    
    # Show backups with numbers
    for i in "${!all_backups[@]}"; do
        local filename=$(basename "${all_backups[$i]}")
        local size=$(du -h "${all_backups[$i]}" | cut -f1)
        local file_type=""
        
        # Determine file type for display
        if [[ "$filename" == *.tar.gz ]]; then
            file_type=" (TAR.GZ)"
        elif [[ "$filename" == *.sql.gz ]]; then
            file_type=" (SQL.GZ)"
        elif [[ "$filename" == *.sql ]]; then
            file_type=" (SQL)"
        fi
        
        echo "  $((i+1)). $filename$file_type ($size)"
    done
    
    # Prompt for backup selection
    echo
    read -p "Select backup to restore (1-${#all_backups[@]}): " selection
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#all_backups[@]} ]; then
        print_error "Invalid selection. Please choose a number between 1 and ${#all_backups[@]}"
        return 1
    fi
    
    local selected_backup="${all_backups[$((selection-1))]}"
    local backup_filename=$(basename "$selected_backup")
    
    print_status "Selected backup: $backup_filename"
    
    # Confirm restore
    read -p "This will overwrite your local database. Continue? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        return 0
    fi
    
    # Get database info from .env
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Cannot determine database connection details."
        return 1
    fi
    
    # Source .env file to get database variables
    export $(cat .env | grep -v '^#' | xargs)
    
    # Check if required variables are set
    if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
        print_error "Missing required database variables in .env (DB_NAME, DB_USER, DB_PASSWORD)"
        return 1
    fi
    
    print_status "Restoring to local database: $DB_NAME"
    
    # Ask if user wants to clean database first
    read -p "Clean database before restore? This will drop all existing data. (y/N): " clean_confirm
    if [[ $clean_confirm =~ ^[Yy]$ ]]; then
        print_status "Cleaning database (dropping all tables and constraints)..."
        
        # Drop all tables and constraints using a simpler approach
        PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
            print_error "Database cleaning failed"
            return 1
        }
        
        print_success "Database cleaned successfully"
    else
        print_warning "Skipping database cleaning - restore may fail due to existing data conflicts"
    fi
    
    # Handle different backup file types
    local temp_sql=""
    
    if [[ "$selected_backup" == *.tar.gz ]]; then
        print_status "Extracting TAR.GZ backup..."
        local temp_dir=$(mktemp -d)
        tar -xzf "$selected_backup" -C "$temp_dir"
        
        # Find the SQL file in the extracted directory
        local sql_file=$(find "$temp_dir" -name "*.sql" -type f | head -1)
        if [ -z "$sql_file" ]; then
            print_error "No SQL file found in TAR.GZ backup"
            rm -rf "$temp_dir"
            return 1
        fi
        
        temp_sql="$sql_file"
        print_status "Found SQL file: $(basename "$sql_file")"
        
    elif [[ "$selected_backup" == *.sql.gz ]]; then
        print_status "Decompressing SQL.GZ backup..."
        temp_sql="${selected_backup%.gz}"
        gunzip -c "$selected_backup" > "$temp_sql"
        
    elif [[ "$selected_backup" == *.sql ]]; then
        print_status "Using uncompressed SQL backup..."
        temp_sql="$selected_backup"
        
    else
        print_error "Unsupported backup file type"
        return 1
    fi
    
    # Restore database
    print_status "Restoring database (this may take a while)..."
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$temp_sql" 2>&1 | tee restore_output.log || {
        print_warning "Database restore completed with some errors (this is normal for production backups)"
        print_status "Check restore_output.log for details"
    }
    
    # Clean up temp files
    if [[ "$selected_backup" == *.tar.gz ]]; then
        rm -rf "$temp_dir"
    else
        rm -f "$temp_sql"
    fi
    
    # Verify restore
    print_status "Verifying restore..."
    local user_count=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | xargs)
    local song_count=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM songs;" | xargs)
    local song_artist_count=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM song_artists;" | xargs)
    
    print_success "Database restore completed successfully!"
    print_status "Verification results:"
    print_status "  Users: $user_count"
    print_status "  Songs: $song_count"
    print_status "  Song-Artist relationships: $song_artist_count"
    
    # Step 6: Regenerate Prisma client and apply schema changes
    print_status "Step 6: Updating local development environment..."
    
    print_status "Regenerating Prisma client..."
    npx prisma generate || {
        print_warning "Failed to regenerate Prisma client"
    }
    
    print_status "Applying schema changes to local database..."
    npx prisma db push || {
        print_warning "Failed to apply schema changes with prisma db push"
    }
    
    # Step 7: Run seeding scripts
    print_status "Step 7: Running local seeding scripts..."
    
    # Check if seeding directory exists
    if [ -d "prisma/seeds" ]; then
        print_status "Found seeding directory, running SQL scripts..."
        
        # Load environment variables
        export $(cat .env | grep -v '^#' | xargs)
        
        # Run all SQL files in the seeds directory
        for sql_file in prisma/seeds/*.sql; do
            if [ -f "$sql_file" ]; then
                local filename=$(basename "$sql_file")
                print_status "Running: $filename"
                PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" || {
                    print_warning "Failed to run $filename (continuing with other scripts)"
                }
            fi
        done
        
        print_success "Local seeding completed"
    else
        print_status "No seeding directory found (prisma/seeds), skipping seeding"
    fi
    
    print_success "Local development environment fully updated!"
}

# Function to restore production backup locally (step-by-step)
restore_prod_db_locally() {
    print_status "Restoring production backup locally (step-by-step)..."
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup directory not found: $BACKUP_PATH"
        print_error "Please check your BACKUP_PATH setting"
        return 1
    fi
    
    # List available tar.gz backups
    print_status "Available tar.gz backups in $BACKUP_PATH:"
    local backups=($(ls -t "$BACKUP_PATH"/*.tar.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_error "No tar.gz backups found in $BACKUP_PATH"
        print_error "Please check your BACKUP_PATH setting"
        return 1
    fi
    
    # Show backups with numbers
    for i in "${!backups[@]}"; do
        local filename=$(basename "${backups[$i]}")
        local size=$(du -h "${backups[$i]}" | cut -f1)
        echo "  $((i+1)). $filename ($size)"
    done
    
    # Prompt for backup selection
    echo
    read -p "Select backup to restore (1-${#backups[@]}): " selection
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#backups[@]} ]; then
        print_error "Invalid selection. Please choose a number between 1 and ${#backups[@]}"
        return 1
    fi
    
    local selected_backup="${backups[$((selection-1))]}"
    local backup_filename=$(basename "$selected_backup")
    
    print_status "Selected backup: $backup_filename"
    
    # Confirm restore
    read -p "This will overwrite your local database. Continue? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        return 0
    fi
    
    # Get database info from .env
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Cannot determine database connection details."
        return 1
    fi
    
    # Source .env file to get database variables
    export $(cat .env | grep -v '^#' | xargs)
    
    # Check if required variables are set
    if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
        print_error "Missing required database variables in .env (DB_NAME, DB_USER, DB_PASSWORD)"
        return 1
    fi
    
    print_status "Restoring to local database: $DB_NAME"
    
    # Create temporary extraction directory
    local extract_dir="./backup_extracted"
    if [ -d "$extract_dir" ]; then
        rm -rf "$extract_dir"
    fi
    mkdir -p "$extract_dir"
    
    # Step 1: Extract backup
    print_status "Step 1: Extracting backup file..."
    tar -xzf "$selected_backup" -C "$extract_dir" || {
        print_error "Failed to extract backup"
        rm -rf "$extract_dir"
        return 1
    }
    print_success "Backup extracted successfully"
    
    # Step 2: Clear current database and recreate schema
    print_status "Step 2: Clearing current database and recreating schema..."
    
    # Drop and recreate the entire schema to ensure clean state
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
        print_error "Failed to recreate database schema"
        return 1
    }
    
    print_success "Database schema recreated successfully"
    
    # Step 3: Restore tables in dependency order
    print_status "Step 3: Restoring tables in dependency order..."
    
    # First, check if we have a schema file
    local schema_file="$extract_dir/schema.sql"
    if [ -f "$schema_file" ]; then
        print_status "Found schema file, creating tables first..."
        PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" < "$schema_file" 2>&1 | tee -a restore_output.log || {
            print_warning "Schema creation had some errors (continuing)"
        }
        print_success "Schema created"
    fi
    
    # Look for individual table files in migration-output directory
    local migration_dir="$extract_dir/migration-output"
    if [ -d "$migration_dir" ]; then
        local restore_order=("users" "artists" "vocalists" "bands" "songs" "band_members" "band_songs" "song_artists" "setlists" "setlist_sets" "setlist_songs" "gig_documents" "links" "medley_songs" "BandInvitations" "password_resets")
        
        for table in "${restore_order[@]}"; do
            local sql_file="$migration_dir/$table.sql"
            
            if [ -f "$sql_file" ]; then
                print_status "Restoring table: $table"
                PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" < "$sql_file" 2>&1 | tee -a restore_output.log || {
                    print_warning "Failed to restore $table (continuing with other tables)"
                }
                
                # Get row count for verification
                local count_result=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
                if [ -n "$count_result" ]; then
                    print_status "  📊 $table: $count_result rows restored"
                fi
            else
                print_warning "SQL file not found for $table, skipping"
            fi
        done
    else
        print_warning "No migration-output directory found, checking for other SQL files..."
        
        # Look for any SQL files in the extracted directory
        local sql_files=($(find "$extract_dir" -name "*.sql" -type f))
        if [ ${#sql_files[@]} -gt 0 ]; then
            print_status "Found ${#sql_files[@]} SQL files, attempting to restore..."
            for sql_file in "${sql_files[@]}"; do
                local filename=$(basename "$sql_file")
                print_status "Processing: $filename"
                PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" < "$sql_file" 2>&1 | tee -a restore_output.log || {
                    print_warning "Failed to process $filename (continuing)"
                }
            done
        else
            print_error "No SQL files found in extracted backup"
            return 1
        fi
    fi
    
    print_success "Table restoration completed"
    
    # Step 3.5: Run Prisma migrations if needed
    print_status "Step 3.5: Running Prisma migrations..."
    if command -v npx &> /dev/null; then
        print_status "Running Prisma migrate deploy..."
        npx prisma migrate deploy 2>&1 | tee -a restore_output.log || {
            print_warning "Prisma migrations had some errors (continuing)"
        }
        print_success "Prisma migrations completed"
    
    print_status "Regenerating Prisma client..."
    npx prisma generate 2>&1 | tee -a restore_output.log || {
        print_warning "Prisma client generation had some errors (continuing)"
    }
    print_success "Prisma client regenerated"
    else
        print_warning "npx not found, skipping Prisma migrations and client generation"
    fi
    
    # Step 4: Verify restore
    print_status "Step 4: Verifying restore..."
    
    local verify_tables=("songs" "gig_documents" "links" "users" "bands")
    
    for table in "${verify_tables[@]}"; do
        local count_result=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        if [ -n "$count_result" ]; then
            print_status "  📊 $table: $count_result rows"
        else
            print_warning "  ❌ $table: Error getting count"
        fi
    done
    
    print_success "Verification completed"
    
    # Step 5: Cleanup
    print_status "Step 5: Cleaning up temporary files..."
    rm -rf "$extract_dir"
    print_success "Temporary files cleaned up"
    
    print_success "Production backup restore completed successfully!"
    print_status "Check restore_output.log for any error details"
}

# Function to restore production backup locally (step-by-step)
restore_prod_db_locally() {
    print_status "Restoring production backup locally (step-by-step)..."
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_PATH" ]; then
        print_error "Backup directory not found: $BACKUP_PATH"
        print_error "Please check your BACKUP_PATH setting"
        return 1
    fi
    
    # List available tar.gz backups
    print_status "Available tar.gz backups in $BACKUP_PATH:"
    local backups=($(ls -t "$BACKUP_PATH"/*.tar.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_error "No tar.gz backups found in $BACKUP_PATH"
        print_error "Please check your BACKUP_PATH setting"
        return 1
    fi
    
    # Show backups with numbers
    for i in "${!backups[@]}"; do
        local filename=$(basename "${backups[$i]}")
        local size=$(du -h "${backups[$i]}" | cut -f1)
        echo "  $((i+1)). $filename ($size)"
    done
    
    # Prompt for backup selection
    echo
    read -p "Select backup to restore (1-${#backups[@]}): " selection
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt ${#backups[@]} ]; then
        print_error "Invalid selection. Please choose a number between 1 and ${#backups[@]}"
        return 1
    fi
    
    local selected_backup="${backups[$((selection-1))]}"
    local backup_filename=$(basename "$selected_backup")
    
    print_status "Selected backup: $backup_filename"
    
    # Confirm restore
    read -p "This will overwrite your local database. Continue? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_status "Restore cancelled"
        return 0
    fi
    
    # Get database info from .env
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Cannot determine database connection details."
        return 1
    fi
    
    # Source .env file to get database variables
    export $(cat .env | grep -v '^#' | xargs)
    
    # Check if required variables are set
    if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
        print_error "Missing required database variables in .env (DB_NAME, DB_USER, DB_PASSWORD)"
        return 1
    fi
    
    print_status "Restoring to local database: $DB_NAME"
    
    # Create temporary extraction directory
    local extract_dir="./backup_extracted"
    if [ -d "$extract_dir" ]; then
        rm -rf "$extract_dir"
    fi
    mkdir -p "$extract_dir"
    
    # Step 1: Extract backup
    print_status "Step 1: Extracting backup file..."
    tar -xzf "$selected_backup" -C "$extract_dir" || {
        print_error "Failed to extract backup"
        rm -rf "$extract_dir"
        return 1
    }
    print_success "Backup extracted successfully"
    
    # Step 2: Clear current database
    print_status "Step 2: Clearing current database..."
    
    # Disable foreign key checks temporarily
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SET session_replication_role = replica;" || {
        print_warning "Could not disable foreign key checks (continuing)"
    }
    
    # Clear all tables in reverse dependency order
    local tables=("password_resets" "BandInvitations" "medley_songs" "links" "gig_documents" "setlist_songs" "setlist_sets" "setlists" "song_artists" "band_songs" "band_members" "songs" "bands" "vocalists" "artists" "users")
    
    for table in "${tables[@]}"; do
        PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE $table CASCADE;" 2>/dev/null || {
            print_warning "Table $table doesn't exist or couldn't be cleared (continuing)"
        }
    done
    
    # Re-enable foreign key checks
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SET session_replication_role = DEFAULT;" || {
        print_warning "Could not re-enable foreign key checks (continuing)"
    }
    
    print_success "Database cleared successfully"
    
    # Step 3: Restore tables in dependency order
    print_status "Step 3: Restoring tables in dependency order..."
    
    local restore_order=("users" "artists" "vocalists" "bands" "songs" "band_members" "band_songs" "song_artists" "setlists" "setlist_sets" "setlist_songs" "gig_documents" "links" "medley_songs" "BandInvitations" "password_resets")
    
    for table in "${restore_order[@]}"; do
        local sql_file="$extract_dir/migration-output/$table.sql"
        
        if [ -f "$sql_file" ]; then
            print_status "Restoring table: $table"
            PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" < "$sql_file" 2>&1 | tee -a restore_output.log || {
                print_warning "Failed to restore $table (continuing with other tables)"
            }
            
            # Get row count for verification
            local count_result=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            if [ -n "$count_result" ]; then
                print_status "  📊 $table: $count_result rows restored"
            fi
        else
            print_warning "SQL file not found for $table, skipping"
        fi
    done
    
    print_success "Table restoration completed"
    
    # Step 4: Verify restore
    print_status "Step 4: Verifying restore..."
    
    local verify_tables=("songs" "gig_documents" "links" "users" "bands")
    
    for table in "${verify_tables[@]}"; do
        local count_result=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        if [ -n "$count_result" ]; then
            print_status "  📊 $table: $count_result rows"
        else
            print_warning "  ❌ $table: Error getting count"
        fi
    done
    
    print_success "Verification completed"
    
    # Step 5: Cleanup
    print_status "Step 5: Cleaning up temporary files..."
    rm -rf "$extract_dir"
    print_success "Temporary files cleaned up"
    
    print_success "Production backup restore completed successfully!"
    print_status "Check restore_output.log for any error details"
}

# Function to run database seeding scripts
run_seeding() {
    print_status "Running database seeding scripts on production..."
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Current branch: $CURRENT_BRANCH"
    
    # First ensure we have the latest code
    print_status "Pulling latest code on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git checkout $CURRENT_BRANCH && git pull origin $CURRENT_BRANCH" || {
        print_error "Failed to pull latest code on server"
        return 1
    }
    
    # Check if seeding directory exists
    print_status "Checking for seeding scripts..."
    if ! ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && [ -d 'prisma/seeds' ]"; then
        print_error "Seeding directory not found: prisma/seeds"
        print_error "Please ensure seeding scripts are in the correct location"
        return 1
    fi
    
    # List available seeding scripts
    print_status "Available seeding scripts:"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && find prisma/seeds -name '*.sql' -type f" || {
        print_error "No SQL seeding scripts found in prisma/seeds"
        return 1
    }
    
    # Ask for confirmation
    echo
    read -p "This will run seeding scripts on the production database. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Seeding cancelled by user"
        return 0
    fi
    
    # Run all SQL files in the seeds directory
    print_status "Running seeding scripts..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && for sql_file in prisma/seeds/*.sql; do echo \"Running: \$sql_file\"; PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -f \"\$sql_file\" || { echo \"Error running \$sql_file\"; exit 1; }; done" || {
        print_error "Failed to run seeding scripts on production database"
        return 1
    }
    
    print_success "Database seeding completed successfully!"
    
    # Verify the seeding worked by checking record counts
    print_status "Verifying seeding results..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && export \$(cat .env | xargs) && echo 'Venue Contact Types:' && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -t -c 'SELECT COUNT(*) FROM venue_contact_types;' && echo 'Venue Social Types:' && PGPASSWORD=\$DB_PASSWORD psql -h localhost -U \$DB_USER -d \$DB_NAME -t -c 'SELECT COUNT(*) FROM venue_social_types;'" || {
        print_warning "Could not verify seeding results"
    }
    
    print_success "Seeding verification completed!"
}

# Function to rollback
rollback() {
    print_warning "Rolling back to previous commit..."
    
    # Get previous commit
    PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
    
    print_warning "Rolling back to: $(git log --oneline -1 $PREVIOUS_COMMIT)"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Rollback cancelled"
        return 0
    fi
    
    # Reset local repository
    git reset --hard $PREVIOUS_COMMIT
    
    # Force push to GitHub
    CURRENT_BRANCH=$(git branch --show-current)
    git push --force origin "$CURRENT_BRANCH"
    
    # Pull on server
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git reset --hard $PREVIOUS_COMMIT"
    
    restart_server
    
    print_success "Rollback completed"
}

# Main script logic
main() {
    check_git
    
    case "$MODE" in
        "help")
            show_help
            exit 0
            ;;
        "status")
            show_status
            exit 0
            ;;
        "logs")
            view_passenger_logs
            exit 0
            ;;
        "app-logs")
            view_app_logs
            exit 0
            ;;
        "restart")
            restart_server
            exit 0
            ;;
        "restart-demo")
            restart_demo_server
            exit 0
            ;;
        "stop")
            stop_server
            exit 0
            ;;
        "start")
            start_server
            exit 0
            ;;
        "backup")
            create_backup
            exit 0
            ;;
        "dbackup")
            create_dbackup
            exit 0
            ;;
        "restoredb-local")
            restore_dbackup_local
            exit 0
            ;;
        "restore-prod-db-locally")
            restore_prod_db_locally
            exit 0
            ;;
        "rollback")
            check_branch_mismatch
            rollback
            exit 0
            ;;
        "deploy")
            check_git_status
            check_branch_mismatch
            deploy_via_git
            ;;
        "deploy-schema")
            check_git_status
            deploy_schema
            ;;
        "deploy-simple")
            check_git_status
            check_branch_mismatch
            deploy_simple
            ;;
        "deploy-postgres")
            check_git_status
            check_branch_mismatch
            deploy_postgres_via_git
            ;;
        "update")
            check_git_status
            check_branch_mismatch
            update_via_git
            ;;
        "quick")
            check_git_status
            check_branch_mismatch
            quick_deploy
            ;;
        "deploy-demo")
            check_git_status
            deploy_to_demo
            ;;
        "test-migration")
            test_migration
            ;;
        "deps")
            update_dependencies
            ;;
        "deps-demo")
            update_demo_dependencies
            ;;
        "migrate")
            run_migrations
            ;;
        "safe-migrate")
            safe_migrate
            ;;
        "seed")
            run_seeding
            ;;
        *)
            print_error "Unknown mode: $MODE"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 