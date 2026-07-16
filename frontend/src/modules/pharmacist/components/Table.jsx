export default function Table({ columns, data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      
      <table className="w-full text-sm text-left">
        
        {/* Header */}
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            {columns.map((col, index) => (
              <th key={index} className="px-6 py-4 font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                {columns.map((col, j) => (
                  <td
                    key={j}
                    className="px-6 py-4 text-gray-700 font-medium"
                  >
                    {row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-gray-400"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>

      </table>
    </div>
  );
}