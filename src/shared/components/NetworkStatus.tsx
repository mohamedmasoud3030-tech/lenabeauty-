import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      {!isOnline && (
        <motion.div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 z-[var(--z-overlay-top)] bg-destructive text-destructive-foreground"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="px-4 py-2.5 flex items-center justify-center gap-2">
            <WifiOff aria-hidden="true" className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-bold">{t('No internet connection')}</span>
          </div>
        </motion.div>
      )}
      {wasOffline && isOnline && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 z-[var(--z-overlay-top)] bg-success text-success-foreground"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="px-4 py-2.5 flex items-center justify-center gap-2">
            <Wifi aria-hidden="true" className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-bold">{t('Back online')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
