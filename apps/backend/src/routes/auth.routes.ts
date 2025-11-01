import { Router } from 'express';
import { loginHandler, profileHandler, registerHandler } from '../modules/auth/auth.controller.js';
import { authenticated } from '../middleware/authenticated.js';

const router = Router();

router.post('/register', (req, res, next) => {
  registerHandler(req, res).catch(next);
});

router.post('/login', (req, res, next) => {
  loginHandler(req, res).catch(next);
});

router.get('/me', authenticated, (req, res, next) => {
  profileHandler(req, res).catch(next);
});

export const authRouter = router;
