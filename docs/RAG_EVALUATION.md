# CareerPilot AI — RAG Retrieval Pipeline Evaluation Report

**Generated:** 2026-10-21 03:20:34 UTC  
**Total Evaluation Queries:** 30  
**Dataset Source:** `backend/tests/data/rag_eval.json`  
**Evaluated Architectures:**
- **Hash-256 Baseline**: Legacy SHA-256 word hashing with 256-dimensional unigram vectors
- **Dense Embeddings Only**: DashScope `text-embedding-v3` (1024-dimensional semantic vectors) with cosine similarity
- **Hybrid Fusion**: Weighted Reciprocal Rank Fusion (0.7 vector + 0.3 BM25) with corpus-wide IDF cache, query analyzer, and role boost

---

## 1. Overall Performance Benchmark

| Architecture | Hit@1 | Hit@3 | Hit@5 | Mean Reciprocal Rank (MRR) |
| :--- | :---: | :---: | :---: | :---: |
| **Legacy Hash-256 Baseline** | 36.7% | 50.0% | 63.3% | 0.463 |
| **Dense Embeddings Only (`text-embedding-v3`)** | 83.3% | 100.0% | 100.0% | 0.917 |
| **Hybrid Retrieval (Dense + BM25 + Weighted RRF)** | **96.7%** | **100.0%** | **100.0%** | **0.983** |

---

## 2. Key Engineering Insights

1. **Dense Semantic vs. Hash Baseline**: Dense embeddings outperform the hash-256 baseline significantly on semantic queries, paraphrases, and synonyms.
2. **Hybrid Advantage**: Weighted Reciprocal Rank Fusion ($k=60$) balances dense semantics with exact technical keyword matches (e.g. `fastapi`, `pydantic`, `ci/cd`, `star`), ensuring zero misses on direct acronym queries.
3. **Corpus-Wide BM25 IDF**: Computing document frequency and IDF over the full corpus prevents candidate pool distortion and elevates rare technical terminology.
4. **Strict Grounding & Refusal**: Relevance thresholding ensures queries yielding low similarity scores degrade cleanly to the refusal path without LLM hallucination.

---

## 3. Per-Query Breakdown (Hybrid Mode)

| # | Query | Type | Expected Document | Hybrid Rank | Top-1 Retrieved Document |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `What are the must-have skills and competencies for a Junior Backend Engineer?` | direct | Junior Backend Engineer Skill Matrix | **Rank 1** | Junior Backend Engineer Skill Matrix |
| 2 | `What are the core requirements and expectations for a server-side developer?` | synonym | Junior Backend Engineer Skill Matrix | **Rank 1** | Junior Backend Engineer Skill Matrix |
| 3 | `How to answer behavioral interview questions using Situation, Task, Action, Result?` | direct | Behavioral Interview Mastery with the STAR Framework | **Rank 1** | Behavioral Interview Mastery with the STAR Framework |
| 4 | `STAR method structured storytelling framework for behavioral interviews` | paraphrase | Behavioral Interview Mastery with the STAR Framework | **Rank 1** | Behavioral Interview Mastery with the STAR Framework |
| 5 | `How to build production REST APIs with FastAPI, Pydantic, and async endpoints?` | direct | FastAPI Framework and Production REST API Engineering | **Rank 1** | FastAPI Framework and Production REST API Engineering |
| 6 | `Modern Python ASGI framework for writing high-performance REST microservices and OpenAPI docs` | synonym | FastAPI Framework and Production REST API Engineering | **Rank 1** | FastAPI Framework and Production REST API Engineering |
| 7 | `How do Docker containers, multi-stage builds, and Docker Compose work?` | direct | Docker Containerization, Multi-Stage Builds, and Compose | **Rank 1** | Docker Containerization, Multi-Stage Builds, and Compose |
| 8 | `Packaging applications into lightweight container images and orchestrating local microservices` | paraphrase | Docker Containerization, Multi-Stage Builds, and Compose | **Rank 1** | Docker Containerization, Multi-Stage Builds, and Compose |
| 9 | `How to set up automated CI/CD pipelines with GitHub Actions workflows?` | direct | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions | **Rank 1** | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions |
| 10 | `Automated build, test, and deployment release pipelines triggered on pull requests and commits` | paraphrase | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions | **Rank 2** | Git Version Control, Branching Models, and Collaborative Pull Requests |
| 11 | `What is the difference between SQL relational databases and MongoDB document storage?` | paraphrase | Document Databases, MongoDB, and Unstructured Data Modeling | **Rank 1** | Document Databases, MongoDB, and Unstructured Data Modeling |
| 12 | `PostgreSQL relational schemas, indexing, table normalization, and foreign keys` | direct | Relational Databases, SQL Mastery, and PostgreSQL | **Rank 1** | Relational Databases, SQL Mastery, and PostgreSQL |
| 13 | `Writing complex database queries with JOINs, aggregation, transactions, and ACID properties` | paraphrase | Relational Databases, SQL Mastery, and PostgreSQL | **Rank 1** | Relational Databases, SQL Mastery, and PostgreSQL |
| 14 | `How do vector embeddings, semantic search, and RAG architectures function in LLM applications?` | direct | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture | **Rank 1** | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture |
| 15 | `Retrieval-Augmented Generation pipeline using cosine similarity and vector stores to ground AI responses` | synonym | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture | **Rank 1** | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture |
| 16 | `What are React hooks, functional component lifecycles, and modern state management?` | direct | React Library, Hooks Architecture, and Modern Component State | **Rank 1** | React Library, Hooks Architecture, and Modern Component State |
| 17 | `Building reactive UI components with useState, useEffect, and virtual DOM reconciliation` | paraphrase | React Library, Hooks Architecture, and Modern Component State | **Rank 1** | React Library, Hooks Architecture, and Modern Component State |
| 18 | `How to write automated unit tests, fixtures, and mocks in Python using Pytest?` | direct | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking | **Rank 1** | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking |
| 19 | `Test driven development, regression assertions, and mocking external API network dependencies` | synonym | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking | **Rank 1** | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking |
| 20 | `System design fundamentals: horizontal scaling, load balancers, caching, and database sharding` | direct | Foundational System Design, Scalability, and Distributed Architectural Patterns | **Rank 1** | Foundational System Design, Scalability, and Distributed Architectural Patterns |
| 21 | `Designing scalable architectures with Redis cache, rate limiting, and message brokers` | paraphrase | Foundational System Design, Scalability, and Distributed Architectural Patterns | **Rank 1** | Foundational System Design, Scalability, and Distributed Architectural Patterns |
| 22 | `How to write quantified resume bullet points using the Google X-Y-Z action formula?` | direct | Writing High-Impact Quantified Resume Bullets Using Action Formulas | **Rank 1** | Writing High-Impact Quantified Resume Bullets Using Action Formulas |
| 23 | `Accomplished [X] as measured by [Y] by doing [Z] impact statements for resume experience` | paraphrase | Writing High-Impact Quantified Resume Bullets Using Action Formulas | **Rank 1** | Writing High-Impact Quantified Resume Bullets Using Action Formulas |
| 24 | `How to optimize resume formatting for Applicant Tracking Systems (ATS)?` | direct | Modern ATS Resume Optimization and Format Guidelines | **Rank 1** | Modern ATS Resume Optimization and Format Guidelines |
| 25 | `Avoiding multi-column layout parsing errors in candidate scanning software` | synonym | Modern ATS Resume Optimization and Format Guidelines | **Rank 1** | Modern ATS Resume Optimization and Format Guidelines |
| 26 | `What technical questions are asked in backend engineering interviews regarding databases and APIs?` | direct | Backend Engineering Technical Interview Questions and Model Answers | **Rank 1** | Backend Engineering Technical Interview Questions and Model Answers |
| 27 | `Server-side technical interview questions on database concurrency, connection pooling, and idempotency` | synonym | Backend Engineering Technical Interview Questions and Model Answers | **Rank 1** | Backend Engineering Technical Interview Questions and Model Answers |
| 28 | `What questions are asked in frontend engineering technical interviews regarding web performance?` | direct | Frontend Engineering Technical Interview Questions and Model Answers | **Rank 1** | Frontend Engineering Technical Interview Questions and Model Answers |
| 29 | `How to handle workplace disagreement with a senior engineer or missing a tight deadline?` | direct | Situational and Workplace Scenario Interview Patterns | **Rank 1** | Situational and Workplace Scenario Interview Patterns |
| 30 | `What are Pakistani software house hiring tests and technical recruitment standards?` | direct | Pakistan Software Houses Hiring Standards and Technical Entry Tests | **Rank 1** | Pakistan Software Houses Hiring Standards and Technical Entry Tests |
