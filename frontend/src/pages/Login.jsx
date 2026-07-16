import { useState } from "react";
import { loginUser } from "@/api/authApi";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

// ── Role → dashboard redirect map (unchanged) ────────────────────────────────
const ROLE_REDIRECTS = {
  Admin:         "/admin/dashboard",
  Doctor:        "/doctor/dashboard",
  Receptionist:  "/receptionist/dashboard",
  LabTechnician: "/lab/dashboard",
  Pharmacist:    "/pharmacist/dashboard",
};

// ── Left panel feature list ───────────────────────────────────────────────────
const FEATURES = [
  { icon: "lock",            label: "AES-256 encrypted sessions" },
  { icon: "speed",           label: "Optimised clinical workflows" },
  { icon: "manage_accounts", label: "Role-based access control" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form,     setForm]     = useState({ username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // ── Auth handler — logic preserved exactly ───────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginUser(form);
      const { access, refresh, role, staff_id, username } = res.data.data;

      login({
        access,
        refresh,
        user: { role, staff_id, username },
      });

      navigate(ROLE_REDIRECTS[role] || "/");
    } catch (err) {
      console.error(err.response?.data);
      setError("Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════════
          Left panel — editorial branding (desktop only)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[46%] bg-clinical-primary flex-col justify-between p-12 relative overflow-hidden">

        {/* Subtle tonal overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-clinical-primary via-clinical-primary to-clinical-container opacity-80 pointer-events-none" />

        {/* Faint dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* ── Logo ── */}
        <Link to="/" className="relative z-10 flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>
              health_and_safety
            </span>
          </div>
          <div>
            <p className="text-white font-display font-bold text-[13px] leading-tight">
              Crescent Valley
            </p>
            <p className="text-white/60 text-[10px] font-semibold tracking-widest uppercase">
              Hospital
            </p>
          </div>
        </Link>

        {/* ── Centre content ── */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="font-display font-extrabold text-white leading-tight text-[2.6rem]">
              The Future of<br />Clinical Operations
            </h1>
            <p className="text-white/65 text-[15px] leading-relaxed max-w-xs">
              Secure, role-based access for healthcare professionals across
              every department.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/12 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }}>
                    {f.icon}
                  </span>
                </div>
                <span className="text-white/80 text-sm">{f.label}</span>
              </li>
            ))}
          </ul>

          {/* Pull-quote */}
          <blockquote className="border-l-2 border-white/30 pl-4">
            <p className="text-white/70 text-sm italic leading-relaxed">
              "Precision is the sanctuary of patient trust."
            </p>
          </blockquote>
        </div>

        {/* ── Footer ── */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-white/50 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            System online
          </span>
          <span className="text-white/25">·</span>
          <span className="text-white/50 text-[11px]">© 2026 Crescent Valley Hospital</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Right panel — login form
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface-container-lowest relative">

        {/* Mobile back link */}
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center gap-1.5
            text-surface-on-variant hover:text-clinical-primary transition-colors text-sm lg:hidden"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-clinical-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>
                health_and_safety
              </span>
            </div>
            <span className="font-display font-bold text-surface-on text-sm">
              Crescent Valley Hospital
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-display font-bold text-[1.6rem] text-surface-on leading-tight">
              Welcome back
            </h2>
            <p className="text-surface-on-variant text-sm mt-1">
              Sign in to your staff account
            </p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl
                bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              <span className="material-symbols-outlined text-red-500 shrink-0" style={{ fontSize: 18 }}>
                error
              </span>
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-surface-on-variant uppercase tracking-widest">
                Username
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2
                    text-surface-on-variant/60 pointer-events-none"
                  style={{ fontSize: 18 }}
                >
                  person
                </span>
                <input
                  type="text"
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-outline-soft
                             text-surface-on placeholder-surface-on-variant/40 text-sm
                             focus:outline-none focus:ring-2 focus:ring-clinical-primary/20
                             focus:border-clinical-primary hover:border-outline transition-all duration-200"
                  onChange={(e) => setForm({ ...form, username: e.target.value.trim() })}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-surface-on-variant uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2
                    text-surface-on-variant/60 pointer-events-none"
                  style={{ fontSize: 18 }}
                >
                  lock
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-surface border border-outline-soft
                             text-surface-on placeholder-surface-on-variant/40 text-sm
                             focus:outline-none focus:ring-2 focus:ring-clinical-primary/20
                             focus:border-clinical-primary hover:border-outline transition-all duration-200"
                  onChange={(e) => setForm({ ...form, password: e.target.value.trim() })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2
                    text-surface-on-variant/50 hover:text-clinical-primary transition-colors"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {showPass ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.015 } : {}}
              whileTap={!loading  ? { scale: 0.985 } : {}}
              className="w-full py-3.5 rounded-xl font-display font-semibold text-sm text-white
                         bg-clinical-primary hover:bg-clinical-container
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-1
                         transition-colors duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Login to Sanctuary"
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-outline-soft" />
            <span className="text-surface-on-variant/50 text-xs">Staff Access</span>
            <div className="flex-1 h-px bg-outline-soft" />
          </div>

          {/* Available roles */}
          <div className="space-y-2">
            <p className="text-surface-on-variant/50 text-xs text-center">Available roles</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Admin", "Doctor", "Receptionist", "Pharmacist", "Lab Tech"].map((role) => (
                <span
                  key={role}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-soft
                             text-surface-on-variant text-[11px] font-medium"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Desktop back link */}
          <div className="text-center mt-8 hidden lg:block">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-surface-on-variant
                hover:text-clinical-primary transition-colors text-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
