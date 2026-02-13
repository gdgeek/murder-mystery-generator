/**
 * 前端入口文件
 * 初始化路由、API 客户端，注册视图并启动路由器
 */

import { Router } from './router';
import { ApiClient } from './api-client';
import { renderHome } from './views/home';
import { renderConfig } from './views/config';
import { renderScripts } from './views/scripts';

const app = document.getElementById('app');

if (app) {
  const apiClient = new ApiClient({ baseUrl: '' });
  const router = new Router(app);

  router.register({ path: '/', render: () => renderHome(app) });
  router.register({ path: '/config', render: () => renderConfig(app, apiClient) });
  router.register({ path: '/scripts', render: () => renderScripts(app, apiClient) });

  router.start();
}
