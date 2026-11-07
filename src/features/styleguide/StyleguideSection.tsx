import type { ReactNode } from 'react'

export function StyleguideSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-20 border-t border-line pt-8">
      <h2 id={`${id}-title`} className="text-heading">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-prose text-text-muted">{description}</p>}
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  )
}

export function Subheading({ children }: { children: ReactNode }) {
  return <h3 className="font-sans text-small font-semibold tracking-wide text-text-muted uppercase">{children}</h3>
}
