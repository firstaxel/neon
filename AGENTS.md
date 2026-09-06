# Velocast

## Stack

- **Language / Runtime**: TypeScript, Bun (Node compatible runtime)
- **Framework**: TanStack Start with Vite and Nitro
- **Key dependencies**: Prisma ORM, oRPC, Better Auth, Inngest, Tailwind CSS v4
- **Package manager**: Bun

## Build approach

Tracer Bullet (prove the whole pipe works end to end before thickening breadth)

## Commands

```bash
# Install
bun install

# Dev server
bun run dev

# Build
bun run build

# Test
bun run test
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Format and lint with Ultracite (run bun run fix before commits)
- Path alias #/* maps to ./src/* for internal application imports
- Protect private pages with server authMiddleware in route definitions
- Use requireSession only when full user profile data is needed
- Build backend procedures in features and register in appRouter
- Instrument critical server functions using Sentry startSpan

## Agent skills

- [tanstack-start](.agents/skills/tanstack-start/): tanstack-skills/tanstack-skills, TanStack Start full stack web framework conventions
- [tanstack-router](.agents/skills/tanstack-router/): tanstack-skills/tanstack-skills, TanStack Router routing and navigation patterns
- [tanstack-query](.agents/skills/tanstack-query/): tanstack-skills/tanstack-skills, TanStack Query asynchronous state management
- [prisma-client-api](.agents/skills/prisma-client-api/): prisma/skills, Prisma client database queries and type safety
- [inngest-durable-functions](.agents/skills/inngest-durable-functions/): inngest/inngest-skills, Inngest background jobs and durable execution
MCP servers: PostgreSQL (recommended), Sentry (recommended)

## Context files

- [prisma/AGENTS.md](prisma/AGENTS.md): Prisma database schema, client setup, and migration workflows
- [src/orpc/AGENTS.md](src/orpc/AGENTS.md): Type safe API router, procedures, OpenAPI generation, and client bindings
- [src/features/jobs/AGENTS.md](src/features/jobs/AGENTS.md): Inngest background jobs, AI parsing, and campaign delivery queues

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
