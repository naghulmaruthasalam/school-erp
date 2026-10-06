import { Card, PageHeader } from "./ui";
import {
  CheckCircle,
  Mail,
  Globe,
  Sparkles,
  Heart,
  Shield,
  Zap
} from "lucide-react";
import type { ComponentType } from "react";

interface Feature {
  icon: ComponentType<{ className?: string }>;
  text: string;
  color: string;
}

interface AboutPageProps {
  role: string;
  features: Feature[];
}

const highlights = [
  { icon: Zap, title: "AI Powered", desc: "Smart insights & automation" },
  { icon: Shield, title: "Secure", desc: "Enterprise-grade security" },
  { icon: Heart, title: "User Friendly", desc: "Intuitive interface" },
];

export default function AboutPage({ role, features }: AboutPageProps) {
  return (
    <div className="animate-page-enter">
      <PageHeader title="About" subtitle="Cogniitec AI School ERP System" />

      {/* Hero Section */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#6D28D9] via-[#8B5CF6] to-[#EC4899] p-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/30 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-float">
              <img src="/logo.png" alt="Cognitec" className="w-16 h-16 object-contain" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="text-white/80 text-sm font-medium px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
                Version 1.0.0
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Cogniitec AI School ERP</h1>
            <p className="text-white/80 max-w-lg">
              A comprehensive, AI-powered school management system designed to streamline educational operations.
            </p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {highlights.map((item, i) => (
          <div
            key={i}
            className="group p-4 rounded-2xl bg-gradient-to-br from-white to-[#F7F5FF] dark:from-[#1B1230] dark:to-[#2D1B4E] border border-[#E5DDF5] dark:border-[#2D1B4E] hover:shadow-xl hover:shadow-[#6D28D9]/10 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <item.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-[#24113F] dark:text-white">{item.title}</h3>
            <p className="text-sm text-[#7C6F95]">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Features Card */}
        <Card gradient className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6D28D9]/10 to-[#EC4899]/10 rounded-full -mr-16 -mt-16" />

          <h3 className="font-bold text-xl text-[#24113F] dark:text-white mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            {role} Features
          </h3>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-[#F7F5FF] dark:hover:bg-[#2D1B4E] transition-all duration-300 cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#4B4260] dark:text-[#D8CCEA] font-medium">{feature.text}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact Card */}
        <Card gradient className="relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-[#EC4899]/10 to-[#6D28D9]/10 rounded-full -ml-16 -mb-16" />

          <h3 className="font-bold text-xl text-[#24113F] dark:text-white mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EC4899] to-[#F472B6] flex items-center justify-center">
              <Mail className="w-4 h-4 text-white" />
            </span>
            Contact & Support
          </h3>

          <div className="space-y-6">
            <a
              href="mailto:support@cogniitec.com"
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#F7F5FF] to-white dark:from-[#2D1B4E] dark:to-[#1B1230] border border-[#E5DDF5] dark:border-[#2D1B4E] hover:border-[#8B5CF6] transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#7C6F95]">Email Support</p>
                <p className="text-[#24113F] dark:text-white font-semibold">support@cogniitec.com</p>
              </div>
            </a>

            <a
              href="https://www.cogniitec.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#F7F5FF] to-white dark:from-[#2D1B4E] dark:to-[#1B1230] border border-[#E5DDF5] dark:border-[#2D1B4E] hover:border-[#8B5CF6] transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#7C6F95]">Website</p>
                <p className="text-[#24113F] dark:text-white font-semibold">www.cogniitec.com</p>
              </div>
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E5DDF5] dark:border-[#2D1B4E]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#7C6F95]">
                &copy; {new Date().getFullYear()} Cogniitec Technologies
              </p>
              <div className="flex items-center gap-1 text-sm text-[#7C6F95]">
                Made with <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" /> in India
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
