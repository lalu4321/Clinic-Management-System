import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { label: "Home",        href: "/" },
  { label: "About",       href: "#about" },
  { label: "Departments", href: "#departments" },
  { label: "Doctors",     href: "#doctors" },
  { label: "Appointment", href: "#appointment" },
  { label: "Enquire Now", href: "#enquire" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm shadow-sm"
          : "bg-white"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0" data-testid="logo-link">
            <div className="w-8 h-8 rounded-lg bg-clinical-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                local_hospital
              </span>
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-sm text-gray-900 tracking-tight">
                Crescent Valley
              </p>
              <p className="text-clinical-primary text-[10px] font-semibold tracking-widest uppercase">
                Hospital
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" data-testid="desktop-nav">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3.5 py-2 text-sm font-medium text-gray-600
                           hover:text-clinical-primary rounded-lg hover:bg-gray-50
                           transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <button
              onClick={() => navigate("/login")}
              data-testid="staff-login-btn"
              className="px-5 py-2 rounded-lg text-sm font-semibold
                         text-white bg-clinical-primary hover:bg-clinical-container
                         transition-colors duration-200"
            >
              Staff Login
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex flex-col justify-center items-center w-10 h-10 gap-[5px]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            data-testid="mobile-menu-toggle"
          >
            <span className={`block h-0.5 w-5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`block h-0.5 w-5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-gray-700 rounded-full transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="lg:hidden bg-white border-t border-gray-100 overflow-hidden"
            data-testid="mobile-menu"
          >
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                             text-gray-600 hover:text-clinical-primary
                             hover:bg-gray-50 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => { navigate("/login"); setMenuOpen(false); }}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold
                             text-white bg-clinical-primary hover:bg-clinical-container
                             transition-colors duration-200"
                >
                  Staff Login
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
