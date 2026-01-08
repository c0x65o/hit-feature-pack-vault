/**
 * Encryption utilities for vault secrets
 * Note: In production, this should use proper KMS (Key Management Service)
 * For now, using AES-256-GCM with a key derived from environment variable
 */
/**
 * Encrypt a string value
 * Returns: iv:authTag:encrypted (all base64)
 */
export declare function encrypt(value: string): string;
/**
 * Decrypt a string value
 * Input format: iv:authTag:encrypted (all base64)
 */
export declare function decrypt(encryptedValue: string): string;
//# sourceMappingURL=encryption.d.ts.map