import { bindAcademicStorage } from "@/lib/academic/storage";
import React from "react";
import { createRoot } from "react-dom/client";
import LocalizedMetadata from "@/components/LocalizedMetadata";
import LanguageToggle from "@/components/LanguageToggle";
import SignupForm from "@/components/auth/SignupForm";
import LoginForm from "@/components/auth/LoginForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import ProfilePage from "@/components/profile/ProfilePage";
import ProfileProvider from "@/components/profile/ProfileProvider";
import { EMPTY_PROFILE } from "@/lib/profile/types";
import "@/app/globals.css";

const mode = new URLSearchParams(location.search).get("mode");
const Form = mode === "profile" ? <ProfileProvider initialProfile={EMPTY_PROFILE}><ProfilePage email="fixture@example.invalid" canChangePassword deletionAvailable={false} /></ProfileProvider> : mode === "login" ? <LoginForm nextPath="/" /> : mode === "forgot" ? <ForgotPasswordForm /> : mode === "reset" ? <ResetPasswordForm /> : <SignupForm />;
// Isolated fixture storage; production requires account hydration.
bindAcademicStorage(window.localStorage);
createRoot(document.getElementById("root")!).render(<main className={mode === "profile" ? "mx-auto p-4" : "mx-auto max-w-md p-4"}><LocalizedMetadata /><LanguageToggle />{Form}</main>);
