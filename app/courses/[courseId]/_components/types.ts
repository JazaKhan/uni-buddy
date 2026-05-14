export type MasteryPoint = { sessionNumber: number; date: string; mastery: number };

export type Outcome = {
  id: string;
  name: string;
  description: string | null;
  mastery: number;
  hasMastery: boolean;
};

export type Top10Outcome = {
  id: string;
  name: string;
  description: string | null;
  mastery: number | null;
  practiced: boolean;
};

export type TopicWithOutcomes = {
  id: string;
  name: string;
  questionCount: number;
  outcomes: Outcome[];
};

export type ExtractedQuestion = {
  content: string;
  answer: string | null;
  outcomeIds: string[];
  outcomeSummary: string;
  selected: boolean;
  showAnswer: boolean;
};

export type DocumentItem = {
  id: string;
  name: string;
  fileUrl: string;
  purpose: string;
  isActive: boolean;
  createdAt: string;
};
