import { ArrayType, type EntityProperty, type Platform } from "@mikro-orm/core";

/**
 * `ArrayType`'s default `toJsValue`/`toDbValue` are the identity function, which round-trips
 * `expected_statuses` as strings ("200") instead of numbers (200) — this coerces both directions
 * so the column stays a real `int[]` (matching the migration) while the TS type stays `number[]`.
 * `getColumnType` is overridden too since the base class hardcodes `text[]`.
 */
export class IntegerArrayType extends ArrayType<number> {
  public constructor() {
    super((value: string) => Number(value), (value: number) => String(value));
  }

  public override getColumnType(prop: EntityProperty, platform: Platform): string {
    void prop;
    void platform;
    return "int[]";
  }
}
