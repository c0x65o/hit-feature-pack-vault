import { HIT_CONFIG } from '@/lib/hit-config.generated';
function readVaultOptionsFromHitConfig() {
    try {
        const opts = HIT_CONFIG?.featurePacks?.vault;
        if (opts && typeof opts === 'object') {
            return opts;
        }
    }
    catch {
        // ignore
    }
    return null;
}
export function getVaultRealtimeConfig() {
    const opts = readVaultOptionsFromHitConfig();
    const realtimeOtpEnabled = opts?.realtime_otp_enabled ??
        // Env fallback (if host maps options into env vars)
        (typeof process !== 'undefined' && process.env?.VAULT_REALTIME_OTP_ENABLED
            ? process.env.VAULT_REALTIME_OTP_ENABLED !== 'false'
            : true);
    const realtimeOtpEventType = opts?.realtime_otp_event_type ??
        (typeof process !== 'undefined' && process.env?.VAULT_REALTIME_OTP_EVENT_TYPE
            ? process.env.VAULT_REALTIME_OTP_EVENT_TYPE
            : 'vault.otp_received');
    return {
        realtimeOtpEnabled: Boolean(realtimeOtpEnabled),
        realtimeOtpEventType: realtimeOtpEventType || 'vault.otp_received',
    };
}
