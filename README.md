# Pocket Mine
https://github.com/user-attachments/assets/c7ccff39-1ba7-4148-9741-355a82c98bfe
Pocket Mine is a professional airport AI demo that screens passenger power banks before boarding, flags lithium-ion fire risks, and turns collected batteries into traceable recyclable resources.

## Demo concept

The app simulates a security-lane workstation for mobile battery inspection:

- **AI battery judgment**: reads label-like text, estimates Wh, and classifies batteries as `持ち込み可能`, `確認が必要`, or `今すぐ隔離`.
- **Professional airport dashboard**: live battery queue, scan animation, action guidance, and structured JSON briefing for operational handoff.
- **Google Cloud architecture placeholder**: the UI presents Gemini, Cloud Vision OCR, Vertex AI, Cloud Run, Firebase, and BigQuery as the intended production stack.
- **Collection reward system**: every 10th collected battery triggers a “びっくら本” style prize moment, making safe disposal feel participatory while keeping the experience suitable for a serious airport demo.

## Try immediately

### Option A: no setup

Open `demo.html` directly in a browser. It is a self-contained HTML/CSS/JS version of the Pocket Mine demo for instant review.

### Option B: local Vite app

```bash
npm install
npm start
```

Then open <http://127.0.0.1:4173>. You can also run `npm run demo` for the same fixed-port demo server.

## Checks

```bash
npm run check
```

This runs the analyzer tests and builds the production bundle.

## Production connection idea

1. Use Cloud Vision OCR to extract printed capacity, voltage, certification marks, and warning labels.
2. Send OCR text plus image observations to Gemini / Vertex AI for structured risk reasoning.
3. Store inspection results in Firebase for the live operator UI.
4. Export anonymized airport safety and recycling metrics to BigQuery.
5. Deploy the demo shell and API adapter on Cloud Run.
