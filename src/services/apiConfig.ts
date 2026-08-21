// Central API URL resolver for Tagoloan Water District
// Supports relative endpoints (/api/...) as well as custom central server URLs (VITE_API_URL)
import { API_BASE_URL } from '../config/api';

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

  // 3. Default to the production backend API base URL
  return (API_BASE_URL || 'https://twd-zeta.vercel.app/api').replace(/\/+$/, '');
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If base already ends with '/api' and cleanPath starts with '/api/', avoid duplicate '/api/api'
  if (base.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${base}${cleanPath.substring(4)}`;
  }

  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}

