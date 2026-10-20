import { formatAmount, formatDate, toTitleCase } from '../format';
import type { AgentOverview, RegistrationExportRow, RegistrationStatus } from '../../types/database';
import { APP_NAME } from '../brand';
import { computeGains, formatGain, formatGainDay, type GainsDailyRow, type GainsSummaryRow } from '../gains';
import { getAbidjanToday } from '../registration-days';

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  en_attente: 'En attente',
  paye: 'Payé',
  refuse: 'Refusé',
  probleme: 'Problème',
  gagne: 'Gagné',
  echec: 'Échec',
  renonce: 'Renoncé',
};

const STATUS_COLORS: Record<RegistrationStatus, [number, number, number]> = {
  en_attente: [14, 165, 233],
  paye: [16, 185, 129],
  refuse: [244, 63, 94],
  probleme: [139, 92, 246],
  gagne: [21, 128, 61],
  echec: [244, 63, 94],
  renonce: [87, 83, 78],
};

export function sanitizePdfText(value: string): string {
  return value
    .replace(/[\u202F\u00A0]/g, ' ')
    .replace(/[→➜➝]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\u0000-\u00FF]/g, '?');
}

function amountForPdf(amount: number | null): string {
  return amount === null
    ? '—'
    : formatAmount(amount).replace(/[\u00A0\u202F]/g, ' ');
}

function generatedAt(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
}

function fileDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'utilisateur';
}

function statusLabel(status: RegistrationStatus): string {
  return STATUS_LABELS[status];
}

function getTotals(rows: RegistrationExportRow[]) {
  return {
    total: rows.length,
    paye: rows.filter((row) => row.status === 'paye').length,
    en_attente: rows.filter((row) => row.status === 'en_attente').length,
    refuse: rows.filter((row) => row.status === 'refuse').length,
    probleme: rows.filter((row) => row.status === 'probleme').length,
    montant: rows.reduce((sum, row) => sum + (row.status === 'paye' ? row.amount ?? 0 : 0), 0),
  };
}

async function loadLogoDataUrl(): Promise<string> {
  const response = await fetch('/logo.png');
  if (!response.ok) throw new Error(`Chargement du logo impossible : ${response.status}`);
  const logo = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Conversion du logo en image impossible.'));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du logo impossible.'));
    reader.readAsDataURL(logo);
  });
}

function drawHeader(doc: import('jspdf').jsPDF, title: string, subtitle: string, logoDataUrl: string | null, filtersLabel?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  if (logoDataUrl) {
    const { width, height } = doc.getImageProperties(logoDataUrl);
    const logoHeight = 14;
    doc.addImage(logoDataUrl, 'PNG', 14, 12, logoHeight * width / height, logoHeight);
  } else {
    doc.setTextColor(28, 25, 23);
    doc.setFontSize(12);
    doc.text(APP_NAME, 14, 21.5);
  }
  doc.setTextColor(28, 25, 23);
  doc.setFontSize(18);
  doc.text(sanitizePdfText(title), 35, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(subtitle), 35, 24);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(sanitizePdfText(`Généré le ${generatedAt()}`), 14, 34);
  if (filtersLabel) doc.text(sanitizePdfText(`Filtres : ${filtersLabel}`), 14, 39, { maxWidth: pageWidth - 28 });
  doc.setTextColor(28, 25, 23);
}

function drawStats(doc: import('jspdf').jsPDF, rows: RegistrationExportRow[], y: number): number {
  const totals = getTotals(rows);
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 3;
  const width = (pageWidth - 28 - gap * 5) / 6;
  const stats = [
    ['Total', String(totals.total)],
    ['Payés', String(totals.paye)],
    ['En attente', String(totals.en_attente)],
    ['Refusés', String(totals.refuse)],
    ['Problèmes', String(totals.probleme)],
    ['Montant payé', amountForPdf(totals.montant)],
  ];

  stats.forEach(([label, value], index) => {
    const x = 14 + index * (width + gap);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(255, 229, 138);
    doc.roundedRect(x, y, width, 16, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(sanitizePdfText(label), x + 2, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(28, 25, 23);
    doc.text(sanitizePdfText(value), x + 2, y + 11, { maxWidth: width - 4 });
  });
  return y + 21;
}

function addFooter(doc: import('jspdf').jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(255, 229, 138);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${APP_NAME} · Données de simulation`, 14, pageHeight - 8);
    doc.text(`Page ${page} / ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

export type GenerateRegistrationsPdfOptions = {
  rows: RegistrationExportRow[];
  title: string;
  subtitle: string;
  filtersLabel: string;
  includePasswords: boolean;
  includeStats: boolean;
  filename?: string;
};

export async function generateRegistrationsPdf(options: GenerateRegistrationsPdfOptions): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: options.includePasswords ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadLogoDataUrl();
  } catch (error) {
    console.warn('Le logo ne peut pas être ajouté au PDF ; le nom de marque sera affiché à la place.', error);
  }
  let startY = options.filtersLabel.length > 0 ? 44 : 39;
  if (options.includeStats) startY = drawStats(doc, options.rows, startY);

  const columns = [
    'Agent',
    'N°',
    'Identifiant',
    'Statut',
    'Montant',
    'Date',
    ...(options.includePasswords ? ['Mot de passe'] : []),
    'Numéro',
  ];
  const body = options.rows.map((row) => [
    sanitizePdfText(toTitleCase(row.profiles?.full_name ?? '—')),
    String(row.seq),
    sanitizePdfText(row.email),
    statusLabel(row.status),
    amountForPdf(row.status === 'paye' || row.status === 'gagne' ? row.amount : null),
    sanitizePdfText(formatDate(row.created_at)),
    ...(options.includePasswords ? [sanitizePdfText(row.mdp)] : []),
    row.numero ?? '',
  ]);

  autoTableModule.default(doc, {
    startY,
    head: [columns],
    body,
    margin: { top: 44, right: 14, bottom: 19, left: 14 },
    willDrawPage: () => drawHeader(doc, options.title, options.subtitle, logoDataUrl, options.filtersLabel),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, overflow: 'linebreak', textColor: [28, 25, 23] },
    headStyles: { fillColor: [255, 201, 60], textColor: [31, 23, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: { 1: { halign: 'center' }, 4: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const row = options.rows[data.row.index];
        data.cell.styles.textColor = STATUS_COLORS[row.status];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  addFooter(doc);
  doc.save(options.filename ?? `${APP_NAME}_enregistres_${fileDate()}.pdf`);
}

export async function generateAgentsSummaryPdf({ rows }: { rows: AgentOverview[] }): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadLogoDataUrl();
  } catch (error) {
    console.warn('Le logo ne peut pas être ajouté au PDF ; le nom de marque sera affiché à la place.', error);
  }
  const body = rows.map((row) => [
    sanitizePdfText(toTitleCase(row.full_name)),
    sanitizePdfText(row.whatsapp),
    row.is_suspended ? 'Suspendu' : 'Actif',
    String(row.total),
    String(row.payes),
    String(row.en_attente),
    amountForPdf(row.montant_total),
    sanitizePdfText(row.last_activity ? formatDate(row.last_activity) : '—'),
  ]);
  autoTableModule.default(doc, {
    startY: 42,
    head: [['Utilisateur', 'WhatsApp', 'Compte', 'Enregistrés', 'Payés', 'En attente', 'Montant payé', 'Dernière activité']],
    body,
    margin: { top: 42, right: 14, bottom: 19, left: 14 },
    willDrawPage: () => drawHeader(doc, 'Récapitulatif des utilisateurs', 'Synthèse des comptes et des enregistrements fictifs.', logoDataUrl),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [255, 201, 60], textColor: [31, 23, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: { 6: { halign: 'right' } },
  });
  addFooter(doc);
  doc.save(`${APP_NAME}_utilisateurs_${fileDate()}.pdf`);
}

export type GenerateGainsPdfOptions = {
  rows: GainsSummaryRow[];
  daily: GainsDailyRow[];
  periodLabel: string;
  totals: { net: number; count: number };
  includeDaily: boolean;
};

export async function generateGainsPdf(options: GenerateGainsPdfOptions): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadLogoDataUrl();
  } catch (error) {
    console.warn('Le logo ne peut pas être ajouté au PDF ; le nom de marque sera affiché à la place.', error);
  }

  const totalAmounts = computeGains(options.totals.net);
  const stats = [
    ['Montant net', formatGain(totalAmounts.net)],
    ['Montant Vp', formatGain(totalAmounts.vp)],
    ['Montant reçu', formatGain(totalAmounts.recu)],
  ];
  const boxWidth = (210 - 28 - 6) / 3;
  stats.forEach(([label, value], index) => {
    const x = 14 + index * (boxWidth + 3);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(255, 229, 138);
    doc.roundedRect(x, 44, boxWidth, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(sanitizePdfText(label), x + 2, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(28, 25, 23);
    doc.text(sanitizePdfText(value), x + 2, 57);
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(sanitizePdfText(`${options.totals.count} enregistrés ayant reçu`), 14, 67);

  autoTableModule.default(doc, {
    startY: 72,
    head: [['Utilisateur', 'Enregistrés', 'Net', 'Vp', 'Reçu']],
    body: options.rows.map((row) => {
      const values = computeGains(row.montant_net);
      return [
        sanitizePdfText(toTitleCase(row.full_name)),
        String(row.nb_recus),
        sanitizePdfText(formatGain(values.net).replace(/[\u00A0\u202F]/g, ' ')),
        sanitizePdfText(formatGain(values.vp).replace(/[\u00A0\u202F]/g, ' ')),
        sanitizePdfText(formatGain(values.recu).replace(/[\u00A0\u202F]/g, ' ')),
      ];
    }),
    margin: { top: 44, right: 14, bottom: 19, left: 14 },
    willDrawPage: () => drawHeader(doc, 'Gains', options.periodLabel, logoDataUrl),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', textColor: [28, 25, 23] },
    headStyles: { fillColor: [255, 201, 60], textColor: [31, 23, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  if (options.includeDaily && options.daily.length > 0) {
    const lastTable = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable;
    const nextY = (lastTable?.finalY ?? 72) + 12;
    if (nextY > doc.internal.pageSize.getHeight() - 32) doc.addPage();
    const startY = nextY > doc.internal.pageSize.getHeight() - 32 ? 44 : nextY;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 25, 23);
    doc.text('Détail par jour', 14, startY - 4);
    autoTableModule.default(doc, {
      startY,
      head: [['Jour', 'Enregistrés ayant reçu', 'Net', 'Vp', 'Reçu']],
      body: options.daily.map((row) => {
        const values = computeGains(row.montant_net);
        return [
          sanitizePdfText(formatGainDay(row.jour)),
          String(row.nb_recus),
          sanitizePdfText(formatGain(values.net).replace(/[\u00A0\u202F]/g, ' ')),
          sanitizePdfText(formatGain(values.vp).replace(/[\u00A0\u202F]/g, ' ')),
          sanitizePdfText(formatGain(values.recu).replace(/[\u00A0\u202F]/g, ' ')),
        ];
      }),
      margin: { top: 44, right: 14, bottom: 19, left: 14 },
      willDrawPage: () => drawHeader(doc, 'Gains', options.periodLabel, logoDataUrl),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', textColor: [28, 25, 23] },
      headStyles: { fillColor: [255, 201, 60], textColor: [31, 23, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
  }
  addFooter(doc);
  doc.save(`${APP_NAME}_gains_${getAbidjanToday()}.pdf`);
}

export function registrationStatusPdfLabel(status: RegistrationStatus): string {
  return statusLabel(status);
}

export function agentPdfFilename(agentName: string): string {
  return `${APP_NAME}_${slug(agentName)}_${fileDate()}.pdf`;
}
