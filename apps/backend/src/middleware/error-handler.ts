import type { NextFunction, Request, Response } from 'express';

interface ApiError extends Error {
  status?: number;
  details?: unknown;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  const status = err.status ?? 500;

  if (status >= 500) {
    console.error(err);
  }

  return res.status(status).json({
    success: false,
    message: err.message ?? 'Internal Server Error',
    details: err.details
  });
};
