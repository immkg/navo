import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { useVoiceDictation } from "../../hooks/useVoiceDictation";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import PrioritySelect from "./PrioritySelect";
import { useCreateIntent } from "./hooks";
import { useSplitIntent } from "../ai/hooks";

// The primary way to add intents: one auto-growing text field. Enter (or the
// Add button) creates a single intent from the whole text; typing or
// dictating several goals and hitting "Split with AI" turns each one into
// its own intent instead of requiring a separate bulk-add mode.
export default function AddIntentPanel({ onOpenDetails }) {
  const { notify } = useNotifications();
  const createIntentMutation = useCreateIntent();
  const splitIntentMutation = useSplitIntent();

  const [text, setText] = useState("");
  const [splitDrafts, setSplitDrafts] = useState(null);
  const [isCreatingSplitDrafts, setIsCreatingSplitDrafts] = useState(false);
  const textareaRef = useRef(null);

  const voice = useVoiceDictation({
    onResult: (transcript) => {
      setText((previous) =>
        previous.trim() ? `${previous.trim()} ${transcript}` : transcript
      );
    },
    onError: (error) => {
      if (error === "not-allowed" || error === "permission-denied") {
        notify("Microphone access was denied.");
      } else if (error !== "no-speech" && error !== "aborted") {
        notify("Voice input failed. Please try typing instead.");
      }
    },
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = text.trim().replace(/\s+/g, " ");
    if (!title) return;

    try {
      await createIntentMutation.mutateAsync({ title });
      setText("");
      textareaRef.current?.focus();
    } catch (error) {
      console.error("Failed to create intent", error);
      notify("Failed to create intent. Make sure the API is running.");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const handleSplitWithAi = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      notify("Type or dictate what you want to do first.");
      return;
    }

    try {
      const { intents } = await splitIntentMutation.mutateAsync(trimmed);
      if (intents.length === 0) {
        notify("AI couldn't find a clear intent in that text.", {
          type: "info",
        });
        return;
      }
      setSplitDrafts(
        intents.map((intent) => ({ ...intent, included: true }))
      );
    } catch (error) {
      console.error("Failed to split intent with AI", error);
      notify(
        error.response?.data?.error || "Failed to split intent right now."
      );
    }
  };

  const updateSplitDraft = (index, patch) => {
    setSplitDrafts((previous) =>
      previous.map((draft, i) => (i === index ? { ...draft, ...patch } : draft))
    );
  };

  const includedSplitDrafts = (splitDrafts || []).filter(
    (draft) => draft.included
  );

  const handleCreateSplitDrafts = async () => {
    if (includedSplitDrafts.length === 0) return;

    setIsCreatingSplitDrafts(true);
    try {
      const results = await Promise.allSettled(
        includedSplitDrafts.map((draft) =>
          createIntentMutation.mutateAsync({
            title: draft.title,
            description: draft.description || undefined,
            priority: draft.priority,
          })
        )
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const succeededCount = results.length - failedCount;

      if (failedCount > 0) {
        notify(
          `Created ${succeededCount} intent(s), but ${failedCount} failed. Please try again.`
        );
      }
      setSplitDrafts(null);
      setText("");
    } finally {
      setIsCreatingSplitDrafts(false);
    }
  };

  const isSplitting = splitIntentMutation.isPending;
  const isVoiceActive = voice.isListening || voice.isProcessing;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to do? (e.g., Plan a vacation)"
            rows={1}
            className="scrollbar-hide block max-h-40 w-full resize-none overflow-y-auto rounded-xl border border-border bg-surface px-3 py-2.5 pr-11 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
          />
          {voice.isSupported && (
            <button
              type="button"
              onClick={() => (voice.isListening ? voice.stop() : voice.start())}
              aria-label={
                voice.isListening ? "Stop dictation" : "Start dictation"
              }
              title={voice.isListening ? "Stop dictation" : "Dictate"}
              className={`absolute right-1.5 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                isVoiceActive
                  ? "animate-pulse bg-danger/15 text-danger"
                  : "text-muted-foreground hover:bg-surface-alt hover:text-foreground"
              }`}
            >
              🎤
            </button>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          pill={false}
          className="shrink-0"
          disabled={createIntentMutation.isPending || !text.trim()}
        >
          Add
        </Button>
      </form>

      {isVoiceActive && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
          {voice.isProcessing ? "Transcribing…" : "Listening… speak now"}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSplitWithAi}
          disabled={isSplitting || !text.trim()}
          className="min-h-8 text-xs font-semibold text-accent hover:underline disabled:opacity-60"
        >
          {isSplitting ? "Thinking…" : "✨ Split with AI"}
        </button>
        <button
          type="button"
          onClick={() => onOpenDetails?.(text.trim())}
          className="min-h-8 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          + Add details (priority, dates, description)
        </button>
      </div>

      <Modal
        open={Boolean(splitDrafts)}
        onClose={() => setSplitDrafts(null)}
        title="Review split intents"
        footer={
          <>
            <Button
              variant="secondary"
              pill={false}
              onClick={() => setSplitDrafts(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              pill={false}
              onClick={handleCreateSplitDrafts}
              disabled={
                isCreatingSplitDrafts || includedSplitDrafts.length === 0
              }
            >
              {isCreatingSplitDrafts
                ? "Creating…"
                : `Create ${includedSplitDrafts.length} intent${includedSplitDrafts.length === 1 ? "" : "s"}`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {(splitDrafts || []).map((draft, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt p-3"
            >
              <input
                type="checkbox"
                checked={draft.included}
                onChange={(e) =>
                  updateSplitDraft(index, { included: e.target.checked })
                }
                aria-label={`Include ${draft.title}`}
                className="mt-2.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={draft.title}
                  onChange={(e) =>
                    updateSplitDraft(index, { title: e.target.value })
                  }
                  className="block w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/30"
                />
                {draft.description && (
                  <p className="text-xs text-muted-foreground">
                    {draft.description}
                  </p>
                )}
                <PrioritySelect
                  value={draft.priority}
                  onChange={(e) =>
                    updateSplitDraft(index, { priority: e.target.value })
                  }
                  className="rounded-full border-0 bg-surface px-2.5 py-1 text-xs font-semibold text-foreground outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
