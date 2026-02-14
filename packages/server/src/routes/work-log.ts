/**
 * 工作日志 API — 读取 .kiro/work-log 下的原始日志和每日日记
 */
import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router: Router = Router();

/** 项目根目录 */
function root(): string {
  return process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..', '..', '..');
}

/**
 * GET /api/work-log/raw
 * 返回 raw.md 原始日志内容
 */
router.get('/raw', (_req, res) => {
  const file = path.join(root(), '.kiro', 'work-log', 'raw.md');
  if (!fs.existsSync(file)) {
    return res.json({ content: '' });
  }
  const content = fs.readFileSync(file, 'utf-8');
  res.json({ content });
});

/**
 * GET /api/work-log/diary
 * 返回所有日记文件列表（按日期倒序）
 */
router.get('/diary', (_req, res) => {
  const dir = path.join(root(), '.kiro', 'work-log', 'diary');
  if (!fs.existsSync(dir)) {
    return res.json({ entries: [] });
  }
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();
  const entries = files.map(f => ({
    date: f.replace('.md', ''),
    filename: f,
  }));
  res.json({ entries });
});

/**
 * GET /api/work-log/diary/:date
 * 返回指定日期的日记内容
 */
router.get('/diary/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式无效，应为 YYYY-MM-DD' });
  }
  const file = path.join(root(), '.kiro', 'work-log', 'diary', `${date}.md`);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: '该日期无日记' });
  }
  const content = fs.readFileSync(file, 'utf-8');
  res.json({ date, content });
});

export default router;
