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
 * Known OTP patterns from common services
 */
const OTP_PATTERNS = [
  // Common patterns with explicit OTP keywords
  { regex: /(?:verification|verify|security|auth|otp|pin|code|password)\s*(?:code|number|pin)?[:\s]+(\d{4,8})/i, name: 'keyword-prefix', confidence: 'high' as const },
  { regex: /(\d{4,8})\s+(?:is|es)\s+(?:your|tu|the)\s+(?:verification|verify|security|auth|otp|pin|code|password)/i, name: 'keyword-suffix', confidence: 'high' as const },
  
  // "Your code is X" style
  { regex: /(?:your|tu|the)\s+(?:verification\s+)?code\s+(?:is|es)[:\s]+(\d{4,8})/i, name: 'your-code-is', confidence: 'high' as const },
  { regex: /(?:code|código)[:\s]+(\d{4,8})/i, name: 'code-colon', confidence: 'high' as const },
  
  // "Code: X" or "OTP: X" patterns
  { regex: /\botp[:\s]+(\d{4,8})\b/i, name: 'otp-colon', confidence: 'high' as const },
  { regex: /\bpin[:\s]+(\d{4,8})\b/i, name: 'pin-colon', confidence: 'high' as const },
  
  // "Use X to verify" patterns
  { regex: /use\s+(\d{4,8})\s+(?:to|for)\s+(?:verify|confirm|validate)/i, name: 'use-to-verify', confidence: 'high' as const },
  
  // "Enter X" patterns
  { regex: /enter[:\s]+(\d{4,8})/i, name: 'enter-code', confidence: 'high' as const },
  
  // Codes with dashes/spaces (e.g., "123-456" or "123 456")
  { regex: /code[:\s]+(\d{2,4}[-\s]\d{2,4})/i, name: 'code-with-dash', confidence: 'high' as const },
  
  // G-XXXXXX pattern (Google)
  { regex: /G-(\d{6})/i, name: 'google-style', confidence: 'high' as const },
  
  // Microsoft pattern
  { regex: /microsoft[^0-9]*(\d{6})/i, name: 'microsoft', confidence: 'high' as const },
  
  // Generic 6-digit in short message (SMS style)
  { regex: /^[^0-9]*(\d{6})[^0-9]*$/i, name: 'standalone-6-digit', confidence: 'medium' as const },
  
  // Standalone digit sequences (lower confidence)
  { regex: /\b(\d{6})\b/, name: 'bare-6-digit', confidence: 'low' as const },
  { regex: /\b(\d{4})\b/, name: 'bare-4-digit', confidence: 'low' as const },
  { regex: /\b(\d{8})\b/, name: 'bare-8-digit', confidence: 'low' as const },
];

/**
 * Extract OTP code from message body with confidence scoring
 */
export function extractOtpWithConfidence(messageBody: string): OtpExtractionResult {
  if (!messageBody) {
    return { code: null, confidence: 'none', pattern: null, fullMessage: messageBody || '' };
  }

  // Clean up the message (strip HTML if present)
  const cleaned = stripHtml(messageBody);
  
  // Try each pattern in order of confidence
  for (const { regex, name, confidence } of OTP_PATTERNS) {
    const match = cleaned.match(regex);
    if (match && match[1]) {
      // Remove dashes/spaces from code
      const code = match[1].replace(/[-\s]/g, '');
      return {
        code,
        confidence,
        pattern: name,
        fullMessage: cleaned,
      };
    }
  }

  // Fallback: look for any 4-8 digit sequence
  const digitMatch = cleaned.match(/\d{4,8}/);
  if (digitMatch) {
    return {
      code: digitMatch[0],
      confidence: 'low',
      pattern: 'fallback-digit-sequence',
      fullMessage: cleaned,
    };
  }

  return { code: null, confidence: 'none', pattern: null, fullMessage: cleaned };
}

/**
 * Extract OTP code from SMS/Email message body
 * Handles various formats from different services
 * 
 * @deprecated Use extractOtpWithConfidence for better results
 */
export function extractOtpCode(messageBody: string): string | null {
  const result = extractOtpWithConfidence(messageBody);
  return result.code;
}

/**
 * Strip HTML tags and decode HTML entities
 */
function stripHtml(html: string): string {
  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a message likely contains an OTP code
 * Returns confidence level
 */
export function isOtpMessage(messageBody: string): boolean {
  const result = extractOtpWithConfidence(messageBody);
  return result.confidence !== 'none';
}

/**
 * Get OTP message keywords for filtering
 */
export const OTP_KEYWORDS = [
  'code',
  'verification',
  'verify',
  'otp',
  'pin',
  'password',
  'authenticate',
  'authentication',
  '2fa',
  'two-factor',
  'security code',
  'one-time',
  'login code',
  'sign-in',
  'signin',
];
