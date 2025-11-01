import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/prisma.js';

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
};

void bootstrap();
