import rawQuestions from "./data/questions.json";

export type AnswerKey = "a" | "b" | "c" | "d";

export type Question = {
  id: number;
  type: "general" | "state";
  page: number;
  text: string;
  options: Record<AnswerKey, string>;
  correctAnswer: AnswerKey;
  state?: string;
  translations?: {
    en?: {
      text: string;
      options: Record<AnswerKey, string>;
      context?: string;
    };
  };
};

export const QUESTIONS = rawQuestions as Question[];
export const GENERAL_QUESTIONS = QUESTIONS.filter((question) => question.type === "general");

export const STATES = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
] as const;

export const IMAGE_BY_ID: Record<number, string> = {
  21: "/question-images/general-21.png",
  55: "/question-images/general-55.png",
  70: "/question-images/general-70.png",
  130: "/question-images/general-130.png",
  176: "/question-images/general-176.png",
  181: "/question-images/general-181.png",
  187: "/question-images/general-187.png",
  209: "/question-images/general-209.png",
  216: "/question-images/general-216.png",
  226: "/question-images/general-226.png",
  235: "/question-images/general-235.png",
  301: "/question-images/baden-wurttemberg-1.png",
  308: "/question-images/baden-wurttemberg-8.png",
  311: "/question-images/bayern-1.png",
  318: "/question-images/bayern-8.png",
  321: "/question-images/berlin-1.png",
  328: "/question-images/berlin-8.png",
  331: "/question-images/brandenburg-1.png",
  338: "/question-images/brandenburg-8.png",
  341: "/question-images/bremen-1.png",
  348: "/question-images/bremen-8.png",
  351: "/question-images/hamburg-1.png",
  358: "/question-images/hamburg-8.png",
  361: "/question-images/hessen-1.png",
  368: "/question-images/hessen-8.png",
  371: "/question-images/mecklenburg-vorpommern-1.png",
  378: "/question-images/mecklenburg-vorpommern-8.png",
  381: "/question-images/niedersachsen-1.png",
  388: "/question-images/niedersachsen-8.png",
  391: "/question-images/nordrhein-westfalen-1.png",
  398: "/question-images/nordrhein-westfalen-8.png",
  401: "/question-images/rheinland-pfalz-1.png",
  408: "/question-images/rheinland-pfalz-8.png",
  411: "/question-images/saarland-1.png",
  418: "/question-images/saarland-8.png",
  421: "/question-images/sachsen-1.png",
  428: "/question-images/sachsen-8.png",
  431: "/question-images/sachsen-anhalt-1.png",
  438: "/question-images/sachsen-anhalt-8.png",
  441: "/question-images/schleswig-holstein-1.png",
  448: "/question-images/schleswig-holstein-8.png",
  451: "/question-images/thuringen-1.png",
  458: "/question-images/thuringen-8.png",
};

export function getStateQuestions(state: string) {
  return QUESTIONS.filter((question) => question.type === "state" && question.state === state);
}

export function getQuestionNumber(question: Question) {
  if (question.type === "general") return question.id;
  const stateQuestions = getStateQuestions(question.state ?? "");
  return stateQuestions.findIndex((item) => item.id === question.id) + 1;
}

export function getQuestionLabel(question: Question) {
  const number = getQuestionNumber(question);
  return question.type === "general"
    ? `Allgemeine Frage ${number}`
    : `${question.state} · Landesfrage ${number}`;
}
