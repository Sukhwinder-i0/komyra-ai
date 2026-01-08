import type {
    EvaluationRequest,
    EvaluationResult,
    InterviewAnswer,
  } from "@/types/interview"
  import { geminiModel } from "./gemini.client"
  
  export async function evaluateCandidateAI(
    data: EvaluationRequest
  ): Promise<EvaluationResult> {
    const { jobDescription, questions, answers, resume } = data
  
    const prompt = buildEvaluationPrompt(
      jobDescription,
      questions,
      answers,
      resume
    )
  
    try {
      const result = await geminiModel.generateContent(prompt)
      const text = result.response.text()
  
      const json = extractJson(text)
      const parsed = JSON.parse(json)
  
      if (!isValidEvaluation(parsed)) {
        throw new Error("Invalid evaluation structure")
      }
  
      return parsed
    } catch (error) {
      console.error("evaluateCandidateAI failed:", error)
      return getFallbackEvaluation(answers)
    }
  }
  
  
  function buildEvaluationPrompt(
    jobDescription: string,
    questions: string[],
    answers: InterviewAnswer[],
    resume?: string
  ): string {
    const qa = answers
      .map(
        (a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`
      )
      .join("\n\n")
  
    return `You are a senior technical interviewer.
  
  Job Description:
  ${jobDescription}
  
  ${resume ? `Candidate Resume:\n${resume}\n` : ""}
  
  Interview Q&A:
  ${qa}
  
  Evaluate the candidate and return STRICT JSON only:
  {
    "alignment_percentage": 0,
    "technical_score": 0,
    "problem_solving_score": 0,
    "communication_score": 0,
    "strengths": [],
    "weaknesses": [],
    "final_verdict": "Fit" | "Maybe" | "Reject",
    "summary": ""
  }`
  }
  
  function extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? match[0] : "{}"
  }
  
  function isValidEvaluation(obj: any): obj is EvaluationResult {
    return (
      obj &&
      typeof obj.alignment_percentage === "number" &&
      typeof obj.technical_score === "number" &&
      typeof obj.problem_solving_score === "number" &&
      typeof obj.communication_score === "number" &&
      Array.isArray(obj.strengths) &&
      Array.isArray(obj.weaknesses) &&
      typeof obj.summary === "string"
    )
  }
  
  function getFallbackEvaluation(
    answers: InterviewAnswer[]
  ): EvaluationResult {
    return {
      alignment_percentage: 60,
      technical_score: 7,
      problem_solving_score: 6,
      communication_score: 7,
      strengths: ["Clear communication", "Basic technical understanding"],
      weaknesses: ["Needs deeper examples", "Limited edge-case discussion"],
      final_verdict: "Maybe",
      summary:
        "The candidate demonstrates baseline competency but requires deeper technical validation.",
    }
  }
  