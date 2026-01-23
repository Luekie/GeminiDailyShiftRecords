import { useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '../store/auth';
import { supabase } from '../lib/supabase';
import { useLocation } from 'wouter';

const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

export function useAutoLogout() {
  const [user, setUser] = useAtom(userAtom);
  const [, setLocation] = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear user state
      setUser(null);
      
      // Clear any localStorage data
      localStorage.removeItem('user');
      localStorage.removeItem('sessionExpiry');
      
      // Show logout notification
      showLogoutNotification();
      
      // Navigate to login page
      setLocation("/");
      
      // Force page reload to ensure clean state
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      console.error('Auto-logout error:', error);
      // Force navigation even if logout fails
      window.location.href = "/";
    }
  }, [setUser, setLocation]);

  const showLogoutNotification = () => {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 bg-orange-500 text-white max-w-sm';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          ⏰
        </div>
        <div>
          <div class="font-semibold">Session Expired</div>
          <div class="text-sm opacity-90">You've been logged out due to inactivity</div>
        </div>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  };

  const showWarningNotification = () => {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 bg-yellow-500 text-white max-w-sm';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
          ⚠️
        </div>
        <div>
          <div class="font-semibold">Session Warning</div>
          <div class="text-sm opacity-90">You'll be logged out in 30 seconds due to inactivity</div>
        </div>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 30000);
  };

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Set logout timer (no warning timer)
    timeoutRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout]);

  const handleActivity = useCallback(() => {
    // Only reset if user is logged in
    if (user) {
      resetTimer();
    }
  }, [user, resetTimer]);

  useEffect(() => {
    // Only start auto-logout if user is logged in
    if (!user) {
      return;
    }

    // Start the timer
    resetTimer();

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup function
    return () => {
      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });

      // Clear timers
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [user, handleActivity, resetTimer]);

  // Return current activity status
  return {
    lastActivity: lastActivityRef.current,
    resetTimer: handleActivity
  };
}