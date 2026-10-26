# StudyPilot

An AI study companion. Add your exam notification and your notes (or a whole Canvas course), and StudyPilot organises everything, then builds quizzes with explanations, timed mock tests, flashcards, an exam strategy and an AI tutor.

## Features

- **Exam setup from the notification**: upload or paste the official notification/brochure (PDF, photos, text). The AI extracts the date, pattern, marking scheme, negative marking, important dates and a weighted syllabus.
- **Organised notes**: paste notes or upload PDFs, Word, PowerPoint, HTML or photos of handwritten pages. You get a summary, sections, key points, definitions, formulas (with LaTeX), memory tricks, exam tips, syllabus gaps and flashcards.
- **Whole-course import**: drop course **EPUB books** (several at once, or inside a `.zip`), a Canvas course export (`.imscc`), any `.zip` of course files, or a folder. Each EPUB chapter (from the book's table of contents) becomes its own note; DRM-locked books are detected and reported. Modules, pages, PDFs, Word docs, slides, discussions and quiz questions are read in the browser and saved as notes per module (no AI needed). You can then organise any or all modules with AI, and use the course syllabus to fill in exam details.
- **Practice quizzes**: multiple choice, true/false and multiple-correct questions, with hints, instant feedback and an explanation for every option.
- **Timed mock tests**: the real exam pattern, a countdown timer, question palette, flag for review, auto-submit and negative marking.
- **Results and AI feedback**: score, accuracy by topic, a full answer review and coaching on what to fix.
- **Flashcards**: spaced repetition (Leitner boxes), made automatically from your notes.
- **Tips and study plan**: a day-by-day or week-by-week plan to exam day, priority topics, time management, common mistakes and an exam-day checklist, based on your progress.
- **AI tutor**: a streaming chat that knows your exam and your notes.
- **Progress**: score trend, topic mastery and history.
- **Focus garden (anti-procrastination)**: a focus timer that grows a plant while you study anywhere in the app; leave the app for more than 60 seconds and it withers. Finished sessions fill your garden. Daily streak, XP and levels (with titles), three daily quests, and an "Excuse shredder" that roasts your excuse and gives you one tiny task to start right now.
- Light/dark themes, mobile layout, keyboard shortcuts in quizzes, reduced-motion support, backup export/import.

## How the AI works (no API key needed on claude.ai)

StudyPilot supports two AI connections and picks one automatically:

1. **Built-in Claude (recommended).** When the app is opened as a claude.ai artifact, it uses the viewer's own Claude plan through the artifact runtime (`window.claude.use("sample")`). No API key. Each AI action counts toward your Claude plan's usage limits like a chat message. There is no separate bill unless you have turned on paid extra usage in your Claude billing settings.
2. **Your own Anthropic API key (optional).** When the app runs anywhere else, add a key in Settings. Calls go straight from your browser to the Anthropic API with the official SDK (Claude Opus 5.5 by default; Sonnet 5.5 and Haiku 5.5 selectable), using structured outputs and streaming. The key is stored only in your browser.

All your data (exams, notes, quizzes, results) is stored locally in your browser (IndexedDB). Use **Settings → Export backup** to keep a copy.

## Publishing on GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds the app and publishes it on every push.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is then at `https://<your-username>.github.io/Study-App/`. On GitHub Pages there is no built-in Claude,
so add an Anthropic API key in the app's Settings to use the AI features (everything else works without one).

## Development

```bash
npm install
npm run dev            # local dev server
npm run build          # dist/: static site for any host (e.g. GitHub Pages)
npm run build:single   # dist-single/: one self-contained file for a claude.ai artifact
npm run lint
```

`npm run build:single` also writes `dist-single/studypilot.html`, the page fragment used to publish the claude.ai artifact.

### Tech

React 19 + TypeScript + Vite, Motion (Framer Motion) for micro-interactions, react-markdown + KaTeX for notes and maths, pdf.js for in-browser PDF text, fflate for course archives, Zod schemas for AI structured output, and the Anthropic TypeScript SDK.

Design follows the modern-web-design and motion-framer guidance from [claudedesignskills](https://github.com/freshtechbro/claudedesignskills): fluid type, restrained palette, glass surfaces, purposeful spring micro-interactions and `prefers-reduced-motion` support.

### Project layout

```
src/
  lib/ai.ts          AI features (built-in Claude or API key), prompts, scoring
  lib/schemas.ts     Zod schemas for every AI output
  lib/course.ts      Canvas/IMS Common Cartridge + zip/folder reader
  lib/epub.ts        EPUB 2/3 reader (chapters from nav/NCX table of contents)
  lib/files.ts       PDF/Word/PowerPoint/image handling for uploads
  lib/store.ts       Local database (IndexedDB) and settings
  lib/runtime.ts     Detects the claude.ai built-in Claude
  pages/             Screens (dashboard, exam overview, notes, quizzes, tests, ...)
  components/        Shared UI, question view, layout
```
