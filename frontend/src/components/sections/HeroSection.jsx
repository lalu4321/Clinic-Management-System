import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const stats = [
  { value: "30+",  label: "Years of Care" },
  { value: "10K+", label: "Patients Served" },
  { value: "98%",  label: "Satisfaction Rate" },
];

const floatingCards = [
  { icon: "calendar_month", label: "Today's Appointments", value: "24 Scheduled", pos: "top-8 -left-4" },
  { icon: "people",         label: "Active Patients",      value: "30+ Admitted",  pos: "top-1/2 -right-4 -translate-y-1/2" },
  { icon: "military_tech",  label: "Specialists On Duty",  value: "5 Doctors",     pos: "bottom-8 -left-4" },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative bg-white overflow-hidden" data-testid="hero-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
              text-xs font-semibold bg-clinical-light text-clinical-primary
              border border-clinical-primary/20">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>favorite</span>
              Premier Healthcare Since 1995
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold
                           leading-tight tracking-tight text-gray-900">
              Healthcare
              <br />
              <span className="text-clinical-primary">That Puts You</span>
              <br />
              First
            </h1>

            <p className="text-gray-500 text-base lg:text-lg leading-relaxed max-w-md">
              Crescent Valley Hospital delivers advanced medical care with
              compassion and cutting-edge technology — where every patient
              receives world-class treatment.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="#appointment"
                data-testid="book-appointment-btn"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                           font-semibold text-white text-sm
                           bg-clinical-primary hover:bg-clinical-container
                           transition-colors duration-200"
              >
                Book Appointment
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                           font-semibold text-gray-600 text-sm
                           bg-gray-50 border border-gray-200
                           hover:bg-gray-100 hover:text-clinical-primary
                           transition-colors duration-200"
              >
                Learn More
              </a>
            </div>

            <div className="flex items-center gap-8 pt-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-2xl font-extrabold text-clinical-primary">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Visual */}
          <div className="relative hidden lg:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mx-auto"
              style={{ maxWidth: 440 }}
            >
              <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
                <img
                  src="https://plus.unsplash.com/premium_photo-1681997214296-9dddf5f2e3a6?q=80&w=1114&auto=format&fit=crop"
                  alt="Healthcare professional"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Floating stat cards */}
              {floatingCards.map((card, i) => (
                <div
                  key={card.label}
                  className={`absolute ${card.pos} bg-white rounded-xl px-4 py-3 shadow-md border border-gray-100 min-w-[170px] z-10`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-clinical-primary" style={{ fontSize: 16 }}>
                      {card.icon}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium">{card.label}</span>
                  </div>
                  <p className="font-display font-bold text-sm text-gray-900">{card.value}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
