import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'

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
  if (score >= 75) return 'text-emerald-700'
  if (score >= 50) return 'text-amber-700'
  return 'text-rose-700'
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'bg-amber-50 border-amber-200'
  return 'bg-rose-50 border-rose-200'
}

function categoryBadge(cat: string): { bg: string; color: string } {
  switch (cat) {
    case 'technical':
      return { bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700' }
    case 'behavioral':
      return { bg: 'bg-slate-100 border-slate-200', color: 'text-slate-800' }
    case 'situational':
      return { bg: 'bg-teal-50 border-teal-200', color: 'text-teal-700' }
    default:
      return { bg: 'bg-slate-100 border-slate-200', color: 'text-slate-700' }
  }
}

type InterviewMode = 'video' | 'voice' | 'text'

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

  // ── media ──
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef<unknown>(null)

  // ── load previous ──
  const loadLatest = useCallback(async () => {
    try {
      const prev = await interviewService.fetchLatestInterview()
      if (prev) setInterview(prev)
    } catch {
      /* no previous interview */
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
      setError('Camera access denied. Please verify your browser camera permissions.')
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
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getAudioTracks().forEach((t) => mediaStreamRef.current?.addTrack(t))
        }
      }
      setMicOn(true)
    } catch {
      setError('Microphone access denied. Please check permissions.')
    }
  }

  /* ── speech synthesis (question reader) ───────────────────────────────── */

  function speakQuestion(text: string) {
    if (!('speechSynthesis' in window)) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.95
    utter.onend = () => setIsSpeaking(false)
    utter.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utter)
  }

  /* ── speech recognition (voice answers) ──────────────────────────────── */

  function toggleSpeechRecognition(questionId: string) {
    const SpeechRecognitionAPI =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser. Please type your response.')
      return
    }

    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(recognitionRef.current as any)?.stop()
      setIsListening(false)
      return
    }

    try {
      const rec = new SpeechRecognitionAPI()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' '
          }
        }
        if (final) {
          setAnswers((prev) => ({
            ...prev,
            [questionId]: (prev[questionId] ? prev[questionId] + ' ' : '') + final.trim(),
          }))
        }
      }

      rec.onerror = () => setIsListening(false)
      rec.onend = () => setIsListening(false)

      recognitionRef.current = rec
      rec.start()
      setIsListening(true)
    } catch {
      setError('Could not initialize speech recognition.')
    }
  }

  /* ── prefill from profile & skill gap ────────────────────────────────── */

  async function handleImportContext() {
    setIsImporting(true)
    setError(null)
    setImportNotice(null)
    try {
      const [profile, gap] = await Promise.all([
        profileService.fetchProfile().catch(() => null),
        skillGapService.fetchLatestSkillGap().catch(() => null),
      ])

      if (profile) {
        setTargetRole(profile.target_role || '')
        setExperienceLevel(profile.experience_level || 'student')
        if (profile.skills.length > 0) {
          setFocusSkills(profile.skills.slice(0, 5).join(', '))
        }
        setImportNotice(`Imported profile (${profile.target_role || 'General'})`)
      }

      if (gap) {
        const missing = [
          ...gap.analysis.missing_technical_skills,
          ...gap.analysis.missing_soft_skills,
        ]
        if (missing.length > 0) {
          setFocusSkills(missing.slice(0, 5).join(', '))
          setImportNotice((prev) => (prev ? `${prev} + Skill Gaps` : 'Imported from Skill Gap'))
        }
      }
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsImporting(false)
    }
  }

  /* ── generate interview ──────────────────────────────────────────────── */

  async function handleStartInterview() {
    if (!targetRole.trim()) {
      setError('Please provide a target role for the interview.')
      return
    }

    setIsLoading(true)
    setError(null)
    setImportNotice(null)

    const skillsList = focusSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const res = await interviewService.startInterview({
        target_role: targetRole.trim(),
        experience_level: experienceLevel,
        question_count: questionCount,
        focus_skills: skillsList,
      })

      setInterview(res)
      setCurrentIdx(0)
      setAnswers({})
      setExpandedHint(null)

      if (mode === 'video') {
        toggleCamera()
      }
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }

  /* ── submit answers for AI evaluation ────────────────────────────────── */

  async function handleSubmitInterview() {
    if (!interview) return

    setIsSubmitting(true)
    setError(null)

    const payloadAnswers: UserAnswer[] = interview.questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id]?.trim() || '',
    }))

    try {
      const evaluated = await interviewService.submitInterview(interview.id, {
        answers: payloadAnswers,
      })
      setInterview(evaluated)

      // Stop camera / mic after completion
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      setCameraOn(false)
      setMicOn(false)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const questions = interview?.questions || []
  const currentQ: InterviewQuestion | undefined = questions[currentIdx]
  const isEvaluated = interview?.status === 'evaluated'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Mock Interview Simulation
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            Practice role-specific technical and behavioral interviews with real-time video/voice support and AI feedback.
          </p>
        </div>

        {interview && (
          <button
            type="button"
            onClick={() => {
              setInterview(null)
              setCurrentIdx(0)
              setAnswers({})
            }}
            className="btn-secondary self-start sm:self-auto text-xs py-1.5 px-3"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>New Simulation</span>
          </button>
        )}
      </div>

      {/* ── Setup Lobby (when no active session) ─────────────────────────── */}
      {!interview && (
        <div className="clean-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Configure Simulation</h2>
              <p className="text-xs text-slate-500">
                Choose target role, experience level, and preferred practice format.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImportContext}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition shrink-0"
            >
              <Zap className="h-3.5 w-3.5 text-slate-600" />
              <span>{isImporting ? 'Importing…' : 'Import from Profile & Gap'}</span>
            </button>
          </div>

          {importNotice && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{importNotice}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Target Role <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, DevOps Engineer"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              >
                <option value="student">Student / Intern</option>
                <option value="fresh-graduate">Fresh Graduate (0-1 yrs)</option>
                <option value="early-career">Early Career (1-3 yrs)</option>
                <option value="mid-level">Mid Level (3-5 yrs)</option>
                <option value="senior">Senior (5+ yrs)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Focus Skills / Topics (Optional)
              </label>
              <input
                type="text"
                value={focusSkills}
                onChange={(e) => setFocusSkills(e.target.value)}
                placeholder="e.g. React, System Design, SQL, Docker"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Number of Questions ({questionCount})
              </label>
              <input
                type="range"
                min={2}
                max={5}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer mt-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>2 Questions (Fast)</span>
                <span>3 Questions (Standard)</span>
                <span>5 Questions (Comprehensive)</span>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="pt-2">
            <label className="block font-medium text-slate-700 mb-2 text-xs">Interview Mode</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  id: 'video',
                  label: 'Video & Voice',
                  desc: 'Webcam feed with voice dictation & speech playback',
                  icon: Video,
                },
                {
                  id: 'voice',
                  label: 'Voice Only',
                  desc: 'Audio speech playback with microphone voice answers',
                  icon: Mic,
                },
                {
                  id: 'text',
                  label: 'Standard Text',
                  desc: 'Classic typing format with structured AI scoring',
                  icon: ArrowRight,
                },
              ].map((m) => {
                const Icon = m.icon
                const isSelected = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id as InterviewMode)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1.5 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold text-slate-900">{m.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{m.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleStartInterview}
              disabled={isLoading || !targetRole.trim()}
              className="btn-primary text-xs py-2 px-4"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Preparing questions…</span>
                </>
              ) : (
                <>
                  <Video className="h-3.5 w-3.5" />
                  <span>Start Interview</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Studio / Evaluation Screen ─────────────────────────────── */}
      {interview && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Session Progress Bar */}
          <div className="clean-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Session: {interview.target_role}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {isEvaluated ? 'Evaluation Scorecard' : `Question ${currentIdx + 1} of ${questions.length}`}
                </h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                  {interview.experience_level}
                </span>
              </div>
            </div>

            {!isEvaluated && (
              <div className="flex items-center gap-1.5">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-7 w-7 rounded-md font-semibold text-xs transition ${
                      currentIdx === idx
                        ? 'bg-slate-900 text-white shadow-xs'
                        : answers[q.id]?.trim()
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Active Question & Stage View ──────────────────────────────── */}
          {!isEvaluated && currentQ && (
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              {/* Left Media Stage */}
              <div className="lg:col-span-5 space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-900 bg-slate-950 aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
                  />

                  {!cameraOn && (
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-1.5 p-4 text-center">
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                        <VideoOff className="h-5 w-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-medium text-white">Camera off</p>
                      <p className="text-[10px] text-slate-400">
                        Enable camera for simulated video interview.
                      </p>
                    </div>
                  )}

                  {/* Live Recording Badge */}
                  {cameraOn && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      <span>LIVE</span>
                    </div>
                  )}
                </div>

                {/* Media Control Toolbar */}
                <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      cameraOn
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                    <span>{cameraOn ? 'Stop Camera' : 'Start Camera'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      micOn
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    <span>{micOn ? 'Mute Mic' : 'Unmute Mic'}</span>
                  </button>
                </div>
              </div>

              {/* Right Active Question & Answer Box */}
              <div className="lg:col-span-7 space-y-4">
                <div className="clean-card p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                        categoryBadge(currentQ.category).bg
                      } ${categoryBadge(currentQ.category).color}`}
                    >
                      {currentQ.category}
                    </span>

                    <button
                      type="button"
                      onClick={() => speakQuestion(currentQ.question)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        isSpeaking
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      <span>{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
                    </button>
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {currentQ.question}
                  </h3>

                  {/* Collapsible Hints */}
                  {currentQ.hint && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHint(expandedHint === currentQ.id ? null : currentQ.id)
                        }
                        className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-800"
                      >
                        <span className="flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                          <span>AI Answer Guidance & Hint</span>
                        </span>
                        {expandedHint === currentQ.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {expandedHint === currentQ.id && (
                        <p className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
                          {currentQ.hint}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Answer Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span>Your Response:</span>
                      <button
                        type="button"
                        onClick={() => toggleSpeechRecognition(currentQ.id)}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition ${
                          isListening
                            ? 'bg-rose-100 text-rose-700 animate-pulse'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Mic className="h-3 w-3" />
                        <span>{isListening ? 'Listening…' : 'Dictate with Voice'}</span>
                      </button>
                    </div>

                    <textarea
                      rows={6}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                      }
                      placeholder="Type or dictate your response..."
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
                    />

                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>
                        Words: {(answers[currentQ.id] || '').trim().split(/\s+/).filter(Boolean).length}
                      </span>
                      <span>Evaluated for structure, depth, and relevance</span>
                    </div>
                  </div>

                  {/* Navigation Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                      className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                        className="btn-primary text-xs py-1.5 px-4"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitInterview}
                        disabled={isSubmitting}
                        className="btn-primary text-xs py-1.5 px-4"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Evaluating…</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Submit for Evaluation</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Evaluated Scorecard View ───────────────────────────────────── */}
          {isEvaluated && interview.feedback && (
            <div className="space-y-5 animate-fade-in">
              {/* Scorecard Hero */}
              <div className="clean-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Interview Assessment
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">{interview.target_role}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluated across clarity, relevance, and technical precision using Qwen-Max.
                  </p>
                </div>

                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 font-bold text-xl shadow-xs ${scoreBg(
                      interview.feedback.overall_score
                    )}`}
                  >
                    <span className={scoreColor(interview.feedback.overall_score)}>
                      {interview.feedback.overall_score}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Readiness Status
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {interview.feedback.overall_score >= 75
                        ? 'Interview Ready'
                        : interview.feedback.overall_score >= 50
                        ? 'Solid Foundation'
                        : 'Needs Practice'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback Summary Callout */}
              {interview.feedback.summary && (
                <div className="clean-card p-5 space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Overall Interview Feedback
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {interview.feedback.summary}
                  </p>
                </div>
              )}

              {/* Recommended Actions */}
              {interview.feedback.recommended_actions && interview.feedback.recommended_actions.length > 0 && (
                <div className="clean-card p-5 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                    Recommended Next Actions
                  </h3>
                  <ul className="space-y-1.5">
                    {interview.feedback.recommended_actions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question-by-Question Detailed Evaluations */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Question-by-Question Breakdown</h3>

                {interview.feedback.evaluations.map((qEval, idx) => {
                  const matchingQ = interview.questions.find((q) => q.id === qEval.question_id)

                  return (
                    <div
                      key={qEval.question_id}
                      className="clean-card p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 font-semibold text-xs text-slate-800 border border-slate-200">
                            {idx + 1}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-900">
                            {matchingQ?.question || `Question ${idx + 1}`}
                          </h4>
                        </div>
                        <span className={`text-xs font-bold ${scoreColor(qEval.score)} self-start sm:self-auto`}>
                          Score: {qEval.score}/100
                        </span>
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        {qEval.strengths.length > 0 && (
                          <div className="bg-emerald-50/40 border border-emerald-200/80 p-3 rounded-lg space-y-1">
                            <span className="font-semibold text-emerald-900 text-[10px] uppercase tracking-wider">Strengths</span>
                            <ul className="space-y-1 text-slate-700 text-[11px]">
                              {qEval.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {qEval.improvements.length > 0 && (
                          <div className="bg-rose-50/40 border border-rose-200/80 p-3 rounded-lg space-y-1">
                            <span className="font-semibold text-rose-900 text-[10px] uppercase tracking-wider">Areas to Improve</span>
                            <ul className="space-y-1 text-slate-700 text-[11px]">
                              {qEval.improvements.map((imp, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                                  <span>{imp}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {qEval.ideal_answer && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                          <span className="font-semibold text-slate-800">Ideal Answer Outline: </span>
                          <p className="text-slate-600 leading-relaxed">{qEval.ideal_answer}</p>
                        </div>
                      )}

                      {matchingQ && answers[matchingQ.id] && (
                        <div className="text-[11px] text-slate-500 pt-1">
                          <span className="font-semibold text-slate-700">Your Answer: </span>
                          <span>{answers[matchingQ.id]}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
