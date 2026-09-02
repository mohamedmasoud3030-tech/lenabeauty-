import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * One-shot "has this element entered the viewport" signal.
 *
 * LazyChart and LazyImage each hand-rolled the identical IntersectionObserver
 * effect — observe, flip a flag on first intersection, disconnect — so the
 * lazy-loading rule lived in two places. This is the single owner. It is
 * generic over the element type because LazyChart observes a wrapper div while
 * LazyImage observes the <img> itself.
 *
 * Once visible it stays visible: the observer is disconnected and never
 * re-attached, so scrolling away can never un-load content that already
 * rendered.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "200px",
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
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
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
