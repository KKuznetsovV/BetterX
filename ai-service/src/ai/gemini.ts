import config from 'config'

interface GeminiInlineData {
	data?: string
	mimeType?: string
}

interface GeminiContentPart {
	inlineData?: GeminiInlineData
}

interface GeminiGenerateContentResult {
	candidates?: Array<{
		content?: {
			parts?: GeminiContentPart[]
		}
	}>
}

interface GeminiClient {
	models: {
		generateContent: (payload: {
			model: string
			contents: Array<{ role: string; parts: Array<{ text: string }> }>
			config: { responseModalities: string[] }
		}) => Promise<GeminiGenerateContentResult>
	}
}

let geminiPromise: Promise<GeminiClient> | null = null

export async function getGemini(): Promise<GeminiClient> {
	if (!geminiPromise) {
		geminiPromise = import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: config.get<string>('gemini.apiKey') }) as GeminiClient)
	}

	return geminiPromise
}
