import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { Toaster } from "react-hot-toast";
import ClientOnly from "@/components/ClientOnly";
import TutorialOverlay from "@/components/TutorialOverlay";

export const metadata: Metadata = {
  title: "Inventory Management Dashboard",
  description: "ระบบจัดการคลังสินค้าและแจ้งปัญหา IT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body suppressHydrationWarning={true}>
        <ClientOnly>
          <AuthProvider>
            <TutorialProvider>
              {children}
              <TutorialOverlay />
            </TutorialProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#333',
                },
                success: {
                  style: {
                    background: '#d4edda',
                    color: '#155724',
                    border: '1px solid #c3e6cb',
                  },
                },
                error: {
                  style: {
                    background: '#f8d7da',
                    color: '#721c24',
                    border: '1px solid #f1b0b7',
                  },
                },
              }}
            />
          </AuthProvider>
        </ClientOnly>
      </body>
    </html>
  );
}
