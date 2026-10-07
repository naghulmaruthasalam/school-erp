import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { fetchHomeworkList, fetchPendingHomework } from "./api";
import { formatDisplayDate, todayIso } from "./dates";
import { useSubjects } from "./hooks";
import { useSelectedChild } from "./SelectedChildContext";
import type { HomeworkOut } from "./types";
import Markdown from "../../copilot/Markdown";
import { useLanguage } from "../../i18n/LanguageContext";

const PAGE_SIZE = 20;

export default function HomeworkPage() {
  const { t, te } = useLanguage();
  const { selectedChild, selectedChildId } = useSelectedChild();
  const [page, setPage] = useState(1);
  const subjectsQuery = useSubjects();

  const pendingQuery = useQuery({
    queryKey: ["parent", "homework-pending"],
    queryFn: fetchPendingHomework,
    enabled: !!selectedChildId,
  });

  const historyQuery = useQuery({
    queryKey: ["parent", "homework-history", selectedChild?.section_id, page],
    queryFn: () =>
      fetchHomeworkList({ section_id: selectedChild!.section_id, page, page_size: PAGE_SIZE }),
    enabled: !!selectedChild,
  });

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title={t("navigation.homework")} />
        <p className="text-sm text-accent-fg">{t("parent.homework.selectChild")}</p>
      </div>
    );
  }

  const subjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name ?? id);

  const pendingForChild = (pendingQuery.data ?? []).filter((h) => h.student_id === selectedChildId);

  return (
    <div>
      <PageHeader title={t("navigation.homework")} subtitle={t("parent.homework.subtitle", { name: selectedChild.full_name })} />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("parent.homework.pendingCount", { n: pendingForChild.length })}</h2>
        {pendingQuery.isLoading ? (
          <Spinner />
        ) : pendingQuery.error ? (
          <ErrorText>{t("parent.homework.pendingError")}</ErrorText>
        ) : pendingForChild.length === 0 ? (
          <p className="text-sm text-accent-fg">{t("parent.homework.noPending")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {pendingForChild.map((hw) => (
              <li key={hw.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{hw.title}</p>
                  <p className="text-xs text-accent-fg">
                    {t("parent.homework.subjectDue", { subject: subjectName(hw.subject_id), date: formatDisplayDate(hw.due_date) })}
                  </p>
                  {hw.description && <div className="mt-1 text-xs" dir="auto"><Markdown>{hw.description}</Markdown></div>}
                </div>
                <Badge tone={hw.due_date < todayIso() ? "red" : "yellow"}>
                  {hw.due_date < todayIso() ? t("fees.overdue") : t("homework.pending")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">{t("parent.homework.all")}</h2>
      <DataTable<HomeworkOut>
        columns={[
          { header: t("parent.homework.titleCol"), cell: (r) => r.title },
          { header: t("timetable.subject"), cell: (r) => subjectName(r.subject_id) },
          { header: t("parent.homework.assigned"), cell: (r) => formatDisplayDate(r.assigned_date) },
          { header: t("parent.homework.due"), cell: (r) => formatDisplayDate(r.due_date) },
        ]}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(r) => r.id}
        emptyLabel={t("parent.homework.empty")}
      />
      {historyQuery.error && <ErrorText>{t("parent.homework.historyError")}</ErrorText>}
      <Pagination page={page} pageSize={PAGE_SIZE} total={historyQuery.data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
