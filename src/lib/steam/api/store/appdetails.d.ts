// https://github.com/Revadike/InternalSteamWebAPI/wiki/Get-App-Details

export type GetAppDetailsQuery = {
    appids: string;
    filters?: string;
    cc?: string; // ISO 3166-1 alpha-2 country code
    l?: string; // Language code
};

/**
 * Rate limit: 200 requests per 5 minutes
 * Path: /appdetails/:appid
 */
export type GetAppDetailsResponse = Record<
    string,
    {
        success: boolean;
        data: {
            type: "game" | "dlc" | "demo" | "advertising" | "mod" | "video";
            name: string;
            steam_appid: number;
            required_age: number;
            controller_support?: "partial" | "full"; // Whether the app has controller support
            is_free: boolean;
            dlc?: number[]; // Array of Steam AppIDs
            detailed_description: string; // A detailed description of the app, in HTML
            about_the_game: string; // About the game, in HTML
            short_description: string; // A short description of the app, in HTML
            fullgame?: Array<{
                appid: number | null; // The Steam AppIDs
                name: string; // The app name
            }>;
            supported_languages: string; // Supported languages, in HTML
            header_image: string; // URL to the app header image
            website: string;
            pc_requirements: {
                minimum: string; // The minimum PC requirements, in HTML
                recommended?: string; // The recommended PC requirements, in HTML
            };
            mac_requirements: {
                minimum: string; // The minimum Mac requirements, in HTML
                recommended?: string; // The recommended Mac requirements, in HTML
            };
            linux_requirements: {
                minimum: string; // The minimum Linux requirements, in HTML
                recommended?: string; // The recommended Linux requirements, in HTML
            };
            legal_notice: string;
            developers: string[];
            publishers: string[];
            demos?: Array<{
                appid: number; // The Steam AppIDs of the demo
                description: string; // To note the demo's restrictions
            }>;
            price_overview?: {
                currency: string; // Currency prices are denoted in
                initial: number; // Pre-discount price
                final: number; // Post-discount price
                discount_percent: number; // Discount percentage
                initial_formatted: string;
                final_formatted: string;
            };
            packages: number[]; // Array of Steam Package IDs
            package_groups: Array<{
                name: "default" | "subscriptions";
                title: string;
                description: string;
                selection_text: string; // If display_type is 1, this describes what the subs represent
                save_text: string; // Marketing text about the massive savings you'll get!
                display_type: 0 | 1; // Numeric value noting how it should be displayed on store pages
                is_recurring_subscription: string;
                subs: Array<{
                    packageid: number;
                    percent_savings_text: string;
                    percent_savings: number;
                    option_text: string;
                    option_description: string;
                    can_get_free_license: string;
                    is_free_license: boolean;
                    price_in_cents_with_discount: number;
                }>;
            }>;
            platforms: {
                windows: boolean;
                mac: boolean;
                linux: boolean;
            };
            metacritic?: {
                score: number;
                url: string;
            };
            categories?: Array<{
                id: number;
                description: string;
            }>;
            genres?: Array<{
                id: string;
                description: string;
            }>;
            screenshots?: Array<{
                id: number;
                path_thumbnail: string; // URL to thumbnail image
                path_full: string; // URL to full image
            }>;
            movies?: Array<{
                id: number;
                name: string;
                thumbnail: string;
                webm: {
                    480: string; // URL of 480p video, in webm format
                    max: string; // URL of max-quality video, in webm format
                };
                mp4: {
                    480: string; // URL of 480p video, in mp4 format
                    max: string; // URL of max-quality video, in mp4 format
                };
                highlight: boolean;
            }>;
            recommendations?: {
                total: number;
            };
            achievements?: {
                total: number;
                highlighted: Array<{
                    name: string;
                    path: string; // URL to achievement icon
                }>;
            };
            release_date: {
                coming_soon: boolean; // true if unreleased, false if released
                date: string; // Format is localized, according to the cc parameter passed. Is an empty string when date is unannounced
            };
            support_info: {
                url: string;
                email: string;
            };
            background: string;
            content_descriptors: {
                ids: number[];
                notes: string;
            };
        };
    }
> | null;
