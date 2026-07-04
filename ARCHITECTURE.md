# Architecture

This document describes the conceptual architecture of Navo.

It defines the core building blocks of the system and how they relate to each other. It does not describe implementation details.

---

# Design Philosophy

Navo models how people think, not how software stores data.

People begin with intentions. Intentions create work. Work happens within context. Context influences decisions. Decisions reshape plans.

Everything in Navo builds upon these concepts.

```
Intent
   │
   ▼
 Work
   │
   ▼
Context
   │
   ▼
 Planning
   │
   ▼
 Execution
   │
   ▼
 Discovery
   │
   └──────────────┐
                  ▼
              New Work
```

The cycle never truly ends.

---

# Core Building Blocks

## Intent

Represents an outcome someone wants to achieve.

Examples

- Plan a vacation
- Organize a wedding
- Buy groceries
- Prepare for interviews

Intent answers:

> Why does this work exist?

---

## Work

Represents anything that moves an intent forward.

Examples

- Task
- Decision
- Meeting
- Approval
- Reminder
- Research
- Purchase

Work answers:

> What needs to happen?

---

## Context

Represents everything that influences work.

Examples

- Time
- Place
- People
- Resources
- Constraints
- Priority
- Energy
- Budget

Context answers:

> What is true right now?

---

## Plan

A plan connects work into a proposed path.

Plans are dynamic.

They evolve continuously as work progresses.

Plan answers:

> What is the best path forward?

---

## Execution

Execution is the process of performing work.

Execution produces outcomes.

Those outcomes often generate new work.

Execution answers:

> What happened?

---

# Relationships

The power of Navo comes from relationships rather than hierarchy.

```
Intent
   │
   ├─────────────┐
   ▼             ▼

Work ◄──────► Work

 │             │

 ▼             ▼

Context     Context

 │

 ▼

People

Time

Locations

Resources
```

Everything is connected.

Relationships are first-class citizens.

---

# Planning Model

Navo separates planning from scheduling.

Planning determines what path should be taken.

Scheduling determines when work should happen.

Routing determines the most effective order.

Execution determines what actually happened.

Each answers a different question.

---

# Multiple Perspectives

The same information can be viewed differently.

```
Intent View

Daily Planner

Timeline

Calendar

Kanban

Map

Graph

List
```

These are different representations of the same underlying model.

No information is duplicated.

No view owns the data.

---

# Guiding Rule

There is only one source of truth.

Every screen, workflow, planner, calendar, route, timeline, and visualization is simply another perspective of the same connected model.
