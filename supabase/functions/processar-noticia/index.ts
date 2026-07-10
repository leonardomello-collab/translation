import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TESS_API_KEY = Deno.env.get("TESS_API_KEY") ?? "";
const TESS_BASE_URL = Deno.env.get("TESS_BASE_URL") ?? "https://api.tess.im";
const TESS_WORKSPACE_ID = Deno.env.get("TESS_WORKSPACE_ID") ?? "";
const TESS_AGENT_EXTRACAO = Deno.env.get("TESS_AGENT_EXTRACAO") ?? "";
const TESS_AGENT_TRADUCAO = Deno.env.get("TESS_AGENT_TRADUCAO") ?? "";
const TESS_MODEL = Deno.env.get("TESS_MODEL") ?? "claude-4.5-haiku";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function assertSecrets() {
  const missing: string[] = [];
  if (!TESS_API_KEY) missing.push("TESS_API_KEY");
  if (!TESS_AGENT_EXTRACAO) missing.push("TESS_AGENT_EXTRACAO");
  if (!TESS_AGENT_TRADUCAO) missing.push("TESS_AGENT_TRADUCAO");
  if (missing.length) {
    throw new Error(
      `Secrets obrigatorios ausentes: ${missing.join(", ")}. Configure via Supabase Dashboard > Edge Functions > Secrets.`
    );
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha6(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 6);
}

function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(
      (w) =>
        ![
          "o", "a", "os", "as", "de", "do", "da", "dos", "das", "e", "em",
          "no", "na", "com", "para", "por", "um", "uma",
        ].includes(w)
    )
    .slice(0, 5)
    .join("-");
}

async function callTessAgent(
  agentId: string,
  userPrompt: string
): Promise<string> {
  const url = `${TESS_BASE_URL}/agents/${agentId}/execute`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TESS_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (TESS_WORKSPACE_ID) headers["x-workspace-id"] = TESS_WORKSPACE_ID;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      temperature: "0.25",
      model: TESS_MODEL,
      tools: "no-tools",
      waitExecution: true,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tess ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const resp = data.responses?.[0];
  if (!resp)
    throw new Error(
      `Resposta Tess vazia: ${JSON.stringify(data).slice(0, 200)}`
    );
  if (resp.status === "failed" || resp.status === "error") {
    throw new Error(
      `Tess falhou: ${resp.output?.slice(0, 200) ?? "sem detalhes"}`
    );
  }
  return resp.output ?? "";
}

function extractJson(text: string): any {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(
    (m) => m[1]
  );
  const candidates = [...fences, text];
  for (const raw of candidates) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `JSON nao encontrado na resposta Tess. Preview: "${text.slice(0, 300)}"`
  );
}

// Remove blocos que nao carregam conteudo editorial antes de enviar a Tess.
// Sem isso, paginas pesadas em script estouravam o corte de 80k chars antes
// do texto da noticia, causando "Extracao incompleta".
function limparHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

async function processarUrl(
  url_origem: string,
  refsEn: string[],
  refsEs: string[],
  jobId: string
) {
  const pageRes = await fetch(url_origem, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FlaNewsBot/1.0)",
      Accept: "text/html",
    },
  });
  if (!pageRes.ok) {
    throw new Error(
      `URL retornou HTTP ${pageRes.status} — pagina nao encontrada ou inacessivel`
    );
  }
  const html = await pageRes.text();
  if (html.length < 500) {
    throw new Error(
      `HTML muito curto (${html.length} chars) — pagina vazia ou bloqueada`
    );
  }

  const cleanedHtml = limparHtml(html).slice(0, 80000);

  // group_id determinístico e estavel: se a URL ja foi processada antes,
  // reutiliza o group_id existente para nao duplicar a noticia
  // (o componente de data mudaria o id a cada reprocessamento em outro dia).
  const { data: existente } = await supabase
    .from("noticias")
    .select("group_id")
    .eq("url_origem", url_origem)
    .maybeSingle();

  const hash6 = await sha6(url_origem);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tempSlug =
    slugify(url_origem.split("/").pop() ?? "noticia") || "noticia";
  const group_id =
    existente?.group_id ?? `flanews_${today}_${tempSlug.slice(0, 40)}_${hash6}`;

  // PARTE 1: Extracao
  const userMsg1 = `URL: ${url_origem}\ngroup_id sugerido: ${group_id}\n\nHTML:\n${cleanedHtml}`;
  const text1 = await callTessAgent(TESS_AGENT_EXTRACAO, userMsg1);
  const parte1 = extractJson(text1);
  parte1.url_origem = url_origem;
  parte1.group_id = group_id;

  const ptBR = parte1.versoes?.["pt-BR"];
  if (!ptBR?.titulo || !ptBR?.corpo || ptBR.corpo.length < 50) {
    throw new Error(
      `Extracao incompleta — titulo="${ptBR?.titulo ?? ""}", corpo=${ptBR?.corpo?.length ?? 0} chars. A pagina pode nao ser uma noticia valida.`
    );
  }

  await supabase
    .from("jobs_traducao")
    .update({
      fase: "traducao",
      group_id: parte1.group_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // PARTE 2: Traducao
  const userMsg2 = `JSON da Parte 1:\n${JSON.stringify(parte1)}\n\nReferencias EN:\n${refsEn.join("\n") || "(nenhuma)"}\n\nReferencias ES:\n${refsEs.join("\n") || "(nenhuma)"}`;
  const text2 = await callTessAgent(TESS_AGENT_TRADUCAO, userMsg2);
  const parte2 = extractJson(text2);

  parte2.url_origem = url_origem;
  parte2.group_id = parte1.group_id;
  if (!parte2.imagens) parte2.imagens = parte1.imagens;
  if (!parte2.publicado_em) parte2.publicado_em = parte1.publicado_em;
  if (parte2.versoes && !parte2.versoes["pt-BR"] && parte1.versoes?.["pt-BR"]) {
    parte2.versoes["pt-BR"] = parte1.versoes["pt-BR"];
  }

  await persistir(parte2);
  return { group_id: parte2.group_id };
}

async function persistir(data: any) {
  const { group_id, url_origem, publicado_em, imagens, versoes, notas_extracao } = data;

  await supabase.from("noticias").upsert({
    group_id,
    url_origem,
    publicado_em: publicado_em ?? null,
    notas_extracao: notas_extracao ?? null,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("versoes").delete().eq("group_id", group_id);
  const versoesRows = Object.entries(versoes ?? {}).map(
    ([idioma, v]: any) => ({
      group_id,
      idioma,
      titulo: v.titulo ?? "",
      subtitulo: v.subtitulo ?? null,
      corpo: v.corpo ?? "",
      descricao: v.descricao ?? "",
      palavras_chave: v.palavras_chave ?? [],
      url_personalizada: v.url_personalizada ?? "",
      categoria: v.categoria ?? "",
    })
  );
  if (versoesRows.length) await supabase.from("versoes").insert(versoesRows);

  await supabase.from("imagens").delete().eq("group_id", group_id);
  const imagensRows = (imagens ?? []).map((img: any, i: number) => ({
    group_id,
    url: img.url,
    caption: img.caption ?? null,
    role: img.role ?? "inline",
    ordem: i,
  }));
  if (imagensRows.length) await supabase.from("imagens").insert(imagensRows);
}

async function runWatchdog() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("jobs_traducao")
    .update({
      status: "erro",
      mensagem_erro: "Timeout: processamento excedeu 10 minutos",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "processando")
    .lt("updated_at", tenMinAgo)
    .select("id");

  // Se a corrente de processamento morreu (ha jobs na fila mas nenhum
  // processando), religa a corrente — sem isso jobs ficavam presos em
  // "fila" para sempre apos uma falha da function.
  const [{ count: emFila }, { count: processando }] = await Promise.all([
    supabase
      .from("jobs_traducao")
      .select("id", { count: "exact", head: true })
      .eq("status", "fila"),
    supabase
      .from("jobs_traducao")
      .select("id", { count: "exact", head: true })
      .eq("status", "processando"),
  ]);
  if ((emFila ?? 0) > 0 && (processando ?? 0) === 0) {
    triggerNext();
  }

  return (data ?? []).length;
}

// Self-invocation: triggers processing of next job in background
function triggerNext() {
  const fnUrl = `${SUPABASE_URL}/functions/v1/processar-noticia`;
  const promise = fetch(fnUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "processar-proximo" }),
  }).catch(() => {});
  // Keep the fetch alive after response is sent
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(promise);
  }
}

// Tenta reivindicar o proximo job da fila. Com workers em paralelo, dois
// podem selecionar o mesmo candidato; o perdedor tenta o proximo em vez de
// encerrar sua corrente (o que degradaria o paralelismo para 1).
async function claimProximoJob(): Promise<{ id: string; url_origem: string } | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: candidates } = await supabase
      .from("jobs_traducao")
      .select("id, url_origem")
      .eq("status", "fila")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!candidates || candidates.length === 0) return null;

    const job = candidates[0];
    const { data: claimed } = await supabase
      .from("jobs_traducao")
      .update({
        status: "processando",
        fase: "extracao",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "fila")
      .select("id");

    if (claimed && claimed.length > 0) return job;
  }
  return null;
}

async function processarProximo(): Promise<{ processed: boolean; group_id?: string; error?: string }> {
  const job = await claimProximoJob();
  if (!job) {
    return { processed: false };
  }

  // Fetch references
  const { data: refs } = await supabase
    .from("referencias_traducao")
    .select("idioma, url")
    .eq("ativo", true);
  const refsEn = (refs ?? []).filter((r) => r.idioma === "en").map((r) => r.url);
  const refsEs = (refs ?? []).filter((r) => r.idioma === "es").map((r) => r.url);

  try {
    const result = await processarUrl(job.url_origem, refsEn, refsEs, job.id);
    await supabase
      .from("jobs_traducao")
      .update({
        status: "concluido",
        group_id: result.group_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { processed: true, group_id: result.group_id };
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 500);
    await supabase
      .from("jobs_traducao")
      .update({
        status: "erro",
        mensagem_erro: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { processed: true, error: msg };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    assertSecrets();
    const body = await req.json();

    // Watchdog: mark stuck jobs as error
    if (body.action === "watchdog") {
      const count = await runWatchdog();
      return respond({ ok: true, timed_out: count });
    }

    // Limpar jobs by status
    if (body.action === "limpar") {
      const filter = body.filter ?? "erro";
      if (filter === "todos") {
        await supabase
          .from("jobs_traducao")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } else {
        await supabase.from("jobs_traducao").delete().eq("status", filter);
      }
      return respond({ ok: true, action: "limpar", filter });
    }

    // Cancelar job
    if (body.action === "cancelar" && body.job_id) {
      await supabase
        .from("jobs_traducao")
        .update({
          status: "erro",
          mensagem_erro: "Cancelado pelo usuario",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.job_id);
      return respond({ ok: true });
    }

    // Reprocessar: move job back to queue
    if (body.action === "reprocessar" && body.job_id) {
      await supabase
        .from("jobs_traducao")
        .update({
          status: "fila",
          fase: "extracao",
          mensagem_erro: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.job_id);
      triggerNext();
      return respond({ ok: true });
    }

    // Processar proximo: picks 1 job from queue, processes it, then chains
    if (body.action === "processar-proximo") {
      const result = await processarProximo();
      // If we processed one, trigger next in chain
      if (result.processed) {
        triggerNext();
      }
      return respond({ ok: true, ...result });
    }

    // Enfileirar: insert all URLs as jobs in bulk, then trigger processing
    if (body.action === "enfileirar" && Array.isArray(body.urls)) {
      const urls: string[] = body.urls.filter(
        (u: string) => typeof u === "string" && u.startsWith("http")
      );
      if (urls.length === 0) {
        return respond({ error: "Nenhuma URL valida" }, 400);
      }

      // Dedup: dentro do proprio lote e contra jobs ja na fila/processando
      const unicas = [...new Set(urls)];
      const { data: ativos } = await supabase
        .from("jobs_traducao")
        .select("url_origem")
        .in("status", ["fila", "processando"]);
      const emAndamento = new Set((ativos ?? []).map((j) => j.url_origem));
      const novas = unicas.filter((u) => !emAndamento.has(u));

      if (novas.length === 0) {
        return respond({
          ok: true,
          enqueued: 0,
          skipped: urls.length,
        });
      }

      const rows = novas.map((url) => ({
        url_origem: url,
        status: "fila",
        fase: "extracao",
      }));
      const { data, error } = await supabase
        .from("jobs_traducao")
        .insert(rows)
        .select("id, url_origem");
      if (error) {
        return respond({ error: error.message }, 500);
      }

      // Dispara ate 3 correntes em paralelo para dar vazao a lotes grandes
      const paralelismo = Math.min(3, (data ?? []).length);
      for (let i = 0; i < paralelismo; i++) {
        triggerNext();
      }
      return respond({
        ok: true,
        enqueued: (data ?? []).length,
        skipped: urls.length - novas.length,
      });
    }

    // Legacy: single URL direct processing (kept for backward compat)
    const url: string = body.url ?? body.urls?.[0];
    if (!url) {
      return respond({ error: "Nenhuma URL fornecida" }, 400);
    }

    // Enqueue single + process
    const { data: job } = await supabase
      .from("jobs_traducao")
      .insert({ url_origem: url, fase: "extracao", status: "fila" })
      .select("id")
      .maybeSingle();

    if (job) {
      await supabase
        .from("jobs_traducao")
        .update({ status: "processando", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      const { data: refs } = await supabase
        .from("referencias_traducao")
        .select("idioma, url")
        .eq("ativo", true);
      const refsEn = (refs ?? []).filter((r) => r.idioma === "en").map((r) => r.url);
      const refsEs = (refs ?? []).filter((r) => r.idioma === "es").map((r) => r.url);

      try {
        const result = await processarUrl(url, refsEn, refsEs, job.id);
        await supabase
          .from("jobs_traducao")
          .update({
            status: "concluido",
            group_id: result.group_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        return respond({ ok: true, group_id: result.group_id });
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 500);
        await supabase
          .from("jobs_traducao")
          .update({
            status: "erro",
            mensagem_erro: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        return respond({ ok: false, error: msg });
      }
    }

    return respond({ error: "Falha ao criar job" }, 500);
  } catch (e: any) {
    return respond({ error: String(e?.message ?? e) }, 500);
  }
});
