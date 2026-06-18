/**
 * Receipt-scan capability gate (spec § Receipt scan). The feature is capability-
 * gated to an on-device structuring model (Apple Foundation Models on iOS 18+,
 * Gemini Nano via ML Kit GenAI on Android) — fully on-device, no cloud, no
 * fallback. The native module is a v1.1 follow-on (it can't be built or verified
 * headless — see JOSH-BLOCK / the app CLAUDE.md). Until it ships, scanning is
 * unsupported on every device, so the camera entry point stays hidden and
 * Settings shows "Not supported on this device". Keeping the contract here means
 * wiring the native module later touches only this file + the add sheet's gate.
 */

export interface ReceiptFields {
  amountMinor: number;
  merchant?: string;
  date?: string;
  suggestedCategoryId?: string;
}

/** True only when the on-device structuring model is available. v1: always
 *  false (native module deferred). */
export function isReceiptScanSupported(): boolean {
  return false;
}
