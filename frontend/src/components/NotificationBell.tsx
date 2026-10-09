import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../auth/store";
import type { PageResponse } from "../types/common";
import { useLanguage } from "../i18n/LanguageContext";

interface Notification {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  priority: string;
  link?: string | null;
  created_at: string;
  is_read: boolean;
}

interface UnreadCount {
  unread: number;
  total: number;
}

export default function NotificationBell() {
  const { t, fmtDate, fmtNumber } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const countQuery = useQuery({
    queryKey: ["notification-count"],
    queryFn: async () => {
      const { data } = await api.get<UnreadCount>("/notifications/unread-count");
      return data;
    },
    refetchInterval: 30000,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notification-preview"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Notification>>("/notifications", {
        params: { page_size: 5 },
      });
      return data;
    },
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["notification-preview"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getNotificationPath = () => {
    if (!user) return "/";
    const rolePathMap: Record<string, string> = {
      SUPER_ADMIN: "/super-admin/notifications",
      SCHOOL_ADMIN: "/admin/notifications",
      PRINCIPAL: "/admin/notifications",
      TEACHER: "/teacher/notifications",
      STUDENT: "/student/notifications",
      PARENT: "/parent/notifications",
    };
    return rolePathMap[user.role] || "/";
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-400",
    NORMAL: "bg-blue-500",
    HIGH: "bg-orange-500",
    URGENT: "bg-red-500",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-icon-btn relative"
        aria-label={t("notifications.title")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-[18px] w-[18px] text-ink-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {(countQuery.data?.unread ?? 0) > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-pink-500 px-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(255,69,58,0.5)]">
            {countQuery.data!.unread > 9 ? "9+" : fmtNumber(countQuery.data!.unread)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="glass-strong absolute end-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden !rounded-[24px] animate-pop-in origin-top-right rtl:origin-top-left">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h3 className="font-semibold text-ink">{t("notifications.title")}</h3>
            {(countQuery.data?.unread ?? 0) > 0 && (
              <span className="lg-chip">
                {t("shell.notificationBell.newCount", { n: fmtNumber(countQuery.data?.unread ?? 0) })}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <div className="p-4 text-center text-ink-3">{t("common.loading")}</div>
            ) : notificationsQuery.data?.items.length === 0 ? (
              <div className="p-8 text-center text-ink-3">{t("notifications.noNotifications")}</div>
            ) : (
              notificationsQuery.data?.items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-line hover:bg-accent-soft cursor-pointer transition-colors ${
                    !n.is_read ? "bg-accent-soft/60" : ""
                  }`}
                  onClick={() => {
                    if (!n.is_read) markReadMutation.mutate(n.id);
                    if (n.link) { setIsOpen(false); navigate(n.link); }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[n.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!n.is_read ? "text-ink" : "text-ink-2"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-3 truncate">{n.content}</p>
                      <p className="text-[11px] text-ink-3 mt-1">
                        {fmtDate(n.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-line">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(getNotificationPath());
              }}
              className="w-full text-center text-sm text-accent-fg hover:opacity-80 font-semibold"
            >
              {t("shell.notificationBell.viewAll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
