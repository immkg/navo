# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog** and follows **Semantic Versioning**.

---

## [1.2.0] - 2026-08-09

### Added

- Planner route builder with location-aware work grouping
- Current location support and manual start-point override
- Google Maps preview with JS loader and static fallback
- Estimated travel and work duration calculations
- Location support for work items in API and frontend
- Unplaced work and route summary UI in the planner

### Documentation

- Clarified route-first planning and location as a core concept
- Updated docs to reflect map-based intent/work flow and opportunity discovery
---

## [Unreleased]

### Added

- Planned remote/mobile/laptop work mode with location-independent work handling
- Planned location-required work with nested location option groups
- Planned map-backed place selection using Google Maps autocomplete

### Documentation

- Planned docs updates for remote work semantics and location option group UX
---

## [1.1.0] - 2026-08-09

### Added

- V1 MVP implementation: Intent creation, Work discovery, SQLite database via Prisma
- React/Vite frontend with Tailwind CSS
- Express REST API with `/api/intents` and `/api/work` routes
- Intent creation modal in Dashboard
- Work discovery UI in IntentView
- Context and dependency linking endpoints

### Documentation (complete rewrite)

- `VISION.md` — Rewritten to centre the route-as-opportunity-engine insight and the physical-world grounding of day planning
- `MENTAL_MODEL.md` — Rewritten to tell the full story: intent forms with context → work discovered → day planned via route → opportunities surface as you move
- `ARCHITECTURE.md` — Location, Route, and Opportunity promoted to core building blocks; map established as the foundation interface
- `DESIGN_PRINCIPLES.md` — New principles added: Location and Route Are Structural, The Map Is the Foundation, Opportunities Are Discovered Through Movement
- `GLOSSARY.md` — Added: Location, Route, Opportunity, Day Plan, Map as first-class terms
- `AGENT.md` — Rewritten to front-load the vision and give agents strong guidance on location as non-negotiable
- `README.md` — Rewritten to lead with the vegetables example and the route insight
- `CONTRIBUTING.md` — Added non-negotiables section (location, map, route); updated design alignment checklist
- `docs/concepts/intent.md` — Context-at-formation now a central concept
- `docs/concepts/context.md` — Location established as the most important contextual variable
- `docs/concepts/work.md` — Location as first-class property; progressive discovery; route enables/disables work
- `docs/concepts/planning.md` — Route-first planning; continuous adaptation; planning loop
- `docs/concepts/scheduling.md` — Clear separation of scheduling, planning, routing; opportunistic work concept
- `docs/specifications/intent.md` — Context properties table; updated rules and relationships
- `docs/specifications/work-item.md` — Location as critical property; work and route relationship
- `docs/specifications/planner.md` — Map as foundation; planning flow; route-aware outputs
- `docs/specifications/navigation.md` — Location-opportunity engine; real-time adaptation; examples
- `docs/specifications/routing.md` — Full routing specification: inputs, outputs, opportunity detection, optimisation
- `docs/specifications/view.md` — Map elevated to primary view; view priority ranking

---

## [0.0.1] — Initial

### Added

- Initial project structure
- Original vision and philosophy documentation
- Architecture and concept documentation
- Repository governance documents (CODE_OF_CONDUCT, SECURITY, LICENSE)
