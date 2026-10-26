import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ConfirmHost, Toaster } from './components/ui'
import { useSettings } from './lib/store'
import Dashboard from './pages/Dashboard'
import ExamLayout from './pages/ExamLayout'
import Flashcards from './pages/Flashcards'
import NewExam from './pages/NewExam'
import NoteNew from './pages/NoteNew'
import NoteView from './pages/NoteView'
import NotesList from './pages/NotesList'
import NotFound from './pages/NotFound'
import CourseImport from './pages/CourseImport'
import Overview from './pages/Overview'
import Progress from './pages/Progress'
import QuizHub from './pages/QuizHub'
import QuizPlayer from './pages/QuizPlayer'
import Results from './pages/Results'
import Settings from './pages/Settings'
import Tips from './pages/Tips'
import Tutor from './pages/Tutor'

// Inside claude.ai the page lives in a frame whose URL never changes, so routes
// are kept in memory there; elsewhere they live in the #hash for bookmarking.
const Router = typeof window !== 'undefined' && window.claude ? MemoryRouter : HashRouter

// The host page may set data-theme itself; keep its value for "System".
const hostTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null

export default function App() {
  const { theme } = useSettings()
  useEffect(() => {
    const root = document.documentElement
    const value = theme === 'system' ? hostTheme : theme
    if (value) root.setAttribute('data-theme', value)
    else root.removeAttribute('data-theme')
  }, [theme])

  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewExam />} />
            <Route path="settings" element={<Settings />} />
            <Route path="exam/:examId" element={<ExamLayout />}>
              <Route index element={<Overview />} />
              <Route path="notes" element={<NotesList />} />
              <Route path="notes/new" element={<NoteNew />} />
              <Route path="notes/import" element={<CourseImport />} />
              <Route path="notes/:noteId" element={<NoteView />} />
              <Route path="practice" element={<QuizHub key="practice" mode="practice" />} />
              <Route path="tests" element={<QuizHub key="timed" mode="timed" />} />
              <Route path="quiz/:quizId" element={<QuizPlayer />} />
              <Route path="results/:attemptId" element={<Results />} />
              <Route path="flashcards" element={<Flashcards />} />
              <Route path="tips" element={<Tips />} />
              <Route path="tutor" element={<Tutor />} />
              <Route path="progress" element={<Progress />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
      <ConfirmHost />
    </MotionConfig>
  )
}
