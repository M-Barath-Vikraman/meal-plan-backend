/**
 * Auth controller providing verified user profile.
 */

/**
 * GET /api/auth/me
 * Returns verified AWS Cognito user profile attached by requireAuth middleware.
 */
export function getCurrentUser(req, res) {
  const verifiedUser = req.user;

  res.status(200).json({
    success: true,
    user: {
      sub: verifiedUser.sub,
      username: verifiedUser.username,
      client_id: verifiedUser.client_id,
      scope: verifiedUser.scope,
      exp: verifiedUser.exp,
      token_use: verifiedUser.token_use,
    },
    message: 'Verified AWS Cognito authenticated session.',
    timestamp: new Date().toISOString(),
  });
}
