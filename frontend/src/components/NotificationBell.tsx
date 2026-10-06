import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../auth/store";
import type { PageResponse } from "../types/common";

interface Notification {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  priority: string;
  created_at: string;
  is_read: boolean;
}

interface UnreadCount {
  unread: number;
  total: number;
}

export default function NotificationBell() {
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
      SUPER_ADMIN: "/super-admin",
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
        className="relative p-2 rounded-lg hover:bg-violet-500/10 transition-colors"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-violet-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {(countQuery.data?.unread ?? 0) > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {countQuery.data!.unread > 9 ? "9+" : countQuery.data!.unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-xl border border-violet-100 z-50 overflow-hidden animate-fade-in-up">
          <div className="px-4 py-3 border-b border-violet-100 flex items-center justify-between">
            <h3 className="font-semibold text-violet-900">Notifications</h3>
            {(countQuery.data?.unread ?? 0) > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">
                {countQuery.data?.unread} new
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <div className="p-4 text-center text-violet-400">Loading...</div>
            ) : notificationsQuery.data?.items.length === 0 ? (
              <div className="p-8 text-center text-violet-400">No notifications</div>
            ) : (
              notificationsQuery.data?.items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-violet-50 hover:bg-violet-50 cursor-pointer transition-colors ${
                    !n.is_read ? "bg-violet-50/50" : ""
                  }`}
                  onClick={() => {
                    if (!n.is_read) markReadMutation.mutate(n.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[n.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!n.is_read ? "text-violet-900" : "text-violet-700"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-violet-500 truncate">{n.content}</p>
                      <p className="text-xs text-violet-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-violet-100">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(getNotificationPath());
              }}
              className="w-full text-center text-sm text-violet-600 hover:text-violet-800 font-medium"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
