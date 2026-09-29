import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Package } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { propertiesApi } from "@/api/properties";
import { propertyServicesApi } from "@/api/property-services";
import { AddServiceDialog } from "@/components/properties/AddServiceDialog";
import { PropertyTypeBadge } from "@/components/properties/PropertyTypeBadge";
import { ServiceRow } from "@/components/properties/ServiceRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PROPERTY_METADATA_FIELDS } from "@/lib/property";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);

  const property = useQuery({
    queryKey: ["properties", propertyId],
    queryFn: () => propertiesApi.get(propertyId),
    enabled: !isNaN(propertyId),
  });

  const services = useQuery({
    queryKey: ["properties", propertyId, "services"],
    queryFn: () => propertyServicesApi.list(propertyId),
    enabled: !isNaN(propertyId),
  });

  if (property.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (property.error || !property.data) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold">Объект не найден</h1>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/properties">
            <ArrowLeft className="mr-2 size-4" />
            К списку
          </Link>
        </Button>
      </div>
    );
  }

  const p = property.data;
  const metadataFields = PROPERTY_METADATA_FIELDS[p.type];
  const existingIds = (services.data ?? []).map((s) => s.service_type_id);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/properties">
            <ArrowLeft className="size-4 mr-1" />
            Объекты
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
              <PropertyTypeBadge type={p.type} />
            </div>
            {p.address && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {p.address}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Метаданные */}
      {metadataFields.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">
            Характеристики
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {metadataFields.map((field) => {
              const value = p.metadata_json[field.key];
              if (value === undefined || value === null || value === "")
                return null;
              return (
                <div key={field.key}>
                  <dt className="text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="text-sm font-medium mt-0.5">
                    {String(value)}
                    {field.suffix && (
                      <span className="text-muted-foreground ml-1">
                        {field.suffix}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Услуги */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Услуги</h2>
          <AddServiceDialog
            propertyId={p.id}
            propertyType={p.type}
            existingServiceTypeIds={existingIds}
          />
        </div>

        {services.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : services.data && services.data.length > 0 ? (
          <div className="space-y-3">
            {services.data.map((s) => (
              <ServiceRow key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card py-12 text-center">
            <Package className="size-8 mx-auto text-muted-foreground mb-2" />
            <div className="font-medium">Услуги не подключены</div>
            <div className="text-sm text-muted-foreground mt-1">
              Добавьте электричество, воду, налог или страховку — система
              будет учитывать платежи.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}