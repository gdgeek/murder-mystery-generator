# @gdgeek/murder-mystery-shared

谋杀悬疑剧本生成器的共享类型定义与校验工具包。

## 安装

```bash
# .npmrc 中添加 registry 映射
@gdgeek:registry=https://npm.pkg.github.com

# 安装
npm install @gdgeek/murder-mystery-shared
```

## 包含内容

- 剧本配置类型（`ScriptConfig`, `GameType`, `AgeGroup` 等）
- 剧本结构类型（`Script`, `DMHandbook`, `PlayerHandbook`, `Material`, `BranchStructure`）
- 创作工作流类型（`AuthoringSession`, `Chapter`, `PhaseOutput`, `AiStepMeta`）
- AI 配置类型（`AiConfig`, `EphemeralAiConfig`, `RoutingConfig`）
- 标签与反馈类型（`Tag`, `Feedback`）
- LLM 请求/响应类型（`LLMRequest`, `LLMResponse`, `TokenUsage`）
- AI 配置校验器（`validateEphemeralAiConfig`）

## 使用示例

```typescript
import type { ScriptConfig, AuthoringSession, AiStepMeta } from '@gdgeek/murder-mystery-shared';
import { validateEphemeralAiConfig } from '@gdgeek/murder-mystery-shared';
```

## 许可证

UNLICENSED — 私有包，仅限授权项目使用。
