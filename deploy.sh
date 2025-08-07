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
  deploy   - Deploy current changes (push to git, pull on server, restart)
  update   - Quick deploy (push to git, pull on server, restart)
  quick    - Update files without restart (auto-commit, push to git, pull on server)
  restart  - Just restart the server
  stop     - Stop the server (kill Passenger process)
  start    - Start the server (touch restart.txt)
  deps     - Update dependencies on server
  status   - Show deployment status
  backup   - Create backup
  rollback - Rollback to previous commit
  help     - Show this help message (default)

Environment Variables:
  HOST_USER      - Username for server (default: bagus1)
  HOST_DOMAIN    - Server domain (default: bagus.org)
  SETLIST_PATH   - Path on server (default: /home/bagus1/repositories/setlister)

Examples:
  ./deploy.sh deploy    # Full deployment with restart
  ./deploy.sh update    # Quick deploy with restart
  ./deploy.sh quick     # Update files without restart
  ./deploy.sh restart   # Just restart server
  ./deploy.sh stop      # Stop server
  ./deploy.sh start     # Start server
  ./deploy.sh deps      # Update dependencies
  ./deploy.sh status    # Show status

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

# Function to deploy via git
deploy_via_git() {
    print_status "Deploying via Git..."
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/main --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin main
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin main" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    # Restart server
    restart_server
    
    print_success "Deployment completed!"
}

# Function to update files without restart
update_via_git() {
    print_status "Quick deploy - pushing and pulling..."
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/main --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin main
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin main" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
    fi
    
    restart_server
    
    print_success "Quick deployment completed!"
}

# Function to quick deploy (just pull on server)
quick_deploy() {
    print_status "Updating files via Git (no restart)..."
    
    # Check if we have changes to push
    if [ "$(git rev-list HEAD...origin/main --count)" != "0" ]; then
        print_status "Pushing changes to GitHub..."
        git push origin main
        print_success "Changes pushed to GitHub"
    else
        print_status "No changes to push"
    fi
    
    # Pull on server
    print_status "Pulling changes on server..."
    ssh "$HOST_USER@$HOST_DOMAIN" "cd $SETLIST_PATH && git pull origin main" || {
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
    git push --force origin main
    
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
        "restart")
            restart_server
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
        "deps")
            update_dependencies
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