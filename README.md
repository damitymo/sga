# SGA Backend

API REST del Sistema de Gestión Administrativa escolar.

## Stack

- **NestJS 11** sobre Node 22
- **TypeORM 0.3** sobre **PostgreSQL**
- **JWT + bcrypt** con `@nestjs/jwt` / `@nestjs/passport`
- **`class-validator` / `class-transformer`** con `ValidationPipe` global (`whitelist`, `transform`)
- **`helmet`** para headers de seguridad
- **`@nestjs/throttler`** para rate-limit global (y endpoint-specific en login)
- **`@nestjs/config`** con validación de env al arranque

Deploy: Render (web service + managed Postgres).

## Estructura

```
src/
  agents/          # docentes/agentes
  assignments/     # designaciones/bajas de agentes en plazas
  attendance/      # asistencias diarias
  auth/            # login, guards, roles, strategy
  config/          # validación de variables de entorno
  migrations/      # migrations TypeORM (generadas)
  pof/             # plazas (POF) + historial de cambios
  revista/         # situación de revista
  scripts/         # scripts one-off (create-agent-users, reconciliaciones, imports)
  users/           # usuarios del sistema
  data-source.ts   # DataSource standalone para el CLI de TypeORM
  app.module.ts
  main.ts
```

## Setup local

Requisitos: Node 22+, PostgreSQL 14+.

```bash
cp .env.example .env
# Editá .env con tus credenciales de Postgres y un JWT_SECRET fuerte (>=32 chars).
# Podés generarlo con:
#   node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"

npm install
npm run migration:run      # aplica el baseline
npm run start:dev          # http://localhost:3001
```

Al arrancar, el ConfigModule valida las variables y falla rápido si falta
alguna crítica (`DB_HOST`, `DB_DATABASE`, `JWT_SECRET`, etc.).

## Variables de entorno

Documentadas en `.env.example`. Resumen:

| Variable | Obligatoria | Default | Notas |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `PORT` | No | `3001` | |
| `DB_HOST` | Sí | — | |
| `DB_PORT` | No | `5432` | |
| `DB_USERNAME` | Sí | — | |
| `DB_PASSWORD` | Sí | — | |
| `DB_DATABASE` | Sí | — | Acepta `DB_NAME` como fallback legacy |
| `JWT_SECRET` | Sí | — | ≥ 32 caracteres |
| `FRONTEND_URL` | No | — | Habilita CORS para esa URL |

## Scripts

```bash
npm run start            # start simple
npm run start:dev        # watch mode
npm run start:prod       # node dist/main (producción)
npm run build            # nest build → dist/

# migrations (dev, con ts-node)
npm run migration:create -- src/migrations/NombreMigration
npm run migration:generate -- src/migrations/NombreMigration
npm run migration:run
npm run migration:revert
npm run migration:show

# migrations (producción, sobre dist/)
npm run migration:run:prod
npm run migration:revert:prod
npm run migration:show:prod

# scripts one-off
npm run create:agent-users           # crea users AGENTE a partir de agents
npm run reconcile:revista            # reconcilia revista a partir de assignments
npm run import:attendance2025        # importa asistencia 2025 desde Excel

# test
npm run test
npm run test:e2e
npm run test:cov

# linting
npm run lint
```

## Autenticación y roles

JWT con expiración de 1 día. El payload incluye `sub` (user.id), `username`, `role`, `full_name` y `agent_id` (si aplica).

Roles:

- `ADMIN` — acceso total, incluyendo gestión de usuarios.
- `ADMINISTRATIVO` — puede leer y escribir sobre agents, POF, assignments, attendance, revista.
- `AGENTE` — sólo puede ver su propio perfil y asistencia (el user debe estar vinculado a un `agent` vía `user.agent_id`).

El login (`POST /auth/login`) tiene rate-limit estricto: 5 requests por minuto por IP.

## Migrations

El baseline se llama `InitialBaseline1776711747878` y crea el schema completo. Para cambiar el schema:

1. Editar las entities.
2. `npm run migration:generate -- src/migrations/DescripcionDelCambio` (contra una DB local al día).
3. Revisar el SQL generado.
4. `npm run migration:run` en local para testear.
5. Commitear y deployar; correr `migration:run:prod` en producción.

**Atención:** la DB productiva de Render tiene drift menor con respecto a las entities (enum columns como varchar, FK onDelete, naming de constraints). Ver "Drift conocido" en `docs/base-de-datos-v1.md`. Al generar migrations contra producción podés obtener cambios destructivos no deseados; generá siempre contra una DB local al día.

## Deploy en Render

- Web service con `npm run build` como build command y `npm run start:prod` como start command.
- Managed Postgres vinculado con las variables `DB_*` (Render las inyecta o configurás manual).
- Setear `JWT_SECRET` y `FRONTEND_URL` en el dashboard.
- `trust proxy` ya está activado en `main.ts`, necesario para que el rate-limit funcione detrás del reverse proxy de Render.

Para aplicar migrations en Render, correlas en un one-off shell:

```bash
npm run migration:run:prod
```

## Documentación adicional

- [`../docs/base-de-datos-v1.md`](../docs/base-de-datos-v1.md) — schema real, relaciones y reglas funcionales.
- [`../README.md`](../README.md) — README general del monorepo.
