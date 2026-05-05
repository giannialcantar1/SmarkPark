import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workbook = Workbook.create();
const gantt = workbook.worksheets.add("Cronograma Gantt");
const summary = workbook.worksheets.add("Resumen Ejecutivo");

const projectStart = new Date(Date.UTC(2026, 3, 25));
const projectEnd = new Date(Date.UTC(2026, 4, 20));
const totalDays = 26;

const requirements = [
  { id: 1, code: "RF1", name: "Registro de garajes (multi-tenant)", start: "2026-04-25", duration: 2, progress: 1, owner: "BD" },
  { id: 2, code: "RF2", name: "Registro de propietarios/usuarios", start: "2026-04-25", duration: 2, progress: 1, owner: "Backend" },
  { id: 3, code: "RF3", name: "Registro de vehiculos (placa, marca, modelo)", start: "2026-04-27", duration: 2, progress: 1, owner: "Backend" },
  { id: 4, code: "RF4", name: "Asignacion de parqueos por unidad", start: "2026-04-29", duration: 2, progress: 1, owner: "Backend" },
  { id: 5, code: "RF5", name: "Control de entradas/salidas", start: "2026-05-01", duration: 3, progress: 1, owner: "Backend" },
  { id: 6, code: "RF6", name: "Lectura QR o codigo para acceso", start: "2026-05-01", duration: 3, progress: 0.5, owner: "Frontend" },
  { id: 7, code: "RF7", name: "Gestion de visitantes y parqueo temporal", start: "2026-05-03", duration: 2, progress: 0.5, owner: "Frontend" },
  { id: 8, code: "RF8", name: "Tarifas por tiempo (si aplica)", start: "2026-05-04", duration: 2, progress: 1, owner: "Backend" },
  { id: 9, code: "RF9", name: "Multivehiculo por usuario", start: "2026-05-05", duration: 1, progress: 1, owner: "Backend" },
  { id: 10, code: "RF10", name: "Control de cupos disponibles", start: "2026-05-06", duration: 2, progress: 1, owner: "BD" },
  { id: 11, code: "RF11", name: "Alertas de acceso no autorizado", start: "2026-05-07", duration: 2, progress: 1, owner: "Backend" },
  { id: 12, code: "RF12", name: "Historial de movimientos", start: "2026-05-07", duration: 2, progress: 1, owner: "Backend" },
  { id: 13, code: "RF13", name: "Reporte de ocupacion", start: "2026-05-09", duration: 2, progress: 1, owner: "Testing" },
  { id: 14, code: "RF14", name: "Reporte por vehiculo", start: "2026-05-10", duration: 2, progress: 1, owner: "Testing" },
  { id: 15, code: "RF15", name: "Reporte por usuario", start: "2026-05-11", duration: 2, progress: 1, owner: "Testing" },
  { id: 16, code: "RF16", name: "Multinivel (pisos)", start: "2026-05-12", duration: 1, progress: 1, owner: "Backend" },
  { id: 17, code: "RF17", name: "Reservas de parqueo (opcional)", start: "2026-05-12", duration: 2, progress: 0.5, owner: "Frontend" },
  { id: 18, code: "RF18", name: "Pagos por mensualidad", start: "2026-05-13", duration: 2, progress: 0.5, owner: "Backend" },
  { id: 19, code: "RF19", name: "Morosidad", start: "2026-05-14", duration: 2, progress: 0, owner: "Backend" },
  { id: 20, code: "RF20", name: "Notificaciones", start: "2026-05-14", duration: 2, progress: 1, owner: "Frontend" },
  { id: 21, code: "RF21", name: "Panel de seguridad/porteria", start: "2026-05-16", duration: 2, progress: 1, owner: "Frontend" },
  { id: 22, code: "RF22", name: "Control de roles", start: "2026-05-17", duration: 1, progress: 1, owner: "Backend" },
  { id: 23, code: "RF23", name: "Auditoria", start: "2026-05-18", duration: 1, progress: 1, owner: "Backend" },
  { id: 24, code: "RF24", name: "Exportacion", start: "2026-05-19", duration: 1, progress: 0.5, owner: "Documentacion" },
  { id: 25, code: "RF25", name: "Configuracion", start: "2026-05-20", duration: 1, progress: 1, owner: "Frontend" },
];

const ownerColors = {
  Backend: "#0983C8",
  Frontend: "#06D6A0",
  BD: "#FFB800",
  Testing: "#EF476F",
  Documentacion: "#9D4EDD",
};

const percentMap = {
  0: "0%",
  0.25: "25%",
  0.5: "50%",
  0.75: "75%",
  1: "100%",
};

const titleFill = "#05203E";
const titleText = "#FFFFFF";
const lightBlue = "#D8ECFF";
const sheetBg = "#F8FAFC";
const borderColor = "#C8D1DC";
const altRow = "#F3F6FA";
const white = "#FFFFFF";

function excelDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function progressLabel(value) {
  return percentMap[value] ?? `${Math.round(value * 100)}%`;
}

gantt.showGridLines = false;
summary.showGridLines = false;

gantt.getRange("A1:AG1").merge();
gantt.getRange("A2:AG2").merge();
gantt.getRange("A3:AG3").merge();

gantt.getRange("A1").values = [["Cronograma Gantt - SmartPark"]];
gantt.getRange("A2").values = [["Sistema de Gestion de Estacionamientos"]];
gantt.getRange("A3").values = [[`Inicio: 25/04/26  |  Fin: 20/05/26  |  Duracion total: ${totalDays} dias`]];

gantt.getRange("A1:AG3").format = {
  fill: titleFill,
  font: { color: titleText, bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
gantt.getRange("A1").format = { ...gantt.getRange("A1").format, font: { color: titleText, bold: true, size: 18 } };
gantt.getRange("A2").format = { ...gantt.getRange("A2").format, font: { color: titleText, bold: false, size: 12 } };
gantt.getRange("A3").format = { ...gantt.getRange("A3").format, font: { color: "#D9E6F2", bold: false, size: 10 } };
gantt.getRange("A1:AG3").format.rowHeight = 24;
gantt.getRange("A1:AG3").format.wrapText = false;

const headers = [["#", "Requisito", "Inicio", "Duracion (dias)", "Fin", "% Completado", "Responsable"]];
gantt.getRange("A5:G5").values = headers;
gantt.getRange("A5:G5").format = {
  fill: titleFill,
  font: { color: titleText, bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};

const dayHeaders = [];
const dayHeaderDates = [];
for (let i = 0; i < totalDays; i += 1) {
  const current = addDays(projectStart, i);
  dayHeaders.push(current);
  dayHeaderDates.push(current);
}
gantt.getRange("H5:AG5").values = [dayHeaders];
gantt.getRange("H5:AG5").format = {
  fill: titleFill,
  font: { color: titleText, bold: true, size: 9 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  numberFormat: "dd/mm",
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};

const tableRows = requirements.map((item, index) => {
  const start = excelDate(item.start);
  return [item.id, `${item.code}: ${item.name}`, start, item.duration, null, item.progress, item.owner];
});
gantt.getRange(`A6:G${5 + requirements.length}`).values = tableRows;

for (let row = 6; row <= 5 + requirements.length; row += 1) {
  gantt.getRange(`E${row}`).formulas = [[`=C${row}+D${row}-1`]];
}

gantt.getRange(`A6:G${5 + requirements.length}`).format = {
  fill: white,
  font: { color: "#10253F", size: 11 },
  verticalAlignment: "center",
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};

for (let row = 6; row <= 5 + requirements.length; row += 1) {
  const fill = row % 2 === 0 ? white : altRow;
  gantt.getRange(`A${row}:AG${row}`).format = {
    fill,
    borders: {
      top: { color: borderColor, style: "Continuous" },
      bottom: { color: borderColor, style: "Continuous" },
      left: { color: borderColor, style: "Continuous" },
      right: { color: borderColor, style: "Continuous" },
    },
  };
}

gantt.getRange(`A6:A${5 + requirements.length}`).format.horizontalAlignment = "center";
gantt.getRange(`C6:E${5 + requirements.length}`).format = {
  numberFormat: "dd/mm/yy",
  horizontalAlignment: "center",
};
gantt.getRange(`D6:D${5 + requirements.length}`).format = {
  horizontalAlignment: "center",
  numberFormat: "0",
};
gantt.getRange(`F6:F${5 + requirements.length}`).format = {
  numberFormat: "0%",
  horizontalAlignment: "center",
};
gantt.getRange(`G6:G${5 + requirements.length}`).format.horizontalAlignment = "center";

gantt.getRange(`F6:F${5 + requirements.length}`).dataValidation = {
  rule: { type: "list", values: [0, 0.25, 0.5, 0.75, 1] },
};

for (let i = 0; i < requirements.length; i += 1) {
  const row = 6 + i;
  const item = requirements[i];
  const taskStart = excelDate(item.start);
  const taskEnd = addDays(taskStart, item.duration - 1);
  for (let j = 0; j < dayHeaderDates.length; j += 1) {
    const day = dayHeaderDates[j];
    const colIndex = 8 + j; // H = 8
    const cell = gantt.getCell(row - 1, colIndex - 1);
    const cellLabel = `${String.fromCharCode(64 + Math.min(colIndex, 26))}${row}`;
    const baseFill = row % 2 === 0 ? white : altRow;
    let fill = baseFill;
    let value = "";
    if (day >= taskStart && day <= taskEnd) {
      fill = ownerColors[item.owner] ?? lightBlue;
      value = "";
    }
    cell.values = [[value]];
    cell.format = {
      fill,
      borders: {
        top: { color: borderColor, style: "Continuous" },
        bottom: { color: borderColor, style: "Continuous" },
        left: { color: borderColor, style: "Continuous" },
        right: { color: borderColor, style: "Continuous" },
      },
    };
  }
}

gantt.getRange("H6:AG30").format.horizontalAlignment = "center";
gantt.getRange("H6:AG30").format.verticalAlignment = "center";

gantt.freezePanes.freezeRows(5);
gantt.freezePanes.freezeColumns(7);

gantt.getRange("A:A").format.columnWidthPx = 42;
gantt.getRange("B:B").format.columnWidthPx = 360;
gantt.getRange("C:C").format.columnWidthPx = 88;
gantt.getRange("D:D").format.columnWidthPx = 92;
gantt.getRange("E:E").format.columnWidthPx = 88;
gantt.getRange("F:F").format.columnWidthPx = 92;
gantt.getRange("G:G").format.columnWidthPx = 110;
gantt.getRange("H:AG").format.columnWidthPx = 30;
gantt.getRange("A5:AG30").format.rowHeightPx = 24;

const completeCount = requirements.filter((r) => r.progress === 1).length;
const progressCount = requirements.filter((r) => r.progress > 0 && r.progress < 1).length;
const pendingCount = requirements.filter((r) => r.progress === 0).length;
const overallProgress = requirements.reduce((acc, item) => acc + item.progress, 0) / requirements.length;

summary.getRange("A1:H1").merge();
summary.getRange("A2:H2").merge();
summary.getRange("A1").values = [["Resumen Ejecutivo - SmartPark"]];
summary.getRange("A2").values = [["Cronograma general de requisitos funcionales"]];
summary.getRange("A1:H2").format = {
  fill: titleFill,
  font: { color: titleText, bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
summary.getRange("A1").format = { ...summary.getRange("A1").format, font: { color: titleText, bold: true, size: 18 } };
summary.getRange("A2").format = { ...summary.getRange("A2").format, font: { color: "#D9E6F2", bold: false, size: 11 } };

summary.getRange("A4:B8").values = [
  ["Indicador", "Valor"],
  ["Total requisitos", requirements.length],
  ["Completados", completeCount],
  ["En progreso", progressCount],
  ["Pendientes", pendingCount],
];
summary.getRange("D4:E8").values = [
  ["Indicador", "Valor"],
  ["Avance general", overallProgress],
  ["Fecha inicio", projectStart],
  ["Fecha fin", projectEnd],
  ["Duracion total", totalDays],
];

summary.getRange("A4:B8").format = {
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};
summary.getRange("D4:E8").format = {
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};
summary.getRange("A4:B4").format = { fill: titleFill, font: { color: titleText, bold: true } };
summary.getRange("D4:E4").format = { fill: titleFill, font: { color: titleText, bold: true } };
summary.getRange("A5:B8").format = { fill: sheetBg, font: { color: "#10253F", size: 11 } };
summary.getRange("D5:E8").format = { fill: sheetBg, font: { color: "#10253F", size: 11 } };
summary.getRange("E5").format = { numberFormat: "0%" };
summary.getRange("E6:E7").format = { numberFormat: "dd/mm/yy" };

summary.getRange("A10:B13").values = [
  ["Estado", "Cantidad"],
  ["Completado", completeCount],
  ["En progreso", progressCount],
  ["Pendiente", pendingCount],
];
summary.getRange("A10:B13").format = {
  borders: {
    top: { color: borderColor, style: "Continuous" },
    bottom: { color: borderColor, style: "Continuous" },
    left: { color: borderColor, style: "Continuous" },
    right: { color: borderColor, style: "Continuous" },
  },
};
summary.getRange("A10:B10").format = { fill: titleFill, font: { color: titleText, bold: true } };
summary.getRange("A11:B13").format = { fill: white, font: { color: "#10253F", size: 11 } };

const statusChart = summary.charts.add("bar", summary.getRange("A10:B13"));
statusChart.title = "Estado actual del proyecto";
statusChart.hasLegend = false;
statusChart.xAxis = { axisType: "textAxis" };
statusChart.yAxis = { numberFormatCode: "0" };
statusChart.setPosition("D10", "H24");

summary.getRange("A:A").format.columnWidthPx = 160;
summary.getRange("B:B").format.columnWidthPx = 90;
summary.getRange("D:D").format.columnWidthPx = 150;
summary.getRange("E:E").format.columnWidthPx = 110;
summary.freezePanes.freezeRows(2);

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(__dirname, "Cronograma_SmartPark_Gantt.xlsx");
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, completeCount, progressCount, pendingCount, overallProgress }, null, 2));
