"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileJson,
  FileUp,
  Download,
  Table as TableIcon,
  Filter,
  Search,
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  Trophy,
  Layers,
  Hash,
  Calendar,
  Copy,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  parseReport,
  flattenForSpreadsheet,
  type ParsedReport,
  type SpreadsheetRow,
} from "@/lib/jsonParser";
import {
  exportAllToXlsx,
  exportByCategoryToXlsx,
  exportAllToCsv,
  exportJson,
} from "@/lib/exportUtils";

type Status = "won" | "lost" | "notStarted" | "";

const STATUS_LABELS: Record<string, string> = {
  won: "Ganada",
  lost: "Perdida",
  notStarted: "No iniciada",
  "": "—",
};

const STATUS_STYLES: Record<string, string> = {
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  notStarted:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "": "bg-muted text-muted-foreground",
};

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState<string>("");
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>("__ALL__");
  const [sectionFilter, setSectionFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");
  const [search, setSearch] = useState<string>("");

  // ---- Load helpers -------------------------------------------------------
  const loadFromText = useCallback(
    (text: string) => {
      if (!text.trim()) {
        toast({
          title: "Vacío",
          description: "Pega o sube contenido JSON primero.",
          variant: "destructive",
        });
        return;
      }
      try {
        const parsed = parseReport(text);
        setReport(parsed);
        setParseError(null);
        setActiveCategory("__ALL__");
        setSectionFilter("__ALL__");
        setStatusFilter("__ALL__");
        setSearch("");
        const totalRows = parsed.groups.reduce(
          (acc, g) => acc + g.predictions.length,
          0,
        );
        toast({
          title: "JSON cargado",
          description: `${totalRows} predicciones en ${parsed.groups.length} secciones.`,
        });
      } catch (e: any) {
        setReport(null);
        setParseError(e?.message ?? "Error al procesar el JSON.");
        toast({
          title: "No se pudo procesar",
          description: e?.message ?? "Revisa el formato del JSON.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      const isJson =
        file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
      if (!isJson) {
        toast({
          title: "Formato no soportado",
          description: "Selecciona un archivo .json.",
          variant: "destructive",
        });
        return;
      }
      try {
        const text = await file.text();
        setRawInput(text);
        loadFromText(text);
      } catch {
        toast({
          title: "Error de lectura",
          description: "No se pudo leer el archivo.",
          variant: "destructive",
        });
      }
    },
    [loadFromText, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ---- Sample loader ------------------------------------------------------
  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/sample.json");
      if (!res.ok) throw new Error("no sample");
      const text = await res.text();
      setRawInput(text);
      loadFromText(text);
    } catch {
      toast({
        title: "Sin ejemplo",
        description: "No se pudo cargar el archivo de ejemplo.",
        variant: "destructive",
      });
    }
  }, [loadFromText, toast]);

  // ---- Derived data -------------------------------------------------------
  const allRows: SpreadsheetRow[] = useMemo(
    () => (report ? flattenForSpreadsheet(report) : []),
    [report],
  );

  const categories = useMemo(
    () => (report ? report.categories : []),
    [report],
  );

  const sectionsForActiveCategory = useMemo(() => {
    if (!report) return [] as string[];
    const set = new Set<string>();
    for (const g of report.groups) {
      if (activeCategory !== "__ALL__" && g.category !== activeCategory) continue;
      set.add(g.sectionName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [report, activeCategory]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (activeCategory !== "__ALL__")
      rows = rows.filter((r) => r.Category === activeCategory);
    if (sectionFilter !== "__ALL__")
      rows = rows.filter((r) => r.Section === sectionFilter);
    if (statusFilter !== "__ALL__")
      rows = rows.filter(
        (r) =>
          (r.CompetitionStatus || "").toLowerCase() ===
          statusFilter.toLowerCase(),
      );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.League, r.Home, r.Away, r.Prediction, r.Section]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return rows;
  }, [allRows, activeCategory, sectionFilter, statusFilter, search]);

  // ---- Stats --------------------------------------------------------------
  const stats = useMemo(() => {
    const total = allRows.length;
    const won = allRows.filter(
      (r) => (r.CompetitionStatus || "").toLowerCase() === "won",
    ).length;
    const lost = allRows.filter(
      (r) => (r.CompetitionStatus || "").toLowerCase() === "lost",
    ).length;
    const notStarted = allRows.filter(
      (r) => (r.CompetitionStatus || "").toLowerCase() === "notstarted",
    ).length;
    const sections = report?.groups.length ?? 0;
    // Aggregate rate multiplied (combinada) per section, where applicable.
    return { total, won, lost, notStarted, sections };
  }, [allRows, report]);

  // ---- Actions ------------------------------------------------------------
  const reset = useCallback(() => {
    setReport(null);
    setRawInput("");
    setParseError(null);
    setActiveCategory("__ALL__");
    setSectionFilter("__ALL__");
    setStatusFilter("__ALL__");
    setSearch("");
  }, []);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawInput);
      toast({ title: "Copiado", description: "JSON copiado al portapapeles." });
    } catch {
      toast({
        title: "No se pudo copiar",
        variant: "destructive",
      });
    }
  }, [rawInput, toast]);

  // ---- Render -------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="size-5 text-primary" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold">
                JSON → Hoja de cálculo
              </h1>
              <p className="text-xs text-muted-foreground">
                Convierte tips de apuestas (MultiTips / Prime) en Excel y CSV
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSample}
              disabled={!report && !rawInput ? false : false}
            >
              <Sparkles className="size-4 mr-1" /> Ejemplo
            </Button>
            {report && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <Trash2 className="size-4 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {!report ? (
          <Uploader
            rawInput={rawInput}
            setRawInput={setRawInput}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onDrop={onDrop}
            fileInputRef={fileInputRef}
            onPickFile={() => fileInputRef.current?.click()}
            onFileChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
            onLoad={() => loadFromText(rawInput)}
            parseError={parseError}
            onCopy={copyJson}
          />
        ) : (
          <div className="space-y-6">
            {/* Metadata + stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                    <FileJson className="size-3.5" /> App
                  </div>
                  <p className="mt-1 font-medium truncate">
                    {report.app || "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                    <Calendar className="size-3.5" /> Timestamp
                  </div>
                  <p className="mt-1 font-medium truncate">
                    {report.timestamp || "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                    <Layers className="size-3.5" /> Secciones
                  </div>
                  <p className="mt-1 font-medium">{stats.sections}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                    <Hash className="size-3.5" /> Predicciones
                  </div>
                  <p className="mt-1 font-medium">{stats.total}</p>
                </CardContent>
              </Card>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5 mr-1" /> Ganadas: {stats.won}
              </Badge>
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Clock className="size-3.5 mr-1" /> No iniciadas:{" "}
                {stats.notStarted}
              </Badge>
              {stats.lost > 0 && (
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  <X className="size-3.5 mr-1" /> Perdidas: {stats.lost}
                </Badge>
              )}
              <Badge className="bg-muted text-muted-foreground">
                <Trophy className="size-3.5 mr-1" /> Total: {stats.total}
              </Badge>
            </div>

            {/* Export toolbar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Exportar</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    exportAllToXlsx(allRows, report.app || "tips")
                  }
                  disabled={allRows.length === 0}
                >
                  <Download className="size-4 mr-1" /> Excel (una hoja)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => exportByCategoryToXlsx(report, report.app || "tips")}
                  disabled={allRows.length === 0}
                >
                  <Layers className="size-4 mr-1" /> Excel (por categoría)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportAllToCsv(allRows, report.app || "tips")}
                  disabled={allRows.length === 0}
                >
                  <Download className="size-4 mr-1" /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => exportJson(report, report.app || "tips")}
                >
                  <FileJson className="size-4 mr-1" /> JSON parseado
                </Button>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Filter className="size-4" /> Filtros:
                  </div>
                  <Select
                    value={activeCategory}
                    onValueChange={(v) => {
                      setActiveCategory(v);
                      setSectionFilter("__ALL__");
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">Todas</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={sectionFilter}
                    onValueChange={setSectionFilter}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Sección" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">Todas las secciones</SelectItem>
                      {sectionsForActiveCategory.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">Todos los estados</SelectItem>
                      <SelectItem value="won">Ganada</SelectItem>
                      <SelectItem value="notstarted">No iniciada</SelectItem>
                      <SelectItem value="lost">Perdida</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar liga, equipo, predicción…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground ml-auto">
                    {filteredRows.length} fila(s) · {allRows.length} total
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs + table */}
            <Tabs value={activeCategory} onValueChange={(v) => {
              setActiveCategory(v);
              setSectionFilter("__ALL__");
            }}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="__ALL__">Todas</TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="max-h-[60vh] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-card">
                          <TableRow>
                            <TableHead className="w-[120px]">Categoría</TableHead>
                            <TableHead className="min-w-[180px]">Sección</TableHead>
                            <TableHead className="w-[70px]">Hora</TableHead>
                            <TableHead className="min-w-[220px]">Liga</TableHead>
                            <TableHead className="min-w-[180px]">Local</TableHead>
                            <TableHead className="min-w-[180px]">Visitante</TableHead>
                            <TableHead className="min-w-[220px]">Predicción</TableHead>
                            <TableHead className="w-[70px] text-right">Cuota</TableHead>
                            <TableHead className="w-[80px] text-center">M. Loc</TableHead>
                            <TableHead className="w-[80px] text-center">M. Vis</TableHead>
                            <TableHead className="w-[110px]">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={11}
                                className="text-center text-muted-foreground py-8"
                              >
                                Sin resultados para los filtros actuales.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredRows.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <Badge variant="outline" className="text-[11px]">
                                    {r.Category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-[13px]">
                                  {r.Section}
                                </TableCell>
                                <TableCell className="font-mono text-[12px] text-muted-foreground">
                                  {r.Time}
                                </TableCell>
                                <TableCell className="text-[13px]">
                                  {r.League}
                                </TableCell>
                                <TableCell className="text-[13px]">
                                  {r.Home}
                                </TableCell>
                                <TableCell className="text-[13px]">
                                  {r.Away}
                                </TableCell>
                                <TableCell className="text-[13px]">
                                  {r.Prediction}
                                </TableCell>
                                <TableCell className="text-right font-mono text-[13px]">
                                  {r.Rate}
                                </TableCell>
                                <TableCell className="text-center font-mono text-[13px]">
                                  {r.ScoreHome}
                                </TableCell>
                                <TableCell className="text-center font-mono text-[13px]">
                                  {r.ScoreAway}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`text-[11px] ${STATUS_STYLES[(r.CompetitionStatus || "").toLowerCase()] ?? STATUS_STYLES[""]}`}
                                  >
                                    {STATUS_LABELS[r.CompetitionStatus || ""] || r.CompetitionStatus}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t bg-card/40">
        <div className="max-w-7xl mx-auto px-4 py-3 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>
            Hecho con Next.js · Tailwind · shadcn/ui · SheetJS
          </span>
          <span>
            Las predicciones se procesan 100% en tu navegador — no se envían a
            ningún servidor.
          </span>
        </div>
      </footer>

      <TooltipProvider>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </TooltipProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Uploader component (shown when there is no parsed report yet)
// ---------------------------------------------------------------------------
function Uploader({
  rawInput,
  setRawInput,
  isDragging,
  setIsDragging,
  onDrop,
  fileInputRef,
  onPickFile,
  onFileChange,
  onLoad,
  parseError,
  onCopy,
}: {
  rawInput: string;
  setRawInput: (v: string) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoad: () => void;
  parseError: string | null;
  onCopy: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Drag & drop / file picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Sube tu archivo JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
            }`}
            onClick={onPickFile}
          >
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <FileUp className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Arrastra tu archivo .json aquí
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              o haz clic para seleccionarlo
            </p>
            <p className="text-[11px] text-muted-foreground mt-3">
              Formatos compatibles: MultiTips y Prime Betting
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFileChange}
          />
        </CardContent>
      </Card>

      {/* Paste JSON */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">2 · O pega el JSON</CardTitle>
            {rawInput && (
              <Button variant="ghost" size="sm" onClick={onCopy}>
                <Copy className="size-3.5 mr-1" /> Copiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder='Pega aquí el JSON, p. ej. { "app": "com.multitips", "FREE": [ ... ], "VIP": [ ... ] }'
            className="font-mono text-[12px] min-h-[200px] resize-y"
          />
          {parseError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={onLoad} disabled={!rawInput.trim()}>
              <TableIcon className="size-4 mr-1" /> Convertir a hoja
            </Button>
            <Button variant="outline" onClick={() => setRawInput("")}>
              Limpiar texto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
