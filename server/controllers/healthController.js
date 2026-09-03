/**
 * Health check controller.
 * ALB Target Group will ping /api/health to confirm instance health.
 */
export function getHealthStatus(req, res) {
  res.status(200).json({
    status: 'healthy',
    service: 'smartmeal-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
