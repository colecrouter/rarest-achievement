export interface IDetectLanguageResponse {
    data: {
        detections: Array<
            Array<{
                language: string;
                confidence: number;
            }>
        >;
    };
}
