# Contributing

Thank you for your interest in contributing to Navo.

Navo is a day planning system built around how people naturally move through the physical world. We welcome contributions of all sizes — from documentation and bug fixes to new features and design discussions.

---

## Read This First

Before contributing, read these documents in order:

1. [VISION.md](VISION.md) — Understand why Navo exists
2. [MENTAL_MODEL.md](MENTAL_MODEL.md) — Understand how the system thinks
3. [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) — The rules that guide every decision
4. [ARCHITECTURE.md](ARCHITECTURE.md) — The structural model
5. [GLOSSARY.md](GLOSSARY.md) — The shared language

These documents define the philosophy and terminology. **Any contribution that conflicts with them will need to be rethought, not just rebased.**

---

## The Non-Negotiables

Before implementing anything, internalise these:

**Location is structural, not optional.**
Work happens somewhere. Location is a first-class property of work items, not a tag.

**The map is the foundation.**
Navo is a physically-grounded planning system. Features that ignore location and movement are incomplete.

**The route enables and disables work.**
As someone moves through their day, proximity to locations determines what work is possible. This is the core mechanic.

**Intent carries context from the start.**
When someone forms an intent, they already know budget, who it is for, and timing. Capture that. Do not ask for it later.

**Progressive discovery over upfront definition.**
Work is found as intent becomes clearer. Do not force users to define everything before they start.

---

## Ways to Contribute

- Improving documentation
- Reporting bugs
- Proposing new features (with a design discussion first)
- Writing tests
- Implementing features
- Reviewing pull requests
- Improving the map and routing experience

---

## Before Implementing a Feature

Ask these questions:

1. Does this serve the core use case: *what am I doing today, where, and in what order?*
2. Does it involve location or route? If so, is location treated as first-class?
3. Does it align with at least one principle in [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)?
4. Would it make Navo feel more like a to-do list or project manager? If yes, reconsider.
5. Does it use the language defined in [GLOSSARY.md](GLOSSARY.md)?

If any answer is unclear, **start a discussion before writing code.**

---

## Pull Requests

Keep pull requests focused. One problem, solved well.

Include:
- A clear description of what this solves
- Motivation — which user scenario does this improve?
- Design decisions and trade-offs considered
- Screenshots or recordings for UI changes
- Documentation updates if behaviour changes

---

## Coding Standards

- Prefer readability over cleverness
- Write self-explanatory code
- Keep functions and components focused on one thing
- Use the terminology from [GLOSSARY.md](GLOSSARY.md) in variable names, comments, and UI copy
- Location must always be a typed entity, never a raw string

---

## Design Discussions

Significant architectural or product changes must begin as a GitHub Discussion or Issue.

This allows the community to review direction before code is written. Ideas that conflict with the vision can be redirected early rather than after significant work.

---

## Code of Conduct

By participating in this project, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Thank you for helping build Navo.
