import type { CategoryType } from "@/components/categories/categories-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import Link from "next/link";

interface CategoryCardProps {
  category: CategoryType;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
      <div className="h-32 flex items-center justify-center p-4">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Category count badge */}
          <div className="absolute top-0 right-0 bg-white/20 text-white text-sm font-medium rounded-full w-8 h-8 flex items-center justify-center">{category.count}</div>

          {/* Category icon */}
          <div className="text-white">{category.icon}</div>
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-lg">{category.name}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{category.description}</p>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full" asChild>
          <Link href={`/categories/${category.slug}`}>Explore</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
