// DEMO BUILD ONLY. Class -> subject -> chapter data for the syllabus browser, built on the same ids the Copilot demo uses.
import { CAPTURE } from "../copilot/demo/capture";

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

const ctx = () => CAPTURE.TEACHER.context.classes as { id: string; name: string; subjects: { id: string; name: string; chapters: string[] }[] }[];
const sylId = (subjectId: string) => `demo-syl-${subjectId}`;

function chapters(subject: { id: string; chapters: string[] }) {
  return subject.chapters.map((name, i) => ({
    id: `${sylId(subject.id)}-${i}`, syllabus_id: sylId(subject.id), name, order: i + 1,
    description: NOTES[name] ? `Key ideas of ${name}` : null, topics: NOTES[name]?.topics ?? [], content: NOTES[name]?.content ?? null,
  }));
}

export function demoTree() {
  return {
    classes: ctx().map((c) => ({
      id: c.id, name: c.name,
      subjects: c.subjects.map((s) => ({
        id: s.id, name: s.name, syllabus_id: sylId(s.id), title: `${s.name} - ${c.name}`, status: "PUBLISHED",
        chapters: chapters(s).map((ch) => ({ id: ch.id, name: ch.name, description: ch.description, order: ch.order, topics: ch.topics, has_content: !!ch.content })),
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

export function getDemoSyllabusResponse(url: string, params?: Record<string, unknown>): unknown | null {
  const clean = url.replace(/\?.*$/, "");
  if (clean.endsWith("/syllabus/tree")) return demoTree();
  const m = clean.match(/\/syllabus\/(demo-syl-[\w-]+)$/);
  if (m) return demoSyllabus(m[1]);
  if (clean.endsWith("/homework") && params?.subject_id) {
    const subject = ctx().flatMap((c) => c.subjects).find((s) => s.id === params.subject_id);
    const seeded = subject?.name === "Physics"
      ? [{ id: "demo-hw-light", title: "Draw a ray diagram for a plane mirror", chapter: "Light", due_date: "2026-10-12", subject_id: subject.id }]
      : [];
    return { items: [...seeded, ...createdHomework.filter((h) => h.subject_id === params.subject_id)], total: 1, page: 1, page_size: 100 };
  }
  return null;
}

export function postDemoResponse(url: string, data: unknown): unknown | null {
  const clean = url.replace(/\?.*$/, "");
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
