import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import PDFDocument from "pdfkit";
import { WebSocketServer, type WebSocket } from "ws";
import { DeepgramClient } from "@deepgram/sdk";
import OpenAI from "openai";

// ---------- config ----------
const PORT = Number(process.env.PORT ?? 8787);
const LLM_MODEL = "gpt-5.4-nano";
const SESSIONS_DIR = path.resolve("sessions");
const RECORDINGS_DIR = path.resolve("recordings");
const SUMMARY_FILE = path.join(SESSIONS_DIR, "summary.json");
const FOLD_AT = 24; // when recent turns exceed this, fold the oldest half into long-term memory

for (const key of [
  "DEEPGRAM_API_KEY",
  "OPENAI_API_KEY",
  "AZURE_SPEECH_KEY",
  "AZURE_SPEECH_REGION",
]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}
const AZURE_KEY = process.env.AZURE_SPEECH_KEY!;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION!;

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

await mkdir(SESSIONS_DIR, { recursive: true });
await mkdir(RECORDINGS_DIR, { recursive: true });

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
}

// ---------- memory ----------
type Turn = { role: "user" | "assistant"; content: string; ts: number };

async function loadMemory(): Promise<string> {
  try {
    return JSON.parse(await readFile(SUMMARY_FILE, "utf8")).summary ?? "";
  } catch {
    return "";
  }
}

async function saveMemory(summary: string) {
  await writeFile(
    SUMMARY_FILE,
    JSON.stringify({ summary, updated: new Date().toISOString() }, null, 2),
  );
}

// ---------- LLM ----------
const VOICE_RULES =
  "You are speaking aloud in a live video call. Reply in 1-3 short, natural spoken sentences. " +
  "No markdown, lists, emojis or stage directions.";

async function generateReply(
  systemPrompt: string,
  memory: string,
  turns: Turn[],
): Promise<string> {
  const instructions = [
    systemPrompt,
    VOICE_RULES,
    memory && `Your memory of earlier conversations with this user:\n${memory}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await openai.responses.create({
    model: LLM_MODEL,
    instructions,
    input: turns.map((t) => ({ role: t.role, content: t.content })),
    reasoning: { effort: "none" },
    max_output_tokens: 300,
  });
  return res.output_text.trim();
}

async function summarize(oldNotes: string, turns: Turn[]): Promise<string> {
  const transcript = turns
    .map((t) => `${t.role === "user" ? "User" : "Avatar"}: ${t.content}`)
    .join("\n");
  const res = await openai.responses.create({
    model: LLM_MODEL,
    instructions:
      "You maintain long-term memory notes for a conversational avatar. Merge the new conversation into the " +
      "existing notes. Keep names, facts, preferences and unresolved topics. Max 200 words. Output only the notes.",
    input: `Existing notes:\n${oldNotes || "(none)"}\n\nNew conversation:\n${transcript}`,
    reasoning: { effort: "none" },
    max_output_tokens: 400,
  });
  return res.output_text.trim();
}

// ---------- one conversation session (one WebSocket) ----------
async function startSession(ws: WebSocket, systemPrompt: string) {
  const sessionId = `${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 6)}`;
  const logFile = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  let memory = await loadMemory();
  const recent: Turn[] = [];
  let muted = false;
  let chain: Promise<void> = Promise.resolve();

  const send = (obj: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  const addTurn = async (role: Turn["role"], content: string) => {
    const turn: Turn = { role, content, ts: Date.now() };
    recent.push(turn);
    await appendFile(logFile, JSON.stringify(turn) + "\n");
  };

  const handleTurn = async (userText: string) => {
    try {
      await addTurn("user", userText);
      send({ type: "transcript", text: userText });

      const text = await generateReply(systemPrompt, memory, recent);
      await addTurn("assistant", text);
      send({ type: "reply", text });

      if (recent.length > FOLD_AT) {
        const old = recent.splice(0, Math.floor(recent.length / 2));
        memory = await summarize(memory, old);
        await saveMemory(memory);
      }
    } catch (err) {
      console.error("turn failed:", err);
      send({ type: "error", message: errText(err) });
    }
  };

  // Deepgram Flux: 16 kHz mono linear16 PCM in, turn events out
  const dg = await deepgram.listen.v2.connect({
    model: "flux-general-en",
    encoding: "linear16",
    sample_rate: "16000",
    eot_threshold: 0.8,
  });

  dg.on("message", (m) => {
    if (m.type !== "TurnInfo") return;
    if (m.event === "Update") {
      send({ type: "partial", text: m.transcript });
    } else if (m.event === "EndOfTurn") {
      const text = m.transcript.trim();
      if (text) chain = chain.then(() => handleTurn(text));
    }
  });
  dg.on("error", (err) => {
    console.error("deepgram error:", err);
    send({
      type: "error",
      message: `speech-to-text error: ${errText(err)}`,
      fatal: true,
    });
  });

  dg.connect();
  await dg.waitForOpen();
  send({ type: "ready", sessionId });

  return {
    audio(chunk: Buffer) {
      if (!muted) dg.sendMedia(chunk);
    },
    setMuted(value: boolean) {
      muted = value;
    },
    async end() {
      dg.close();
      await chain;
      if (recent.length >= 2) {
        memory = await summarize(memory, recent);
        await saveMemory(memory);
      }
    },
  };
}

// ---------- HTTP: Azure token + recording upload + sessions + pdf ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  try {
    if (req.method === "GET" && url.pathname === "/api/token") {
      const r = await fetch(
        `https://${AZURE_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": AZURE_KEY,
            "Content-Length": "0",
          },
        },
      );
      if (!r.ok) return json(502, { error: `azure token failed: ${r.status}` });
      return json(200, { token: await r.text(), region: AZURE_REGION });
    }

    if (req.method === "POST" && url.pathname === "/api/recording") {
      const id = url.searchParams.get("id") ?? "";
      if (!/^[\w-]+$/.test(id)) return json(400, { error: "bad id" });
      const file = path.join(RECORDINGS_DIR, `${id}.webm`);
      await pipeline(req, createWriteStream(file, { flags: "a" })); // chunks arrive in order and are appended
      return json(200, { saved: file });
    }

    // List all sessions in reverse chronological order
    if (req.method === "GET" && url.pathname === "/api/sessions") {
      const files = await readdir(SESSIONS_DIR);
      const jsonlFiles = files.filter(
        (f) => f.endsWith(".jsonl") && !f.startsWith(".")
      );

      const items = await Promise.all(
        jsonlFiles.map(async (file) => {
          const id = file.replace(/\.jsonl$/, "");
          const filePath = path.join(SESSIONS_DIR, file);
          const pdfPath = path.join(SESSIONS_DIR, `${id}.pdf`);
          const fileStat = await stat(filePath);

          let messageCount = 0;
          let preview = "";
          try {
            const content = await readFile(filePath, "utf8");
            const lines = content.trim().split("\n").filter(Boolean);
            messageCount = lines.length;
            if (lines.length > 0) {
              const firstTurn = JSON.parse(lines[0]);
              preview = firstTurn.content ?? "";
            }
          } catch {}

          let hasPdf = false;
          try {
            await stat(pdfPath);
            hasPdf = true;
          } catch {}

          return {
            id,
            createdAt: fileStat.birthtimeMs || fileStat.mtimeMs,
            messageCount,
            preview,
            hasPdf,
          };
        })
      );

      // Sort reverse chronological
      items.sort((a, b) => b.createdAt - a.createdAt);
      return json(200, { sessions: items });
    }

    // Get specific session details or PDF download
    if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      // /api/sessions/:id or /api/sessions/:id/pdf
      const id = parts[2];
      if (!id || !/^[\w-]+$/.test(id)) return json(400, { error: "bad session id" });

      const isPdfReq = parts[3] === "pdf";
      const jsonlPath = path.join(SESSIONS_DIR, `${id}.jsonl`);
      const pdfPath = path.join(SESSIONS_DIR, `${id}.pdf`);

      if (isPdfReq) {
        try {
          const pdfData = await readFile(pdfPath);
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${id}.pdf"`,
            "Content-Length": pdfData.length,
          });
          res.end(pdfData);
          return;
        } catch {
          return json(404, { error: "PDF not found on disk" });
        }
      }

      // Return session turns
      try {
        const content = await readFile(jsonlPath, "utf8");
        const turns: Turn[] = content
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));

        let hasPdf = false;
        try {
          await stat(pdfPath);
          hasPdf = true;
        } catch {}

        return json(200, { id, turns, hasPdf });
      } catch {
        return json(404, { error: "Session not found" });
      }
    }

    // Handle POST /api/sessions/:id/create-pdf
    if (req.method === "POST" && url.pathname.startsWith("/api/sessions/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[2];
      const isCreatePdf = parts[3] === "create-pdf";
      if (!id || !/^[\w-]+$/.test(id) || !isCreatePdf) {
        return json(400, { error: "bad request" });
      }
      const jsonlPath = path.join(SESSIONS_DIR, `${id}.jsonl`);
      const pdfPath = path.join(SESSIONS_DIR, `${id}.pdf`);

      let turns: Turn[] = [];
      try {
        const content = await readFile(jsonlPath, "utf8");
        turns = content
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
      } catch {
        return json(404, { error: "Session not found" });
      }

      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40 });
        const stream = createWriteStream(pdfPath);
        doc.pipe(stream);

        doc.fontSize(20).text("Conversation Transcript", { underline: true });
        doc.fontSize(10).fillColor("#666666").text(`Session ID: ${id}`);
        doc.text(`Generated: ${new Date().toLocaleString()}`);
        doc.moveDown(1.5);

        for (const turn of turns) {
          const isUser = turn.role === "user";
          const label = isUser ? "User" : "Avatar";
          const roleColor = isUser ? "#1d4ed8" : "#047857";
          const timeStr = turn.ts ? new Date(turn.ts).toLocaleTimeString() : "";

          doc.fontSize(11).fillColor(roleColor).text(`${label} [${timeStr}]:`, {
            continued: false,
          });
          doc.fontSize(10).fillColor("#111827").text(turn.content);
          doc.moveDown(0.8);
        }

        doc.end();
        stream.on("finish", () => resolve());
        stream.on("error", reject);
      });

      return json(200, { success: true, pdfUrl: `/api/sessions/${id}/pdf` });
    }

    json(404, { error: "not found" });
  } catch (err) {
    console.error(err);
    json(500, { error: errText(err) });
  }
});

// ---------- WebSocket: mic audio in, transcript/reply out ----------
// Client -> server: binary = PCM16 audio; JSON = {type:"start", systemPrompt} | {type:"mute", value}
// Server -> client: {type:"ready"|"partial"|"transcript"|"reply"|"error", ...}
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let session: Awaited<ReturnType<typeof startSession>> | null = null;

  ws.on("message", async (data, isBinary) => {
    let msgIsStart = false;
    try {
      if (isBinary) {
        session?.audio(data as Buffer);
        return;
      }
      const msg = JSON.parse(data.toString());
      if (msg.type === "start" && !session) {
        msgIsStart = true;
        session = await startSession(
          ws,
          String(
            msg.systemPrompt ?? "You are a friendly conversation partner.",
          ),
        );
      } else if (msg.type === "mute") {
        session?.setMuted(Boolean(msg.value));
      }
    } catch (err) {
      console.error(err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: errText(err),
          fatal: msgIsStart,
        }),
      );
    }
  });

  ws.on("close", () => {
    session?.end().catch((err) => console.error("session end failed:", err));
  });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`server on http://127.0.0.1:${PORT}`),
);
