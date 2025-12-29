/**
 * SMS sending utility
 *
 * Supports two modes:
 * 1. CAC API mode (recommended) - Uses the CAC /sms/send endpoint with configured Twilio integration
 * 2. Direct Twilio mode (fallback) - Uses Twilio REST API directly with environment variables
 *
 * CAC mode is preferred as it:
 * - Keeps credentials secure in CAC
 * - Works with verified integrations
 * - Provides centralized SMS sending for all feature packs
 */
interface SendSmsOptions {
    to: string;
    body: string;
    fromNumber?: string;
    statusCallback?: string;
}
interface SendSmsResult {
    success: boolean;
    messageSid?: string;
    status?: string;
    error?: string;
}
interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}
/**
 * Send SMS via CAC API (recommended method)
 *
 * Uses the CAC /sms/send endpoint which uses the configured Twilio integration.
 * This keeps credentials secure in CAC and works with any feature pack.
 */
export declare function sendSmsViaCac(options: SendSmsOptions): Promise<SendSmsResult>;
/**
 * Send SMS via Twilio REST API directly (fallback method)
 *
 * Uses environment variables for Twilio credentials.
 * Only used when CAC is not available.
 *
 * @param config Twilio configuration
 * @param options SMS sending options
 * @returns SMS send result
 */
export declare function sendSmsViaTwilio(config: TwilioConfig, options: SendSmsOptions): Promise<SendSmsResult>;
/**
 * Get Twilio configuration from environment variables (fallback)
 */
export declare function getTwilioConfig(): TwilioConfig | null;
/**
 * Send SMS using the best available method
 *
 * Priority:
 * 1. CAC API (if configured) - uses Twilio integration from CAC
 * 2. Direct Twilio API (fallback) - uses TWILIO_* env vars
 *
 * @param options SMS sending options
 * @returns SMS send result
 */
export declare function sendSms(options: SendSmsOptions): Promise<SendSmsResult>;
export {};
//# sourceMappingURL=twilio-sms.d.ts.map