<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages.js";
	import { deLocalizeUrl, localizeHref } from "$lib/paraglide/runtime";
	import Shield from "@lucide/svelte/icons/shield";
	import { Tabs } from "@skeletonlabs/skeleton-svelte";
	import Breadcrumbs from "../../Breadcrumbs.svelte";

	let activeTab = $derived.by(() => {
		switch (page.url.searchParams.get("tab")) {
			case "terms":
				return "terms";
			default:
				return "privacy";
		}
	});

	const { data } = $props();
	const breadcrumbs = $derived(data.breadcrumbs);
</script>

<svelte:head>
	<title>{m["legal.meta.title"]()}</title>
	<meta name="description" content={m["legal.meta.description"]()} />
	<link rel="canonical" href={deLocalizeUrl(page.url).toString()} />
	<meta property="og:title" content={m["legal.meta.title"]()} />
	<meta property="og:description" content={m["legal.meta.description"]()} />
	<meta property="og:type" content="website" />
</svelte:head>

<!-- Main content translated from React (skipping header and footer) -->
<main class="container mx-auto px-4 py-8">
	<!-- Breadcrumb Navigation -->
	<Breadcrumbs path={breadcrumbs} />

	<!-- Page Header -->
	<div class="mb-8 flex items-center gap-4">
		<div class="bg-primary-500/10 rounded p-3">
			<Shield class="text-primary-500 h-8 w-8" />
		</div>
		<div>
			<h1 class="text-3xl font-bold">{m["legal.header.title"]()}</h1>
			<p class="text-surface-300">{m["legal.header.subtitle"]()}</p>
		</div>
	</div>

	<!-- Disclaimer -->
	<div class="card mb-8 p-4">
		<div>
			<p class="font-bold">{m["legal.disclaimer.title"]()}</p>
			<p class="text-surface-300 text-xs">
				{m["legal.disclaimer.text"]()}
			</p>
		</div>
	</div>

	<!-- Updated Tabs system -->
	<Tabs
		value={activeTab}
		onValueChange={(v) => {
			switch (v.value) {
				case "terms":
					goto(localizeHref("/legal?tab=terms"));
					break;
				default:
					goto(localizeHref("/legal"));
			}
		}}
	>
		{#snippet list()}
			<Tabs.Control value="privacy"
				>{m["legal.tabs.privacy"]()}</Tabs.Control
			>
			<Tabs.Control value="terms">{m["legal.tabs.terms"]()}</Tabs.Control>
		{/snippet}

		{#snippet content()}
			<Tabs.Panel value="privacy">
				<div class="prose !max-w-none pt-4">
					<blockquote>{m["legal.privacy.blockquote"]()}</blockquote>

					<!-- Section: Information We Collect -->
					<section>
						<h2>
							{m["legal.privacy.sections.information.title"]()}
						</h2>
						<p>{m["legal.privacy.sections.information.list"]()}</p>
					</section>

					<!-- Section: How We Use Your Information -->
					<section>
						<h2>{m["legal.privacy.sections.howWeUse.title"]()}</h2>
						<p>{m["legal.privacy.sections.howWeUse.list"]()}</p>
					</section>

					<!-- Section: Sharing Your Information -->
					<section>
						<h2>{m["legal.privacy.sections.sharing.title"]()}</h2>
						<p>{m["legal.privacy.sections.sharing.list"]()}</p>
					</section>

					<!-- Section: Data Security -->
					<section>
						<h2>
							{m["legal.privacy.sections.dataSecurity.title"]()}
						</h2>
						<p>{m["legal.privacy.sections.dataSecurity.text"]()}</p>
					</section>

					<!-- Section: Your Rights -->
					<section>
						<h2>
							{m["legal.privacy.sections.yourRights.title"]()}
						</h2>
						<p>{m["legal.privacy.sections.yourRights.list"]()}</p>
					</section>

					<!-- Section: Cookies and Tracking Technologies -->
					<section>
						<h2>{m["legal.privacy.sections.cookies.title"]()}</h2>
						<p>{m["legal.privacy.sections.cookies.text"]()}</p>
					</section>

					<!-- Section: Changes to This Privacy Policy -->
					<section>
						<h2>{m["legal.privacy.sections.changes.title"]()}</h2>
						<p>{m["legal.privacy.sections.changes.text"]()}</p>
					</section>
				</div>
			</Tabs.Panel>

			<Tabs.Panel value="terms">
				<div class="prose !max-w-none pt-4">
					<blockquote>{m["legal.terms.blockquote"]()}</blockquote>

					<!-- Section: User Accounts -->
					<section>
						<h2>
							{m["legal.terms.sections.userAccounts.title"]()}
						</h2>
						<p>{m["legal.terms.sections.userAccounts.text"]()}</p>
					</section>

					<!-- Section: Acceptable Use -->
					<section>
						<h2>
							{m["legal.terms.sections.acceptableUse.title"]()}
						</h2>
						<p>{m["legal.terms.sections.acceptableUse.text"]()}</p>
					</section>

					<!-- Section: Intellectual Property Rights -->
					<section>
						<h2>
							{m[
								"legal.terms.sections.intellectualProperty.title"
							]()}
						</h2>
						<p>
							{m[
								"legal.terms.sections.intellectualProperty.text"
							]()}
						</p>
					</section>

					<!-- Section: Limitation of Liability -->
					<section>
						<h2>
							{m[
								"legal.terms.sections.limitationOfLiability.title"
							]()}
						</h2>
						<p>
							{m[
								"legal.terms.sections.limitationOfLiability.text"
							]()}
						</p>
					</section>

					<!-- Section: Termination -->
					<section>
						<h2>{m["legal.terms.sections.termination.title"]()}</h2>
						<p>{m["legal.terms.sections.termination.text"]()}</p>
					</section>

					<!-- Section: Changes to These Terms -->
					<section>
						<h2>{m["legal.terms.sections.changes.title"]()}</h2>
						<p>{m["legal.terms.sections.changes.text"]()}</p>
					</section>
				</div>
			</Tabs.Panel>
		{/snippet}
	</Tabs>

	<!-- Contact Information -->
	<div class="card mb-8 p-6">
		<h2 id="support" class="text-xl font-bold">
			{m["legal.contact.heading"]()}
		</h2>
		<p class="text-surface-300">
			{m["legal.contact.intro"]()}
		</p>
		<ul class="text-surface-300 space-y-2">
			<li>
				<strong>Email:</strong>
				<a href="mailto:support@steamvault.info" class="underline">
					support@steamvault.info
				</a>
			</li>
		</ul>
	</div>

	<!-- Print and Download Options -->
	<button
		class="btn preset-outlined-surface-500 mb-8"
		onclick={() => window.print()}
	>
		{m["legal.print.button"]()}
	</button>

	<!-- Acknowledgment -->
	<p class="text-surface-300 mb-8 text-sm">
		{m["legal.acknowledgment.text"]()}
	</p>
</main>
