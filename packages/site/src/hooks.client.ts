import { dev } from "$app/environment";
import { setBypassCdnEnabled } from "@project/lib";

export const init = () => {
    dev && setBypassCdnEnabled(true);
};
