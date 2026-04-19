# Matrix Food — Guia para Claude

> SaaS de delivery para restaurantes no Brasil. Cadastro grátis, cobrança pós-paga por percentual sobre vendas. Monorepo Turborepo/pnpm.

## Estrutura

```
apps/
  web/        # Next.js 15 — app principal (cliente + painel restaurante + superadmin)
  customer/   # App cliente isolado (pode ter sido unificado em web/ — verificar antes de editar)
  employee/   # App do funcionário/atendente
packages/
  database/   # Drizzle ORM + schema. Conexão lazy via getDb()
  api/        # tRPC routers (health, tenant, ...)
  auth/       # Firebase Auth config + middleware (next-firebase-auth-edge)
  ui/         # shadcn/ui + globals.css (Tailwind v4)
  utils/      # currency, operating-hours, order-number
  tsconfig/   # TS configs compartilhados
```

## Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind v4, shadcn/ui
- **Backend:** tRPC, Drizzle ORM, PostgreSQL (Railway)
- **Auth:** Firebase Auth (edge)
- **State:** Zustand + TanStack Query
- **Infra:** Railway (hosting + DB), Cloudinary (imagens), Hostgator (domínio)
- **Testes:** Vitest (unit/integration), Playwright (E2E)
- **CI:** GitHub Actions
- **Pacote:** pnpm 10.31.0, Node >= 20

## Comandos

Rodar sempre na raiz:

```bash
pnpm dev             # sobe todos os apps via turbo
pnpm build           # build completo
pnpm test            # unit tests (Vitest)
pnpm test:e2e        # Playwright
pnpm lint            # ESLint via turbo
pnpm format          # Prettier --write
pnpm db:push         # aplica schema Drizzle no banco
pnpm db:generate     # gera migrations
pnpm db:studio       # abre Drizzle Studio
```

Filtrar um workspace: `pnpm --filter @matrix-food/<pkg> <script>`.

## Convenções

- **Cor primária:** purple `#7c3aed` (definida nos tokens do Tailwind)
- **Portas dev:** `web` em 3000, `superadmin` em 3003 (se separado), demais conforme `turbo dev`
- **Banco:** usar sempre `getDb()` de `@matrix-food/database` — inicialização lazy, nunca importar o client direto
- **tRPC:** routers em `packages/api/src/routers/`; cliente consome via TanStack Query
- **UI:** componentes shadcn/ui em `packages/ui/`; não duplicar em apps
- **Idioma do produto:** Português (Brasil); moeda `BRL` via `@matrix-food/utils/currency`

## Contexto do usuário

- Desenvolvedor é **iniciante** — explicar em português, evitar jargão desnecessário.
- Preferências, fases do projeto e contas externas ficam em `~/.claude/projects/.../memory/MEMORY.md` (não duplicar aqui).

## Cuidados

Antes de alterar, pedir confirmação se a mudança afetar:

- `packages/database/src/schema` — schema do banco em produção
- `packages/auth/` e envs do Firebase
- `.github/workflows/` — CI/CD
- `turbo.json`, `pnpm-workspace.yaml`, `package.json` raiz
- Qualquer `.env*`

## Dicas para economizar contexto

- Antes de explorar, **ler este arquivo**. A estrutura acima costuma bastar.
- Para tarefas pontuais, pedir arquivo específico (`apps/web/src/app/...`) em vez de varredura.
- `MEMORY.md` tem o estado atual de fases — consultar antes de perguntar "em que fase estamos".
