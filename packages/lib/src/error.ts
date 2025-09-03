/**
 * Attempt is a basic result type, returned by repository methods.
 * Unlike Result, it always returns a value, but an error may be present.
 * This is useful for still returning data on bulk operations, where a page can still be loaded with partial information (such as when hitting a rate limit).
 */

export enum AttemptStatus {
	Ok = 0,
	Partial = 1,
	Failure = 2,
}

// helper: recurse into nested data
type FlatData<A> = A extends Attempt<infer Inner, AttemptStatus> ? FlatData<Inner> : A;

// helper: pick the higher of two statuses
type HighestStatus<A extends AttemptStatus, B extends AttemptStatus> = A extends AttemptStatus.Failure
	? AttemptStatus.Failure
	: B extends AttemptStatus.Failure
		? AttemptStatus.Failure
		: A extends AttemptStatus.Partial
			? AttemptStatus.Partial
			: B extends AttemptStatus.Partial
				? AttemptStatus.Partial
				: AttemptStatus.Ok;

// helper: recurse into nested Attempts to find the highest status
type FlatStatus<A> = A extends Attempt<infer Inner, infer S>
	? Inner extends Attempt<unknown, AttemptStatus>
		? HighestStatus<S, FlatStatus<Inner>>
		: S
	: AttemptStatus.Ok;

// new FlatAttempt that flattens data and accumulates highest status
type FlatAttempt<A> = Attempt<FlatData<A>, FlatStatus<A>>;

export class Attempt<T, S extends AttemptStatus = AttemptStatus> {
	readonly status: S;
	readonly data: S extends AttemptStatus.Failure ? null : T;
	readonly error: S extends AttemptStatus.Ok ? null : Error;

	constructor(
		status: S,
		data: S extends AttemptStatus.Failure ? null : T,
		error: S extends AttemptStatus.Ok ? null : Error,
	) {
		this.status = status;
		this.data = data;
		this.error = error;
	}

	static from<U>(data: U, error: null): Attempt<U, AttemptStatus.Ok>;
	static from<U>(data: U, error: Error): Attempt<U, AttemptStatus.Partial>;
	static from<U>(data: null, error: Error): Attempt<U, AttemptStatus.Failure>;
	static from<U>(data: U, error: Error | null): Attempt<U, AttemptStatus.Ok | AttemptStatus.Partial>;
	static from<U>(data: U | null, error: Error): Attempt<U, AttemptStatus.Partial | AttemptStatus.Failure>;
	static from<U>(data: U | null, error: Error | null = null): Attempt<U, AttemptStatus> {
		if (error === null) {
			return Attempt.ok(data as U);
		}
		if (data !== null && error !== null) {
			return Attempt.partial(data, error);
		}
		return Attempt.fail(error);
	}

	/** Full success */
	static ok<U>(data: U): Attempt<U, AttemptStatus.Ok> {
		return new Attempt<U, AttemptStatus.Ok>(AttemptStatus.Ok, data, null);
	}

	/** Partial success: you get `data` but also an `error` */
	static partial<U>(data: U, error: Error): Attempt<U, AttemptStatus.Partial> {
		return new Attempt<U, AttemptStatus.Partial>(AttemptStatus.Partial, data, error);
	}

	/** Full failure: no meaningful data */
	static fail<U>(error: Error): Attempt<U, AttemptStatus.Failure> {
		// we have to satisfy the T slot; `null as any` is a necessary sacrifice
		return new Attempt<U, AttemptStatus.Failure>(AttemptStatus.Failure, null, error);
	}

	/** true if the Attempt is a full success */
	isOk(): this is Attempt<T, AttemptStatus.Ok> {
		return this.error === null;
	}

	/** true if the Attempt is a partial success */
	isPartial(): this is Attempt<T, AttemptStatus.Partial> {
		return this.status === AttemptStatus.Partial;
	}

	/** true if the Attempt is a full failure */
	isFailure(): this is Attempt<T, AttemptStatus.Failure> {
		return this.status === AttemptStatus.Failure;
	}

	/** true if there _was_ an error (partial or full) */
	isError(): this is Attempt<T, AttemptStatus.Partial | AttemptStatus.Failure> {
		return !this.isOk();
	}

	hasData(): this is Attempt<T, AttemptStatus.Ok | AttemptStatus.Partial> {
		return this.status !== AttemptStatus.Failure;
	}

	/**
	 * If the Attempt is successful, returns the data.
	 * If it is an error, throws the error.
	 */
	unwrap() {
		if (this.status !== AttemptStatus.Ok) throw this.error;

		return this.data;
	}

	/**
	 * If there is data, returns it.
	 * If there is no data, throws the error.
	 */
	partialUnwrap(): T | null {
		if (this.status === AttemptStatus.Failure) throw this.error;

		return this.data;
	}
	/**
	 * Maps the data of the Attempt to a new value.
	 * If the Attempt is an error, the error is preserved.
	 * This is useful for carrying forward errors while transforming data.
	 */
	map<U>(fn: (data: T) => U): Attempt<U, S> {
		const newData = fn(this.data as T);
		const newError = this.error as Error;
		switch (this.status) {
			case AttemptStatus.Ok:
				// Preserve Ok status for successful mapping
				return Attempt.ok(newData) as Attempt<U, S>;
			case AttemptStatus.Partial:
				// Preserve Partial status and error
				return Attempt.partial(newData, newError) as Attempt<U, S>;
			case AttemptStatus.Failure:
				// Preserve Failure status and error
				return Attempt.fail<U>(newError) as Attempt<U, S>;
		}
	}

	/**
	 * Helper method to combine two Attempts, preserving the highest status
	 */
	private combineWith<U, S extends AttemptStatus>(
		result: Attempt<U, S>,
	): Attempt<U, HighestStatus<this["status"], S>> {
		// If this is Ok, just return the result
		if (this.status === AttemptStatus.Ok) {
			return result as unknown as Attempt<U, HighestStatus<this["status"], S>>;
		}

		// this.status is Partial, combine with result
		if (result.isFailure()) {
			return Attempt.fail<U>(result.error as Error) as unknown as Attempt<U, HighestStatus<this["status"], S>>;
		}

		if (result.isPartial()) {
			return Attempt.partial(result.data as U, result.error as Error) as unknown as Attempt<
				U,
				HighestStatus<this["status"], S>
			>;
		}

		// result is Ok, but this is Partial, so return Partial with result's data and this error
		return Attempt.partial(result.data as U, this.error as Error) as unknown as Attempt<
			U,
			HighestStatus<this["status"], S>
		>;
	}

	/**
	 * Chains the Attempt with a function that returns another Attempt.
	 * If the first attempt is a failure, the second function is not called and the error is preserved.
	 */
	chain<U, S extends AttemptStatus>(fn: (data: T) => Attempt<U, S>): Attempt<U, HighestStatus<this["status"], S>> {
		if (this.status === AttemptStatus.Failure) {
			return Attempt.fail<U>(this.error as Error) as unknown as Attempt<U, HighestStatus<this["status"], S>>;
		}

		const result = fn(this.data as T);
		return this.combineWith(result);
	}

	/** Same as `chain`, but for asynchronous functions */
	async chainAsync<U, S extends AttemptStatus>(
		fn: (data: T) => PromiseLike<Attempt<U, S>>,
	): Promise<Attempt<U, HighestStatus<this["status"], S>>> {
		if (this.status === AttemptStatus.Failure) {
			return Attempt.fail<U>(this.error as Error) as unknown as Attempt<U, HighestStatus<this["status"], S>>;
		}

		const result = await fn(this.data as T);
		return this.combineWith(result);
	}

	/**
	 * Combines this Attempt with another Attempt, returning a new Attempt with the final value.
	 * If either Attempt is a failure, the result is a failure.
	 * If both are partial, the result is a partial with the error from this Attempt.
	 */
	and<U>(other: Attempt<U, AttemptStatus>) {
		const thisError = this.error as Error;
		const otherError = other.error as Error;
		const otherData = other.data as U;

		if (this.isOk()) {
			return other;
		}
		if (this.isPartial()) {
			if (other.isOk()) {
				return Attempt.partial(otherData, thisError);
			}
			if (other.isPartial()) {
				return Attempt.partial(otherData, thisError); // Use thisError, not otherError
			}
			return Attempt.fail<U>(otherError);
		}
		return Attempt.fail<U>(thisError);
	}

	/**
	 * Combines this Attempt with another Attempt, returning a new Attempt with the final value.
	 * If this is Ok, returns this. If this fails but other succeeds, returns other.
	 * If both are partial, the result is a partial with other's data and other's error.
	 * If either Attempt is a failure, the result is a failure.
	 */
	or<U>(other: Attempt<U, AttemptStatus>): Attempt<T | U, AttemptStatus> {
		const thisError = this.error as Error;
		const otherError = other.error as Error;
		const thisData = this.data as T;
		const otherData = other.data as U;

		switch (this.status) {
			case AttemptStatus.Partial:
				if (other.isOk()) {
					return Attempt.partial(otherData, thisError);
				}
				if (other.isPartial()) {
					return Attempt.partial(otherData, otherError);
				}
				return Attempt.fail<U>(otherError);
			case AttemptStatus.Ok:
				switch (other.status) {
					case AttemptStatus.Failure:
						return Attempt.fail<T>(otherError);
					case AttemptStatus.Partial:
						return Attempt.partial(otherData, otherError);
					case AttemptStatus.Ok:
						return Attempt.ok(thisData);
				}
		}

		return Attempt.fail<U>(thisError);
	}

	/**
	 * Flattens nested Attempts into a single Attempt.
	 * If data isn’t an Attempt, returns itself unchanged.
	 * The error is the first error encountered.
	 */
	flat<A, D extends number = 1>(this: A, depth?: D): FlatAttempt<A> {
		// no-op if asked to flatten 0 levels
		if (depth === 0) return this as unknown as FlatAttempt<A>;

		const flattenAll = depth === undefined;
		let remaining = depth ?? 0;

		// start from the outer Attempt
		let status = (this as unknown as Attempt<unknown, AttemptStatus>).status;
		let data = (this as unknown as Attempt<unknown, AttemptStatus>).data;
		let error = (this as unknown as Attempt<unknown, AttemptStatus>).error;

		// peel off nested Attempts
		while ((flattenAll || remaining > 0) && data instanceof Attempt) {
			const inner = data as Attempt<unknown, AttemptStatus>;

			// pick highest status
			if (status === AttemptStatus.Failure || inner.status === AttemptStatus.Failure) {
				status = AttemptStatus.Failure;
			} else if (status === AttemptStatus.Partial || inner.status === AttemptStatus.Partial) {
				status = AttemptStatus.Partial;
			} else {
				status = AttemptStatus.Ok;
			}

			// first non-null error
			if (error === null && inner.error !== null) {
				error = inner.error;
			}

			data = inner.data;
			if (!flattenAll) remaining--;
		}

		// rebuild a single Attempt
		if (status === AttemptStatus.Ok) {
			return Attempt.ok(data) as FlatAttempt<A>;
		}
		if (status === AttemptStatus.Partial) {
			return Attempt.partial(data, error as Error) as FlatAttempt<A>;
		}
		return Attempt.fail(error as Error) as FlatAttempt<A>;
	}

	/**
	 * Run a function that may throw an error, capturing the error in an Attempt.
	 */
	static async try<T>(fn: () => Promise<T>): Promise<Attempt<T, AttemptStatus>>;
	static try<T>(fn: () => T): Attempt<T, AttemptStatus>;
	static try<T>(fn: () => T | Promise<T>): Attempt<T, AttemptStatus> | Promise<Attempt<T, AttemptStatus>> {
		try {
			const result = fn();
			if (result instanceof Promise) {
				return result.then((r) => Attempt.ok(r)).catch((err) => Attempt.fail<T>(err as Error));
			}
			return Attempt.ok(result);
		} catch (err) {
			return Attempt.fail<T>(err as Error);
		}
	}

	/**
	 * Run multiple Promises in parallel, aggregating their results into a single Attempt.
	 * If passed a tuple, preserves tuple shape; otherwise returns an array.
	 */
	static async all<const T extends readonly (PromiseLike<unknown> | unknown)[]>(
		values: readonly [...T],
	): Promise<
		| Attempt<{ [K in keyof T]: Awaited<T[K]> }, AttemptStatus.Ok>
		| Attempt<{ [K in keyof T]: Awaited<T[K]> | undefined }, AttemptStatus.Partial>
	>;
	static async all<T>(
		values: Iterable<T | PromiseLike<T>>,
	): Promise<Attempt<Awaited<T>[], AttemptStatus.Ok> | Attempt<(Awaited<T> | undefined)[], AttemptStatus.Partial>>;
	static async all(values: Iterable<unknown | PromiseLike<unknown>>): Promise<Attempt<unknown[], AttemptStatus>> {
		const arr = Array.isArray(values) ? values : Array.from(values);
		const results = await Promise.allSettled(arr);
		const data = results.map((r) => (r.status === "fulfilled" ? r.value : undefined));
		const firstErr = results.find((r) => r.status === "rejected")?.reason;

		return Attempt.from(data, (firstErr as Error) ?? null);
	}
}
