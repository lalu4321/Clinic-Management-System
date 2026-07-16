import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const Pagination = ({ className, ...props }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);

const PaginationContent = React.forwardRef(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
));

const PaginationItem = React.forwardRef(({ className, ...props }, ref) => (
  <li ref={ref} className={cn(className)} {...props} />
));

const PaginationLink = ({
  className,
  isActive,
  children,
  ...props
}) => (
  <a
    className={cn(
      "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-gray-100",
      isActive && "bg-gray-200",
      className
    )}
    {...props}
  >
    {children}
  </a>
);

const PaginationPrevious = ({ className, ...props }) => (
  <PaginationLink className={className} {...props}>
    <ChevronLeft className="h-4 w-4 mr-1" />
    Previous
  </PaginationLink>
);

const PaginationNext = ({ className, ...props }) => (
  <PaginationLink className={className} {...props}>
    Next
    <ChevronRight className="h-4 w-4 ml-1" />
  </PaginationLink>
);

const PaginationEllipsis = ({ className, ...props }) => (
  <span
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
  </span>
);

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};

export default Pagination;