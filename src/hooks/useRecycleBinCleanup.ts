import { useEffect, useRef } from 'react';

/**
 * Hook to trigger daily cleanup of recycle bin
 * Runs once per day when admin accesses the system
 */
export function useRecycleBinCleanup() {
    const hasRunToday = useRef(false);

    useEffect(() => {
        const checkAndRunCleanup = async () => {
            // Check if cleanup has already run today
            const lastCleanup = localStorage.getItem('lastRecycleBinCleanup');
            const today = new Date().toDateString();

            if (lastCleanup === today || hasRunToday.current) {
                return; // Already ran today
            }

            try {
                console.log('🧹 Running daily recycle bin cleanup...');

                const response = await fetch('/api/cron/cleanup-recycle-bin', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Recycle bin cleanup completed:', data);

                    if (data.deletedCount > 0) {
                        console.log(`🗑️ Deleted ${data.deletedCount} expired items from recycle bin`);
                    }

                    // Mark as completed for today
                    localStorage.setItem('lastRecycleBinCleanup', today);
                    hasRunToday.current = true;
                } else {
                    console.warn('⚠️ Recycle bin cleanup failed:', response.status);
                }
            } catch (error) {
                console.error('❌ Recycle bin cleanup error:', error);
            }
        };

        // Run cleanup check after component mounts
        const timer = setTimeout(checkAndRunCleanup, 2000); // Wait 2 seconds after page load

        return () => clearTimeout(timer);
    }, []);
}
