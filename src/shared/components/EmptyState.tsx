import { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'minimal' | 'featured';
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const { t } = useTranslation();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
    },
  };

  if (variant === 'minimal') {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center justify-center py-12 text-center space-y-4"
      >
        <motion.div variants={item} className="text-muted-foreground/50">
          {icon || <Plus className="h-10 w-10" />}
        </motion.div>
        <motion.div variants={item} className="space-y-1">
          <p className="text-sm font-bold text-muted-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground/70">{description}</p>
          )}
        </motion.div>
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center justify-center py-16 text-center space-y-6"
      >
        <motion.div
          variants={item}
          className="relative"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent blur-xl"
          />
          <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shadow-lg">
            {icon || <Plus className="h-12 w-12" />}
          </div>
        </motion.div>
        <motion.div variants={item} className="max-w-md space-y-2">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </motion.div>
        {actionLabel && onAction && (
          <motion.button
            variants={item}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAction}
            className="group relative px-8 h-12 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Plus className="h-5 w-5 relative z-10" />
            <span className="relative z-10">{t(actionLabel)}</span>
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-8 sm:p-12 text-center space-y-6"
    >
      <motion.div
        variants={item}
        className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shadow-lg mx-auto"
      >
        {icon || <Plus className="h-10 w-10" />}
      </motion.div>
      <motion.div variants={item} className="space-y-2">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </motion.div>
      {actionLabel && onAction && (
        <motion.button
          variants={item}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="group relative px-8 h-12 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 overflow-hidden mx-auto"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <Plus className="h-5 w-5 relative z-10" />
          <span className="relative z-10">{t(actionLabel)}</span>
        </motion.button>
      )}
    </motion.div>
  );
}
