import { useEffect } from "react";
import { Select } from "../components/ui";
import type { CopilotContextOptions, StudyContextSel } from "./api";

/** Class / subject / chapter pickers (and the child picker for parents), limited by the server to what the
 * signed-in user is allowed to use. A single class (a student, or a parent with one child) is picked for them. */
export default function ContextPicker({
  options,
  value,
  onChange,
  requireSubject = false,
  requireChapter = false,
  showChapter = true,
}: {
  options: CopilotContextOptions;
  value: StudyContextSel;
  onChange: (next: StudyContextSel) => void;
  requireSubject?: boolean;
  requireChapter?: boolean;
  showChapter?: boolean;
}) {
  const { classes, children } = options;
  const hasChildren = children.length > 0;

  useEffect(() => {
    // Pre-select the only possible choice so a student never has to pick their own class.
    if (hasChildren && children.length === 1 && !value.studentId) {
      onChange({ studentId: children[0].id, classId: children[0].class_id });
    } else if (!hasChildren && classes.length === 1 && !value.classId) {
      onChange({ classId: classes[0].id });
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const klass = classes.find((c) => c.id === value.classId);
  const subject = klass?.subjects.find((s) => s.id === value.subjectId);
  const showClass = !hasChildren && classes.length > 1;

  return (
    <div className="grid grid-cols-2 gap-2">
      {hasChildren && children.length > 1 && (
        <Select
          className="col-span-2 !min-h-9 !py-1.5 text-[13px]"
          value={value.studentId ?? ""}
          onChange={(e) => {
            const child = children.find((c) => c.id === e.target.value);
            onChange(child ? { studentId: child.id, classId: child.class_id } : {});
          }}
          aria-label="Child"
        >
          <option value="">Choose a child…</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {showClass && (
        <Select
          className="col-span-2 !min-h-9 !py-1.5 text-[13px]"
          value={value.classId ?? ""}
          onChange={(e) => onChange({ classId: e.target.value || undefined })}
          aria-label="Class"
        >
          <option value="">Choose a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Select
        className={`!min-h-9 !py-1.5 text-[13px] ${showChapter ? "" : "col-span-2"}`}
        value={value.subjectId ?? ""}
        disabled={!klass}
        onChange={(e) => onChange({ ...value, subjectId: e.target.value || undefined, chapter: undefined })}
        aria-label="Subject"
      >
        <option value="">{requireSubject ? "Choose a subject…" : "Any subject"}</option>
        {klass?.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      {showChapter && (
        <Select
          className="!min-h-9 !py-1.5 text-[13px]"
          value={value.chapter ?? ""}
          disabled={!subject}
          onChange={(e) => onChange({ ...value, chapter: e.target.value || undefined })}
          aria-label="Chapter"
        >
          <option value="">{requireChapter ? "Choose a chapter…" : "Whole subject"}</option>
          {subject?.chapters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
