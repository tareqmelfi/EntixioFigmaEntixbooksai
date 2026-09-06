import type { DeviceProof } from "./use-zatca-status";

export function isDeviceProofCurrent(proof: DeviceProof, now = Date.now()) {
  return !!proof.certificate && proof.deviceLinked && proof.certificateState === "valid"
    && Date.parse(proof.certificate.issuedAt) <= now && now < Date.parse(proof.certificate.expiresAt);
}

export function deviceProofStages(proof: DeviceProof, t: (ar: string, en: string) => string) {
  const current = isDeviceProofCurrent(proof);
  // An incomplete current proof cannot assert historic key/OTP milestones.
  return [
    { label: t("توليد المفاتيح و CSR", "Keys and CSR generated"), complete: current },
    { label: t("شهادة الامتثال (OTP)", "Compliance certificate (OTP)"), complete: current },
    { label: t("فحوصات الامتثال (٦ مستندات)", "Compliance checks (6 documents)"), complete: proof.complianceChecksPassed === 6 },
    { label: t("شهادة الإنتاج", "Production certificate"), complete: current },
  ];
}

export function deviceProofReviewReason(proof: DeviceProof, t: (ar: string, en: string) => string) {
  if (proof.certificateState === "expired" || (proof.certificate && Date.parse(proof.certificate.expiresAt) <= Date.now())) return t("انتهت صلاحية شهادة الجهاز؛ يلزم تجديد الربط قبل إصدار سجل جديد.", "The device certificate has expired. Renew onboarding before issuing a new record.");
  if (proof.certificateState === "not_yet_valid" || (proof.certificate && Date.parse(proof.certificate.issuedAt) > Date.now())) return t("لم يبدأ سريان شهادة الجهاز بعد؛ راجع تاريخ الصلاحية.", "The device certificate is not yet valid. Review its validity dates.");
  return t("تعذر تأكيد الربط من شهادة الجهاز والأدلة المحفوظة؛ راجع إعدادات الربط. لا تُعرض نسخة تؤكد النجاح حتى تُحل المشكلة.", "The stored certificate and evidence do not confirm current onboarding. Review the settings. A success record stays unavailable until the issue is resolved.");
}
