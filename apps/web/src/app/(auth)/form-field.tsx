import { Button } from "@/components/ui/button";

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  errors?: string[];
}

export function FormField({ label, name, type = "text", autoComplete, placeholder, defaultValue, errors }: FormFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/25 aria-[invalid]:border-danger"
      />
      {errors ? (
        <p id={errorId} className="text-sm text-danger">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="mt-2 w-full">
      {pending ? "Please wait…" : children}
    </Button>
  );
}
