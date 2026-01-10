export type QuestionType = 'MCQ' | 'MSQ' | 'FIB';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // for MCQ/MSQ
  correctAnswer?: number | number[] | string; // number for MCQ (index), number[] for MSQ (indices), string for FIB
}

export interface Exam {
  id: string;
  title: string;
  durationMinutes: number;
  questions: Question[];
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

export interface ExamSession {
  userId: string;
  examId: string;
  startTime: number;
  endTime?: number;
  answers: Record<string, number>;
  violations: Violation[];
  submitted: boolean;
  score?: number;
}

export interface Violation {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'REFRESH';
  timestamp: number;
}
