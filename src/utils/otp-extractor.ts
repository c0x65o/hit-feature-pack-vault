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
  // Steam Guard patterns (alphanumeric, 5 chars, e.g., "TF35D")
  // Most robust: anchors on "Steam Guard code" and captures exactly 5 chars
  { regex: /Steam\s+Guard\s+code[^A-Z0-9]*([A-Z0-9]{5})/i, name: 'steam-guard-robust', confidence: 'high' as const },
  { regex: /steam\s+guard[^a-z0-9]*code[:\s]+([A-Z0-9]{5})/i, name: 'steam-guard', confidence: 'high' as const },
  { regex: /(?:here is|is)\s+(?:the\s+)?steam\s+guard\s+code[:\s]+([A-Z0-9]{5})/i, name: 'steam-guard-here-is', confidence: 'high' as const },
  { regex: /steam\s+guard[^a-z0-9]*([A-Z0-9]{5})/i, name: 'steam-guard-bare', confidence: 'high' as const },
  
  // Alphanumeric codes with common keywords (5-8 chars minimum)
  { regex: /(?:verification|verify|security|auth|otp|pin|code|password)\s*(?:code|number|pin)?[:\s]+([A-Z0-9]{5,8})/i, name: 'keyword-prefix-alphanumeric', confidence: 'high' as const },
  { regex: /([A-Z0-9]{5,8})\s+(?:is|es)\s+(?:your|tu|the)\s+(?:verification|verify|security|auth|otp|pin|code|password)/i, name: 'keyword-suffix-alphanumeric', confidence: 'high' as const },
  
  // Common patterns with explicit OTP keywords (numeric, 5-8 chars minimum)
  { regex: /(?:verification|verify|security|auth|otp|pin|code|password)\s*(?:code|number|pin)?[:\s]+(\d{5,8})/i, name: 'keyword-prefix', confidence: 'high' as const },
  { regex: /(\d{5,8})\s+(?:is|es)\s+(?:your|tu|the)\s+(?:verification|verify|security|auth|otp|pin|code|password)/i, name: 'keyword-suffix', confidence: 'high' as const },
  
  // "Your code is X" style (alphanumeric, 5-8 chars minimum)
  { regex: /(?:your|tu|the)\s+(?:verification\s+)?code\s+(?:is|es)[:\s]+([A-Z0-9]{5,8})/i, name: 'your-code-is-alphanumeric', confidence: 'high' as const },
  // "Your code is X" style (numeric, 5-8 chars minimum)
  { regex: /(?:your|tu|the)\s+(?:verification\s+)?code\s+(?:is|es)[:\s]+(\d{5,8})/i, name: 'your-code-is', confidence: 'high' as const },
  // "code is X" or "verification code is X" (without "your") - numeric, 5-8 chars minimum
  { regex: /(?:verification\s+)?code\s+(?:is|es)\s+(\d{5,8})/i, name: 'code-is-numeric', confidence: 'high' as const },
  // "code is X" or "verification code is X" (without "your") - alphanumeric, 5-8 chars minimum
  { regex: /(?:verification\s+)?code\s+(?:is|es)\s+([A-Z0-9]{5,8})/i, name: 'code-is-alphanumeric', confidence: 'high' as const },
  { regex: /(?:code|código)[:\s]+(\d{5,8})/i, name: 'code-colon', confidence: 'high' as const },
  
  // "Code: X" or "OTP: X" patterns (alphanumeric, 5-8 chars minimum)
  { regex: /\botp[:\s]+([A-Z0-9]{5,8})\b/i, name: 'otp-colon-alphanumeric', confidence: 'high' as const },
  { regex: /\bpin[:\s]+([A-Z0-9]{5,8})\b/i, name: 'pin-colon-alphanumeric', confidence: 'high' as const },
  // "Code: X" or "OTP: X" patterns (numeric, 5-8 chars minimum)
  { regex: /\botp[:\s]+(\d{5,8})\b/i, name: 'otp-colon', confidence: 'high' as const },
  { regex: /\bpin[:\s]+(\d{5,8})\b/i, name: 'pin-colon', confidence: 'high' as const },
  
  // "Use X to verify" patterns (alphanumeric, 5-8 chars minimum)
  { regex: /use\s+([A-Z0-9]{5,8})\s+(?:to|for)\s+(?:verify|confirm|validate)/i, name: 'use-to-verify-alphanumeric', confidence: 'high' as const },
  // "Use X to verify" patterns (numeric, 5-8 chars minimum)
  { regex: /use\s+(\d{5,8})\s+(?:to|for)\s+(?:verify|confirm|validate)/i, name: 'use-to-verify', confidence: 'high' as const },
  
  // "Enter X" patterns (alphanumeric, 5-8 chars minimum)
  { regex: /enter[:\s]+([A-Z0-9]{5,8})/i, name: 'enter-code-alphanumeric', confidence: 'high' as const },
  // "Enter X" patterns (numeric, 5-8 chars minimum)
  { regex: /enter[:\s]+(\d{5,8})/i, name: 'enter-code', confidence: 'high' as const },
  
  // Codes with dashes/spaces (e.g., "123-456" or "123 456") - total must be at least 5 digits
  { regex: /code[:\s]+(\d{3,4}[-\s]\d{3,4})/i, name: 'code-with-dash', confidence: 'high' as const },
  
  // G-XXXXXX pattern (Google)
  { regex: /G-(\d{6})/i, name: 'google-style', confidence: 'high' as const },
  
  // Microsoft pattern
  { regex: /microsoft[^0-9]*(\d{6})/i, name: 'microsoft', confidence: 'high' as const },
  
  // Generic 6-digit in short message (SMS style) - only if message is very short
  { regex: /^[^0-9]*(\d{6})[^0-9]*$/i, name: 'standalone-6-digit', confidence: 'medium' as const },
  
  // Standalone digit sequences (lower confidence, minimum 5 chars)
  // Only match standalone digits, not alphanumeric (to avoid random words)
  { regex: /\b(\d{6})\b/, name: 'bare-6-digit', confidence: 'low' as const },
  { regex: /\b(\d{5})\b/, name: 'bare-5-digit', confidence: 'low' as const },
  { regex: /\b(\d{8})\b/, name: 'bare-8-digit', confidence: 'low' as const },
];

/**
 * Extract OTP code from message body with confidence scoring
 */
export function extractOtpWithConfidence(messageBody: string): OtpExtractionResult {
  if (!messageBody) {
    return { code: null, confidence: 'none', pattern: null, fullMessage: messageBody || '' };
  }

  // First, try HTML-aware patterns for Steam Guard (before stripping HTML)
  // Steam Guard codes are often in specific HTML elements with large fonts
  const htmlSteamPatterns = [
    // HTML-aware pattern for Steam Guard codes in styled elements
    { regex: /x_title-48[^>]*>\s*([A-Z0-9]{5})\s*</i, name: 'steam-guard-html', confidence: 'high' as const },
    // Generic pattern for codes in large/styled HTML elements
    { regex: /(?:font-size|fontSize)[^>]*>\s*([A-Z0-9]{5})\s*</i, name: 'steam-guard-html-font', confidence: 'high' as const },
  ];

  for (const { regex, name, confidence } of htmlSteamPatterns) {
    const match = messageBody.match(regex);
    if (match && match[1]) {
      const code = match[1].replace(/[-\s]/g, '');
      if (code.length === 5 && /^[A-Z0-9]{5}$/.test(code)) {
        return {
          code,
          confidence,
          pattern: name,
          fullMessage: stripHtml(messageBody),
        };
      }
    }
  }

  // Clean up the message (strip HTML if present)
  const cleaned = stripHtml(messageBody);
  
  // Try each pattern in order of confidence
  for (const { regex, name, confidence } of OTP_PATTERNS) {
    const match = cleaned.match(regex);
    if (match && match[1]) {
      // Remove dashes/spaces from code
      const code = match[1].replace(/[-\s]/g, '');
      // Enforce minimum 5 characters for all codes
      if (code.length < 5) {
        continue; // Skip this match, try next pattern
      }
      // Reject letter-only matches (e.g. "codes") — they are far more likely to be normal words.
      // Exception: Steam Guard codes are 5-character alphanumeric and may be letter-only.
      if (!/[\d]/.test(code) && !name.startsWith('steam-guard')) {
        continue;
      }
      return {
        code,
        confidence,
        pattern: name,
        fullMessage: cleaned,
      };
    }
  }

  // Fallback: look for digit sequences (minimum 5 chars) and pick the best candidate.
  // Important: a naive "first match wins" often grabs ZIP codes / street numbers in emails.
  const digitCandidates = Array.from(cleaned.matchAll(/\b\d{5,8}\b/g)).map((m) => ({
    value: m[0],
    index: m.index ?? -1,
  }));
  if (digitCandidates.length > 0) {
    const KEYWORDS = [
      'verification',
      'verify',
      'code',
      'otp',
      'pin',
      'security',
      'auth',
      '2fa',
      'two-factor',
      'login',
      'sign-in',
      'signin',
    ];

    const score = (cand: { value: string; index: number }) => {
      let s = 0;
      // Prefer 6-digit codes (most common), then 5/8.
      if (cand.value.length === 6) s += 4;
      else if (cand.value.length === 5) s += 2;
      else if (cand.value.length === 8) s += 1;

      // Keyword proximity: look ±40 chars around the candidate.
      if (cand.index >= 0) {
        const start = Math.max(0, cand.index - 40);
        const end = Math.min(cleaned.length, cand.index + cand.value.length + 40);
        const window = cleaned.slice(start, end).toLowerCase();
        for (const k of KEYWORDS) {
          if (window.includes(k)) s += 2;
        }
        // Common “code in app: 123456” pattern includes a colon near the number.
        if (window.includes(':')) s += 1;
      }

      // Avoid obvious “address-like” context: Penalize if nearby contains common address tokens.
      if (cand.index >= 0) {
        const start = Math.max(0, cand.index - 60);
        const end = Math.min(cleaned.length, cand.index + cand.value.length + 60);
        const window = cleaned.slice(start, end).toLowerCase();
        if (window.includes('blvd') || window.includes('ave') || window.includes('street') || window.includes('st ')) {
          s -= 3;
        }
        if (window.includes('ca ') || window.includes('ny ') || window.includes('tx ')) {
          s -= 1;
        }
      }

      return s;
    };

    const best = digitCandidates
      .slice()
      .sort((a, b) => score(b) - score(a))[0];

    return {
      code: best.value,
      confidence: 'low',
      pattern: 'fallback-digit-best-candidate',
      fullMessage: cleaned,
    };
  }

  // No fallback for alphanumeric sequences - they match too many random words
  // Only context-aware patterns should extract alphanumeric codes

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
 * Improved handling for better OTP extraction from HTML emails
 */
function stripHtml(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // First, try to extract text from common HTML structures that might contain OTP codes
  // Look for text in <strong>, <b>, <span>, <div>, <p>, <td>, <h1-h6> tags
  // These are often used to highlight OTP codes
  const codePatterns = [
    /<strong[^>]*>([^<]*)<\/strong>/gi,
    /<b[^>]*>([^<]*)<\/b>/gi,
    /<span[^>]*>([^<]*)<\/span>/gi,
    /<div[^>]*>([^<]*)<\/div>/gi,
    /<p[^>]*>([^<]*)<\/p>/gi,
    /<td[^>]*>([^<]*)<\/td>/gi,
    /<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi,
  ];
  
  // Extract text from these tags and preserve it
  const extractedTexts: string[] = [];
  codePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        extractedTexts.push(match[1].trim());
      }
    }
  });
  
  // Remove script and style tags completely
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // Replace <br>, <br/>, <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Replace </p>, </div>, </li>, </td>, </tr> with newlines
  text = text.replace(/<\/(p|div|li|td|tr)>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities (more comprehensive)
  const entityMap: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp': ' ',
    '&amp': '&',
    '&lt': '<',
    '&gt': '>',
    '&quot': '"',
  };
  
  // Decode named entities
  Object.entries(entityMap).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'gi'), char);
  });
  
  // Decode numeric entities (&#123; and &#x1F;)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Combine extracted texts with main text
  if (extractedTexts.length > 0) {
    text = extractedTexts.join(' ') + ' ' + text;
  }
  
  // Normalize whitespace - replace multiple spaces/newlines with single space
  text = text.replace(/[\s\n\r]+/g, ' ');
  
  // Trim and return
  return text.trim();
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
  'steam',
  'steam guard',
];
