/**
 * 配置表单组件 - 渲染完整 Bootstrap 表单
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4
 */

import { GameType, AgeGroup, SettingType, ScriptStyle } from '@murder-mystery/shared';
import type { CreateConfigInput } from '@murder-mystery/shared';
import { validateConfigForm } from '../validators';
import type { ApiClient } from '../api-client';
import { RoundPreview } from './round-preview';
import { showToast } from './toast';

export interface ConfigFormOptions {
  container: HTMLElement;
  apiClient: ApiClient;
  onConfigCreated: (configId: string) => void;
}

export class ConfigForm {
  private container: HTMLElement;
  private apiClient: ApiClient;
  private onConfigCreated: (configId: string) => void;
  private roundPreview: RoundPreview | null = null;
  private form: HTMLFormElement | null = null;

  constructor(options: ConfigFormOptions) {
    this.container = options.container;
    this.apiClient = options.apiClient;
    this.onConfigCreated = options.onConfigCreated;
  }

  render(): void {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.buildFormHTML();
    this.container.appendChild(wrapper);

    this.form = wrapper.querySelector<HTMLFormElement>('#config-form')!;
    const previewContainer = wrapper.querySelector<HTMLElement>('#round-preview-container')!;
    this.roundPreview = new RoundPreview({ container: previewContainer });

    this.bindEvents();
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.roundPreview = null;
    this.form = null;
  }

  private buildFormHTML(): string {
    return `
      <h3 class="mb-4">创建剧本配置</h3>
      <form id="config-form" novalidate>
        <div class="row g-3">

          <div class="col-md-6">
            <label for="playerCount" class="form-label">玩家人数</label>
            <input type="number" class="form-control" id="playerCount" min="1" max="6" value="4">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="durationHours" class="form-label">游戏时长（小时）</label>
            <input type="number" class="form-control" id="durationHours" min="2" max="6" value="3">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="gameType" class="form-label">游戏类型</label>
            <select class="form-select" id="gameType">
              <option value="">请选择</option>
              <option value="${GameType.HONKAKU}">本格</option>
              <option value="${GameType.SHIN_HONKAKU}">新本格</option>
              <option value="${GameType.HENKAKU}">变格</option>
            </select>
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="ageGroup" class="form-label">目标年龄段</label>
            <select class="form-select" id="ageGroup">
              <option value="">请选择</option>
              <option value="${AgeGroup.ELEMENTARY}">小学生</option>
              <option value="${AgeGroup.MIDDLE_SCHOOL}">中学生</option>
              <option value="${AgeGroup.COLLEGE}">大学生</option>
              <option value="${AgeGroup.ADULT}">成年人</option>
            </select>
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="restorationRatio" class="form-label">
              还原比例：<span id="restorationRatioValue">50</span>%
            </label>
            <input type="range" class="form-range" id="restorationRatio" min="0" max="100" value="50">
          </div>

          <div class="col-md-6">
            <label class="form-label">
              推理比例：<span id="deductionRatioValue">50</span>%
            </label>
          </div>

          <div class="col-md-6">
            <label for="era" class="form-label">时代背景</label>
            <input type="text" class="form-control" id="era" placeholder="如：现代、民国、唐朝">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="location" class="form-label">地点</label>
            <input type="text" class="form-control" id="location" placeholder="如：别墅、古镇、学校">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="theme" class="form-label">主题</label>
            <input type="text" class="form-control" id="theme" placeholder="如：复仇、爱情、阴谋">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="language" class="form-label">语言</label>
            <input type="text" class="form-control" id="language" value="zh">
            <div class="invalid-feedback"></div>
          </div>

          <div class="col-md-6">
            <label for="style" class="form-label">剧本风格（侦探角色）</label>
            <select class="form-select" id="style">
              <option value="">请选择</option>
              <option value="${ScriptStyle.DETECTIVE}">正统侦探（中年严谨）— 悬疑</option>
              <option value="${ScriptStyle.DRAMA}">戏影侦探（老年戏骨）— 情感</option>
              <option value="${ScriptStyle.DISCOVER}">寻迹侦探（少年户外）— 搞笑</option>
              <option value="${ScriptStyle.DESTINY}">命运侦探（小女孩）— 浪漫</option>
              <option value="${ScriptStyle.DREAM}">幻梦侦探（宅男社恐）— 惊悚</option>
              <option value="${ScriptStyle.DIMENSION}">赛博侦探（酷飒黑客）— 科幻</option>
              <option value="${ScriptStyle.DEATH}">幽冥侦探（老者阴森）— 恐怖</option>
            </select>
            <div class="invalid-feedback"></div>
          </div>

        </div>

        <!-- 特殊设定区域（仅新本格显示） -->
        <div id="special-setting-area" class="mt-4" style="display: none;">
          <h5 class="mb-3">特殊设定</h5>

          <div class="mb-3">
            <label class="form-label">设定类型</label>
            <div id="settingTypes-group">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="setting_superpower" value="${SettingType.SUPERPOWER}">
                <label class="form-check-label" for="setting_superpower">超能力</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="setting_fantasy" value="${SettingType.FANTASY}">
                <label class="form-check-label" for="setting_fantasy">异世界</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="setting_special_rule" value="${SettingType.SPECIAL_RULE}">
                <label class="form-check-label" for="setting_special_rule">特殊规则</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="setting_narrative_trick" value="${SettingType.NARRATIVE_TRICK}">
                <label class="form-check-label" for="setting_narrative_trick">叙述性诡计</label>
              </div>
            </div>
            <div class="invalid-feedback" id="settingTypes-feedback"></div>
          </div>

          <div class="mb-3">
            <label for="settingDescription" class="form-label">设定描述</label>
            <textarea class="form-control" id="settingDescription" rows="3" placeholder="描述特殊世界观设定"></textarea>
            <div class="invalid-feedback"></div>
          </div>

          <div class="mb-3">
            <label for="settingConstraints" class="form-label">设定限制条件</label>
            <textarea class="form-control" id="settingConstraints" rows="3" placeholder="描述设定的限制条件"></textarea>
          </div>
        </div>

        <!-- 轮次预览 -->
        <div id="round-preview-container" class="mt-4"></div>

        <div class="mt-4">
          <button type="submit" class="btn btn-primary">创建配置</button>
        </div>
      </form>`;
  }

  private bindEvents(): void {
    const form = this.form!;

    // restorationRatio slider → update deductionRatio display
    const slider = form.querySelector<HTMLInputElement>('#restorationRatio')!;
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      form.querySelector<HTMLElement>('#restorationRatioValue')!.textContent = String(val);
      form.querySelector<HTMLElement>('#deductionRatioValue')!.textContent = String(100 - val);
    });

    // gameType change → toggle special setting area
    const gameTypeSelect = form.querySelector<HTMLSelectElement>('#gameType')!;
    gameTypeSelect.addEventListener('change', () => {
      this.toggleSpecialSetting(gameTypeSelect.value);
      this.clearFieldError('gameType');
    });

    // durationHours change → update round preview
    const durationInput = form.querySelector<HTMLInputElement>('#durationHours')!;
    durationInput.addEventListener('change', () => {
      const val = parseInt(durationInput.value, 10);
      if (!isNaN(val)) {
        this.roundPreview?.update(val);
      } else {
        this.roundPreview?.clear();
      }
      this.clearFieldError('durationHours');
    });
    // Trigger initial preview
    const initialDuration = parseInt(durationInput.value, 10);
    if (!isNaN(initialDuration)) {
      this.roundPreview?.update(initialDuration);
    }

    // Clear validation errors on input for all fields
    const clearableFields = ['playerCount', 'era', 'location', 'theme', 'language'];
    for (const fieldId of clearableFields) {
      const el = form.querySelector<HTMLElement>(`#${fieldId}`);
      el?.addEventListener('input', () => this.clearFieldError(fieldId));
    }
    form.querySelector<HTMLSelectElement>('#ageGroup')?.addEventListener('change', () => this.clearFieldError('ageGroup'));
    form.querySelector<HTMLSelectElement>('#style')?.addEventListener('change', () => this.clearFieldError('style'));

    // Clear special setting field errors on input
    const settingTextFields = ['settingDescription', 'settingConstraints'];
    for (const fieldId of settingTextFields) {
      const el = form.querySelector<HTMLElement>(`#${fieldId}`);
      el?.addEventListener('input', () => this.clearFieldError(fieldId));
    }
    // Clear settingTypes error when any checkbox changes
    const checkboxes = form.querySelectorAll<HTMLInputElement>('#settingTypes-group input[type="checkbox"]');
    checkboxes.forEach(cb => cb.addEventListener('change', () => this.clearSettingTypesError()));

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private toggleSpecialSetting(gameType: string): void {
    const area = this.container.querySelector<HTMLElement>('#special-setting-area')!;
    if (gameType === GameType.SHIN_HONKAKU) {
      area.style.display = '';
    } else {
      area.style.display = 'none';
      // Clear special setting values
      const checkboxes = area.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      checkboxes.forEach(cb => { cb.checked = false; });
      const textareas = area.querySelectorAll<HTMLTextAreaElement>('textarea');
      textareas.forEach(ta => { ta.value = ''; });
      // Clear any validation errors in the area
      this.clearFieldError('settingTypes');
      this.clearFieldError('settingDescription');
    }
  }

  private collectFormData(): Partial<CreateConfigInput> {
    const form = this.form!;
    const data: Partial<CreateConfigInput> = {
      playerCount: parseInt(form.querySelector<HTMLInputElement>('#playerCount')!.value, 10),
      durationHours: parseInt(form.querySelector<HTMLInputElement>('#durationHours')!.value, 10),
      gameType: form.querySelector<HTMLSelectElement>('#gameType')!.value as GameType,
      ageGroup: form.querySelector<HTMLSelectElement>('#ageGroup')!.value as AgeGroup,
      restorationRatio: parseInt(form.querySelector<HTMLInputElement>('#restorationRatio')!.value, 10),
      deductionRatio: 100 - parseInt(form.querySelector<HTMLInputElement>('#restorationRatio')!.value, 10),
      era: form.querySelector<HTMLInputElement>('#era')!.value.trim(),
      location: form.querySelector<HTMLInputElement>('#location')!.value.trim(),
      theme: form.querySelector<HTMLInputElement>('#theme')!.value.trim(),
      language: form.querySelector<HTMLInputElement>('#language')!.value.trim() || 'zh',
      style: form.querySelector<HTMLSelectElement>('#style')!.value as ScriptStyle || undefined,
    };

    if (data.gameType === GameType.SHIN_HONKAKU) {
      const checkedTypes = Array.from(
        form.querySelectorAll<HTMLInputElement>('#settingTypes-group input[type="checkbox"]:checked')
      ).map(cb => cb.value);

      data.specialSetting = {
        settingTypes: checkedTypes,
        settingDescription: form.querySelector<HTMLTextAreaElement>('#settingDescription')!.value.trim(),
        settingConstraints: form.querySelector<HTMLTextAreaElement>('#settingConstraints')!.value.trim(),
      };
    }

    return data;
  }

  private async handleSubmit(): Promise<void> {
    this.clearAllErrors();
    const data = this.collectFormData();
    const result = validateConfigForm(data);

    if (!result.valid) {
      for (const err of result.errors) {
        this.showFieldError(err.field, err.message);
      }
      return;
    }

    try {
      const submitBtn = this.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      submitBtn.disabled = true;
      submitBtn.textContent = '提交中...';

      const response = await this.apiClient.post<{ id: string }>('/api/configs', data);
      showToast('配置创建成功', 'success');
      this.onConfigCreated(response.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建配置失败';
      showToast(message, 'danger');
    } finally {
      const submitBtn = this.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '创建配置';
      }
    }
  }

  private showFieldError(field: string, message: string): void {
    if (field === 'settingTypes') {
      const group = this.container.querySelector<HTMLElement>('#settingTypes-group');
      const feedback = this.container.querySelector<HTMLElement>('#settingTypes-feedback');
      if (group) group.classList.add('is-invalid');
      if (feedback) {
        feedback.textContent = message;
        feedback.style.display = 'block';
      }
      return;
    }

    const el = this.form?.querySelector<HTMLElement>(`#${field}`);
    if (el) {
      el.classList.add('is-invalid');
      const feedback = el.nextElementSibling;
      if (feedback?.classList.contains('invalid-feedback')) {
        feedback.textContent = message;
      }
    }
  }

  private clearFieldError(field: string): void {
    if (field === 'settingTypes') {
      this.clearSettingTypesError();
      return;
    }

    const el = this.form?.querySelector<HTMLElement>(`#${field}`);
    if (el) {
      el.classList.remove('is-invalid');
      const feedback = el.nextElementSibling;
      if (feedback?.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    }
  }

  private clearSettingTypesError(): void {
    const group = this.container.querySelector<HTMLElement>('#settingTypes-group');
    const feedback = this.container.querySelector<HTMLElement>('#settingTypes-feedback');
    if (group) group.classList.remove('is-invalid');
    if (feedback) {
      feedback.textContent = '';
      feedback.style.display = '';
    }
  }

  private clearAllErrors(): void {
    const invalidEls = this.form?.querySelectorAll('.is-invalid') ?? [];
    invalidEls.forEach(el => el.classList.remove('is-invalid'));
    const feedbacks = this.form?.querySelectorAll('.invalid-feedback') ?? [];
    feedbacks.forEach(el => { el.textContent = ''; });
    this.clearSettingTypesError();
  }
}
