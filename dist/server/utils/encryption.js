/**
 * Encryption utilities for vault secrets
 * Note: In production, this should use proper KMS (Key Management Service)
 * For now, using AES-256-GCM with a key derived from environment variable
 */
import * as crypto from 'crypto';
function getEncryptionKey() {
    const encryptionKey = process.env.VAULT_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';
    return crypto.createHash('sha256').update(encryptionKey).digest();
}
/**
 * Encrypt a string value
 * Returns: iv:authTag:encrypted (all base64)
 */
export function encrypt(value) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}
/**
 * Decrypt a string value
 * Input format: iv:authTag:encrypted (all base64)
 */
export function decrypt(encryptedValue) {
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
    }
    const [ivBase64, authTagBase64, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
