# Live AI Avatar Conversation App

Local browser app. Talk live with an avatar animated from a single photo. Her feed and your webcam show side by side. The session records to a local video file. Any persona via system prompt (interviewer, storyteller, etc.). Conversation memory persists.

Versions and prices verified Sep 30, 2026.

## Pipeline

```
Mic -> Deepgram Flux (STT) -> gpt-5.4-nano (LLM) -> Azure Speech (TTS + visemes)
                                                          |
                                     audio + viseme timings -> browser
                                                          |
                     MediaPipe landmarks on photo -> canvas mouth/jaw warp
                                                          |
             Canvas (avatar + webcam) + mixed audio -> MediaRecorder -> .webm
```

## Stack

| Layer | Package | Version | Runs | Cost |
|---|---|---|---|---|
| Runtime | Node.js | 26.x (LTS from 2026-10-28) | Local | Free |
| Language | TypeScript | 7.0.2 | Dev | Free |
| Build | Vite | 8.3.1 (needs Node 20.19+ / 22.12+) | Dev | Free |
| Runner | tsx | 4.23.15 | Dev | Free |
| Face landmarks | @mediapipe/tasks-vision | 1.0.1 (install with `@latest`) | Browser | Free |
| Animation + recording | Canvas 2D + MediaRecorder | Built in | Browser | Free |
| Memory | JSONL + summary.json via Node `fs` | Built in | Local | Free |
| STT | @deepgram/sdk (Flux) | 5.12.0 | Cloud | $0.0065/min |
| LLM | openai (Responses API), `gpt-5.4-nano` | 7.23.0 | Cloud | $0.20 in / $1.25 out per 1M tokens |
| TTS + visemes | microsoft-cognitiveservices-speech-sdk | 1.51.0 | Cloud | ~$16 per 1M chars (free: 500K chars/month) |

UI: vanilla TypeScript + Canvas 2D, no framework.

## Local system requirements

- Any laptop from ~2020, 2+ cores, 8GB RAM, no dedicated GPU
- Current Chrome or Edge
- Disk: ~0.5-1 GB per hour of 480p recording
- No local AI models

## Cost

About $0.016 per conversation minute (~$0.95/hour).

Assumptions: AI speaks half the time at ~900 chars/min; 4 turns/min; ~2,000 input and ~150 output tokens per turn. Deepgram new accounts get $200 credit.

## Implementation notes

**Server (Node)**
- All API keys in `.env`, server side only.
- Browser receives a short-lived Azure Speech token.
- WebSocket between browser and server.

**STT**
- Send raw linear16 PCM to Deepgram Flux. Compressed formats such as WebM are not accepted.
- Flux handles turn detection.

**LLM**
- Use the Responses API with reasoning effort minimal. Reasoning tokens bill as output.
- Each call = system prompt + running summary + recent turns.

**Avatar**
- Run MediaPipe Face Landmarker once on the photo.
- Azure Speech emits `visemeReceived` events: 22 viseme IDs, offset in ticks (divide by 10000 for ms).
- Map visemes to mouth shapes and warp mouth/jaw on the canvas, timed to the audio.
- Add idle motion: blink timer, slight head sway.
- Confirm viseme support for your chosen Azure voice and language.

**Recording**
- Draw avatar and webcam side by side on one canvas at 480p.
- Mix mic and TTS audio with Web Audio API.
- `canvas.captureStream()` + `MediaRecorder` -> WebM saved locally.

**Memory**
- Transcript in RAM during session.
- Append each turn to `sessions/<id>.jsonl`.
- Maintain rolling summary in `summary.json`.

## Structure

```
server/   Node: token endpoint, STT/LLM/TTS orchestration, memory
web/      Vite + TS: capture, avatar canvas, recorder, UI
sessions/ JSONL transcripts + summary.json
.env      DEEPGRAM_API_KEY, OPENAI_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
```

## Constraints

- Use only photos you own or have consent to use.
- Expect ~1-3s turn latency.
- After install, run `npm outdated`.