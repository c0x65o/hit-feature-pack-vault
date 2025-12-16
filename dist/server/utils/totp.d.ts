/**
 * TOTP (Time-based One-Time Password) utilities
 * Compatible with pyotp library used in auth module
 */
/**
 * Generate TOTP code from secret
 * Uses RFC 6238 (TOTP) algorithm
 *
 * @param secret Base32-encoded secret
 * @returns 6-digit TOTP code
 */
export declare function generateTotpCode(secret: string): string;
/**
 * Parse TOTP URI (otpauth://totp/...?secret=...)
 * Returns the secret from the URI
 */
export declare function parseTotpUri(uri: string): string | null;
//# sourceMappingURL=totp.d.ts.map