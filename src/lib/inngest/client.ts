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

	"Velocast/campaign.paused-low-balance": {
		data: {
			campaignId: string;
			userId: string;
			remainingBalanceKobo: number;
		};
	};

	"Velocast/campaign.pending-reply-yes": {
		data: {
			pendingDeliveryId: string;
			phone: string;
		};
	};

	// ── Utility pre-screen flow ──────────────────────────────────────────────────

	"Velocast/campaign.prescreen": {
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

	"Velocast/campaign.prescreen-single": {
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

	"Velocast/campaign.send": {
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
	"Velocast/campaign.send-single": {
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

	"Velocast/contact-list.parse": {
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
	id: "Velocast",
	schemas: new EventSchemas().fromRecord<{
		// ── Billing ──────────────────────────────────────────────────────────────────

		"Velocast/campaign.paused-low-balance": {
			data: {
				campaignId: string;
				userId: string;
				remainingBalanceKobo: number;
			};
		};

		"Velocast/campaign.pending-reply-yes": {
			data: {
				pendingDeliveryId: string;
				phone: string;
			};
		};

		// ── Utility pre-screen flow ──────────────────────────────────────────────────

		"Velocast/campaign.prescreen": {
			data: {
				campaignId: string;
				userId: string;
				orgName: string;
				contactIds: string[];
				realWhatsappMessage: string;
				realSmsMessage: string;
				scenario: ScenarioId;
				templateVars: Record<string, string>;
			};
		};

		"Velocast/campaign.prescreen-single": {
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

		"Velocast/campaign.send": {
			data: {
				campaignId: string;
				userId: string;
				contactIds: string[];
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
		"Velocast/campaign.send-single": {
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

		"Velocast/contact-list.parse": {
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
