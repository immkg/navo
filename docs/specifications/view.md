# View Specification

## Purpose

Views present the same underlying model from different perspectives.

A view answers a specific question about the data. It does not own data. It does not duplicate data.

Changing a view never changes the underlying model.

---

## The Map Is the Primary View

The Map view is the most important view in Navo. It is the only view that reveals the physical dimension of the day — where work happens, whether it is on your route, and what opportunities are available.

All other views are valid and useful perspectives. But they are incomplete without the geographic reality the map provides.

---

## Available Views

### Map View

**Question it answers:** Where does work happen, and is it on my route?

- Shows all work items that have locations, plotted on a map
- Shows the planned route for the day
- Highlights opportunities along the route
- Shows travel time and distance between stops
- Surfaces work at locations you are passing through

**This is the primary interface for day planning.**

---

### Day Planner View

**Question it answers:** What am I doing today and in what order?

- Shows the day's route with work organised by stop
- Includes time estimates and travel windows
- Shows fixed commitments (meetings, appointments)
- Highlights opportunities that fit the day's route

---

### Intent View

**Question it answers:** What am I trying to achieve and how is it progressing?

- Lists all active intents with their context
- Shows the work discovered for each intent
- Provides an overview of progress across all goals

---

### Work Graph View

**Question it answers:** What needs to happen and what depends on what?

- Shows work items as nodes in a graph
- Shows dependencies between work items
- Reveals which work is blocked and which is ready
- Groups by intent or by location

---

### Timeline View

**Question it answers:** How does this unfold over days and weeks?

- Shows work spread across future days
- Surfaces work with upcoming deadlines
- Helps with multi-day planning

---

### Calendar View

**Question it answers:** When is work scheduled?

- Shows fixed commitments and scheduled work
- Provides availability windows for opportunistic work
- Integrates with external calendars

---

## Rules

Every View:
- Reads from the same underlying model
- Preserves all relationships
- Supports interaction (completing work, adjusting routes)
- Never duplicates or locally stores information

---

## View Priority

Views are not equal. Some are more central to the Navo experience than others:

| Priority | View | Core to day planning? |
|----------|------|-----------------------|
| 1st | **Map** | Yes — the primary interface |
| 2nd | **Day Planner** | Yes — the operational view |
| 3rd | **Intent** | Yes — the goal-setting view |
| 4th | **Work Graph** | Supporting — for complex work networks |
| 5th | **Timeline** | Supporting — for multi-day horizons |
| 6th | **Calendar** | Supporting — for scheduled commitments |
