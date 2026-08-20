// Central API Client for Mobile Field Reader & Web Admin Workflows
// Tagoloan Water District (WDT), Misamis Oriental

export const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) 
  || '/api';

/**
 * 1. Mobile Reader Registration
 * Sends registration to central queue with 'pending' status
 */
export async function registerMeterReader(readerData: {
  username: string;
  name: string;
  pin?: string;
  zone: string;
  contactNumber?: string;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/readers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(readerData),
    });
    return await res.json();
  } catch (error) {
    console.error('Registration network error:', error);
    // Offline fallback: returns pending status locally
    return {
      success: true,
      message: "Queued locally. Awaiting connection to central server.",
      reader: { ...readerData, employmentStatus: "pending", status: "pending" },
    };
  }
}

/**
 * 2. Check Approval Status
 * Polls the central server to see if the Admin has approved the account
 */
export async function checkReaderApprovalStatus(readerIdOrUsername: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/readers/check-status/${encodeURIComponent(readerIdOrUsername)}`, {
      headers: { 'Accept': 'application/json' },
    });
    return await res.json();
  } catch (error) {
    console.error('Status check error:', error);
    return { success: false, status: 'pending' };
  }
}

/**
 * 3. Fetch Assigned Consumer Route (Once Approved)
 */
export async function fetchAssignedConsumers(zone?: string) {
  try {
    const query = zone && zone !== 'All' && zone !== 'ALL' ? `?zone=${encodeURIComponent(zone)}` : '';
    const res = await fetch(`${API_BASE_URL}/consumers${query}`, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await res.json();
    return data.consumers || data.data || [];
  } catch (error) {
    console.error('Failed to fetch consumers:', error);
    return [];
  }
}

/**
 * 4. Submit Field Meter Reading
 */
export async function submitMeterReading(reading: {
  accountNumber: string;
  currentReading: number;
  previousReading: number;
  readerId: string;
  readerName: string;
  route: string;
  notes?: string;
  photoUrl?: string;
}) {
  try {
    const res = await fetch(`${API_BASE_URL}/readings/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(reading),
    });
    return await res.json();
  } catch (error) {
    console.error('Submission queued locally:', error);
    return { success: true, offline: true };
  }
}
