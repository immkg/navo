# Intent Specification

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the concept and glossary entry. This document specifies the actual data shape.

## Purpose

An Intent represents a desired outcome. It is the highest-level object in Navo and answers:

> **What is the person trying to achieve?**

## Key Characteristics

An Intent:

- Describes an outcome, not a set of steps
- Carries context from the moment it is formed (budget, who is involved, timing constraints)
- Groups and anchors related Work Items as they are discovered
- Remains stable as the work beneath it changes
- Can be fulfilled through multiple possible paths

## Properties

| Property      | Description                        | Example                      |
| ------------- | ---------------------------------- | ---------------------------- |
| `title`       | Natural language outcome statement | "Get vegetables for dinner"  |
| `description` | Optional free-text detail          | "Cooking for 4, ₹400 budget" |
| `status`      | See Status below                   | `active`                     |
| `priority`    | `low` / `medium` / `high`          | `high`                       |
| `startDate`   | Optional planned start             | —                            |
| `dueDate`     | Optional deadline                  | —                            |

## Status

| Status         | Meaning                          |
| -------------- | -------------------------------- |
| `active`       | Being worked on (default)        |
| `completed`    | Desired outcome achieved         |
| `not_required` | No longer needed for this intent |
| `archived`     | Hidden from the active list      |

## Rules

- An Intent may contain zero or more Work Items, discovered progressively.
- An Intent does not define how the work will be done or in what order.
- An Intent does not define a schedule — it may have a `startDate`/`dueDate`, but scheduling is separate (see [routing.md](routing.md)).
- `startDate` cannot be after `dueDate`.

## Relationships

```
Intent
  └── contains Work Items (discovered over time)
```

Multi-participant collaboration on a shared Intent is part of the long-term vision (see [VISION.md](../../VISION.md)) but has no data model yet — there is no user or participant concept in the schema today.
