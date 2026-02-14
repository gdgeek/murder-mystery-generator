import swaggerJsdoc from 'swagger-jsdoc';

/**
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       required: [error]
 *       properties:
 *         error:
 *           type: string
 *           description: 错误信息
 *         details:
 *           type: array
 *           items:
 *             type: string
 *           description: 详细错误列表
 *
 *     ScriptStyle:
 *       type: string
 *       enum: [detective, drama, discover, destiny, dream, dimension, death]
 *       description: 剧本风格 — detective悬疑/drama搞笑/discover探索/destiny浪漫/dream叙诡/dimension科幻/death恐怖
 *
 *     GameType:
 *       type: string
 *       enum: [honkaku, shin_honkaku, henkaku]
 *       description: 游戏类型
 *
 *     AgeGroup:
 *       type: string
 *       enum: [elementary, middle_school, college, adult]
 *       description: 目标年龄段
 *
 *     SettingType:
 *       type: string
 *       enum: [setting_superpower, setting_fantasy, setting_special_rule, setting_narrative_trick]
 *       description: 新本格特殊设定类型
 *
 *     AuthoringMode:
 *       type: string
 *       enum: [staged, vibe]
 *       description: 创作模式
 *
 *     SessionState:
 *       type: string
 *       enum: [draft, planning, plan_review, designing, design_review, executing, chapter_review, completed, generating, failed]
 *       description: 会话状态
 *
 *     PhaseName:
 *       type: string
 *       enum: [plan, outline, chapter]
 *       description: 阶段名称
 *
 *     ChapterType:
 *       type: string
 *       enum: [dm_handbook, player_handbook, materials, branch_structure]
 *       description: 章节类型
 *
 *     TagCategory:
 *       type: string
 *       enum: [game_type, age_group, player_count, era, theme, custom]
 *       description: 标签类别
 *
 *     Tag:
 *       type: object
 *       required: [id, name, category]
 *       properties:
 *         id:
 *           type: string
 *           description: 标签唯一标识
 *         name:
 *           type: string
 *           description: 标签名称
 *         category:
 *           $ref: '#/components/schemas/TagCategory'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     SpecialSetting:
 *       type: object
 *       required: [settingTypes, settingDescription, settingConstraints]
 *       properties:
 *         settingTypes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SettingType'
 *           description: 特殊设定类型列表
 *         settingDescription:
 *           type: string
 *           description: 设定描述
 *         settingConstraints:
 *           type: string
 *           description: 设定约束
 *
 *     RoundPhase:
 *       type: object
 *       required: [readingMinutes, investigationMinutes, discussionMinutes]
 *       properties:
 *         readingMinutes:
 *           type: number
 *           description: 阅读时间（分钟）
 *         investigationMinutes:
 *           type: number
 *           description: 调查时间（分钟）
 *         discussionMinutes:
 *           type: number
 *           description: 讨论时间（分钟）
 *
 *     RoundStructure:
 *       type: object
 *       required: [rounds, totalRounds, summaryMinutes, finalVoteMinutes, revealMinutes]
 *       properties:
 *         rounds:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RoundPhase'
 *           description: 各轮次阶段配置
 *         totalRounds:
 *           type: integer
 *           description: 总轮次数
 *         summaryMinutes:
 *           type: integer
 *           description: 总结时间（分钟）
 *         finalVoteMinutes:
 *           type: integer
 *           description: 最终投票时间（分钟）
 *         revealMinutes:
 *           type: integer
 *           description: 揭晓时间（分钟）
 *
 *     ScriptConfig:
 *       type: object
 *       required: [id, playerCount, durationHours, gameType, ageGroup, restorationRatio, deductionRatio, era, location, theme, language, style, roundStructure]
 *       properties:
 *         id:
 *           type: string
 *           description: 配置唯一标识
 *         playerCount:
 *           type: integer
 *           description: 玩家人数
 *         durationHours:
 *           type: number
 *           description: 游戏时长（小时）
 *         gameType:
 *           $ref: '#/components/schemas/GameType'
 *         ageGroup:
 *           $ref: '#/components/schemas/AgeGroup'
 *         restorationRatio:
 *           type: number
 *           description: 还原占比
 *         deductionRatio:
 *           type: number
 *           description: 推理占比
 *         era:
 *           type: string
 *           description: 时代背景
 *         location:
 *           type: string
 *           description: 地点设定
 *         theme:
 *           type: string
 *           description: 主题
 *         language:
 *           type: string
 *           description: 语言
 *         style:
 *           $ref: '#/components/schemas/ScriptStyle'
 *         roundStructure:
 *           $ref: '#/components/schemas/RoundStructure'
 *         specialSetting:
 *           $ref: '#/components/schemas/SpecialSetting'
 *
 *     CreateConfigRequest:
 *       type: object
 *       required: [playerCount, durationHours, gameType, ageGroup, restorationRatio, deductionRatio, era, location, theme, language, style, roundStructure]
 *       properties:
 *         playerCount:
 *           type: integer
 *           description: 玩家人数
 *         durationHours:
 *           type: number
 *           description: 游戏时长（小时）
 *         gameType:
 *           $ref: '#/components/schemas/GameType'
 *         ageGroup:
 *           $ref: '#/components/schemas/AgeGroup'
 *         restorationRatio:
 *           type: number
 *           description: 还原占比
 *         deductionRatio:
 *           type: number
 *           description: 推理占比
 *         era:
 *           type: string
 *           description: 时代背景
 *         location:
 *           type: string
 *           description: 地点设定
 *         theme:
 *           type: string
 *           description: 主题
 *         language:
 *           type: string
 *           description: 语言
 *         style:
 *           $ref: '#/components/schemas/ScriptStyle'
 *         roundStructure:
 *           $ref: '#/components/schemas/RoundStructure'
 *         specialSetting:
 *           $ref: '#/components/schemas/SpecialSetting'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     EphemeralAiConfig:
 *       type: object
 *       required: [provider, apiKey, endpoint, model]
 *       properties:
 *         provider:
 *           type: string
 *           description: AI 服务提供商
 *         apiKey:
 *           type: string
 *           description: API 密钥
 *         endpoint:
 *           type: string
 *           description: API 端点地址
 *         model:
 *           type: string
 *           description: 模型名称
 *
 *     AiStatusResult:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [configured, unconfigured]
 *           description: AI 配置状态
 *         provider:
 *           type: string
 *           description: 服务提供商
 *         model:
 *           type: string
 *           description: 模型名称
 *
 *     AiVerifyResult:
 *       type: object
 *       required: [valid]
 *       properties:
 *         valid:
 *           type: boolean
 *           description: 验证是否通过
 *         provider:
 *           type: string
 *           description: 服务提供商
 *         model:
 *           type: string
 *           description: 模型名称
 *         error:
 *           type: string
 *           description: 错误信息
 *
 *     AiConfigMeta:
 *       type: object
 *       required: [provider, model]
 *       properties:
 *         provider:
 *           type: string
 *           description: 服务提供商
 *         model:
 *           type: string
 *           description: 模型名称
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     ScriptPlan:
 *       type: object
 *       required: [worldOverview, characters, coreTrickDirection, themeTone, eraAtmosphere]
 *       properties:
 *         worldOverview:
 *           type: string
 *           description: 世界观概述
 *         characters:
 *           type: array
 *           items:
 *             type: object
 *             required: [name, role, relationshipSketch]
 *             properties:
 *               name:
 *                 type: string
 *                 description: 角色名称
 *               role:
 *                 type: string
 *                 description: 角色定位
 *               relationshipSketch:
 *                 type: string
 *                 description: 关系概述
 *           description: 角色列表
 *         coreTrickDirection:
 *           type: string
 *           description: 核心诡计方向
 *         themeTone:
 *           type: string
 *           description: 主题基调
 *         eraAtmosphere:
 *           type: string
 *           description: 时代氛围
 *
 *     ScriptOutline:
 *       type: object
 *       required: [detailedTimeline, characterRelationships, trickMechanism, clueChainDesign, branchSkeleton, roundFlowSummary]
 *       properties:
 *         detailedTimeline:
 *           type: array
 *           items:
 *             type: object
 *             required: [time, event, involvedCharacters]
 *             properties:
 *               time:
 *                 type: string
 *                 description: 时间点
 *               event:
 *                 type: string
 *                 description: 事件描述
 *               involvedCharacters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 涉及角色
 *           description: 详细时间线
 *         characterRelationships:
 *           type: array
 *           items:
 *             type: object
 *             required: [characterA, characterB, relationship]
 *             properties:
 *               characterA:
 *                 type: string
 *                 description: 角色A
 *               characterB:
 *                 type: string
 *                 description: 角色B
 *               relationship:
 *                 type: string
 *                 description: 关系描述
 *           description: 角色关系
 *         trickMechanism:
 *           type: string
 *           description: 诡计机制
 *         clueChainDesign:
 *           type: array
 *           items:
 *             type: object
 *             required: [clueId, description, leadsTo]
 *             properties:
 *               clueId:
 *                 type: string
 *                 description: 线索标识
 *               description:
 *                 type: string
 *                 description: 线索描述
 *               leadsTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 指向的线索
 *           description: 线索链设计
 *         branchSkeleton:
 *           type: array
 *           items:
 *             type: object
 *             required: [nodeId, description, options, endingDirections]
 *             properties:
 *               nodeId:
 *                 type: string
 *                 description: 节点标识
 *               description:
 *                 type: string
 *                 description: 节点描述
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 选项列表
 *               endingDirections:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 结局方向
 *           description: 分支骨架
 *         roundFlowSummary:
 *           type: array
 *           items:
 *             type: object
 *             required: [roundIndex, focus, keyEvents]
 *             properties:
 *               roundIndex:
 *                 type: integer
 *                 description: 轮次索引
 *               focus:
 *                 type: string
 *                 description: 轮次重点
 *               keyEvents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 关键事件
 *           description: 轮次流程摘要
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Chapter:
 *       type: object
 *       required: [index, type, content, generatedAt]
 *       properties:
 *         index:
 *           type: integer
 *           description: 章节索引
 *         type:
 *           $ref: '#/components/schemas/ChapterType'
 *         characterId:
 *           type: string
 *           description: 角色标识（仅 player_handbook 类型）
 *         content:
 *           type: object
 *           description: 章节内容
 *         generatedAt:
 *           type: string
 *           format: date-time
 *           description: 生成时间
 *
 *     AuthorEdit:
 *       type: object
 *       required: [editedAt, originalContent, editedContent]
 *       properties:
 *         editedAt:
 *           type: string
 *           format: date-time
 *           description: 编辑时间
 *         originalContent:
 *           type: object
 *           description: 原始内容
 *         editedContent:
 *           type: object
 *           description: 编辑后内容
 *
 *     PhaseOutput:
 *       type: object
 *       required: [phase, llmOriginal, edits, approved, generatedAt]
 *       properties:
 *         phase:
 *           $ref: '#/components/schemas/PhaseName'
 *         llmOriginal:
 *           type: object
 *           description: LLM 原始生成内容
 *         authorEdited:
 *           type: object
 *           description: 作者编辑后版本
 *         authorNotes:
 *           type: string
 *           description: 作者附加备注
 *         edits:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AuthorEdit'
 *           description: 编辑历史
 *         approved:
 *           type: boolean
 *           description: 是否已审批
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           description: 审批时间
 *         generatedAt:
 *           type: string
 *           format: date-time
 *           description: 生成时间
 *
 *     FailureInfo:
 *       type: object
 *       required: [phase, error, failedAt, retryFromState]
 *       properties:
 *         phase:
 *           type: string
 *           enum: [plan, outline, chapter, generating]
 *           description: 失败阶段
 *         error:
 *           type: string
 *           description: 错误信息
 *         failedAt:
 *           type: string
 *           format: date-time
 *           description: 失败时间
 *         retryFromState:
 *           $ref: '#/components/schemas/SessionState'
 *
 *     ParallelBatch:
 *       type: object
 *       required: [chapterIndices, completedIndices, failedIndices, reviewedIndices]
 *       properties:
 *         chapterIndices:
 *           type: array
 *           items:
 *             type: integer
 *           description: 本批次包含的章节索引
 *         completedIndices:
 *           type: array
 *           items:
 *             type: integer
 *           description: 已生成完成的章节索引
 *         failedIndices:
 *           type: array
 *           items:
 *             type: integer
 *           description: 生成失败的章节索引
 *         reviewedIndices:
 *           type: array
 *           items:
 *             type: integer
 *           description: 已审阅通过的章节索引
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     AuthoringSession:
 *       type: object
 *       required: [id, configId, mode, state, chapters, chapterEdits, currentChapterIndex, totalChapters, createdAt, updatedAt]
 *       properties:
 *         id:
 *           type: string
 *           description: 会话唯一标识
 *         configId:
 *           type: string
 *           description: 关联配置标识
 *         mode:
 *           $ref: '#/components/schemas/AuthoringMode'
 *         state:
 *           $ref: '#/components/schemas/SessionState'
 *         planOutput:
 *           $ref: '#/components/schemas/PhaseOutput'
 *         outlineOutput:
 *           $ref: '#/components/schemas/PhaseOutput'
 *         chapters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Chapter'
 *           description: 章节列表
 *         chapterEdits:
 *           type: object
 *           additionalProperties:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/AuthorEdit'
 *           description: 章节编辑记录（键为章节索引）
 *         currentChapterIndex:
 *           type: integer
 *           description: 当前章节索引
 *         totalChapters:
 *           type: integer
 *           description: 总章节数
 *         parallelBatch:
 *           $ref: '#/components/schemas/ParallelBatch'
 *         scriptId:
 *           type: string
 *           description: 完成后关联的剧本标识
 *         aiConfigMeta:
 *           $ref: '#/components/schemas/AiConfigMeta'
 *         failureInfo:
 *           $ref: '#/components/schemas/FailureInfo'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *
 *     CreateSessionRequest:
 *       type: object
 *       required: [configId, mode]
 *       properties:
 *         configId:
 *           type: string
 *           description: 关联配置标识
 *         mode:
 *           $ref: '#/components/schemas/AuthoringMode'
 *         ephemeralAiConfig:
 *           $ref: '#/components/schemas/EphemeralAiConfig'
 */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '剧本杀创作工坊 API',
      version: '1.0.0',
      description: '谋杀悬疑剧本生成器后端 API 文档',
    },
    servers: [
      { url: 'http://localhost:3000', description: '本地开发服务器' },
    ],
    tags: [
      { name: '配置管理', description: '剧本生成参数配置' },
      { name: '剧本管理', description: '剧本生成、查询与优化' },
      { name: '标签管理', description: '标签查询与管理' },
      { name: '创作会话', description: '分阶段创作工作流' },
      { name: 'AI 状态', description: 'AI 配置状态检测与验证' },
      { name: '系统', description: '健康检查等系统端点' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/app.ts', './src/swagger.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
