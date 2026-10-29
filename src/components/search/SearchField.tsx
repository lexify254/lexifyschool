import { Search } from "lucide-react";
import styles from "./search-field.module.css";

type SearchFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
};

export default function SearchField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  maxLength,
  className,
}: SearchFieldProps) {
  return (
    <label className={[styles.control, className].filter(Boolean).join(" ")}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <Search className={styles.icon} size={18} aria-hidden="true" />
        <input
          className={styles.input}
          id={id}
          name={name}
          type="search"
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      </span>
    </label>
  );
}
