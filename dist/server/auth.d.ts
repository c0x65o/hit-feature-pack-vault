import { NextRequest } from 'next/server';
export interface User {
    sub: string;
    email: string;
    roles?: string[];
}
/**
 * Extract user from JWT token in cookies or Authorization header
 */
export declare function extractUserFromRequest(request: NextRequest): User | null;
/**
 * Extract user ID from request (convenience function)
 */
export declare function getUserId(request: NextRequest): string | null;
//# sourceMappingURL=auth.d.ts.map