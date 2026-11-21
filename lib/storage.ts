import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function isServerlessReadOnlyEnv(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NOW_REGION ||
      process.env.NETLIFY
  );
}

export function getWritablePdfDir(): string {
  if (isServerlessReadOnlyEnv()) {
    return path.join(os.tmpdir(), 'lsi-generated-pdfs');
  }
  return path.join(process.cwd(), 'storage', 'generated-pdfs');
}

export function savePdfToCache(documentId: string, bytes: Uint8Array): string | null {
  try {
    const dir = getWritablePdfDir();
    fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, `${documentId}.pdf`);
    fs.writeFileSync(fullPath, bytes);
    if (isServerlessReadOnlyEnv()) {
      return fullPath;
    }
    return path.join('storage', 'generated-pdfs', `${documentId}.pdf`);
  } catch {
    return null;
  }
}

export function readPdfFromCache(pdfPath: string | null | undefined): Uint8Array | null {
  if (!pdfPath) return null;
  try {
    const resolved = path.isAbsolute(pdfPath) ? pdfPath : path.join(process.cwd(), pdfPath);
    if (fs.existsSync(resolved)) {
      return fs.readFileSync(resolved);
    }
  } catch {
    return null;
  }
  return null;
}
