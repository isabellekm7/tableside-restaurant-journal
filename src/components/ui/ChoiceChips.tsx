import { useId } from 'react'

export interface ChoiceOption {
  value: string
  label: string
}

export interface ChoiceChipsProps {
  legend: string
  options: readonly ChoiceOption[]
  value: string
  onChange: (value: string) => void
}

/** Single-choice pills built on real radio inputs (arrow keys work, one tab stop). */
export function ChoiceChips({ legend, options, value, onChange }: ChoiceChipsProps) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-small font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={
                'inline-flex min-h-(--size-touch) items-center rounded-pill border-2 border-line-strong bg-surface px-4 text-small font-medium ' +
                'transition-colors duration-(--duration-fast) hover:bg-surface-sunken ' +
                'peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-semibold peer-checked:text-primary ' +
                'peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus'
              }
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
