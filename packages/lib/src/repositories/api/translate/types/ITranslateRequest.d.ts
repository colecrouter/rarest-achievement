import type { LanguageCode } from "../../../../lang";

export interface ITranslateRequest {
	/** Text to translate */
	q: string[];
	/** Required target language, e.g. "fr" */
	target: LanguageCode;
}
