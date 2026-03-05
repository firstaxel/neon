import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { inngest } from "#/lib/inngest/client";

export const Route = createFileRoute("/api/webhooks/whatsapp")({
	server: {
		handlers: {
			POST: async ({ request }) => whatsappPostWebhook(request),
			GET: async ({ request }) => whatsappGetWebhook(request),
		},
	},
});

/**
 * /api/whatsapp/webhook
 *
 * Meta WhatsApp Business Platform webhook handler.
 *
 * Two responsibilities:
 *
 * 1. GET  — Webhook verification challenge (one-time setup)
 *    Meta calls this when you register the webhook URL in the Meta App Dashboard.
 *    It sends hub.mode, hub.challenge, hub.verify_token.
 *    We echo back hub.challenge if the verify_token matches.
 *
 * 2. POST — Inbound event notifications
 *    Meta sends events for:
 *      - message_template_status_update  → approval / rejection status changes
 *      - (future) inbound messages, read receipts, etc.
 *
 * Setup in Meta App Dashboard:
 *   App → WhatsApp → Configuration → Webhook
 *   Callback URL: https://yourdomain.com/api/whatsapp/webhook
 *   Verify token: must match WHATSAPP_WEBHOOK_VERIFY_TOKEN env var
 *   Subscribe to: message_template_status_update
 *
 * Env vars:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — any secret string you choose
 *   WHATSAPP_WEBHOOK_SECRET        — app secret for payload signature verification (optional but recommended)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

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
	REJECTED: "REJECTED",
	PENDING: "PENDING",
	PAUSED: "PAUSED",
	DISABLED: "DISABLED",
	IN_APPEAL: "PENDING", // treat as still pending
};

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
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});
	}

	console.warn("[WA Webhook] Verification failed — token mismatch");
	return new Response("Forbidden", { status: 403 });
}

// ─── POST — inbound events ─────────────────────────────────────────────────────

const isStopRegex = /^\s*(stop|unsubscribe|quit|cancel|end|opt.?out)\s*$/i;
const isStartRegex = /^\s*(start|subscribe|unstop)\s*$/i;
const isYesRegex = /^\s*(yes|yeah|yep|ok|okay|sure|send|1)\s*$/i;

export async function whatsappPostWebhook(req: Request) {
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
						where: { waTemplateId: String(ev.message_template_id) },
						data: {
							status: newStatus as
								| "APPROVED"
								| "REJECTED"
								| "PENDING"
								| "PAUSED"
								| "DISABLED",
							rejectionReason: ev.reason ?? null,
							...(newStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
						},
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

					updates.push(
						prisma.message.updateMany({
							where: { metaMessageId: status.id },
							data: {
								status: dbStatus,
								...(dbStatus === "delivered"
									? { deliveredAt: new Date() }
									: {}),
								...(status.errors?.[0]
									? { errorMessage: status.errors[0].message }
									: {}),
							},
						})
					);
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
					const isYes = isYesRegex.test(body);

					if (isStop) {
						console.log(`[WA Webhook] STOP from ${phone}`);
						updates.push(
							prisma.contact.updateMany({
								where: { phone: { in: [phone, `+${phone}`] } },
								data: { optedOut: true, optedOutAt: new Date() },
							})
						);
					} else if (isStart) {
						console.log(`[WA Webhook] START from ${phone}`);
						updates.push(
							prisma.contact.updateMany({
								where: { phone: { in: [phone, `+${phone}`] } },
								data: { optedOut: false, optedOutAt: null },
							})
						);
					} else if (isYes) {
						// Look for a pending pre-screen delivery waiting on this phone's YES
						const pending = await prisma.pendingDelivery.findFirst({
							where: {
								phone,
								replied: false,
								expiresAt: { gt: new Date() },
							},
							orderBy: { createdAt: "desc" },
						});

						if (pending) {
							console.log(
								`[WA Webhook] YES from ${phone} — firing pending delivery ${pending.id}`
							);
							await inngest.send({
								name: "neon/campaign.pending-reply-yes",
								data: { pendingDeliveryId: pending.id, phone },
							});
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
}
