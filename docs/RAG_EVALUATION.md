# CareerPilot AI — RAG Retrieval Pipeline Evaluation Report

**Generated:** 2026-10-21 02:38:56 UTC  
**Total Evaluation Queries:** 40  
**Categories Tested:** Direct, Paraphrase, Synonym, Role-Specific, Misspelled (8 queries each)  
**Configuration:**
- Vector Weight (`RAG_VECTOR_WEIGHT`): 0.7
- Keyword Weight (`RAG_KEYWORD_WEIGHT`): 0.3
- Fusion Constant ($k$): 60
- Normalized Cosine Bonus: +0.02 × sim
- Role Boost Factor (`RAG_ROLE_BOOST_FACTOR`): 1.25x
- Chunker Version: `v2_heading_governed` (first-sentence governance + heading path breadcrumbs)

---

## 1. Overall Performance Summary

| Method | Hit@1 | Hit@3 | Hit@5 | MRR |
| :--- | :---: | :---: | :---: | :---: |
| **Vector Only** | 90.0% | 100.0% | 100.0% | 0.950 |
| **BM25 Only** | 70.0% | 92.5% | 95.0% | 0.809 |
| **Hybrid (Weighted Fusion + Role Boost)** | 92.5% | 100.0% | 100.0% | 0.963 |

### Key Findings
1. **Hybrid Fusion Superiority**: Hybrid ranking combines dense vector semantics with exact lexical matching, yielding higher Hit@1 and MRR than pure vector or BM25 alone.
2. **Robustness to Misspellings**: Dense semantic vectors maintain high recall on queries with typographical errors where BM25 token matches degrade.
3. **Role & Skill Disambiguation**: The metadata-aware query analyzer provides soft boosts for role matrices (e.g. Backend vs Frontend vs Mobile), resolving disambiguation ambiguities.
4. **Context-Aware Embeddings**: Prefixing embedding text with `"title | section"` grounds chunks in their parent document and subsection hierarchy.

---

## 2. Performance by Query Category

| Query Type | N | Vector Only Hit@1 | Vector MRR | BM25 Hit@1 | BM25 MRR | Hybrid Hit@1 | Hybrid MRR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Direct** | 8 | 100.0% | 1.000 | 75.0% | 0.812 | 100.0% | 1.000 |
| **Misspelled** | 8 | 87.5% | 0.938 | 62.5% | 0.775 | 87.5% | 0.938 |
| **Paraphrase** | 8 | 62.5% | 0.812 | 50.0% | 0.729 | 75.0% | 0.875 |
| **Role_specific** | 8 | 100.0% | 1.000 | 75.0% | 0.792 | 100.0% | 1.000 |
| **Synonym** | 8 | 100.0% | 1.000 | 87.5% | 0.938 | 100.0% | 1.000 |

---

## 3. Detailed Query Evaluation Results (Hybrid Mode)

| ID | Query | Category | Expected Document Title | Hybrid Rank | Top-1 Retrieved Document |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `What skills does a junior backend developer need?` | direct | Junior Backend Engineer Skill Matrix | **Rank 1** | Junior Backend Engineer Skill Matrix |
| 2 | `How do I answer a behavioral question using the STAR method?` | direct | Behavioral Interview Mastery with the STAR Framework | **Rank 1** | Behavioral Interview Mastery with the STAR Framework |
| 3 | `How should I format an ATS friendly resume?` | direct | Modern ATS Resume Optimization and Format Guidelines | **Rank 1** | Modern ATS Resume Optimization and Format Guidelines |
| 4 | `FastAPI framework and building production REST APIs` | direct | FastAPI Framework and Production REST API Engineering | **Rank 1** | FastAPI Framework and Production REST API Engineering |
| 5 | `Docker containerization multi-stage builds and docker-compose` | direct | Docker Containerization, Multi-Stage Builds, and Compose | **Rank 1** | Docker Containerization, Multi-Stage Builds, and Compose |
| 6 | `What are the fundamentals of CI/CD with GitHub Actions?` | direct | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions | **Rank 1** | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions |
| 7 | `How can Pakistani software engineers get remote freelancing clients?` | direct | Remote Global Contracts and Freelancing for Pakistani Software Engineers | **Rank 1** | Remote Global Contracts and Freelancing for Pakistani Software Engineers |
| 8 | `What are the hiring standards and technical entry tests in Pakistan software houses?` | direct | Pakistan Software Houses Hiring Standards and Technical Entry Tests | **Rank 1** | Pakistan Software Houses Hiring Standards and Technical Entry Tests |
| 9 | `server-side engineer responsibilities and requirements` | paraphrase | Junior Backend Engineer Skill Matrix | **Rank 1** | Junior Backend Engineer Skill Matrix |
| 10 | `how to answer scenario based behavioral interview prompts effectively` | paraphrase | Behavioral Interview Mastery with the STAR Framework | **Rank 1** | Behavioral Interview Mastery with the STAR Framework |
| 11 | `how to pass corporate applicant tracking system cv scanners` | paraphrase | Modern ATS Resume Optimization and Format Guidelines | **Rank 1** | Modern ATS Resume Optimization and Format Guidelines |
| 12 | `creating lightweight container images for cloud microservice deployments` | paraphrase | Docker Containerization, Multi-Stage Builds, and Compose | **Rank 2** | Cloud Infrastructure Fundamentals and Compute Services |
| 13 | `automated test running on pull requests using git workflows` | paraphrase | Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions | **Rank 2** | Git Version Control, Branching Models, and Collaborative Pull Requests |
| 14 | `how developers from Pakistan land international contract work on Upwork and LinkedIn` | paraphrase | Remote Global Contracts and Freelancing for Pakistani Software Engineers | **Rank 1** | Remote Global Contracts and Freelancing for Pakistani Software Engineers |
| 15 | `turning university software development internship into permanent employment` | paraphrase | Transitioning from University Internship to Full-Time Software Engineer | **Rank 1** | Transitioning from University Internship to Full-Time Software Engineer |
| 16 | `optimizing LinkedIn profile and choosing cloud certifications for engineers` | paraphrase | Professional LinkedIn Strategy and Industry Certifications for Developers | **Rank 1** | Professional LinkedIn Strategy and Industry Certifications for Developers |
| 17 | `relational database design PostgreSQL indexing and SQL queries` | synonym | Relational Databases, SQL Mastery, and PostgreSQL | **Rank 1** | Relational Databases, SQL Mastery, and PostgreSQL |
| 18 | `NoSQL document collections MongoDB queries and aggregation pipelines` | synonym | Document Databases, MongoDB, and Unstructured Data Modeling | **Rank 1** | Document Databases, MongoDB, and Unstructured Data Modeling |
| 19 | `version control branching git flow merge conflicts and pull requests` | synonym | Git Version Control, Branching Models, and Collaborative Pull Requests | **Rank 1** | Git Version Control, Branching Models, and Collaborative Pull Requests |
| 20 | `unit testing with pytest test doubles mocking and integration test suites` | synonym | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking | **Rank 1** | Software Testing Fundamentals, Pytest, Unit Testing, and Mocking |
| 21 | `distributed systems horizontal scaling load balancing and caching patterns` | synonym | Foundational System Design, Scalability, and Distributed Architectural Patterns | **Rank 1** | Foundational System Design, Scalability, and Distributed Architectural Patterns |
| 22 | `machine learning embeddings semantic search and retrieval augmented generation` | synonym | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture | **Rank 1** | Machine Learning Fundamentals, Vector Embeddings, and RAG Architecture |
| 23 | `data structures Big O time complexity arrays trees and graph algorithms` | synonym | Data Structures, Algorithms, and Technical Problem Solving Patterns | **Rank 1** | Data Structures, Algorithms, and Technical Problem Solving Patterns |
| 24 | `writing quantified resume bullet points using Google XYZ formula` | synonym | Writing High-Impact Quantified Resume Bullets Using Action Formulas | **Rank 1** | Writing High-Impact Quantified Resume Bullets Using Action Formulas |
| 25 | `What core competencies are expected from a junior frontend engineer?` | role_specific | Junior Frontend Engineer Skill Matrix | **Rank 1** | Junior Frontend Engineer Skill Matrix |
| 26 | `What technical skills does a junior full-stack developer need?` | role_specific | Junior Full-Stack Engineer Skill Matrix | **Rank 1** | Junior Full-Stack Engineer Skill Matrix |
| 27 | `What tools and skills are mandatory for a junior data analyst?` | role_specific | Junior Data Analyst Skill Matrix | **Rank 1** | Junior Data Analyst Skill Matrix |
| 28 | `What does a junior data scientist do and what skills are required?` | role_specific | Junior Data Scientist Skill Matrix | **Rank 1** | Junior Data Scientist Skill Matrix |
| 29 | `Junior DevOps and Cloud engineer skills Terraform AWS and Kubernetes` | role_specific | Junior DevOps and Cloud Engineer Skill Matrix | **Rank 1** | Junior DevOps and Cloud Engineer Skill Matrix |
| 30 | `What skills are needed for a junior QA automation and SDET engineer?` | role_specific | Junior QA and SDET Skill Matrix | **Rank 1** | Junior QA and SDET Skill Matrix |
| 31 | `Junior mobile developer skills Flutter React Native iOS Android` | role_specific | Junior Mobile Application Developer Skill Matrix | **Rank 1** | Junior Mobile Application Developer Skill Matrix |
| 32 | `Junior machine learning and AI engineer skill matrix and roadmap` | role_specific | Junior Machine Learning and AI Engineer Skill Matrix | **Rank 1** | Junior Machine Learning and AI Engineer Skill Matrix |
| 33 | `fastpi dependecy injecton and pydantc schemas` | misspelled | FastAPI Framework and Production REST API Engineering | **Rank 1** | FastAPI Framework and Production REST API Engineering |
| 34 | `dokcerfile multi stage buikd and compose yamls` | misspelled | Docker Containerization, Multi-Stage Builds, and Compose | **Rank 1** | Docker Containerization, Multi-Stage Builds, and Compose |
| 35 | `behaveoral interveiw using star methd stituation task` | misspelled | Behavioral Interview Mastery with the STAR Framework | **Rank 1** | Behavioral Interview Mastery with the STAR Framework |
| 36 | `ats freindly cv bullet ponits and formating guidlines` | misspelled | Modern ATS Resume Optimization and Format Guidelines | **Rank 1** | Modern ATS Resume Optimization and Format Guidelines |
| 37 | `relatonal databse sql posgtresql indexng queries` | misspelled | Relational Databases, SQL Mastery, and PostgreSQL | **Rank 1** | Relational Databases, SQL Mastery, and PostgreSQL |
| 38 | `git branchng rebase and pull reqeust conflict resoluton` | misspelled | Git Version Control, Branching Models, and Collaborative Pull Requests | **Rank 1** | Git Version Control, Branching Models, and Collaborative Pull Requests |
| 39 | `pakistan remot softwre hous freelancng upwrk contracts` | misspelled | Remote Global Contracts and Freelancing for Pakistani Software Engineers | **Rank 1** | Remote Global Contracts and Freelancing for Pakistani Software Engineers |
| 40 | `pythn async await event loop and asyncio architecture` | misspelled | Python Core Programming and Asynchronous Architecture | **Rank 2** | Backend Engineering Technical Interview Questions and Model Answers |
