import { useCallback, useState } from "react";
import { NotificationContext } from "../hooks/useNotifications";

let nextToastId = 0;

const TOAST_STYLES = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
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

      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg sm:p-6">
            <h2 className="text-lg font-bold text-gray-900">
              {confirmState.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{confirmState.message}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white shadow transition ${
                  confirmState.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
