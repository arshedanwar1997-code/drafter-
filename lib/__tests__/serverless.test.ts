import test from 'node:test';
import assert from 'node:assert/strict';
import { getWritablePdfDir, readPdfFromCache, savePdfToCache } from '../storage';

test('db module works cleanly in serverless in-memory fallback when node:sqlite is unavailable', async () => {
  const g = globalThis as unknown as {
    __tmAdvisorySqlite?: unknown;
    __tmAdvisoryUseMemory?: boolean;
    __tmAdvisoryMemStore?: unknown;
  };
  const prevSqlite = g.__tmAdvisorySqlite;
  const prevUseMem = g.__tmAdvisoryUseMemory;
  const prevStore = g.__tmAdvisoryMemStore;

  try {
    g.__tmAdvisorySqlite = undefined;
    g.__tmAdvisoryUseMemory = true;
    g.__tmAdvisoryMemStore = undefined;

    const db = await import('../db');
    const stats = db.getDashboardStats();
    assert.ok(stats.totalReports >= 3);

    const templates = db.listTemplates();
    assert.ok(templates.length >= 5);

    const settings = db.getOrganizationSettings();
    assert.equal(settings.organizationName, 'LEGAL SUCCESS INDIA');

    const created = db.createReport({
      ...db.getReportById('rep-anzora-1')!,
      id: undefined,
      documentId: 'LSI-TEST-MEM-1',
      brandName: 'VERCEL TEST BRAND',
    });
    assert.equal(created.brandName, 'VERCEL TEST BRAND');
    assert.equal(db.deleteReport(created.id), true);
  } finally {
    g.__tmAdvisorySqlite = prevSqlite;
    g.__tmAdvisoryUseMemory = prevUseMem;
    g.__tmAdvisoryMemStore = prevStore;
  }
});

test('storage helper uses os.tmpdir() when VERCEL=1 and safely reads/writes PDF bytes', () => {
  const prevVercel = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    const dir = getWritablePdfDir();
    assert.ok(!dir.startsWith(process.cwd()), 'Vercel PDF dir must not write inside read-only cwd');

    const sample = new Uint8Array([37, 80, 68, 70, 45]);
    const saved = savePdfToCache('test-vercel-cache', sample);
    assert.ok(saved !== null);
    const loaded = readPdfFromCache(saved);
    assert.ok(loaded !== null);
    assert.deepEqual(Array.from(loaded), Array.from(sample));
  } finally {
    if (prevVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = prevVercel;
    }
  }
});
