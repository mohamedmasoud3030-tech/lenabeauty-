import { motion } from "motion/react";
import { Zap } from "lucide-react";

export function PageLoader() {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-background to-muted/10">
      {/* Animated Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="relative w-16 h-16"
      >
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary" />
      </motion.div>

      {/* Loading Text */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest"
        >
          <Zap className="h-4 w-4 text-primary" />
          <span>Loading</span>
        </motion.div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonLoader() {
  return (
    <div className="w-full space-y-6 p-6">
      {/* Header Skeleton */}
      <div className="space-y-4">
        <div className="h-8 w-1/3 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-2/3 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="h-10 w-10 bg-muted rounded-lg animate-pulse" />
            <div className="h-6 w-2/3 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-1/2 bg-muted rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="h-6 w-1/4 bg-muted rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 w-full bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
