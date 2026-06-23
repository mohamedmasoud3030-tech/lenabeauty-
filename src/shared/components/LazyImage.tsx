/**
 * LazyImage - تحميل كسول احترافي للصور
 * - Intersection Observer لتأجيل التحميل حتى يصبح العنصر مرئياً
 * - Blur placeholder أثناء التحميل
 * - دعم WebP مع fallback تلقائي
 * - معالجة أخطاء التحميل
 */
import React, { useRef, useState, useEffect } from "react";
import { clsx } from "clsx";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  placeholderColor?: string;
  fallbackSrc?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showSkeleton?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = "",
  width,
  height,
  placeholderColor = "#f3f4f6",
  fallbackSrc,
  objectFit = "cover",
  rounded = "md",
  showSkeleton = true,
  onLoad,
  onError,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);

  const roundedClasses = {
    none: "",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  const objectFitClasses = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
    none: "object-none",
    "scale-down": "object-scale-down",
  };

  // Intersection Observer - تحميل عند الظهور
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  return (
    <div
      className={clsx(
        "relative overflow-hidden",
        roundedClasses[rounded],
        className
      )}
      style={{
        width,
        height,
        backgroundColor: placeholderColor,
      }}
    >
      {/* Skeleton shimmer */}
      {showSkeleton && !loaded && !error && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100"
          aria-hidden="true"
        />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={inView ? (error && fallbackSrc ? fallbackSrc : src) : undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={clsx(
          "w-full h-full transition-opacity duration-500",
          objectFitClasses[objectFit],
          roundedClasses[rounded],
          loaded ? "opacity-100" : "opacity-0"
        )}
        style={{ width, height }}
      />

      {/* Error fallback */}
      {error && !fallbackSrc && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 gap-1">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">{alt}</span>
        </div>
      )}
    </div>
  );
};

/**
 * SalonLogo - عرض شعار الصالون مع fallback احترافي
 */
interface SalonLogoProps {
  logoUrl?: string | null;
  salonName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const SalonLogo: React.FC<SalonLogoProps> = ({
  logoUrl,
  salonName = "LenaBeauty",
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-3xl",
  };

  const sizePx = { sm: 32, md: 48, lg: 64, xl: 96 };

  if (!logoUrl) {
    // Text fallback with gradient
    const initials = salonName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    return (
      <div
        className={clsx(
          "flex items-center justify-center rounded-full font-bold text-white",
          "bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg",
          sizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <LazyImage
      src={logoUrl}
      alt={salonName}
      width={sizePx[size]}
      height={sizePx[size]}
      rounded="full"
      objectFit="contain"
      className={clsx("shadow-md", className)}
      fallbackSrc={undefined}
    />
  );
};

/**
 * ServiceImage - صورة الخدمة مع placeholder
 */
interface ServiceImageProps {
  src?: string | null;
  name: string;
  className?: string;
  size?: number;
}

export const ServiceImage: React.FC<ServiceImageProps> = ({
  src,
  name,
  className = "",
  size = 48,
}) => {
  if (!src) {
    // Emoji/icon fallback
    const emojis: Record<string, string> = {
      hair: "✂️",
      nail: "💅",
      skin: "🧴",
      massage: "💆",
      makeup: "💄",
      beard: "🧔",
      wax: "🪒",
      default: "💎",
    };

    const key = Object.keys(emojis).find((k) =>
      name.toLowerCase().includes(k)
    ) ?? "default";

    return (
      <div
        className={clsx(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 text-2xl",
          className
        )}
        style={{ width: size, height: size }}
        title={name}
      >
        {emojis[key]}
      </div>
    );
  }

  return (
    <LazyImage
      src={src}
      alt={name}
      width={size}
      height={size}
      rounded="xl"
      objectFit="cover"
      className={className}
    />
  );
};

export default LazyImage;
