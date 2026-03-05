import { EventSchemas, Inngest } from "inngest";
import type { MessageType } from "#/features/billing/utils";
import type { MessageChannel, ScenarioId } from "../types";

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
//
// Every Inngest event used in neon is declared here.
// The `inngest` client is generic over this map, giving full type-safety
// on event.data inside every function handler.
//
// Naming convention:
//   neon/<resource>.<verb>         -- primary trigger
//   neon/<resource>.<verb>-single  -- per-item fan-out worker trigger

export interface Events {
	// ── Billing ──────────────────────────────────────────────────────────────────

	/**
	 * Fired when a campaign pauses due to insufficient wallet balance.
	 * Consumed by: handleLowBalancePause (sends email to user)
	 */
	"neon/campaign.paused-low-balance": {
		data: {
			campaignId: string;
			userId: string;
			remainingBalanceKobo: number;
		};
	};

	/**
	 * Fired by the WhatsApp webhook when a contact replies YES.
	 * Consumed by: sendPendingMessage
	 */
	"neon/campaign.pending-reply-yes": {
		data: {
			pendingDeliveryId: string;
			phone: string;
		};
	};

	// ── Utility pre-screen flow ──────────────────────────────────────────────────

	/**
	 * Fired by campaign.router for utility_prescreen mode.
	 * Consumed by: sendCampaignPrescreen (orchestrator)
	 */
	"neon/campaign.prescreen": {
		data: {
			campaignId: string;
			userId: string;
			orgName: string;
			contacts: ContactPayload[];
			realWhatsappMessage: string;
			realSmsMessage: string;
			scenario: ScenarioId;
			prescreenedBy: string;
		};
	};

	/**
	 * Fan-out: one event per contact in pre-screen mode.
	 * Consumed by: sendPrescreenSingle
	 */
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
			prescrenedBy: string;
		};
	};

	// ── Standard campaign ────────────────────────────────────────────────────────

	/**
	 * Fired by campaign.router for marketing or sms_fallback mode.
	 * Consumed by: sendCampaign (orchestrator)
	 */
	"neon/campaign.send": {
		data: {
			campaignId: string;
			userId: string;
			contacts: ContactPayload[];
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: ScenarioId;
			sentBy: string;
		};
	};

	/**
	 * Fan-out: one event per contact.
	 * Consumed by: sendSingleMessage (per-message worker)
	 */
	"neon/campaign.send-single": {
		data: {
			sentBy: string;
			campaignId: string;
			messageId: string;
			userId: string;
			contactName: string;
			phone: string;
			channel: MessageChannel;
			message: string;
		};
	};
	// ── Contact parsing ──────────────────────────────────────────────────────────

	/**
	 * Fired when a contact list image is uploaded to R2.
	 * Consumed by: parseContactList
	 */
	"neon/contact-list.parse": {
		data: {
			jobId: string; // parse_jobs.id in DB
			r2Key: string; // Cloudflare R2 object key
			r2Bucket: string;
			mimeType: string;
			originalFilename: string;
			parsedBy: string;
		};
	};
}
// Create a client to send and receive events
export const inngest = new Inngest({
	id: "neon",
	schemas: new EventSchemas().fromRecord<{
		// ── Contact parsing ──────────────────────────────────────────────────────────

		/**
		 * Fired when a contact list image is uploaded to R2.
		 * Consumed by: parseContactList
		 */
		"neon/contact-list.parse": {
			data: {
				jobId: string; // parse_jobs.id in DB
				r2Key: string; // Cloudflare R2 object key
				r2Bucket: string;
				mimeType: string;
				originalFilename: string;
				parsedBy: string;
			};
		};

		// ── Billing ──────────────────────────────────────────────────────────────────

		/**
		 * Fired when a campaign pauses due to insufficient wallet balance.
		 * Consumed by: handleLowBalancePause (sends email to user)
		 */
		"neon/campaign.paused-low-balance": {
			data: {
				campaignId: string;
				userId: string;
				remainingBalanceKobo: number;
			};
		};

		/**
		 * Fired by the WhatsApp webhook when a contact replies YES.
		 * Consumed by: sendPendingMessage
		 */
		"neon/campaign.pending-reply-yes": {
			data: {
				pendingDeliveryId: string;
				phone: string;
			};
		};

		// ── Utility pre-screen flow ──────────────────────────────────────────────────

		/**
		 * Fired by campaign.router for utility_prescreen mode.
		 * Consumed by: sendCampaignPrescreen (orchestrator)
		 */
		"neon/campaign.prescreen": {
			data: {
				campaignId: string;
				userId: string;
				orgName: string;
				contacts: ContactPayload[];
				realWhatsappMessage: string;
				realSmsMessage: string;
				scenario: ScenarioId;
			};
		};

		/**
		 * Fan-out: one event per contact in pre-screen mode.
		 * Consumed by: sendPrescreenSingle
		 */
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

		/**
		 * Fired by campaign.router for marketing or sms_fallback mode.
		 * Consumed by: sendCampaign (orchestrator)
		 */
		"neon/campaign.send": {
			data: {
				campaignId: string;
				userId: string;
				contacts: ContactPayload[];
				whatsappTemplate: string;
				smsTemplate: string;
				scenario: ScenarioId;
			};
		};

		/**
		 * Fan-out: one event per contact.
		 * Consumed by: sendSingleMessage (per-message worker)
		 */
		"neon/campaign.send-single": {
			data: {
				campaignId: string;
				messageId: string;
				userId: string;
				contactName: string;
				phone: string;
				messageType: MessageType;
				channel: MessageChannel;
				message: string;
				deliveryMode: "marketing" | "utility_prescreen" | "sms_fallback";
			};
		};
	}>(),
});
