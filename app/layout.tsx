import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "First Wave — catch the next trend before it lands", description: "Qloo-powered cultural trend scout for US small businesses." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
