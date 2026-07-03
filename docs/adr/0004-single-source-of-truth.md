# ADR 0004: Single Source of Truth

**Status:** Accepted

## Context

Traditional productivity applications often duplicate information across multiple views.

This creates synchronization problems and inconsistent behavior.

## Decision

Navo will maintain one underlying domain model.

All planners, calendars, timelines, maps, and graphs will present different views of the same data.

No view owns information.

## Consequences

### Benefits

* Consistent behavior.
* Reduced duplication.
* Simpler synchronization.
* Easier extensibility.

### Trade-offs

* Views become more sophisticated.
* The core domain model must remain stable.
