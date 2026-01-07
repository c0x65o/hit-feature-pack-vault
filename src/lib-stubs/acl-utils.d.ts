declare module '@/lib/acl-utils' {
  import type { NextRequest } from 'next/server';

  export type PrincipalType = 'user' | 'group' | 'role';

  export interface UserClaimsLike {
    sub: string;
    email?: string;
    roles?: string[];
    groups?: string[];
  }

  export interface ResolvedUserPrincipals {
    userId: string;
    userEmail: string;
    roles: string[];
    groupIds: string[];
  }

  export interface ResolveUserPrincipalsOptions {
    request?: NextRequest;
    user: UserClaimsLike;
    includeTokenGroups?: boolean;
    includeAuthMeGroups?: boolean;
    strict?: boolean;
    extraGroupIds?: () => Promise<string[]>;
  }

  export function resolveUserPrincipals(options: ResolveUserPrincipalsOptions): Promise<ResolvedUserPrincipals>;
}
