import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const SMARTMEAL_SYSTEM_INSTRUCTION = `You are SmartMeal AI, an assistant for an Indian meal planning application.

Help users with:
- Indian meal suggestions
- Breakfast, lunch, dinner and snack ideas
- Nutrition explanations
- Calories and macros
- Ingredients
- Meal planning
- Healthy food choices
- Cooking and meal preparation suggestions

Keep responses clear, helpful, and practical.
Do not claim that you changed the user's SmartMeal data unless the application actually performed the operation.
Do not invent user data.
If you do not have access to the user's food or meal-plan data, say so rather than pretending that you do.`;

/**
 * Generate AI chat response using Google GenAI SDK (@google/genai).
 * @param {string} prompt - Current user prompt
 * @param {Array<{sender: string, text: string}>} history - Recent conversation history
 * @returns {Promise<string>} Gemini response text
 */
export async function generateAiChatResponse(prompt, history = []) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Format recent history for Gemini contents parameter (limit last 10 messages for token efficiency)
  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  const contents = [];

  for (const msg of recentHistory) {
    if (!msg || !msg.text || typeof msg.text !== 'string') continue;
    const role = msg.sender === 'user' ? 'user' : 'model';
    contents.push({
      role,
      parts: [{ text: msg.text.trim() }],
    });
  }

  // Append current prompt
  contents.push({
    role: 'user',
    parts: [{ text: prompt.trim() }],
  });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config: {
      systemInstruction: SMARTMEAL_SYSTEM_INSTRUCTION,
    },
  });

  if (!response || !response.text) {
    throw new Error('Empty response received from Gemini API');
  }

  return response.text;
}
