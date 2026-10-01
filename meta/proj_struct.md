```
avatar-app/
├── .env                 # DEEPGRAM_API_KEY, OPENAI_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
├── .gitignore           # .env, node_modules, sessions/, recordings/
├── package.json
├── tsconfig.json
├── vite.config.ts       # proxies /api and /ws to the Node server
├── index.html           # two canvases/videos side by side + controls
├── server.ts            # everything server side, one file
├── src/
│   ├── main.ts          # UI wiring, mic capture (PCM), WebSocket client
│   ├── avatar.ts        # MediaPipe landmarks, mouth/jaw warp, viseme mapping, blink and sway
│   ├── tts.ts           # Azure Speech SDK: speak text, emit visemes, output audio
│   ├── recorder.ts      # canvas compositing, audio mix, MediaRecorder, upload on stop
│   └── style.css
├── public/
│   └── avatar.jpg       # your photo
├── sessions/            # runtime: <id>.jsonl + summary.json
└── recordings/          # runtime: <id>.webm
```

**Responsibilities**

- **`server.ts`**
  - Serves the Azure token endpoint (`/api/token`).
  - Runs the WebSocket: receives mic PCM and relays it to Deepgram Flux.
  - On end of turn, calls `gpt-5.4-nano` with system prompt + summary + recent turns, then sends the reply text to the browser.
  - Appends turns to `sessions/<id>.jsonl` and updates `summary.json`.
  - Receives the finished recording and writes it to `recordings/`.
- **`src/main.ts`**: starts the session, captures the mic, and connects everything.
- **`src/tts.ts`**: takes reply text, speaks it through Azure, and fires viseme events.
- **`src/avatar.ts`**: draws the photo on the canvas each frame and warps the mouth from viseme events.
- **`src/recorder.ts`**: combines the avatar canvas, your webcam and both audio sources, records, and sends the file to the server.

Run in dev with `tsx watch server.ts` and `vite` in two terminals.