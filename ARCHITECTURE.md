# Architecture

This document describes the conceptual architecture of Navo.

It defines the core building blocks and how they relate to each other. It does not describe implementation details.

---

## Design Philosophy

Navo models how people plan and move through their day, not how software stores data.

People start with intentions. Intentions carry context from the beginning. Context shapes what work gets discovered. Work gets executed through a day shaped by location, time, and movement.

The route through locations is the engine of the day. Moving changes what is possible.

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

---

## Core Building Blocks

### Intent

An Intent represents an outcome someone wants to achieve.

Intents are formed before the how is known. They carry context from the start.

**Examples:**

- Get vegetables for dinner
- Plan a vacation
- Prepare for an interview

**Context carried with the intent:**

- Budget
- Number of people involved
- Time constraints
- Personal preferences and constraints

> **Intent answers: Why does this work exist?**

---

### Work

Work is any action that moves an intent forward.

Work is discovered progressively as intent becomes clearer and context changes.

**Types of work:**

- Task (a clear, actionable step)
- Decision (choosing between alternatives)
- Research (gathering information before acting)
- Purchase (acquiring something)
- Errand (going somewhere to do something)
- Preparation (making something ready)

Work has relationships. One piece of work may depend on another. Completing one may unlock several more.

> **Work answers: What needs to happen?**

---

### Context

Context is everything that influences how and when work can be done.

Context is not an afterthought. It is present at the moment the intent forms.

**Dimensions of context:**

- **Who**: how many people, who else is involved
- **Budget**: financial constraints
- **Time**: deadlines, availability windows
- **Location**: where you are and where you need to be
- **Energy**: capacity at a given moment
- **Constraints**: things that cannot change

Context changes throughout the day. As context changes, the optimal plan changes.

> **Context answers: What is true right now that shapes the decision?**

---

### Location

Location is where work can happen.

Location is a first-class citizen in Navo, not a tag or a label.

**Location has properties:**

- Physical coordinates (latitude, longitude)
- Opening hours and availability
- Distance from current position
- Whether it falls on the planned route
- Cost or effort to reach it

Multiple pieces of work may share a location. A single trip can fulfil multiple intents.

> **Location answers: Where can this work happen?**

---

### Route

A route is the planned sequence of locations for the day.

The route is not just about travel. It determines what work is possible.

**As a route changes:**

- Some work becomes accessible (you pass a shop that is relevant)
- Some work becomes inaccessible (you miss the window to stop)
- New opportunities emerge (something you did not plan for becomes easy to do)

The route is dynamic. It adapts as the day evolves.

> **Route answers: What is possible as I move through the day?**

---

### Opportunity

An Opportunity is work that becomes possible or significantly easier due to the current context — particularly location and time.

Opportunities are surfaced by Navo automatically. They are not created manually.

**Examples:**

- Passing a farmers' market while already heading downtown
- Being near a pharmacy when a prescription needs collecting
- Having 30 free minutes near a preferred restaurant

Opportunities are how Navo turns a route into a productive day.

> **Opportunity answers: What can I pick up or knock off while I am here?**

---

### Plan

A plan is the proposed path through work for a given time horizon.

Plans are dynamic. They are expected to evolve as work is completed, context shifts, and new opportunities emerge.

A plan for a day is built from:

1. The intents active for the day
2. The work that needs to happen
3. The locations where work can happen
4. The route connecting those locations
5. Time windows when work is possible

> **Plan answers: What is the best path forward right now?**

---

## The Map as the Core Interface

The map is the primary interface through which day planning becomes real.

Without the map, planning is abstract. With the map:

- You can see whether work is on your route or out of the way
- You can combine errands that share a location
- You can understand the real cost (time, distance, effort) of decisions
- Opportunities surface naturally as your route intersects with relevant locations

The map is not a view. It is the foundation.

---

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

Everything is connected.

Location and route are not metadata. They are structural.

---

## Multiple Perspectives

The same model can be viewed differently depending on the question being asked.

| View            | Primary Question                                    |
| --------------- | --------------------------------------------------- |
| **Intent View** | What am I trying to achieve and why?                |
| **Work Graph**  | What needs to happen and what depends on what?      |
| **Map View**    | Where does everything happen and is it on my route? |
| **Day Planner** | What am I doing today and in what order?            |
| **Timeline**    | How does this unfold over days and weeks?           |
| **Calendar**    | When is work scheduled?                             |

No view owns the data. All views represent the same underlying model.

---

## Guiding Rule

There is one source of truth: the connected model of intents, work, context, locations, and routes.

Every screen, view, planner, map, and timeline is a lens on the same reality.

The software adapts to how people move and think. People do not adapt to the software.
