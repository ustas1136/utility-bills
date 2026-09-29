import {
  Building2,
  Car,
  Home,
  LandPlot,
  type LucideIcon,
  Package,
} from "lucide-react";

import type { PropertyType } from "@/api/properties";

export const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "land",
  "vehicle",
  "other",
];

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  apartment: "Квартира",
  house: "Дом",
  land: "Участок",
  vehicle: "Автомобиль",
  other: "Другое",
};

export const PROPERTY_LABELS_PLURAL: Record<PropertyType, string> = {
  apartment: "Квартиры",
  house: "Дома",
  land: "Участки",
  vehicle: "Автомобили",
  other: "Другое",
};

export const PROPERTY_ICONS: Record<PropertyType, LucideIcon> = {
  apartment: Building2,
  house: Home,
  land: LandPlot,
  vehicle: Car,
  other: Package,
};

export const PROPERTY_COLORS: Record<PropertyType, string> = {
  apartment:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  house:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  land: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  vehicle:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

/**
 * Поля метаданных для каждого типа объекта. Используется для
 * динамической формы создания/редактирования.
 */
export interface MetadataField {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
  suffix?: string;
}

export const PROPERTY_METADATA_FIELDS: Record<PropertyType, MetadataField[]> = {
  apartment: [
    { key: "area", label: "Площадь", type: "number", suffix: "м²" },
    { key: "rooms", label: "Комнат", type: "number" },
    { key: "residents", label: "Проживает", type: "number" },
  ],
  house: [
    { key: "area", label: "Площадь", type: "number", suffix: "м²" },
    { key: "land_area", label: "Площадь участка", type: "number", suffix: "м²" },
    { key: "residents", label: "Проживает", type: "number" },
  ],
  land: [
    { key: "area", label: "Площадь", type: "number", suffix: "м²" },
    {
      key: "cadastral_number",
      label: "Кадастровый номер",
      type: "text",
      placeholder: "77:01:0001001:1234",
    },
    {
      key: "purpose",
      label: "Назначение",
      type: "text",
      placeholder: "ИЖС, СНТ, ЛПХ",
    },
  ],
  vehicle: [
    { key: "make", label: "Марка", type: "text", placeholder: "Toyota" },
    { key: "model", label: "Модель", type: "text", placeholder: "Camry" },
    { key: "year", label: "Год выпуска", type: "number" },
    {
      key: "plate",
      label: "Госномер",
      type: "text",
      placeholder: "А123ВС77",
    },
    {
      key: "vin",
      label: "VIN",
      type: "text",
      placeholder: "JTNBE46K123456789",
    },
  ],
  other: [],
};