import { authHeaders } from '@/lib/auth-api';
import { PayrollItem, PayrollItemStatus, PayrollPreviewItem, PayrollRun } from '@/types/payroll';

const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

async function handleJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error || `HTTP ${res.status}`);
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  const res = await fetch(`${API_BASE}/payroll`, { headers: { ...authHeaders() } });
  const data = await handleJson(res);
  return Array.isArray(data?.runs) ? data.runs : [];
}

export async function getPayrollByPeriod(period: string): Promise<{ run: PayrollRun | null; items: PayrollItem[] }> {
  const res = await fetch(`${API_BASE}/payroll?period=${encodeURIComponent(period)}`, {
    headers: { ...authHeaders() },
  });
  const data = await handleJson(res);
  return { run: data?.run ?? null, items: Array.isArray(data?.items) ? data.items : [] };
}

export async function previewPayroll(period: string): Promise<{ period: string; items: PayrollPreviewItem[] }> {
  const res = await fetch(
    `${API_BASE}/payroll?action=preview&period=${encodeURIComponent(period)}`,
    { headers: { ...authHeaders() } }
  );
  const data = await handleJson(res);
  return { period: data.period, items: Array.isArray(data?.items) ? data.items : [] };
}

export async function createOrRegeneratePayroll(period: string, options: { regenerate?: boolean; note?: string } = {}) {
  const res = await fetch(`${API_BASE}/payroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ period, regenerate: !!options.regenerate, note: options.note ?? '' }),
  });
  const data = await handleJson(res);
  return { run: data.run as PayrollRun, items: (data.items || []) as PayrollItem[], regenerated: !!data.regenerated };
}

export async function updatePayrollItem(itemId: string, updates: {
  status?: PayrollItemStatus;
  paidMethod?: string;
  adjustment?: number;
  adjustmentNote?: string;
  note?: string;
}) {
  const res = await fetch(`${API_BASE}/payroll`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ itemId, updates }),
  });
  return handleJson(res);
}

export async function finalizePayrollRun(runId: string) {
  const res = await fetch(`${API_BASE}/payroll`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ runId, action: 'finalize' }),
  });
  return handleJson(res);
}

export async function reopenPayrollRun(runId: string) {
  const res = await fetch(`${API_BASE}/payroll`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ runId, action: 'reopen' }),
  });
  return handleJson(res);
}

export interface ImportPreview {
  totalInSheet: number;
  alreadyImported: number;
  willImport: number;
}

export interface ImportResult {
  success: boolean;
  totalInSheet: number;
  duplicatesInSheet?: number;
  imported: number;
  skipped: number;
  errors: number;
  errorSamples?: Array<{ sheetId: string; message: string }>;
}

export async function previewLegacySalesImport(): Promise<ImportPreview> {
  const res = await fetch(`${API_BASE}/payroll?action=import-sales-preview`, {
    headers: { ...authHeaders() },
  });
  return handleJson(res);
}

export async function importLegacySales(): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/payroll?action=import-sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({}),
  });
  return handleJson(res);
}

export async function deletePayrollRun(runId: string) {
  const res = await fetch(`${API_BASE}/payroll?runId=${encodeURIComponent(runId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handleJson(res);
}
