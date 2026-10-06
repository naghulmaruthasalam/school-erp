import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

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
      <PageHeader title="Staff Overview" subtitle="View all teaching and non-teaching staff" />

      {teachersQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachersQuery.data?.items.map((teacher) => (
            <Card key={teacher.id}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center text-white font-semibold">
                  {teacher.full_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#24113F] dark:text-white">{teacher.full_name}</h3>
                    <Badge tone={statusColors[teacher.status] || "gray"}>{teacher.status}</Badge>
                  </div>
                  <p className="text-sm text-[#6D28D9] dark:text-[#8B5CF6]">{teacher.designation || "Teacher"}</p>
                  <p className="text-xs text-[#7C6F95] mt-1">{teacher.department || "General"}</p>
                  <div className="mt-2 text-xs text-[#4B4260] dark:text-[#D8CCEA]">
                    <p>{teacher.email}</p>
                    <p>{teacher.phone}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {teachersQuery.data?.items.length === 0 && (
            <Card className="col-span-full">
              <p className="text-center text-[#7C6F95] py-8">No staff members found.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
