require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('./db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE Client ADD COLUMN IF NOT EXISTS id_commercial INT REFERENCES Utilisateur(id);
    `);
    console.log('✅ Column id_commercial added to Client successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
