/**
 * 内嵌测试 UI — 暗色玻璃拟态风格 + 分步骤工作流
 * 静态资源拆分为 styles.css / body.html / app.js 三个文件
 */
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();

const read = (f: string) => readFileSync(join(__dirname, f), 'utf-8');

const PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>剧本杀创作工坊</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<style>${read('styles.css')}</style>
</head>
<body>
${read('body.html')}
<script>${read('app.js')}</script>
</body>
</html>`;

router.get('/', (_req, res) => { res.send(PAGE_HTML); });

export default router;
