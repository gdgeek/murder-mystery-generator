import { describe, it, expect } from 'vitest';
import { swaggerSpec } from './swagger';

// Cast to a typed structure for easier access
const spec = swaggerSpec as {
  openapi: string;
  info: { title: string; version: string; description: string };
  paths: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
};

describe('OpenAPI Spec 结构验证', () => {
  it('should contain openapi, info, and paths fields', () => {
    expect(spec.openapi).toBeDefined();
    expect(spec.openapi).toMatch(/^3\.0\.\d+$/);
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBeDefined();
    expect(spec.info.version).toBeDefined();
    expect(spec.paths).toBeDefined();
    expect(typeof spec.paths).toBe('object');
  });
});

describe('OpenAPI Spec 端点覆盖', () => {
  const expectedPaths = [
    '/api/configs',
    '/api/configs/{id}',
    '/api/scripts/generate',
    '/api/scripts/jobs/{jobId}',
    '/api/scripts',
    '/api/scripts/{id}',
    '/api/scripts/{id}/versions',
    '/api/scripts/{id}/optimize',
    '/api/tags',
    '/api/tags/popular',
    '/api/scripts/{id}/tags',
    '/api/scripts/{id}/tags/{tagId}',
    '/api/authoring-sessions',
    '/api/authoring-sessions/{id}',
    '/api/authoring-sessions/{id}/advance',
    '/api/authoring-sessions/{id}/phases/{phase}/edit',
    '/api/authoring-sessions/{id}/phases/{phase}/approve',
    '/api/authoring-sessions/{id}/chapters/{chapterIndex}/regenerate',
    '/api/authoring-sessions/{id}/retry',
    '/api/authoring-sessions/{id}/assemble',
    '/api/ai-status',
    '/api/ai-status/verify',
    '/health',
  ];

  it('should contain all 23 expected paths', () => {
    const actualPaths = Object.keys(spec.paths);
    for (const path of expectedPaths) {
      expect(actualPaths, `missing path: ${path}`).toContain(path);
    }
  });

  it.each(expectedPaths)('should have path: %s', (path) => {
    expect(spec.paths[path]).toBeDefined();
  });
});

describe('OpenAPI Spec Schema 覆盖', () => {
  const expectedSchemas = [
    'ErrorResponse',
    'ScriptConfig',
    'CreateConfigRequest',
    'ScriptStyle',
    'GameType',
    'AgeGroup',
    'SettingType',
    'AuthoringMode',
    'SessionState',
    'PhaseName',
    'ChapterType',
    'EphemeralAiConfig',
    'AiStatusResult',
    'AiVerifyResult',
    'ScriptPlan',
    'ScriptOutline',
    'Chapter',
    'PhaseOutput',
    'AuthoringSession',
    'CreateSessionRequest',
    'ParallelBatch',
    'FailureInfo',
  ];

  it('should have components.schemas defined', () => {
    expect(spec.components).toBeDefined();
    expect(spec.components!.schemas).toBeDefined();
  });

  it('should contain all expected schemas', () => {
    const actualSchemas = Object.keys(spec.components!.schemas!);
    for (const schema of expectedSchemas) {
      expect(actualSchemas, `missing schema: ${schema}`).toContain(schema);
    }
  });

  it.each(expectedSchemas)('should have schema: %s', (schema) => {
    expect(spec.components!.schemas![schema]).toBeDefined();
  });
});
