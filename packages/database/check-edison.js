const postgres = require('postgres');
const bcrypt = require('bcryptjs');
const sql = postgres(process.env.DATABASE_URL);
(async () => {
  const rows = await sql`SELECT id, name, phone, password_hash, updated_at FROM customers WHERE id = '5bad4868-9e0a-4ce4-80a5-82ed4b34faf0'`;
  const row = rows[0];
  console.log('Edison:', { id: row.id, name: row.name, phone: row.phone, updated_at: row.updated_at, hashPrefix: row.password_hash?.slice(0, 15) });
  if (row.password_hash) {
    const candidates = ['656587', 'senha123', '123456', 'teste'];
    for (const pw of candidates) {
      const ok = await bcrypt.compare(pw, row.password_hash);
      console.log(`  ${pw.padEnd(12)} → ${ok ? 'MATCH' : 'no'}`);
    }
  }
  await sql.end();
})();
