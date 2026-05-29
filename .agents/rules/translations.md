# Translations And Paraglide

This project uses Paraglide JS with locale files under `packages/site/messages`.

## Context Safety

The locale JSON files are large. The generated Paraglide output is larger. Reading them broadly can consume the agent context and cause unproductive loops.

Do not:

- Open every locale file to inspect key parity.
- Read `packages/site/src/lib/paraglide`.
- Use broad searches that dump large translation payloads into the session.
- Manually compare locales by pasting file contents into the session.

## Preferred Workflow

Use the local `i18n-json` MCP tool when available.

1. Query only the specific key or locale needed.
2. Use the tool to check missing or extra keys across locales.
3. Add, update, or remove translations through the tool.
4. Validate with `npm run check --workspace=@project/site`.

If the tool is unavailable, use targeted scripts or JSON queries that summarize keys only, not full values. Edit the smallest necessary set of locale entries.

## Translation Semantics

English is the source locale.

This site is about Steam and video game achievements. Translate terms in the context of games and Steam, not as generic dictionary terms. If Steam or the target language's gaming community uses a specific localized term, prefer that.

Use recognizable localized names for well-known proper nouns when they exist.

String key naming:

- Page strings should use a page prefix such as `about.` or `home.`.
- Metadata strings should use names such as `page.meta.title`.
- Component or section strings should use the component or section prefix.
- Reused strings should use the least specific accurate prefix.
