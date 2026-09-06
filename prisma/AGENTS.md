# Prisma Database Area

## Overview

This area configures the PostgreSQL database schema and client for Velocast. It handles data models for user accounts, contacts, campaigns, billing, message queues, and organization teams.

## Key files

| File | Owns |
|---|---|
| prisma/schema.prisma | Database schema definition, model relations, and indices |
| prisma.config.ts | Environment configuration for migrations and database seeding |
| src/db.ts | PrismaClient instance with PostgreSQL driver adapter and model type exports |
| prisma/migrations/ | Versioned SQL migration files |

## Commands

```bash
# Generate Prisma client
bun run db:generate

# Run migrations in development
bun run db:migrate

# Apply migrations in production
bun run db:migrate:prod

# Push schema directly without migrations
bun run db:push

# Open Prisma Studio web interface
bun run db:studio
```

## Conventions

- Client generation outputs directly to src/generated/prisma as defined in schema.prisma.
- Use the singleton client exported from src/db.ts instead of instantiating PrismaClient.
- The database connection uses PrismaPg driver adapter with connection strings from environment variables.
- Models mapped to snake case table names in PostgreSQL use the @@map attribute.
- Phone number uniqueness per user is strictly enforced by @@unique([userId, phone]).

## Gotchas

- Always run bun run db:generate after editing schema.prisma so generated types update.
- Production and local database connections differ via PROD environment flag in prisma.config.ts.
- Migrations use tsx prisma/seed.ts for seeding initial records.

## Agent skills

- [prisma-client-api](.agents/skills/prisma-client-api/): prisma/skills, Prisma client database queries and type safety
- [prisma-cli](.agents/skills/prisma-cli/): prisma/skills, Prisma CLI commands and migration management
- [prisma-driver-adapter-implementation](.agents/skills/prisma-driver-adapter-implementation/): prisma/skills, Prisma driver adapter setup

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
