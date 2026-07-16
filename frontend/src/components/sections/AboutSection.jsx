import { motion } from "framer-motion";

const highlights = [
  "State-of-the-art diagnostic imaging and laboratory facilities",
  "Board-certified specialists across 50+ medical disciplines",
  "Patient-centered care with 98% satisfaction scores",
  "Accredited by Joint Commission International (JCI)",
];

export default function AboutSection() {
  return (
    <section id="about" className="bg-white py-16 lg:py-20" data-testid="about-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <img
                src="https://images.pexels.com/photos/5452221/pexels-photo-5452221.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="Modern hospital facility"
                className="w-full h-[400px] object-cover"
              />
            </div>
            <div className="absolute bottom-4 right-4 bg-white rounded-xl px-5 py-3 shadow-md border border-gray-100">
              <p className="font-display text-2xl font-extrabold text-clinical-primary">30+</p>
              <p className="text-xs text-gray-500">Years of Trusted Care</p>
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-clinical-light text-clinical-primary border border-clinical-primary/20">
              About Us
            </span>

            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              Committed to Your
              <br />
              <span className="text-clinical-primary">Health & Wellbeing</span>
            </h2>

            <p className="text-gray-500 text-base leading-relaxed">
              Crescent Valley Hospital is a non-profit community healthcare center
              delivering comprehensive medical, dental, and specialty services. Our
              expert team combines compassion with cutting-edge technology to ensure
              every patient receives individualized, world-class treatment.
            </p>

            <ul className="space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-clinical-primary mt-0.5" style={{ fontSize: 20 }}>
                    check_circle
                  </span>
                  <span className="text-gray-600 text-sm">{item}</span>
                </li>
              ))}
            </ul>

            <a
              href="#departments"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         font-semibold text-white text-sm
                         bg-clinical-primary hover:bg-clinical-container
                         transition-colors duration-200"
            >
              Explore Our Services
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
