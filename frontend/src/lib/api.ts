const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Stories API
export const storiesApi = {
  getBySlug: (slug: string) => fetchApi<any>(`/stories/slug/${slug}`),
  getById: (id: string) => fetchApi<any>(`/stories/${id}`),
  update: (id: string, data: any, token: string) =>
    fetchApi<any>(`/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  publish: (id: string, token: string) =>
    fetchApi<any>(`/stories/${id}/publish`, {
      method: 'POST',
      token,
    }),
};

// Segments API
export const segmentsApi = {
  getById: (id: string) => fetchApi<any>(`/segments/${id}`),
  getByStory: (storyId: string) => fetchApi<any[]>(`/segments/story/${storyId}`),
  getStructure: (storyId: string) => fetchApi<any>(`/segments/story/${storyId}/structure`),
  create: (data: any, token: string) =>
    fetchApi<any>('/segments', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: any, token: string) =>
    fetchApi<any>(`/segments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  delete: (id: string, token: string) =>
    fetchApi<void>(`/segments/${id}`, {
      method: 'DELETE',
      token,
    }),
  updatePositions: (storyId: string, positions: any[], token: string) =>
    fetchApi<void>(`/segments/story/${storyId}/positions`, {
      method: 'PUT',
      body: JSON.stringify({ positions }),
      token,
    }),
};

// Choices API
export const choicesApi = {
  getBySegment: (segmentId: string) => fetchApi<any[]>(`/choices/segment/${segmentId}`),
  getAvailable: (segmentId: string, state: Record<string, any>, visited: string[]) =>
    fetchApi<any[]>(`/choices/segment/${segmentId}/available?state=${JSON.stringify(state)}&visited=${visited.join(',')}`),
  recordChoice: (choiceId: string) =>
    fetchApi<void>(`/choices/${choiceId}/chosen`, { method: 'POST' }),
  create: (data: any, token: string) =>
    fetchApi<any>('/choices', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: any, token: string) =>
    fetchApi<any>(`/choices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  delete: (id: string, token: string) =>
    fetchApi<void>(`/choices/${id}`, {
      method: 'DELETE',
      token,
    }),
};

// Progress API
export const progressApi = {
  start: (storyId: string, token: string) =>
    fetchApi<any>('/progress/start', {
      method: 'POST',
      body: JSON.stringify({ storyId }),
      token,
    }),
  get: (storyId: string, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}`, { token }),
  makeChoice: (storyId: string, choiceId: string, timeSpent: number, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}/choice`, {
      method: 'POST',
      body: JSON.stringify({ choiceId, timeSpent }),
      token,
    }),
  navigate: (storyId: string, segmentId: string, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}/navigate/${segmentId}`, {
      method: 'POST',
      token,
    }),
  reset: (storyId: string, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}/reset`, {
      method: 'POST',
      token,
    }),
  addBookmark: (storyId: string, segmentId: string, note: string, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}/bookmarks`, {
      method: 'POST',
      body: JSON.stringify({ segmentId, note }),
      token,
    }),
  removeBookmark: (storyId: string, segmentId: string, token: string) =>
    fetchApi<any>(`/progress/story/${storyId}/bookmarks/${segmentId}`, {
      method: 'DELETE',
      token,
    }),
};

// State Variables API
export const stateVariablesApi = {
  getByStory: (storyId: string, token: string) =>
    fetchApi<any[]>(`/state-variables/story/${storyId}`, { token }),
  create: (data: any, token: string) =>
    fetchApi<any>('/state-variables', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: any, token: string) =>
    fetchApi<any>(`/state-variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  delete: (id: string, token: string) =>
    fetchApi<void>(`/state-variables/${id}`, {
      method: 'DELETE',
      token,
    }),
};

// Branch Submissions API
export const branchSubmissionsApi = {
  getByStory: (storyId: string, token: string) =>
    fetchApi<any>(`/branch-submissions?storyId=${storyId}`, { token }),
  review: (id: string, data: any, token: string) =>
    fetchApi<any>(`/branch-submissions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
};

export { fetchApi };
