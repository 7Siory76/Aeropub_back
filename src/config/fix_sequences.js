require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('./db');

async function fixSequences() {
  const tables = [
    { table: 'utilisateur', col: 'id' },
    { table: 'client', col: 'id' },
    { table: 'contact', col: 'id' },
    { table: 'role', col: 'id' },
    { table: 'action_commerciale', col: 'id' },
    { table: 'document_lie', col: 'id' },
    { table: 'statut_abonnement', col: 'id' },
    { table: 'journal_notification', col: 'id' }
  ];

  for (const { table, col } of tables) {
    try {
      const q = `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE(MAX(${col}), 0) + 1, false) FROM "${table}"`;
      const res = await db.query(q);
      console.log(`Sequence for ${table}.${col} reset:`, res.rows[0]);
    } catch (err) {
      // try without quotes
      try {
        const q2 = `SELECT setval(pg_get_serial_sequence('${table}', '${col}'), COALESCE(MAX(${col}), 0) + 1, false) FROM ${table}`;
        const res2 = await db.query(q2);
        console.log(`Sequence for ${table}.${col} reset (unquoted):`, res2.rows[0]);
      } catch(e2) {
        console.log(`Table ${table} sequence notice:`, e2.message);
      }
    }
  }

  process.exit(0);
}

fixSequences().catch(err => {
  console.error(err);
  process.exit(1);
});
