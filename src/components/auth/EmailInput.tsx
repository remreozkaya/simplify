type EmailInputProps = {
  error?: string;
  defaultValue?: string;
};

export default function EmailInput({
  error,
  defaultValue,
}: EmailInputProps) {
  return (
    <div>
      <label
        htmlFor="email"
        className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100"
      >
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        inputMode="email"
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "email-error" : undefined}
        className={`h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-950 dark:text-white ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
            : "border-slate-300 focus:border-blue-600 focus:ring-blue-600/10 dark:border-slate-700"
        }`}
        placeholder="you@example.com"
      />
      {error ? (
        <p id="email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
