import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";
import {
	parseContactList,
	parseContactListOnFailure,
} from "#/features/jobs/functions/parse-contacts";
import {
	handleLowBalancePause,
	sendCampaign,
	sendSingleMessage,
} from "#/features/jobs/functions/send-campaign";
import {
	sendCampaignPrescreen,
	sendPendingMessage,
	sendPrescreenSingle,
} from "#/features/jobs/functions/send-campaign-prescreen";
import { inngest } from "#/lib/inngest/client";

const handler = serve({
	client: inngest,
	functions: [
		parseContactList, // Gemini AI contact parsing (R2 → Gemini → Postgres)
		parseContactListOnFailure, // Marks parse_jobs as error on failure
		sendCampaign, // Campaign orchestrator (fan-out)
		sendSingleMessage, // Per-message worker (rate-limited, retried)
		sendCampaignPrescreen, // Campaign orchestrator (fan-out)
		sendPrescreenSingle, // Per-message worker (rate-limited, retried)
		sendPendingMessage, // Real send after YES reply (rate-limited, retried)
		handleLowBalancePause,
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
