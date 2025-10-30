import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/public";

Sentry.initCloudflareSentryHandle({
	// @ts-expect-error idk
	dsn: env.PUBLIC_SENTRY_DSN,

	// Adds request headers and IP for users, for more info visit:
	// https://docs.sentry.io/platforms/javascript/guides/sveltekit/configuration/options/#sendDefaultPii
	sendDefaultPii: true,
});
