/**
 * Extract user from JWT token in cookies or Authorization header
 * Also checks x-user-id header (set by proxy/middleware in production)
 */
export function extractUserFromRequest(request) {
    // Check for token in cookie first
    let token = request.cookies.get('hit_token')?.value;
    // Fall back to Authorization header
    if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
    }
    // Always try to extract from JWT first (to get roles)
    if (token) {
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                // Check expiration
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    return null;
                }
                const email = payload.email ||
                    payload.preferred_username ||
                    payload.upn ||
                    payload.unique_name ||
                    '';
                return {
                    sub: payload.sub || email || '',
                    email: email || '',
                    roles: payload.roles || [],
                };
            }
        }
        catch {
            // JWT parsing failed, fall through to x-user-id header
        }
    }
    // Fall back to x-user-id header (set by proxy in production)
    // Also check for x-user-email and x-user-roles headers
    const xUserId = request.headers.get('x-user-id');
    if (xUserId) {
        const xUserEmail = request.headers.get('x-user-email') || '';
        const xUserRoles = request.headers.get('x-user-roles');
        const roles = xUserRoles ? xUserRoles.split(',').map(r => r.trim()) : [];
        return { sub: xUserId, email: xUserEmail, roles };
    }
    return null;
}
/**
 * Extract user ID from request (convenience function)
 */
export function getUserId(request) {
    const user = extractUserFromRequest(request);
    return user?.sub || null;
}
