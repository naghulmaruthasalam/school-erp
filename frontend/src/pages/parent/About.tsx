import AboutPage from "../../components/AboutPage";
import { Eye, ClipboardCheck, Bell, CreditCard, MessageSquare } from "lucide-react";

const features = [
  { icon: Eye, text: "Track child's academic progress", color: "from-green-500 to-emerald-500" },
  { icon: ClipboardCheck, text: "View attendance records", color: "from-teal-500 to-cyan-500" },
  { icon: Bell, text: "Receive notifications and updates", color: "from-pink-500 to-rose-500" },
  { icon: CreditCard, text: "Pay fees online", color: "from-blue-500 to-indigo-500" },
  { icon: MessageSquare, text: "Communicate with teachers", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  return <AboutPage role="Parent" features={features} />;
}
