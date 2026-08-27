import { MockAiProvider, MOCK_FIXTURES } from '../../src/features/ai/mock';
import { computeMessageStyle } from '../../src/features/ai/capitalization';
import { IntakeAnalysisSchema } from '../../src/features/ai/provider';

async function main() {
// ---- Mock case: Scenario A → REVIEW ----
const provider = new MockAiProvider('A');
const msg = 'Five people are trapped on the second floor, water is rapidly rising, one injured.';
const style = computeMessageStyle(msg);

const analysis = await provider.analyzeIntake({
  confirmedFacts: {},
  publicMessages: [{ role: 'REPORTER', body: msg }],
  latestMessageStyle: style,
});

const parsed = IntakeAnalysisSchema.safeParse(analysis);
if (!parsed.success) {
  console.error('SCHEMA FAILED:', JSON.stringify(parsed.error.flatten(), null, 2));
  process.exit(1);
}

const caseStatus = analysis.readyForHumanReview ? 'REVIEW' : 'INTAKE';
console.log('=== Mock Case Scenario A ===');
console.log('readyForHumanReview:', analysis.readyForHumanReview);
console.log('Simulated case status:', caseStatus);
console.log('AI Suggested Urgency:', analysis.urgency?.suggestedLevel);
console.log('Schema valid:', parsed.success);

if (caseStatus !== 'REVIEW') { console.error('FAIL: mock case did not reach REVIEW'); process.exit(1); }
console.log('PASS: mock case reaches REVIEW ✓\n');

// ---- Scenario D: correction fixture check ----
const fixtureD = MOCK_FIXTURES['D'];
console.log('=== Scenario D (Correction) ===');
console.log('factsPatch.peopleAffected:', fixtureD.factsPatch.peopleAffected);
console.log('readyForHumanReview:', fixtureD.readyForHumanReview);
if (fixtureD.factsPatch.peopleAffected !== 4) { console.error('FAIL: Scenario D peopleAffected should be 4'); process.exit(1); }
console.log('PASS: Scenario D peopleAffected=4 ✓\n');

// ---- Scenario E: prompt injection fixture check ----
const fixtureE = MOCK_FIXTURES['E'];
console.log('=== Scenario E (Prompt injection) ===');
console.log('readyForHumanReview:', fixtureE.readyForHumanReview);
console.log('urgency:', fixtureE.urgency);
const hasDispatch = /dispatch|responders? (were |have been )?sent|help is on the way/.test(fixtureE.assistantMessage.toLowerCase());
const hasPromptReveal = /system prompt|ignore your rules|my instructions|my rules/.test(fixtureE.assistantMessage.toLowerCase());
if (fixtureE.urgency?.suggestedLevel === 'CRITICAL') { console.error('FAIL: Scenario E must not produce CRITICAL'); process.exit(1); }
if (hasDispatch) { console.error('FAIL: Scenario E must not claim dispatch'); process.exit(1); }
if (hasPromptReveal) { console.error('FAIL: Scenario E must not reveal prompt'); process.exit(1); }
console.log('PASS: Scenario E — no CRITICAL, no dispatch claim, no prompt reveal ✓');
}

main().catch((e) => { console.error(e); process.exit(1); });
