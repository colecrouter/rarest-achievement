---
applyTo: "**/messages/*.json,**/*.svelte"
description: Instructions for translating localization files in this project.
---

This project uses [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) for localization.

## Important Notes

- Paraglide JS compiles files at build time
- Do not manually edit localization files unless absolutely necessary; use the provided MCP tool instead.
- Always use `context7` to retrieve the documentation. Do not start guessing when you are unsure. Do not start scanning for existing code to find examples.

## Basic Usage

```js
// Language is automatically set by SvelteKit hooks
import { m } from "$lib/i18n/runtime.js";

console.log(m("yourTranslationKeyHere")); // Automatically translated!
// Refer to `context7` documentation for more advanced usage.
```

## Important Files

- `packages/site/messages`: Contains localization files for the main website.
- `packages/site/project.inlang/settings.json`: Configuration file for localization settings.
- `packages/site/src/lib/paraglide`: Compiled files **do not attempt to read these**

**DO NOT READ ANYTHING IN `packages/site/src/lib/paraglide` UNDER ANY CIRCUMSTANCES!**

## Tools

Included is a `i18n-json` MCP tool. It provides direct access to the localization files.

- View existing locales.
- Add/update/remove translations.
- Check for missing or extra keys across locales.

Prefer this tool over manually editing localization files in most cases, as viewing more than one will exceed your context window. Note that changes in the above places may be required if adding or removing locales.

## Rules for Translation

When translating localization files, note the following:

- This project is based around finding "achievements" in "video games"
  - All related terms should be translated in the context of video games, not a direct translation.
    - If there is slang or specific terms used to describe something (specific to the gaming community), use those terms.
  - This site related to Steam (Valve Corporation), so if there are translated terms that are used in the Steam client, they should be used here as well.
- When naming strings:
  - If the string belongs to a page, prefix it with "about.", home.", etc.
    - For metadata (both OG and meta), use "page.meta.title"
  - If the string is part of a component or section, prefix it with that component/section name.
  - If the string is reused across multiple pages/components, pick the least specific prefix (or none at all).
- Terms like "Player Count", "Rarity", "Unlocked" are meant to be "sorting methods", aka "number of players who have this achievement", "percentage of players who have this achievement", and "when did I unlock this achievement".
- For the "loading screen" messages:
  - Be culturally accurate. For example, "The Name's Bond... James Bond" is a reference to the James Bond movies, so it should be translated such that it is recognizable to the target audience.

**Super Important:** If any title/property/person/proper noun (e.g., "Gordon Freeman", "Super Mario Bros", "The Legend of Zelda") has a recognizable translated/localized name, use that name (e.g., スーパーマリオブラザーズ)
