<!--
    Achievement Sorting/Filtering Toolbar Component
    
    A universal toolbar that adapts to both client-side and server-side sorting contexts.
    
    Features:
    - Automatic detection of client vs server mode
    - Type-safe URL generation for server mode using sort manager's built-in methods
    - Support for search, sorting, filtering, and direction controls
    - Adaptive UI based on data type (UserAchievement vs AppAchievement)
    - Proper internationalization support
    - State caching to avoid flickering between promise states
    - Progressive loading with disabled inputs during data transitions
    
    The component automatically detects whether it's running in:
    - Server mode: Renders navigation links using the sort manager's URL generation
    - Client mode: Renders interactive controls that update the sort manager state
    
    State Management:
    - Caches resolved data to prevent loading states when new promises are created
    - Shows current data with disabled controls during loading transitions
    - Only shows full loading placeholders on initial load (no cached data)
-->

<script lang="ts" module>
	import type { RepositoryResult, SortDirection, SteamAppAchievement, SteamUserAchievement } from "@project/lib";

	// Type guard to check if manager has URL generation capabilities
	function isServerSortManager(
		manager: AchievementClientSortManager | AchievementServerSortManager,
	): manager is AchievementServerSortManager {
		return "generateUrl" in manager;
	}

	// Helper function to determine if data has unlocked property (UserAchievement)
	function hasUnlocked(item: SteamUserAchievement | SteamAppAchievement): item is SteamUserAchievement {
		return "unlocked" in item;
	}

	// Helper function to check if data supports filtering (has unlocked achievements)
	function supportsFiltering<TData extends SteamUserAchievement | SteamAppAchievement>(data: TData[]): boolean {
		if (!data.length) return false;
		const userAchievements = data.filter(hasUnlocked) as SteamUserAchievement[];
		if (userAchievements.length !== data.length) return false;

		return userAchievements.some((a) => a.unlocked) && userAchievements.some((a) => !a.unlocked);
	}
</script>

<script lang="ts" generics="TData extends SteamUserAchievement | SteamAppAchievement">
	import KeyRound from "@lucide/svelte/icons/key-round";
	import Lock from "@lucide/svelte/icons/lock";
	import SquareDashed from "@lucide/svelte/icons/square-dashed";
	import { Segment } from "@skeletonlabs/skeleton-svelte";
	import { crossfade } from "svelte/transition";
	import { goto } from "$app/navigation";
	import { m } from "$lib/paraglide/messages.js";
	import {
		AchievementClientSortManager,
		AchievementServerSortManager,
		getAchievementSortManager,
	} from "./AchievementSortManager";

	type AchievementSortMethod = "rarity_pct" | "rarity_score" | "unlocked_at";

	interface Props<TData extends SteamUserAchievement | SteamAppAchievement> {
		data: MaybePromise<RepositoryResult<TData>>;
	}

	let { data }: Props<TData> = $props();

	const sortManager = $derived(getAchievementSortManager());
	const serverMode = $derived(isServerSortManager(sortManager));
	let currentMethod = $derived(sortManager.method);
	let currentDirection = $derived(sortManager.direction);

	let searchTimeout: ReturnType<typeof setTimeout>;

	// State caching - track the last resolved data and loading state
	let cachedData: RepositoryResult<TData> | null = $state(null);
	let isLoading = $state(false);

	// Update cached data when new data resolves, and track loading state
	$effect(() => {
		const currentData = data;

		(async () => {
			// It's a promise - mark as loading
			isLoading = true;

			try {
				// Wait for the promise to resolve
				cachedData = await currentData;
			} catch (error) {
				// If it fails, keep the cached data and set loading to false
				console.error("Failed to load data:", error);
				isLoading = false;
				return;
			} finally {
				isLoading = false;
			}
		})();
	});

	const [send, receive] = crossfade({
		duration: 200,
		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === "none" ? "" : style.transform;

			return {
				duration: 200,
				css: (t) => `transform: ${transform} opacity(${t});`,
			};
		},
	});

	const segmentRounded = "rounded-container";
	const segmentBorder = "preset-outlined-surface-300-700 p-2";

	// Helper function to generate URLs for server mode using the sort manager's URL generation
	function generateSortUrl(overrides: {
		method?: AchievementSortMethod;
		filter?: string;
		direction?: SortDirection;
		search?: string;
	}): string {
		if (!serverMode) return "#";
		return (sortManager as AchievementServerSortManager).generateUrl(overrides);
	}

	// Helper function to handle clicks in client mode or navigate in server mode
	function handleMethodChange(method: string) {
		const nextMethod = method as AchievementSortMethod;

		// Optimistically update
		currentMethod = nextMethod;

		if (serverMode) {
			goto(generateSortUrl({ method: nextMethod }), {
				noScroll: true,
			});
		} else {
			sortManager.method = nextMethod;
		}
	}

	function handleFilterChange(filter: string) {
		if (serverMode) {
			goto(generateSortUrl({ filter }), { noScroll: true });
		} else {
			(sortManager as AchievementClientSortManager).filter = filter;
		}
	}

	function handleDirectionToggle() {
		// Optimistically update
		currentDirection = currentDirection === "asc" ? "desc" : "asc";

		if (serverMode) {
			goto(
				generateSortUrl({
					direction: currentDirection,
				}),
				{ noScroll: true },
			);
		} else {
			const clientManager = sortManager as AchievementClientSortManager;
			clientManager.direction = currentDirection;
		}
	}

	// Get the configuration for available sort methods with proper localization
	function getAvailableMethods(resolvedData: TData[]) {
		const firstItem = resolvedData[0];

		if (firstItem && hasUnlocked(firstItem)) {
			// UserAchievement data - supports all methods including unlocked_at
			return [
				{
					method: "rarity_pct",
					label: m["toolbar.sort.method.rarity"](),
				},
				{
					method: "rarity_score",
					label: m["toolbar.sort.method.playerCount"](),
				},
				{
					method: "unlocked_at",
					label: m["toolbar.sort.method.unlocked"](),
				},
			] as const;
		}

		// AppAchievement data - only supports rarity methods
		return [
			{ method: "rarity_pct", label: m["toolbar.sort.method.rarity"]() },
			{
				method: "rarity_score",
				label: m["toolbar.sort.method.playerCount"](),
			},
		] as const;
	}

	// Helper function to check if we have an error state that should be displayed
	function shouldShowError(repositoryResult: RepositoryResult<TData>): boolean {
		return repositoryResult.isFailure() || (repositoryResult.isPartial() && repositoryResult.data.length === 0);
	}
</script>

<div
	class="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:gap-6"
	class:opacity-75={isLoading}
	class:pointer-events-none={isLoading}
>
	{#if !cachedData}
		<!-- Initial loading state - no cached data available -->
		<input
			type="search"
			placeholder={m["toolbar.search.placeholder"]()}
			disabled
			class="input border-surface-700 bg-surface-800 text-surface-100 grow py-3 opacity-50"
		>
		<div class="flex flex-col items-center gap-2 md:flex-row">
			<div class="bg-surface-700 h-10 w-32 animate-pulse rounded"></div>
		</div>
		<button
			type="button"
			disabled
			aria-label={m["toolbar.sort.direction.toggle"]()}
			class="btn preset-outlined-surface-300-700 text-surface-300 py-3 opacity-50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide-icon lucide lucide-arrow-up-wide-narrow"
				aria-hidden="true"
			>
				<path d="m3 8 4-4 4 4"></path>
				<path d="M7 4v16"></path>
				<path d="M11 12h10"></path>
				<path d="M11 16h7"></path>
				<path d="M11 20h4"></path>
			</svg>
		</button>
	{:else}
		{@const resolvedData = cachedData.data}
		{@const availableMethods = getAvailableMethods(resolvedData)}
		<!-- Search Input -->
		<input
			type="search"
			placeholder={m["toolbar.search.placeholder"]()}
			bind:value={sortManager.search}
			class="input border-surface-700 bg-surface-800 text-surface-100 grow py-3"
			oninput={serverMode
				? () => {
						const captured = sortManager.search;
						// Debounce search in server mode
						clearTimeout(searchTimeout);
						searchTimeout = setTimeout(() => {
							goto(generateSortUrl({ search: captured }));
						}, 300);
					}
				: undefined}
		>

		<!-- Sort Method Selection -->
		<div class="flex flex-col items-center gap-2 md:flex-row">
			<label class="text-surface-300 text-sm">
				<span hidden>{m["toolbar.sort.by"]()}</span>
				<Segment
					value={currentMethod}
					onValueChange={(e) => handleMethodChange(e.value as string)}
					border={segmentBorder}
					rounded={segmentRounded}
				>
					{#each availableMethods as methodConfig}
						<Segment.Item classes="text-sm" value={methodConfig.method}>
							{methodConfig.label}
						</Segment.Item>
					{/each}
				</Segment>
			</label>
		</div>

		<!-- Filter Status Selection -->
		{#if supportsFiltering(resolvedData)}
			<div class="flex flex-col items-center gap-2 md:flex-row">
				<label class="text-surface-300 text-sm">
					<span hidden>{m["toolbar.filter.by"]()}</span>
					<Segment
						value={sortManager.filter ?? "all"}
						onValueChange={(e) => handleFilterChange(e.value ?? "")}
						border={segmentBorder}
						rounded={segmentRounded}
					>
						<Segment.Item labelClasses="text-sm" value="all">
							<span hidden>{m["toolbar.filter.all"]()}</span>
							<SquareDashed />
						</Segment.Item>
						<Segment.Item labelClasses="text-sm" value="unlocked">
							<span hidden>{m["toolbar.filter.unlocked"]()}</span>
							<KeyRound />
						</Segment.Item>
						<Segment.Item labelClasses="text-sm" value="locked">
							<span hidden>{m["toolbar.filter.locked"]()}</span>
							<Lock />
						</Segment.Item>
					</Segment>
				</label>
			</div>
		{/if}

		<!-- Sort Direction Toggle -->
		<button
			type="button"
			onclick={handleDirectionToggle}
			aria-label={m["toolbar.sort.direction.toggle"]()}
			class="btn preset-outlined-surface-300-700 text-surface-300 py-3"
		>
			<!-- SVG content same as original -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide-icon lucide lucide-arrow-up-wide-narrow top-0 left-0"
				aria-hidden="true"
			>
				{#if currentDirection === "asc"}
					<path d="m3 8 4-4 4 4" in:receive={{ key: 0 }} out:send={{ key: 0 }}></path>
					<path d="M7 4v16" in:receive={{ key: 1 }} out:send={{ key: 1 }}></path>
					<path d="M11 12h10" in:receive={{ key: 2 }} out:send={{ key: 2 }}></path>
					<path d="M11 16h7" in:receive={{ key: 3 }} out:send={{ key: 3 }}></path>
					<path d="M11 20h4" in:receive={{ key: 4 }} out:send={{ key: 4 }}></path>
				{:else}
					<path d="m3 16 4 4 4-4" in:receive={{ key: 0 }} out:send={{ key: 0 }}></path>
					<path d="M7 20V4" in:receive={{ key: 1 }} out:send={{ key: 1 }}></path>
					<path d="M11 4h4" in:receive={{ key: 2 }} out:send={{ key: 2 }}></path>
					<path d="M11 8h7" in:receive={{ key: 3 }} out:send={{ key: 3 }}></path>
					<path d="M11 12h10" in:receive={{ key: 4 }} out:send={{ key: 4 }}></path>
				{/if}
			</svg>
		</button>
	{/if}
</div>
