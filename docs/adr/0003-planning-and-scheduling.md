# ADR 0003: Separate Planning and Scheduling

**Status:** Accepted

## Context

Most software combines planning and scheduling into a single activity.

Planning answers what should happen.

Scheduling answers when it should happen.

These are related but distinct concerns.

## Decision

Navo will treat planning and scheduling as independent concepts.

Scheduling becomes one input into planning rather than defining the plan itself.

## Consequences

### Benefits

* More flexible planning.
* Better support for dynamic work.
* Easier adaptation to changing priorities.

### Trade-offs

* Requires users to understand two concepts.
* Increases the sophistication of the planning model.
