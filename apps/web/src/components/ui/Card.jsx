const PADDING_STYLES = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-4 sm:p-6",
};

const ROUNDING_STYLES = {
  md: "rounded-2xl",
  lg: "rounded-3xl",
};

export default function Card({
  as: Component = "div",
  padding = "md",
  rounded = "lg",
  bordered = true,
  className = "",
  children,
  ...rest
}) {
  return (
    <Component
      className={`bg-surface ${bordered ? "border border-border" : ""} shadow-sm ${
        ROUNDING_STYLES[rounded] || ROUNDING_STYLES.lg
      } ${PADDING_STYLES[padding] || PADDING_STYLES.md} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
