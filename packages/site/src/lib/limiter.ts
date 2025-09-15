/**
 * Limiter class to manage concurrent operations with a limit.
 * @example
 * const limiter = new Limiter(5);
 * await limiter.wait(); // Waits if count is at limit, otherwise increments count
 * // Perform operation
 * limiter.done(); // Call when operation is complete to decrement count or resolve waiting promises
 */
export class Limiter {
	private active = 0;
	private waiting: Array<() => void> = [];

	constructor(private readonly limit: number) {}

	/**
	 * Waits until the count is below the limit before proceeding.
	 * If the limit is reached, it returns a promise that resolves when space is available.
	 */
	public async wait(): Promise<void> {
		// If we’re under limit, take a slot immediately.
		if (this.active < this.limit) {
			this.active++;
			return;
		}
		// Otherwise enqueue and wait for a slot.
		await new Promise<void>((resolve) => {
			this.waiting.push(resolve);
		});
		// When we’re unblocked, we must take the slot!
		this.active++;
	}

	/**
	 * Call this method when an operation is complete to decrement the count
	 * or resolve any waiting promises.
	 */
	public done(): void {
		// One operation freed up.
		this.active--;
		// If anyone’s waiting, unblock exactly one of them.
		if (this.waiting.length > 0) {
			const resolve = this.waiting.shift();
			resolve?.();
		}
	}
}
