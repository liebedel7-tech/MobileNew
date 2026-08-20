// Central API URL resolver for Tagoloan Water District
// Supports relative endpoints (/api/...) as well as custom central server URLs (VITE_API_URL)

export function getApiBaseUrl(): string {
  // 1. Check environment variable
  try {
    const meta = import.meta as any;
    if (meta && meta.env) {
      const envUrl = meta.env.VITE_API_URL || meta.env.VITE_CENTRAL_API_URL;
      if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
        return envUrl.trim().replace(/\/+$/, '');
      }
    }
  } catch {
    // Ignore in non-vite environments
  }

  // 2. Check local storage override if user customized it
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL');
    if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '');
    }
  }

  // 3. Default to relative endpoint
  return '';
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}

