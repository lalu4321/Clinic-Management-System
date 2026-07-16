import { useEffect, useState } from "react";
import { getDashboardData } from "api/adminApi";

const useDashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getDashboardData();
        setData(res);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  return data;
};

export default useDashboard;