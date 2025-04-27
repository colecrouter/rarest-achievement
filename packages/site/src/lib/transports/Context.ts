// biome-ignore lint/suspicious/noExplicitAny: using any here to get string | number | symbol
type Key = keyof any;

export interface Encodable {
    id: Key;
}

/**
 * A generic abstract class for deduplication of objects during
 * serialization. T is the type being deduplicated and Encoded is the
 * object representation.
 */
export abstract class DeduplicationContext<Class extends Encodable, Params extends [Key, ...unknown[]]> {
    /** The encodeCache is a WeakMap that maps the object to its constructor parameters. */
    protected encodeCache = new WeakMap<Class, Params>();
    /** The decodeCache is a Map that maps the serial number to the object. */
    protected decodeCache = new Map<Key, Class>();

    /**
     * Called by the transport when it wishes to encode an instance.
     * Returns an array containing the unique serial number.
     */
    public encode(value: Class): Params {
        const existing = this.encodeCache.get(value);
        if (existing) {
            return existing;
        }
        const encoded = this.encodeValue(value);
        this.encodeCache.set(value, encoded);
        return encoded;
    }

    /**
     * Called by the transport to decode an instance based on the id;
     */
    public decode(encoded: Params): Class {
        const existing = this.decodeCache.get(encoded[0]);
        if (existing) {
            return existing;
        }
        const decoded = this.decodeValue(encoded);
        this.decodeCache.set(decoded.id, decoded);
        return decoded;
    }

    /**
     * Clear the caches. Typically called at the start of each request.
     */
    public reset(): void {
        this.encodeCache = new WeakMap();
        this.decodeCache = new Map();
    }

    /**
     * Convert the value to its serialized form.
     * Must be implemented by subclasses.
     */
    protected abstract encodeValue(value: Class): Params;

    /**
     * Convert the serialized form back into an instance.
     * Must be implemented by subclasses.
     */
    protected abstract decodeValue(encoded: Params): Class;
}
