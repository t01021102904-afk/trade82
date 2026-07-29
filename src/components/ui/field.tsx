import * as React from "react"

import { cn } from "@/lib/utils"

type FieldOrientation = "vertical" | "horizontal"

function FieldSet({
  className,
  ...props
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-5", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-legend"
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function FieldGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex min-w-0 flex-col gap-4", className)}
      {...props}
    />
  )
}

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: FieldOrientation
}) {
  return (
    <div
      data-slot="field"
      data-orientation={orientation}
      className={cn(
        "flex min-w-0 gap-2",
        orientation === "vertical" ? "flex-col" : "items-start",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium leading-none text-foreground",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      role="separator"
      className={cn("h-px w-full bg-border", className)}
      {...props}
    />
  )
}

export {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
}
