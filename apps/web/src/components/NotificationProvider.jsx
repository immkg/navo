import { useCallback, useState } from "react";
import { NotificationContext } from "../hooks/useNotifications";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

let nextToastId = 0;

const TOAST_STYLES = {
  error: "border-danger/30 bg-danger/10 text-danger",
  success: "border-success/30 bg-success/10 text-success",
  info: "border-primary/30 bg-primary/10 text-primary",
};

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismissToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, options = {}) => {
      const id = ++nextToastId;
      const duration = options.duration ?? 5000;

      setToasts((previous) => [
        ...previous,
        { id, message, type: options.type || "error" },
      ]);

      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast]
  );

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        title: options.title || "Are you sure?",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        danger: options.danger ?? false,
        resolve,
      });
    });
  }, []);

  const resolveConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}

      <div
        className="fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end sm:p-0"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg sm:w-96 ${TOAST_STYLES[toast.type] || TOAST_STYLES.error}`}
          >
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-1 text-sm font-semibold opacity-70 transition hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(confirmState)}
        onClose={() => resolveConfirm(false)}
        title={confirmState?.title}
        closeOnBackdrop={false}
        footer={
          confirmState && (
            <>
              <Button
                variant="secondary"
                pill={false}
                onClick={() => resolveConfirm(false)}
              >
                {confirmState.cancelLabel}
              </Button>
              <Button
                variant={confirmState.danger ? "danger" : "primary"}
                pill={false}
                onClick={() => resolveConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </>
          )
        }
      >
        {confirmState && (
          <p className="text-sm text-muted-foreground">
            {confirmState.message}
          </p>
        )}
      </Modal>
    </NotificationContext.Provider>
  );
}
