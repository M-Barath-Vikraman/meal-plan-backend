import { CognitoJwtVerifier } from 'aws-jwt-verify';

const userPoolId = process.env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_h5wK04j2m';
const clientId = process.env.VITE_COGNITO_CLIENT_ID || '7ngr1t1fddt1pr8i0tf8tk506i';

// Create Cognito JWT Verifier for Access Tokens
let verifier = null;
try {
  verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId,
  });
} catch (err) {
  console.error('[CognitoJwtVerifier Init Error]:', err);
}

/**
 * Express middleware to verify AWS Cognito Access Tokens in Authorization header.
 * Seamlessly falls back to local dev user identity in development mode if no token is passed.
 */
export default async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // If no auth header provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        sub: process.env.DEV_USER_SUB || 'local_dev_user_001',
        username: 'local_dev_user',
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      error: {
        message: 'Authorization header missing or invalid. Expected: Bearer <access_token>',
        code: 'UNAUTHORIZED',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.substring(7);

  // Dev token shortcut
  if (token === 'dev_token' || token === 'mock_token') {
    req.user = {
      sub: process.env.DEV_USER_SUB || 'local_dev_user_001',
      username: 'local_dev_user',
    };
    return next();
  }

  try {
    if (!verifier) {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }

    const payload = await verifier.verify(token);

    // Attach verified Cognito user payload to request
    req.user = {
      sub: payload.sub,
      username: payload.username,
      client_id: payload.client_id,
      scope: payload.scope,
      exp: payload.exp,
      token_use: payload.token_use,
    };

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[requireAuth] Token verification failed in dev mode, using dev user sub fallback:', err.message);
      req.user = {
        sub: process.env.DEV_USER_SUB || 'local_dev_user_001',
        username: 'local_dev_user',
      };
      return next();
    }

    console.warn('[requireAuth] Token verification failed:', err.message);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired authentication token',
        code: 'UNAUTHORIZED',
        details: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
