import {
  getAuthUrl,
  handleOAuthCallback,
  getUserGoogleTokens,
  syncShoppingToGoogle,
} from '../services/googleService.js';
import {
  getPlanByDateForUser,
  updatePlanShoppingForUser,
} from '../services/dynamoDbService.js';

/**
 * GET /api/google/auth-url
 * Returns Google OAuth consent URL.
 */
export async function getGoogleAuthUrl(req, res, next) {
  try {
    const userId = req.user.sub;
    const url = getAuthUrl(userId);
    console.log(`[GoogleController] Generated auth URL for user: ${userId}`);
    res.status(200).json({ success: true, url });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/google/status
 * Checks if the user has authorized Google Calendar & Tasks.
 */
export async function getGoogleStatus(req, res, next) {
  try {
    const userId = req.user.sub;
    const tokens = await getUserGoogleTokens(userId);
    res.status(200).json({
      success: true,
      connected: !!tokens,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/google/callback
 * Exchanges authorization code for Google tokens.
 */
export async function handleGoogleCallback(req, res, next) {
  try {
    const userId = req.user.sub;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'Authorization code is required', code: 'BAD_REQUEST' },
      });
    }

    const tokens = await handleOAuthCallback(userId, code);
    console.log(`[GoogleController] Successfully stored Google tokens for user ${userId}`);
    res.status(200).json({
      success: true,
      connected: true,
      tokens,
    });
  } catch (err) {
    console.error('[GoogleController Callback Error]:', err);
    next(err);
  }
}

/**
 * POST /api/google/sync-shopping
 * Saves ingredient availability statuses to DynamoDB and syncs NOT_AVAILABLE items to Google Calendar & Tasks.
 */
export async function syncShopping(req, res, next) {
  try {
    const userId = req.user.sub;
    const { planId, date, shoppingItems } = req.body;

    if (!planId || !date || !Array.isArray(shoppingItems)) {
      return res.status(400).json({
        success: false,
        error: { message: 'planId, date, and shoppingItems array are required', code: 'BAD_REQUEST' },
      });
    }

    // 1. Fetch current plan item from DynamoDB
    const items = await getPlanByDateForUser(userId, date);
    const planItem = items.find((i) => i.planId === planId || i.id === planId);

    if (!planItem) {
      return res.status(404).json({
        success: false,
        error: { message: `Plan item ${planId} not found on date ${date}`, code: 'NOT_FOUND' },
      });
    }

    // 2. Identify ingredients marked NOT AVAILABLE
    const notAvailableIngredients = shoppingItems
      .filter((item) => item.status === 'not_available')
      .map((item) => item.name);

    // 3. Sync to Google Calendar & Tasks if user has connected Google account
    let googleCalendarEventId = planItem.shopping?.googleCalendarEventId || null;
    let googleTaskId = planItem.shopping?.googleTaskId || null;
    let syncResult = null;
    let googleError = null;

    const userTokens = await getUserGoogleTokens(userId);
    if (userTokens) {
      try {
        syncResult = await syncShoppingToGoogle(userId, planItem, notAvailableIngredients);
        googleCalendarEventId = syncResult.googleCalendarEventId;
        googleTaskId = syncResult.googleTaskId;
      } catch (err) {
        console.error('[Google Sync Execution Error]:', err);
        googleError = err.message || 'Failed to sync with Google Calendar/Tasks';
      }
    } else {
      console.warn(`[GoogleSync] User ${userId} has not connected Google account yet.`);
      googleError = 'Google Calendar & Tasks is not connected. Please click "Connect Google" to authorize sync.';
    }

    // 4. Save updated shopping state & Google IDs to DynamoDB
    const updatedPlanItem = await updatePlanShoppingForUser(userId, date, planId, {
      items: shoppingItems,
      googleCalendarEventId,
      googleTaskId,
    });

    res.status(200).json({
      success: true,
      data: updatedPlanItem,
      googleConnected: !!userTokens,
      syncResult,
      googleError,
    });
  } catch (err) {
    next(err);
  }
}
