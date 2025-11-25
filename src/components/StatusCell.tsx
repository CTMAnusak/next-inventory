'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface StatusCellProps {
  item: {
    _id: string;
    itemName: string;
    categoryId: string;
    statusMain?: string;
  };
  breakdown?: {
    statusBreakdown?: Record<string, number>;
    conditionBreakdown?: Record<string, number>;
    adminStatusBreakdown?: Record<string, number>;
    adminConditionBreakdown?: Record<string, number>;
    userStatusBreakdown?: Record<string, number>;
    userConditionBreakdown?: Record<string, number>;
    typeBreakdown?: {
      withoutSN: number;
      withSN: number;
      withPhone: number;
    };
    adminTypeBreakdown?: {
      withoutSN: number;
      withSN: number;
      withPhone: number;
    };
    userTypeBreakdown?: {
      withoutSN: number;
      withSN: number;
      withPhone: number;
    };
    // 🆕 Grouped breakdowns (status + condition + type combined)
    adminGroupedBreakdown?: Array<{
      statusId: string;
      conditionId: string;
      type: 'withoutSN' | 'withSN' | 'withPhone';
      count: number;
    }>;
    userGroupedBreakdown?: Array<{
      statusId: string;
      conditionId: string;
      type: 'withoutSN' | 'withSN' | 'withPhone';
      count: number;
    }>;
  };
  onFetchBreakdown?: () => Promise<any> | void;
  statusConfigs?: Array<{ id: string; name: string; }>;
  conditionConfigs?: Array<{ id: string; name: string; }>;
}

const StatusCell: React.FC<StatusCellProps> = ({ 
  item, 
  breakdown, 
  onFetchBreakdown,
  statusConfigs = [],
  conditionConfigs = []
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isPinned, setIsPinned] = useState(false); // โหมดค้างเมื่อคลิก
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriedFetch, setHasTriedFetch] = useState(false); // ป้องกันการ fetch ซ้ำ
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // สำหรับ timeout loading
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; transform?: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Helper: reposition tooltip to stay within viewport and flip if needed
  const repositionTooltip = () => {
    const target = infoButtonRef.current;
    const el = tooltipRef.current;
    if (!target || !el) return;

    const anchor = target.getBoundingClientRect();
    const tooltipRect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = Math.round(anchor.bottom + 8);
    let left = Math.round(anchor.left + anchor.width / 2);
    let transform: string | undefined = 'translateX(-50%)';

    // Prefer top if bottom space insufficient
    if (tooltipRect.height + 8 > viewportH - anchor.bottom) {
      top = Math.round(anchor.top - tooltipRect.height - 8);
    }
    // If still out of top boundary, push down to fit
    if (top < 8) {
      top = Math.max(8, Math.round(anchor.bottom + 8));
    }
    if (top + tooltipRect.height > viewportH - 8) {
      top = Math.max(8, viewportH - 8 - tooltipRect.height);
    }

    // Clamp horizontally
    const halfWidth = Math.round(tooltipRect.width / 2);
    const minLeft = 8 + halfWidth;
    const maxLeft = viewportW - 8 - halfWidth;
    if (left < minLeft) {
      left = 8;
      transform = undefined;
    } else if (left > maxLeft) {
      left = viewportW - 8 - tooltipRect.width;
      transform = undefined;
    }

    setTooltipPosition({ top, left, transform });
  };
  // Auto-fetch breakdown whenever it's missing - โหลดล่วงหน้าเมื่อ component mount
  useEffect(() => {
    // ถ้ามี breakdown แล้ว ให้หยุด loading
    if (breakdown) {
      setIsLoading(false);
      setError(null);
      // Clear timeout ถ้ามี
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      return;
    }
    
    // ถ้าไม่มี onFetchBreakdown ให้ไม่ fetch
    if (!onFetchBreakdown) {
      return;
    }
    
    // ถ้าเคย fetch แล้ว และยังไม่มี breakdown และไม่มี error ให้ไม่ fetch อีก
    // แต่ถ้ามี error ให้ reset และ fetch ใหม่ (เหมือนปุ่ม "ลองอีกครั้ง")
    if (hasTriedFetch && !error) {
      return;
    }
    
    console.log(`🚀 Starting auto-fetch for ${item.itemName} (hasTriedFetch: ${hasTriedFetch}, breakdown: ${!!breakdown}, error: ${!!error})`);
    
    // เริ่ม fetch ทันทีเมื่อ component mount (ไม่ต้องรอ hover)
    // Reset state เหมือนปุ่ม "ลองอีกครั้ง"
    setIsLoading(true);
    setError(null);
    setHasTriedFetch(true); // ป้องกันการ fetch ซ้ำ
    
    // เรียก fetch ทันทีโดยไม่ต้อง debounce เพื่อให้โหลดเร็วขึ้น
    // ใช้ requestAnimationFrame เพื่อให้ไม่ block UI แต่ยังเร็ว
    const rafId = requestAnimationFrame(() => {
      console.log(`📞 Calling onFetchBreakdown for ${item.itemName}`);
      const p = onFetchBreakdown();
      // Support both Promise and void returns
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<any>)
          .then((result) => {
            // ถ้า result เป็น error object ให้แสดง error ทันที
            if (result && typeof result === 'object' && 'error' in result && result.error) {
              setIsLoading(false);
              const errorMsg = (result as any).message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
              setError(errorMsg);
              return;
            }
            
            // ถ้าได้ result ที่ถูกต้อง ไม่ต้องรออะไร เพราะ useEffect ที่ตรวจสอบ breakdown จะทำงานทันที
            // เมื่อ breakdown prop ถูก update useEffect จะ clear loading state อัตโนมัติ
            if (result && !result.error) {
              // ไม่ต้องทำอะไร เพราะ useEffect ที่ตรวจสอบ breakdown จะทำงานเมื่อ breakdown ถูก update
              // แต่ถ้ายังไม่มี breakdown หลังจาก 5 วินาที ให้แสดง error (fallback)
              const timeoutId = setTimeout(() => {
                setIsLoading(prevLoading => {
                  if (prevLoading && !breakdown) {
                    console.warn(`⚠️ Breakdown data fetched but not received via props for ${item.itemName} after 5 seconds`);
                    setError('ไม่สามารถโหลดข้อมูลได้');
                    return false;
                  }
                  return prevLoading;
                });
              }, 5000); // ลดจาก 22 วินาทีเป็น 5 วินาที
              
              loadingTimeoutRef.current = timeoutId;
            } else {
              // ถ้า result เป็น null หรือ undefined
              setIsLoading(false);
              setError('ไม่สามารถโหลดข้อมูลได้');
            }
          })
          .catch((error) => {
            console.error('❌ Auto-fetch breakdown error:', error);
            setError('ไม่สามารถโหลดข้อมูลได้');
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });
    
    return () => {
      cancelAnimationFrame(rafId);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [breakdown, onFetchBreakdown, error, hasTriedFetch, item.itemName]); // เพิ่ม item.itemName เพื่อให้ trigger เมื่อ component เปลี่ยน
  
  // ใช้ ref เพื่อเก็บค่า breakdown ก่อนหน้า
  const prevBreakdownRef = useRef(breakdown);
  
  // ตรวจสอบว่า breakdown ถูก update แล้วหรือไม่ และ reset state เมื่อ breakdown ถูก clear
  useEffect(() => {
    const prevBreakdown = prevBreakdownRef.current;
    
    if (breakdown) {
      // มี breakdown แล้ว
      setIsLoading(false);
      setError(null);
      // Clear timeout ถ้ามี
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    } else if (prevBreakdown && !breakdown) {
      // breakdown เปลี่ยนจากมีเป็นไม่มี (เช่น เมื่อรีเฟรชหน้าเว็บ)
      console.log(`🔄 Breakdown cleared for ${item.itemName} (was: ${!!prevBreakdown}, now: ${!!breakdown}), resetting state to allow refetch`);
      setHasTriedFetch(false);
      setError(null);
      setIsLoading(false);
      // Clear timeout ถ้ามี
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
    
    // อัปเดต ref ทุกครั้งที่ breakdown เปลี่ยน
    prevBreakdownRef.current = breakdown;
  }, [breakdown, item.itemName]);
  
  // ตรวจสอบว่าเมื่อ hasTriedFetch เปลี่ยนเป็น false ให้ fetch ใหม่
  useEffect(() => {
    // ถ้า hasTriedFetch เปลี่ยนเป็น false และยังไม่มี breakdown และไม่มี error
    // ให้ trigger useEffect หลักเพื่อ fetch ใหม่
    if (!hasTriedFetch && !breakdown && !error && onFetchBreakdown) {
      console.log(`🔄 hasTriedFetch reset to false for ${item.itemName}, will trigger refetch`);
    }
  }, [hasTriedFetch, breakdown, error, onFetchBreakdown, item.itemName]);
  
  // เพิ่ม timeout สำหรับ loading เพื่อไม่ให้แสดง "กำลังโหลด..." นานเกินไป
  useEffect(() => {
    if (isLoading && !breakdown && !error) {
      const timeoutId = setTimeout(() => {
        if (isLoading && !breakdown && !error) {
          console.warn(`⚠️ Loading timeout for ${item.itemName} - clearing loading state after 25 seconds`);
          setIsLoading(false);
          setError('ไม่สามารถโหลดข้อมูลได้ (Timeout)');
        }
      }, 25000); // เพิ่มเป็น 25 วินาที timeout เพื่อให้มีเวลาโหลดข้อมูล (มากกว่า API timeout 20 วินาที)
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, breakdown, error, item.itemName]);

  // Show tooltip when hover - ข้อมูลควรจะโหลดไว้แล้วจาก useEffect
  const handleMouseEnter = async (event: React.MouseEvent) => {
    if (isPinned) return; // ถ้าคลิกค้างอยู่ ไม่ต้องตอบสนอง hover
    setShowTooltip(true);
    // Position tooltip relative to the info button, but render via portal (body)
    const target = (event.currentTarget as HTMLElement) || infoButtonRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      // Initial placement: bottom-center
      setTooltipPosition({
        top: Math.round(rect.bottom + 8),
        left: Math.round(rect.left + rect.width / 2),
        transform: 'translateX(-50%)'
      });

      // After paint, correct position. Do 2 frames to catch size changes.
      requestAnimationFrame(() => {
        repositionTooltip();
        requestAnimationFrame(repositionTooltip);
      });
    }
    
    // ถ้ายังไม่มี breakdown และยังไม่เคย fetch ให้ fetch ทันที (fallback)
    if (!breakdown && onFetchBreakdown && !error && !hasTriedFetch) {
      setIsLoading(true);
      setError(null);
      setHasTriedFetch(true);
      try {
        const result = await onFetchBreakdown();
        setIsLoading(false);
        if (!result) {
          setError('ไม่สามารถโหลดข้อมูลได้');
          console.warn('⚠️ Breakdown fetch returned null/undefined');
        } else if (result && typeof result === 'object' && 'error' in result && result.error) {
          // ถ้า result เป็น error object (เช่น 500 error)
          const errorMsg = (result as any).message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
          setError(errorMsg);
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        setError(errorMessage);
        console.error('❌ Error fetching breakdown in StatusCell:', error);
        setIsLoading(false);
      }
    }
  };

  const handleMouseLeave = () => {
    if (isPinned) return; // โหมดค้าง: ไม่ปิดเมื่อออกจาก hover
    setShowTooltip(false);
  };

  // Toggle ด้วยการคลิกไอคอน
  const handleIconClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isPinned) {
      setIsPinned(false);
      setShowTooltip(false);
      return;
    }
    setIsPinned(true);
    // เปิดและจัดตำแหน่งเหมือน hover
    void handleMouseEnter(event);
  };

  // Reposition on resize/scroll while visible
  useEffect(() => {
    if (!showTooltip) return;
    const onResize = () => repositionTooltip();
    const onScroll = () => repositionTooltip();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    // Re-run shortly after to adapt async content changes
    const t1 = setTimeout(repositionTooltip, 50);
    const t2 = setTimeout(repositionTooltip, 150);
    // Close on outside click when pinned
    const onDocumentMouseDown = (e: MouseEvent) => {
      if (!isPinned) return;
      const tooltipEl = tooltipRef.current;
      const btnEl = infoButtonRef.current;
      const target = e.target as Node;
      if (tooltipEl?.contains(target) || btnEl?.contains(target)) return;
      setIsPinned(false);
      setShowTooltip(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDocumentMouseDown, true);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showTooltip, isPinned]);

  // Get status names from database configs
  const getStatusName = (statusId: string) => {
    const statusConfig = statusConfigs.find(config => config.id === statusId);
    return statusConfig?.name || statusId;
  };

  // Get condition names from database configs
  const getConditionName = (conditionId: string) => {
    const conditionConfig = conditionConfigs.find(config => config.id === conditionId);
    return conditionConfig?.name || conditionId;
  };

  // Get type display name
  const getTypeDisplayName = (type: 'withoutSN' | 'withSN' | 'withPhone') => {
    switch (type) {
      case 'withoutSN':
        return 'ไม่มี SN';
      case 'withSN':
        return 'มี SN';
      case 'withPhone':
        return 'เบอร์';
      default:
        return type;
    }
  };

  // Get type unit (ชิ้น or เบอร์)
  const getTypeUnit = (type: 'withoutSN' | 'withSN' | 'withPhone') => {
    return type === 'withPhone' ? 'เบอร์' : 'ชิ้น';
  };

  // คำนวณ statusMain จากข้อมูล condition breakdown
  const calculateStatusMain = () => {
    // If breakdown is cleared (undefined), force refresh by returning loading state
    if (!breakdown) {
      return 'กำลังโหลด...';
    }
    
    if (!breakdown?.conditionBreakdown) {
      return item.statusMain || 'กำลังโหลด...';
    }

    const conditionData = breakdown.conditionBreakdown;
    const totalItems = Object.values(conditionData).reduce((sum, count) => sum + count, 0);
    
    if (totalItems === 0) {
      return 'ไม่มีข้อมูล';
    }

    // หาอุปกรณ์ที่ใช้งานได้
    const usableConditionId = conditionConfigs.find(config => config.name === 'ใช้งานได้')?.id;
    const usableCount = usableConditionId ? (conditionData[usableConditionId] || 0) : 0;
    
    if (usableCount > 0) {
      return 'ใช้งานได้';
    }

    // หากไม่มีอุปกรณ์ที่ใช้งานได้ ให้หาสภาพที่ส่วนใหญ่เป็น
    const sortedConditions = Object.entries(conditionData)
      .sort(([,a], [,b]) => b - a);
    
    if (sortedConditions.length > 0) {
      const [mostCommonConditionId] = sortedConditions[0];
      const conditionName = conditionConfigs.find(config => config.id === mostCommonConditionId)?.name;
      return conditionName || 'ไม่ทราบสภาพ';
    }

    return 'ไม่ทราบสภาพ';
  };

  return (
    <div className="status-cell">
      <span className="status-main">
        {calculateStatusMain()}
      </span>
      <button 
        className="info-button"
        ref={infoButtonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleIconClick}
        aria-expanded={showTooltip}
        title="ดูข้อมูลเพิ่มเติม"
      >
        ℹ️
      </button>
      
      {showTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="tooltip"
          ref={tooltipRef}
          style={{ top: tooltipPosition.top, left: tooltipPosition.left, transform: tooltipPosition.transform }}
        >
          <div className="tooltip-content">
            {isLoading && !breakdown && !error ? (
              <div className="loading">
                กำลังโหลดข้อมูล...
                <br />
                <small style={{ fontSize: '10px', color: '#666' }}>กรุณารอสักครู่...</small>
              </div>
            ) : error ? (
              <div className="error" style={{ color: '#dc2626', padding: '8px' }}>
                ❌ {error}
                <br />
                <button 
                  onClick={() => {
                    // Reset state ทั้งหมดเพื่อให้ fetch ใหม่
                    setError(null);
                    setHasTriedFetch(false);
                    setIsLoading(true);
                    
                    if (onFetchBreakdown) {
                      const p = onFetchBreakdown();
                      // Support both Promise and void returns
                      if (p && typeof (p as any).then === 'function') {
                        (p as Promise<any>)
                          .then((result) => {
                            // ไม่ต้องรออะไร เพราะ useEffect ที่ตรวจสอบ breakdown จะทำงานทันที
                            // เมื่อ breakdown prop ถูก update useEffect จะ clear loading state อัตโนมัติ
                            if (result && typeof result === 'object' && 'error' in result && result.error) {
                              setIsLoading(false);
                              const errorMsg = (result as any).message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
                              setError(errorMsg);
                            } else if (!result) {
                              setIsLoading(false);
                              setError('ไม่สามารถโหลดข้อมูลได้');
                            }
                            // ถ้าได้ result ที่ถูกต้อง ไม่ต้องทำอะไร เพราะ useEffect จะจัดการ
                          })
                          .catch((err) => {
                            setError('ไม่สามารถโหลดข้อมูลได้');
                            setIsLoading(false);
                          });
                      } else {
                        setIsLoading(false);
                      }
                    }
                  }}
                  style={{ 
                    marginTop: '8px', 
                    padding: '4px 8px', 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ลองอีกครั้ง
                </button>
              </div>
            ) : breakdown ? (
              <>
                <div className="breakdown-note" style={{ 
                  backgroundColor: '#E3F2FD', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#1565C0'
                }}>
                  💡 <strong>จำนวนที่เบิกได้</strong> = อุปกรณ์ที่อยู่ใน Admin Stock + สถานะ "มี" + สภาพ "ใช้งานได้"
                </div>
                
                {/* 🆕 Admin Stock - Grouped Display */}
                <h4 className="text-green-600 mb-1">สถานะ, สภาพ, ประเภทอุปกรณ์ (Admin Stock):</h4>
                {breakdown.adminGroupedBreakdown && breakdown.adminGroupedBreakdown.length > 0 ? (
                  breakdown.adminGroupedBreakdown.map((group, index) => (
                    <div key={`admin-${index}-${group.statusId}-${group.conditionId}-${group.type}`} className="breakdown-item">
                      • {getStatusName(group.statusId)}: {group.count} ชิ้น, {getConditionName(group.conditionId)}: {group.count} ชิ้น, ประเภท "{getTypeDisplayName(group.type)}": {group.count} {getTypeUnit(group.type)}
                    </div>
                  ))
                ) : (
                  <div className="breakdown-item text-gray-500">• ไม่มีอุปกรณ์</div>
                )}

                {/* 🆕 User Owned - Grouped Display */}
                <h4 className="text-orange-500 mt-2 mb-1">สถานะ, สภาพ, ประเภทอุปกรณ์ (User Owned):</h4>
                {breakdown.userGroupedBreakdown && breakdown.userGroupedBreakdown.length > 0 ? (
                  breakdown.userGroupedBreakdown.map((group, index) => (
                    <div key={`user-${index}-${group.statusId}-${group.conditionId}-${group.type}`} className="breakdown-item">
                      • {getStatusName(group.statusId)}: {group.count} ชิ้น, {getConditionName(group.conditionId)}: {group.count} ชิ้น, ประเภท "{getTypeDisplayName(group.type)}": {group.count} {getTypeUnit(group.type)}
                    </div>
                  ))
                ) : (
                  <div className="breakdown-item text-gray-500">• ไม่มีอุปกรณ์</div>
                )}
              </>
            ) : (
              <div className="error">ไม่สามารถโหลดข้อมูลได้</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StatusCell;
