import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PropertyType } from "@/api/properties";
import { PROPERTY_METADATA_FIELDS } from "@/lib/property";

interface Props {
  type: PropertyType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function PropertyMetadataFields({ type, values, onChange }: Props) {
  const fields = PROPERTY_METADATA_FIELDS[type];

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Дополнительно
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`meta-${field.key}`} className="text-xs">
              {field.label}
              {field.suffix && (
                <span className="text-muted-foreground ml-1">
                  ({field.suffix})
                </span>
              )}
            </Label>
            <Input
              id={`meta-${field.key}`}
              type={field.type}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}