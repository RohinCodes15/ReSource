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

## A technical challenge and how you solved it (1,500 characters at most): 1174

The hardest problem was making the chat assistant safe to trust. A language model will happily invent a phone number or a budget figure, and in a civic app one wrong answer about where to get food does real harm.

The solution has three parts. First, the model never answers from memory. Each request builds a prompt from the app's own data (services, resources, budget and council records, each with a source) and tells the model to use only that, to say "I don't know" otherwise, and to point people to 211 or the City.

Second, the app works with no model at all. A keyword matcher in the API maps a question to categories in five languages and returns the matching rows directly. It runs when no API key is set and also when the AI service fails, so chat never breaks. A bug here taught me the most: the question "Which services were cut?" returned a housing nonprofit, because the matcher treated the word "services" in "Abode Services" as a name match. The fix was to match only distinctive whole words and to test every suggested question in every language.

Third, the app shows which mode answered and lists the sources under every answer, so a reader can check it.

**Choose a challenge you can explain in person.** This one is real: the bug and its fix are in the repository (`review/BUGS.md`, B1, and `backend/grounding.py`). It is written in the first person because the form asks for your experience, so only submit it if you understand it and it reflects work you directed and can walk through. Read `judge_qa.md`, questions 9 to 12, and the function `local_answer` first. If AI tools wrote the fix, say so in the AI disclosure.

## Longer description, for anywhere a paragraph is allowed

ReSource is a free app for Fremont, California residents living through the city's budget reductions. It answers one question first: what changed for me? A resident enters a ZIP code, picks what matters to them (kids, older adults, streets, health, parks) and gets a short summary of the service changes that touch them. Every item links to the City of Fremont document it came from, and where the City has not published a detail the app says so instead of guessing.

From there a resident can see services on a map, find food, clinics, housing and legal help sorted by distance, read the budget figures with their sources, report how a change affects them, write to their council member, and ask questions in a chat that answers only from the app's data. It works in English, Spanish, Dari, Chinese and Vietnamese, with no account, no ads and no tracking, and it keeps working when the connection drops.

ReSource is an independent student project. It is not an official City of Fremont service, and the City has not reviewed it.
