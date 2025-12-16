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
export declare function extractOtpCode(messageBody: string): string | null;
/**
 * Check if a message likely contains an OTP code
 */
export declare function isOtpMessage(messageBody: string): boolean;
//# sourceMappingURL=otp-extractor.d.ts.map