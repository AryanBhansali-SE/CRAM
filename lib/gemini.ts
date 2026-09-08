import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

export async function embed(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return result.embeddings![0].values!;
}

export async function askLLM(prompt: string): Promise<string> {
    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });
    return result.text!;
}
