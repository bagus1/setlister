-- Seed script for venue contact types and social types
-- Run this script against your production database to populate the tables

-- Insert venue contact types (idempotent)
INSERT INTO venue_contact_types (name, "displayName", "iconClass", "urlTemplate", is_active, sort_order, created_at, updated_at) VALUES
-- Direct Communication
('EMAIL', 'Email', 'bi-envelope', 'mailto:{contact}', true, 1, NOW(), NOW()),
('PHONE_CALL', 'Phone Call', 'bi-telephone', 'tel:{contact}', true, 2, NOW(), NOW()),
('TEXT', 'Text Message', 'bi-chat-dots', 'sms:{contact}', true, 3, NOW(), NOW()),
('IN_PERSON', 'In-Person Meeting', 'bi-person', NULL, true, 4, NOW(), NOW()),
('NOTE', 'Note/Internal', 'bi-sticky', NULL, true, 5, NOW(), NOW()),

-- Website Interactions
('WEBSITE_CONTACT_FORM', 'Website Contact Form', 'bi-window', NULL, true, 6, NOW(), NOW()),
('WEBSITE_LIVE_CHAT', 'Website Live Chat', 'bi-chat-dots', NULL, true, 7, NOW(), NOW()),

-- Social Media Posts
('FACEBOOK_POST', 'Facebook Post', 'bi-facebook', 'https://facebook.com/{contact}', true, 8, NOW(), NOW()),
('INSTAGRAM_POST', 'Instagram Post', 'bi-instagram', 'https://instagram.com/{contact}', true, 9, NOW(), NOW()),
('LINKEDIN_POST', 'LinkedIn Post', 'bi-linkedin', 'https://linkedin.com/company/{contact}', true, 10, NOW(), NOW()),
('TWITTER_POST', 'Twitter Post', 'bi-twitter', 'https://twitter.com/{contact}', true, 11, NOW(), NOW()),

-- Social Media Comments
('FACEBOOK_COMMENT', 'Facebook Comment', 'bi-chat-square', 'https://facebook.com/{contact}', true, 12, NOW(), NOW()),
('INSTAGRAM_COMMENT', 'Instagram Comment', 'bi-chat-square', 'https://instagram.com/{contact}', true, 13, NOW(), NOW()),
('LINKEDIN_COMMENT', 'LinkedIn Comment', 'bi-chat-square', 'https://linkedin.com/company/{contact}', true, 14, NOW(), NOW()),
('TWITTER_COMMENT', 'Twitter Comment', 'bi-chat-square', 'https://twitter.com/{contact}', true, 15, NOW(), NOW()),

-- Social Media Messages
('FACEBOOK_MESSAGE', 'Facebook Message', 'bi-messenger', 'https://m.me/{contact}', true, 16, NOW(), NOW()),
('INSTAGRAM_MESSAGE', 'Instagram Message', 'bi-chat-dots', 'https://instagram.com/{contact}', true, 17, NOW(), NOW()),
('LINKEDIN_MESSAGE', 'LinkedIn Message', 'bi-linkedin', 'https://linkedin.com/in/{contact}', true, 18, NOW(), NOW()),
('TWITTER_MESSAGE', 'Twitter Message', 'bi-chat-dots', 'https://twitter.com/{contact}', true, 19, NOW(), NOW()),

-- Other Platforms
('WHATSAPP', 'WhatsApp', 'bi-whatsapp', 'https://wa.me/{contact}', true, 20, NOW(), NOW()),
('TELEGRAM', 'Telegram', 'bi-telegram', 'https://t.me/{contact}', true, 21, NOW(), NOW()),
('DISCORD', 'Discord', 'bi-discord', 'https://discord.com/users/{contact}', true, 22, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "iconClass" = EXCLUDED."iconClass",
    "urlTemplate" = EXCLUDED."urlTemplate",
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Insert venue social types (idempotent)
INSERT INTO venue_social_types (name, "displayName", "iconClass", "urlTemplate", is_active, sort_order, created_at, updated_at) VALUES
('Website', 'Website', 'bi-globe', 'https://{contact}', true, 1, NOW(), NOW()),
('Facebook', 'Facebook', 'bi-facebook', 'https://facebook.com/{contact}', true, 2, NOW(), NOW()),
('Instagram', 'Instagram', 'bi-instagram', 'https://instagram.com/{contact}', true, 3, NOW(), NOW()),
('Twitter', 'Twitter', 'bi-twitter', 'https://twitter.com/{contact}', true, 4, NOW(), NOW()),
('YouTube', 'YouTube', 'bi-youtube', 'https://youtube.com/{contact}', true, 5, NOW(), NOW()),
('TikTok', 'TikTok', 'bi-tiktok', 'https://tiktok.com/{contact}', true, 6, NOW(), NOW()),
('LinkedIn', 'LinkedIn', 'bi-linkedin', 'https://linkedin.com/company/{contact}', true, 7, NOW(), NOW()),
('Snapchat', 'Snapchat', 'bi-snapchat', 'https://snapchat.com/add/{contact}', true, 8, NOW(), NOW()),
('Bandcamp', 'Bandcamp', 'bi-music-note', 'https://{contact}.bandcamp.com', true, 9, NOW(), NOW()),
('SoundCloud', 'SoundCloud', 'bi-cloud', 'https://soundcloud.com/{contact}', true, 10, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "iconClass" = EXCLUDED."iconClass",
    "urlTemplate" = EXCLUDED."urlTemplate",
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Verify the inserts
SELECT 'Venue Contact Types' as table_name, COUNT(*) as count FROM venue_contact_types
UNION ALL
SELECT 'Venue Social Types' as table_name, COUNT(*) as count FROM venue_social_types;
