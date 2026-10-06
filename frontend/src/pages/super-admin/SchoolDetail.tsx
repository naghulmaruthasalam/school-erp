import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { getSchool } from "./api";
import { api } from "../../api/client";

interface SchoolStats {
  total_students: number;
  total_teachers: number;
  total_parents: number;
  total_admissions: number;
  active_classes: number;
}

async function fetchSchoolStats(schoolId: string): Promise<SchoolStats> {
  try {
    const { data } = await api.get<SchoolStats>(`/schools/${schoolId}/stats`);
    return data;
  } catch {
    return { total_students: 0, total_teachers: 0, total_parents: 0, total_admissions: 0, active_classes: 0 };
  }
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-3 border-b border-[#E5DDF5] dark:border-[#2D1B4E] last:border-0">
      <span className="text-sm text-[#7C6F95]">{label}</span>
      <span className="text-sm font-medium text-[#24113F] dark:text-white">{value || "—"}</span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="p-4 bg-[#F7F5FF] dark:bg-[#1B1230] rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#6D28D9] flex items-center justify-center text-white text-lg">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[#6D28D9] dark:text-[#8B5CF6]">{value}</p>
          <p className="text-xs text-[#7C6F95]">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function SchoolDetail() {
  const { id } = useParams<{ id: string }>();

  const schoolQuery = useQuery({
    queryKey: ["super-admin", "school", id],
    queryFn: () => getSchool(id as string),
    enabled: Boolean(id),
  });

  const statsQuery = useQuery({
    queryKey: ["super-admin", "school-stats", id],
    queryFn: () => fetchSchoolStats(id as string),
    enabled: Boolean(id),
  });

  if (schoolQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (schoolQuery.isError || !schoolQuery.data) {
    return (
      <div className="text-center py-12">
        <p className="text-[#DC2626] mb-4">Failed to load school details.</p>
        <Link to="/super-admin/schools">
          <Button variant="secondary">← Back to Schools</Button>
        </Link>
      </div>
    );
  }

  const school = schoolQuery.data;
  const stats = statsQuery.data;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center text-white text-2xl font-bold">
            {school.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#24113F] dark:text-white">{school.name}</h1>
              <Badge tone={school.is_active ? "green" : "red"}>
                {school.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-[#7C6F95]">School Code: <span className="font-mono font-medium text-[#6D28D9]">{school.code}</span></p>
          </div>
        </div>
        <Link to="/super-admin/schools">
          <Button variant="secondary">← Back to Schools</Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Students" value={stats?.total_students ?? 0} icon="👨‍🎓" />
        <StatCard label="Teachers" value={stats?.total_teachers ?? 0} icon="👨‍🏫" />
        <StatCard label="Parents" value={stats?.total_parents ?? 0} icon="👨‍👩‍👧" />
        <StatCard label="Admissions" value={stats?.total_admissions ?? 0} icon="📝" />
        <StatCard label="Classes" value={stats?.active_classes ?? 0} icon="🏫" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <h3 className="text-lg font-semibold text-[#24113F] dark:text-white mb-4 pb-3 border-b border-[#E5DDF5] dark:border-[#2D1B4E]">
            School Information
          </h3>
          <div className="space-y-1">
            <InfoRow label="School Name" value={school.name} />
            <InfoRow label="School Code" value={school.code} />
            <InfoRow label="Email" value={school.email} />
            <InfoRow label="Phone" value={school.phone} />
            <InfoRow label="Academic Year Starts" value={`Month ${school.academic_year_start_month}`} />
          </div>
        </Card>

        {/* Address */}
        <Card>
          <h3 className="text-lg font-semibold text-[#24113F] dark:text-white mb-4 pb-3 border-b border-[#E5DDF5] dark:border-[#2D1B4E]">
            Address Details
          </h3>
          <div className="space-y-1">
            <InfoRow label="Address" value={school.address} />
            <InfoRow label="City" value={school.city} />
            <InfoRow label="State" value={school.state} />
            <InfoRow label="Country" value={school.country} />
            <InfoRow label="Postal Code" value={school.postal_code} />
          </div>
        </Card>

        {/* System Information */}
        <Card>
          <h3 className="text-lg font-semibold text-[#24113F] dark:text-white mb-4 pb-3 border-b border-[#E5DDF5] dark:border-[#2D1B4E]">
            System Information
          </h3>
          <div className="space-y-1">
            <InfoRow label="Status" value={school.is_active ? "Active" : "Inactive"} />
            <InfoRow label="Created" value={new Date(school.created_at).toLocaleDateString()} />
            <InfoRow label="Last Updated" value={new Date(school.updated_at).toLocaleDateString()} />
            <InfoRow label="School ID" value={school.id} />
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-lg font-semibold text-[#24113F] dark:text-white mb-4 pb-3 border-b border-[#E5DDF5] dark:border-[#2D1B4E]">
            Platform Actions
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-[#F7F5FF] dark:bg-[#1B1230] rounded-lg border border-[#E5DDF5] dark:border-[#2D1B4E]">
              <p className="text-sm font-medium text-[#24113F] dark:text-white">School Status</p>
              <p className="text-xs text-[#7C6F95] mb-3">
                {school.is_active
                  ? "This school is currently active and operational."
                  : "This school is currently inactive."}
              </p>
              <Badge tone={school.is_active ? "green" : "red"}>
                {school.is_active ? "Operational" : "Suspended"}
              </Badge>
            </div>
            <div className="p-4 bg-[#F0E9FF] dark:bg-[#2D1B4E] rounded-lg">
              <p className="text-xs text-[#7C6F95]">
                <strong>Note:</strong> School data management (students, teachers, fees, etc.) is handled by the School Admin.
                Platform admin can only view high-level statistics for monitoring purposes.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
