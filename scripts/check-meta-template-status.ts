/**
 * scripts/check-meta-template-status.ts
 *
 * Fetches approval status for all submitted templates from Meta's API.
 * Groups by status so you can see at a glance what's approved, pending, rejected.
 *
 * Usage:
 *   META_WABA_ID=your_waba_id META_SYSTEM_TOKEN=your_token npx tsx scripts/check-meta-template-status.ts
 *
 * Options:
 *   FILTER_STATUS — "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" to filter output
 */

const WABA_ID = process.env.META_WABA_ID;
const META_TOKEN = process.env.META_SYSTEM_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION ?? "v23.0";
const FILTER_STATUS = process.env.FILTER_STATUS;

if (!(WABA_ID && META_TOKEN)) {
	console.error("❌  META_WABA_ID and META_SYSTEM_TOKEN are required.");
	process.exit(1);
}

interface MetaTemplate {
	category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
	id: string;
	language: string;
	name: string;
	quality_score?: { score: string };
	rejected_reason?: string;
	status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
}

interface MetaListResponse {
	data: MetaTemplate[];
	paging?: { cursors: { after: string }; next?: string };
}

async function fetchAllTemplates(): Promise<MetaTemplate[]> {
	const all: MetaTemplate[] = [];
	let url = `https://graph.facebook.com/${META_API_VERSION}/${WABA_ID}/message_templates?limit=100&fields=id,name,status,category,language,quality_score,rejected_reason`;

	while (url) {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${META_TOKEN}` },
		});
		const data = (await res.json()) as MetaListResponse;
		all.push(...data.data);
		url = data.paging?.next ?? "";
	}

	return all;
}

async function mainSync() {
	console.log("\n📋  Velocast — Meta Template Status");
	console.log("━".repeat(55));

	const templates = await fetchAllTemplates();

	let filtered = templates;
	if (FILTER_STATUS) {
		filtered = filtered.filter((t) => t.status === FILTER_STATUS);
	}

	// Group by status
	const groups: Record<string, MetaTemplate[]> = {};
	for (const t of filtered) {
		if (!groups[t.status]) {
			groups[t.status] = [];
		}
		groups[t.status].push(t);
	}

	const statusEmoji: Record<string, string> = {
		APPROVED: "✅",
		PENDING: "⏳",
		REJECTED: "❌",
		PAUSED: "⏸️",
		DISABLED: "🚫",
	};

	for (const [status, list] of Object.entries(groups)) {
		console.log(`\n${statusEmoji[status] ?? "•"}  ${status} (${list.length})`);
		console.log("─".repeat(45));
		for (const t of list.sort((a, b) => a.name.localeCompare(b.name))) {
			const quality = t.quality_score?.score
				? ` · quality: ${t.quality_score.score}`
				: "";
			const rejection = t.rejected_reason
				? ` · reason: ${t.rejected_reason}`
				: "";
			console.log(`   ${t.name} [${t.category}]${quality}${rejection}`);
		}
	}

	console.log(`\n${"━".repeat(55)}`);
	console.log(`   Total templates in WABA : ${templates.length}`);
	for (const [status, list] of Object.entries(groups)) {
		console.log(
			`   ${statusEmoji[status] ?? "•"}  ${status.padEnd(10)} : ${list.length}`
		);
	}
	console.log(`${"━".repeat(55)}\n`);
}

mainSync().catch((e) => {
	console.error(e);
	process.exit(1);
});
