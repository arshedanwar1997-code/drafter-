import { NextResponse } from 'next/server';
import { AdminUser } from './types';

export const DEFAULT_WORKSPACE_USER: AdminUser = {
  id: 'admin-1',
  email: 'admin@legalsuccessindia.in',
  name: 'Legal Success India Workspace',
  role: 'ADMIN',
};

export async function getSessionUser(): Promise<AdminUser> {
  return DEFAULT_WORKSPACE_USER;
}

export async function requireApiAuth(): Promise<{
  user: AdminUser;
  errorResponse: NextResponse | null;
}> {
  return { user: DEFAULT_WORKSPACE_USER, errorResponse: null };
}
