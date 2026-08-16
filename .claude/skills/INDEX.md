# Skills Index

> Generated from `.claude/skills/*/SKILL.md` by `scripts/update-skills-index.mjs`. Do not edit by
> hand — run the generator (or `create-skill` regenerates it). `check-consistency` enforces that
> this index lists exactly the skills that exist. Skills are auto-discovered by opencode and
> Claude Code from `.claude/skills/`; this file is the human/agent-readable catalog.

| Skill | Purpose |
|---|---|
| `adopt-project` | Add the spec-driven + TDD methodology to a repository that **already has a stack, code, and possibly its own `AGENTS.md`, CI, and `package.json`**. |
| `check-consistency` | Validate that every skill in `.claude/skills/` and the project's conventions hold, using a real script so the result is deterministic (not a best-effort prose scan). |
| `create-case` | Transformar uma ideia de mistério num módulo jogável e **válido**: pistas que exigem deslocamento real, um grafo de dedução que fecha, e uma solução que só se alcança raciocinando. |
| `create-character-agent` | Dar voz a alguém do caso: um agente que conversa livremente, responde ao que foi realmente perguntado — e que **não inventa**, porque tudo que ele afirma passa pela lore. |
| `create-project` | One-shot skill that bootstraps a completely new project from the starter-kit. |
| `create-skill` | Guide to create new, standardized skills for this project. |
| `cut-release` | Prepare a release deterministically and safely. |
| `gather-requirements` | Guide the requirements elicitation process — from a raw idea or problem statement to a structured requirements document. |
| `init-project` | Guide users through the initial setup of a new project following the spec-driven + TDD methodology. |
| `playtest-case` | Responder, sem sair do lugar, à pergunta que de outro modo só apareceria no meio da rua: **este caso fecha?** |
| `reconcile-upgrade` | Finish a methodology upgrade. |
| `record-troubleshooting` | Turn a hard-won debugging session into persistent project memory. |
| `resume-session` | Print a "where you left off" summary so a new session regains context without re-reading the whole project. |
| `review-alignment` | Semantically verify that a spec faithfully covers its requirements document, producing a stamped `alignment-review.md` verdict per requirement. |
| `run-change` | Keep the methodology proportional to the change. |
| `run-tdd` | Guide agents through the Test-Driven Development cycle integrated with the spec-driven methodology. |
| `update-changelog` | Generate changelog entries from archived specs using a real script. |
| `upgrade-methodology` | Bring a project that already uses the methodology up to the starter-kit's latest version, applying **only the delta** — non-destructively, never re-running setup and never clobbering project content. |
| `validate-module` | Rodar o validador e transformar a saída em conversa útil: cada código de diagnóstico existe por uma razão de jogo, e o autor merece saber qual é. |
