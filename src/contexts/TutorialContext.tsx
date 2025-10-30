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
    title: '🏠 ยินดีต้อนรับสู่ระบบจัดการคลังสินค้า',
    description: 'หน้านี้เป็นจุดเริ่มต้นของระบบ ที่คุณสามารถเข้าถึงเมนูต่างๆ และดูรายการอุปกรณ์ที่คุณมีอยู่ในปัจจุบัน รวมถึงสถานะการเบิก-คืนอุปกรณ์ต่างๆ',
    target: 'body',
    position: 'right'
  },
  {
    id: 'equipment-request',
    title: '📦 เบิกอุปกรณ์จากคลัง',
    description: 'ใช้เมนูนี้เมื่อคุณต้องการขออุปกรณ์จากคลังสินค้า เช่น คอมพิวเตอร์ เมาส์ คีย์บอร์ด หรืออุปกรณ์ IT อื่นๆ สำหรับใช้งาน โดยระบุรายละเอียดและสถานที่จัดส่ง',
    target: '[data-tutorial="equipment-request-card"]',
    position: 'bottom'
  },
  {
    id: 'equipment-return',
    title: '📤 คืนอุปกรณ์เข้าคลัง',
    description: 'เมื่อคุณใช้งานอุปกรณ์เสร็จแล้ว หรือไม่ต้องการใช้งานต่อ สามารถคืนอุปกรณ์เข้าคลังได้ที่นี่ เพื่อให้คนอื่นสามารถนำไปใช้งานต่อได้',
    target: '[data-tutorial="equipment-return-card"]',
    position: 'right'
  },
  {
    id: 'it-report',
    title: '⚠️ แจ้งปัญหาด้าน IT',
    description: 'เมื่อพบปัญหาการใช้งานคอมพิวเตอร์ อินเทอร์เน็ต ระบบงาน หรืออุปกรณ์ IT ชำรุด สามารถแจ้งปัญหาได้ที่นี่ ทีม IT Support จะได้รับแจ้งและดำเนินการแก้ไขให้',
    target: '[data-tutorial="it-report-card"]',
    position: 'right'
  },
  {
    id: 'it-tracking',
    title: '🔍 ติดตามสถานะงาน IT',
    description: 'หลังจากแจ้งปัญหา IT แล้ว คุณสามารถเข้ามาดูความคืบหน้าการแก้ไขปัญหา สถานะดำเนินงาน และผลการดำเนินงานของทีม IT Support ได้ที่นี่',
    target: '[data-tutorial="it-tracking-card"]',
    position: 'right'
  },
  {
    id: 'contact-it',
    title: '📞 ข้อมูลติดต่อทีม IT Support',
    description: 'หากต้องการติดต่อทีม IT Support โดยตรงเพื่อสอบถามข้อมูล ขอคำแนะนำ หรือแจ้งปัญหาเร่งด่วน สามารถดูข้อมูลการติดต่อ เบอร์โทร และช่องทางติดต่อได้ที่นี่',
    target: '[data-tutorial="contact-it-card"]',
    position: 'right'
  },
  {
    id: 'add-equipment',
    title: '➕ บันทึกอุปกรณ์ส่วนตัว',
    description: 'ใช้สำหรับบันทึกอุปกรณ์ที่คุณมีอยู่แล้ว เช่น โน้ตบุ๊คส่วนตัว เมาส์ที่ซื้อเอง เพื่อเก็บประวัติและจัดการอุปกรณ์ของคุณในระบบ ไม่ใช่การเบิกจากคลัง',
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
