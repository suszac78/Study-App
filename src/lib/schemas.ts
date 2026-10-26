import { z } from 'zod/v4'

// Schemas the AI must fill in. Kept to plain strings/numbers/arrays/enums so
// they map cleanly onto Claude's structured-output JSON schema support.

export const Weight = z.enum(['high', 'medium', 'low'])
export const Difficulty = z.enum(['easy', 'medium', 'hard'])

export const ExamAnalysisSchema = z.object({
  examName: z.string().describe('Official name of the exam'),
  conductingBody: z.string().describe('Who conducts the exam, or empty string'),
  examDate: z.string().describe('Main exam date as YYYY-MM-DD, or empty string if unknown'),
  summary: z.string().describe('2-4 sentence plain-language overview of the exam'),
  importantDates: z.array(z.object({ label: z.string(), date: z.string() })),
  pattern: z.object({
    durationMinutes: z.number(),
    totalQuestions: z.number(),
    totalMarks: z.number(),
    marksPerQuestion: z.number(),
    negativeMarking: z.number().describe('Marks deducted per wrong answer; 0 if none'),
    questionTypes: z.array(z.string()),
    sections: z.array(
      z.object({
        name: z.string(),
        questions: z.number(),
        marks: z.number(),
        durationMinutes: z.number(),
      }),
    ),
  }),
  syllabus: z.array(
    z.object({
      topic: z.string(),
      subtopics: z.array(z.string()),
      weight: Weight.describe('Expected importance / weightage in the exam'),
    }),
  ),
  eligibility: z.array(z.string()),
  instructions: z.array(z.string()),
  keyFacts: z.array(z.string()).describe('Other key facts a candidate must know'),
})
export type ExamAnalysis = z.infer<typeof ExamAnalysisSchema>

export const OrganizedNoteSchema = z.object({
  title: z.string(),
  topic: z.string().describe('Exact syllabus topic name this note belongs to, or a short topic if none fits'),
  summary: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string().describe('Markdown. Use bullet lists, bold key terms, tables and $LaTeX$ where useful'),
    }),
  ),
  keyPoints: z.array(z.string()),
  definitions: z.array(z.object({ term: z.string(), meaning: z.string() })),
  formulas: z.array(z.object({ name: z.string(), expression: z.string(), note: z.string() })),
  mnemonics: z.array(z.string()),
  examTips: z.array(z.string()),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  gaps: z.array(z.string()).describe('Syllabus areas these notes do not cover yet'),
})
export type OrganizedNote = z.infer<typeof OrganizedNoteSchema>

export const QuestionSchema = z.object({
  type: z.enum(['mcq', 'truefalse', 'multi']),
  topic: z.string(),
  difficulty: Difficulty,
  prompt: z.string(),
  options: z.array(z.string()),
  correct: z.array(z.number()).describe('Zero-based indexes of the correct option(s)'),
  explanation: z.string().describe('Why the answer is correct, teaching the concept (markdown)'),
  optionExplanations: z.array(z.string()).describe('One short note per option saying why it is right or wrong'),
  hint: z.string(),
})
export type AIQuestion = z.infer<typeof QuestionSchema>

export const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(QuestionSchema),
})
export type AIQuiz = z.infer<typeof QuizSchema>

export const TipsSchema = z.object({
  headline: z.string(),
  overview: z.string(),
  priorityTopics: z.array(z.object({ topic: z.string(), reason: z.string(), weight: Weight })),
  studyPlan: z.array(z.object({ label: z.string(), focus: z.string(), tasks: z.array(z.string()) })),
  strategies: z.array(z.object({ title: z.string(), detail: z.string() })),
  timeManagement: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  examDayChecklist: z.array(z.string()),
  motivation: z.string(),
})
export type ExamTips = z.infer<typeof TipsSchema>

export const FeedbackSchema = z.object({
  verdict: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.object({ topic: z.string(), issue: z.string(), fix: z.string() })),
  nextSteps: z.array(z.string()),
})
export type AttemptFeedback = z.infer<typeof FeedbackSchema>

export const ResultAnalysisSchema = z.object({
  headline: z.string().describe('One encouraging but honest sentence summing up the result'),
  scoreRead: z.string().describe('What the score/grade means, e.g. "34/50 (68%), a solid B"'),
  strengths: z.array(z.string()),
  lostMarks: z.array(
    z.object({
      area: z.string().describe('Question, topic or skill'),
      marksLost: z.string().describe('e.g. "6 marks" or "about a third of Section B"; "unknown" if not visible'),
      why: z.string(),
      fix: z.string().describe('Concrete thing to do differently next time'),
    }),
  ),
  patterns: z.array(z.string()).describe('Recurring habits across the paper, e.g. not showing working, misreading command words'),
  topicsToRevise: z.array(z.string()),
  examTechnique: z.array(z.string()),
  nextTime: z.array(z.string()).describe('Short checklist of what to do before and during the next assessment in this subject'),
})
export type ResultAnalysis = z.infer<typeof ResultAnalysisSchema>

export const QuotesSchema = z.object({
  quotes: z.array(z.string()),
})

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string(), topic: z.string() })),
})
