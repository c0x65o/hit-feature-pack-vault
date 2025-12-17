/**
 * OTP Code Extraction Utility
 * Extracts OTP codes from SMS/Email message text
 */
export interface OtpExtractionResult {
    code: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    pattern: string | null;
    fullMessage: string;
}
/**
 * Extract OTP code from message body with confidence scoring
 */
export declare function extractOtpWithConfidence(messageBody: string): OtpExtractionResult;
/**
 * Extract OTP code from SMS/Email message body
 * Handles various formats from different services
 *
 * @deprecated Use extractOtpWithConfidence for better results
 */
export declare function extractOtpCode(messageBody: string): string | null;
/**
 * Check if a message likely contains an OTP code
 * Returns confidence level
 */
export declare function isOtpMessage(messageBody: string): boolean;
/**
 * Get OTP message keywords for filtering
 */
export declare const OTP_KEYWORDS: string[];
//# sourceMappingURL=otp-extractor.d.ts.map