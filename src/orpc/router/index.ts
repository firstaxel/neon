import {
	cancelSubscription,
	checkCampaignCost,
	getSubscription,
	getTransactions,
	getWallet,
	initDeposit,
	initSubscription,
	verifyDeposit,
} from "#/features/billing/billing.router";
import {
	getCampaignStatus,
	listCampaigns,
	sendCampaign,
} from "#/features/campaigns/router";
import {
	autoMergeDuplicates,
	deleteContact,
	deleteContacts,
	getContact,
	getDuplicates,
	listContacts,
	mergeContacts,
	updateContact,
} from "#/features/contacts/server/router";
import {
	getThread,
	listConversations,
	markThreadReplied,
	replyToConversation,
} from "#/features/messages/router";
import { parsingRouter } from "#/features/parsing/server/router";
import {
	completeOnboarding,
	getProfile,
	updatePassword,
	updateProfile,
} from "#/features/profile/server/router";
import {
	createTemplate,
	deleteTemplate,
	getTemplate,
	listTemplates,
	recordTemplateUsage,
	submitTemplateForApproval,
	syncTemplateStatus,
	updateTemplate,
} from "#/features/templates/router";
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

	contacts: o.router({
		get: getContact,
		list: listContacts,
		delete: deleteContact,
		deleteContacts,
		autoMergeDuplicates,
		getDuplicates,
		mergeContacts,
		updateContact,
	}),
	parse: parsingRouter,
	billing: o.router({
		getWallet,
		initDeposit,
		verifyDeposit,
		getTransactions,
		checkCampaignCost,
		getSubscription,
		initSubscription,
		cancelSubscription,
	}),
	profile: o.router({
		get: getProfile,
		update: updateProfile,
		completeOnboarding,
		updatePassword,
	}),
	template: o.router({
		list: listTemplates,
		get: getTemplate,
		create: createTemplate,
		update: updateTemplate,
		delete: deleteTemplate,
		submit: submitTemplateForApproval,
		syncStatus: syncTemplateStatus,
		recordUsage: recordTemplateUsage,
	}),
	inbox: o.router({
		get: getThread,
		list: listConversations,
		reply: replyToConversation,
		markThread: markThreadReplied,
	}),
});

export type AppRouter = typeof appRouter;
