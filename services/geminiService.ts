import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIAnalysis, ChatMessage } from "../types";
import { config } from "../config";

const API_KEY = config.GEMINI_API_KEY;
const MAX_FILE_SIZE_MB = 15; // Gemini safe limit
const CHUNK_DURATION_SEC = 600; // 10 minutes per chunk

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

import { blobToBase64 } from "../utils";

/**
 * Estimates audio file size from base64 string
 */
const estimateFileSizeMB = (base64: string): number => {
  const sizeBytes = (base64.length * 3) / 4; // Base64 encoding overhead
  return sizeBytes / (1024 * 1024);
};

/**
 * Splits base64 audio into manageable chunks based on duration
 * Note: This is a simplistic split. Ideally, we'd use FFmpeg or similar.
 */
const splitAudioBase64 = (base64: string, numChunks: number): string[] => {
  const chunkSize = Math.ceil(base64.length / numChunks);
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, base64.length);
    chunks.push(base64.slice(start, end));
  }

  return chunks;
};

/**
 * Merges multiple analysis results into one cohesive result
 */
const mergeAnalysisResults = (results: AIAnalysis[]): AIAnalysis => {
  if (results.length === 0) {
    throw new Error("No analysis results to merge");
  }

  if (results.length === 1) {
    return results[0];
  }

  // Merge transcripts in order
  const mergedTranscript = results.flatMap(r => r.transcript || []);

  // Combine summaries
  const mergedSummary = results.flatMap(r => r.summary || []);

  // Combine action items and dedupe
  const mergedActions = [...new Set(results.flatMap(r => r.actionItems || []))];

  // Combine tags and dedupe
  const mergedTags = [...new Set(results.flatMap(r => r.tags || []))];

  // Use first result's title and category (could be smarter)
  return {
    title: results[0].title,
    category: results[0].category,
    summary: mergedSummary.slice(0, 10), // Limit to 10 key points
    actionItems: mergedActions.slice(0, 10),
    tags: mergedTags.slice(0, 8),
    transcript: mergedTranscript
  };
};

/**
 * Analyzes a single audio chunk
 */
const analyzeChunk = async (
  base64Audio: string,
  chunkIndex: number,
  totalChunks: number,
  markersCount: number
): Promise<AIAnalysis> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp"
  });

  const prompt = `
    Actúa como un asistente experto en documentación para "Asesorías Étnicas", una organización dedicada a apoyar comunidades indígenas y preservar su cultura.
    
    Estás procesando el SEGMENTO ${chunkIndex + 1} de ${totalChunks} de una grabación larga.
    
    Por favor, procesa este segmento de audio y devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin explicaciones adicionales) con esta estructura exacta:
    
    {
      "title": "Título para este segmento (en Español)",
      "category": "Categoría (ej. Asamblea, Legal, Cultural, Territorio, Educación)",
      "tags": ["etiqueta1", "etiqueta2", "etiqueta3"],
      "summary": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "actionItems": ["Tarea 1", "Tarea 2"],
      "transcript": [
        {"speaker": "Hablante A", "text": "Texto transcrito", "timestamp": "00:00"}
      ]
    }
    
    ${markersCount > 0 ? `El usuario marcó ${markersCount} momentos importantes durante toda la grabación.` : ''}
    Asegúrate de que el tono sea respetuoso y profesional.
    
    IMPORTANTE: Responde SOLO con el JSON, sin texto adicional antes ni después.
  `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "audio/webm",
        data: base64Audio
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();

  if (!text) throw new Error("No response from AI");

  // Clean potential markdown code blocks
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```json")) {
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.replace(/```\n?/g, '');
  }

  return JSON.parse(cleanedText) as AIAnalysis;
};

export const analyzeAudio = async (
  segments: Blob[],
  markersCount: number,
  onProgress?: (current: number, total: number) => void
): Promise<AIAnalysis> => {
  if (!API_KEY) {
    throw new Error("Falta la API Key.");
  }

  const numChunks = segments.length;
  console.log(`[Gemini] Processing ${numChunks} segments provided by Recorder`);

  const results: AIAnalysis[] = [];

  // Process chunks sequentially to avoid rate limits (15 RPM)
  for (let i = 0; i < numChunks; i++) {
    try {
      if (onProgress) onProgress(i + 1, numChunks);
      console.log(`[Gemini] Processing chunk ${i + 1}/${numChunks}...`);

      // Convert ONLY the current chunk to base64 to save memory
      const base64Chunk = await blobToBase64(segments[i]);

      const result = await analyzeChunk(base64Chunk, i, numChunks, markersCount);
      results.push(result);

      // Force garbage collection of the large string if possible (by scope exit)

      // Wait 4 seconds between chunks to respect rate limits (approx 15 RPM = 1 req every 4s)
      if (i < numChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (error) {
      console.error(`[Gemini] Error processing chunk ${i + 1}:`, error);
      // Retry logic
      try {
        console.log(`[Gemini] Retrying chunk ${i + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        const base64Chunk = await blobToBase64(segments[i]);
        const retryResult = await analyzeChunk(base64Chunk, i, numChunks, markersCount);
        results.push(retryResult);
      } catch (retryError) {
        console.error(`[Gemini] Retry failed for chunk ${i + 1}. Skipping.`);
      }
    }
  }

  if (results.length === 0) {
    throw new Error("Failed to analyze any chunks.");
  }

  try {
    console.log(`[Gemini] Successfully analyzed ${results.length}/${numChunks} chunks`);
    return mergeAnalysisResults(results);
  } catch (error: any) {
    console.error("Gemini Chunked Analysis Error:", error);
    throw error;
  }
};

export const chatWithMeeting = async (
  analysis: AIAnalysis,
  history: ChatMessage[],
  userMessage: string
): Promise<string> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp"
  });

  // Construct context from analysis
  const context = `
    Estás actuando como un asistente experto que responde preguntas sobre una reunión específica.
    Aquí tienes los detalles de la reunión:
    
    TÍTULO: ${analysis.title}
    CATEGORÍA: ${analysis.category}
    
    RESUMEN:
    ${analysis.summary.join('\n')}
    
    TAREAS:
    ${analysis.actionItems.join('\n')}
    
    TRANSCRIPCIÓN (fragmento):
    ${analysis.transcript.slice(0, 50).map(t => `${t.speaker}: ${t.text}`).join('\n')}
    ... (transcripción truncada para brevedad si es muy larga)
  `;

  // Construct chat history for the prompt
  const chatHistory = history.map(msg =>
    `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`
  ).join('\n');

  const prompt = `
    ${context}

    HISTORIAL DE CHAT:
    ${chatHistory}
    
    USUARIO: ${userMessage}
    
    ASISTENTE (Responde de manera concisa, útil y basada SOLO en la información de la reunión):
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text) throw new Error("No response from AI");
  return text.trim();
};