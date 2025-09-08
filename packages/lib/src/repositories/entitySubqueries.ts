import { type AnyColumn, eq, exists, type SQL } from "drizzle-orm";
import type { SubqueryWithSelection, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import type { ProjectDB } from "..";

// Pre-alias Drizzle subquery wrappers per entity. Use structural shapes with unknown to avoid 'any'.
type AppsSub =
	| WithSubqueryWithSelection<{ app_id: unknown }, string>
	| SubqueryWithSelection<{ app_id: unknown }, string>;
type UserSub = WithSubqueryWithSelection<{ id: unknown }, string> | SubqueryWithSelection<{ id: unknown }, string>;
type AchSub =
	| WithSubqueryWithSelection<{ ach_id: unknown }, string>
	| SubqueryWithSelection<{ ach_id: unknown }, string>;

type RequiredEntitySubqueryMap = {
	app: AppsSub;
	user: UserSub;
	ach: AchSub;
};

export type RequiredEntityType = keyof RequiredEntitySubqueryMap;

export type RequiredEntity<K extends RequiredEntityType> = RequiredEntitySubqueryMap[K];

export abstract class RequiredEntityStore<K extends RequiredEntityType> {
	protected whereConditions: SQL[] = [];
	protected dbRef: ProjectDB;

	private entityColumns = new Map<K, AnyColumn>();
	/** Persist original subqueries so downstream logic (ensure flows, dependency repos) can reuse them. */
	private providedSubqueries = new Map<
		RequiredEntityType,
		RequiredEntitySubqueryMap[keyof RequiredEntitySubqueryMap]
	>();

	private static propMap: Record<RequiredEntityType, string> = { app: "app_id", user: "id", ach: "ach_id" };

	/**
	 * @param db Drizzle database instance.
	 * @param entityColumns Mapping of canonical entity type -> table column. Omit unsupported entities.
	 */
	constructor(db: ProjectDB, entityColumns: Record<K, AnyColumn>) {
		this.dbRef = db;
		this.entityColumns = new Map();
		for (const [key, col] of Object.entries(entityColumns) as Array<[K, AnyColumn | undefined]>) {
			if (col) this.entityColumns.set(key, col);
		}
	}

	/**
	 * Register a required-entity subquery. Adds an EXISTS(...) predicate correlating the entity's primary column
	 * and stores the subquery for later retrieval (e.g. to feed into dependent repositories' ensure logic).
	 */
	withRequiredEntitySubquery(t: K, sub: RequiredEntitySubqueryMap[K]): this {
		const tableCol = this.entityColumns.get(t);
		if (!tableCol) throw new Error(`Entity column for type ${t} not bound.`);
		this.providedSubqueries.set(t, sub as RequiredEntitySubqueryMap[keyof RequiredEntitySubqueryMap]);
		const subqueryCol = sub[RequiredEntityStore.propMap[t] as keyof typeof sub] as AnyColumn;
		if (!subqueryCol) throw new Error(`Subquery does not have expected column for type ${t}.`);
		this.whereConditions.push(exists(this.dbRef.select().from(sub).where(eq(subqueryCol, tableCol))));
		return this;
	}

	/** Retrieve the original subquery provided for an entity (if any). */
	protected getRequiredEntitySubquery(t: K): RequiredEntitySubqueryMap[K] | undefined {
		return this.providedSubqueries.get(t) as RequiredEntitySubqueryMap[K] | undefined;
	}
}
