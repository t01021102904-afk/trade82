"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type CometSpinnerSize = "xs" | "sm" | "md" | "lg"

type IOSSpinnerProps = {
  size?: CometSpinnerSize
  className?: string
  label?: string
}

const sizeClasses: Record<
  CometSpinnerSize,
  { outer: string; bar: string }
> = {
  xs: { outer: "size-4", bar: "h-1 w-px" },
  sm: { outer: "size-5", bar: "h-[5px] w-[1.5px]" },
  md: { outer: "size-8", bar: "h-[7px] w-[2px]" },
  lg: { outer: "size-10", bar: "h-2 w-[2px]" },
}

export function IOSSpinner({
  size = "md",
  className,
  label,
}: IOSSpinnerProps) {
  const classes = sizeClasses[size]

  return (
    <div
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative shrink-0", classes.outer, className)}
    >
      {Array.from({ length: 12 }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute inset-0"
          style={{ rotate: index * 30 }}
        >
          <motion.div
            className={cn(
              "mx-auto rounded-full bg-foreground",
              classes.bar,
            )}
            animate={{ opacity: [1, 0.2] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * (1 / 12),
              ease: "linear",
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

export function CometSpinner({
  size = "lg",
  className,
  label,
}: IOSSpinnerProps) {
  return (
    <IOSSpinner
      size={size}
      className={className}
      label={label}
    />
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
