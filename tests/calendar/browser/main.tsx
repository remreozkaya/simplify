import React from "react";
import { createRoot } from "react-dom/client";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import ProfileProvider from "@/components/profile/ProfileProvider";
import { EMPTY_PROFILE } from "@/lib/profile/types";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <ProfileProvider initialProfile={EMPTY_PROFILE}>
    <main className="mx-auto max-w-7xl p-4"><WeeklyCalendar /></main>
  </ProfileProvider>,
);
