import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// ===== Types =====
export interface Profile {
  id: number;
  name: string;
  color: string;
}

export interface Problem {
  id: number;
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
  time_rating: 'excellent' | 'passing' | 'needs_improvement';
  created_at: string;
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
  list: () => api.get<Profile[]>('/profiles/').then(r => r.data),
};

export const problemsApi = {
  list: () => api.get<{ results: Problem[] }>('/problems/').then(r => r.data.results),
  get: (id: number) => api.get<Problem>(`/problems/${id}/`).then(r => r.data),
  solution: (id: number) => api.get<{ solution_code: string; solution_explanation: string }>(`/problems/${id}/solution/`).then(r => r.data),
};

export const submissionsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<{ results: Submission[] }>('/submissions/', { params }).then(r => r.data.results),
  create: (data: Partial<Submission>) => api.post<Submission>('/submissions/', data).then(r => r.data),
  stats: (userId?: number) =>
    api.get<Stats>('/submissions/stats/', { params: userId ? { user: userId } : {} }).then(r => r.data),
  compare: () => api.get<CompareItem[]>('/submissions/compare/').then(r => r.data),
};

export const notesApi = {
  get: (userId: number, problemId: number) =>
    api.get<{ results: Note[] }>('/notes/', { params: { user: userId, problem: problemId } }).then(r => r.data.results[0] || null),
  save: (data: { user: number; problem: number; content: string }) =>
    api.post<Note>('/notes/', data).then(r => r.data),
};

export default api;
