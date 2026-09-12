# Vibe — Product Requirements Document

## 1. Product Overview

**Vibe** is an AI-powered website creation platform. Users describe a website idea using text or voice, and multiple AI agents collaborate to turn that idea into a working website.

The platform generates frontend code, validates it, displays a live preview, and allows users to edit the code and push the final project to GitHub.

The MVP generates only:

```text
index.html
style.css
script.js
```

The platform should be simple, fast, modern, and suitable for a hackathon demonstration.

---

# 2. Main User Flow

```text
User opens Vibe
      ↓
Signs in with Supabase
      ↓
Creates a project
      ↓
Enters a website idea using text or voice
      ↓
Designer Agent understands the requirements
      ↓
Developer Agent generates website code
      ↓
Tester Agent validates the generated code
      ↓
Files are saved in the project
      ↓
User views live preview
      ↓
User edits code in Monaco Editor
      ↓
User saves changes
      ↓
User optionally connects GitHub
      ↓
Creates or selects a repository
      ↓
Pushes website files to GitHub
```

---

# 3. Target Users

- Students
- Hackathon participants
- Beginners learning web development
- Designers and non-technical users
- Developers who want to quickly prototype websites

---

# 4. Core Features

## Authentication

Use Supabase Authentication.

Requirements:

- Sign up
- Login
- Logout
- Protected dashboard routes
- Persistent sessions
- User profile information

---

## Dashboard

The dashboard should allow users to:

- Create a new project
- View existing projects
- Rename projects
- Delete projects
- Open a project workspace
- View recent project activity

Each project should contain:

```text
Project
├── Name
├── Description
├── Owner
├── Status
├── Created At
├── Updated At
└── Generated Files
```

---

# 5. Project Workspace

The workspace is the main feature of Vibe.

It should contain:

```text
┌─────────────────────────────────────────────┐
│ Header: Project Name | Save | GitHub        │
├───────────────────────┬─────────────────────┤
│ Chat / Agent Panel    │ Live Preview        │
│                       │                     │
│ User Messages         │ Generated Website   │
│ Agent Responses       │                     │
│ Agent Status          │                     │
│                       │                     │
├───────────────────────┴─────────────────────┤
│ Monaco Code Editor                          │
│ index.html | style.css | script.js          │
└─────────────────────────────────────────────┘
```

Features:

- Chat input
- Voice input button
- Agent activity indicators
- Code editor tabs
- Live preview iframe
- Save project button
- GitHub integration button
- Error and success notifications

---

# 6. AI Agent System

Vibe uses three agents.

## Designer Agent

Responsibilities:

- Understand the user's website idea
- Identify the website type
- Extract requirements
- Decide the visual direction
- Ask clarification questions when necessary
- Produce a structured design plan

Output should include:

```json
{
  "websiteType": "landing_page",
  "goal": "Describe the website purpose",
  "sections": [
    "Hero",
    "Features",
    "About",
    "Contact"
  ],
  "style": {
    "theme": "modern",
    "colors": [],
    "typography": "",
    "layout": ""
  },
  "requirements": []
}
```

The Designer Agent must not generate final code.

---

## Developer Agent

Responsibilities:

- Receive the Designer Agent's plan
- Generate complete website files
- Follow the MVP file structure
- Produce functional HTML, CSS, and JavaScript
- Ensure files work together without missing references

Required output:

```text
index.html
style.css
script.js
```

The Developer Agent should return structured file data:

```json
{
  "files": [
    {
      "path": "index.html",
      "content": ""
    },
    {
      "path": "style.css",
      "content": ""
    },
    {
      "path": "script.js",
      "content": ""
    }
  ]
}
```

---

## Tester Agent

Responsibilities:

- Validate generated HTML
- Check CSS references
- Check JavaScript references
- Identify broken selectors
- Check missing assets
- Check basic accessibility
- Check responsive layout issues
- Report errors and warnings

The Tester Agent should not expose chain-of-thought. It should return only concise findings and fixes.

Example:

```json
{
  "status": "passed",
  "errors": [],
  "warnings": [],
  "suggestions": []
}
```

---

# 7. AI Provider Configuration

The backend must support configurable AI providers.

Add placeholders for:

```env
# Primary AI Provider
AI_API_KEY=
AI_MODEL=

# Groq
GROQ_API_KEY=

GROQ_MODEL=

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=
```

Create a provider abstraction:

```text
backend/src/ai/
├── ai.provider.ts
├── groq.provider.ts
├── gemini.provider.ts
└── prompts/
    ├── designer.prompt.ts
    ├── developer.prompt.ts
    └── tester.prompt.ts
```

Requirements:

- The active provider should be configurable through environment variables.
- Groq and Gemini must be supported as interchangeable providers.
- Do not expose API keys in the frontend.
- Keep the provider interface consistent.
- Allow different models for different agents if needed.

Example configuration:

```env
AI_PROVIDER=groq

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

---

# 8. Voice Features

Use Sarvam AI for voice functionality.

Required features:

- Speech-to-text
- Optional text-to-speech
- Voice input inside the chat panel

Flow:

```text
User speaks
   ↓
Sarvam Speech-to-Text
   ↓
Text added to chat input
   ↓
AI Agent processes request
```

Environment variable:

```env
SARVAM_API_KEY=
```

---

# 9. Code Generation Requirements

Generated websites must:

- Use semantic HTML
- Use responsive CSS
- Include functional JavaScript where required
- Avoid broken external references
- Use accessible buttons and form labels
- Work inside a sandboxed iframe
- Be previewable without a build step
- Store each generated file separately

MVP restrictions:

- Do not generate React projects inside user projects.
- Do not generate Next.js projects inside user projects.
- Do not require npm installation for generated websites.
- Generate only static HTML, CSS, and JavaScript files.

---

# 10. Live Preview

The frontend should combine the three generated files and render them in a sandboxed iframe.

Requirements:

- Update preview after code changes
- Support refresh
- Display runtime errors safely
- Prevent generated code from accessing the parent application
- Keep preview isolated from the main Vibe application

---

# 11. Monaco Editor

Use Monaco Editor for code editing.

Required tabs:

```text
index.html
style.css
script.js
```

Features:

- Syntax highlighting
- File switching
- Editing
- Save changes
- Reset to last saved version
- Basic error display

---

# 12. GitHub Integration

Users can connect their GitHub account and push generated files.

Required features:

- GitHub OAuth connection
- Create repository
- Select existing repository
- Push generated files
- Display repository URL
- Display push success or failure status

GitHub environment variables:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:4000/api/github/callback
GITHUB_ACCESS_TOKEN=
```

GitHub access tokens and client secrets must remain backend-only.

MVP push structure:

```text
repository/
├── index.html
├── style.css
└── script.js
```

Do not include:

- Vercel deployment
- Vercel SDK
- Deployment APIs
- Automatic hosting
- CI/CD pipelines

---

# 13. API Requirements

Use the existing backend APIs where available.

Required API groups:

```text
GET    /api/health

POST   /api/projects
GET    /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId

GET    /api/agents
GET    /api/agents/:agentId

POST   /api/chat
GET    /api/projects/:projectId/messages

POST   /api/code/generate
POST   /api/code/validate
GET    /api/projects/:projectId/files
PATCH  /api/projects/:projectId/files

POST   /api/voice/stt
POST   /api/voice/tts

GET    /api/github/connect
GET    /api/github/callback
POST   /api/github/create-repo
POST   /api/github/push
GET    /api/github/repositories
```

The frontend should consume these APIs through a centralized Axios client.

---

# 14. Database Requirements

Use Supabase for database storage.

Main tables:

```text
profiles
projects
agents
messages
project_files
github_connections
```

Relationships:

```text
User
 ├── Projects
 │    ├── Messages
 │    └── Project Files
 │
 └── GitHub Connection
```

Each project should have an owner and timestamps.

---

# 15. Frontend Requirements

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand
- Monaco Editor
- Axios
- Supabase
- Lucide icons
- Sonner notifications

Main pages:

```text
/login
/dashboard
/projects
/projects/[projectId]
/settings
```

Main components:

```text
components/
├── ui/
├── layout/
├── auth/
├── dashboard/
├── workspace/
├── agents/
├── editor/
├── preview/
└── github/
```

---

# 16. Backend Requirements

Use:

- Node.js
- Express
- TypeScript
- Supabase
- Zod
- Octokit
- Axios
- AI SDK
- Sarvam AI SDK

Backend structure:

```text
backend/src/
├── server.ts
├── app.ts
├── config/
├── middleware/
├── routes/
├── controllers/
├── services/
├── agents/
├── ai/
├── code/
├── integrations/
│   ├── supabase/
│   ├── sarvam/
│   └── github/
├── schemas/
├── types/
└── utils/
```

---

# 17. Security Requirements

- Keep all secrets in environment variables.
- Never expose service-role keys in the frontend.
- Never expose GitHub client secrets or access tokens.
- Validate request bodies with Zod.
- Add authentication middleware to protected APIs.
- Add CORS configuration.
- Add Helmet.
- Add rate limiting.
- Sanitize generated HTML before preview when necessary.
- Use sandboxed iframes for generated websites.
- Do not expose AI chain-of-thought.

---

# 18. Development Requirements

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:4000
```

The project should run with:

```bash
npm run dev
```

The implementation should prioritize a working MVP, clean architecture, reusable components, and easy future expansion.

Do not add unnecessary deployment infrastructure or microservices.
