// Central API URL resolver for Tagoloan Water District
// Supports relative endpoints (/api/...) as well as custom central server URLs (VITE_API_URL)

export const LIVE_BACKEND_URL = 'https://ais-dev-ui6fsepfskrowqsfycbac7-946013608969.asia-southeast1.run.app';
export const DEFAULT_SERVER_URL = LIVE_BACKEND_URL;

export function getApiBaseUrl(): string {
  // 1. Check local storage override if user customized it
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    // If the stored URL is a broken vercel or old url, clear it
    if (stored && (stored.includes('twd-zeta') || stored.includes('mobile-new-woad.vercel.app'))) {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
    } else if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '').replace(/\/api$/, '');
    }
  }

  // 2. Check environment variable
  try {
    const meta = import.meta as any;
    if (meta && meta.env) {
      const envUrl = meta.env.VITE_API_URL || meta.env.VITE_CENTRAL_API_URL;
      if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !envUrl.includes('twd-zeta') && !envUrl.includes('vercel.app')) {
        return envUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      }
    }
  } catch {
    // Ignore in non-vite environments
  }

  // 3. Check if running on a static frontend host (Vercel, Netlify, GitHub Pages, etc.)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = (window.location.hostname || '').toLowerCase();
    const isStaticHost = 
      hostname.includes('vercel.app') || 
      hostname.includes('vercel.dev') ||
      hostname.includes('netlify.app') ||
      hostname.includes('pages.dev') ||
      hostname.includes('surge.sh') ||
      hostname.includes('github.io');

    if (isStaticHost) {
      // Vercel is static-only; all API calls must route to the live Cloud Run backend
      return LIVE_BACKEND_URL;
    }

    if (window.location.origin) {
      return window.location.origin;
    }
  }

  return LIVE_BACKEND_URL;
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '').replace(/\/api$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function setCustomApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const clean = url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
    if (clean) {
      window.localStorage.setItem('TWD_API_BASE_URL', clean);
      window.localStorage.setItem('twd_api_base_url', clean);
    } else {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
    }
    window.location.reload();
  }
}

export function resetApiBaseUrl(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('TWD_API_BASE_URL');
    window.localStorage.removeItem('twd_api_base_url');
    window.location.reload();
  }
}


