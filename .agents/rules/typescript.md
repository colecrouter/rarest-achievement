# TypeScript Rules

## Runtime Compatibility

CI currently runs Node 22, and production runs on Cloudflare Workers plus modern browsers. Do not assume a newer JavaScript feature is valid everywhere unless the target runtime supports it.

Modern iterator helpers and set composition methods can be useful, but check runtime support before using them in shared code.

## Style

Prefer existing local patterns. Use type narrowing and precise types over assertions when practical.

Avoid introducing `any` as a shortcut. If an external API or framework boundary requires an escape hatch, keep it localized and explain the boundary.

