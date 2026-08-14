import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AnswerKey,
  GENERAL_QUESTIONS,
  IMAGE_BY_ID,
  Question,
  STATES,
  getQuestionLabel,
  getQuestionNumber,
  getStateQuestions,
} from "./data/question-data";
import { AppTab, Attempt, Attempts } from "./types";
import {
  auth,
  db,
  signInWithGoogle,
  logOut,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  getDocFromServer,
} from "firebase/firestore";
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  Sparkles,
  Layers,
  X,
  RefreshCw,
} from "lucide-react";

const ANSWER_KEYS: AnswerKey[] = ["a", "b", "c", "d"];
const DEFAULT_STATE = "Nordrhein-Westfalen";

interface PendingAttemptRecord {
  uid: string;
  questionId: number;
  answer: AnswerKey;
  isCorrect: boolean;
  timestamp: string;
}

function readStoredGuestState(): string {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const value =
    window.localStorage.getItem("trainer_guest_state") ||
    window.localStorage.getItem("trainer_selected_state");
  return value && STATES.includes(value as (typeof STATES)[number])
    ? value
    : DEFAULT_STATE;
}

function readStoredGuestAttempts(): Attempts {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      window.localStorage.getItem("trainer_guest_attempts") ||
      window.localStorage.getItem("trainer_quiz_attempts_v2");
    if (raw) return JSON.parse(raw) as Attempts;

    // Backward compatibility with previous legacy attempts format if present
    const legacyRaw = window.localStorage.getItem("trainer_quiz_attempts");
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) {
        const converted: Attempts = {};
        const keyMap: AnswerKey[] = ["a", "b", "c", "d"];
        legacy.forEach((item: any) => {
          if (item.questionId && typeof item.selectedIdx === "number") {
            const key = keyMap[item.selectedIdx] || "a";
            converted[item.questionId] = {
              answer: key,
              isCorrect: Boolean(item.isCorrect),
              timestamp: item.timestamp || new Date().toISOString(),
            };
          }
        });
        return converted;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function readStoredGuestPracticeIndex(): number {
  if (typeof window === "undefined") return 0;
  const val =
    window.localStorage.getItem("trainer_guest_practice_index") ||
    window.localStorage.getItem("trainer_practice_index");
  const parsed = Number(val);
  return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
}

function readStoredUserState(uid: string): string {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const value = window.localStorage.getItem(`trainer_user_${uid}_state`);
  return value && STATES.includes(value as (typeof STATES)[number])
    ? value
    : readStoredGuestState();
}

function readStoredUserAttempts(uid: string): Attempts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`trainer_user_${uid}_attempts`);
    if (raw) return JSON.parse(raw) as Attempts;
    return {};
  } catch {
    return {};
  }
}

function readStoredUserPracticeIndex(uid: string): number {
  if (typeof window === "undefined") return 0;
  const val = window.localStorage.getItem(`trainer_user_${uid}_practice_index`);
  const parsed = Number(val);
  return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
}

function getPendingUserQueue(uid: string): Record<number, PendingAttemptRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`trainer_user_${uid}_pending_queue`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const filtered: Record<number, PendingAttemptRecord> = {};
      Object.entries(parsed).forEach(([qIdStr, item]: [string, any]) => {
        if (item && item.uid === uid && item.questionId) {
          filtered[Number(qIdStr)] = item;
        }
      });
      return filtered;
    }
    return {};
  } catch {
    return {};
  }
}

function setPendingUserQueue(
  uid: string,
  queue: Record<number, PendingAttemptRecord>
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `trainer_user_${uid}_pending_queue`,
    JSON.stringify(queue)
  );
}

function scopeLabel(question: Question) {
  return question.type === "general" ? "Allgemein" : "Bundesland";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

interface HeaderProps {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  user: User | null;
  syncing: boolean;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

function Header({
  tab,
  setTab,
  selectedState,
  setSelectedState,
  user,
  syncing,
  onOpenAuthModal,
  onSignOut,
}: HeaderProps) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: "dashboard", label: "Übersicht" },
    { id: "practice", label: "Lernen" },
    { id: "exam", label: "Prüfung" },
    { id: "guide", label: "Info" },
  ];

  return (
    <header className="site-header" id="header-root">
      <div className="header-inner">
        <div className="header-left">
          <button
            id="brand-button"
            className="brand"
            onClick={() => setTab("dashboard")}
            aria-label="Zur Übersicht"
          >
            <span className="brand-mark" aria-hidden="true">
              DE<span />
            </span>
            <span className="brand-copy">
              <strong>Citizenship Study Lab</strong>
              <small>Einbürgerungstest · Deutsch + English</small>
            </span>
          </button>

          <label className="state-select" id="bundesland-selector">
            <span>Bundesland</span>
            <select
              id="bundesland-dropdown"
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value)}
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="header-right">
          <nav className="main-nav" id="main-navigation" aria-label="Hauptnavigation">
            {tabs.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="auth-bar" id="auth-status-bar">
            {user ? (
              <div className="auth-user-chip" id="user-profile-chip">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon size={14} />
                )}
                <span>{user.displayName?.split(" ")[0] || "User"}</span>
                {syncing ? (
                  <span className="sync-status syncing" title="Syncing with Firestore...">
                    <RefreshCw size={11} className="animate-spin" />
                  </span>
                ) : (
                  <span className="sync-status" title="Synced to Firestore">
                    <Cloud size={12} />
                  </span>
                )}
                <button
                  id="sign-out-btn"
                  className="auth-btn"
                  style={{ minHeight: "26px", padding: "0 6px", border: "1px solid var(--ink)" }}
                  onClick={onSignOut}
                  title="Sign Out"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <button
                id="sign-in-prompt-btn"
                className="auth-btn google"
                onClick={onOpenAuthModal}
              >
                <LogIn size={12} />
                <span>Sync Account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  id,
  label,
  value,
  note,
  color,
}: {
  id: string;
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <article
      id={id}
      className="metric-card"
      style={{ "--metric-color": color } as React.CSSProperties}
    >
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function DashboardView({
  attempts,
  studyQuestions,
  selectedState,
  onPractice,
  onStartExam,
  onOpenAuthModal,
  user,
}: {
  attempts: Attempts;
  studyQuestions: Question[];
  selectedState: string;
  onPractice: () => void;
  onStartExam: () => void;
  onOpenAuthModal: () => void;
  user: User | null;
}) {
  const attemptEntries = Object.entries(attempts);
  const correct = attemptEntries.filter(([, attempt]) => attempt.isCorrect).length;
  const accuracy = attemptEntries.length
    ? Math.round((correct / attemptEntries.length) * 100)
    : 0;
  const coverage = Math.round((attemptEntries.length / studyQuestions.length) * 100);
  const imageQuestions = studyQuestions.filter(
    (question) => IMAGE_BY_ID[question.id]
  ).length;
  const recent = attemptEntries
    .sort(([, a], [, b]) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 4);

  return (
    <div className="view-stack" id="dashboard-view">
      <section className="hero-panel" id="hero-banner">
        <div className="hero-copy">
          <span className="eyebrow">BAMF FRAGENKATALOG · STAND 07.05.2025</span>
          <h1>Prepare with the complete official question catalogue.</h1>
          <p>
            Study all 300 general questions and the state-specific questions for
            every German federal state, with original German wording, official
            answer choices, clear English support, and correctly placed visuals.
          </p>
          <div className="button-row">
            <button
              id="continue-learning-btn"
              className="button primary"
              onClick={onPractice}
            >
              Continue learning
            </button>
            <button
              id="start-exam-hero-btn"
              className="button secondary"
              onClick={onStartExam}
            >
              Start 33-question test
            </button>
          </div>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <span className="hero-circle" />
          <span className="hero-square" />
          <div className="hero-card">
            <b>{imageQuestions}</b>
            <span>image questions in your path</span>
          </div>
        </div>
      </section>

      {!user && (
        <div
          id="guest-sync-banner"
          className="panel"
          style={{
            background: "#fef3c7",
            borderColor: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sparkles size={20} color="#b45309" />
            <div>
              <strong style={{ fontSize: "12px", display: "block" }}>
                Guest Mode Active (Saving Locally)
              </strong>
              <span style={{ fontSize: "11px", color: "#78350f" }}>
                Sign in with Google to synchronize your answered questions and exam
                scores across all devices.
              </span>
            </div>
          </div>
          <button
            id="guest-banner-signin-btn"
            className="button warning"
            style={{ minHeight: "36px", padding: "0 14px", fontSize: "9px" }}
            onClick={onOpenAuthModal}
          >
            Sign in with Google
          </button>
        </div>
      )}

      <section className="metric-grid" id="stats-metric-grid" aria-label="Lernstatistik">
        <MetricCard
          id="metric-bearbeitet"
          label="BEARBEITET"
          value={`${attemptEntries.length}`}
          note={`von ${studyQuestions.length} Fragen`}
          color="#1d4ed8"
        />
        <MetricCard
          id="metric-richtig"
          label="RICHTIG"
          value={`${accuracy}%`}
          note={`${correct} richtige Antworten`}
          color="#16a34a"
        />
        <MetricCard
          id="metric-abdeckung"
          label="ABDECKUNG"
          value={`${coverage}%`}
          note="deines Fragenkatalogs"
          color="#f4b400"
        />
        <MetricCard
          id="metric-bildfragen"
          label="BILD-FRAGEN"
          value={`${imageQuestions}`}
          note="11 allgemein + 2 im Bundesland"
          color="#dc2626"
        />
      </section>

      <section className="content-grid" id="dashboard-content-grid">
        <article className="panel panel-large" id="image-mapping-info-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow blue">CORRECTLY MAPPED</span>
              <h2>All 43 official image questions are connected</h2>
            </div>
            <span className="count-badge">43 / 43</span>
          </div>
          <p className="muted">
            The national catalogue has 11 visual questions. Each of the 16
            federal-state sections has two more: the coat of arms question and
            the state-map question. The app resolves the right pair after you
            choose your Bundesland.
          </p>
          <div className="mapping-strip">
            <span>National · 11</span>
            <span>State · 2 × 16</span>
            <span>Workbook match · exact</span>
          </div>
        </article>

        <article className="panel recent-panel" id="recent-answers-panel">
          <div className="section-heading compact">
            <h2>Recent answers</h2>
            <span>{attemptEntries.length}</span>
          </div>
          {recent.length ? (
            <ul className="recent-list" id="recent-answers-list">
              {recent.map(([id, attempt]) => {
                const question = studyQuestions.find(
                  (item) => item.id === Number(id)
                );
                if (!question) return null;
                return (
                  <li key={id} id={`recent-item-${id}`}>
                    <span
                      className={
                        attempt.isCorrect
                          ? "status-dot correct"
                          : "status-dot wrong"
                      }
                    />
                    <div>
                      <b>{getQuestionLabel(question)}</b>
                      <small>{question.text}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state" id="recent-empty-state">
              Your answers will appear here after the first question.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function ImagePanel({
  question,
  onExpand,
}: {
  question: Question;
  onExpand: (src: string) => void;
}) {
  const image = IMAGE_BY_ID[question.id];
  if (!image) return null;

  return (
    <figure className="question-image-card" id={`image-panel-${question.id}`}>
      <div className="image-card-heading">
        <span>Abbildung zur Frage</span>
        <button
          id={`expand-btn-${question.id}`}
          onClick={() => onExpand(image)}
        >
          Vergrößern
        </button>
      </div>
      <button
        id={`image-click-btn-${question.id}`}
        className="question-image-button"
        onClick={() => onExpand(image)}
        aria-label="Abbildung vergrößern"
      >
        <img
          src={image}
          alt={`Offizielle Abbildung für ${getQuestionLabel(question)}`}
          loading="lazy"
        />
      </button>
      <figcaption>Tap or click the image to inspect it at full size.</figcaption>
    </figure>
  );
}

interface QuestionCardProps {
  key?: React.Key;
  question: Question;
  selectedAnswer?: AnswerKey;
  onAnswer: (answer: AnswerKey) => void;
  onExpandImage: (src: string) => void;
  revealResult?: boolean;
  showTranslation?: boolean;
}

function QuestionCard({
  question,
  selectedAnswer,
  onAnswer,
  onExpandImage,
  revealResult = true,
  showTranslation = true,
}: QuestionCardProps) {
  const translation = question.translations?.en;
  const answered = Boolean(selectedAnswer);

  return (
    <article className="question-card" id={`question-card-${question.id}`}>
      <div className="question-meta">
        <span
          className={
            question.type === "general" ? "scope general" : "scope state"
          }
        >
          {scopeLabel(question)}
        </span>
        <span>{getQuestionLabel(question)}</span>
        {IMAGE_BY_ID[question.id] && <span className="image-pill">Bildfrage</span>}
      </div>

      <div className={`bilingual-question ${showTranslation ? "" : "single"}`}>
        <div>
          <small>DEUTSCH · ORIGINAL</small>
          <h2>{question.text}</h2>
        </div>
        {showTranslation && (
          <div className="translation-card">
            <small>ENGLISH · STUDY SUPPORT</small>
            <p>
              {translation?.text ??
                "English translation is not available for this question."}
            </p>
          </div>
        )}
      </div>

      <ImagePanel question={question} onExpand={onExpandImage} />

      <div
        className="answer-grid"
        role="group"
        aria-label="Antwortmöglichkeiten"
        id={`answer-options-${question.id}`}
      >
        {ANSWER_KEYS.map((key, index) => {
          const isSelected = selectedAnswer === key;
          const isCorrect = question.correctAnswer === key;
          const showCorrect = revealResult && answered && isCorrect;
          const showWrong = revealResult && isSelected && !isCorrect;
          return (
            <button
              key={key}
              id={`option-${question.id}-${key}`}
              className={`answer-option ${isSelected ? "selected" : ""} ${
                showCorrect ? "correct" : ""
              } ${showWrong ? "wrong" : ""}`}
              onClick={() => onAnswer(key)}
              aria-pressed={isSelected}
            >
              <span className="answer-key">{index + 1}</span>
              <span className="answer-copy">
                <b>{question.options[key]}</b>
                {showTranslation && <small>{translation?.options[key]}</small>}
              </span>
              {showCorrect && <span className="answer-state">✓</span>}
              {showWrong && <span className="answer-state">×</span>}
            </button>
          );
        })}
      </div>

      {revealResult && answered && (
        <div
          id={`result-feedback-${question.id}`}
          className={
            selectedAnswer === question.correctAnswer
              ? "result-note correct"
              : "result-note wrong"
          }
          role="status"
        >
          <strong>
            {selectedAnswer === question.correctAnswer
              ? "Richtig"
              : "Noch nicht richtig"}
          </strong>
          <span>
            {selectedAnswer === question.correctAnswer
              ? translation?.context ?? "Correct answer selected."
              : `The correct answer is ${
                  ANSWER_KEYS.indexOf(question.correctAnswer) + 1
                }: ${question.options[question.correctAnswer]}`}
          </span>
        </div>
      )}
    </article>
  );
}

function PracticeView({
  questions,
  attempts,
  onSaveAttempt,
  practiceIndex,
  onPracticeIndexChange,
}: {
  questions: Question[];
  attempts: Attempts;
  onSaveAttempt: (questionId: number, answer: AnswerKey, isCorrect: boolean) => void;
  practiceIndex: number;
  onPracticeIndexChange: (idx: number) => void;
}) {
  const [jump, setJump] = useState("1");
  const [imageOnly, setImageOnly] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const activeList = imageOnly
    ? questions.filter((question) => IMAGE_BY_ID[question.id])
    : questions;
  const activeIndex = Math.min(
    practiceIndex,
    Math.max(0, activeList.length - 1)
  );
  const question = activeList[activeIndex];

  useEffect(() => {
    setJump(String(activeIndex + 1));
  }, [activeIndex]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (["1", "2", "3", "4"].includes(event.key) && question) {
        const answer = ANSWER_KEYS[Number(event.key) - 1];
        onSaveAttempt(question.id, answer, answer === question.correctAnswer);
      }
      if (event.key === "ArrowRight") {
        const next = Math.min(activeList.length - 1, activeIndex + 1);
        onPracticeIndexChange(next);
      }
      if (event.key === "ArrowLeft") {
        const prev = Math.max(0, activeIndex - 1);
        onPracticeIndexChange(prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeList.length, activeIndex, question, onSaveAttempt, onPracticeIndexChange]);

  const handleAnswer = (answer: AnswerKey) => {
    if (!question) return;
    onSaveAttempt(question.id, answer, answer === question.correctAnswer);
  };

  const move = (next: number) => {
    const safe = Math.max(0, Math.min(activeList.length - 1, next));
    onPracticeIndexChange(safe);
    setJump(String(safe + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!question) return null;

  return (
    <div className="view-stack" id="practice-view">
      <section className="practice-toolbar panel" id="practice-toolbar">
        <div>
          <span className="eyebrow red">ACTIVE STUDY MODE</span>
          <h1>{imageOnly ? "Image questions" : "Bilingual question trainer"}</h1>
          <p>
            {imageOnly
              ? `${activeList.length} visual questions for the selected study path`
              : "300 general + 10 state questions"}
          </p>
        </div>
        <div className="toolbar-controls">
          <button
            id="filter-image-toggle"
            className={imageOnly ? "filter-button active" : "filter-button"}
            onClick={() => {
              setImageOnly((value) => !value);
              onPracticeIndexChange(0);
            }}
          >
            {imageOnly ? "Show all questions" : "Only image questions"}
          </button>
          <label className="jump-control" id="question-jump-control">
            <span>Go to</span>
            <input
              id="jump-input"
              inputMode="numeric"
              value={jump}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");
                setJump(value);
                const parsed = Number(value);
                if (parsed >= 1 && parsed <= activeList.length) {
                  onPracticeIndexChange(parsed - 1);
                }
              }}
              onBlur={() => setJump(String(activeIndex + 1))}
              aria-label="Question position"
            />
            <b>/ {activeList.length}</b>
          </label>
        </div>
      </section>

      <div
        className="progress-track"
        id="practice-progress-bar"
        aria-label={`Question ${activeIndex + 1} of ${activeList.length}`}
      >
        <span
          style={{
            width: `${((activeIndex + 1) / activeList.length) * 100}%`,
          }}
        />
      </div>

      <QuestionCard
        key={question.id}
        question={question}
        selectedAnswer={attempts[question.id]?.answer}
        onAnswer={handleAnswer}
        onExpandImage={setExpandedImage}
      />

      <div className="question-navigation" id="practice-navigation">
        <button
          id="practice-prev-btn"
          className="button secondary"
          disabled={activeIndex === 0}
          onClick={() => move(activeIndex - 1)}
        >
          ← Previous
        </button>
        <span>
          {activeIndex + 1} / {activeList.length}
        </span>
        <button
          id="practice-next-btn"
          className="button primary"
          disabled={activeIndex === activeList.length - 1}
          onClick={() => move(activeIndex + 1)}
        >
          Next →
        </button>
      </div>

      {expandedImage && (
        <div
          id="practice-lightbox"
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößerte Abbildung"
          onClick={() => setExpandedImage(null)}
        >
          <button
            id="lightbox-close-btn"
            className="lightbox-close"
            onClick={() => setExpandedImage(null)}
          >
            Close ×
          </button>
          <img
            src={expandedImage}
            alt={`Vergrößerte Abbildung für ${getQuestionLabel(question)}`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function ExamIntro({
  selectedState,
  onStart,
}: {
  selectedState: string;
  onStart: () => void;
}) {
  return (
    <section className="exam-intro panel" id="exam-intro-screen">
      <span className="eyebrow red">REALISTIC MOCK TEST</span>
      <h1>33 questions. One clean run.</h1>
      <p>
        The simulation draws 30 general questions and 3 questions for{" "}
        {selectedState}. English support and answer feedback stay hidden until
        submission, while question images remain visible exactly when required.
      </p>
      <div className="exam-facts">
        <span>
          <b>33</b> questions
        </span>
        <span>
          <b>60</b> minutes
        </span>
        <span>
          <b>17</b> to pass
        </span>
      </div>
      <button
        id="begin-mock-exam-btn"
        className="button danger"
        onClick={onStart}
      >
        Begin mock exam
      </button>
    </section>
  );
}

function ExamView({
  questions,
  selectedState,
  onStart,
  onSaveExamAttempts,
}: {
  questions: Question[];
  selectedState: string;
  onStart: () => void;
  onSaveExamAttempts: (answers: Record<number, AnswerKey>) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerKey>>({});
  const [finished, setFinished] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    setIndex(0);
    setAnswers({});
    setFinished(false);
  }, [questions]);

  if (!questions.length)
    return <ExamIntro selectedState={selectedState} onStart={onStart} />;

  const score = questions.filter(
    (question) => answers[question.id] === question.correctAnswer
  ).length;
  const answeredCount = Object.keys(answers).length;
  const activeQuestion = questions[index];

  if (finished) {
    const passed = score >= 17;
    const missed = questions.filter(
      (question) => answers[question.id] !== question.correctAnswer
    );
    return (
      <div className="view-stack" id="exam-results-view">
        <section
          id="score-result-panel"
          className={`score-panel panel ${passed ? "passed" : "failed"}`}
        >
          <span className="eyebrow">RESULT</span>
          <div className="score-number">
            {score}
            <small>/ 33</small>
          </div>
          <h1>
            {passed
              ? "Passed — this run cleared the threshold."
              : "Not passed yet — review the missed set."}
          </h1>
          <p>
            {passed
              ? "You reached the required 17 correct answers."
              : `You need ${Math.max(
                  0,
                  17 - score
                )} more correct answers to reach 17.`}
          </p>
          <div className="button-row">
            <button
              id="retake-exam-btn"
              className="button primary"
              onClick={onStart}
            >
              Start another test
            </button>
            <button
              id="review-exam-btn"
              className="button secondary"
              onClick={() => {
                setFinished(false);
                setIndex(0);
              }}
            >
              Review this attempt
            </button>
          </div>
        </section>

        {missed.length > 0 && (
          <section className="panel missed-panel" id="missed-questions-panel">
            <div className="section-heading compact">
              <h2>Questions to review</h2>
              <span>{missed.length}</span>
            </div>
            <div className="missed-grid" id="missed-questions-grid">
              {missed.map((question) => (
                <button
                  key={question.id}
                  id={`missed-q-${question.id}`}
                  onClick={() => {
                    setFinished(false);
                    setIndex(
                      questions.findIndex((item) => item.id === question.id)
                    );
                  }}
                >
                  <b>{getQuestionLabel(question)}</b>
                  <span>{question.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="view-stack" id="exam-active-view">
      <section className="exam-toolbar panel" id="exam-toolbar">
        <div>
          <span className="eyebrow red">EXAM MODE · DEUTSCH ONLY</span>
          <h1>Question {index + 1} of 33</h1>
        </div>
        <div className="exam-counter" id="exam-answered-counter">
          <b>{answeredCount}</b>
          <span>answered</span>
        </div>
      </section>

      <div
        className="exam-map"
        id="exam-questions-map"
        aria-label="Exam question navigation"
      >
        {questions.map((question, questionIndex) => (
          <button
            key={question.id}
            id={`exam-map-q-${questionIndex + 1}`}
            className={`${questionIndex === index ? "active" : ""} ${
              answers[question.id] ? "answered" : ""
            }`}
            onClick={() => setIndex(questionIndex)}
            aria-label={`Question ${questionIndex + 1}${
              answers[question.id] ? ", answered" : ""
            }`}
          >
            {questionIndex + 1}
          </button>
        ))}
      </div>

      <QuestionCard
        key={activeQuestion.id}
        question={activeQuestion}
        selectedAnswer={answers[activeQuestion.id]}
        onAnswer={(answer) =>
          setAnswers((current) => ({
            ...current,
            [activeQuestion.id]: answer,
          }))
        }
        onExpandImage={setExpandedImage}
        revealResult={false}
        showTranslation={false}
      />

      <div className="question-navigation" id="exam-navigation">
        <button
          id="exam-prev-btn"
          className="button secondary"
          disabled={index === 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        >
          ← Previous
        </button>
        <span>{answeredCount} / 33 answered</span>
        {index < questions.length - 1 ? (
          <button
            id="exam-next-btn"
            className="button primary"
            onClick={() =>
              setIndex((current) => Math.min(questions.length - 1, current + 1))
            }
          >
            Next →
          </button>
        ) : (
          <button
            id="exam-submit-btn"
            className="button danger"
            disabled={answeredCount !== questions.length}
            onClick={() => {
              onSaveExamAttempts(answers);
              setFinished(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Submit test
          </button>
        )}
      </div>

      {answeredCount === questions.length && index < questions.length - 1 && (
        <div className="submit-banner panel" id="exam-submit-banner">
          <span>All 33 questions are answered.</span>
          <button
            id="exam-submit-early-btn"
            className="button danger"
            onClick={() => {
              onSaveExamAttempts(answers);
              setFinished(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Submit and score
          </button>
        </div>
      )}

      {expandedImage && (
        <div
          id="exam-lightbox"
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößerte Abbildung"
          onClick={() => setExpandedImage(null)}
        >
          <button
            id="exam-lightbox-close"
            className="lightbox-close"
            onClick={() => setExpandedImage(null)}
          >
            Close ×
          </button>
          <img
            src={expandedImage}
            alt={`Vergrößerte Abbildung für ${getQuestionLabel(activeQuestion)}`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function GuideView() {
  return (
    <div className="guide-grid" id="guide-view">
      <section className="panel guide-main" id="guide-structure-panel">
        <span className="eyebrow blue">EXAM STRUCTURE</span>
        <h1>Leben in Deutschland / Einbürgerungstest</h1>
        <p>
          The official test sheet contains 33 multiple-choice questions: 30
          national questions and 3 from your selected federal state.
        </p>
        <div className="guide-steps" id="guide-steps-list">
          <div>
            <b>01</b>
            <span>
              <strong>Prepare 310 questions</strong>
              <small>300 national + 10 for your Bundesland.</small>
            </span>
          </div>
          <div>
            <b>02</b>
            <span>
              <strong>Choose one answer</strong>
              <small>
                Every question has four choices and exactly one correct answer.
              </small>
            </span>
          </div>
          <div>
            <b>03</b>
            <span>
              <strong>Reach at least 17/33</strong>
              <small>
                That is the passing threshold for the citizenship test.
              </small>
            </span>
          </div>
        </div>
      </section>
      <aside className="panel source-panel" id="guide-source-panel">
        <span className="eyebrow red">SOURCE CONTROL</span>
        <h2>Image mapping</h2>
        <p>
          43 visual entries were extracted from the official catalogue and
          matched by section plus task number.
        </p>
        <ul>
          <li>11 national image questions</li>
          <li>32 state image questions</li>
          <li>No headers, answer boxes, or decorative page art</li>
        </ul>
        <a
          id="bamf-catalogue-link"
          href="https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.html"
          target="_blank"
          rel="noreferrer"
        >
          Open the official BAMF catalogue ↗
        </a>
      </aside>
    </div>
  );
}

function AuthModal({
  isOpen,
  onClose,
  onSignIn,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      id="auth-modal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card"
        id="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow blue">FIREBASE CLOUD SYNC</span>
            <h3>Sync Your Progress</h3>
          </div>
          <button
            id="auth-modal-close-btn"
            className="auth-btn"
            style={{ minHeight: "32px", padding: "0 8px" }}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <p>
          Sign in with Google to synchronize your answers, state preference, and
          test attempts across devices with your own secure Firestore account.
        </p>
        <div className="modal-actions">
          <button
            id="google-signin-btn"
            className="button primary"
            style={{ width: "100%" }}
            onClick={onSignIn}
          >
            <LogIn size={14} /> Sign in with Google
          </button>
          <button
            id="continue-guest-btn"
            className="button secondary"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Continue as Guest (Local Only)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<AppTab>("dashboard");
  const [selectedState, setSelectedState] = useState<string>(readStoredGuestState);
  const [attempts, setAttempts] = useState<Attempts>(readStoredGuestAttempts);
  const [practiceIndex, setPracticeIndex] = useState<number>(
    readStoredGuestPracticeIndex
  );
  const [hydrated, setHydrated] = useState(false);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);

  // Firebase Auth & Cloud Sync state
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Firestore connection health check on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "connection-test", "ping"));
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("the client is offline")
        ) {
          console.warn(
            "Firebase client is currently offline. Local fallback active."
          );
        }
      }
    }
    testConnection();
  }, []);

  // Stabilize local values with refs to prevent stale closure loops during async auth events
  const userRef = useRef<User | null>(user);
  const selectedStateRef = useRef(selectedState);
  const attemptsRef = useRef(attempts);
  const practiceIndexRef = useRef(practiceIndex);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedStateRef.current = selectedState;
  }, [selectedState]);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  useEffect(() => {
    practiceIndexRef.current = practiceIndex;
  }, [practiceIndex]);

  // Initial localStorage hydration (guest baseline)
  useEffect(() => {
    setSelectedState(readStoredGuestState());
    setAttempts(readStoredGuestAttempts());
    setPracticeIndex(readStoredGuestPracticeIndex());
    setHydrated(true);
  }, []);

  // Local storage persistence: Strictly isolated by Firebase UID or guest
  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      window.localStorage.setItem(`trainer_user_${user.uid}_state`, selectedState);
    } else {
      window.localStorage.setItem("trainer_guest_state", selectedState);
    }
  }, [hydrated, selectedState, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      window.localStorage.setItem(
        `trainer_user_${user.uid}_attempts`,
        JSON.stringify(attempts)
      );
    } else {
      window.localStorage.setItem(
        "trainer_guest_attempts",
        JSON.stringify(attempts)
      );
    }
  }, [hydrated, attempts, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      window.localStorage.setItem(
        `trainer_user_${user.uid}_practice_index`,
        String(practiceIndex)
      );
    } else {
      window.localStorage.setItem(
        "trainer_guest_practice_index",
        String(practiceIndex)
      );
    }
  }, [hydrated, practiceIndex, user]);

  // Firebase Auth state listener and initial Firestore data migration & sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setSyncing(true);
        try {
          const userId = currentUser.uid;
          
          // Check if guest progress has unmigrated attempts that should be claimed by the first logged-in user
          const guestAttempts = readStoredGuestAttempts();
          const guestState = readStoredGuestState();
          const guestPracticeIdx = readStoredGuestPracticeIndex();
          const isGuestMigrated = window.localStorage.getItem("trainer_guest_migrated") === "true";

          let localState = readStoredUserState(userId);
          let localPracticeIdx = readStoredUserPracticeIndex(userId);
          let localAttempts = readStoredUserAttempts(userId);

          // If this user has no local attempts yet and guest has unmigrated attempts, migrate guest -> this user
          if (Object.keys(localAttempts).length === 0 && Object.keys(guestAttempts).length > 0 && !isGuestMigrated) {
            localAttempts = { ...guestAttempts };
            localState = guestState;
            localPracticeIdx = guestPracticeIdx;
            // Mark guest as migrated and clear guest attempts to prevent cross-account contamination
            window.localStorage.setItem("trainer_guest_migrated", "true");
            window.localStorage.removeItem("trainer_guest_attempts");
          }

          // 1. Fetch Cloud Profile
          const profileRef = doc(db, "users", userId);
          const profileSnap = await getDoc(profileRef);

          let cloudState = localState;
          let cloudPracticeIdx = localPracticeIdx;

          if (profileSnap.exists()) {
            const data = profileSnap.data();
            cloudState = data.selectedState || localState;
            cloudPracticeIdx =
              typeof data.practiceIndex === "number"
                ? data.practiceIndex
                : localPracticeIdx;
            setSelectedState(cloudState);
            setPracticeIndex(cloudPracticeIdx);
          } else {
            // New cloud account: Migrate local profile baseline to Firestore
            await setDoc(profileRef, {
              userId,
              selectedState: localState,
              practiceIndex: localPracticeIdx,
              updatedAt: new Date().toISOString(),
            });
            setSelectedState(localState);
            setPracticeIndex(localPracticeIdx);
          }

          // 2. Fetch Cloud Attempts
          const attemptsColRef = collection(db, "users", userId, "attempts");
          const attemptsSnap = await getDocs(attemptsColRef);
          const cloudAttempts: Record<number, Attempt> = {};

          attemptsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.questionId && data.answer) {
              cloudAttempts[data.questionId] = {
                answer: data.answer as AnswerKey,
                isCorrect: Boolean(data.isCorrect),
                timestamp: data.timestamp || new Date().toISOString(),
              };
            }
          });

          // 3. Bidirectional migration & offline queue processing:
          // Check local attempts and pending queue for newer items to upload to Firestore
          const pendingQueue = getPendingUserQueue(userId);
          const attemptsToCloud: { qId: number; item: Attempt }[] = [];

          // Compare local attempts against cloud attempts
          (Object.entries(localAttempts) as [string, Attempt][]).forEach(([idStr, localItem]) => {
            const qId = Number(idStr);
            const cloudItem = cloudAttempts[qId];
            if (
              !cloudItem ||
              new Date(localItem.timestamp) > new Date(cloudItem.timestamp)
            ) {
              attemptsToCloud.push({ qId, item: localItem });
            }
          });

          // Also include any explicitly queued pending attempts
          Object.values(pendingQueue).forEach((pendingItem) => {
            if (pendingItem.uid === userId) {
              const alreadyListed = attemptsToCloud.some(
                (a) => a.qId === pendingItem.questionId
              );
              if (!alreadyListed) {
                attemptsToCloud.push({
                  qId: pendingItem.questionId,
                  item: {
                    answer: pendingItem.answer,
                    isCorrect: pendingItem.isCorrect,
                    timestamp: pendingItem.timestamp,
                  },
                });
              }
            }
          });

          if (attemptsToCloud.length > 0) {
            for (const { qId, item } of attemptsToCloud) {
              const attemptRef = doc(db, "users", userId, "attempts", `q${qId}`);
              await setDoc(attemptRef, {
                questionId: qId,
                answer: item.answer,
                isCorrect: item.isCorrect,
                timestamp: item.timestamp,
              });
              delete pendingQueue[qId];
            }
            setPendingUserQueue(userId, pendingQueue);
          }

          // Merge local and cloud attempts (taking the latest timestamp for each question)
          const merged: Attempts = { ...localAttempts };
          (Object.entries(cloudAttempts) as [string, Attempt][]).forEach(([idStr, cloudItem]) => {
            const qId = Number(idStr);
            const local = merged[qId];
            if (
              !local ||
              new Date(cloudItem.timestamp) > new Date(local.timestamp)
            ) {
              merged[qId] = cloudItem;
            }
          });

          window.localStorage.setItem(
            `trainer_user_${userId}_attempts`,
            JSON.stringify(merged)
          );
          setAttempts(merged);
        } catch (error) {
          console.error("Firestore sync error:", error);
        } finally {
          setSyncing(false);
        }
      } else {
        // User logged out: switch safely to guest storage
        setSelectedState(readStoredGuestState());
        setAttempts(readStoredGuestAttempts());
        setPracticeIndex(readStoredGuestPracticeIndex());
      }
    });

    return () => unsubscribe();
  }, []);

  // Automatic recovery and sync when internet connectivity returns
  useEffect(() => {
    const handleOnline = async () => {
      if (!user) return;
      setSyncing(true);
      try {
        const queue = getPendingUserQueue(user.uid);
        const entries = Object.entries(queue) as [string, PendingAttemptRecord][];
        if (entries.length > 0) {
          for (const [idStr, item] of entries) {
            if (item.uid === user.uid) {
              const qId = Number(idStr);
              const attemptRef = doc(db, "users", user.uid, "attempts", `q${qId}`);
              await setDoc(attemptRef, {
                questionId: qId,
                answer: item.answer,
                isCorrect: item.isCorrect,
                timestamp: item.timestamp,
              });
              const freshQueue = getPendingUserQueue(user.uid);
              delete freshQueue[qId];
              setPendingUserQueue(user.uid, freshQueue);
            }
          }
        }
        const profileRef = doc(db, "users", user.uid);
        await setDoc(
          profileRef,
          {
            userId: user.uid,
            selectedState: selectedStateRef.current,
            practiceIndex: practiceIndexRef.current,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Online reconnect sync attempted:", err);
      } finally {
        setSyncing(false);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user]);

  // Debounced cloud profile update when user changes state or practice position
  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(async () => {
      try {
        const profileRef = doc(db, "users", user.uid);
        await setDoc(
          profileRef,
          {
            userId: user.uid,
            selectedState,
            practiceIndex,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to update profile to Firestore:", error);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, selectedState, practiceIndex]);

  // Record an attempt (both local and cloud)
  const saveAttempt = async (
    questionId: number,
    answer: AnswerKey,
    isCorrect: boolean
  ) => {
    const timestamp = new Date().toISOString();
    const newAttempt: Attempt = { answer, isCorrect, timestamp };

    // Update local state immediately
    setAttempts((current) => {
      const updated = {
        ...current,
        [questionId]: newAttempt,
      };
      if (user) {
        window.localStorage.setItem(
          `trainer_user_${user.uid}_attempts`,
          JSON.stringify(updated)
        );
      } else {
        window.localStorage.setItem(
          "trainer_guest_attempts",
          JSON.stringify(updated)
        );
      }
      return updated;
    });

    // If signed in, queue attempt with owning Firebase UID and sync immediately to Firestore
    if (user) {
      const queue = getPendingUserQueue(user.uid);
      queue[questionId] = {
        uid: user.uid,
        questionId,
        answer,
        isCorrect,
        timestamp,
      };
      setPendingUserQueue(user.uid, queue);

      try {
        const attemptRef = doc(
          db,
          "users",
          user.uid,
          "attempts",
          `q${questionId}`
        );
        await setDoc(attemptRef, {
          questionId,
          answer,
          isCorrect,
          timestamp,
        });
        const currentQueue = getPendingUserQueue(user.uid);
        delete currentQueue[questionId];
        setPendingUserQueue(user.uid, currentQueue);
      } catch (error) {
        console.warn("Saved attempt locally to pending queue (will sync when online):", error);
      }
    }
  };

  const stateQuestions = useMemo(
    () => getStateQuestions(selectedState),
    [selectedState]
  );
  const studyQuestions = useMemo(
    () => [...GENERAL_QUESTIONS, ...stateQuestions],
    [stateQuestions]
  );

  const startExam = () => {
    setExamQuestions([
      ...shuffle(GENERAL_QUESTIONS).slice(0, 30),
      ...shuffle(stateQuestions).slice(0, 3),
    ]);
    setTab("exam");
  };

  const saveExamAttempts = async (answers: Record<number, AnswerKey>) => {
    const timestamp = new Date().toISOString();
    const nextAttempts: Attempts = { ...attempts };
    const newAttemptEntries: { qId: number; item: Attempt }[] = [];

    for (const question of examQuestions) {
      const answer = answers[question.id];
      if (answer) {
        const isCorrect = answer === question.correctAnswer;
        const attemptItem: Attempt = { answer, isCorrect, timestamp };
        nextAttempts[question.id] = attemptItem;
        newAttemptEntries.push({ qId: question.id, item: attemptItem });
      }
    }

    setAttempts(nextAttempts);

    if (user) {
      window.localStorage.setItem(
        `trainer_user_${user.uid}_attempts`,
        JSON.stringify(nextAttempts)
      );

      const queue = getPendingUserQueue(user.uid);
      newAttemptEntries.forEach(({ qId, item }) => {
        queue[qId] = {
          uid: user.uid,
          questionId: qId,
          answer: item.answer,
          isCorrect: item.isCorrect,
          timestamp: item.timestamp,
        };
      });
      setPendingUserQueue(user.uid, queue);

      for (const { qId, item } of newAttemptEntries) {
        try {
          const attemptRef = doc(
            db,
            "users",
            user.uid,
            "attempts",
            `q${qId}`
          );
          await setDoc(attemptRef, {
            questionId: qId,
            answer: item.answer,
            isCorrect: item.isCorrect,
            timestamp: item.timestamp,
          });
          const currentQueue = getPendingUserQueue(user.uid);
          delete currentQueue[qId];
          setPendingUserQueue(user.uid, currentQueue);
        } catch (error) {
          console.warn(`Exam attempt for q${qId} queued for sync:`, error);
        }
      }
    } else {
      window.localStorage.setItem(
        "trainer_guest_attempts",
        JSON.stringify(nextAttempts)
      );
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setAuthModalOpen(false);
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  return (
    <div className="app-shell" id="app-container">
      <Header
        tab={tab}
        setTab={setTab}
        selectedState={selectedState}
        setSelectedState={setSelectedState}
        user={user}
        syncing={syncing}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <main className="main-content" id="main-view-container">
        {tab === "dashboard" && (
          <DashboardView
            attempts={attempts}
            studyQuestions={studyQuestions}
            selectedState={selectedState}
            onPractice={() => setTab("practice")}
            onStartExam={startExam}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            user={user}
          />
        )}
        {tab === "practice" && (
          <PracticeView
            questions={studyQuestions}
            attempts={attempts}
            onSaveAttempt={saveAttempt}
            practiceIndex={practiceIndex}
            onPracticeIndexChange={setPracticeIndex}
          />
        )}
        {tab === "exam" && (
          <ExamView
            questions={examQuestions}
            selectedState={selectedState}
            onStart={startExam}
            onSaveExamAttempts={saveExamAttempts}
          />
        )}
        {tab === "guide" && <GuideView />}
      </main>

      <footer className="site-footer" id="app-footer">
        <span>Citizenship Study Lab · Einbürgerungstest</span>
        <span>
          Questions based on the BAMF catalogue · Images mapped from the
          official workbook
        </span>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={handleSignIn}
      />

      <span className="sr-only" aria-live="polite">
        {examQuestions.length ? "Mock exam prepared" : ""}
      </span>
    </div>
  );
}
