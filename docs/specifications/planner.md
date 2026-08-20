# Day Planner Specification

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the concept. This document specifies what the Planner view actually does today; see [routing.md](routing.md) for how the route itself is computed.

## Purpose

The Day Planner brings not-yet-done Work Items together with their locations into one route-aware view of the day.

## Inputs

| Input            | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| Work Items       | All work that isn't marked done, across Intents            |
| Current location | Device geolocation, or a manually entered start coordinate |

## Outputs

| Output                 | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| Ordered route stops    | Work grouped by location, ordered nearest-first from the start point |
| Map                    | Google Maps preview of the route, with a static-image fallback       |
| Travel + stop estimate | Total estimated minutes for travel plus work duration                |
| Unplaced work          | Work Items with no Location Option selected, listed separately       |

## Flow

1. Load all not-done Work Items and their selected Location Options.
2. Determine the start point (device location, or a manually entered one).
3. Order the located stops nearest-first from the start point (see [routing.md](routing.md)).
4. Render the route on the map and sum estimated travel + work time.
5. List any Work Items with no location under "unplaced work."

There is no scheduling, fixed-commitment, or manual route-editing step — the route is computed and shown, not interactively adjusted.
