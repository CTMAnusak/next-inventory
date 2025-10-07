'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  phone?: string;
  userType: 'individual' | 'branch';
  office: string;
  isMainAdmin?: boolean;
  userRole?: 'user' | 'admin' | 'it_admin';
  pendingDeletion?: boolean; // เพิ่ม pendingDeletion status
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const checkAuth = async () => {
    try {
      // Skip auth check on login/register pages to avoid unnecessary 401 errors
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname === '/login' || pathname.startsWith('/auth/')) {
          setUser(null);
          setLoading(false);
          return;
        }
      }

      // ใช้ API auth check ที่แก้ไขแล้ว
      const response = await fetch('/api/auth/check', {
        credentials: 'include' // เพิ่ม credentials เพื่อส่ง cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.authenticated && data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            nickname: data.user.nickname,
            department: data.user.department,
            phone: data.user.phone,
            userType: data.user.userType,
            office: data.user.office,
            isMainAdmin: data.user.isMainAdmin || false,
            userRole: data.user.userRole || 'user',
            pendingDeletion: data.user.pendingDeletion || false // เพิ่ม pendingDeletion
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      // Silent fail - this is normal when not authenticated
      // Only log errors that are not 401 (unauthorized)
      if (error instanceof Error && !error.message.includes('401')) {
        console.error('Auth check error:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      setUser(data.user);
      router.push('/dashboard');
    } else {
      throw new Error(data.error);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/login', { method: 'DELETE' });
    } catch (error) {
      // Ignore errors
    }
    setUser(null);
    // ใช้ window.location.href แทน router.push เพื่อให้รีเฟรชหน้าเว็บ
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    } else {
      router.push('/login');
    }
  };

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, loading: true, login: async (email: string, password: string) => {}, logout: async () => {}, checkAuth: async () => {} }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
