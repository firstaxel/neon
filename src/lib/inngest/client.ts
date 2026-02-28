import { EventSchemas, Inngest } from "inngest";
import type { MessageChannel, ScenarioId } from "../types";

export interface ContactPayload {
	channel: MessageChannel;
	id: string;
	name: string;
	phone: string;
	type: string;
}

export interface Events {
	/** Triggered to start a campaign — orchestrator fans out to individual sends */
	"neon/campaign.send": {
		data: {
			campaignId: string;
			contacts: ContactPayload[];
			whatsappTemplate: string;
			smsTemplate: string;
			scenario: ScenarioId;
		};
	};
	/** One message send — one Inngest job */
	"neon/campaign.send-single": {
		data: {
			campaignId: string;
			messageId: string;
			contactName: string;
			phone: string;
			channel: MessageChannel;
			message: string;
		};
	};
	/** Triggered when an image is uploaded to R2 — parse it with Gemini */
	"neon/contact-list.parse": {
		data: {
			jobId: string; // DB parse_jobs.id
			r2Key: string; // Cloudflare R2 object key
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
		/** Triggered when an image is uploaded to R2 — parse it with Gemini */
		"neon/contact-list.parse": {
			data: {
				jobId: string; // DB parse_jobs.id
				r2Key: string; // Cloudflare R2 object key
				r2Bucket: string;
				mimeType: string;
				originalFilename: string;
				parsedBy: string;
			};
		};
		/** Triggered to start a campaign — orchestrator fans out to individual sends */
		"neon/campaign.send": {
			data: {
				campaignId: string;
				contacts: ContactPayload[];
				whatsappTemplate: string;
				smsTemplate: string;
				scenario: ScenarioId;
				createdBy: string;
			};
		};
		/** One message send — one Inngest job */
		"neon/campaign.send-single": {
			data: {
				campaignId: string;
				messageId: string;
				contactName: string;
				phone: string;
				channel: MessageChannel;
				message: string;
				sentBy: string;
			};
		};
	}>(),
});
