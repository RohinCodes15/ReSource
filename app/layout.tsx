import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReSource — Make the most of what schools already have",
  description: "An intelligent resource-sharing platform for schools and community organizations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
