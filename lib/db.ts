import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {
  AdminUser,
  DashboardStats,
  FeePreset,
  LegalClause,
  OrganizationSettings,
  ReportPayload,
  ReportStatus,
  ReportTemplate,
  SavedReport,
} from './types';
import {
  createDefaultReportPayload,
  DEFAULT_ORGANIZATION_SETTINGS,
  INITIAL_FEE_PRESETS,
  INITIAL_LEGAL_CLAUSES,
  INITIAL_TEMPLATES,
} from './default-data';
import { todayIsoDate } from './text-utils';
import { isServerlessReadOnlyEnv } from './storage';

interface SqliteStatement {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => { changes: number };
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

interface SqliteBuiltinModule {
  DatabaseSync: new (location: string) => SqliteDatabase;
}

interface MemoryStore {
  users: (AdminUser & { passwordHash: string })[];
  reports: SavedReport[];
  templates: ReportTemplate[];
  legalClauses: LegalClause[];
  feePresets: FeePreset[];
  organizationSettings: OrganizationSettings;
}

const globalForDb = globalThis as unknown as {
  __tmAdvisorySqlite?: SqliteDatabase;
  __tmAdvisoryMemStore?: MemoryStore;
  __tmAdvisoryUseMemory?: boolean;
};

function getInitialSeedRecords() {
  const now = new Date().toISOString();

  const anzora = createDefaultReportPayload();
  anzora.documentId = 'LSI-20261118-8127';
  anzora.reportReferenceNumber = 'TM/ADV/2026/81270';
  anzora.documentDate = todayIsoDate();
  anzora.applicantName = 'Anzora Lifestyle Pvt. Ltd.';
  anzora.reportStatus = 'Finalized';

  const rhino = createDefaultReportPayload();
  rhino.documentId = 'LSI-20261117-4491';
  rhino.reportReferenceNumber = 'TM/ADV/2026/44912';
  rhino.documentDate = todayIsoDate();
  rhino.applicantName = 'Rhino Agro Implements';
  rhino.brandName = 'RHINO TRACTOR ATTACHMENTS';
  rhino.applicationNumber = '6412980';
  rhino.trademarkClass = 'Class 7';
  rhino.earlierTrademarks = [
    {
      id: 'em-r1',
      markName: 'RHINO HEAVY ENGINEERING',
      applicationNumber: '4120874',
      registrationNumber: '4120874',
      trademarkClass: 'Class 7',
      proprietorName: 'Rhino Engineering Works',
      status: 'Registered',
      similarityType: 'Phonetic & Conceptual Similarity',
      similarityDescription: 'Shared prefix RHINO in Class 7 agricultural machinery.',
    },
  ];
  rhino.fees.professionalFee = 6500;
  rhino.fees.governmentFee = 4500;
  rhino.reportStatus = 'Generated';

  const oshaita = createDefaultReportPayload();
  oshaita.documentId = 'LSI-20261115-3109';
  oshaita.reportReferenceNumber = 'TM/ADV/2026/31095';
  oshaita.documentDate = '2026-11-15';
  oshaita.applicantName = 'Oshaita Consumer Products';
  oshaita.brandName = 'OSHAITA PREMIUM';
  oshaita.applicationNumber = '7058321';
  oshaita.trademarkClass = 'Class 30';
  oshaita.applicationProvision = 'Section 9 – Absolute Grounds for Refusal';
  oshaita.currentStatus = 'Objection Raised';
  oshaita.subject = 'Section 9(1)(b) – Descriptive Laudatory Wordmark Advisory';
  oshaita.earlierTrademarks = [
    {
      id: 'em-o1',
      markName: 'OSHAITA FOODS',
      applicationNumber: '3981205',
      registrationNumber: '',
      trademarkClass: 'Class 30',
      proprietorName: 'Oshaita Enterprises',
      status: 'Pending',
      similarityType: 'Visual Similarity',
      similarityDescription: 'Overlapping mark element in Class 30 food products.',
    },
  ];
  oshaita.fees.professionalFee = 5500;
  oshaita.reportStatus = 'Draft';

  const samples: [string, ReportPayload][] = [
    ['rep-anzora-1', anzora],
    ['rep-rhino-2', rhino],
    ['rep-oshaita-3', oshaita],
  ];

  return { now, samples };
}

function getMemoryStore(): MemoryStore {
  if (globalForDb.__tmAdvisoryMemStore) {
    return globalForDb.__tmAdvisoryMemStore;
  }

  const { now, samples } = getInitialSeedRecords();
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@legalsuccessindia.in').toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'LegalSuccess@2026';

  let passwordHash = '';
  try {
    passwordHash = bcrypt.hashSync(password, 10);
  } catch {
    passwordHash = '';
  }

  const store: MemoryStore = {
    users: [
      {
        id: 'admin-1',
        email,
        name: 'Legal Success India Admin',
        role: 'ADMIN',
        passwordHash,
      },
    ],
    reports: samples.map(([id, payload]) => ({
      ...payload,
      id,
      pdfPath: null,
      createdAt: now,
      updatedAt: now,
    })),
    templates: INITIAL_TEMPLATES.map((t) => ({
      ...t,
      createdAt: now,
      updatedAt: now,
    })),
    legalClauses: INITIAL_LEGAL_CLAUSES.map((c) => ({
      ...c,
      updatedAt: now,
    })),
    feePresets: INITIAL_FEE_PRESETS.map((f) => ({
      ...f,
      updatedAt: now,
    })),
    organizationSettings: { ...DEFAULT_ORGANIZATION_SETTINGS },
  };

  globalForDb.__tmAdvisoryMemStore = store;
  return store;
}

function loadSqliteBuiltin(): SqliteBuiltinModule | null {
  try {
    const proc = process as unknown as {
      getBuiltinModule?: (id: string) => unknown;
    };
    if (typeof proc.getBuiltinModule === 'function') {
      const mod = proc.getBuiltinModule('node:sqlite') as SqliteBuiltinModule | undefined;
      if (mod && typeof mod.DatabaseSync === 'function') {
        return mod;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function resolveCandidateDbPaths(): string[] {
  if (process.env.SQLITE_DB_PATH) {
    return [path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)];
  }
  const tmpPath = path.join(os.tmpdir(), 'trademark_advisory.db');
  if (isServerlessReadOnlyEnv()) {
    return [tmpPath];
  }
  return [path.join(process.cwd(), 'data', 'trademark_advisory.db'), tmpPath];
}

function getDb(): SqliteDatabase | null {
  if (globalForDb.__tmAdvisoryUseMemory) return null;
  if (globalForDb.__tmAdvisorySqlite) return globalForDb.__tmAdvisorySqlite;

  const sqlite = loadSqliteBuiltin();
  if (!sqlite) {
    globalForDb.__tmAdvisoryUseMemory = true;
    return null;
  }

  for (const dbPath of resolveCandidateDbPaths()) {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new sqlite.DatabaseSync(dbPath);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'ADMIN',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          document_id TEXT UNIQUE NOT NULL,
          report_reference_number TEXT NOT NULL,
          applicant_name TEXT NOT NULL DEFAULT '',
          brand_name TEXT NOT NULL,
          application_number TEXT NOT NULL,
          trademark_class TEXT NOT NULL DEFAULT '',
          earlier_trademark TEXT NOT NULL DEFAULT '',
          earlier_application_number TEXT NOT NULL DEFAULT '',
          document_date TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          report_status TEXT NOT NULL DEFAULT 'Draft',
          pdf_path TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          provision TEXT NOT NULL DEFAULT '',
          heading_text TEXT NOT NULL,
          salutation TEXT NOT NULL,
          opening_paragraphs_json TEXT NOT NULL,
          sections_json TEXT NOT NULL,
          default_professional_fee REAL NOT NULL DEFAULT 9500,
          default_government_fee REAL NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS legal_clauses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          provision TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fee_presets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          professional_fee REAL NOT NULL DEFAULT 0,
          government_fee REAL NOT NULL DEFAULT 0,
          other_charges REAL NOT NULL DEFAULT 0,
          gst REAL NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      seedInitialData(db);
      globalForDb.__tmAdvisorySqlite = db;
      return db;
    } catch {
      // Try next candidate path or fall back to in-memory store
    }
  }

  globalForDb.__tmAdvisoryUseMemory = true;
  return null;
}

function seedInitialData(db: SqliteDatabase) {
  const { now, samples } = getInitialSeedRecords();

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (userCount.c === 0) {
    const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@legalsuccessindia.in';
    const password = process.env.INITIAL_ADMIN_PASSWORD || 'LegalSuccess@2026';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('admin-1', email.toLowerCase(), 'Legal Success India Admin', hash, 'ADMIN', now, now);
  }

  const tplCount = db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number };
  if (tplCount.c === 0) {
    const stmt = db.prepare(
      `INSERT INTO templates (id, name, description, provision, heading_text, salutation, opening_paragraphs_json, sections_json, default_professional_fee, default_government_fee, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of INITIAL_TEMPLATES) {
      stmt.run(
        t.id,
        t.name,
        t.description,
        t.provision,
        t.headingText,
        t.salutation,
        JSON.stringify(t.openingParagraphs),
        JSON.stringify(t.sections),
        t.defaultProfessionalFee,
        t.defaultGovernmentFee,
        t.isDefault ? 1 : 0,
        now,
        now
      );
    }
  }

  const clauseCount = db.prepare('SELECT COUNT(*) as c FROM legal_clauses').get() as { c: number };
  if (clauseCount.c === 0) {
    const stmt = db.prepare(
      `INSERT INTO legal_clauses (id, title, category, provision, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const c of INITIAL_LEGAL_CLAUSES) {
      stmt.run(c.id, c.title, c.category, c.provision, c.content, now);
    }
  }

  const feeCount = db.prepare('SELECT COUNT(*) as c FROM fee_presets').get() as { c: number };
  if (feeCount.c === 0) {
    const stmt = db.prepare(
      `INSERT INTO fee_presets (id, name, description, professional_fee, government_fee, other_charges, gst, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const f of INITIAL_FEE_PRESETS) {
      stmt.run(f.id, f.name, f.description, f.professionalFee, f.governmentFee, f.otherCharges, f.gst, now);
    }
  }

  const orgRow = db.prepare('SELECT key FROM settings WHERE key = ?').get('organization');
  if (!orgRow) {
    db.prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)').run(
      'organization',
      JSON.stringify(DEFAULT_ORGANIZATION_SETTINGS),
      now
    );
  }

  const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports').get() as { c: number };
  if (reportCount.c === 0) {
    const insertStmt = db.prepare(
      `INSERT INTO reports (id, document_id, report_reference_number, applicant_name, brand_name, application_number, trademark_class, earlier_trademark, earlier_application_number, document_date, payload_json, report_status, pdf_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const [id, p] of samples) {
      const earlierNames = p.earlierTrademarks.map((m) => m.markName).join(', ');
      const earlierNos = p.earlierTrademarks.map((m) => m.applicationNumber).join(', ');
      insertStmt.run(
        id,
        p.documentId,
        p.reportReferenceNumber,
        p.applicantName,
        p.brandName,
        p.applicationNumber,
        p.trademarkClass,
        earlierNames,
        earlierNos,
        p.documentDate,
        JSON.stringify(p),
        p.reportStatus,
        null,
        now,
        now
      );
    }
  }
}

function rowToSavedReport(row: Record<string, unknown>): SavedReport {
  const payload = JSON.parse(String(row.payload_json)) as ReportPayload;
  return {
    ...payload,
    id: String(row.id),
    reportStatus: String(row.report_status) as ReportStatus,
    pdfPath: row.pdf_path ? String(row.pdf_path) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// --- USERS ---
export function findUserByEmail(emailOrUsername: string): (AdminUser & { passwordHash: string }) | null {
  const db = getDb();
  const clean = emailOrUsername.trim().toLowerCase();
  if (!db) {
    const store = getMemoryStore();
    return (
      store.users.find(
        (u) => u.email.toLowerCase() === clean || (clean === 'admin' && u.id === 'admin-1')
      ) || null
    );
  }
  const row = db
    .prepare(
      'SELECT id, email, name, password_hash, role FROM users WHERE LOWER(email) = ? OR (? = \'admin\' AND id = \'admin-1\')'
    )
    .get(clean, clean) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role),
    passwordHash: String(row.password_hash),
  };
}

export function updateUserPassword(email: string, newPasswordHash: string): boolean {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    return true;
  }
  const res = db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)')
    .run(newPasswordHash, new Date().toISOString(), email.trim());
  return res.changes > 0;
}

// --- REPORTS ---
export function listReports(filters?: {
  search?: string;
  status?: string;
  date?: string;
}): SavedReport[] {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    return store.reports
      .filter((r) => {
        if (filters?.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          const hit =
            (r.applicantName || '').toLowerCase().includes(q) ||
            (r.brandName || '').toLowerCase().includes(q) ||
            (r.applicationNumber || '').toLowerCase().includes(q) ||
            (r.documentId || '').toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (filters?.status && filters.status !== 'All' && r.reportStatus !== filters.status) {
          return false;
        }
        if (filters?.date && filters.date.trim() && r.documentDate !== filters.date.trim()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const clauses: string[] = [];
  const params: string[] = [];

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    clauses.push('(applicant_name LIKE ? OR brand_name LIKE ? OR application_number LIKE ? OR document_id LIKE ?)');
    params.push(q, q, q, q);
  }
  if (filters?.status && filters.status !== 'All') {
    clauses.push('report_status = ?');
    params.push(filters.status);
  }
  if (filters?.date && filters.date.trim()) {
    clauses.push('document_date = ?');
    params.push(filters.date.trim());
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM reports ${where} ORDER BY updated_at DESC`)
    .all(...params) as Record<string, unknown>[];

  return rows.map(rowToSavedReport);
}

export function getReportById(id: string): SavedReport | null {
  const db = getDb();
  if (!db) {
    return getMemoryStore().reports.find((r) => r.id === id) || null;
  }
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToSavedReport(row) : null;
}

export function createReport(payload: ReportPayload, pdfPath: string | null = null): SavedReport {
  const db = getDb();
  const id = payload.id || `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const cleanPayload: ReportPayload = { ...payload, id };

  if (!db) {
    const created: SavedReport = {
      ...cleanPayload,
      id,
      reportStatus: cleanPayload.reportStatus || 'Draft',
      pdfPath,
      createdAt: now,
      updatedAt: now,
    };
    getMemoryStore().reports.unshift(created);
    return created;
  }

  const earlierNames = payload.earlierTrademarks.map((m) => m.markName).filter(Boolean).join(', ');
  const earlierNos = payload.earlierTrademarks.map((m) => m.applicationNumber).filter(Boolean).join(', ');

  db.prepare(
    `INSERT INTO reports (id, document_id, report_reference_number, applicant_name, brand_name, application_number, trademark_class, earlier_trademark, earlier_application_number, document_date, payload_json, report_status, pdf_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    cleanPayload.documentId,
    cleanPayload.reportReferenceNumber,
    cleanPayload.applicantName || '',
    cleanPayload.brandName,
    cleanPayload.applicationNumber,
    cleanPayload.trademarkClass || '',
    earlierNames,
    earlierNos,
    cleanPayload.documentDate,
    JSON.stringify(cleanPayload),
    cleanPayload.reportStatus || 'Draft',
    pdfPath,
    now,
    now
  );

  return getReportById(id)!;
}

export function updateReport(
  id: string,
  payload: ReportPayload,
  pdfPath?: string | null
): SavedReport | null {
  const db = getDb();
  const existing = getReportById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const cleanPayload: ReportPayload = { ...payload, id };
  const nextPdfPath = pdfPath !== undefined ? pdfPath : existing.pdfPath;

  if (!db) {
    const store = getMemoryStore();
    const updated: SavedReport = {
      ...cleanPayload,
      id,
      pdfPath: nextPdfPath,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    store.reports = store.reports.map((r) => (r.id === id ? updated : r));
    return updated;
  }

  const earlierNames = payload.earlierTrademarks.map((m) => m.markName).filter(Boolean).join(', ');
  const earlierNos = payload.earlierTrademarks.map((m) => m.applicationNumber).filter(Boolean).join(', ');

  db.prepare(
    `UPDATE reports SET
      document_id = ?,
      report_reference_number = ?,
      applicant_name = ?,
      brand_name = ?,
      application_number = ?,
      trademark_class = ?,
      earlier_trademark = ?,
      earlier_application_number = ?,
      document_date = ?,
      payload_json = ?,
      report_status = ?,
      pdf_path = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    cleanPayload.documentId,
    cleanPayload.reportReferenceNumber,
    cleanPayload.applicantName || '',
    cleanPayload.brandName,
    cleanPayload.applicationNumber,
    cleanPayload.trademarkClass || '',
    earlierNames,
    earlierNos,
    cleanPayload.documentDate,
    JSON.stringify(cleanPayload),
    cleanPayload.reportStatus,
    nextPdfPath,
    now,
    id
  );

  return getReportById(id);
}

export function deleteReport(id: string): boolean {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const prev = store.reports.length;
    store.reports = store.reports.filter((r) => r.id !== id);
    return store.reports.length < prev;
  }
  const res = db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  return res.changes > 0;
}

export function duplicateReport(id: string): SavedReport | null {
  const existing = getReportById(id);
  if (!existing) return null;

  const copyPayload: ReportPayload = {
    ...existing,
    id: undefined,
    documentId: `LSI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    reportReferenceNumber: `TM/ADV/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`,
    brandName: `${existing.brandName} (Copy)`,
    reportStatus: 'Draft',
  };
  return createReport(copyPayload, null);
}

export function getDashboardStats(): DashboardStats {
  const all = listReports();
  const today = todayIsoDate();
  const monthPrefix = today.slice(0, 7);

  const reportsToday = all.filter((r) => r.documentDate === today || r.createdAt.startsWith(today)).length;
  const reportsThisMonth = all.filter(
    (r) => r.documentDate.startsWith(monthPrefix) || r.createdAt.startsWith(monthPrefix)
  ).length;
  const draftReports = all.filter((r) => r.reportStatus === 'Draft').length;
  const completedReports = all.filter(
    (r) => r.reportStatus === 'Generated' || r.reportStatus === 'Finalized'
  ).length;

  const countsByMonth = new Map<string, number>();
  for (const r of all) {
    const ym = (r.documentDate || r.createdAt).slice(0, 7);
    if (ym) countsByMonth.set(ym, (countsByMonth.get(ym) || 0) + 1);
  }
  const now = new Date();
  const monthlySeries: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlySeries.push({ month: label, count: countsByMonth.get(ym) || 0 });
  }

  return {
    totalReports: all.length,
    reportsToday,
    reportsThisMonth,
    draftReports,
    completedReports,
    monthlySeries,
    recentReports: [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    latestEditedReports: all.slice(0, 5),
  };
}

// --- TEMPLATES ---
export function listTemplates(): ReportTemplate[] {
  const db = getDb();
  if (!db) {
    return [...getMemoryStore().templates].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  const rows = db
    .prepare('SELECT * FROM templates ORDER BY is_default DESC, updated_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: String(r.description),
    provision: String(r.provision),
    headingText: String(r.heading_text),
    salutation: String(r.salutation),
    openingParagraphs: JSON.parse(String(r.opening_paragraphs_json)),
    sections: JSON.parse(String(r.sections_json)),
    defaultProfessionalFee: Number(r.default_professional_fee),
    defaultGovernmentFee: Number(r.default_government_fee),
    isDefault: Boolean(r.is_default),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function upsertTemplate(tpl: Omit<ReportTemplate, 'createdAt' | 'updatedAt'>): ReportTemplate {
  const db = getDb();
  const now = new Date().toISOString();
  if (!db) {
    const store = getMemoryStore();
    if (tpl.isDefault) {
      store.templates = store.templates.map((t) => ({ ...t, isDefault: false }));
    }
    const existing = store.templates.find((t) => t.id === tpl.id);
    const saved: ReportTemplate = {
      ...tpl,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (existing) {
      store.templates = store.templates.map((t) => (t.id === tpl.id ? saved : t));
    } else {
      store.templates.push(saved);
    }
    return saved;
  }

  if (tpl.isDefault) {
    db.prepare('UPDATE templates SET is_default = 0').run();
  }
  const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(tpl.id);
  if (existing) {
    db.prepare(
      `UPDATE templates SET name = ?, description = ?, provision = ?, heading_text = ?, salutation = ?, opening_paragraphs_json = ?, sections_json = ?, default_professional_fee = ?, default_government_fee = ?, is_default = ?, updated_at = ? WHERE id = ?`
    ).run(
      tpl.name,
      tpl.description,
      tpl.provision,
      tpl.headingText,
      tpl.salutation,
      JSON.stringify(tpl.openingParagraphs),
      JSON.stringify(tpl.sections),
      tpl.defaultProfessionalFee,
      tpl.defaultGovernmentFee,
      tpl.isDefault ? 1 : 0,
      now,
      tpl.id
    );
  } else {
    db.prepare(
      `INSERT INTO templates (id, name, description, provision, heading_text, salutation, opening_paragraphs_json, sections_json, default_professional_fee, default_government_fee, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      tpl.id,
      tpl.name,
      tpl.description,
      tpl.provision,
      tpl.headingText,
      tpl.salutation,
      JSON.stringify(tpl.openingParagraphs),
      JSON.stringify(tpl.sections),
      tpl.defaultProfessionalFee,
      tpl.defaultGovernmentFee,
      tpl.isDefault ? 1 : 0,
      now,
      now
    );
  }
  return listTemplates().find((t) => t.id === tpl.id)!;
}

export function deleteTemplate(id: string): boolean {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const prev = store.templates.length;
    store.templates = store.templates.filter((t) => t.id !== id);
    return store.templates.length < prev;
  }
  const res = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  return res.changes > 0;
}

// --- LEGAL CLAUSES ---
export function listLegalClauses(): LegalClause[] {
  const db = getDb();
  if (!db) {
    return [...getMemoryStore().legalClauses].sort(
      (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
    );
  }
  const rows = db.prepare('SELECT * FROM legal_clauses ORDER BY category, title').all() as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    category: String(r.category),
    provision: String(r.provision),
    content: String(r.content),
    updatedAt: String(r.updated_at),
  }));
}

export function upsertLegalClause(clause: Omit<LegalClause, 'updatedAt'>): LegalClause {
  const db = getDb();
  const now = new Date().toISOString();
  if (!db) {
    const store = getMemoryStore();
    const saved: LegalClause = { ...clause, updatedAt: now };
    const exists = store.legalClauses.some((c) => c.id === clause.id);
    store.legalClauses = exists
      ? store.legalClauses.map((c) => (c.id === clause.id ? saved : c))
      : [...store.legalClauses, saved];
    return saved;
  }
  const existing = db.prepare('SELECT id FROM legal_clauses WHERE id = ?').get(clause.id);
  if (existing) {
    db.prepare(
      'UPDATE legal_clauses SET title = ?, category = ?, provision = ?, content = ?, updated_at = ? WHERE id = ?'
    ).run(clause.title, clause.category, clause.provision, clause.content, now, clause.id);
  } else {
    db.prepare(
      'INSERT INTO legal_clauses (id, title, category, provision, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(clause.id, clause.title, clause.category, clause.provision, clause.content, now);
  }
  return listLegalClauses().find((c) => c.id === clause.id)!;
}

export function deleteLegalClause(id: string): boolean {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const prev = store.legalClauses.length;
    store.legalClauses = store.legalClauses.filter((c) => c.id !== id);
    return store.legalClauses.length < prev;
  }
  return db.prepare('DELETE FROM legal_clauses WHERE id = ?').run(id).changes > 0;
}

// --- FEE PRESETS ---
export function listFeePresets(): FeePreset[] {
  const db = getDb();
  if (!db) {
    return [...getMemoryStore().feePresets].sort((a, b) => a.name.localeCompare(b.name));
  }
  const rows = db.prepare('SELECT * FROM fee_presets ORDER BY name').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: String(r.description),
    professionalFee: Number(r.professional_fee),
    governmentFee: Number(r.government_fee),
    otherCharges: Number(r.other_charges),
    gst: Number(r.gst),
    updatedAt: String(r.updated_at),
  }));
}

export function upsertFeePreset(preset: Omit<FeePreset, 'updatedAt'>): FeePreset {
  const db = getDb();
  const now = new Date().toISOString();
  if (!db) {
    const store = getMemoryStore();
    const saved: FeePreset = { ...preset, updatedAt: now };
    const exists = store.feePresets.some((p) => p.id === preset.id);
    store.feePresets = exists
      ? store.feePresets.map((p) => (p.id === preset.id ? saved : p))
      : [...store.feePresets, saved];
    return saved;
  }
  const existing = db.prepare('SELECT id FROM fee_presets WHERE id = ?').get(preset.id);
  if (existing) {
    db.prepare(
      'UPDATE fee_presets SET name = ?, description = ?, professional_fee = ?, government_fee = ?, other_charges = ?, gst = ?, updated_at = ? WHERE id = ?'
    ).run(
      preset.name,
      preset.description,
      preset.professionalFee,
      preset.governmentFee,
      preset.otherCharges,
      preset.gst,
      now,
      preset.id
    );
  } else {
    db.prepare(
      'INSERT INTO fee_presets (id, name, description, professional_fee, government_fee, other_charges, gst, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      preset.id,
      preset.name,
      preset.description,
      preset.professionalFee,
      preset.governmentFee,
      preset.otherCharges,
      preset.gst,
      now
    );
  }
  return listFeePresets().find((p) => p.id === preset.id)!;
}

export function deleteFeePreset(id: string): boolean {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    const prev = store.feePresets.length;
    store.feePresets = store.feePresets.filter((p) => p.id !== id);
    return store.feePresets.length < prev;
  }
  return db.prepare('DELETE FROM fee_presets WHERE id = ?').run(id).changes > 0;
}

// --- SETTINGS ---
export function getOrganizationSettings(): OrganizationSettings {
  const db = getDb();
  if (!db) {
    return { ...getMemoryStore().organizationSettings };
  }
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('organization') as
    | { value_json: string }
    | undefined;
  if (!row) return DEFAULT_ORGANIZATION_SETTINGS;
  return { ...DEFAULT_ORGANIZATION_SETTINGS, ...JSON.parse(row.value_json) };
}

export function saveOrganizationSettings(settings: OrganizationSettings): OrganizationSettings {
  const db = getDb();
  if (!db) {
    const store = getMemoryStore();
    store.organizationSettings = { ...DEFAULT_ORGANIZATION_SETTINGS, ...settings };
    store.reports = store.reports.map((r) => ({ ...r, pdfPath: null }));
    return { ...store.organizationSettings };
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
  ).run('organization', JSON.stringify(settings), now);
  db.prepare('UPDATE reports SET pdf_path = NULL').run();
  return getOrganizationSettings();
}
