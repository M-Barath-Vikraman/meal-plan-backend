import { generateAiChatResponse } from '../services/geminiService.js';

/**
 * POST /api/ai/chat
 * Handles user chat input and returns Gemini-generated response.
 */
export async function handleAiChat(req, res, next) {
  try {
    const { message, history } = req.body;

    // Validation: Trim whitespace & check message presence
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Message text is required and cannot be empty', code: 'BAD_REQUEST' },
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 2000) {
      return res.status(400).json({
        success: false,
        error: { message: 'Message exceeds maximum length of 2000 characters', code: 'BAD_REQUEST' },
      });
    }

    console.log(`[AiController] Received user prompt from ${req.user?.sub || 'user'}: "${trimmedMessage.slice(0, 50)}..."`);

    try {
      const reply = await generateAiChatResponse(trimmedMessage, history);
      return res.status(200).json({
        success: true,
        reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (geminiError) {
      console.error('[AiController Gemini Error]:', geminiError);
      return res.status(500).json({
        success: false,
        error: {
          message: "Sorry, I couldn't generate a response right now. Please try again.",
          code: 'GEMINI_ERROR',
        },
      });
    }
  } catch (err) {
    next(err);
  }
}
