import { Card, PageHeader, Spinner } from "../../components/ui";
import { useLanguage } from "../../i18n/LanguageContext";
import { useMyTimetable, useSections, useSubjects, useClasses } from "./hooks";
import { WEEKDAY_LABELS, type TimetableSlot } from "./types";
import { Calendar, Clock, BookOpen, Users, ChevronRight } from "lucide-react";

const dayColors = [
  "from-violet-500 to-purple-500",
  "from-blue-500 to-cyan-500",
  "from-teal-500 to-emerald-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-violet-500",
  "from-gray-500 to-slate-500",
];

export default function TeacherTimetable() {
  const { t, te } = useLanguage();
  const { data: slots, isLoading } = useMyTimetable();
  const { data: sections } = useSections();
  const { data: subjects } = useSubjects();
  const { data: classes } = useClasses();

  const byDay: Record<number, TimetableSlot[]> = {};
  for (const slot of slots ?? []) {
    (byDay[slot.day_of_week] ??= []).push(slot);
  }
  for (const day of Object.keys(byDay)) {
    byDay[Number(day)].sort((a, b) => a.period_number - b.period_number);
  }

  const totalPeriods = slots?.length ?? 0;
  const uniqueSubjects = new Set(slots?.map(s => s.subject_id)).size;
  const uniqueSections = new Set(slots?.map(s => s.section_id)).size;

  return (
    <div className="animate-page-enter">
      <PageHeader title={t("teacher.timetable.pageTitle")} subtitle={t("teacher.timetable.pageSubtitle")} />

      {isLoading ? (
        <Card className="py-12 flex justify-center">
          <Spinner size="lg" />
        </Card>
      ) : !slots || slots.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/10 to-accent-2/10 flex items-center justify-center animate-float">
            <Calendar className="w-10 h-10 text-accent-fg" />
          </div>
          <h3 className="text-xl font-bold text-ink dark:text-white mb-2">{t("teacher.timetable.noTimetable")}</h3>
          <p className="text-ink-3 max-w-md mx-auto">
            {t("teacher.timetable.noTimetableDesc")}
          </p>
        </Card>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: t("teacher.timetable.totalPeriods"), value: totalPeriods, icon: Clock, color: "from-violet-500 to-purple-500" },
              { label: t("teacher.timetable.subjects"), value: uniqueSubjects, icon: BookOpen, color: "from-teal-500 to-cyan-500" },
              { label: t("teacher.timetable.sections"), value: uniqueSections, icon: Users, color: "from-pink-500 to-rose-500" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="p-5 rounded-2xl bg-surface border border-line hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-3xl font-bold text-ink dark:text-white">{stat.value}</p>
                <p className="text-sm text-ink-3">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Timetable by Day */}
          <div className="space-y-6">
            {WEEKDAY_LABELS.map((label, dow) =>
              byDay[dow] ? (
                <Card key={dow} className="overflow-hidden !p-0">
                  {/* Day Header */}
                  <div className={`bg-gradient-to-r ${dayColors[dow]} p-4`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{te("weekday", label)}</h2>
                        <p className="text-sm text-white/70">{t("teacher.timetable.periodsCount", { n: byDay[dow].length })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Periods List */}
                  <div className="divide-y divide-line dark:divide-line">
                    {byDay[dow].map((slot, i) => {
                      const section = sections?.find((s) => s.id === slot.section_id);
                      const subject = subjects?.find((s) => s.id === slot.subject_id);
                      const cls = section ? classes?.find((c) => c.id === section.class_id) : null;

                      return (
                        <div
                          key={slot.id}
                          className="p-4 hover:bg-surface-3 dark:hover:bg-surface-3 transition-all flex items-center gap-4"
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          {/* Period Number */}
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-accent-fg">{slot.period_number}</span>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Clock className="w-4 h-4 text-ink-3" />
                            <span className="text-sm font-medium text-ink dark:text-white">
                              <span dir="ltr">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                            </span>
                          </div>

                          {/* Subject & Section */}
                          <div className="flex-1">
                            <p className="font-semibold text-ink dark:text-white">
                              {subject ? te("subject", subject.name) : t("teacher.timetable.unknownSubject")}
                            </p>
                            <p className="text-sm text-ink-3">
                              {te("class", cls?.name)} - {section ? te("section", section.name) : t("teacher.timetable.unknownSection")}
                            </p>
                          </div>

                          <ChevronRight className="w-5 h-5 text-ink-3 rtl:-scale-x-100" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
}
