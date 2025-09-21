-- Seed script for venue types, venue contact types and social types
-- Run this script against your production database to populate the tables

-- Insert venue types (idempotent)
INSERT INTO venue_types (name, description, is_active, sort_order, created_at, updated_at) VALUES
('AMPHITHEATER', 'Amphitheater', true, 1, NOW(), NOW()),
('ARENA', 'Arena', true, 2, NOW(), NOW()),
('ARTS_CENTER', 'Arts Center', true, 3, NOW(), NOW()),
('ARTS_FESTIVAL', 'Arts Festival', true, 4, NOW(), NOW()),
('BALLROOM', 'Ballroom', true, 5, NOW(), NOW()),
('BAR_PUB_TAVERN', 'Bar/Pub/Tavern/Saloon/Lounge', true, 6, NOW(), NOW()),
('BAR_RESTAURANT', 'Bar/Restaurant', true, 7, NOW(), NOW()),
('BAR_VENUE', 'Bar/Venue', true, 8, NOW(), NOW()),
('BEER_GARDEN', 'Beer Garden', true, 9, NOW(), NOW()),
('BLOCK_PARTY', 'Block Party', true, 10, NOW(), NOW()),
('BREWERY', 'Brewery', true, 11, NOW(), NOW()),
('BOWLING_ALLEY', 'Bowling Alley', true, 12, NOW(), NOW()),
('CAFE_COFFEEHOUSE', 'Cafe/Coffeehouse', true, 13, NOW(), NOW()),
('CAFE_VENUE', 'Cafe/Venue', true, 14, NOW(), NOW()),
('CHURCH', 'Church', true, 15, NOW(), NOW()),
('CIDERY', 'Cidery', true, 16, NOW(), NOW()),
('CIVIC_COMMUNITY', 'Civic/Community Center', true, 17, NOW(), NOW()),
('CLUB', 'Club', true, 18, NOW(), NOW()),
('CONCERT_HALL', 'Concert Hall', true, 19, NOW(), NOW()),
('CONVENTION_CENTER', 'Convention Center', true, 20, NOW(), NOW()),
('DISTILLERY', 'Distillery', true, 21, NOW(), NOW()),
('DIY_VENUE', 'DIY Venue', true, 22, NOW(), NOW()),
('EVENT_SPACE', 'Event Space', true, 23, NOW(), NOW()),
('FESTIVAL_GROUNDS', 'Festival Grounds', true, 24, NOW(), NOW()),
('GALLERY', 'Gallery', true, 25, NOW(), NOW()),
('HOUSE_CONCERT', 'House Concert', true, 26, NOW(), NOW()),
('JAZZ_CLUB', 'Jazz Club', true, 27, NOW(), NOW()),
('LISTENING_ROOM', 'Listening Room', true, 28, NOW(), NOW()),
('LODGE_RESORT', 'Lodge/Resort', true, 29, NOW(), NOW()),
('MUSEUM', 'Museum', true, 30, NOW(), NOW()),
('MUSIC_HALL', 'Music Hall', true, 31, NOW(), NOW()),
('MUSIC_VENUE', 'Music Venue', true, 32, NOW(), NOW()),
('OPEN_FIELD', 'Open Field', true, 33, NOW(), NOW()),
('OTHER', 'Other', true, 34, NOW(), NOW()),
('OUTDOOR_VENUE', 'Outdoor Venue', true, 35, NOW(), NOW()),
('PARKING_LOT', 'Parking Lot', true, 36, NOW(), NOW()),
('PERFORMING_ARTS', 'Performing Arts Center', true, 37, NOW(), NOW()),
('PRIVATE', 'Private', true, 38, NOW(), NOW()),
('RESTAURANT', 'Restaurant', true, 39, NOW(), NOW()),
('ROADHOUSE', 'Roadhouse', true, 40, NOW(), NOW()),
('SCHOOL_VENUE', 'School Venue', true, 41, NOW(), NOW()),
('SPORTS_BAR', 'Sports Bar', true, 42, NOW(), NOW()),
('STADIUM', 'Stadium', true, 43, NOW(), NOW()),
('THEATER', 'Theater', true, 44, NOW(), NOW()),
('THEATER_VENUE', 'Theater/Venue', true, 45, NOW(), NOW()),
('WINE_BAR', 'Wine Bar', true, 46, NOW(), NOW()),
('WINERY', 'Winery', true, 47, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

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
