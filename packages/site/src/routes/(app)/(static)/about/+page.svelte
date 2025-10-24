<script lang="ts">
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages.js";
	import { deLocalizeUrl, localizeHref } from "$lib/paraglide/runtime";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import DollarSign from "@lucide/svelte/icons/dollar-sign";
	import Github from "@lucide/svelte/icons/github";
	import Mail from "@lucide/svelte/icons/mail";
	import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
	import Trophy from "@lucide/svelte/icons/trophy";
	import { Accordion } from "@skeletonlabs/skeleton-svelte";

	let team = [
		{
			name: "Cole Crouter",
			avatar: "https://avatars.githubusercontent.com/u/15883173?v=4",
			role: "Founder & Lead Developer",
		},
	];

	let faqs = [
		{
			question: m["about.faq.question1"](),
			answer: m["about.faq.answer1"](),
		},
		{
			question: m["about.faq.question2"](),
			answer: m["about.faq.answer2"](),
		},
		{
			question: m["about.faq.question3"](),
			answer: m["about.faq.answer3"](),
		},
		{
			question: m["about.faq.question4"](),
			answer: m["about.faq.answer4"](),
		},
		{
			question: m["about.faq.question5"](),
			answer: m["about.faq.answer5"](),
		},
		{
			question: m["about.faq.question6"](),
			answer: m["about.faq.answer6"](),
		},
		{
			question: m["about.faq.question7"](),
			answer: m["about.faq.answer7"](),
		},
	] satisfies Record<"question" | "answer", string>[];

	let { data } = $props();

	let features = [
		{
			title: m["about.features.feature1.title"](),
			shortDescription: m["about.features.feature1.shortDescription"](),
			description: m["about.features.feature1.description"](),
			icon: Trophy,
			iconType: "component",
		},
		{
			title: m["about.features.feature2.title"](),
			shortDescription: m["about.features.feature2.shortDescription"](),
			description: m["about.features.feature2.description"](),
			icon: DollarSign,
			iconType: "component",
		},
		{
			title: m["about.features.feature3.title"](),
			shortDescription: m["about.features.feature3.shortDescription"](),
			description: m["about.features.feature3.description"](),
			icon: SlidersHorizontal,
			iconType: "component",
		},
	];
</script>

<svelte:head>
	<title>{m["about.meta.title"]()}</title>
	<meta name="description" content={m["about.meta.description"]()} />
	<link rel="canonical" href={deLocalizeUrl(page.url).toString()} />
	<meta property="og:title" content={m["about.meta.title"]()} />
	<meta property="og:description" content={m["about.meta.description"]()} />
</svelte:head>

<div
	class="from-surface-900 to-surface-950 text-surface-100 min-h-screen bg-gradient-to-b"
>
	<main class="container mx-auto px-4 py-12">
		<!-- Hero Section -->
		<section class="mb-16 text-center">
			<div class="relative mb-6 inline-block">
				<!-- Icon thing -->
				<div
					class="bg-primary-500/20 absolute inset-0 rounded-full blur-xl"
				></div>
				<Trophy class="text-primary-500 relative h-20 w-20" />
			</div>
			<h1 class="mb-4 text-4xl font-bold md:text-5xl">
				{m["about.hero.title"]()}
			</h1>
			<p class="text-surface-300 mx-auto max-w-3xl text-xl">
				{m["about.hero.subtitle"]()}
			</p>
		</section>

		<!-- Our Mission -->
		<section class="mb-16 flex flex-col items-center">
			<div class="grid max-w-2xl items-center gap-12">
				<div>
					<h2 class="mb-6 text-center text-3xl font-bold">
						{m["about.mission.title"]()}
					</h2>
					<p class="text-surface-300 mb-4">
						{m["about.mission.paragraph1"]()}
					</p>
					<p class="text-surface-300 mb-4">
						{m["about.mission.paragraph2"]()}
					</p>
					<p class="text-surface-300">
						{m["about.mission.paragraph3"]()}
					</p>
				</div>
			</div>
		</section>

		<!-- Key Features -->
		<section class="mb-16">
			<h2 class="mb-8 text-center text-3xl font-bold">
				{m["about.features.title"]()}
			</h2>
			<div class="grid gap-6 md:grid-cols-3">
				{#each Object.values(features) as feature}
					<div class="card p-4">
						<div class="flex flex-col items-center">
							<div
								class="bg-primary-500/10 mb-4 flex h-12 w-12 items-center justify-center rounded"
							>
								{#if feature.iconType === "component"}
									<feature.icon
										class="text-primary-500 h-6 w-6"
									/>
								{:else}
									{@html feature.icon}
								{/if}
							</div>
							<h3 class="mb-2 font-bold">{feature.title}</h3>
							<p
								class="text-surface-300 mb-4 text-center text-sm"
							>
								{feature.shortDescription}
							</p>
						</div>
						<p class="text-surface-300 text-sm">
							{feature.description}
						</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- Team -->
		<section class="mb-16">
			<h2 class="mb-8 text-center text-3xl font-bold">
				{m["about.team.title"]()}
			</h2>
			<div class="flex flex-wrap justify-center gap-8">
				{#each team as member}
					<div class="text-center">
						<div
							class="border-surface-700 bg-surface-800 mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border"
						>
							<img
								src={member.avatar}
								alt={member.name}
								width="96"
								height="96"
							/>
						</div>
						<h3 class="font-bold">{member.name}</h3>
						<p class="text-surface-300 text-sm">{member.role}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- FAQ -->
		<section class="mx-auto mb-16 max-w-[800px]">
			<h2 class="mb-8 text-center text-3xl font-bold">
				{m["about.faq.title"]()}
			</h2>
			<Accordion multiple>
				{#each faqs as faq, index}
					<Accordion.Item value={index.toString()}>
						{#snippet control()}{faq.question}{/snippet}
						{#snippet panel()}
							<p class="p-4">
								{faq.answer}
							</p>
						{/snippet}
					</Accordion.Item>
					{#if index < faqs.length - 1}
						<hr class="hr" />
					{/if}
				{/each}
			</Accordion>
		</section>

		<!-- Contact -->
		<section class="mb-16">
			<div class="card mx-auto max-w-3xl p-8">
				<h2 class="mb-6 text-center text-3xl font-bold">
					{m["about.contactTitle"]()}
				</h2>
				<p class="text-surface-300 mb-8 text-center">
					{m["about.socialText"]()}
				</p>
				<div class="grid gap-8 md:grid-cols-2">
					<div>
						<div class="mb-6 flex items-center gap-4">
							<div
								class="bg-primary-500/10 flex h-10 w-10 items-center justify-center rounded-full"
							>
								<Mail class="text-primary-500 h-5 w-5" />
							</div>
							<div>
								<h3 class="font-medium">Email Us</h3>
								<a
									class="text-surface-300 text-sm hover:underline"
									href="mailto:support@steamvault.info"
								>
									support@steamvault.info
								</a>
							</div>
						</div>
						<!-- <div class="mb-6 flex items-center gap-4">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10"
                            >
                                <Twitter class="h-5 w-5 text-primary-500" />
                            </div>
                            <div>
                                <h3 class="font-medium">Twitter</h3>
                                <p class="text-sm text-surface-300">
                                    @AchievementVault
                                </p>
                            </div>
                        </div> -->
						<div class="flex items-center gap-4">
							<div
								class="bg-primary-500/10 flex h-10 w-10 items-center justify-center rounded-full"
							>
								<Github class="text-primary-500 h-5 w-5" />
							</div>
							<div>
								<h3 class="font-medium">GitHub</h3>
								<a
									class="text-surface-300 text-sm hover:underline"
									href="https://github.com/colecrouter/rarest-achievement"
									target="_blank"
									rel="noopener noreferrer"
								>
									github.com/colecrouter/rarest-achievement
								</a>
							</div>
						</div>
					</div>
					<div class="flex flex-col justify-center">
						<p class="text-surface-300/20 mb-4">
							Follow us on social media for updates, tips, and to
							join our growing community of achievement hunters.
						</p>
						<button
							disabled
							class="btn preset-filled-primary-500 flex w-full items-center justify-center py-2"
						>
							Join Our Discord
							<ArrowRight class="ml-2 h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- CTA -->
		<section>
			<div class="text-center">
				<h2 class="mb-4 text-3xl font-bold">
					{m["home.cta.title"]()}
				</h2>
				<p class="text-surface-300 mx-auto mb-8 max-w-2xl">
					{m["about.ctaDescription"]()}
				</p>

				<div class="flex flex-wrap justify-center gap-4">
					{#if !data.loggedIn}
						<form action="?/login" method="POST">
							<button class="btn preset-filled-primary-500 p-3">
								{m["home.features.signIn"]()}
								<ChevronRight class="ml-2 h-4 w-4" />
							</button>
						</form>
					{:else}
						<a
							href={localizeHref(`/user/${data.loggedIn.id}`)}
							class="btn preset-filled-primary-500 p-3"
						>
							{m["home.features.dashboard"]()}
							<ChevronRight class="ml-2 h-4 w-4" />
						</a>
					{/if}
				</div>
			</div>
		</section>
	</main>
</div>
