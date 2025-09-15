export interface ITranslateResponse {
	data: {
		translations: Array<{
			translatedText: string;
			detectedSourceLanguage?: string;
		}>;
	};
}
