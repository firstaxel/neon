import { contactRouter } from "#/features/contacts/server/router";
import {
	getCampaignStatus,
	listCampaigns,
	sendCampaign,
} from "#/features/hooks/use-campaign.ts/router";
import { parsingRouter } from "#/features/parsing/server/router";
import {
	confirmDirectUpload,
	getParseStatus,
	getUploadPresignedUrl,
	uploadContactImage,
} from "#/features/upload/router";
import { o } from "..";

/**
 * Root o router.
 *
 * All procedures are namespaced under logical groups:
 *   upload.*   — file uploads + parse job management
 *   campaign.* — campaign creation + status + history
 *
 * This router is the single source of truth for the API type contract.
 * The client (o/client.ts) derives its types directly from this.
 */
export const appRouter = o.router({
	upload: o.router({
		uploadContactImage,
		getUploadPresignedUrl,
		confirmDirectUpload,
		getParseStatus,
	}),
	campaign: o.router({
		send: sendCampaign,
		getStatus: getCampaignStatus,
		list: listCampaigns,
	}),

	contacts: contactRouter,
	parse: parsingRouter,
});

export type AppRouter = typeof appRouter;
