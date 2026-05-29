<script lang="ts">
	import type { RepositoryResult, SteamUser, SteamUserAchievement } from "@project/lib";
	import { Accordion, Tabs } from "@skeletonlabs/skeleton-svelte";
	import AchievementCards from "$lib/AchievementCards";
	import IndexError from "$lib/IndexError.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import Toolbar from "$lib/SortManager/Toolbar.svelte";
	import PublicProfile from "../../(static)/about/PublicProfile.svelte";
	import Podium from "./Podium.svelte";

	interface Props {
		topThree: SteamUserAchievement[];
		achievements: Promise<RepositoryResult<SteamUserAchievement>>;
		user: SteamUser;
	}
	let { achievements, topThree, user }: Props = $props();

	let activeTab = $state("grid");

	const podiumAchievements = $derived.by(
		(): [SteamUserAchievement, SteamUserAchievement, SteamUserAchievement] | null => {
			const [first, second, third] = topThree;
			if (!first || !second || !third) return null;
			return [first, second, third];
		},
	);
</script>

{#if user.private}
	<!-- Friend's achievements are private -->
	<section class="mb-12">
		<h2 class="mb-6 text-center text-2xl font-bold">
			{m["user.page.title"]({ displayName: user.displayName })}
		</h2>

		<div class="flex min-h-[400px] flex-col items-center justify-center">
			<p class="text-surface-300 mb-8">
				{m["profile.private"]()}
			</p>

			<div class="w-full max-w-[800px]">
				<Accordion multiple>
					<Accordion.Item value="0">
						{#snippet control()}
							{m["user.page.faq.private.question"]()}
						{/snippet}
						{#snippet panel()}
							<p class="p-4">
								{m["user.page.faq.private.answer"]()}
							</p>
						{/snippet}
					</Accordion.Item>
					<Accordion.Item value="1">
						{#snippet control()}
							{m["user.page.faq.public.question"]()}
						{/snippet}
						{#snippet panel()}
							<PublicProfile />
						{/snippet}
					</Accordion.Item>
				</Accordion>
			</div>
		</div>
	</section>
{:else}
	<!-- Hero Section with Podium -->
	<section class="mb-12">
		<h2 class="mb-6 text-center text-2xl font-bold">
			{m["user.page.title"]({ displayName: user.displayName })}
		</h2>

		<div class="relative mb-8 flex items-end justify-center gap-2 pt-4 sm:gap-4">
			{#if podiumAchievements}
				<Podium place={2} achievement={podiumAchievements[1]} />

				<Podium place={1} achievement={podiumAchievements[0]} />

				<Podium place={3} achievement={podiumAchievements[2]} />
			{:else}
				<!-- Base thing -->
				<div class="flex h-full w-full items-center justify-center">
					<p class="text-surface-300">
						{m["user.page.noAchievements"]()}
					</p>
				</div>
			{/if}

			<!-- Base -->
			<div class="bg-surface-700 absolute bottom-0 h-8 w-full rounded"></div>
		</div>
	</section>

	{#await achievements then { error }}
		{#if error}
			<!-- TODO move this into the card component? -->
			<IndexError />
		{/if}
	{/await}

	<!-- Achievement Leaderboard -->
	<section>
		<h2 class="mb-4 text-2xl font-bold">
			{m["user.page.leaderboard.title"]()}
		</h2>

		<Toolbar data={achievements} />

		<!-- Tabs -->
		<Tabs value={activeTab} onValueChange={(e) => (activeTab = e.value)}>
			{#snippet list()}
				<Tabs.Control value="grid">{m["user.view.table"]()}</Tabs.Control>
			<!-- <Tabs.Control value="list">{m.user.view.list()}</Tabs.Control> -->
			{/snippet}

			{#snippet content()}
				<Tabs.Panel value="grid">
					<AchievementCards achievements={achievements.then((d) => d.data)} />
				</Tabs.Panel>

				<Tabs.Panel value="list">
					<div class="border-surface-700 bg-surface-800 overflow-hidden rounded border">
						<table class="w-full">
							<thead>
								<tr class="border-surface-700 bg-surface-900/50 border-b">
									<th
										class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
									>
										{m["user.table.achievement"]()}
									</th>
									<th
										class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
									>
										{m["user.table.game"]()}
									</th>
									<th
										class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
									>
										{m["user.table.rarity"]()}
									</th>
									<th
										class="text-surface-300 px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
									>
										{m["status.unlocked"]()}
									</th>
								</tr>
							</thead>
							<!-- <tbody class="divide-surface-700 divide-y">
                                {#each filteredAchievements as achievement}
                                    {#if achievement.unlocked !== null}
                                        <tr
                                            class="hover:bg-surface-700/30 transition-colors"
                                        >
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
                                                <div
                                                    class="flex items-center gap-3"
                                                >
                                                    <img
                                                        src={achievement.icon}
                                                        alt={achievement.name}
                                                        width="32"
                                                        height="32"
                                                        class="border-surface-700 bg-surface-900 rounded border"
                                                    />
                                                    <div>
                                                        <div
                                                            class="text-surface-100 text-sm font-medium"
                                                        >
                                                            {achievement.name}
                                                        </div>
                                                        <div
                                                            class="text-surface-300 line-clamp-1 text-xs"
                                                        >
                                                            {achievement.description}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td
                                                class="text-surface-300 px-4 py-3 text-sm whitespace-nowrap"
                                                >{achievement.app.name}</td
                                            >
                                            <td
                                                class="px-4 py-3 whitespace-nowrap"
                                            >
                                                <span
                                                    class="bg-primary-500/10 text-primary-500 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                >
                                                    {achievement.globalPercentage}%
                                                </span>
                                            </td>
                                            <td
                                                class="text-surface-300 px-4 py-3 text-sm whitespace-nowrap"
                                            >
                                                {achievement.unlocked.toLocaleDateString()}
                                            </td>
                                        </tr>
                                    {/if}
                                {/each}
                            </tbody> -->
						</table>
					</div>
				</Tabs.Panel>
			{/snippet}
		</Tabs>
	</section>
{/if}
