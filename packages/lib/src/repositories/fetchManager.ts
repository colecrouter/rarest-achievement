/**
 * Configuration for the fetch manager
 */
export interface FetchManagerConfig {
	/** Maximum fetch requests allowed per request lifecycle (default: 800 for safety margin) */
	maxFetches: number;
}

/**
 * Manages fetch requests to prevent hitting Cloudflare's 1000 fetch limit.
 *
 * Key Features:
 * - Request counting with configurable limits (default: 800 for safety)
 * - AbortController integration for cancelling in-flight requests
 * - Consecutive failure detection with automatic early stopping
 *
 * Critical for Cloudflare Workers/Pages: Fetch requests count against quota
 * when initiated (not when completed), so early termination is essential.
 */
export class FetchManager {
	public static readonly MAX_FETCHES = 800; // Conservative limit to stay under Cloudflare's 1000
	private static readonly WARNING_THRESHOLD_FACTOR = 0.8;

	private subCount = 0;
	private totalCount = 0;
	private subConfig?: FetchManagerConfig;
	private readonly startTime = Date.now();
	private readonly abortController = new AbortController();

	/**
	 * Reset the fetch counter & apply a new configuration
	 */
	reset(config: FetchManagerConfig): void {
		this.subCount = 0;
		// Note: totalCount is intentionally not reset as it tracks global usage
		this.subConfig = config;
	}

	/**
	 * Get current fetch count
	 */
	get fetchCount(): number {
		return this.subCount;
	}

	/**
	 * Get total fetch count across all operations
	 */
	get totalFetchCount(): number {
		return this.totalCount;
	}

	/**
	 * Get remaining fetch requests before hitting limit
	 */
	get remainingFetches(): number {
		return Math.min(
			// Global limit
			FetchManager.MAX_FETCHES - this.totalCount,
			// Config limit
			(this.subConfig?.maxFetches ?? FetchManager.MAX_FETCHES) - this.subCount,
		);
	}

	/**
	 * Check if we're at or near the fetch limit
	 */
	isNearLimit(): boolean {
		return (
			this.subCount >=
			Math.floor((this.subConfig?.maxFetches ?? FetchManager.MAX_FETCHES) * FetchManager.WARNING_THRESHOLD_FACTOR)
		);
	}

	/**
	 * Check if we've hit the fetch limit
	 */
	hasHitLimit(): boolean {
		const configLimit = this.subConfig?.maxFetches ?? FetchManager.MAX_FETCHES;
		const hitSubLimit = this.subCount >= configLimit;
		const hitGlobalLimit = this.totalCount >= FetchManager.MAX_FETCHES;

		if (hitSubLimit || hitGlobalLimit) {
			// Auto-abort when limit is hit
			if (!this.isAborted()) {
				const reason = hitGlobalLimit
					? `Global fetch limit exceeded: ${this.totalCount}/${FetchManager.MAX_FETCHES}`
					: `Config fetch limit exceeded: ${this.subCount}/${configLimit}`;
				this.abort(reason);
			}
			return true;
		}

		return false;
	}

	/**
	 * Check if the operation has been aborted
	 */
	isAborted(): boolean {
		return this.abortController.signal.aborted;
	}

	/**
	 * Abort all ongoing operations
	 */
	private abort(reason?: string): void {
		console.debug(`🛑 FetchManager: Aborting operations - ${reason || "Manual abort"}`);
		this.abortController.abort(reason);
	}

	/**
	 * Get the abort signal for use in fetch operations
	 */
	get abortSignal(): AbortSignal {
		return this.abortController.signal;
	}

	/**
	 * Get the current configuration
	 */
	get config() {
		return this.subConfig;
	}

	/**
	 * Increment the fetch counter (for external use, e.g., in handleFetch hook)
	 */
	incrementFetchCount(): void {
		this.subCount++;
		this.totalCount++;
	}

	/**
	 * Log current fetch status
	 */
	logStatus(): void {
		const elapsed = Date.now() - this.startTime;
		const remaining = this.remainingFetches;
		const configLimit = this.subConfig?.maxFetches ?? FetchManager.MAX_FETCHES;

		if (this.isNearLimit()) {
			console.debug(
				`⚠️ FetchManager: ${this.subCount}/${configLimit} fetches used (total: ${this.totalCount}/${FetchManager.MAX_FETCHES}, ${remaining} remaining, ${elapsed}ms elapsed)`,
			);
		} else {
			console.debug(
				`📊 FetchManager: ${this.subCount}/${configLimit} fetches used (total: ${this.totalCount}/${FetchManager.MAX_FETCHES}, ${remaining} remaining, ${elapsed}ms elapsed)`,
			);
		}
	}

	/**
	 * Get a summary of fetch usage for logging/debugging
	 */
	getSummary(): {
		used: number;
		total: number;
		totalUsed: number;
		remaining: number;
		percentUsed: number;
		isNearLimit: boolean;
		hasHitLimit: boolean;
		elapsedMs: number;
	} {
		const used = this.subCount;
		const total = this.subConfig?.maxFetches ?? FetchManager.MAX_FETCHES;
		const remaining = this.remainingFetches;
		const percentUsed = (used / total) * 100;

		return {
			used,
			total,
			totalUsed: this.totalCount,
			remaining,
			percentUsed,
			isNearLimit: this.isNearLimit(),
			hasHitLimit: this.hasHitLimit(),
			elapsedMs: Date.now() - this.startTime,
		};
	}
}

// Global fetch manager instance for request-scoped usage
let globalFetchManager: FetchManager | null = null;

/**
 * Get the global fetch manager instance
 * Creates a new one if none exists
 */
export function getFetchManager(): FetchManager {
	if (!globalFetchManager) {
		globalFetchManager = new FetchManager();
	}
	return globalFetchManager;
}

/**
 * Set a new global fetch manager (useful for request context initialization)
 */
export function setFetchManager(manager: FetchManager): void {
	globalFetchManager = manager;
}
