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

    static try<U>(fn: (setError: (e: Error) => void) => Promise<U>): Promise<Errable<U | null>>;
    static try<U>(fn: (setError: (e: Error) => void) => U): Errable<U | null>;
    static try(fn: (setError: (e: Error) => void) => unknown): unknown {
        let manualError: Error | null = null;
        const setError = (e: Error) => {
            manualError = e;
        };

        try {
            const result = fn(setError);
            if (result instanceof Promise) {
                return result
                    .then((r) => new Errable(r, manualError))
                    .catch((error) => new Errable(null as unknown, error as Error));
            }
            return new Errable(result, manualError);
        } catch (error) {
            return new Errable(null as unknown, error as Error);
        }
    }
}
