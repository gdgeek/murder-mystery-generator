/**
 * 阶段产出物解析器 (PhaseParser)
 *
 * 解析和校验每个阶段的 LLM 输出。
 * Requirements: 3.2, 4.2
 */

import type { ScriptPlan, ScriptOutline, Chapter, ChapterType } from '@murder-mystery/shared';

export interface IPhaseParser {
  parsePlan(content: string): ScriptPlan;
  parseOutline(content: string): ScriptOutline;
  parseChapter(content: string, chapterType: ChapterType): Chapter;
}

/**
 * 从 LLM 输出字符串中提取 JSON。
 * 处理可能的 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）。
 */
function extractJson(content: string): string {
  const trimmed = content.trim();

  // Match ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return trimmed;
}

/**
 * 安全解析 JSON，提供清晰的错误信息。
 */
function parseJson(content: string, context: string): unknown {
  const jsonStr = extractJson(content);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to parse ${context} JSON: ${message}`);
  }
}

export class PhaseParser implements IPhaseParser {
  /**
   * 解析 LLM 输出为 ScriptPlan。
   * Req 3.2: 包含 worldOverview、characters（name/role/relationshipSketch）、
   *          coreTrickDirection、themeTone、eraAtmosphere，全部非空。
   */
  parsePlan(content: string): ScriptPlan {
    const data = parseJson(content, 'ScriptPlan') as Record<string, unknown>;

    // Validate required string fields
    const requiredStrings = ['worldOverview', 'coreTrickDirection', 'themeTone', 'eraAtmosphere'] as const;
    for (const field of requiredStrings) {
      const value = data[field];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`ScriptPlan validation failed: '${field}' must be a non-empty string`);
      }
    }

    // Validate characters array
    if (!Array.isArray(data.characters) || data.characters.length === 0) {
      throw new Error('ScriptPlan validation failed: \'characters\' must be a non-empty array');
    }

    for (let i = 0; i < data.characters.length; i++) {
      const char = data.characters[i] as Record<string, unknown>;
      for (const field of ['name', 'role', 'relationshipSketch']) {
        if (typeof char[field] !== 'string' || (char[field] as string).trim() === '') {
          throw new Error(
            `ScriptPlan validation failed: characters[${i}].${field} must be a non-empty string`,
          );
        }
      }
    }

    return {
      ...(typeof data.title === 'string' && data.title.trim() ? { title: data.title as string } : {}),
      worldOverview: data.worldOverview as string,
      characters: (data.characters as Array<Record<string, string>>).map(c => ({
        name: c.name,
        role: c.role,
        relationshipSketch: c.relationshipSketch,
      })),
      coreTrickDirection: data.coreTrickDirection as string,
      themeTone: data.themeTone as string,
      eraAtmosphere: data.eraAtmosphere as string,
      ...(data.specialSetting ? { specialSetting: data.specialSetting as ScriptPlan['specialSetting'] } : {}),
    };
  }

  /**
   * 解析 LLM 输出为 ScriptOutline。
   * Req 4.2: 所有 6 个字段/数组非空。
   */
  parseOutline(content: string): ScriptOutline {
    const data = parseJson(content, 'ScriptOutline') as Record<string, unknown>;

    // Validate required arrays
    const requiredArrays = [
      'detailedTimeline',
      'characterRelationships',
      'clueChainDesign',
      'branchSkeleton',
      'roundFlowSummary',
    ] as const;

    for (const field of requiredArrays) {
      const value = data[field];
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`ScriptOutline validation failed: '${field}' must be a non-empty array`);
      }
    }

    // Validate trickMechanism as non-empty string
    if (typeof data.trickMechanism !== 'string' || data.trickMechanism.trim() === '') {
      throw new Error('ScriptOutline validation failed: \'trickMechanism\' must be a non-empty string');
    }

    return data as unknown as ScriptOutline;
  }

  /**
   * 解析 LLM 输出为 Chapter。
   * 解析 JSON 内容并包装为 Chapter 对象，设置 generatedAt 为当前时间。
   */
  parseChapter(content: string, chapterType: ChapterType): Chapter {
    const data = parseJson(content, 'Chapter');

    return {
      index: 0,  // Will be set by the caller (AuthoringService)
      type: chapterType,
      content: data,
      generatedAt: new Date(),
    };
  }
}
