const VARIANT_STYLES = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-alt",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
  "danger-outline":
    "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  accent: "bg-accent text-accent-foreground hover:bg-accent-hover",
  "accent-outline":
    "border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
  ghost: "text-muted-foreground hover:bg-surface-alt hover:text-foreground",
};

const SIZE_STYLES = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export default function Button({
  variant = "secondary",
  size = "md",
  full = false,
  square = false,
  pill = true,
  className = "",
  children,
  ...rest
}) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.secondary;
  const sizeStyle = square ? "h-9 w-9" : SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        pill ? "rounded-full" : "rounded-xl"
      } ${variantStyle} ${sizeStyle} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
