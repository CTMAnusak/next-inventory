import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import ClientOnly from "@/components/ClientOnly";

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
            {children}
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
