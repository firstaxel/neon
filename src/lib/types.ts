// ─── Contact Types ───────────────────────────────────────────────────────────

export type MessageChannel = "whatsapp" | "sms";
export type ContactType = "first_timer" | "returning" | "member" | "visitor";
export type MessageStatus =
	| "pending"
	| "queued"
	| "sending"
	| "sent"
	| "failed"
	| "rate_limited";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type ParseJobStatus = "pending" | "parsing" | "done" | "error";

export interface Contact {
	channel: MessageChannel;
	email?: string;
	id: string;
	name: string;
	notes?: string;
	parsedAt?: string;
	phone: string;
	rawRow?: string; // original text from image
	type: ContactType;
}

export interface ParsedContactResult {
	confidence: number; // 0-1
	contacts: Contact[];
	rawText: string;
	warnings: string[];
}

// ─── Campaign & Messaging Types ───────────────────────────────────────────────

export interface MessageTemplate {
	sms: string;
	whatsapp: string;
}

export interface Campaign {
	contacts: string[]; // contact IDs
	createdAt: string;
	failedMessages: number;
	id: string;
	inngestJobId?: string;
	name: string;
	scenario: ScenarioId;
	sentMessages: number;
	status: JobStatus;
	totalMessages: number;
}

export interface MessageRecord {
	campaignId: string;
	channel: MessageChannel;
	contactId: string;
	contactName: string;
	errorMessage?: string;
	id: string;
	message: string;
	phone: string;
	sentAt?: string;
	status: MessageStatus;
	twilioSid?: string;
}

// ─── Scenario Types ───────────────────────────────────────────────────────────

export type ScenarioId =
	| "first_timer"
	| "follow_up"
	| "event_invite"
	| "request"
	| "general";

export interface Scenario {
	description: string;
	icon: string;
	id: ScenarioId;
	label: string;
	template: MessageTemplate;
}

// ─── Job / Background Task Types ─────────────────────────────────────────────

export interface ParseImageJobPayload {
	imageBase64: string;
	jobId: string;
	mimeType: string;
	uploadedAt: string;
}

export interface SendMessagesJobPayload {
	campaignId: string;
	contacts: Contact[];
	customTemplate?: MessageTemplate;
	scenario: ScenarioId;
	template: MessageTemplate;
	useCustom: boolean;
}

export interface ParseJobState {
	completedAt?: string;
	error?: string;
	jobId: string;
	result?: ParsedContactResult;
	startedAt: string;
	status: ParseJobStatus;
}

export interface CampaignJobState {
	campaignId: string;
	completedAt?: string;
	messages: MessageRecord[];
	startedAt: string;
	status: JobStatus;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
	data?: T;
	error?: string;
	success: boolean;
}

export interface UploadResponse {
	jobId: string;
	message: string;
}

export interface ParseStatusResponse {
	contacts?: Contact[];
	error?: string;
	jobId: string;
	progress?: number;
	status: ParseJobStatus;
	warnings?: string[];
}

export interface SendCampaignResponse {
	campaignId: string;
	message: string;
	totalQueued: number;
}

export interface CampaignStatusResponse {
	campaignId: string;
	failed: number;
	messages: MessageRecord[];
	sent: number;
	status: JobStatus;
	total: number;
}
