/** Names that come from the database (subjects, classes, sections, statuses...) shown in the reader's language. */
export type EntityKind = "subject" | "class" | "section" | "status" | "role" | "month" | "weekday" | "gender" | "leaveType" | "feeType" | "other";

const SUBJECTS: Record<string, string> = {
  mathematics: "الرياضيات", maths: "الرياضيات", math: "الرياضيات",
  science: "العلوم", "general science": "العلوم العامة",
  physics: "الفيزياء", chemistry: "الكيمياء", biology: "الأحياء",
  english: "اللغة الإنجليزية", "english language": "اللغة الإنجليزية",
  arabic: "اللغة العربية", "arabic language": "اللغة العربية",
  "social studies": "الدراسات الاجتماعية", "social science": "الدراسات الاجتماعية", "social sciences": "الدراسات الاجتماعية",
  geography: "الجغرافيا", history: "التاريخ",
  "islamic education": "التربية الإسلامية", islamic: "التربية الإسلامية", "islamic studies": "التربية الإسلامية",
  "computer science": "علوم الحاسوب", computer: "الحاسوب", ict: "تقنية المعلومات", computers: "الحاسوب",
  "physical education": "التربية البدنية", pe: "التربية البدنية",
  art: "التربية الفنية", "art and craft": "الفنون والحرف", music: "الموسيقى",
  "life skills": "المهارات الحياتية", "moral education": "التربية الأخلاقية", french: "اللغة الفرنسية",
};

const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
const SECTIONS: Record<string, string> = { A: "أ", B: "ب", C: "ج", D: "د", E: "هـ", F: "و" };

const STATUSES: Record<string, string> = {
  present: "حاضر", absent: "غائب", late: "متأخر", excused: "بعذر", "half day": "نصف يوم", "half_day": "نصف يوم", leave: "إجازة",
  pending: "قيد الانتظار", approved: "مقبول", rejected: "مرفوض", cancelled: "ملغى", submitted: "تم التسليم", graded: "تم التقييم",
  draft: "مسودة", published: "منشور", paid: "مدفوع", unpaid: "غير مدفوع", partial: "مدفوع جزئياً", "partially paid": "مدفوع جزئياً", "on leave": "في إجازة", overdue: "متأخر السداد", due: "مستحق",
  active: "نشط", inactive: "غير نشط", open: "مفتوح", closed: "مغلق", completed: "مكتمل", "in progress": "قيد التنفيذ", in_progress: "قيد التنفيذ",
  enrolled: "ملتحق", graduated: "متخرج", transferred: "منقول", "not submitted": "لم يُسلَّم", not_submitted: "لم يُسلَّم",
  scheduled: "مجدول", upcoming: "قادم", ongoing: "جارٍ", result_published: "نُشرت النتيجة", issued: "معار", returned: "مُرجَع", lost: "مفقود",
  new: "جديد", accepted: "مقبول", waitlisted: "قائمة الانتظار", under_review: "قيد المراجعة", "under review": "قيد المراجعة",
};

const ROLES: Record<string, string> = {
  super_admin: "المشرف العام", school_admin: "مدير المدرسة", admin: "مدير المدرسة", principal: "المدير",
  teacher: "معلم", student: "طالب", parent: "ولي أمر", guardian: "ولي أمر", accountant: "محاسب", librarian: "أمين المكتبة", staff: "موظف",
};

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTH_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS: Record<string, string> = {
  monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة", saturday: "السبت", sunday: "الأحد",
  mon: "الاثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة", sat: "السبت", sun: "الأحد",
};
const GENDERS: Record<string, string> = { male: "ذكر", female: "أنثى", m: "ذكر", f: "أنثى", other: "آخر" };
const LEAVE_TYPES: Record<string, string> = { sick: "مرضية", casual: "عارضة", annual: "سنوية", maternity: "أمومة", unpaid: "بدون راتب", emergency: "طارئة", other: "أخرى" };
const FEE_TYPES: Record<string, string> = { tuition: "الرسوم الدراسية", transport: "النقل", library: "المكتبة", exam: "الامتحانات", admission: "القبول", uniform: "الزي المدرسي", lab: "المختبر", activity: "الأنشطة", other: "أخرى" };

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** "Class 6", "Grade 6", "Class 6 - A", "6" -> الصف السادس (keeps any trailing section). Returns null when it isn't a grade name. */
function gradeName(value: string): string | null {
  const m = /^(?:class|grade|std|standard|year)?\s*0?(\d{1,2})(?:\s*[-–]?\s*([A-Za-z]))?$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  const section = m[2] ? ` ${SECTIONS[m[2].toUpperCase()] ?? m[2]}` : "";
  return `الصف ${ORDINALS[n - 1]}${section}`;
}

export function entityLabel(language: "en" | "ar", kind: EntityKind, value: string | null | undefined): string {
  if (value == null || value === "") return "";
  if (language !== "ar") return value;
  const key = norm(value);
  switch (kind) {
    case "subject": return SUBJECTS[key] ?? value;
    case "class": return gradeName(value) ?? value;
    case "section": return SECTIONS[value.trim().toUpperCase()] ?? value;
    case "status": return STATUSES[key] ?? STATUSES[key.replace(/_/g, " ")] ?? value;
    case "role": return ROLES[key.replace(/\s+/g, "_")] ?? value;
    case "month": {
      const i = MONTH_EN.findIndex((m) => key.startsWith(m.slice(0, 3)));
      return i >= 0 ? MONTHS[i] : value;
    }
    case "weekday": return WEEKDAYS[key] ?? value;
    case "gender": return GENDERS[key] ?? value;
    case "leaveType": return LEAVE_TYPES[key.replace(/ leave$/, "")] ?? value;
    case "feeType": return FEE_TYPES[key.replace(/ fee[s]?$/, "")] ?? value;
    default: return SUBJECTS[key] ?? STATUSES[key] ?? gradeName(value) ?? value;
  }
}
