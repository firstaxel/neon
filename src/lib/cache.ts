/**
 * src/lib/cache.ts
 *
 * In-process LRU cache for oRPC procedure handlers.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 *
 * Uses a Map<string, Entry> where Map's insertion-order iteration gives us
 * free LRU eviction: when full, we delete the first (oldest) key. O(1) get/set.
 *
 * Keys are always scoped per user:  `userId:procedureName:stableJson(input)`
 * This is non-negotiable — cross-user data leakage would be a security bug.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { withCache, invalidate } from "#/lib/cache";
 *
 *   // Wrap a handler — caches result for 30s per user+input combo
 *   export const listContacts = protectedProcedure
 *     .input(schema)
 *     .handler(withCache("contacts.list", 30_000, async ({ input, context }) => {
 *       return db.contact.findMany(...)
 *     }))
 *
 *   // Invalidate after a mutation
 *   invalidate(userId, "contacts.list")              // all inputs
 *   invalidate(userId, "contacts.list", { page: 1 }) // one specific input
 *
 * ── TTL Guide ─────────────────────────────────────────────────────────────────
 *
 *   Live campaign progress (polled every few seconds) → skip cache
 *   Contacts list, templates list                     → 30s
 *   Wallet balance, transactions                      → 20s
 *   Profile, sender numbers, org members              → 60s
 *   Billing subscription                              → 120s
 */

import type { Context } from "#/orpc/context";

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 4000;

interface Entry {
	expiresAt: number;
	value: unknown;
}

// Module-level singleton — survives across requests in the same Node process.
const store = new Map<string, Entry>();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function stableJson(v: unknown): string {
	return JSON.stringify(v, (_k, val) =>
		val !== null && typeof val === "object" && !Array.isArray(val)
			? Object.fromEntries(Object.entries(val as object).sort())
			: val
	);
}

function cacheKey(userId: string, name: string, input: unknown): string {
	return `${userId}:${name}:${stableJson(input)}`;
}

function cacheGet(key: string): unknown | undefined {
	const e = store.get(key);
	if (!e) {
		return undefined;
	}
	if (e.expiresAt <= Date.now()) {
		store.delete(key);
		return undefined;
	}
	// Promote to tail (most-recently-used) — re-inserting moves key to end of Map
	store.delete(key);
	store.set(key, e);
	return e.value;
}

function cacheSet(key: string, value: unknown, ttlMs: number): void {
	// Evict oldest (head) entry when at capacity
	if (store.size >= MAX_ENTRIES) {
		const oldest = store.keys().next().value;
		if (oldest !== undefined) {
			store.delete(oldest);
		}
	}
	store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Lazy cleanup — sweep expired entries when store is 80%+ full
function maybePurgeExpired(): void {
	if (store.size < MAX_ENTRIES * 0.8) {
		return;
	}
	const now = Date.now();
	for (const [key, entry] of store) {
		if (entry.expiresAt <= now) {
			store.delete(key);
		}
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Invalidate cached results for a procedure.
 *
 * @param userId        The user whose cache to clear.
 * @param procedureName Dot-path name used in withCache (e.g. "contacts.list").
 * @param exactInput    Optional — if provided, only the entry for this specific
 *                      input is invalidated. If omitted, ALL inputs are cleared.
 *
 * @example
 *   // After creating a contact:
 *   invalidate(userId, "contacts.list")
 *
 *   // After updating profile:
 *   invalidate(userId, "profile.get")
 */
export function invalidate(
	userId: string,
	procedureName: string,
	exactInput?: unknown
): void {
	if (exactInput !== undefined) {
		store.delete(cacheKey(userId, procedureName, exactInput));
		return;
	}
	const prefix = `${userId}:${procedureName}:`;
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) {
			store.delete(key);
		}
	}
}

/**
 * Invalidate all cached data for a user. Call on logout or account delete.
 */
export function invalidateUser(userId: string): void {
	const prefix = `${userId}:`;
	for (const key of store.keys()) {
		if (key.startsWith(prefix)) {
			store.delete(key);
		}
	}
}

/**
 * Invalidate multiple procedure caches in one call.
 *
 * @example
 *   invalidateMany(userId, ["contacts.list", "contacts.getDuplicates"])
 */
export function invalidateMany(userId: string, names: string[]): void {
	for (const name of names) {
		invalidate(userId, name);
	}
}

/**
 * Wrap an oRPC handler with result caching.
 *
 * The first call for a given (userId, input) combination hits the database and
 * stores the result. Subsequent identical calls within `ttlMs` return the
 * cached value without touching the database.
 *
 * Type-safe: the returned function matches oRPC's handler signature exactly,
 * so it can be passed directly to `.handler(...)`.
 *
 * @param name   Unique dot-path identifier for this procedure (used as cache key prefix).
 * @param ttlMs  How long to cache the result in milliseconds.
 * @param fn     The actual handler function.
 *
 * @example
 *   .handler(withCache("contacts.list", 30_000, async ({ input, context }) => { ... }))
 */
export function withCache<TInput, TOutput>(
	name: string,
	ttlMs: number,
	fn: (opts: { input: TInput; context: Context }) => Promise<TOutput>
): (opts: { input: TInput; context: Context }) => Promise<TOutput> {
	return async ({ input, context }) => {
		const userId = context?.session?.user?.id as string | undefined;

		// No user session → bypass cache (shouldn't happen on protectedProcedure)
		if (!userId) {
			return fn({ input, context });
		}

		const key = cacheKey(userId, name, input);
		const hit = cacheGet(key);
		if (hit !== undefined) {
			return hit as TOutput;
		}

		maybePurgeExpired();

		const result = await fn({ input, context });
		cacheSet(key, result, ttlMs);
		return result;
	};
}

// ─── Debug helpers (dev only) ─────────────────────────────────────────────────

/** Returns current cache stats — useful for logging/monitoring. */
export function cacheStats() {
	const now = Date.now();
	let expired = 0;
	for (const e of store.values()) {
		if (e.expiresAt <= now) {
			expired++;
		}
	}
	return {
		size: store.size,
		expired,
		live: store.size - expired,
		max: MAX_ENTRIES,
	};
}
