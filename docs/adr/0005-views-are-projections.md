# ADR 0005: Views Are Projections

**Status:** Accepted

## Context

Users interact with work in different ways depending on the question they are trying to answer.

A planner, calendar, map, graph, and timeline all represent the same underlying information.

## Decision

Views in Navo are projections of the domain model.

They never own data and never introduce new business logic.

Their responsibility is to present information in a way that best answers a user's current question.

## Consequences

### Benefits

* Consistent user experience.
* Easy introduction of new views.
* Simplified architecture.

### Trade-offs

* More responsibility in the domain layer.
* Projection logic becomes increasingly important.
