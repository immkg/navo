# Glossary

This document defines the language used throughout Navo.

Every feature, discussion, API, and data model must use these terms consistently. When in doubt, refer to this document before using a term.

---

## Intent

An **Intent** is an outcome someone wants to achieve.

It is formed before the how is known. It represents a desired end state, not a list of steps.

**Examples:**
- "Get vegetables for dinner"
- "Plan a vacation"
- "Prepare for the interview"

An Intent does not require a plan to exist. It exists the moment someone decides they want something to happen.

Intents carry **Context** from the moment they are formed.

---

## Context

**Context** is everything that is true at the moment of forming an intent or making a decision.

Context comes before the plan. It shapes what work is relevant, when work can happen, and how it should be done.

**Examples:**
- Cooking for 4 people tonight (shapes what vegetables to buy)
- Budget of ₹500 (rules out premium shops)
- 30 minutes free before a meeting (limits which errands are feasible)
- Already in the neighbourhood of a market (makes this the obvious moment)

Context is not static. It changes throughout the day. As context changes, the plan adapts.

---

## Work

**Work** is any action that moves an intent forward.

Work is discovered progressively. Not all of it is known when the intent is first formed.

**Types of Work:**
- **Task** — a clear, actionable step ("write the shopping list")
- **Decision** — choosing between alternatives ("decide which market to go to")
- **Errand** — going somewhere to do something ("visit the market")
- **Research** — gathering information before acting ("check what vegetables are in season")
- **Purchase** — acquiring something ("buy the tomatoes and spinach")
- **Preparation** — making something ready for a later step ("chop the vegetables")

Work has dependencies. Some work can only begin after other work is completed.

---

## Task

A **Task** is work with a clear, specific action.

All tasks are work. Not all work is a task.

**Examples:**
- "Buy milk"
- "Call the venue"
- "Print the boarding pass"

---

## Decision

A **Decision** is work that requires choosing between alternatives.

Decisions often unlock new work once made.

**Examples:**
- "Choose which market to visit"
- "Decide between two routes"
- "Pick which recipe to cook"

---

## Dependency

A **Dependency** is a relationship where one piece of work must be done before another can begin.

Work forms a directed graph through dependencies.

**Example:**
- "Write the shopping list" must be done before "Buy the vegetables"
- "Check what is already at home" must be done before "Write the shopping list"

---

## Location

A **Location** is a physical place where work can happen.

Location is not a tag or a note. It is a structural property of work.

**Properties of a location:**
- Physical coordinates
- Name and address
- Opening hours
- Type (shop, office, home, gym, etc.)
- Distance from current position

A single location may be relevant to multiple pieces of work and multiple intents.

---

## Route

A **Route** is the planned sequence of locations that makes up a day.

The route is the spine of day planning. It determines what is possible.

**A route:**
- Connects the locations you need to visit
- Has a travel time and distance between each stop
- Changes what work is accessible as you move through it
- Surfaces opportunities for work that fits the path

The route is dynamic. It changes as the day unfolds.

---

## Opportunity

An **Opportunity** is work that becomes possible or easier because of the current context, especially location and time.

Opportunities are surfaced by the system. They are not manually created.

**Examples:**
- You are passing a pharmacy → "collect the prescription" becomes a natural stop
- You have 20 free minutes near a print shop → "print the documents" is now feasible
- Your route passes a farmers' market → "buy vegetables for dinner" is on the way

An opportunity disappears if the relevant context changes (you miss the stop, the shop closes, the time window passes).

---

## Day Plan

A **Day Plan** is the complete picture of a single day: the intents being pursued, the work to be done, the locations to visit, and the route that connects them.

A day plan answers: "What am I doing today, where, and in what order?"

The map is essential to a day plan. Without it, the plan is abstract.

---

## Map

The **Map** is the interface that grounds planning in physical reality.

The map:
- Shows where work can happen relative to where you are
- Reveals whether work is on your route or requires a detour
- Surfaces opportunities as location context changes
- Makes the cost (time, distance) of decisions visible

The map is not a feature. It is the foundation of day planning in Navo.

---

## Plan

A **Plan** is a proposed path through work, time, and location.

Plans are dynamic. They evolve continuously as work is completed, context changes, and opportunities emerge.

A plan for today is built from:
1. Active intents
2. Discovered work
3. Locations where that work can happen
4. A route connecting those locations
5. Time windows when each piece of work is feasible

---

## Schedule

A **Schedule** places work into specific time slots.

Scheduling answers **when**.

Planning answers **how** and **in what order**.

Routing answers **where** and **whether it is feasible today**.

---

## View

A **View** is a way of presenting the same underlying model.

Changing the view never changes the underlying data.

| View | Question it answers |
|------|-------------------|
| Intent View | What am I trying to achieve? |
| Work Graph | What needs to happen and in what order? |
| Map View | Where does work happen and is it on my route? |
| Day Planner | What am I doing today and when? |
| Timeline | How does this unfold over days and weeks? |
| Calendar | When is work scheduled? |

---

## Flow

**Flow** describes how work evolves over time.

Work can:
- Split into multiple sub-tasks
- Merge with other work
- Branch based on a decision
- Pause and resume
- Generate new work on completion

Flow is not linear. It reflects the real, messy nature of getting things done.

---

## Collaboration

**Collaboration** is the participation of multiple people in the same intent or work.

Different people may contribute at different stages.

Collaboration is part of the model. It is not an add-on.
