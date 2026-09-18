import { jsPDF } from 'jspdf';

type Dimension = [string, number];

export type ZandofyReportInput = {
  storeName: string;
  storeSlug: string;
  currency: string;
  periodLabel: string;
  generatedAt: Date;
  summary: {
    netRevenue: number;
    periodRevenue: number;
    periodSales: number;
    paidOrders: number;
    inProgress: number;
    clients: number;
    uniqueVisitors: number;
    conversionRate: number;
    averageOrder: number;
    recurrentClients: number;
    repeatRate: number;
    fppTotal: number;
    lowStock: number;
    rating: number;
    reviewCount: number;
  };
  dailySeries: Array<{ label: string; sales: number; revenue: number; views: number }>;
  topProducts: Array<{ title: string; orders: number; revenue: number; currency: string }>;
  dimensions: {
    devices: Dimension[];
    countries: Dimension[];
    cities: Dimension[];
    sources: Dimension[];
  };
};

const green: [number, number, number] = [21, 234, 62];
const ink: [number, number, number] = [8, 17, 11];
const muted: [number, number, number] = [92, 107, 98];
const pale: [number, number, number] = [241, 247, 243];

const count = (value: number) => Number(value || 0).toLocaleString('fr-FR').replace(/\s/g, ' ');
const money = (value: number, currency: string) => `${count(Math.round(Number(value || 0)))} ${currency}`;

export async function downloadZandofyReport(input: ZandofyReportInput) {
  const document = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 16;
  let page = 1;

  const footer = () => {
    document.setDrawColor(222, 231, 225);
    document.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    document.setTextColor(...muted);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.text('WeZandofy - un service AfriZia | Marque déposée AfriZia', margin, pageHeight - 8);
    document.text(`Rapport confidentiel - ${page}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  const newPage = () => {
    footer();
    document.addPage();
    page += 1;
  };

  const title = (eyebrow: string, heading: string, description?: string) => {
    document.setTextColor(...green);
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.text(eyebrow.toUpperCase(), margin, 20);
    document.setTextColor(...ink);
    document.setFontSize(22);
    document.text(heading, margin, 30);
    if (description) {
      document.setTextColor(...muted);
      document.setFont('helvetica', 'normal');
      document.setFontSize(9.5);
      document.text(document.splitTextToSize(description, pageWidth - margin * 2), margin, 37);
    }
  };

  const metricCard = (x: number, y: number, width: number, label: string, value: string, accent = false) => {
    document.setFillColor(...(accent ? green : pale));
    document.roundedRect(x, y, width, 25, 3, 3, 'F');
    document.setTextColor(...(accent ? ink : muted));
    document.setFont('helvetica', 'bold');
    document.setFontSize(7.5);
    document.text(label.toUpperCase(), x + 4, y + 7);
    document.setTextColor(...ink);
    document.setFontSize(12.5);
    document.text(value, x + 4, y + 17);
  };

  const barChart = (x: number, y: number, width: number, height: number) => {
    const series = input.dailySeries.slice(-12);
    document.setFillColor(250, 252, 250);
    document.roundedRect(x, y, width, height, 3, 3, 'F');
    document.setTextColor(...ink);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.text('Tendance des ventes et visites', x + 5, y + 8);
    if (!series.length) {
      document.setTextColor(...muted);
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.text('Les données apparaîtront après les premières visites et commandes.', x + 5, y + height / 2);
      return;
    }
    const maxValue = Math.max(1, ...series.map((item) => Math.max(item.sales, item.views)));
    const chartY = y + 16;
    const chartHeight = height - 27;
    const gap = 3;
    const columnWidth = Math.max(5, (width - 14 - gap * (series.length - 1)) / series.length);
    document.setDrawColor(220, 231, 224);
    for (let line = 0; line < 3; line += 1) {
      const lineY = chartY + (chartHeight / 2) * line;
      document.line(x + 6, lineY, x + width - 6, lineY);
    }
    series.forEach((item, index) => {
      const columnX = x + 7 + index * (columnWidth + gap);
      const salesHeight = Math.max(item.sales ? 2 : 0, (item.sales / maxValue) * chartHeight);
      const viewHeight = Math.max(item.views ? 2 : 0, (item.views / maxValue) * chartHeight);
      document.setFillColor(...green);
      document.roundedRect(columnX, chartY + chartHeight - salesHeight, columnWidth / 2 - 0.5, salesHeight, 0.7, 0.7, 'F');
      document.setFillColor(20, 69, 42);
      document.roundedRect(columnX + columnWidth / 2 + 0.5, chartY + chartHeight - viewHeight, columnWidth / 2 - 0.5, viewHeight, 0.7, 0.7, 'F');
      if (index === 0 || index === series.length - 1 || index % 3 === 0) {
        document.setTextColor(...muted);
        document.setFont('helvetica', 'normal');
        document.setFontSize(6);
        document.text(item.label.slice(5), columnX + columnWidth / 2, y + height - 5, { align: 'center' });
      }
    });
    document.setFillColor(...green);
    document.rect(x + 6, y + height - 10, 3, 3, 'F');
    document.setFillColor(20, 69, 42);
    document.rect(x + 31, y + height - 10, 3, 3, 'F');
    document.setTextColor(...muted);
    document.setFontSize(6.5);
    document.text('Ventes', x + 11, y + height - 7.5);
    document.text('Visites', x + 36, y + height - 7.5);
  };

  const dimensionTable = (x: number, y: number, width: number, heading: string, values: Dimension[]) => {
    document.setFillColor(...pale);
    document.roundedRect(x, y, width, 48, 3, 3, 'F');
    document.setTextColor(...ink);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.text(heading, x + 4, y + 8);
    const rows = values.slice(0, 4);
    if (!rows.length) {
      document.setTextColor(...muted);
      document.setFont('helvetica', 'normal');
      document.setFontSize(7.5);
      document.text('Aucune donnée disponible', x + 4, y + 20);
      return;
    }
    const max = Math.max(1, ...rows.map(([, value]) => value));
    rows.forEach(([label, value], index) => {
      const rowY = y + 15 + index * 7.5;
      document.setTextColor(...muted);
      document.setFont('helvetica', 'normal');
      document.setFontSize(7.3);
      document.text(label.slice(0, 18), x + 4, rowY);
      document.setFillColor(211, 224, 214);
      document.roundedRect(x + width * 0.5, rowY - 3, width * 0.32, 2.5, 1, 1, 'F');
      document.setFillColor(...green);
      document.roundedRect(x + width * 0.5, rowY - 3, Math.max(2, (value / max) * width * 0.32), 2.5, 1, 1, 'F');
      document.setTextColor(...ink);
      document.setFont('helvetica', 'bold');
      document.text(count(value), x + width - 4, rowY, { align: 'right' });
    });
  };

  document.setFillColor(...ink);
  document.rect(0, 0, pageWidth, 62, 'F');
  document.setFillColor(...green);
  document.circle(margin + 8, 21, 8, 'F');
  document.setTextColor(...ink);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('WZ', margin + 8, 25, { align: 'center' });
  document.setTextColor(255, 255, 255);
  document.setFontSize(11);
  document.text('WeZandofy', margin + 22, 18);
  document.setFont('helvetica', 'normal');
  document.setFontSize(7.5);
  document.text('Commerce connecté par AfriZia', margin + 22, 23);
  document.setFont('helvetica', 'bold');
  document.setFontSize(24);
  document.text('Rapport de performance', margin, 42);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Boutique: ${input.storeName}`, margin, 51);
  document.text(`Période: ${input.periodLabel}  |  Généré le ${input.generatedAt.toLocaleDateString('fr-FR')}`, margin, 56);

  document.setTextColor(...green);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.text('SYNTHÈSE EXÉCUTIVE', margin, 72);
  document.setTextColor(...ink);
  document.setFontSize(18);
  document.text('Une lecture claire de votre activité', margin, 81);
  document.setTextColor(...muted);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  document.text(document.splitTextToSize(`Ce rapport rassemble les indicateurs commerciaux de ${input.storeName}, de la découverte de la boutique jusqu’aux ventes confirmées.`, pageWidth - margin * 2), margin, 88);
  const cardWidth = (pageWidth - margin * 2 - 6) / 3;
  metricCard(margin, 101, cardWidth, 'Revenu net', money(input.summary.periodRevenue, input.currency), true);
  metricCard(margin + cardWidth + 3, 101, cardWidth, 'Commandes', count(input.summary.periodSales));
  metricCard(margin + (cardWidth + 3) * 2, 101, cardWidth, 'Conversion', `${input.summary.conversionRate.toFixed(1)}%`);
  metricCard(margin, 129, cardWidth, 'Visiteurs', count(input.summary.uniqueVisitors));
  metricCard(margin + cardWidth + 3, 129, cardWidth, 'Panier moyen', money(input.summary.averageOrder, input.currency));
  metricCard(margin + (cardWidth + 3) * 2, 129, cardWidth, 'Clients récurrents', count(input.summary.recurrentClients));
  barChart(margin, 161, pageWidth - margin * 2, 58);
  document.setFillColor(255, 249, 224);
  document.roundedRect(margin, 227, pageWidth - margin * 2, 24, 3, 3, 'F');
  document.setTextColor(96, 76, 19);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.text('À suivre', margin + 5, 235);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text(`Commandes en cours: ${count(input.summary.inProgress)}  |  Produits à faible stock: ${count(input.summary.lowStock)}  |  Contribution FPP: ${money(input.summary.fppTotal, input.currency)}`, margin + 5, 244);

  newPage();
  title('Catalogue et ventes', 'Produits qui portent la croissance', 'Les produits sont classés selon les commandes et le revenu vendeur sur la période sélectionnée.');
  const tableY = 51;
  document.setFillColor(...ink);
  document.roundedRect(margin, tableY, pageWidth - margin * 2, 9, 2, 2, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(7.5);
  document.text('PRODUIT', margin + 4, tableY + 5.7);
  document.text('COMMANDES', margin + 110, tableY + 5.7, { align: 'right' });
  document.text('REVENU NET', pageWidth - margin - 4, tableY + 5.7, { align: 'right' });
  const products = input.topProducts.length ? input.topProducts : [{ title: 'Aucune vente enregistrée', orders: 0, revenue: 0, currency: input.currency }];
  products.slice(0, 8).forEach((product, index) => {
    const rowY = tableY + 9 + index * 13;
    document.setFillColor(index % 2 ? 250 : 241, index % 2 ? 252 : 247, index % 2 ? 250 : 243);
    document.rect(margin, rowY, pageWidth - margin * 2, 13, 'F');
    document.setTextColor(...ink);
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.text(product.title.slice(0, 48), margin + 4, rowY + 5.5);
    document.setTextColor(...muted);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.text(`Rang ${index + 1}`, margin + 4, rowY + 9.5);
    document.setTextColor(...ink);
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.text(count(product.orders), margin + 110, rowY + 7, { align: 'right' });
    document.text(money(product.revenue, product.currency), pageWidth - margin - 4, rowY + 7, { align: 'right' });
  });
  metricCard(margin, 176, (pageWidth - margin * 2 - 4) / 2, 'Commandes payées', count(input.summary.paidOrders), true);
  metricCard(margin + (pageWidth - margin * 2 + 4) / 2, 176, (pageWidth - margin * 2 - 4) / 2, 'Réputation', `${input.summary.rating.toFixed(1)} / 5 (${count(input.summary.reviewCount)} avis)`);
  document.setFillColor(234, 248, 237);
  document.roundedRect(margin, 211, pageWidth - margin * 2, 31, 3, 3, 'F');
  document.setTextColor(...ink);
  document.setFont('helvetica', 'bold');
  document.setFontSize(9);
  document.text('Lecture commerciale', margin + 5, 220);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  const commercialInsight = input.summary.repeatRate > 15
    ? `La récurrence atteint ${input.summary.repeatRate.toFixed(1)}%. Consolidez cette dynamique avec des offres réservées aux clients existants.`
    : `La récurrence atteint ${input.summary.repeatRate.toFixed(1)}%. Les liens d’affiliation et les promotions peuvent aider à augmenter le retour des clients.`;
  document.text(document.splitTextToSize(commercialInsight, pageWidth - margin * 2 - 10), margin + 5, 228);

  newPage();
  title('Audience et acquisition', 'D’où viennent vos clients', 'Les visites sont regroupées par appareil, localisation et source de découverte de la boutique.');
  const dimensionWidth = (pageWidth - margin * 2 - 5) / 2;
  dimensionTable(margin, 52, dimensionWidth, 'Appareils', input.dimensions.devices);
  dimensionTable(margin + dimensionWidth + 5, 52, dimensionWidth, 'Pays', input.dimensions.countries);
  dimensionTable(margin, 106, dimensionWidth, 'Villes', input.dimensions.cities);
  dimensionTable(margin + dimensionWidth + 5, 106, dimensionWidth, 'Sources', input.dimensions.sources);
  document.setFillColor(...ink);
  document.roundedRect(margin, 166, pageWidth - margin * 2, 46, 3, 3, 'F');
  document.setTextColor(...green);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.text('INDICATEURS DE CONFIANCE', margin + 6, 176);
  document.setTextColor(255, 255, 255);
  document.setFontSize(12);
  document.text(`${count(input.summary.clients)} clients  |  ${count(input.summary.uniqueVisitors)} visiteurs  |  ${input.summary.conversionRate.toFixed(1)}% de conversion`, margin + 6, 187);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text('Les données de ce rapport sont calculées à partir de l’activité enregistrée dans votre boutique WeZandofy.', margin + 6, 200);
  footer();

  const fileSlug = input.storeSlug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'boutique';
  document.save(`rapport-wezandofy-${fileSlug}-${input.generatedAt.toISOString().slice(0, 10)}.pdf`);
}
