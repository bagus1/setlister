-- Venue socials seeds generated from Bagus CSV (idempotent)
-- Note: Run this AFTER venue seeds

-- Social media for The Woodcellar
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.thewoodcellar.net', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Woodcellar' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Fracos
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.fracos.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Fracos' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'fracosdenver', 'https://instagram.com/fracosdenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Fracos' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'fracosdenver');

-- Social media for Globe Hall
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.globehall.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Globe Hall' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'globehalldenver', 'https://instagram.com/globehalldenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Globe Hall' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'globehalldenver');

-- Social media for Ironton Distillery
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'irontondistillery.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ironton Distillery' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Larimer Lounge
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.larimerlounge.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Larimer Lounge' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'larimerlounge', 'https://instagram.com/larimerlounge', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Larimer Lounge' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'larimerlounge');

-- Social media for Lions Lair
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'lionslairdenver', 'https://instagram.com/lionslairdenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Lions Lair' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'lionslairdenver');

-- Social media for Mercury Cafe
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.mercurycafe.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mercury Cafe' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'mercurycafe', 'https://instagram.com/mercurycafe', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mercury Cafe' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'mercurycafe');

-- Social media for Ophelia''s Electric Soapbox
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.opheliasdenver.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ophelia''s Electric Soapbox' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'opheliasdenver', 'https://instagram.com/opheliasdenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ophelia''s Electric Soapbox' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'opheliasdenver');

-- Social media for Pug Ryans
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://www.pugryans.com/contact', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Pug Ryans' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Lot 46
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://lot46bar.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Lot 46' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Cactus Jack''s Saloon
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/CJsaloonEvergreen', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cactus Jack''s Saloon' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Evergreen Brewery
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://evergreenbrewingco.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Evergreen Brewery' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Ace Hi Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'AceHiTavern', 'https://instagram.com/AceHiTavern', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ace Hi Tavern' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'AceHiTavern');

-- Social media for Goosetown Station
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'goosetownstation.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Goosetown Station' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'goosetowngolden', 'https://instagram.com/goosetowngolden', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Goosetown Station' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'goosetowngolden');

-- Social media for Red Rocks Bar & Grill
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.redrocksbar.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Rocks Bar & Grill' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'redrocksbar', 'https://instagram.com/redrocksbar', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Rocks Bar & Grill' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'redrocksbar');

-- Social media for Morrison Holiday Bar
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.morrisonholidaybar.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Morrison Holiday Bar' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'morrisonholidaybar', 'https://instagram.com/morrisonholidaybar', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Morrison Holiday Bar' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'morrisonholidaybar');

-- Social media for Tailgate Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://tailgatetavern.com/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Tailgate Tavern' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Studio
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://www.studioatmainstreet.com/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Studio' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/thestudioatmainstreet/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Studio' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Wild Goose
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://wildgoosesaloon.com/contact-us/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Wild Goose' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Jakes Roadhouse
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://places.singleplatform.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Jakes Roadhouse' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Boco Cider
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bococider.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Boco Cider' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for eTown Hall
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.etown.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'eTown Hall' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'etownradio', 'https://instagram.com/etownradio', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'eTown Hall' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'etownradio');

-- Social media for Mountain Sun
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.mountainsunpub.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mountain Sun' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Laughing Goat
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.laughinggoat.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Laughing Goat' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'laughinggoat', 'https://instagram.com/laughinggoat', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Laughing Goat' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'laughinggoat');

-- Social media for Sunshine Studios
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.sunshinestudioslive.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Sunshine Studios' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'sunshinestudios', 'https://instagram.com/sunshinestudios', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Sunshine Studios' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'sunshinestudios');

-- Social media for The Black Sheep
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.blacksheeprocks.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Black Sheep' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'blacksheeprocks', 'https://instagram.com/blacksheeprocks', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Black Sheep' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'blacksheeprocks');

-- Social media for 3 Kings Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.3kingstavern.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = '3 Kings Tavern' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, '3kingstavern', 'https://instagram.com/3kingstavern', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = '3 Kings Tavern' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = '3kingstavern');

-- Social media for Bierstadt Lagerhaus
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://bierstadtlager.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Bierstadt Lagerhaus' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Cervantes'' Masterpiece Ballroom
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.cervantesmasterpiece.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cervantes'' Masterpiece Ballroom' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'cervantesdenver', 'https://instagram.com/cervantesdenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cervantes'' Masterpiece Ballroom' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'cervantesdenver');

-- Social media for Hi-Dive
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.hi-dive.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Hi-Dive' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'hidivedenver', 'https://instagram.com/hidivedenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Hi-Dive' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'hidivedenver');

-- Social media for Levitt Pavilion
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.levittdenver.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Levitt Pavilion' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'levittdenver', 'https://instagram.com/levittdenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Levitt Pavilion' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'levittdenver');

-- Social media for Lost Lake Lounge
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.lostlakelounge.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Lost Lake Lounge' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Marquis Theater
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.marquistheaterdenver.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Marquis Theater' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'marquistheater', 'https://instagram.com/marquistheater', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Marquis Theater' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'marquistheater');

-- Social media for Ogden Theatre
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.ogdentheatre.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ogden Theatre' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'ogdendenver', 'https://instagram.com/ogdendenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ogden Theatre' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'ogdendenver');

-- Social media for Syntax Physic Opera
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.syntaxphysicopera.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Syntax Physic Opera' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'syntaxphysicopera', 'https://instagram.com/syntaxphysicopera', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Syntax Physic Opera' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'syntaxphysicopera');

-- Social media for The Venue
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'thevenue303.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Venue' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Wild Game
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/TheWildGameECO/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Wild Game' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Parrot''s Sports Grill
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/profile.php?id=61568741720550', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Parrot''s Sports Grill' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Aggie Theatre
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.aggietheatre.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Aggie Theatre' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'aggietheatre', 'https://instagram.com/aggietheatre', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Aggie Theatre' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'aggietheatre');

-- Social media for Atrium At the Alley Cat
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/theatriumfortcollins/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Atrium At the Alley Cat' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Eqinox Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/equinoxbrewing/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Eqinox Brewing' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Funkwerks Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://funkwerks.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Funkwerks Brewing' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Hodi''s Half Note
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.hodishalfnote.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Hodi''s Half Note' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'hodishalfnote', 'https://instagram.com/hodishalfnote', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Hodi''s Half Note' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'hodishalfnote');

-- Social media for Horsetooth Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/horsetoothtavern2023', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Horsetooth Tavern' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Island Grill
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/IslandGrillFortCollins/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Island Grill' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Jay''s Bistro
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/jaysbistro/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Jay''s Bistro' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Lucky Joe''s
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/luckyjoesfortcollins', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Lucky Joe''s' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Magic Rat
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/MagicRatLiveMusic', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Magic Rat' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Maxline Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://maxlinebrewing.com/contact/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Maxline Brewing' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for New Belgium Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.newbelgium.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'New Belgium Brewing' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'newbelgium', 'https://instagram.com/newbelgium', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'New Belgium Brewing' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'newbelgium');

-- Social media for Panhandler''s Pizza
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/panhandlerspizzafortcollins/#', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Panhandler''s Pizza' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Ryan''s Sports Bar
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/greyrock80525', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ryan''s Sports Bar' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Surfside7
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/surfside7/#', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Surfside7' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Coast
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://barcoastfoco.com/contact/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Coast' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Colorado Room
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/TheColoradoRoom', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Colorado Room' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Emporium Sports Bar
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/130397230959493', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Emporium Sports Bar' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The OBC Wine Project
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/theobcwineproject', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The OBC Wine Project' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Whisk(e)y
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/TheWhiskeyFortCollins/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Whisk(e)y' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Tony''s Bar & Rooftop
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/TonysFortCollins/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Tony''s Bar & Rooftop' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Washington''s
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.washingtonsfoco.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Washington''s' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'washingtonsfoco', 'https://instagram.com/washingtonsfoco', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Washington''s' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'washingtonsfoco');

-- Social media for Ten Mile Music Hall
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', '10milemusic.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Ten Mile Music Hall' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for In The Zone
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.inthezonebar.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'In The Zone' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Max Taps
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.maxtaps.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Max Taps' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Front Range Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.frontrangebrewingcompany.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Front Range Brewing' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Oskar Blues Longmont
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.oskarblues.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Oskar Blues Longmont' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'oskarblues', 'https://instagram.com/oskarblues', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Oskar Blues Longmont' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'oskarblues');

-- Social media for Tilted Barrel
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'tiltedbarrelbrewpub.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Tilted Barrel' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Carboy Winery at Mt. Garfield Estate
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://www.carboywinery.com/event-calendar/happenings', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Carboy Winery at Mt. Garfield Estate' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Colterris Collections
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/ColterrisWines', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Colterris Collections' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Colterris Winery
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/ColterrisWines', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Colterris Winery' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Grande River Vineyards
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://granderivervineyards.com/about/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Grande River Vineyards' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Red Fox Cellars
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://redfoxcellars.com/contact/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Fox Cellars' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Restoration Vineyards
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://restorationvineyards.com/contact/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Restoration Vineyards' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Purple Bee Apothecary
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/ThePurpleBeeApothecary/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Purple Bee Apothecary' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for El Nopal Restaurant
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/BlueCactusRoom/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'El Nopal Restaurant' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Graham''s Grill 3
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/p/Grahams-Grill-3-100063561880067/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Graham''s Grill 3' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Grind Haus Cafe
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/thegrindhauscafe/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Grind Haus Cafe' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Riverside Bar & Grill
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/p/Riverside-Bar-Grill-100063655956183/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Riverside Bar & Grill' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Smitty''s Greenlight Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/pages/Smittys-Greenlight-Tavern/110152899070779', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Smitty''s Greenlight Tavern' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Broadway Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/Broadwaytavernandgrillpueblo/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Broadway Tavern' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Garage
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/thegaragepueblo/about', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Garage' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Walter''s Brewery & Taproom
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/waltersbrewery/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Walter''s Brewery & Taproom' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Strings Music Pavilion
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.stringsmusicfestival.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Strings Music Pavilion' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'stringsmusic', 'https://instagram.com/stringsmusic', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Strings Music Pavilion' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'stringsmusic');

-- Social media for Sheridan Opera House
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.sheridanoperahouse.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Sheridan Opera House' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'sheridanoperahouse', 'https://instagram.com/sheridanoperahouse', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Sheridan Opera House' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'sheridanoperahouse');

-- Social media for Firefly Saloon
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'fireflysaloon.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Firefly Saloon' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Peculier Ales
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://peculierales.com/contact-us-windsor/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Peculier Ales' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Deno''s Winter Park
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.denoswp.com/new-page-2', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Deno''s Winter Park' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Fontenot''s Winter Park
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.fontenotswp.com/connect', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Fontenot''s Winter Park' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Vertical Bistro
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.verticalbistro.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Vertical Bistro' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Volario''s Winter Park
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'volarioswinterpark.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Volario''s Winter Park' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Denver Artisan Markets
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/artisanmarkets.co', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Denver Artisan Markets' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Boulder Theater
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bouldertheater.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Boulder Theater' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'bouldertheater', 'https://instagram.com/bouldertheater', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Boulder Theater' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'bouldertheater');

-- Social media for The Fox Theatre
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.foxtheatre.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Fox Theatre' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'foxboulder', 'https://instagram.com/foxboulder', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Fox Theatre' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'foxboulder');

-- Social media for Pikes Peak Center
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.pikespeakcenter.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Pikes Peak Center' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'pikespeakcenter', 'https://instagram.com/pikespeakcenter', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Pikes Peak Center' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'pikespeakcenter');

-- Social media for Wild Edge Brewing Collective
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://www.wildedgebrewing.com/contact', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Wild Edge Brewing Collective' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Crested Butte Public House
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'http://publichousecb.com/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Crested Butte Public House' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Red Lady Stage
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://mtcbmusic.com/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Lady Stage' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Talk of the Town
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'facebook', 'https://www.facebook.com/TalkoftheTownCB/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Talk of the Town' AND st.name = 'Facebook'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Eldo
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://eldobrewery.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Eldo' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Summit Music Hall
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.summitmusichall.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Summit Music Hall' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'summithalldenver', 'https://instagram.com/summithalldenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Summit Music Hall' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'summithalldenver');

-- Social media for The Bluebird Theater
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluebirdtheater.net', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Bluebird Theater' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'bluebirddenver', 'https://instagram.com/bluebirddenver', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Bluebird Theater' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'bluebirddenver');

-- Social media for The Oriental Theater
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.orientaltheater.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Oriental Theater' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'orientaltheater', 'https://instagram.com/orientaltheater', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Oriental Theater' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'orientaltheater');

-- Social media for UMS (Underground Music Showcase)
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.theums.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'UMS (Underground Music Showcase)' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'theums', 'https://instagram.com/theums', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'UMS (Underground Music Showcase)' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'theums');

-- Social media for Westword Music Showcase
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.westword.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Westword Music Showcase' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Gothic Theatre
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.gothictheatre.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Gothic Theatre' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'gothictheatre', 'https://instagram.com/gothictheatre', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Gothic Theatre' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'gothictheatre');

-- Social media for A Bar Above
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'https://www.abarcb.com/', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'A Bar Above' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Mountain View Lodge
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.mountainviewlodge.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mountain View Lodge' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for The Belly Up
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bellyupaspen.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Belly Up' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'bellyupaspen', 'https://instagram.com/bellyupaspen', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Belly Up' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'bellyupaspen');

-- Social media for Antone''s Nightclub
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.antones.net', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Antone''s Nightclub' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'antonesaustin', 'https://instagram.com/antonesaustin', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Antone''s Nightclub' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'antonesaustin');

-- Social media for C-Boys Heart & Soul
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.cboys.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'C-Boys Heart & Soul' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'cboysaustin', 'https://instagram.com/cboysaustin', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'C-Boys Heart & Soul' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'cboysaustin');

-- Social media for Cactus Cafe
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.cactuscafe.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cactus Cafe' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'cactuscafeatx', 'https://instagram.com/cactuscafeatx', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cactus Cafe' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'cactuscafeatx');

-- Social media for Cheer Up Charlies
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.cheerupcharlies.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cheer Up Charlies' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'cheerupcharlies', 'https://instagram.com/cheerupcharlies', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Cheer Up Charlies' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'cheerupcharlies');

-- Social media for Crossroads Brewing
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.crossroadsbrewing.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Crossroads Brewing' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'crossroadsatx', 'https://instagram.com/crossroadsatx', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Crossroads Brewing' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'crossroadsatx');

-- Social media for Mohawk
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.mohawkaustin.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mohawk' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'mohawkatx', 'https://instagram.com/mohawkatx', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Mohawk' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'mohawkatx');

-- Social media for Saxon Pub
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.saxonpub.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Saxon Pub' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'saxonpub', 'https://instagram.com/saxonpub', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Saxon Pub' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'saxonpub');

-- Social media for Stubb''s Bar-B-Q
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.stubbsaustin.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Stubb''s Bar-B-Q' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'stubbsaustin', 'https://instagram.com/stubbsaustin', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Stubb''s Bar-B-Q' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'stubbsaustin');

-- Social media for The Continental Club
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.continentalclub.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Continental Club' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'continentalclub', 'https://instagram.com/continentalclub', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Continental Club' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'continentalclub');

-- Social media for The Parish
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.theparishaustin.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Parish' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'parishaustin', 'https://instagram.com/parishaustin', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Parish' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'parishaustin');

-- Social media for The Well
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.thewell.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Well' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'thewellaustin', 'https://instagram.com/thewellaustin', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Well' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'thewellaustin');

-- Social media for The White Horse
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.thewhitehorseaustin.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The White Horse' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'whitehorseatx', 'https://instagram.com/whitehorseatx', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The White Horse' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'whitehorseatx');

-- Social media for Vilar Performing Arts Center
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.vilarpac.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Vilar Performing Arts Center' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'vilarpac', 'https://instagram.com/vilarpac', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Vilar Performing Arts Center' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'vilarpac');

-- Social media for House of Blues
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.houseofblues.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'House of Blues' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'hobdallas', 'https://instagram.com/hobdallas', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'House of Blues' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'hobdallas');

-- Social media for Planet Bluegrass
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluegrass.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Planet Bluegrass' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'planetbluegrass', 'https://instagram.com/planetbluegrass', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Planet Bluegrass' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'planetbluegrass');

-- Social media for RockyGrass
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluegrass.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'RockyGrass' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'planetbluegrass', 'https://instagram.com/planetbluegrass', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'RockyGrass' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'planetbluegrass');

-- Social media for Blue Moon Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluemoontavern.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Blue Moon Tavern' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'bluemoonnash', 'https://instagram.com/bluemoonnash', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Blue Moon Tavern' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'bluemoonnash');

-- Social media for Bluebird Cafe
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluebirdcafe.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Bluebird Cafe' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'bluebirdcafe', 'https://instagram.com/bluebirdcafe', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Bluebird Cafe' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'bluebirdcafe');

-- Social media for Exit/In
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.exitin.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Exit/In' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'exitinnashville', 'https://instagram.com/exitinnashville', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Exit/In' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'exitinnashville');

-- Social media for The Station Inn
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.stationinn.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Station Inn' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'stationinn', 'https://instagram.com/stationinn', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Station Inn' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'stationinn');

-- Social media for Niwot Tavern
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.niwottavern.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Niwot Tavern' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

-- Social media for Kilby Court
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.kilbycourt.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Kilby Court' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'kilbycourt', 'https://instagram.com/kilbycourt', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Kilby Court' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'kilbycourt');

-- Social media for Red Butte Garden
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.redbuttegarden.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Butte Garden' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'redbuttegardenUT', 'https://instagram.com/redbuttegardenUT', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Red Butte Garden' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'redbuttegardenUT');

-- Social media for The State Room
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.thestateroom.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The State Room' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'stateroomslc', 'https://instagram.com/stateroomslc', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The State Room' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'stateroomslc');

-- Social media for The Fillmore
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.thefillmore.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Fillmore' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'fillmoresf', 'https://instagram.com/fillmoresf', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Fillmore' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'fillmoresf');

-- Social media for The Independent
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.theindependentsf.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Independent' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'independentsf', 'https://instagram.com/independentsf', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Independent' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'independentsf');

-- Social media for Telluride Bluegrass Festival
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.bluegrass.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Telluride Bluegrass Festival' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'planetbluegrass', 'https://instagram.com/planetbluegrass', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Telluride Bluegrass Festival' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'planetbluegrass');

-- Social media for Gerald R. Ford Amphitheater
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.vvf.org', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Gerald R. Ford Amphitheater' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'vailvalleyfoundation', 'https://instagram.com/vailvalleyfoundation', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'Gerald R. Ford Amphitheater' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'vailvalleyfoundation');

-- Social media for The Troubadour
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.troubadour.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Troubadour' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'troubadourwh', 'https://instagram.com/troubadourwh', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Troubadour' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'troubadourwh');

-- Social media for The Backyard/BattleCreek
INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'website', 'www.playinthebackyard.com', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Backyard/BattleCreek' AND st.name = 'Website'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id);

INSERT INTO venue_socials (venue_id, social_type_id, handle, url, created_at, updated_at)
SELECT v.id, st.id, 'playinthebackyard', 'https://instagram.com/playinthebackyard', NOW(), NOW()
FROM venues v, venue_social_types st
WHERE v.name = 'The Backyard/BattleCreek' AND st.name = 'Instagram'
  AND NOT EXISTS (SELECT 1 FROM venue_socials vs WHERE vs.venue_id = v.id AND vs.social_type_id = st.id AND vs.handle = 'playinthebackyard');

