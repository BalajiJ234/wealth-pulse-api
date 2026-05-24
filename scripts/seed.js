#!/usr/bin/env node
/**
 * Database Seeding Script for Wealth Pulse API
 * Seeds the API with transaction data from transformed ledger
 * 
 * Usage: 
 *   npm run seed
 *   npm run seed:clear  (clears existing data first)
 *   node scripts/seed.js
 *   node scripts/seed.js --clear
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
// Look for seed data in multiple locations
const SEED_FILE_LOCAL = path.join(__dirname, '..', 'seed-data', 'api-expenses.json');
const SEED_FILE_ROOT = path.join(__dirname, '..', '..', 'seed-data', 'api-expenses.json');
const CLEAR_BEFORE_SEED = process.argv.includes('--clear');

// Determine which seed file to use
function getSeedFile() {
  if (fs.existsSync(SEED_FILE_LOCAL)) {
    return SEED_FILE_LOCAL;
  } else if (fs.existsSync(SEED_FILE_ROOT)) {
    return SEED_FILE_ROOT;
  }
  return null;
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Make HTTP request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(body),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Check API health
async function checkAPIHealth() {
  try {
    const url = new URL(`${API_BASE_URL}/api/health`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
    };

    const response = await makeRequest(options);
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

// Seed expenses
async function seedExpenses(expenses) {
  try {
    const url = new URL(`${API_BASE_URL}/api/expenses/seed`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const data = {
      clear: CLEAR_BEFORE_SEED,
      expenses: expenses,
    };

    const response = await makeRequest(options, data);
    return response;
  } catch (error) {
    throw new Error(`Failed to seed expenses: ${error.message}`);
  }
}

// Bulk import expenses
async function bulkImportExpenses(expenses) {
  try {
    const url = new URL(`${API_BASE_URL}/api/expenses/bulk`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const data = {
      expenses: expenses,
    };

    const response = await makeRequest(options, data);
    return response;
  } catch (error) {
    throw new Error(`Failed to bulk import expenses: ${error.message}`);
  }
}

// Main execution
async function main() {
  try {
    log('\n🚀 Starting database seeding process...\n', 'cyan');

    // Check if seed file exists
    const SEED_FILE = getSeedFile();
    if (!SEED_FILE) {
      log('❌ Seed file not found!', 'red');
      log(`   Looked in:`, 'yellow');
      log(`   - ${SEED_FILE_LOCAL}`, 'yellow');
      log(`   - ${SEED_FILE_ROOT}`, 'yellow');
      log(`\n   Please run: npm run transform (from project root) first\n`, 'yellow');
      process.exit(1);
    }

    log(`📂 Using seed file: ${path.relative(process.cwd(), SEED_FILE)}`, 'blue');

    // Load seed data
    log('📂 Loading seed data...', 'blue');
    const expenses = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
    log(`   Found ${expenses.length} expenses to import\n`, 'green');

    // Check API health
    log('🔍 Checking API health...', 'blue');
    const isHealthy = await checkAPIHealth();
    
    if (!isHealthy) {
      log('❌ API is not responding!', 'red');
      log(`   Please ensure wealth-pulse-api is running on ${API_BASE_URL}`, 'yellow');
      log(`   Start it with: cd wealth-pulse-api && npm run dev\n`, 'yellow');
      process.exit(1);
    }
    log('   ✓ API is healthy\n', 'green');

    // Seed the database
    if (CLEAR_BEFORE_SEED) {
      log('🗑️  Clearing existing data...', 'yellow');
    }
    
    log('💾 Seeding database...', 'blue');
    const response = await seedExpenses(expenses);

    if (response.statusCode === 200) {
      log('✅ Database seeded successfully!\n', 'green');
      log('📊 Results:', 'cyan');
      log(`   Total expenses seeded: ${response.body.data.seeded}`, 'green');
      log(`   Total expenses in database: ${response.body.data.total}\n`, 'green');
    } else {
      log('⚠️  Seeding completed with warnings:', 'yellow');
      console.log(response.body);
    }

    log('🎉 Seeding process complete!\n', 'cyan');
    log('Next steps:', 'cyan');
    log('1. Open your WealthPulse app', 'reset');
    log('2. View your imported expenses', 'reset');
    log('3. Start tracking your finances!\n', 'reset');

  } catch (error) {
    log(`\n❌ Error: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

main();
