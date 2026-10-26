import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type {
  BetaContentBlockParam,
  BetaMessageParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { z } from 'zod/v4'
import { filesToBlocks, filesToTextAndImages } from './files'
import { getImageLimits, getRuntimeState, getSample } from './runtime'
import { getSettings } from './store'
import {
  ExamAnalysisSchema,
  FeedbackSchema,
  FlashcardsSchema,
  OrganizedNoteSchema,
  QuizSchema,
  TipsSchema,
  type AIQuestion,
  type ExamTips,
} from './schemas'
import type { Attempt, ChatMessage, Depth, Exam, Note, Quiz } from './types'

export class AiError extends Error {
  code: 'no-ai' | 'auth' | 'rate' | 'refusal' | 'truncated' | 'network' | 'bad-output' | 'too-large' | 'cancelled' | 'denied' | 'other'
  constructor(code: AiError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export type Provider = 'claude' | 'api' | 'none'

/** Built-in Claude (claude.ai page) wins; otherwise an API key if one is set. */
export function currentProvider(): Provider {
  if (getRuntimeState() === 'ready' && getSample()) return 'claude'
  if (getSettings().apiKey) return 'api'
  return 'none'
}

const NO_AI_MESSAGE =
  'AI is not connected. Open StudyPilot from its claude.ai link to use the built-in Claude, or add an API key in Settings.'

// Built-in Claude accepts at most 256 KiB of text per call.
const SAMPLE_TEXT_BUDGET = 200_000

const depthToEffort: Record<Depth, 'low' | 'medium' | 'high'> = { quick: 'low', balanced: 'medium', deep: 'high' }
const depthToTier: Record<Depth, 'quick' | 'default' | 'complex'> = { quick: 'quick', balanced: 'default', deep: 'complex' }

export interface Source {
  text: string
  files: File[]
}

export interface CallOptions {
  onProgress?: (chars: number) => void
  signal?: AbortSignal
}

// ---------- API-key backend ----------

function apiClient() {
  const { apiKey } = getSettings()
  // The key stays in this browser and is sent straight to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

// Opus 5.5 / Sonnet 5.5 can fall back to another model if a safety classifier
// declines a request; Haiku has no server-side fallback.
function fallbackParams(model: string) {
  return model === 'claude-haiku-5-5'
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
}

function apiError(err: unknown): AiError {
  if (err instanceof AiError) return err
  if (err instanceof Anthropic.APIUserAbortError) return new AiError('cancelled', 'Stopped.')
  if (err instanceof Anthropic.AuthenticationError) return new AiError('auth', 'Your API key was rejected. Check it in Settings.')
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError('auth', 'This API key cannot use the selected model. Pick another model in Settings.')
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate', 'Rate limit reached. Wait a minute and try again.')
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', 'Could not reach the AI. Check your internet connection.')
  if (err instanceof Anthropic.APIError) return new AiError('other', err.message)
  if (err instanceof SyntaxError) return new AiError('bad-output', 'The AI returned an unreadable answer. Please try again.')
  return new AiError('other', err instanceof Error ? err.message : String(err))
}

// ---------- built-in Claude backend ----------

interface SampleErr {
  code: string
  message?: string
}

function sampleError(err: unknown): AiError {
  if (err instanceof AiError) return err
  const code = (err as SampleErr)?.code
  switch (code) {
    case 'cancelled':
      return new AiError('cancelled', 'Stopped.')
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return new AiError('denied', 'Claude access was not allowed for this page. Reload and choose Allow to use the AI.')
    case 'rate_limited':
      return new AiError('rate', 'You have hit a Claude usage limit. Try again a little later.')
    case 'session_expired':
      return new AiError('auth', 'Your claude.ai session expired. Sign in again and reload.')
    case 'prompt_too_large':
      return new AiError('too-large', 'That is too much text for one request. Split your notes into smaller parts.')
    case 'refused':
      return new AiError('refusal', 'Claude declined this request. Try rephrasing or using different material.')
    case 'invalid_json':
    case 'empty_completion':
      return new AiError('bad-output', 'The AI returned an incomplete answer. Please try again (or ask for fewer questions).')
    case 'image_rejected':
    case 'images_unavailable':
      return new AiError('other', 'One of the images could not be used. Try a JPG or PNG, or paste the text instead.')
    default:
      return new AiError('other', (err as SampleErr)?.message || (err instanceof Error ? err.message : 'Something went wrong. Please try again.'))
  }
}

// ---------- shared ----------

const PERSONA = `You are StudyPilot, an expert exam coach and tutor inside a study app.
You are accurate, encouraging and concrete. You teach for understanding, not rote recall.
Never invent official exam facts (dates, marks, rules). If the source material does not state something, leave it empty or say it is not stated.`

interface GenerateArgs<S extends z.ZodType> {
  instructions: string
  /** Main material: pasted text plus uploaded files. */
  source?: Source
  /** Extra text placed after the source. */
  request: string
  schema: S
  maxTokens?: number
}

async function generate<S extends z.ZodType>(args: GenerateArgs<S>, opts: CallOptions = {}): Promise<z.infer<S>> {
  const provider = currentProvider()
  if (provider === 'none') throw new AiError('no-ai', NO_AI_MESSAGE)
  const { depth, model } = getSettings()

  if (provider === 'claude') {
    const sample = getSample()!
    try {
      let sourceText = args.source?.text ?? ''
      let images: File[] = []
      if (args.source?.files.length) {
        const extracted = await filesToTextAndImages(args.source.files)
        sourceText = [extracted.text, sourceText].filter(Boolean).join('\n\n')
        images = extracted.images
        const max = getImageLimits()?.maxCount ?? 0
        if (images.length && !max) throw new AiError('other', 'Images cannot be sent from this view. Paste the text instead.')
        if (images.length > max) throw new AiError('other', `Attach at most ${max} images at a time.`)
      }
      if (sourceText.length > SAMPLE_TEXT_BUDGET) {
        throw new AiError('too-large', `That material is about ${Math.round(sourceText.length / 1000)}k characters. For a whole book or course, use Notes → Import course, which splits it into chapters. Otherwise split it into parts under ${SAMPLE_TEXT_BUDGET / 1000}k.`)
      }
      const schema = JSON.stringify(z.toJSONSchema(args.schema))
      const prompt = [
        PERSONA,
        args.instructions,
        sourceText ? `<source_material>\n${sourceText}\n</source_material>` : '',
        args.request,
        `Reply with only one JSON object (no prose, no code fence) that matches this JSON Schema exactly:\n${schema}`,
      ]
        .filter(Boolean)
        .join('\n\n')
      const value = await sample.json(prompt, {
        signal: opts.signal,
        modelTier: depthToTier[depth],
        images: images.length ? images : undefined,
        onText: ({ text }) => opts.onProgress?.(text.length),
      })
      const parsed = args.schema.safeParse(value)
      if (!parsed.success) throw new AiError('bad-output', 'The AI returned an incomplete answer. Please try again.')
      return parsed.data
    } catch (err) {
      throw sampleError(err)
    }
  }

  try {
    const blocks: BetaContentBlockParam[] = args.source?.files.length ? await filesToBlocks(args.source.files) : []
    if (args.source?.text) blocks.push({ type: 'text', text: `<source_material>\n${args.source.text}\n</source_material>` })
    blocks.push({ type: 'text', text: args.request })
    const stream = apiClient().beta.messages.stream(
      {
        model,
        max_tokens: args.maxTokens ?? 32000,
        system: `${PERSONA}\n\n${args.instructions}`,
        messages: [{ role: 'user', content: blocks }],
        output_config: { effort: depthToEffort[depth], format: betaZodOutputFormat(args.schema) },
        ...fallbackParams(model),
      },
      { signal: opts.signal },
    )
    stream.on('text', (_delta, snapshot) => opts.onProgress?.(snapshot.length))
    const msg = await stream.finalMessage()
    if (msg.stop_reason === 'refusal')
      throw new AiError('refusal', 'The AI declined this request. Try rephrasing or using different material.')
    if (msg.stop_reason === 'max_tokens')
      throw new AiError('truncated', 'The answer was too long and got cut off. Ask for fewer questions or split your notes.')
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = args.schema.safeParse(JSON.parse(text))
    if (!parsed.success) throw new AiError('bad-output', 'The AI returned an incomplete answer. Please try again.')
    return parsed.data
  } catch (err) {
    throw apiError(err)
  }
}

// ---------- context helpers ----------

export function examContext(exam: Exam): string {
  if (!exam.info) return `Exam: ${exam.name}${exam.examDate ? ` on ${exam.examDate}` : ''}`
  const i = exam.info
  return [
    `Exam: ${exam.name}${exam.examDate ? ` (date: ${exam.examDate})` : ''}`,
    i.summary,
    `Pattern: ${i.pattern.totalQuestions} questions, ${i.pattern.totalMarks} marks, ${i.pattern.durationMinutes} minutes, negative marking ${i.pattern.negativeMarking} per wrong answer. Question types: ${i.pattern.questionTypes.join(', ') || 'not stated'}.`,
    i.pattern.sections.length
      ? `Sections: ${i.pattern.sections.map((s) => `${s.name} (${s.questions} Q, ${s.marks} marks)`).join('; ')}`
      : '',
    `Syllabus topics:\n${i.syllabus.map((t) => `- ${t.topic} [${t.weight}]: ${t.subtopics.join(', ')}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function noteBody(n: Note) {
  if (!n.organized) return n.raw
  const o = n.organized
  return [
    o.summary,
    ...o.sections.map((s) => `## ${s.heading}\n${s.content}`),
    o.keyPoints.map((k) => `- ${k}`).join('\n'),
    o.definitions.map((d) => `- ${d.term}: ${d.meaning}`).join('\n'),
    o.formulas.map((f) => `- ${f.name}: ${f.expression} (${f.note})`).join('\n'),
  ].join('\n\n')
}

/** Notes as context. With built-in Claude, stays inside the per-call text budget. */
function notesContext(notes: Note[], budget = currentProvider() === 'claude' ? 120_000 : Infinity): string {
  if (!notes.length) return 'The student has not added notes yet.'
  let out = ''
  let skipped = 0
  for (const n of notes) {
    const chunk = `<note title="${n.title}" topic="${n.topic}">\n${noteBody(n)}\n</note>\n\n`
    if (out.length + chunk.length > budget) {
      skipped++
      continue
    }
    out += chunk
  }
  if (skipped) out += `(${skipped} more note(s) not included because of length; their topics: ${notes.slice(-skipped).map((n) => n.topic).join(', ')})`
  return out
}

const today = () => new Date().toISOString().slice(0, 10)

// ---------- features ----------

export function analyzeExam(source: Source, opts?: CallOptions) {
  return generate(
    {
      schema: ExamAnalysisSchema,
      instructions: `Read the exam notification / information brochure provided and extract everything a candidate needs.
Today is ${today()}. Use YYYY-MM-DD for dates when the day is known; otherwise copy the date as written.
Build a clean syllabus: group into 4-15 main topics with their subtopics. Rate each topic's weight from stated weightage, or from how prominent it is if no weightage is given.
If a pattern number is not stated, use 0. Do not guess official numbers.`,
      source,
      request: 'Analyse this exam notification.',
      maxTokens: 16000,
    },
    opts,
  )
}

export function organizeNotes(exam: Exam, source: Source, hint: string, opts?: CallOptions) {
  return generate(
    {
      schema: OrganizedNoteSchema,
      instructions: `Turn the student's raw notes into clean, well-organised study notes for this exam.
${examContext(exam)}

Rules:
- Keep every fact from the source; fix clear errors and mark each correction with "(corrected)".
- Structure logically with clear headings; use markdown bullet lists, **bold** key terms, tables for comparisons, and $...$ LaTeX for maths.
- "topic" must be one of the syllabus topic names above, copied exactly, when one fits.
- Write 6-20 flashcards that test understanding, not trivia.
- Exam tips must be specific to this content and this exam pattern.
- "gaps" lists important syllabus subtopics for this topic that the notes do not cover.`,
      source,
      request: `${hint ? `Student's description of these notes: ${hint}\n\n` : ''}Organise these notes.`,
      maxTokens: 32000,
    },
    opts,
  )
}

export interface QuizRequest {
  count: number
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard'
  topics: string[]
  types: Array<AIQuestion['type']>
  mode: 'practice' | 'timed'
  focus: string
}

export async function generateQuiz(exam: Exam, notes: Note[], req: QuizRequest, opts?: CallOptions) {
  const relevant = req.topics.length ? notes.filter((n) => req.topics.includes(n.topic)) : notes
  const result = await generate(
    {
      schema: QuizSchema,
      instructions: `Write exam-quality questions for this exam, in the style and level of the real paper.
${examContext(exam)}

Student notes (primary source; also use standard syllabus knowledge for these topics):
${notesContext(relevant.length ? relevant : notes)}

Rules:
- Exactly ${req.count} questions.
- Allowed types: ${req.types.join(', ')}. "mcq" has 4 options and exactly one correct; "truefalse" has options ["True","False"]; "multi" has 4-5 options and 2 or more correct.
- Difficulty: ${req.difficulty === 'mixed' ? 'a realistic mix of easy, medium and hard' : req.difficulty}.
- Topics: ${req.topics.length ? req.topics.join('; ') : 'spread across the syllabus, weighted by importance'}. "topic" must copy a syllabus topic name exactly.
- ${req.mode === 'timed' ? 'This is a timed mock test: mirror the real exam pattern and spread.' : 'This is practice: favour questions that teach and expose common misconceptions.'}
- Distractors must be plausible. Vary the position of the correct answer.
- "explanation" teaches the underlying concept in 2-5 sentences. "optionExplanations" has one entry per option.
- Every answer must be unambiguous and factually correct. Double-check each one.`,
      request: `Create the ${req.mode === 'timed' ? 'mock test' : 'practice quiz'} now.${req.focus ? ` Extra instructions from the student: ${req.focus}` : ''}`,
      maxTokens: Math.min(64000, 4000 + req.count * 900),
    },
    opts,
  )
  // Drop any malformed question rather than show a broken one.
  result.questions = result.questions.filter(
    (q) =>
      q.options.length >= 2 &&
      q.correct.length > 0 &&
      q.correct.every((c) => Number.isInteger(c) && c >= 0 && c < q.options.length),
  )
  if (!result.questions.length) throw new AiError('bad-output', 'No usable questions came back. Please try again.')
  return result
}

export function generateTips(exam: Exam, notes: Note[], attempts: Attempt[], quizzes: Quiz[], opts?: CallOptions, coachChat: ChatMessage[] = []) {
  const perf = topicStats(attempts, quizzes)
  return generate(
    {
      schema: TipsSchema,
      instructions: `Create a personalised exam strategy for this student.
${examContext(exam)}
Today is ${today()}.${exam.examDate ? ` The exam is on ${exam.examDate}.` : ' The exam date is not set; plan for 4 weeks.'}

Notes covered so far: ${notes.map((n) => n.topic).join(', ') || 'none'}.
Practice accuracy by topic: ${perf.length ? perf.map((p) => `${p.topic} ${Math.round(p.accuracy * 100)}% of ${p.total}`).join('; ') : 'no attempts yet'}.

Rules:
- The study plan runs from today to the exam in sensible blocks (days if under 3 weeks away, otherwise weeks), ending with revision and mock tests.
- Prioritise high-weight topics and the student's weakest topics.
- Time management must use the real pattern (duration, question count, negative marking).
- Be specific and practical; no generic filler.`,
      source: coachChat.length
        ? { text: coachChat.slice(-20).map((m) => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n\n'), files: [] }
        : undefined,
      request: coachChat.length
        ? 'Write my updated exam strategy. Apply everything the student asked for and the coach agreed to in the conversation above (time available, dates, topics to add or drop, pace).'
        : 'Write my exam strategy.',
      maxTokens: 16000,
    },
    opts,
  )
}

export function generateFeedback(exam: Exam, quiz: Quiz, attempt: Attempt, opts?: CallOptions) {
  const lines = quiz.questions.map((q, i) => {
    const given = attempt.answers[q.id] ?? []
    const status = !given.length ? 'skipped' : sameSet(given, q.correct) ? 'correct' : 'wrong'
    return `${i + 1}. [${q.topic} | ${q.difficulty}] ${status}. Q: ${q.prompt} | chose: ${given.map((g) => q.options[g]).join(', ') || '-'} | answer: ${q.correct.map((c) => q.options[c]).join(', ')}`
  })
  return generate(
    {
      schema: FeedbackSchema,
      instructions: `Review this student's ${quiz.mode === 'timed' ? 'mock test' : 'quiz'} attempt and coach them.
${examContext(exam)}
Score: ${attempt.score}/${attempt.maxScore}; correct ${attempt.correct}, wrong ${attempt.wrong}, skipped ${attempt.skipped}; time ${Math.round((attempt.finishedAt - attempt.startedAt) / 60000)} min of ${quiz.durationMinutes}.
Look for patterns in the mistakes (concept gaps, careless errors, guessing under negative marking, time pressure). Be honest and kind.`,
      source: { text: lines.join('\n'), files: [] },
      request: 'Give me feedback on this attempt.',
      maxTokens: 8000,
    },
    opts,
  )
}

export function generateFlashcards(exam: Exam, note: Note, opts?: CallOptions) {
  return generate(
    {
      schema: FlashcardsSchema,
      instructions: `Write 10-20 new flashcards from this note for active recall. Short fronts, precise backs. "topic" must copy a syllabus topic name exactly when one fits.
${examContext(exam)}`,
      source: { text: notesContext([note]), files: [] },
      request: 'Write the flashcards.',
      maxTokens: 8000,
    },
    opts,
  )
}

/** Streaming chat: `rules` are the standing instructions, `history` the turns. */
async function streamChat(
  rules: string,
  history: ChatMessage[],
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; blocks?: unknown[] }> {
  const provider = currentProvider()
  if (provider === 'none') throw new AiError('no-ai', NO_AI_MESSAGE)
  const { model, depth } = getSettings()

  if (provider === 'claude') {
    // Keep the newest turns within the text budget; the rules turn always stays.
    const turns: SampleTurn[] = []
    let size = rules.length
    for (const m of [...history].reverse()) {
      if (size + m.text.length > 230_000) break
      size += m.text.length
      turns.unshift({ role: m.role, content: m.text })
    }
    try {
      const { text } = await getSample()!([{ role: 'user', content: rules }, ...turns], {
        cache: false,
        signal,
        modelTier: depth === 'deep' ? 'complex' : 'default',
        onText: ({ text }) => onText(text),
      })
      return { text }
    } catch (err) {
      throw sampleError(err)
    }
  }

  const messages: BetaMessageParam[] = history.map((m) =>
    m.role === 'assistant' && m.blocks?.length
      ? { role: 'assistant', content: m.blocks as BetaContentBlockParam[] }
      : { role: m.role, content: m.text },
  )
  try {
    const stream = apiClient().beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        system: [{ type: 'text', text: rules, cache_control: { type: 'ephemeral' } }],
        messages,
        output_config: { effort: depth === 'deep' ? 'medium' : 'low' },
        ...fallbackParams(model),
      },
      { signal },
    )
    stream.on('text', (_d, snapshot) => onText(snapshot))
    const msg = await stream.finalMessage()
    if (msg.stop_reason === 'refusal') throw new AiError('refusal', 'The AI declined to answer that. Try rephrasing.')
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const blocks = msg.content.filter((b) => b.type === 'text' || b.type === 'thinking' || b.type === 'redacted_thinking')
    return { text, blocks }
  } catch (err) {
    throw apiError(err)
  }
}

function chatRules(context: string) {
  return `${PERSONA}

${context}

Answer clearly using markdown (bullet lists, **bold** key terms, $LaTeX$ for maths; headings only when useful).`
}

/** Streaming tutor chat with the exam and notes as context. */
export function tutorReply(exam: Exam, notes: Note[], history: ChatMessage[], onText: (text: string) => void, signal?: AbortSignal) {
  const rules = chatRules(`You are chatting with a student preparing for this exam:
${examContext(exam)}

Their notes:
${notesContext(notes, currentProvider() === 'claude' ? 100_000 : Infinity)}

Ground answers in their notes where possible and say when you go beyond them. When asked to quiz them, ask one question at a time and wait for their answer.`)
  return streamChat(rules, history, onText, signal)
}

function planText(tips: ExamTips) {
  return [
    `Headline: ${tips.headline}`,
    tips.overview,
    `Priority topics: ${tips.priorityTopics.map((p) => `${p.topic} (${p.weight}): ${p.reason}`).join('; ')}`,
    `Study plan:\n${tips.studyPlan.map((b) => `- ${b.label} [${b.focus}]: ${b.tasks.join('; ')}`).join('\n')}`,
    `Strategies: ${tips.strategies.map((x) => `${x.title}: ${x.detail}`).join('; ')}`,
    `Time management: ${tips.timeManagement.join('; ')}`,
    `Common mistakes: ${tips.commonMistakes.join('; ')}`,
    `Exam-day checklist: ${tips.examDayChecklist.join('; ')}`,
  ].join('\n')
}

/** Streaming exam-prep coach chat about strategy, the study plan and progress. */
export function coachReply(
  exam: Exam,
  notes: Note[],
  attempts: Attempt[],
  quizzes: Quiz[],
  tips: ExamTips | null,
  history: ChatMessage[],
  onText: (text: string) => void,
  signal?: AbortSignal,
) {
  const perf = topicStats(attempts, quizzes)
  const rules = chatRules(`You are this student's exam-prep coach: strategy, planning, time management, revision technique, motivation and exam-day nerves.
${examContext(exam)}
Today is ${today()}.${exam.examDate ? ` The exam is on ${exam.examDate}.` : ' The exam date is not set.'}

Notes they have: ${notes.map((n) => `${n.title} [${n.organized ? 'organised' : 'raw'}]`).join('; ') || 'none yet'}.
Practice accuracy by topic: ${perf.length ? perf.map((p) => `${p.topic} ${Math.round(p.accuracy * 100)}% of ${p.total}`).join('; ') : 'no quizzes taken yet'}.
Recent attempts: ${attempts.slice(-5).map((a) => `${a.mode} ${a.score}/${a.maxScore}`).join('; ') || 'none'}.

${tips ? `Their current study plan and tips:\n${planText(tips)}` : 'They have not generated a study plan yet.'}

Be specific to their exam, dates and scores. Keep answers practical and fairly short. When you suggest changes to their plan, say exactly what changes; the app has an "Update my plan" button that rewrites the plan using this conversation.`)
  return streamChat(rules, history, onText, signal)
}

/** "Excuse shredder": funny tough love plus one tiny task to start right now. */
export function shredExcuse(excuse: string, exam: Exam | null, onText: (t: string) => void, signal?: AbortSignal) {
  const rules = chatRules(`The student is procrastinating and just typed their excuse for not studying.
${exam ? examContext(exam) : 'They have not set up an exam yet.'}
Today is ${today()}.${exam?.examDate ? ` Exam date: ${exam.examDate}.` : ''}

Reply in at most 3 short sentences: playfully roast the excuse (witty, warm, never mean, never about their worth), then give ONE concrete task they can start in the next 60 seconds that takes 5-15 minutes, using their exam topics where you can. No headings or lists. End with a short punchy call to action.`)
  return streamChat(rules, [{ id: 'x', role: 'user', text: excuse }], onText, signal)
}

// ---------- scoring helpers (shared by UI) ----------

export function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function topicStats(attempts: Attempt[], quizzes: Quiz[]) {
  const map = new Map<string, { correct: number; total: number }>()
  for (const a of attempts) {
    const quiz = quizzes.find((q) => q.id === a.quizId)
    if (!quiz) continue
    for (const q of quiz.questions) {
      const s = map.get(q.topic) ?? { correct: 0, total: 0 }
      s.total++
      if (sameSet(a.answers[q.id] ?? [], q.correct)) s.correct++
      map.set(q.topic, s)
    }
  }
  return [...map.entries()]
    .map(([topic, s]) => ({ topic, ...s, accuracy: s.total ? s.correct / s.total : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy)
}
