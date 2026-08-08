# Design Principles

These principles guide every design and engineering decision in Navo.

They are intentionally stable and should rarely change.

---

## 1. Intent Before Work

Everything begins with an outcome someone wants to achieve.

People start with desires, not definitions. "Get vegetables for dinner" exists before any shopping list, any chosen shop, or any planned route.

Work is discovered progressively as the intent becomes clearer.

Navo models intentions first and execution second.

---

## 2. Context Is Present From the Start

Context does not arrive after the plan. It arrives with the intent.

When someone decides to "get vegetables for dinner," they already know how many people are eating, roughly what the budget is, and what time dinner needs to be ready.

Navo must capture and use context from the moment an intent is formed, not as an afterthought.

---

## 3. The Day Is the Unit of Execution

People do not execute plans in the abstract.

They execute them in a day — in real places, at real times, moving through the world.

Day planning is the primary activity Navo supports. Everything — intents, work, context — ultimately flows into the question: **what am I doing today, where, and in what order?**

---

## 4. Location and Route Are Structural, Not Optional

Location is not a tag or a metadata field. It is a first-class property of work.

The route through locations is the spine of the day. As someone moves along a route, some work becomes possible and other work becomes impossible.

Every design decision must account for the physical dimension of planning.

A feature that ignores location and movement is an incomplete feature.

---

## 5. The Map Is the Foundation

The map is the interface through which planning becomes real.

Without the map, a plan is abstract. It cannot tell you whether the shop is on your way or out of the way. It cannot surface the opportunity to combine two errands into one trip.

The map must be treated as core infrastructure, not as a feature bolt-on.

---

## 6. Opportunities Are Discovered Through Movement

As someone moves through their day along a route, context changes continuously.

Navo must surface opportunities — work that becomes possible or easier because of where someone is or where they are heading — at the right moment.

Opportunities must be relevant to context. They should not be noise.

The right opportunity, surfaced at the right moment, is the product.

---

## 7. Work Is a Network, Not a List

Real work is connected.

One task depends on another. Completing a decision unlocks several new tasks. Two intents may share a common piece of work.

Navo models work as a connected graph. Relationships between work items are first-class citizens.

Linear lists are never sufficient to represent how things actually get done.

---

## 8. Planning Is Continuous Discovery

Not everything can or should be planned upfront.

Many decisions only become clear after earlier work is done. "Which vegetables to buy" cannot be answered before "what to cook for dinner" is decided.

Navo embraces progressive discovery. The plan evolves as the day unfolds and as context changes.

Rigidity is a failure of design.

---

## 9. Plans Adapt to Reality

Plans exist to be changed.

When a route changes, when a shop is closed, when time runs short — the plan must adapt without friction.

Navo continuously reconsiders the plan in light of current reality. It does not hold on to a plan that no longer fits.

---

## 10. One System, Many Perspectives

The underlying model — intents, work, context, locations, routes, opportunities — never changes.

Different views exist to answer different questions:

| View | Question |
|------|----------|
| Intent View | What am I trying to achieve? |
| Work Graph | What needs to happen and in what order? |
| Map View | Where and is it on my route? |
| Day Planner | What am I doing today? |
| Timeline | How does this unfold over time? |

Changing the view never changes the underlying reality.

No view owns the data.

---

## 11. Software Adapts to People

People do not change the way they think in order to use Navo.

Navo changes to match how people naturally think, plan, and move through the world.

The software is a model of human behaviour. Not the other way around.

---

## 12. Human Language First

The interface uses the language people naturally use.

- "Get vegetables for dinner" not "Create task: Grocery type: errand"
- "I'm heading downtown this afternoon" not "Set location context: Downtown, time: 14:00"
- "What can I do while I'm near the market?" not "Filter work items by proximity radius"

Navo listens to how people describe their lives, and it adapts.
