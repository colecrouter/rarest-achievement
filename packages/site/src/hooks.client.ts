import { dev } from "$app/environment";
import { setBypassCdnEnabled } from "@project/lib";
import * as Sentry from "@sentry/sveltekit";

// If you don't want to use Session Replay, remove the `Replay` integration,
// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
if (!dev) {
    // Initialize Sentry only in production
    Sentry.init({
        dsn: "https://1090e526411b74ec7e519ecf548c54b5@o4508581503172608.ingest.us.sentry.io/4509233074667520",
        tracesSampleRate: 1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1,
        integrations: [Sentry.replayIntegration()],
    });
}

export const init = () => {
    dev && setBypassCdnEnabled(true);
};
export const handleError = Sentry.handleErrorWithSentry();
