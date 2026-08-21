import { PRIORITY_OPTIONS } from "./utils";

export default function PrioritySelect({ className, ...rest }) {
  return (
    <select className={className} {...rest}>
      {PRIORITY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
