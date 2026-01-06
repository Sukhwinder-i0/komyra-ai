'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { InterviewSetup, InterviewAnswer } from '@/types/interview'

/**
 * Interview Page
 * 
 * Handles the candidate interview flow:
 * - Camera and microphone access
 * - Speech recognition (browser API)
 * - Question display and answer recording
 * - Real-time transcription
 * - Navigation between questions
 */
export default function InterviewPage() {
  const router = useRouter()
  const [setup, setSetup] = useState<InterviewSetup | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Load interview setup
  useEffect(() => {
    const savedSetup = sessionStorage.getItem('interviewSetup') || localStorage.getItem('interviewSetup')
    if (!savedSetup) {
      alert('No interview setup found. Please complete admin setup first.')
      router.push('/setup')
      return
    }

    try {
      const parsed = JSON.parse(savedSetup)
      setSetup(parsed)
    } catch (e) {
      console.error('Failed to parse setup data:', e)
      setError('Failed to load interview setup')
    }
  }, [router])

  // Initialize camera
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

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [setup])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check for browser support
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

      setCurrentAnswer(prev => prev + finalTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        // This is normal, just means no speech detected yet
        return
      }
      setError(`Speech recognition error: ${event.error}`)
      setIsRecording(false)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Auto-restart if we're still in recording mode
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
  }, [isRecording])

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

  const saveAnswer = () => {
    if (!setup || currentAnswer.trim().length === 0) {
      alert('Please provide an answer before proceeding')
      return
    }

    const answer: InterviewAnswer = {
      question: setup.questions[currentQuestionIndex],
      answer: currentAnswer.trim(),
      timestamp: new Date().toISOString(),
    }

    setAnswers([...answers, answer])
    setCurrentAnswer('')
    
    // Move to next question or finish
    if (currentQuestionIndex < setup.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // All questions answered, proceed to evaluation
      finishInterview([...answers, answer])
    }
  }

  const finishInterview = async (finalAnswers: InterviewAnswer[]) => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    // Store answers in sessionStorage for evaluation
    sessionStorage.setItem('interviewAnswers', JSON.stringify(finalAnswers))
    
    // Navigate to evaluation API
    router.push('/result')
  }

  const skipQuestion = () => {
    if (!setup) return
    
    if (currentQuestionIndex < setup.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setCurrentAnswer('')
      setIsRecording(false)
    } else {
      // Finish interview even if last question skipped
      finishInterview(answers)
    }
  }

  if (!setup) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading interview setup...</p>
        </div>
      </main>
    )
  }

  const currentQuestion = setup.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / setup.questions.length) * 100

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Interview: {setup.roleTitle}
          </h1>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Question {currentQuestionIndex + 1} of {setup.questions.length}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Camera Preview */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Camera Preview</h2>
            <div className="bg-black rounded-lg overflow-hidden aspect-video">
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
              <h2 className="text-lg font-semibold mb-2">Current Question</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-800">{currentQuestion}</p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Your Answer</h2>
              <div className="bg-white border border-gray-300 rounded-lg p-4 min-h-[200px]">
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
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Start Answer
                </button>
              ) : (
                <button
                  onClick={stopAnswer}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Stop Answer
                </button>
              )}
              
              <button
                onClick={saveAnswer}
                disabled={!currentAnswer.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestionIndex < setup.questions.length - 1 ? 'Next Question' : 'Finish Interview'}
              </button>
              
              <button
                onClick={skipQuestion}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
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
  }
}

