import type {
  DashboardResponse,
  RoadmapResponse,
  SkillGapResponse,
  InterviewResponse,
} from '../types'

export interface MockDashboardState {
  dashboard: DashboardResponse
  roadmap: RoadmapResponse | null
  skillGap: SkillGapResponse | null
  interview: InterviewResponse | null
}

export const MOCK_FULL_DATA: MockDashboardState = {
  dashboard: {
    profile: {
      has_profile: true,
      completeness: 100,
      target_role: 'Senior AI Engineer',
      experience_level: 'early-career',
      career_goal: 'Architect and scale production LLM agents',
      skills_count: 8,
      skills: ['Python', 'FastAPI', 'TypeScript', 'React', 'PyTorch', 'Docker', 'RAG', 'Vector DBs'],
    },
    resume: {
      has_analysis: true,
      score: 88,
      skills_detected: ['Python', 'FastAPI', 'TypeScript', 'React', 'Docker'],
      skills_count: 5,
      improvements_count: 2,
      improvements: [
        'Quantify latency and cost optimization benchmarks in recent multi-agent deployments.',
        'Highlight distributed inference experience (e.g. vLLM or Triton) in past roles.',
      ],
      analyzed_at: '2026-10-21T14:30:00Z',
      total_analyses: 3,
    },
    roadmap: {
      has_roadmap: true,
      title: 'Senior AI Engineer Mastery',
      target_role: 'Senior AI Engineer',
      total_tasks: 16,
      completed_tasks_count: 12,
      completion_percentage: 75,
    },
    interview: {
      has_interview: true,
      latest_score: 84,
      total_interviews: 4,
      target_role: 'Senior AI Engineer',
    },
    readiness_score: 86,
    overall_progress: 86,
    next_steps: [
      {
        label: 'Complete Week 3: Vector Index Fine-Tuning',
        action: '/roadmap',
        priority: 'high',
      },
      {
        label: 'Run System Design Mock Interview Simulation',
        action: '/interview',
        priority: 'medium',
      },
      {
        label: 'Consult AI Career Mentor on Salary Negotiation',
        action: '/mentor',
        priority: 'low',
      },
    ],
  },
  roadmap: {
    id: 'roadmap-mock-1',
    user_id: 'user-mock-1',
    target_role: 'Senior AI Engineer',
    time_frame_weeks: 4,
    weekly_hours: 10,
    completed_tasks: ['task-1', 'task-2', 'task-3'],
    created_at: '2026-10-15T10:00:00Z',
    roadmap: {
      title: 'Senior AI Engineer Mastery',
      target_role: 'Senior AI Engineer',
      total_duration_weeks: 4,
      summary: 'Focused 4-week sprint to master production RAG, vector indexes, and system design.',
      phases: [
        {
          phase_number: 3,
          name: 'Week 3: Advanced Vector Indexing & RAG',
          duration_weeks: 1,
          focus: 'HNSW indexing, reranking, and multi-query retrieval architecture',
          tasks: [
            {
              id: 'task-1',
              title: 'Benchmark HNSW vs IVF indexing latency on 100k embeddings',
              skill: 'Vector DBs',
              description: 'Implement performance testing across index structures.',
              action: 'Run latency benchmark tests',
              resource: 'Vector Search Handbook',
              milestone: 'Index Optimization',
              estimated_hours: 3,
            },
            {
              id: 'task-2',
              title: 'Integrate Cohere rerank model into retrieval pipeline',
              skill: 'RAG Pipeline',
              description: 'Add two-stage retrieval to maximize recall at top-5 results.',
              action: 'Build reranker middleware',
              resource: 'Advanced RAG Patterns',
              milestone: 'Retrieval Quality',
              estimated_hours: 2,
            },
            {
              id: 'task-3',
              title: 'Set up hybrid keyword-vector search with Reciprocal Rank Fusion',
              skill: 'Search Engineering',
              description: 'Combine BM25 and dense vector results for domain keywords.',
              action: 'Implement RRF algorithm',
              resource: 'Hybrid Search Guide',
              milestone: 'Hybrid Search',
              estimated_hours: 2,
            },
            {
              id: 'task-4',
              title: 'Conduct synthetic evaluation of hallucination rates with RAGAS',
              skill: 'Eval & Quality',
              description: 'Measure context relevance, faithfulness, and answer correctness.',
              action: 'Generate evaluation dataset',
              resource: 'RAGAS Framework Docs',
              milestone: 'Production Readiness',
              estimated_hours: 3,
            },
          ],
        },
      ],
    },
  },
  skillGap: {
    id: 'gap-mock-1',
    user_id: 'user-mock-1',
    target_role: 'Senior AI Engineer',
    target_job_description: 'Architect and scale enterprise LLM and agentic workflows.',
    created_at: '2026-10-18T12:00:00Z',
    analysis: {
      summary: 'Strong foundation in Python and full-stack web applications. Key growth areas are in vector infrastructure and distributed evaluation.',
      missing_technical_skills: [
        'Vector Index Optimization',
        'Distributed Inference (vLLM)',
        'RAGAS Quality Metrics',
      ],
      missing_soft_skills: [
        'Enterprise Stakeholder Communication',
        'Technical Trade-off Justification',
      ],
      required_proficiencies: [],
      match_score: 78,
    },
  },
  interview: {
    id: 'int-mock-1',
    user_id: 'user-mock-1',
    target_role: 'Senior AI Engineer',
    experience_level: 'early-career',
    status: 'completed',
    created_at: '2026-10-22T09:15:00Z',
    completed_at: '2026-10-22T09:40:00Z',
    questions: [],
    answers: [],
  },
}

export const MOCK_PARTIAL_DATA: MockDashboardState = {
  dashboard: {
    profile: {
      has_profile: true,
      completeness: 85,
      target_role: 'Full Stack Engineer',
      experience_level: 'early-career',
      career_goal: 'Transition into modern AI-driven full stack roles',
      skills_count: 5,
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
    },
    resume: {
      has_analysis: true,
      score: 64,
      skills_detected: ['TypeScript', 'React', 'Node.js'],
      skills_count: 3,
      improvements_count: 2,
      improvements: [
        'Add quantifiable impact metrics to recent software projects.',
        'Incorporate cloud hosting and CI/CD tools to match modern job descriptions.',
      ],
      analyzed_at: '2026-10-20T10:00:00Z',
      total_analyses: 1,
    },
    roadmap: {
      has_roadmap: false,
      title: '',
      target_role: '',
      total_tasks: 0,
      completed_tasks_count: 0,
      completion_percentage: 0,
    },
    interview: {
      has_interview: false,
      latest_score: 0,
      total_interviews: 0,
      target_role: '',
    },
    readiness_score: 32,
    overall_progress: 32,
    next_steps: [
      {
        label: 'Generate Personalized Learning Roadmap',
        action: '/roadmap',
        priority: 'high',
      },
      {
        label: 'Practice Behavioral Mock Interview',
        action: '/interview',
        priority: 'medium',
      },
    ],
  },
  roadmap: null,
  skillGap: {
    id: 'gap-mock-2',
    user_id: 'user-mock-2',
    target_role: 'Full Stack Engineer',
    target_job_description: 'Build full stack web apps with modern frameworks.',
    created_at: '2026-10-20T10:05:00Z',
    analysis: {
      summary: 'Good core JavaScript skills. Missing automated testing and containerization.',
      missing_technical_skills: [
        'Docker & Containers',
        'CI/CD Pipelines',
        'Integration Testing',
      ],
      missing_soft_skills: ['Cross-functional Collaboration'],
      required_proficiencies: [],
      match_score: 62,
    },
  },
  interview: null,
}

export const MOCK_NEW_USER_DATA: MockDashboardState = {
  dashboard: {
    profile: {
      has_profile: false,
      completeness: 0,
      target_role: '',
      experience_level: '',
      career_goal: '',
      skills_count: 0,
      skills: [],
    },
    resume: {
      has_analysis: false,
      score: 0,
      skills_detected: [],
      skills_count: 0,
      improvements_count: 0,
      improvements: [],
      analyzed_at: null,
      total_analyses: 0,
    },
    roadmap: {
      has_roadmap: false,
      title: '',
      target_role: '',
      total_tasks: 0,
      completed_tasks_count: 0,
      completion_percentage: 0,
    },
    interview: {
      has_interview: false,
      latest_score: 0,
      total_interviews: 0,
      target_role: '',
    },
    readiness_score: 0,
    overall_progress: 0,
    next_steps: [
      {
        label: 'Complete Your Career Profile',
        action: '/profile',
        priority: 'high',
      },
      {
        label: 'Upload Resume for ATS Benchmark',
        action: '/resume',
        priority: 'high',
      },
    ],
  },
  roadmap: null,
  skillGap: null,
  interview: null,
}
