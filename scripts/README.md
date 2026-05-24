# 🌱 Wealth Pulse API - Seeding Scripts

Scripts for seeding the Wealth Pulse API with transaction data.

## 📋 Available Scripts

### `npm run seed`
Seeds the API with transaction data from `seed-data/api-expenses.json`

```bash
npm run seed
```

### `npm run seed:clear`
Clears existing data and seeds with fresh transaction data

```bash
npm run seed:clear
```

## 🚀 Quick Start

### 1. Transform Data (from project root)
```bash
cd ../..  # Go to project root
node scripts/transform-ledger-data.js
```

This creates `seed-data/api-expenses.json` with your transaction data.

### 2. Start API
```bash
cd wealth-pulse-api
npm run dev
```

### 3. Seed Database
In another terminal:
```bash
cd wealth-pulse-api
npm run seed
```

## 📁 File Locations

The seed script looks for data in two locations (in order):

1. **Local**: `wealth-pulse-api/seed-data/api-expenses.json`
2. **Root**: `life-sync-2.0/seed-data/api-expenses.json`

## 🔧 Manual Usage

You can also run the script directly:

```bash
# From wealth-pulse-api directory
node scripts/seed.js

# Or with --clear flag
node scripts/seed.js --clear
```

## ⚙️ Configuration

The script uses these environment variables:

- `API_URL` - API base URL (default: `http://localhost:3001`)

Example:
```bash
API_URL=http://localhost:3002 npm run seed
```

## 📊 What Gets Seeded

The script seeds:
- ✅ All expense transactions from your ledger
- ✅ Validates data before import
- ✅ Reports success/failure for each transaction
- ✅ Shows import statistics

## 🎯 Expected Output

```
🚀 Starting database seeding process...

📂 Using seed file: ../../seed-data/api-expenses.json
📂 Loading seed data...
   Found 185 expenses to import

🔍 Checking API health...
   ✓ API is healthy

💾 Seeding database...
✅ Database seeded successfully!

📊 Results:
   Total expenses seeded: 185
   Total expenses in database: 185

🎉 Seeding process complete!
```

## ⚠️ Troubleshooting

### API not responding
```bash
# Make sure API is running
npm run dev
```

### Seed file not found
```bash
# Run transformation from project root first
cd ../..
node scripts/transform-ledger-data.js
```

### Port already in use
```bash
# Change port in .env or use API_URL
API_URL=http://localhost:3002 npm run seed
```

## 🔄 Re-seeding

To clear and re-import data:

```bash
npm run seed:clear
```

Or manually:
```bash
# Delete all expenses via API
curl -X DELETE http://localhost:3001/api/expenses

# Re-seed
npm run seed
```

## 📚 Related Scripts

- **Transform Data**: `node ../../scripts/transform-ledger-data.js` (from root)
- **Prepare Frontend**: `node ../../scripts/prepare-frontend-import.js` (from root)

## 🏗️ Architecture

```
life-sync-2.0/
├── scripts/
│   └── transform-ledger-data.js     # Transforms CSV → JSON
├── seed-data/
│   └── api-expenses.json            # Generated seed data
└── wealth-pulse-api/
    ├── scripts/
    │   └── seed.js                  # This seeding script
    └── src/
        └── routes/
            └── expense.routes.ts    # Bulk import endpoints
```

## 🎓 Next Steps

After seeding:
1. ✅ Verify data: `curl http://localhost:3001/api/expenses`
2. ✅ Check count: `curl http://localhost:3001/api/expenses | jq '.meta.total'`
3. ✅ View in frontend app
4. ✅ Start using the API!
