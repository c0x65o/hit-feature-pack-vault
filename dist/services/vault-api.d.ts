/**
 * Vault API Service
 * Client for interacting with vault API endpoints
 */
import type { VaultVault, VaultFolder, VaultItem, VaultAcl, VaultSmsNumber, VaultSmsMessage, VaultAuditEvent, VaultStaticGroup, InsertVaultVault, InsertVaultFolder, InsertVaultItem, InsertVaultAcl } from '../schema/vault';
/**
 * Vault API Client
 */
export declare class VaultApiClient {
    private baseUrl;
    constructor(baseUrl?: string);
    private request;
    getVaults(): Promise<VaultVault[]>;
    getVault(id: string): Promise<VaultVault>;
    createVault(data: InsertVaultVault): Promise<VaultVault>;
    updateVault(id: string, data: Partial<VaultVault>): Promise<VaultVault>;
    deleteVault(id: string): Promise<void>;
    getFolders(vaultId?: string, parentId?: string): Promise<VaultFolder[]>;
    getFolder(id: string): Promise<VaultFolder>;
    createFolder(data: InsertVaultFolder): Promise<VaultFolder>;
    updateFolder(id: string, data: Partial<VaultFolder>): Promise<VaultFolder>;
    moveFolder(id: string, newParentId: string | null): Promise<VaultFolder>;
    deleteFolder(id: string): Promise<void>;
    getItems(vaultId?: string, folderId?: string): Promise<VaultItem[]>;
    getItem(id: string): Promise<VaultItem>;
    createItem(data: InsertVaultItem): Promise<VaultItem>;
    updateItem(id: string, data: Partial<VaultItem>): Promise<VaultItem>;
    moveItem(id: string, newFolderId: string | null): Promise<VaultItem>;
    deleteItem(id: string): Promise<void>;
    revealItem(id: string): Promise<{
        password?: string;
        notes?: string;
        totpSecret?: string;
    }>;
    copyItem(id: string, field: 'password' | 'username' | 'totp'): Promise<void>;
    getAcls(resourceType: string, resourceId: string): Promise<VaultAcl[]>;
    createAcl(data: InsertVaultAcl): Promise<VaultAcl>;
    deleteAcl(id: string): Promise<void>;
    recomputeAcl(resourceType: string, resourceId: string): Promise<void>;
    importTotp(itemId: string, otpauthUri: string): Promise<VaultItem>;
    generateTotpCode(itemId: string): Promise<{
        code: string;
        expiresIn: number;
    }>;
    removeTotp(itemId: string): Promise<void>;
    getSmsNumbers(vaultId?: string, itemId?: string): Promise<VaultSmsNumber[]>;
    provisionSmsNumber(vaultId: string, itemId?: string): Promise<VaultSmsNumber>;
    deleteSmsNumber(id: string): Promise<void>;
    getSmsMessages(smsNumberId: string): Promise<VaultSmsMessage[]>;
    revealSmsMessage(id: string): Promise<{
        body: string;
    }>;
    getGlobalPhoneNumber(): Promise<{
        phoneNumber: string | null;
    }>;
    setGlobalPhoneNumber(phoneNumber: string): Promise<{
        phoneNumber: string;
    }>;
    deleteGlobalPhoneNumber(): Promise<void>;
    getLatestSmsMessages(since?: string): Promise<{
        messages: Array<{
            id: string;
            fromNumber: string;
            toNumber: string;
            receivedAt: Date;
        }>;
    }>;
    search(query: string, filters?: {
        vaultId?: string;
        folderId?: string;
        tags?: string[];
        hasTotp?: boolean;
        hasSms?: boolean;
    }): Promise<VaultItem[]>;
    previewCsvImport(file: File, vaultId: string, folderId?: string): Promise<{
        preview: Array<Record<string, any>>;
        mappings: Record<string, string>;
        conflicts: Array<{
            row: number;
            reason: string;
        }>;
    }>;
    commitCsvImport(data: {
        vaultId: string;
        folderId?: string;
        mappings: Record<string, string>;
        conflictStrategy: 'create' | 'update' | 'skip';
    }): Promise<{
        imported: number;
        updated: number;
        skipped: number;
    }>;
    getAuditEvents(filters?: {
        resourceType?: string;
        resourceId?: string;
        action?: string;
        actorUserId?: string;
        limit?: number;
    }): Promise<VaultAuditEvent[]>;
    getGroups(): Promise<VaultStaticGroup[]>;
    createGroup(name: string, description?: string): Promise<VaultStaticGroup>;
    updateGroup(id: string, data: Partial<VaultStaticGroup>): Promise<VaultStaticGroup>;
    deleteGroup(id: string): Promise<void>;
    getGroupMembers(groupId: string): Promise<string[]>;
    addGroupMember(groupId: string, userId: string): Promise<void>;
    removeGroupMember(groupId: string, userId: string): Promise<void>;
}
export declare const vaultApi: VaultApiClient;
//# sourceMappingURL=vault-api.d.ts.map