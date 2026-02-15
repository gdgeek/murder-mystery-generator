import { describe, it, expect } from 'vitest';
import { PhaseParser } from './phase-parser';
import type { ChapterType } from '@gdgeek/murder-mystery-shared';

// ─── test fixtures ───

const validPlanJson = JSON.stringify({
  worldOverview: '民国上海，租界风云',
  characters: [
    { name: '张三', role: '侦探', relationshipSketch: '与李四是旧友' },
    { name: '李四', role: '嫌疑人', relationshipSketch: '与张三有旧怨' },
  ],
  coreTrickDirection: '密室杀人',
  themeTone: '黑暗悬疑',
  eraAtmosphere: '民国乱世，暗流涌动',
});

const validOutlineJson = JSON.stringify({
  detailedTimeline: [
    { time: '1930年春', event: '命案发生', involvedCharacters: ['张三'] },
  ],
  characterRelationships: [
    { characterA: '张三', characterB: '李四', relationship: '旧友反目' },
  ],
  trickMechanism: '利用暗道进出密室',
  clueChainDesign: [
    { clueId: 'clue-1', description: '血迹', leadsTo: ['clue-2'] },
  ],
  branchSkeleton: [
    { nodeId: 'node-1', description: '投票', options: ['A', 'B'], endingDirections: ['结局A'] },
  ],
  roundFlowSummary: [
    { roundIndex: 0, focus: '搜证', keyEvents: ['发现血迹'] },
  ],
});

const validChapterJson = JSON.stringify({
  overview: 'DM手册概述',
  characters: [],
  timeline: [],
});

// ─── tests ───

describe('PhaseParser', () => {
  const parser = new PhaseParser();

  // ─── parsePlan ───

  describe('parsePlan', () => {
    it('parses valid ScriptPlan JSON', () => {
      const result = parser.parsePlan(validPlanJson);
      expect(result.worldOverview).toBe('民国上海，租界风云');
      expect(result.characters).toHaveLength(2);
      expect(result.characters[0].name).toBe('张三');
      expect(result.characters[0].role).toBe('侦探');
      expect(result.characters[0].relationshipSketch).toBe('与李四是旧友');
      expect(result.coreTrickDirection).toBe('密室杀人');
      expect(result.themeTone).toBe('黑暗悬疑');
      expect(result.eraAtmosphere).toBe('民国乱世，暗流涌动');
    });

    it('handles markdown code block wrapping', () => {
      const wrapped = '```json\n' + validPlanJson + '\n```';
      const result = parser.parsePlan(wrapped);
      expect(result.worldOverview).toBe('民国上海，租界风云');
    });

    it('handles code block without json language tag', () => {
      const wrapped = '```\n' + validPlanJson + '\n```';
      const result = parser.parsePlan(wrapped);
      expect(result.worldOverview).toBe('民国上海，租界风云');
    });

    it('throws on invalid JSON', () => {
      expect(() => parser.parsePlan('not json')).toThrow('Failed to parse ScriptPlan JSON');
    });

    it('throws when worldOverview is empty', () => {
      const data = JSON.parse(validPlanJson);
      data.worldOverview = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow(
        "ScriptPlan validation failed: 'worldOverview' must be a non-empty string",
      );
    });

    it('throws when worldOverview is missing', () => {
      const data = JSON.parse(validPlanJson);
      delete data.worldOverview;
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('worldOverview');
    });

    it('throws when characters array is empty', () => {
      const data = JSON.parse(validPlanJson);
      data.characters = [];
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow(
        "'characters' must be a non-empty array",
      );
    });

    it('throws when characters is missing', () => {
      const data = JSON.parse(validPlanJson);
      delete data.characters;
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('characters');
    });

    it('throws when a character is missing name', () => {
      const data = JSON.parse(validPlanJson);
      data.characters[0].name = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('characters[0].name');
    });

    it('throws when a character is missing role', () => {
      const data = JSON.parse(validPlanJson);
      data.characters[1].role = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('characters[1].role');
    });

    it('throws when a character is missing relationshipSketch', () => {
      const data = JSON.parse(validPlanJson);
      data.characters[0].relationshipSketch = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('characters[0].relationshipSketch');
    });

    it('throws when coreTrickDirection is empty', () => {
      const data = JSON.parse(validPlanJson);
      data.coreTrickDirection = '  ';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('coreTrickDirection');
    });

    it('throws when themeTone is empty', () => {
      const data = JSON.parse(validPlanJson);
      data.themeTone = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('themeTone');
    });

    it('throws when eraAtmosphere is empty', () => {
      const data = JSON.parse(validPlanJson);
      data.eraAtmosphere = '';
      expect(() => parser.parsePlan(JSON.stringify(data))).toThrow('eraAtmosphere');
    });
  });

  // ─── parseOutline ───

  describe('parseOutline', () => {
    it('parses valid ScriptOutline JSON', () => {
      const result = parser.parseOutline(validOutlineJson);
      expect(result.detailedTimeline).toHaveLength(1);
      expect(result.characterRelationships).toHaveLength(1);
      expect(result.trickMechanism).toBe('利用暗道进出密室');
      expect(result.clueChainDesign).toHaveLength(1);
      expect(result.branchSkeleton).toHaveLength(1);
      expect(result.roundFlowSummary).toHaveLength(1);
    });

    it('handles markdown code block wrapping', () => {
      const wrapped = '```json\n' + validOutlineJson + '\n```';
      const result = parser.parseOutline(wrapped);
      expect(result.trickMechanism).toBe('利用暗道进出密室');
    });

    it('throws on invalid JSON', () => {
      expect(() => parser.parseOutline('{bad')).toThrow('Failed to parse ScriptOutline JSON');
    });

    it('throws when detailedTimeline is empty', () => {
      const data = JSON.parse(validOutlineJson);
      data.detailedTimeline = [];
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('detailedTimeline');
    });

    it('throws when characterRelationships is missing', () => {
      const data = JSON.parse(validOutlineJson);
      delete data.characterRelationships;
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('characterRelationships');
    });

    it('throws when trickMechanism is empty', () => {
      const data = JSON.parse(validOutlineJson);
      data.trickMechanism = '';
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('trickMechanism');
    });

    it('throws when trickMechanism is missing', () => {
      const data = JSON.parse(validOutlineJson);
      delete data.trickMechanism;
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('trickMechanism');
    });

    it('throws when clueChainDesign is empty', () => {
      const data = JSON.parse(validOutlineJson);
      data.clueChainDesign = [];
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('clueChainDesign');
    });

    it('throws when branchSkeleton is empty', () => {
      const data = JSON.parse(validOutlineJson);
      data.branchSkeleton = [];
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('branchSkeleton');
    });

    it('throws when roundFlowSummary is empty', () => {
      const data = JSON.parse(validOutlineJson);
      data.roundFlowSummary = [];
      expect(() => parser.parseOutline(JSON.stringify(data))).toThrow('roundFlowSummary');
    });
  });

  // ─── parseChapter ───

  describe('parseChapter', () => {
    it('parses valid chapter JSON and sets type', () => {
      const result = parser.parseChapter(validChapterJson, 'dm_handbook');
      expect(result.type).toBe('dm_handbook');
      expect(result.index).toBe(0);
      expect(result.content).toEqual({ overview: 'DM手册概述', characters: [], timeline: [] });
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('sets generatedAt to current date', () => {
      const before = new Date();
      const result = parser.parseChapter(validChapterJson, 'dm_handbook');
      const after = new Date();
      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('handles all chapter types', () => {
      const types: ChapterType[] = ['dm_handbook', 'player_handbook', 'materials', 'branch_structure'];
      for (const type of types) {
        const result = parser.parseChapter(validChapterJson, type);
        expect(result.type).toBe(type);
      }
    });

    it('handles markdown code block wrapping', () => {
      const wrapped = '```json\n' + validChapterJson + '\n```';
      const result = parser.parseChapter(wrapped, 'materials');
      expect(result.type).toBe('materials');
      expect(result.content).toEqual({ overview: 'DM手册概述', characters: [], timeline: [] });
    });

    it('throws on invalid JSON', () => {
      expect(() => parser.parseChapter('not json', 'dm_handbook')).toThrow(
        'Failed to parse Chapter JSON',
      );
    });

    it('parses array content (e.g. materials)', () => {
      const arrayContent = JSON.stringify([{ id: 'm1', type: 'clue_card', content: '线索' }]);
      const result = parser.parseChapter(arrayContent, 'materials');
      expect(Array.isArray(result.content)).toBe(true);
    });
  });
});
