import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth";
import NavBar from "../components/NavBar";

export const metadata: Metadata = {
  title: "Fantasy Cycling",
  description: "Fantasy Cycling — pick your riders, chase the yellow jersey.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased dark:bg-gray-950">
        <AuthProvider>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
