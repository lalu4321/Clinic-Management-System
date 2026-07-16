export function Spinner({ size = "md", color = "blue" }) {
  const sizes = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  const colors = {
    blue: "border-blue-600",
    white: "border-white",
    gray: "border-slate-400",
  };
  return (
    <div
      className={`${sizes[size]} border-2 ${colors[color]} border-t-transparent rounded-full animate-spin`}
    />
  );
}

export default function Loader({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}
