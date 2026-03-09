/**
 * scripts/debug-meta-ids.ts
 *
 * For system user tokens — finds your WABA ID and verifies template access.
 *
 * Usage:
 *   META_SYSTEM_TOKEN=xxx npx tsx scripts/debug-meta-ids.ts
 *   META_SYSTEM_TOKEN=xxx META_BUSINESS_ID=yyy npx tsx scripts/debug-meta-ids.ts
 */

const TOKEN = process.env.META_SYSTEM_TOKEN;
const API_VERSION = process.env.META_API_VERSION ?? "v20.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const KNOWN_BIZ_ID = process.env.META_BUSINESS_ID; // optional shortcut

if (!TOKEN) {
	console.error("❌  META_SYSTEM_TOKEN required");
	process.exit(1);
}

async function get(path: string) {
	const sep = path.includes("?") ? "&" : "?";
	const res = await fetch(`${BASE}${path}${sep}access_token=${TOKEN}`);
	return res.json() as Promise<any>;
}

async function tryWaba(wabaId: string) {
	console.log(`\n  🔎  Testing WABA ID: ${wabaId}`);
	const info = await get(
		`/${wabaId}?fields=id,name,currency,message_template_namespace`
	);
	if (info.error) {
		console.log(`      ❌  Not a valid WABA: ${info.error.message}`);
		return false;
	}
	console.log(`      ✅  VALID WABA: ${info.name ?? info.id}`);
	console.log(
		`      📋  namespace: ${info.message_template_namespace ?? "(missing — check permissions)"}`
	);

	// Phone numbers
	const phones = await get(
		`/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status`
	);
	for (const p of phones.data ?? []) {
		console.log(
			`      📱  ${p.display_phone_number} (${p.verified_name}) — phone_id: ${p.id} — ${p.status}`
		);
	}

	// Try listing templates to confirm write access
	const tpls = await get(
		`/${wabaId}/message_templates?limit=3&fields=id,name,status`
	);
	if (tpls.error) {
		console.log(`      ⚠️   Can't list templates: ${tpls.error.message}`);
	} else {
		console.log(
			`      📄  Templates visible: ${tpls.data?.length ?? 0} (showing up to 3)`
		);
		for (const t of tpls.data ?? []) {
			console.log(`           - ${t.name} [${t.status}]`);
		}
	}
	return true;
}

async function main() {
	// Step 1: confirm token
	const me = await get("/me?fields=id,name");
	if (me.error) {
		console.error("❌  Invalid token:", me.error.message);
		process.exit(1);
	}
	console.log(`\n✅  Token OK — system user: ${me.name} (${me.id})\n`);

	// Step 2: try the business the user knows about
	if (KNOWN_BIZ_ID) {
		console.log(`━━━ Testing META_BUSINESS_ID = ${KNOWN_BIZ_ID}`);
		const wabas = await get(
			`/${KNOWN_BIZ_ID}/owned_whatsapp_business_accounts?fields=id,name,message_template_namespace`
		);
		if (!wabas.error && wabas.data?.length) {
			for (const w of wabas.data) {
				await tryWaba(w.id);
			}
			return done();
		}
		// Maybe it IS the WABA ID directly
		const valid = await tryWaba(KNOWN_BIZ_ID);
		if (valid) {
			return done();
		}
	}

	// Step 3: system user → assigned businesses
	console.log("━━━ Fetching assigned businesses for this system user...");
	const assigned = await get(`/${me.id}/businesses?fields=id,name`);
	if (!assigned.error && assigned.data?.length) {
		for (const biz of assigned.data) {
			console.log(`\n📦  Business: ${biz.name} (${biz.id})`);
			const wabas = await get(
				`/${biz.id}/owned_whatsapp_business_accounts?fields=id,name`
			);
			for (const w of wabas.data ?? []) {
				await tryWaba(w.id);
			}
			const clientWabas = await get(
				`/${biz.id}/client_whatsapp_business_accounts?fields=id,name`
			);
			for (const w of clientWabas.data ?? []) {
				await tryWaba(w.id);
			}
		}
		return done();
	}

	// Step 4: nothing worked — guide user
	console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your system user token can reach the API but lacks
business_management permission to list WABAs automatically.

DO THIS:
  1. Go to developers.facebook.com → your app
  2. Left sidebar → WhatsApp → API Setup
  3. Under "Send and receive messages", look for:
     "WhatsApp Business Account" — copy that ID
  4. Re-run with:
     META_SYSTEM_TOKEN=xxx META_BUSINESS_ID=<that_id> npx tsx scripts/debug-meta-ids.ts

OR find it in Meta Business Suite:
  business.facebook.com → Settings → Accounts → WhatsApp Accounts
  Click your account → the ID in the URL is your WABA ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function done() {
	console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use the ✅ VALID WABA ID above as META_WABA_ID:

  META_WABA_ID=<id> META_SYSTEM_TOKEN=<token> \\
    npx tsx scripts/submit-meta-templates.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
	console.error("❌  Error during execution:", err);
	process.exit(1);
});
