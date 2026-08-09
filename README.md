# Navo

<p align="center">
  <img src="docs/navo-hero.png" alt="Navo Hero" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/immkg/navo/stargazers">
    <img src="https://img.shields.io/github/stars/immkg/navo?style=for-the-badge" alt="Stars" />
  </a>
  <a href="https://github.com/immkg/navo/network/members">
    <img src="https://img.shields.io/github/forks/immkg/navo?style=for-the-badge" alt="Forks" />
  </a>
  <a href="https://github.com/immkg/navo/issues">
    <img src="https://img.shields.io/github/issues/immkg/navo?style=for-the-badge" alt="Issues" />
  </a>
  <a href="https://github.com/immkg/navo/pulls">
    <img src="https://img.shields.io/github/issues-pr/immkg/navo?style=for-the-badge" alt="Pull Requests" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/immkg/navo/commits/main">
    <img src="https://img.shields.io/github/last-commit/immkg/navo?style=flat-square" alt="Last Commit" />
  </a>
  <a href="https://github.com/immkg/navo/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/immkg/navo?style=flat-square" alt="Contributors" />
  </a>
  <a href="https://github.com/immkg/navo/actions/workflows/ci.yml">
    <img src="https://github.com/immkg/navo/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-success?style=flat-square" alt="MIT License" />
</p>

---

Navo is a day planning system built around how people naturally move through the world.
## v1.2.0 Release

- Added location-aware planner routing with grouped nearby work
- Added map preview support with Google Maps JS and static fallback
- Added current location and manual start-point handling
- Added travel-time estimation and unplaced-work visibility
- Added selected location option support for work items
- Improved planner UX for unplaced work and route summaries
---

## The Insight

You start your day with an intent: **"get vegetables for dinner."**

You don't yet have a shopping list. You don't know which shop. You haven't scheduled anything.

But you do know context — cooking for 4, budget is ₹400, dinner needs to be ready by 7pm.

As you plan your day — home to office to gym — the map shows that a fresh produce market is a 3-minute detour off your route to the office. The timing works. The window is there.

**That moment — being in the right place at the right time with the right intent — is the opportunity.**

Navo surfaces it.

---

## What Navo Is

**Navo is a day planning system grounded in physical reality.**

- You form **intents** — outcomes you want to achieve, carrying context from the start.
- **Work** is discovered progressively as the intent becomes clearer.
- Work happens at **locations** — first-class entities, not tags.
- **Routes** connect those locations and determine what is possible each day.
- **Opportunities** surface when location, time, and available work align.
- The **map** is the interface through which all of this becomes real.

---

## What Navo Is Not

| Not               | But                                        |
| ----------------- | ------------------------------------------ |
| A to-do list app  | A day planning system grounded in location |
| A project manager | An intent-driven life operating system     |
| A calendar app    | A route-aware opportunity engine           |
| A rigid scheduler | A continuously adapting day plan           |

---

## Core Concepts

| Concept         | What it is                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| **Intent**      | An outcome you want to achieve, formed with context                        |
| **Work**        | Any action that moves an intent forward, discovered progressively          |
| **Context**     | What is true right now — especially location, time, budget, people         |
| **Location**    | Where work happens — a first-class structural property                     |
| **Route**       | The sequence of locations that makes up your day                           |
| **Opportunity** | Work that becomes possible because of where you are or where you're headed |

---

## Documentation

### Foundation

- [Vision](VISION.md) — Why Navo exists and the core insight
- [Mental Model](MENTAL_MODEL.md) — How the system thinks
- [Design Principles](DESIGN_PRINCIPLES.md) — The rules that guide every decision
- [Architecture](ARCHITECTURE.md) — The structural model
- [Glossary](GLOSSARY.md) — The shared language

### Concepts

- [Intent](docs/concepts/intent.md)
- [Work](docs/concepts/work.md)
- [Context](docs/concepts/context.md)
- [Planning](docs/concepts/planning.md)
- [Scheduling](docs/concepts/scheduling.md)

### Specifications

- [Intent](docs/specifications/intent.md)
- [Work Item](docs/specifications/work-item.md)
- [Day Planner](docs/specifications/planner.md)
- [Navigation](docs/specifications/navigation.md)
- [Routing](docs/specifications/routing.md)
- [Views](docs/specifications/view.md)

### Architecture Decisions

- [Architecture Decision Records](docs/adr/README.md)

---

## Contributing

Contributions are welcome.

Before opening an issue or pull request, please read:

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Author

**Mayank Kumar Gupta**

- Email: <mayankgupta690@gmail.com>
- GitHub: https://github.com/immkg
