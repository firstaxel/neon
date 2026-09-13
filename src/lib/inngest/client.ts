import { eventType, Inngest, staticSchema } from "inngest";
import type { MessageType } from "#/features/billing/utils/format";
import type { MessageChannel, ScenarioId } from "../types";

// ─── Shared payload types ─────────────────────────────────────────────────────

export type ContactPayload = {
	channel: MessageChannel;
	id: string;
	name: string;
	phone: string;
	type: string;
};

export type DeliveryMode = "marketing" | "utility_prescreen" | "sms_fallback";

// ─── Event payload types ──────────────────────────────────────────────────────

export type CampaignPausedLowBalancePayload = {
	campaignId: string;
	userId: string;
	remainingBalanceKobo: number;
};

export type CampaignPendingReplyYesPayload = {
	pendingDeliveryId: string;
	phone: string;
};

export type CampaignPrescreenPayload = {
	campaignId: string;
	userId: string;
	orgName: string;
	contactIds: string[];
	realWhatsappMessage: string;
	realSmsMessage: string;
	scenario: ScenarioId;
	templateVars: Record<string, string>;
};

export type CampaignPrescreenSinglePayload = {
	campaignId: string;
	userId: string;
	orgName: string;
	orgType: string;
	scenario: ScenarioId;
	contactId: string;
	contactName: string;
	phone: string;
	channel: MessageChannel;
	realMessage: string;
};

export type CampaignSendPayload = {
	campaignId: string;
	userId: string;
	contactIds: string[];
	whatsappTemplate: string;
	smsTemplate: string;
	scenario: ScenarioId;
	templateVars: Record<string, string>;
	forceSmsChannel?: boolean;
	scheduledAt?: string;
};

export type CampaignSendSinglePayload = {
	campaignId: string;
	messageId: string;
	userId: string;
	contactName: string;
	phone: string;
	channel: MessageChannel;
	deliveryMode: DeliveryMode;
	message: string;
	messageType: MessageType;
	senderId?: string;
	segments?: number;
	costKobo?: number;
};

export type ContactListParsePayload = {
	jobId: string;
	r2Key: string;
	r2Bucket: string;
	mimeType: string;
	originalFilename: string;
	parsedBy?: string;
};

// ─── Event Types (v4 staticSchema & eventType) ────────────────────────────────

export const campaignPausedLowBalanceEvent = eventType(
	"Velocast/campaign.paused-low-balance",
	{
		schema: staticSchema<CampaignPausedLowBalancePayload>(),
	}
);

export const campaignPendingReplyYesEvent = eventType(
	"Velocast/campaign.pending-reply-yes",
	{
		schema: staticSchema<CampaignPendingReplyYesPayload>(),
	}
);

export const campaignPrescreenEvent = eventType("Velocast/campaign.prescreen", {
	schema: staticSchema<CampaignPrescreenPayload>(),
});

export const campaignPrescreenSingleEvent = eventType(
	"Velocast/campaign.prescreen-single",
	{
		schema: staticSchema<CampaignPrescreenSinglePayload>(),
	}
);

export const campaignSendEvent = eventType("Velocast/campaign.send", {
	schema: staticSchema<CampaignSendPayload>(),
});

export const campaignSendSingleEvent = eventType(
	"Velocast/campaign.send-single",
	{
		schema: staticSchema<CampaignSendSinglePayload>(),
	}
);

export const contactListParseEvent = eventType("Velocast/contact-list.parse", {
	schema: staticSchema<ContactListParsePayload>(),
});

// ─── Events map type for backward compatibility ──────────────────────────────

export type Events = {
	"Velocast/campaign.paused-low-balance": {
		data: CampaignPausedLowBalancePayload;
	};
	"Velocast/campaign.pending-reply-yes": {
		data: CampaignPendingReplyYesPayload;
	};
	"Velocast/campaign.prescreen": {
		data: CampaignPrescreenPayload;
	};
	"Velocast/campaign.prescreen-single": {
		data: CampaignPrescreenSinglePayload;
	};
	"Velocast/campaign.send": {
		data: CampaignSendPayload;
	};
	"Velocast/campaign.send-single": {
		data: CampaignSendSinglePayload;
	};
	"Velocast/contact-list.parse": {
		data: ContactListParsePayload;
	};
};

// ─── Client initialization ────────────────────────────────────────────────────

/**
 * Inngest client (v4 SDK).
 *
 * Migration notes:
 * - EventSchemas replaced with eventType() + staticSchema()
 * - Serve options (signingKey, baseUrl) configured here on client constructor
 * - checkpointing.maxRuntime set for serverless execution
 * - isDev set explicitly so local dev server works without requiring signing key
 */
export const inngest = new Inngest({
	checkpointing: {
		maxRuntime: "50s",
	},
	id: "Velocast",
	isDev: process.env.NODE_ENV === "development",
	signingKey: process.env.INNGEST_SIGNING_KEY,
});
