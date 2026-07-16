import { motion } from "framer-motion";

const doctors = [
  {
    name: "Dr. Rajesh Sharma",
    specialty: "General Medicine",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=300&auto=format&fit=crop",
  },
  {
    name: "Dr. Amit Patel",
    specialty: "Cardiology",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=300&auto=format&fit=crop",
  },
  {
    name: "Dr. Priya Reddy",
    specialty: "Pediatrics",
    image: "https://images.unsplash.com/photo-1706565029539-d09af5896340?q=80&w=300&auto=format&fit=crop",
  },
  {
    name: "Dr. Vikram Kumar",
    specialty: "Orthopedics",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=300&auto=format&fit=crop",
  },
];

export default function LeadershipSection() {
  return (
    <section id="doctors" className="bg-white py-16 lg:py-20" data-testid="leadership-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-clinical-light text-clinical-primary border border-clinical-primary/20 mb-4">
            Our Doctors
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Meet Our <span className="text-clinical-primary">Expert Team</span>
          </h2>
          <p className="text-gray-500 text-base">
            Our team of experienced medical professionals is dedicated to providing
            the highest quality care to every patient.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {doctors.map((doc, i) => (
            <motion.div
              key={doc.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden
                         hover:shadow-md transition-shadow duration-200 group"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={doc.image}
                  alt={doc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-display font-bold text-gray-900 text-sm">{doc.name}</h3>
                <p className="text-clinical-primary text-xs mt-0.5">{doc.specialty}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
