/**
 * Drag scrolling utility for table containers
 * Enables mouse drag to scroll functionality
 */

import React from 'react';

export function enableDragScroll(element: HTMLElement) {
  let isDown = false;
  let startX: number;
  let scrollLeft: number;

  const handleMouseDown = (e: MouseEvent) => {
    // Only enable drag scrolling if not clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'INPUT' || 
        target.tagName === 'SELECT' ||
        target.closest('button') ||
        target.closest('a')) {
      return;
    }

    // Check if the target is a selectable element
    const isSelectableCell = target.classList.contains('text-selectable');
    
    // If it's a selectable cell, don't start drag scrolling
    if (isSelectableCell) {
      return;
    }

    // Check if clicking on text content or table cell with text
    const isTextContent = target.tagName === 'SPAN' || 
                         target.tagName === 'DIV' || 
                         target.tagName === 'P' ||
                         target.nodeType === Node.TEXT_NODE ||
                         (target.tagName === 'TD' && target.textContent && target.textContent.trim() !== '');
    
    // If clicking on text content, allow text selection instead of drag scrolling
    if (isTextContent) {
      // Don't prevent default - allow text selection
      return;
    }

    // Only start drag scrolling for empty areas
    isDown = true;
    element.classList.add('dragging');
    startX = e.pageX;
    scrollLeft = element.scrollLeft;
    
    // Prevent default to avoid text selection
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseLeave = () => {
    isDown = false;
    element.classList.remove('dragging');
  };

  const handleMouseUp = () => {
    isDown = false;
    element.classList.remove('dragging');
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDown) return;
    
    e.preventDefault();
    const x = e.pageX;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    element.scrollLeft = scrollLeft - walk;
  };

  // Add event listeners
  element.addEventListener('mousedown', handleMouseDown);
  element.addEventListener('mouseleave', handleMouseLeave);
  element.addEventListener('mouseup', handleMouseUp);
  element.addEventListener('mousemove', handleMouseMove);

  // Set cursor and scrollable class immediately - no checking needed
  element.style.cursor = 'grab';
  element.classList.add('scrollable');

  // Return cleanup function
  return () => {
    // Remove event listeners
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('mouseleave', handleMouseLeave);
    element.removeEventListener('mouseup', handleMouseUp);
    element.removeEventListener('mousemove', handleMouseMove);
    
    // Clean up element state
    element.classList.remove('dragging', 'scrollable');
    element.style.cursor = '';
  };
}

/**
 * React hook for drag scrolling
 */
export function useDragScroll() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  return ref;
}

// For non-React usage
declare global {
  interface Window {
    enableDragScroll: typeof enableDragScroll;
  }
}

// Make it available globally for non-React components
if (typeof window !== 'undefined') {
  window.enableDragScroll = enableDragScroll;
}
