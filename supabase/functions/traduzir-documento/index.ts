import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { unzipSync, zipSync } from "npm:fflate@0.8.2";

// Traducao de documentos DOCX/PPTX preservando layout.
//
// DOCX e PPTX sao pacotes ZIP contendo XML: o texto vive em nos <w:t> (Word)
// e <a:t> (PowerPoint), separados da formatacao. A estrategia e substituir
// apenas o conteudo desses nos, paragrafo a paragrafo, mantendo todo o resto
// do pacote intacto (imagens, estilos, posicionamento).
//
// PDF nao e suportado: e um formato de layout fixo (texto posicionado por
// coordenadas, fontes embutidas por subconjunto de glifos) — nao ha como
// reinserir texto traduzido preservando o layout com fidelidade.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TESS_API_KEY = Deno.env.get("TESS_API_KEY") ?? "";
const TESS_BASE_URL = Deno.env.get("TESS_BASE_URL") ?? "https://api.tess.im";
const TESS_WORKSPACE_ID = Deno.env.get("TESS_WORKSPACE_ID") ?? "";
// Agente dedicado a documentos se existir; senao reutiliza o de noticias
const TESS_AGENT_DOC =
  Deno.env.get("TESS_AGENT_TRADUCAO_DOC") ??
  Deno.env.get("TESS_AGENT_TRADUCAO") ??
  "";
const TESS_MODEL = Deno.env.get("TESS_MODEL") ?? "claude-4.5-haiku";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const MAX_SEGMENTOS = 600;
const BATCH_MAX_ITENS = 40;
const BATCH_MAX_CHARS = 8000;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface FormatoDoc {
  arquivos: RegExp;
  paragrafo: RegExp;
  texto: RegExp;
  novoTexto: (t: string) => string;
}

const FORMATOS: Record<string, FormatoDoc> = {
  docx: {
    arquivos: /^word\/(document|header\d*|footer\d*)\.xml$/,
    paragrafo: /<w:p[ >][\s\S]*?<\/w:p>/g,
    texto: /<w:t(?:\s[^>]*)?\/>|<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g,
    novoTexto: (t) => `<w:t xml:space="preserve">${xmlEscape(t)}</w:t>`,
  },
  pptx: {
    arquivos: /^ppt\/slides\/slide\d+\.xml$/,
    paragrafo: /<a:p>[\s\S]*?<\/a:p>/g,
    texto: /<a:t\/>|<a:t>[\s\S]*?<\/a:t>/g,
    novoTexto: (t) => `<a:t>${xmlEscape(t)}</a:t>`,
  },
};

function textoDoParagrafo(paragrafoXml: string, fmt: FormatoDoc): string {
  const partes: string[] = [];
  for (const m of paragrafoXml.match(fmt.texto) ?? []) {
    const inner = m.match(/>([\s\S]*)</);
    partes.push(inner ? xmlUnescape(inner[1]) : "");
  }
  return partes.join("");
}

function injetarTexto(paragrafoXml: string, fmt: FormatoDoc, traduzido: string): string {
  let primeiro = true;
  return paragrafoXml.replace(fmt.texto, () => {
    if (primeiro) {
      primeiro = false;
      return fmt.novoTexto(traduzido);
    }
    return fmt.novoTexto("");
  });
}

async function callTess(userPrompt: string): Promise<string> {
  const url = `${TESS_BASE_URL}/agents/${TESS_AGENT_DOC}/execute`;
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
  if (!resp) throw new Error(`Resposta Tess vazia`);
  if (resp.status === "failed" || resp.status === "error") {
    throw new Error(`Tess falhou: ${resp.output?.slice(0, 200) ?? "sem detalhes"}`);
  }
  return resp.output ?? "";
}

function extractJsonArray(text: string): string[] {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const raw of [...fences, text]) {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      /* tenta o proximo candidato */
    }
  }
  throw new Error(`Array JSON nao encontrado na resposta Tess. Preview: "${text.slice(0, 200)}"`);
}

async function traduzirLote(
  textos: string[],
  idioma: "en" | "es",
  refs: string[]
): Promise<string[]> {
  const alvo = idioma === "en" ? "ingles" : "espanhol";
  const prompt = [
    `Traduza os trechos abaixo de portugues para ${alvo}.`,
    `Sao trechos extraidos de um documento institucional do Clube de Regatas do Flamengo (apresentacao ou relatorio); preserve nomes proprios, siglas, numeros e valores exatamente como estao.`,
    refs.length
      ? `Use estas URLs como referencia de tom, vocabulario e estilo editorial no idioma de destino:\n${refs.join("\n")}`
      : "",
    `Responda APENAS com um array JSON de strings com EXATAMENTE ${textos.length} itens, na mesma ordem dos trechos de entrada, sem comentarios nem texto adicional. Trechos vazios ou intraduziveis devem ser devolvidos como estao.`,
    `Trechos (JSON):\n${JSON.stringify(textos)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const out = await callTess(prompt);
    const arr = extractJsonArray(out);
    if (arr.length === textos.length) return arr;
  }
  throw new Error(
    `Tess devolveu quantidade de traducoes diferente da esperada (${textos.length} trechos).`
  );
}

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!TESS_API_KEY || !TESS_AGENT_DOC) {
      throw new Error(
        "Secrets obrigatorios ausentes: TESS_API_KEY e TESS_AGENT_TRADUCAO_DOC (ou TESS_AGENT_TRADUCAO)."
      );
    }

    const body = await req.json();
    const { filename, fileBase64, idioma } = body as {
      filename?: string;
      fileBase64?: string;
      idioma?: string;
    };

    if (!filename || !fileBase64 || (idioma !== "en" && idioma !== "es")) {
      return respond(
        { error: "Envie filename, fileBase64 e idioma ('en' ou 'es')." },
        400
      );
    }

    const ext = filename.toLowerCase().split(".").pop() ?? "";
    if (ext === "pdf") {
      return respond(
        {
          error:
            "PDF nao e suportado para traducao com layout preservado: e um formato de layout fixo. Envie o PPTX ou DOCX original que gerou o PDF.",
        },
        400
      );
    }
    const fmt = FORMATOS[ext];
    if (!fmt) {
      return respond({ error: `Formato .${ext} nao suportado. Use .docx ou .pptx.` }, 400);
    }

    const zip = unzipSync(base64ParaBytes(fileBase64));
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // 1) Extrai os paragrafos com texto de todos os XMLs relevantes
    const segmentos: { arquivo: string; indice: number; texto: string }[] = [];
    const xmls: Record<string, string> = {};
    for (const nome of Object.keys(zip)) {
      if (!fmt.arquivos.test(nome)) continue;
      const xml = decoder.decode(zip[nome]);
      xmls[nome] = xml;
      let indice = 0;
      for (const p of xml.match(fmt.paragrafo) ?? []) {
        const texto = textoDoParagrafo(p, fmt);
        if (/\p{L}/u.test(texto)) {
          segmentos.push({ arquivo: nome, indice, texto });
        }
        indice++;
      }
    }

    if (segmentos.length === 0) {
      return respond({ error: "Nenhum texto encontrado no documento." }, 400);
    }
    if (segmentos.length > MAX_SEGMENTOS) {
      return respond(
        {
          error: `Documento muito grande (${segmentos.length} trechos; limite ${MAX_SEGMENTOS}). Divida o arquivo.`,
        },
        400
      );
    }

    // 2) Referencias ativas do idioma de destino (mesma base das noticias)
    const { data: refsData } = await supabase
      .from("referencias_traducao")
      .select("url")
      .eq("ativo", true)
      .eq("idioma", idioma);
    const refs = (refsData ?? []).map((r) => r.url);

    // 3) Traduz em lotes
    const traducoes = new Map<string, string>();
    let lote: typeof segmentos = [];
    let chars = 0;
    const lotes: (typeof segmentos)[] = [];
    for (const seg of segmentos) {
      if (lote.length >= BATCH_MAX_ITENS || chars + seg.texto.length > BATCH_MAX_CHARS) {
        if (lote.length) lotes.push(lote);
        lote = [];
        chars = 0;
      }
      lote.push(seg);
      chars += seg.texto.length;
    }
    if (lote.length) lotes.push(lote);

    for (const l of lotes) {
      const resultado = await traduzirLote(l.map((s) => s.texto), idioma, refs);
      l.forEach((s, i) => traducoes.set(`${s.arquivo}#${s.indice}`, resultado[i]));
    }

    // 4) Reinjeta as traducoes nos XMLs, paragrafo a paragrafo
    for (const nome of Object.keys(xmls)) {
      let indice = 0;
      xmls[nome] = xmls[nome].replace(fmt.paragrafo, (p) => {
        const traduzido = traducoes.get(`${nome}#${indice}`);
        indice++;
        return traduzido !== undefined ? injetarTexto(p, fmt, traduzido) : p;
      });
      zip[nome] = encoder.encode(xmls[nome]);
    }

    // 5) Reempacota o documento
    const saida = zipSync(zip, { level: 6 });
    const base = filename.replace(/\.[^.]+$/, "");
    return respond({
      ok: true,
      filename: `${base}_${idioma}.${ext}`,
      fileBase64: bytesParaBase64(saida),
      segmentos: segmentos.length,
    });
  } catch (e: any) {
    return respond({ error: String(e?.message ?? e) }, 500);
  }
});
