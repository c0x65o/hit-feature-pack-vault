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
/**
 * Get CAC URL from environment
 */
function getCacUrl() {
    return process.env.HIT_CAC_URL || process.env.CAC_URL || null;
}
/**
 * Get service token for CAC authentication
 */
function getServiceToken() {
    return process.env.HIT_SERVICE_TOKEN || null;
}
/**
 * Send SMS via CAC API (recommended method)
 *
 * Uses the CAC /sms/send endpoint which uses the configured Twilio integration.
 * This keeps credentials secure in CAC and works with any feature pack.
 */
export async function sendSmsViaCac(options) {
    const cacUrl = getCacUrl();
    const serviceToken = getServiceToken();
    if (!cacUrl) {
        return {
            success: false,
            error: 'CAC URL not configured. Set HIT_CAC_URL environment variable.',
        };
    }
    if (!serviceToken) {
        return {
            success: false,
            error: 'Service token not configured. Set HIT_SERVICE_TOKEN environment variable.',
        };
    }
    try {
        const response = await fetch(`${cacUrl}/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceToken}`,
            },
            body: JSON.stringify({
                to: options.to,
                body: options.body,
                from_number: options.fromNumber,
                status_callback: options.statusCallback,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: data.detail || data.error || `HTTP ${response.status}`,
            };
        }
        return {
            success: true,
            messageSid: data.message_sid,
            status: data.status,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send SMS via CAC',
        };
    }
}
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
export async function sendSmsViaTwilio(config, options) {
    const { accountSid, authToken, fromNumber } = config;
    const { to, body, statusCallback } = options;
    // Validate phone numbers (basic E.164 format check)
    if (!to.match(/^\+?[1-9]\d{1,14}$/)) {
        return {
            success: false,
            error: `Invalid phone number format: ${to}`,
        };
    }
    // Build request URL
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    // Build form data
    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', to);
    formData.append('Body', body);
    if (statusCallback) {
        formData.append('StatusCallback', statusCallback);
    }
    // Make request with basic auth
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });
        const responseData = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: `Twilio API error: ${responseData.message || response.statusText} (Code: ${responseData.code || response.status})`,
            };
        }
        return {
            success: true,
            messageSid: responseData.sid,
            status: responseData.status,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send SMS',
        };
    }
}
/**
 * Get Twilio configuration from environment variables (fallback)
 */
export function getTwilioConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
        return null;
    }
    return {
        accountSid,
        authToken,
        fromNumber,
    };
}
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
export async function sendSms(options) {
    // Try CAC API first (recommended)
    const cacUrl = getCacUrl();
    const serviceToken = getServiceToken();
    if (cacUrl && serviceToken) {
        console.log('[vault] Sending SMS via CAC API');
        return sendSmsViaCac(options);
    }
    // Fallback to direct Twilio API
    console.log('[vault] CAC not configured, falling back to direct Twilio API');
    const twilioConfig = getTwilioConfig();
    if (!twilioConfig) {
        return {
            success: false,
            error: 'Neither CAC nor Twilio is configured. Set HIT_CAC_URL + HIT_SERVICE_TOKEN or TWILIO_* environment variables.',
        };
    }
    return sendSmsViaTwilio(twilioConfig, options);
}
