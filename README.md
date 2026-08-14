# Einbürgerungstest Study Lab (Leben in Deutschland)

A modern, offline-capable bilingual study platform and test trainer for the German Citizenship Test (*Einbürgerungstest* / *Leben in Deutschland*), containing all **460 official questions** from the Federal Office for Migration and Refugees (BAMF).

---

## Key Features

- **Complete Official BAMF Catalogue**:
  - **300 General Questions** (IDs 1–300).
  - **160 State-Specific Questions** across all 16 federal states (IDs 301–460; exactly 10 per Bundesland).
  - **43 Official Visual Diagram Questions** (11 national + 2 per Bundesland) correctly resolved and mapped.
- **100% Static bilingual Dataset**:
  - All original German questions and options.
  - Complete English translations and civic context explanations bundled statically in the production app.
  - **No runtime Gemini API or external AI model required**. Zero API key dependencies for core study features.
- **Realistic 33-Question Mock Exam Mode**:
  - 30 general questions + 3 questions for your selected federal state.
  - 60-minute examination simulation with 17-question passing mark.
  - In-depth post-exam review revealing your submitted answers, the correct answers, and bilingual explanations.
- **PWA & Offline Capability**:
  - Service Worker precaches the application shell, scripts, styles, and question catalog.
  - On-demand runtime caching for question images.
  - Full study capabilities available without an active internet connection.
- **Firebase Synchronization**:
  - Optional Google sign-in to securely synchronize progress, answers, and mock test scores across devices.
  - Guest mode saves progress directly to local storage.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 6
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Firebase Firestore & Firebase Authentication
- **Deployment**: Vercel (Static Vite SPA)

---

## Local Development

```bash
# Install dependencies
npm ci

# Start local development server
npm run dev

# Run TypeScript linter
npm run lint

# Build for production
npm run build
```

---

## Deployment to Vercel

1. Connect your GitHub repository to Vercel.
2. Vercel automatically detects the build configuration via `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Optional Firebase configuration:
   - The app defaults to `/public/firebase-applet-config.json`.
   - You can also configure standard client environment variables (`VITE_FIREBASE_*`) in Vercel project settings if using a custom Firebase project.
