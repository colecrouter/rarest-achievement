let bypassCdn = false;

/**
 * This overwrites all CDN urls with "http://localhost:5173/image/*"
 */
export function setBypassCdnEnabled(value: boolean): void {
    bypassCdn = value;
}

export function isBypassCdnEnabled(): boolean {
    return bypassCdn;
}
