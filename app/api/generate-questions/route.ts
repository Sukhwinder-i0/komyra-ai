import { NextRequest, NextResponse } from 'next/server'
import type { GenerateQuestionsRequest, GenerateQuestionsResponse } from '@/types/interview'

/**
 * Generate Questions API Route
 * 
 * Generates interview questions from JD + Resume using Gemini API
 * 
 * POST /api/generate-questions
 */
export async function POST(request: NextRequest) {
  try {
    const body: GenerateQuestionsRequest = await request.json()
    const { jobDescription, resume, roleTitle } = body

    // Validate input
    if (!jobDescription || !resume || !roleTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDescription, resume, or roleTitle' },
        { status: 400 }
      )
    }

    // Generate questions using Gemini
    const questions = await generateQuestionsFromJDAndResume({
      jobDescription,
      resume,
      roleTitle,
    })

    return NextResponse.json({ questions, questionIds: questions.map((_, i) => `q${i + 1}`) })
  } catch (error) {
    console.error('Generate questions error:', error)
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    )
  }
}

/**
 * Generate Questions Function
 * 
 * Uses Gemini API to generate personalized interview questions
 * based on job description and candidate resume
 */
async function generateQuestionsFromJDAndResume(
  data: GenerateQuestionsRequest
): Promise<string[]> {
  const { jobDescription, resume, roleTitle } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  const prompt = `You are an expert technical interviewer. Generate 5-7 interview questions for a ${roleTitle} position.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

Generate personalized interview questions that:
1. Assess technical skills relevant to the role
2. Evaluate problem-solving abilities
3. Test domain knowledge based on their experience
4. Explore their background and fit
5. Are specific to the candidate's resume and the job requirements

Return ONLY a JSON array of question strings (no markdown, no code blocks, just valid JSON array):
["Question 1", "Question 2", "Question 3", ...]

Example format:
["Tell me about your experience with React and how you've used it in production applications.", "Describe a challenging technical problem you solved recently.", ...]`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Clean up the response - remove markdown code blocks if present
    let cleanedText = text
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }
    if (cleanedText.startsWith('[')) {
      // Already JSON array
    } else if (cleanedText.includes('[')) {
      // Extract JSON array from response
      const match = cleanedText.match(/\[[\s\S]*\]/)
      if (match) {
        cleanedText = match[0]
      }
    }

    const questions = JSON.parse(cleanedText)

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format')
    }

    return questions.filter((q: any) => typeof q === 'string' && q.trim().length > 0)
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    // Fallback to default questions
    return [
      `Tell me about your experience relevant to this ${roleTitle} position.`,
      'What technical challenges have you faced in your previous projects?',
      'How do you approach problem-solving in complex technical scenarios?',
      'Describe a project where you demonstrated strong technical skills.',
      'What interests you most about this role?',
    ]
  }
}

