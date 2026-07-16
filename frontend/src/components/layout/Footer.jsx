import { Link } from "react-router-dom";

const quickLinks = [
  { label: "Home",         href: "/" },
  { label: "About Us",     href: "#about" },
  { label: "Departments",  href: "#departments" },
  { label: "Our Doctors",  href: "#doctors" },
];

const services = [
  "Emergency Care",
  "Outpatient Services",
  "Laboratory",
  "Pharmacy",
];

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-clinical-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                  local_hospital
                </span>
              </div>
              <div className="leading-tight">
                <p className="font-display font-bold text-sm text-white">Crescent Valley</p>
                <p className="text-clinical-primary text-[10px] font-semibold tracking-widest uppercase">Hospital</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Delivering advanced medical care with compassion since 1995.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-bold text-white text-sm mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-white text-sm mb-4">Services</h4>
            <ul className="space-y-2">
              {services.map((service) => (
                <li key={service} className="text-sm text-gray-400">{service}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-white text-sm mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-clinical-primary mt-0.5" style={{ fontSize: 16 }}>location_on</span>
                <span className="text-sm text-gray-400">123 Medical Center Drive, Crescent Valley, CA 94000</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-clinical-primary" style={{ fontSize: 16 }}>call</span>
                <span className="text-sm text-gray-400">1800-000-000</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-clinical-primary" style={{ fontSize: 16 }}>mail</span>
                <span className="text-sm text-gray-400">info@crescentvalley.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Crescent Valley Hospital. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
