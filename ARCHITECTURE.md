# Architecture

This document describes how Navo thinks, how it's structured, the design principles that follow from that, and the shared vocabulary. It replaces what used to be four separate documents (Architecture, Mental Model, Design Principles, Glossary) — they restated the same core loop and the same "one model, many views" table repeatedly, which made them easy to let drift out of sync. `VISION.md` covers the "why"; this document covers the "how" and the rules.

---

## Design Philosophy

Navo models how people plan and move through their day, not how software stores data.

People start with intentions. Intentions carry context from the beginning. Context shapes what work gets discovered. Work gets executed through a day shaped by location, time, and movement. The route through locations is the engine of the day — moving changes what is possible.

```
Intent (with Context)
       │
       ▼
  Work Graph
  (discovered progressively)
       │
       ▼
  Day Planning
  (time + locations + route)
       │
       ▼
  Route surfaces Opportunities
       │
       ▼
  Execution as you move
       │
       ▼
  New Work and New Intents
```

This loop never truly ends — it's a living model of how a day unfolds, not a project management system.

For the full narrative walkthrough of how this loop plays out in a day ("get vegetables for dinner"), see [VISION.md](VISION.md#what-this-looks-like).

## Core Building Blocks

| Block           | Answers                                    | Examples                                                                              |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Intent**      | Why does this work exist?                  | Get vegetables for dinner, plan a vacation, prepare for an interview                  |
| **Work**        | What needs to happen?                      | Task, decision, research, purchase, errand, preparation                               |
| **Context**     | What is true right now?                    | Who's involved, budget, time constraints, location, energy, other constraints         |
| **Location**    | Where can this work happen?                | A physical place with coordinates, address, distance, route membership                |
| **Route**       | What's possible as I move through the day? | The planned sequence of locations; dynamic, adapts as the day evolves                 |
| **Opportunity** | What can I pick up while I'm here?         | Work that becomes possible or easier because of current location/time                 |
| **Plan**        | What's the best path forward right now?    | A proposed, continuously evolving path built from intents, work, locations, and route |

Work has relationships — one piece may depend on another, completing one may unlock several more. Location is a first-class citizen, not a tag: multiple pieces of work may share a location, and a single trip can fulfil multiple intents. Opportunities are surfaced automatically by Navo, never created manually.

## The Map as the Core Interface

The map is the primary interface through which day planning becomes real — not a view, but the foundation. Without it, planning is abstract: you can't tell whether a shop is on your route, whether two errands can be combined into one trip, or what a decision actually costs in time and distance.

## Relationships

```
Intent ──────────────┐
  │                  │
  │ has context      │ has many
  │                  ▼
  ▼               Work ◄────────► Work
Context              │           (depends on)
  │                  │ happens at
  │                  ▼
  │              Location
  │                  │
  │                  │ connected by
  │                  ▼
  └─────────────► Route
                     │
                     │ surfaces
                     ▼
                 Opportunity
```

Everything is connected. Location and route are structural, not metadata.

## One Model, Many Views

The underlying model never changes. Different views simply answer different questions about the same connected data — no view owns the data, and nothing is duplicated between them.

| View        | Answers                                      |
| ----------- | -------------------------------------------- |
| Intent View | What am I trying to achieve?                 |
| Work Graph  | What needs to happen and in what order?      |
| Map View    | Where does it happen, and is it on my route? |
| Day Planner | What should I do today and when?             |
| Timeline    | How does this unfold over time?              |
| Calendar    | When is work scheduled?                      |

## Guiding Rule

There is one source of truth: the connected model of intents, work, context, locations, and routes. Every screen, view, planner, map, and timeline is a lens on the same reality. The software adapts to how people move and think — people don't adapt to the software.

---

## Design Principles

These principles guide every design and engineering decision in Navo. They are intentionally stable and should rarely change.

1. **Intent before work.** People start with desires, not definitions. Work is discovered progressively as the intent becomes clearer.
2. **Context is present from the start.** It arrives with the intent, not as an afterthought.
3. **The day is the unit of execution.** Everything ultimately flows into: what am I doing today, where, and in what order?
4. **Location and route are structural, not optional.** A feature that ignores the physical dimension of planning is incomplete.
5. **The map is the foundation**, not a feature bolt-on.
6. **Opportunities are discovered through movement**, and must be relevant to context rather than noise.
7. **Work is a network, not a list.** Relationships between work items are first-class citizens.
8. **Planning is continuous discovery.** Rigidity — forcing everything to be defined upfront — is a failure of design.
9. **Plans adapt to reality** without friction, rather than holding on to a plan that no longer fits.
10. **One system, many perspectives.** Changing the view never changes the underlying reality, and no view owns the data.
11. **Software adapts to people**, not the other way around.
12. **Human language first.** "Get vegetables for dinner," not "Create task: Grocery type: errand."

---

## Glossary

Common language used throughout Navo. Every feature, discussion, API, and data model should use these terms consistently.

- **Intent** — An outcome someone wants to achieve, formed before the how is known. Carries context from the moment it's formed; doesn't require a plan to exist.
- **Context** — Everything true at the moment of forming an intent or making a decision (who, budget, timing, location, constraints). Not static — changes throughout the day, and the plan adapts with it.
- **Work** — Any action that moves an intent forward; discovered progressively rather than known all at once. Has dependencies — some work can only begin once other work is done.
- **Task** — Work with a clear, specific action (e.g. "buy milk"). All tasks are work; not all work is a task.
- **Decision** — Work that requires choosing between alternatives, often unlocking new work once made.
- **Dependency** — A relationship where one piece of work must be done before another can begin; work forms a directed graph through these.
- **Location** — A physical place where work can happen. A structural property of work, not a tag — has coordinates, name/address, and a provider place ID.
- **Route** — The planned, dynamic sequence of locations that makes up a day. Determines what's possible and surfaces opportunities as you move through it.
- **Opportunity** — Work that becomes possible or easier because of current context, especially location and time. Surfaced by the system, not manually created, and disappears if the context that created it changes.
- **Day Plan** — The complete picture of a single day: intents being pursued, work to do, locations to visit, and the route connecting them. Answers "what am I doing today, where, and in what order?"
- **Map** — The interface that grounds planning in physical reality: shows where work can happen relative to your position, reveals detours, surfaces opportunities, makes cost visible.
- **Plan** — A proposed, ever-evolving path through work, time, and location — built from active intents, discovered work, locations, route, and feasible time windows.
- **Schedule** — Places work into specific time slots. Scheduling answers _when_; planning answers _how and in what order_; routing answers _where and whether it's feasible today_.
- **View** — A way of presenting the same underlying model (see [One Model, Many Views](#one-model-many-views)); changing the view never changes the underlying data.
- **Flow** — How work evolves over time: splitting, merging, branching, pausing, resuming, generating new work. Not linear.
- **Collaboration** — The participation of multiple people in the same intent or work, potentially at different stages; part of the model, not an add-on.
