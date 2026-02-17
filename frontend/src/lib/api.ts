import type {
  Story,
  StorySegment,
  Choice,
  ReaderProgress,
  CreateStoryDto,
  UpdateStoryDto,
  CreateSegmentDto,
  UpdateSegmentDto,
  CreateChoiceDto,
  UpdateChoiceDto,
} from '@aardvark/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
}

interface SegmentPosition {
  segmentId: string;
  x: number;
  y: number;
}

interface StoryStructure {
  segments: StorySegment[];
  choices: Choice[];
}

interface BranchSubmission {
  id: string;
  storyId: string;
  authorId: string;
  segmentData: { title: string; content: string };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

interface ReviewSubmissionDto {
  status: 'approved' | 'rejected';
  feedback?: string;
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
    throw new ApiError(
      error.message || `HTTP error ${response.status}`,
      response.status,
      error.error,
    );
  }

  return response.json();
}

// Stories API
export const storiesApi = {
  getBySlug: (slug: string) => fetchApi<Story>(`/stories/slug/${slug}`),
  getById: (id: string) => fetchApi<Story>(`/stories/${id}`),
  create: (data: CreateStoryDto, token: string) =>
    fetchApi<Story>('/stories', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: Partial<UpdateStoryDto>, token: string) =>
    fetchApi<Story>(`/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  publish: (id: string, token: string) =>
    fetchApi<Story>(`/stories/${id}/publish`, {
      method: 'POST',
      token,
    }),
};

// Segments API
export const segmentsApi = {
  getById: (id: string) => fetchApi<StorySegment>(`/segments/${id}`),
  getByStory: (storyId: string) => fetchApi<StorySegment[]>(`/segments/story/${storyId}`),
  getStructure: (storyId: string) => fetchApi<StoryStructure>(`/segments/story/${storyId}/structure`),
  create: (data: CreateSegmentDto, token: string) =>
    fetchApi<StorySegment>('/segments', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: Partial<UpdateSegmentDto>, token: string) =>
    fetchApi<StorySegment>(`/segments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  delete: (id: string, token: string) =>
    fetchApi<void>(`/segments/${id}`, {
      method: 'DELETE',
      token,
    }),
  updatePositions: (storyId: string, positions: SegmentPosition[], token: string) =>
    fetchApi<void>(`/segments/story/${storyId}/positions`, {
      method: 'PUT',
      body: JSON.stringify({ positions }),
      token,
    }),
};

// Choices API
export const choicesApi = {
  getBySegment: (segmentId: string) => fetchApi<Choice[]>(`/choices/segment/${segmentId}`),
  getAvailable: (segmentId: string) =>
    fetchApi<Choice[]>(`/choices/segment/${segmentId}/available`),
  recordChoice: (choiceId: string) =>
    fetchApi<void>(`/choices/${choiceId}/chosen`, { method: 'POST' }),
  create: (data: CreateChoiceDto, token: string) =>
    fetchApi<Choice>('/choices', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  update: (id: string, data: Partial<UpdateChoiceDto>, token: string) =>
    fetchApi<Choice>(`/choices/${id}`, {
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
    fetchApi<ReaderProgress>('/progress/start', {
      method: 'POST',
      body: JSON.stringify({ storyId }),
      token,
    }),
  get: (storyId: string, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}`, { token }),
  makeChoice: (storyId: string, choiceId: string, timeSpent: number, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}/choice`, {
      method: 'POST',
      body: JSON.stringify({ choiceId, timeSpent }),
      token,
    }),
  navigate: (storyId: string, segmentId: string, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}/navigate/${segmentId}`, {
      method: 'POST',
      token,
    }),
  reset: (storyId: string, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}/reset`, {
      method: 'POST',
      token,
    }),
  addBookmark: (storyId: string, segmentId: string, note: string, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}/bookmarks`, {
      method: 'POST',
      body: JSON.stringify({ segmentId, note }),
      token,
    }),
  removeBookmark: (storyId: string, segmentId: string, token: string) =>
    fetchApi<ReaderProgress>(`/progress/story/${storyId}/bookmarks/${segmentId}`, {
      method: 'DELETE',
      token,
    }),
};

// Branch Submissions API
export const branchSubmissionsApi = {
  getByStory: (storyId: string, token: string) =>
    fetchApi<BranchSubmission[]>(`/branch-submissions?storyId=${storyId}`, { token }),
  review: (id: string, data: ReviewSubmissionDto, token: string) =>
    fetchApi<BranchSubmission>(`/branch-submissions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
};

export { fetchApi };
