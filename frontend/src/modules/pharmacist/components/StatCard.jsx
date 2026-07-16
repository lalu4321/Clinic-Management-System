export default function StatCard({ title, value }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:-translate-y-1">
      
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </h4>

      <h2 className="text-3xl font-semibold text-gray-900">
        {value}
      </h2>

    </div>
  );
}