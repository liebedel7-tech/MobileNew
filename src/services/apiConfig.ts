// Central API & System Connect Cycle for Tagoloan Water District
// Handles Multi-Deployment discovery, CORS preflight failovers, and offline resiliency

export const LIVE_BACKEND_URL = typeof window !== 'undefined' && window.location?.origin 
  ? window.location.origin 
  : '';

export const DEFAULT_SERVER_URL = LIVE_BACKEND_URL;

let cachedWorkingBaseUrl: string | null = null;
let lastHealthCheckTime = 0;

function isObsoleteOrCrossDomain(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase().trim();
  if (lower.includes('twd-zeta') || lower.includes('ui6fsepfskrowqsfycbac7') || lower.includes('6cykzmqeda3wtxfpbqbxts')) {
    return true;
  }
  
  // If running on Vercel, localhost, or any custom domain, strictly NEVER connect to transient Cloud Run preview URLs
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const currentOrigin = window.location.origin.toLowerCase();
    if (!currentOrigin.includes('run.app') && lower.includes('run.app')) {
      return true;
    }
  }
  return false;
}

// Proactively purge obsolete Cloud Run dev URLs from localStorage immediately upon module load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    if (stored && isObsoleteOrCrossDomain(stored)) {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
    }
  } catch {
    // Ignore localStorage access issues
  }
}

/**
 * Resolves the primary base URL based on environment, localStorage override, and origin
 */
export function getApiBaseUrl(): string {
  // If we found a working base URL recently, reuse it
  if (cachedWorkingBaseUrl && Date.now() - lastHealthCheckTime < 60000) {
    return cachedWorkingBaseUrl;
  }

  // 1. User manual server override in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    if (stored && isObsoleteOrCrossDomain(stored)) {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
    } else if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '').replace(/\/api$/, '');
    }
  }

  // 2. Vite environment variable
  try {
    const meta = import.meta as any;
    if (meta && meta.env) {
      const envUrl = meta.env.VITE_API_URL || meta.env.VITE_CENTRAL_API_URL;
      if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !isObsoleteOrCrossDomain(envUrl)) {
        return envUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      }
    }
  } catch {
    // Ignore in non-vite environments
  }

  // 3. Current window origin (Works directly on Vercel, Cloud Run, or Localhost)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  }

  return LIVE_BACKEND_URL;
}

/**
 * Returns candidate backend URLs to try during the system connect cycle
 */
export function getCandidateBackendUrls(): string[] {
  const candidates: string[] = [];

  // Candidate 1: Current origin (relative / same domain) - HIGHEST PRIORITY
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http') && !candidates.includes(origin)) {
      candidates.push(origin);
    }
  }

  // Candidate 2: Stored custom URL (if valid and not cross-domain obsolete)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    if (stored && stored.trim() && !isObsoleteOrCrossDomain(stored)) {
      const clean = stored.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      if (!candidates.includes(clean)) {
        candidates.push(clean);
      }
    }
  }

  return candidates.length > 0 ? candidates : [''];
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '').replace(/\/api$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Universal smart fetch that executes through the System Connect Cycle.
 */
export async function universalApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const candidates = getCandidateBackendUrls();

  let lastResponse: Response | null = null;
  let lastError: any = null;

  for (const base of candidates) {
    const fullUrl = base ? `${base.replace(/\/+$/, '').replace(/\/api$/, '')}${cleanPath}` : cleanPath;
    try {
      const response = await fetch(fullUrl, {
        ...init,
        headers: {
          'Accept': 'application/json',
          ...(init?.headers || {}),
        },
      });

      lastResponse = response;

      if (response.status < 500) {
        cachedWorkingBaseUrl = base;
        lastHealthCheckTime = Date.now();
        return response;
      }
    } catch (err) {
      lastError = err;
    }
  }

  // If we received a response and it's valid (< 500), return it
  if (lastResponse && lastResponse.status < 500) {
    return lastResponse;
  }

  // Fallback: direct relative request without cross-domain cycling
  try {
    const directRes = await fetch(cleanPath, {
      ...init,
      headers: {
        'Accept': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (directRes && directRes.status < 500) {
      return directRes;
    }
  } catch {
    // Network unavailable or serverless cold start - handled by synthetic fallback below
  }

  // Resilient Offline Fallback: If server is unavailable (500 or offline), return a graceful synthetic 200 response
  const fallbackPayload = {
    success: true,
    district: 'Tagoloan Water District (WDT-MISOR)',
    isOfflineFallback: true,
    consumers: [],
    data: [],
    readers: [],
    staff: [],
    message: 'Operating in local offline database mode',
  };

  return new Response(JSON.stringify(fallbackPayload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Offline-Fallback': 'true',
    },
  });
}

export function setCustomApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const clean = url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
    if (clean) {
      window.localStorage.setItem('TWD_API_BASE_URL', clean);
      window.localStorage.setItem('twd_api_base_url', clean);
      cachedWorkingBaseUrl = clean;
    } else {
      window.localStorage.removeItem('TWD_API_BASE_URL');
      window.localStorage.removeItem('twd_api_base_url');
      cachedWorkingBaseUrl = null;
    }
    window.location.reload();
  }
}

export function resetApiBaseUrl(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('TWD_API_BASE_URL');
    window.localStorage.removeItem('twd_api_base_url');
    cachedWorkingBaseUrl = null;
    window.location.reload();
  }
}
