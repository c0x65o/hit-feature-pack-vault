/**
 * OTP Code Extraction Utility
 * Extracts OTP codes from SMS message text
 */
/**
 * Extract OTP code from SMS message body
 * Handles various formats:
 * - "Your code is 123456"
 * - "123456 is your verification code"
 * - "Code: 123456"
 * - "123456"
 * - "Your verification code is 123-456" (with dashes)
 */
export function extractOtpCode(messageBody) {
    if (!messageBody)
        return null;
    // Remove common prefixes and suffixes
    const cleaned = messageBody
        .replace(/[^\d]/g, ' ') // Replace non-digits with spaces
        .trim();
    // Look for 4-8 digit codes (most OTPs are 4-8 digits)
    const patterns = [
        /\b(\d{6})\b/, // 6 digits (most common)
        /\b(\d{4})\b/, // 4 digits
        /\b(\d{5})\b/, // 5 digits
        /\b(\d{7})\b/, // 7 digits
        /\b(\d{8})\b/, // 8 digits
    ];
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            return match[1];
        }
    }
    // Try to find any sequence of 4-8 digits
    const digitSequence = cleaned.match(/\d{4,8}/);
    if (digitSequence) {
        return digitSequence[0];
    }
    return null;
}
/**
 * Check if a message likely contains an OTP code
 */
export function isOtpMessage(messageBody) {
    if (!messageBody)
        return false;
    const lowerBody = messageBody.toLowerCase();
    const otpKeywords = [
        'code',
        'verification',
        'otp',
        'pin',
        'password',
        'verify',
        'authentication',
        '2fa',
        'two-factor',
    ];
    return otpKeywords.some(keyword => lowerBody.includes(keyword));
}
