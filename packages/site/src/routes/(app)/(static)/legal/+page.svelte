<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { m } from "$lib/paraglide/messages.js";
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
    <title>{m.legalPageMetaTitle()}</title>
    <meta name="description" content={m.legalPageMetaDescription()} />
    <link rel="canonical" href="/legal" />
    <meta property="og:title" content={m.legalPageMetaTitle()} />
    <meta property="og:description" content={m.legalPageMetaDescription()} />
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
            <h1 class="text-3xl font-bold">{m.legalHeaderTitle()}</h1>
            <p class="text-surface-300">{m.legalHeaderSubtitle()}</p>
        </div>
    </div>

    <!-- Disclaimer -->
    <div class="card mb-8 p-4">
        <div>
            <p class="font-bold">{m.legalDisclaimerTitle()}</p>
            <p class="text-surface-300 text-xs">{m.legalDisclaimerText()}</p>
        </div>
    </div>

    <!-- Updated Tabs system -->
    <Tabs
        value={activeTab}
        onValueChange={(v) => {
            switch (v.value) {
                case "terms":
                    goto("/legal?tab=terms");
                    break;
                default:
                    goto("/legal");
            }
        }}
    >
        {#snippet list()}
            <Tabs.Control value="privacy">{m.legalTabsPrivacy()}</Tabs.Control>
            <Tabs.Control value="terms">{m.legalTabsTerms()}</Tabs.Control>
        {/snippet}

        {#snippet content()}
            <Tabs.Panel value="privacy">
                <div class="prose max-w-none pt-4">
                    <blockquote>{m.legalPrivacyBlockquote()}</blockquote>

                    <!-- Section: Information We Collect -->
                    <section>
                        <h2>{m.legalPrivacySectionInformation()}</h2>
                        <p>{m.legalPrivacySectionInformationList()}</p>
                    </section>

                    <!-- Section: How We Use Your Information -->
                    <section>
                        <h2>{m.legalPrivacySectionHowWeUse()}</h2>
                        <p>{m.legalPrivacySectionHowWeUseList()}</p>
                    </section>

                    <!-- Section: Sharing Your Information -->
                    <section>
                        <h2>{m.legalPrivacySectionSharing()}</h2>
                        <p>{m.legalPrivacySectionSharingList()}</p>
                    </section>

                    <!-- Section: Data Security -->
                    <section>
                        <h2>{m.legalPrivacySectionDataSecurity()}</h2>
                        <p>{m.legalPrivacySectionDataSecurityText()}</p>
                    </section>

                    <!-- Section: Your Rights -->
                    <section>
                        <h2>{m.legalPrivacySectionYourRights()}</h2>
                        <p>{m.legalPrivacySectionYourRightsList()}</p>
                    </section>

                    <!-- Section: Cookies and Tracking Technologies -->
                    <section>
                        <h2>{m.legalPrivacySectionCookies()}</h2>
                        <p>{m.legalPrivacySectionCookiesText()}</p>
                    </section>

                    <!-- Section: Changes to This Privacy Policy -->
                    <section>
                        <h2>{m.legalPrivacySectionChanges()}</h2>
                        <p>{m.legalPrivacySectionChangesText()}</p>
                    </section>
                </div>
            </Tabs.Panel>

            <Tabs.Panel value="terms">
                <div class="prose max-w-none pt-4">
                    <blockquote>{m.legalTermsBlockquote()}</blockquote>

                    <!-- Section: User Accounts -->
                    <section>
                        <h2>{m.legalTermsSectionUserAccounts()}</h2>
                        <p>{m.legalTermsSectionUserAccountsText()}</p>
                    </section>

                    <!-- Section: Acceptable Use -->
                    <section>
                        <h2>{m.legalTermsSectionAcceptableUse()}</h2>
                        <p>{m.legalTermsSectionAcceptableUseText()}</p>
                    </section>

                    <!-- Section: Intellectual Property Rights -->
                    <section>
                        <h2>{m.legalTermsSectionIntellectualProperty()}</h2>
                        <p>{m.legalTermsSectionIntellectualPropertyText()}</p>
                    </section>

                    <!-- Section: Limitation of Liability -->
                    <section>
                        <h2>{m.legalTermsSectionLimitationOfLiability()}</h2>
                        <p>{m.legalTermsSectionLimitationOfLiabilityText()}</p>
                    </section>

                    <!-- Section: Termination -->
                    <section>
                        <h2>{m.legalTermsSectionTermination()}</h2>
                        <p>{m.legalTermsSectionTerminationText()}</p>
                    </section>

                    <!-- Section: Changes to These Terms -->
                    <section>
                        <h2>{m.legalTermsSectionChanges()}</h2>
                        <p>{m.legalTermsSectionChangesText()}</p>
                    </section>
                </div>
            </Tabs.Panel>
        {/snippet}
    </Tabs>

    <!-- Contact Information -->
    <div class="card mb-8 p-6">
        <h2 id="support" class="text-xl font-bold">
            {m.legalContactHeading()}
        </h2>
        <p class="text-surface-300">
            {m.legalContactIntro()}
        </p>
        <ul class="text-surface-300 space-y-2">
            <li>
                <strong>Email:</strong>
                <a href="mailto:{m.legalContactEmail()}" class="underline">
                    {m.legalContactEmail()}
                </a>
            </li>
        </ul>
    </div>

    <!-- Print and Download Options -->
    <button
        class="btn preset-outlined-surface-500 mb-8"
        onclick={() => window.print()}
    >
        {m.legalPrintButton()}
    </button>

    <!-- Acknowledgment -->
    <p class="text-surface-300 mb-8 text-sm">{m.legalAcknowledgmentText()}</p>
</main>
