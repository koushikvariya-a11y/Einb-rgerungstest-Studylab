# Einbürgerungstest App

A responsive German citizenship-test trainer rebuilt from the supplied AI Studio sources and the BAMF question catalogue dated 07.05.2025.

## What is included

- 300 general questions and all 160 state questions in `app/data/questions.json`
- German questions and options, English study translations, answer keys and context notes
- 43 extracted question images in `public/question-images/`
- Exact mapping for 11 general image questions and questions 1 and 8 for every Bundesland
- State-aware 310-question practice path
- 33-question mock exam using 30 general and 3 selected-state questions
- Device-local progress storage
- Responsive desktop, tablet and phone layouts with full-screen image inspection

## Relevant source files

- `app/CitizenshipTrainer.tsx` — application state, dashboard, practice and exam flows
- `app/question-data.ts` — data types, Bundesland handling and image manifest
- `app/globals.css` — visual system and responsive breakpoints
- `app/data/questions.json` — normalized 460-question catalogue
- `public/question-images/` — workbook-extracted question images

## Original source analysis

The supplied project used Firebase Authentication and Firestore for optional cross-device progress sync, plus an Express endpoint backed by Gemini for dictionary explanations. The uploaded source set omitted several files required to run that exact build (`questions.ts`, `stateQuestions.ts`, `QuestViewer.tsx`, `firebase.ts`, `types.ts`, `main.tsx`, and the global stylesheet). This implementation therefore keeps progress device-local and uses the supplied bilingual question context directly, avoiding a secret-dependent runtime.

## Verification baseline

- 460 questions
- 16 states, 10 questions each
- 43 image mappings
- 43 image assets
- No horizontal overflow at phone, tablet or desktop widths
