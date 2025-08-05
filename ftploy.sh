#!/bin/bash

# Setlist Manager Deployment Script
# Usage: ./deploy.sh [mode] [options]
# 
# Modes:
#   mods     - Deploy only modified files (default)
#   all      - Deploy all files (excluding .gitignore)
#   routes   - Deploy only route files
#   views    - Deploy only view files
#   models   - Deploy only model files
#   static   - Deploy static assets (CSS, JS, images)
#   config   - Deploy configuration files only
#   server   - Deploy server.js and package.json only
#   restart  - Just restart the server (no file transfer)
#   status   - Show deployment status and recent changes
#   backup   - Create backup before deploying
#   rollback - Rollback to previous backup
#   clean    - Clean up old backups
#   help     - Show this help message

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE=${1:-mods}
HOST_USER=${HOST_USER:-bagus1}
BAGUS_PASS=${BAGUS_PASS:-}
HOST_DOMAIN=${HOST_DOMAIN:-ftp.bagus.org}
SETLIST_PATH=${SETLIST_PATH:-/home/bagus1/public_html/setlist-manager}

# Backup directory
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

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
Setlist Manager Deployment Script

Usage: ./deploy.sh [mode] [options]

Modes:
  mods     - Deploy only modified files (default)
  all      - Deploy all files (excluding .gitignore)
  routes   - Deploy only route files
  views    - Deploy only view files
  models   - Deploy only model files
  static   - Deploy static assets (CSS, JS, images)
  config   - Deploy configuration files only
  server   - Deploy server.js and package.json only
  restart  - Just restart the server (no file transfer)
  status   - Show deployment status and recent changes
  backup   - Create backup before deploying
  rollback - Rollback to previous backup
  clean    - Clean up old backups
  help     - Show this help message

Environment Variables:
  HOST_USER     - Username for server (default: bagus1)
  BAGUS_PASS     - Password for server
  HOST_DOMAIN      - FTP server (default: ftp.bagus.org)
  SETLIST_PATH   - Path on server (default: /home/bagus1/public_html/setlist-manager)

Examples:
  ./deploy.sh                    # Deploy modified files
  ./deploy.sh all               # Deploy all files
  ./deploy.sh routes            # Deploy only routes
  ./deploy.sh restart           # Just restart server
  ./deploy.sh backup            # Create backup
  ./deploy.sh status            # Show status

EOF
}

# Function to check if we're in a git repository
check_git() {
    if [ ! -d ".git" ]; then
        print_error "Not in a git repository. Please run this script from the project root."
        exit 1
    fi
}

# Function to check environment variables
check_env() {
    if [ -z "$BAGUS_PASS" ]; then
        print_warning "BAGUS_PASS not set. You may be prompted for password."
    fi
}

# Function to create backup
create_backup() {
    print_status "Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Create backup filename
    BACKUP_FILE="$BACKUP_DIR/setlist_backup_$TIMESTAMP.tar.gz"
    
    # Create backup on server
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && tar -czf /tmp/setlist_backup_$TIMESTAMP.tar.gz ." || {
        print_error "Failed to create backup on server"
        return 1
    }
    
    # Download backup
    scp "$HOST_USER@$HOST_DOMAIN:/tmp/setlist_backup_$TIMESTAMP.tar.gz" "$BACKUP_FILE" || {
        print_error "Failed to download backup"
        return 1
    }
    
    # Clean up server backup
    ssh "$HOST_USER@$HOST_DOMAIN" "rm /tmp/setlist_backup_$TIMESTAMP.tar.gz"
    
    print_success "Backup created: $BACKUP_FILE"
}

# Function to deploy files
deploy_files() {
    local files_to_deploy="$1"
    local description="$2"
    
    if [ -z "$files_to_deploy" ]; then
        print_warning "No files to deploy for $description"
        return 0
    fi
    
    print_status "Deploying $description..."
    
    # Create temporary file list
    local temp_file_list="/tmp/deploy_files_$TIMESTAMP.txt"
    echo "$files_to_deploy" > "$temp_file_list"
    
    # Deploy files
    while IFS= read -r file; do
        if [ -n "$file" ] && [ -f "$file" ]; then
            print_status "Deploying: $file"
            
            # Determine target directory
            local target_dir="$SETLIST_PATH"
            if [[ "$file" == routes/* ]]; then
                target_dir="$SETLIST_PATH/routes"
            elif [[ "$file" == views/* ]]; then
                target_dir="$SETLIST_PATH/views"
            elif [[ "$file" == models/* ]]; then
                target_dir="$SETLIST_PATH/models"
            elif [[ "$file" == public/* ]]; then
                target_dir="$SETLIST_PATH/public"
            fi
            
            # Create directory if it doesn't exist
            ssh "$HOST_USER@$HOST_DOMAIN" "mkdir -p $target_dir"
            
            # Copy file
            scp "$file" "$HOST_USER@$HOST_DOMAIN:$target_dir/" || {
                print_error "Failed to deploy $file"
                return 1
            }
        fi
    done < "$temp_file_list"
    
    # Clean up
    rm "$temp_file_list"
    
    print_success "$description deployed successfully"
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

# Function to show status
show_status() {
    print_status "Checking deployment status..."
    
    echo -e "\n${BLUE}Recent Git Changes:${NC}"
    git log --oneline -10
    
    echo -e "\n${BLUE}Modified Files:${NC}"
    git status --porcelain
    
    echo -e "\n${BLUE}Server Status:${NC}"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && ls -la tmp/restart.txt 2>/dev/null && echo 'Server restart file exists' || echo 'No restart file found'"
    
    echo -e "\n${BLUE}Recent Backups:${NC}"
    ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5 || echo "No backups found"
}

# Function to clean old backups
clean_backups() {
    print_status "Cleaning old backups (keeping last 5)..."
    ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    print_success "Old backups cleaned"
}

# Function to rollback
rollback() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        # Find most recent backup
        backup_file=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
        if [ -z "$backup_file" ]; then
            print_error "No backup files found"
            return 1
        fi
    fi
    
    print_warning "Rolling back to: $backup_file"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Rollback cancelled"
        return 0
    fi
    
    # Upload and extract backup
    scp "$backup_file" "$HOST_USER@$HOST_DOMAIN:/tmp/"
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && tar -xzf /tmp/$(basename $backup_file) --strip-components=1 && rm /tmp/$(basename $backup_file)"
    restart_server
    
    print_success "Rollback completed"
}

# Main script logic
main() {
    check_git
    check_env
    
    case "$MODE" in
        "help")
            show_help
            exit 0
            ;;
        "status")
            show_status
            exit 0
            ;;
        "restart")
            restart_server
            exit 0
            ;;
        "backup")
            create_backup
            exit 0
            ;;
        "rollback")
            rollback "$2"
            exit 0
            ;;
        "clean")
            clean_backups
            exit 0
            ;;
        "mods")
            # Deploy modified files
            files=$(git diff --name-only HEAD~1 2>/dev/null || git ls-files --modified --others --exclude-standard)
            deploy_files "$files" "modified files"
            ;;
        "all")
            # Deploy all files except those in .gitignore
            files=$(git ls-files)
            deploy_files "$files" "all files"
            ;;
        "routes")
            # Deploy only route files
            files=$(git ls-files | grep "^routes/")
            deploy_files "$files" "route files"
            ;;
        "views")
            # Deploy only view files
            files=$(git ls-files | grep "^views/")
            deploy_files "$files" "view files"
            ;;
        "models")
            # Deploy only model files
            files=$(git ls-files | grep "^models/")
            deploy_files "$files" "model files"
            ;;
        "static")
            # Deploy static assets
            files=$(git ls-files | grep "^public/")
            deploy_files "$files" "static assets"
            ;;
        "config")
            # Deploy configuration files
            files=$(git ls-files | grep -E "\.(env|json|js)$" | grep -v "node_modules" | grep -v "package-lock.json")
            deploy_files "$files" "configuration files"
            ;;
        "server")
            # Deploy server files
            files="server.js package.json"
            deploy_files "$files" "server files"
            ;;
        *)
            print_error "Unknown mode: $MODE"
            show_help
            exit 1
            ;;
    esac
    
    # Restart server after deployment (unless it was just a restart)
    if [ "$MODE" != "restart" ] && [ "$MODE" != "status" ] && [ "$MODE" != "backup" ] && [ "$MODE" != "rollback" ] && [ "$MODE" != "clean" ]; then
        restart_server
    fi
    
    print_success "Deployment completed successfully!"
}

# Run main function
main "$@" 