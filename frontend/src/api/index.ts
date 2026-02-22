import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
}

const toRelativeUrl = (url: string) => {
  try {
    const parsed = new URL(url, 'http://localhost');
    const pathname = parsed.pathname.startsWith('/api/')
      ? parsed.pathname.replace(/^\/api/, '')
      : parsed.pathname;
    return `${pathname}${parsed.search}`;
  } catch {
    return url.replace(/^\/api/, '');
  }
};

async function fetchAllPages<T>(url: string, params?: Record<string, string | number>): Promise<T[]> {
  let nextUrl: string | null = url;
  let first = true;
  const all: T[] = [];

  while (nextUrl) {
    const response: { data: PaginatedResponse<T> | T[] } = await api.get<PaginatedResponse<T> | T[]>(nextUrl, {
      params: first ? params : undefined,
    });
    const data: PaginatedResponse<T> | T[] = response.data;
    if (Array.isArray(data)) {
      all.push(...data);
      break;
    }
    all.push(...data.results);
    nextUrl = data.next ? toRelativeUrl(data.next) : null;
    first = false;
  }
  return all;
}

// ===== Types =====
export interface Profile {
  id: number;
  name: string;
  color: string;
}

export interface Problem {
  id: number;
  hot100_order: number;
  number: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  description?: string;
  solution_code?: string;
  solution_explanation?: string;
  leetcode_url: string;
  time_standard: number;
}

export interface Submission {
  id: number;
  user: number;
  user_name: string;
  problem: number;
  problem_title: string;
  code: string;
  time_spent: number;
  is_passed: boolean;
  test_cases_total: number;
  test_cases_passed: number;
  feedback: string;
  ai_feedback: string;
  time_rating: 'excellent' | 'passing' | 'needs_improvement';
  created_at: string;
}

export interface SubmissionCreateResponse extends Submission {
  is_new_record: boolean;
  is_first_pass: boolean;
  is_record_break: boolean;
  previous_best: number | null;
}

export interface PersonalBestRecord {
  submission_id: number;
  time_spent: number;
  created_at: string;
}

export interface PersonalBest {
  has_record: boolean;
  best_time: number | null;
  submission_id?: number;
  created_at?: string;
  records: PersonalBestRecord[];
}

export interface PersonalBestsResponse {
  user: number;
  records: Array<{
    problem_id: number;
    best_time: number;
    solved_count: number;
  }>;
}

export interface Note {
  id: number;
  user: number;
  problem: number;
  content: string;
  updated_at: string;
}

export interface Stats {
  total_submissions: number;
  total_passed: number;
  pass_rate: number;
  avg_time_seconds: number;
  by_difficulty: Array<{
    problem__difficulty: string;
    count: number;
    passed_count: number;
    avg_time: number;
  }>;
  by_category: Array<{
    problem__category: string;
    count: number;
    passed_count: number;
    avg_time: number;
  }>;
  daily: Array<{ date: string; count: number }>;
}

export interface CompareItem {
  user_id: number;
  user_name: string;
  user_color: string;
  total_submissions: number;
  total_passed: number;
  pass_rate: number;
  unique_solved: number;
  by_difficulty: Record<string, { count: number; passed: number; avg_time: number }>;
}

// ===== API =====
export const profilesApi = {
  list: () => fetchAllPages<Profile>('/profiles/'),
  create: (data: { name: string; color: string }) => api.post<Profile>('/profiles/', data).then(r => r.data),
};

export const problemsApi = {
  list: () => fetchAllPages<Problem>('/problems/'),
  get: (id: number) => api.get<Problem>(`/problems/${id}/`).then(r => r.data),
  solution: (id: number) => api.get<{ solution_code: string; solution_explanation: string }>(`/problems/${id}/solution/`).then(r => r.data),
};

export const submissionsApi = {
  list: (params?: Record<string, string | number>) =>
    fetchAllPages<Submission>('/submissions/', params),
  create: (data: Partial<Submission>) =>
    api.post<SubmissionCreateResponse>('/submissions/', data).then(r => r.data),
  stats: (userId?: number) =>
    api.get<Stats>('/submissions/stats/', { params: userId ? { user: userId } : {} }).then(r => r.data),
  compare: () => api.get<CompareItem[]>('/submissions/compare/').then(r => r.data),
  personalBest: (userId: number, problemId: number) =>
    api.get<PersonalBest>('/submissions/personal_best/', { params: { user: userId, problem: problemId } }).then(r => r.data),
  personalBests: (userId: number) =>
    api.get<PersonalBestsResponse>('/submissions/personal_bests/', { params: { user: userId } }).then(r => r.data),
};

export const notesApi = {
  get: (userId: number, problemId: number) =>
    api.get<{ results: Note[] }>('/notes/', { params: { user: userId, problem: problemId } }).then(r => r.data.results[0] || null),
  save: (data: { user: number; problem: number; content: string }) =>
    api.post<Note>('/notes/', data).then(r => r.data),
};

export default api;
