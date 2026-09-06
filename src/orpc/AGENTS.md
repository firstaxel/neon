# oRPC API Layer

## Overview

This area implements the type safe remote procedure call layer for Velocast. It provides end to end type safety between backend procedures and frontend components while exposing OpenAPI documentation and REST compatible endpoints.

## Key files

| File | Owns |
|---|---|
| src/orpc/index.ts | Root procedure builder, error definitions, and authentication middleware |
| src/orpc/context.ts | Request context resolution including Better Auth session |
| src/orpc/router/index.ts | Central API router merging all feature procedures into one schema |
| src/orpc/client.ts | Frontend oRPC client instance configured with TanStack Query |
| src/routes/api.rpc.$.ts | HTTP handler serving procedure requests at /api/rpc |
| src/routes/api.$.ts | OpenAPI handler serving interactive documentation and REST endpoints at /api |

## Conventions

- Define procedures inside their respective feature directories and register them in src/orpc/router/index.ts.
- Use publicProcedure for unauthenticated endpoints and protectedProcedure for endpoints requiring a valid session.
- Validate procedure inputs and outputs using Zod schemas.
- Throw typed errors with ORPCError using standard codes like UNAUTHORIZED, NOT_FOUND, or BAD_REQUEST.
- The frontend accesses procedures through the type safe client exported from src/orpc/client.ts.

## Gotchas

- protectedProcedure automatically verifies session existence and attaches session context.
- OpenAPI route handles coercion and schemas via SmartCoercionPlugin and ZodToJsonSchemaConverter.
- When adding a procedure, export it from the feature router and mount it into appRouter in src/orpc/router/index.ts.

## Agent skills

- [tanstack-query](.agents/skills/tanstack-query/): tanstack-skills/tanstack-skills, TanStack Query integration with oRPC

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
