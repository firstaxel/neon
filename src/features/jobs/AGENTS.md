# Inngest Background Jobs

## Overview

This area manages asynchronous background tasks, event driven workflows, and long running orchestrations. It powers AI contact list parsing, broadcast campaign dispatch, rate limited SMS delivery, and retry management.

## Key files

| File | Owns |
|---|---|
| src/routes/api/inngest.ts | Inngest serve handler exposing background functions to the engine |
| src/lib/inngest/client.ts | Inngest client configuration, event schemas, and event trigger definitions |
| src/features/jobs/functions/parse-contacts.ts | Gemini AI contact extraction from uploaded R2 or S3 images |
| src/features/jobs/functions/send-campaign.ts | Campaign fan out orchestrator and single message worker functions |
| src/features/jobs/functions/send-campaign-prescreen.ts | Prescreening campaign execution and response handling |

## Commands

```bash
# Start local Inngest development server
bun run inngest-cli
```

## Conventions

- Trigger background workflows by dispatching typed events using the inngest client in src/lib/inngest/client.ts.
- Define functions using inngest.createFunction with explicit concurrency limits, retries, and timeouts.
- Break multi step workflows into step.run blocks so Inngest can memoize results and resume safely.
- Keep event payload sizes small by storing binary files in R2 or S3 and passing only object keys.
- Handle low wallet balance gracefully by calling handleLowBalancePause when credits run out.

## Gotchas

- Concurrency limits are enforced per function to prevent downstream API rate limit exhaustion.
- Failed jobs update database status fields in their onFailure callback.
- Testing background functions locally requires running the Inngest CLI dev server alongside the app.

## Agent skills

- [inngest-durable-functions](.agents/skills/inngest-durable-functions/): inngest/inngest-skills, Inngest durable functions and execution patterns
- [inngest-events](.agents/skills/inngest-events/): inngest/inngest-skills, Inngest typed event definitions and triggers
- [inngest-steps](.agents/skills/inngest-steps/): inngest/inngest-skills, Step execution and state memoization

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
