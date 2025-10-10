'use client';

import { useEffect, useState } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import { X, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';

export default function TutorialOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTutorial, completeTutorial } = useTutorial();
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isActive || !steps[currentStep]) return;

    const calculateCenterPosition = () => {
      // Always center the tooltip
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const tooltipHeight = window.innerWidth < 640 ? 200 : 250;
      
      setTooltipPosition({ 
        top: Math.max(50, (viewportHeight - tooltipHeight) / 2),
        left: viewportWidth / 2
      });
    };

    // Calculate position immediately
    calculateCenterPosition();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateCenterPosition);
    
    return () => {
      window.removeEventListener('resize', calculateCenterPosition);
    };
  }, [isActive, currentStep, steps]);

  if (!isActive || !steps[currentStep]) return null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 pointer-events-none" />

      {/* Tooltip - Always centered */}
      <div
        className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 pointer-events-auto w-[calc(100vw-20px)] sm:w-[340px] lg:w-[380px] max-w-[380px]"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: 'translateX(-50%)',
          zIndex: 60,
          maxHeight: '80vh',
          overflow: 'auto'
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
