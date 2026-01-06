# Komyra AI - Interview Platform MVP

An AI-powered interview platform built with Next.js (App Router) that evaluates candidates through speech-based interviews.

## Features

- **Admin Setup**: Configure job descriptions and interview questions
- **Speech-Based Interview**: Real-time speech-to-text using browser Speech Recognition API
- **Camera Preview**: Live camera feed for interview realism
- **AI Evaluation**: Candidate evaluation using Gemini API (placeholder)
- **Detailed Reports**: Comprehensive evaluation with scores, strengths, weaknesses, and verdict

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Speech Recognition**: Browser Speech Recognition API
- **AI**: Gemini API (placeholder implementation)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
komyra-ai/
├── app/
│   ├── api/
│   │   └── evaluate/
│   │       └── route.ts          # Evaluation API endpoint
│   ├── setup/
│   │   └── page.tsx              # Admin setup page
│   ├── interview/
│   │   └── page.tsx              # Interview page
│   ├── result/
│   │   └── page.tsx              # Results page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── types/
│   └── interview.ts              # TypeScript type definitions
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Usage Flow

1. **Admin Setup** (`/setup`): Admin enters job description, role title, and interview questions
2. **Interview** (`/interview`): Candidate answers questions using speech recognition
3. **Evaluation**: System evaluates answers using Gemini API
4. **Results** (`/result`): Display comprehensive evaluation report

## Gemini API Integration

The Gemini API integration is currently a placeholder. To implement:

1. Install the Gemini SDK:
```bash
npm install @google/generative-ai
```

2. Add your API key to `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

3. Update `app/api/evaluate/route.ts` - replace the mock evaluation function with actual Gemini API calls (see comments in the file)

## Browser Compatibility

- **Speech Recognition**: Works best in Chrome/Edge (uses WebKit Speech Recognition API)
- **Camera/Microphone**: Requires HTTPS in production (localhost works for development)

## Notes

- Data is stored in localStorage/sessionStorage (no database)
- Camera access is optional but recommended for realism
- Speech recognition requires microphone permission
- This is an MVP - not production-ready

## License

MIT

