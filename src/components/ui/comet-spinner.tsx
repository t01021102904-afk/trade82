"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type CometSpinnerSize = "xs" | "sm" | "md" | "lg"

const sizeClasses: Record<
  CometSpinnerSize,
  { outer: string; inner: string }
> = {
  xs: { outer: "size-4", inner: "size-3" },
  sm: { outer: "size-5", inner: "size-4" },
  md: { outer: "size-8", inner: "size-6" },
  lg: { outer: "size-10", inner: "size-8" },
}

export function CometSpinner({
  size = "lg",
  className,
  label,
}: {
  size?: CometSpinnerSize
  className?: string
  label?: string
}) {
  const classes = sizeClasses[size]

  return (
    <div
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800",
        classes.outer,
        className,
      )}
    >
      <motion.div
        className="absolute size-full rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, rgba(39, 39, 42, 0.1) 60%, rgba(39, 39, 42, 1) 100%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <div
        className={cn(
          "absolute rounded-full bg-white dark:bg-zinc-950",
          classes.inner,
        )}
      />
    </div>
  )
}

export function CometLoadingScreen({
  label = "Loading",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[50vh] w-full items-center justify-center",
        className,
      )}
    >
      <CometSpinner label={label} />
    </div>
  )
}
