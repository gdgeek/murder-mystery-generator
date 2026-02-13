/**
 * Express application setup
 * Registers all routes and middleware
 */

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import configsRouter from './routes/configs';
import scriptsRouter from './routes/scripts';
import { tagRouter, scriptTagRouter } from './routes/tags';
import authoringRouter from './routes/authoring';
import aiStatusRouter from './routes/ai-status';
import uiRouter from './routes/ui';
import { swaggerSpec } from './swagger';

const app: express.Express = express();

// Middleware
app.use(express.json());

// i18n middleware: set req.language from Accept-Language header
app.use((req, _res, next) => {
  const acceptLang = req.headers['accept-language'] || 'zh';
  (req as Record<string, unknown>).language = acceptLang.split(',')[0].split('-')[0].trim();
  next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec));
app.get('/api-docs/', swaggerUi.setup(swaggerSpec));
app.get('/api-docs/json', (_req, res) => res.json(swaggerSpec));

// Routes
app.use('/api/configs', configsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/scripts', scriptTagRouter);
app.use('/api/tags', tagRouter);
app.use('/api/authoring-sessions', authoringRouter);
app.use('/api/ai-status', aiStatusRouter);

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [系统]
 *     summary: 健康检查
 *     description: 检查服务器运行状态，返回当前服务健康信息
 *     responses:
 *       200:
 *         description: 服务运行正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status]
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                   description: 服务状态
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Test UI
app.use('/', uiRouter);

export default app;
