import { docClient, FOODS_TABLE, PLANS_TABLE } from '../config/aws.js';
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { generateUUID } from '../utils/uuidUtils.js';

/**
 * Fetch all food items for the authenticated Cognito user from DynamoDB.
 */
export async function getFoodsForUser(userId) {
  try {
    const command = new QueryCommand({
      TableName: FOODS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []).map((item) => ({
      id: item.foodId || item.id,
      ...item,
    }));
  } catch (err) {
    if (err.name === 'ValidationException' || err.message?.includes('schema')) {
      const fallbackCmd = new QueryCommand({
        TableName: FOODS_TABLE,
        KeyConditionExpression: 'Userid = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      });
      const response = await docClient.send(fallbackCmd);
      return (response.Items || []).map((item) => ({
        id: item.foodId || item.id,
        ...item,
      }));
    }
    throw err;
  }
}

/**
 * Create a new food item in DynamoDB smartmeal-foods for the authenticated Cognito user.
 * Generates a unique foodId UUID.
 */
export async function createFoodForUser(userId, foodData) {
  const foodId = `food_${generateUUID()}`;
  const timestamp = new Date().toISOString();

  const newFood = {
    userId,
    foodId,
    name: foodData.name,
    mealType: foodData.mealType,
    ingredients: Array.isArray(foodData.ingredients) ? foodData.ingredients : [],
    calories: Number(foodData.calories) || 0,
    protein: foodData.protein || '0g',
    carbs: foodData.carbs || '0g',
    fat: foodData.fat || '0g',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const command = new PutCommand({
    TableName: FOODS_TABLE,
    Item: newFood,
  });

  await docClient.send(command);

  return {
    id: newFood.foodId,
    ...newFood,
  };
}

/**
 * Update an existing food item in DynamoDB smartmeal-foods.
 */
export async function updateFoodForUser(userId, foodId, updateData) {
  const timestamp = new Date().toISOString();
  const existing = await getFoodsForUser(userId);
  const current = existing.find((item) => item.foodId === foodId || item.id === foodId);

  if (!current) {
    return null;
  }

  const updatedItem = {
    ...current,
    userId,
    foodId: current.foodId || foodId,
    name: updateData.name !== undefined ? updateData.name : current.name,
    mealType: updateData.mealType !== undefined ? updateData.mealType : current.mealType,
    ingredients: Array.isArray(updateData.ingredients) ? updateData.ingredients : current.ingredients,
    calories: updateData.calories !== undefined ? Number(updateData.calories) : current.calories,
    protein: updateData.protein !== undefined ? updateData.protein : current.protein,
    carbs: updateData.carbs !== undefined ? updateData.carbs : current.carbs,
    fat: updateData.fat !== undefined ? updateData.fat : current.fat,
    updatedAt: timestamp,
  };

  const putCommand = new PutCommand({
    TableName: FOODS_TABLE,
    Item: updatedItem,
  });

  await docClient.send(putCommand);

  return {
    id: updatedItem.foodId,
    ...updatedItem,
  };
}

/**
 * Delete a food item from DynamoDB smartmeal-foods.
 */
export async function deleteFoodForUser(userId, foodId) {
  const existing = await getFoodsForUser(userId);
  const current = existing.find((item) => item.foodId === foodId || item.id === foodId);

  if (!current) {
    return false;
  }

  const targetFoodId = current.foodId || foodId;

  try {
    const deleteCmd = new DeleteCommand({
      TableName: FOODS_TABLE,
      Key: {
        userId,
        foodId: targetFoodId,
      },
    });
    await docClient.send(deleteCmd);
  } catch (err) {
    const deleteCmd = new DeleteCommand({
      TableName: FOODS_TABLE,
      Key: {
        Userid: userId,
        foodId: targetFoodId,
      },
    });
    await docClient.send(deleteCmd);
  }
  return true;
}

/**
 * Query meal plan items for authenticated user by date from DynamoDB smartmeal-plans.
 */
export async function getPlanByDateForUser(userId, dateStr) {
  const prefix = `DATE#${dateStr}`;
  try {
    const command = new QueryCommand({
      TableName: PLANS_TABLE,
      KeyConditionExpression: 'userId = :userId AND begins_with(planKey, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': prefix,
      },
    });

    const response = await docClient.send(command);
    return response.Items || [];
  } catch (err) {
    if (err.name === 'ValidationException' || err.message?.includes('schema')) {
      const fallbackCmd = new QueryCommand({
        TableName: PLANS_TABLE,
        KeyConditionExpression: 'Userid = :userId AND begins_with(planKey, :prefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':prefix': prefix,
        },
      });
      const response = await docClient.send(fallbackCmd);
      return response.Items || [];
    }
    throw err;
  }
}

/**
 * Query monthly summary for authenticated user from DynamoDB smartmeal-plans.
 * @param {string} userId - Cognito sub
 * @param {string} monthStr - Format YYYY-MM
 */
export async function getMonthlySummaryForUser(userId, monthStr) {
  const parts = monthStr.split('-');
  const formattedMonth = `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
  const prefix = `DATE#${formattedMonth}`;

  try {
    let items = [];
    try {
      const command = new QueryCommand({
        TableName: PLANS_TABLE,
        KeyConditionExpression: 'userId = :userId AND begins_with(planKey, :prefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':prefix': prefix,
        },
      });

      const response = await docClient.send(command);
      items = response.Items || [];
    } catch (err) {
      if (err.name === 'ValidationException' || err.message?.includes('schema')) {
        const fallbackCmd = new QueryCommand({
          TableName: PLANS_TABLE,
          KeyConditionExpression: 'Userid = :userId AND begins_with(planKey, :prefix)',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':prefix': prefix,
          },
        });
        const response = await docClient.send(fallbackCmd);
        items = response.Items || [];
      } else {
        throw err;
      }
    }

    const summary = {};
    items.forEach((item) => {
      const d = item.date;
      if (!d) return;
      if (!summary[d]) {
        summary[d] = { count: 0, completedCount: 0 };
      }
      summary[d].count += 1;
      if (item.completed) {
        summary[d].completedCount += 1;
      }
    });

    return summary;
  } catch (err) {
    console.error('[getMonthlySummaryForUser Error]:', err);
    return {};
  }
}

/**
 * Create a new meal plan item in DynamoDB smartmeal-plans.
 * planKey format: DATE#YYYY-MM-DD#MEAL#MealType#PLAN#plan-uuid
 */
export async function createPlanItemForUser(userId, planData) {
  const planId = generateUUID();
  const date = planData.date;
  const mealType = planData.mealType;
  const planKey = `DATE#${date}#MEAL#${mealType}#PLAN#${planId}`;
  const timestamp = new Date().toISOString();

  const newPlanItem = {
    userId,
    Userid: userId,
    planKey,
    planId,
    date,
    mealType,
    foodId: planData.foodId || '',
    name: planData.name,
    ingredients: Array.isArray(planData.ingredients) ? planData.ingredients : [],
    calories: Number(planData.calories) || 0,
    completed: false,
    shopping: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const command = new PutCommand({
    TableName: PLANS_TABLE,
    Item: newPlanItem,
  });

  await docClient.send(command);
  return newPlanItem;
}

/**
 * Toggle meal plan completion in DynamoDB smartmeal-plans.
 */
export async function togglePlanItemCompletionForUser(userId, dateStr, planId) {
  const items = await getPlanByDateForUser(userId, dateStr);
  const targetItem = items.find((i) => i.planId === planId || i.id === planId);

  if (!targetItem) {
    return null;
  }

  const updatedItem = {
    ...targetItem,
    userId,
    Userid: userId,
    completed: !targetItem.completed,
    updatedAt: new Date().toISOString(),
  };

  const putCmd = new PutCommand({
    TableName: PLANS_TABLE,
    Item: updatedItem,
  });

  await docClient.send(putCmd);
  return updatedItem;
}

/**
 * Update shopping data for a planned meal item in DynamoDB smartmeal-plans.
 */
export async function updatePlanShoppingForUser(userId, dateStr, planId, shoppingData) {
  const items = await getPlanByDateForUser(userId, dateStr);
  const targetItem = items.find((i) => i.planId === planId || i.id === planId);

  if (!targetItem) {
    return null;
  }

  const updatedItem = {
    ...targetItem,
    userId,
    Userid: userId,
    shopping: {
      items: shoppingData.items || [],
      googleCalendarEventId: shoppingData.googleCalendarEventId || null,
      googleTaskId: shoppingData.googleTaskId || null,
      lastSyncedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  const putCmd = new PutCommand({
    TableName: PLANS_TABLE,
    Item: updatedItem,
  });

  await docClient.send(putCmd);
  return updatedItem;
}

/**
 * Delete a meal plan item from DynamoDB smartmeal-plans.
 */
export async function deletePlanItemForUser(userId, dateStr, planId) {
  const items = await getPlanByDateForUser(userId, dateStr);
  const targetItem = items.find((i) => i.planId === planId || i.id === planId);

  if (!targetItem) {
    return false;
  }

  try {
    const deleteCmd = new DeleteCommand({
      TableName: PLANS_TABLE,
      Key: {
        userId,
        planKey: targetItem.planKey,
      },
    });
    await docClient.send(deleteCmd);
  } catch (err) {
    const deleteCmd = new DeleteCommand({
      TableName: PLANS_TABLE,
      Key: {
        Userid: userId,
        planKey: targetItem.planKey,
      },
    });
    await docClient.send(deleteCmd);
  }

  return true;
}
