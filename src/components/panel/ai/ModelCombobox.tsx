import { useTranslation } from "react-i18next";
import { MdCheck, MdExpandMore } from "react-icons/md";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getModelProviderLabel } from "@/lib/aiSettings";
import type { AIModelConfigItem, AIProviderCredential } from "@/types/global";

export function ModelCombobox({
  models,
  credentials,
  selectedModel,
  open,
  onOpenChange,
  onSelect,
  className,
}: {
  models: AIModelConfigItem[];
  credentials: AIProviderCredential[];
  selectedModel: AIModelConfigItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (model: AIModelConfigItem) => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`h-8 min-w-0 max-w-[12rem] justify-between gap-2 px-2 text-xs ${className}`}
          disabled={models.length === 0}
        >
          <span className="truncate">{selectedModel?.name ?? t("ai.modelSelect")}</span>
          <MdExpandMore className="shrink-0 text-sm" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("ai.searchModels")} className="text-xs" />
          <CommandList className="max-h-64 terminal-scroll">
            <CommandEmpty>{t("ai.noModelMatches")}</CommandEmpty>
            <CommandGroup>
              {models.map((model) => {
                const providerLabel = getModelProviderLabel(model, credentials);
                return (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${providerLabel} ${model.id}`}
                    onSelect={() => {
                      onSelect(model);
                      onOpenChange(false);
                    }}
                  >
                    <MdCheck
                      className={`text-sm ${selectedModel?.id === model.id ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{model.name}</span>
                    {providerLabel ? (
                      <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                        {providerLabel}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
