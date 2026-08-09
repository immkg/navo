# Work Item Specification

## Purpose

A Work Item represents one unit of meaningful work — any action that moves an Intent forward.

It is the primary execution object in Navo.

---

## Key Characteristics

A Work Item:

- Advances one or more Intents
- **Has a Location** where it can be performed (the most important property for day planning)
- May depend on other Work Items before it can begin
- May generate new Work Items when completed
- May belong to multiple Intents simultaneously

---

## Location: The Critical Property

Location is not a tag or optional metadata. It is a structural property that determines whether work is plannable for a given day.

| Location State            | Meaning                                                        |
| ------------------------- | -------------------------------------------------------------- |
| **Has specific location** | Can be routed — maps to a physical place                       |
| **Has location type**     | Any place of this type will do (any pharmacy, any supermarket) |
| **Location-independent**  | Can be done anywhere (e.g., a phone call, a document review)   |
| **Remote/virtual**        | Done online, no physical location                              |

Work with a specific or type-based location is what the **route** is built around.

## Remote vs Place-driven Work

Navo distinguishes between remote/virtual work and work that requires one or more physical places.

- **Remote/virtual work** can be performed anywhere with a device. It is location-independent and does not generate a route stop.
- **Place-driven work** requires one or more physical locations. It may define one or more location option groups, each containing one or more places.

When creating place-driven work, users can choose a location option group and then select a place using map-backed place discovery.

---

## Types

| Type            | Description                     | Location typical? |
| --------------- | ------------------------------- | ----------------- |
| **Task**        | A clear, actionable step        | Sometimes         |
| **Errand**      | Going somewhere to do something | Always            |
| **Decision**    | Choosing between alternatives   | Rarely            |
| **Purchase**    | Acquiring something             | Always            |
| **Research**    | Gathering information           | Sometimes         |
| **Meeting**     | Coordinating with others        | Often             |
| **Preparation** | Making something ready          | Rarely            |
| **Approval**    | Getting sign-off                | Rarely            |

---

## Properties

| Property          | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| **Title**         | Natural language description of the work                       |
| **Type**          | Category of work (errand, decision, purchase, etc.)            |
| **Location**      | Where it can happen (specific address, location type, or none) |
| **Status**        | Not started / In progress / Done / Deferred                    |
| **Dependencies**  | Work items that must be completed first                        |
| **Intent(s)**     | Which intents this work serves                                 |
| **Time estimate** | How long it is expected to take                                |
| **Opening hours** | When the location is accessible (if applicable)                |
| **Notes**         | Additional context                                             |

---

## Rules

- A Work Item has a unique identity.
- A Work Item may belong to multiple Intents.
- A Work Item may depend on other Work Items (forming a dependency graph).
- A Work Item with a location is included in route planning.
- A Work Item may be unscheduled — some work happens opportunistically when context allows.
- Completing a Work Item may automatically surface new Work Items.

---

## Relationships

A Work Item may:

- **depend on** — cannot start until another is done
- **block** — prevents another from starting
- **create** — completing it generates new work
- **combine with** — shares a location trip with another Work Item
- **relate to** — linked for context without strict dependency

---

## Work and the Route

When the Day Planner builds a route, it organises Work Items by location.

**Items at the same location are grouped into a single stop.**

**Items along the planned route are surfaced as natural opportunities.**

**Items that require significant detours are flagged and the user decides whether to include them.**

This is how Navo turns a list of abstract tasks into a physically executable day.
