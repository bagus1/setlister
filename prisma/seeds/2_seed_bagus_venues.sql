-- Venue seeds generated from Bagus CSV (idempotent)
-- Using INSERT WHERE NOT EXISTS since there's no unique constraint on name

-- The Woodcellar
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Woodcellar', '1552 Bergen Pkwy #101', 'Evergreen', 'CO', '80439', '(303) 670-8448', 'codeadhead@gmail.com', 200, '600-900', 'Merged from: The Woodcellar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Woodcellar');

-- Buffalo Rose
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Buffalo Rose', '1119 Washington Ave', 'Golden', 'CO', NULL, NULL, 'ccone@buffalorose.net', 300, '600-1200', 'Mardi Gras gigs 2019-2021', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Buffalo Rose');

-- Fracos
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Fracos', '456 Venue St', 'Denver', 'CO', NULL, '(555) 234-5678', 'mike@fracos.com', 150, '300-600', 'Need to confirm summer dates', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Fracos');

-- Globe Hall
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Globe Hall', '4483 Logan St', 'Denver', 'CO', NULL, '(303) 997-6888', 'booking@globehall.com', 200, '500-900', 'Americana/folk focused. South Broadway', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Globe Hall');

-- Ironton Distillery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ironton Distillery', '3636 Chestnut Place', 'Denver', 'CO', NULL, '(720) 532-0937', 'kelsey@irontondistillery.com', 150, '400-800', 'Gig 11/19/2022 through Kelsey', 21, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ironton Distillery');

-- Larimer Lounge
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Larimer Lounge', '2721 Larimer St', 'Denver', 'CO', NULL, '(303) 555-1567', 'steve@larimerlounge.com', 200, '500-900', 'RiNo district. Young professionals', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Larimer Lounge');

-- Lions Lair
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Lions Lair', '2022 East Colfax Avenue', 'Denver', 'CO', NULL, NULL, NULL, 150, '300-600', 'Not booking yet (as of 2021)', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Lions Lair');

-- Mercury Cafe
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mercury Cafe', '2199 California St', 'Denver', 'CO', NULL, '(303) 555-1123', 'booking@mercurycafe.com', 200, '300-600', 'Artsy crowd. Diverse acts', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mercury Cafe');

-- Ophelia''s Electric Soapbox
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ophelia''s Electric Soapbox', '1215 20th St', 'Denver', 'CO', NULL, '(303) 800-9198', 'booking@opheliasdenver.com', 150, '400-800', 'Historic venue in RiNo. Great for intimate shows', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ophelia''s Electric Soapbox');

-- Pug Ryans
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Pug Ryans', '104 Village Pl', 'Dillon', 'CO', '80435', '(970) 468-2145', NULL, NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Pug Ryans');

-- Lot 46
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Lot 46', '5302 W 25th Ave', 'Edgewater', 'CO', '80214', '(720) 421-3098', 'booking@lot46bar.com', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Lot 46');

-- Cactus Jack''s Saloon
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Cactus Jack''s Saloon', '4651 County Hwy 73', 'Evergreen', 'CO', NULL, '(303) 674-1564', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Cactus Jack''s Saloon');

-- Evergreen Brewery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Evergreen Brewery', '2962 Evergreen Pkwy #201', 'Evergreen', 'CO', '80439', '720-224-5536', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Evergreen Brewery');

-- Little Bear
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Little Bear', '28075 CO-74', 'Evergreen', 'CO', '80439', '(303) 674-9991', 'music@littlebearlive.com', 300, '800-1500', 'Merged from: Little Bear', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Little Bear');

-- Ace Hi Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ace Hi Tavern', '1216 Washington Ave', 'Golden', 'CO', NULL, '(303) 279-9043', NULL, NULL, '200-400', 'Not really doing shows', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ace Hi Tavern');

-- Goosetown Station
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Goosetown Station', '514 9th St', 'Golden', 'CO', '80401', '(303) 278-2729', 'GoosetownStation@gmail.com', 200, '400-800', 'Trying for booking', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Goosetown Station');

-- Red Rocks Bar & Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Red Rocks Bar & Grill', '1234 Main St', 'Golden', 'CO', NULL, '(720) 555-0123', 'events@redrocksbar.com', 250, '600-1200', 'Near Red Rocks. Tourist crowd', 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Red Rocks Bar & Grill');

-- The Goat Soup and Whiskey
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Goat Soup and Whiskey', '22954 US-6', 'Keystone', 'CO', '80435', '(970) 513-9344', 'Thegoattavern@aol.com', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Goat Soup and Whiskey');

-- Morrison Holiday Bar
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Morrison Holiday Bar', '403 Bear Creek Ave', 'Morrison', 'CO', '80465', '(303) 697-5658', NULL, 150, '300-600', 'Tom Smith contact', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Morrison Holiday Bar');

-- Colorado Mountain Winefest
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colorado Mountain Winefest', NULL, 'Palisade', 'CO', NULL, '(970) 464-0111', 'info@coloradowinefest.com', NULL, 'Unknown', 'Found via Colorado Playlist scraping - Festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colorado Mountain Winefest');

-- Palisade Peach Festival
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Palisade Peach Festival', '451 Pendleton St', 'Palisade', 'CO', '81526', '(970) 464-7458', 'palisadepeachfestival@palisadecoc.com', NULL, 'Unknown', 'Found via Colorado Playlist scraping - Festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Palisade Peach Festival');

-- Tailgate Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Tailgate Tavern', '19552 Mainstreet', 'Parker', 'CO', '80138', '(303) 841-7179', 'jk@tailgatetavern.com', NULL, '400-700', 'Minimal info available', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Tailgate Tavern');

-- Takoda Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Takoda Tavern', '12365 Pine Bluffs Way', 'Parker', 'CO', NULL, NULL, 'takodatavern@aol.com', 150, '300-600', 'Parker location', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Takoda Tavern');

-- The Studio
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Studio', '19604 Mainstreet', 'Parker', 'CO', '80138', '(720) 545-5155', 'rfneumann1@gmail.com', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Studio');

-- Wild Goose
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Wild Goose', '11160 S Pikes Peak Dr', 'Parker', 'CO', '80138', '(720) 766-8449', NULL, NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Wild Goose');

-- Bluebird Market
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Bluebird Market', '325 Blue River Pkwy', 'Silverthorne', 'CO', '80498', '(303) 216-0420', 'info@bluebirdmarket.co', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Bluebird Market');

-- The Werks
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Werks', '2625 Kipling St', 'Wheat Ridge', 'CO', '80215', '(720) 749-3137', 'trisha@thewerkscolorado.com', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Werks');

-- Rails end brewery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Rails end brewery', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Rails end brewery');

-- Jakes Roadhouse
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Jakes Roadhouse', '5980 N Lamar St', 'Arvada', 'CO', NULL, '(303) 424-7266', 'doug@jakesroadhouse.com', 200, '400-800', 'Open mic every other Sunday', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Jakes Roadhouse');

-- Painted Prairie Events
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Painted Prairie Events', NULL, 'Aurora', 'CO', NULL, NULL, 'info@lifeatpaintedprairie.com', NULL, 'Unknown', 'Colorado event venue', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Painted Prairie Events');

-- Bands on the Bricks
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Bands on the Bricks', NULL, 'Boulder', 'CO', NULL, '303.449.3774', 'info@downtownboulder.org', NULL, 'Unknown', 'Boulder downtown summer series', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Bands on the Bricks');

-- Boco Cider
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Boco Cider', '1501 Lee Hill Dr Unit 14', 'Boulder', 'CO', NULL, '(720) 938-7285', NULL, 100, '300-600', 'Played Feb 2023 & 2024. Good relationship', 16, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Boco Cider');

-- BookCliff Vineyards
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'BookCliff Vineyards', '1501 Lee Hill Dr UNIT 17', 'Boulder', 'CO', '80304', '(303)-449-9463', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'BookCliff Vineyards');

-- eTown Hall
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'eTown Hall', '1535 Spruce St', 'Boulder', 'CO', NULL, '(303) 443-8696', 'booking@etown.org', 200, '400-800', 'Acoustic/folk venue with radio show', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'eTown Hall');

-- Mountain Sun
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mountain Sun', NULL, 'Boulder', 'CO', NULL, NULL, 'mtnsun@mountainsunpub.com', 120, '300-500', 'Free live music is back', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mountain Sun');

-- The Laughing Goat
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Laughing Goat', '1709 Pearl St', 'Boulder', 'CO', NULL, '(303) 440-4628', 'info@laughinggoat.com', 80, '200-400', 'Coffeehouse with live music', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Laughing Goat');

-- Great Divide Castle Rock
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Great Divide Castle Rock', '215 Wilcox St', 'Castle Rock', 'CO', '80104', '(303) 955-5788', NULL, NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Great Divide Castle Rock');

-- East End Ale House
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'East End Ale House', 'Loveland', 'CO', NULL, NULL, '(970) 966-7169', 'eastendalehouseco@gmail.com', NULL, '200-400', '3', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'East End Ale House');

-- Sunshine Studios
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Sunshine Studios', '3970 Clearview Frontage Rd', 'Colorado Springs', 'CO', NULL, '(719) 600-8977', 'booking@sunshinestudioslive.com', 300, '500-1000', 'Live music venue in Springs', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Sunshine Studios');

-- The Black Sheep
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Black Sheep', '2106 E Platte Ave', 'Colorado Springs', 'CO', NULL, '(719) 227-7625', 'booking@blacksheeprocks.com', 200, '400-800', 'Rock/alternative venue in Springs', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Black Sheep');

-- 3 Kings Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT '3 Kings Tavern', '60 S Broadway', 'Denver', 'CO', NULL, '(303) 777-7352', 'booking@3kingstavern.com', 250, '300-600', 'Merged from: 3 Kings Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = '3 Kings Tavern');

-- Alliance Francais Bastille Day
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Alliance Francais Bastille Day', NULL, 'Denver', 'CO', NULL, '(720) 568-9976', 'reception@afdenver.org', NULL, 'Unknown', 'French cultural organization event', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Alliance Francais Bastille Day');

-- Bierstadt Lagerhaus
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Bierstadt Lagerhaus', '2875 Blake St', 'Denver', 'CO', '80205', '(303) 296-2337', 'info@bierstadtlager.com', NULL, NULL, NULL, 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Bierstadt Lagerhaus');

-- Cervantes'' Masterpiece Ballroom
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Cervantes'' Masterpiece Ballroom', '2635 Welton St', 'Denver', 'CO', NULL, '(303) 555-2567', 'booking@cervantesmasterpiece.com', 1400, '1800-3500', 'Two rooms. Electronic focus', 5, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Cervantes'' Masterpiece Ballroom');

-- Dairy Block
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Dairy Block', '1800 Wazee St', 'Denver', 'CO', '80202', '(303) 309-4847', 'info@dairyblock.com', NULL, 'Unknown', 'Downtown Denver event space', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Dairy Block');

-- Goosetown Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Goosetown Tavern', '3242 E Colfax Ave', 'Denver', 'CO', NULL, '(720) 975-6306', NULL, 150, '400-700', 'Mother''s Day 2021 gig recordings', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Goosetown Tavern');

-- Hi-Dive
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Hi-Dive', '7 S Broadway', 'Denver', 'CO', NULL, '(303) 733-0230', 'booking@hi-dive.com', 200, '400-800', 'Indie rock venue. South Broadway', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Hi-Dive');

-- Larimer Square Events
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Larimer Square Events', NULL, 'Denver', 'CO', NULL, NULL, 'larimersquare@twoparts.com', NULL, 'Unknown', 'Historic Denver district events', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Larimer Square Events');

-- Levitt Pavilion
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Levitt Pavilion', '1380 W Florida Ave', 'Denver', 'CO', NULL, '(303) 297-7790', 'info@levittdenver.org', 7500, 'Unknown', 'Free outdoor summer concerts. Ruby Hill Park', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Levitt Pavilion');

-- Lost Lake Lounge
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Lost Lake Lounge', 'haylee@larimerlounge.com and jackson@larimerlounge.com', '3602 E Colfax Ave', 'Denver', 'CO', '(303) 555-0678', 'chris@lostlakelounge.com', NULL, 'Small', '2024-07-18', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Lost Lake Lounge');

-- Marquis Theater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Marquis Theater', '2009 Larimer St', 'Denver', 'CO', NULL, '(303) 487-0111', 'booking@marquistheaterdenver.com', 400, '600-1200', 'Downtown venue for rock/alternative', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Marquis Theater');

-- McGregor Square Events
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'McGregor Square Events', NULL, 'Denver', 'CO', NULL, NULL, 'info@mcgregorsquare.com', NULL, 'Unknown', 'Downtown Denver event space', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'McGregor Square Events');

-- Ogden Theatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ogden Theatre', '935 E Colfax Ave', 'Denver', 'CO', NULL, '(303) 555-3123', 'booking@ogdentheatre.com', 1600, '2200-4500', 'Historic Colfax venue', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ogden Theatre');

-- Rock the Block at Marjorie Park
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Rock the Block at Marjorie Park', NULL, 'Denver', 'CO', NULL, NULL, 'info@moaonline.org', NULL, 'Unknown', 'Community park event series', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Rock the Block at Marjorie Park');

-- Syntax Physic Opera
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Syntax Physic Opera', '554 S Broadway', 'Denver', 'CO', NULL, '(303) 282-4705', 'booking@syntaxphysicopera.com', 150, '400-700', 'Eclectic venue with great sound. South Broadway', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Syntax Physic Opera');

-- Taste of La Receta / Mi Casa
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Taste of La Receta / Mi Casa', NULL, 'Denver', 'CO', NULL, NULL, 'jmarinelarena@micasaresourcecenter.org', NULL, 'Unknown', 'Colorado seafood restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Taste of La Receta / Mi Casa');

-- Tequila Tasting Festival
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Tequila Tasting Festival', NULL, 'Denver', 'CO', NULL, NULL, 'connect@besocialscene.com', NULL, 'Unknown', 'Latino restaurant venue', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Tequila Tasting Festival');

-- The Venue
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Venue', '1451 Cortez St', 'Denver', 'CO', NULL, '(303) 428-3339', 'THEVENUE303@gmail.com', NULL, '400-800', 'Bagus reached out via webform', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Venue');

-- Union Station Urban Market
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Union Station Urban Market', NULL, 'Denver', 'CO', NULL, NULL, 'info@unionstationindenver.com', NULL, 'Unknown', 'Historic Denver Union Station', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Union Station Urban Market');

-- Woods Boss Brewery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Woods Boss Brewery', '2210 California St', 'Denver', 'CO', '80205', NULL, 'info@woodsbossbrewing.com', NULL, NULL, NULL, 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Woods Boss Brewery');

-- Englewood Events
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Englewood Events', '1000 Englewood Pkwy', 'Englewood', 'CO', '80110', '(303) 762-2300', 'events@englewoodco.gov', NULL, 'Unknown', 'City of Englewood events', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Englewood Events');

-- The Wild Game
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Wild Game', '1204 Bergen Pkwy', 'Evergreen', 'CO', '80439', '(720) 630-8888', 'info@thewildgameevergreen.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Wild Game');

-- Parrot''s Sports Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Parrot''s Sports Grill', '6050 Firestone Blvd', 'Firestone', 'CO', '80504', '(303) 774-0700', 'Email: parrottsfirestone@gmail.com', NULL, '400-700', 'Found via Colorado Playlist scraping - Sports Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Parrot''s Sports Grill');

-- 830 North
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT '830 North', NULL, 'Fort Collins', 'CO', NULL, '(719) 696-8861', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = '830 North');

-- Ace Gillet''s Lounge
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ace Gillet''s Lounge', NULL, 'Fort Collins', 'CO', NULL, '(970) 449-4797', NULL, NULL, '400-700', 'Found via Colorado Playlist scraping - Bar/Lounge', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ace Gillet''s Lounge');

-- Aggie Theatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Aggie Theatre', '204 S College Ave', 'Fort Collins', 'CO', NULL, '(970) 482-8300', 'booking@aggietheatre.com', 300, '500-1000', 'Downtown Fort Collins venue', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Aggie Theatre');

-- Atrium At the Alley Cat
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Atrium At the Alley Cat', '120 1/2 W Laurel St B', 'Fort Collins', 'CO', '80524', '(970) 325-3687', NULL, NULL, '500-1000', 'Merged from: Atrium At the Alley Cat', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Atrium At the Alley Cat');

-- Avogadro''s Number
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Avogadro''s Number', NULL, 'Fort Collins', 'CO', NULL, '(970) 493-5555', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Avogadro''s Number');

-- Breckenridge Brewery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Breckenridge Brewery', NULL, 'Fort Collins', 'CO', NULL, '(970) 658-3894', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Breckenridge Brewery');

-- Crown Pub
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Crown Pub', '134 S College Ave', 'Fort Collins', 'CO', '80524', '(970) 484-5929', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Pub', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Crown Pub');

-- Eqinox Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Eqinox Brewing', '133 Remington St', 'Fort Collins', 'CO', '80524', '(970) 484-1368', 'Info@equinoxbrewing.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Eqinox Brewing');

-- Funkwerks Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Funkwerks Brewing', '1900 E Lincoln Ave UNIT B', 'Fort Collins', 'CO', '80524', '(970) 482-3865', 'music@funkwerks.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Funkwerks Brewing');

-- Gilded Goat
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Gilded Goat', '3500 S College', 'Fort Collins', 'CO', NULL, NULL, NULL, 100, '200-400', 'Open mic 4th Thursdays', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Gilded Goat');

-- Hodi''s Half Note
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Hodi''s Half Note', '167 N College Ave', 'Fort Collins', 'CO', NULL, '(970) 472-2034', 'booking@hodishalfnote.com', 150, '300-600', 'Intimate Fort Collins venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Hodi''s Half Note');

-- Horsetooth Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Horsetooth Tavern', '4791 W County Rd 38 E', 'Fort Collins', 'CO', '80526', '(970) 229-0022', 'info@horsetoothtavern.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Horsetooth Tavern');

-- Illegal Petes
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Illegal Petes', '320 Walnut St', 'Fort Collins', 'CO', '80524', '(970) 999-3051', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Illegal Petes');

-- Island Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Island Grill', '2601 S Lemay Ave #12', 'Fort Collins', 'CO', '80525', '(970) 266-0124', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Island Grill');

-- Jay''s Bistro
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Jay''s Bistro', '135 W Oak St', 'Fort Collins', 'CO', '80524', '(970) 482-1876', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Jay''s Bistro');

-- Lucky Joe''s
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Lucky Joe''s', '25 Old Town Square', 'Fort Collins', 'CO', '80524', '(970) 493-2213', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Lucky Joe''s');

-- Mackenzie''s Pub & Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mackenzie''s Pub & Grill', '5750 S Lemay Ave', 'Fort Collins', 'CO', '80525', '(970) 223-0630', 'rob@golfsouthridge.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Pub', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mackenzie''s Pub & Grill');

-- Magic Rat
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Magic Rat', '111 Chestnut St', 'Fort Collins', 'CO', '80524', '(970) 999-3494', 'info@magicratlivemusic.com', NULL, '500-1000', 'Merged from: Magic Rat', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Magic Rat');

-- Maxline Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Maxline Brewing', '2724 McClelland Dr #190', 'Fort Collins', 'CO', '80525', '(970) 286-2855', 'kevin@maxlinebrewing.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Maxline Brewing');

-- New Belgium Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'New Belgium Brewing', '500 Linden St', 'Fort Collins', 'CO', NULL, '(970) 221-0524', 'events@newbelgium.com', 1000, 'Unknown', 'Large outdoor brewery venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'New Belgium Brewing');

-- Odell Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Odell Brewing', NULL, 'Fort Collins', 'CO', NULL, NULL, NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Odell Brewing');

-- Panhandler''s Pizza
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Panhandler''s Pizza', '2721 S College Ave', 'Fort Collins', 'CO', '80521', '(970) 232-9328', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Panhandler''s Pizza');

-- Penrose Taphouse and Eatery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Penrose Taphouse and Eatery', '216 N College Ave #110', 'Fort Collins', 'CO', '80524', '(970) 672-8400', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Penrose Taphouse and Eatery');

-- Ryan''s Sports Bar
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ryan''s Sports Bar', '925 E Harmony Rd', 'Fort Collins', 'CO', '80525', '(970) 229-0017', NULL, NULL, '400-700', 'Found via Colorado Playlist scraping - Sports Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ryan''s Sports Bar');

-- Scrumpy''s Hard Cider Bar & Pub
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Scrumpy''s Hard Cider Bar & Pub', '215 N College Ave', 'Fort Collins', 'CO', '80524', '(970) 682-1944', 'scrumpysmanager@gmail.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Cidery', 16, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Scrumpy''s Hard Cider Bar & Pub');

-- Songbryd Records
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Songbryd Records', '526 S College Ave B', 'Fort Collins', 'CO', '80524', '(970) 889-8890', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Record Store', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Songbryd Records');

-- Surfside7
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Surfside7', '238 Linden St', 'Fort Collins', 'CO', '80524', '(970) 221-4281', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Surfside7');

-- The Armory
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Armory', '314 E Mountain Ave', 'Fort Collins', 'CO', '80524', '(970) 232-9525', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Armory');

-- The Coast
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Coast', '254 Linden St', 'Fort Collins', 'CO', '80524', '(970) 682-2022', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Coast');

-- The Colorado Room
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Colorado Room', '642 S College Ave', 'Fort Collins', 'CO', '80524', '(970) 235-1442', 'info@thecoloradoroom.com', NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Colorado Room');

-- The Emporium Sports Bar
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Emporium Sports Bar', '925 S Taft Hill Rd', 'Fort Collins', 'CO', '80521', '(970) 232-9920', NULL, NULL, '400-700', 'Found via Colorado Playlist scraping - Sports Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Emporium Sports Bar');

-- The Forge Publick House
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Forge Publick House', '255 Old Firehouse Alley', 'Fort Collins', 'CO', '80524', '(970) 682-2578', 'music@theforgepub.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Pub', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Forge Publick House');

-- The Neighbor
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Neighbor', '144 S Mason St', 'Fort Collins', 'CO', '80524', NULL, NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Neighbor');

-- The OBC Wine Project
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The OBC Wine Project', '824 E Lincoln Ave', 'Fort Collins', 'CO', '80524', '(970) 541-0540', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The OBC Wine Project');

-- The Whisk(e)y
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Whisk(e)y', '214 S College Ave # 2', 'Fort Collins', 'CO', '80524', NULL, NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Whisk(e)y');

-- Tony''s Bar & Rooftop
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Tony''s Bar & Rooftop', '224 S College Ave', 'Fort Collins', 'CO', '80524', '(970) 484-6969', 'tonysfocobar@gmail.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Tony''s Bar & Rooftop');

-- Washington''s
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Washington''s', '132 Laporte Ave', 'Fort Collins', 'CO', NULL, '(970) 568-3010', 'booking@washingtonsfoco.com', 200, '400-800', 'Historic Fort Collins venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Washington''s');

-- Wolverine Farm Publick House
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Wolverine Farm Publick House', '316 Willow St', 'Fort Collins', 'CO', '80524', '(970) 297-7632', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Pub', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Wolverine Farm Publick House');

-- Fountain Creek Winery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Fountain Creek Winery', '606 S Santa Fe Ave', 'Fountain', 'CO', NULL, 'fountaincreekwinery@gmail.com', NULL, 80, '300-600', 'Interest in New Orleans music. South of Springs', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Fountain Creek Winery');

-- Ten Mile Music Hall
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Ten Mile Music Hall', '710 Main St', 'Frisco', 'CO', NULL, NULL, 'Booking@10milemusic.com', 400, '800-1800', 'Mountain resort venue', 31, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ten Mile Music Hall');

-- In The Zone
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'In The Zone', '15600 W 44th Ave', 'Golden', 'CO', NULL, '(303) 279-3888', 'thezonecolorado@yahoo.com', 200, '400-700', 'Open late - 2am', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'In The Zone');

-- Urban Bricks Pizza
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Urban Bricks Pizza', '7008 W 10th St Suite 500', 'Greeley', 'CO', NULL, NULL, NULL, 100, '200-400', 'Greeley pizza place', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Urban Bricks Pizza');

-- Max Taps
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Max Taps', '2680 East County Line Rd', 'Highlands Ranch', 'CO', NULL, '(720) 550-8914', NULL, 180, '400-700', 'Highlands Ranch location', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Max Taps');

-- Front Range Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Front Range Brewing', '400 W South Boulder Rd #1650', 'Lafayette', 'CO', NULL, '(303) 339-0767', NULL, 120, '300-500', 'Might not exist anymore', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Front Range Brewing');

-- Swing Station
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Swing Station', '3311 Co Rd 54G', 'Laporte', 'CO', '80535', '(970) 224-3326', 'heather@swingstationlaporte.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Swing Station');

-- Oskar Blues Longmont
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Oskar Blues Longmont', '1800 Pike Rd', 'Longmont', 'CO', NULL, '(303) 776-1914', 'events@oskarblues.com', 200, '400-800', 'Merged from: Oskar Blues Longmont', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Oskar Blues Longmont');

-- Tilted Barrel
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Tilted Barrel', '110 E 29th St', 'Loveland', 'CO', NULL, '(970) 619-8950', NULL, 120, '300-500', 'Loveland brew pub', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Tilted Barrel');

-- BookCliff Vineyards
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'BookCliff Vineyards', '670 39 Road Palisade', 'CO 81526', 'Palisade', 'CO', '(303) 499-7301', NULL, NULL, 'Unknown', '2024-08-01', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'BookCliff Vineyards');

-- Carboy Winery at Mt. Garfield Estate
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Carboy Winery at Mt. Garfield Estate', '3572 G Rd', 'Palisade', 'CO', '81526', '(970) 464-0941', 'info@carboywinery.com', NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Carboy Winery at Mt. Garfield Estate');

-- Colterris Collections
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colterris Collections', '3708 G Rd', 'Palisade', 'CO', '81526', '(970) 464-1150', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colterris Collections');

-- Colterris Winery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colterris Winery', '3708 G Rd', 'Palisade', 'CO', '81526', '(970) 464-1150', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colterris Winery');

-- Grande River Vineyards
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Grande River Vineyards', '787 Grande River Dr', 'Palisade', 'CO', '81526', '(970) 464-5867', 'info@granderivervineyards.com', NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Grande River Vineyards');

-- Palisade Brewing Company
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Palisade Brewing Company', '200 Peach Ave', 'Palisade', 'CO', '81526', '(970) 464-1462', 'brewingpalisade@gmail.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Palisade Brewing Company');

-- Palisade Livery Saloon 2.0
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Palisade Livery Saloon 2.0', '215 Main St', 'Palisade', 'CO', '81526', '(970) 464-5449', 'liverysaloon@outlook.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Palisade Livery Saloon 2.0');

-- Red Fox Cellars
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Red Fox Cellars', '691 36 Rd', 'Palisade', 'CO', '81526', '(970) 464-1099', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Red Fox Cellars');

-- Restoration Vineyards
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Restoration Vineyards', '3594 E 1/2 Rd', 'Palisade', 'CO', '81526', '(970) 985-0832', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Winery', 47, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Restoration Vineyards');

-- Talbots Cider Company
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Talbots Cider Company', '3782 F 1/4 Rd', 'Palisade', 'CO', '81526', '(970) 464-5943', 'talbottsciderco@gmail.com', NULL, 'Unknown', 'Found via Colorado Playlist scraping - Specialty Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Talbots Cider Company');

-- The Purple Bee Apothecary
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Purple Bee Apothecary', '213 Main St', 'Palisade', 'CO', '81526', '(970) 986-1897', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Specialty Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Purple Bee Apothecary');

-- 7th Street Station
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT '7th Street Station', NULL, 'Pueblo', 'CO', NULL, '(719) 696-8861', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Music Venue', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = '7th Street Station');

-- Analogue by Solar Roast
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Analogue by Solar Roast', NULL, 'Pueblo', 'CO', NULL, '(719) 545-0863', NULL, NULL, '300-500', 'Found via Colorado Playlist scraping - Cafe/Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Analogue by Solar Roast');

-- Blo Back Gallery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Blo Back Gallery', '131 Spring St', 'Pueblo', 'CO', '81003', '(719) 299-0059', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Gallery', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Blo Back Gallery');

-- Brues AleHouse
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Brues AleHouse', '120 E Riverwalk', 'Pueblo', 'CO', '81003', '(719) 924-9670', 'info@bruesalehouse.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Brues AleHouse');

-- Colorado Taproom
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colorado Taproom', '27050 E US Hwy 50', 'Pueblo', 'CO', '81006', '719-582-1783', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colorado Taproom');

-- El Nopal Restaurant
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'El Nopal Restaurant', '1435 E Evans Ave', 'Pueblo', 'CO', '81004', '(719) 564-9784', 'gtelnopal@gmail.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'El Nopal Restaurant');

-- El Wuateke Restaurant Bar Nightclub
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'El Wuateke Restaurant Bar Nightclub', '208 W Northern Ave', 'Pueblo', 'CO', '81004', '(719) 225-2731', NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Nightclub', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'El Wuateke Restaurant Bar Nightclub');

-- Graham''s Grill 3
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Graham''s Grill 3', '2149 Jerry Murphy Rd', 'Pueblo', 'CO', '81001', '(719) 696-9628', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Graham''s Grill 3');

-- Grind Haus Cafe
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Grind Haus Cafe', '209 S Union Ave', 'Pueblo', 'CO', '81003', '(719) 561-8567', NULL, NULL, '300-500', 'Found via Colorado Playlist scraping - Cafe', 13, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Grind Haus Cafe');

-- Riverside Bar & Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Riverside Bar & Grill', '4021 Jerry Murphy Rd', 'Pueblo', 'CO', '81001', '(719) 543-2037', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Riverside Bar & Grill');

-- Smitty''s Greenlight Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Smitty''s Greenlight Tavern', '227 N Santa Fe Ave', 'Pueblo', 'CO', '81003', '(719) 543-2747', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Smitty''s Greenlight Tavern');

-- The Broadway Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Broadway Tavern', '127 Broadway Ave', 'Pueblo', 'CO', '81004', '(719) 542-9964', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Broadway Tavern');

-- The Garage
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Garage', NULL, 'Pueblo', 'CO', NULL, NULL, NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Garage');

-- The Houdini Lounge
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Houdini Lounge', '419 N Santa Fe Ave', 'Pueblo', 'CO', '81003', '(719) 321-8326', NULL, NULL, '400-700', 'Found via Colorado Playlist scraping - Bar/Lounge', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Houdini Lounge');

-- The New Oasis
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The New Oasis', '1501 E Evans Ave', 'Pueblo', 'CO', '81004', NULL, NULL, NULL, '500-1000', 'Found via Colorado Playlist scraping - Bar/Venue', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The New Oasis');

-- Walter''s Brewery & Taproom
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Walter''s Brewery & Taproom', '126 Oneida St', 'Pueblo', 'CO', '81003', '(719) 542-0766', 'walterstaproom@gmail.com', NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Walter''s Brewery & Taproom');

-- Copper River
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Copper River', NULL, 'Pueblo West', 'CO', NULL, NULL, NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Copper River');

-- Strings Music Pavilion
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Strings Music Pavilion', '900 Strings Rd', 'Steamboat Springs', 'CO', NULL, '(970) 879-5056', 'info@stringsmusicfestival.com', 2000, 'Unknown', 'Steamboat outdoor venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Strings Music Pavilion');

-- Sheridan Opera House
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Sheridan Opera House', '110 N Oak St', 'Telluride', 'CO', NULL, '(970) 728-6363', 'info@sheridanoperahouse.com', 240, '600-1200', 'Telluride''s historic venue', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Sheridan Opera House');

-- Firefly Saloon
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Firefly Saloon', '7605 W 44th Ave Unit F', 'Wheat Ridge', 'CO', NULL, 'fireflysaloon@gmail.com', NULL, 150, '300-500', 'Previously booked up', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Firefly Saloon');

-- Peculier Ales
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Peculier Ales', '301 Main St Unit A', 'Windsor', 'CO', '80550', '(970) 460-2224', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Peculier Ales');

-- Deno''s Winter Park
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Deno''s Winter Park', '78911 U.S. Hwy 40', 'Winter Park', 'CO', '80482', '(970) 726-5332', NULL, NULL, 'Unknown', 'Winter Park restaurant venue', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Deno''s Winter Park');

-- Fontenot''s Winter Park
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Fontenot''s Winter Park', '78336 U.S. Hwy 40', 'Winter Park', 'CO', '80482', '(970) 726-4021', 'chrismoore11@msn.com', NULL, 'Unknown', 'Winter Park restaurant venue', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Fontenot''s Winter Park');

-- Fresh Seafood & Grill
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Fresh Seafood & Grill', NULL, 'Winter Park', 'CO', NULL, NULL, 'jmarinelarena@micasaresourcecenter.org', NULL, 'Unknown', NULL, 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Fresh Seafood & Grill');

-- Vertical Bistro
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Vertical Bistro', '130 Parry Peak Way', 'Winter Park', 'CO', '80482', '(970) 363-7053', 'gm@verticalbistro.com', NULL, 'Unknown', 'Village in Winter Park', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Vertical Bistro');

-- Volario''s Winter Park
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Volario''s Winter Park', 'First Floor', '78786 U.S. Hwy 40', 'Winter Park', 'CO', '(970) 722-1199', 'volarios@devilsthumbranch.com', NULL, 'Unknown', '2024-08-01', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Volario''s Winter Park');

-- Denver Artisan Markets
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Denver Artisan Markets', NULL, NULL, NULL, NULL, NULL, 'info@artisanmarkets.co', NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Denver Artisan Markets');

-- Boulder Theater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Boulder Theater', '2032 14th St', 'Boulder', 'CO', NULL, '(303) 555-2456', 'entertainment@bouldertheater.com', 850, '1300-2800', 'Historic theater. Prime Boulder venue', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Boulder Theater');

-- The Fox Theatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Fox Theatre', '1135 13th St', 'Boulder', 'CO', NULL, '(303) 555-2345', 'booking@foxtheatre.com', 625, '1200-2500', 'Boulder scene. University crowd', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Fox Theatre');

-- Pikes Peak Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Pikes Peak Center', '190 S Cascade Ave', 'Colorado Springs', 'CO', NULL, '(719) 477-2100', 'info@pikespeakcenter.com', 2000, 'Unknown', 'Large performing arts center', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Pikes Peak Center');

-- Sunflower Theatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Sunflower Theatre', NULL, 'Cortez', 'CO', NULL, NULL, NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Theater', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Sunflower Theatre');

-- Wild Edge Brewing Collective
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Wild Edge Brewing Collective', '111 N Market St', 'Cortez', 'CO', '81321', '(970) 565-9445', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Brewery', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Wild Edge Brewing Collective');

-- Zu Gallery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Zu Gallery', '48 W Main St', 'Cortez', 'CO', '81321', '(970) 235-1107', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Gallery', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Zu Gallery');

-- Butte 66 River Bar At Garlic Mike''s
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Butte 66 River Bar At Garlic Mike''s', NULL, 'Crested Butte', 'CO', NULL, '(970) 349-2272', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Butte 66 River Bar At Garlic Mike''s');

-- Crested Butte Public House
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Crested Butte Public House', '202 Elk Avenue', 'CO 81224', 'Crested Butte', 'CO', '(970) 349-0173', NULL, NULL, 'Small', '2024-08-01', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Crested Butte Public House');

-- Kochevars Saloon
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Kochevars Saloon', '127 Elk Ave', 'Crested Butte', 'CO', '81224', '(970) 349-7117', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Saloon', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Kochevars Saloon');

-- Mid-Week On Main Street
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mid-Week On Main Street', NULL, 'Crested Butte', 'CO', NULL, NULL, NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Event', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mid-Week On Main Street');

-- Mt. Crested Butte
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mt. Crested Butte', NULL, 'Crested Butte', 'CO', NULL, NULL, NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Outdoor Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mt. Crested Butte');

-- Red Lady Stage
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Red Lady Stage', NULL, 'Crested Butte', 'CO', NULL, NULL, NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Outdoor Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Red Lady Stage');

-- Talk of the Town
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Talk of the Town', '230 Elk Ave', 'Crested Butte', 'CO', '81224', '(970) 349-6809', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Talk of the Town');

-- The Crested Butte Center for the Arts
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Crested Butte Center for the Arts', '606 6th St', 'Crested Butte', 'CO', '81224', '(970) 349-7487', NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Arts Center', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Crested Butte Center for the Arts');

-- The Eldo
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Eldo', '215 Elk Ave', 'Crested Butte', 'CO', '81224', '(970) 251-5425', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Eldo');

-- Western Colorado University
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Western Colorado University', NULL, 'Crested Butte', 'CO', NULL, NULL, NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - University', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Western Colorado University');

-- Colorado Black Arts Festival
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colorado Black Arts Festival', NULL, 'Denver', 'CO', NULL, '(303) 306-8672', 'info@colbafweb.org', NULL, 'Unknown', 'Annual Black arts celebration', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colorado Black Arts Festival');

-- Summit Music Hall
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Summit Music Hall', '1902 Blake St', 'Denver', 'CO', NULL, '(303) 555-3012', 'booking@summitmusichall.com', 1800, '2000-4000', 'Large capacity. National acts', 31, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Summit Music Hall');

-- The Bluebird Theater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Bluebird Theater', '3317 E Colfax Ave', 'Denver', 'CO', NULL, '(303) 377-1666', 'booking@bluebirdtheater.net', 500, '800-1500', 'Classic Denver venue on Colfax', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Bluebird Theater');

-- The Oriental Theater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Oriental Theater', '4335 W 44th Ave', 'Denver', 'CO', NULL, '(720) 420-0030', 'booking@orientaltheater.com', 300, '600-1200', 'Historic theater. Northwest Denver', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Oriental Theater');

-- UMS (Underground Music Showcase)
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'UMS (Underground Music Showcase)', 'Multiple venues', 'Denver', 'CO', NULL, '(303) 297-1692', 'info@theums.com', NULL, 'Unknown', 'Denver''s largest indie music festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'UMS (Underground Music Showcase)');

-- Westword Music Showcase
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Westword Music Showcase', 'Multiple venues', 'Denver', 'CO', NULL, '(303) 293-1894', 'music@westword.com', NULL, 'Unknown', 'Annual Denver music festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Westword Music Showcase');

-- Gothic Theatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Gothic Theatre', '3263 S Broadway', 'Englewood', 'CO', NULL, '(303) 555-1345', 'booking@gothictheatre.com', 1100, '1500-3500', 'Historic theater. Professional only', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Gothic Theatre');

-- El Rancho Colorado
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'El Rancho Colorado', '29260 U.S. Hwy 40', 'Evergreen', 'CO', '80439', '(303) 228-1634', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar/Tavern', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'El Rancho Colorado');

-- Colorado State University Center for the Arts
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Colorado State University Center for the Arts', NULL, 'Fort Collins', 'CO', NULL, NULL, NULL, NULL, '1000-2000', 'Found via Colorado Playlist scraping - Theater', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Colorado State University Center for the Arts');

-- Fort Collins Museum of Discovery
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Fort Collins Museum of Discovery', NULL, 'Fort Collins', 'CO', NULL, NULL, NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Museum', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Fort Collins Museum of Discovery');

-- Lyric Cinema
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Lyric Cinema', '1209 N College Ave', 'Fort Collins', 'CO', '80524', '(970) 426-6767', NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Cinema', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Lyric Cinema');

-- Mountain Whitewater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mountain Whitewater', NULL, 'Fort Collins', 'CO', NULL, NULL, NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Outdoor Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mountain Whitewater');

-- Music City Hot Chicken
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Music City Hot Chicken', NULL, 'Fort Collins', 'CO', NULL, NULL, NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Restaurant', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Music City Hot Chicken');

-- The Lincoln Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Lincoln Center', '417 W Magnolia St', 'Fort Collins', 'CO', '80521', NULL, NULL, NULL, '1000-2000', 'Found via Colorado Playlist scraping - Theater', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Lincoln Center');

-- Gunnison Arts Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Gunnison Arts Center', '102 S Main St', 'Gunnison', 'CO', '81230', '(970) 641-4029', NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Arts Center', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Gunnison Arts Center');

-- A Bar Above
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'A Bar Above', '620 Gothic Rd Suite C130', 'Mt. Crested Butte', 'CO', '81225', '(512) 332-6096', NULL, NULL, '300-600', 'Found via Colorado Playlist scraping - Bar', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'A Bar Above');

-- Palisade Bluegrass Festival
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Palisade Bluegrass Festival', NULL, 'Palisade', 'CO', NULL, '970-925-1663', NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Palisade Bluegrass Festival');

-- Pueblo Memorial Hall
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Pueblo Memorial Hall', NULL, 'Pueblo', 'CO', NULL, NULL, NULL, NULL, '800-1500', 'Found via Colorado Playlist scraping - Theater', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Pueblo Memorial Hall');

-- Pueblo Riverwalk
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Pueblo Riverwalk', NULL, 'Pueblo', 'CO', NULL, NULL, NULL, NULL, 'Unknown', 'Found via Colorado Playlist scraping - Outdoor Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Pueblo Riverwalk');

-- Pueblo Union Depot
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Pueblo Union Depot', '132 W B St', 'Pueblo', 'CO', '81003', NULL, 'uniondepot@comcast.net', NULL, '800-1500', 'Found via Colorado Playlist scraping - Historic Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Pueblo Union Depot');

-- Sangre de Cristo Arts Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Sangre de Cristo Arts Center', NULL, 'Pueblo', 'CO', NULL, NULL, NULL, NULL, '600-1200', 'Found via Colorado Playlist scraping - Arts Center', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Sangre de Cristo Arts Center');

-- Southwest Motors Event Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Southwest Motors Event Center', NULL, 'Pueblo', 'CO', NULL, NULL, NULL, NULL, '1000-2000', 'Found via Colorado Playlist scraping - Event Center', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Southwest Motors Event Center');

-- Mountain View Lodge
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mountain View Lodge', '321 Resort Dr', 'Aspen', 'CO', NULL, '(555) 456-7890', 'tom@mountainview.com', 100, '400-800', 'Loves acoustic sets. Summer bookings', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mountain View Lodge');

-- The Belly Up
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Belly Up', '450 S Galena St', 'Aspen', 'CO', NULL, '(970) 544-9800', 'booking@bellyupaspen.com', 450, '800-1500', 'Aspen''s premier music venue', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Belly Up');

-- Antone''s Nightclub
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Antone''s Nightclub', '305 E 5th St', 'Austin', 'TX', NULL, '(512) 555-0567', 'talent@antones.net', 500, '800-1800', 'Home of the Blues. Know blues rep', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Antone''s Nightclub');

-- C-Boys Heart & Soul
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'C-Boys Heart & Soul', '2008 S Lamar Blvd', 'Austin', 'TX', NULL, '(512) 555-2789', 'matt@cboys.com', 200, '400-800', 'Soul music focus. Late night', 18, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'C-Boys Heart & Soul');

-- Cactus Cafe
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Cactus Cafe', '2247 Guadalupe St', 'Austin', 'TX', NULL, '(512) 555-1234', 'music@cactuscafe.org', 100, '200-500', 'Acoustic only. Listening room', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Cactus Cafe');

-- Cheer Up Charlies
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Cheer Up Charlies', '900 Red River St', 'Austin', 'TX', NULL, '(512) 555-2678', 'booking@cheerupcharlies.com', 250, '500-1000', 'Red River. Eclectic programming', 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Cheer Up Charlies');

-- Crossroads Brewing
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Crossroads Brewing', '567 Brewery Way', 'Austin', 'TX', NULL, '(512) 555-0345', 'jenny@crossroadsbrewing.com', 120, '300-500', 'Monthly residency possible', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Crossroads Brewing');

-- Mohawk
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mohawk', '912 Red River St', 'Austin', 'TX', NULL, '(512) 555-1678', 'booking@mohawkaustin.com', 300, '700-1400', 'Rooftop bar. Red River district', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mohawk');

-- Saxon Pub
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Saxon Pub', '1320 S Lamar Blvd', 'Austin', 'TX', NULL, '(512) 555-1456', 'jim@saxonpub.com', 120, '200-400', 'Songwriter rounds. Austin classic', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Saxon Pub');

-- Stubb''s Bar-B-Q
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Stubb''s Bar-B-Q', '801 Red River St', 'Austin', 'TX', NULL, '(512) 555-1012', 'entertainment@stubbs.com', 800, '1000-2000', 'Outdoor stage. SXSW venue', 39, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Stubb''s Bar-B-Q');

-- The Continental Club
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Continental Club', '1315 S Congress Ave', 'Austin', 'TX', NULL, '(512) 555-0789', 'booking@continentalclub.com', 300, '600-1200', 'Austin institution. Good pay', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Continental Club');

-- The Parish
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Parish', '214 E 6th St', 'Austin', 'TX', NULL, '(512) 555-2901', 'booking@theparishaustin.com', 800, '1200-2500', 'Downtown. Electronic friendly', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Parish');

-- The Well
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Well', '123 Music Ave', 'Austin', 'TX', NULL, '(555) 123-4567', 'sarah@thewell.com', 200, '500-1000', 'Great sound system. Books 2-3 months out', 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Well');

-- The White Horse
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The White Horse', '500 Comal St', 'Austin', 'TX', NULL, '(512) 555-2890', 'events@thewhitehorseaustin.com', 400, '600-1200', 'Honky-tonk. Two-step dancing', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The White Horse');

-- Vilar Performing Arts Center
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Vilar Performing Arts Center', '68 Avondale Ln', 'Beaver Creek', 'CO', NULL, '(970) 845-8497', 'info@vilarpac.org', 530, '800-1500', 'Beaver Creek venue', 44, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Vilar Performing Arts Center');

-- Mishawaka Amphitheatre
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Mishawaka Amphitheatre', '13714 Poudre Canyon Rd', 'Bellvue', 'CO', '80512', '(888) 843-6474', NULL, NULL, '1000-2000', 'Found via Colorado Playlist scraping - Outdoor Venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Mishawaka Amphitheatre');

-- House of Blues
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'House of Blues', '2200 N Lamar St', 'Dallas', 'TX', NULL, '(214) 555-0890', 'tyler@hob.com', 2000, '3000-8000', 'Chain venue. Professional EPK needed', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'House of Blues');

-- Planet Bluegrass
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Planet Bluegrass', '500 W Main St', 'Lyons', 'CO', NULL, '(303) 823-0848', 'info@bluegrass.com', 2500, 'Unknown', 'Home of RockyGrass Telluride Bluegrass', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Planet Bluegrass');

-- RockyGrass
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'RockyGrass', 'Planet Bluegrass', 'Lyons', 'CO', NULL, '(303) 823-0848', 'info@bluegrass.com', NULL, 'Unknown', 'Lyons bluegrass festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'RockyGrass');

-- Blue Moon Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Blue Moon Tavern', '789 Bar Blvd', 'Nashville', 'TN', NULL, '(555) 345-6789', 'events@bluemoon.com', 300, '800-1500', 'Competitive venue. Submit early', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Blue Moon Tavern');

-- Bluebird Cafe
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Bluebird Cafe', '4104 Hillsboro Pike', 'Nashville', 'TN', NULL, '(615) 555-1901', 'booking@bluebirdcafe.com', 90, '200-400', 'Songwriter showcase. Very competitive', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Bluebird Cafe');

-- Exit/In
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Exit/In', '2208 Elliston Pl', 'Nashville', 'TN', NULL, '(615) 555-1789', 'booking@exitin.com', 500, '900-2000', 'Near Vanderbilt. College crowd', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Exit/In');

-- The Station Inn
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Station Inn', '402 12th Ave S', 'Nashville', 'TN', NULL, '(615) 555-1890', 'bill@stationinn.com', 200, '300-600', 'Bluegrass only. Traditional venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Station Inn');

-- Niwot Tavern
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Niwot Tavern', '7960 Niwot Road', 'Niwot', 'CO', NULL, NULL, NULL, 100, '200-400', 'Small Niwot venue', 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Niwot Tavern');

-- Kilby Court
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Kilby Court', '741 S Kilby Ct', 'Salt Lake City', 'UT', NULL, '(801) 555-2234', 'booking@kilbycourt.com', 200, '200-500', 'All-ages. DIY aesthetic', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Kilby Court');

-- Red Butte Garden
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Red Butte Garden', '300 Wakara Way', 'Salt Lake City', 'UT', NULL, '(801) 555-2012', 'concerts@redbuttegarden.org', 3000, '2000-5000', 'Summer outdoor series only', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Red Butte Garden');

-- The State Room
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The State Room', '638 S State St', 'Salt Lake City', 'UT', NULL, '(801) 555-2123', 'programming@thestateroom.com', 1100, '1500-3000', 'Upscale venue. Professional presentation', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The State Room');

-- The Fillmore
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Fillmore', '1805 Geary Blvd', 'San Francisco', 'CA', NULL, '(415) 555-0234', 'booking@fillmore.com', 1150, '2000-5000', 'Historic venue. Very competitive', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Fillmore');

-- The Independent
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Independent', '628 Divisadero St', 'San Francisco', 'CA', NULL, '(415) 555-0901', 'alex@theindependentsf.com', 500, '1200-2500', 'Great sound. Submit early', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Independent');

-- Telluride Bluegrass Festival
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Telluride Bluegrass Festival', 'Town Park', 'Telluride', 'CO', NULL, '(303) 823-0848', 'info@bluegrass.com', NULL, 'Unknown', 'World-famous bluegrass festival', 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Telluride Bluegrass Festival');

-- Gerald R. Ford Amphitheater
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Gerald R. Ford Amphitheater', '530 S Frontage Rd E', 'Vail', 'CO', NULL, '(970) 476-4500', 'info@vvf.org', 2600, 'Unknown', 'Vail outdoor venue', 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Gerald R. Ford Amphitheater');

-- The Troubadour
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Troubadour', '9081 Santa Monica Blvd', 'West Hollywood', 'CA', NULL, '(310) 555-0456', 'booking@troubadour.com', 500, '1000-2500', 'Legendary venue. Submit video', 32, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Troubadour');

-- The Backyard/BattleCreek
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'The Backyard/BattleCreek', '330 Third St', 'Castle Rock', 'CO', NULL, '(720) 555-3456', NULL, 200, '500-1000', 'Booked July 8 2021 Oct 22 2022', 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Backyard/BattleCreek');

-- Culinary Dropout
INSERT INTO venues (name, address, city, state, zip_code, phone, email, capacity, fees, notes, venue_type_id, created_at, updated_at)
SELECT 'Culinary Dropout', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 34, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Culinary Dropout');

