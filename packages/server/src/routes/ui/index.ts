/**
 * 内嵌测试 UI — 暗色玻璃拟态风格 + 分步骤工作流
 * 静态资源拆分为 styles.css / body.html / app.js 三个文件
 *
 * 开发模式（tsx）：每次请求重新读取文件，改 UI 只需刷新浏览器
 * 生产模式（dist）：启动时读取一次并缓存
 */
import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

const router: Router = Router();

const isDev = __filename.endsWith('.ts');
const assetDir = isDev
  ? __dirname                                       // tsx 直接跑 src，__dirname 就是 src/routes/ui
  : join(__dirname);                                 // dist/routes/ui（build 时 cp 过去了）

function read(f: string): string {
  return readFileSync(join(assetDir, f), 'utf-8');
}

function buildPage(): string {
  return `<!DOCTYPE html>
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
}

// 生产模式：启动时缓存；开发模式：每次请求重新读取
const cachedPage = isDev ? null : buildPage();

router.get('/', (_req, res) => {
  res.send(cachedPage ?? buildPage());
});

export default router;
