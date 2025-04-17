/**
 * Errable is a basic result type, returned by repository methods.
 * Unlike Result, it always returns a value, but an error may be present.
 * This is useful for still returning data on bulk operations, where a page can still be loaded with partial information (such as when hitting a rate limit).
 */
export class Errable<T> {
    data: T;
    error: Error | null;

    constructor(data: T, error: Error | null) {
        this.data = data;
        this.error = error;
    }

    static try<U>(fn: () => Promise<U>): Promise<Errable<U>>;
    static try<U>(fn: () => U): Errable<U>;
    static try(fn: () => unknown): unknown {
        try {
            const result = fn();
            if (result instanceof Promise) {
                return result.then((r) => new Errable(r, null));
            }
            return new Errable(result, null);
        } catch (error) {
            return new Errable(null as unknown, error as Error);
        }
    }
}
