# Architecture Overview

Autiverse is a full-stack monorepo with three applications and a shared library, orchestrated by Nx.

## System Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Mobile App    │     │   Admin Web      │     │    Backend        │
│  (React Native) │     │  (React + Vite)  │     │   (FastAPI)       │
│   Expo SDK 53   │     │  Ant Design      │     │   Python 3.12     │
│   port: 8081    │     │  port: 8888      │     │   port: 3000      │
└────────┬────────┘     └────────┬─────────┘     └─────┬──────┬──────┘
         │                       │                     │      │
         │         REST API / WebSocket (Socket.IO)    │      │
         └───────────────────────┴─────────────────────┘      │
                                                              │
                    ┌─────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼─────┐     ┌────────▼────────┐     ┌──────────────┐
    │  Redis   │     │ SQLite/PostgreSQL│     │  External    │
    │ (WS mgr) │     │   (database)     │     │  APIs        │
    └──────────┘     └─────────────────┘     │ - OpenAI     │
                                              │ - Naver Clova│
                                              └──────────────┘
```

## Applications

### Backend (`apps/backend/`)

FastAPI server handling REST APIs, WebSocket connections, and AI pipelines.

```
apps/backend/backend/
├── server.py              # FastAPI app, CORS, middlewares, static files
├── run-dev.py             # Uvicorn entry point (dev, with optional SSL)
├── core/
│   ├── ai/                # LangChain-based AI chatbot pipelines
│   └── socket.py          # Socket.IO WebSocket management
├── database/
│   ├── engine.py          # DB connection (SQLite or PostgreSQL)
│   ├── models.py          # SQLModel ORM models
│   └── migrations.py      # Alembic migration runner
├── router/
│   ├── admin/             # Admin API endpoints
│   └── app/               # Mobile app API endpoints
└── utils/
    ├── i18n.py            # I18nManager for server-side translations
    ├── speech.py          # Naver Clova TTS/STT integration
    └── image.py           # Image upload handling
```

Key features:
- **AI Pipelines**: LangChain + OpenAI for conversational journaling and comic generation
- **WebSocket**: Socket.IO with Redis as client manager for real-time communication
- **Auth**: JWT tokens + bcrypt password hashing
- **Database**: SQLModel (async) with SQLite or PostgreSQL
- **Static serving**: Serves admin-web build at `/admin/` and uploaded files at `/uploads/`

### Admin Web (`apps/admin-web/`)

React dashboard for managing Dyads (child-caregiver pairs), viewing diaries, and administering content.

- **Routing**: TanStack Router with code splitting
- **UI**: Ant Design components + TailwindCSS
- **State**: TanStack Query for server state

### Mobile App (`apps/mobile/`)

React Native tablet app (landscape-only) where autistic adolescents create journal entries through AI-guided conversation, resulting in editable four-panel comic strips.

- **Navigation**: Expo Router
- **UI**: React Native Paper + NativeWind
- **Forms**: React Hook Form + Yup validation
- **Audio**: expo-audio for recording, expo-speech / react-native-tts for playback
- **Real-time**: Socket.IO client for chatbot communication
- **Storage**: expo-secure-store for auth tokens

## Shared Library

### `libs/ts-core/`

Package: `@autiverse-monorepo/ts-core`

| Export | Description |
|--------|-------------|
| `types.ts` | Shared TypeScript types (`UserLocale`, Dyad types, etc.) |
| `i18n.ts` | i18next initialization with translation file loading |
| `network.ts` | API client utilities |
| `utils.ts` | General-purpose helpers |
| `emotion.ts` | Emotion styling utilities |

## External Services

| Service | Purpose |
|---------|---------|
| **OpenAI API** | LLM for conversational journaling and comic narrative generation |
| **Naver Clova** | Korean text-to-speech and speech recognition |
| **Redis** | WebSocket client manager for Socket.IO |

## Monorepo Tooling

- **Nx 21**: Task orchestration, caching, and dependency graph
- **npm workspaces**: Package linking across `apps/`, `libs/`, `packages/`
- **Poetry**: Python dependency management for backend
- **Nx plugins**: `@nxlv/python`, `@nx/expo`, `@nx/vite`, `@nx/js/typescript`
