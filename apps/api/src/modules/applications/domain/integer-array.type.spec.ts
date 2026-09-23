import type { Platform } from "@mikro-orm/core";
import { IntegerArrayType } from "./integer-array.type";

describe("IntegerArrayType", () => {
  const platform = {
    marshallArray: (values: string[]) => `{${values.join(",")}}`,
    unmarshallArray: (value: string) => value.slice(1, -1).split(","),
  } as unknown as Platform;

  it("declares the column as int[]", () => {
    const type = new IntegerArrayType();

    expect(type.getColumnType({} as never, platform)).toBe("int[]");
  });

  it("round-trips a number array through the database representation", () => {
    const type = new IntegerArrayType();

    const dbValue = type.convertToDatabaseValue([200, 201], platform);
    expect(dbValue).toBe("{200,201}");
    expect(type.convertToJSValue(dbValue, platform)).toEqual([200, 201]);
  });

  it("passes through null", () => {
    const type = new IntegerArrayType();

    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
    expect(type.convertToJSValue(null, platform)).toBeNull();
  });
});
