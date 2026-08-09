# Planner Specification

## Purpose

The Day Planner is where intents, work, locations, and routes come together into an actionable picture of the day.

Its job is to help the user answer one question:

> **What am I doing today, where, and in what order?**

The Planner recommends. It never controls.

---

## What the Planner Does

The Planner takes everything the user wants to achieve and produces a realistic, route-aware plan for the day.

It is not a to-do list. It is a day plan grounded in physical reality.

---

## Inputs

| Input                 | Description                                        |
| --------------------- | -------------------------------------------------- |
| **Active Intents**    | What the user wants to achieve                     |
| **Work Items**        | Discovered work for each intent, with locations    |
| **Fixed Commitments** | Scheduled meetings, appointments, hard constraints |
| **Current Location**  | Where the user is starting from                    |
| **Time Available**    | When the day starts and ends                       |
| **Route Preferences** | Preferred transport, avoided areas, etc.           |
| **Context**           | Budget, energy level, priorities                   |

---

## Outputs

| Output                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| **Day Route**             | An ordered sequence of locations to visit                |
| **Work at Each Stop**     | What can be done at each location                        |
| **Opportunities Flagged** | Work from other intents that fits the route              |
| **Time Estimates**        | Approximate timing for each stop and transit             |
| **Deferred Work**         | Work that does not fit today with suggested alternatives |

---

## The Map Is the Foundation

The Planner's primary view is the map.

A list of tasks without location context is incomplete. The Planner always shows:

- Where each piece of work happens
- Whether it is on the planned route or requires a detour
- The travel cost (time, distance) of including each stop
- The time windows available at each location

Planning begins with the geography of the day. Work is fitted into that geography.

---

## Planning Flow

```
1. User opens the Day Planner
2. Active intents are listed with their work
3. Fixed commitments anchor the route
4. Planner suggests a route connecting the work locations
5. Opportunities are surfaced along that route
6. User adjusts and approves the route
7. Navigation takes over for real-time guidance during execution
8. As context changes, the Planner updates the remaining plan
```

---

## Rules

The Planner:

- **Continuously adapts** — the plan is a living document, not a fixed schedule
- **Explains recommendations** — every suggestion has a visible reason
- **Respects user decisions** — if the user rejects a suggestion, it is remembered
- **Never modifies work automatically** — the user always approves changes
- **Surfaces conflicts** — if two pieces of work cannot coexist today, the Planner flags it
- **Combines intents** — if two intents share a location, the Planner suggests combining the trips

---

## What the Planner Is Not

- Not a rigid schedule with every minute assigned
- Not a task list that ignores location
- Not a calendar with fixed slots
- Not a system that locks you into a plan made at 8am

The Planner is a living model of the day that adapts as the day happens.

---

## Goal

Make it easy to answer: _given everything I want to do today and everywhere I need to be, what is the smartest way to move through my day?_

Reduce the mental load of that question to almost nothing.
