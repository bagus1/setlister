#!/bin/bash

# Setlist Manager Git-Based Deployment Script
# Usage: ./deploy-git.sh [mode]
# 
# Modes:
#   deploy   - Deploy current changes (push to git, pull on server)
#   quick    - Quick deploy (just pull on server)
#   restart  - Just restart the server
#   stop     - Stop the server (kill Passenger process)
#   start    - Start the server (touch restart.txt)
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
BAGUS_NAME=${BAGUS_NAME:-bagus1}
BAGUS_FTP=${BAGUS_FTP:-bagus.org}
SETLIST_PATH=${SETLIST_PATH:-/home/bagus1/repositories/setlister}

# Default mode
MODE=${1:-deploy}

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

Usage: ./deploy-git.sh [mode]

Modes:
  deploy   - Deploy current changes (push to git, pull on server) [default]
  quick    - Quick deploy (just pull on server)
  restart  - Just restart the server
  stop     - Stop the server (kill Passenger process)
  start    - Start the server (touch restart.txt)
  status   - Show deployment status
  backup   - Create backup
  rollback - Rollback to previous commit
  help     - Show this help message

Environment Variables:
  BAGUS_NAME     - Username for server (default: bagus1)
  BAGUS_FTP      - Server (default: bagus.org)
  SETLIST_PATH   - Path on server (default: /home/bagus1/repositories/setlister)

Examples:
  ./deploy-git.sh deploy    # Full deployment
  ./deploy-git.sh quick     # Quick server update
  ./deploy-git.sh restart   # Just restart server
  ./deploy-git.sh stop      # Stop server
  ./deploy-git.sh start     # Start server
  ./deploy-git.sh status    # Show status

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
        else
            print_warning "Deploying with uncommitted changes"
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
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && git pull origin main" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    # Install dependencies if package.json changed
    if ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && git diff --name-only HEAD~1 | grep -q package.json"; then
        print_status "Installing dependencies..."
        ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && npm install --production"
    fi
    
    # Restart server
    restart_server
    
    print_success "Deployment completed!"
}

# Function to quick deploy (just pull on server)
quick_deploy() {
    print_status "Quick deploy - pulling on server..."
    
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && git pull origin main" || {
        print_error "Failed to pull on server"
        return 1
    }
    
    restart_server
    
    print_success "Quick deployment completed!"
}

# Function to restart server
restart_server() {
    print_status "Restarting server..."
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to restart server"
        return 1
    }
    print_success "Server restarted successfully"
}

# Function to stop server
stop_server() {
    print_status "Stopping server..."
    ssh "$BAGUS_NAME@$BAGUS_FTP" "pkill -f 'Passenger NodeApp.*setlister'" || {
        print_warning "No Passenger process found to stop"
        return 0
    }
    print_success "Server stopped successfully"
}

# Function to start server
start_server() {
    print_status "Starting server..."
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && touch tmp/restart.txt" || {
        print_error "Failed to start server"
        return 1
    }
    print_success "Server started successfully"
}

# Function to show status
show_status() {
    print_status "Checking deployment status..."
    
    echo -e "\n${BLUE}Local Git Status:${NC}"
    git status --short
    
    echo -e "\n${BLUE}Recent Commits:${NC}"
    git log --oneline -5
    
    echo -e "\n${BLUE}Server Status:${NC}"
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && echo 'Current commit:' && git log --oneline -1 && echo 'Server restart file:' && ls -la tmp/restart.txt 2>/dev/null && echo 'Server restart file exists' || echo 'No restart file found'"
    
    echo -e "\n${BLUE}Database Status:${NC}"
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && ls -la database.sqlite 2>/dev/null && echo 'Database exists' || echo 'Database not found'"
}

# Function to create backup
create_backup() {
    print_status "Creating backup..."
    
    # Create backup directory
    mkdir -p "./backups"
    
    # Create backup filename
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="./backups/setlist_backup_$TIMESTAMP.tar.gz"
    
    # Create backup on server
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && tar -czf /tmp/setlist_backup_$TIMESTAMP.tar.gz ." || {
        print_error "Failed to create backup on server"
        return 1
    }
    
    # Download backup
    scp "$BAGUS_NAME@$BAGUS_FTP:/tmp/setlist_backup_$TIMESTAMP.tar.gz" "$BACKUP_FILE" || {
        print_error "Failed to download backup"
        return 1
    }
    
    # Clean up server backup
    ssh "$BAGUS_NAME@$BAGUS_FTP" "rm /tmp/setlist_backup_$TIMESTAMP.tar.gz"
    
    print_success "Backup created: $BACKUP_FILE"
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
    ssh "$BAGUS_NAME@$BAGUS_FTP" "cd $SETLIST_PATH && git reset --hard $PREVIOUS_COMMIT"
    
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
            rollback
            exit 0
            ;;
        "deploy")
            check_git_status
            deploy_via_git
            ;;
        "quick")
            quick_deploy
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