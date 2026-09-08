# Architecture Diagram — Placeholder

This file describes the architecture diagram that should be created for the CareerPilot AI README.

## Where to Place the File

Save your exported diagram as:

```
docs/architecture.png
```

The README already references this path.

## Suggested Tools

- [draw.io](https://app.diagrams.net/) (free, export to PNG)
- [Excalidraw](https://excalidraw.com/) (free, hand-drawn style)
- [Lucidchart](https://www.lucidchart.com/)
- [Mermaid](https://mermaid.live/) (code-based diagrams)

## Diagram Content

The diagram should show these layers and connections:

```
┌─────────────────────────────────────────────────┐
│  Frontend (Vercel)                              │
│  React 19 + TypeScript + Vite + Tailwind CSS    │
│  10 pages · React Router 7 · Axios              │
└────────────────────┬────────────────────────────┘
                     │ HTTP / REST + JWT Bearer
                     ▼
┌─────────────────────────────────────────────────┐
│  Backend (Render)                               │
│  Python + FastAPI                               │
│                                                 │
│  ┌─ 10 API Routers ──────────────────────────┐  │
│  │ auth · profile · resume · skill_gap       │  │
│  │ roadmap · interview · ai · chat           │  │
│  │ rag · progress                            │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Service Layer ───────────────────────────┐  │
│  │ Business logic · Pydantic validation      │  │
│  │ AI service (isolated Qwen calls)          │  │
│  └───────────────────────────────────────────┘  │
└──────────────┬──────────────────┬────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌──────────────────────┐
│  MongoDB Atlas       │  │  Alibaba Cloud       │
│  Motor async driver  │  │  Model Studio        │
│  (offline fallback)  │  │  Qwen (qwen-plus)    │
└──────────────────────┘  └──────────────────────┘
```

## Color Suggestions

- Frontend: blue tones
- Backend: green tones
- Database: orange/amber
- AI Service: purple/violet
- Arrows: gray
