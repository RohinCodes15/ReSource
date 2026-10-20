# Submission form answers

Answers to the questions on the CA-17 challenge page, each inside its limit. The limits are in **characters**, counted with spaces. Check your own district's form: the questions may differ. Rewrite anything that is not true of you or does not sound like you, then count again.

## App title

ReSource

## Purpose in one sentence (140 characters at most): 108

ReSource shows Fremont residents which city services changed with the budget and where to find help instead.

## What inspired the app (200 characters at most): 167

Fremont cut services to balance its budget, but the details sit in long PDFs. I wanted neighbors to see what changed for them and where to turn, in their own language.

**Write this one yourself.** The sentence above is a draft built from what the app does. Only you know what actually made you start it. A real moment (a closed counter, a family member who could not find a service, a council meeting) is stronger than any draft.

## What the app aims to accomplish (200 characters at most): 170

Give every resident a sourced, plain-language summary of budget changes that affect them, nearby places to get help, and a way to tell the City how a change affects them.

## A technical challenge and how you solved it (1,500 characters at most): 1454

The hardest problem was deciding what the chat could promise. My first version gave the model the app's services, resources, budget and council data and told it to answer only from those sources. That kept answers tied to our civic dataset, but the model refused most questions residents actually asked. I changed the primary path to general-purpose Claude Sonnet 5 so residents can ask beyond the app's data. We gave up the dataset-based factual-accuracy promise: Claude may be wrong about Fremont. A visible disclaimer now says AI answers can be wrong and asks residents to check Fremont-specific facts in the app's sourced Budget and Resources tabs.

I added guardrails, not a promise. Claude is prompted to flag local claims and direct people to official sources; when a Fremont answer contains a phone number or address not in ReSource's data, the server replaces it with a keyword-search answer. Basic search is also used when there is no API key, Claude's call fails, or the daily token budget is spent. It is labeled "Basic search" and uses ReSource's data.

That matcher is the fallback path, not the primary assistant, and covers five languages. B1 exposed a bug: "Which services were cut?" matched Abode Services because "services" counted as a distinctive name word. I fixed the matcher to ignore generic words and require distinctive whole-word matches, then tested every suggestion in every language. A daily token budget limits model cost.

**Choose a challenge you can explain in person.** This one is real: the bug and its fix are in the repository (`review/BUGS.md`, B1, and `local_answer` in `backend/grounding.py`; the Fremont contact check is in `backend/answer_validation.py`). It is written in the first person because the form asks for your experience, so only submit it if you understand it and it reflects work you directed and can walk through. Read `judge_qa.md`, questions 9 to 12, and the function `local_answer` first. If AI tools wrote the fix, say so in the AI disclosure.

## Longer description, for anywhere a paragraph is allowed

ReSource is a free app for Fremont, California residents living through the city's budget reductions. It answers one question first: what changed for me? A resident enters a ZIP code, picks what matters to them (kids, older adults, streets, health, parks) and gets a short summary of the service changes that touch them. Every item links to the City of Fremont document it came from, and where the City has not published a detail the app says so instead of guessing.

From there a resident can see services on a map, find food, clinics, housing and legal help sorted by distance, read the budget figures with their sources, report how a change affects them, write to their council member, and ask an AI assistant anything, with a reminder to check Fremont facts against the sourced Budget and Resources tabs. It works in English, Spanish, Dari, Chinese and Vietnamese, with no account, no ads and no tracking, and it keeps working when the connection drops.

ReSource is an independent student project. It is not an official City of Fremont service, and the City has not reviewed it.
