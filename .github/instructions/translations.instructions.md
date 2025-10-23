---
applyTo: "**/messages/*.json,**/*.svelte"
description: Instructions for translating localization files in this project.
---

This project uses [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) for localization.

## Important Files

- `packages/site/messages`: Contains localization files for the main website.
- `packages/site/project.inlang/settings.json`: Configuration file for localization settings.

## Rules for Translation

When translating localization files, note the following:

- This project is based around finding "achievements" in "video games"
  - All related terms should be translated in the context of video games, not a direct translation.
    - If there is slang or specific terms used to describe something (specific to the gaming community), use those terms.
  - This site related to Steam (Valve Corporation), so if there are translated terms that are used in the Steam client, they should be used here as well.
- When naming strings:
  - If the file is a reusable component (e.g. "$lib/") prefix it with "componentNameX" (e.g. "toolbarInputPlaceholder").
  - If the file is a page, prefix it with "pageNamePageX" (e.g. "homePageTitle").
    - For metadata (both OG and meta), use "pageNamePageXMeta" (e.g. "homePageMetaDescription").
- Terms like "Player Count", "Rarity", "Unlocked" are meant to be "sorting methods", aka "number of players who have this achievement", "percentage of players who have this achievement", and "when did I unlock this achievement".
- For the "loading screen" messages:
  - Be culturally accurate. For example, "The Name's Bond... James Bond" is a reference to the James Bond movies, so it should be translated such that it is recognizable to the target audience.

**Super Important:** If any title/property/person/proper noun (e.g., "Gordon Freeman", "Super Mario Bros", "The Legend of Zelda") has a recognizable translated/localized name, use that name (e.g., スーパーマリオブラザーズ)
