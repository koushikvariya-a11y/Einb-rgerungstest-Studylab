export type AnswerKey = 'a' | 'b' | 'c' | 'd';

export interface QuestionTranslation {
  text: string;
  options: Record<AnswerKey, string>;
  context?: string;
}

export interface Question {
  id: number;
  type: 'general' | 'state';
  page: number;
  text: string;
  options: Record<AnswerKey, string>;
  correctAnswer: AnswerKey;
  state?: string;
  translations?: {
    en?: QuestionTranslation;
  };
}

export interface Attempt {
  answer: AnswerKey;
  isCorrect: boolean;
  timestamp: string;
}

export type Attempts = Record<number, Attempt>;

export interface UserProfile {
  userId: string;
  selectedState: string;
  practiceIndex: number;
  updatedAt: string;
}

export type AppTab = 'dashboard' | 'practice' | 'exam' | 'guide';
