'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { 
  Package, 
  PackageOpen, 
  AlertTriangle, 
  Phone, 
  Settings,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  BookOpen,
  BarChart3,
  MapPin,
  Users,
  HelpCircle,
  Clock,
  Loader2
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: any;
  href?: string;
  onClick?: string;
  isAdmin?: boolean;
  submenu?: Array<{ title: string; href: string }>;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { startTutorial } = useTutorial();
  const [adminOpen, setAdminOpen] = useState(false);
  const [itReportOpen, setItReportOpen] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState<string | null>(null);

  // ตรวจสอบว่าควรเปิด submenu หรือไม่ตาม pathname
  useEffect(() => {
    // IT Report submenu paths
    const itReportPaths = ['/it-report', '/it-tracking', '/it-manual'];
    // Admin submenu paths
    const adminPaths = ['/admin/pending-summary', '/admin/inventory', '/admin/it-reports', '/admin/equipment-reports', '/admin/dashboard', '/admin/equipment-tracking', '/admin/users'];
    
    // เปิด IT Report submenu ถ้าอยู่ในหน้าที่เกี่ยวข้อง
    if (itReportPaths.some(path => pathname.startsWith(path))) {
      setItReportOpen(true);
      setAdminOpen(false);
    }
    // เปิด Admin submenu ถ้าอยู่ในหน้าที่เกี่ยวข้อง
    else if (adminPaths.some(path => pathname.startsWith(path))) {
      setAdminOpen(true);
      setItReportOpen(false);
    }
  }, [pathname]);

  // เช็คว่าผู้ใช้เป็น Admin หรือไม่
  const isAdmin = user && (
    user.isMainAdmin || 
    user.userRole === 'admin' || 
    user.userRole === 'it_admin' ||
    user.userRole === 'super_admin'
  );

  const handleAdminClick = () => {
    if (isAdmin) {
      setAdminOpen(!adminOpen);
    } else {
      alert('เมนูนี้ใช้ได้เฉพาะ Admin เท่านั้น');
    }
  };

  const handleMenuClick = (menuName: string) => {
    if (menuName === 'admin') {
      setAdminOpen(!adminOpen);
      setItReportOpen(false); // ปิด submenu อื่น
    } else if (menuName === 'it-report') {
      setItReportOpen(!itReportOpen);
      setAdminOpen(false); // ปิด submenu อื่น
    }
  };

  const handleMenuNavigation = async (href: string, menuTitle: string) => {
    setLoadingMenu(menuTitle);
    
    try {
      // ใช้ router.push แทน Link เพื่อให้สามารถจัดการ loading state ได้
      await router.push(href);
      
      // ✅ Force refresh data when navigating to ensure fresh data
      router.refresh();
      
      // ปิด sidebar ในมือถือเท่านั้น
      if (window.innerWidth < 1024) {
        onClose();
      }
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      // หยุด loading หลังจาก 500ms เพื่อให้ผู้ใช้เห็นอนิเมชั่น
      setTimeout(() => {
        setLoadingMenu(null);
      }, 500);
    }
  };

  // Prevent hydration mismatch - wait for auth to load
  if (loading) {
    return (
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
            <div className="ml-2 w-24 h-6 bg-gray-300 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      title: 'Dashboard',
      icon: BarChart3,
      href: '/dashboard',
    },
    {
      title: 'เบิกอุปกรณ์',
      icon: Package,
      href: '/equipment-request',
    },
    {
      title: 'คืนอุปกรณ์',
      icon: PackageOpen,
      href: '/equipment-return',
    },
    {
      title: 'แจ้งปัญหา IT',
      icon: AlertTriangle,
      submenu: [
        { title: 'แจ้งงาน IT', href: '/it-report' },
        { title: 'ติดตามสถานะ', href: '/it-tracking' },
        { title: 'คู่มือการใช้งาน', href: '/it-manual' },
      ],
    },
    {
      title: 'Admin',
      icon: Settings,
      isAdmin: true,
      submenu: [
        { title: 'Inventory', href: '/admin/inventory' },
        { title: 'สรุปรายงานรอทำ', href: '/admin/pending-summary' },
        { title: 'รายงานแจ้งงาน IT', href: '/admin/it-reports' },
        { title: 'รายงานเบิก/คืน', href: '/admin/equipment-reports' },
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'ติดตามอุปกรณ์', href: '/admin/equipment-tracking' },
        { title: 'User', href: '/admin/users' },
      ],
    },
    {
      title: 'ติดต่อทีม IT',
      icon: Phone,
      href: '/contact',
    },
    {
      title: 'การใช้งานเบื้องต้น',
      icon: HelpCircle,
      onClick: 'startTutorial',
    },
  ];

  const getIconForSubmenu = (title: string) => {
    switch (title) {
      case 'แจ้งงาน IT': return AlertTriangle;
      case 'ติดตามสถานะ': return Search;
      case 'คู่มือการใช้งาน': return BookOpen;
      case 'สรุปรายงานรอทำ': return Clock;
      case 'Inventory': return Package;
      case 'รายงานแจ้งงาน IT': return FileText;
      case 'รายงานเบิก/คืน': return FileText;
      case 'Dashboard': return BarChart3;
      case 'ติดตามอุปกรณ์': return MapPin;
      case 'User': return Users;
      default: return FileText;
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-80 sm:w-64 bg-gradient-to-b from-blue-600 to-blue-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-blue-500/30">
            <Link
              href="/dashboard"
              prefetch={true}
              className="block"
              onClick={() => {
                // ✅ Force refresh data when navigating
                setTimeout(() => router.refresh(), 100);
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
              aria-label="Go to dashboard"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    Inventory
                  </h1>
                  <p className="text-xs text-blue-200">
                    Management System
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto sidebar-scrollbar">
            {menuItems
              .filter(item => !item.isAdmin || isAdmin) // ซ่อนเมนู Admin จากผู้ใช้ทั่วไป
              .map((item, index) => (
              <div key={index}>
                {item.submenu ? (
                  <div>
                    <button
                      onClick={item.isAdmin ? handleAdminClick : () => handleMenuClick('it-report')}
                      className="w-full flex items-center justify-between px-4 py-3 text-white/90 rounded-xl hover:bg-white/10 hover:text-white hover:scale-105 transition-all duration-200 backdrop-blur-sm cursor-pointer"
                      data-tutorial={item.title === 'แจ้งปัญหา IT' ? 'it-report' : undefined}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
                        <span>{item.title}</span>
                      </div>
                      {(item.isAdmin ? adminOpen : itReportOpen) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {(item.isAdmin ? adminOpen : itReportOpen) && (
                      <div 
                        className="mt-2 space-y-1"
                        onClick={(e) => e.stopPropagation()} // หยุดการ bubble up
                      >
                        {item.submenu.map((subItem, subIndex) => {
                          const SubIcon = getIconForSubmenu(subItem.title);
                          
                          // Determine data-tutorial attribute for submenu items
                          let dataTutorial = '';
                          if (subItem.title === 'แจ้งงาน IT') dataTutorial = 'it-report';
                          else if (subItem.title === 'ติดตามสถานะ') dataTutorial = 'it-tracking';
                          
                          return (
                            <Link
                              key={subIndex}
                              href={subItem.href}
                              prefetch={true}
                              className={`flex items-center px-4 py-2 text-sm rounded-lg transition-all duration-200 ml-5 w-full ${
                                pathname === subItem.href
                                  ? 'bg-white/20 text-white shadow-md'
                                  : 'text-white/70 hover:bg-white/10 hover:text-white hover:scale-105'
                              }`}
                              onClick={() => {
                                // ✅ Force refresh data when navigating
                                setTimeout(() => router.refresh(), 100);
                                if (window.innerWidth < 1024) {
                                  onClose();
                                }
                              }}
                              data-tutorial={dataTutorial || undefined}
                              aria-current={pathname === subItem.href ? 'page' : undefined}
                            >
                              <SubIcon className="w-4 h-4 mr-3" />
                              <span>{subItem.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : item.onClick ? (
                  <button
                    onClick={() => {
                      if (item.onClick === 'startTutorial') {
                        startTutorial();
                      }
                      onClose();
                    }}
                    className="flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white hover:scale-105 cursor-pointer w-full"
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.title}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    prefetch={true}
                    className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 w-full ${
                      pathname === item.href
                        ? 'bg-white/20 text-white shadow-lg scale-105'
                        : 'text-white/90 hover:bg-white/10 hover:text-white hover:scale-105'
                    }`}
                    onClick={() => {
                      // ✅ Force refresh data when navigating
                      setTimeout(() => router.refresh(), 100);
                      if (window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
                    data-tutorial={
                      item.href === '/contact' ? 'contact' : 
                      item.href === '/dashboard' ? 'dashboard-menu' : 
                      undefined
                    }
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.title}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>


    </>
  );
}
