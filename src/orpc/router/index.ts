import {
	checkCampaignCost,
	getTransactions,
	getWallet,
	initDeposit,
	verifyDeposit,
} from "#/features/billing/billing.router";
import {
	cancelScheduledCampaign,
	createSmsCampaign,
	estimateCost,
	getCampaignDetail,
	getCampaignStatus,
	listCampaigns,
	sendCampaign,
} from "#/features/campaigns/router";
import {
	autoMergeDuplicates,
	batchTagContacts,
	createContact,
	deleteContact,
	deleteContacts,
	exportContacts,
	getContact,
	getDuplicates,
	getImportDetails,
	importContactsBatch,
	listContacts,
	listImports,
	listTags,
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
	deleteAccount,
	deleteSenderNumber,
	getProfile,
	getSenderNumbers,
	reseedTemplates,
	submitSenderId,
	updatePassword,
	updateProfile,
} from "#/features/profile/server/router";
import {
	createTemplate,
	deleteTemplate,
	getScenarioDefaults,
	getTemplate,
	listTemplates,
	recordTemplateUsage,
	seedFromLibrary,
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
	billing: o.router({
		checkCampaignCost,
		getTransactions,
		getWallet,
		initDeposit,
		verifyDeposit,
	}),
	campaign: o.router({
		cancelScheduled: cancelScheduledCampaign,
		cancelScheduledCampaign,
		createSms: createSmsCampaign,
		createSmsCampaign,
		estimateCost,
		getCampaignDetail,
		getDetail: getCampaignDetail,
		getStatus: getCampaignStatus,
		list: listCampaigns,
		send: sendCampaign,
	}),

	contacts: o.router({
		autoMergeDuplicates,
		batchTag: batchTagContacts,
		create: createContact,
		delete: deleteContact,
		deleteContacts,
		export: exportContacts,
		get: getContact,
		getDuplicates,
		getImportDetails,
		importBatch: importContactsBatch,
		list: listContacts,
		listImports,
		listTags,
		mergeContacts,
		updateContact,
	}),
	inbox: o.router({
		get: getThread,
		list: listConversations,
		markThread: markThreadReplied,
		reply: replyToConversation,
	}),
	parse: parsingRouter,
	profile: o.router({
		completeOnboarding,
		deleteAccount,
		deleteSenderNumber,
		get: getProfile,
		getSenderNumbers,
		reseedTemplates,
		submitSenderId,
		update: updateProfile,
		updatePassword,
	}),
	template: o.router({
		create: createTemplate,
		delete: deleteTemplate,
		get: getTemplate,
		getScenarioDefaults,
		list: listTemplates,
		recordUsage: recordTemplateUsage,
		seedFromLibrary,
		submit: submitTemplateForApproval,
		syncStatus: syncTemplateStatus,
		update: updateTemplate,
	}),
	upload: o.router({
		confirmDirectUpload,
		getParseStatus,
		getUploadPresignedUrl,
		uploadContactImage,
	}),
});

export type AppRouter = typeof appRouter;
