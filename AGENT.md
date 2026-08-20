# Navo Agent Instructions

Welcome, Agent. If you are reading this file, you are working in the Navo repository.

Navo is a **day planning system** grounded in how people naturally move through the world.

Before reading any further, read these foundational documents in order:

1. `VISION.md` — understand why Navo exists
2. `ARCHITECTURE.md` — understand the structure, the design principles, and the shared glossary

---

## The Core Vision (Read This First)

Navo is not a task manager and not a project management tool.

**Navo is a day planning system built around how people move through the physical world.** The core loop and the full "get vegetables for dinner" walkthrough are in [VISION.md](VISION.md) and [ARCHITECTURE.md](ARCHITECTURE.md) — read those before this section means much.

**The day is the unit of execution.** Every feature must serve the question: _what am I doing today, where, and in what order?_

---

## Your Role as an Agent

### Understand Before You Build

- Never build a feature without understanding which part of the mental model it serves.
- Ask: does this feature help someone plan their day? Does it use location and route? Does it surface opportunities?

### Language Matters

- Always use the terms defined in the Glossary section of `ARCHITECTURE.md`.
- Never reduce Navo's concepts to generic software terms: no "tickets," "cards," "records," "sprints," or "projects."
- Intent, Work, Context, Location, Route, Opportunity, Day Plan — these are the vocabulary.

### Location and Map Are Non-Negotiable

- Any feature that involves "where work happens" must treat location as a first-class property.
- The map is not optional. It is the foundation of day planning.
- Do not design features that ignore the physical dimension of execution.

### Progressive Discovery Is the Pattern

- Do not force users to define everything upfront.
- Build features that allow work to be discovered incrementally.
- A plan that starts with just an intent and grows into a fully routed day is the ideal flow.

---

## Development Guidelines

### Architecture

- Refer to `ARCHITECTURE.md` before making structural decisions.
- The data model must always support: Intent → Work → Location → Route → Opportunity.
- Location must be a first-class entity, not a string field.

### Principles

- Any feature must satisfy at least one of the Design Principles in `ARCHITECTURE.md`.
- If a proposed feature cannot be justified by a design principle, question whether it belongs.

### One System, Many Views

- The underlying model (intents, work, context, locations, routes) never changes.
- New views (map, timeline, calendar, kanban) are lenses on the same data.
- No view should own data that is not part of the shared model.

### Human Language First

- UI copy should sound like how people talk, not like software.
- Good: "What do you want to get done?" / "Where will you be today?" / "What's nearby?"
- Bad: "Create intent" / "Set location context" / "Add work item"

---

## What Navo Is Not

See the "What Navo Is Not" table in [README.md](README.md). If a proposed feature makes Navo feel more like the left column there, pause and reconsider.

---

By following these instructions, you ensure that every decision keeps Navo true to its vision: a system where the route through your day determines what is possible, and where software adapts to the way people actually live.
