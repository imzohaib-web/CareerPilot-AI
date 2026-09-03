import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Sparkles,
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
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-rose-600'
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
      return { bg: 'bg-purple-50 border-purple-200', color: 'text-purple-700' }
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
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          audioStream.getAudioTracks().forEach((t) => {
            mediaStreamRef.current?.addTrack(t)
          })
        }
      }
      setMicOn(true)
    } catch {
      setError('Microphone access denied. Please verify your microphone permissions.')
    }
  }

  /* ── speech recognition (Web Speech API) ──────────────────────────────── */

  function toggleSpeechRecognition(questionId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please type your answer.')
      return
    }

    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(recognitionRef.current as any)?.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' '
        }
        setAnswers((prev) => ({
          ...prev,
          [questionId]: (prev[questionId] ? prev[questionId] + ' ' : '') + transcript.trim(),
        }))
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
    } catch {
      setError('Could not start speech recognition.')
    }
  }

  /* ── text to speech (AI reads question) ──────────────────────────────── */

  function speakQuestion(text: string) {
    if (!('speechSynthesis' in window)) {
      setError('Text-to-speech is not supported in this browser.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  /* ── import from profile / gap ───────────────────────────────────────── */

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
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Alibaba Cloud Qwen AI Simulator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            AI Mock Interview Studio
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Simulate realistic technical and behavioral interviews with real-time video/voice support and deep AI scoring.
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition self-start sm:self-auto"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>New Simulation</span>
          </button>
        )}
      </div>

      {/* ── Setup Lobby (when no active session) ─────────────────────────── */}
      {!interview && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Configure Interview Simulation</h2>
              <p className="text-xs text-slate-500">
                Choose your role, level, question format, and interview mode.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImportContext}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-200 px-3.5 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition shrink-0"
            >
              <Zap className="h-3.5 w-3.5 text-brand-600" />
              <span>{isImporting ? 'Importing…' : 'Import from Profile & Gap'}</span>
            </button>
          </div>

          {importNotice && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{importNotice}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Role <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, DevOps Engineer"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              >
                <option value="student">Student / Intern</option>
                <option value="fresh-graduate">Fresh Graduate (0-1 yrs)</option>
                <option value="early-career">Early Career (1-3 yrs)</option>
                <option value="mid-level">Mid Level (3-5 yrs)</option>
                <option value="senior">Senior (5+ yrs)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Focus Skills / Topics (Optional)
              </label>
              <input
                type="text"
                value={focusSkills}
                onChange={(e) => setFocusSkills(e.target.value)}
                placeholder="e.g. React, System Design, REST APIs, Leadership"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Number of Questions</span>
                <span className="text-brand-600">{questionCount} Questions</span>
              </div>
              <input
                type="range"
                min={2}
                max={5}
                step={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>2 (Quick)</span>
                <span>3 (Standard)</span>
                <span>5 (Comprehensive)</span>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="block text-xs font-bold text-slate-700">Interview Mode</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'video' as const, label: 'Video Studio', desc: 'Camera + Audio + Speech-to-Text', icon: Video },
                { id: 'voice' as const, label: 'Voice Mode', desc: 'Audio recording & Voice dictation', icon: Mic },
                { id: 'text' as const, label: 'Text Focus', desc: 'Fast written response mode', icon: Sparkles },
              ].map((m) => {
                const Icon = m.icon
                const isSelected = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-900">{m.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{m.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleStartInterview}
              disabled={isLoading || !targetRole.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Preparing AI Questions…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Start Interview Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Studio / Evaluation Screen ─────────────────────────────── */}
      {interview && (
        <div className="space-y-8 animate-fade-in">
          {/* Top Session Progress Bar */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Session: {interview.target_role}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {isEvaluated ? 'Evaluation Scorecard' : `Question ${currentIdx + 1} of ${questions.length}`}
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                  {interview.experience_level}
                </span>
              </div>
            </div>

            {!isEvaluated && (
              <div className="flex items-center gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-8 w-8 rounded-xl font-bold text-xs transition ${
                      currentIdx === idx
                        ? 'bg-brand-600 text-white shadow-xs'
                        : answers[q.id]?.trim()
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
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
            <div className="grid gap-8 lg:grid-cols-12 items-start">
              {/* Left Media Stage */}
              <div className="lg:col-span-5 space-y-4">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-950 aspect-video flex items-center justify-center shadow-card">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
                  />

                  {!cameraOn && (
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-2 p-6 text-center">
                      <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                        <VideoOff className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-white">Camera is currently off</p>
                      <p className="text-[10px] text-slate-400">
                        Enable camera for an authentic video interview experience.
                      </p>
                    </div>
                  )}

                  {/* Live Recording Badge */}
                  {cameraOn && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      <span>LIVE</span>
                    </div>
                  )}
                </div>

                {/* Media Control Toolbar */}
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      cameraOn
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    <span>{cameraOn ? 'Stop Camera' : 'Start Camera'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      micOn
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    <span>{micOn ? 'Mute Mic' : 'Unmute Mic'}</span>
                  </button>
                </div>
              </div>

              {/* Right Active Question & Answer Box */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        categoryBadge(currentQ.category).bg
                      } ${categoryBadge(currentQ.category).color}`}
                    >
                      {currentQ.category}
                    </span>

                    <button
                      type="button"
                      onClick={() => speakQuestion(currentQ.question)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        isSpeaking
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      <span>{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
                    </button>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {currentQ.question}
                  </h3>

                  {/* Collapsible Hints */}
                  {currentQ.hint && (
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHint(expandedHint === currentQ.id ? null : currentQ.id)
                        }
                        className="flex items-center justify-between w-full text-left text-xs font-bold text-brand-900"
                      >
                        <span className="flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4 text-brand-600" />
                          <span>AI Answer Guidance & Hint</span>
                        </span>
                        {expandedHint === currentQ.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {expandedHint === currentQ.id && (
                        <p className="mt-3 pt-2 border-t border-brand-100 text-xs text-brand-950 leading-relaxed">
                          {currentQ.hint}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Answer Textarea */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Your Response:</span>
                      <button
                        type="button"
                        onClick={() => toggleSpeechRecognition(currentQ.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          isListening
                            ? 'bg-rose-100 text-rose-700 animate-pulse'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>{isListening ? 'Listening… (Click to stop)' : 'Dictate with Voice'}</span>
                      </button>
                    </div>

                    <textarea
                      rows={6}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                      }
                      placeholder="Type or dictate your response to the question..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none leading-relaxed"
                    />

                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>
                        Words: {(answers[currentQ.id] || '').trim().split(/\s+/).filter(Boolean).length}
                      </span>
                      <span>Qwen will evaluate structure, relevance, and depth</span>
                    </div>
                  </div>

                  {/* Navigation / Next Question Action */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitInterview}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Evaluating Responses…</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            <span>Submit for AI Evaluation</span>
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
            <div className="space-y-8 animate-fade-in">
              {/* Scorecard Hero */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Final Interview Assessment
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-1">{interview.target_role}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Evaluated across clarity, relevance, and technical precision using Qwen-Max.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-4 font-black text-2xl shadow-sm ${scoreBg(
                      interview.feedback.overall_score
                    )}`}
                  >
                    <span className={scoreColor(interview.feedback.overall_score)}>
                      {interview.feedback.overall_score}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Readiness Status
                    </span>
                    <p className="text-base font-bold text-slate-900">
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
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Overall Interview Feedback</h3>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {interview.feedback.summary}
                  </p>
                </div>
              )}

              {/* Recommended Actions */}
              {interview.feedback.recommended_actions && interview.feedback.recommended_actions.length > 0 && (
                <div className="rounded-3xl border border-brand-200/80 bg-brand-50/20 p-6 shadow-card">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-900 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-600" />
                    <span>Recommended Next Actions</span>
                  </h3>
                  <ul className="space-y-2">
                    {interview.feedback.recommended_actions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question-by-Question Detailed Evaluations */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Question-by-Question Analysis</h3>

                {interview.feedback.evaluations.map((qEval, idx) => {
                  const matchingQ = interview.questions.find((q) => q.id === qEval.question_id)

                  return (
                    <div
                      key={qEval.question_id}
                      className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 font-bold text-xs text-slate-800">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">
                            {matchingQ?.question || `Question ${idx + 1}`}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className={`text-sm font-extrabold ${scoreColor(qEval.score)}`}>
                            {qEval.score}/100
                          </span>
                        </div>
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        {qEval.strengths.length > 0 && (
                          <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl space-y-1">
                            <span className="font-bold text-emerald-900 text-[11px] uppercase">Strengths</span>
                            <ul className="space-y-1 text-slate-700">
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
                          <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-2xl space-y-1">
                            <span className="font-bold text-rose-900 text-[11px] uppercase">Improvements</span>
                            <ul className="space-y-1 text-slate-700">
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
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                          <span className="font-bold text-slate-800">Ideal Answer Outline: </span>
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
