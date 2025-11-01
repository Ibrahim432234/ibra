import type { Response } from 'express';
import { registerSchema, loginSchema } from './auth.schema.js';
import { registerUser, loginUser, getUserProfile } from './auth.service.js';
import type { AuthenticatedRequest } from '../../middleware/authenticated.js';

export const registerHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues
    });
  }

  const { user, token } = await registerUser(parsed.data);

  return res.status(201).json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user)
    }
  });
};

export const loginHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues
    });
  }

  const { user, token } = await loginUser(parsed.data);

  return res.status(200).json({
    success: true,
    data: {
      token,
      user: sanitizeUser(user)
    }
  });
};

export const profileHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  if (req.user == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const user = await getUserProfile(req.user.id);

  if (user == null) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  return res.status(200).json({
    success: true,
    data: sanitizeUser(user)
  });
};

const sanitizeUser = (user: { passwordHash?: string; [key: string]: any }): Record<string, any> => {
  const { passwordHash, ...rest } = user;
  return rest;
};
