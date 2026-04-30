-- Backfill: popular customer_tenants.loyalty_points_balance a partir do histórico
-- de loyalty_transactions. Usar uma única vez ao deployar a Fase 1.
--
-- Como rodar (escolha uma):
--   1) psql:        psql "$DATABASE_URL" -f packages/database/scripts/backfill-loyalty-balance.sql
--   2) Railway:     cole o SQL abaixo na console do Postgres
--   3) Drizzle Studio: aba Query, cole e execute
--
-- Esta operação é idempotente: rodar várias vezes não duplica saldos
-- (sempre recalcula do SUM original).

BEGIN;

WITH balances AS (
  SELECT
    c.id AS customer_id,
    lt.tenant_id,
    SUM(lt.points)::int AS total_points
  FROM loyalty_transactions lt
  JOIN customers c ON c.phone = lt.customer_phone
  GROUP BY c.id, lt.tenant_id
)
UPDATE customer_tenants ct
SET loyalty_points_balance = COALESCE(b.total_points, 0)
FROM balances b
WHERE ct.customer_id = b.customer_id
  AND ct.tenant_id = b.tenant_id;

-- Sanity check: contar quantos registros foram atualizados
SELECT
  COUNT(*) FILTER (WHERE loyalty_points_balance > 0) AS clientes_com_saldo,
  COUNT(*) AS total_customer_tenants,
  COALESCE(SUM(loyalty_points_balance), 0) AS pontos_totais_em_circulacao
FROM customer_tenants;

COMMIT;
