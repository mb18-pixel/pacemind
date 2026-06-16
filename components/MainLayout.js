"use client";

import { usePathname } from "next/navigation";

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const isAuthPage = ["/login", "/register", "/consent", "/onboarding"].includes(
    pathname
  );
  const isChatPage = pathname === "/chat";

  if (isLandingPage) {
    return <main className="w-full flex-1">{children}</main>;
  }

  return (
    <main
      className={`page-container mx-auto w-full max-w-5xl flex-1 ${
        isChatPage ? "chat-page-main" : ""
      } ${!isAuthPage ? "has-bottom-nav" : ""}`}
    >
      {children}
    </main>
  );
}
