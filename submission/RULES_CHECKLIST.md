# Congressional App Challenge: rules checklist

What the rules say, where each one was read, and whether this project meets it. Checked on October 13, 2026. **The rulebook for this year and your own district's page are the authority, not this file.** Two things below could not be confirmed and one needs your honest judgment; they are marked.

## Sources read

| Source | Address | What it gave |
| --- | --- | --- |
| National rules page | https://www.congressionalappchallenge.us/students/rules/ | Eligibility, team size, dates, platforms |
| Rep. Ro Khanna (CA-17) challenge page | https://khanna.house.gov/services/congressional-app-challenge | District deadline, video requirements, submission questions and character limits, judging criteria |
| 2025 national rulebook (PDF, as posted by a Member office) | https://morgangriffith.house.gov/UploadedFiles/2025-CAC-Rules.pdf | Could not be opened as text here. Its AI rule is quoted below from search results, not from the document itself. |

The complete 2026 rulebook is linked from the national rules page as a PDF. **It was not read.** Read it yourself before submitting.

## Which district?

Fremont is not all in one congressional district. You may compete in the district where you live or the one where you attend school. **Not confirmed:** which district that is for you. Look up your address at https://www.house.gov/representatives/find-your-representative, then use that Member's challenge page. The CA-17 page above applies only if that is your district.

## Deadline

| Source | Says |
| --- | --- |
| National rules page | "October 26": deadline to register and submit. No time is given on the page; other Member offices state 12:00 PM Eastern. |
| CA-17 page | Submissions accepted "May 1st – October 30th (11:59 pm EST, October 30th, 2026" |

**These do not agree.** Plan to submit by **October 26, 2026, before 12:00 PM Eastern (9:00 AM Pacific)**, which satisfies both, and ask your Member's office which date is right. Submissions cannot be changed after the period closes.

## Checklist

| Rule | Source | Status |
| --- | --- | --- |
| Middle or high school student at the time of submission | National | **You confirm.** |
| U.S. resident; no citizenship requirement | National | **You confirm.** |
| Compete in the district where you live or attend school | National | **You confirm** (see above). |
| Individual or team of up to four; one app per student | National, CA-17 | Met if you enter alone with this app. |
| Register and submit online by the deadline | National | To do. |
| Any programming language, any platform | National | Met: TypeScript (React Native, Expo) and Python (FastAPI); web, iOS, Android. |
| No limit on theme or topic | National | Met. |
| Demonstration video, 1 to 3 minutes; outside that range "may be penalized by the judges at their discretion" | CA-17 | `demo_script.md` is timed at 2 minutes 50 seconds. Check the final cut. |
| Video uploaded to YouTube, Vimeo or another video host | CA-17 | To do. See `MEDIA_GUIDE.md`. |
| Video includes: participant names, app name, a one-sentence purpose, target audience, tools and languages used, and a demonstration of how the app works | CA-17 | All six are in the script, in the first 30 seconds and the last 20. |
| App title | CA-17 | ReSource |
| Purpose in one sentence, 140 characters at most | CA-17 | `app_description.md`, 108 characters |
| What inspired the app, 200 characters at most | CA-17 | `app_description.md`. **Write this one yourself:** only you know what inspired it. A draft based on the app is given. |
| What the app aims to accomplish, 200 characters at most | CA-17 | `app_description.md`, within the limit |
| A technical challenge and how it was solved, 1,500 characters at most | CA-17 | `app_description.md`, within the limit. **Choose one you can explain in person.** |
| Judges may ask for access to the app and source code; refusing disqualifies | CA-17 | Deploy the app (`deployment/deploy_guide.md`) and make the repository public, or be ready to share it. |
| Judged on: quality of the idea (creativity and originality); implementation (user experience and design); demonstrated excellence of coding and programming skills | CA-17 | See `judge_qa.md`. |
| App created within the eligibility window (search results say: after October 30, 2025) | Search result, **not confirmed in a primary source** | The repository's history starts with a baseline snapshot dated October 12, 2026, so it does not show when work began. **You confirm** the app was created inside the window, and keep any earlier evidence (drafts, notes, older copies). |

## The AI rule, and what it means for this project

This is the rule to read most carefully.

- The CA-17 page does not state an AI policy.
- Search results quoting the **2025** national rules say that using AI tools in app development is permitted provided all AI usage is fully disclosed in the submission materials, and that AI may only support specific aspects of the project and **must not make up the entirety of the technical development**. A 2026 district page adds that students must be able to explain their own contributions and show that they understand how their project and its code work.
- **Not confirmed:** the exact 2026 wording. Read it in the rulebook.

What is true of this repository: most of its code, tests, translations and documents were written by AI coding agents (Anthropic's Claude Code and OpenAI's Codex), working from your instructions and decisions, with commits that say so. The app also uses an AI model at run time for the chat assistant.

What that means:

1. **Disclose it fully and plainly.** `AI_DISCLOSURE.md` is a draft. It must say what the tools did and what you did, in your words. Do not understate the tools' share.
2. **Be honest with yourself about the "entirety" rule.** Only you know what you designed, decided, wrote, tested and changed. If the truthful answer is that the tools did nearly all of the technical work, ask your Member's office whether the project is eligible before you submit. That is a better outcome than a disqualification or a win you cannot stand behind.
3. **Be able to explain the code.** `technical_overview.md` and `judge_qa.md` are written for that. Read the files they point to until you can answer each question without notes. Where you cannot, say so to the judges rather than guess.

## Before you submit

1. Read the 2026 rulebook PDF from the national rules page.
2. Confirm your district and its deadline.
3. Settle the AI question above.
4. Deploy the app and run the smoke test.
5. Record and upload the video.
6. Paste the answers from `app_description.md` into the form and check each character count there.
7. Submit, and keep the confirmation.
