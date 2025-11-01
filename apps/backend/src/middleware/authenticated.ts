import type { NextFunction, Request, Response } from 'express';
import { verifyJwt } from '../modules/auth/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing authorization header' });
    return;
  }

  try {
    const token = header.replace('Bearer ', '');
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
