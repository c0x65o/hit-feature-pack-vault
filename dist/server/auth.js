/**
 * Extract user from JWT token in cookies or Authorization header
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
    if (!token)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
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
    catch {
        return null;
    }
}
/**
 * Extract user ID from request (convenience function)
 */
export function getUserId(request) {
    const user = extractUserFromRequest(request);
    return user?.sub || null;
}
