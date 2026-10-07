import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { fetchTimetable } from "./api";
import { useMyProfile, useSubjects, subjectMap } from "./hooks";
import { DAY_LABELS } from "./types";

export default function StudentTimetable() {
  const { data: profile } = useMyProfile();
  const { data: subjects } = useSubjects();
  const subjects_ = subjectMap(subjects);

  const timetableQuery = useQuery({
    queryKey: ["student", "timetable", profile?.section_id],
    queryFn: () => fetchTimetable(profile!.section_id),
    enabled: !!profile?.section_id,
  });

  const slots = timetableQuery.data ?? [];
  const slotsByDay = DAY_LABELS.map((_, dayIndex) =>
    slots.filter((s) => s.day_of_week === dayIndex).sort((a, b) => a.period_number - b.period_number),
  );

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Your weekly class schedule." />

      {timetableQuery.isLoading ? (
        <Spinner />
      ) : slots.length === 0 ? (
        <Card>
          <p className="text-sm text-accent-fg">No timetable has been published for your section yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAY_LABELS.map((label, dayIndex) => (
            <Card key={label}>
              <h3 className="mb-3 text-sm font-semibold text-ink">{label}</h3>
              {dayIndex === 6 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <span className="text-lg">🌴</span>
                  <p className="text-xs font-medium">Holiday</p>
                </div>
              ) : slotsByDay[dayIndex].length === 0 ? (
                <p className="text-xs text-accent-fg">No periods scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {slotsByDay[dayIndex].map((slot) => (
                    <li key={slot.id} className="rounded-md border border-line bg-violet-50 px-3 py-2 text-xs">
                      <p className="font-medium text-ink">
                        Period {slot.period_number} · {slot.start_time}–{slot.end_time}
                      </p>
                      <p className="text-accent-fg">{subjects_[slot.subject_id]?.name ?? "—"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
