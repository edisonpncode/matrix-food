/**
 * Investigação: estado de tenant_users em produção.
 * Pergunta-chave: quantos donos/funcionários têm firebase_uid populado?
 * Sem isso, o /restaurante/admin em produção deixa de funcionar após o fix.
 *
 * Uso (na raiz do repo):
 *   DATABASE_URL=$(cat .env.local | grep ^DATABASE_URL | cut -d= -f2-) \
 *     node packages/database/check-tenant-users.js
 */
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL);

(async () => {
  try {
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM tenant_users`;
    const [{ withUid }] =
      await sql`SELECT COUNT(*)::int AS "withUid" FROM tenant_users WHERE firebase_uid IS NOT NULL AND firebase_uid <> ''`;
    const [{ active }] =
      await sql`SELECT COUNT(*)::int AS active FROM tenant_users WHERE is_active = true`;
    const [{ activeWithUid }] = await sql`
      SELECT COUNT(*)::int AS "activeWithUid"
      FROM tenant_users
      WHERE is_active = true AND firebase_uid IS NOT NULL AND firebase_uid <> ''
    `;

    console.log("=== tenant_users (produção) ===");
    console.log("Total:                 ", total);
    console.log("Ativos:                ", active);
    console.log("Com firebase_uid:      ", withUid);
    console.log("Ativos + firebase_uid: ", activeWithUid);

    const byTenant = await sql`
      SELECT
        t.name AS tenant,
        t.slug,
        COUNT(*)::int AS users,
        SUM(CASE WHEN tu.firebase_uid IS NOT NULL AND tu.firebase_uid <> '' THEN 1 ELSE 0 END)::int AS with_uid,
        SUM(CASE WHEN tu.role = 'OWNER' THEN 1 ELSE 0 END)::int AS owners,
        SUM(CASE WHEN tu.role = 'OWNER' AND tu.firebase_uid IS NOT NULL AND tu.firebase_uid <> '' THEN 1 ELSE 0 END)::int AS owners_with_uid
      FROM tenant_users tu
      JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.is_active = true
      GROUP BY t.name, t.slug
      ORDER BY t.name
    `;

    console.log("\n=== Por tenant (apenas ativos) ===");
    if (byTenant.length === 0) {
      console.log("(nenhum tenant_user ativo)");
    } else {
      for (const r of byTenant) {
        console.log(
          `${r.tenant.padEnd(30)} users=${r.users}  com_uid=${r.with_uid}  owners=${r.owners}  owners_com_uid=${r.owners_with_uid}`
        );
      }
    }

    const ownersSemUid = await sql`
      SELECT t.name AS tenant, tu.email, tu.name AS user_name, tu.role
      FROM tenant_users tu
      JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.is_active = true
        AND tu.role = 'OWNER'
        AND (tu.firebase_uid IS NULL OR tu.firebase_uid = '')
      ORDER BY t.name
      LIMIT 20
    `;

    console.log("\n=== OWNERs ativos SEM firebase_uid (primeiros 20) ===");
    if (ownersSemUid.length === 0) {
      console.log("(nenhum — todos os owners estão linkados ao Firebase)");
    } else {
      for (const r of ownersSemUid) {
        console.log(
          `${r.tenant.padEnd(30)} ${(r.email ?? "(sem email)").padEnd(40)} ${r.user_name}  [${r.role}]`
        );
      }
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
