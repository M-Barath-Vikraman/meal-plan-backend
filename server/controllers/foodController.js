import {
  getFoodsForUser,
  createFoodForUser,
  updateFoodForUser,
  deleteFoodForUser,
} from '../services/dynamoDbService.js';

/**
 * GET /api/foods
 * Fetch list of all foods for the authenticated Cognito user from DynamoDB.
 */
export async function getFoods(req, res, next) {
  try {
    const userId = req.user.sub;
    const foods = await getFoodsForUser(userId);

    res.status(200).json({
      success: true,
      data: foods,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/foods
 * Add a new food item for the authenticated user in DynamoDB.
 */
export async function createFood(req, res, next) {
  try {
    const userId = req.user.sub;
    const { name, mealType, ingredients, calories, protein, carbs, fat } = req.body;

    if (!name || !mealType) {
      return res.status(400).json({
        success: false,
        error: { message: 'Food name and mealType are required', code: 'BAD_REQUEST' },
      });
    }

    const newFood = await createFoodForUser(userId, {
      name,
      mealType,
      ingredients,
      calories,
      protein,
      carbs,
      fat,
    });

    res.status(201).json({
      success: true,
      data: newFood,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/foods/:id
 * Update an existing food item for the authenticated user in DynamoDB.
 */
export async function updateFood(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const updatedFood = await updateFoodForUser(userId, id, req.body);

    if (!updatedFood) {
      return res.status(404).json({
        success: false,
        error: { message: `Food item ${id} not found for this user`, code: 'NOT_FOUND' },
      });
    }

    res.status(200).json({
      success: true,
      data: updatedFood,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/foods/:id
 * Delete a food item belonging to the authenticated user from DynamoDB.
 */
export async function deleteFood(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const deleted = await deleteFoodForUser(userId, id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: `Food item ${id} not found for this user`, code: 'NOT_FOUND' },
      });
    }

    res.status(200).json({
      success: true,
      message: `Food item ${id} deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
}
