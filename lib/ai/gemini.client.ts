import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing")
}

const client = new GoogleGenerativeAI(apiKey)

export const geminiModel = client.getGenerativeModel({
  model: "models/gemini-3.0-pro",
})
