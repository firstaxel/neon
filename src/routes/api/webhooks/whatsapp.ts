import { createHmac, timingSafeEqual } from "node:crypto";
import { startSpan } from "@sentry/tanstackstart-react";
import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { refundForMessage } from "#/features/billing/utils";
import { inngest } from "#/lib/inngest/client";

export const Route = createFileRoute("/api/webhooks/whatsapp")({
	server: {
		handlers: {
			GET: async ({ request }) => whatsappGetWebhook(request),
			POST: async ({ request }) => whatsappWebhookPost(request),
		},
	},
});

// ─── Status mapper ─────────────────────────────────────────────────────────────

// ─── GET — verification challenge ─────────────────────────────────────────────

export function whatsappGetWebhook(req: Request) {
	const url = new URL(req.url);

	const mode = url.searchParams.get("hub.mode");
	const token = url.searchParams.get("hub.verify_token");
	const challenge = url.searchParams.get("hub.challenge");

	if (
		mode === "subscribe" &&
		token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
	) {
		console.log("[WA Webhook] Verification successful");
		return new Response(challenge, {
			headers: { "Content-Type": "text/plain" },
			status: 200,
		});
	}

	console.warn("[WA Webhook] Verification failed — token mismatch");
	return new Response("Forbidden", { status: 403 });
}

// ─── POST — inbound events ─────────────────────────────────────────────────────

const isStopRegex = /^\s*(stop|unsubscribe|quit|cancel|end|opt.?out)\s*$/i;
const isStartRegex = /^\s*(start|subscribe|unstop)\s*$/i;

interface MetaTemplateStatusEvent {
	event:
		| "APPROVED"
		| "REJECTED"
		| "PENDING"
		| "PAUSED"
		| "DISABLED"
		| "IN_APPEAL";
	message_template_id: number;
	message_template_language: string;
	message_template_name: string;
	reason?: string; // present on REJECTED
}

interface MetaStatusUpdate {
	errors?: Array<{ code: number; title: string; message: string }>;
	id: string; // wamid — matches metaMessageId in Message table
	recipient_id: string;
	status: "sent" | "delivered" | "read" | "failed";
	timestamp: string;
}

interface MetaInboundMessage {
	from: string; // sender's phone (E.164 without +)
	id: string;
	text?: { body: string };
	timestamp: string;
	type:
		| "text"
		| "image"
		| "audio"
		| "document"
		| "interactive"
		| "button"
		| "order";
}

interface MetaMessagesValue {
	contacts?: Array<{ profile: { name: string }; wa_id: string }>;
	messages?: MetaInboundMessage[];
	messaging_product: "whatsapp";
	metadata: { display_phone_number: string; phone_number_id: string };
	statuses?: MetaStatusUpdate[];
}

interface MetaWebhookEntry {
	changes: Array<{
		value:
			| {
					messaging_product: "whatsapp";
					event?: MetaTemplateStatusEvent;
			  }
			| MetaMessagesValue;
		field: string; // "message_template_status_update" | "messages"
	}>;
	id: string; // WABA ID
}

interface MetaWebhookPayload {
	entry: MetaWebhookEntry[];
	object: "whatsapp_business_account";
}

// ─── Signature verification ────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string | null): boolean {
	const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
	if (!secret) {
		return true; // Skip verification if not configured
	}

	if (!signature?.startsWith("sha256=")) {
		return false;
	}

	const expected =
		"sha256=" +
		createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

	try {
		return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
	} catch {
		return false;
	}
}

// ─── Status mapper ─────────────────────────────────────────────────────────────

// Meta event strings → our WaTemplateStatus enum
const STATUS_MAP: Record<string, string> = {
	APPROVED: "APPROVED",
	DISABLED: "DISABLED",
	IN_APPEAL: "PENDING", // treat as still pending
	PAUSED: "PAUSED",
	PENDING: "PENDING",
	REJECTED: "REJECTED",
};

// ─── POST — inbound events ─────────────────────────────────────────────────────

export async function whatsappWebhookPost(req: Request) {
	return await startSpan(
		{ name: "whatsappWebhookPost", op: "http.server" },
		async () => {
			// 1. Read raw body for signature verification
			const rawBody = await req.text();

			// 2. Verify payload signature (recommended for production)
			const signature = req.headers.get("x-hub-signature-256");
			if (!verifySignature(rawBody, signature)) {
				console.warn("[WA Webhook] Invalid signature — rejecting payload");
				return new Response("Unauthorized", { status: 401 });
			}

			// 3. Parse payload
			let payload: MetaWebhookPayload;
			try {
				payload = JSON.parse(rawBody);
			} catch {
				return new Response("Bad Request", { status: 400 });
			}

			if (payload.object !== "whatsapp_business_account") {
				// 4. Only handle WhatsApp Business Account events
				return Response.json({ received: true });
			}

			// 5. Process each entry / change
			const updates: Promise<unknown>[] = [];

			for (const entry of payload.entry ?? []) {
				for (const change of entry.changes ?? []) {
					// ── Template status update ──────────────────────────────────────────────
					if (change.field === "message_template_status_update") {
						const val = change.value as { event?: MetaTemplateStatusEvent };
						const ev = val.event;
						if (!ev) {
							continue;
						}

						const newStatus = STATUS_MAP[ev.event];
						if (!newStatus) {
							continue;
						}

						console.log(
							`[WA Webhook] Template "${ev.message_template_name}" (${ev.message_template_id}) → ${newStatus}`,
							ev.reason ? `reason: ${ev.reason}` : ""
						);

						updates.push(
							prisma.messageTemplate.updateMany({
								data: {
									rejectionReason: ev.reason ?? null,
									status: newStatus as
										| "APPROVED"
										| "REJECTED"
										| "PENDING"
										| "PAUSED"
										| "DISABLED",
									...(newStatus === "APPROVED"
										? { approvedAt: new Date() }
										: {}),
								},
								where: { waTemplateId: String(ev.message_template_id) },
							})
						);
					}

					// ── Message delivery status updates ─────────────────────────────────────
					if (change.field === "messages") {
						const val = change.value as MetaMessagesValue;

						// Delivery/read receipts — update message status in our DB
						for (const status of val.statuses ?? []) {
							const dbStatus =
								status.status === "delivered"
									? "delivered"
									: status.status === "read"
										? "read"
										: status.status === "failed"
											? "failed"
											: null;

							if (!dbStatus) {
								continue;
							}

							if (dbStatus === "failed") {
								updates.push(
									(async () => {
										const existing = await prisma.message.findUnique({
											include: {
												campaign: { select: { id: true, userId: true } },
											},
											where: { metaMessageId: status.id },
										});
										if (!existing) {
											return;
										}

										// Atomically claim the failure transition to avoid duplicate counters or refunds on concurrent webhooks
										const updateRes = await prisma.message.updateMany({
											data: {
												errorMessage:
													status.errors?.[0]?.message ?? "Meta delivery failed",
												status: "failed",
											},
											where: { id: existing.id, status: { not: "failed" } },
										});

										if (updateRes.count > 0) {
											await prisma.campaign.update({
												data: {
													failedMessages: { increment: 1 },
													...(existing.status === "sent"
														? { sentMessages: { decrement: 1 } }
														: {}),
												},
												where: { id: existing.campaignId },
											});

											const alreadyRefunded =
												await prisma.transaction.findFirst({
													where: { reference: `refund_${existing.id}` },
												});

											if (
												!alreadyRefunded &&
												existing.costKobo &&
												existing.costKobo > 0
											) {
												await refundForMessage({
													campaignId: existing.campaignId,
													messageId: existing.id,
													messageType: "whatsapp_marketing",
													reason:
														status.errors?.[0]?.message ??
														"Meta delivery failed",
													userId: existing.campaign.userId,
												});
											}
										}
									})()
								);
							} else {
								updates.push(
									prisma.message.updateMany({
										data: {
											status: dbStatus as "delivered" | "read",
											...(dbStatus === "delivered"
												? { deliveredAt: new Date() }
												: {}),
											...(dbStatus === "read" ? { readAt: new Date() } : {}),
										},
										where: { metaMessageId: status.id },
									})
								);
							}
						}

						// Inbound messages — handle STOP / START opt-out and YES pre-screen replies
						for (const msg of val.messages ?? []) {
							if (msg.type !== "text" || !msg.text?.body) {
								continue;
							}

							const body = msg.text.body.trim();
							const phone = msg.from; // E.164 without +

							const isStop = isStopRegex.test(body);
							const isStart = isStartRegex.test(body);

							if (isStop) {
								console.log(`[WA Webhook] STOP from ${phone}`);
								updates.push(
									prisma.contact.updateMany({
										data: { optedOut: true, optedOutAt: new Date() },
										where: { phone: { in: [phone, `+${phone}`] } },
									})
								);
							} else if (isStart) {
								console.log(`[WA Webhook] START from ${phone}`);
								updates.push(
									prisma.contact.updateMany({
										data: { optedOut: false, optedOutAt: null },
										where: { phone: { in: [phone, `+${phone}`] } },
									})
								);
							}

							// Any non-keyword reply fires any pending pre-screen delivery.
							// Utility consent templates are warm open questions — any natural
							// reply ("Thanks!", "What time?", "👍") counts as consent given.
							if (!(isStop || isStart)) {
								const pending = await prisma.pendingDelivery.findFirst({
									orderBy: { createdAt: "desc" },
									where: {
										expiresAt: { gt: new Date() },
										phone,
										replied: false,
									},
								});
								if (pending) {
									console.log(
										`[WA Webhook] Reply from ${phone} → pending ${pending.id} ("${body.slice(0, 30)}")`
									);
									await inngest.send({
										data: { pendingDeliveryId: pending.id, phone },
										name: "Velocast/campaign.pending-reply-yes",
									});
								}
							}

							// ── Persist all inbound messages to inbox ──────────────────────────
							// Resolve contact + campaign owner so the message lands in the right inbox
							const contact = await prisma.contact.findFirst({
								select: { id: true, name: true, uploadedBy: true },
								where: { phone: { in: [phone, `+${phone}`] } },
							});

							// Find the most recent campaign outbound message to this phone to
							// attribute the inbound reply to the right campaign + userId
							const lastOutbound = await prisma.message.findFirst({
								orderBy: { sentAt: "desc" },
								select: {
									campaign: { select: { userId: true } },
									campaignId: true,
								},
								where: {
									channel: "whatsapp",
									phone: { in: [phone, `+${phone}`] },
								},
							});

							const userId =
								contact?.uploadedBy ?? lastOutbound?.campaign?.userId;
							if (!userId) {
								console.log(
									`[WA Webhook] Inbound from ${phone} — no userId found, skipping inbox save`
								);
								continue;
							}

							// Dedup by externalId (Meta message ID)
							const existing = msg.id
								? await prisma.inboundMessage.findUnique({
										where: { externalId: msg.id },
									})
								: null;
							if (!existing) {
								await prisma.inboundMessage.create({
									data: {
										body,
										campaignId: lastOutbound?.campaignId ?? null,
										channel: "whatsapp",
										contactId: contact?.id ?? null,
										contactName: contact?.name ?? null,
										externalId: msg.id,
										isKeyword: isStop || isStart,
										phone,
										receivedAt: new Date(
											Number.parseInt(msg.timestamp, 10) * 1000
										),
										userId,
									},
								});

								// Stamp lastInboundAt so the wizard can detect open service windows
								if (contact?.id) {
									await prisma.contact.update({
										data: {
											lastInboundAt: new Date(
												Number.parseInt(msg.timestamp, 10) * 1000
											),
										},
										where: { id: contact.id },
									});
								}
							}
						}
					}
				}
			}

			if (updates.length > 0) {
				// 6. Run all DB updates in parallel
				await Promise.allSettled(updates);
			}

			// Meta requires a 200 within 20s — always respond quickly
			return Response.json({ received: true });
		}
	);
}
