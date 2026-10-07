import AboutPage from "../../components/AboutPage";
import { BarChart3, Users, FileCheck, Shield, TrendingUp } from "lucide-react";

const features = [
  { icon: BarChart3, text: "View school analytics and reports", color: "from-indigo-500 to-violet-500" },
  { icon: Users, text: "Monitor teacher performance", color: "from-teal-500 to-cyan-500" },
  { icon: FileCheck, text: "Approve leave requests", color: "from-pink-500 to-rose-500" },
  { icon: Shield, text: "Oversee school operations", color: "from-blue-500 to-indigo-500" },
  { icon: TrendingUp, text: "Track academic progress", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  return <AboutPage role="Principal" features={features} />;
}
