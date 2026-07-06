import { RequestBody } from "../types/bik";
import { BodyPlaceholderField, findRequestBodyPlaceholders, isMapPlaceholder } from "./requestBody";

export interface MapPlaceholderField {
  path: string;
  label: string;
  value: string;
}

export { isMapPlaceholder };

export function findBodyMapPlaceholders(body: RequestBody): MapPlaceholderField[] {
  return findRequestBodyPlaceholders(body) as BodyPlaceholderField[];
}
