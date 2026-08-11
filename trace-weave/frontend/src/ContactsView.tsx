import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type AuthUser,
  type ContactOverview,
  type ContactSearchResult,
  type ConversationSummary,
  type DirectMessage,
} from "./api";

type ContactTab = "friends" | "messages";

function avatar(user: AuthUser) {
  return user.displayName.trim().slice(0, 1) || user.username.slice(0, 1).toUpperCase();
}

function shortTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

export function ContactsView({
  currentUser,
  data,
  initialTab,
  embedded = false,
  onTabChange,
  onDataChange,
  onNotificationsChanged,
  onRelationshipsChanged,
}: {
  currentUser: AuthUser;
  data: ContactOverview;
  initialTab: ContactTab;
  embedded?: boolean;
  onTabChange?: (tab: ContactTab) => void;
  onDataChange: (data: ContactOverview) => void;
  onNotificationsChanged: () => void | Promise<void>;
  onRelationshipsChanged: () => void | Promise<void>;
}) {
  const tab = initialTab;
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactSearchResult[]>([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<{ id: string; otherUser: AuthUser; canSend: boolean } | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [overview, conversationResult] = await Promise.all([api.getContacts(), api.getConversations()]);
    onDataChange(overview);
    setConversations(conversationResult.conversations);
    return conversationResult.conversations;
  }, [onDataChange]);

  useEffect(() => {
    void refresh().catch((error: Error) => setStatus(error.message));
  }, [refresh]);

  const loadConversation = useCallback(async (conversationId: string, quiet = false) => {
    try {
      const result = await api.getConversationMessages(conversationId);
      setActiveConversation(result.conversation);
      setMessages(result.messages);
      setNextCursor(result.nextCursor);
      await api.markConversationRead(conversationId);
      if (!quiet) void onNotificationsChanged();
      const [overview, conversationResult] = await Promise.all([api.getContacts(), api.getConversations()]);
      onDataChange(overview);
      setConversations(conversationResult.conversations);
      if (!quiet) requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "end" }));
    } catch (error) {
      if (!quiet) setStatus(error instanceof Error ? error.message : "无法读取会话");
    }
  }, [onDataChange, onNotificationsChanged]);

  useEffect(() => {
    if (!selectedConversationId || tab !== "messages") return;
    void loadConversation(selectedConversationId);
    const timer = window.setInterval(() => void loadConversation(selectedConversationId, true), 4_000);
    return () => window.clearInterval(timer);
  }, [loadConversation, selectedConversationId, tab]);

  useEffect(() => {
    if (selectedConversationId || !conversations.length || tab !== "messages") return;
    setSelectedConversationId(conversations[0]!.id);
  }, [conversations, selectedConversationId, tab]);

  async function searchUsers(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.searchContactUsers(query.trim());
      setSearchResults(result.users);
      if (!result.users.length) setStatus("没有找到匹配的用户");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法搜索用户");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(user: ContactSearchResult) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await api.sendFriendRequest(user.id, requestMessage.trim() || undefined);
      setRequestMessage("");
      setSearchResults((items) => items.map((item) => item.id === user.id ? { ...item, relationship: "outgoing" } : item));
      await refresh();
      setStatus(`已向 ${user.displayName} 发送好友申请`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法发送好友申请");
    } finally {
      setBusy(false);
    }
  }

  async function decideRequest(requestId: string, decision: "accept" | "reject" | "cancel") {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.decideFriendRequest(requestId, decision);
      await refresh();
      void onNotificationsChanged();
      if (decision === "accept" && result.conversationId) {
        void onRelationshipsChanged();
        onTabChange?.("messages");
        setSelectedConversationId(result.conversationId);
      } else {
        setStatus(decision === "reject" ? "已拒绝好友申请" : "好友申请已撤回");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法处理好友申请");
    } finally {
      setBusy(false);
    }
  }

  async function startChat(userId: string) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.openConversation(userId);
      await refresh();
      onTabChange?.("messages");
      setSelectedConversationId(result.conversationId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法打开私聊");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFriend(user: AuthUser) {
    if (!window.confirm(`解除与 ${user.displayName} 的好友关系？聊天记录会保留，但不能再发送消息。`)) return;
    setBusy(true);
    try {
      await api.removeContact(user.id);
      await refresh();
      void onRelationshipsChanged();
      setStatus("好友关系已经解除");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法解除好友关系");
    } finally {
      setBusy(false);
    }
  }

  async function blockFriend(user: AuthUser) {
    if (!window.confirm(`拉黑 ${user.displayName}？双方将不能查找、匹配或发送消息。`)) return;
    setBusy(true);
    try {
      await api.blockUser(user.id, "user_requested");
      await refresh();
      void onRelationshipsChanged();
      setStatus("已拉黑该用户");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法拉黑用户");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedConversationId || !composer.trim() || busy) return;
    const content = composer.trim();
    setComposer("");
    setBusy(true);
    try {
      await api.sendDirectMessage(selectedConversationId, content);
      await loadConversation(selectedConversationId);
    } catch (error) {
      setComposer(content);
      setStatus(error instanceof Error ? error.message : "消息发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadEarlier() {
    if (!selectedConversationId || !nextCursor || busy) return;
    setBusy(true);
    try {
      const result = await api.getConversationMessages(selectedConversationId, nextCursor);
      setMessages((current) => [...result.messages, ...current]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "无法加载更早消息");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="contacts-page">
      {!embedded ? <header className="contacts-heading">
        <div>
          <h1>好友与私聊</h1>
          <span>{tab === "friends" ? "查找用户、处理好友申请和管理关系" : "只有双方建立好友关系后才能私聊"}</span>
        </div>
        <div className="contacts-tabs" role="tablist" aria-label="好友与私聊">
          <button type="button" className={tab === "friends" ? "active" : ""} onClick={() => onTabChange?.("friends")}>
            好友{data.incomingRequests.length ? <strong>{data.incomingRequests.length}</strong> : null}
          </button>
          <button type="button" className={tab === "messages" ? "active" : ""} onClick={() => onTabChange?.("messages")}>
            消息{data.unreadTotal ? <strong>{data.unreadTotal > 99 ? "99+" : data.unreadTotal}</strong> : null}
          </button>
        </div>
      </header> : null}

      {status ? <div className="contacts-status" role="status"><span>{status}</span><button type="button" onClick={() => setStatus(null)}>×</button></div> : null}

      {tab === "friends" ? (
        <div className={`friends-layout ${data.incomingRequests.length || data.outgoingRequests.length ? "with-requests" : "without-requests"}`}>
          <section className="friend-search-card">
            <div><strong>添加好友</strong><small>通过用户名或昵称查找</small></div>
            <form onSubmit={searchUsers}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入用户名或昵称" aria-label="搜索用户" />
              <button className="secondary-button" type="submit" disabled={busy || !query.trim()}>查找</button>
            </form>
            {searchResults.length ? <div className="friend-search-results">
              <label><span>申请留言（可选）</span><input value={requestMessage} maxLength={240} onChange={(event) => setRequestMessage(event.target.value)} placeholder="简单介绍一下自己" /></label>
              {searchResults.map((result) => <article key={result.id}>
                <span className="contact-avatar">{avatar(result)}</span>
                <div><strong>{result.displayName}</strong><small>@{result.username}</small></div>
                {result.relationship === "none" ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void sendRequest(result)}>添加好友</button> : null}
                {result.relationship === "friend" ? <span className="relationship-label">已经是好友</span> : null}
                {result.relationship === "outgoing" ? <span className="relationship-label">等待对方处理</span> : null}
                {result.relationship === "incoming" ? <span className="relationship-label">对方申请添加你</span> : null}
              </article>)}
            </div> : null}
          </section>

          {data.incomingRequests.length || data.outgoingRequests.length ? <section className="friend-requests-card">
            <div className="friend-section-title"><strong>好友申请</strong><span>{data.incomingRequests.length} 条待处理</span></div>
            {[...data.incomingRequests, ...data.outgoingRequests].map((request) => <article key={request.id}>
              <span className="contact-avatar">{avatar(request.user)}</span>
              <div><strong>{request.user.displayName}</strong><small>@{request.user.username} · {shortTime(request.createdAt)}</small>{request.message ? <p>{request.message}</p> : null}</div>
              {request.direction === "incoming" ? <div className="request-actions"><button type="button" className="text-button" disabled={busy} onClick={() => void decideRequest(request.id, "reject")}>拒绝</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void decideRequest(request.id, "accept")}>同意</button></div> : <button type="button" className="text-button danger" disabled={busy} onClick={() => void decideRequest(request.id, "cancel")}>撤回</button>}
            </article>)}
          </section> : null}

          <section className="friend-list-card">
            <div className="friend-section-title"><strong>我的好友</strong><span>{data.contacts.length} 人</span></div>
            {data.contacts.map((contact) => <article key={contact.connectionId}>
              <span className="contact-avatar">{avatar(contact.user)}</span>
              <div className="contact-identity"><strong>{contact.user.displayName}</strong><small>@{contact.user.username}</small>{contact.lastMessage ? <p>{contact.lastMessage.senderId === currentUser.id ? "我：" : ""}{contact.lastMessage.content}</p> : <p>现在可以开始私聊了</p>}</div>
              {contact.unreadCount ? <span className="contact-unread">{contact.unreadCount}</span> : null}
              <div className="contact-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void startChat(contact.user.id)}>发消息</button><details><summary>•••</summary><div><button type="button" onClick={() => void deleteFriend(contact.user)}>解除好友</button><button type="button" className="danger" onClick={() => void blockFriend(contact.user)}>拉黑</button></div></details></div>
            </article>)}
            {!data.contacts.length ? <div className="contacts-empty"><strong>还没有好友</strong><span>通过上方搜索添加，或在“发现”中与匿名相似用户双方同意后建立关系。</span></div> : null}
          </section>
        </div>
      ) : (
        <div className="messages-layout">
          <aside className="conversation-list">
            <div className="conversation-list-heading"><strong>私聊</strong><span>{conversations.length}</span></div>
            {conversations.map((conversation) => <button type="button" className={selectedConversationId === conversation.id ? "active" : ""} key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)}>
              <span className="contact-avatar">{avatar(conversation.otherUser)}</span>
              <span className="conversation-preview"><strong>{conversation.otherUser.displayName}</strong><small>{conversation.lastMessage ? `${conversation.lastMessage.senderId === currentUser.id ? "我：" : ""}${conversation.lastMessage.content}` : "还没有消息"}</small></span>
              <span className="conversation-meta"><time>{shortTime(conversation.updatedAt)}</time>{conversation.unreadCount ? <i>{conversation.unreadCount}</i> : null}</span>
            </button>)}
            {!conversations.length ? <div className="contacts-empty compact"><span>还没有私聊会话</span></div> : null}
          </aside>
          <section className="chat-panel">
            {activeConversation ? <>
              <header><span className="contact-avatar">{avatar(activeConversation.otherUser)}</span><div><strong>{activeConversation.otherUser.displayName}</strong><small>@{activeConversation.otherUser.username}</small></div><span className={activeConversation.canSend ? "chat-state online" : "chat-state"}>{activeConversation.canSend ? "好友" : "关系已解除"}</span></header>
              <div className="message-stream">
                {nextCursor ? <button type="button" className="load-earlier" disabled={busy} onClick={() => void loadEarlier()}>加载更早消息</button> : null}
                {messages.map((message, index) => {
                  const mine = message.senderId === currentUser.id;
                  const previous = messages[index - 1];
                  const showTime = !previous || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60_000;
                  return <div className={`message-row ${mine ? "mine" : "theirs"}`} key={message.id}>{showTime ? <time>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(message.createdAt))}</time> : null}<div>{message.content}</div></div>;
                })}
                {!messages.length ? <div className="chat-empty"><strong>这是你们的私聊</strong><span>生活记录不会自动发送到这里，只有你主动输入的消息会被对方看到。</span></div> : null}
                <div ref={messageEndRef} />
              </div>
              <form className="chat-composer" onSubmit={sendMessage}>
                <textarea value={composer} maxLength={4000} disabled={!activeConversation.canSend} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={activeConversation.canSend ? "输入消息，Enter 发送，Shift + Enter 换行" : "恢复好友关系后才能继续发送"} />
                <div><span>{composer.length}/4000</span><button className="secondary-button" type="submit" disabled={busy || !composer.trim() || !activeConversation.canSend}>{busy ? "发送中" : "发送"}</button></div>
              </form>
            </> : <div className="chat-empty centered"><strong>选择一位好友开始私聊</strong><span>你的生活流水仍然默认私密，不会自动进入聊天。</span></div>}
          </section>
        </div>
      )}
    </section>
  );
}
