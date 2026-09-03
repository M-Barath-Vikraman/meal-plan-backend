import {
  getPlanByDateForUser,
  getMonthlySummaryForUser,
  createPlanItemForUser,
  togglePlanItemCompletionForUser,
  deletePlanItemForUser,
} from '../services/dynamoDbService.js';

/**
 * GET /api/plans?date=YYYY-MM-DD
 * Query plans for authenticated user by date from DynamoDB.
 */
export async function getPlanByDate(req, res, next) {
  try {
    const userId = req.user.sub;
    const dateStr = req.query.date;

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        success: false,
        error: { message: 'date query parameter is required in format YYYY-MM-DD', code: 'BAD_REQUEST' },
      });
    }

    const rawItems = await getPlanByDateForUser(userId, dateStr);

    const plans = rawItems.map((item) => ({
      id: item.planId || item.id,
      planId: item.planId,
      planKey: item.planKey,
      date: item.date,
      mealType: item.mealType,
      foodId: item.foodId,
      name: item.name,
      ingredients: item.ingredients || [],
      calories: item.calories || 0,
      completed: !!item.completed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: plans,
      date: dateStr,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/plans/summary?month=YYYY-MM
 * Query monthly meal plan summary for calendar view.
 */
export async function getMonthlySummary(req, res, next) {
  try {
    const userId = req.user.sub;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStr = req.query.month || defaultMonth;

    const summary = await getMonthlySummaryForUser(userId, monthStr);

    res.status(200).json({
      success: true,
      data: summary,
      month: monthStr,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/plans
 * Add a meal item to a date plan for authenticated user in DynamoDB.
 */
export async function createPlanItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { date, name, mealType, ingredients, calories, foodId } = req.body;

    if (!date || !name || !mealType) {
      return res.status(400).json({
        success: false,
        error: { message: 'date, name, and mealType are required', code: 'BAD_REQUEST' },
      });
    }

    const newPlanItem = await createPlanItemForUser(userId, {
      date,
      name,
      mealType,
      ingredients,
      calories,
      foodId,
    });

    res.status(201).json({
      success: true,
      data: {
        id: newPlanItem.planId,
        planId: newPlanItem.planId,
        planKey: newPlanItem.planKey,
        date: newPlanItem.date,
        mealType: newPlanItem.mealType,
        foodId: newPlanItem.foodId,
        name: newPlanItem.name,
        ingredients: newPlanItem.ingredients,
        calories: newPlanItem.calories,
        completed: newPlanItem.completed,
        createdAt: newPlanItem.createdAt,
        updatedAt: newPlanItem.updatedAt,
      },
      date,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/plans/:id/complete?date=YYYY-MM-DD
 * Toggle meal item completion status in DynamoDB.
 */
export async function togglePlanItemCompletion(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const dateStr = req.query.date || req.body.date;

    if (!dateStr) {
      return res.status(400).json({
        success: false,
        error: { message: 'date parameter is required (in query or body)', code: 'BAD_REQUEST' },
      });
    }

    const updatedItem = await togglePlanItemCompletionForUser(userId, dateStr, id);

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        error: { message: `Plan item ${id} not found for date ${dateStr}`, code: 'NOT_FOUND' },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: updatedItem.planId,
        planId: updatedItem.planId,
        date: updatedItem.date,
        mealType: updatedItem.mealType,
        name: updatedItem.name,
        ingredients: updatedItem.ingredients,
        calories: updatedItem.calories,
        completed: updatedItem.completed,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/plans/:id?date=YYYY-MM-DD
 * Delete a meal item from plan for authenticated user in DynamoDB.
 */
export async function deletePlanItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const dateStr = req.query.date || req.body?.date;

    if (!dateStr) {
      return res.status(400).json({
        success: false,
        error: { message: 'date query parameter is required', code: 'BAD_REQUEST' },
      });
    }

    const deleted = await deletePlanItemForUser(userId, dateStr, id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: `Plan item ${id} not found for date ${dateStr}`, code: 'NOT_FOUND' },
      });
    }

    res.status(200).json({
      success: true,
      message: `Plan item ${id} deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
}
