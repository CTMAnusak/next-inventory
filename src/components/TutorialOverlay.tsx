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
        
        // Use the first element for tooltip positioning
        const primaryTarget = foundElements[0];
        const rect = primaryTarget.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        let top = 0;
        let left = 0;
        
        switch (currentStepData.position) {
          case 'right':
            top = rect.top + scrollTop + (rect.height / 2) - 100;
            left = rect.right + scrollLeft + 20;
            break;
          case 'left':
            top = rect.top + scrollTop + (rect.height / 2) - 100;
            left = rect.left + scrollLeft - 320;
            break;
          case 'top':
            top = rect.top + scrollTop - 220;
            left = rect.left + scrollLeft + (rect.width / 2) - 150;
            break;
          case 'bottom':
            top = rect.bottom + scrollTop + 20;
            left = rect.left + scrollLeft + (rect.width / 2) - 150;
            break;
        }
        
        // Ensure tooltip stays within viewport
        const maxLeft = window.innerWidth - 320;
        const maxTop = window.innerHeight - 200;
        
        left = Math.max(20, Math.min(left, maxLeft));
        top = Math.max(20, Math.min(top, maxTop));
        
        setTooltipPosition({ top, left });
        
        // Scroll primary target into view
        primaryTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // Delay to ensure DOM is ready
    setTimeout(findAndHighlightTarget, 100);
  }, [isActive, currentStep, steps]);

  if (!isActive || !steps[currentStep] || targetElements.length === 0) return null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Create a single overlay with multiple cutouts using SVG mask
  const createOverlayMask = () => {
    if (targetElements.length === 0) return null;
    
    // If only one target, use the simple approach that works well
    if (targetElements.length === 1) {
      const targetElement = targetElements[0];
      const rect = targetElement.getBoundingClientRect();
      const top = rect.top + window.pageYOffset - 4;
      const left = rect.left + window.pageXOffset - 4;
      const width = rect.width + 8;
      const height = rect.height + 8;
      
      return (
        <div
          className="absolute border-4 border-yellow-400 rounded-lg shadow-2xl pointer-events-auto"
          style={{
            top,
            left,
            width,
            height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 193, 7, 0.9)',
            backgroundColor: 'transparent',
          }}
        />
      );
    }
    
    // For multiple targets, use SVG mask approach
    const maskId = `tutorial-mask-${Date.now()}`;
    
    return (
      <>
        {/* SVG mask definition */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
          <defs>
            <mask id={maskId}>
              {/* White background allows the overlay to show */}
              <rect width="100%" height="100%" fill="white" />
              {/* Black rectangles create holes (transparent areas) */}
              {targetElements.map((targetElement, index) => {
                const rect = targetElement.getBoundingClientRect();
                return (
                  <rect
                    key={index}
                    x={rect.left + window.pageXOffset - 4}
                    y={rect.top + window.pageYOffset - 4}
                    width={rect.width + 8}
                    height={rect.height + 8}
                    rx="8"
                    fill="black"
                  />
                );
              })}
            </mask>
          </defs>
        </svg>
        
        {/* Dark overlay with mask applied */}
        <div 
          className="fixed inset-0 bg-black/50 pointer-events-none"
          style={{ mask: `url(#${maskId})` }}
        />
        
        {/* Highlight borders for each target */}
        {targetElements.map((targetElement, index) => (
          <div
            key={`border-${index}`}
            className="absolute border-4 border-yellow-400 rounded-lg shadow-2xl pointer-events-auto"
            style={{
              top: targetElement.getBoundingClientRect().top + window.pageYOffset - 4,
              left: targetElement.getBoundingClientRect().left + window.pageXOffset - 4,
              width: targetElement.getBoundingClientRect().width + 8,
              height: targetElement.getBoundingClientRect().height + 8,
              backgroundColor: 'transparent',
              boxShadow: '0 0 30px rgba(255, 193, 7, 0.9)',
            }}
          />
        ))}
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
        className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentStepData.title}
          </h3>
          <button
            onClick={completeTutorial}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            {currentStepData.description}
          </p>

          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>ย้อนกลับ</span>
                </button>
              )}
              
              <button
                onClick={skipTutorial}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>ข้าม</span>
              </button>
            </div>

            <button
              onClick={nextStep}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>{isLastStep ? 'เสร็จสิ้น' : 'ต่อไป'}</span>
              {!isLastStep && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Arrow pointer */}
        <div
          className={`absolute w-0 h-0 ${
            currentStepData.position === 'right'
              ? 'border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white -left-2 top-1/2 transform -translate-y-1/2'
              : currentStepData.position === 'left'
              ? 'border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white -right-2 top-1/2 transform -translate-y-1/2'
              : currentStepData.position === 'top'
              ? 'border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white -bottom-2 left-1/2 transform -translate-x-1/2'
              : 'border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white -top-2 left-1/2 transform -translate-x-1/2'
          }`}
        />
      </div>
    </>
  );
}
