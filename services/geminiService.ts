import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, StressLevel } from '../types';

const ai = new GoogleGenAI({ apiKey: "AIzaSyDOQmy085cvVN1kBEYEjVyDmFcGyHMk76A" });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        stressLevel: {
            type: Type.STRING,
            enum: Object.values(StressLevel),
            description: 'The predicted stress level.'
        },
        confidenceScore: {
            type: Type.INTEGER,
            description: 'A confidence score for the prediction, from 0 to 100.'
        },
        explanation: {
            type: Type.STRING,
            description: 'A brief explanation of why this stress level was predicted, based on tone and keywords.'
        },
        stressfulKeywords: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    word: {
                        type: Type.STRING,
                        description: "A stressful word or phrase from the text."
                    },
                    intensity: {
                        type: Type.INTEGER,
                        description: "A score from 1 (mild) to 10 (extreme) indicating the word's contribution to the stress level."
                    }
                },
                required: ['word', 'intensity']
            },
            description: 'A list of stressful keywords, each with a stress intensity score.'
        },
        suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'If the stress level is high, provide 2-3 actionable suggestions for stress reduction. Otherwise, return an empty array.'
        },
        reasoningScores: {
            type: Type.OBJECT,
            properties: {
                negativeWordScore: {
                    type: Type.INTEGER,
                    description: "A score from 0 to 100 indicating the density and severity of negative words."
                },
                emotionalTone: {
                    type: Type.INTEGER,
                    description: "A score from -100 (very negative) to 100 (very positive) representing the overall emotional tone."
                },
                cognitiveOverloadIndex: {
                    type: Type.INTEGER,
                    description: "A score from 0 to 100 indicating cognitive load, based on sentence complexity, repetition, and confusion markers."
                }
            },
            required: ['negativeWordScore', 'emotionalTone', 'cognitiveOverloadIndex'],
            description: 'A detailed breakdown of numerical indicators for the analysis.'
        }
    },
    required: ['stressLevel', 'confidenceScore', 'explanation', 'stressfulKeywords', 'suggestions', 'reasoningScores']
};

export const analyzeStress = async (text: string): Promise<AnalysisResult> => {
    try {
        const prompt = `First, automatically detect the language of the following text from these options: English, Hindi, Tamil.

        Then, analyze the text in its detected language to determine the user's stress level based on its sentiment and emotional keywords.

        Text: "${text}"
        
        Provide a detailed reasoning section with numerical indicators:
        - "negativeWordScore": A score from 0 to 100 indicating the density and severity of negative words.
        - "emotionalTone": A score from -100 (very negative) to 100 (very positive) representing the overall emotional tone.
        - "cognitiveOverloadIndex": A score from 0 to 100 indicating cognitive load, based on sentence complexity, repetition, and confusion markers.

        Identify stressful keywords and assign an intensity score from 1 (mildly stressful) to 10 (highly stressful) for each keyword, reflecting its contribution to the overall stress level.

        Provide your analysis in a JSON format. The JSON object must conform to the schema provided. Do not include any introductory text or markdown formatting in your response. Only return the valid JSON object.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        // Basic validation
        if (!result.stressLevel || !Object.values(StressLevel).includes(result.stressLevel)) {
            throw new Error('Invalid stressLevel in response');
        }
        if (!result.reasoningScores) {
            throw new Error('Missing reasoningScores in response');
        }

        return result as AnalysisResult;

    } catch (error) {
        console.error("Error analyzing stress:", error);
        throw new Error("Failed to analyze stress level. The API may be unavailable or the response was invalid.");
    }
};