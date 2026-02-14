/**
 * 内嵌测试 UI — 暗色玻璃拟态风格 + 分步骤工作流
 * 拆分为 styles / html / scripts 三个模块
 */
import { Router } from 'express';
import { UI_STYLES } from './styles';
import { UI_HTML } from './html';
import { UI_SCRIPTS } from './scripts';

const router: Router = Router();

const PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>剧本杀创作工坊</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<style>${UI_STYLES}</style>
</head>
<body>
${UI_HTML}
<script>${UI_SCRIPTS}</script>
</body>
</html>`;

router.get('/', (_req, res) => { res.send(PAGE_HTML); });

export default router;
