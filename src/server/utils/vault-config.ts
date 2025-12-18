import { HIT_CONFIG } from '@/lib/hit-config.generated';

export type VaultRealtimeConfig = {
  realtimeOtpEnabled: boolean;
  realtimeOtpEventType: string;
};

function readVaultOptionsFromHitConfig(): Record<string, unknown> | null {
  try {
    const opts = (HIT_CONFIG as any)?.featurePacks?.vault;
    if (opts && typeof opts === 'object') {
      return opts as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getVaultRealtimeConfig(): VaultRealtimeConfig {
  const opts = readVaultOptionsFromHitConfig();

  const realtimeOtpEnabled =
    (opts?.realtime_otp_enabled as boolean | undefined) ??
    // Env fallback (if host maps options into env vars)
    (typeof process !== 'undefined' && process.env?.VAULT_REALTIME_OTP_ENABLED
      ? process.env.VAULT_REALTIME_OTP_ENABLED !== 'false'
      : true);

  const realtimeOtpEventType =
    (opts?.realtime_otp_event_type as string | undefined) ??
    (typeof process !== 'undefined' && process.env?.VAULT_REALTIME_OTP_EVENT_TYPE
      ? process.env.VAULT_REALTIME_OTP_EVENT_TYPE
      : 'vault.otp_received');

  return {
    realtimeOtpEnabled: Boolean(realtimeOtpEnabled),
    realtimeOtpEventType: realtimeOtpEventType || 'vault.otp_received',
  };
}


