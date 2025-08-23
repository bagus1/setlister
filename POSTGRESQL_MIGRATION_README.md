# PostgreSQL Migration Guide

This guide covers the complete migration from SQLite to PostgreSQL for the Setlists application.

## 🎯 Migration Overview

We've successfully migrated the application from SQLite to PostgreSQL with:

- ✅ **Schema migration** using Sequelize CLI
- ✅ **Data migration** from SQLite to PostgreSQL
- ✅ **Code updates** for snake_case column mapping
- ✅ **Deployment scripts** for staging and production

## 🏗️ Architecture Changes

### **Database Schema**

- **Before**: SQLite with camelCase columns (`userId`, `createdAt`)
- **After**: PostgreSQL with snake_case columns (`user_id`, `created_at`)

### **Code Mapping**

- **Models**: Use Sequelize's `field` property to map camelCase → snake_case
- **Queries**: Use database column names in ORDER BY, WHERE clauses
- **Associations**: Automatically handled by Sequelize

## 📁 Migration Files

### **Core Migration Files**

- `migrations/20250823201940-initial-schema.js` - Creates all tables with proper schema
- `migrations/20250823202149-seed-sqlite-data.js` - Data import migration (placeholder)

### **Data Migration**

- `migrate-sqlite-to-postgres.js` - Exports SQLite data to PostgreSQL-compatible SQL
- `migration-output/` - Generated SQL files for each table

### **Deployment Scripts**

- `deploy-staging-postgres.sh` - Staging server deployment
- `deploy-production-postgres.sh` - Production deployment (when ready)

## 🚀 Migration Process

### **Phase 1: Local Development**

1. **Install dependencies**: `npm install`
2. **Test migration locally**: `node test-migration-locally.js`
3. **Generate migration files**: `node migrate-sqlite-to-postgres.js`

### **Phase 2: Staging Deployment**

1. **Update staging configuration** in `deploy-staging-postgres.sh`
2. **Run staging deployment**: `./deploy-staging-postgres.sh`
3. **Test thoroughly** on staging server

### **Phase 3: Production Deployment**

1. **Update production credentials** in `deploy-production-postgres.sh`
2. **Run production migration**: `./deploy-production-postgres.sh`
3. **Monitor closely** during and after deployment

## 🛠️ Sequelize CLI Commands

### **Database Management**

```bash
# Check migration status
npx sequelize-cli db:migrate:status

# Run migrations
npx sequelize-cli db:migrate

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all migrations
npx sequelize-cli db:migrate:undo:all

# Drop database
npx sequelize-cli db:drop

# Create database
npx sequelize-cli db:create
```

### **Migration Management**

```bash
# Generate new migration
npx sequelize-cli migration:generate --name migration-name

# Generate new model
npx sequelize-cli model:generate --name ModelName --attributes attr1:type,attr2:type
```

## 🔧 Configuration

### **Environment Variables**

```bash
# Development (PostgreSQL)
NODE_ENV=development_postgres

# Staging
NODE_ENV=staging

# Production
NODE_ENV=production
```

### **Database Configs**

- `config/config.json` - Sequelize CLI configuration
- `config/database.js` - Application database configuration

## 📊 Data Migration Process

### **1. Export SQLite Data**

```bash
node migrate-sqlite-to-postgres.js
```

This creates:

- `migration-output/users.sql` - User data
- `migration-output/bands.sql` - Band data
- `migration-output/songs.sql` - Song data
- And more...

### **2. Import to PostgreSQL**

Two options:

**Option A: Direct SQL Import**

```bash
psql -h localhost -U setlists_dev -d setlists_dev -f migration-output/users.sql
```

**Option B: Convert to Sequelize Migrations**

- Parse SQL files
- Use `queryInterface.bulkInsert()` in migrations

## 🚨 Important Notes

### **Before Production**

- ✅ Test on staging first
- ✅ Verify all data integrity
- ✅ Test rollback procedures
- ✅ Have backup plan ready

### **Column Name Mapping**

- **JavaScript**: `createdById`, `updatedAt`
- **Database**: `created_by_id`, `updated_at`
- **Models**: Use `field` property for mapping

### **Migration Safety**

- **Never use `sequelize.sync({ force: true })` in production**
- **Always use Sequelize CLI migrations**
- **Test rollbacks before production**

## 🔄 Rollback Procedures

### **If Migration Fails**

1. **Stop the application**
2. **Rollback migrations**: `npx sequelize-cli db:migrate:undo:all`
3. **Restore from backup**
4. **Investigate and fix issues**

### **If Data Import Fails**

1. **Clear imported data**: Use the `down` migration
2. **Fix data issues** in SQLite export
3. **Re-run migration**

## 📈 Performance Benefits

### **PostgreSQL Advantages**

- **Better concurrency** - Multiple users can write simultaneously
- **Advanced indexing** - Better query performance
- **ACID compliance** - Stronger data integrity
- **Scalability** - Can handle much larger datasets
- **Advanced features** - JSON support, full-text search, etc.

## 🧪 Testing

### **Local Testing**

```bash
# Test complete migration
NODE_ENV=development_postgres node test-migration-locally.js

# Test specific components
NODE_ENV=development_postgres npm start
```

### **Staging Testing**

- Deploy to staging server
- Test all functionality
- Verify data integrity
- Test rollback procedures

## 📞 Support

### **Common Issues**

1. **Column name mismatches** - Check `field` properties in models
2. **Foreign key constraints** - Ensure proper table creation order
3. **Data type conversions** - Verify SQLite → PostgreSQL type mapping

### **Getting Help**

- Check migration logs
- Verify database connection
- Test with smaller datasets first
- Use staging environment for debugging

## 🎉 Success Criteria

Migration is successful when:

- ✅ All tables created with correct schema
- ✅ All data imported without loss
- ✅ Application functions normally
- ✅ Performance meets expectations
- ✅ Rollback procedures tested
- ✅ Team trained on new processes

---

**Remember**: Always test on staging before production, and have a rollback plan ready!
