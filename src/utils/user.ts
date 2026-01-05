/**
 * User utilities for frontend
 * Helper functions to get current user info from JWT token
 */

/**
 * Get current user ID from JWT token
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    // Try to get token from cookie (set by server)
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('hit_token='));
    const token = tokenCookie ? tokenCookie.split('=')[1] : null;
    
    if (!token) {
      // Fall back to localStorage
      const storedToken = localStorage.getItem('hit_token') || localStorage.getItem('auth_token');
      if (!storedToken) return null;
      
      const parts = storedToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.sub || payload.email || null;
      }
      return null;
    }
    
    // Decode JWT token
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.email || null;
    }
  } catch (e) {
    console.error('Failed to parse user token:', e);
  }
  
  return null;
}

/**
 * Get current user email from JWT token
 */
export function getCurrentUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('hit_token='));
    const token = tokenCookie ? tokenCookie.split('=')[1] : null;
    
    if (!token) {
      const storedToken = localStorage.getItem('hit_token') || localStorage.getItem('auth_token');
      if (!storedToken) return null;
      
      const parts = storedToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.email || payload.sub || null;
      }
      return null;
    }
    
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.email || payload.sub || null;
    }
  } catch (e) {
    console.error('Failed to parse user token:', e);
  }
  
  return null;
}

/**
 * Get current user roles from JWT token
 */
export function getCurrentUserRoles(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(c => c.trim().startsWith('hit_token='));
    const token = tokenCookie ? tokenCookie.split('=')[1] : null;
    
    if (!token) {
      const storedToken = localStorage.getItem('hit_token') || localStorage.getItem('auth_token');
      if (!storedToken) return [];
      
      const parts = storedToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.roles || [];
      }
      return [];
    }
    
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.roles || [];
    }
  } catch (e) {
    console.error('Failed to parse user token:', e);
  }
  
  return [];
}

/**
 * Check if current user is an admin
 */
export function isCurrentUserAdmin(): boolean {
  const roles = getCurrentUserRoles();
  return roles.includes('admin');
}