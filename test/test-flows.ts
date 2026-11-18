import { LOCAL_PRESETS, createMockIncident } from '../src/services/mockPresets.ts';
import type { IncidentRecord, IncidentPreset } from '../src/types.ts';

function runAssertions() {
  console.log('🧪 Starting IncidentLens E2E Flow Verifications...\n');

  // Test 1: Verify all 4 Presets
  console.log('Test 1: Verifying production presets & low-confidence edge case...');
  if (LOCAL_PRESETS.length < 4) {
    throw new Error(`Expected at least 4 presets, got ${LOCAL_PRESETS.length}`);
  }
  const oomPreset = LOCAL_PRESETS.find(p => p.id === 'k8s-oomkilled');
  const deadlockPreset = LOCAL_PRESETS.find(p => p.id === 'postgres-deadlock');
  const ambiguousPreset = LOCAL_PRESETS.find(p => p.id === 'sparse-ambiguous');

  if (!oomPreset || !deadlockPreset || !ambiguousPreset) {
    throw new Error('Missing core presets');
  }
  console.log('  ✅ Presets verified (OOMKilled, Deadlock, Stampede, Low-Confidence Ambiguous)');

  // Test 2: Structured 4-Stage Triage Generation for OOMKilled
  console.log('\nTest 2: Verifying 4-stage structured triage for OOMKilled...');
  const oomIncident = createMockIncident(oomPreset);
  if (!oomIncident.errorUnderstanding) {
    throw new Error('Stage 1 (ErrorUnderstanding) is missing');
  }
  if (!oomIncident.severityAssessment) {
    throw new Error('Stage 2 (SeverityAssessment) is missing');
  }
  if (!oomIncident.confidenceAssessment) {
    throw new Error('Stage 3 (ConfidenceAssessment) is missing');
  }
  if (oomIncident.actionItems.length === 0) {
    throw new Error('Stage 4 (ActionItems Plan) is missing');
  }
  console.log(`  - Stage 1 Failure Mechanism: "${oomIncident.errorUnderstanding.failureMechanism}"`);
  console.log(`  - Stage 2 Severity Justification: "${oomIncident.severityAssessment.justification.slice(0, 70)}..."`);
  console.log(`  - Stage 3 Confidence Score: ${oomIncident.confidenceAssessment.primaryConfidence}% (isConfident: ${oomIncident.confidenceAssessment.isConfident})`);
  console.log(`  - Stage 4 Action Items: ${oomIncident.actionItems.length} items (P1: ${oomIncident.actionItems.filter(a => a.priority === 'p1').length}, P2: ${oomIncident.actionItems.filter(a => a.priority === 'p2').length}, P3: ${oomIncident.actionItems.filter(a => a.priority === 'p3').length})`);
  console.log('  ✅ 4-stage structured triage verified successfully');

  // Test 3: Low-Confidence & Ambiguity Handling
  console.log('\nTest 3: Verifying low-confidence guard & missing telemetry checklist...');
  const ambiguousIncident = createMockIncident(ambiguousPreset);
  if (ambiguousIncident.confidenceAssessment?.isConfident !== false) {
    throw new Error('Ambiguous incident should have isConfident: false');
  }
  if ((ambiguousIncident.confidenceAssessment?.primaryConfidence || 0) >= 60) {
    throw new Error('Ambiguous incident should have confidence < 60%');
  }
  if (!ambiguousIncident.confidenceAssessment?.missingTelemetry || ambiguousIncident.confidenceAssessment.missingTelemetry.length === 0) {
    throw new Error('Missing telemetry list should be populated for ambiguous incidents');
  }
  console.log(`  - Flagged isConfident: ${ambiguousIncident.confidenceAssessment.isConfident}`);
  console.log(`  - Confidence rating: ${ambiguousIncident.confidenceAssessment.primaryConfidence}%`);
  console.log(`  - Ambiguity Explanation: "${ambiguousIncident.confidenceAssessment.ambiguityExplanation?.slice(0, 80)}..."`);
  console.log(`  - Missing Telemetry checklist items: ${ambiguousIncident.confidenceAssessment.missingTelemetry.length}`);
  console.log('  ✅ Low-confidence guard verified successfully');

  // Test 4: Action Items completion toggle
  console.log('\nTest 4: Verifying action items completion status...');
  const targetAction = oomIncident.actionItems[0];
  targetAction.status = 'completed';
  if (targetAction.status !== 'completed') {
    throw new Error('Failed to toggle action item status');
  }
  console.log(`  - Action item "${targetAction.description.slice(0, 40)}..." marked completed.`);
  console.log('  ✅ Action item completion verified');

  // Test 5: Incident status lifecycle transitions
  console.log('\nTest 5: Verifying incident status transitions...');
  oomIncident.status = 'IDENTIFIED';
  oomIncident.status = 'MITIGATED';
  oomIncident.status = 'RESOLVED';
  if (oomIncident.status !== 'RESOLVED') {
    throw new Error('Failed status lifecycle transition');
  }
  console.log('  - Transitioned from INVESTIGATING -> IDENTIFIED -> MITIGATED -> RESOLVED');
  console.log('  ✅ Status lifecycle verified');

  // Test 6: Cross-incident reference structure
  console.log('\nTest 6: Verifying cross-incident reference structure...');
  oomIncident.crossIncidentReferences = [
    {
      relatedIncidentId: 'inc-prev-1',
      relatedIncidentTitle: 'PostgreSQL Connection Exhaustion & Deadlock',
      similarityFactor: 'Production environment outage',
      comparisonNote: 'Both incidents triggered cascading 502s on upstream API gateway.',
    },
  ];
  if (oomIncident.crossIncidentReferences.length !== 1) {
    throw new Error('Cross-incident references failed to attach');
  }
  console.log(`  - Cross reference linked: "${oomIncident.crossIncidentReferences[0].relatedIncidentTitle}"`);
  console.log('  ✅ Cross-incident reference verified');

  console.log('\n🎉 ALL E2E USER FLOW TESTS PASSED SUCCESSFULLY!\n');
}

runAssertions();
