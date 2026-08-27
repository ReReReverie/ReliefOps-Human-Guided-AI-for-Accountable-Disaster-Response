// Inline verification: mock case reaches REVIEW via Scenario A
// Run with: node --experimental-vm-modules .bob/tmp/verify-mock-review.mjs
// (uses compiled output via tsx / ts-node is not needed — we import compiled JS)

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

// Use tsx/register to handle TypeScript imports
const require = createRequire(import.meta.url);

// Register tsx for TypeScript resolution
const { register } = await import('tsx/esm/api');
register();

const { MockAiProvider } = await import('../../src/features/ai/mock.ts');
const { computeMessageStyle } = await import('../../src/features/ai/capitalization.ts');
const { IntakeAnalysisSchema } = await import('../../src/features/ai/provider.ts');

const provider = new MockAiProvider('A');
const msg = 'Five people are trapped on the second floor, water is rapidly rising, one injured.';
const style = computeMessageStyle(msg);

const analysis = await provider.analyzeIntake({
  confirmedFacts: {},
  publicMessages: [{ role: 'REPORTER', body: msg }],
  latestMessageStyle: style,
});

// Validate schema
const parsed = IntakeAnalysisSchema.safeParse(analysis);
if (!parsed.success) {
  console.error('SCHEMA FAILED:', JSON.stringify(parsed.error.flatten(), null, 2));
  process.exit(1);
}

// Simulate service-layer REVIEW transition
const caseStatus = analysis.readyForHumanReview ? 'REVIEW' : 'INTAKE';

console.log('--- Mock Case (Scenario A) ---');
console.log('readyForHumanReview:', analysis.readyForHumanReview);
console.log('Case status would be:', caseStatus);
console.log('AI Suggested Urgency:', analysis.urgency?.suggestedLevel);
console.log('Schema valid:', parsed.success);

if (caseStatus !== 'REVIEW') {
  console.error('FAIL: case did not reach REVIEW');
  process.exit(1);
}
console.log('\nPASS: mock case reaches REVIEW');
