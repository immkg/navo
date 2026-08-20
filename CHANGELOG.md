# Changelog

All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog** and follows **Semantic Versioning**.

---

## [Unreleased]

### Added

- Place autocomplete for location selection in the work form, backed by Google Maps
- Location option management for work items (add, edit, remove location choices)

### Not started

- Nested/grouped location option sets — location options are currently a flat list per work item
- Persisting the remote/mobile/laptop work-mode selector to the API — the selector exists in the work form UI but the choice isn't saved yet

### Documentation

- Corrected `docs/specifications/*` against the actual Prisma schema and UI: fixed the Intent status enum, removed claims about opening-hours/location-type matching and fixed-commitment scheduling that don't exist, and rewrote `planner.md`/`routing.md` to describe the real nearest-neighbor route heuristic instead of aspirational optimisation/opportunity-detection features
- Removed duplicated release notes and narrative from `README.md` in favor of linking to `CHANGELOG.md`/`VISION.md`; trimmed repeated "vegetables for dinner" retellings in `AGENT.md`/`ARCHITECTURE.md` down to a single canonical version in `VISION.md`
- Fixed `.github/PULL_REQUEST_TEMPLATE.md`'s checklist, which still referenced the removed Concepts docs

---

## [1.6.0] - 2026-08-09

### Changed

- Duration picker now defaults to 15 minutes, starts at 5 minutes, and caps at 4 hours in 15-minute steps
- Moved work notes directly below the work title field in the add-work form

### Documentation

- Recorded the 1.6.0 work form update

## [1.5.0] - 2026-08-09

### Added

- Mobile-friendly Intent view layout with tighter spacing and stacked controls
- Responsive work form, location option cards, and places sidebar
- Compact intent detail header and action areas for smaller screens

### Documentation

- Recorded the Intent view mobile pass and release 1.5.0 notes

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
