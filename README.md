# Pocket Mine

Pocket Mine is a hackathon demo app for airport lithium battery screening. It turns one battery photo or one label reading into a clear operational decision:

- `CLEAR TO FLY`
- `NEEDS HUMAN CHECK`
- `DO NOT BOARD`

The pitch concept is:

```text
Scan the pocket. Find the mine. Save the flight.
```

The local demo runs without API keys. It uses deterministic mock analysis so the pitch can be presented anywhere, while the UI and data model are shaped for a real Google stack.

The current UI includes two extra pitch modules:

- `Can it fly?`: an instant search panel for `Wh`, visible appearance, spare-battery status, and carry-on / checked-bag handling.
- `Danger Battery Atlas`: a field-learning view where detected cases become staff education patterns and a simulated AI precision signal.

## Google Stack Concept

- Gemini: multimodal reasoning over battery image, shape, label context, and visible damage.
- Cloud Vision OCR: extraction of `mAh`, `Wh`, voltage, and warning labels.
- Vertex AI: managed model deployment, evaluation, and safety policy versioning.
- Cloud Run: low-latency inspection API for airport tablets and kiosks.
- Firebase: authentication, offline-first inspection records, and audit trail sync.
- BigQuery: incident trend analysis and airport safety reporting.

The browser app has an optional integration point: set `window.POCKET_MINE_GOOGLE_ENDPOINT` before `src/app.js` loads, and the scan flow will POST `{ image, labelText, prompt }` to that endpoint. If the endpoint fails or is absent, the app falls back to the built-in demo rules.

## Demo Rules

The demo follows common passenger lithium battery screening thresholds:

- Visible swelling, heat marks, leakage, or terminal damage: `isolate`
- Capacity unreadable: `review`
- `<= 100Wh` with no damage signs: `carry`
- `> 100Wh` and `<= 160Wh`: `review`
- `> 160Wh`: `isolate`

This is a pitch prototype, not an operational safety authority. Real deployment must be validated against the airport, airline, and regulator policy in force on the deployment date.

References used for the prototype rules and Google integration concept:

- FAA PackSafe lithium battery guidance: https://www.faa.gov/hazmat/packsafe/lithium-batteries
- FAA airline passengers and batteries guidance: https://www.faa.gov/hazmat/packsafe/airline-passengers-and-batteries
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Cloud Vision OCR: https://docs.cloud.google.com/vision/docs/ocr
- Cloud Run: https://docs.cloud.google.com/run/docs
- Firestore offline behavior: https://firebase.google.com/docs/firestore/manage-data/enable-offline

## Run

Node.js 20 or newer is required.

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

Change the port if needed:

```bash
PORT=8080 npm run dev
```

## Use

1. Select one of the demo batteries, or upload a battery image.
2. Edit the OCR / label candidate text if needed.
3. Press `Start Scan`.
4. Watch the camera overlay move through shape, label, swelling, Wh, and damage checks.
5. Read the single final decision and the five evidence factors.
6. Use `Can it fly?` to test capacity, appearance, spare battery, and bag placement instantly.
7. Show `Danger Battery Atlas` to explain how detections become education data.
8. Export JSON or copy a briefing for pitch notes.

The UI also includes the generated `Pocket Mine Inspector` mascot at `src/assets/pocket-mine-mascot.png`.

## Test

```bash
npm run check
```

The checks cover syntax and the core analyzer:

- `mAh` + voltage to `Wh` conversion
- explicit `Wh` parsing
- carry / review / isolate classification
- missing label review behavior
- uploaded-image damage hint detection
- `Can it fly?` capacity / appearance / spare-battery behavior
- Gemini prompt contract

## Files

- `src/app.js`: UI, demo flow, camera/upload handling, optional Google endpoint call.
- `src/analyzer.js`: testable label parser, capacity conversion, risk rules, demo data, Gemini prompt builder.
- `src/export.js`: JSON and text report downloads.
- `test/analyzer.test.js`: Node test suite for the decision engine.
