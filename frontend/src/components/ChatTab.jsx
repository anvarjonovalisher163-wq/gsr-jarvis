import { useEffect, useRef, useState } from "react";
import { api, streamChat } from "../api.js";

const QUICK_ACTIONS = [
  {
    label: "Haftalik kontent-plan",
    prompt:
      "Keyingi hafta uchun Instagram kontent-plan tuz: 5 ta post (post/karusel/reels aralash), har biriga hook + qiymat + CTA, hashtaglar va eng yaxshi joylash vaqti.",
  },
  {
    label: "Sotuv posti yoz",
    prompt:
      "GSR Logistics uchun kuchli sotuv posti yoz: Xitoydan avia yuk tashish xizmati. Hook + qiymat + CTA tuzilishida, hashtaglar bilan.",
  },
  {
    label: "Aksiya g'oyasi",
    prompt:
      "Yangi mijozlarni jalb qilish uchun 3 ta aksiya g'oyasi taklif qil (masalan, birinchi jo'natmaga chegirma). Har birining sharti va kutilayotgan natijasini yoz.",
  },
  {
    label: "Raqobatchi tahlili",
    prompt:
      "Xitoy-O'zbekiston logistika bozorida raqobatchilar odatda qanday kontent va aksiyalar bilan ishlaydi? GSR Logistics ajralib turishi uchun 5 ta amaliy tavsiya ber.",
  },
];

export default function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    api
      .chatHistory()
      .then(setMessages)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setError("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: `u${Date.now()}`, role: "user", content: message },
      { id: `a${Date.now()}`, role: "assistant", content: "" },
    ]);
    try {
      await streamChat(message, (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      });
    } catch (e) {
      setError(e.message);
      setMessages((prev) => prev.filter((m) => m.content !== ""));
    } finally {
      setBusy(false);
    }
  };

  const toggleVoice = () => {
    if (!speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    // uz-UZ where supported; the browser falls back to its default otherwise.
    rec.lang = "uz-UZ";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 && !busy && (
          <div className="chat-empty">
            <span className="j-avatar big">J</span>
            <p>
              Salom! Men Jarvis — GSR Logistics'ning AI marketing direktori.
              Kontent, aksiya, strategiya — nimadan boshlaymiz?
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            {m.role === "assistant" && <span className="j-avatar">J</span>}
            <div className={`msg ${m.role}`}>
              {m.content || (busy ? <span className="typing">Jarvis yozmoqda…</span> : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error-text chat-error">{error}</div>}

      <div className="quick-chips">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            className="chip"
            disabled={busy}
            onClick={() => send(qa.prompt)}
          >
            {qa.label}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        {speechSupported && (
          <button
            className={`icon-btn mic ${listening ? "listening" : ""}`}
            onClick={toggleVoice}
            title="Ovozli kiritish"
          >
            🎙️
          </button>
        )}
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Jarvis'ga yozing…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn btn-primary send-btn" disabled={busy || !input.trim()} onClick={() => send()}>
          ➤
        </button>
      </div>
    </div>
  );
}
