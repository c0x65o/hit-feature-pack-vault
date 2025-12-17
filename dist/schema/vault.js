/**
 * Vault Schema
 *
 * Drizzle table definitions for the password management vault feature pack.
 * This schema gets merged into the project's database.
 *
 * Features:
 * - Personal and shared vaults
 * - Folder tree organization
 * - Credential items with encrypted secrets
 * - ACL-based sharing (users and groups)
 * - TOTP 2FA support
 * - SMS inbox for OTP codes
 * - Audit logging
 * - Static groups (fallback when dynamic groups not enabled)
 */
import { pgTable, varchar, text, timestamp, uuid, boolean, jsonb, integer, index, unique, pgEnum, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
/**
 * Vault Types
 */
export const vaultTypeEnum = pgEnum("vault_type", ["personal", "shared"]);
/**
 * Item Types
 */
export const itemTypeEnum = pgEnum("item_type", ["credential", "api_key", "secure_note"]);
/**
 * Principal Types for ACL
 */
export const principalTypeEnum = pgEnum("principal_type", ["user", "group", "role"]);
/**
 * SMS Number Status
 */
export const smsStatusEnum = pgEnum("sms_status", ["active", "inactive", "pending"]);
/**
 * Audit Action Types
 */
export const auditActionEnum = pgEnum("audit_action", [
    "ITEM_VIEW_METADATA",
    "ITEM_REVEAL_PASSWORD",
    "ITEM_COPY_PASSWORD",
    "ITEM_GENERATE_TOTP",
    "ITEM_REVEAL_TOTP_SECRET",
    "SMS_READ_MESSAGE",
    "CSV_IMPORT_RUN",
    "ACL_CHANGED",
    "VAULT_CREATED",
    "VAULT_DELETED",
    "FOLDER_CREATED",
    "FOLDER_DELETED",
    "FOLDER_MOVED",
    "ITEM_CREATED",
    "ITEM_UPDATED",
    "ITEM_DELETED",
    "ITEM_MOVED",
]);
/**
 * Vaults Table
 * Stores personal and shared vaults
 */
export const vaultVaults = pgTable("vault_vaults", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: vaultTypeEnum("type").notNull(), // personal | shared
    name: varchar("name", { length: 255 }).notNull(),
    ownerUserId: varchar("owner_user_id", { length: 255 }).notNull(), // For personal vaults
    ownerOrgId: varchar("owner_org_id", { length: 255 }), // For shared vaults (optional)
    tenantId: varchar("tenant_id", { length: 255 }), // For multi-tenant (optional)
    encryptionKeyVersion: integer("encryption_key_version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    ownerIdx: index("vault_vaults_owner_idx").on(table.ownerUserId),
    typeIdx: index("vault_vaults_type_idx").on(table.type),
    tenantIdx: index("vault_vaults_tenant_idx").on(table.tenantId),
}));
/**
 * Folders Table
 * Folder tree with materialized path support
 */
export const vaultFolders = pgTable("vault_folders", {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
        .references(() => vaultVaults.id, { onDelete: "cascade" })
        .notNull(),
    // Self-referencing foreign key: provide explicit return type to avoid TS circular inference issues
    parentId: uuid("parent_id").references(() => vaultFolders.id, { onDelete: "cascade" }), // Nullable for root folders
    name: varchar("name", { length: 255 }).notNull(),
    path: text("path").notNull(), // Materialized path (e.g., "/root/eng/prod")
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    vaultIdx: index("vault_folders_vault_idx").on(table.vaultId),
    parentIdx: index("vault_folders_parent_idx").on(table.parentId),
    pathIdx: index("vault_folders_path_idx").on(table.path), // For subtree queries
    vaultParentNameIdx: unique("vault_folders_vault_parent_name_unique").on(table.vaultId, table.parentId, table.name), // Unique name among siblings
}));
/**
 * Items Table (Credentials)
 * Stores password entries and other secrets
 */
export const vaultItems = pgTable("vault_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id")
        .references(() => vaultVaults.id, { onDelete: "cascade" })
        .notNull(),
    folderId: uuid("folder_id").references(() => vaultFolders.id, { onDelete: "set null" }), // Nullable for root items
    type: itemTypeEnum("type").notNull().default("credential"),
    // Metadata fields (searchable, not encrypted)
    title: varchar("title", { length: 255 }).notNull(),
    username: varchar("username", { length: 255 }),
    url: varchar("url", { length: 500 }),
    tags: jsonb("tags").$type(), // Array of tag strings
    // Encrypted secret blob (JSON payload: password, notes, totp_secret, recovery_codes, etc.)
    secretBlobEncrypted: text("secret_blob_encrypted").notNull(), // Base64-encoded encrypted JSON
    secretVersion: integer("secret_version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    vaultIdx: index("vault_items_vault_idx").on(table.vaultId),
    folderIdx: index("vault_items_folder_idx").on(table.folderId),
    titleIdx: index("vault_items_title_idx").on(table.title),
    usernameIdx: index("vault_items_username_idx").on(table.username),
    urlIdx: index("vault_items_url_idx").on(table.url),
    tagsIdx: index("vault_items_tags_idx").on(table.tags), // GIN index for JSONB array search
    createdByIdx: index("vault_items_created_by_idx").on(table.createdBy),
}));
/**
 * ACL Table (Access Control Entries)
 * Defines permissions for vaults, folders, and items
 */
export const vaultAcls = pgTable("vault_acls", {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // vault | folder | item
    resourceId: uuid("resource_id").notNull(), // ID of vault/folder/item
    principalType: principalTypeEnum("principal_type").notNull(), // user | group | role
    principalId: varchar("principal_id", { length: 255 }).notNull(), // User email, group ID, or role name
    // Permissions bitmask or JSON array of permission strings
    // Permissions: VIEW_METADATA, REVEAL_PASSWORD, COPY_PASSWORD, EDIT, DELETE, SHARE, GENERATE_TOTP, REVEAL_TOTP_SECRET, READ_SMS, MANAGE_SMS, IMPORT
    permissions: jsonb("permissions").$type().notNull(),
    inherit: boolean("inherit").notNull().default(true), // If folder-level, applies to children
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    resourceIdx: index("vault_acls_resource_idx").on(table.resourceType, table.resourceId),
    principalIdx: index("vault_acls_principal_idx").on(table.principalType, table.principalId),
    resourcePrincipalIdx: unique("vault_acls_resource_principal_unique").on(table.resourceType, table.resourceId, table.principalType, table.principalId), // One ACL entry per resource+principal
}));
/**
 * Static Groups Table (fallback when dynamic groups not enabled)
 * Only used when auth.user_groups_enabled is false
 */
export const vaultStaticGroups = pgTable("vault_static_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull().default("static"), // static | dynamic_ref
    externalRef: varchar("external_ref", { length: 255 }), // For dynamic groups mapping (if hybrid)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    nameIdx: index("vault_static_groups_name_idx").on(table.name),
}));
/**
 * Group Members Table (static groups only)
 * Many-to-many relationship between users and static groups
 */
export const vaultGroupMembers = pgTable("vault_group_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
        .references(() => vaultStaticGroups.id, { onDelete: "cascade" })
        .notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(), // User email
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    groupIdx: index("vault_group_members_group_idx").on(table.groupId),
    userIdx: index("vault_group_members_user_idx").on(table.userId),
    groupUserIdx: unique("vault_group_members_group_user_unique").on(table.groupId, table.userId),
}));
/**
 * SMS Numbers Table
 * Provisioned phone numbers for SMS inbox
 */
export const vaultSmsNumbers = pgTable("vault_sms_numbers", {
    id: uuid("id").primaryKey().defaultRandom(),
    vaultId: uuid("vault_id").references(() => vaultVaults.id, { onDelete: "cascade" }), // Optional: per-vault number
    itemId: uuid("item_id").references(() => vaultItems.id, { onDelete: "cascade" }), // Optional: per-item number
    phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(),
    provider: varchar("provider", { length: 50 }).notNull().default("twilio"),
    status: smsStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    vaultIdx: index("vault_sms_numbers_vault_idx").on(table.vaultId),
    itemIdx: index("vault_sms_numbers_item_idx").on(table.itemId),
    phoneIdx: index("vault_sms_numbers_phone_idx").on(table.phoneNumber),
}));
/**
 * SMS Messages Table
 * Inbound SMS messages (encrypted)
 */
export const vaultSmsMessages = pgTable("vault_sms_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    smsNumberId: uuid("sms_number_id")
        .references(() => vaultSmsNumbers.id, { onDelete: "cascade" })
        .notNull(),
    fromNumber: varchar("from_number", { length: 50 }).notNull(),
    toNumber: varchar("to_number", { length: 50 }).notNull(),
    bodyEncrypted: text("body_encrypted").notNull(), // Base64-encoded encrypted message
    metadataEncrypted: jsonb("metadata_encrypted"), // Optional encrypted metadata
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    retentionExpiresAt: timestamp("retention_expires_at"), // Auto-expire after N days
}, (table) => ({
    smsNumberIdx: index("vault_sms_messages_sms_number_idx").on(table.smsNumberId),
    receivedIdx: index("vault_sms_messages_received_idx").on(table.receivedAt),
    retentionIdx: index("vault_sms_messages_retention_idx").on(table.retentionExpiresAt),
}));
/**
 * Vault Settings Table
 * Stores global vault settings (webhook API keys, etc.)
 */
export const vaultSettings = pgTable("vault_settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    valueEncrypted: text("value_encrypted").notNull(), // Encrypted setting value
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    keyIdx: index("vault_settings_key_idx").on(table.key),
}));
/**
 * Webhook Logs Table
 * Logs all incoming webhook requests for debugging
 */
export const vaultWebhookLogs = pgTable("vault_webhook_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    method: varchar("method", { length: 10 }).notNull(), // GET, POST, etc.
    url: text("url").notNull(),
    headers: jsonb("headers").$type(), // Request headers
    body: jsonb("body").$type(), // Request body (sanitized)
    rawBody: text("raw_body"), // Raw request body text (for debugging)
    ip: varchar("ip", { length: 45 }), // Client IP
    statusCode: integer("status_code"), // Response status code
    success: boolean("success").notNull().default(true),
    error: text("error"), // Error message if failed
    processingTimeMs: integer("processing_time_ms"), // Time taken to process
    messageSid: varchar("message_sid", { length: 100 }), // Twilio message SID if applicable
    fromNumber: varchar("from_number", { length: 50 }),
    toNumber: varchar("to_number", { length: 50 }),
}, (table) => ({
    receivedIdx: index("vault_webhook_logs_received_idx").on(table.receivedAt),
    successIdx: index("vault_webhook_logs_success_idx").on(table.success),
    messageSidIdx: index("vault_webhook_logs_message_sid_idx").on(table.messageSid),
}));
/**
 * Audit Events Table
 * Immutable audit log for all sensitive actions
 */
export const vaultAuditEvents = pgTable("vault_audit_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    ts: timestamp("ts").defaultNow().notNull(),
    actorUserId: varchar("actor_user_id", { length: 255 }).notNull(),
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 50 }), // vault | folder | item | sms_number | sms_message
    resourceId: uuid("resource_id"),
    ip: varchar("ip", { length: 45 }), // IPv4 or IPv6
    userAgent: text("user_agent"),
    success: boolean("success").notNull().default(true),
    reason: text("reason"), // Failure reason if success=false
    metadata: jsonb("metadata"), // Additional context
}, (table) => ({
    actorIdx: index("vault_audit_events_actor_idx").on(table.actorUserId),
    actionIdx: index("vault_audit_events_action_idx").on(table.action),
    resourceIdx: index("vault_audit_events_resource_idx").on(table.resourceType, table.resourceId),
    tsIdx: index("vault_audit_events_ts_idx").on(table.ts),
}));
/**
 * Relations
 */
export const vaultVaultsRelations = relations(vaultVaults, ({ many }) => ({
    folders: many(vaultFolders),
    items: many(vaultItems),
    smsNumbers: many(vaultSmsNumbers),
}));
export const vaultFoldersRelations = relations(vaultFolders, ({ one, many }) => ({
    vault: one(vaultVaults, {
        fields: [vaultFolders.vaultId],
        references: [vaultVaults.id],
    }),
    parent: one(vaultFolders, {
        fields: [vaultFolders.parentId],
        references: [vaultFolders.id],
        relationName: "parent_folder",
    }),
    children: many(vaultFolders, {
        relationName: "parent_folder",
    }),
    items: many(vaultItems),
}));
export const vaultItemsRelations = relations(vaultItems, ({ one, many }) => ({
    vault: one(vaultVaults, {
        fields: [vaultItems.vaultId],
        references: [vaultVaults.id],
    }),
    folder: one(vaultFolders, {
        fields: [vaultItems.folderId],
        references: [vaultFolders.id],
    }),
    smsNumbers: many(vaultSmsNumbers),
}));
// ACL relations are polymorphic - handled via resourceType and resourceId
// No direct relations defined as they reference different tables based on resourceType
export const vaultStaticGroupsRelations = relations(vaultStaticGroups, ({ many }) => ({
    members: many(vaultGroupMembers),
}));
export const vaultGroupMembersRelations = relations(vaultGroupMembers, ({ one }) => ({
    group: one(vaultStaticGroups, {
        fields: [vaultGroupMembers.groupId],
        references: [vaultStaticGroups.id],
    }),
}));
export const vaultSmsNumbersRelations = relations(vaultSmsNumbers, ({ one, many }) => ({
    vault: one(vaultVaults, {
        fields: [vaultSmsNumbers.vaultId],
        references: [vaultVaults.id],
    }),
    item: one(vaultItems, {
        fields: [vaultSmsNumbers.itemId],
        references: [vaultItems.id],
    }),
    messages: many(vaultSmsMessages),
}));
export const vaultSmsMessagesRelations = relations(vaultSmsMessages, ({ one }) => ({
    smsNumber: one(vaultSmsNumbers, {
        fields: [vaultSmsMessages.smsNumberId],
        references: [vaultSmsNumbers.id],
    }),
}));
/**
 * Permission Constants
 * Simplified permissions:
 * - READ_ONLY: Can view passwords and items
 * - READ_WRITE: Can add/edit items and folders
 * - DELETE: Can delete items and folders
 * - MANAGE_ACL: Can manage access control lists (grant/revoke permissions)
 */
export const VAULT_PERMISSIONS = {
    READ_ONLY: "READ_ONLY",
    READ_WRITE: "READ_WRITE",
    DELETE: "DELETE",
    MANAGE_ACL: "MANAGE_ACL",
};
