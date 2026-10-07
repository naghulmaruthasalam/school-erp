import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge, Select } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  class_id: string;
  section_id: string;
  roll_no: number;
  status: string;
}

interface Class {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

export default function StudentOverview() {
  const { t, te } = useLanguage();
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await api.get<Class[]>("/academics/classes");
      return data;
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data } = await api.get<Section[]>("/academics/sections");
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students", classFilter, sectionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classFilter) params.append("class_id", classFilter);
      if (sectionFilter) params.append("section_id", sectionFilter);
      const { data } = await api.get<PageResponse<Student>>(`/students?${params}`);
      return data;
    },
  });

  const getClassName = (id: string) => te("class", classesQuery.data?.find((c) => c.id === id)?.name || "");
  const getSectionName = (id: string) => te("section", sectionsQuery.data?.find((s) => s.id === id)?.name || "");

  const filteredSections = sectionsQuery.data?.filter((s) => !classFilter || s.class_id === classFilter) || [];

  const statusColors: Record<string, "green" | "red" | "yellow"> = {
    ACTIVE: "green",
    INACTIVE: "red",
    GRADUATED: "yellow",
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("principal.students.title")} subtitle={t("principal.students.subtitle")} />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("principal.common.class")}</label>
            <Select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}>
              <option value="">{t("principal.common.allClasses")}</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{te("class", c.name)}</option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("principal.common.section")}</label>
            <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
              <option value="">{t("principal.students.allSections")}</option>
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>{te("section", s.name)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {studentsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-start py-3 px-4 text-xs font-semibold text-accent-fg uppercase">{t("principal.students.admissionNo")}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-accent-fg uppercase">{t("principal.common.name")}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-accent-fg uppercase">{t("principal.students.classSection")}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-accent-fg uppercase">{t("principal.students.rollNo")}</th>
                  <th className="text-start py-3 px-4 text-xs font-semibold text-accent-fg uppercase">{t("principal.common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {studentsQuery.data?.items.map((student) => (
                  <tr key={student.id} className="border-b border-line hover:bg-surface-3 dark:hover:bg-[#2D1B4E]/50">
                    <td className="py-3 px-4 text-sm text-ink dark:text-white">{student.admission_no}</td>
                    <td className="py-3 px-4 text-sm font-medium text-ink dark:text-white">{student.full_name}</td>
                    <td className="py-3 px-4 text-sm text-ink-2">
                      {getClassName(student.class_id)} - {getSectionName(student.section_id)}
                    </td>
                    <td className="py-3 px-4 text-sm text-ink-2">{student.roll_no}</td>
                    <td className="py-3 px-4">
                      <Badge tone={statusColors[student.status] || "gray"}>{te("status", student.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {studentsQuery.data?.items.length === 0 && (
              <p className="text-center text-ink-3 py-8">{t("principal.students.empty")}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
