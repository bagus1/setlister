-- Cleanup venue_contact_types: Remove Post types and improve descriptions
-- This migration removes unused "Post" contact types and updates display names with validation hints

-- Step 1: Remove the Post contact types (IDs 8-11) and Comment contact types (IDs 12-15)
DELETE FROM venue_contact_types WHERE id IN (8, 9, 10, 11, 12, 13, 14, 15);

-- Step 2: Update display names to include validation hints
UPDATE venue_contact_types SET "displayName" = 'Email Address' WHERE name = 'EMAIL';
UPDATE venue_contact_types SET "displayName" = 'Phone Number' WHERE name = 'PHONE_CALL';
UPDATE venue_contact_types SET "displayName" = 'Phone Number (SMS)' WHERE name = 'TEXT';
UPDATE venue_contact_types SET "displayName" = 'In-Person Meeting' WHERE name = 'IN_PERSON';
UPDATE venue_contact_types SET "displayName" = 'Note/Internal' WHERE name = 'NOTE';
UPDATE venue_contact_types SET "displayName" = 'Website Contact Form Link' WHERE name = 'WEBSITE_CONTACT_FORM';
UPDATE venue_contact_types SET "displayName" = 'Website Live Chat Link' WHERE name = 'WEBSITE_LIVE_CHAT';

-- Step 3: Update messaging contact types with validation hints
UPDATE venue_contact_types SET "displayName" = 'Facebook Messenger' WHERE name = 'FACEBOOK_MESSAGE';
UPDATE venue_contact_types SET "displayName" = 'Instagram Username or Business Link (for Direct Messages)' WHERE name = 'INSTAGRAM_MESSAGE';
UPDATE venue_contact_types SET "displayName" = 'LinkedIn Username/Company Link (for Messages)' WHERE name = 'LINKEDIN_MESSAGE';
UPDATE venue_contact_types SET "displayName" = 'Twitter Username Link (for Direct Messages)' WHERE name = 'TWITTER_MESSAGE';
UPDATE venue_contact_types SET "displayName" = 'WhatsApp (phone number)' WHERE name = 'WHATSAPP';
UPDATE venue_contact_types SET "displayName" = 'Telegram Username' WHERE name = 'TELEGRAM';
UPDATE venue_contact_types SET "displayName" = 'Discord Username/Server link' WHERE name = 'DISCORD';

-- Step 4: Update URL templates for better validation (if they exist)
-- Facebook Messenger
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://m.me/{contact}' 
WHERE name = 'FACEBOOK_MESSAGE';

-- Instagram Direct  
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://instagram.com/{contact}' 
WHERE name = 'INSTAGRAM_MESSAGE';

-- LinkedIn Message
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://linkedin.com/in/{contact}' 
WHERE name = 'LINKEDIN_MESSAGE';

-- Twitter Message
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://twitter.com/messages/compose?recipient_id={contact}' 
WHERE name = 'TWITTER_MESSAGE';

-- WhatsApp
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://wa.me/{contact}' 
WHERE name = 'WHATSAPP';

-- Telegram
UPDATE venue_contact_types 
SET "urlTemplate" = 'https://t.me/{contact}' 
WHERE name = 'TELEGRAM';

-- Discord (this one is trickier, might need invite links)
UPDATE venue_contact_types 
SET "urlTemplate" = NULL 
WHERE name = 'DISCORD';

-- Step 5: Verify the cleanup
SELECT id, name, "displayName", "urlTemplate" FROM venue_contact_types ORDER BY id;
