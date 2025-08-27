#!/bin/bash

# Setlist Manager Git-Based Deployment Script
# Usage: ./deploy.sh [mode]
# 
# Modes:
#   deploy   - Deploy current changes (push to git, pull on server, restart)
#   update   - Quick deploy (push to git, pull on server, restart)
#   quick    - Update files without restart (auto-commit, push to git, pull on server)
#   restart  - Just restart the server
#   stop     - Stop the server (kill Passenger process)
#   start    - Start the server (touch restart.txt)
#   deps     - Update dependencies on server
#   status   - Show deployment status
#   backup   - Create backup
#   rollback - Rollback to previous commit
#   help     - Show this help message

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
  deploy-postgres - Full PostgreSQL setup with migration (for new servers)
  update   - Quick deploy with PostgreSQL migration (push to git, pull on server, migrate, restart)
  quick    - Update files with PostgreSQL migration (auto-commit, push to git, pull on server, migrate, restart)
  deploy-demo - Deploy to demo environment with PostgreSQL migration
  test-migration - Test PostgreSQL migration locally (no server deployment)
  migrate  - Run database migrations on server (Prisma)
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
  restoredb-local - Restore database backup to local PostgreSQL
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
  ./deploy.sh deploy-postgres # Full PostgreSQL setup with migration
  ./deploy.sh update       # Quick deploy with restart
  ./deploy.sh quick        # Update files without restart
  ./deploy.sh deploy-demo  # Deploy to demo with PostgreSQL migration
  ./deploy.sh migrate      # Run database migrations (Prisma)
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
            git commit -m "Auto-commit before deployment $(date)"
            print_success "Changes committed"
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
    
    # Check if prisma/schema.prisma changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q prisma/schema.prisma"; then
        print_status "Schema changes detected in prisma/schema.prisma"
        SCHEMA_CHANGED=true
    fi
    
    # Check if any migration files changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q migration-output"; then
        print_status "Migration files changed"
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
    
    # Check for new files that might import Prisma
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q '^.*\.js$'"; then
        print_status "New JavaScript files detected - may affect Prisma initialization"
        SCHEMA_CHANGED=true
    fi
    
    # If schema changed, run Prisma commands
    if [ "$SCHEMA_CHANGED" = true ]; then
        print_status "Schema or structural changes detected - running Prisma commands..."
        
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
        
        print_success "Schema migration completed"
    else
        print_status "No schema or structural changes detected - skipping Prisma commands"
    fi
    
    # Restart server
    restart_server
    
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

# Function to stop server
stop_server() {
    print_status "Stopping server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "pkill -f 'Passenger NodeApp.*setlister'" || {
        print_warning "No Passenger process found to stop"
        return 0
    }
    print_success "Server stopped successfully"
}

# Function to start server
start_server() {
    print_status "Starting server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to start server"
        return 1
    }
    print_success "Server started successfully"
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
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma generate" || {
        print_error "Failed to generate Prisma client on server"
        return 1
    }
    
    # Push schema changes to database
    print_status "Pushing schema changes to database..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npx prisma db push" || {
        print_error "Failed to push schema changes to database"
        return 1
    }
    
    print_success "Database migrations completed successfully!"
    print_warning "Note: You may need to restart the server if migrations affect running processes."
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
    local backups=($(ls -t "$BACKUP_PATH"/*.sql.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_error "No compressed backups found in $BACKUP_PATH"
        print_error "Run './deploy.sh dbackup' first to create a backup"
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
    
    # Decompress backup
    print_status "Decompressing backup..."
    local temp_sql="${selected_backup%.gz}"
    gunzip -c "$selected_backup" > "$temp_sql"
    
    # Restore database
    print_status "Restoring database (this may take a while)..."
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$temp_sql" || {
        print_error "Database restore failed"
        rm -f "$temp_sql"
        return 1
    }
    
    # Clean up temp file
    rm -f "$temp_sql"
    
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
        *)
            print_error "Unknown mode: $MODE"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 