import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Load Paraglide/Inlang settings
const { default: ParaglideConfig } = await import("../../packages/site/project.inlang/settings.json", {
	with: { type: "json" },
});
const pathPattern = ParaglideConfig["plugin.inlang.messageFormat"].pathPattern;
const LOCALES = ParaglideConfig.locales as string[];
if (!Array.isArray(LOCALES) || LOCALES.length === 0) {
	throw new Error("No locales defined in Paraglide settings.json");
}

// Path constants

// Resolve based on this file location to avoid CWD issues
const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const SITE_PATH = resolve(__dirname, "../../packages/site");

// Helpers
function getLanguageFilePath(languageCode: string) {
	const placeholder = pathPattern.includes("{locale}") ? "{locale}" : null;
	if (placeholder === null) {
		throw new Error(`Unsupported pathPattern in inlang settings: ${pathPattern}`);
	}
	return join(SITE_PATH, pathPattern.replace(placeholder, languageCode));
}

async function getLanguageCodes() {
	// We return the configured locales without hitting the file system.
	return new Set<string>(LOCALES);
}

async function getTranslationsForLanguage(languageCode: string) {
	// Reads and parses the locale JSON file. We enforce:
	// - ENOENT -> throw explicit error (caller decides how to surface)
	// - Invalid JSON -> throw explicit error including filename
	// - Values are treated as strings; other types are ignored by design
	const filePath = getLanguageFilePath(languageCode);
	try {
		const fileContent = await readFile(filePath, "utf-8");
		const json = JSON.parse(fileContent);
		const flattened = flattenObject(json);
		return new Map<string, string>(Object.entries(flattened));
	} catch (err) {
		const error = err as NodeJS.ErrnoException;
		if (error.code === "ENOENT") {
			throw new Error(`Language file not found for locale '${languageCode}' at ${filePath}`);
		}
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in ${filePath}: ${(error as SyntaxError).message}`);
		}
		throw error;
	}
}

async function writeTranslationsForLanguage(languageCode: string, translations: Map<string, string>) {
	const filePath = getLanguageFilePath(languageCode);
	// We intentionally sort keys to produce stable diffs and reduce review noise.
	// We also append a trailing newline to match common editor/formatter defaults.
	const unflattened = unflattenObject(Object.fromEntries(translations));
	const sorted = sortObjectRecursively(unflattened);
	const jsonContent = JSON.stringify(sorted, null, "\t");
	await writeFile(filePath, `${jsonContent}\n`, "utf-8");
}

function flattenObject(obj: unknown, prefix = ""): Record<string, string> {
	const result: Record<string, string> = {};
	// @ts-expect-error -- dynamic object
	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			result[newKey] = value;
		} else if (value && typeof value === "object") {
			Object.assign(result, flattenObject(value, newKey));
		}
	}
	return result;
}

function unflattenObject(flat: Record<string, string>): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(flat)) {
		const parts = key.split(".");
		let current = result;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) throw new Error(`Invalid key with empty part: "${key}"`);
			if (i === parts.length - 1) {
				current[part] = value;
			} else {
				if (typeof current[part] !== "object" || current[part] === null) {
					current[part] = {};
				}
				// @ts-expect-error -- dynamic key
				current = current[part];
			}
		}
	}

	return result;
}

function sortObjectRecursively(obj: unknown): unknown {
	if (Array.isArray(obj)) {
		return obj.map(sortObjectRecursively);
	} else if (obj && typeof obj === "object") {
		const sortedEntries = Object.entries(obj)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => [k, sortObjectRecursively(v)]);
		return Object.fromEntries(sortedEntries);
	}
	return obj; // primitive (string, number, null, etc.)
}

// zod helpers

type ExtractZodObjectShape<T extends Record<string, z.ZodTypeAny>> = {
	[K in keyof T]: z.infer<T[K]>;
};

// const zLocale = z.enum(LOCALES as [string, ...string[]]);
const zLocale = z.string(); // I'm realizing now that I can't use a dynamic array here :/

const SearchI18nInput = {
	languageCode: zLocale.optional(),
	query: z.string().min(1, "query must not be empty").optional(),
};

const SearchI18nOutput = {
	results: z.array(z.object({ languageCode: zLocale, key: z.string(), value: z.string() })),
};

const GetI18nInput = {
	languageCode: zLocale.optional(),
	key: z.string().min(1),
};

const GetI18nOutput = {
	results: z.array(z.object({ languageCode: zLocale, value: z.string() })),
};

const SetI18nInput = {
	updates: z
		.array(
			z.object({
				languageCode: zLocale,
				key: z.string().min(1),
				value: z.string(),
			}),
		)
		.min(1),
};

const SetI18nOutput = {
	updated: z.number().int().nonnegative(),
};

const DeleteI18nInput = {
	languageCode: zLocale.optional(),
	key: z.string().min(1),
};

const DeleteI18nOutput = {
	deleted: z.array(zLocale),
};

const DiffI18nInput = {
	baseLang: zLocale,
	targetLang: z.array(zLocale).optional(),
};

const DiffI18nOutput = {
	diffs: z.record(z.string(), z.object({ missing: z.array(z.string()), extra: z.array(z.string()) })),
};

const ListLocalesInput = undefined;
const ListLocalesOutput = { locales: z.array(zLocale) };

// Methods

async function SearchTranslation(params: ExtractZodObjectShape<typeof SearchI18nInput>) {
	// Case-insensitive substring match on both keys and values.
	// Simplicity > complexity here: message files are small enough to scan fully.
	const { languageCode, query } = params;
	const languageCodes = languageCode ? [languageCode] : Array.from(await getLanguageCodes());

	const q = query?.toLowerCase();
	const results = [];

	for (const code of languageCodes) {
		const allTranslations = await getTranslationsForLanguage(code);
		for (const [key, value] of allTranslations) {
			// If no query provided, return all entries. Otherwise, filter by case-insensitive substring match.
			if (!q || key.toLowerCase().includes(q) || value.toLowerCase().includes(q)) {
				results.push({ languageCode: code, key, value });
			}
		}
	}

	return results;
}

async function GetTranslations({ languageCode, key }: ExtractZodObjectShape<typeof GetI18nInput>) {
	// Returns present values only; does not synthesize fallbacks from base locale.
	// Maintainers can extend this later if fallback behavior is desired.
	const languageCodes = languageCode ? [languageCode] : Array.from(await getLanguageCodes());

	const results: Array<{ languageCode: string; value: string }> = [];

	for (const code of languageCodes) {
		const allTranslations = await getTranslationsForLanguage(code);
		if (allTranslations.has(key)) {
			const v = allTranslations.get(key);
			if (typeof v === "string") {
				results.push({ languageCode: code, value: v });
			}
		}
	}

	return results;
}

async function SetTranslations(params: ExtractZodObjectShape<typeof SetI18nInput>["updates"]) {
	// Batch update: read once per locale, apply all updates in-memory, then write once.
	if (params.length === 0) return 0;
	// Build map of all existing translations
	const allTranslations = new Map<string, Map<string, string>>();
	const languageCodes = new Set<string>(params.map((p) => p.languageCode));
	for (const code of languageCodes) {
		const translations = await getTranslationsForLanguage(code);
		allTranslations.set(code, translations);
	}

	// Update translations
	for (const param of params) {
		const translations = allTranslations.get(param.languageCode);
		if (!translations) throw new Error(`No translations found for language code: ${param.languageCode}`);
		translations.set(param.key, param.value);
	}

	// Write back to files
	for (const [code, translations] of allTranslations) {
		await writeTranslationsForLanguage(code, translations);
	}
	return params.length;
}

async function DeleteTranslations({ languageCode, key }: ExtractZodObjectShape<typeof DeleteI18nInput>) {
	// Idempotent: silently skips locales where the key is absent, returns the
	// list of locales where a deletion actually occurred.
	const languageCodes = languageCode ? [languageCode] : Array.from(await getLanguageCodes());

	const deleted: string[] = [];
	for (const code of languageCodes) {
		const translations = await getTranslationsForLanguage(code);
		if (translations.delete(key)) {
			await writeTranslationsForLanguage(code, translations);
			deleted.push(code);
		}
	}
	return deleted;
}

async function DiffTranslations({ baseLang, targetLang }: ExtractZodObjectShape<typeof DiffI18nInput>) {
	// Compare base -> targets and report keys missing in targets and keys extra in targets.
	// We exclude the base language from targets by default. Output arrays are unsorted to
	// reflect file order; sort upstream if callers need stable ordering.
	const baseTranslations = await getTranslationsForLanguage(baseLang);
	const targetLanguages = targetLang
		? targetLang
		: Array.from(await getLanguageCodes()).filter((code) => code !== baseLang);

	const baseTranslationKeys = new Set(baseTranslations.keys());
	const targetTranslationKeys = new Map<string, Set<string>>();
	for (const code of targetLanguages) {
		const translations = await getTranslationsForLanguage(code);
		targetTranslationKeys.set(code, new Set(translations.keys()));
	}

	const readable = Object.fromEntries(
		[...targetTranslationKeys.entries()].map(([code, keys]) => [
			code,
			{
				missing: [...baseTranslationKeys.difference(keys)],
				extra: [...keys.difference(baseTranslationKeys)],
			},
		]),
	);

	return readable;
}

// Server

const server = new McpServer({
	name: "Inlang i18n Tool",
	version: "0.1.0",
});

// Standardized error handling
// All tools should route errors through this helper for consistent user-facing
// messages and server-side logging. We intentionally do not include stack traces
// in structuredContent; logs are sufficient for debugging while keeping tool
// responses concise for clients.
function toolError(err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	// Optional: log detailed error for debugging
	console.error("[i18nTool] Tool error:", err);
	return {
		content: [{ type: "text" as const, text: `Error: ${message}` }],
		isError: true as const,
	};
}

// 1) Search
server.registerTool(
	"search_i18n",
	{
		title: "Search Translations Keys & Values",
		description:
			"Search for existing translations by key or value. The provided string will be matched as a case-insensitive substring. Omit query to return all entries.",
		inputSchema: SearchI18nInput,
		outputSchema: SearchI18nOutput,
	},
	async ({ languageCode, query }) => {
		try {
			console.log(query);
			const results = await SearchTranslation({ languageCode, query });
			const output = { results };
			return {
				content: [{ type: "text", text: JSON.stringify(output) }],
				structuredContent: output,
			};
		} catch (error) {
			return toolError(error);
		}
	},
);

// 2) Get
server.registerTool(
	"get_i18n",
	{
		title: "Get Translations by Key",
		description: "Get the translations for the given key across locales. Omit languageCode to get _all_ locales.",
		// Using centralized zod schemas keeps handler types in sync with validation.
		inputSchema: GetI18nInput,
		outputSchema: GetI18nOutput,
	},
	async ({ languageCode, key }) => {
		try {
			const results = await GetTranslations({ languageCode, key });
			const output = { results };
			return {
				content: [{ type: "text", text: JSON.stringify(output) }],
				structuredContent: output,
			};
		} catch (error) {
			return toolError(error);
		}
	},
);

// 3) Set
server.registerTool(
	"set_i18n",
	{
		title: "Set/Update Translations",
		description: "Create or update translation values for one or more locales.",
		// Bulk updates are validated as a non-empty array; each item enforces locale+key+value.
		inputSchema: SetI18nInput,
		outputSchema: SetI18nOutput,
	},
	async ({ updates }) => {
		try {
			const updated = await SetTranslations(updates);
			const output = { updated };
			return {
				content: [{ type: "text", text: JSON.stringify(output) }],
				structuredContent: output,
			};
		} catch (error) {
			return toolError(error);
		}
	},
);

// 4) Delete
server.registerTool(
	"delete_i18n",
	{
		title: "Delete Translation(s) by Key",
		description: "Delete the given key for one locale or all locales if not specified.",
		// Idempotent behavior: returns only the locales where a deletion occurred.
		inputSchema: DeleteI18nInput,
		outputSchema: DeleteI18nOutput,
	},
	async ({ languageCode, key }) => {
		try {
			const deleted = await DeleteTranslations({ languageCode, key });
			const output = { deleted };
			return {
				content: [{ type: "text", text: JSON.stringify(output) }],
				structuredContent: output,
			};
		} catch (error) {
			return toolError(error);
		}
	},
);

// 5) Diff
server.registerTool(
	"diff_i18n",
	{
		title: "Diff Translations",
		description: "Compare target locales against a base locale to find missing/extra keys.",
		// Target locales default to all except base. Output is a record keyed by locale.
		inputSchema: DiffI18nInput,
		outputSchema: DiffI18nOutput,
	},
	async ({ baseLang, targetLang }) => {
		try {
			const diffs = await DiffTranslations({ baseLang, targetLang });
			const output = { diffs };
			return {
				content: [{ type: "text", text: JSON.stringify(output) }],
				structuredContent: output,
			};
		} catch (error) {
			return toolError(error);
		}
	},
);

// 6) List locales (utility)
server.registerTool(
	"list_locales",
	{
		title: "List Supported Locales",
		description: "Return the list of locales from inlang settings.json",
		inputSchema: ListLocalesInput,
		outputSchema: ListLocalesOutput,
	},
	async () => {
		const output = { locales: [...LOCALES] };
		return {
			content: [{ type: "text", text: JSON.stringify(output) }],
			structuredContent: output,
		} as const;
	},
);

// Connect via stdio for local usage
const transport = new StdioServerTransport();
await server.connect(transport);
