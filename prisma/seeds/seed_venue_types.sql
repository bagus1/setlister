-- Seed script for venue contact types and social types
-- Run this script against your production database to populate the tables

-- Insert venue contact types (idempotent)
INSERT INTO venue_contact_types (name, "displayName", "iconClass", "urlTemplate", is_active, sort_order, created_at, updated_at) VALUES
('EMAIL', 'Email', 'bi-envelope', 'mailto:{contact}', true, 1, NOW(), NOW()),
('PHONE_CALL', 'Phone Call', 'bi-telephone', 'tel:{contact}', true, 2, NOW(), NOW()),
('TEXT', 'Text Message', 'bi-chat-dots', 'sms:{contact}', true, 3, NOW(), NOW()),
('IN_PERSON', 'In-Person', 'bi-person', NULL, true, 4, NOW(), NOW()),
('NOTE', 'Note', 'bi-sticky', NULL, true, 5, NOW(), NOW()),
('FACEBOOK', 'Facebook', 'bi-facebook', 'https://facebook.com/{contact}', true, 6, NOW(), NOW()),
('INSTAGRAM', 'Instagram', 'bi-instagram', 'https://instagram.com/{contact}', true, 7, NOW(), NOW()),
('TWITTER', 'Twitter', 'bi-twitter', 'https://twitter.com/{contact}', true, 8, NOW(), NOW()),
('LINKEDIN', 'LinkedIn', 'bi-linkedin', 'https://linkedin.com/in/{contact}', true, 9, NOW(), NOW()),
('WHATSAPP', 'WhatsApp', 'bi-whatsapp', 'https://wa.me/{contact}', true, 10, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "iconClass" = EXCLUDED."iconClass",
    "urlTemplate" = EXCLUDED."urlTemplate",
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Insert venue social types (idempotent)
INSERT INTO venue_social_types (name, "displayName", "iconClass", "urlTemplate", is_active, sort_order, created_at, updated_at) VALUES
('WEBSITE', 'Website', 'bi-globe', 'https://{contact}', true, 1, NOW(), NOW()),
('FACEBOOK', 'Facebook', 'bi-facebook', 'https://facebook.com/{contact}', true, 2, NOW(), NOW()),
('INSTAGRAM', 'Instagram', 'bi-instagram', 'https://instagram.com/{contact}', true, 3, NOW(), NOW()),
('TWITTER', 'Twitter', 'bi-twitter', 'https://twitter.com/{contact}', true, 4, NOW(), NOW()),
('YOUTUBE', 'YouTube', 'bi-youtube', 'https://youtube.com/{contact}', true, 5, NOW(), NOW()),
('TIKTOK', 'TikTok', 'bi-tiktok', 'https://tiktok.com/{contact}', true, 6, NOW(), NOW()),
('LINKEDIN', 'LinkedIn', 'bi-linkedin', 'https://linkedin.com/company/{contact}', true, 7, NOW(), NOW()),
('SNAPCHAT', 'Snapchat', 'bi-snapchat', 'https://snapchat.com/add/{contact}', true, 8, NOW(), NOW()),
('BANDCAMP', 'Bandcamp', 'bi-music-note', 'https://{contact}.bandcamp.com', true, 9, NOW(), NOW()),
('SOUNDCLOUD', 'SoundCloud', 'bi-cloud', 'https://soundcloud.com/{contact}', true, 10, NOW(), NOW())
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
