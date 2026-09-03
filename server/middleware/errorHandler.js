/**
 * Centralized error handling middleware for Express server.
 */
export default function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}
