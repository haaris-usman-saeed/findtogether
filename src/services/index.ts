import { createHttpApi } from './http/httpApi';
import type { MockBackend } from './mock/mockApi';
export const apiMode: 'mock' | 'http' = 'http';
export const mockBackend: MockBackend | null = null;
export const api = createHttpApi({ baseUrl: '/api', getAuthToken: () => null });
