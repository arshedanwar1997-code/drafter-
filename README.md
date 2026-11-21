# Legal Success India – Trademark Advisory PDF Generator

A production web application for generating standardized, one-page A4 portrait **Private Trademark Examination & Section 11 Advisory Reports** in searchable and fillable PDF formats.

## Key Capabilities

- **Exact Structured A4 Layout**: Matches traditional Indian trademark examination correspondence hierarchy with a three-column private organizational header, compact bilingual (Hindi + English) application metadata block, bold uppercase heading with double horizontal line, numbered underlined statutory sections, prominent Indian Rupee fee display, private advisory disclaimer, and page footer.
- **Live Split-Panel Workspace**: Dynamic multi-section form with collapsible panels alongside a real-time debounced A4 preview featuring zoom controls, fit-to-page, overflow warnings, and fullscreen view.
- **PDF-lib + Fontkit Engine**: Generates genuine vector PDFs with embedded `Noto Sans` and `Noto Sans Devanagari` fonts so Unicode Hindi labels, the `₹` symbol, and selectable English text render cleanly on Windows 10/11, macOS, and Linux.
- **Two Export Modes**:
  - **Mode 1 (Standard PDF)**: Fixed print-ready searchable PDF with automatic layout spacing and multi-page overflow handling.
  - **Mode 2 (Fillable AcroForm PDF)**: Interactive editable PDF fields (`Document Date`, `Applicant Name`, `Brand Name`, `Application No.`, `Class`, `Current Status`, `Earlier Trademark`, `Earlier Application No.`, `Applicable Charges`, `Payment Reference`, `Payment Date`).
- **Admin Dashboard & Persistence**: Built-in SQLite (`node:sqlite`) storage (with included `prisma/schema.prisma` for PostgreSQL migration), JWT + bcrypt authentication, saved reports management, 5 initial templates, reusable legal clause library, and fee schedules.

---

## Local Setup (Windows 10 / 11, macOS, Linux)

### Prerequisites
- **Node.js 22.x** or newer (required for built-in `node:sqlite`)
- **npm 10+**

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` (or `.env`) and set a strong `JWT_SECRET`:
```bash
cp .env.example .env.local
```

### 3. Provision Initial Administrator Account
Create or update an administrator account securely via the CLI setup script:
```bash
node scripts/setup-admin.mjs admin@legalsuccessindia.in YourStrongPassword123 "Legal Success India Admin"
```
*(If no users exist in the database on first launch, the application also seeds an initial account from `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.)*

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 5. Build & Run Production Server
```bash
npm run build
npm run start
```
