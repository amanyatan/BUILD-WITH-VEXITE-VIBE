
# Vibe

An AI-powered website creation platform.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase project
- API keys for AI provider, Sarvam AI, and GitHub

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd vibe
```

2. **Install root dependencies**

```bash
npm install
```

3. **Install frontend dependencies**

```bash
cd frontend && npm install
```

4. **Install backend dependencies**

```bash
cd ../backend && npm install
```

5. **Copy environment variables**

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

6. **Set up Supabase**

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run the database migrations: `database/migrations/001_initial.sql`
- Add the Supabase URL and keys to `.env`

7. **Start the development servers**

```bash
npm run dev
```

This starts both the frontend (port 3000) and backend (port 4000) concurrently.

### Individual Commands

- Start frontend only: `npm run dev:frontend`
- Start backend only: `npm run dev:backend`
- Build all: `npm run build`
- Start frontend only: `npm run start:frontend`
- Start backend only: `npm run start:backend`

## Project Structure

```
vibe/
├── frontend/        # Next.js application
│   ├── app/         # App pages
│   ├── components/  # React components
│   ├── hooks/       # Custom hooks
│   ├── lib/         # Library utilities
│   ├── store/       # Zustand state management
│   ├── types/       # TypeScript types
│   └── public/      # Static assets
├── backend/         # Express API server
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── controllers/ # Route controllers
│   │   ├── services/    # Business logic services
│   │   ├── integrations/ # External service clients
│   │   └── agents/      # AI agents
├── shared/          # Shared types and schemas
├── database/        # Database migrations and seeds
└── docs/            # Documentation
```

## Features

- **AI Code Generation**: Generate code using AI agents
- **Monaco Editor**: Built-in code editor
- **Live Preview**: Real-time preview of generated code
- **Voice Integration**: Transcribe and synthesize speech with Sarvam AI
- **GitHub Integration**: Connect and manage repositories
- **Supabase Auth**: Authentication and project data storage

## Technologies

- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [TypeScript](https://typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Express](https://expressjs.com)
- [Supabase](https://supabase.com)
- [AI SDK](https://sdk.vercel.ai)
- [Sarvam AI](https://sarvam.ai)
- [Monaco Editor](https://microsoft.github.io/monaco-editor)
- [Octokit](https://github.com/octokit/octokit.js)
- [Zustand](https://zustand-demo.pmnd.rs)

## License

MIT
