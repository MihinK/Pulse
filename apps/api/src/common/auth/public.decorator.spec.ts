import "reflect-metadata";
import { Public, IS_PUBLIC_KEY } from "./public.decorator";

describe("@Public", () => {
  it("marks a handler with the public metadata key", () => {
    class Controller {
      @Public()
      public handler(): void {}
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Controller.prototype.handler)).toBe(true);
  });
});
