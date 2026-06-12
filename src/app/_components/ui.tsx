import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type IconName = "check" | "user" | "plus" | "arrow";

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="m4 12 5 5L20 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
};

export function Icon({
  name,
  size,
  className,
}: {
  name: IconName;
  size?: "sm" | "lg";
  className?: string;
}) {
  const cls = ["ico", size && size, className].filter(Boolean).join(" ");
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

type ButtonVariant = "primary" | "dark" | "ghost" | "quiet";
type ButtonSize = "sm" | "lg";

type CommonButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
};

function buttonClass({
  variant = "dark",
  size,
  block,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}) {
  return [
    "btn",
    `--${variant}`,
    size && `--${size}`,
    block && "--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  className,
  ...rest
}: CommonButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...rest}
      className={buttonClass({ variant, size, block, className })}
    >
      {icon && <Icon name={icon} size="sm" />}
      {children}
      {iconRight && <Icon name={iconRight} size="sm" />}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  iconRight,
  children,
  className,
  href,
  ...rest
}: CommonButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    className?: string;
  }) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  const cls = buttonClass({ variant, size, block, className });

  if (internal) {
    return (
      <Link href={href} className={cls}>
        {icon && <Icon name={icon} size="sm" />}
        {children}
        {iconRight && <Icon name={iconRight} size="sm" />}
      </Link>
    );
  }

  return (
    <a {...rest} href={href} className={cls}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
      {iconRight && <Icon name={iconRight} size="sm" />}
    </a>
  );
}

type BadgeVariant =
  | "default"
  | "volt"
  | "volt-soft"
  | "ok"
  | "warn"
  | "info"
  | "ink";

export function Badge({
  variant = "default",
  size,
  icon,
  children,
}: {
  variant?: BadgeVariant;
  size?: "lg";
  icon?: IconName;
  children: ReactNode;
}) {
  const cls = [
    "badge",
    variant !== "default" && `--${variant}`,
    size && `--${size}`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </span>
  );
}

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={["input", className].filter(Boolean).join(" ")} />;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={["input", className].filter(Boolean).join(" ")}
    />
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}
