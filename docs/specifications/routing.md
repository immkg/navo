# Routing Specification

## Purpose

Routing determines the most effective path through locations for a given day.

Unlike scheduling (which handles time) and planning (which handles order), routing handles **physical movement** — connecting the locations where work happens into a practical sequence.

---

## Why Routing Is Central to Navo

The route through locations is the spine of the day.

As someone moves along a route:

- Work at nearby locations becomes accessible
- Work at missed locations becomes inaccessible
- New opportunities surface that were not initially planned

The route is not just travel. It is the mechanism through which work becomes possible or impossible.

A plan without a route is abstract. A plan with a route is something that can actually be executed today.

---

## What Routing Considers

| Factor               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| **Location of work** | Where each piece of work needs to happen                   |
| **Current position** | Where the person is right now                              |
| **Planned stops**    | Fixed commitments (office, meetings, appointments)         |
| **Travel time**      | Time to move between locations                             |
| **Opening hours**    | When each location is accessible                           |
| **Time windows**     | Available time between fixed commitments                   |
| **Dependencies**     | Work that must happen before other work                    |
| **Budget**           | Whether detours are worth the time cost                    |
| **Opportunities**    | Work that naturally fits the route with minimal added cost |

---

## Route Inputs

To compute a route, Navo uses:

- The day's active intents
- All work items associated with those intents that have a location
- Fixed commitments (scheduled meetings, appointments)
- The person's starting point
- Available travel time throughout the day

---

## Route Outputs

A route produces:

- An ordered sequence of locations to visit
- The work that can be completed at each stop
- Estimated travel and stop times
- Opportunities flagged along the path
- Work that does not fit today and should be deferred

---

## Opportunity Detection

The route is also how Navo detects **opportunities** — work from other intents that can be combined with the planned route at minimal extra cost.

**Example:**

- Planned route: Home → Office → Gym → Home
- Intent A: Buy vegetables (market is 200m off the gym route)
- Intent B: Pick up dry cleaning (dry cleaner is on the way home from gym)

Both can be folded into the existing route as natural stops.

Navo surfaces these overlaps rather than treating each intent's work in isolation.

---

## Rules

Routes are:

- **Dynamic** — recomputed as context changes throughout the day
- **Context-aware** — adapted to current location, time, and remaining work
- **Explainable** — the user can understand why a particular stop is suggested
- **User-controlled** — the user always approves or adjusts the final route

Multiple valid routes may exist for the same set of work. Navo presents options but the person always decides.

---

## Optimisation Factors

Routes can be optimised for different priorities:

- **Minimum distance** — spend as little time travelling as possible
- **Maximum completion** — fit the most work into the day
- **Time windows** — respect location opening hours and personal commitments
- **Combined trips** — fulfil multiple intents in single journeys
- **User preference** — preferred routes, avoided areas, transport modes

The default optimisation balances completion and efficiency. Users can adjust their preferences.

---

## Relationship to Planning

Routing is one layer of planning:

```
Planning layer:   What needs to happen?
Routing layer:    Where does it happen and in what order?
Scheduling layer: When exactly is each step?
```

These layers are computed together but kept conceptually separate so each can evolve independently.
