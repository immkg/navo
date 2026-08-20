# Work Item Specification

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the concept and glossary entry. This document specifies the actual data shape.

## Purpose

A Work Item represents one unit of meaningful work — any action that moves an Intent forward. It is the primary execution object in Navo.

## Key Characteristics

A Work Item:

- Belongs to at most one Intent
- May have one or more Location Options, each a group of one or more places
- May depend on other Work Items before it can begin (`WorkDependency`)
- Has a free-text `type` (e.g. `task`, `decision`) — not an enforced enum

## Location

A Work Item's location is expressed through **Location Options**: each option groups one or more specific `Location` records (address, coordinates, place ID). A Work Item can have:

- **One or more Location Options** — the Planner uses whichever option is selected (`selectedLocationOptionId`, defaulting to the first) to place it on the route.
- **No Location Options** — the item is location-independent or not yet planned. It shows up as "unplaced work" in the Planner rather than on the route.

There is no location-type matching (e.g. "any pharmacy") or opening-hours field in the schema today — only specific places.

The work form also lets a user mark work as "Remote (mobile / laptop)," but this choice is UI-only right now: it is not yet persisted to the API. See [CHANGELOG.md](../../CHANGELOG.md) for current status.

## Properties

| Property                   | Description                                  |
| -------------------------- | -------------------------------------------- |
| `title`                    | Natural language description of the work     |
| `type`                     | Free-text category (e.g. `task`, `decision`) |
| `status`                   | `todo` / `in_progress` / `done`              |
| `durationMinutes`          | Estimated time to complete (default 30)      |
| `notes`                    | Additional free text                         |
| `intentId`                 | The Intent this work belongs to, if any      |
| `locationOptions`          | Groups of candidate places for this work     |
| `selectedLocationOptionId` | Which option the Planner should use          |

## Rules

- A Work Item has a unique identity and may belong to at most one Intent.
- A Work Item may depend on other Work Items, forming a dependency graph (`WorkDependency`, enforced unique per pair).
- A Work Item with a selected Location Option is eligible for route planning (see [planner.md](planner.md)).
- A Work Item without any location is shown separately as unplaced work.

## Relationships

A Work Item may:

- **depend on** — cannot start until another Work Item is done
- **be depended on by** — blocks another Work Item from starting
- **belong to** one Intent

Automatic generation of new Work Items on completion, and sharing a single Work Item across multiple Intents, are part of the long-term vision (see [VISION.md](../../VISION.md)) but are not implemented — the schema ties each Work Item to a single, optional Intent.
