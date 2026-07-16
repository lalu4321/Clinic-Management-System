import { useState, useEffect, useCallback, useRef } from "react";
import API from "@/api/axiosInstance";
import { motion, AnimatePresence } from "framer-motion";
import { formatIST, formatISTDate } from "@/utils/dateUtils";

const STATUS_CONFIG = {
  SCHEDULED: { label: "Scheduled", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-500" },
};

const REFRESH_INTERVAL = 15000;

export default function LiveAppointmentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await API.get("/appointments/live-board/");
      const payload = res.data?.data || res.data;
      setData(payload);
      setLastRefresh(new Date());
      setError(null);
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch (err) {
      setError("Failed to load live board data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isPaused) {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
      return;
    }

    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [fetchData, isPaused]);

  const summary = data?.summary || { total: 0, scheduled: 0, completed: 0, cancelled: 0 };
  const appointments = data?.appointments || [];

  const filtered = filter === "ALL"
    ? appointments
    : appointments.filter((a) => a.status === filter);

  const completionRate = summary.total
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="live-board-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-clinical-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading live board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="live-board-error">
        <span className="material-symbols-outlined text-red-400" style={{ fontSize: 36 }}>error</span>
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 text-sm font-medium bg-clinical-primary text-white rounded-lg hover:bg-clinical-container transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="live-appointment-board">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-clinical-primary" style={{ fontSize: 24 }}>monitor_heart</span>
            Live Appointment Board
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.date ? formatISTDate(data.date) : "Today"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator isPaused={isPaused} />
          <button
            onClick={() => setIsPaused((v) => !v)}
            data-testid="pause-refresh-btn"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isPaused
                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 14 }}>
              {isPaused ? "play_arrow" : "pause"}
            </span>
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={fetchData}
            data-testid="manual-refresh-btn"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 14 }}>refresh</span>
            Refresh
          </button>
          {!isPaused && (
            <span className="text-[10px] text-gray-400 tabular-nums w-6 text-right">{countdown}s</span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon="event_note" label="Total" value={summary.total} color="blue" />
        <SummaryCard icon="schedule" label="Scheduled" value={summary.scheduled} color="amber" />
        <SummaryCard icon="check_circle" label="Completed" value={summary.completed} color="green" />
        <SummaryCard icon="cancel" label="Cancelled" value={summary.cancelled} color="red" />
        <SummaryCard icon="trending_up" label="Completion" value={`${completionRate}%`} color="teal" />
      </div>

      {/* Progress bar */}
      <ProgressBar summary={summary} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-2">
        {[
          { key: "ALL", label: "All", count: appointments.length },
          { key: "SCHEDULED", label: "Scheduled", count: summary.scheduled },
          { key: "COMPLETED", label: "Completed", count: summary.completed },
          { key: "CANCELLED", label: "Cancelled", count: summary.cancelled },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            data-testid={`filter-${tab.key.toLowerCase()}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? "bg-clinical-primary text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              filter === tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Appointment Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="live-board-table">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Token</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Patient</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Doctor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Specialization</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      No appointments found
                    </td>
                  </tr>
                ) : (
                  filtered.map((appt) => (
                    <motion.tr
                      key={appt.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                      data-testid={`appointment-row-${appt.id}`}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-clinical-light text-clinical-primary font-bold text-xs">
                          {appt.token}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{appt.patient_name}</p>
                          <p className="text-xs text-gray-400">{appt.patient_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">{appt.doctor_name}</td>
                      <td className="px-4 py-3 text-gray-500">{appt.specialization}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700 font-medium">{appt.time}</span>
                        {appt.completed_at && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">Done at {formatIST(appt.completed_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={appt.status} />
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Last refresh */}
      {lastRefresh && (
        <p className="text-[11px] text-gray-400 text-right" data-testid="last-refresh-time">
          Last updated: {formatIST(lastRefresh.toISOString())}
        </p>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function SummaryCard({ icon, label, value, color }) {
  const colorMap = {
    blue:  "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red:   "bg-red-50 text-red-600 border-red-100",
    teal:  "bg-teal-50 text-teal-700 border-teal-100",
  };
  const iconColorMap = {
    blue: "text-blue-500", amber: "text-amber-500", green: "text-emerald-500",
    red: "text-red-500", teal: "text-teal-500",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${colorMap[color]}`} data-testid={`summary-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className={`material-symbols-outlined ${iconColorMap[color]}`} style={{ fontSize: 20 }}>{icon}</span>
        <span className="font-display text-2xl font-extrabold">{value}</span>
      </div>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "SCHEDULED" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ summary }) {
  const total = summary.total || 1;
  const completedW = (summary.completed / total) * 100;
  const cancelledW = (summary.cancelled / total) * 100;
  const scheduledW = (summary.scheduled / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>Today's Progress</span>
        <span>{summary.completed} of {summary.total} completed</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${completedW}%` }} />
        <div className="bg-red-400 transition-all duration-700" style={{ width: `${cancelledW}%` }} />
        <div className="bg-amber-400 transition-all duration-700" style={{ width: `${scheduledW}%` }} />
      </div>
      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Completed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Cancelled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Scheduled</span>
      </div>
    </div>
  );
}

function LiveIndicator({ isPaused }) {
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      isPaused ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
    }`}>
      <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-gray-400" : "bg-emerald-500 animate-pulse"}`} />
      {isPaused ? "Paused" : "Live"}
    </span>
  );
}
