"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnswerKey,
  GENERAL_QUESTIONS,
  IMAGE_BY_ID,
  Question,
  STATES,
  getQuestionLabel,
  getQuestionNumber,
  getStateQuestions,
} from "./question-data";

type Tab = "dashboard" | "practice" | "exam" | "guide";
type Attempt = { answer: AnswerKey; correct: boolean; timestamp: string };
type Attempts = Record<number, Attempt>;

const ANSWER_KEYS: AnswerKey[] = ["a", "b", "c", "d"];
const DEFAULT_STATE = "Nordrhein-Westfalen";

function readStoredState() {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const value = window.localStorage.getItem("trainer_selected_state");
  return value && STATES.includes(value as (typeof STATES)[number]) ? value : DEFAULT_STATE;
}

function readAttempts(): Attempts {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("trainer_quiz_attempts_v2") ?? "{}") as Attempts;
  } catch {
    return {};
  }
}

function scopeLabel(question: Question) {
  return question.type === "general" ? "Allgemein" : "Bundesland";
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function Header({
  tab,
  setTab,
  selectedState,
  setSelectedState,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Übersicht" },
    { id: "practice", label: "Lernen" },
    { id: "exam", label: "Prüfung" },
    { id: "guide", label: "Info" },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => setTab("dashboard")} aria-label="Zur Übersicht">
          <span className="brand-mark" aria-hidden="true">
            DE<span />
          </span>
          <span className="brand-copy">
            <strong>Citizenship Study Lab</strong>
            <small>Einbürgerungstest · Deutsch + English</small>
          </span>
        </button>

        <label className="state-select">
          <span>Bundesland</span>
          <select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>
            {STATES.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>

        <nav className="main-nav" aria-label="Hauptnavigation">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function MetricCard({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <article className="metric-card" style={{ "--metric-color": color } as React.CSSProperties}>
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
}: {
  attempts: Attempts;
  studyQuestions: Question[];
  selectedState: string;
  onPractice: () => void;
  onStartExam: () => void;
}) {
  const attemptEntries = Object.entries(attempts);
  const correct = attemptEntries.filter(([, attempt]) => attempt.correct).length;
  const accuracy = attemptEntries.length ? Math.round((correct / attemptEntries.length) * 100) : 0;
  const coverage = Math.round((attemptEntries.length / studyQuestions.length) * 100);
  const imageQuestions = studyQuestions.filter((question) => IMAGE_BY_ID[question.id]).length;
  const recent = attemptEntries
    .sort(([, a], [, b]) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 4);

  return (
    <div className="view-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">BAMF FRAGENKATALOG · STAND 07.05.2025</span>
          <h1>Study the questions as they actually appear.</h1>
          <p>
            300 general questions plus 10 for {selectedState}, with German text, English support,
            official answer choices and every visual question placed where it belongs.
          </p>
          <div className="button-row">
            <button className="button primary" onClick={onPractice}>Continue learning</button>
            <button className="button secondary" onClick={onStartExam}>Start 33-question test</button>
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

      <section className="metric-grid" aria-label="Lernstatistik">
        <MetricCard label="BEARBEITET" value={`${attemptEntries.length}`} note={`von ${studyQuestions.length} Fragen`} color="#1d4ed8" />
        <MetricCard label="RICHTIG" value={`${accuracy}%`} note={`${correct} richtige Antworten`} color="#16a34a" />
        <MetricCard label="ABDECKUNG" value={`${coverage}%`} note="deines Fragenkatalogs" color="#f4b400" />
        <MetricCard label="BILD-FRAGEN" value={`${imageQuestions}`} note="11 allgemein + 2 im Bundesland" color="#dc2626" />
      </section>

      <section className="content-grid">
        <article className="panel panel-large">
          <div className="section-heading">
            <div>
              <span className="eyebrow blue">CORRECTLY MAPPED</span>
              <h2>All 43 official image questions are connected</h2>
            </div>
            <span className="count-badge">43 / 43</span>
          </div>
          <p className="muted">
            The national catalogue has 11 visual questions. Each of the 16 federal-state sections has
            two more: the coat of arms question and the state-map question. The app resolves the right
            pair after you choose your Bundesland.
          </p>
          <div className="mapping-strip">
            <span>National · 11</span><span>State · 2 × 16</span><span>Workbook match · exact</span>
          </div>
        </article>

        <article className="panel recent-panel">
          <div className="section-heading compact">
            <h2>Recent answers</h2>
            <span>{attemptEntries.length}</span>
          </div>
          {recent.length ? (
            <ul className="recent-list">
              {recent.map(([id, attempt]) => {
                const question = studyQuestions.find((item) => item.id === Number(id));
                if (!question) return null;
                return (
                  <li key={id}>
                    <span className={attempt.correct ? "status-dot correct" : "status-dot wrong"} />
                    <div><b>{getQuestionLabel(question)}</b><small>{question.text}</small></div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">Your answers will appear here after the first question.</div>
          )}
        </article>
      </section>
    </div>
  );
}

function ImagePanel({ question, onExpand }: { question: Question; onExpand: (src: string) => void }) {
  const image = IMAGE_BY_ID[question.id];
  if (!image) return null;

  return (
    <figure className="question-image-card">
      <div className="image-card-heading">
        <span>Abbildung zur Frage</span>
        <button onClick={() => onExpand(image)}>Vergrößern</button>
      </div>
      <button className="question-image-button" onClick={() => onExpand(image)} aria-label="Abbildung vergrößern">
        {/* Native img keeps the original workbook crop and aspect ratio intact. */}
        <img src={image} alt={`Offizielle Abbildung für ${getQuestionLabel(question)}`} loading="lazy" />
      </button>
      <figcaption>Tap or click the image to inspect it at full size.</figcaption>
    </figure>
  );
}

function QuestionCard({
  question,
  selectedAnswer,
  onAnswer,
  onExpandImage,
  revealResult = true,
  showTranslation = true,
}: {
  question: Question;
  selectedAnswer?: AnswerKey;
  onAnswer: (answer: AnswerKey) => void;
  onExpandImage: (src: string) => void;
  revealResult?: boolean;
  showTranslation?: boolean;
}) {
  const translation = question.translations?.en;
  const answered = Boolean(selectedAnswer);

  return (
    <article className="question-card">
      <div className="question-meta">
        <span className={question.type === "general" ? "scope general" : "scope state"}>{scopeLabel(question)}</span>
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
            <p>{translation?.text ?? "English translation is not available for this question."}</p>
          </div>
        )}
      </div>

      <ImagePanel question={question} onExpand={onExpandImage} />

      <div className="answer-grid" role="group" aria-label="Antwortmöglichkeiten">
        {ANSWER_KEYS.map((key, index) => {
          const isSelected = selectedAnswer === key;
          const isCorrect = question.correctAnswer === key;
          const showCorrect = revealResult && answered && isCorrect;
          const showWrong = revealResult && isSelected && !isCorrect;
          return (
            <button
              key={key}
              className={`answer-option ${isSelected ? "selected" : ""} ${showCorrect ? "correct" : ""} ${showWrong ? "wrong" : ""}`}
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
        <div className={selectedAnswer === question.correctAnswer ? "result-note correct" : "result-note wrong"} role="status">
          <strong>{selectedAnswer === question.correctAnswer ? "Richtig" : "Noch nicht richtig"}</strong>
          <span>
            {selectedAnswer === question.correctAnswer
              ? translation?.context ?? "Correct answer selected."
              : `The correct answer is ${ANSWER_KEYS.indexOf(question.correctAnswer) + 1}: ${question.options[question.correctAnswer]}`}
          </span>
        </div>
      )}
    </article>
  );
}

function PracticeView({
  questions,
  attempts,
  setAttempts,
}: {
  questions: Question[];
  attempts: Attempts;
  setAttempts: React.Dispatch<React.SetStateAction<Attempts>>;
}) {
  const [index, setIndex] = useState(0);
  const [jump, setJump] = useState("1");
  const [imageOnly, setImageOnly] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const activeList = imageOnly ? questions.filter((question) => IMAGE_BY_ID[question.id]) : questions;
  const activeIndex = Math.min(index, Math.max(0, activeList.length - 1));
  const question = activeList[activeIndex];

  useEffect(() => {
    setIndex(0);
    setJump("1");
  }, [questions, imageOnly]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (["1", "2", "3", "4"].includes(event.key)) {
        const answer = ANSWER_KEYS[Number(event.key) - 1];
        setAttempts((current) => ({
          ...current,
          [question.id]: { answer, correct: answer === question.correctAnswer, timestamp: new Date().toISOString() },
        }));
      }
      if (event.key === "ArrowRight") setIndex((current) => Math.min(activeList.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeList.length, question, setAttempts]);

  const handleAnswer = (answer: AnswerKey) => {
    setAttempts((current) => ({
      ...current,
      [question.id]: { answer, correct: answer === question.correctAnswer, timestamp: new Date().toISOString() },
    }));
  };

  const move = (next: number) => {
    const safe = Math.max(0, Math.min(activeList.length - 1, next));
    setIndex(safe);
    setJump(String(safe + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!question) return null;

  return (
    <div className="view-stack">
      <section className="practice-toolbar panel">
        <div>
          <span className="eyebrow red">ACTIVE STUDY MODE</span>
          <h1>{imageOnly ? "Image questions" : "Bilingual question trainer"}</h1>
          <p>{imageOnly ? `${activeList.length} visual questions for the selected study path` : "300 general + 10 state questions"}</p>
        </div>
        <div className="toolbar-controls">
          <button className={imageOnly ? "filter-button active" : "filter-button"} onClick={() => setImageOnly((value) => !value)}>
            {imageOnly ? "Show all questions" : "Only image questions"}
          </button>
          <label className="jump-control">
            <span>Go to</span>
            <input
              inputMode="numeric"
              value={jump}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");
                setJump(value);
                const parsed = Number(value);
                if (parsed >= 1 && parsed <= activeList.length) setIndex(parsed - 1);
              }}
              onBlur={() => setJump(String(activeIndex + 1))}
              aria-label="Question position"
            />
            <b>/ {activeList.length}</b>
          </label>
        </div>
      </section>

      <div className="progress-track" aria-label={`Question ${activeIndex + 1} of ${activeList.length}`}>
        <span style={{ width: `${((activeIndex + 1) / activeList.length) * 100}%` }} />
      </div>

      <QuestionCard
        key={question.id}
        question={question}
        selectedAnswer={attempts[question.id]?.answer}
        onAnswer={handleAnswer}
        onExpandImage={setExpandedImage}
      />

      <div className="question-navigation">
        <button className="button secondary" disabled={activeIndex === 0} onClick={() => move(activeIndex - 1)}>← Previous</button>
        <span>{activeIndex + 1} / {activeList.length}</span>
        <button className="button primary" disabled={activeIndex === activeList.length - 1} onClick={() => move(activeIndex + 1)}>Next →</button>
      </div>

      {expandedImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Vergrößerte Abbildung" onClick={() => setExpandedImage(null)}>
          <button className="lightbox-close" onClick={() => setExpandedImage(null)}>Close ×</button>
          <img src={expandedImage} alt={`Vergrößerte Abbildung für ${getQuestionLabel(question)}`} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function ExamIntro({ selectedState, onStart }: { selectedState: string; onStart: () => void }) {
  return (
    <section className="exam-intro panel">
      <span className="eyebrow red">REALISTIC MOCK TEST</span>
      <h1>33 questions. One clean run.</h1>
      <p>
        The simulation draws 30 general questions and 3 questions for {selectedState}. English support and
        answer feedback stay hidden until submission, while question images remain visible exactly when required.
      </p>
      <div className="exam-facts"><span><b>33</b> questions</span><span><b>60</b> minutes</span><span><b>17</b> to pass</span></div>
      <button className="button danger" onClick={onStart}>Begin mock exam</button>
    </section>
  );
}

function ExamView({
  questions,
  selectedState,
  onStart,
  onSaveAttempts,
}: {
  questions: Question[];
  selectedState: string;
  onStart: () => void;
  onSaveAttempts: (answers: Record<number, AnswerKey>) => void;
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

  if (!questions.length) return <ExamIntro selectedState={selectedState} onStart={onStart} />;

  const score = questions.filter((question) => answers[question.id] === question.correctAnswer).length;
  const answeredCount = Object.keys(answers).length;
  const activeQuestion = questions[index];

  if (finished) {
    const passed = score >= 17;
    const missed = questions.filter((question) => answers[question.id] !== question.correctAnswer);
    return (
      <div className="view-stack">
        <section className={`score-panel panel ${passed ? "passed" : "failed"}`}>
          <span className="eyebrow">RESULT</span>
          <div className="score-number">{score}<small>/ 33</small></div>
          <h1>{passed ? "Passed — this run cleared the threshold." : "Not passed yet — review the missed set."}</h1>
          <p>{passed ? "You reached the required 17 correct answers." : `You need ${Math.max(0, 17 - score)} more correct answers to reach 17.`}</p>
          <div className="button-row">
            <button className="button primary" onClick={onStart}>Start another test</button>
            <button className="button secondary" onClick={() => { setFinished(false); setIndex(0); }}>Review this attempt</button>
          </div>
        </section>
        {missed.length > 0 && (
          <section className="panel missed-panel">
            <div className="section-heading compact"><h2>Questions to review</h2><span>{missed.length}</span></div>
            <div className="missed-grid">
              {missed.map((question) => (
                <button key={question.id} onClick={() => { setFinished(false); setIndex(questions.findIndex((item) => item.id === question.id)); }}>
                  <b>{getQuestionLabel(question)}</b><span>{question.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="view-stack">
      <section className="exam-toolbar panel">
        <div><span className="eyebrow red">EXAM MODE · DEUTSCH ONLY</span><h1>Question {index + 1} of 33</h1></div>
        <div className="exam-counter"><b>{answeredCount}</b><span>answered</span></div>
      </section>

      <div className="exam-map" aria-label="Exam question navigation">
        {questions.map((question, questionIndex) => (
          <button
            key={question.id}
            className={`${questionIndex === index ? "active" : ""} ${answers[question.id] ? "answered" : ""}`}
            onClick={() => setIndex(questionIndex)}
            aria-label={`Question ${questionIndex + 1}${answers[question.id] ? ", answered" : ""}`}
          >
            {questionIndex + 1}
          </button>
        ))}
      </div>

      <QuestionCard
        key={activeQuestion.id}
        question={activeQuestion}
        selectedAnswer={answers[activeQuestion.id]}
        onAnswer={(answer) => setAnswers((current) => ({ ...current, [activeQuestion.id]: answer }))}
        onExpandImage={setExpandedImage}
        revealResult={false}
        showTranslation={false}
      />

      <div className="question-navigation">
        <button className="button secondary" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>← Previous</button>
        <span>{answeredCount} / 33 answered</span>
        {index < questions.length - 1 ? (
          <button className="button primary" onClick={() => setIndex((current) => Math.min(questions.length - 1, current + 1))}>Next →</button>
        ) : (
          <button
            className="button danger"
            disabled={answeredCount !== questions.length}
            onClick={() => { onSaveAttempts(answers); setFinished(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            Submit test
          </button>
        )}
      </div>

      {answeredCount === questions.length && index < questions.length - 1 && (
        <div className="submit-banner panel">
          <span>All 33 questions are answered.</span>
          <button className="button danger" onClick={() => { onSaveAttempts(answers); setFinished(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Submit and score</button>
        </div>
      )}

      {expandedImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Vergrößerte Abbildung" onClick={() => setExpandedImage(null)}>
          <button className="lightbox-close" onClick={() => setExpandedImage(null)}>Close ×</button>
          <img src={expandedImage} alt={`Vergrößerte Abbildung für ${getQuestionLabel(activeQuestion)}`} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function GuideView() {
  return (
    <div className="guide-grid">
      <section className="panel guide-main">
        <span className="eyebrow blue">EXAM STRUCTURE</span>
        <h1>Leben in Deutschland / Einbürgerungstest</h1>
        <p>The official test sheet contains 33 multiple-choice questions: 30 national questions and 3 from your selected federal state.</p>
        <div className="guide-steps">
          <div><b>01</b><span><strong>Prepare 310 questions</strong><small>300 national + 10 for your Bundesland.</small></span></div>
          <div><b>02</b><span><strong>Choose one answer</strong><small>Every question has four choices and exactly one correct answer.</small></span></div>
          <div><b>03</b><span><strong>Reach at least 17/33</strong><small>That is the passing threshold for the citizenship test.</small></span></div>
        </div>
      </section>
      <aside className="panel source-panel">
        <span className="eyebrow red">SOURCE CONTROL</span>
        <h2>Image mapping</h2>
        <p>43 visual entries were extracted from the official catalogue and matched by section plus task number.</p>
        <ul><li>11 national image questions</li><li>32 state image questions</li><li>No headers, answer boxes or decorative page art</li></ul>
        <a href="https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.html" target="_blank" rel="noreferrer">Open the official BAMF catalogue ↗</a>
      </aside>
    </div>
  );
}

export default function CitizenshipTrainer() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedState, setSelectedState] = useState(DEFAULT_STATE);
  const [attempts, setAttempts] = useState<Attempts>({});
  const [hydrated, setHydrated] = useState(false);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);

  useEffect(() => {
    setSelectedState(readStoredState());
    setAttempts(readAttempts());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("trainer_selected_state", selectedState);
  }, [hydrated, selectedState]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("trainer_quiz_attempts_v2", JSON.stringify(attempts));
  }, [attempts, hydrated]);

  const stateQuestions = useMemo(() => getStateQuestions(selectedState), [selectedState]);
  const studyQuestions = useMemo(() => [...GENERAL_QUESTIONS, ...stateQuestions], [stateQuestions]);

  const startExam = () => {
    setExamQuestions([...shuffle(GENERAL_QUESTIONS).slice(0, 30), ...shuffle(stateQuestions).slice(0, 3)]);
    setTab("exam");
  };

  const saveExamAttempts = (answers: Record<number, AnswerKey>) => {
    const timestamp = new Date().toISOString();
    setAttempts((current) => {
      const next = { ...current };
      examQuestions.forEach((question) => {
        const answer = answers[question.id];
        if (answer) next[question.id] = { answer, correct: answer === question.correctAnswer, timestamp };
      });
      return next;
    });
  };

  return (
    <div className="app-shell">
      <Header tab={tab} setTab={setTab} selectedState={selectedState} setSelectedState={setSelectedState} />
      <main className="main-content">
        {tab === "dashboard" && (
          <DashboardView
            attempts={attempts}
            studyQuestions={studyQuestions}
            selectedState={selectedState}
            onPractice={() => setTab("practice")}
            onStartExam={startExam}
          />
        )}
        {tab === "practice" && <PracticeView questions={studyQuestions} attempts={attempts} setAttempts={setAttempts} />}
        {tab === "exam" && (
          <ExamView
            questions={examQuestions}
            selectedState={selectedState}
            onStart={startExam}
            onSaveAttempts={saveExamAttempts}
          />
        )}
        {tab === "guide" && <GuideView />}
      </main>
      <footer className="site-footer">
        <span>Citizenship Study Lab</span>
        <span>Questions based on the BAMF catalogue · Images mapped from the supplied workbook</span>
      </footer>
      <span className="sr-only" aria-live="polite">{examQuestions.length ? "Mock exam prepared" : ""}</span>
    </div>
  );
}
