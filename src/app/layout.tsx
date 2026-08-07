import type { Metadata } from "next";
import "./styles.css";
import { AuthGate } from "./auth-gate";

export const metadata: Metadata = { title: "Thought Space", description: "A quiet place to capture thoughts." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><AuthGate>{children}</AuthGate></body></html>;
}