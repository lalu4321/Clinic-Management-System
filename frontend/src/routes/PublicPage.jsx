import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import StatsSection from "@/components/sections/StatsSection";
import AboutSection from "@/components/sections/AboutSection";
import DepartmentsSection from "@/components/sections/DepartmentsSection";
import LeadershipSection from "@/components/sections/LeadershipSection";
import CTASection from "@/components/sections/CTASection";

export default function PublicPage() {
  return (
    <div className="bg-surface-container-lowest min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <AboutSection />
      <DepartmentsSection />
      <LeadershipSection />
      <CTASection />
      <Footer />
    </div>
  );
}
