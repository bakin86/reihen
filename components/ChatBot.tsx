"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Turn /booking?center=... links in text into clickable Links */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\/booking\?center=[a-zA-Z0-9_-]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("/booking?center=") ? (
          <Link
            key={i}
            href={part}
            className="underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            Захиалах →
          </Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const SUGGESTIONS = ["5 сул суудал хайх", "10 суудал байна уу?", "Хамгийн хямд газар"];

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant")
                  updated[updated.length - 1] = { ...last, content: "Алдаа: " + parsed.error };
                return updated;
              });
              break;
            }
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant")
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
                return updated;
              });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant")
          updated[updated.length - 1] = {
            ...last,
            content: last.content || "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.",
          };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center border border-white/10 bg-[#0a0a0a] text-white transition-all duration-300 hover:bg-white hover:text-black"
        aria-label={open ? "Чат хаах" : "Чат нээх"}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[4.5rem] right-4 z-50 flex w-[min(340px,calc(100vw-32px))] flex-col border border-white/10 bg-[#0a0a0a] shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
          style={{ maxHeight: "min(520px, calc(100vh - 100px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em] text-white/80">
                Reihen AI
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/20 transition-colors hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-4 pt-2">
                <p className="text-[11px] text-white/70 text-center leading-relaxed">
                  Сайн байна уу!<br />Танд юугаар туслах вэ?
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="border border-white/20 bg-white/[0.06] px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-white/70 transition-all duration-200 hover:border-white/50 hover:bg-white/[0.12] hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-white text-black"
                      : "border border-white/[0.12] bg-white/[0.06] text-white"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <RichText text={msg.content} />
                  ) : (
                    msg.content
                  )}
                  {msg.role === "assistant" && !msg.content && streaming && (
                    <span className="inline-block h-3.5 w-1 bg-white/60 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex border-t border-white/10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Мессеж бичих..."
              disabled={streaming}
              className="flex-1 bg-transparent px-4 py-3 text-[12px] text-white placeholder:text-white/45 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="px-4 py-3 text-[9px] uppercase tracking-[0.25em] text-white/60 transition-all duration-200 hover:text-white disabled:opacity-30"
            >
              {streaming ? (
                <span className="flex gap-0.5 items-center">
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1 w-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : "Илгээх"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
