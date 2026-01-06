'use client'

/**
 * Interview Page - Refactored Architecture
 * 
 * ARCHITECTURE OVERVIEW:
 * This page implements a dynamic AI-driven interview system with the following components:
 * 
 * 1. INTERVIEW STATE CONTROLLER:
 *    - Manages interview flow (main questions, follow-ups, completion)
 *    - Tracks question indices, follow-up counts, and conversation history
 *    - Ensures state consistency between client and server
 * 
 * 2. AI QUESTION GENERATION:
 *    - Uses /api/analyze-profile to create interview blueprint (once at start)
 *    - Uses /api/next-question to generate questions dynamically
 *    - Server decides: main question vs follow-up based on answer quality
 * 
 * 3. SPOKEN AI INTERVIEWER:
 *    - Browser TTS (SpeechSynthesis API) speaks questions aloud
 *    - AI never speaks directly - browser reads AI-generated text
 *    - Questions are also displayed on screen for accessibility
 * 
 * 4. SPEECH-BASED ANSWERS:
 *    - Browser Speech Recognition API captures candidate responses
 *    - Live transcript shown in real-time
 *    - Final transcript sent to server for evaluation
 * 
 * WHY THIS ARCHITECTURE:
 * - State controller prevents infinite loops (max questions/follow-ups)
 * - Unified API (/api/next-question) simplifies client logic
 * - Pre-computed blueprint avoids re-analyzing JD+Resume per question
 * - Browser APIs keep everything client-side (no external services)
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { InterviewSetup, InterviewAnswer, InterviewState, InterviewBlueprint, NextQuestionResponse } from '@/types/interview'
import { 
  createInitialInterviewState, 
  addAnswerToState, 
  updateStateFromResponse,
  canContinueInterview,
  getInterviewProgress,
  getQuestionContext,
} from '@/lib/interview-state'

export default function InterviewPage() {
  const router = useRouter()
  
  // Interview setup (from admin)
  const [setup, setSetup] = useState<InterviewSetup | null>(null)
  const [blueprint, setBlueprint] = useState<InterviewBlueprint | null>(null)
  
  // Interview state (managed by state controller)
  const [interviewState, setInterviewState] = useState<InterviewState | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  
  // Answer recording
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  // UI state
  const [error, setError] = useState<string | null>(null)
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  
  // Refs for browser APIs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize TTS
   * ARCHITECTURE NOTE: Browser TTS is initialized once and reused throughout interview
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  /**
   * Load interview setup and initialize
   * ARCHITECTURE FLOW:
   * 1. Load setup from storage
   * 2. If dynamic questions: analyze profile to create blueprint
   * 3. Initialize interview state
   * 4. Get first question
   */
  useEffect(() => {
    const initializeInterview = async () => {
      // Load setup
      const savedSetup = sessionStorage.getItem('interviewSetup') || localStorage.getItem('interviewSetup')
      if (!savedSetup) {
        alert('No interview setup found. Please complete admin setup first.')
        router.push('/setup')
        return
      }

      try {
        const parsed = JSON.parse(savedSetup) as InterviewSetup
        setSetup(parsed)

        // Initialize interview state
        const initialState = createInitialInterviewState(7, 2) // 7 questions max, 2 follow-ups max
        setInterviewState(initialState)

        // If dynamic questions, analyze profile first
        if (parsed.useDynamicQuestions && parsed.resume) {
          setIsInitializing(true)
          const blueprintResult = await analyzeProfile(parsed)
          if (blueprintResult) {
            setBlueprint(blueprintResult)
            // Cache blueprint in setup for later use
            parsed.interviewBlueprint = blueprintResult
          }
        }

        setIsInitializing(false)

        // Get first question
        if (parsed.useDynamicQuestions && parsed.resume) {
          await loadNextQuestion(initialState, parsed, parsed.interviewBlueprint)
        } else if (parsed.questions && parsed.questions.length > 0) {
          // Static questions mode (backward compatibility)
          setCurrentQuestion(parsed.questions[0])
        }
      } catch (e) {
        console.error('Failed to initialize interview:', e)
        setError('Failed to load interview setup')
        setIsInitializing(false)
      }
    }

    initializeInterview()
  }, [router])

  /**
   * Analyze Profile
   * ARCHITECTURE PURPOSE: Creates interview blueprint once at start
   * This blueprint guides all subsequent question generation
   */
  const analyzeProfile = async (setupData: InterviewSetup): Promise<InterviewBlueprint | null> => {
    if (!setupData.resume) return null

    try {
      const response = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: setupData.jobDescription,
          resume: setupData.resume,
          roleTitle: setupData.roleTitle,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze profile')
      }

      const data = await response.json()
      return data.blueprint || null
    } catch (error) {
      console.error('Error analyzing profile:', error)
      return null
    }
  }

  /**
   * Load Next Question
   * ARCHITECTURE FLOW:
   * 1. Call /api/next-question with current state
   * 2. Server decides: main question or follow-up
   * 3. Update state from server response
   * 4. Speak question using TTS
   */
  const loadNextQuestion = async (
    state: InterviewState,
    setupData: InterviewSetup,
    blueprintData?: InterviewBlueprint | null,
    lastAnswer?: string
  ) => {
    if (!setupData.useDynamicQuestions || !setupData.resume) {
      return
    }

    setIsLoadingQuestion(true)
    try {
      const response = await fetch('/api/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: setupData.jobDescription,
          resume: setupData.resume,
          roleTitle: setupData.roleTitle,
          interview_state: state,
          last_answer: lastAnswer,
          blueprint: blueprintData || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get next question')
      }

      const data: NextQuestionResponse = await response.json()

      // Update state from server
      const updatedState = updateStateFromResponse(state, data.updated_state)
      setInterviewState(updatedState)

      if (data.question) {
        setCurrentQuestion(data.question)
        speakQuestion(data.question)
      }

      if (data.interview_complete) {
        // Interview complete, proceed to evaluation
        finishInterview()
      }
    } catch (error) {
      console.error('Error loading next question:', error)
      setError('Failed to load next question. Please try again.')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // ============================================
  // SPEECH SYNTHESIS (TTS)
  // ============================================

  /**
   * Speak Question
   * ARCHITECTURE NOTE: Browser TTS speaks AI-generated text
   * AI never speaks directly - browser reads the text we provide
   * This ensures compatibility and accessibility
   */
  const speakQuestion = (question: string) => {
    if (!synthRef.current) return

    // Stop any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(question)
    utterance.rate = 0.9 // Slightly slower for clarity
    utterance.pitch = 1
    utterance.volume = 1
    utterance.lang = 'en-US'

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }

  // ============================================
  // SPEECH RECOGNITION
  // ============================================

  /**
   * Initialize Speech Recognition
   * ARCHITECTURE NOTE: Browser Speech Recognition API stays client-side
   * No audio data is sent to server - only final transcript
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !setup) return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      // Update current answer with final transcript
      setCurrentAnswer(prev => prev + finalTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        return // Normal - no speech detected yet
      }
      setError(`Speech recognition error: ${event.error}`)
      setIsRecording(false)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-restart if still in recording mode
      if (isRecording) {
        try {
          recognition.start()
          setIsListening(true)
        } catch (e) {
          // Already started or error
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [setup, isRecording])

  // cam init 

  useEffect(() => {
    if (!setup) return

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraPermission(true)
        }
      } catch (err) {
        console.error('Camera/microphone access denied:', err)
        setCameraPermission(false)
        setError('Camera and microphone access is required for the interview')
      }
    }

    initCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [setup])

 
  useEffect(() => {
    if (currentQuestion && synthRef.current && !isSpeaking) {
     
      setTimeout(() => speakQuestion(currentQuestion), 300)
    }
  }, [currentQuestion])

 
  const startAnswer = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized')
      return
    }

    try {
      recognitionRef.current.start()
      setIsRecording(true)
      setIsListening(true)
      setCurrentAnswer('')
    } catch (e) {
      console.error('Failed to start recognition:', e)
      setError('Failed to start speech recognition')
    }
  }

  
  const stopAnswer = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
      setIsListening(false)
    }
  }


  const saveAnswer = async () => {
    if (!setup || !interviewState || !currentQuestion || currentAnswer.trim().length === 0) {
      alert('Please provide an answer before proceeding')
      return
    }

    // Add answer to state
    const updatedState = addAnswerToState(
      interviewState,
      currentQuestion,
      currentAnswer.trim(),
      interviewState.current_question_id
    )
    setInterviewState(updatedState)
    setCurrentAnswer('')

    // Get next question
    if (setup.useDynamicQuestions && setup.resume) {
      await loadNextQuestion(
        updatedState,
        setup,
        blueprint,
        currentAnswer.trim()
      )
    } else if (setup.questions) {
      // Static questions mode (backward compatibility)
      const nextIndex = interviewState.current_question_index + 1
      if (nextIndex < setup.questions.length) {
        setCurrentQuestion(setup.questions[nextIndex])
        const newState = {
          ...updatedState,
          current_question_index: nextIndex,
        }
        setInterviewState(newState)
      } else {
        finishInterview()
      }
    }
  }

  /**
   * Skip Question
   */
  const skipQuestion = () => {
    if (!setup || !interviewState) return
    
    // Stop any ongoing speech
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }

    if (setup.useDynamicQuestions && setup.resume) {
      // Dynamic mode: get next question
      loadNextQuestion(interviewState, setup, blueprint)
    } else if (setup.questions) {
      // Static mode: move to next question
      const nextIndex = interviewState.current_question_index + 1
      if (nextIndex < setup.questions.length) {
        setCurrentQuestion(setup.questions[nextIndex])
        const newState = {
          ...interviewState,
          current_question_index: nextIndex,
        }
        setInterviewState(newState)
      } else {
        finishInterview()
      }
    }
  }

  
  const finishInterview = async () => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    // Stop any ongoing speech
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }

    // Store conversation history for evaluation
    if (interviewState) {
      sessionStorage.setItem('interviewAnswers', JSON.stringify(interviewState.conversation_history))
      sessionStorage.setItem('interviewState', JSON.stringify(interviewState))
    }
    
    // Navigate to results page
    router.push('/result')
  }

  if (isInitializing) {
    return (
      <main className="min-h-screen flex items-center bg-black justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Initializing interview...</p>
          {setup?.useDynamicQuestions && (
            <p className="text-sm text-gray-500 mt-2">Analyzing profile and generating questions...</p>
          )}
        </div>
      </main>
    )
  }

  if (!setup || !interviewState) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading interview setup...</p>
        </div>
      </main>
    )
  }

  const progress = getInterviewProgress(interviewState)
  const context = getQuestionContext(interviewState)
  const displayQuestion = currentQuestion || 'Loading question...'

  return (
    <main className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-100 mb-2">
            Interview: {setup.roleTitle}
          </h1>
          <div className="w-full bg-gray-300 rounded-full h-1">
            <div
              className="bg-blue-600 h-1 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-400">
              Question {context.questionNumber} of {context.totalQuestions}
              {context.isFollowUp && ` (Follow-up ${context.followupCount}/${context.maxFollowups})`}
            </p>
            {isLoadingQuestion && (
              <p className="text-sm text-blue-600">Loading next question...</p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Camera Preview */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Camera Preview</h2>
            <div className="bg-gray-800 rounded-md overflow-hidden aspect-video">
              {cameraPermission === false ? (
                <div className="h-full flex items-center justify-center text-white">
                  <p>Camera access denied</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>

          {/* Right Column: Question & Answer */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-md font-semibold">
                  {context.isFollowUp ? 'Follow-up Question' : 'Current Question'}
                </h2>
                {isSpeaking && (
                  <span className="text-sm text-blue-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    Speaking...
                  </span>
                )}
                <button
                  onClick={() => displayQuestion && speakQuestion(displayQuestion)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  title="Replay question"
                >
                  <span>🔊</span> Replay
                </button>
              </div>
              <div className="bg-gray-700 border  border-blue-200 rounded-md p-2">
                <p className="text-gray-200 text-sm">{displayQuestion}</p>
              </div>
            </div>

            <div>
              <h2 className="text-md font-semibold mb-2">Your Answer</h2>
              <div className="bg-gray-700 border border-gray-300 rounded-md p-2 min-h-[200px]">
                {currentAnswer ? (
                  <p className="text-gray-800 whitespace-pre-wrap">{currentAnswer}</p>
                ) : (
                  <p className="text-gray-400 italic">
                    {isRecording ? 'Listening...' : 'Click "Start Answer" to begin speaking'}
                  </p>
                )}
              </div>
              {isListening && (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  Recording...
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2 flex-wrap">
              {!isRecording ? (
                <button
                  onClick={startAnswer}
                  disabled={isSpeaking || isLoadingQuestion}
                  className="px-3 py-2 bg-green-600 text-white rounded-sm text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Answer
                </button>
              ) : (
                <button
                  onClick={stopAnswer}
                  className="px-3 py-2 bg-red-600 text-sm text-white rounded-sm hover:bg-red-700 transition-colors"
                >
                  Stop Answer
                </button>
              )}
              
              <button
                onClick={saveAnswer}
                disabled={!currentAnswer.trim() || isLoadingQuestion}
                className="px-3 py-2 bg-blue-600 text-white rounded-sm text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canContinueInterview(interviewState) ? 'Submit Answer' : 'Finish Interview'}
              </button>
              
              <button
                onClick={skipQuestion}
                disabled={isLoadingQuestion}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-sm hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
    speechSynthesis: SpeechSynthesis
  }
}
