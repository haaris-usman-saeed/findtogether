import { demoHeaders, expireDemoSession } from '../demoSession';
/**
 * HTTP implementation of FindTogetherApi, matching docs/API.md.
 *
 * Not exercised yet: there is no backend in this phase. It exists so the
 * swap from mock to real is one environment variable, and so the contract
 * is concrete. Identity comes from the auth token; the `session` argument
 * the mock uses is ignored here on purpose.
 */
import { connection } from '../connection';
import { ApiError, type ApiErrorCode, type CaseDetail, type CandidateView, type FindTogetherApi } from '../contracts';

export interface HttpApiOptions {
  baseUrl: string;
  getAuthToken: () => string | null;
  timeoutMs?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
}

function codeFor(status: number, serverCode: string | undefined): ApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return serverCode === 'consent_required' ? 'consent_required' : 'conflict';
  if (status === 400 || status === 422) return 'validation';
  return 'server_unavailable';
}

export function createHttpApi({ baseUrl, getAuthToken, timeoutMs = 15_000 }: HttpApiOptions): FindTogetherApi {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    if (connection.isBrowserOffline()) {
      connection.reportFailure('offline');
      throw new ApiError('network_unavailable', 'No connection. Check the connection and retry the same submission.');
    }
    const headers: Record<string, string> = { Accept: 'application/json', ...demoHeaders() };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'include',
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      connection.reportFailure(connection.isBrowserOffline() ? 'offline' : 'error');
      throw timedOut
        ? new ApiError('timeout', 'The request took too long. It may not have been saved. Retrying is safe.')
        : new ApiError('network_unavailable', 'Couldn\u2019t reach the server. Check the connection and retry the same submission.');
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 500) {
      connection.reportFailure('error');
      throw new ApiError('server_unavailable', 'The server had a problem. The result could not be confirmed. Retry the same submission.');
    }
    connection.reportSuccess(performance.now() - started);
    if (response.status === 204) return undefined as T;

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) expireDemoSession(headers['X-Findtogether-Session'] ?? null);
      const err = (payload as ErrorBody | null)?.error;
      throw new ApiError(codeFor(response.status, err?.code), err?.message ?? 'The request was not accepted.', err?.fieldErrors);
    }
    return payload as T;
  }

  const ref = encodeURIComponent;

  return {
    getShelters: () => call('GET', '/shelters'),
    createRegistration: ({ clientRequestId, ...body }) => call('POST', '/registrations', body, clientRequestId),
    recordConsent: (reference, consent) => call('POST', `/registrations/${ref(reference)}/consent`, consent),
    createSearchRequest: ({ clientRequestId, ...body }) => call('POST', '/search-requests', body, clientRequestId),
    getRequesterStatus: (reference) => call('GET', `/search-requests/${ref(reference)}/status`),
    getDashboard: () => call('GET', '/dashboard'),
    listCases: () => call('GET', '/cases'),
    async getCase(reference) {
      const [detail, candidates] = await Promise.all([
        call<Omit<CaseDetail, 'candidates'>>('GET', `/cases/${ref(reference)}`),
        call<CandidateView[]>('GET', `/cases/${ref(reference)}/matches`),
      ]);
      return { ...detail, candidates };
    },
    submitReviewDecision: (reference, decision) => call('POST', `/cases/${ref(reference)}/decisions`, decision),
    recordVerificationStep: (reference, registrationReference, step) =>
      call('POST', `/cases/${ref(reference)}/matches/${ref(registrationReference)}/verification`, step),
    requestContactCoordination: (reference, registrationReference, method) =>
      call('POST', `/cases/${ref(reference)}/matches/${ref(registrationReference)}/contact-coordination`, { method }),
  };
}
