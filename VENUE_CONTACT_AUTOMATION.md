# Venue Contact Automation

## Overview

This document outlines the automatic creation of venue contact records when venue social media entries are added. The system will automatically generate corresponding contact methods (like Messenger links) based on the social media platform.

## Problem Statement

When users add social media entries for venues (e.g., Facebook page), they often also want to contact that venue through related platforms (e.g., Facebook Messenger). Currently, this requires manual creation of separate contact records.

## Solution

Automatically create venue contact records when social media entries are added, using predefined URL templates to generate contact links.

## Supported Automations

### Facebook Social → Messenger Contact

**Trigger:** When a venue social of type `FACEBOOK` is created

**Action:** Automatically create a `venue_contacts` record with:

- **Contact Type:** `FACEBOOK_MESSAGE`
- **Value:** Username extracted from Facebook URL
- **Generated Link:** `https://m.me/{username}`

**Example:**

- **Input:** Facebook social with handle `krewedegrooveco`
- **Output:** Messenger contact with value `krewedegrooveco` → `https://m.me/krewedegrooveco`

### Instagram Social → Instagram Message Contact

**Trigger:** When a venue social of type `INSTAGRAM` is created

**Action:** Automatically create a `venue_contacts` record with:

- **Contact Type:** `INSTAGRAM_MESSAGE`
- **Value:** Username extracted from Instagram URL
- **Generated Link:** `https://instagram.com/{username}`

### LinkedIn Social → LinkedIn Message Contact

**Trigger:** When a venue social of type `LINKEDIN` is created

**Action:** Automatically create a `venue_contacts` record with:

- **Contact Type:** `LINKEDIN_MESSAGE`
- **Value:** Username extracted from LinkedIn URL
- **Generated Link:** `https://linkedin.com/in/{username}`

## Implementation Approaches

### Option 1: Application Logic (Recommended)

**Location:** Route handlers that create venue socials

**Pros:**

- Easy to maintain and debug
- Can include validation and error handling
- Flexible business logic
- Easy to test

**Implementation:**

```javascript
// In venue social creation route
if (socialType.name === "FACEBOOK") {
  // Extract username from handle
  const username = extractUsernameFromFacebookUrl(handle);

  // Auto-create messenger contact
  await prisma.venueContact.create({
    data: {
      venueId: venueId,
      contactTypeId: facebookMessageType.id,
      value: username,
    },
  });
}
```

### Option 2: Database Triggers

**Location:** PostgreSQL database level

**Pros:**

- Automatic at database level
- No application code changes needed
- Consistent regardless of how data is inserted

**Cons:**

- Harder to debug
- Less flexible
- Database-specific

**Implementation:**

```sql
CREATE OR REPLACE FUNCTION auto_create_venue_contacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Facebook social → Messenger contact
  IF NEW."socialTypeId" = (SELECT id FROM venue_social_types WHERE name = 'FACEBOOK') THEN
    INSERT INTO venue_contacts (venue_id, contact_type_id, value, created_at, updated_at)
    VALUES (
      NEW.venue_id,
      (SELECT id FROM venue_contact_types WHERE name = 'FACEBOOK_MESSAGE'),
      NEW.handle,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_venue_contacts
  AFTER INSERT ON venue_socials
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_venue_contacts();
```

## URL Template System

The system uses predefined URL templates from the `venue_contact_types` table:

| Contact Type        | URL Template                        | Example                                 |
| ------------------- | ----------------------------------- | --------------------------------------- |
| `FACEBOOK_MESSAGE`  | `https://m.me/{contact}`            | `https://m.me/krewedegrooveco`          |
| `INSTAGRAM_MESSAGE` | `https://instagram.com/{contact}`   | `https://instagram.com/venue_bar`       |
| `LINKEDIN_MESSAGE`  | `https://linkedin.com/in/{contact}` | `https://linkedin.com/in/venue-company` |
| `TWITTER_MESSAGE`   | `https://twitter.com/{contact}`     | `https://twitter.com/venue_bar`         |

## Username Extraction Logic

### Facebook URLs

- **Input:** `https://facebook.com/krewedegrooveco/` or `krewedegrooveco`
- **Output:** `krewedegrooveco`

### Instagram URLs

- **Input:** `https://instagram.com/venue_bar/` or `@venue_bar`
- **Output:** `venue_bar`

### LinkedIn URLs

- **Input:** `https://linkedin.com/company/venue-company/` or `venue-company`
- **Output:** `venue-company`

## Error Handling

- **Invalid URLs:** Skip automation, log warning
- **Duplicate Contacts:** Check for existing contacts before creating
- **Missing Contact Types:** Log error, continue with social creation
- **Database Errors:** Rollback social creation if contact creation fails

## Configuration

### Enable/Disable Automation

```javascript
const AUTOMATION_CONFIG = {
  facebookToMessenger: true,
  instagramToMessage: true,
  linkedinToMessage: true,
  twitterToMessage: true,
};
```

### Custom URL Patterns

```javascript
const URL_PATTERNS = {
  facebook: /(?:facebook\.com\/|^)([^\/\?]+)/,
  instagram: /(?:instagram\.com\/|@?)([^\/\?]+)/,
  linkedin: /(?:linkedin\.com\/(?:company\/|in\/)|^)([^\/\?]+)/,
};
```

## Testing

### Unit Tests

- Username extraction functions
- URL template generation
- Contact creation logic

### Integration Tests

- End-to-end social creation with contact automation
- Error scenarios (invalid URLs, missing contact types)
- Duplicate handling

### Manual Testing

1. Add Facebook social for venue
2. Verify Messenger contact is created
3. Test URL template generation
4. Verify no duplicates are created

## Future Enhancements

### Additional Platforms

- **TikTok** → TikTok message
- **Discord** → Discord server invite
- **Telegram** → Telegram contact

### Smart Detection

- Detect if platform supports messaging
- Only create contacts for platforms with messaging capabilities

### User Preferences

- Allow users to disable automation per venue
- Custom URL templates per user/organization

## Database Schema Requirements

### Existing Tables

- `venue_socials` - Stores social media entries
- `venue_contacts` - Stores contact methods
- `venue_social_types` - Social media platform types
- `venue_contact_types` - Contact method types

### Required Fields

- `venue_socials.handle` - The username/handle
- `venue_contacts.value` - The extracted username
- `venue_contact_types.urlTemplate` - URL generation template

## Implementation Priority

1. **Phase 1:** Facebook → Messenger automation
2. **Phase 2:** Instagram → Instagram message automation
3. **Phase 3:** LinkedIn → LinkedIn message automation
4. **Phase 4:** Additional platforms and user preferences

## Success Metrics

- **Automation Rate:** % of social entries that get auto-contacts
- **User Adoption:** % of users who use auto-generated contacts
- **Error Rate:** % of failed automation attempts
- **Time Saved:** Reduction in manual contact creation time
