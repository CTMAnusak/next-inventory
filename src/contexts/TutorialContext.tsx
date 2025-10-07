'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRouter, usePathname } from 'next/navigation';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string | string[]; // CSS selector(s) - can be single or multiple
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: string; // Optional action to perform
}

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const tutorialSteps: TutorialStep[] = [
  {
    id: 'dashboard',
    title: '🏠 หน้า Dashboard',
    description: 'นี่คือหน้าหลักของระบบ คุณสามารถดูข้อมูลสรุปและอุปกรณ์ของคุณได้ที่นี่',
    target: 'body', // ไม่ไฮไลท์อะไรเฉพาะ แค่แสดง popup
    position: 'right'
  },
  {
    id: 'equipment-request',
    title: '📦 เบิกอุปกรณ์',
    description: 'คลิกที่นี่เพื่อทำการเบิกอุปกรณ์ต่างๆ ที่คุณต้องการใช้งาน',
    target: '[data-tutorial="equipment-request-card"]',
    position: 'bottom'
  },
  {
    id: 'equipment-return',
    title: '📤 คืนอุปกรณ์',
    description: 'เมื่อใช้งานเสร็จแล้ว คุณสามารถคืนอุปกรณ์ได้ที่เมนูนี้',
    target: '[data-tutorial="equipment-return-card"]',
    position: 'right'
  },
  {
    id: 'it-report',
    title: '⚠️ แจ้งปัญหา IT',
    description: 'หากพบปัญหาการใช้งานหรือต้องการความช่วยเหลือด้าน IT สามารถแจ้งได้ที่นี่',
    target: '[data-tutorial="it-report-card"]',
    position: 'right'
  },
  {
    id: 'it-tracking',
    title: '🔍 ติดตามสถานะ',
    description: 'หลังจากแจ้งปัญหา IT แล้ว คุณสามารถติดตามสถานะการดำเนินงานได้ที่นี่',
    target: '[data-tutorial="it-tracking-card"]',
    position: 'right'
  },
  {
    id: 'contact-it',
    title: '📞 ติดต่อทีม IT',
    description: 'หากต้องการติดต่อทีม IT โดยตรง สามารถคลิกที่เมนูนี้ได้',
    target: '[data-tutorial="contact-it-card"]',
    position: 'right'
  },
  {
    id: 'add-equipment',
    title: '➕ เพิ่มอุปกรณ์ของตัวเอง',
    description: 'คลิกปุ่มนี้เพื่อเพิ่มอุปกรณ์ส่วนตัวของคุณเข้าสู่ระบบ',
    target: '[data-tutorial="add-equipment"]',
    position: 'left'
  }
];

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  useEffect(() => {
    // Check if user has seen tutorial before
    const tutorialSeen = localStorage.getItem(`tutorial_seen_${user?.id}`);
    setHasSeenTutorial(!!tutorialSeen);

    // Auto-start tutorial for new users
    if (user && !tutorialSeen && !hasSeenTutorial) {
      setTimeout(() => {
        startTutorial();
      }, 2000); // Delay 2 seconds after login
    }
  }, [user, hasSeenTutorial]);

  const startTutorial = () => {
    // Check if we're already on dashboard
    if (pathname === '/dashboard') {
      setIsActive(true);
      setCurrentStep(0);
    } else {
      // Navigate to dashboard first, then start tutorial
      router.push('/dashboard');
      // Use a small delay to ensure navigation completes
      setTimeout(() => {
        setIsActive(true);
        setCurrentStep(0);
      }, 300);
    }
  };

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    setIsActive(false);
    setCurrentStep(0);
    if (user) {
      localStorage.setItem(`tutorial_seen_${user.id}`, 'true');
      setHasSeenTutorial(true);
    }
  };

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        steps: tutorialSteps,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        completeTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
