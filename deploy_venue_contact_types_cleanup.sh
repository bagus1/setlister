#!/bin/bash

# Production deployment script for venue contact types cleanup
# This script should be run on production to clean up venue contact types

echo "=== Venue Contact Types Cleanup Deployment ==="
echo "This will:"
echo "1. Remove unused 'Post' contact types (Facebook Post, Instagram Post, LinkedIn Post, Twitter Post)"
echo "2. Remove unused 'Comment' contact types (Facebook Comment, Instagram Comment, LinkedIn Comment, Twitter Comment)"
echo "3. Update display names with validation hints"
echo "4. Update URL templates for better messaging integration"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying venue contact types cleanup..."
    
    # Run the SQL migration
    psql $DATABASE_URL -f venue_contact_types_cleanup.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Venue contact types cleanup deployed successfully!"
        echo ""
        echo "Changes made:"
        echo "- Removed 8 unused contact types (4 'Post' + 4 'Comment' types)"
        echo "- Updated 14 contact types with better display names"
        echo "- Updated URL templates for messaging platforms"
        echo ""
        echo "New contact types available:"
        echo "- Website Contact Form Link"
        echo "- Website Live Chat Link"
        echo "- Facebook Page (for Messenger)"
        echo "- Instagram Username or Business Link (for Direct Messages)"
        echo "- LinkedIn Username/Company Link (for Messages)"
        echo "- Twitter Username Link (for Direct Messages)"
        echo "- WhatsApp (phone number)"
        echo "- Telegram Username"
        echo "- Discord Username/Server link"
    else
        echo "❌ Deployment failed!"
        exit 1
    fi
else
    echo "Deployment cancelled."
    exit 0
fi
