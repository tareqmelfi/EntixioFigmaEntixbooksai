import assert from 'node:assert/strict';
import { deviceProofStages, deviceProofReviewReason, isDeviceProofCurrent } from '../src/app/lib/zatca-proof-presentation';
import { deviceProofReference, renderDeviceProofDocument } from '../src/app/lib/zatca-proof-document';
import type { DeviceProof } from '../src/app/lib/use-zatca-status';

const proof: DeviceProof = {
  orgId: 'synthetic-org-1', companyName: 'Synthetic fixture', vatNumber: null,
  deviceLinked: true, certificateState: 'valid',
  certificate: { deviceName: 'TEST', issuedAt: '2020-01-01', expiresAt: '2099-01-01', fingerprint: 'AA:BB:CC:DD:EE:FF', issuer: 'Synthetic' },
  complianceChecksPassed: 6, complianceCheckedAt: '2026-09-06T00:00:00Z', checkedAt: '2026-09-06T00:00:00Z',
  verificationScope: 'stored_certificate_and_onboarding_evidence', revocationStatus: 'not_checked', submissionStatus: 'frozen',
};
const t = (ar: string, _en: string) => ar;
assert.equal(isDeviceProofCurrent(proof), true);
assert.equal(deviceProofStages(proof, t).filter(s => s.complete).length, 4);
const expired = { ...proof, certificate: { ...proof.certificate!, expiresAt: '2021-01-01' } };
assert.equal(isDeviceProofCurrent(expired), false, 'stale server valid flag cannot override expiry');
assert.equal(deviceProofStages(expired, t)[3].complete, false);
assert.match(deviceProofReviewReason(expired, t), /انتهت/);
await assert.rejects(renderDeviceProofDocument(expired, t), /device_proof_unavailable/);
const mismatch = { ...proof, deviceLinked: false, certificateState: 'invalid' as const, complianceChecksPassed: 0 };
assert.equal(deviceProofStages(mismatch, t).some(s => s.complete), false);
await assert.rejects(renderDeviceProofDocument(mismatch, t), /device_proof_unavailable/);
const future = { ...proof, certificate: { ...proof.certificate!, issuedAt: '2098-01-01' } };
assert.equal(isDeviceProofCurrent(future), false);
assert.match(deviceProofReviewReason(future, t), /لم يبدأ/);
const renewed = { ...proof, certificate: { ...proof.certificate!, fingerprint: 'BB:CC:DD:EE:FF:11' } };
assert.notEqual(deviceProofReference(proof), deviceProofReference(renewed));
assert.equal(deviceProofReference(proof), deviceProofReference({ ...proof, checkedAt: '2026-09-07T00:00:00Z' }));
console.log('PASS: four verified stages, expiry, future validity, mismatched proof, renewal and stable record reference.');
