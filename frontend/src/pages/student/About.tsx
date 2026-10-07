import AboutPage from "../../components/AboutPage";
import { BookOpen, ClipboardCheck, Calendar, FileText, Bell } from "lucide-react";

const features = [
  { icon: BookOpen, text: "Access course materials and homework", color: "from-violet-500 to-purple-500" },
  { icon: ClipboardCheck, text: "View attendance records", color: "from-teal-500 to-cyan-500" },
  { icon: FileText, text: "Check exam results and marks", color: "from-pink-500 to-rose-500" },
  { icon: Calendar, text: "View class timetable", color: "from-blue-500 to-indigo-500" },
  { icon: Bell, text: "Receive notifications and updates", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  return <AboutPage role="Student" features={features} />;
}
