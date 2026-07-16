import { motion } from "framer-motion";

const departments = [
  { icon: "cardiology",       name: "Cardiology",       desc: "Heart and cardiovascular system care" },
  { icon: "neurology",        name: "Neurology",        desc: "Brain and nervous system specialist" },
  { icon: "orthopedics",      name: "Orthopedics",      desc: "Bone, joint and muscle treatment" },
  { icon: "pediatrics",       name: "Pediatrics",       desc: "Comprehensive children's healthcare" },
  { icon: "dermatology",      name: "Dermatology",      desc: "Skin, hair and nail treatment" },
  { icon: "ophthalmology",    name: "Ophthalmology",    desc: "Eye care and vision correction" },
  { icon: "stethoscope",      name: "General Medicine", desc: "Primary healthcare and wellness" },
  { icon: "pregnant_woman",   name: "Gynecology",       desc: "Women's health and maternity care" },
];

export default function DepartmentsSection() {
  return (
    <section id="departments" className="bg-gray-50 py-16 lg:py-20" data-testid="departments-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-clinical-light text-clinical-primary border border-clinical-primary/20 mb-4">
            Departments
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Specialized <span className="text-clinical-primary">Medical Care</span>
          </h2>
          <p className="text-gray-500 text-base">
            Our hospital offers a wide range of specialized departments to provide
            comprehensive healthcare services to all patients.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {departments.map((dept, i) => (
            <motion.div
              key={dept.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-white rounded-xl p-5 border border-gray-100
                         hover:border-clinical-primary/30 hover:shadow-md
                         transition-all duration-200 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-lg bg-clinical-light flex items-center justify-center mb-3
                              group-hover:bg-clinical-primary transition-colors duration-200">
                <span className="material-symbols-outlined text-clinical-primary group-hover:text-white transition-colors" style={{ fontSize: 22 }}>
                  {dept.icon}
                </span>
              </div>
              <h3 className="font-display font-bold text-gray-900 text-sm mb-1">{dept.name}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{dept.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
