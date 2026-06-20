# Effect Port Specification for `packages/lib`

This document scopes a future port of `packages/lib` to [Effect](https://effect.website/). It is intentionally a planning artifact: it does not require the migration to happen all at once, and it should be updated as each slice lands.

## Goals

- Preserve the current public behavior of `@project/lib` while introducing Effect incrementally.
- Make external IO, database access, fetch budgeting, cache access, and AI calls explicit services.
- Replace ad hoc `try`/`catch`, singleton clients, and ambient globals with typed Effect errors, services, and layers where the benefit is clear.
- Move the repo away from `Attempt` as an internal abstraction. Keep it only as a compatibility adapter while callers still expect it.
- Keep Cloudflare Workers constraints front and center: bounded fetches, bounded memory, D1 parameter limits, and reliable partial-result behavior.

## Target Effect Architecture

Do not model every recoverable problem as an Effect failure. Effect's error channel should mean "this operation cannot return a valid result." Partial-but-usable data should be represented in the success value.

Target result shape:

```ts
export type Degradation =
	| { readonly _tag: "SteamApiUnavailable"; readonly endpoint: string; readonly cause: unknown }
	| { readonly _tag: "SteamApiMissingData"; readonly endpoint: string; readonly resource: string }
	| { readonly _tag: "FetchBudgetExceeded"; readonly used: number; readonly limit: number }
	| { readonly _tag: "MissingLocalization"; readonly requested: string; readonly fallback: string }
	| { readonly _tag: "PlayerEstimateUnavailable"; readonly appId: number; readonly cause: unknown }
	| { readonly _tag: "GuideSearchUnavailable"; readonly provider: "steamcommunity" | "youtube"; readonly cause: unknown }
	| { readonly _tag: "TranslationUnavailable"; readonly locale: string; readonly cause: unknown };

export interface QueryResult<T> {
	readonly data: readonly T[];
	readonly cursor: number;
	readonly degradations: readonly Degradation[];
}
```

Target Effect shapes:

```ts
export type RepositoryEffect<T> = Effect.Effect<
	QueryResult<T>,
	DbError | InvalidQueryError,
	ProjectDb | SteamApis | FetchBudget | CacheServices
>;

export type ApiEffect<T> = Effect.Effect<
	T,
	FetchError | HttpStatusError | DecodeError,
	FetchService | Config
>;
```

Implications:

- Steam/API failures usually become `Degradation` values when stale or partial database data can still produce a meaningful page.
- Steam/API failures become Effect failures only when the caller explicitly asked for fresh remote data and no valid result can be produced.
- SQLite, Drizzle, invalid query state, schema mismatch, and programmer errors should fail the Effect.
- Fetch budget exhaustion should usually be a degradation on the returned page, because existing behavior allows partial upserts/results under budget.
- `Attempt` should be implemented as an adapter over `QueryResult` while existing callers still expect `Ok`, `Partial`, and `Failure`.
- Long-lived dependencies should become services/layers: `ProjectDb`, `SteamAuthenticatedApi`, `SteamStoreApi`, `SteamChartsApi`, `SteamCommunityApi`, `TranslateApi`, `YouTubeApi`, `KVCache`, `CloudflareAi`, `FetchBudget`.
- Retry, timeout, and rate-limit behavior should be represented with `Schedule`, `Effect.timeout`, and service-level policies rather than scattered call-site logic.
- External response validation should eventually use `Schema` for Steam, Store, YouTube, Translate, and AI responses. The existing `.d.ts` files are type declarations only; they do not protect runtime parsing.

## Compatibility Mapping

`Attempt<T>` is a legacy public contract, not the target internal model.

- `QueryResult<T>` with no degradations maps to `Attempt.ok(data)`.
- `QueryResult<T>` with one or more degradations maps to `Attempt.partial(data, firstDegradationAsError)`.
- An Effect failure maps to `Attempt.fail(error)` only in Promise compatibility wrappers.
- `ComposableQueryResult<T>` and `RepositoryResult<T>` should eventually become compatibility wrappers around `QueryResult<T>`.

The compatibility layer should be narrow and explicit. New internal code should pass typed `Degradation` values instead of constructing `Error` objects just to signal partial success.

## Error Taxonomy

Use the Effect error channel for fatal failures:

- `DbError`: D1/SQLite/Drizzle execution failed, migration/schema assumptions are broken, or a database result cannot be interpreted safely.
- `InvalidQueryError`: a composer was built into an invalid state, received unsupported sort/filter input, or would violate a repository invariant.
- `DecodeError`: a required external response cannot be decoded and no cached/stale result can produce a valid answer.
- `ConfigurationError`: required API keys, bindings, or service configuration are absent.

Use `Degradation` values in successful results for recoverable incompleteness:

- Steam/Store/Charts/Community endpoint failed but cached or database-backed data can still be returned.
- Steam returned private/missing data in a way the current code treats as empty or nullable.
- Fetch budget was exhausted after some rows were fetched/upserted.
- Localized metadata fell back to English.
- Player estimates, guide search, translation, or AI relevance filtering failed without invalidating the primary page.

Rule of thumb: if the UI or worker can do useful work with the returned data, prefer a successful `QueryResult` with degradations. If continuing would hide corrupt state or return a misleading result, fail the Effect.

## Migration Order

1. Add Effect, `Degradation`, `QueryResult`, typed fatal errors, and `Attempt` adapters without changing repository behavior.
2. Convert API clients to Effect services while preserving Promise/class wrappers.
3. Convert cache-backed guide/translation repositories to return typed degradations for recoverable provider/cache/AI failures.
4. Convert `FetchManager` to a `FetchBudget` service backed by `Ref`/`AbortController` state.
5. Convert repository ensure/fetch paths so API failures append degradations instead of producing nested `Attempt` values.
6. Convert SQLite composers/repositories one at a time so `build()` returns `Effect<QueryResult<T>, DbError | InvalidQueryError, Deps>`.
7. Replace `ComposableQueryResult`, `RepositoryResult`, and `Attempt` use in internal repository code with `QueryResult`.
8. Replace `VaultService` constructor wiring with an Effect `Layer`.
9. Migrate `packages/site` and `packages/worker` callers to Effect-native APIs, then remove compatibility wrappers if no longer needed.

## Legacy Result Semantics To Preserve Through Adapters

`packages/lib/src/error.ts`

- `AttemptStatus` values and ordering: `Ok = 0`, `Partial = 1`, `Failure = 2`.
- `Attempt.from` overload behavior:
  - data plus `null` error is `Ok`.
  - data plus `Error` is `Partial`.
  - `null` data plus `Error` is `Failure`.
- `Attempt.ok`, `Attempt.partial`, `Attempt.fail`.
- Type guards: `isOk`, `isPartial`, `isFailure`, `isError`, `hasData`.
- `unwrap` throws on non-`Ok`; `partialUnwrap` throws only on `Failure`.
- `map` preserves status and error.
- `chain` and `chainAsync` short-circuit `Failure` and preserve the highest status.
- `and` and `or` have nonstandard error precedence rules tested in `packages/lib/src/error.spec.ts`.
- `flat` recursively combines nested attempts and keeps the first non-null error.
- `Attempt.try` captures thrown/rejected errors.
- `Attempt.all` uses `Promise.allSettled`, preserves tuple shape, stores `undefined` for rejected positions, and returns the first rejection as the error.

Effect migration note: these semantics are the compatibility contract. They should not drive the internal Effect design once `QueryResult` and `Degradation` exist.

## Files And Conversion Candidates

### Package Entrypoints

- `packages/lib/src/index.ts`
  - Re-exports `error`, `models`, `repositories`, and `userId`.
  - Preserve public exports while adding Effect-native exports behind new names or paths.
- `packages/lib/src/models/index.ts`
  - Re-exports model classes. Keep serialization compatibility.
- `packages/lib/src/repositories/index.ts`
  - Re-exports API clients, repository classes, schema, `FetchManager`, and language helpers.
  - This is a compatibility boundary; add Promise wrappers here if internals become Effect-native.

### Pure Utilities

- `packages/lib/src/date.ts`
  - `normalizeDigits`
  - `parseLocalizedDate`
  - Behavior to preserve: localized digit normalization, locale-specific parse patterns, invalid/missing date handling.
  - Effect fit: pure function; convert only if using `Option<Date>` or typed parse errors would clarify call sites.
- `packages/lib/src/lang.ts`
  - `Languages`
  - `getLanguageByAPICode`
  - `getLanguageByCode`
  - `getLanguageByName`
  - Behavior to preserve: undefined for unknown codes/names.
  - Effect fit: likely stays pure; optional adapters can return `Option`.
- `packages/lib/src/userId.ts`
  - `SteamIDUniverse`
  - `SteamIDType`
  - `SteamID`
  - `SteamID.toSteamID`
  - `resolveSteamID`
  - Behavior to preserve: Steam community URL parsing, decimal ID parsing, Steam2/Steam3 parsing, account ID parsing, vanity username support through `fetch`, and thrown errors for unsupported forms.
  - Effect fit: split pure parsing from vanity lookup; make vanity lookup depend on `FetchService`.
- `packages/lib/src/utils/timing.ts`
  - `generateTimingId`
  - Effect fit: pure/random-ish helper; leave as is or route through a `Random` service if deterministic tests become useful.

### Model Classes

- `packages/lib/src/models/SteamApp.ts`
  - `SteamApp`
  - getters: `id`, `name`, `icon`, `banner`, `developers`, `publishers`, `releaseDate`, `description`, `estimatedPlayers`, `language`
  - `serialize`
  - Behavior to preserve: unknown API language throws; coming-soon release date returns `null`; release dates use `parseLocalizedDate`.
- `packages/lib/src/models/SteamAppAchievement.ts`
  - `SteamAppAchievement`
  - getters: `id`, `name`, `iconUnlocked`, `iconLocked`, `icon`, `description`, `globalPercentage`, `globalCount`, `app`, `hidden`, `language`
  - `serialize`
  - Behavior to preserve: `globalCount` is `null` without `estimatedPlayers`; language resolution throws for unknown API code.
- `packages/lib/src/models/SteamUser.ts`
  - `SteamUser`
  - `SteamUserStatus`
  - getters: `id`, `displayName`, `avatar`, `profileUrl`, `lastLogOff`, `status`, `private`, `realName`, `created`, `lastLoggedIn`, `ownedApps`
  - `serialize`
  - Behavior to preserve: `ownedApps` maps raw owned games to `SteamOwnedGame`; missing optional raw fields return `undefined`.
- `packages/lib/src/models/SteamFriendUser.ts`
  - `SteamFriendUser`
  - Behavior to preserve: extends `SteamUser` while carrying friend relationship metadata.
- `packages/lib/src/models/SteamOwnedGame.ts`
  - `SteamOwnedGame`
  - Behavior to preserve: raw owned-game wrapper and serialization shape.
- `packages/lib/src/models/SteamSearchApp.ts`
  - `SteamSearchApp`
  - Behavior to preserve: mapping from Store search payload and `serialize` output.
- `packages/lib/src/models/SteamSearchUser.ts`
  - `SteamSearchUser`
  - Behavior to preserve: mapping from community search payload and `serialize` output.
- `packages/lib/src/models/SteamUserAchievement.ts`
  - `SteamUserAchievement`
  - getters: `user`, `unlocked`, `icon`
  - `serialize`
  - Behavior to preserve: unlocked date requires `achieved === 1` and nonzero `unlocktime`; locked achievements use locked icon.

Effect fit: models can remain plain classes. If converted, prefer `Data.Class` or `Schema.Class` only after deciding whether immutable structural data is worth the compatibility churn.

### API Client Base And Utilities

- `packages/lib/src/repositories/api/baseClient.ts`
  - `BaseSteamAPIClient.applyOptions`
  - `BaseSteamAPIClient.fetchJSON`
  - Behavior to preserve: arrays serialize as comma-separated query params; `undefined` is skipped; status `400`, `403`, and `404` return `null` only when `allowEmpty` is true; other non-OK responses throw with URL and status.
  - Effect fit: replace with `Effect.tryPromise`, typed `HttpStatusError`, optional `Schema.decodeUnknown`. API clients may fail because they are low-level remote calls; repositories decide whether those failures become degradations.
- `packages/lib/src/repositories/api/utils.ts`
  - `unescapeHTML`
  - Effect fit: pure utility.

### Steam/Store/Community API Clients

- `packages/lib/src/repositories/api/steampowered/client.ts`
  - `SteamAuthenticatedAPI`
  - `SteamAuthenticatedAPIClient`
  - `getFriendsList`
  - `getGlobalAchievementPercentagesForApp`
  - `getPlayerAchievements`
  - `getPlayerSummaries`
  - `getUserStatsForGame`
  - `getSchemaForGame`
  - `getOwnedGames`
  - Behavior to preserve: API key handling, documented private/missing responses, `allowEmpty` behavior, comma-joined `steamids`.
- `packages/lib/src/repositories/api/store/client.ts`
  - `SteamStoreAPI`
  - `SteamStoreAPIClient`
  - `getAppDetails`
  - `getAppReviews`
  - `searchApps`
  - Behavior to preserve: `appids` setting, `json=1` reviews query, encoded community search query.
- `packages/lib/src/repositories/api/steamcharts/client.ts`
  - `SteamChartsAPI`
  - `SteamChartsAPIClient.getAppChartData`
  - Behavior to preserve: null-on-empty/error status handling as currently implemented.
- `packages/lib/src/repositories/api/steamcommunity/client.ts`
  - `SteamCommunityAPI`
  - `SteamCommunityAPIClient.fetchArticles`
  - `SteamCommunityAPIClient.searchUsers`
  - Behavior to preserve: default page size/counts and scraping helpers.
- `packages/lib/src/repositories/api/steamcommunity/articles.ts`
  - `scrapeSteamCommunityArticles`
  - handler classes: `TitleHandler`, `AuthorHandler`, `DescriptionHandler`, `StarHandler`, `ThumbnailHandler`, `ArticleIDHandler`
  - Behavior to preserve: HTMLRewriter extraction, article IDs, thumbnails, star/rating metadata, language-specific guide search.
- `packages/lib/src/repositories/api/steamcommunity/users.ts`
  - `searchSteamCommunityUsers`
  - `getSessionID`
  - handler classes: `NameHandler`, `AvatarHandler`, `SessionIDHandler`, `CountHandler`
  - Behavior to preserve: session ID scraping, pagination, result count scraping, username/avatar mapping.
- `packages/lib/src/repositories/api/steamcommunity/htmlRewriterHelper.ts`
  - `getHTMLRewriter`
  - Behavior to preserve: Cloudflare/Node-compatible HTMLRewriter loading.
- `packages/lib/src/repositories/api/translate/client.ts`
  - `TranslateAPI`
  - `TranslateClient.translateText`
  - `TranslateClient.detectLanguage`
  - `TranslateClient.getSupportedLanguages`
  - Behavior to preserve: Google Translate request shape and API-key handling.
- `packages/lib/src/repositories/api/youtube/client.ts`
  - `YouTubeAPI`
  - `YouTubeClient.fetchVideos`
  - Behavior to preserve: query construction from app/achievement, locale, and `maxResults`.

Effect fit: these should become service interfaces with live layers. Keep current class exports as Promise wrappers until `packages/site` and `packages/worker` move.

### Cache And AI Repositories

- `packages/lib/src/repositories/api/steamcommunity/repo.ts`
  - `SteamCommunityRepo.searchGuides`
  - `SteamCommunityRepo.searchUsers`
  - Behavior to preserve: KV cache keys, 24-hour TTL, cached JSON parsing, successful cache hits, recoverable API/cache-write failures represented as degradations in new code and `Attempt.partial`/`Attempt.fail` through legacy wrappers.
- `packages/lib/src/repositories/api/youtube/repo.ts`
  - `YouTubeRepository.searchGuides`
  - `YouTubeGuide`
  - Behavior to preserve: KV cache key and cached degradation/error replay, HTML entity unescaping, Cloudflare AI model selection, prompt/output contract, boolean-array validation, 24-hour TTL, caching both data and recoverable failure metadata.
- `packages/lib/src/repositories/api/translate/repo.ts`
  - `TranslateRepository.translateAchievements`
  - Behavior to preserve: empty input returns empty `Map`, group-by-app caching, translation only for missing descriptions, cache writes only when dirty, translation failures are logged and do not throw, only existing translations are returned.

Effect fit: strong candidates for early conversion because they combine cache, external IO, and recoverable errors.

### Fetch Budgeting

- `packages/lib/src/repositories/fetchManager.ts`
  - `FetchManagerConfig`
  - `FetchManager`
  - methods/getters: `reset`, `fetchCount`, `totalFetchCount`, `remainingFetches`, `isNearLimit`, `hasHitLimit`, `isAborted`, `abortSignal`, `config`, `incrementFetchCount`, `logStatus`, `getSummary`
  - `getFetchManager`
  - `setFetchManager`
  - Behavior to preserve: default global limit `800`, warning threshold `0.8`, total count survives `reset`, remaining count is min of global and scoped limit, `hasHitLimit` auto-aborts, singleton override for tests/request setup.
  - Effect fit: replace singleton with `FetchBudget` service using `Ref` for counts and `Scope`/finalizers for abort lifecycle. Keep test helpers until site hooks are migrated.

### Repository Contracts And Composition

- `packages/lib/src/repositories/repository.ts`
  - `RepositorySort`
  - `RepositoryResult`
  - `Repository`
  - Behavior to preserve through adapters: cursor is next offset, any degradation maps to legacy partial result with a non-null error.
- `packages/lib/src/repositories/composable.ts`
  - `ComposableQuerySort`
  - `ComposableQueryOptions`
  - `ComposableQueryResult`
  - `QueryComposer`
  - `RequiredSubquery`
  - `SubqueryProvider`
  - `SubqueryConsumer`
  - `ComposableRepository`
  - `createQueryResult`
  - Behavior to preserve: `build()` converts recoverable Steam/API data-fetch errors into `Degradation` values, does not convert SQLite errors into degradations, `count()` preserves dual-storage ensure semantics, and CTE-based composition avoids parameter explosion.
- `packages/lib/src/repositories/entitySubqueries.ts`
  - `RequiredEntityStore`
  - `RequiredEntityType`
  - `RequiredEntity`
  - Behavior to preserve: repository dependency scopes are CTE/subquery based, not materialized unbounded arrays.

Effect fit: convert after API clients and result compatibility are stable. Query composers are stateful builders today; an Effect version can remain builder-style but should make execution return `Effect<QueryResult<T>, DbError | InvalidQueryError, Deps>`.

### SQLite Schema, Operators, And Helpers

- `packages/lib/src/repositories/sqlite/schema.ts`
  - tables: `users`, `apps`, `achievementsStats`, `achievementsMeta`, `userAchievements`, `ownedGames`, `friends`, `estimatedPlayers`, `userScores`
  - `ProjectDB`
  - Behavior to preserve: schema names and column types. Do not Effect-wrap schema declarations.
- `packages/lib/src/repositories/sqlite/operators.ts`
  - SQL helpers: `distinct`, `multiply`, `divide`, `add`, `subtract`, `concat`, `coalesce`, `excluded`, `max`, `now`, `jsonExtract`, `jsonArrayEach`, `upper`, `lower`, `glob`, `caseWhen`
  - internal classes: `CaseBuilder`, `CaseBuilderInit`
  - Behavior to preserve: Drizzle SQL typing, aliases, JSON path construction, SQLite timestamp expressions, conflict `excluded()` references.
  - Effect fit: keep pure. Do not wrap SQL expression builders.
- `packages/lib/src/repositories/sqlite/utils.ts`
  - `chunkArray`
  - `safeInsert`
  - `getTableAliasedColumns`
  - `searchTerms`
  - Behavior to preserve: `SQL_PARAM_LIMIT = 100`, builder-measured chunking, `FETCH_LIMIT = 5`, D1 `batch` when available, sequential fallback for better-sqlite3, search term normalization, max five terms, `%`/`_` escaping.
  - Effect fit: `safeInsert` can return `Effect` later; search helpers stay pure.
- `packages/lib/src/repositories/sqlite/ensurePolicy.ts`
  - `EnsurePolicy`
  - `defaultUnlockedAtEnsurePolicy`
  - `defaultEnsurePolicy`
  - Behavior to preserve: hardcoded defaults and unlocked-at direct-first strategy.

### SQLite Repositories

- `packages/lib/src/repositories/sqlite/App.ts`
  - `AppQueryComposer`
  - builder methods: `withLanguage`, `withAppIds`, `withOwnedByUsers`, `withOwnedByFriendsOf`, `withAchievements`, `withSearch`, `withRequiredEntitySubquery`, `withUnlockedAtMode`, `withCutoff`
  - execution methods: `build`, `count`, `ensureDataExists`
  - private helpers: `findMissingApps`, `findMissingPlayerEstimates`, `fetchAchievementMetaWithFallbackDetection`, `fetchAndUpsertApps`, `fetchAndUpsertPlayerEstimates`
  - `AppRepository.compose`
  - Behavior to preserve: localization storage/fallback detection, app details and achievement metadata upserts, achievement stats upserts, player estimate fetching, stale-data cutoff refetch, pagination/sorting/search, fetch-limit-bounded upserts with degradations, no throw when player estimates are unavailable.
- `packages/lib/src/repositories/sqlite/AppAchievement.ts`
  - `AppAchievementQueryComposer`
  - inherited builder methods from `BaseAchievementQueryComposer`
  - methods: `withCutoff`, `count`, private `ensureDataExists`, private `getAppData`, protected `ensureDependencies`
  - `AppAchievementRepository.compose`
  - Behavior to preserve: dependency on `AppRepository`, language fallback to English metadata, rarity percent and rarity score sorting, count/build consistency.
- `packages/lib/src/repositories/sqlite/BaseAchievement.ts`
  - `BaseAchievementQueryComposer`
  - methods: `withLanguage`, `withCutoff`, `withAppIds`, `withAchievementIds`, `withRarityThreshold`, `withSearch`
  - protected helpers: `createAppIdsCondition`, `createAchievementIdsCondition`, `buildStandardWhereConditions`, `collectWhereConditions`, `buildRequiredAppsScope`, `isRarityScoreSort`
  - Behavior to preserve: CTE-based rarity/search filtering, language fallback metadata join, rarity-score exclusion for missing/zero/negative estimated players.
- `packages/lib/src/repositories/sqlite/User.ts`
  - `UserQueryComposer`
  - builder methods: `withUserIds`, `withRequiredEntitySubquery`, `withCutoff`, `withOwnedApps`
  - methods: `count`, `ensureDataExists`, private `findMissingUsers`, private `fetchAndUpsertUsers`
  - `UserRepository.compose`
  - Behavior to preserve: fetch missing users, cache hits avoid API calls, stale cutoff refetch, optional owned games, recoverable API failures produce empty/degraded results instead of crashing where currently tested, fetch manager limits.
- `packages/lib/src/repositories/sqlite/Friends.ts`
  - `FriendsQueryComposer`
  - builder methods: `withUserIds`, `withCutoff`, `withAppId`, `withOwnedGames`
  - methods: `count`, `ensureDataExists`
  - `FriendsRepository.compose`
  - Behavior to preserve: fetch friend relationships, ensure friend users, duplicate friendships do not duplicate DB/output, stale cutoff refetch, sorting by `friend_since` and `id`, optional owned-games join.
- `packages/lib/src/repositories/sqlite/UserAchievement.ts`
  - `UserAchievementQueryComposer`
  - builder methods: `withUserIds`, `withFriendsOf`, `withUnlockedStatus`, `withCutoff`, inherited achievement filters/search/language
  - methods/helpers: `applySorting`, `getCandidateAppsFromOwnedGames`, `getCandidateAppsFromOwnedGamesForUsers`, `buildRequiredAppsScope`, `count`, `shouldUseComprehensiveSQL`, `ensureUserDataExists`, `ensureAppDataExists`
  - `UserAchievementRepository.compose`
  - Behavior to preserve: unlocked-state semantics, unlocked-at direct-first path, friends-of path, non-owner fallback to app-achievement objects with no user, localization fallback, count/build consistency, SQL-level pagination, idempotent upserts, budget-bounded upserts with degradations, no parameter explosion for large sets.
- `packages/lib/src/repositories/sqlite/index.ts`
  - `VaultService`
  - methods: `getAppsOwnedByFriends`, `getUserAchievementsWithUnlockedFilter`, `getPopularAppsWithAchievements`, `getAppsWithFullData`, `getRareAchievementsForApps`, `getUsersWithOwnedGames`
  - getters: `appAchievements`, `apps`, `users`, `friends`, `userAchievements`
  - Behavior to preserve: repository wiring, cross-repository composition through subqueries, direct repository access.
  - Effect fit: final orchestration target for `Layer`-based service composition.

### ML And Scoring

- `packages/lib/src/ml/model.d.ts`
  - Runtime model type declarations only.
- `packages/lib/src/ml/predict.ts`
  - `predict`
  - private `predictTree`
  - Behavior to preserve: XGBoost tree traversal and score calculation.
- `packages/lib/src/ml/playerEstimate.ts`
  - `estimatePlayerCount`
  - Behavior to preserve: feature mapping into bundled `steam_model.json`, async interface, numeric estimate output.
- `packages/lib/src/ml/benchmark.ts`
  - benchmark helper script.

Effect fit: pure prediction can remain pure. If model loading becomes IO-bound later, introduce a `PlayerEstimateModel` service.

### Type Declaration Files

The `.d.ts` files under `repositories/api/**` define request/response shapes for Steam, Store, Translate, SteamCharts, and YouTube. They are conversion candidates only if the project adopts `Schema` for runtime validation.

Behavior to preserve:

- Generic response types such as `GetOwnedGamesResponse<T>`, `GetPlayerAchievementsResponse<L>`, and `GetAppDetailsResponse<T>`.
- Optional/private/missing API response shapes currently represented in types and comments.
- Existing compile-time consumer expectations.

## Test And Validation Obligations

Existing tests that must remain meaningful during the port:

- `packages/lib/src/error.spec.ts`
  - Full `Attempt` compatibility suite.
- `packages/lib/src/repositories/fetchManager.spec.ts`
  - Fetch budget counting, reset, abort, global manager, edge cases.
- `packages/lib/test/sqlite/AppRepository.spec.ts`
  - App fetch/upsert, localization fallback, search/filter/sort/pagination, player estimates, stale cutoff, fetch limits, conflict updates.
- `packages/lib/test/sqlite/AppAchievementRepository.spec.ts`
  - Achievement upsert regressions, rarity score behavior, count/build consistency.
- `packages/lib/test/sqlite/UserRepository.spec.ts`
  - User fetch/cache, filters, pagination, API failure behavior, owned games, stale cutoff, fetch limits.
- `packages/lib/test/sqlite/FriendsRepository.spec.ts`
  - Friend fetching, user dependency ensuring, duplicate handling, owned games, sorting/pagination, large insert safety.
- `packages/lib/test/sqlite/UserAchievementRepository.spec.ts`
  - User achievement fetching/upserting, localization fallback, unlock semantics, rarity/search/unlocked filters, friends-of path, count/build consistency, large inserts, fetch-budget degraded results.

Recommended validation after spec-only changes:

- No runtime validation required.

Recommended validation after future code changes under `packages/lib/src`:

- `npm run check --workspace=@project/lib`
- `npm test --workspace=@project/lib`

Recommended extra checks after each Effect repository conversion:

- Add focused tests for typed error conversion/adapters.
- Add one test proving SQLite errors still propagate where current contracts require propagation.
- Add one test proving recoverable API errors become `Degradation` values and legacy wrappers still expose partial results where current contracts require partials.
- Add one test proving fetch-budget abort behavior still short-circuits external work.

## Non-Goals For The First Port

- Do not rewrite Drizzle query composition just to look more functional.
- Do not replace CTE/subquery filtering with array materialization.
- Do not read or rewrite generated Drizzle snapshots as part of Effect migration.
- Do not convert plain data models unless a caller needs Effect-native validation or immutable structural data.
- Do not remove Promise-compatible APIs until `packages/site` and `packages/worker` have been migrated.
