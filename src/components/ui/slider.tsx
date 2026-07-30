"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import clsx from "clsx";
import type * as React from "react";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[];
};

function Slider({
  className,
  thumbLabels = [],
  value,
  defaultValue,
  ...props
}: SliderProps) {
  const currentValue = value ?? defaultValue ?? 0;
  const thumbCount = Array.isArray(currentValue) ? currentValue.length : 1;

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      thumbAlignment="edge"
      className={clsx(
        "relative flex w-full touch-none select-none items-center data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          {Array.from({ length: thumbCount }, (_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              index={index}
              aria-label={thumbLabels[index]}
              className="block size-4 rounded-full border border-border bg-background shadow-sm ring-ring/30 transition-shadow hover:ring-4 focus-visible:outline-none focus-visible:ring-4"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
