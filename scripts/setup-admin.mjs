#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const [, , emailArg, passwordArg, nameArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/setup-admin.mjs <email> <password> [name]');
  process.exit(1);
}

if (passwordArg.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
  : path.join(process.cwd(), 'data', 'trademark_advisory.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
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
`);

const now = new Date().toISOString();
const hash = bcrypt.hashSync(passwordArg, 10);
const email = emailArg.trim().toLowerCase();
const name = (nameArg || 'Legal Success India Admin').trim();

const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
if (existing) {
  db.prepare('UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE LOWER(email) = ?').run(
    name,
    hash,
    now,
    email
  );
  console.log(`Updated admin credentials for ${email}`);
} else {
  const id = `admin-${Date.now()}`;
  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email, name, hash, 'ADMIN', now, now);
  console.log(`Created admin user ${email}`);
}
