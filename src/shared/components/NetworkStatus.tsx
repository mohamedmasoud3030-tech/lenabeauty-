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
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 inset-x-0 z-40 bg-rose-500/10 border-b border-rose-500/20 backdrop-blur-sm"
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
            <WifiOff className="h-5 w-5 text-rose-600 animate-pulse" />
            <span className="text-sm font-bold text-rose-600">{t('No internet connection')}</span>
          </div>
        </motion.div>
      )}
      {wasOffline && isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 inset-x-0 z-40 bg-emerald-500/10 border-b border-emerald-500/20 backdrop-blur-sm"
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-3">
            <Wifi className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-600">{t('Connection restored')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
