// Demo mode: everything below runs in the browser with sample data, no server. The UI is the same as with a real login.
/* eslint-disable */
import { authStore } from "../../auth/store";
import type { CopilotContextOptions, CopilotProfile, CopilotSession, Mode, SessionSummary, StudyContextSel } from "../api";
import { saveDemoFile } from "../../api/demoCopilotTools";
import { CAPTURE } from "./capture";

// ============================ DEMO BUILD: everything below runs in the browser, no server ============================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const roleKey = () => (authStore.getState().user?.role ?? "STUDENT") as string;
const sessions = new Map<string, CopilotSession & { updated: string }>();
let seq = 1;

export const fetchProfile = async (): Promise<CopilotProfile> => { await sleep(150); return CAPTURE[roleKey()].profile; };
export const fetchContext = async (): Promise<CopilotContextOptions> => { await sleep(150); return CAPTURE[roleKey()].context; };
export const listSessions = async (): Promise<SessionSummary[]> =>
  [...sessions.values()].sort((a, b) => b.updated.localeCompare(a.updated)).map((s) => ({
    id: s.id, mode: s.mode, title: s.title, label: s.label, message_count: s.messages.length, updated_at: s.updated,
  }));
export const getSession = async (id: string) => sessions.get(id)!;
export const deleteSession = async (id: string) => { sessions.delete(id); };

function names(ctx: StudyContextSel) {
  const c = CAPTURE[roleKey()].context;
  const klass = c.classes.find((k: any) => k.id === ctx.classId);
  const subject = klass?.subjects.find((s: any) => s.id === ctx.subjectId);
  return { klass: klass?.name as string | undefined, subject: subject?.name as string | undefined, chapter: ctx.chapter };
}

export async function startSession(mode: Mode, language: string, ctx: StudyContextSel): Promise<CopilotSession> {
  await sleep(200);
  const p: CopilotProfile = CAPTURE[roleKey()].profile;
  const n = names(ctx);
  const label = mode === "study" ? [n.klass, n.subject, n.chapter].filter(Boolean).join(" · ") : null;
  const welcome = mode === "school"
    ? `Hi! I'm your ${p.title}. Ask me about your own school information, for example attendance, homework, timetable or results.`
    : `Hi! I'm your ${p.title}. I've loaded ${label}. ${p.tagline}. What would you like to do?`;
  const id = `demo-${seq++}`;
  const s = { id, mode, title: null, language, label, context: { class_id: ctx.classId ?? null, subject_id: ctx.subjectId ?? null, chapter: ctx.chapter ?? null, student_id: ctx.studentId ?? null },
    messages: [{ role: "assistant" as const, content: welcome }], updated: new Date().toISOString() };
  sessions.set(id, s);
  return s;
}

// ---------------------------------------------------------------------------------------------- study answers
const TOPIC: Record<string, { gist: string; formula: string; example: string; mistake: string; activity: string }> = {
  Light: { gist: "Light travels in straight lines and changes direction when it reflects off a surface or bends (refracts) as it enters another material.", formula: "Mirror formula: $\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}$, and refractive index $n = \\frac{c}{v}$", example: "A spoon looks bent in a glass of water because light bends as it leaves the water.", mistake: "Students often think the image in a plane mirror is smaller or flipped top to bottom; it is the same size and only laterally inverted.", activity: "Place a pencil in a glass of water and have pairs sketch what they see, then explain it with refraction." },
  Electricity: { gist: "Electric current is the flow of charge. Voltage pushes the charge, and resistance opposes the flow.", formula: "Ohm's law: $V = IR$, and power $P = VI = I^2R$", example: "A thin wire on a heater glows because it has high resistance, so it turns more electrical energy into heat.", mistake: "Many students think current gets 'used up' in a bulb; the same current leaves the bulb, it is energy that is transferred.", activity: "Build a simple series and parallel circuit with bulbs and compare brightness." },
  "Real Numbers": { gist: "Real numbers include rationals and irrationals. Every composite number can be written as a product of primes in exactly one way.", formula: "$\\text{HCF}(a,b) \\times \\text{LCM}(a,b) = a \\times b$", example: "To tile a 12 m by 18 m floor with the largest square tiles, find $\\text{HCF}(12,18)=6$, so 6 m tiles.", mistake: "Students assume the sum of two irrationals is always irrational; $\\sqrt2 + (-\\sqrt2) = 0$.", activity: "Prime-factor tree race: groups factor numbers and find HCF and LCM." },
  Polynomials: { gist: "A polynomial is a sum of terms like $ax^n$. Its zeroes are the x-values where the graph crosses the x-axis.", formula: "For $ax^2+bx+c$: sum of zeroes $=-\\frac{b}{a}$, product $=\\frac{c}{a}$", example: "$x^2-5x+6$ has zeroes 2 and 3: the sum is 5 and the product is 6.", mistake: "Students mix up the signs in $-\\frac{b}{a}$; check with a quick example.", activity: "Graph a few quadratics and mark where each crosses the x-axis." },
  "Quadratic Equations": { gist: "A quadratic equation has the form $ax^2+bx+c=0$ and can have two, one or no real roots.", formula: "$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$, with discriminant $D=b^2-4ac$", example: "$x^2-7x+12=0$ factors as $(x-3)(x-4)=0$, so $x=3$ or $x=4$.", mistake: "Forgetting the $\\pm$ and giving only one root.", activity: "Roots-or-not cards: students predict from $D$ before solving." },
  Trigonometry: { gist: "Trigonometric ratios relate the angles of a right triangle to the ratios of its sides.", formula: "$\\sin\\theta = \\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos\\theta=\\frac{\\text{adjacent}}{\\text{hypotenuse}}$, $\\sin^2\\theta+\\cos^2\\theta=1$", example: "A 10 m ladder at $30^\\circ$ reaches $10\\sin30^\\circ = 5$ m up the wall.", mistake: "Using the wrong side as 'opposite' when the reference angle changes.", activity: "Measure the height of the school flagpole with a clinometer and ratios." },
  "Linear Equations": { gist: "A pair of linear equations describes two straight lines. Their intersection is the solution, if there is one.", formula: "Substitution or elimination; the lines are parallel when $\\frac{a_1}{a_2}=\\frac{b_1}{b_2}\\neq\\frac{c_1}{c_2}$", example: "Two taxi plans compared: the point where the costs are equal is the solution.", mistake: "Subtracting equations without aligning like terms.", activity: "Plot two plans on graph paper and find where they meet." },
  "Magnetic Effects": { gist: "A current-carrying wire creates a magnetic field, and a wire in a magnetic field feels a force.", formula: "Force on a conductor: $F = BIL\\sin\\theta$", example: "An electric motor spins because the coil feels opposite forces on its two sides.", mistake: "Thinking field lines cross; they never do.", activity: "Iron filings around a current-carrying wire to reveal the field." },
  "Sources of Energy": { gist: "Energy sources are renewable (solar, wind, hydro) or non-renewable (coal, petroleum), with different costs and impacts.", formula: "Efficiency $=\\frac{\\text{useful output}}{\\text{total input}}\\times 100\\%$", example: "A solar cooker uses sunlight directly and needs no fuel.", mistake: "Calling any source that 'lasts long' renewable.", activity: "Class debate: which source suits our town best?" },
};
const GENERIC = { gist: "This topic builds step by step: first the key definitions, then how they connect, then worked examples.", formula: "", example: "Think of a situation from daily life where this idea shows up.", mistake: "Skipping the definitions and jumping straight to formulas.", activity: "Pair discussion followed by a short worked example on the board." };

function study(role: string, msg: string, n: ReturnType<typeof names>): string {
  const t = (n.chapter && TOPIC[n.chapter]) || GENERIC;
  const topic = n.chapter ?? n.subject ?? "this subject";
  const m = msg.toLowerCase();
  const eq = t.formula ? `\n\n**Key idea:** ${t.formula}` : "";
  if (/story/.test(m)) return `## A little story about ${topic}\nOnce upon a time, a curious student named Asha wondered about **${topic}**.\n\n${t.gist}\n\nThat evening she saw it herself: ${t.example}\n\n*Beyond the notes:* stories like this are a memory trick, not part of the textbook.\n\n**Takeaway:** ${t.gist.split(".")[0]}.`;
  if (role === "TEACHER" && /homework/.test(m)) return `Open the **Tools** tab and choose **Homework ideas** for ${topic}: you get a few tasks that don't repeat what this chapter already has, and each one has a **Create this homework** button.`;
  if (/quiz|test me|practice/.test(m)) return `Happy to! Open the **Tools** tab and choose **Practice quiz** for ${topic}: pick how many questions and how hard, and you get answers with explanations.`;
  if (role === "PARENT") {
    if (/support|help|revise|activit|practis/.test(m))
      return `## Helping with ${topic} at home\n- **Ask, don't tell:** "Can you explain ${topic} to me like I'm 8?" Listening to the explanation shows what is solid.\n- **Link it to daily life:** ${t.example}\n- **Keep it short:** 15 focused minutes beat an hour of worry.\n- **Watch for:** ${t.mistake}\n\nWant a simple 3-day practice routine?`;
    return `## ${topic} in plain words\n${t.gist}${eq}\n\n**A real-life picture:** ${t.example}\n\n**How you can help:** ask your child to teach this back to you in their own words, and praise the effort.`;
  }
  if (role === "TEACHER") {
    if (/misconception|mistake/.test(m)) return `## Common misconceptions: ${topic}\n- ${t.mistake}\n- Students memorise the formula without the meaning. Ask "what does each symbol stand for?" before using it.\n\n**A quick check question:** "Predict first, then compute." Compare predictions with results.`;
    if (/activity|hands-on/.test(m)) return `## A hands-on activity for ${topic}\n${t.activity}\n\n**Timing:** 10 min set-up, 15 min exploration, 10 min debrief.\n**Debrief prompts:** What did you expect? What surprised you? Which idea explains it?`;
    return `## ${topic}: a teaching summary\n${t.gist}${eq}\n\n**Analogy / hook:** ${t.example}\n**Watch for:** ${t.mistake}\n\nNeed a worksheet, lesson plan or class quiz? Open the **Tools** tab.`;
  }
  // student
  if (/example|real.?life/.test(m)) return `## A real-life example\n${t.example}\n\nCan you think of another place you have seen this? Tell me and I'll check it with you.`;
  if (/hard|stuck|help me understand|confus/.test(m)) return `No problem, let's go slowly.\n\n**Step 1.** ${t.gist}\n\n**Step 2.** Try this: ${t.example}\n\nWhat part still feels fuzzy: the idea, or using the formula? Tell me and we'll do that bit together.`;
  return `## ${topic}, simply\n${t.gist}${eq}\n\n**Example:** ${t.example}\n\n| Remember | Why it matters |\n|---|---|\n| The idea | Makes formulas easy to recall |\n| One worked example | Shows how to apply it |\n\nWant a quick quiz on this chapter?`;
}

function school(role: string, msg: string): string {
  const replies: Record<string, string> = CAPTURE[role].school;
  const exact = replies[msg.trim()];
  if (exact) return exact;
  const m = msg.toLowerCase();
  const pick = (re: RegExp) => Object.entries(replies).find(([q]) => re.test(q.toLowerCase()))?.[1];
  const hit = (/attend|absent|present/.test(m) && pick(/attend|absent/)) || (/homework|assign|due|pending|submission/.test(m) && pick(/homework|submission/)) ||
    (/timetable|schedule|class(es)? (do|today)|today/.test(m) && pick(/timetable|classes|today/)) || (/exam|result|marks/.test(m) && pick(/exam|result/)) ||
    (/fee|due|pay/.test(m) && pick(/fee/)) || (/event|holiday|calendar/.test(m) && pick(/event/));
  return hit || "I can answer questions about your own school information: attendance, homework, timetable, exams, fees and events. Try one of the suggestions above.";
}

function reply(session: CopilotSession, message: string): string {
  const m = message.toLowerCase();
  if (/badword|porn|hack the|kill/.test(m)) return "I can't help with that. This chat is for school and study topics only, so let's get back to that whenever you're ready.";
  if (/football|cricket score|movie|celebrity|recipe|bitcoin|who won/.test(m)) return "I can only help with school and study topics, so let's get back to that whenever you're ready.";
  const role = roleKey();
  if (session.mode === "school") return school(role, message);
  return study(role, message, names({ classId: session.context.class_id ?? undefined, subjectId: session.context.subject_id ?? undefined, chapter: session.context.chapter ?? undefined }));
}

async function finish(id: string, message: string, text: string) {
  const s = sessions.get(id)!;
  if (!s.title) s.title = message.slice(0, 60);
  s.messages.push({ role: "user", content: message }, { role: "assistant", content: text });
  s.updated = new Date().toISOString();
}

export async function sendMessage(sessionId: string, message: string) {
  await sleep(500);
  const text = reply(sessions.get(sessionId)!, message);
  await finish(sessionId, message, text);
  return { reply: text, title: sessions.get(sessionId)!.title };
}

export async function streamMessage(sessionId: string, message: string, onChunk: (text: string) => void): Promise<string | null> {
  await sleep(450);
  const text = reply(sessions.get(sessionId)!, message);
  for (let i = 0; i < text.length; i += 9) { onChunk(text.slice(i, i + 9)); await sleep(22); }
  await finish(sessionId, message, text);
  return sessions.get(sessionId)!.title;
}

// ---------------------------------------------------------------------------------------------- tools
const QUIZ: Record<string, any[]> = {
  Light: [
    { type: "mcq", question: "A ray of light going from air into water bends. This is called:", options: ["Reflection", "Refraction", "Diffraction", "Dispersion"], answer: "Refraction", explanation: "Refraction is the bending of light as it passes between materials of different density." },
    { type: "mcq", question: "The image formed by a plane mirror is:", options: ["Real and inverted", "Virtual and upright", "Real and magnified", "Virtual and diminished"], answer: "Virtual and upright", explanation: "A plane mirror forms a virtual, upright image of the same size." },
    { type: "mcq", question: "If $u=-20$ cm and $f=-10$ cm for a concave mirror, the image distance $v$ is:", options: ["-20 cm", "-10 cm", "+20 cm", "-40 cm"], answer: "-20 cm", explanation: "$\\frac1v=\\frac1f-\\frac1u=-\\frac1{10}+\\frac1{20}=-\\frac1{20}$, so $v=-20$ cm." },
    { type: "short", question: "State the relation between refractive index $n$, the speed of light in vacuum $c$ and in the medium $v$.", answer: "$n = c / v$", explanation: "The refractive index is the ratio of the speed of light in vacuum to its speed in the medium." },
    { type: "short", question: "Why does a pencil look bent in a glass of water?", answer: "Because light refracts as it leaves the water.", explanation: "The change in speed at the boundary bends the rays, shifting the apparent position." },
  ],
  "Real Numbers": [
    { type: "mcq", question: "$\\text{HCF}(12, 18)$ is:", options: ["2", "3", "6", "36"], answer: "6", explanation: "$12=2^2\\cdot3$, $18=2\\cdot3^2$, so the HCF is $2\\cdot3=6$." },
    { type: "mcq", question: "Which of these is irrational?", options: ["$\\sqrt{16}$", "$\\sqrt{2}$", "$0.25$", "$\\frac{3}{7}$"], answer: "$\\sqrt{2}$", explanation: "$\\sqrt2$ cannot be written as a fraction of integers." },
    { type: "short", question: "If $\\text{HCF}(a,b)=4$ and $\\text{LCM}(a,b)=48$ and $a=12$, find $b$.", answer: "16", explanation: "$a\\times b = \\text{HCF}\\times\\text{LCM}=192$, so $b=192/12=16$." },
  ],
  Electricity: [
    { type: "mcq", question: "The unit of resistance is:", options: ["Volt", "Ampere", "Ohm", "Watt"], answer: "Ohm", explanation: "Resistance is measured in ohms ($\\Omega$)." },
    { type: "mcq", question: "A 6 V battery drives a current of 2 A. The resistance is:", options: ["12 Ω", "3 Ω", "4 Ω", "8 Ω"], answer: "3 Ω", explanation: "$R=V/I=6/2=3\\,\\Omega$." },
    { type: "short", question: "Write the formula for electrical power in terms of $I$ and $R$.", answer: "$P = I^2 R$", explanation: "From $P=VI$ and $V=IR$." },
  ],
};
const GENERIC_QUIZ = (s: string, c: string) => [
  { type: "mcq", question: `Which statement best describes the main idea of "${c}"?`, options: ["A key definition from the chapter", "Something unrelated", "A historical date", "A random fact"], answer: "A key definition from the chapter", explanation: `Start with the chapter's central definition in ${s}.` },
  { type: "short", question: `In your own words, explain one important idea from "${c}".`, answer: "Any accurate idea with an example.", explanation: "Good answers use the chapter's vocabulary and give one example." },
  { type: "short", question: `Give a real-life example connected to "${c}".`, answer: "Any relevant everyday example.", explanation: "Linking ideas to daily life shows understanding." },
];


export async function runTool<T = Record<string, unknown>>(key: string, ctx: StudyContextSel, params: Record<string, unknown>, _language: string): Promise<T> {
  await sleep(900);
  const n = names(ctx);
  const chapter = n.chapter ?? n.subject ?? "this subject";
  const out = (v: unknown) => v as T;
  if (key === "quiz") {
    const count = Number(params.count ?? 5);
    const base = (n.chapter && QUIZ[n.chapter]) || GENERIC_QUIZ(n.subject ?? "the subject", chapter);
    const type = String(params.question_type ?? "mixed");
    const filtered = type === "mixed" ? base : base.filter((q) => q.type === type);
    return out({ title: `${n.subject}: ${chapter} (${params.difficulty ?? "medium"})`, questions: (filtered.length ? filtered : base).slice(0, count) });
  }
  if (key === "study_plan") {
    const days = Number(params.days ?? 7);
    const items = ["Algebra practice set 4 (due soon)", "Essay: My favourite season", "Pendulum lab report", "Periodic table revision", "Mid-Term exam revision"];
    const body = Array.from({ length: days }, (_, i) => `### Day ${i + 1}\n- ${items[i % items.length]}${i % 3 === 2 ? "\n- Light day: 15 minutes of reading and a short walk" : `\n- ${["Physics", "Mathematics", "English", "Chemistry"][i % 4]} revision: ${Number(params.minutes_per_day ?? 60) - 20} min`}`).join("\n\n");
    return out({ title: `${days}-day study plan`, content: `Here is a plan around your pending homework and the Mid-Term exam in 15 days.\n\n${body}\n\nYou've got this. Small steps every day beat a last-minute rush!` });
  }
  if (key === "child_report") {
    const child = CAPTURE.PARENT.context.children[0].name;
    return out({ title: `Progress summary: ${child}`, facts: { pending_homework: 4, invoices: 2, exams_with_results: 1 },
      content: `## How things look\n- **Attendance:** about 83% over the last 30 days (9 present, 1 late, 2 absent).\n- **Homework:** 4 items are pending, the nearest due in 2 days.\n- **Results:** one exam result available; the details are in the Exams page.\n\n## What's going well\nSteady attendance and homework mostly submitted on time.\n\n## Where to help\nTwo absences this month: a short chat about what was missed would help.\n\n## Simple ways to support at home this week\n1. Ask ${child.split(" ")[0]} to explain one topic aloud for 2 minutes.\n2. Keep a fixed 30-minute study slot after dinner.\n3. Check the homework list together on Sunday evening.\n\n*Based only on data in the school system. Fees: two invoices exist, see the Fees page for what is outstanding.*` });
  }
  if ((key === "worksheet" || key === "lesson_plan") && params.step === "finalize") {
    const h = (params.header ?? {}) as Record<string, string>;
    const title = key === "worksheet" ? `Homework worksheet: ${n.chapter ?? n.subject}` : `Lesson plan: ${n.chapter ?? n.subject}`;
    const slots = (params.slots as { date: string; topic: string; minutes_allocated: number; sequence: { label: string; minutes: number; description: string }[]; teacher_note: string }[] | undefined) ?? [];
    const body = params.content != null ? String(params.content)
      : slots.map((x) => `## ${x.date}: ${x.topic} (${x.minutes_allocated} min)\n` + x.sequence.map((st) => `- ${st.label} (${st.minutes} min): ${st.description}`).join("\n") + `\nTeacher note: ${x.teacher_note}\n`).join("\n");
    return out(saveDemoFile(key, title, [h.school_name, h.teacher_name].filter(Boolean).join("\n") + "\n\n" + body, String(params.export_format ?? "pdf")));
  }
  if (key === "worksheet") {
    const topics = ((n.chapter && TOPIC[n.chapter]) ? [n.chapter + ": core ideas", n.chapter + ": applications", n.chapter + ": common mistakes"] : [chapter + ": definitions", chapter + ": examples"]);
    if (params.step === "topics") return out({ step: "topics", chapter, topics: topics.map((t, i) => ({ topic: t, description: ["The key definitions and formulas", "Using them in problems and daily life", "Spotting and fixing frequent errors"][i] ?? "Key points", suggested_activities: ["Fill in the Blanks", "Short-Answer Questions", "Explain the Process", "Match the Following"].slice(0, 3 + (i % 2)) })) });
    const sel = (params.selected_topics as any[]) ?? [];
    const md = sel.map((s) => `## ${s.topic}\n` + (s.activities as string[]).map((a, j) => `${j + 1}. **${a}:** ${["Complete the statement using the right term: ________.", "Explain in 2 to 3 sentences, with an example.", "Describe each step in order.", "Match each term with its meaning."][j % 4]}`).join("\n") + "\n\n---").join("\n\n");
    return out({ step: "generate", chapter, title: `Worksheet: ${chapter}`, content: md });
  }
  if (key === "lesson_plan") {
    const topics = ["Introduction and hook", `${chapter}: core ideas`, `${chapter}: worked examples`, "Practice and review"];
    if (params.step === "topics") return out({ step: "topics", chapter, topics });
    const list = (params.topics as string[]) ?? topics;
    const dates = (params.teaching_dates as { date: string; minutes: number }[]).slice().sort((a, b) => a.date.localeCompare(b.date));
    const per = Math.max(1, Math.ceil(list.length / dates.length));
    const slots = dates.map((d, i) => {
      const chunk = list.slice(i * per, (i + 1) * per);
      const m = d.minutes, h = Math.round(m * 0.25), t = Math.round(m * 0.45);
      return { date: d.date, topic: chunk.join(" + ") || "Revision", minutes_allocated: m, session_type: i === 0 ? "Introduction" : i === dates.length - 1 ? "Review" : "Application",
        sequence: [{ label: "Hook", minutes: h, description: "Open with a quick, concrete question or demonstration that makes students predict an outcome, then collect two or three ideas aloud." },
          { label: "Teach", minutes: t, description: `Explain ${chunk[0] ?? "the topic"} step by step with one worked example on the board, pausing to check understanding with a thumbs-up or thumbs-down.` },
          { label: "Practice", minutes: m - h - t, description: "Pairs solve two graded problems; circulate and note the most common slip to address in the closing minutes." }],
        teacher_note: `Common misconception: students memorise the rule without the reason. Ask "why does this work?" before moving on. Link back to the previous session's key idea and preview the next one.`, pacing_flag: null };
    });
    const uncovered = list.slice(dates.length * per);
    return out({ step: "schedule", chapter, slots, all_topics_covered: uncovered.length === 0, uncovered_topics: uncovered,
      buffer_notice: uncovered.length ? `This chapter needs more time: ${uncovered.length} topic(s) (${uncovered.join(", ")}) won't be covered. Add another teaching day or extend the dates.` : null,
      surplus_notice: null });
  }
  if (key === "parent_note") {
    const who = String(params.student_name || "your child");
    return out({ title: "Message to parent", content: `Dear Parent,\n\nI wanted to share a quick note about ${who}. ${params.details ? String(params.details) : "They have been working well in class."} I'd be glad to talk if you have any questions, and I appreciate your support at home.\n\nWarm regards,\n${authStore.getState().user?.full_name ?? "Class Teacher"}` });
  }
  if (key === "explain") {
    const style = String(params.style ?? "simple");
    const t = (n.chapter && TOPIC[n.chapter]) || GENERIC;
    const what = String(params.concept || "").trim() || chapter;
    const body: Record<string, string> = {
      simple: `## ${what}, in simple words\n${t.gist}\n\n**Think of it like this:** ${t.example}\n\n*Remember:* start with the idea, then the formula.`,
      story: `## The story of ${what}\nOnce upon a time, in a small town called Learnville, a curious girl named Meera wondered about **${what}**.\n\n${t.gist}\n\nOne evening she saw this for herself: ${t.example} "So *that's* how it works!" she smiled.\n\n**What the story shows:** ${t.gist.split(".")[0]}.`,
      analogy: `## An analogy for ${what}\nImagine ${what} as a school corridor during break: ${t.gist.split(".")[0].toLowerCase()}.\n\n- The corridor is the path everything follows.\n- The crowd is what flows through it.\n\n*Where the analogy stops:* real situations have more details, so check the formula${t.formula ? " " + t.formula : ""}.`,
      example: `## Real-life examples: ${what}\n1. ${t.example}\n2. At home: notice where you have seen this idea in the kitchen or on the road.\n3. At school: look for it in the playground.\n\nCan you add a fourth example of your own?`,
      worked: `## Worked examples: ${what}\n**Example 1.** ${t.example}\n\n**Step 1.** Identify what is given.\n**Step 2.** ${t.formula || "Apply the key idea."}\n**Step 3.** Check the answer makes sense.\n\n**Your turn:** make up one similar example and solve it.`,
      steps: `## ${what}, step by step\n1. ${t.gist.split(".")[0]}.\n2. ${t.example}\n3. ${t.formula || "Practise with one example."}\n4. Avoid this mistake: ${t.mistake}`,
      memory: `## Memory tricks for ${what}\n- **Picture it:** ${t.example}\n- **Say it:** make a short rhyme from "${t.gist.split(".")[0]}".\n- **Self-test:** close the book and explain it in two sentences.`,
    };
    return out({ title: `${({ simple: "In simple words", story: "As a story", analogy: "With an analogy", example: "With real-life examples", worked: "Worked examples", steps: "Step by step", memory: "Memory tricks" } as Record<string, string>)[style]}: ${what}`, content: body[style] ?? body.simple });
  }
  if (key === "homework_ideas") {
    const t = (n.chapter && TOPIC[n.chapter]) || GENERIC;
    const count = Math.min(Number(params.count ?? 3), 3);
    const ideas = [
      { title: `Observe and sketch: ${chapter}`, kind: "practical", minutes: 25, instructions: `1. Find one everyday example of **${chapter}**.\n2. Draw it and label the important parts.\n3. Write two lines explaining it. Hint: ${t.example}`, what_to_check: "A labelled sketch with a correct explanation" },
      { title: `Explain it in your own words`, kind: "written", minutes: 15, instructions: `Write a short paragraph on ${chapter}. ${t.formula ? "Include: " + t.formula : "Use at least three key terms from the chapter."}`, what_to_check: "Correct use of the key terms" },
      { title: `Teach a family member`, kind: "project", minutes: 30, instructions: `Teach someone at home the main idea of ${chapter}. Ask them one question and write down their answer.`, what_to_check: "The student's one-page note of what they taught" },
    ].slice(0, count);
    return out({ title: `Homework ideas: ${chapter}`, content: ideas.map((x, i) => `### ${i + 1}. ${x.title}\n${x.instructions}`).join("\n\n"), ideas,
      context: { class_id: ctx.classId, subject_id: ctx.subjectId, chapter: ctx.chapter } });
  }
  throw new Error("Unknown tool");
}

