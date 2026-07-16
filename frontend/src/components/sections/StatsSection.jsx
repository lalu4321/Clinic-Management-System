import { motion } from "framer-motion";

const stats = [
  { icon: "ecg_heart",    label: "Cardiac Procedures",  value: "5,200+" },
  { icon: "labs",          label: "Lab Tests Daily",     value: "850+" },
  { icon: "groups",        label: "Medical Staff",       value: "120+" },
  { icon: "emoji_events",  label: "Awards & Recognitions", value: "45+" },
];

export default function StatsSection() {
  return (
    <section className="bg-clinical-primary" data-testid="stats-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <span className="material-symbols-outlined text-white/80 mb-2" style={{ fontSize: 28 }}>
                {stat.icon}
              </span>
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {stat.value}
              </p>
              <p className="text-white/70 text-sm mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
