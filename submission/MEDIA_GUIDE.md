# Recording the demo video

A practical guide to recording `demo_script.md`. The rules ask for a video of 1 to 3 minutes, uploaded to YouTube, Vimeo or another video host.

## Before recording

1. **Use real, working software.** Deployed site if possible; otherwise run it locally (`README.md`). Do not mock up screens.
2. **Prepare the data.** File one report and verify it in Admin Tools so Community Impact has something to show. Do it before recording; do not show the admin passcode on screen.
3. **Clean the browser.** A new window with no bookmarks bar, no other tabs, no extensions showing, notifications off. Zoom at 100%.
4. **Phone-sized window.** 390 pixels wide looks right for a phone app. In Chrome: View, Developer, Developer Tools, then the device toolbar. Or record a real phone's screen.
5. **Reset the app.** Settings, "Clear data on this device". Answer the storage banner before you start so it is not in the first shot.
6. **Check the language** is English and the location is cleared.
7. **Rehearse twice with a timer.** Aim for 2:50. Over 3:00 can be penalized.

## Recording

- **Screen:** QuickTime Player on a Mac (File, New Screen Recording) or OBS on any computer. On an iPhone, Control Center, Screen Recording.
- **Voice:** record in a quiet room with the microphone close. A phone's voice memo app held near your mouth is better than a laptop microphone across a desk. Recording the voice separately and laying it over the screen recording is easier than doing both at once.
- **Pace:** click, pause one second, then speak. Viewers need a moment to see what changed.
- **Pointer:** move it slowly and rest it on what you are talking about.
- **Resolution:** 1080p. Export as MP4.

## Editing

- Cut pauses and loading waits, but do not speed up footage so far that the app looks faster than it is.
- Add captions. YouTube can generate them; read them through and fix mistakes, especially "ReSource" and "Fremont".
- A title card for the first two seconds with the app name and your name is enough. No music under your voice.
- If you add text on screen, keep it large and leave it up long enough to read twice.

## What must be in the video

From the CA-17 page; confirm against your district's rules:

1. Your name (every team member's name)
2. The app's name
3. Its purpose in one sentence
4. Who it is for
5. The tools and programming languages used
6. A demonstration of how it works

`demo_script.md` marks where each one is said.

## Honesty in the video

- Show what the app does today. If you demonstrate AI chat, say whether an AI model or the basic lookup is answering; the label on screen shows which.
- Do not show the City's seal or logo, and do not imply the City is involved.
- Say that AI coding tools were used. It is in the script.
- If something fails while recording, re-record. Do not edit around a feature that does not work.

## Uploading

1. Upload as **Unlisted** on YouTube (anyone with the link can watch; it does not appear in search) unless the rules ask for Public.
2. Title: "ReSource: Congressional App Challenge 2026". Put the one-sentence purpose in the description, and the line "Independent student project. Not an official City of Fremont service."
3. Watch the uploaded version all the way through on a phone before pasting the link into the form. Check the length shown on the page is under 3:00.
4. Do not delete or re-upload after submitting: the link in the form would break.

## Screenshots

`submission/screenshots/desktop/` and `mobile/` hold one image per screen, made from the real app running against a fresh, empty API (`npm run build:web && npm run screenshots` in `app/` regenerates them). `for-me-summary.png` shows the main feature after it has been used. Community Impact is empty in them because no report exists in a fresh install. Use them for the form or a poster. Do not edit them to show data that is not there.
