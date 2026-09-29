import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, type ListRenderItem, Platform, StyleSheet, type TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MatchSummary } from "@snack/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Icon,
  Pill,
  Screen,
  Text,
  appShellRoutes,
  profileHref,
  toast,
  useTheme
} from "../../../shared/ui";
import { useDelayedFlag, useScreenFocus } from "../../activity/presentation/use-screen-focus";
import { useMatchForConversation, useUnmatch } from "../../matches/application/use-matches";
import { displayNameOf, matchExpiryHint } from "../../matches/domain/match-list";
import { SafetySheet } from "../../safety";
import { useChatSession } from "../application/use-chat-session";
import { useIcebreakers } from "../application/use-icebreakers";
import type { TimelineItem } from "../domain/timeline";
import { ChatHeader } from "./chat-header";
import { ChatMenuSheet } from "./chat-menu-sheet";
import { ChatSkeleton, DaySeparator, HistoryTop, TypingBubble } from "./chat-parts";
import { Composer } from "./composer";
import { IcebreakersPanel } from "./icebreakers-panel";
import { MessageBubble } from "./message-bubble";

/** Borradores por conversación mientras la app está abierta (salir y volver no pierde lo escrito). */
const drafts = new Map<string, string>();

/** Deja que la hoja anterior termine de cerrarse antes de abrir otra (iOS no apila modales al vuelo). */
const SHEET_HANDOFF_MS = 320;

/** Conversación en tiempo real con un match. `conversationId` viene de la ruta `/chat/[id]`. */
export function ChatScreen({ conversationId }: { conversationId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocus();
  const { match: liveMatch, status: matchStatus } = useMatchForConversation(conversationId);

  // Tras deshacer o bloquear el match desaparece de la lista: la cabecera conserva lo último conocido.
  const lastMatch = useRef<MatchSummary | null>(liveMatch);
  if (liveMatch) {
    lastMatch.current = liveMatch;
  }
  const match = liveMatch ?? lastMatch.current;
  const other = match?.otherProfile ?? null;
  const name = match ? displayNameOf(match) : null;

  const chat = useChatSession(conversationId, { otherProfileId: other?.id ?? null, focused });
  const { state, timeline } = chat;

  const [text, setText] = useState(() => drafts.get(conversationId) ?? "");
  const inputRef = useRef<TextInput>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [unmatchError, setUnmatchError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const unmatch = useUnmatch();

  useEffect(() => {
    drafts.set(conversationId, text);
  }, [conversationId, text]);

  const empty = state.status === "ready" && state.messages.length === 0 && state.outbox.length === 0;
  const icebreakers = useIcebreakers(other?.id ?? null, empty, conversationId);
  const reconnecting = useDelayedFlag(state.status === "ready" && state.connection === "connecting", 3000);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(appShellRoutes.chats);
    }
  }, [router]);

  // Vuelve a la pestaña Chats que ya está en la pila (sin apilar otro navegador de pestañas);
  // si no existe (enlace directo), la sustituye.
  const leaveToChats = useCallback(() => {
    router.dismissTo(appShellRoutes.chats);
  }, [router]);

  const openProfile = useCallback(() => {
    if (other) {
      router.push(profileHref(other.id));
    }
  }, [other, router]);

  function submit() {
    if (chat.send(text)) {
      setText("");
    }
  }

  function changeText(next: string) {
    setText(next);
    if (next.trim() !== "") {
      chat.notifyTyping();
    }
  }

  function pickIcebreaker(message: string) {
    setText(message);
    inputRef.current?.focus();
  }

  function fromMenu(next: () => void) {
    setMenuOpen(false);
    setTimeout(next, SHEET_HANDOFF_MS);
  }

  async function confirmUnmatchNow() {
    if (!match || unmatching) {
      return;
    }

    setUnmatching(true);
    setUnmatchError(null);
    try {
      await unmatch(match.id);
      setConfirmUnmatch(false);
      toast.show({ message: `Has deshecho el match con ${name ?? "esta persona"}.`, icon: "heart-crack" });
      leaveToChats();
    } catch (error) {
      // Dentro de la hoja: un toast quedaría debajo del Modal.
      setUnmatchError(friendlyErrorMessage(error, "No hemos podido deshacer el match. Inténtalo otra vez."));
    } finally {
      setUnmatching(false);
    }
  }

  const { retry, discard, loadOlder } = chat;
  const renderItem: ListRenderItem<TimelineItem> = useCallback(
    ({ item }) =>
      item.kind === "day" ? (
        <DaySeparator label={item.label} />
      ) : (
        <MessageBubble live={state.liveKeys.has(item.key)} message={item} onDiscard={discard} onRetry={retry} />
      ),
    [discard, retry, state.liveKeys]
  );

  const displayName = name ?? "esta persona";
  let body: ReactNode;

  // Sin saber aún quién es quién (enlace directo, lista sin cargar) las burbujas saldrían del lado equivocado.
  const identityPending = !other && (matchStatus === "loading" || matchStatus === "idle");

  if (state.status === "loading" || (state.status === "ready" && identityPending)) {
    body = <ChatSkeleton />;
  } else if (state.status === "error") {
    body = (
      <ErrorState
        message={friendlyErrorMessage(state.error, "No hemos podido cargar la conversación.")}
        onRetry={chat.retryLoad}
        testID="chat-error"
      />
    );
  } else if (state.status === "unavailable" && state.messages.length === 0) {
    body = (
      <EmptyState
        actionIcon="chat"
        actionLabel="Volver a mis chats"
        description="Puede que se haya deshecho el match o que alguien haya cerrado su cuenta. No pasa nada: hay mucha gente maja en Descubrir."
        mascotColor="lavanda"
        mood="sad"
        onAction={leaveToChats}
        testID="chat-unavailable"
        title="Esta conversación ya no está disponible"
      />
    );
  } else if (empty) {
    body = (
      <IcebreakersPanel
        expiryHint={matchExpiryHint(match?.expiresAt ?? null)}
        icebreakers={icebreakers.icebreakers}
        loading={icebreakers.loading}
        name={displayName}
        onPick={pickIcebreaker}
      />
    );
  } else {
    body = (
      <FlatList
        contentContainerStyle={styles.list}
        data={timeline}
        initialNumToRender={20}
        inverted
        keyExtractor={(item) => item.key}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <HistoryTop
            hasMessages={state.messages.length > 0}
            hasOlder={state.hasOlder}
            loadingOlder={state.loadingOlder}
            matchedAt={match?.matchedAt ?? null}
            olderError={state.olderError}
            onRetry={loadOlder}
          />
        }
        ListHeaderComponent={state.otherTyping ? <TypingBubble name={displayName} /> : null}
        onEndReached={() => {
          if (state.hasOlder && !state.olderError) {
            loadOlder();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        testID="chat-messages"
      />
    );
  }

  const composer =
    state.status === "unavailable" ? (
      state.messages.length > 0 ? (
        <View
          style={[styles.closed, { borderTopColor: theme.primitives.color.dot, paddingBottom: insets.bottom + 16 }]}
          testID="chat-closed"
        >
          <Icon color={theme.primitives.color.inkSoft} name="lock" size={20} />
          <Text color="muted" style={styles.closedText} variant="callout">
            Esta conversación ya no está disponible.
          </Text>
          <Button onPress={leaveToChats} size="sm" variant="secondary">
            Volver
          </Button>
        </View>
      ) : null
    ) : state.status === "error" ? null : (
      <Composer
        accessibilityLabel={`Mensaje para ${displayName}`}
        onChangeText={changeText}
        onSend={submit}
        placeholder="Escribe algo bonito…"
        ref={inputRef}
        value={text}
      />
    );

  return (
    <Screen
      contentStyle={styles.screenContent}
      edges={["top", "left", "right"]}
      header={
        <ChatHeader
          age={other?.age ?? null}
          loading={!name && (state.status === "loading" || matchStatus === "loading" || matchStatus === "idle")}
          name={name}
          onBack={goBack}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenProfile={openProfile}
          photoUrl={other?.photoUrl ?? null}
        />
      }
      padded={false}
      testID="chat-screen"
    >
      <View style={styles.body}>
        {body}
        {reconnecting ? (
          <View style={styles.reconnecting}>
            <Pill
              color="limonada"
              icon="refresh"
              label="Reconectando…"
              size="sm"
              style={styles.centeredPill}
              testID="chat-reconnecting"
            />
          </View>
        ) : null}
      </View>
      {composer}

      <ChatMenuSheet
        name={displayName}
        onClose={() => setMenuOpen(false)}
        onSafety={() => fromMenu(() => setSafetyOpen(true))}
        onUnmatch={() => fromMenu(() => setConfirmUnmatch(true))}
        onViewProfile={() => fromMenu(openProfile)}
        visible={menuOpen}
      />
      <ConfirmSheet
        cancelLabel="Mejor no"
        confirmLabel="Sí, deshacer"
        destructive
        error={unmatchError}
        loading={unmatching}
        message="Dejaréis de veros y esta conversación se cerrará para los dos. Sin dramas."
        onCancel={() => {
          setConfirmUnmatch(false);
          setUnmatchError(null);
        }}
        onConfirm={() => void confirmUnmatchNow()}
        testID="chat-unmatch-confirm"
        title={`¿Deshacer el match con ${displayName}?`}
        visible={confirmUnmatch}
      />
      {other ? (
        <SafetySheet
          displayName={displayName}
          onBlocked={leaveToChats}
          onClose={() => setSafetyOpen(false)}
          profileId={other.id}
          visible={safetyOpen}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0
  },
  body: {
    flex: 1
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  reconnecting: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none"
  },
  centeredPill: {
    alignSelf: "center"
  },
  closed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 2
  },
  closedText: {
    flex: 1
  }
});
