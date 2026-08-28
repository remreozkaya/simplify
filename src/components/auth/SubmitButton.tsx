"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
};

export default function SubmitButton({
  label,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
    >
      {pending ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
          aria-hidden="true"
        />
      ) : null}
      {pending ? pendingLabel : label}
    </button>
  );
}
