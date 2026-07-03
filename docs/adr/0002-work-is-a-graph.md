# ADR 0002: Work Is a Graph

**Status:** Accepted

## Context

Most planning tools organize work as lists or trees.

Real work rarely follows a strict hierarchy.

Tasks often share dependencies, contribute to multiple intentions, and involve multiple participants.

## Decision

Navo will model work as a graph.

Relationships between work items are first-class citizens.

A work item may participate in multiple relationships simultaneously.

## Consequences

### Benefits

* Supports shared dependencies.
* Enables richer planning.
* Better represents real-world workflows.
* Avoids duplicated work.

### Trade-offs

* Requires graph-aware algorithms.
* Visualization becomes more complex.
