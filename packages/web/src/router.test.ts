import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Router, Route } from './router';

describe('Router', () => {
  let container: HTMLElement;
  let router: Router;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(container);
    // Reset hash
    window.location.hash = '';
  });

  afterEach(() => {
    router.stop();
    document.body.removeChild(container);
    window.location.hash = '';
  });

  describe('register', () => {
    it('should register a route', () => {
      const route: Route = {
        path: '/config',
        render: (el) => { el.textContent = 'config'; },
      };
      router.register(route);
      // No error means success; we verify via start() below
    });
  });

  describe('parsePath', () => {
    it('should return "/" for empty hash', () => {
      window.location.hash = '';
      expect(router.parsePath()).toBe('/');
    });

    it('should return "/" for "#"', () => {
      window.location.hash = '#';
      expect(router.parsePath()).toBe('/');
    });

    it('should return "/" for "#/"', () => {
      window.location.hash = '#/';
      expect(router.parsePath()).toBe('/');
    });

    it('should return "/config" for "#/config"', () => {
      window.location.hash = '#/config';
      expect(router.parsePath()).toBe('/config');
    });

    it('should return "/scripts" for "#/scripts"', () => {
      window.location.hash = '#/scripts';
      expect(router.parsePath()).toBe('/scripts');
    });
  });

  describe('start', () => {
    it('should render the default route on start when hash is empty', () => {
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.start();
      expect(container.textContent).toBe('首页');
    });

    it('should render the matching route on start when hash is set', () => {
      window.location.hash = '#/config';
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.register({ path: '/config', render: (el) => { el.textContent = '配置'; } });
      router.start();
      expect(container.textContent).toBe('配置');
    });
  });

  describe('fallback to default route', () => {
    it('should render default route for unmatched hash', () => {
      window.location.hash = '#/unknown';
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.start();
      expect(container.textContent).toBe('首页');
    });

    it('should clear container before rendering fallback', () => {
      container.innerHTML = '<p>old content</p>';
      window.location.hash = '#/nonexistent';
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.start();
      expect(container.textContent).toBe('首页');
      expect(container.querySelector('p')).toBeNull();
    });
  });

  describe('hashchange navigation', () => {
    it('should render new view on hashchange', async () => {
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.register({ path: '/scripts', render: (el) => { el.textContent = '剧本'; } });
      router.start();
      expect(container.textContent).toBe('首页');

      // Simulate navigation
      const hashChanged = new Promise<void>((resolve) => {
        window.addEventListener('hashchange', () => resolve(), { once: true });
      });
      window.location.hash = '#/scripts';
      await hashChanged;

      expect(container.textContent).toBe('剧本');
    });
  });

  describe('navigate', () => {
    it('should set the hash and trigger rendering', async () => {
      router.register({ path: '/', render: (el) => { el.textContent = '首页'; } });
      router.register({ path: '/config', render: (el) => { el.textContent = '配置'; } });
      router.start();

      const hashChanged = new Promise<void>((resolve) => {
        window.addEventListener('hashchange', () => resolve(), { once: true });
      });
      router.navigate('/config');
      await hashChanged;

      expect(window.location.hash).toBe('#/config');
      expect(container.textContent).toBe('配置');
    });
  });

  describe('container clearing', () => {
    it('should clear container before rendering each route', () => {
      router.register({
        path: '/',
        render: (el) => {
          const p = document.createElement('p');
          p.textContent = '首页内容';
          el.appendChild(p);
        },
      });
      router.start();
      expect(container.querySelectorAll('p').length).toBe(1);

      // Re-trigger same route
      window.location.hash = '#';
      router.start();
      // Container should still only have one <p>, not two
      expect(container.querySelectorAll('p').length).toBe(1);
    });
  });
});
