/**
 * Realistic backend JSON fixtures mirroring the exact FastAPI response shapes
 * from GET /api/rag/documents and GET /api/rag/knowledge-base/stats.
 */

export const backendDocumentsFixture = [
  {
    id: "6601a2b3c4d5e6f7a8b9c0d1",
    user_id: null,
    title: "Software Engineer Role Matrix & Competency Guide",
    category: "Role Matrix",
    chunk_count: 4,
    content_length: 3200,
    scope: "global",
    created_at: "2026-03-30T10:00:00.000Z",
    deletable: false,
  },
  {
    id: "6601a2b3c4d5e6f7a8b9c0d2",
    user_id: "6601a2b3c4d5e6f7a8b9c0aa",
    title: "Senior Backend Engineer Job Description",
    category: "Job Description",
    chunk_count: 2,
    content_length: 1250,
    scope: "user",
    created_at: "2026-03-30T11:15:00.000Z",
    deletable: true,
  },
]

export const backendKnowledgeBaseStatsFixture = {
  total_documents: 34,
  total_chunks: 72,
  global_documents: 34,
  global_chunks: 72,
  user_documents: 0,
  user_chunks: 0,
  categories: {
    "Role Matrix": 12,
    "Learning Path": 10,
    "Career Guide": 8,
    "Interview Guide": 4,
  },
  category_list: [
    "Role Matrix",
    "Learning Path",
    "Career Guide",
    "Interview Guide",
  ],
  chunks_by_category: {
    "Role Matrix": 24,
    "Learning Path": 20,
    "Career Guide": 16,
    "Interview Guide": 12,
  },
  last_seeded_at: "2026-03-30T10:00:00.000Z",
  last_updated: "2026-03-30T10:00:00.000Z",
  embedding_model: "text-embedding-v3",
  vector_dimension: 1024,
  retrieval_backend: "atlas",
  storage_mode: "mongodb",
  database_name: "careerpilot_ai",
  status: "ready",
}
