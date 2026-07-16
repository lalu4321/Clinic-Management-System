import Layout from "../components/Layout";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "../api/axios";

export default function InventoryDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/pharmacy/inventory/${id}/`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  }, [id]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">

        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">
          Inventory Details
        </h1>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : !data ? (
          <p className="text-gray-400">No data found</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">

            {/* Medicine Info */}
            <div>
              <p className="text-sm text-gray-500">Medicine</p>
              <h2 className="text-lg font-semibold text-gray-800">
                {data.medicine_name}
              </h2>
            </div>

            {/* Grid Info */}
            <div className="grid grid-cols-2 gap-6">

              <div>
                <p className="text-sm text-gray-500">Batch Number</p>
                <p className="font-medium text-gray-700">
                  {data.batch_number}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Expiry Date</p>
                <p className="font-medium text-gray-700">
                  {data.expiry_date}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Quantity</p>
                <p className="font-medium text-gray-700">
                  {data.quantity_available}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    data.status === "AVAILABLE"
                      ? "bg-green-100 text-green-700"
                      : data.status === "LOW_STOCK"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {data.status}
                </span>
              </div>

            </div>

          </div>
        )}

      </div>
    </Layout>
  );
}