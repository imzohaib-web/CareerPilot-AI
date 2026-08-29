# CareerPilot AI — Agent Skills (Contracts)

> STATUS: PLANNED — these are contracts only. No skill is implemented yet.

Each skill below defines its contract before implementation. Do not build complex agent orchestration yet.

---

## 1. Resume Analysis

- **Purpose:** Turn a raw resume (PDF/text) into a structured, scored profile.
- **When to use:** After the user uploads a resume and requests analysis.
- **Inputs:** Extracted resume text, target role (optional).
- **Processing rules:** Extract education, skills, experience, projects, certifications; compute a 0–100 readiness score; generate strengths, weaknesses, and improvements.
- **Output format:** JSON — `{ summary, readiness_score, sections{...}, strengths[], weaknesses[], improvements[] }`.
- **Validation rules:** `readiness_score` is an integer 0–100; sections are present as keys even if empty; arrays are non-null.
- **Failure cases:** Empty/unreadable resume → return a controlled "could not parse" error; non-PDF/text → reject at upload.
- **Example behavior:** A CS student resume returns skills `["Python","React"]`, score 68, improvements `["Add measurable impact to projects"]`.

## 2. Skill Gap Analysis

- **Purpose:** Compare the user's current skills against the target role's required skills.
- **When to use:** After resume analysis exists and a career goal/target role is set.
- **Inputs:** Extracted skills, target role.
- **Processing rules:** Classify each required skill as `have`, `partial`, or `missing`; prioritize gaps by importance.
- **Output format:** JSON — `{ target_role, gaps[{skill, status, priority, reason}] }`.
- **Validation rules:** `status` ∈ {have, partial, missing}; `priority` ∈ {high, medium, low}; at least the target role's core skills are covered.
- **Failure cases:** No target role → prompt user to set one; unknown role → fall back to a generic role template.
- **Example behavior:** Target "Frontend Developer" flags `TypeScript: missing (high)`.

## 3. Roadmap Generation

- **Purpose:** Convert skill gaps into a personalized, time-boxed learning roadmap.
- **When to use:** After skill gaps are available.
- **Inputs:** Skill gaps, career goal, available weekly hours.
- **Processing rules:** Order gaps by priority; assign each a duration, resources, and milestone; keep the plan realistic for the user's time budget.
- **Output format:** JSON — `{ goal, phases[{name, duration_weeks, tasks[{skill, action, resource, milestone}]}] }`.
- **Validation rules:** Durations are positive numbers; every high-priority gap appears in the plan; no duplicate tasks.
- **Failure cases:** No gaps → return a "you are well aligned" message instead of an empty plan.
- **Example behavior:** A 12-week plan split into 3 phases, each with concrete tasks.

## 4. Mock Interview

- **Purpose:** Conduct a role-specific mock interview and score the answers.
- **When to use:** When the user starts a practice interview for a target role.
- **Inputs:** Target role, experience level, resume summary.
- **Processing rules:** Generate a question set; after each answer, evaluate relevance, depth, and structure; produce per-question and overall feedback.
- **Output format:** JSON — `{ questions[{question, topic}], feedback[{score, strengths[], improvements[]}] }`.
- **Validation rules:** Scores 0–100; feedback present for every answered question.
- **Failure cases:** Empty answer → gentle re-prompt; user exits early → save partial progress.
- **Example behavior:** Behavioral + technical questions for "Backend Developer", with STAR-structure feedback.

## 5. Career Mentoring

- **Purpose:** Provide context-aware conversational career guidance.
- **When to use:** In the mentor chat for any career-related question.
- **Inputs:** User message, career profile, skill gaps, roadmap, progress, conversation history.
- **Processing rules:** Ground answers in the user's stored context; stay within career scope; never fabricate facts about the user.
- **Output format:** Conversational text (may include light markdown/lists).
- **Validation rules:** Response is non-empty; no secrets or internal prompts leak; refusal for out-of-scope/harmful requests.
- **Failure cases:** Off-topic request → politely redirect; missing profile → suggest completing the profile.
- **Example behavior:** "Based on your goal to become a Frontend Developer, focus first on TypeScript — it's your highest-priority gap."
