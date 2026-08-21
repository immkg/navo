const TONE_STYLES = {
  neutral: "bg-surface-alt text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  danger: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  accent: "bg-accent/10 text-accent",
};

export default function Badge({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        TONE_STYLES[tone] || TONE_STYLES.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
