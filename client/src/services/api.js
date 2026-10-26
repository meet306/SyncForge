const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('syncforge_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      localStorage.removeItem('syncforge_token');
      localStorage.removeItem('syncforge_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new ApiError(data.error || 'An unexpected error occurred.', response.status, data);
  }

  return data;
}

export const api = {
  auth: {
    login: (email, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),
    register: (name, email, password) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      }),
    getMe: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' })
  },
  documents: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/documents${query ? `?${query}` : ''}`);
    },
    get: (id) => request(`/documents/${id}`),
    create: (title) =>
      request('/documents', {
        method: 'POST',
        body: JSON.stringify({ title })
      }),
    update: (id, updates) =>
      request(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }),
    delete: (id) =>
      request(`/documents/${id}`, {
        method: 'DELETE'
      }),
    addMember: (docId, email, role) =>
      request(`/documents/${docId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      }),
    updateMemberRole: (docId, userId, role) =>
      request(`/documents/${docId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      }),
    removeMember: (docId, userId) =>
      request(`/documents/${docId}/members/${userId}`, {
        method: 'DELETE'
      }),
    createShareLink: (docId, permission, expiresInHours) =>
      request(`/documents/${docId}/share-links`, {
        method: 'POST',
        body: JSON.stringify({ permission, expiresInHours })
      }),
    revokeShareLink: (docId, linkId) =>
      request(`/documents/${docId}/share-links/${linkId}`, {
        method: 'DELETE'
      }),
    getPublicShare: (token) => request(`/documents/public/share/${token}`)
  },
  metrics: {
    getHealth: () => fetch('/health').then((r) => r.json()),
    getMetrics: () => fetch('/api/metrics').then((r) => r.json())
  }
};
