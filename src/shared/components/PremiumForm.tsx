import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <label className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-widest">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-destructive font-bold"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground font-medium">{hint}</p>
      )}
    </motion.div>
  );
}

interface PremiumInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  success?: boolean;
  loading?: boolean;
}

export function PremiumInput({
  icon,
  success,
  loading,
  className,
  ...props
}: PremiumInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = props.type === "password";

  return (
    <div className="relative group">
      <input
        {...props}
        type={isPassword && showPassword ? "text" : props.type}
        className={clsx(
          "w-full px-4 py-3 rounded-xl border border-border bg-card/50 backdrop-blur-sm",
          "text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all",
          "font-bold text-sm",
          icon && "pl-12",
          (success || isPassword) && "pr-12",
          loading && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={loading || props.disabled}
      />
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </div>
      )}
      {success && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600"
        >
          <CheckCircle2 className="h-5 w-5" />
        </motion.div>
      )}
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}

interface PremiumTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: ReactNode;
}

export function PremiumTextarea({
  icon,
  className,
  ...props
}: PremiumTextareaProps) {
  return (
    <div className="relative group">
      <textarea
        {...props}
        className={clsx(
          "w-full px-4 py-3 rounded-xl border border-border bg-card/50 backdrop-blur-sm",
          "text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all",
          "font-bold text-sm resize-none",
          icon && "pl-12",
          className
        )}
      />
      {icon && (
        <div className="absolute left-4 top-4 text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </div>
      )}
    </div>
  );
}

interface PremiumSelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  icon?: ReactNode;
}

export function PremiumSelect({
  options,
  icon,
  className,
  ...props
}: PremiumSelectProps) {
  return (
    <div className="relative group">
      <select
        {...props}
        className={clsx(
          "w-full px-4 py-3 rounded-xl border border-border bg-card/50 backdrop-blur-sm appearance-none",
          "text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all",
          "font-bold text-sm cursor-pointer",
          icon && "pl-12",
          "pr-10",
          className
        )}
      >
        {props.placeholder && (
          <option value="" disabled>
            {props.placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
          {icon}
        </div>
      )}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </div>
  );
}

interface PremiumCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function PremiumCheckbox({ label, className, ...props }: PremiumCheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          {...props}
          className="sr-only"
        />
        <div className={clsx(
          "h-6 w-6 rounded-lg border-2 border-border bg-card/50 transition-all",
          "group-hover:border-primary group-hover:bg-primary/5",
          "group-has-[:checked]:border-primary group-has-[:checked]:bg-primary"
        )} />
        <CheckCircle2 className="absolute inset-0 h-6 w-6 text-primary opacity-0 group-has-[:checked]:opacity-100 transition-opacity" />
      </div>
      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

interface PremiumRadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function PremiumRadio({ label, className, ...props }: PremiumRadioProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="radio"
          {...props}
          className="sr-only"
        />
        <div className={clsx(
          "h-6 w-6 rounded-full border-2 border-border bg-card/50 transition-all",
          "group-hover:border-primary group-hover:bg-primary/5",
          "group-has-[:checked]:border-primary group-has-[:checked]:bg-primary"
        )} />
        <div className="absolute inset-0 h-6 w-6 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-primary opacity-0 group-has-[:checked]:opacity-100 transition-opacity" />
        </div>
      </div>
      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function PremiumButton({
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  children,
  className,
  ...props
}: PremiumButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl",
    secondary: "bg-muted text-foreground hover:bg-muted/80 shadow-md hover:shadow-lg",
    danger: "bg-destructive/10 text-destructive hover:bg-destructive/20",
    ghost: "text-foreground hover:bg-muted/50",
  };

  const motionProps = props as any;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={clsx(
        "rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && "w-full",
        loading && "opacity-50 cursor-not-allowed",
        className
      )}
      disabled={loading || props.disabled}
      {...motionProps}
    >
      {loading ? (
        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </motion.button>
  );
}
