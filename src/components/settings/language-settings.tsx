import { LanguagesIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useI18n } from "@/hooks/use-i18n"
import { useSavePreferences } from "@/hooks/use-inbox"
import { LANGUAGES, LANGUAGE_NAMES, isLanguage } from "@/lib/i18n/core"

export function LanguageSettings() {
  const { t, language } = useI18n()
  const save = useSavePreferences()
  return (
    <Card>
      <CardContent>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel className="flex items-center gap-2">
              <LanguagesIcon className="size-4" />
              {t.settings.language.title}
            </FieldLabel>
            <FieldDescription>
              {t.settings.language.description}
            </FieldDescription>
          </FieldContent>
          <ToggleGroup
            value={[language]}
            onValueChange={(value) => {
              const next = value[0]
              if (isLanguage(next) && next !== language) {
                save.mutate({ language: next })
              }
            }}
            variant="outline"
            size="sm"
            aria-label={t.settings.language.title}
          >
            {LANGUAGES.map((option) => (
              <ToggleGroupItem key={option} value={option} lang={option}>
                {LANGUAGE_NAMES[option]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </CardContent>
    </Card>
  )
}
