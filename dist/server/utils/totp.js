/**
 * TOTP (Time-based One-Time Password) utilities
 * Compatible with pyotp library used in auth module
 */
import * as crypto from 'crypto';
/**
 * Generate TOTP code from secret
 * Uses RFC 6238 (TOTP) algorithm
 *
 * @param secret Base32-encoded secret
 * @returns 6-digit TOTP code
 */
export function generateTotpCode(secret) {
    // Decode base32 secret
    const key = base32Decode(secret);
    // Get current time step (30-second intervals)
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    // Convert time step to 8-byte buffer (big-endian)
    const timeBuffer = Buffer.allocUnsafe(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(timeStep, 4);
    // Generate HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)) % 1000000;
    // Return as 6-digit string with leading zeros
    return code.toString().padStart(6, '0');
}
/**
 * Decode base32 string to buffer
 */
function base32Decode(str) {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const strUpper = str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = [];
    for (let i = 0; i < strUpper.length; i++) {
        const char = strUpper[i];
        const charIndex = base32Chars.indexOf(char);
        if (charIndex === -1) {
            throw new Error(`Invalid base32 character: ${char}`);
        }
        value = (value << 5) | charIndex;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 0xff;
            bits -= 8;
        }
    }
    return Buffer.from(output);
}
/**
 * Parse TOTP URI (otpauth://totp/...?secret=...)
 * Returns the secret from the URI
 */
export function parseTotpUri(uri) {
    try {
        const url = new URL(uri);
        if (url.protocol !== 'otpauth:' || url.hostname !== 'totp') {
            return null;
        }
        const secret = url.searchParams.get('secret');
        return secret;
    }
    catch {
        return null;
    }
}
