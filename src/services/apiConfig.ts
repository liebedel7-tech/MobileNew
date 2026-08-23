// Central API URL resolver for Tagoloan Water District
// Supports relative endpoints (/api/...) as well as custom central server URLs (VITE_API_URL)

export function getApiBaseUrl(): string {
  // 1. Check local storage override if user customized it
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    // If the stored URL is the broken twd-zeta url, clear it
    if (stored && stored.includes('twd-zeta')) {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
    } else if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '');
    }
  }

  // 2. Check environment variable
  try {
    const meta = import.meta as any;
    if (meta && meta.env) {
      const envUrl = meta.env.VITE_API_URL || meta.env.VITE_CENTRAL_API_URL;
      if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !envUrl.includes('twd-zeta')) {
        return envUrl.trim().replace(/\/+$/, '');
      }
    }
  } catch {
    // Ignore in non-vite environments
  }

  // 3. Default to same origin or empty base for native relative API routing
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  return '';
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If base already ends with '/api' and cleanPath starts with '/api', avoid duplicate '/api/api'
  if (base.endsWith('/api') && cleanPath.startsWith('/api')) {
    return `${base}${cleanPath.substring(4)}`;
  }

  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}

