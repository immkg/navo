# Navo Agent Instructions

Welcome, Agent. If you are reading this file, you are working in the Navo repository.

Navo is a **day planning system** grounded in how people naturally move through the world.

Before reading any further, read these foundational documents in order:

1. `MENTAL_MODEL.md` — understand the vision
2. `ARCHITECTURE.md` — understand the structure
3. `DESIGN_PRINCIPLES.md` — understand the rules
4. `GLOSSARY.md` — understand the language

---

## The Core Vision (Read This First)

Navo is not a task manager. It is not a project management tool.

**Navo is a day planning system built around how people move through the physical world.**

The insight at the heart of Navo:

> People form **intents** (outcomes they want) before they know the plan.
> Intents carry **context** from the start (budget, people, timing, constraints).
> **Work** to fulfil the intent is discovered progressively, not defined upfront.
> Work happens in **locations**.
> Locations are connected by **routes**.
> As someone moves along a route, **opportunities** to complete work emerge or disappear.
> The **map** is the interface that makes this real.

**The day is the unit of execution.** Every feature must serve the question: _what am I doing today, where, and in what order?_

---

## Mental Model in One Paragraph

Someone decides to "get vegetables for dinner." At this moment, they do not have a shopping list or a chosen shop. But they know how many people they are cooking for, their budget, and what time dinner needs to be ready. As the day is planned — home → office → gym — they notice the route passes a farmers' market. The context (location, time, intent) surfaces an opportunity: stop at the market on the way. Work that was abstract becomes real and executable because of the route.

**This is the experience Navo builds.**

---

## Your Role as an Agent

### Understand Before You Build

- Never build a feature without understanding which part of the mental model it serves.
- Ask: does this feature help someone plan their day? Does it use location and route? Does it surface opportunities?

### Language Matters

- Always use the terms defined in `GLOSSARY.md`.
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

- Any feature must satisfy at least one of the principles in `DESIGN_PRINCIPLES.md`.
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

To stay on track, it helps to know what Navo is not:

| Not This          | But This                              |
| ----------------- | ------------------------------------- |
| A to-do list app  | A day planning system                 |
| A project manager | An intent-driven day organiser        |
| A calendar app    | A route-aware opportunity engine      |
| A task tracker    | A work discovery and execution system |

If a proposed feature makes Navo feel more like any of the left column, pause and reconsider.

---

By following these instructions, you ensure that every decision keeps Navo true to its vision: a system where the route through your day determines what is possible, and where software adapts to the way people actually live.
