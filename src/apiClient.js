const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || 'http://localhost:8000').replace(/\/$/, '');
export const hasConfiguredApiUrl = Boolean(configuredBaseUrl);

export class ApiClientError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiClientError(0, 'API_UNAVAILABLE', 'Could not reach the SkillMirror API. Check that the backend is running.');
  }

  if (response.status === 204) return null;

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'The API returned an unreadable response.');
  }

  if (!response.ok || envelope?.success !== true) {
    const error = envelope?.error || {};
    throw new ApiClientError(response.status, error.code || 'REQUEST_FAILED', error.message || 'The API request failed.', error.details ?? null);
  }
  return envelope.data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });
const encode = (value) => encodeURIComponent(value);

export const skillMirrorApi = {
  health: () => request('/health'),
  register: (input) => request('/auth/register', json('POST', input)),
  login: (input) => request('/auth/login', json('POST', input)),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  listOrganizations: () => request('/owner/organizations'),
  createOrganization: (input) => request('/owner/organizations', json('POST', input)),
  ownerOverview: (organizationId) => request(`/owner/organizations/${encode(organizationId)}/overview`),
  listWorkers: (organizationId, filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
    return request(`/owner/organizations/${encode(organizationId)}/workers${params.size ? `?${params}` : ''}`);
  },
  addWorker: (organizationId, input) => request(`/owner/organizations/${encode(organizationId)}/workers`, json('POST', input)),
  getWorker: (organizationId, workerId) => request(`/owner/organizations/${encode(organizationId)}/workers/${encode(workerId)}`),
  listOrganizationTrainings: (organizationId) => request(`/owner/organizations/${encode(organizationId)}/trainings`),
  createOrganizationTraining: (organizationId, input) => request(`/owner/organizations/${encode(organizationId)}/trainings`, json('POST', input)),
  createCompetency: (organizationId, input) => request(`/owner/organizations/${encode(organizationId)}/competencies`, json('POST', input)),
  assignTraining: (organizationId, input) => request(`/owner/organizations/${encode(organizationId)}/assignments`, json('POST', input)),
  listAssignments: (organizationId) => request(`/owner/organizations/${encode(organizationId)}/assignments`),
  approveCompetency: (organizationId, competencyId, input) => request(`/owner/organizations/${encode(organizationId)}/competencies/${encode(competencyId)}/approve`, json('POST', input)),
  ownerActivity: (organizationId) => request(`/owner/organizations/${encode(organizationId)}/activity`),
  ownerReports: (organizationId, filters = {}) => {
    const params = new URLSearchParams({ organizationId });
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
    return request(`/owner/organizations/${encode(organizationId)}/reports?${params}`);
  },
  ownerReportExportUrl: (organizationId) => `${API_BASE_URL}/api/v1/owner/organizations/${encode(organizationId)}/reports/export.csv`,
  acceptWorkerInvitation: (token) => request('/worker/invitations/accept', json('POST', { token })),
  workerAssignments: () => request('/worker/assignments'),
  workerAssignment: (assignmentId) => request(`/worker/assignments/${encode(assignmentId)}`),
  workerProgress: () => request('/worker/progress'),
  startAssignedSession: (assignmentId) => request(`/worker/assignments/${encode(assignmentId)}/sessions`, { method: 'POST' }),
  listTrainings: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
    return request(`/trainings${params.size ? `?${params}` : ''}`);
  },
  getTraining: (id) => request(`/trainings/${encode(id)}`),
  createTraining: (input) => request('/trainings', json('POST', input)),
  updateTraining: (id, input) => request(`/trainings/${encode(id)}`, json('PATCH', input)),
  deleteTraining: (id) => request(`/trainings/${encode(id)}`, { method: 'DELETE' }),
  saveProcedure: (id, input) => request(`/trainings/${encode(id)}/procedure`, json('PUT', input)),
  addStep: (trainingId, input) => request(`/trainings/${encode(trainingId)}/steps`, json('POST', input)),
  updateStep: (trainingId, stepId, input) => request(`/trainings/${encode(trainingId)}/steps/${encode(stepId)}`, json('PATCH', input)),
  deleteStep: (trainingId, stepId) => request(`/trainings/${encode(trainingId)}/steps/${encode(stepId)}`, { method: 'DELETE' }),
  reorderSteps: (trainingId, stepIds) => request(`/trainings/${encode(trainingId)}/steps/reorder`, json('PUT', { stepIds })),
  generateSampleSteps: (trainingId) => request(`/trainings/${encode(trainingId)}/generate-steps`, json('POST', { mode: 'demo' })),
  trainingProgress: (trainingId) => request(`/trainings/${encode(trainingId)}/progress`),
  createSession: (trainingId) => request(`/trainings/${encode(trainingId)}/sessions`, { method: 'POST' }),
  getSession: (sessionId) => request(`/sessions/${encode(sessionId)}`),
  updateProgress: (sessionId, input) => request(`/sessions/${encode(sessionId)}/progress`, json('PATCH', input)),
  uploadTrainingMedia: (trainingId, file, stepId) => {
    const body = new FormData();
    body.append('file', file);
    if (stepId) body.append('stepId', stepId);
    return request(`/trainings/${encode(trainingId)}/media`, { method: 'POST', body });
  },
  uploadEvidence: (sessionId, stepId, file) => {
    const body = new FormData();
    body.append('file', file);
    body.append('stepId', stepId);
    return request(`/sessions/${encode(sessionId)}/media`, { method: 'POST', body });
  },
  getMediaUrl: (assetId) => `${API_BASE_URL}/api/v1/media/${encode(assetId)}`,
  submitAttempt: (sessionId, stepId, evidenceIds = []) => request(`/sessions/${encode(sessionId)}/steps/${encode(stepId)}/attempts`, json('POST', { evidenceIds })),
  listAttempts: (sessionId) => request(`/sessions/${encode(sessionId)}/attempts`),
  reviewAttempt: (sessionId, attemptId, input) => request(`/sessions/${encode(sessionId)}/attempts/${encode(attemptId)}/review`, json('PATCH', input)),
  completeSession: (sessionId) => request(`/sessions/${encode(sessionId)}/complete`, { method: 'POST' }),
  getReport: (sessionId) => request(`/sessions/${encode(sessionId)}/report`),
};

export { request as apiRequest };