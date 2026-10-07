import { PageHeader } from "../../components/ui";
import SyllabusBrowser from "../../components/SyllabusBrowser";
import { useLanguage } from "../../i18n/LanguageContext";

/** The child's class, subject by subject and chapter by chapter, from the syllabus in the database (in the app's language). */
export default function ParentSyllabusPage() {
  const { t } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("parent.syllabus.title")} subtitle={t("parent.syllabus.subtitle")} />
      <SyllabusBrowser role="parent" />
    </div>
  );
}
