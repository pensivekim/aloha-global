import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, MessageCircle, Loader2 } from "lucide-react";

// 브라우저 언어별 UI 텍스트 정의
const i18n = {
  ko: {
    title: "Aloha 챗봇",
    subtitle: "돌봄 시설 상담 도우미",
    welcome:
      "안녕하세요! 돌봄 시설 상담 도우미 Aloha예요 🌺\n\n영유아 시설(어린이집·유치원)과 노인복지시설(주간보호·요양원) 관련 문의를 도와드려요.\n궁금한 점을 편하게 물어보세요!",
    placeholder: "궁금한 점을 입력하세요...",
    thinking: "답변 작성 중...",
  },
  en: {
    title: "Aloha Chatbot",
    subtitle: "Care Facility Assistant",
    welcome:
      "Hello! I'm Aloha, your care facility assistant 🌺\n\nI can help with inquiries about child care (daycare, preschool) and elderly care (nursing homes, day care centers).\nFeel free to ask anything!",
    placeholder: "Type your question...",
    thinking: "Thinking...",
  },
  ja: {
    title: "Aloha チャットボット",
    subtitle: "ケア施設相談アシスタント",
    welcome:
      "こんにちは！ケア施設相談アシスタントのAlohaです 🌺\n\n保育施設（保育所・幼稚園）や高齢者施設（デイサービス・特養）に関するご質問にお答えします。\nお気軽にどうぞ！",
    placeholder: "ご質問を入力してください...",
    thinking: "回答を作成中...",
  },
  zh: {
    title: "Aloha 聊天助手",
    subtitle: "护理机构咨询助手",
    welcome:
      "您好！我是护理机构咨询助手 Aloha 🌺\n\n我可以帮助解答有关幼儿园、托儿所以及养老院、日间照护中心等方面的问题。\n请随时提问！",
    placeholder: "请输入您的问题...",
    thinking: "正在生成回复...",
  },
  es: {
    title: "Aloha Chatbot",
    subtitle: "Asistente de centros de cuidado",
    welcome:
      "¡Hola! Soy Aloha, tu asistente de centros de cuidado 🌺\n\nPuedo ayudarte con consultas sobre guarderías, preescolares, residencias de ancianos y centros de día.\n¡Pregunta lo que necesites!",
    placeholder: "Escribe tu pregunta...",
    thinking: "Pensando...",
  },
  vi: {
    title: "Aloha Chatbot",
    subtitle: "Trợ lý tư vấn cơ sở chăm sóc",
    welcome:
      "Xin chào! Tôi là Aloha, trợ lý tư vấn cơ sở chăm sóc 🌺\n\nTôi có thể hỗ trợ các câu hỏi về nhà trẻ, mẫu giáo, viện dưỡng lão và trung tâm chăm sóc ban ngày.\nHãy hỏi bất cứ điều gì!",
    placeholder: "Nhập câu hỏi của bạn...",
    thinking: "Đang suy nghĩ...",
  },
};

// 브라우저 언어 코드에서 지원 언어를 찾는 함수
function detectLang() {
  const browserLang = (navigator.language || "en").toLowerCase();
  const prefix = browserLang.split("-")[0];
  return i18n[prefix] ? prefix : "en";
}

// Aloha — Global Care Facility AI Assistant
function App() {
  // 브라우저 언어 감지
  const lang = useMemo(() => detectLang(), []);
  const t = i18n[lang];

  // 메시지 목록 상태
  const [messages, setMessages] = useState([
    { role: "bot", text: t.welcome },
  ]);
  // 입력값 상태
  const [input, setInput] = useState("");
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 메시지 끝으로 자동 스크롤하기 위한 ref
  const bottomRef = useRef(null);

  // 새 메시지가 추가될 때마다 하단으로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 메시지 전송 및 API 호출 처리
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // 사용자 메시지 추가
    const userMessage = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Cloudflare Pages Function 호출
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error");
      }

      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: `⚠️ ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Enter 키로 전송 (한글 등 조합형 입력 중에는 무시)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      {/* 챗봇 카드 */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl flex flex-col overflow-hidden border border-orange-100">

        {/* 헤더 */}
        <header className="bg-gradient-to-r from-orange-300 to-rose-300 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              {t.title}
            </h1>
            <p className="text-xs text-white/80">
              {t.subtitle}
            </p>
          </div>
        </header>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[420px] max-h-[420px] scroll-smooth">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* 봇 아바타 */}
              {msg.role === "bot" && (
                <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center mr-2 shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-orange-600" />
                </div>
              )}

              {/* 말풍선 */}
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-orange-400 text-white rounded-br-sm"
                    : "bg-amber-50 text-gray-700 rounded-bl-sm border border-amber-100"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* 로딩 표시 */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center mr-2 shrink-0 mt-1">
                <Bot className="w-4 h-4 text-orange-600" />
              </div>
              <div className="bg-amber-50 text-gray-500 border border-amber-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.thinking}
              </div>
            </div>
          )}

          {/* 자동 스크롤 앵커 */}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-orange-100 bg-white/60 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={t.placeholder}
            className="flex-1 rounded-full border border-orange-200 bg-white px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="bg-orange-400 hover:bg-orange-500 active:scale-95 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
