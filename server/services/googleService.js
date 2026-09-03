import { google } from 'googleapis';
import { docClient, PLANS_TABLE } from '../config/aws.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/oauth2callback';

export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/**
 * Generate Google OAuth 2.0 authorization URL for Calendar & Tasks.
 */
export function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/tasks',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: state || '',
  });
}

/**
 * Retrieve stored Google tokens for a user from DynamoDB smartmeal-plans.
 */
export async function getUserGoogleTokens(userId) {
  try {
    const command = new GetCommand({
      TableName: PLANS_TABLE,
      Key: {
        userId,
        planKey: 'USER#GOOGLE_TOKENS',
      },
    });

    const response = await docClient.send(command);
    if (response.Item && response.Item.tokens) {
      return response.Item.tokens;
    }
  } catch (err) {
    try {
      const fallbackCmd = new GetCommand({
        TableName: PLANS_TABLE,
        Key: {
          Userid: userId,
          planKey: 'USER#GOOGLE_TOKENS',
        },
      });
      const response = await docClient.send(fallbackCmd);
      if (response.Item && response.Item.tokens) {
        return response.Item.tokens;
      }
    } catch (e) {
      console.error('[getUserGoogleTokens] Error fetching tokens:', e);
    }
  }
  return null;
}

/**
 * Save Google OAuth tokens for a user to DynamoDB smartmeal-plans.
 */
export async function saveUserGoogleTokens(userId, tokens) {
  const item = {
    userId,
    Userid: userId,
    planKey: 'USER#GOOGLE_TOKENS',
    tokens,
    updatedAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: PLANS_TABLE,
    Item: item,
  });

  await docClient.send(command);
  console.log(`[GoogleAuth] Stored OAuth tokens for user: ${userId}`);
}

/**
 * Exchange auth code for tokens and save for user.
 */
export async function handleOAuthCallback(userId, code) {
  console.log(`[GoogleAuth] Exchanging auth code for tokens (User: ${userId})...`);
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await saveUserGoogleTokens(userId, tokens);
  return tokens;
}

/**
 * Get an authenticated Google API OAuth2 client instance for a user.
 */
export async function getAuthenticatedClient(userId) {
  const tokens = await getUserGoogleTokens(userId);
  if (!tokens) {
    throw new Error('Google account not connected');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Automatically refresh and save updated tokens if expired
  oauth2Client.on('tokens', (newTokens) => {
    console.log(`[GoogleAuth] Refreshing tokens for user: ${userId}`);
    saveUserGoogleTokens(userId, {
      ...tokens,
      ...newTokens,
    }).catch((err) => console.error('Failed to save refreshed tokens:', err));
  });

  return oauth2Client;
}

/**
 * Helper to compute next day date string (YYYY-MM-DD) for Google Calendar all-day event end date.
 */
function getNextDayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Sync shopping items to Google Calendar and Google Tasks.
 * Rule: ONLY NOT_AVAILABLE ingredients are added to Calendar and Tasks.
 */
export async function syncShoppingToGoogle(userId, planItem, notAvailableIngredients) {
  console.log(`[GoogleSync] Starting sync for plan ${planItem.planId} (User: ${userId})...`);
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const tasks = google.tasks({ version: 'v1', auth });

  const mealName = planItem.name || 'Meal';
  const mealType = planItem.mealType || 'Meal';
  const dateStr = planItem.date; // YYYY-MM-DD
  const nextDateStr = getNextDayStr(dateStr);

  const existingCalendarEventId = planItem.shopping?.googleCalendarEventId;
  const existingTaskId = planItem.shopping?.googleTaskId;

  let newCalendarEventId = existingCalendarEventId || null;
  let newTaskId = existingTaskId || null;

  // Case 1: All ingredients are available (no missing items to buy)
  if (!notAvailableIngredients || notAvailableIngredients.length === 0) {
    console.log('[GoogleSync] All items available. Cleaning up any existing Google entries...');
    if (existingCalendarEventId) {
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: existingCalendarEventId,
        });
        console.log(`[GoogleSync] Deleted Google Calendar Event: ${existingCalendarEventId}`);
      } catch (err) {
        console.warn('[GoogleSync] Could not delete calendar event:', err.message);
      }
      newCalendarEventId = null;
    }

    if (existingTaskId) {
      try {
        await tasks.tasks.delete({
          tasklist: '@default',
          task: existingTaskId,
        });
        console.log(`[GoogleSync] Deleted Google Task: ${existingTaskId}`);
      } catch (err) {
        console.warn('[GoogleSync] Could not delete google task:', err.message);
      }
      newTaskId = null;
    }

    return {
      googleCalendarEventId: null,
      googleTaskId: null,
      syncedCount: 0,
      message: 'All items marked Available. Existing Google entries removed.',
    };
  }

  // Case 2: There are NOT_AVAILABLE ingredients to buy
  const ingredientListFormatted = notAvailableIngredients.map((item) => `- ${item}`).join('\n');
  const eventTitle = `Shopping - ${mealType} - ${mealName}`;
  const eventDescription = `Ingredients to buy for ${mealName} (${mealType}):\n\n${ingredientListFormatted}`;

  // 1. Manage Google Calendar Event
  const eventBody = {
    summary: eventTitle,
    description: eventDescription,
    start: { date: dateStr },
    end: { date: nextDateStr },
  };

  if (existingCalendarEventId) {
    try {
      console.log(`[GoogleSync] Patching Google Calendar Event ${existingCalendarEventId}...`);
      const updatedEvent = await calendar.events.patch({
        calendarId: 'primary',
        eventId: existingCalendarEventId,
        requestBody: eventBody,
      });
      newCalendarEventId = updatedEvent.data.id;
    } catch (err) {
      console.warn('[GoogleSync] Failed to update event, creating new event:', err.message);
      const newEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventBody,
      });
      newCalendarEventId = newEvent.data.id;
    }
  } else {
    console.log('[GoogleSync] Creating new Google Calendar Event...');
    const newEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });
    newCalendarEventId = newEvent.data.id;
    console.log(`[GoogleSync] Created Google Calendar Event ID: ${newCalendarEventId}`);
  }

  // 2. Manage Google Task
  const taskTitle = `Buy ingredients for ${mealType} - ${mealName}`;
  const taskNotes = `Ingredients to buy:\n${ingredientListFormatted}`;
  const taskDueDate = `${dateStr}T00:00:00.000Z`;

  const taskBody = {
    title: taskTitle,
    notes: taskNotes,
    due: taskDueDate,
  };

  if (existingTaskId) {
    try {
      console.log(`[GoogleSync] Patching Google Task ${existingTaskId}...`);
      const updatedTask = await tasks.tasks.patch({
        tasklist: '@default',
        task: existingTaskId,
        requestBody: taskBody,
      });
      newTaskId = updatedTask.data.id;
    } catch (err) {
      console.warn('[GoogleSync] Failed to update task, creating new task:', err.message);
      const newTask = await tasks.tasks.insert({
        tasklist: '@default',
        requestBody: taskBody,
      });
      newTaskId = newTask.data.id;
    }
  } else {
    console.log('[GoogleSync] Creating new Google Task...');
    const newTask = await tasks.tasks.insert({
      tasklist: '@default',
      requestBody: taskBody,
    });
    newTaskId = newTask.data.id;
    console.log(`[GoogleSync] Created Google Task ID: ${newTaskId}`);
  }

  return {
    googleCalendarEventId: newCalendarEventId,
    googleTaskId: newTaskId,
    syncedCount: notAvailableIngredients.length,
    message: `Successfully synced ${notAvailableIngredients.length} item(s) to Google Calendar & Tasks!`,
  };
}
