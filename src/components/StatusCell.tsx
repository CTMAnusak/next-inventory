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
  // Auto-fetch breakdown whenever it's missing and we're not already loading
  useEffect(() => {
    if (!breakdown && onFetchBreakdown && !isLoading) {
      const p = onFetchBreakdown();
      // Support both Promise and void returns
      if (p && typeof (p as any).finally === 'function') {
        setIsLoading(true);
        (p as Promise<any>).finally(() => setIsLoading(false));
      }
    }
  }, [breakdown, onFetchBreakdown, isLoading]);

  // Fetch breakdown data when tooltip is shown
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
    
    if (!breakdown && onFetchBreakdown) {
      setIsLoading(true);
      try {
        await onFetchBreakdown();
      } catch (error) {
        console.error('Error fetching breakdown:', error);
      } finally {
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
            {isLoading ? (
              <div className="loading">กำลังโหลดข้อมูล...</div>
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
                <h4 className="text-green-600 mb-1">สถานะอุปกรณ์ (Admin Stock):</h4>
                {breakdown.adminStatusBreakdown && Object.keys(breakdown.adminStatusBreakdown).length > 0 ? (
                  Object.entries(breakdown.adminStatusBreakdown).map(([statusId, count]) => (
                    <div key={statusId} className="breakdown-item">
                      • {getStatusName(statusId)}: {count} ชิ้น
                    </div>
                  ))
                ) : (
                  <div className="breakdown-item text-gray-500">• ไม่มีอุปกรณ์ในคลัง</div>
                )}
                
                <h4 className="text-green-600 mb-1">สภาพอุปกรณ์ (Admin Stock):</h4>
                {breakdown.adminConditionBreakdown && Object.keys(breakdown.adminConditionBreakdown).length > 0 ? (
                  Object.entries(breakdown.adminConditionBreakdown).map(([conditionId, count]) => (
                    <div key={conditionId} className="breakdown-item">
                      • {getConditionName(conditionId)}: {count} ชิ้น
                    </div>
                  ))
                ) : (
                  <div className="breakdown-item text-gray-500">• ไม่มีอุปกรณ์ในคลัง</div>
                )}

                {breakdown.userStatusBreakdown && Object.keys(breakdown.userStatusBreakdown).length > 0 && (
                  <>
                    <h4 className="text-orange-500 mt-2 mb-1">สถานะอุปกรณ์ (User Owned):</h4>
                    {Object.entries(breakdown.userStatusBreakdown).map(([statusId, count]) => (
                      <div key={statusId} className="breakdown-item">
                        • {getStatusName(statusId)}: {count} ชิ้น
                      </div>
                    ))}
                  </>
                )}

                {breakdown.userConditionBreakdown && Object.keys(breakdown.userConditionBreakdown).length > 0 && (
                  <>
                    <h4 className="text-orange-500 mt-2 mb-1">สภาพอุปกรณ์ (User Owned):</h4>
                    {Object.entries(breakdown.userConditionBreakdown).map(([conditionId, count]) => (
                      <div key={conditionId} className="breakdown-item">
                        • {getConditionName(conditionId)}: {count} ชิ้น
                      </div>
                    ))}
                  </>
                )}
                
                <h4 className="text-blue-500 mt-2 mb-1">ประเภทอุปกรณ์:</h4>
                {breakdown.typeBreakdown && (
                  <>
                    {breakdown.typeBreakdown.withoutSN > 0 && (
                      <div className="breakdown-item">
                        • ไม่มี SN: {breakdown.typeBreakdown.withoutSN} ชิ้น
                      </div>
                    )}
                    {breakdown.typeBreakdown.withSN > 0 && (
                      <div className="breakdown-item">
                        • มี SN: {breakdown.typeBreakdown.withSN} ชิ้น
                      </div>
                    )}
                    {breakdown.typeBreakdown.withPhone > 0 && (
                      <div className="breakdown-item">
                        • เบอร์: {breakdown.typeBreakdown.withPhone} เบอร์
                      </div>
                    )}
                  </>
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
