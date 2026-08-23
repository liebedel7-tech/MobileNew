// Central API & System Connect Cycle for Tagoloan Water District
// Handles Multi-Deployment discovery, CORS preflight failovers, and offline resiliency

export const LIVE_BACKEND_URL = 'https://ais-pre-6cykzmqeda3wtxfpbqbxts-409978713286.asia-southeast1.run.app';
export const DEFAULT_SERVER_URL = LIVE_BACKEND_URL;

let cachedWorkingBaseUrl: string | null = null;
let lastHealthCheckTime = 0;

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
    // Clear known obsolete/broken dev instances
    if (stored && (stored.includes('twd-zeta') || stored.includes('ui6fsepfskrowqsfycbac7'))) {
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
      if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !envUrl.includes('twd-zeta') && !envUrl.includes('ui6fsepfskrowqsfycbac7')) {
        return envUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
      }
    }
  } catch {
    // Ignore in non-vite environments
  }

  // 3. Current window origin (Works directly on Cloud Run, Localhost, or on Vercel with rewrites)
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

  // Candidate 1: Stored custom URL
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('TWD_API_BASE_URL') || window.localStorage.getItem('twd_api_base_url');
    if (stored && stored.trim() && !stored.includes('ui6fsepfskrowqsfycbac7') && !stored.includes('twd-zeta')) {
      candidates.push(stored.trim().replace(/\/+$/, '').replace(/\/api$/, ''));
    }
  }

  // Candidate 2: Current origin (relative / same domain)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http') && !candidates.includes(origin)) {
      candidates.push(origin);
    }
  }

  // Candidate 3: Live Central Cloud Backend
  if (!candidates.includes(LIVE_BACKEND_URL)) {
    candidates.push(LIVE_BACKEND_URL);
  }

  return candidates;
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '').replace(/\/api$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Universal smart fetch that executes through the System Connect Cycle.
 * If the current origin or primary candidate is unreachable or encounters a CORS/network error,
 * it seamlessly fails over to the live cloud backend and saves the working connection.
 */
export async function universalApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const candidates = getCandidateBackendUrls();

  let lastError: any = null;

  for (const base of candidates) {
    const fullUrl = `${base.replace(/\/+$/, '').replace(/\/api$/, '')}${cleanPath}`;
    try {
      const response = await fetch(fullUrl, {
        ...init,
        headers: {
          'Accept': 'application/json',
          ...(init?.headers || {}),
        },
      });

      // If server returned valid status (even 400/401/403 business response, but not 502/503/504 gateway dead), mark working
      if (response.status < 500) {
        cachedWorkingBaseUrl = base;
        lastHealthCheckTime = Date.now();
        return response;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[System Connect Cycle] Failed to connect to ${fullUrl}, cycling to next candidate...`, err);
    }
  }

  // If all failed, attempt direct default endpoint
  if (lastError) {
    throw lastError;
  }
  return fetch(getApiEndpoint(path), init);
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



