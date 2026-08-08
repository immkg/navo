# Navigation Specification

## Purpose

Navigation answers the question at the heart of every moment in the day:

> **Given where I am right now, what should I do next?**

Navigation is not just about physical movement. It is the continuous process of matching your current reality — location, time, energy, available work — to the best next action.

---

## How Navigation Works

Navigation runs continuously throughout the day. It is not computed once in the morning and forgotten.

At any moment, navigation considers:

| Input | What it captures |
|-------|----------------|
| **Current location** | Where you are physically right now |
| **Current time** | What time it is and how much of the day remains |
| **Planned route** | The sequence of locations you intend to visit |
| **Available work** | All work that has not yet been completed |
| **Active intents** | What you are trying to achieve today |
| **Context** | Budget, energy, constraints, preferences |

From these inputs, navigation produces recommendations in real time.

---

## What Navigation Surfaces

### Next Action
The most relevant piece of work given current location and time.

If you are near a market and "buy vegetables" is on your list → that is the next action.

### Nearby Opportunities
Work from any active intent that can be done at or near your current location.

These are surfaced even if they were not originally planned for today — because being here makes them easy.

### Route Adjustments
When context changes (you're running late, a location is closed, you've finished early), navigation recommends adjustments to the remaining route.

### Work to Defer
Work that was planned for today but is no longer feasible given the current context. Navigation surfaces this proactively so you can decide whether to defer, reschedule, or find an alternative.

---

## The Location-Opportunity Engine

The core of navigation is the continuous matching of **where you are** against **where work can happen**.

As you move:
- Your position changes
- Distance to each work location changes
- Time windows open and close
- Opportunities emerge and expire

Navigation is the engine that processes this continuously and surfaces what matters right now.

**Example flow:**
```
7:30am  - Leaving home
          → Navigation: "Market opens at 8am, 5 min from your office route. 
             Add vegetable stop?"

8:05am  - Passing the market area
          → Navigation: "You are 200m from the market. 
             'Buy vegetables for dinner' is ready to complete."

12:30pm - Near office, lunch break
          → Navigation: "Print shop 3 min walk. 
             'Print interview documents' could be done now."

5:45pm  - Leaving office
          → Navigation: "Dry cleaner closes at 6:30pm, on your way home. 
             'Pick up dry cleaning' window is now."
```

---

## Rules

Navigation:
- **Runs continuously** — not just at the start of the day
- **Never acts automatically** — it recommends, the user decides
- **Explains reasoning** — "this is suggested because you're nearby and the window closes at 6pm"
- **Respects priorities** — high-priority work is surfaced first
- **Adapts to changes** — if context shifts, recommendations shift immediately

---

## Navigation vs. Routing

| | Routing | Navigation |
|---|---------|-----------|
| **When** | Planning the day ahead | Real-time, throughout the day |
| **Question** | What is the best sequence of stops? | What should I do right now? |
| **Input** | Full day context | Current position and context |
| **Output** | A route | A recommendation |

Routing builds the plan. Navigation executes it — and adapts it as reality diverges from the plan.
