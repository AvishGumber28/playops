import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayOps",
  description: "Smart Campus Sports & Tournament Management System",
};

// Applies a previously-chosen light theme before first paint, so there's
// no flash of the default dark/green theme for a visitor who picked light
// last time - ThemeProvider's own effect (lib/theme-context.tsx) then
// just keeps state in sync with whatever this already set.
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('playops-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
