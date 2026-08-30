type AuthMessageProps = {
  message?: string;
  tone?: "error" | "success" | "info";
};

const toneClasses = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
};

export default function AuthMessage({
  message,
  tone = "error",
}: AuthMessageProps) {
  if (!message) return null;
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 text-sm leading-5 ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {message}
    </div>
  );
}
