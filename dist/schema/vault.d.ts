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
/**
 * Vault Types
 */
export declare const vaultTypeEnum: import("drizzle-orm/pg-core").PgEnum<["personal", "shared"]>;
/**
 * Item Types
 */
export declare const itemTypeEnum: import("drizzle-orm/pg-core").PgEnum<["credential", "api_key", "secure_note"]>;
/**
 * Principal Types for ACL
 */
export declare const principalTypeEnum: import("drizzle-orm/pg-core").PgEnum<["user", "group", "role"]>;
/**
 * SMS Number Status
 */
export declare const smsStatusEnum: import("drizzle-orm/pg-core").PgEnum<["active", "inactive", "pending"]>;
/**
 * Audit Action Types
 */
export declare const auditActionEnum: import("drizzle-orm/pg-core").PgEnum<["ITEM_VIEW_METADATA", "ITEM_REVEAL_PASSWORD", "ITEM_COPY_PASSWORD", "ITEM_GENERATE_TOTP", "ITEM_REVEAL_TOTP_SECRET", "SMS_READ_MESSAGE", "CSV_IMPORT_RUN", "ACL_CHANGED", "VAULT_CREATED", "VAULT_DELETED", "FOLDER_CREATED", "FOLDER_DELETED", "FOLDER_MOVED", "ITEM_CREATED", "ITEM_UPDATED", "ITEM_DELETED", "ITEM_MOVED"]>;
/**
 * Vaults Table
 * Stores personal and shared vaults
 */
export declare const vaultVaults: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_vaults";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        type: import("drizzle-orm/pg-core").PgColumn<{
            name: "type";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "personal" | "shared";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: ["personal", "shared"];
            baseColumn: never;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        ownerUserId: import("drizzle-orm/pg-core").PgColumn<{
            name: "owner_user_id";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        ownerOrgId: import("drizzle-orm/pg-core").PgColumn<{
            name: "owner_org_id";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        tenantId: import("drizzle-orm/pg-core").PgColumn<{
            name: "tenant_id";
            tableName: "vault_vaults";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        encryptionKeyVersion: import("drizzle-orm/pg-core").PgColumn<{
            name: "encryption_key_version";
            tableName: "vault_vaults";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_vaults";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "vault_vaults";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Folders Table
 * Folder tree with materialized path support
 */
export declare const vaultFolders: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_folders";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        vaultId: import("drizzle-orm/pg-core").PgColumn<{
            name: "vault_id";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        parentId: import("drizzle-orm/pg-core").PgColumn<{
            name: "parent_id";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        path: import("drizzle-orm/pg-core").PgColumn<{
            name: "path";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_by";
            tableName: "vault_folders";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_folders";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Items Table (Credentials)
 * Stores password entries and other secrets
 */
export declare const vaultItems: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_items";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        vaultId: import("drizzle-orm/pg-core").PgColumn<{
            name: "vault_id";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        folderId: import("drizzle-orm/pg-core").PgColumn<{
            name: "folder_id";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        type: import("drizzle-orm/pg-core").PgColumn<{
            name: "type";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "credential" | "api_key" | "secure_note";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: ["credential", "api_key", "secure_note"];
            baseColumn: never;
        }, {}, {}>;
        title: import("drizzle-orm/pg-core").PgColumn<{
            name: "title";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        username: import("drizzle-orm/pg-core").PgColumn<{
            name: "username";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        url: import("drizzle-orm/pg-core").PgColumn<{
            name: "url";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        tags: import("drizzle-orm/pg-core").PgColumn<{
            name: "tags";
            tableName: "vault_items";
            dataType: "json";
            columnType: "PgJsonb";
            data: string[];
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        secretBlobEncrypted: import("drizzle-orm/pg-core").PgColumn<{
            name: "secret_blob_encrypted";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        secretVersion: import("drizzle-orm/pg-core").PgColumn<{
            name: "secret_version";
            tableName: "vault_items";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_by";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        updatedBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_by";
            tableName: "vault_items";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_items";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "vault_items";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * ACL Table (Access Control Entries)
 * Defines permissions for vaults, folders, and items
 */
export declare const vaultAcls: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_acls";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        resourceType: import("drizzle-orm/pg-core").PgColumn<{
            name: "resource_type";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        resourceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "resource_id";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        principalType: import("drizzle-orm/pg-core").PgColumn<{
            name: "principal_type";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "user" | "group" | "role";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: ["user", "group", "role"];
            baseColumn: never;
        }, {}, {}>;
        principalId: import("drizzle-orm/pg-core").PgColumn<{
            name: "principal_id";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        permissions: import("drizzle-orm/pg-core").PgColumn<{
            name: "permissions";
            tableName: "vault_acls";
            dataType: "json";
            columnType: "PgJsonb";
            data: string[];
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        inherit: import("drizzle-orm/pg-core").PgColumn<{
            name: "inherit";
            tableName: "vault_acls";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        createdBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_by";
            tableName: "vault_acls";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_acls";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Static Groups Table (fallback when dynamic groups not enabled)
 * Only used when auth.user_groups_enabled is false
 */
export declare const vaultStaticGroups: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_static_groups";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_static_groups";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "vault_static_groups";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        description: import("drizzle-orm/pg-core").PgColumn<{
            name: "description";
            tableName: "vault_static_groups";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        type: import("drizzle-orm/pg-core").PgColumn<{
            name: "type";
            tableName: "vault_static_groups";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        externalRef: import("drizzle-orm/pg-core").PgColumn<{
            name: "external_ref";
            tableName: "vault_static_groups";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_static_groups";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "vault_static_groups";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Group Members Table (static groups only)
 * Many-to-many relationship between users and static groups
 */
export declare const vaultGroupMembers: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_group_members";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_group_members";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        groupId: import("drizzle-orm/pg-core").PgColumn<{
            name: "group_id";
            tableName: "vault_group_members";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "vault_group_members";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_group_members";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * SMS Numbers Table
 * Provisioned phone numbers for SMS inbox
 */
export declare const vaultSmsNumbers: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_sms_numbers";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        vaultId: import("drizzle-orm/pg-core").PgColumn<{
            name: "vault_id";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        itemId: import("drizzle-orm/pg-core").PgColumn<{
            name: "item_id";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        phoneNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "phone_number";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        provider: import("drizzle-orm/pg-core").PgColumn<{
            name: "provider";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        status: import("drizzle-orm/pg-core").PgColumn<{
            name: "status";
            tableName: "vault_sms_numbers";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "active" | "inactive" | "pending";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: ["active", "inactive", "pending"];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_sms_numbers";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * SMS Messages Table
 * Inbound SMS messages (encrypted)
 */
export declare const vaultSmsMessages: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_sms_messages";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_sms_messages";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        smsNumberId: import("drizzle-orm/pg-core").PgColumn<{
            name: "sms_number_id";
            tableName: "vault_sms_messages";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        fromNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "from_number";
            tableName: "vault_sms_messages";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        toNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "to_number";
            tableName: "vault_sms_messages";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        bodyEncrypted: import("drizzle-orm/pg-core").PgColumn<{
            name: "body_encrypted";
            tableName: "vault_sms_messages";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metadataEncrypted: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata_encrypted";
            tableName: "vault_sms_messages";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        receivedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "received_at";
            tableName: "vault_sms_messages";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        retentionExpiresAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "retention_expires_at";
            tableName: "vault_sms_messages";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Vault Settings Table
 * Stores global vault settings (webhook API keys, etc.)
 */
export declare const vaultSettings: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_settings";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_settings";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        key: import("drizzle-orm/pg-core").PgColumn<{
            name: "key";
            tableName: "vault_settings";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        valueEncrypted: import("drizzle-orm/pg-core").PgColumn<{
            name: "value_encrypted";
            tableName: "vault_settings";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "vault_settings";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "vault_settings";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Webhook Logs Table
 * Logs all incoming webhook requests for debugging
 */
export declare const vaultWebhookLogs: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_webhook_logs";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        receivedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "received_at";
            tableName: "vault_webhook_logs";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        method: import("drizzle-orm/pg-core").PgColumn<{
            name: "method";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        url: import("drizzle-orm/pg-core").PgColumn<{
            name: "url";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        headers: import("drizzle-orm/pg-core").PgColumn<{
            name: "headers";
            tableName: "vault_webhook_logs";
            dataType: "json";
            columnType: "PgJsonb";
            data: Record<string, string>;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        body: import("drizzle-orm/pg-core").PgColumn<{
            name: "body";
            tableName: "vault_webhook_logs";
            dataType: "json";
            columnType: "PgJsonb";
            data: Record<string, any>;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        rawBody: import("drizzle-orm/pg-core").PgColumn<{
            name: "raw_body";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        ip: import("drizzle-orm/pg-core").PgColumn<{
            name: "ip";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        statusCode: import("drizzle-orm/pg-core").PgColumn<{
            name: "status_code";
            tableName: "vault_webhook_logs";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        success: import("drizzle-orm/pg-core").PgColumn<{
            name: "success";
            tableName: "vault_webhook_logs";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        error: import("drizzle-orm/pg-core").PgColumn<{
            name: "error";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        processingTimeMs: import("drizzle-orm/pg-core").PgColumn<{
            name: "processing_time_ms";
            tableName: "vault_webhook_logs";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        messageSid: import("drizzle-orm/pg-core").PgColumn<{
            name: "message_sid";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        fromNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "from_number";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        toNumber: import("drizzle-orm/pg-core").PgColumn<{
            name: "to_number";
            tableName: "vault_webhook_logs";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Audit Events Table
 * Immutable audit log for all sensitive actions
 */
export declare const vaultAuditEvents: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "vault_audit_events";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        ts: import("drizzle-orm/pg-core").PgColumn<{
            name: "ts";
            tableName: "vault_audit_events";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        actorUserId: import("drizzle-orm/pg-core").PgColumn<{
            name: "actor_user_id";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        action: import("drizzle-orm/pg-core").PgColumn<{
            name: "action";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgEnumColumn";
            data: "ITEM_VIEW_METADATA" | "ITEM_REVEAL_PASSWORD" | "ITEM_COPY_PASSWORD" | "ITEM_GENERATE_TOTP" | "ITEM_REVEAL_TOTP_SECRET" | "SMS_READ_MESSAGE" | "CSV_IMPORT_RUN" | "ACL_CHANGED" | "VAULT_CREATED" | "VAULT_DELETED" | "FOLDER_CREATED" | "FOLDER_DELETED" | "FOLDER_MOVED" | "ITEM_CREATED" | "ITEM_UPDATED" | "ITEM_DELETED" | "ITEM_MOVED";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            enumValues: ["ITEM_VIEW_METADATA", "ITEM_REVEAL_PASSWORD", "ITEM_COPY_PASSWORD", "ITEM_GENERATE_TOTP", "ITEM_REVEAL_TOTP_SECRET", "SMS_READ_MESSAGE", "CSV_IMPORT_RUN", "ACL_CHANGED", "VAULT_CREATED", "VAULT_DELETED", "FOLDER_CREATED", "FOLDER_DELETED", "FOLDER_MOVED", "ITEM_CREATED", "ITEM_UPDATED", "ITEM_DELETED", "ITEM_MOVED"];
            baseColumn: never;
        }, {}, {}>;
        resourceType: import("drizzle-orm/pg-core").PgColumn<{
            name: "resource_type";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        resourceId: import("drizzle-orm/pg-core").PgColumn<{
            name: "resource_id";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        ip: import("drizzle-orm/pg-core").PgColumn<{
            name: "ip";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        userAgent: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_agent";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        success: import("drizzle-orm/pg-core").PgColumn<{
            name: "success";
            tableName: "vault_audit_events";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
        reason: import("drizzle-orm/pg-core").PgColumn<{
            name: "reason";
            tableName: "vault_audit_events";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, {}, {}>;
        metadata: import("drizzle-orm/pg-core").PgColumn<{
            name: "metadata";
            tableName: "vault_audit_events";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: false;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
/**
 * Relations
 */
export declare const vaultVaultsRelations: import("drizzle-orm").Relations<"vault_vaults", {
    folders: import("drizzle-orm").Many<"vault_folders">;
    items: import("drizzle-orm").Many<"vault_items">;
    smsNumbers: import("drizzle-orm").Many<"vault_sms_numbers">;
}>;
export declare const vaultFoldersRelations: import("drizzle-orm").Relations<"vault_folders", {
    vault: import("drizzle-orm").One<"vault_vaults", true>;
    parent: import("drizzle-orm").One<"vault_folders", false>;
    children: import("drizzle-orm").Many<"vault_folders">;
    items: import("drizzle-orm").Many<"vault_items">;
}>;
export declare const vaultItemsRelations: import("drizzle-orm").Relations<"vault_items", {
    vault: import("drizzle-orm").One<"vault_vaults", true>;
    folder: import("drizzle-orm").One<"vault_folders", false>;
    smsNumbers: import("drizzle-orm").Many<"vault_sms_numbers">;
}>;
export declare const vaultStaticGroupsRelations: import("drizzle-orm").Relations<"vault_static_groups", {
    members: import("drizzle-orm").Many<"vault_group_members">;
}>;
export declare const vaultGroupMembersRelations: import("drizzle-orm").Relations<"vault_group_members", {
    group: import("drizzle-orm").One<"vault_static_groups", true>;
}>;
export declare const vaultSmsNumbersRelations: import("drizzle-orm").Relations<"vault_sms_numbers", {
    vault: import("drizzle-orm").One<"vault_vaults", false>;
    item: import("drizzle-orm").One<"vault_items", false>;
    messages: import("drizzle-orm").Many<"vault_sms_messages">;
}>;
export declare const vaultSmsMessagesRelations: import("drizzle-orm").Relations<"vault_sms_messages", {
    smsNumber: import("drizzle-orm").One<"vault_sms_numbers", true>;
}>;
/**
 * TypeScript Types
 */
export type VaultVault = typeof vaultVaults.$inferSelect;
export type VaultFolder = typeof vaultFolders.$inferSelect;
export type VaultItem = typeof vaultItems.$inferSelect;
export type VaultAcl = typeof vaultAcls.$inferSelect;
export type VaultSmsNumber = typeof vaultSmsNumbers.$inferSelect;
export type VaultSmsMessage = typeof vaultSmsMessages.$inferSelect;
export type VaultWebhookLog = typeof vaultWebhookLogs.$inferSelect;
export type VaultAuditEvent = typeof vaultAuditEvents.$inferSelect;
export type VaultStaticGroup = typeof vaultStaticGroups.$inferSelect;
export type VaultGroupMember = typeof vaultGroupMembers.$inferSelect;
export type VaultSetting = typeof vaultSettings.$inferSelect;
export type InsertVaultVault = typeof vaultVaults.$inferInsert;
export type InsertVaultFolder = typeof vaultFolders.$inferInsert;
export type InsertVaultItem = typeof vaultItems.$inferInsert;
export type InsertVaultAcl = typeof vaultAcls.$inferInsert;
export type InsertVaultSmsNumber = typeof vaultSmsNumbers.$inferInsert;
export type InsertVaultSmsMessage = typeof vaultSmsMessages.$inferInsert;
export type InsertVaultWebhookLog = typeof vaultWebhookLogs.$inferInsert;
export type InsertVaultAuditEvent = typeof vaultAuditEvents.$inferInsert;
export type InsertVaultStaticGroup = typeof vaultStaticGroups.$inferInsert;
export type InsertVaultGroupMember = typeof vaultGroupMembers.$inferInsert;
export type InsertVaultSetting = typeof vaultSettings.$inferInsert;
/**
 * Permission Constants
 * Simplified permissions:
 * - READ_ONLY: Can view passwords and items
 * - READ_WRITE: Can add/edit items and folders
 * - DELETE: Can delete items and folders
 * - MANAGE_ACL: Can manage access control lists (grant/revoke permissions)
 */
export declare const VAULT_PERMISSIONS: {
    readonly READ_ONLY: "READ_ONLY";
    readonly READ_WRITE: "READ_WRITE";
    readonly DELETE: "DELETE";
    readonly MANAGE_ACL: "MANAGE_ACL";
};
export type VaultPermission = (typeof VAULT_PERMISSIONS)[keyof typeof VAULT_PERMISSIONS];
//# sourceMappingURL=vault.d.ts.map