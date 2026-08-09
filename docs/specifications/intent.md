# Intent Specification

## Purpose

An Intent represents a desired outcome.

It is the highest-level object in Navo and answers:

> **What is the person trying to achieve?**

---

## Key Characteristics

An Intent:

- Describes an outcome, not a set of steps
- **Carries context from the moment it is formed** (budget, who is involved, timing constraints)
- Groups and anchors related work as it is discovered
- Remains stable as the work beneath it changes
- Can be fulfilled through multiple possible paths

---

## Context Properties

Every Intent has associated context that shapes planning:

| Property        | Description                        | Example                     |
| --------------- | ---------------------------------- | --------------------------- |
| **Title**       | Natural language outcome statement | "Get vegetables for dinner" |
| **For whom**    | Who the intent serves              | "Cooking for 4 people"      |
| **Budget**      | Financial constraint               | "₹400 max"                  |
| **Timing**      | When it needs to be done           | "Before 7pm tonight"        |
| **Constraints** | Things that cannot change          | "No onions, vegetarian"     |
| **Priority**    | Relative importance today          | High / Normal / Low         |

---

## Rules

- An Intent may contain zero or more Work Items (discovered progressively).
- An Intent does not define how the work will be done.
- An Intent does not define execution order.
- An Intent does not define a schedule — it may have a deadline, but scheduling is separate.
- Multiple Intents may share Work Items (e.g., two intents fulfilled in one trip to a shop).
- An Intent may be collaborative (multiple participants working toward the same outcome).

---

## Relationships

```
Intent
  ├── carries Context (budget, people, timing, constraints)
  ├── contains Work Items (discovered over time)
  ├── may share Work Items with other Intents
  └── may have Participants
```

---

## Examples

| Intent                         | Key Context                                      |
| ------------------------------ | ------------------------------------------------ |
| "Get vegetables for dinner"    | 4 people, ₹400, needs to be done before 7pm      |
| "Plan a vacation"              | 2 people, 7 days, budget ₹80,000, prefer beaches |
| "Prepare for the interview"    | 2 days away, focus on system design questions    |
| "Buy a birthday gift for Riya" | ₹1,500 budget, birthday is Saturday              |

---

## Status

An Intent progresses through states:

| Status        | Meaning                    |
| ------------- | -------------------------- |
| **Active**    | Being worked on            |
| **Paused**    | On hold, no immediate work |
| **Completed** | Desired outcome achieved   |
| **Abandoned** | No longer relevant         |
