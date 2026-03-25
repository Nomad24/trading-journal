import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req.header('Authorization'));

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Требуется access token',
      },
    });
  }

  try {
    jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access_secret');
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token просрочен',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Недействительный access token',
      },
    });
  }
};