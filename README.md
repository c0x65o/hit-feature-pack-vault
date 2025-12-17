# @hit/feature-pack-vault

Password management and 2FA vault feature pack with team sharing, folders, CSV import, TOTP, and SMS inbox.

## Features

- **Personal Vaults**: Private, unshareable password vaults
- **Shared Vaults**: Team/organization vaults with ACL-based sharing
- **Folder Tree**: Organize credentials in a hierarchical folder structure
- **Credential Items**: Store passwords, usernames, URLs, notes, and tags
- **2FA TOTP**: Import and generate TOTP codes from authenticator apps
- **SMS Inbox**: Provision phone numbers for receiving OTP codes via SMS
- **CSV Import**: Bulk import passwords from CSV files with preview and mapping
- **Access Control**: Fine-grained permissions (view, reveal, edit, share, etc.)
- **Audit Logging**: Comprehensive audit trail for all sensitive actions
- **Dynamic/Static Groups**: Supports dynamic groups from auth module or falls back to static groups/roles

## Installation

```bash
npm install @hit/feature-pack-vault
```

## Usage

Add to your `hit.yaml`:

```yaml
feature_packs:
  - name: vault
    version: "1.0.0"
    options:
      use_dynamic_groups: false  # Use dynamic groups if auth.user_groups_enabled is true
      sms_provider: "fdroid"  # Options: "twilio", "fdroid", or "custom"
      sms_retention_days: 30
      encryption_key_version: 1
      enable_export: true
      require_reauth_for_reveal: false
```

### SMS Provider Configuration

The vault supports multiple SMS providers for receiving OTP codes:

#### F-Droid (Recommended for OTP)
Use an Android phone with F-Droid SMS forwarding app to relay SMS messages to the webhook.

**Setup:**
1. Install an SMS forwarding app from F-Droid (e.g., "SMS Forwarder")
2. Configure the app to forward SMS to: `https://your-domain.com/api/vault/sms/webhook/inbound`
3. Set the Authorization header: `Bearer <VAULT_SMS_WEBHOOK_API_KEY>` or use `X-API-Key` header
4. Add the phone number in the vault settings with provider set to `"fdroid"`

**Environment Variable:**
```bash
VAULT_SMS_WEBHOOK_API_KEY=your-secret-api-key-here
```

**Webhook Format (JSON):**
```json
{
  "from": "+1234567890",
  "to": "+0987654321",
  "body": "Your OTP code is 123456",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Twilio (For sending SMS, 2FA provider)
Twilio is still used for **sending** SMS messages (2FA requests). For receiving SMS, use F-Droid or keep Twilio webhook configured.

**Note:** Twilio virtual numbers may filter OTP codes, so F-Droid with a real phone number is recommended for receiving OTP codes.

Import the schema into your Drizzle schema:

```typescript
import {
  vaultVaults,
  vaultFolders,
  vaultItems,
  vaultAcls,
  vaultSmsNumbers,
  vaultSmsMessages,
  vaultAuditEvents,
  vaultStaticGroups,
  vaultGroupMembers,
} from '@hit/feature-pack-vault/schema';
```

## Schema

The feature pack provides the following database tables:

- `vault_vaults` - Personal and shared vaults
- `vault_folders` - Folder tree structure
- `vault_items` - Credential items with encrypted secrets
- `vault_acls` - Access control entries for sharing
- `vault_sms_numbers` - Provisioned SMS phone numbers
- `vault_sms_messages` - Inbound SMS messages (encrypted)
- `vault_audit_events` - Audit log for all actions
- `vault_static_groups` - Static groups (fallback when dynamic groups not enabled)
- `vault_group_members` - Group membership (static groups only)

## API Routes

The feature pack expects the following API routes to be implemented:

- `/api/vault/vaults` - Vault CRUD
- `/api/vault/folders` - Folder CRUD
- `/api/vault/items` - Item CRUD
- `/api/vault/items/[id]/reveal` - Reveal decrypted password
- `/api/vault/items/[id]/totp/code` - Generate TOTP code
- `/api/vault/acl` - ACL management
- `/api/vault/sms/numbers` - SMS number provisioning
- `/api/vault/sms/webhook/inbound` - Inbound SMS webhook
- `/api/vault/import/csv/preview` - CSV import preview
- `/api/vault/import/csv/commit` - Commit CSV import
- `/api/vault/search` - Search items
- `/api/vault/audit` - Audit log access

See `feature-pack.yaml` for complete API route documentation.

## Permissions

The feature pack uses a fine-grained permission system:

- `VIEW_METADATA` - View title, username, URL, tags
- `REVEAL_PASSWORD` - Reveal decrypted password
- `COPY_PASSWORD` - Copy password to clipboard
- `EDIT` - Edit item
- `DELETE` - Delete item
- `SHARE` - Manage ACL/sharing
- `GENERATE_TOTP` - Generate TOTP code
- `REVEAL_TOTP_SECRET` - Reveal TOTP secret (admin only)
- `READ_SMS` - Read SMS inbox
- `MANAGE_SMS` - Provision/manage SMS numbers
- `IMPORT` - Import items into folder

## Group Management

The feature pack supports two group modes:

1. **Dynamic Groups** (preferred): When `auth.user_groups_enabled` is `true`, uses groups from the auth module JWT claims or directory API
2. **Static Groups** (fallback): When dynamic groups are not enabled, uses static groups stored in `vault_static_groups` table

Set `use_dynamic_groups: true` in feature pack options to use dynamic groups when available.

## Encryption

The feature pack uses envelope encryption:

- KMS key encrypts per-vault data encryption keys (DEKs)
- Item secrets encrypted with DEK using AEAD (AES-GCM)
- Key rotation supported via `encryption_key_version`

**Note**: Backend implementation must handle encryption/decryption. The feature pack provides the schema and UI only.

## Development

```bash
npm install
npm run dev  # Watch mode
npm run build  # Build for production
```

## License

MIT

