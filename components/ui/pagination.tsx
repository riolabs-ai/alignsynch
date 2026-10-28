import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as React from "react";
interface PaginationProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  currentPage?: number;
  totalPages?: number;
  onChange?: (page: number) => void;
}

interface PaginationLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}
const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(({ className, currentPage, totalPages, onChange, ...props }, ref) => <nav ref={ref} className={cn("mx-auto flex w-full justify-center", className)} {...props} />);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props} />);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("w-8 h-8", className)} {...props} />);
PaginationItem.displayName = "PaginationItem";

const PaginationLink = React.forwardRef<HTMLButtonElement, PaginationLinkProps>(({ className, ...props }, ref) => {
  return <Button ref={ref} variant="outline" size="sm" className={cn("h-8 w-8 p-0 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground", className)} {...props} />;
});
PaginationLink.displayName = "PaginationLink";

const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("h-8 w-8 select-none text-center", className)} {...props}>
    ...
  </span>
));
PaginationEllipsis.displayName = "PaginationEllipsis";

const PaginationPrevious = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => {
  return <Button ref={ref} variant="outline" size="sm" className={cn("h-8 w-8 p-0", className)} {...props} />;
});
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => {
  return <Button ref={ref} variant="outline" size="sm" className={cn("h-8 w-8 p-0", className)} {...props} />;
});
PaginationNext.displayName = "PaginationNext";

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious };
