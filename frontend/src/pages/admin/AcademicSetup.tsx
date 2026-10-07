import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchAcademicYears, fetchClasses, fetchSections, fetchSubjects } from "./api";
import {
  Plus, Trash2, Calendar, BookOpen, Users, GraduationCap,
  Sparkles
} from "lucide-react";

interface AcademicYear { id: string; name: string; start_date: string; end_date: string; is_current: boolean; }
interface ClassItem { id: string; name: string; academic_year_id: string; order: number; }
interface Section { id: string; name: string; class_id: string; room_no: string | null; }
interface Subject { id: string; name: string; code: string; }

export default function AcademicSetup() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"years" | "classes" | "sections" | "subjects">("years");
  const [showForm, setShowForm] = useState(false);
  const [seedingYear, setSeedingYear] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [yearForm, setYearForm] = useState({
    name: `${currentYear}-${currentYear + 1}`,
    start_date: `${currentYear}-04-01`,
    end_date: `${currentYear + 1}-03-31`
  });
  const [classForm, setClassForm] = useState({ name: "", academic_year_id: "", order: 0 });
  const [sectionForm, setSectionForm] = useState({ name: "", class_id: "", room_no: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const onCreateError = (err: unknown) => setFormError(err instanceof Error ? err.message : "Failed to save.");

  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const createYear = useMutation({
    mutationFn: async (p: typeof yearForm) => { await api.post("/academics/years", p); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["academic-years"] }); setShowForm(false); setFormError(null); },
    onError: onCreateError,
  });

  const createClass = useMutation({
    mutationFn: async (p: typeof classForm) => { await api.post("/academics/classes", p); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["classes"] }); setShowForm(false); setFormError(null); },
    onError: onCreateError,
  });

  const createSection = useMutation({
    mutationFn: async (p: typeof sectionForm) => { await api.post("/academics/sections", p); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sections"] }); setShowForm(false); setFormError(null); },
    onError: onCreateError,
  });

  const createSubject = useMutation({
    mutationFn: async (p: typeof subjectForm) => { await api.post("/academics/subjects", p); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["subjects"] }); setShowForm(false); setFormError(null); },
    onError: onCreateError,
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/academics/classes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/academics/sections/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sections"] }); },
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/academics/subjects/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["subjects"] }); },
  });

  const seedClasses = useMutation({
    mutationFn: async (yearId: string) => {
      setSeedingYear(yearId);
      const res = await api.post(`/academics/classes/seed?academic_year_id=${yearId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setSeedingYear(null);
    },
    onError: () => { setSeedingYear(null); },
  });

  const getClassName = (id: string) => classesQuery.data?.find((c: ClassItem) => c.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y: AcademicYear) => y.id === id)?.name || id;

  const tabs = [
    { key: "years", label: "Academic Years", icon: Calendar, color: "from-violet-500 to-purple-500" },
    { key: "classes", label: "Classes", icon: GraduationCap, color: "from-blue-500 to-cyan-500" },
    { key: "sections", label: "Sections", icon: Users, color: "from-teal-500 to-emerald-500" },
    { key: "subjects", label: "Subjects", icon: BookOpen, color: "from-pink-500 to-rose-500" },
  ] as const;

  const classCount = classesQuery.data?.length || 0;
  const sectionCount = sectionsQuery.data?.length || 0;

  return (
    <div className="animate-page-enter">
      <PageHeader title="Academic Setup" subtitle="Configure academic structure">
        <Button onClick={() => { setShowForm(!showForm); setFormError(null); }} glow>
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add New</>}
        </Button>
      </PageHeader>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {tabs.map((t) => {
          const count = t.key === "years" ? yearsQuery.data?.length || 0
            : t.key === "classes" ? classCount
            : t.key === "sections" ? sectionCount
            : subjectsQuery.data?.length || 0;
          return (
            <div
              key={t.key}
              onClick={() => { setActiveTab(t.key); setShowForm(false); setFormError(null); }}
              className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                activeTab === t.key
                  ? "bg-gradient-to-br " + t.color + " text-white shadow-xl scale-[1.02]"
                  : "bg-surface border border-line hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              <t.icon className={`w-6 h-6 mb-2 ${activeTab === t.key ? "text-white" : "text-accent-fg"}`} />
              <p className={`text-2xl font-bold ${activeTab === t.key ? "text-white" : "text-ink dark:text-white"}`}>{count}</p>
              <p className={`text-sm ${activeTab === t.key ? "text-white/80" : "text-ink-3"}`}>{t.label}</p>
            </div>
          );
        })}
      </div>

      {/* Forms */}
      {showForm && activeTab === "years" && (
        <Card className="mb-6" gradient>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-fg" /> Add Academic Year
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); createYear.mutate(yearForm); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Name</label>
                <input type="text" value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="2026-2027" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Start Date</label>
                <input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">End Date</label>
                <input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" required />
              </div>
            </div>
            {formError && <p className="text-sm font-medium text-red-600 mb-2">{formError}</p>}
            <Button type="submit" disabled={createYear.isPending} glow>
              {createYear.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              Add Year
            </Button>
          </form>
        </Card>
      )}

      {showForm && activeTab === "classes" && (
        <Card className="mb-6" gradient>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-accent-fg" /> Add Class
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); createClass.mutate(classForm); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Name</label>
                <input type="text" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="Class 10" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Academic Year</label>
                <select value={classForm.academic_year_id} onChange={(e) => setClassForm({ ...classForm, academic_year_id: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" required>
                  <option value="">-- Select --</option>
                  {yearsQuery.data?.map((y: AcademicYear) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Order</label>
                <input type="number" value={classForm.order} onChange={(e) => setClassForm({ ...classForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" />
              </div>
            </div>
            {formError && <p className="text-sm font-medium text-red-600 mb-2">{formError}</p>}
            <Button type="submit" disabled={createClass.isPending} glow>
              {createClass.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              Add Class
            </Button>
          </form>
        </Card>
      )}

      {showForm && activeTab === "sections" && (
        <Card className="mb-6" gradient>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-fg" /> Add Section
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); createSection.mutate(sectionForm); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Name</label>
                <input type="text" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="A" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Class</label>
                <select value={sectionForm.class_id} onChange={(e) => setSectionForm({ ...sectionForm, class_id: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" required>
                  <option value="">-- Select --</option>
                  {classesQuery.data?.map((c: ClassItem) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Room No</label>
                <input type="text" value={sectionForm.room_no} onChange={(e) => setSectionForm({ ...sectionForm, room_no: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" />
              </div>
            </div>
            {formError && <p className="text-sm font-medium text-red-600 mb-2">{formError}</p>}
            <Button type="submit" disabled={createSection.isPending} glow>
              {createSection.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              Add Section
            </Button>
          </form>
        </Card>
      )}

      {showForm && activeTab === "subjects" && (
        <Card className="mb-6" gradient>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent-fg" /> Add Subject
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); createSubject.mutate(subjectForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Name</label>
                <input type="text" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="Mathematics" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Code</label>
                <input type="text" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="MATH" required />
              </div>
            </div>
            {formError && <p className="text-sm font-medium text-red-600 mb-2">{formError}</p>}
            <Button type="submit" disabled={createSubject.isPending} glow>
              {createSubject.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
              Add Subject
            </Button>
          </form>
        </Card>
      )}

      {/* Content Lists */}
      {activeTab === "years" && (
        yearsQuery.isLoading ? <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card> : (
          <div className="space-y-3">
            {yearsQuery.data?.length === 0 ? (
              <Card className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-ink-3 mb-4" />
                <p className="text-ink-3">No academic years yet. Create one to get started.</p>
              </Card>
            ) : yearsQuery.data?.map((y: AcademicYear) => (
              <Card key={y.id} className="hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-ink dark:text-white">{y.name}</p>
                      <p className="text-sm text-ink-3">{y.start_date} to {y.end_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {y.is_current && <Badge tone="green">Current</Badge>}
                    <Button
                      variant="secondary"
                      onClick={() => seedClasses.mutate(y.id)}
                      disabled={seedClasses.isPending}
                    >
                      {seedingYear === y.id ? <Spinner size="sm" /> : <Sparkles className="w-4 h-4" />}
                      Seed Classes
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {activeTab === "classes" && (
        classesQuery.isLoading ? <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card> : (
          <div className="space-y-3">
            {classesQuery.data?.length === 0 ? (
              <Card className="text-center py-12">
                <GraduationCap className="w-12 h-12 mx-auto text-ink-3 mb-4" />
                <p className="text-ink-3 mb-4">No classes yet. Use "Seed Classes" on an academic year to auto-create LKG to 12th.</p>
              </Card>
            ) : classesQuery.data?.sort((a: ClassItem, b: ClassItem) => a.order - b.order).map((c: ClassItem) => (
              <Card key={c.id} className="hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-ink dark:text-white">{c.name}</p>
                      <p className="text-sm text-ink-3">{getYearName(c.academic_year_id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="blue">{sectionsQuery.data?.filter((s: Section) => s.class_id === c.id).length || 0} Sections</Badge>
                    <button
                      onClick={() => { if(confirm("Delete this class and all its sections?")) deleteClass.mutate(c.id); }}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {activeTab === "sections" && (
        sectionsQuery.isLoading ? <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card> : (
          <div className="space-y-3">
            {sectionsQuery.data?.length === 0 ? (
              <Card className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-ink-3 mb-4" />
                <p className="text-ink-3">No sections yet. Create classes first, then add sections.</p>
              </Card>
            ) : sectionsQuery.data?.map((s: Section) => (
              <Card key={s.id} className="hover:shadow-lg transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-ink dark:text-white">{getClassName(s.class_id)} - Section {s.name}</p>
                      {s.room_no && <p className="text-sm text-ink-3">Room: {s.room_no}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => { if(confirm("Delete this section?")) deleteSection.mutate(s.id); }}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {activeTab === "subjects" && (
        subjectsQuery.isLoading ? <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subjectsQuery.data?.length === 0 ? (
              <Card className="col-span-full text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-ink-3 mb-4" />
                <p className="text-ink-3">No subjects yet. Add subjects to assign to classes.</p>
              </Card>
            ) : subjectsQuery.data?.map((s: Subject) => (
              <Card key={s.id} className="hover:shadow-lg transition-all group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-3">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-ink dark:text-white">{s.name}</p>
                    <p className="text-sm text-ink-3">{s.code}</p>
                  </div>
                  <button
                    onClick={() => { if(confirm("Delete this subject?")) deleteSubject.mutate(s.id); }}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
