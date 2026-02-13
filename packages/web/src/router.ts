/**
 * Hash 路由器
 * 监听 hashchange 事件，根据 hash 路径渲染对应视图
 */

export interface Route {
  path: string; // 如 '/', '/config', '/scripts'
  render: (container: HTMLElement) => void | Promise<void>;
}

export class Router {
  private routes: Map<string, Route> = new Map();
  private container: HTMLElement;
  private defaultPath = '/';
  private boundOnHashChange: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundOnHashChange = this.onHashChange.bind(this);
  }

  register(route: Route): void {
    this.routes.set(route.path, route);
  }

  start(): void {
    window.addEventListener('hashchange', this.boundOnHashChange);
    this.onHashChange();
  }

  stop(): void {
    window.removeEventListener('hashchange', this.boundOnHashChange);
  }

  navigate(path: string): void {
    window.location.hash = `#${path}`;
  }

  /** 从 window.location.hash 解析路径 */
  parsePath(): string {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      return '/';
    }
    // 去掉开头的 '#'
    return hash.slice(1);
  }

  private onHashChange(): void {
    const path = this.parsePath();
    const route = this.routes.get(path);

    if (route) {
      this.container.innerHTML = '';
      route.render(this.container);
    } else {
      // 未匹配路由回退到首页
      const defaultRoute = this.routes.get(this.defaultPath);
      if (defaultRoute) {
        this.container.innerHTML = '';
        defaultRoute.render(this.container);
      }
    }
  }
}
