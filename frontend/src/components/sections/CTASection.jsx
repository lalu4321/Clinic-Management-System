import { useNavigate } from "react-router-dom";

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section id="appointment" className="bg-clinical-primary py-16 lg:py-20" data-testid="cta-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <span className="material-symbols-outlined text-white/80 mb-4" style={{ fontSize: 40 }}>
            health_and_safety
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-4">
            Ready to Take the First Step?
          </h2>
          <p className="text-white/80 text-base mb-8 max-w-lg mx-auto">
            Schedule your appointment today and experience world-class healthcare
            at Crescent Valley Hospital.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/login")}
              data-testid="cta-login-btn"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         font-semibold text-clinical-primary text-sm
                         bg-white hover:bg-gray-50 transition-colors duration-200"
            >
              Staff Portal
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
            <a
              href="tel:+1800000000"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                         font-semibold text-white text-sm
                         border border-white/30 hover:bg-white/10
                         transition-colors duration-200"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>call</span>
              Call Us: 1800-000-000
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
