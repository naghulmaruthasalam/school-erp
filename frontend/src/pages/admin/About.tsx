import AboutPage from "../../components/AboutPage";
import { Users, Building2, Calendar, BarChart3, Settings } from "lucide-react";

const features = [
  { icon: Users, text: "Manage teachers and students", color: "from-violet-500 to-purple-500" },
  { icon: Building2, text: "Configure classes and sections", color: "from-teal-500 to-cyan-500" },
  { icon: Calendar, text: "Create timetables and schedules", color: "from-pink-500 to-rose-500" },
  { icon: BarChart3, text: "View analytics and reports", color: "from-blue-500 to-indigo-500" },
  { icon: Settings, text: "Manage school settings", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  return <AboutPage role="School Admin" features={features} />;
}
