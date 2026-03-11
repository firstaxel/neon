/**
 * src/lib/content-check.ts
 *
 * Shared AI content safety check used by both campaign Inngest functions.
 *
 * Previously duplicated verbatim in:
 *   - src/features/jobs/functions/send-campaign.ts
 *   - src/features/jobs/functions/send-campaign-prescreen.ts
 *
 * Extracted here so the model, prompt, and fail-open policy are maintained
 * in a single place.
 *
 * Design decisions:
 *  - Fails OPEN (returns safe: true) on any error. We never block a campaign
 *    because the AI is temporarily unavailable.
 *  - Truncates messages to 800 chars — enough for compliance, avoids token waste.
 *  - Uses gemini-1.5-flash for speed and cost efficiency (not pro).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "#/env";

// Single shared instance — no need to re-construct per function call.
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface ContentCheckResult {
	safe: boolean;
	reason?: string;
}

/**
 * Check a message body for compliance before sending.
 *
 * Safe = normal marketing/customer outreach copy.
 * Unsafe = spam, phishing, threats, sexual content, financial fraud, hate speech.
 *
 * Always call this ONCE per campaign in the orchestrator, never per-message.
 * The same template body is sent to every contact — no need to check it 5,000 times.
 */
export async function checkContent(
	message: string,
	channel: "whatsapp" | "sms" = "whatsapp"
): Promise<ContentCheckResult> {
	try {
		const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

		const prompt = `You are a messaging compliance checker for a business messaging platform.
Analyze this ${channel.toUpperCase()} message for compliance. Normal marketing and customer outreach is SAFE.
Mark UNSAFE only for: spam/phishing/scam, illegal threats, sexual content, financial fraud, hate speech.

Message: """
${message.slice(0, 800)}
"""

Reply with ONLY this JSON (no markdown):
{"safe": true, "reason": null}`;

		const result = await model.generateContent(prompt);
		const text = result.response
			.text()
			.trim()
			.replace(/```json\n?|```\n?/g, "");
		const parsed = JSON.parse(text) as ContentCheckResult;
		return { safe: parsed.safe ?? true, reason: parsed.reason };
	} catch {
		// Fail open — never block a campaign because Gemini is unavailable.
		return { safe: true };
	}
}
