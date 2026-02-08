
import { GoogleGenAI } from "@google/genai";

// Use the API key directly from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getClinicalAdvice = async (patientData: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      // Use gemini-3-pro-preview for complex medical reasoning tasks
      model: 'gemini-3-pro-preview',
      contents: `Eres un asistente experto en medicina estética y neurología especializado en toxina botulínica. 
      Analiza los siguientes datos del paciente: ${patientData}. 
      Pregunta del médico: ${prompt}. 
      Responde de forma concisa y profesional, siempre aclarando que es una sugerencia basada en guías generales.`,
      config: {
        systemInstruction: "You are a professional medical assistant for botulinum toxin treatments. Keep responses clinical, safe, and helpful.",
      },
    });
    // Use the .text property directly to get the response string
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lo siento, no pude procesar la consulta clínica en este momento.";
  }
};
