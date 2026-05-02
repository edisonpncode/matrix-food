/**
 * Helpers para gerar e baixar CSV no client.
 *
 * Convenções:
 *  - Separador: vírgula. Quem precisar de ponto-e-vírgula (Excel pt-BR) pode
 *    abrir o CSV e o Excel detecta. Se for problema futuro, expor option.
 *  - Encoding: UTF-8 com BOM, para o Excel não bagunçar acentos.
 *  - Quoting: aspas duplas em volta de todos os campos não-numéricos para
 *    evitar problemas com vírgulas e quebras de linha.
 */

export type CsvCell = string | number | boolean | null | undefined;
export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => CsvCell;
}

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const str = String(value);
  // Sempre quotar strings — simplifica e evita problemas com vírgula/quebra.
  return `"${str.replace(/"/g, '""')}"`;
}

export function rowsToCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.accessor(row))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const BOM = "﻿";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[]
): void {
  const csv = rowsToCsv(columns, rows);
  downloadCsv(filename, csv);
}
