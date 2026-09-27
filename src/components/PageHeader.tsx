import type { ReactNode } from 'react'

/**
 * Shared page title block: eyebrow, display title, short description, optional actions on the right.
 * Compact by default so data pages show their content above the fold; `size="large"` for showcase pages.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  size = 'compact',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  size?: 'compact' | 'large'
}) {
  const large = size === 'large'
  return (
    <div className="relative overflow-hidden border-b border-base-content/[0.07]">
      <div className="felt-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className={`relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${large ? 'pb-10 pt-12 md:pt-16' : 'pb-7 pt-7 md:pb-8 md:pt-10'}`}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className={`rise max-w-2xl ${large ? 'space-y-3' : 'space-y-2'}`}>
            {eyebrow && <div className="eyebrow text-primary/90">{eyebrow}</div>}
            <h1
              className={`font-display font-semibold leading-[1.02] tracking-[-0.03em] ${
                large ? 'text-4xl md:text-6xl' : 'text-3xl md:text-[2.75rem]'
              }`}
            >
              {title}
            </h1>
            {description && (
              <p className={`max-w-xl text-base-content/60 ${large ? 'text-base md:text-lg' : 'text-sm md:text-base'}`}>{description}</p>
            )}
          </div>
          {actions && <div className="rise shrink-0 [animation-delay:80ms]">{actions}</div>}
        </div>
        {children && <div className={large ? 'mt-8' : 'mt-6'}>{children}</div>}
      </div>
    </div>
  )
}
