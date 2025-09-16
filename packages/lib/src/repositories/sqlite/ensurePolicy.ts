/**
 * EnsurePolicy controls bounded ensure work for unlocked_at sorting.
 *
 * The unlocked_at path prefers a "direct-first" strategy: execute the page's DB-limited select immediately,
 * then ensure only what the page likely needs, scoped to recently played apps. This avoids large bursts that
 * can cause memory spikes. Micro-batching rows and yielding between flushes keeps the event loop responsive
 * and allows the global fetch limiter to interleave other work smoothly.
 */
export interface EnsurePolicy {
	mode: "unlocked_at" | "default";
	caps: {
		/** Maximum number of apps to process per request */
		maxAppsPerRequest: number;
		/** Maximum rows per flush (safeInsert) micro-batch */
		maxRowsPerFlush: number;
	};
	/** If true, run the direct DB-limited select first, then ensure only what the page needs */
	preferDirectFirst: boolean;
	/**
	 * How many recent owned_games to consider as ensure candidates (ordered by last_played_at DESC).
	 * Note: an index on (user_id, last_played_at DESC) is recommended; handled in a separate migration.
	 */
	candidateWindowFromOwned: number;
}

/**
 * Default EnsurePolicy for unlocked_at. Hardcoded defaults (no env dependency).
 *
 * Defaults chosen to:
 * - maxAppsPerRequest=24 to bound cross-app fanout
 * - maxRowsPerFlush=150 to keep SQLite parameter counts and memory stable
 * - candidateWindowFromOwned=64 to consider recent activity without exploding scope
 * - preferDirectFirst=true to return the current page ASAP, then backfill what it needs
 */
export function defaultUnlockedAtEnsurePolicy(): EnsurePolicy {
	const maxAppsPerRequest = 24;
	const maxRowsPerFlush = 150;
	const candidateWindowFromOwned = 64;

	return {
		mode: "unlocked_at",
		caps: { maxAppsPerRequest, maxRowsPerFlush },
		preferDirectFirst: true,
		candidateWindowFromOwned,
	};
}

/**
 * Minimal default policy placeholder for non-unlocked_at paths.
 * These numbers are intentionally higher since comprehensive paths
 * already bound themselves differently (and they are not activated for unlocked_at).
 */
export function defaultEnsurePolicy(): EnsurePolicy {
	return {
		mode: "default",
		caps: {
			maxAppsPerRequest: 512,
			maxRowsPerFlush: 500,
		},
		preferDirectFirst: false,
		candidateWindowFromOwned: 256,
	};
}
