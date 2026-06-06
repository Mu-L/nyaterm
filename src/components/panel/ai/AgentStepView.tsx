import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdBlock, MdExpandMore, MdPlayArrow } from "react-icons/md";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { invoke } from "@/lib/invoke";
import type { AgentStepPayload } from "@/types/global";
import { AnimatedStatusText } from "./AnimatedStatusText";
import { MarkdownContent } from "./MarkdownContent";

export function AgentStepView({
  step,
  prismStyle,
}: {
  step: AgentStepPayload;
  prismStyle: Record<string, CSSProperties>;
}) {
  const { t } = useTranslation();
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  const isCommand = step.action.kind === "execute_command";
  const isFinal = step.action.kind === "final_answer";

  const isSuccess = step.status === "completed";
  const isFailed = step.status === "failed" || step.status === "rejected";
  const isRunning = step.status === "running";

  const borderColor = isSuccess
    ? "border-emerald-500"
    : isFailed
      ? "border-destructive"
      : isRunning
        ? "border-primary"
        : "border-amber-500";

  return (
    <div className="pb-3 last:pb-0">
      <Collapsible open={thoughtOpen} onOpenChange={setThoughtOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-[0.6875rem] text-muted-foreground hover:text-foreground"
          >
            <MdExpandMore
              className={`text-sm transition-transform ${thoughtOpen ? "rotate-180" : ""}`}
            />
            <span className="font-semibold text-foreground">#{step.stepIndex + 1}</span>
            <span>
              {step.thought ? t("ai.expandThought") : isFinal ? t("ai.agentStepCompleted") : ""}
            </span>
            {step.observation?.durationMs != null ? (
              <span className="ml-auto tabular-nums text-muted-foreground/70">
                {step.observation.durationMs}ms
              </span>
            ) : null}
          </button>
        </CollapsibleTrigger>
        {step.thought ? (
          <CollapsibleContent>
            <div className="mt-1 ml-5 text-xs leading-5 text-muted-foreground">{step.thought}</div>
          </CollapsibleContent>
        ) : null}
      </Collapsible>

      {isCommand && step.action.command ? (
        <div
          className={`mt-2 overflow-hidden rounded-md border-l-[3px] ${borderColor} border border-border/60 bg-muted/20`}
        >
          <div className="flex items-center gap-1.5 border-b border-border/40 px-2.5 py-1 text-[0.625rem] text-muted-foreground">
            <span className="font-medium uppercase tracking-wider">shell</span>
          </div>

          <SyntaxHighlighter
            language="bash"
            style={prismStyle}
            customStyle={{
              margin: 0,
              padding: "0.5rem 0.625rem",
              fontSize: "0.6875rem",
              lineHeight: "1.25rem",
              background: "transparent",
              borderRadius: 0,
            }}
            wrapLongLines
          >
            {step.action.command}
          </SyntaxHighlighter>

          {step.observation ? (
            <Collapsible open={outputOpen} onOpenChange={setOutputOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 border-t border-border/40 px-2.5 py-1 text-[0.625rem] text-muted-foreground hover:bg-muted/30"
                >
                  <MdExpandMore
                    className={`text-sm transition-transform ${outputOpen ? "rotate-180" : ""}`}
                  />
                  <span>{outputOpen ? t("ai.collapseOutput") : t("ai.expandOutput")}</span>
                  {step.observation.exitCode != null ? (
                    <span
                      className={`ml-auto font-medium ${step.observation.exitCode === 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {t("ai.stepExitCode", { code: step.observation.exitCode })}
                    </span>
                  ) : null}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="max-h-48 overflow-auto border-t border-border/40 bg-muted/10 px-2.5 py-2 font-mono text-[0.625rem] leading-5 terminal-scroll whitespace-pre-wrap break-all text-muted-foreground">
                  {step.observation.output || "(no output)"}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          {isRunning ? (
            <div className="border-t border-border/40 px-2.5 py-1.5">
              <AnimatedStatusText label={t("ai.agentExecuting")} />
            </div>
          ) : null}

          {step.status === "needs_approval" ? (
            <div className="flex items-center gap-1.5 border-t border-border/40 px-2.5 py-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  void invoke("respond_agent_step", {
                    streamId: step.streamId,
                    stepIndex: step.stepIndex,
                    approved: false,
                  })
                }
              >
                <MdBlock />
                {t("ai.rejectExecute")}
              </Button>
              <Button
                size="xs"
                onClick={() =>
                  void invoke("respond_agent_step", {
                    streamId: step.streamId,
                    stepIndex: step.stepIndex,
                    approved: true,
                  })
                }
              >
                <MdPlayArrow />
                {t("ai.authorizeExecute")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {step.error ? (
        <div className="mt-1.5 ml-5 text-[0.6875rem] text-destructive">{step.error}</div>
      ) : null}

      {isFinal && step.action.answer ? (
        <div className="mt-2 ml-5">
          <MarkdownContent content={step.action.answer} />
        </div>
      ) : null}
    </div>
  );
}
