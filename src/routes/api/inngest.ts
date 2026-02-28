import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";
import {
	parseContactList,
	parseContactListOnFailure,
} from "#/features/jobs/functions/parse-contacts";
import {
	sendCampaign,
	sendSingleMessage,
} from "#/features/jobs/functions/send-campaign";
import { inngest } from "#/lib/inngest/client";

const handler = serve({
	client: inngest,
	functions: [
		parseContactList, // Gemini AI contact parsing (R2 → Gemini → Postgres)
		parseContactListOnFailure, // Marks parse_jobs as error on failure
		sendCampaign, // Campaign orchestrator (fan-out)
		sendSingleMessage, // Per-message worker (rate-limited, retried)
	],
});

export const Route = createFileRoute("/api/inngest")({
	server: {
		handlers: {
			GET: async ({ request }) => handler(request),
			POST: async ({ request }) => handler(request),
			PUT: async ({ request }) => handler(request),
		},
	},
});
