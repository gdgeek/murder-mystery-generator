import { describe, it, expect, beforeEach } from 'vitest';
import { renderHome } from './home';

describe('renderHome', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders welcome heading', () => {
    renderHome(container);
    const heading = container.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain('剧本杀 AI 生成工具');
  });

  it('renders introduction text', () => {
    renderHome(container);
    const lead = container.querySelector('.lead');
    expect(lead).not.toBeNull();
    expect(lead!.textContent).toContain('AI');
  });

  it('renders quick link to config page', () => {
    renderHome(container);
    const configLink = container.querySelector('a[href="#/config"]');
    expect(configLink).not.toBeNull();
    expect(configLink!.textContent).toBe('创建配置');
    expect(configLink!.classList.contains('btn')).toBe(true);
  });

  it('renders quick link to scripts page', () => {
    renderHome(container);
    const scriptsLink = container.querySelector('a[href="#/scripts"]');
    expect(scriptsLink).not.toBeNull();
    expect(scriptsLink!.textContent).toBe('剧本列表');
    expect(scriptsLink!.classList.contains('btn')).toBe(true);
  });

  it('uses Bootstrap styling classes', () => {
    renderHome(container);
    expect(container.querySelector('.display-4')).not.toBeNull();
    expect(container.querySelector('.btn-primary')).not.toBeNull();
    expect(container.querySelector('.btn-lg')).not.toBeNull();
  });
});
