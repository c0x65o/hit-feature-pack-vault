/**
 * Vault API Service
 * Client for interacting with vault API endpoints
 */

import type {
  VaultVault,
  VaultFolder,
  VaultItem,
  VaultAcl,
  VaultSmsNumber,
  VaultSmsMessage,
  VaultAuditEvent,
  VaultStaticGroup,
  InsertVaultVault,
  InsertVaultFolder,
  InsertVaultItem,
  InsertVaultAcl,
  VaultPermission,
} from '../schema/vault';

const API_BASE = '/api/vault';

/**
 * Vault API Client
 */
export class VaultApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Vaults
  async getVaults(): Promise<VaultVault[]> {
    return this.request<VaultVault[]>('/vaults');
  }

  async getVault(id: string): Promise<VaultVault> {
    return this.request<VaultVault>(`/vaults/${id}`);
  }

  async createVault(data: InsertVaultVault): Promise<VaultVault> {
    return this.request<VaultVault>('/vaults', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVault(id: string, data: Partial<VaultVault>): Promise<VaultVault> {
    return this.request<VaultVault>(`/vaults/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVault(id: string): Promise<void> {
    return this.request<void>(`/vaults/${id}`, {
      method: 'DELETE',
    });
  }

  // Folders
  async getFolders(vaultId?: string, parentId?: string): Promise<VaultFolder[]> {
    const params = new URLSearchParams();
    if (vaultId) params.append('vault_id', vaultId);
    if (parentId) params.append('parent_id', parentId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VaultFolder[]>(`/folders${query}`);
  }

  async getFolder(id: string): Promise<VaultFolder> {
    return this.request<VaultFolder>(`/folders/${id}`);
  }

  async createFolder(data: InsertVaultFolder): Promise<VaultFolder> {
    return this.request<VaultFolder>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFolder(id: string, data: Partial<VaultFolder>): Promise<VaultFolder> {
    return this.request<VaultFolder>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async moveFolder(id: string, newParentId: string | null): Promise<VaultFolder> {
    return this.request<VaultFolder>(`/folders/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parentId: newParentId }),
    });
  }

  async deleteFolder(id: string): Promise<void> {
    return this.request<void>(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // Items
  async getItems(vaultId?: string, folderId?: string): Promise<VaultItem[]> {
    const params = new URLSearchParams();
    if (vaultId) params.append('vault_id', vaultId);
    if (folderId) params.append('folder_id', folderId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VaultItem[]>(`/items${query}`);
  }

  async getItem(id: string): Promise<VaultItem> {
    return this.request<VaultItem>(`/items/${id}`);
  }

  async createItem(data: InsertVaultItem): Promise<VaultItem> {
    return this.request<VaultItem>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, data: Partial<VaultItem>): Promise<VaultItem> {
    return this.request<VaultItem>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async moveItem(id: string, newFolderId: string | null): Promise<VaultItem> {
    return this.request<VaultItem>(`/items/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ folderId: newFolderId }),
    });
  }

  async deleteItem(id: string): Promise<void> {
    return this.request<void>(`/items/${id}`, {
      method: 'DELETE',
    });
  }

  async revealItem(id: string): Promise<{ password?: string; notes?: string; totpSecret?: string }> {
    return this.request(`/items/${id}/reveal`, {
      method: 'POST',
    });
  }

  async copyItem(id: string, field: 'password' | 'username' | 'totp'): Promise<void> {
    return this.request(`/items/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ field }),
    });
  }

  // ACL/Sharing
  async getAcls(resourceType: string, resourceId: string): Promise<VaultAcl[]> {
    return this.request<VaultAcl[]>(`/acl?resource_type=${resourceType}&resource_id=${resourceId}`);
  }

  async createAcl(data: InsertVaultAcl): Promise<VaultAcl> {
    return this.request<VaultAcl>('/acl', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAcl(id: string): Promise<void> {
    return this.request<void>(`/acl/${id}`, {
      method: 'DELETE',
    });
  }

  async recomputeAcl(resourceType: string, resourceId: string): Promise<void> {
    return this.request<void>('/acl/recompute', {
      method: 'POST',
      body: JSON.stringify({ resourceType, resourceId }),
    });
  }

  // TOTP
  async importTotp(itemId: string, otpauthUri: string): Promise<VaultItem> {
    return this.request<VaultItem>(`/items/${itemId}/totp/import`, {
      method: 'POST',
      body: JSON.stringify({ otpauthUri }),
    });
  }

  async generateTotpCode(itemId: string): Promise<{ code: string; expiresIn: number }> {
    return this.request(`/items/${itemId}/totp/code`, {
      method: 'POST',
    });
  }

  async removeTotp(itemId: string): Promise<void> {
    return this.request<void>(`/items/${itemId}/totp`, {
      method: 'DELETE',
    });
  }

  // SMS
  async getSmsNumbers(vaultId?: string, itemId?: string): Promise<VaultSmsNumber[]> {
    const params = new URLSearchParams();
    if (vaultId) params.append('vault_id', vaultId);
    if (itemId) params.append('item_id', itemId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VaultSmsNumber[]>(`/sms/numbers${query}`);
  }

  async provisionSmsNumber(vaultId: string, itemId?: string): Promise<VaultSmsNumber> {
    return this.request<VaultSmsNumber>('/sms/numbers', {
      method: 'POST',
      body: JSON.stringify({ vaultId, itemId }),
    });
  }

  async deleteSmsNumber(id: string): Promise<void> {
    return this.request<void>(`/sms/numbers/${id}`, {
      method: 'DELETE',
    });
  }

  async getSmsMessages(smsNumberId: string): Promise<VaultSmsMessage[]> {
    return this.request<VaultSmsMessage[]>(`/sms/numbers/${smsNumberId}/messages`);
  }

  async revealSmsMessage(id: string): Promise<{ body: string }> {
    return this.request(`/sms/messages/${id}/reveal`, {
      method: 'POST',
    });
  }

  // Global phone number (admin only)
  async getGlobalPhoneNumber(): Promise<{ phoneNumber: string | null }> {
    return this.request<{ phoneNumber: string | null }>('/sms/global');
  }

  async setGlobalPhoneNumber(phoneNumber: string): Promise<{ phoneNumber: string }> {
    return this.request<{ phoneNumber: string }>('/sms/global', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  async deleteGlobalPhoneNumber(): Promise<void> {
    return this.request<void>('/sms/global', {
      method: 'DELETE',
    });
  }

  // Latest SMS messages for polling
  async getLatestSmsMessages(since?: string): Promise<{
    messages: Array<{
      id: string;
      fromNumber: string;
      toNumber: string;
      receivedAt: Date;
    }>;
  }> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/sms/messages/latest${query}`);
  }

  // Search
  async search(query: string, filters?: {
    vaultId?: string;
    folderId?: string;
    tags?: string[];
    hasTotp?: boolean;
    hasSms?: boolean;
  }): Promise<VaultItem[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.vaultId) params.append('vault_id', filters.vaultId);
    if (filters?.folderId) params.append('folder_id', filters.folderId);
    if (filters?.tags) filters.tags.forEach(tag => params.append('tag', tag));
    if (filters?.hasTotp !== undefined) params.append('has_totp', String(filters.hasTotp));
    if (filters?.hasSms !== undefined) params.append('has_sms', String(filters.hasSms));
    return this.request<VaultItem[]>(`/search?${params.toString()}`);
  }

  // Import
  async previewCsvImport(file: File, vaultId: string, folderId?: string): Promise<{
    preview: Array<Record<string, any>>;
    mappings: Record<string, string>;
    conflicts: Array<{ row: number; reason: string }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('vaultId', vaultId);
    if (folderId) formData.append('folderId', folderId);

    const response = await fetch(`${this.baseUrl}${API_BASE}/import/csv/preview`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async commitCsvImport(data: {
    vaultId: string;
    folderId?: string;
    mappings: Record<string, string>;
    conflictStrategy: 'create' | 'update' | 'skip';
  }): Promise<{ imported: number; updated: number; skipped: number }> {
    return this.request('/import/csv/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Audit
  async getAuditEvents(filters?: {
    resourceType?: string;
    resourceId?: string;
    action?: string;
    actorUserId?: string;
    limit?: number;
  }): Promise<VaultAuditEvent[]> {
    const params = new URLSearchParams();
    if (filters?.resourceType) params.append('resource_type', filters.resourceType);
    if (filters?.resourceId) params.append('resource_id', filters.resourceId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.actorUserId) params.append('actor_user_id', filters.actorUserId);
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<VaultAuditEvent[]>(`/audit${query}`);
  }

  // Static Groups (fallback)
  async getGroups(): Promise<VaultStaticGroup[]> {
    return this.request<VaultStaticGroup[]>('/groups');
  }

  async createGroup(name: string, description?: string): Promise<VaultStaticGroup> {
    return this.request<VaultStaticGroup>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async updateGroup(id: string, data: Partial<VaultStaticGroup>): Promise<VaultStaticGroup> {
    return this.request<VaultStaticGroup>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteGroup(id: string): Promise<void> {
    return this.request<void>(`/groups/${id}`, {
      method: 'DELETE',
    });
  }

  async getGroupMembers(groupId: string): Promise<string[]> {
    return this.request<string[]>(`/groups/${groupId}/members`);
  }

  async addGroupMember(groupId: string, userId: string): Promise<void> {
    return this.request<void>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    return this.request<void>(`/groups/${groupId}/members`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });
  }
}

// Default instance
export const vaultApi = new VaultApiClient();

