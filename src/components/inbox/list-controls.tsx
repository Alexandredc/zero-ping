import { useEffect, useState } from "react"
import { ArrowUpDownIcon, ListFilterIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { filterOptions, toggleValue } from "@/lib/list-filters"
import type { FilterDef, FilterSelection } from "@/lib/list-filters"
import type { SortOption } from "@/lib/sorts"
import { useI18n } from "@/hooks/use-i18n"

/** Filters of a list, kept per page in this browser. */
export function useListFilters(storageKey: string) {
  const key = `filters:${storageKey}`
  const [selection, setSelection] = useState<FilterSelection>({})
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      setSelection(saved ? (JSON.parse(saved) as FilterSelection) : {})
    } catch {
      setSelection({})
    }
  }, [key])
  const update = (next: FilterSelection) => {
    setSelection(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Private browsing: the filters last until the page closes.
    }
  }
  return {
    selection,
    toggle: (id: string, value: string) =>
      update(toggleValue(selection, id, value)),
    clear: () => update({}),
  }
}

/** A filter with a few options sits in the menu; a longer one opens a submenu. */
const INLINE_OPTIONS = 5

type FilterProps<T> = {
  /** The items before filtering, to count each option. */
  items: T[]
  filters: FilterDef<T>[]
  selection: FilterSelection
  onToggle: (id: string, value: string) => void
  onClear: () => void
}

function chipsOf<T>(filters: FilterDef<T>[], selection: FilterSelection) {
  return filters.flatMap((def) =>
    (selection[def.id] ?? []).map((value) => ({
      id: def.id,
      value,
      label:
        def.options?.find((option) => option.value === value)?.label ?? value,
    }))
  )
}

/** The « Trier » and « Filtres » menus, small enough to sit in a list's header. */
export function ListMenus<T, TSort extends string>({
  sort,
  sorts,
  onSort,
  items,
  filters,
  selection,
  onToggle,
  onClear,
}: FilterProps<T> & {
  sort?: TSort
  sorts?: SortOption<TSort>[]
  onSort?: (sort: TSort) => void
}) {
  const { t, language } = useI18n()
  const groups = filters
    .map((def) => ({ def, options: filterOptions(items, def, language) }))
    // A filter every item passes, or none, has nothing to pick from; one in use stays.
    .filter(
      (group) =>
        group.options.length > 1 || (selection[group.def.id] ?? []).length > 0
    )
  const chips = chipsOf(filters, selection)
  const sortKind = sorts?.find((option) => option.value === sort)?.kind

  return (
    <div className="flex items-center gap-0.5">
      {sorts && sort && onSort && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.inbox.listControls.sort}
              />
            }
          >
            <ArrowUpDownIcon data-icon="inline-start" />
            {sortKind && t.inbox.sorts[sortKind]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {t.inbox.listControls.sortBy}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => onSort(value as TSort)}
              >
                {sorts.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {t.inbox.sorts[option.kind]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {groups.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="xs" />}>
            <ListFilterIcon data-icon="inline-start" />
            {t.inbox.listControls.filters}
            {chips.length > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
                {chips.length}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {groups.map(({ def, options }, index) => (
              <DropdownMenuGroup key={def.id}>
                {index > 0 && <DropdownMenuSeparator />}
                {options.length > INLINE_OPTIONS ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {def.label}
                      {(selection[def.id] ?? []).length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {selection[def.id].length}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 w-60 overflow-y-auto">
                      <DropdownMenuGroup>
                        {options.map((option) => (
                          <FilterItem
                            key={option.value}
                            option={option}
                            checked={(selection[def.id] ?? []).includes(
                              option.value
                            )}
                            onToggle={() => onToggle(def.id, option.value)}
                          />
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : (
                  <>
                    <DropdownMenuLabel>{def.label}</DropdownMenuLabel>
                    {options.map((option) => (
                      <FilterItem
                        key={option.value}
                        option={option}
                        checked={(selection[def.id] ?? []).includes(
                          option.value
                        )}
                        onToggle={() => onToggle(def.id, option.value)}
                      />
                    ))}
                  </>
                )}
              </DropdownMenuGroup>
            ))}
            {chips.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClear}>
                  {t.inbox.listControls.clearFilters}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** The filters on, as chips under the header; nothing while none is. */
export function ActiveFilters<T>({
  filters,
  selection,
  onToggle,
  onClear,
  shown,
  total,
}: Omit<FilterProps<T>, "items"> & { shown: number; total: number }) {
  const { t } = useI18n()
  const chips = chipsOf(filters, selection)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5">
      {chips.map((chip) => (
        <Badge
          key={`${chip.id}:${chip.value}`}
          variant="secondary"
          className="h-5 gap-0.5 pr-0.5 text-xs"
        >
          {chip.label}
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-4"
            aria-label={t.inbox.listControls.removeFilter(chip.label)}
            onClick={() => onToggle(chip.id, chip.value)}
          >
            <XIcon />
          </Button>
        </Badge>
      ))}
      <Button
        variant="link"
        size="xs"
        className="h-5 px-1 text-muted-foreground"
        onClick={onClear}
      >
        {t.inbox.listControls.clearAll}
      </Button>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {t.inbox.listControls.shownOf(shown, total)}
      </span>
    </div>
  )
}

function FilterItem({
  option,
  checked,
  onToggle,
}: {
  option: { label: string; count: number }
  checked: boolean
  onToggle: () => void
}) {
  return (
    <DropdownMenuCheckboxItem checked={checked} onCheckedChange={onToggle}>
      <span className="truncate">{option.label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {option.count}
      </span>
    </DropdownMenuCheckboxItem>
  )
}
