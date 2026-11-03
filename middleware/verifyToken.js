import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;

function getJWKS() {
  const jwksUrl = process.env.AUTH_JWKS_URL;
  if (!jwksUrl) {
    throw new Error('AUTH_JWKS_URL environment variable is not defined.');
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  return jwks;
}

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required. Missing or malformed Bearer token.',
      });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({
        message: 'Authentication required. Bearer token is empty.',
      });
    }

    const remoteJWKS = getJWKS();

    const verifyOptions = {};
    if (process.env.AUTH_ISSUER) {
      verifyOptions.issuer = process.env.AUTH_ISSUER;
    }
    if (process.env.AUTH_AUDIENCE) {
      verifyOptions.audience = process.env.AUTH_AUDIENCE;
    }

    const { payload } = await jwtVerify(token, remoteJWKS, verifyOptions);

    const userId = payload.sub || payload.id;
    const userEmail = payload.email;
    const userName =
      payload.name ||
      payload.userName ||
      (userEmail ? userEmail.split('@')[0] : 'Library Patron');

    if (!userEmail) {
      return res.status(401).json({
        message: 'Authentication token is missing a valid user email claim.',
      });
    }

    req.user = {
      id: userId,
      email: userEmail,
      name: userName,
      ...payload,
    };

    return next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({
      message: 'Invalid or expired authentication session. Please sign in again.',
    });
  }
}

export default verifyToken;
