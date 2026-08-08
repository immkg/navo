# Scheduling

Scheduling places work into time.

It is one dimension of planning — but only one.

---

## Scheduling vs. Planning vs. Routing

These three activities are separate in Navo:

| Activity | Question |
|----------|---------|
| **Planning** | What needs to happen and in what order? |
| **Scheduling** | When exactly should this happen? |
| **Routing** | Where and how do I get there efficiently? |

Most planning tools treat these as the same thing. Navo separates them because they serve different purposes and evolve at different speeds.

---

## Not All Work Needs a Schedule

This is a core difference from calendar-first tools.

Some work has hard timing:
- A meeting at 3pm
- A shop that closes at 6pm
- A deadline tomorrow morning

Some work is opportunistic:
- "Buy vegetables while near the market"
- "Drop off the package if passing the post office"
- "Grab coffee if I have 10 free minutes"

Opportunistic work is not scheduled. It is **enabled by context** — specifically by location and available time on the route.

Forcing all work into a schedule destroys its opportunistic nature.

---

## Schedule as a Constraint, Not a Plan

When work does have a schedule, Navo treats that schedule as a **constraint** — not the plan itself.

A meeting scheduled at 3pm creates a time window: everything before 3pm must fit into the morning, and everything after 3pm fits in the afternoon.

The schedule constrains the route. The route shapes what work is possible in each window.

---

## Scheduling in Day Planning

When you build a day plan, scheduling provides the fixed anchors:

```
8:00am  ← leave home
         (route window: home → office)
9:00am  ← arrive at office
         (work window: 3 hours at desk)
12:00pm ← lunch break near office
         (route window: 30-minute radius)
1:00pm  ← back at office
         (work window: 2 hours)
3:00pm  ← meeting (fixed, scheduled)
5:00pm  ← leave office
         (route window: office → gym → home)
7:00pm  ← dinner (intent: vegetables, 4 people)
```

The route windows between fixed points are where Navo surfaces opportunities for work that does not have a fixed time.

---

## Key Principle

> Scheduling answers **when**. But most of daily life is not scheduled — it is **opportunistic**.

Navo is built for both. Fixed schedules provide the structure. Routes and context surface the opportunities in between.
