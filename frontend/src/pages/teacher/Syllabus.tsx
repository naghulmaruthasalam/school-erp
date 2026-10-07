import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, PageHeader, Card, Spinner, Badge } from "../../components/ui";
import { listSyllabus } from "../admin/syllabusApi";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "../admin/api";
import { Plus, Filter, BookOpen, GraduationCap, FileText, Sparkles } from "lucide-react";

export default function TeacherSyllabus() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const syllabusQuery = useQuery({
    queryKey: ["teacher", "syllabus", selectedClass, selectedSubject],
    queryFn: () => listSyllabus({
      class_id: selectedClass || undefined,
      subject_id: selectedSubject || undefined,
    }),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getSubjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  const totalSyllabus = syllabusQuery.data?.items?.length || 0;
  const publishedCount = syllabusQuery.data?.items?.filter((s: any) => s.status === "PUBLISHED").length || 0;

  const stats = [
    { icon: BookOpen, label: "Total Syllabus", value: totalSyllabus, color: "from-violet-500 to-purple-600" },
    { icon: FileText, label: "Published", value: publishedCount, color: "from-emerald-500 to-teal-600" },
    { icon: GraduationCap, label: "Classes", value: classesQuery.data?.length || 0, color: "from-blue-500 to-cyan-600" },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title="Syllabus Management" subtitle="Manage and upload course curriculum">
        <Link to="/teacher/syllabus/new">
          <Button glow className="flex items-center gap-2">
            <Plus size={18} />
            Create Syllabus
          </Button>
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className={`relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl" />
            <s.icon className="w-7 h-7 mb-3 drop-shadow-lg" />
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-white/80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6" gradient>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Filter size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-ink dark:text-white">Filter Syllabus</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-ink dark:text-white mb-2">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all [&>option]:bg-surface [&>option]:dark:bg-surface-3 [&>option]:text-ink [&>option]:dark:text-white"
            >
              <option value="">All Classes</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-ink dark:text-white mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-3 px-4 py-3 text-sm text-ink dark:text-white focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all [&>option]:bg-surface [&>option]:dark:bg-surface-3 [&>option]:text-ink [&>option]:dark:text-white"
            >
              <option value="">All Subjects</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Syllabus List */}
      {syllabusQuery.isLoading ? (
        <Card className="py-16 flex justify-center">
          <Spinner size="lg" />
        </Card>
      ) : syllabusQuery.data?.items?.length === 0 ? (
        <Card className="text-center py-16" gradient>
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-accent-fg" />
            </div>
          </div>
          <p className="text-lg font-bold text-ink dark:text-white mb-2">No syllabus found</p>
          <p className="text-ink-3 mb-6">Create one to get started with your course curriculum.</p>
          <Link to="/teacher/syllabus/new">
            <Button glow>
              <Sparkles className="w-4 h-4" /> Create Your First Syllabus
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {syllabusQuery.data?.items?.map((syllabus: any) => (
            <Card key={syllabus.id} className="hover:shadow-xl transition-all duration-300 group" gradient>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
                    <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <BookOpen className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  <div>
                    <Link to={`/teacher/syllabus/${syllabus.id}`} className="font-bold text-lg text-ink dark:text-white hover:text-accent-fg transition-colors">
                      {syllabus.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-ink-3 flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" /> {getClassName(syllabus.class_id)}
                      </span>
                      <span className="text-ink-3">•</span>
                      <span className="text-sm text-ink-3">{getSubjectName(syllabus.subject_id)}</span>
                      <span className="text-ink-3">•</span>
                      <span className="text-sm text-ink-3">{getYearName(syllabus.academic_year_id)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={syllabus.status === "PUBLISHED" ? "green" : syllabus.status === "DRAFT" ? "amber" : "gray"}>
                    {syllabus.status}
                  </Badge>
                  <Link to={`/teacher/syllabus/${syllabus.id}`}>
                    <Button variant="secondary" className="group-hover:bg-accent group-hover:text-white transition-all">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
