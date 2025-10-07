'use client';

import { useEffect, useState } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import { X, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';

export default function TutorialOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTutorial, completeTutorial } = useTutorial();
  const [targetElements, setTargetElements] = useState<HTMLElement[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isActive || !steps[currentStep]) return;

    const findAndHighlightTarget = () => {
      const currentStepData = steps[currentStep];
      const targets = Array.isArray(currentStepData.target) ? currentStepData.target : [currentStepData.target];
      const foundElements: HTMLElement[] = [];
      
      targets.forEach(targetSelector => {
        const element = document.querySelector(targetSelector) as HTMLElement;
        if (element) {
          foundElements.push(element);
        }
      });
      
      if (foundElements.length > 0) {
        setTargetElements(foundElements);
        
        // Use the first element for scrolling
        const primaryTarget = foundElements[0];
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth < 640; // sm breakpoint
        
        // Fixed position: Center of viewport (using fixed positioning)
        const tooltipWidth = isMobile ? Math.min(viewportWidth - 20, 320) : viewportWidth >= 640 && viewportWidth < 1024 ? 340 : 380;
        
        // Position at center of viewport (fixed position)
        const top = 0;
        const left = viewportWidth / 2; // Center horizontally
        
        setTooltipPosition({ top, left });
        
        // Scroll primary target into view
        primaryTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // Delay to ensure DOM is ready
    const timeoutId = setTimeout(findAndHighlightTarget, 100);
    
    // Recalculate on window resize
    window.addEventListener('resize', findAndHighlightTarget);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', findAndHighlightTarget);
    };
  }, [isActive, currentStep, steps]);

  if (!isActive || !steps[currentStep] || targetElements.length === 0) return null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Create overlay with highlighted target elements
  const createOverlayMask = () => {
    if (targetElements.length === 0) return null;
    
    const isMobile = window.innerWidth < 640;
    const borderOffset = isMobile ? 3 : 4;
    const glowSize = isMobile ? 20 : 30;
    
    // Check if current step is dashboard (no highlighting needed)
    const isDashboardStep = currentStepData.id === 'dashboard';
    
    if (isDashboardStep) {
      // For dashboard step, only show dark overlay without highlighting
      return (
        <div className="fixed inset-0 pointer-events-none" />
      );
    }
    
    // If only one target, use the simple approach that works well
    if (targetElements.length === 1) {
      const targetElement = targetElements[0];
      const rect = targetElement.getBoundingClientRect();
      const top = rect.top - borderOffset;
      const left = rect.left - borderOffset;
      const width = rect.width + (borderOffset * 2);
      const height = rect.height + (borderOffset * 2);
      
      return (
        <>
          {/* Dark overlay */}
          <div
            className="fixed pointer-events-none"
            style={{
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.75)`,
              zIndex: 51,
            }}
          />
          
          {/* Bright content area with backdrop filter */}
          <div
            className="fixed rounded-xl pointer-events-none transition-all duration-300"
            style={{
              top: `${top}px`,
              left: `${left}px`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: 'transparent',
              WebkitBackdropFilter: 'brightness(2.0) contrast(1.25) saturate(1.4)',
              zIndex: 51,
            }}
          />
          
          {/* Yellow border on top */}
          <div
            className={`fixed rounded-xl shadow-2xl pointer-events-none transition-all duration-300 ${
              isMobile ? 'border-[4px]' : 'border-[5px]'
            } border-yellow-400`}
            style={{
              top: `${top}px`,
              left: `${left}px`,
              width: `${width}px`,
              height: `${height}px`,
              boxShadow: `0 0 ${glowSize}px rgba(251, 191, 36, 1)`,
              backgroundColor: 'transparent',
              zIndex: 52,
            }}
          />
        </>
      );
    }
    
    // For multiple targets, use simple fixed positioning
    return (
      <>
        {/* Dark overlay with full screen coverage */}
        <div className="fixed inset-0 pointer-events-none" />
        
        {/* Highlight borders for each target */}
        {targetElements.map((targetElement, index) => {
          const rect = targetElement.getBoundingClientRect();
          return (
            <div key={`highlight-wrapper-${index}`}>
              {/* Bright content area with backdrop filter */}
              <div
                className="fixed rounded-xl pointer-events-none transition-all duration-300"
                style={{
                  top: `${rect.top - borderOffset}px`,
                  left: `${rect.left - borderOffset}px`,
                  width: `${rect.width + (borderOffset * 2)}px`,
                  height: `${rect.height + (borderOffset * 2)}px`,
                  backgroundColor: 'transparent',
                  WebkitBackdropFilter: 'brightness(2.0) contrast(1.25) saturate(1.4)',
                  zIndex: 51,
                }}
              />
              
              {/* Yellow border on top */}
              <div
                className={`fixed rounded-xl shadow-2xl pointer-events-none transition-all duration-300 ${
                  isMobile ? 'border-[4px]' : 'border-[5px]'
                } border-yellow-400`}
                style={{
                  top: `${rect.top - borderOffset}px`,
                  left: `${rect.left - borderOffset}px`,
                  width: `${rect.width + (borderOffset * 2)}px`,
                  height: `${rect.height + (borderOffset * 2)}px`,
                  backgroundColor: 'transparent',
                  boxShadow: `0 0 ${glowSize}px rgba(251, 191, 36, 1)`,
                  zIndex: 52,
                }}
              />
            </div>
          );
        })}
      </>
    );
  };

  return (
    <>
      {/* Overlay with cutouts */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        {createOverlayMask()}
      </div>

      {/* Tooltip */}
      <div
        className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 pointer-events-auto w-[calc(100vw-20px)] sm:w-[340px] lg:w-[380px] max-w-[380px]"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(-50%, 15%)',
          zIndex: 60,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight pr-2">
            {currentStepData.title}
          </h3>
          <button
            onClick={completeTutorial}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="ปิด Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-3 sm:mb-4">
            {currentStepData.description}
          </p>

          {/* Progress */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex space-x-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-2">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex space-x-1 sm:space-x-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="flex items-center space-x-1 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="ย้อนกลับ"
                >
                  <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">ย้อนกลับ</span>
                </button>
              )}
              
              <button
                onClick={skipTutorial}
                className="flex items-center space-x-1 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="ข้าม Tutorial"
              >
                <SkipForward className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">ข้าม</span>
              </button>
            </div>

            <button
              onClick={nextStep}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
              aria-label={isLastStep ? 'เสร็จสิ้น' : 'ต่อไป'}
            >
              <span>{isLastStep ? 'เสร็จสิ้น' : 'ต่อไป'}</span>
              {!isLastStep && <ArrowRight className="w-4 h-4 flex-shrink-0" />}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
