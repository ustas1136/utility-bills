import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import type { PropertyRead } from "@/api/properties";
import { PropertyTypeBadge } from "@/components/properties/PropertyTypeBadge";
import { PROPERTY_ICONS } from "@/lib/property";
import { cn } from "@/lib/utils";

interface Props {
  property: PropertyRead;
}

export function PropertyCard({ property }: Props) {
  const Icon = PROPERTY_ICONS[property.type];

  return (
    <Link
      to={`/properties/${property.id}`}
      className="group rounded-xl border bg-card p-5 flex items-start gap-4 hover:border-primary/40 hover:bg-accent/20 transition-colors"
    >
      <div
        className={cn(
          "size-11 rounded-xl shrink-0 flex items-center justify-center border",
          "bg-muted/50",
        )}
      >
        <Icon className="size-5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium truncate">{property.name}</h3>
          <PropertyTypeBadge type={property.type} />
        </div>

        {property.address && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{property.address}</span>
          </div>
        )}

        {/* Ключевые метаданные */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {property.type === "vehicle" &&
            typeof property.metadata_json.make === "string" && (
              <span>
                {String(property.metadata_json.make)}{" "}
                {String(property.metadata_json.model ?? "")}
              </span>
            )}
          {typeof property.metadata_json.area === "number" && (
            <span>{property.metadata_json.area} м²</span>
          )}
          {typeof property.metadata_json.year === "number" && (
            <span>{property.metadata_json.year} г.</span>
          )}
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 mt-3 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}