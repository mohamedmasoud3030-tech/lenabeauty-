import React, { useEffect, useState } from 'react';
import { logger } from '../logger';

/**
 * Hook for mobile optimization
 * Provides utilities for detecting device type and optimizing UX
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  isLandscape: boolean;
  isPortrait: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  touchSupported: boolean;
  isRetina: boolean;
  dpr: number; // Device pixel ratio
}

export const useMobileOptimization = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    orientation: 'portrait',
    isLandscape: false,
    isPortrait: true,
    deviceType: 'desktop',
    touchSupported: false,
    isRetina: false,
    dpr: 1,
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      const isLandscape = width > height;
      const isPortrait = width <= height;
      const touchSupported = () => {
        return (
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0
        );
      };
      const isRetina = window.devicePixelRatio > 1;
      const dpr = window.devicePixelRatio;

      let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      if (isMobile) deviceType = 'mobile';
      else if (isTablet) deviceType = 'tablet';

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        screenHeight: height,
        orientation: isLandscape ? 'landscape' : 'portrait',
        isLandscape,
        isPortrait,
        deviceType,
        touchSupported: touchSupported(),
        isRetina,
        dpr,
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
};

/**
 * Hook for detecting if device is in low battery mode
 */
export const useLowBatteryMode = (): boolean => {
  const [isLowBattery, setIsLowBattery] = useState(false);

  useEffect(() => {
    const checkBattery = async () => {
      try {
        const battery = await (navigator as any).getBattery?.();
        if (battery) {
          const updateBatteryStatus = () => {
            setIsLowBattery(battery.level < 0.2);
          };
          battery.addEventListener('levelchange', updateBatteryStatus);
          updateBatteryStatus();
          return () => battery.removeEventListener('levelchange', updateBatteryStatus);
        }
      } catch (error) {
        logger.debug('Battery API not available');
      }
    };

    checkBattery();
  }, []);

  return isLowBattery;
};

/**
 * Hook for detecting network speed
 */
export interface NetworkInfo {
  type: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown';
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export const useNetworkInfo = (): NetworkInfo => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  });

  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      const updateNetworkInfo = () => {
        setNetworkInfo({
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
        });
      };

      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);

      return () => connection.removeEventListener('change', updateNetworkInfo);
    }
  }, []);

  return networkInfo;
};

/**
 * Hook for detecting if user prefers reduced motion
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

/**
 * Hook for detecting if user prefers dark mode
 */
export const usePrefersDarkMode = (): boolean => {
  const [prefersDarkMode, setPrefersDarkMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersDarkMode;
};

/**
 * Hook for detecting if device is online/offline
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Hook for viewport intersection (lazy loading)
 */
export const useIntersectionObserver = (ref: React.RefObject<HTMLElement>, options = {}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);

  return isVisible;
};

/**
 * Hook for debouncing values (useful for search, resize, etc.)
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for throttling values (useful for scroll, resize, etc.)
 */
export const useThrottle = <T,>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = React.useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, delay]);

  return throttledValue;
};

/**
 * Hook for managing viewport size
 */
export const useViewport = () => {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
};
