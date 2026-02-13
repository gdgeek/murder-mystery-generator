/**
 * 首页视图
 * 展示简介和快捷入口
 */

export function renderHome(container: HTMLElement): void {
  container.innerHTML = `
    <div class="py-5 text-center">
      <h1 class="display-4 fw-bold">剧本杀 AI 生成工具</h1>
      <p class="lead mt-3 mb-4">
        利用 AI 智能生成高质量剧本杀剧本。只需配置基本参数——玩家人数、游戏时长、类型风格，
        即可自动生成完整的角色设定、线索分布和轮次结构。
      </p>
      <hr class="my-4" />
      <p class="mb-4">选择下方入口开始使用：</p>
      <div class="d-flex justify-content-center gap-3">
        <a href="#/config" class="btn btn-primary btn-lg">创建配置</a>
        <a href="#/scripts" class="btn btn-outline-secondary btn-lg">剧本列表</a>
      </div>
    </div>
  `;
}
