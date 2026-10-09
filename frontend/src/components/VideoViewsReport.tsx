import { useQuery } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { api } from "../api/client";
import { Badge, Card, PageHeader, Spinner } from "./ui";
import { DataTable } from "./DataTable";
import { useLanguage } from "../i18n/LanguageContext";

interface Row {
  syllabus_id: string; class: string; subject: string; chapter: string; language: "en" | "ar";
  views: number; students: number; class_size: number; percent: number;
}

/** School-wide: every chapter video with its views, unique students and the share of the class that finished it. */
export default function VideoViewsReport() {
  const { t, te, fmtNumber } = useLanguage();
  const report = useQuery({ queryKey: ["syllabus", "video-report"], queryFn: async () => (await api.get<{ rows: Row[]; total_views: number }>("/syllabus/video-report")).data });
  const rows = report.data?.rows ?? [];
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.percent, 0) / rows.length) : 0;

  return (
    <div className="animate-page-enter">
      <PageHeader title={t("lead.videoReport.title")} subtitle={t("lead.videoReport.subtitle")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[[t("lead.videoReport.totalViews"), fmtNumber(report.data?.total_views ?? 0)], [t("lead.videoReport.videos"), fmtNumber(rows.length)], [t("lead.videoReport.avgWatched"), `${fmtNumber(avg)}%`]].map(([label, value]) => (
          <Card key={label} gradient><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p><p className="mt-1 text-2xl font-bold text-ink" dir="ltr">{value}</p></Card>
        ))}
      </div>
      {report.isLoading ? <Card className="flex justify-center py-10"><Spinner size="lg" /></Card> : (
        <Card gradient>
          <DataTable
            rowKey={(r) => `${r.syllabus_id}-${r.chapter}-${r.language}`}
            rows={rows}
            emptyLabel={t("lead.videoReport.empty")}
            columns={[
              { header: t("lead.videoReport.class"), cell: (r) => te("class", r.class) },
              { header: t("lead.videoReport.subject"), cell: (r) => te("subject", r.subject) },
              { header: t("lead.videoReport.chapter"), cell: (r) => <span className="inline-flex items-center gap-1.5 font-medium text-ink" dir="auto"><PlayCircle size={14} className="text-accent-fg" />{r.chapter}</span> },
              { header: t("lead.videoReport.language"), cell: (r) => <Badge tone={r.language === "ar" ? "violet" : "blue"}>{t(r.language === "ar" ? "lead.browser.arabic" : "lead.browser.english")}</Badge> },
              { header: t("lead.videoReport.views"), cell: (r) => <span dir="ltr">{fmtNumber(r.views)}</span> },
              { header: t("lead.videoReport.students"), cell: (r) => <span dir="ltr">{fmtNumber(r.students)} / {fmtNumber(r.class_size)}</span> },
              { header: t("lead.videoReport.percent"), cell: (r) => (
                <span className="flex items-center gap-2" dir="ltr">
                  <span className="h-2 w-20 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent" style={{ width: `${r.percent}%` }} /></span>
                  {fmtNumber(r.percent)}%
                </span>
              ) },
            ]}
          />
          <p className="mt-3 text-xs text-ink-3">{t("lead.videoReport.note")}</p>
        </Card>
      )}
    </div>
  );
}
