<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import {
		localizeHref,
		deLocalizeHref,
		getLocale,
		locales,
	} from "$lib/paraglide/runtime";
	import Trophy from "@lucide/svelte/icons/trophy";
	import Languages from "@lucide/svelte/icons/languages";
	import { page } from "$app/stores";

	// Build localized links for all available locales, excluding the current one
	$: currentPath = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
	$: baseHref = deLocalizeHref(currentPath);
	$: currentLocale = getLocale();
	$: otherLocales = locales.filter((l) => l !== currentLocale);

	// Temporary typing-safe access until Paraglide recompiles message types
	const getMsg = (key: string): (() => string) | undefined => {
		const table = m as unknown as Record<string, unknown>;
		const maybeFn = table[key];
		return typeof maybeFn === "function"
			? (maybeFn as () => string)
			: undefined;
	};
	$: languagePrompt =
		getMsg("footer.languagePrompt")?.() ??
		"View this page in another language";

	const getAutonym = (tag: string) => {
		try {
			// Display the language name in its own language (autonym)
			const dn = new Intl.DisplayNames([tag], { type: "language" });
			const name = dn.of(tag) ?? tag;
			// Prevent line breaks before parentheses, e.g. "português (Brasil)"
			return name.replace(/\s\(/, "\u00A0(");
		} catch {
			return tag;
		}
	};
</script>

<footer class="border-surface-800 bg-surface-900 border-t py-8">
	<div class="container mx-auto px-4">
		<div class="flex flex-col items-center justify-between md:flex-row">
			<div class="mb-4 flex items-center gap-2 md:mb-0">
				<Trophy class="text-primary-500 h-6 w-6" />
				<span class="text-xl font-bold"
					>{m["footer.companyName"]()}</span
				>
			</div>
			<div
				class="text-surface-300 flex flex-wrap justify-center gap-6 text-sm"
			>
				<a href={localizeHref("/about")} class="hover:text-surface-100"
					>{m["footer.about"]()}</a
				>
				<a
					href={localizeHref("/legal#support")}
					class="hover:text-surface-100">{m["footer.support"]()}</a
				>
				<a href={localizeHref("/legal")} class="hover:text-surface-100"
					>{m["footer.privacy"]()}</a
				>
				<a
					href={localizeHref("/legal?tab=terms")}
					class="hover:text-surface-100">{m["footer.terms"]()}</a
				>
			</div>
		</div>

		<!-- Language switcher CTA (compact, left-aligned, grid) moved below logo/links -->
		<div class="mt-6">
			<div class="text-surface-400">
				<div class="mb-2 flex items-center gap-2">
					<Languages
						class="text-surface-500 hidden h-4 w-4 sm:block"
					/>
					<p class="text-sm">{languagePrompt}</p>
				</div>
				<div
					class="text-md grid max-w-xl grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-2 md:grid-cols-2 md:text-sm lg:grid-cols-4"
				>
					{#each otherLocales as locale}
						<a
							class="text-surface-400 hover:text-surface-100 hover:underline"
							href={localizeHref(baseHref, { locale })}
							hreflang={locale}
							lang={locale}
							data-sveltekit-reload
							aria-label={`Switch language to ${getAutonym(locale)}`}
						>
							{getAutonym(locale)}
						</a>
					{/each}
				</div>
			</div>
		</div>
		<div
			class="text-surface-300 border-surface-800 mt-8 border-t pt-6 text-center text-sm"
		>
			{m["footer.rights"]({ year: new Date().getFullYear() })}
		</div>
	</div>
</footer>
