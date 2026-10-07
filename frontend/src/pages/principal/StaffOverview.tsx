import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

interface Teacher {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  joining_date: string;
  status: string;
}

export default function StaffOverview() {
  const { t, te } = useLanguage();
  const teachersQuery = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Teacher>>("/teachers");
      return data;
    },
  });

  const statusColors: Record<string, "green" | "red" | "yellow"> = {
    ACTIVE: "green",
    INACTIVE: "red",
    ON_LEAVE: "yellow",
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("principal.staff.title")} subtitle={t("principal.staff.subtitle")} />

      {teachersQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachersQuery.data?.items.map((teacher) => (
            <Card key={teacher.id}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white font-semibold">
                  {teacher.full_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink dark:text-white">{teacher.full_name}</h3>
                    <Badge tone={statusColors[teacher.status] || "gray"}>{te("status", teacher.status)}</Badge>
                  </div>
                  <p className="text-sm text-accent-fg dark:text-accent-fg">{teacher.designation || t("principal.staff.teacher")}</p>
                  <p className="text-xs text-ink-3 mt-1">{teacher.department || t("principal.staff.general")}</p>
                  <div className="mt-2 text-xs text-ink-2">
                    <p dir="ltr" className="text-start">{teacher.email}</p>
                    <p dir="ltr" className="text-start">{teacher.phone}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {teachersQuery.data?.items.length === 0 && (
            <Card className="col-span-full">
              <p className="text-center text-ink-3 py-8">{t("principal.staff.empty")}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
