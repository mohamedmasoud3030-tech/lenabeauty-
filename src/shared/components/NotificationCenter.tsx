/**
 * NotificationCenter — in-app notification bell with a dropdown list.
 * Shows recent staff notifications (from the customer_notification_timeline)
 * and links to the notifications settings page for admin.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCircle2, XCircle, Clock3, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./Toast";
import { useCases } from "../../app/composition/useCases";

export interface NotificationCenterItem {
  id: string;
  title: string;
  message: string;
  channel: string;
  deliveryStatus: string;
  createdAt: Date;
}

interface NotificationCenterProps {
  readonly isAdmin: boolean;
}

export function NotificationCenter({ isAdmin }: NotificationCenterProps) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationCenterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    void loadRecent();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node | null;
        if (target && containerRef.current?.contains(target)) return;
      }
      setOpen(false);
      if (event instanceof KeyboardEvent) {
        window.setTimeout(() => buttonRef.current?.focus(), 0);
      }
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  async function loadRecent() {
    setLoading(true);
    try {
      const res = await useCases.notifications.listRecent(10);
      if (res.ok) {
        setItems(
          res.data.map((record) => ({
            id: record.id,
            title: record.templateKey ? record.templateKey.replaceAll("_", " ") : record.channel,
            message: record.messagePreview,
            channel: record.channel,
            deliveryStatus: record.deliveryStatus,
            createdAt: record.createdAt,
          })),
        );
      }
    } catch {
      // Silent — the bell simply shows nothing on failure rather than
      // fabricating data (project rule: failed reads hide surfaces).
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function statusIcon(status: string) {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />;
      case "FAILED":
        return <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />;
      default:
        return <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button"
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("Notifications")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-center"
        className="h-11 w-11 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all shadow-sm relative group active:scale-95"
        title={t("Notifications")}
      >
        <Bell aria-hidden="true" className="h-5 w-5 group-hover:rotate-12 transition-transform" />
        {items.length > 0 && open === false && (
          <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="notification-center"
            role="dialog"
            aria-label={t("Notifications")}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 end-0 w-[min(90vw,380px)] rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-bold text-foreground">{t("Notifications")}</p>
              {isAdmin && (
                <button type="button"
                  onClick={() => { setOpen(false); nav("/settings?tab=notifications"); }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  {t("Configure")}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("Loading...")}</div>
              )}
              {!loading && items.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("No notifications yet")}
                </div>
              )}
              {!loading && items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">{statusIcon(item.deliveryStatus)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wider">
                      {item.channel} · {item.createdAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;
