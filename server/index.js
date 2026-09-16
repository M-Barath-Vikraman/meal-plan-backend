import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import cors from 'cors';

// Import custom middleware
import loggerMiddleware from './middleware/loggerMiddleware.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import errorHandler from './middleware/errorHandler.js';

// Import route modules
import healthRoutes from './routes/healthRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import mealPlanRoutes from './routes/mealPlanRoutes.js';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import googleRoutes from './routes/googleRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration to allow local frontend on port 5173
app.use(cors({
  origin: ['http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://main.dog3dcvao5gjr.amplifyapp.com/',
  ],
  credentials: true,
}));

// Body parser and logging middleware
app.use(express.json());
app.use(loggerMiddleware);

// API Route mounts
app.use('/api/health', healthRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/plans', mealPlanRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/ai', aiRoutes);

// Catch-all for unknown /api/* endpoints (returns JSON 404)
app.use('/api', notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 SmartMeal Express API Server running on port ${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`==================================================`);
});
