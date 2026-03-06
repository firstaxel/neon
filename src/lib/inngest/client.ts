import { EventSchemas, Inngest } from "inngest";
import type { MessageType } from "#/features/billing/utils";
import type { MessageChannel, ScenarioId } from "../types";

// ─── Shared payload types ─────────────────────────────────────────────────────

// ─── Shared payload types ─────────────────────────────────────────────────────

export interface ContactPayload {
	channel: MessageChannel;
	id: string;
	name: string;
	phone: string;
	type: string;
}

export type DeliveryMode = "marketing" | "utility_prescreen" | "sms_fallback";

// ─── Event map ────────────────────────────────────────────────────────────────

export interface Events {
	// ── Billing ──────────────────────────────────────────────────────────────────

	"neon/campaign.paused-low-balance": {
		data: {
			campaignId: string;
			userId: string;
			remainingBalanceKobo: number;
		};
	};

	"neon/campaign.pending-reply-yes": {
		data: {
			pendingDeliveryId: string;
			phone: string;
		};
	};

	// ── Utility pre-screen flow ──────────────────────────────────────────────────

	"neon/campaign.prescreen": {
		data: {
			campaignId: string;
			userId: string;
			orgName: string;
			contacts: ContactPayload[];
			realWhatsappMessage: string;
			realSmsMessage: string;
			scenario: ScenarioId;
			templateVars: Record<string, string>;
		};
	};

	"neon/campaign.prescreen-single": {
		data: {
			campaignId: string;
			userId: string;
			orgName: string;
			contactId: string;
			contactName: string;
			phone: string;
			channel: MessageChannel;
			realMessage: string;
		};
	};

	// ── Standard campaign ────────────────────────────────────────────────────────

	"neon/campaign.send": {
		data: {
			campaignId: string;
			userId: string;
			contacts: ContactPayload[];
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: ScenarioId;
			templateVars: Record<string, string>;
		};
	};

	/**
	 * Fan-out: one event per contact.
	 * messageType is pre-resolved by the orchestrator to avoid redundant DB reads
	 * and to ensure the worker uses the exact same billing rate as was quoted.
	 */
	"neon/campaign.send-single": {
		data: {
			campaignId: string;
			messageId: string;
			userId: string;
			contactName: string;
			phone: string;
			channel: MessageChannel;
			deliveryMode: DeliveryMode;
			message: string;
			messageType: MessageType; // pre-resolved — avoids per-worker re-derivation
		};
	};
	// ── Contact parsing ──────────────────────────────────────────────────────────

	"neon/contact-list.parse": {
		data: {
			jobId: string;
			r2Key: string;
			r2Bucket: string;
			mimeType: string;
			originalFilename: string;
		};
	};
}
// Create a client to send and receive events
export const inngest = new Inngest({
	id: "neon",
	schemas: new EventSchemas().fromRecord<{
		// ── Billing ──────────────────────────────────────────────────────────────────

		"neon/campaign.paused-low-balance": {
			data: {
				campaignId: string;
				userId: string;
				remainingBalanceKobo: number;
			};
		};

		"neon/campaign.pending-reply-yes": {
			data: {
				pendingDeliveryId: string;
				phone: string;
			};
		};

		// ── Utility pre-screen flow ──────────────────────────────────────────────────

		"neon/campaign.prescreen": {
			data: {
				campaignId: string;
				userId: string;
				orgName: string;
				contacts: ContactPayload[];
				realWhatsappMessage: string;
				realSmsMessage: string;
				scenario: ScenarioId;
				templateVars: Record<string, string>;
			};
		};

		"neon/campaign.prescreen-single": {
			data: {
				campaignId: string;
				userId: string;
				orgName: string;
				contactId: string;
				contactName: string;
				phone: string;
				channel: MessageChannel;
				realMessage: string;
			};
		};

		// ── Standard campaign ────────────────────────────────────────────────────────

		"neon/campaign.send": {
			data: {
				campaignId: string;
				userId: string;
				contacts: ContactPayload[];
				whatsappTemplate: string;
				smsTemplate: string;
				scenario: ScenarioId;
				templateVars: Record<string, string>;
			};
		};

		/**
		 * Fan-out: one event per contact.
		 * messageType is pre-resolved by the orchestrator to avoid redundant DB reads
		 * and to ensure the worker uses the exact same billing rate as was quoted.
		 */
		"neon/campaign.send-single": {
			data: {
				campaignId: string;
				messageId: string;
				userId: string;
				contactName: string;
				phone: string;
				channel: MessageChannel;
				deliveryMode: DeliveryMode;
				message: string;
				messageType: MessageType; // pre-resolved — avoids per-worker re-derivation
			};
		};
		// ── Contact parsing ──────────────────────────────────────────────────────────

		"neon/contact-list.parse": {
			data: {
				jobId: string;
				r2Key: string;
				r2Bucket: string;
				mimeType: string;
				originalFilename: string;
			};
		};
	}>(),
});
