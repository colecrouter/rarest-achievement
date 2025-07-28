/**
 * Limiter class to manage concurrent operations with a limit.
 * @example
 * const limiter = new Limiter(5);
 * await limiter.wait(); // Waits if count is at limit, otherwise increments count
 * // Perform operation
 * limiter.done(); // Call when operation is complete to decrement count or resolve waiting promises
 */
export class Limiter {
    private count = 0;
    private resolvers = new Array<() => void>();

    constructor(private readonly limit: number) {}

    /**
     * Waits until the count is below the limit before proceeding.
     * If the limit is reached, it returns a promise that resolves when space is available.
     */
    public async wait() {
        if (this.count < this.limit) {
            this.count++;
        } else {
            return new Promise<void>((resolve) => {
                this.resolvers.push(resolve);
            });
        }
    }

    /**
     * Call this method when an operation is complete to decrement the count
     * or resolve any waiting promises.
     */
    public done() {
        if (this.resolvers.length > 0) {
            const resolve = this.resolvers.shift();
            if (resolve) {
                resolve();
            }
        } else {
            this.count--;
        }
    }
}
