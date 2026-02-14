/**
 * Startup environment variable validation.
 * Catches common misconfigurations before the server starts serving requests.
 */

interface EnvRule {
  key: string;
  required: boolean;
  validate?: (value: string) => string | null; // returns error message or null
}

const ASCII_ONLY = /^[\x20-\x7e]*$/;
const PLACEHOLDERS = ['your-llm-api-key', 'your_api_key_here', 'placeholder', 'sk-xxx', 'xxx', 'changeme'];

function checkAscii(key: string, value: string): string | null {
  if (!ASCII_ONLY.test(value)) {
    return `${key} contains non-ASCII characters — this will cause HTTP header errors. Please set a valid value.`;
  }
  return null;
}

function checkNotPlaceholder(key: string, value: string): string | null {
  if (PLACEHOLDERS.includes(value.trim().toLowerCase())) {
    return `${key} is still a placeholder ("${value.slice(0, 10)}..."). Please set a real value.`;
  }
  return null;
}

function checkPort(_key: string, value: string): string | null {
  const n = Number(value);
  if (isNaN(n) || n < 1 || n > 65535) {
    return `PORT must be a number between 1 and 65535, got "${value}".`;
  }
  return null;
}

const ENV_RULES: EnvRule[] = [
  { key: 'LLM_API_KEY', required: false, validate: (v) => checkAscii('LLM_API_KEY', v) || checkNotPlaceholder('LLM_API_KEY', v) },
  { key: 'LLM_ENDPOINT', required: false, validate: (v) => checkAscii('LLM_ENDPOINT', v) },
  { key: 'DB_PASSWORD', required: false, validate: (v) => checkAscii('DB_PASSWORD', v) },
  { key: 'PORT', required: false, validate: (v) => checkPort('PORT', v) },
];

export function validateEnv(): void {
  const errors: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];
    if (!value || value.trim() === '') {
      if (rule.required) {
        errors.push(`${rule.key} is required but not set.`);
      }
      continue;
    }
    if (rule.validate) {
      const err = rule.validate(value);
      if (err) errors.push(err);
    }
  }

  if (errors.length > 0) {
    console.error('\n⚠️  Environment validation failed:\n');
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('\nFix the above issues and restart.\n');
    process.exit(1);
  }
}
