import type { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (_req: Request, res: Response, _next: NextFunction): Response => {
  return res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
};
