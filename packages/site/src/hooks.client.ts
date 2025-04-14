import { dev } from "$app/environment";
import { setBypassCdnEnabled } from "lib";

export const init = () => {
    dev && setBypassCdnEnabled(true);
};
