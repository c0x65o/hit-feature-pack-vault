/**
 * Vault API Service
 * Client for interacting with vault API endpoints
 */
const API_BASE = '/api/vault';
/**
 * Vault API Client
 */
export class VaultApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }
    async request(endpoint, options = {}) {
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
    async getVaults() {
        const response = await this.request('/vaults');
        return response.items || [];
    }
    async getVault(id) {
        return this.request(`/vaults/${id}`);
    }
    async createVault(data) {
        return this.request('/vaults', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async updateVault(id, data) {
        return this.request(`/vaults/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
    async deleteVault(id) {
        return this.request(`/vaults/${id}`, {
            method: 'DELETE',
        });
    }
    // Folders
    async getFolders(vaultId, parentId) {
        const params = new URLSearchParams();
        if (vaultId)
            params.append('vaultId', vaultId);
        if (parentId)
            params.append('parentId', parentId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await this.request(`/folders${query}`);
        return response.items || [];
    }
    async getFolder(id) {
        return this.request(`/folders/${id}`);
    }
    async createFolder(data) {
        return this.request('/folders', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async updateFolder(id, data) {
        return this.request(`/folders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
    async moveFolder(id, newParentId) {
        return this.request(`/folders/${id}/move`, {
            method: 'POST',
            body: JSON.stringify({ parentId: newParentId }),
        });
    }
    async deleteFolder(id) {
        return this.request(`/folders/${id}`, {
            method: 'DELETE',
        });
    }
    // Items
    async getItems(vaultId, folderId) {
        const params = new URLSearchParams();
        if (vaultId)
            params.append('vaultId', vaultId);
        if (folderId)
            params.append('folderId', folderId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await this.request(`/items${query}`);
        return response.items || [];
    }
    async getItem(id) {
        return this.request(`/items/${id}`);
    }
    async createItem(data) {
        const response = await this.request('/items', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return response;
    }
    async updateItem(id, data) {
        return this.request(`/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
    async moveItem(id, newFolderId) {
        return this.request(`/items/${id}/move`, {
            method: 'POST',
            body: JSON.stringify({ folderId: newFolderId }),
        });
    }
    async deleteItem(id) {
        return this.request(`/items/${id}`, {
            method: 'DELETE',
        });
    }
    async revealItem(id) {
        return this.request(`/items/${id}/reveal`, {
            method: 'POST',
        });
    }
    async copyItem(id, field) {
        return this.request(`/items/${id}/copy`, {
            method: 'POST',
            body: JSON.stringify({ field }),
        });
    }
    // ACL/Sharing
    async getAcls(resourceType, resourceId) {
        const response = await this.request(`/acl?resource_type=${resourceType}&resource_id=${resourceId}`);
        return response.items || [];
    }
    async createAcl(data) {
        return this.request('/acl', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async deleteAcl(id) {
        return this.request(`/acl/${id}`, {
            method: 'DELETE',
        });
    }
    async recomputeAcl(resourceType, resourceId) {
        return this.request('/acl/recompute', {
            method: 'POST',
            body: JSON.stringify({ resourceType, resourceId }),
        });
    }
    // TOTP
    async importTotp(itemId, secretOrUri) {
        // Try to detect if it's a URI or just a secret
        const isUri = secretOrUri.startsWith('otpauth://');
        return this.request(`/items/${itemId}/totp/import`, {
            method: 'POST',
            body: JSON.stringify(isUri
                ? { qrCode: secretOrUri }
                : { secret: secretOrUri }),
        });
    }
    async generateTotpCode(itemId) {
        return this.request(`/items/${itemId}/totp/code`, {
            method: 'POST',
        });
    }
    async removeTotp(itemId) {
        return this.request(`/items/${itemId}/totp`, {
            method: 'DELETE',
        });
    }
    // SMS 2FA
    async requestSms2fa(itemId, phoneNumber) {
        return this.request(`/items/${itemId}/sms/request`, {
            method: 'POST',
            body: JSON.stringify({ phoneNumber }),
        });
    }
    // SMS
    async getSmsNumbers(vaultId, itemId) {
        const params = new URLSearchParams();
        if (vaultId)
            params.append('vaultId', vaultId);
        if (itemId)
            params.append('itemId', itemId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await this.request(`/sms/numbers${query}`);
        return response.items || [];
    }
    async provisionSmsNumber(vaultId, itemId) {
        return this.request('/sms/numbers', {
            method: 'POST',
            body: JSON.stringify({ vaultId, itemId }),
        });
    }
    async deleteSmsNumber(id) {
        return this.request(`/sms/numbers/${id}`, {
            method: 'DELETE',
        });
    }
    async getSmsMessages(smsNumberId) {
        return this.request(`/sms/numbers/${smsNumberId}/messages`);
    }
    async revealSmsMessage(id) {
        return this.request(`/sms/messages/${id}/reveal`, {
            method: 'POST',
        });
    }
    // Global phone number (admin only)
    async getGlobalPhoneNumber() {
        return this.request('/sms/global');
    }
    async setGlobalPhoneNumber(phoneNumber) {
        return this.request('/sms/global', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber }),
        });
    }
    async deleteGlobalPhoneNumber() {
        return this.request('/sms/global', {
            method: 'DELETE',
        });
    }
    // Latest SMS messages for polling
    async getLatestSmsMessages(since) {
        const params = new URLSearchParams();
        if (since)
            params.append('since', since);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/sms/messages/latest${query}`);
    }
    // Global email address (admin only)
    async getGlobalEmailAddress() {
        return this.request('/email/global');
    }
    async setGlobalEmailAddress(emailAddress) {
        return this.request('/email/global', {
            method: 'POST',
            body: JSON.stringify({ emailAddress }),
        });
    }
    async deleteGlobalEmailAddress() {
        return this.request('/email/global', {
            method: 'DELETE',
        });
    }
    // Latest email messages for polling
    async getLatestEmailMessages(options) {
        const params = new URLSearchParams();
        if (options?.since)
            params.append('since', options.since);
        if (options?.email)
            params.append('email', options.email);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/email/messages/latest${query}`);
    }
    // Search
    async search(query, filters) {
        const params = new URLSearchParams({ q: query });
        // Note: Backend search API currently only supports 'q' parameter
        // Filters are not yet implemented in the backend
        const response = await this.request(`/search?${params.toString()}`);
        return response.items || [];
    }
    // Import
    async previewCsvImport(file, vaultId, folderId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('vaultId', vaultId);
        if (folderId)
            formData.append('folderId', folderId);
        const response = await fetch(`${this.baseUrl}${API_BASE}/import/csv/preview`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }
    async commitCsvImport(data) {
        return this.request('/import/csv/commit', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    // Audit
    async getAuditEvents(filters) {
        const params = new URLSearchParams();
        if (filters?.resourceType)
            params.append('resource_type', filters.resourceType);
        if (filters?.resourceId)
            params.append('resource_id', filters.resourceId);
        if (filters?.action)
            params.append('action', filters.action);
        if (filters?.actorUserId)
            params.append('actor_user_id', filters.actorUserId);
        if (filters?.limit)
            params.append('limit', String(filters.limit));
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/audit${query}`);
    }
    // Webhook Logs (admin only)
    async getWebhookLogs(options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.append('limit', String(options.limit));
        if (options?.offset)
            params.append('offset', String(options.offset));
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/webhook-logs${query}`);
    }
    // Webhook API Key
    async getWebhookApiKey() {
        return this.request('/webhook/api-key');
    }
    async generateWebhookApiKey() {
        return this.request('/webhook/api-key', {
            method: 'POST',
        });
    }
    // Static Groups (fallback)
    async getGroups() {
        const response = await this.request('/groups');
        return response.items || [];
    }
    async createGroup(name, description) {
        return this.request('/groups', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        });
    }
    async updateGroup(id, data) {
        return this.request(`/groups/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }
    async deleteGroup(id) {
        return this.request(`/groups/${id}`, {
            method: 'DELETE',
        });
    }
    async getGroupMembers(groupId) {
        return this.request(`/groups/${groupId}/members`);
    }
    async addGroupMember(groupId, userId) {
        return this.request(`/groups/${groupId}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
    }
    async removeGroupMember(groupId, userId) {
        return this.request(`/groups/${groupId}/members`, {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
        });
    }
}
// Default instance
export const vaultApi = new VaultApiClient();
