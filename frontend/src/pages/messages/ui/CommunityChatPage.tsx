import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Users } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCommunityMessages,
  sendCommunityMessage,
} from "@/entities/conversation";
import { useAuth } from "@/features/auth";
import { apiMessage } from "@/shared/api";

function messageTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommunityChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["community-messages"],
    queryFn: getCommunityMessages,
    refetchInterval: 4_000,
  });
  const send = useMutation({
    mutationFn: sendCommunityMessage,
    onSuccess: async () => {
      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["community-messages"] });
    },
    onError: (value) => setError(apiMessage(value)),
  });

  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || send.isPending) return;
    setError("");
    send.mutate(value);
  };

  return (
    <main id="main-content" className="community-chat-page">
      <section className="community-chat-shell">
        <header className="community-chat-head">
          <Link to="/messages" className="back">
            <ArrowLeft /> Сообщения
          </Link>
          <div className="community-chat-title">
            <span>
              <Users />
            </span>
            <div>
              <p className="kicker">все участники</p>
              <h1>Общий чат</h1>
            </div>
          </div>
          <p>
            Обсуждайте машины, находки, события и всё, что хочется показать
            друзьям.
          </p>
        </header>
        <div className="community-message-stream">
          {isLoading ? (
            <div className="conversation-loading">Загружаем сообщения…</div>
          ) : isError ? (
            <div className="error">Не удалось загрузить чат. <button onClick={() => void refetch()}>Повторить</button></div>
          ) : messages.length ? (
            messages.map((message) => (
              <article
                className={
                  message.sender_username === user?.username
                    ? "community-message mine"
                    : "community-message"
                }
                key={message.id}
              >
                <b>@{message.sender_username}</b>
                <p>{message.content}</p>
                <time>{messageTime(message.created_at)}</time>
              </article>
            ))
          ) : (
            <div className="community-chat-empty">
              <Users />
              <h2>Чат ждёт первое сообщение</h2>
              <p>
                Напиши, какую машину недавно заметил или что ищешь для своей
                подборки.
              </p>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form className="community-composer" onSubmit={submit}>
          <textarea
            disabled={send.isPending}
            aria-label="Сообщение в общий чат"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Написать в общий чат…"
          />
          <button
            type="submit"
            disabled={!content.trim() || send.isPending}
            aria-label="Отправить"
          >
            <Send />
          </button>
          {error && <p className="field-error">{error}</p>}
        </form>
      </section>
    </main>
  );
}
