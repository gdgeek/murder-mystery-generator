/**
 * Express application setup
 * Registers all routes and middleware
 */

import express from 'express';
import configsRouter from './routes/configs';
import scriptsRouter from './routes/scripts';
import { tagRouter, scriptTagRouter } from './routes/tags';
import authoringRouter from './routes/authoring';

const app = express();

// Middleware
app.use(express.json());

// i18n middleware: set req.language from Accept-Language header
app.use((req, _res, next) => {
  const acceptLang = req.headers['accept-language'] || 'zh';
  (req as Record<string, unknown>).language = acceptLang.split(',')[0].split('-')[0].trim();
  next();
});

// Routes
app.use('/api/configs', configsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/scripts', scriptTagRouter);
app.use('/api/tags', tagRouter);
app.use('/api/authoring-sessions', authoringRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
