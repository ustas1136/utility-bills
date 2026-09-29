import { Badge } from "@/components/ui/badge";
import type { PropertyType } from "@/api/properties";
import {
  PROPERTY_ICONS,
  PROPERTY_COLORS,
  PROPERTY_LABELS,
} from "@/lib/property";
import { cn } from "@/lib/utils";

interface Props {
  type: PropertyType;
  showLabel?: boolean;
}

export function PropertyTypeBadge({ type, showLabel = true }: Props) {
  const Icon = PROPERTY_ICONS[type];
  return (
    <Badge
      variant="outline"
      className={cn("font-normal gap-1.5", PROPERTY_COLORS[type])}
    >
      <Icon className="size-3" />
      {showLabel && PROPERTY_LABELS[type]}
    </Badge>
  );
}