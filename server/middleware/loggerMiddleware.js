/**
 * Request logging middleware for Express server.
 */
export default function loggerMiddleware(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} - ${duration}ms`);
  });

  next();
}
