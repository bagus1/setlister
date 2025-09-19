# How to Add Tables and Fields to the Database

This guide explains how to add new tables and fields to the database in the Setlister application, covering both local development and production deployment considerations.

## Overview

The application uses:

- **Prisma** as the ORM (Object-Relational Mapping) tool
- **PostgreSQL** as the database
- **Schema-first approach** - define changes in `prisma/schema.prisma` first

## Adding New Fields to Existing Tables

### Step 1: Update the Prisma Schema

Edit `prisma/schema.prisma` to add your new fields to the appropriate model:

```prisma
model Band {
  id          Int     @id @default(autoincrement())
  name        String  @db.VarChar(255)
  description String?

  // New fields
  websiteUrl   String? @db.VarChar(500) @map("website_url")
  epkUrl       String? @db.VarChar(500) @map("epk_url")
  bookingPitch String? @db.Text @map("booking_pitch")
  contactEmail String? @db.VarChar(255) @map("contact_email")
  contactPhone String? @db.VarChar(50) @map("contact_phone")

  // ... rest of model
}
```

**Field Mapping Notes:**

- Use `@map("column_name")` to specify the actual database column name (snake_case)
- Use `@db.VarChar(n)` for string length limits
- Use `@db.Text` for longer text fields
- Make fields optional with `?` unless they're required

### Step 2: Apply Schema Changes to Database

#### For Local Development:

```bash
npx prisma db push
```

This applies schema changes directly to your local database without creating migration files.

#### For Production (when ready):

Use the deployment script's schema mode:

```bash
./deploy.sh deploy-schema
```

### Step 3: Regenerate Prisma Client

```bash
npx prisma generate
```

This updates the Prisma client to include your new fields.

### Step 4: Update Application Code

#### Update Forms (EJS templates)

Add form fields to your EJS templates:

```html
<div class="mb-3">
  <label for="websiteUrl" class="form-label">Website URL (Optional)</label>
  <input
    type="url"
    class="form-control"
    id="websiteUrl"
    name="websiteUrl"
    value="<%= typeof websiteUrl !== 'undefined' ? websiteUrl : '' %>"
    placeholder="https://yourband.com"
  />
</div>
```

#### Update Route Validation

Add validation for new fields in your Express routes:

```javascript
body("websiteUrl")
  .optional()
  .isURL()
  .withMessage("Website URL must be a valid URL"),
body("contactEmail")
  .optional()
  .isEmail()
  .withMessage("Contact email must be a valid email"),
```

#### Update Route Handlers

Extract and use the new fields:

```javascript
const { name, description, websiteUrl, contactEmail } = req.body;

const band = await prisma.band.create({
  data: {
    name,
    description,
    websiteUrl: websiteUrl || null,
    contactEmail: contactEmail || null,
    // ... other fields
  },
});
```

#### Update Error Handling

Include new fields in error response data:

```javascript
return res.render("bands/new", {
  title: "Create Band",
  errors: errors.array(),
  name: req.body.name,
  description: req.body.description,
  websiteUrl: req.body.websiteUrl,
  contactEmail: req.body.contactEmail,
  // ... other fields
});
```

## Adding New Tables

### Step 1: Define the Model in Schema

Add a new model to `prisma/schema.prisma`:

```prisma
model VenueContactType {
  id          Int      @id @default(autoincrement())
  name        String   @unique @db.VarChar(50)
  displayName String   @db.VarChar(100)
  iconClass   String?  @db.VarChar(50)
  urlTemplate String?  @db.VarChar(500)
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  // Relations
  contacts    VenueContact[]

  @@map("venue_contact_types")
}
```

### Step 2: Apply to Database

```bash
npx prisma db push
```

### Step 3: Regenerate Client

```bash
npx prisma generate
```

### Step 4: Create Seeding Script (Optional)

For lookup tables, create seeding scripts in `prisma/seeds/`:

```sql
-- prisma/seeds/seed_venue_types.sql
INSERT INTO venue_contact_types (name, "displayName", "iconClass", "urlTemplate", is_active, sort_order, created_at, updated_at) VALUES
('EMAIL', 'Email', 'bi-envelope', 'mailto:{contact}', true, 1, NOW(), NOW()),
('PHONE_CALL', 'Phone Call', 'bi-telephone', 'tel:{contact}', true, 2, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "iconClass" = EXCLUDED."iconClass",
    "urlTemplate" = EXCLUDED."urlTemplate",
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
```

Run seeding:

```bash
./deploy.sh seed
```

## Production Deployment Considerations

### Schema Changes

- **Never run migrations directly** on production
- Use `./deploy.sh deploy-schema` which:
  - Downloads current production schema
  - Compares with local changes
  - Generates appropriate SQL
  - Applies changes safely
  - Commits and deploys

### Data Seeding

- Use idempotent SQL scripts with `ON CONFLICT` clauses
- Test seeding scripts locally first
- Use `./deploy.sh seed` for production seeding

## Common Patterns

### Optional Fields

Always make new fields optional initially:

```prisma
websiteUrl String? @db.VarChar(500)
```

This prevents issues with existing records.

### Default Values

Use defaults for boolean fields:

```prisma
isActive Boolean @default(true) @map("is_active")
```

### Timestamps

Include created/updated timestamps:

```prisma
createdAt DateTime @map("created_at") @db.Timestamptz(6)
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
```

### Foreign Keys

Use proper foreign key relationships:

```prisma
createdById Int @map("created_by_id")
creator     User @relation("BandCreator", fields: [createdById], references: [id])
```

## Troubleshooting

### Schema Drift

If you see "drift detected" errors:

```bash
npx prisma migrate reset  # WARNING: This will delete all data
# OR
npx prisma db push       # Safer for development
```

### Column Name Issues

Ensure Prisma field names match database column names:

```prisma
contactEmail String? @db.VarChar(255) @map("contact_email")
```

### Client Generation Issues

If fields aren't available in code:

```bash
npx prisma generate
```

## Best Practices

1. **Always test locally first** with `npx prisma db push`
2. **Use descriptive field names** and proper data types
3. **Make new fields optional** unless they're truly required
4. **Include proper validation** in your routes
5. **Update error handling** to preserve form data
6. **Use the deployment script** for production changes
7. **Create seeding scripts** for lookup tables
8. **Document your changes** in commit messages

## Example: Complete Field Addition

Here's a complete example of adding a new field:

1. **Schema** (`prisma/schema.prisma`):

```prisma
model Band {
  // ... existing fields
  websiteUrl String? @db.VarChar(500) @map("website_url")
}
```

2. **Apply**:

```bash
npx prisma db push
npx prisma generate
```

3. **Form** (`views/bands/new.ejs`):

```html
<input
  type="url"
  name="websiteUrl"
  value="<%= typeof websiteUrl !== 'undefined' ? websiteUrl : '' %>"
/>
```

4. **Route** (`routes/bands.js`):

```javascript
body("websiteUrl").optional().isURL(),
const { websiteUrl } = req.body;
// ... use in database operation
```

This process ensures your database schema, Prisma client, and application code stay in sync.
