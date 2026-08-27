"use client";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("simplify-theme", theme);
}

export default function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle ml-1 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <span className="theme-light-label" aria-hidden="true">◐</span>
      <span className="theme-dark-label hidden" aria-hidden="true">☀</span>
      <span className="theme-light-label hidden sm:inline">Dark</span>
      <span className="theme-dark-label hidden">Light</span>
    </button>
  );
}
