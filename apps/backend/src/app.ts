import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { routes } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

export const createApp = (): express.Application => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(cors({
    origin: true,
    credentials: true
  }));

  app.use(helmet({
    contentSecurityPolicy: false
  }));

  app.use(express.json({
    limit: '1mb',
    verify: (req: express.Request, _res, buf) => {
      if (req.originalUrl === '/api/stripe/webhook') {
        (req as any).rawBody = Buffer.from(buf);
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);

  app.use(morgan('combined'));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
