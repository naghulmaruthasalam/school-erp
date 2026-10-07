// DEMO BUILD ONLY. Class -> subject -> chapter data for the syllabus browser, built on the same ids the Copilot demo uses.
import { CAPTURE } from "../copilot/demo/capture";
import { currentLanguage } from "../i18n/LanguageContext";
import { getDemoResponse } from "./demoData";

const NOTES: Record<string, { topics: string[]; content: string }> = {
  Light: { topics: ["Reflection", "Refraction", "Mirrors", "Lenses"], content: "Light travels in straight lines. **Reflection** is when light bounces off a surface; **refraction** is when it bends as it enters another medium.\n\nMirror formula: $\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}$" },
  Electricity: { topics: ["Current", "Potential difference", "Ohm's law", "Resistance"], content: "Electric current is the flow of charge. Ohm's law: $V = IR$." },
  "Magnetic Effects": { topics: ["Magnetic field", "Right-hand rule"], content: "A current-carrying wire produces a magnetic field around it." },
  "Sources of Energy": { topics: ["Renewable", "Non-renewable"], content: "Energy sources are renewable (solar, wind) or non-renewable (coal, petroleum)." },
  "Real Numbers": { topics: ["Euclid's division lemma", "HCF and LCM", "Irrational numbers"], content: "Every composite number is a product of primes in exactly one way. $\\text{HCF} \\times \\text{LCM} = a \\times b$." },
  Polynomials: { topics: ["Zeroes", "Sum and product of zeroes"], content: "For $ax^2+bx+c$ the sum of zeroes is $-\\frac{b}{a}$ and the product is $\\frac{c}{a}$." },
  "Linear Equations": { topics: ["Substitution", "Elimination", "Graphs"], content: "Two linear equations describe two lines; their intersection is the solution." },
  "Quadratic Equations": { topics: ["Factorisation", "Quadratic formula", "Discriminant"], content: "$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$, with discriminant $D = b^2 - 4ac$." },
  Trigonometry: { topics: ["Ratios", "Identities", "Heights and distances"], content: "$\\sin^2\\theta + \\cos^2\\theta = 1$." },
};

// The same chapters in Arabic: the real app stores both editions on one chapter and serves the one the user selected.
const AR: Record<string, { name: string; topics: string[]; content: string }> = {
  Light: { name: "الضوء", topics: ["الانعكاس", "الانكسار", "المرايا", "العدسات"], content: "ينتقل الضوء في خطوط مستقيمة. **الانعكاس** هو ارتداد الضوء عن السطح، و**الانكسار** هو انحناؤه عند دخوله وسطاً آخر.\n\nقانون المرايا: $\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}$" },
  Electricity: { name: "الكهرباء", topics: ["التيار", "فرق الجهد", "قانون أوم", "المقاومة"], content: "التيار الكهربائي هو تدفق الشحنات. قانون أوم: $V = IR$." },
  "Magnetic Effects": { name: "التأثيرات المغناطيسية", topics: ["المجال المغناطيسي", "قاعدة اليد اليمنى"], content: "يولّد السلك الذي يمرّ فيه تيار مجالاً مغناطيسياً حوله." },
  "Sources of Energy": { name: "مصادر الطاقة", topics: ["المتجددة", "غير المتجددة"], content: "مصادر الطاقة إما متجددة (الشمس والرياح) أو غير متجددة (الفحم والنفط)." },
  "Real Numbers": { name: "الأعداد الحقيقية", topics: ["خوارزمية إقليدس", "القاسم المشترك الأكبر والمضاعف المشترك الأصغر", "الأعداد غير النسبية"], content: "كل عدد مركّب هو حاصل ضرب أعداد أولية بطريقة وحيدة. $\\text{HCF} \\times \\text{LCM} = a \\times b$." },
  Polynomials: { name: "كثيرات الحدود", topics: ["الأصفار", "مجموع الأصفار وحاصل ضربها"], content: "في $ax^2+bx+c$ مجموع الأصفار $-\\frac{b}{a}$ وحاصل ضربها $\\frac{c}{a}$." },
  "Linear Equations": { name: "المعادلات الخطية", topics: ["التعويض", "الحذف", "الرسم البياني"], content: "كل معادلتين خطيتين تمثلان مستقيمين، ونقطة تقاطعهما هي الحل." },
  "Quadratic Equations": { name: "المعادلات التربيعية", topics: ["التحليل إلى عوامل", "القانون العام", "المميِّز"], content: "$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ والمميِّز $D = b^2 - 4ac$." },
  Trigonometry: { name: "حساب المثلثات", topics: ["النسب", "المتطابقات", "الارتفاعات والمسافات"], content: "$\\sin^2\\theta + \\cos^2\\theta = 1$." },
};
const ar = () => currentLanguage() === "ar";

const ctx = () => CAPTURE.TEACHER.context.classes as { id: string; name: string; subjects: { id: string; name: string; chapters: string[] }[] }[];
const sylId = (subjectId: string) => `demo-syl-${subjectId}`;

function chapters(subject: { id: string; chapters: string[] }) {
  return subject.chapters.map((name, i) => {
    const a = ar() ? AR[name] : undefined;
    const base = NOTES[name];
    return {
      id: `${sylId(subject.id)}-${i}`, key: name, syllabus_id: sylId(subject.id), name: a?.name ?? name, order: i + 1,
      description: base ? (a ? `الأفكار الرئيسة في ${a.name}` : `Key ideas of ${name}`) : null,
      topics: a?.topics ?? base?.topics ?? [], content: a?.content ?? base?.content ?? null,
      content_language: base ? (a ? "ar" : "en") : null, languages: base ? ["en", "ar"] : [],
    };
  });
}

export function demoTree() {
  return {
    classes: ctx().map((c) => ({
      id: c.id, name: c.name,
      subjects: c.subjects.map((s) => ({
        id: s.id, name: s.name, syllabus_id: sylId(s.id), title: `${s.name} - ${c.name}`, status: "PUBLISHED",
        chapters: chapters(s).map((ch) => ({ id: ch.id, key: ch.key, content_language: ch.content_language, languages: ch.languages, name: ch.name, description: ch.description, order: ch.order, topics: ch.topics, has_content: !!ch.content })),
      })),
    })),
  };
}

function demoSyllabus(id: string) {
  for (const c of ctx()) for (const s of c.subjects) {
    if (sylId(s.id) === id) {
      return { id, school_id: "demo", academic_year_id: "ay", class_id: c.id, subject_id: s.id, title: `${s.name} - ${c.name}`, description: "", status: "PUBLISHED",
        chapters: chapters(s), chapters_count: s.chapters.length, documents: [], created_at: "2026-06-01T00:00:00", updated_at: "2026-06-01T00:00:00" };
    }
  }
  return null;
}

const createdHomework: Record<string, unknown>[] = [];
const submitted = new Set<string>();

/** What the AI marking returns for a student's upload, in the app's language. */
function demoFeedback() {
  const a = ar();
  return {
    status: "ready", total_score: 8, max_score: 10, percentage: 80, grade: "B", language: a ? "ar" : "en", files_checked: ["my-answers.jpg"],
    overall_feedback: a ? "عمل جيد! شرحتَ الفكرة الرئيسة بوضوح، وبقيت لمسات بسيطة لإكمال الإجابة." : "Good work! You explained the main idea clearly. A couple of small things would make the answer complete.",
    strengths: a ? ["تعريف واضح للانعكاس", "رسم مخطط الشعاع بدقة"] : ["Clear definition of reflection", "Neat, accurate ray diagram"],
    areas_to_improve: a ? ["اذكر قانون الانعكاس: زاوية السقوط = زاوية الانعكاس", "ضع أسهماً على الأشعة"] : ["State the law of reflection: angle of incidence = angle of reflection", "Add arrows to the rays"],
    questions: [
      { question_number: 1, student_answer: a ? "الضوء يرتد عن المرآة" : "Light bounces off the mirror", is_correct: true, score: 4, max_score: 5,
        feedback: a ? "إجابة صحيحة، لكنك لم تذكر قانون الانعكاس." : "Correct, but you did not mention the law of reflection.", suggestions: a ? ["أضف: زاوية السقوط تساوي زاوية الانعكاس"] : ["Add: angle of incidence equals angle of reflection"] },
      { question_number: 2, student_answer: a ? "رسم مخطط الشعاع" : "Ray diagram drawn", is_correct: true, score: 4, max_score: 5,
        feedback: a ? "رسم دقيق؛ أضف أسهم الاتجاه." : "Accurate drawing; add direction arrows.", suggestions: [] },
    ],
  };
}

export function getDemoSyllabusResponse(url: string, params?: Record<string, unknown>): unknown | null {
  const clean = url.replace(/\?.*$/, "");
  if (clean.endsWith("/syllabus/tree")) return demoTree();
  const m = clean.match(/\/syllabus\/(demo-syl-[\w-]+)$/);
  if (m) return demoSyllabus(m[1]);
  if (clean.endsWith("/homework/pending")) {
    const all = getDemoResponse("/homework/pending") as { id: string }[];
    return all.filter((h) => !submitted.has(h.id));
  }
  const subs = clean.match(/\/homework\/([\w-]+)\/submissions$/);
  if (subs) return [{ id: `demo-sub-${subs[1]}`, homework_id: subs[1], student_id: undefined, status: submitted.has(subs[1]) ? "SUBMITTED" : "PENDING", attachment_document_ids: [] }];
  if (/\/homework\/submissions\/[\w-]+\/feedback$/.test(clean)) return demoFeedback();
  if (clean.endsWith("/homework") && params?.subject_id) {
    const subject = ctx().flatMap((c) => c.subjects).find((s) => s.id === params.subject_id);
    const seeded = subject?.name === "Physics"
      ? [{ id: "demo-hw-light", title: "Draw a ray diagram for a plane mirror", chapter: "Light", due_date: "2026-10-12", subject_id: subject.id }]
      : [];
    return { items: [...seeded, ...createdHomework.filter((h) => h.subject_id === params.subject_id)], total: 1, page: 1, page_size: 100 };
  }
  return null;
}

export function postDemoResponse(url: string, data: unknown, method = "post"): unknown | null {
  const clean = url.replace(/\?.*$/, "");
  if (method === "post" && clean.endsWith("/uploads")) return { id: `demo-doc-${Date.now()}`, filename: "my-answers.jpg" };
  const patch = clean.match(/\/homework\/submissions\/demo-sub-([\w-]+)$/);
  if (patch) {
    submitted.add(patch[1]);
    return { id: `demo-sub-${patch[1]}`, homework_id: patch[1], status: "SUBMITTED", attachment_document_ids: ["demo-doc"] };
  }
  if (method !== "post") return null;
  if (clean.endsWith("/syllabus/import") && data instanceof FormData) {
    const dry = data.get("dry_run") === "true";
    return {
      academic_year: "2026-2027", dry_run: dry, problems: ["Class 'Class 5' doesn't exist in 2026-2027 (tick 'create missing classes and subjects')"],
      created_classes: [], created_subjects: [],
      totals: { syllabi_created: 1, syllabi_updated: 1, chapters_added: 3, chapters_updated: 2, skipped_groups: 1 },
      syllabi: [
        { class: "Class 10", subject: "Physics", action: "update", chapters_added: 1, chapters_updated: 2, chapters: ["Light", "Electricity", "Sound"] },
        { class: "Class 9", subject: "Mathematics", action: "create", chapters_added: 2, chapters_updated: 0, chapters: ["Quadratic Equations", "Polynomials"] },
      ],
    };
  }
  if (clean.endsWith("/homework") && data && typeof data === "object" && !(data instanceof FormData)) {
    const body = data as Record<string, unknown>;
    const created = { id: `demo-hw-${createdHomework.length + 1}`, teacher_id: "demo", ...body };
    createdHomework.push(created);
    return created;
  }
  return null;
}
