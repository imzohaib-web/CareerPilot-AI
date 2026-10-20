---
title: "Git Version Control, Branching Models, and Collaborative Pull Requests"
category: "learning_path"
role: "general"
source_note: "Curated guide to professional Git workflows, branch strategies, conflict resolution, and pull requests."
---

# Git Version Control, Branching Models, and Collaborative Pull Requests

Git is the distributed version control system that underpins modern software engineering. Fluency with Git is required across every software development discipline to maintain project history, collaborate smoothly, and ship changes reliably.

## Learning Roadmap

### Phase 1: Daily Working Directory Mechanics
1. **The Three Trees**: Understanding the Working Directory, the Staging Area (Index), and the Git Repository (commit history).
2. **Core Commands**:
   - `git init`, `git clone <url>`
   - `git status`, `git diff`, `git diff --staged`
   - `git add <file>`, `git add -p` (interactive staging for clean, atomic commits)
   - `git commit -m "feat(auth): add jwt token refresh"`, `git commit --amend`
   - `git log --oneline --graph --decorate`
3. **Ignoring Unwanted Artifacts (`.gitignore`)**: Properly ignoring virtual environments (`venv/`), dependencies (`node_modules/`), compiled binaries, secrets (`.env`), and OS files (`.DS_Store`).

### Phase 2: Branching, Merging, and Collaborative Workflows
1. **Branch Management**: Creating and switching branches (`git switch -c feature/branch-name` or `git checkout -b`), listing branches (`git branch -a`), and deleting merged branches.
2. **Merge vs Rebase**:
   - `git merge`: Preserves complete historical context with a merge commit.
   - `git rebase`: Linearizes project history by replaying commits on top of the target branch.
   - **Golden Rule**: Never rebase shared public branches (such as `main` or `develop`).
3. **Resolving Merge Conflicts**: Understanding conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`), inspecting conflicting diffs, selecting resolution strategies, and completing the merge or rebase cleanly.
4. **Interactive Rebasing (`git rebase -i`)**: Squashing minor typo commits (`fix typo`, `wip`) into cohesive, well-formatted atomic commits before opening or merging a Pull Request.
5. **Stashing Changes (`git stash`, `git stash pop`)**: Temporarily shelving uncommitted work to switch contexts or pull upstream changes quickly.

---

## Recommended Free Official Resources

- **Pro Git Book (git-scm.com/book)**: The official, complete, free book by Scott Chacon and Ben Straub covering everything from basic snapshots to internal plumbing objects.
- **Learn Git Branching (learngitbranching.js.org)**: Visual, interactive game that simulates tree branches, commits, cherry-picks, and rebases in the browser.
- **GitHub Docs - Pull Request Guidelines**: Practical official guide on managing collaborative forks, branches, and code reviews (`docs.github.com`).

---

## Professional Pull Request (PR) Checklist

A strong pull request demonstrates professionalism and respect for team members' review time:
1. **Title**: Follow Conventional Commits format (e.g., `feat(rag): add atlas vector search pipeline`).
2. **Summary**: Provide a 2-4 sentence description of the business motivation, what changed, and how it was implemented.
3. **Testing Evidence**: Note test results, test coverage numbers, and screenshots or CLI output demonstrating success.
4. **Breaking Changes**: Explicitly document any required database migrations, environment variable additions, or dependency updates.
