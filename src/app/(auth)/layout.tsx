import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simplify · Account",
  description: "Sign in to Simplify to access your university planning tools.",
};

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
