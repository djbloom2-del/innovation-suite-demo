import { cn } from "@/lib/utils";

interface Props {
  label: string;
  variant?: "organic" | "keto" | "vegan" | "protein" | "nonGmo" | "glutenFree" | "functional" | "default";
  size?: "sm" | "md";
}

const styles: Record<string, string> = {
  organic: "bg-green-50 text-green-700 border-green-200",
  keto: "bg-purple-50 text-purple-700 border-purple-200",
  vegan: "bg-teal-50 text-teal-700 border-teal-200",
  protein: "bg-blue-50 text-blue-700 border-blue-200",
  nonGmo: "bg-lime-50 text-lime-700 border-lime-200",
  glutenFree: "bg-orange-50 text-orange-700 border-orange-200",
  functional: "bg-indigo-50 text-indigo-700 border-indigo-200",
  default: "bg-slate-50 text-slate-600 border-slate-200",
};

export function AttributeBadge({ label, variant = "default", size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center border rounded-full font-medium",
        styles[variant],
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      )}
    >
      {label}
    </span>
  );
}

export function LaunchAttributeBadges({
  attributes,
  size = "sm",
}: {
  attributes: import("@/lib/types").AttributeSet;
  size?: "sm" | "md";
}) {
  const badges: { label: string; variant: Props["variant"] }[] = [];
  if (attributes.isOrganic) badges.push({ label: "Organic", variant: "organic" });
  if (attributes.isNonGmo) badges.push({ label: "Non-GMO", variant: "nonGmo" });
  if (attributes.isKeto) badges.push({ label: "Keto", variant: "keto" });
  if (attributes.isVegan) badges.push({ label: "Vegan", variant: "vegan" });
  if (attributes.isGlutenFree) badges.push({ label: "GF", variant: "glutenFree" });
  if (attributes.isProteinFocused) badges.push({ label: "Protein", variant: "protein" });
  if (attributes.functionalIngredient)
    badges.push({ label: attributes.functionalIngredient.split(" ")[0], variant: "functional" });

  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, 5).map((b) => (
        <AttributeBadge key={b.label} label={b.label} variant={b.variant} size={size} />
      ))}
    </div>
  );
}
