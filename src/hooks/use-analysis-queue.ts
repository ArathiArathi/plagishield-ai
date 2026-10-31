import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processQueue } from "@/lib/analysis.functions";
import { useAuth } from "@/hooks/use-auth";

type QueueResult = { started: boolean; reason?: string; ok?: boolean; error?: string };

/**
 * Drives the single-file-at-a-time analysis queue.
 *
 * - `drain()` keeps calling the server queue driver until nothing is pending.
 * - On mount (and whenever the user changes) any analysis left in
 *   `pending`/`processing` is picked up automatically, so a document can never
 *   stay stuck at "queued" because the uploader navigated away or reloaded.
 */
export function useAnalysisQueue(options: { autoStart?: boolean } = {}) {
  const { autoStart = true } = options;
  const { user } = useAuth();
  const qc = useQueryClient();
  const processQueueFn = useServerFn(processQueue);
  const running = useRef(false);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["analyses-latest"] });
    qc.invalidateQueries({ queryKey: ["workspace-data"] });
  }, [qc]);

  const drain = useCallback(
    async (opts: { notify?: boolean } = {}) => {
      const notify = opts.notify ?? true;
      if (running.current) return;
      running.current = true;
      try {
        for (let i = 0; i < 25; i++) {
          const res = (await processQueueFn({ data: undefined })) as QueueResult | undefined;
          refresh();
          if (!res?.started) return;
          if (res.ok === false && res.error) {
            if (notify) toast.error(`Analysis failed: ${res.error}`);
          } else if (notify) {
            toast.success("Analysis complete");
          }
        }
      } catch (e: unknown) {
        if (notify) toast.error(e instanceof Error ? e.message : "Queue error");
        refresh();
      } finally {
        running.current = false;
      }
    },
    [processQueueFn, refresh],
  );

  useEffect(() => {
    if (!autoStart || !user) return;
    let cancelled = false;

    const tick = async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id")
        .in("status", ["pending", "processing"])
        .limit(1);
      if (error) {
        console.error("Could not check the analysis queue:", error);
        return;
      }
      if (cancelled || !data || data.length === 0) return;
      await drain({ notify: false });
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [autoStart, user, drain]);

  return { drain, refresh };
}
