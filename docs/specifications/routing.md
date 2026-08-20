# Routing Specification

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the concept. This document specifies how the route is actually computed today.

## Purpose

Routing orders the day's located Work Items into a sequence of stops, starting from the current position.

## Algorithm

A greedy nearest-neighbor heuristic:

1. Start from the current location (device geolocation or a manually entered coordinate). If none is available, stops are ordered alphabetically by location name instead.
2. Repeatedly pick the nearest remaining stop (great-circle distance) to the current position, add it to the route, and move "current position" to that stop.
3. Estimate travel time between consecutive stops from distance, using a fixed average speed; estimate total time as travel plus each work item's `durationMinutes`.

This is a single fixed heuristic — there is no support today for alternate optimisation strategies, fixed time windows/opening hours, or route preferences.

## Inputs

- Work Items that have a selected Location Option (each with coordinates)
- The current or manually entered starting position

## Outputs

- An ordered list of stops with cumulative travel-time estimates
- A Google Maps preview (interactive if a Maps API key is configured, otherwise a static map image) and a "open in Google Maps" link
- Work Items with no location, listed separately as unplaced

## Relationship to Planning

Routing is what the Day Planner (see [planner.md](planner.md)) uses to turn located work into a sequence. Dependencies between Work Items (see [work-item.md](work-item.md)) are modeled in the data but are not yet factored into the route order.

Cross-intent opportunity detection, time-window/opening-hours constraints, and user-selectable optimisation goals are part of the long-term vision (see [VISION.md](../../VISION.md)) but are not implemented.
