import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

/** Accessible tabs: roving tabindex, Left/Right/Home/End keys. */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const baseId = useId()
  const [activeId, setActiveId] = useState(items[0]?.id)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId))
  const current = items[activeIndex]

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    let next = index
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    const target = items[next]
    if (target) {
      setActiveId(target.id)
      refs.current[next]?.focus()
    }
  }

  if (!current) return null

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
        {items.map((item, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[index] = el
              }}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-4 py-3 text-[0.95rem] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                selected ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div id={`${baseId}-panel-${current.id}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current.id}`} tabIndex={0} className="pt-6 focus:outline-none">
        {current.content}
      </div>
    </div>
  )
}
