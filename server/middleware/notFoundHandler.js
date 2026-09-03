/**
 * JSON 404 handler middleware for unmatched API endpoints.
 */
export default function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    },
    timestamp: new Date().toISOString(),
  });
}
