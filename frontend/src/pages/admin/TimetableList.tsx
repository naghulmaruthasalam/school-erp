import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchClasses, fetchSections, fetchSubjects, listTeachers } from "./api";
import { useLanguage } from "../../i18n/LanguageContext";
import { Calendar, Clock, User, BookOpen, Plus, Trash2, GraduationCap, Users, Eye } from "lucide-react";

interface TimetableSlot {
  id: string;
  section_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  teacher_id: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-indigo-500 to-blue-500",
];

export default function TimetableList() {
  const { t, te } = useLanguage();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"overview" | "section">("overview");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    section_id: "",
    day_of_week: 0,
    period_number: 1,
    start_time: "08:00",
    end_time: "08:45",
    subject_id: "",
    teacher_id: "",
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const teachersQuery = useQuery({
    queryKey: ["teachers-all"],
    queryFn: () => listTeachers({ page: 1, page_size: 100 }),
  });

  // Fetch ALL timetable slots for overview
  const allTimetableQuery = useQuery({
    queryKey: ["timetable-all"],
    queryFn: async () => {
      const { data } = await api.get<TimetableSlot[]>("/academics/timetable");
      return data;
    },
  });

  // Fetch timetable for specific section
  const sectionTimetableQuery = useQuery({
    queryKey: ["timetable", selectedSection],
    queryFn: async () => {
      if (!selectedSection) return [];
      const { data } = await api.get<TimetableSlot[]>("/academics/timetable", {
        params: { section_id: selectedSection },
      });
      return data;
    },
    enabled: !!selectedSection && viewMode === "section",
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await api.post("/academics/timetable", {
        ...payload,
        start_time: payload.start_time + ":00",
        end_time: payload.end_time + ":00",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-all"] });
      setShowForm(false);
      setForm({ ...form, subject_id: "", teacher_id: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academics/timetable/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-all"] });
    },
  });

  const getSubjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name) || id;
  const getTeacherName = (id: string) => teachersQuery.data?.items.find((tc) => tc.id === id)?.full_name || id;
  const getSectionName = (id: string) => {
    const section = sectionsQuery.data?.find((s) => s.id === id);
    if (!section) return id;
    const cls = classesQuery.data?.find((c) => c.id === section.class_id);
    return `${te("class", cls?.name)} - ${te("section", section.name)}`;
  };

  // Group slots by teacher for overview
  const slotsByTeacher = teachersQuery.data?.items.map((teacher) => ({
    teacher,
    slots: (allTimetableQuery.data || []).filter((s) => s.teacher_id === teacher.id),
  })) || [];

  // Filter by selected teacher
  const filteredTeachers = selectedTeacher
    ? slotsByTeacher.filter((x) => x.teacher.id === selectedTeacher)
    : slotsByTeacher.filter((x) => x.slots.length > 0);

  const slotsByDay = DAYS.map((_, i) =>
    (sectionTimetableQuery.data || [])
      .filter((s) => s.day_of_week === i)
      .sort((a, b) => a.period_number - b.period_number)
  );

  const totalSlots = allTimetableQuery.data?.length || 0;
  const teachersWithSlots = new Set(allTimetableQuery.data?.map(s => s.teacher_id)).size;

  return (
    <div className="animate-page-enter">
      <PageHeader title={t("admin.timetable.title")} subtitle={t("admin.timetable.subtitle")}>
        <Button onClick={() => setShowForm(!showForm)} glow>
          {showForm ? t("admin.common.cancel") : <><Plus className="w-4 h-4" /> {t("admin.common.addSlot")}</>}
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <Calendar className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{totalSlots}</p>
          <p className="text-sm text-white/80">{t("admin.timetable.totalPeriods")}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <Users className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{teachersWithSlots}</p>
          <p className="text-sm text-white/80">{t("admin.timetable.teachersAssigned")}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <GraduationCap className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{sectionsQuery.data?.length || 0}</p>
          <p className="text-sm text-white/80">{t("admin.timetable.sections")}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <BookOpen className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{subjectsQuery.data?.length || 0}</p>
          <p className="text-sm text-white/80">{t("admin.timetable.subjects")}</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <Card className="mb-6" gradient>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-3 rounded-xl p-1">
            <button
              onClick={() => setViewMode("overview")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "overview"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              {t("admin.timetable.allTeachersOverview")}
            </button>
            <button
              onClick={() => setViewMode("section")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "section"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <GraduationCap className="w-4 h-4 inline mr-2" />
              {t("admin.timetable.bySection")}
            </button>
          </div>

          {viewMode === "overview" && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-accent-fg" />
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="rounded-xl border border-line bg-surface-3 px-4 py-2 text-sm text-ink dark:text-white"
              >
                <option value="">{t("admin.timetable.allTeachers")}</option>
                {teachersQuery.data?.items.map((tc) => (
                  <option key={tc.id} value={tc.id}>{tc.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === "section" && (
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-accent-fg" />
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="rounded-xl border border-line bg-surface-3 px-4 py-2 text-sm text-ink dark:text-white"
              >
                <option value="">{t("admin.reportCards.selectSection")}</option>
                {sectionsQuery.data?.map((section) => (
                  <option key={section.id} value={section.id}>{getSectionName(section.id)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Add Slot Form */}
      {showForm && (
        <Card className="mb-6" gradient>
          <h3 className="font-bold text-ink dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            {t("admin.timetable.addNewSlot")}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ ...form, section_id: form.section_id || selectedSection });
            }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.common.section")}</label>
              <select
                value={form.section_id || selectedSection}
                onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
                required
              >
                <option value="">{t("admin.common.selectDash")}</option>
                {sectionsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>{getSectionName(s.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.common.day")}</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{te("weekday", d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.timetable.periodNo")}</label>
              <input
                type="number"
                min={1}
                value={form.period_number}
                onChange={(e) => setForm({ ...form, period_number: parseInt(e.target.value) || 1 })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.common.subject")}</label>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
                required
              >
                <option value="">{t("admin.common.selectDash")}</option>
                {subjectsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>{te("subject", s.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.common.teacher")}</label>
              <select
                value={form.teacher_id}
                onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
                required
              >
                <option value="">{t("admin.common.selectDash")}</option>
                {teachersQuery.data?.items.map((tc) => (
                  <option key={tc.id} value={tc.id}>{tc.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.timetable.startTime")}</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink dark:text-white mb-2">{t("admin.timetable.endTime")}</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending} glow>
                {createMutation.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                {t("admin.common.addSlot")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Overview Mode - All Teachers */}
      {viewMode === "overview" && (
        allTimetableQuery.isLoading ? (
          <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card>
        ) : filteredTeachers.length === 0 ? (
          <Card className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-ink-3 mb-4" />
            <p className="text-ink-3">{t("admin.timetable.noSlots")}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTeachers.map(({ teacher, slots }) => (
              <Card key={teacher.id} className="hover:shadow-lg transition-all" gradient>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {teacher.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink dark:text-white">{teacher.full_name}</h3>
                    <p className="text-sm text-ink-3">{t("admin.timetable.periodsAssigned", { n: slots.length })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {DAYS.map((day, dayIndex) => {
                    const daySlots = slots.filter(s => s.day_of_week === dayIndex).sort((a, b) => a.period_number - b.period_number);
                    return (
                      <div key={day} className="text-center">
                        <p className={`text-xs font-medium mb-2 px-2 py-1 rounded-lg bg-gradient-to-r ${DAY_COLORS[dayIndex]} text-white`}>
                          {te("weekday", day)}
                        </p>
                        {daySlots.length === 0 ? (
                          <p className="text-xs text-ink-3">—</p>
                        ) : (
                          <div className="space-y-1">
                            {daySlots.map((slot) => (
                              <div key={slot.id} className="p-2 bg-surface-3 rounded-lg text-xs group relative">
                                <p className="font-medium text-ink dark:text-white truncate">{getSubjectName(slot.subject_id)}</p>
                                <p className="text-ink-3 truncate">{getSectionName(slot.section_id)}</p>
                                <p className="text-ink-3">{t("admin.timetable.periodShort", { n: slot.period_number })}</p>
                                <button
                                  onClick={() => deleteMutation.mutate(slot.id)}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Section Mode */}
      {viewMode === "section" && (
        selectedSection ? (
          sectionTimetableQuery.isLoading ? (
            <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAYS.map((day, dayIndex) => (
                <Card key={day} gradient>
                  <h3 className={`font-bold text-white text-center mb-4 py-2 rounded-xl bg-gradient-to-r ${DAY_COLORS[dayIndex]}`}>
                    {te("weekday", day)}
                  </h3>
                  {slotsByDay[dayIndex].length === 0 ? (
                    <p className="text-sm text-ink-3 text-center py-4">{t("admin.timetable.noPeriods")}</p>
                  ) : (
                    <div className="space-y-2">
                      {slotsByDay[dayIndex].map((slot) => (
                        <div key={slot.id} className="p-3 bg-surface-3 rounded-xl group relative">
                          <div className="flex items-center justify-between mb-1">
                            <Badge tone="violet">{t("admin.timetable.periodN", { n: slot.period_number })}</Badge>
                            <span className="text-xs text-ink-3 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                          </div>
                          <p className="font-medium text-ink dark:text-white">{getSubjectName(slot.subject_id)}</p>
                          <p className="text-sm text-ink-3 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getTeacherName(slot.teacher_id)}
                          </p>
                          <button
                            onClick={() => deleteMutation.mutate(slot.id)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="text-center py-12">
            <GraduationCap className="w-12 h-12 mx-auto text-ink-3 mb-4" />
            <p className="text-ink-3">{t("admin.timetable.selectSectionHint")}</p>
          </Card>
        )
      )}
    </div>
  );
}
