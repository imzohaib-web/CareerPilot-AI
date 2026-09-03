import { useCallback, useEffect, useRef, useState } from 'react'

import { describeApiError } from '../services/apiClient'
import * as interviewService from '../services/interview'
import * as profileService from '../services/profile'
import * as skillGapService from '../services/skillGap'
import type {
  InterviewQuestion,
  InterviewResponse,
  UserAnswer,
} from '../types'

/* ── helpers ────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function scoreRingColor(score: number): string {
  if (score >= 75) return 'border-emerald-500 bg-emerald-50'
  if (score >= 50) return 'border-amber-500 bg-amber-50'
  return 'border-red-500 bg-red-50'
}

function categoryBadge(cat: string): string {
  switch (cat) {
    case 'technical':
      return 'bg-blue-100 text-blue-800'
    case 'behavioral':
      return 'bg-purple-100 text-purple-800'
    case 'situational':
      return 'bg-teal-100 text-teal-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

type InterviewMode = 'video' | 'voice' | 'text'

/* ── component ──────────────────────────────────────────────────────────── */

export function MockInterviewPage() {
  // ── lobby / config ──
  const [targetRole, setTargetRole] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('student')
  const [questionCount, setQuestionCount] = useState(3)
  const [focusSkills, setFocusSkills] = useState('')
  const [mode, setMode] = useState<InterviewMode>('video')

  // ── state ──
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [interview, setInterview] = useState<InterviewResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [expandedHint, setExpandedHint] = useState<string | null>(null)
  const [expandedEval, setExpandedEval] = useState<string | null>(null)

  // ── media ──
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef</* SpeechRecognition */ unknown>(null)

  // ── load previous ──
  const loadLatest = useCallback(async () => {
    try {
      const prev = await interviewService.fetchLatestInterview()
      if (prev) setInterview(prev)
    } catch {
      /* no previous interview — that's fine */
    }
  }, [])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  // ── cleanup media on unmount ──
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(recognitionRef.current as any)?.abort?.()
      window.speechSynthesis?.cancel()
    }
  }, [])

  /* ── camera ──────────────────────────────────────────────────────────── */

  async function toggleCamera() {
    if (cameraOn) {
      mediaStreamRef.current?.getVideoTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      setCameraOn(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: micOn,
      })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraOn(true)
    } catch {
      setError('Camera access denied. Please allow camera permissions.')
    }
  }

  async function toggleMic() {
    if (micOn) {
      mediaStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = false
      })
      setMicOn(false)
      return
    }
    try {
      if (!mediaStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
      } else {
        const audioTracks = mediaStreamRef.current.getAudioTracks()
        if (audioTracks.length > 0) {
          audioTracks.forEach((t) => {
            t.enabled = true
          })
        } else {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          })
          audioStream
            .getAudioTracks()
            .forEach((t) => mediaStreamRef.current?.addTrack(t))
        }
      }
      setMicOn(true)
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.')
    }
  }

  /* ── speech-to-text (voice answering) ───────────────────────────────── */

  function startVoiceInput(questionId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    const SpeechRecognitionCtor =
      win.SpeechRecognition ?? win.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser.')
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setAnswers((prev) => ({ ...prev, [questionId]: transcript }))
    }
    recognition.onerror = () => {
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function stopVoiceInput() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recognitionRef.current as any)?.stop?.()
    setIsListening(false)
  }

  /* ── text-to-speech (AI reads question) ─────────────────────────────── */

  function speakQuestion(text: string) {
    if (!window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  /* ── import from profile / skill gap ────────────────────────────────── */

  async function handleImport() {
    setIsImporting(true)
    setError(null)
    setImportNotice(null)
    try {
      const gapDoc = await skillGapService.fetchLatestSkillGap()
      if (gapDoc) {
        setTargetRole(gapDoc.target_role)
        const skills = [
          ...gapDoc.analysis.missing_technical_skills,
          ...gapDoc.analysis.missing_soft_skills,
        ]
        setFocusSkills(skills.join(', '))
        setImportNotice('Imported from Skill Gap Analysis ✓')
        setIsImporting(false)
        return
      }
    } catch {
      /* fallthrough to profile */
    }
    try {
      const profile = await profileService.fetchProfile()
      if (profile) {
        setTargetRole(profile.target_role || '')
        setFocusSkills((profile.skills || []).join(', '))
        setExperienceLevel(profile.experience_level || 'student')
        setImportNotice('Imported from Career Profile ✓')
      }
    } catch {
      setError('No profile or skill gap analysis found to import.')
    }
    setIsImporting(false)
  }

  /* ── start interview ────────────────────────────────────────────────── */

  async function handleStart() {
    if (!targetRole.trim()) {
      setError('Please enter a target role.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const resp = await interviewService.startInterview({
        target_role: targetRole.trim(),
        experience_level: experienceLevel,
        question_count: questionCount,
        focus_skills: focusSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setInterview(resp)
      setAnswers({})
      setCurrentIdx(0)
      // Auto-speak first question
      if (mode !== 'text' && resp.questions.length > 0) {
        setTimeout(() => speakQuestion(resp.questions[0].question), 500)
      }
      // Auto-start camera in video mode
      if (mode === 'video' && !cameraOn) {
        toggleCamera()
      }
    } catch (err) {
      setError(describeApiError(err).message)
    }
    setIsLoading(false)
  }

  /* ── submit answers ─────────────────────────────────────────────────── */

  async function handleSubmit() {
    if (!interview) return
    setIsSubmitting(true)
    setError(null)
    stopVoiceInput()
    window.speechSynthesis?.cancel()
    try {
      const answerPayload: UserAnswer[] = interview.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || '',
      }))
      const resp = await interviewService.submitInterview(interview.id, {
        answers: answerPayload,
      })
      setInterview(resp)
      // Stop camera after submission
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      setCameraOn(false)
    } catch (err) {
      setError(describeApiError(err).message)
    }
    setIsSubmitting(false)
  }

  /* ── navigate questions ─────────────────────────────────────────────── */

  function goToQuestion(idx: number) {
    stopVoiceInput()
    setCurrentIdx(idx)
    if (
      mode !== 'text' &&
      interview?.questions[idx]
    ) {
      setTimeout(() => speakQuestion(interview.questions[idx].question), 300)
    }
  }

  function handleRetake() {
    setInterview(null)
    setAnswers({})
    setCurrentIdx(0)
    setError(null)
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    setCameraOn(false)
    setMicOn(false)
  }

  const currentQuestion: InterviewQuestion | undefined =
    interview?.questions[currentIdx]
  const isActiveInterview =
    interview?.status === 'in_progress' && interview.questions.length > 0
  const isCompleted = interview?.status === 'completed' && interview.feedback

  /* ───────────────────────────────────────────────────────────────────── */
  /* ── RENDER ─────────────────────────────────────────────────────────── */
  /* ───────────────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎙️</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            AI Mock Interview
          </h1>
          <p className="text-sm text-gray-500">
            Practice realistic interviews with AI-powered question generation,
            voice interaction, and STAR evaluation
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* ═══════════════ LOBBY / CONFIG ═══════════════ */}
      {!isActiveInterview && !isCompleted && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              🏢 Interview Setup
            </h2>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
            >
              {isImporting ? '⏳ Importing…' : '⚡ Import from Profile / Skill Gap'}
            </button>
          </div>

          {importNotice && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {importNotice}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Target Role *
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Backend Engineer"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="student">Student / Fresh Graduate</option>
                <option value="junior">Junior (0-2 years)</option>
                <option value="mid">Mid-Level (2-5 years)</option>
                <option value="senior">Senior (5+ years)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Focus Skills / Topics
            </label>
            <input
              type="text"
              value={focusSkills}
              onChange={(e) => setFocusSkills(e.target.value)}
              placeholder="e.g. Python, FastAPI, System Design"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Number of Questions: {questionCount}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>1</span>
                <span>3</span>
                <span>5</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Interview Mode
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'video', label: '🎥 Video', desc: 'Camera + Voice' },
                    { id: 'voice', label: '🎙️ Voice', desc: 'Voice Only' },
                    { id: 'text', label: '⌨️ Text', desc: 'Silent / Quiet' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium transition ${
                      mode === m.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div>{m.label}</div>
                    <div className="mt-0.5 text-[10px] opacity-70">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isLoading || !targetRole.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="60 20" />
                </svg>
                Generating Questions…
              </span>
            ) : (
              '🚀 Start Mock Interview'
            )}
          </button>
        </div>
      )}

      {/* ═══════════════ ACTIVE INTERVIEW STUDIO ═══════════════ */}
      {isActiveInterview && currentQuestion && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT PANEL — Question & Answer */}
          <div className="lg:col-span-2 space-y-4">
            {/* Progress stepper */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Question {currentIdx + 1} of {interview.questions.length}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadge(currentQuestion.category)}`}
                >
                  {currentQuestion.category}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${((currentIdx + 1) / interview.questions.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.question}
                </p>
                {mode !== 'text' && (
                  <button
                    onClick={() => speakQuestion(currentQuestion.question)}
                    disabled={isSpeaking}
                    className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isSpeaking
                        ? 'border-blue-300 bg-blue-50 text-blue-600 animate-pulse'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Listen to question"
                  >
                    {isSpeaking ? '🔊 Speaking…' : '🔊 Listen'}
                  </button>
                )}
              </div>

              {/* Hint drawer */}
              {currentQuestion.hint && (
                <div>
                  <button
                    onClick={() =>
                      setExpandedHint(
                        expandedHint === currentQuestion.id
                          ? null
                          : currentQuestion.id
                      )
                    }
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {expandedHint === currentQuestion.id
                      ? '▼ Hide Tip'
                      : '💡 Show Tip / STAR Guidance'}
                  </button>
                  {expandedHint === currentQuestion.id && (
                    <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                      {currentQuestion.hint}
                    </div>
                  )}
                </div>
              )}

              {/* Answer input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Your Answer
                  </label>
                  <div className="flex items-center gap-2">
                    {mode !== 'text' && (
                      <button
                        onClick={() =>
                          isListening
                            ? stopVoiceInput()
                            : startVoiceInput(currentQuestion.id)
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          isListening
                            ? 'border-red-300 bg-red-50 text-red-600 animate-pulse'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {isListening ? '⏹️ Stop Recording' : '🎤 Speak Answer'}
                      </button>
                    )}
                    <span className="text-xs text-gray-400">
                      {(answers[currentQuestion.id] || '').split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: e.target.value,
                    }))
                  }
                  placeholder={
                    mode === 'text'
                      ? 'Type your answer here…'
                      : 'Speak your answer or type here…'
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => goToQuestion(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                  ← Previous
                </button>

                <div className="flex gap-1.5">
                  {interview.questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToQuestion(i)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        i === currentIdx
                          ? 'bg-blue-500 scale-125'
                          : answers[interview.questions[i].id]
                            ? 'bg-emerald-400'
                            : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>

                {currentIdx < interview.questions.length - 1 ? (
                  <button
                    onClick={() => goToQuestion(currentIdx + 1)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? '⏳ Evaluating…' : '✅ Submit Interview'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — Webcam Studio */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-900 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE INTERVIEW
                </span>
                <span className="text-xs text-gray-500">
                  {interview.target_role}
                </span>
              </div>
              {/* Video feed */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-800">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-full w-full object-cover ${
                    cameraOn ? '' : 'hidden'
                  }`}
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!cameraOn && (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-3xl">
                        👤
                      </div>
                      <p className="text-xs text-gray-400">Camera Off</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Media controls */}
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  onClick={toggleCamera}
                  className={`rounded-full p-2.5 text-sm transition ${
                    cameraOn
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                  title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {cameraOn ? '🎥' : '📷'}
                </button>
                <button
                  onClick={toggleMic}
                  className={`rounded-full p-2.5 text-sm transition ${
                    micOn
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                  title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {micOn ? '🎙️' : '🔇'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="rounded-full bg-red-600 p-2.5 text-sm text-white hover:bg-red-500 disabled:opacity-50 transition"
                  title="End Interview"
                >
                  📞
                </button>
              </div>
            </div>

            {/* AI Interviewer panel */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                    isSpeaking
                      ? 'bg-blue-100 animate-pulse'
                      : 'bg-gray-100'
                  }`}
                >
                  🤖
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    AI Interviewer
                  </p>
                  <p className="text-xs text-gray-500">
                    {isSpeaking
                      ? '🔊 Speaking…'
                      : isListening
                        ? '👂 Listening…'
                        : 'Waiting for response'}
                  </p>
                </div>
              </div>

              {/* Question list sidebar */}
              <div className="space-y-1.5">
                {interview.questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(i)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                      i === currentIdx
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : answers[q.id]
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">Q{i + 1}.</span>{' '}
                    {q.question.slice(0, 50)}
                    {q.question.length > 50 ? '…' : ''}
                    {answers[q.id] && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ FEEDBACK / RESULTS ═══════════════ */}
      {isCompleted && interview.feedback && (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
              <div
                className={`flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full border-4 ${scoreRingColor(interview.feedback.overall_score)}`}
              >
                <div className="text-center">
                  <p
                    className={`text-3xl font-bold ${scoreColor(interview.feedback.overall_score)}`}
                  >
                    {interview.feedback.overall_score}
                  </p>
                  <p className="text-xs text-gray-500">/ 100</p>
                </div>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-gray-900">
                  Interview Performance
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {interview.target_role} • {interview.questions.length} questions
                </p>
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                  {interview.feedback.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Per-question evaluations */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">
              📝 Question-by-Question Breakdown
            </h3>
            {interview.feedback.evaluations.map((ev) => {
              const question = interview.questions.find(
                (q) => q.id === ev.question_id
              )
              const answer = interview.answers?.find(
                (a) => a.question_id === ev.question_id
              )
              const isExpanded = expandedEval === ev.question_id

              return (
                <div
                  key={ev.question_id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedEval(isExpanded ? null : ev.question_id)
                    }
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${scoreRingColor(ev.score)}`}
                      >
                        <span
                          className={`text-sm font-bold ${scoreColor(ev.score)}`}
                        >
                          {ev.score}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {question?.question || ev.question_id}
                        </p>
                        <span
                          className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryBadge(question?.category || '')}`}
                        >
                          {question?.category || ''}
                        </span>
                      </div>
                    </div>
                    <span className="ml-2 text-gray-400">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* User's answer */}
                      {answer && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">
                            Your Answer
                          </p>
                          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                            {answer.answer || '(No answer provided)'}
                          </p>
                        </div>
                      )}

                      {/* Strengths */}
                      {ev.strengths.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-emerald-600 uppercase">
                            ✅ Strengths
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ev.strengths.map((s, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Improvements */}
                      {ev.improvements.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-amber-600 uppercase">
                            ⚡ Areas to Improve
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ev.improvements.map((im, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700"
                              >
                                {im}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ideal answer */}
                      {ev.ideal_answer && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-blue-600 uppercase">
                            💡 Ideal Answer Benchmark
                          </p>
                          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                            {ev.ideal_answer}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recommended actions */}
          {interview.feedback.recommended_actions.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">
                🎯 Recommended Next Steps
              </h3>
              <ul className="space-y-2">
                {interview.feedback.recommended_actions.map((action, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-0.5 text-blue-500">→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Retake */}
          <div className="flex justify-center">
            <button
              onClick={handleRetake}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              🔄 Retake Interview / Practice Another Role
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
