import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Send, Users } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getConversation,
  getConversations,
  getMessages,
  sendMessage,
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

export function MessagesPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { data: conversations = [], isLoading: conversationsLoading } =
    useQuery({
      queryKey: ["conversations"],
      queryFn: getConversations,
      refetchInterval: 10_000,
    });
  const { data: selected, isError: conversationError } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
  });
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: 4_000,
  });
  const send = useMutation({
    mutationFn: (value: string) => sendMessage(conversationId!, value),
    onSuccess: async () => {
      setContent("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["messages", conversationId],
        }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    },
    onError: (value) => setError(apiMessage(value)),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || send.isPending) return;
    setError("");
    send.mutate(value);
  };

  return (
    <main className="messages-page">
      <aside
        className={
          conversationId
            ? "conversation-list mobile-hidden"
            : "conversation-list"
        }
      >
        <div className="messages-title">
          <p className="kicker">Общение</p>
          <h1>Сообщения</h1>
        </div>
        <Link className="community-chat-link" to="/messages/community">
          <span>
            <Users />
          </span>
          <div>
            <b>Общий чат</b>
            <p>Для всех участников</p>
          </div>
        </Link>
        {conversationsLoading ? (
          <div className="conversation-loading">Загружаем диалоги…</div>
        ) : conversations.length ? (
          <div className="conversation-items">
            {conversations.map((conversation) => (
              <Link
                className={conversation.id === conversationId ? "active" : ""}
                to={`/messages/${conversation.id}`}
                key={conversation.id}
              >
                <div className="message-avatar">
                  {conversation.other_avatar_url ? (
                    <img src={conversation.other_avatar_url} alt="" />
                  ) : (
                    conversation.other_username[0].toUpperCase()
                  )}
                </div>
                <div>
                  <b>
                    {conversation.other_display_name ||
                      `@${conversation.other_username}`}
                  </b>
                  <p>{conversation.last_message || "Начните разговор"}</p>
                </div>
                <time>{messageTime(conversation.last_message_at)}</time>
                {conversation.unread_count > 0 && (
                  <span className="unread-count">
                    {conversation.unread_count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="messages-empty">
            <MessageCircle />
            <h2>Диалогов пока нет</h2>
            <p>Открой машину из чужой подборки и нажми «Написать автору».</p>
            <Link to="/explore">Найти автомобиль</Link>
          </div>
        )}
      </aside>

      <section
        className={conversationId ? "chat-panel" : "chat-panel desktop-empty"}
      >
        {!conversationId ? (
          <div className="chat-placeholder">
            <MessageCircle />
            <h2>Выберите диалог</h2>
            <p>Ваша личная переписка появится здесь.</p>
          </div>
        ) : conversationError ? (
          <div className="chat-placeholder">
            <h2>Диалог не найден</h2>
            <Link to="/messages">Назад к сообщениям</Link>
          </div>
        ) : (
          <>
            <header className="chat-head">
              <Link
                to="/messages"
                className="chat-back"
                aria-label="К списку диалогов"
              >
                <ArrowLeft />
              </Link>
              <div className="message-avatar">
                {selected?.other_username[0].toUpperCase()}
              </div>
              <div>
                <b>
                  {selected?.other_display_name ||
                    `@${selected?.other_username ?? ""}`}
                </b>
                <span>@{selected?.other_username}</span>
              </div>
              {selected && (
                <Link to={`/users/${selected.other_username}`}>Профиль</Link>
              )}
            </header>
            <div className="message-stream">
              {messagesLoading ? (
                <div className="conversation-loading">Загружаем сообщения…</div>
              ) : messages.length ? (
                messages.map((message) => (
                  <article
                    className={
                      message.sender_username === user?.username
                        ? "message-bubble mine"
                        : "message-bubble"
                    }
                    key={message.id}
                  >
                    <p>{message.content}</p>
                    <time>{messageTime(message.created_at)}</time>
                  </article>
                ))
              ) : (
                <div className="first-message">
                  <p>Напиши первое сообщение автору подборки.</p>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form className="message-composer" onSubmit={submit}>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Напишите сообщение…"
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
          </>
        )}
      </section>
    </main>
  );
}
