<script lang="ts" module>
	import { SvelteMap, SvelteSet } from "svelte/reactivity";

	let translate = $state(false); // default to false, because oof my wallet

	// I wanted to use a WeakMap here, but it's not reactive.
	let translations = new SvelteMap<SteamAppAchievement, Promise<string>>();
	let achievements = new SvelteSet<SteamAppAchievement>();

	function translateAchievements(lang: LanguageCode) {
		console.debug(
			`Translating achievements for language: ${lang}, total: ${achievements.size}`,
		);

		const missingTranslations = achievements
			.values()
			.filter(
				(achievement) =>
					!translations.has(achievement) &&
					achievement.language !== lang,
			)
			.toArray();
		if (missingTranslations.length === 0) return;

		// Group achievements by app ID to reduce API calls
		const appIds = new Set(missingTranslations.map((a) => a.app.id))
			.values()
			.toArray();

		const resMap = fetch(`/translate?lang=${lang}`, {
			method: "POST",
			body: JSON.stringify(appIds),
		}).then((res) => {
			if (!res.ok) {
				throw new Error(
					`Failed to fetch translations: ${res.status} ${res.statusText}`,
				);
			}
			return res.json() as Promise<Record<string, string>>;
		});

		for (const achievement of missingTranslations) {
			// Assign promise back to the map
			const res = resMap.then(
				(res) => res[`${achievement.app.id}:${achievement.id}`] ?? "",
			);
			translations.set(achievement, res);
		}
	}

	// I'm fairly confident this is another memory leak, but it's fine for now
	$effect.root(() => {
		$effect(() => {
			if (translate) translateAchievements(getLocale());
		});

		return () => {};
	});
</script>

<script lang="ts">
	import { SteamAppAchievement, type LanguageCode } from "@project/lib";
	// biome-ignore lint/style/useImportType: <explanation>
	import { m } from "$lib/paraglide/messages.js";
	import { getLocale, localizeHref } from "$lib/paraglide/runtime";
	import TranslationToggle from "$lib/TranslationToggle.svelte";
	import { SteamUserAchievement } from "@project/lib";
	import Badge from "./_badge.svelte";

	interface Props {
		achievement: SteamUserAchievement | SteamAppAchievement;
	}

	let { achievement }: Props = $props();

	const size = 64;

	const imgClass = "border-surface-300 bg-surface-900 rounded border";

	$effect(() => {
		achievements.add(achievement);

		return () => {
			achievements.delete(achievement);
			translations.delete(achievement);
		};
	});
</script>

<div class="card">
	<!-- {achievement.translation} -->
	<article class="flex h-full flex-col justify-between">
		<!-- Main section -->
		<div class="flex items-start gap-4 p-4">
			<!-- icon snippet -->
			<a
				href={localizeHref(
					`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`,
				)}
				class="relative"
			>
				{#if achievement instanceof SteamUserAchievement && !achievement.unlocked}
					<div class="icon-container">
						<img
							src={achievement.iconLocked}
							alt={achievement.name}
							width={size}
							height={size}
							class={imgClass}
						/>
						<img
							src={achievement.iconUnlocked}
							alt={achievement.name}
							width={size}
							height={size}
							class={`unlocked ${imgClass}`}
						/>
					</div>
				{:else}
					<div class="icon-container">
						<img
							src={achievement.icon}
							alt={achievement.name}
							width={size}
							height={size}
							class={imgClass}
						/>
					</div>
				{/if}
				<!-- badge snippet -->
				<div class="absolute -right-2 -bottom-2">
					<Badge {achievement} />
				</div>
			</a>
			<div class="flex w-full justify-between">
				<div class="">
					<!-- Achievement name -->
					<h3 class="line-clamp-2 text-sm font-bold">
						<a
							class="hover:underline"
							href={localizeHref(
								`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`,
							)}
						>
							{achievement.name}
						</a>
					</h3>
					<!-- Game name & description -->
					<p class="text-surface-300 mb-1 text-xs">
						<a
							class="hover:underline"
							href={localizeHref(`/game/${achievement.app.id}`)}
						>
							{achievement.app.name}
						</a>
					</p>
					{#if achievement.hidden}
						<p class="text-surface-300 text-xs font-bold italic">
							{m["status.hidden"]()}
						</p>
					{:else}
						<p class="text-surface-100 line-clamp-3 text-xs">
							{#if !translate || achievement.language === getLocale()}
								{achievement.description}
							{:else}
								{#await translations.get(achievement)}
									<span class="text-surface-500">
										{m["loading.title"]()}
									</span>
								{:then translation}
									{@html translation}
								{:catch error}
									<span class="text-error"
										>{error.message}</span
									>
								{/await}
							{/if}
						</p>
					{/if}
				</div>
				<div class="z-50">
					{#if achievement.language !== getLocale()}
						<TranslationToggle
							class="preset-outlined-surface-500 text-surface-600-400 h-7 w-7"
							bind:translate
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- Footer section -->
		<div
			class="text-surface-300 bg-surface-900 flex items-center justify-between px-4 py-2 text-xs"
		>
			{#if achievement instanceof SteamUserAchievement}
				<span>
					{#if achievement.unlocked}
						{m["status.unlocked"]()}: {achievement.unlocked.toLocaleDateString()}
					{:else}
						{m["status.locked"]()}
					{/if}
				</span>
				<a
					href={localizeHref(
						`/game/${achievement.app.id}/achievement/${encodeURIComponent(achievement.id)}`,
					)}
					class="text-primary-500 hover:text-primary-400"
				>
					{m["achievement.details"]()}
				</a>
			{/if}
		</div>
	</article>
</div>

<style>
	.icon-container {
		position: relative;
		transition: transform 0.5s ease-in-out;
		width: 64px;
		overflow: hidden;
	}
	.icon-container img.unlocked {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		transition: opacity 0.5s ease-in-out;
	}
	.icon-container:hover {
		transform: scale(1.1);
	}
	.icon-container:hover img.unlocked {
		opacity: 1;
	}
	.icon-container:hover::after {
		content: "";
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			120deg,
			transparent,
			rgba(255, 255, 255, 0.6),
			transparent
		);
		transform: skewX(-20deg);
		animation: shine 0.8s forwards;
		pointer-events: none;
	}
	@keyframes shine {
		to {
			left: 100%;
		}
	}
</style>
