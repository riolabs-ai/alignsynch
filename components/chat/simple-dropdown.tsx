"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SimpleDropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: "left" | "right"
  className?: string
}

export function SimpleDropdown({ trigger, children, align = "left", className }: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[200px] rounded-md bg-popover p-1 shadow-md",
            "animate-in fade-in-0 zoom-in-95",
            align === "left" ? "left-0" : "right-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface SimpleDropdownItemProps {
  children: ReactNode
  onClick?: () => void
  destructive?: boolean
  disabled?: boolean
  className?: string
}

export function SimpleDropdownItem({
  children,
  onClick,
  destructive = false,
  disabled = false,
  className,
}: SimpleDropdownItemProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled && onClick) onClick()
      }}
      className={cn(
        "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        destructive && "text-destructive hover:text-destructive",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SimpleDropdownLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>
}

export function SimpleDropdownSeparator({ className }: { className?: string }) {
  return <div className={cn("my-1 h-px bg-muted", className)} />
}
