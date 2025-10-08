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
  const [isLoading, setIsLoading] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
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
    setShowTooltip(true);
    // Position tooltip relative to the info button, but render via portal (body)
    const target = (event.currentTarget as HTMLElement) || infoButtonRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      // Place tooltip below the icon and center horizontally
      setTooltipPosition({
        top: Math.round(rect.bottom + 8),
        left: Math.round(rect.left + rect.width / 2)
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
    setShowTooltip(false);
  };

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
        title="ดูข้อมูลเพิ่มเติม"
      >
        ℹ️
      </button>
      
      {showTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="tooltip"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left, transform: 'translateX(-50%)' }}
        >
          <div className="tooltip-content">
            {isLoading ? (
              <div className="loading">กำลังโหลดข้อมูล...</div>
            ) : breakdown ? (
              <>
                <h4>สถานะอุปกรณ์:</h4>
                {breakdown.statusBreakdown && Object.entries(breakdown.statusBreakdown)
                  .map(([statusId, count]) => {
                    return (
                      <div key={statusId} className="breakdown-item">
                        • {getStatusName(statusId)}: {count} ชิ้น
                      </div>
                    );
                  })}
                
                <h4>สภาพอุปกรณ์:</h4>
                {breakdown.conditionBreakdown && Object.entries(breakdown.conditionBreakdown)
                  .map(([conditionId, count]) => {
                    return (
                      <div key={conditionId} className="breakdown-item">
                        • {getConditionName(conditionId)}: {count} ชิ้น
                      </div>
                    );
                  })}
                
                <h4>ประเภทอุปกรณ์:</h4>
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
