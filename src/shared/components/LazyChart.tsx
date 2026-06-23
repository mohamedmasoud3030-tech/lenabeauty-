/**
 * LazyChart - تحميل كسول للرسوم البيانية
 * يؤجل تحميل recharts حتى يصبح العنصر مرئياً في الشاشة
 * يقلل وقت التحميل الأولي بشكل كبير على الهواتف
 */
import React, { useRef, useState, useEffect, Suspense, lazy } from "react";

// ---- Skeleton placeholder ----
const ChartSkeleton: React.FC<{ height?: number; className?: string }> = ({
  height = 200,
  className = "",
}) => (
  <div
    className={`animate-pulse rounded-xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 ${className}`}
    style={{ height }}
    aria-hidden="true"
  />
);

// ---- Intersection Observer hook ----
function useInView(rootMargin = "200px"): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null!);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return; // once visible, stay visible
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}

// ---- Generic lazy chart wrapper ----
interface LazyChartProps {
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export const LazyChart: React.FC<LazyChartProps> = ({
  height = 200,
  className = "",
  children,
}) => {
  const [ref, inView] = useInView("300px");

  return (
    <div ref={ref} style={{ minHeight: height }} className={className}>
      {inView ? (
        <Suspense fallback={<ChartSkeleton height={height} />}>
          {children}
        </Suspense>
      ) : (
        <ChartSkeleton height={height} />
      )}
    </div>
  );
};

// ---- Mobile-aware chart wrapper ----
// On mobile, shows only the most important chart and collapses the rest
interface MobileAwareChartProps {
  height?: number;
  className?: string;
  priority?: "high" | "medium" | "low";
  title?: string;
  children: React.ReactNode;
}

export const MobileAwareChart: React.FC<MobileAwareChartProps> = ({
  height = 200,
  className = "",
  priority = "medium",
  title,
  children,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(priority === "high");
  const [ref, inView] = useInView("300px");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // On desktop, always show
  if (!isMobile) {
    return (
      <div ref={ref} style={{ minHeight: height }} className={className}>
        {inView ? (
          <Suspense fallback={<ChartSkeleton height={height} />}>
            {children}
          </Suspense>
        ) : (
          <ChartSkeleton height={height} />
        )}
      </div>
    );
  }

  // On mobile, collapse low/medium priority charts
  if (isMobile && priority === "low" && !expanded) {
    return (
      <div className={`rounded-xl border border-gray-100 bg-white ${className}`}>
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-600"
        >
          <span>{title ?? "عرض الرسم البياني"}</span>
          <span className="text-xs text-blue-500">اضغط للعرض ▼</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      {title && isMobile && (
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {priority !== "high" && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-gray-400"
            >
              طي ▲
            </button>
          )}
        </div>
      )}
      <div style={{ minHeight: height }}>
        {inView ? (
          <Suspense fallback={<ChartSkeleton height={height} />}>
            {children}
          </Suspense>
        ) : (
          <ChartSkeleton height={height} />
        )}
      </div>
    </div>
  );
};

// ---- Auto-refresh wrapper ----
// Wraps a chart and triggers a data refresh every N seconds
interface AutoRefreshChartProps {
  intervalMs?: number;
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export const AutoRefreshChart: React.FC<AutoRefreshChartProps> = ({
  intervalMs = 30_000,
  onRefresh,
  children,
  className = "",
}) => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(async () => {
      await onRefresh();
      setLastRefresh(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, onRefresh]);

  return (
    <div className={`relative ${className}`}>
      {children}
      <span className="absolute bottom-1 right-2 text-[10px] text-gray-300 select-none">
        آخر تحديث: {lastRefresh.toLocaleTimeString("ar-OM")}
      </span>
    </div>
  );
};

export { ChartSkeleton };
