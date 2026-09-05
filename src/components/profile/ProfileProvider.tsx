"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { UserProfile } from "@/lib/profile/types";

type ProfileContextValue = {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export default function ProfileProvider({ initialProfile, children }: { initialProfile: UserProfile; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initialProfile);
  const value = useMemo(() => ({ profile, setProfile }), [profile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within ProfileProvider.");
  return context;
}
