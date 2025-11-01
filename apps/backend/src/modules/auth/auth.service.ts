import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

export const registerUser = async (payload: RegisterInput): Promise<{ user: User; token: string }> => {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing !== null) {
    const error = new Error('User already exists');
    (error as any).status = 409;
    throw error;
  }

  const passwordHash = await argon2.hash(payload.password);

  const data: Prisma.UserCreateInput = {
    email: payload.email,
    passwordHash,
    firstName: payload.firstName,
    lastName: payload.lastName,
    companyName: payload.companyName,
    street: payload.street,
    postalCode: payload.postalCode,
    city: payload.city,
    country: payload.country,
    vatId: payload.vatId,
    taxNumber: payload.taxNumber,
    isSmallBiz: payload.isSmallBiz ?? false
  };

  const user = await prisma.user.create({ data });

  const token = createJwt({ sub: user.id, email: user.email });

  return { user, token };
};

export const loginUser = async (payload: LoginInput): Promise<{ user: User; token: string }> => {
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (user === null) {
    const error = new Error('Invalid credentials');
    (error as any).status = 401;
    throw error;
  }

  const isValid = await argon2.verify(user.passwordHash, payload.password);
  if (!isValid) {
    const error = new Error('Invalid credentials');
    (error as any).status = 401;
    throw error;
  }

  const token = createJwt({ sub: user.id, email: user.email });

  return { user, token };
};

export const createJwt = (payload: { sub: string; email: string }): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
};

export const verifyJwt = (token: string): { sub: string; email: string } => {
  return jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  return await prisma.user.findUnique({ where: { id: userId } });
};
