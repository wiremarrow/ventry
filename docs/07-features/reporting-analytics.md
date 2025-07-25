# Reporting & Analytics

Comprehensive guide to Ventry's reporting, analytics, and business intelligence features.

## Overview

Ventry provides powerful reporting and analytics capabilities to help organizations make data-driven decisions about their inventory, operations, and business performance.

### Key Features

- **Real-time Dashboards**: Live metrics and KPIs
- **Standard Reports**: Pre-built reports for common needs
- **Custom Reports**: Build your own reports
- **Data Visualization**: Charts, graphs, and heatmaps
- **Export Capabilities**: PDF, Excel, CSV formats
- **Scheduled Reports**: Automated report delivery
- **AI Insights**: Machine learning-powered recommendations

## Dashboard System

### 1. Executive Dashboard

```typescript
// Get executive dashboard data
const getExecutiveDashboard = async (period: DateRange) => {
  const metrics = await trpc.analytics.executiveDashboard.query({
    startDate: period.start,
    endDate: period.end,
    compareWith: 'PREVIOUS_PERIOD',
  });

  return {
    // Revenue metrics
    revenue: {
      total: metrics.revenue.total,
      growth: metrics.revenue.growthPercent,
      byChannel: metrics.revenue.channels,
      forecast: metrics.revenue.forecast,
    },

    // Order metrics
    orders: {
      count: metrics.orders.count,
      averageValue: metrics.orders.avgValue,
      fulfillmentRate: metrics.orders.fulfillmentRate,
      trend: metrics.orders.trend,
    },

    // Inventory metrics
    inventory: {
      totalValue: metrics.inventory.value,
      turnoverRate: metrics.inventory.turnover,
      stockouts: metrics.inventory.stockouts,
      excess: metrics.inventory.excess,
    },

    // Operational metrics
    operations: {
      warehouseUtilization: metrics.operations.utilization,
      pickAccuracy: metrics.operations.accuracy,
      shippingOnTime: metrics.operations.onTime,
      laborEfficiency: metrics.operations.efficiency,
    },
  };
};

// Real-time updates
const subscribeToMetrics = () => {
  const ws = new WebSocket('wss://api.ventry.app/metrics');

  ws.on('message', (data) => {
    const update = JSON.parse(data);

    switch (update.type) {
      case 'ORDER_CREATED':
        updateOrderMetrics(update.data);
        break;
      case 'INVENTORY_MOVEMENT':
        updateInventoryMetrics(update.data);
        break;
      case 'SHIPMENT_COMPLETED':
        updateFulfillmentMetrics(update.data);
        break;
    }
  });
};
```

### 2. Operational Dashboard

```typescript
interface OperationalDashboard {
  warehouse: {
    receiving: {
      todayExpected: number;
      received: number;
      pending: number;
      averageProcessTime: number;
    };
    picking: {
      ordersInQueue: number;
      itemsPicked: number;
      pickRate: number;
      accuracy: number;
    };
    shipping: {
      packagesReady: number;
      shipped: number;
      averageShipTime: number;
      carriers: CarrierMetric[];
    };
  };

  alerts: {
    lowStock: Alert[];
    expiring: Alert[];
    delayed: Alert[];
    errors: Alert[];
  };

  performance: {
    throughput: TimeSeriesData;
    efficiency: GaugeData;
    utilization: HeatmapData;
  };
}

// Get operational metrics
const getOperationalDashboard = async () => {
  const [warehouse, alerts, performance] = await Promise.all([
    getWarehouseMetrics(),
    getActiveAlerts(),
    getPerformanceMetrics(),
  ]);

  return {
    warehouse,
    alerts,
    performance,
    lastUpdated: new Date(),
  };
};
```

## Standard Reports

### 1. Inventory Reports

```typescript
// Inventory valuation report
const generateInventoryValuation = async (options: ValuationOptions) => {
  const report = await trpc.reports.inventoryValuation.generate({
    asOfDate: options.date,
    method: options.costingMethod || 'AVERAGE',
    groupBy: options.groupBy || ['category', 'location'],
    includeDetails: options.detailed,
    format: options.format || 'PDF',
  });

  return {
    summary: {
      totalValue: report.totalValue,
      itemCount: report.itemCount,
      categories: report.categoryBreakdown,
      locations: report.locationBreakdown,
    },
    details: report.details,
    url: report.downloadUrl,
  };
};

// Stock aging report
const generateAgingReport = async () => {
  const aging = await trpc.reports.inventoryAging.generate({
    buckets: [30, 60, 90, 180, 365],
    includeValue: true,
    highlightSlow: true,
  });

  return {
    summary: aging.summary,
    items: aging.items.map((item) => ({
      ...item,
      risk: calculateObsolescenceRisk(item),
      recommendation: getAgingRecommendation(item),
    })),
  };
};

// ABC analysis report
const generateABCAnalysis = async () => {
  const analysis = await trpc.reports.abcAnalysis.generate({
    criteria: 'REVENUE', // or 'QUANTITY', 'PROFIT'
    period: 'LAST_12_MONTHS',
    includeRecommendations: true,
  });

  return {
    classification: {
      A: { items: analysis.A, value: analysis.AValue },
      B: { items: analysis.B, value: analysis.BValue },
      C: { items: analysis.C, value: analysis.CValue },
    },
    recommendations: analysis.recommendations,
    visualization: generateParetoDiagram(analysis),
  };
};
```

### 2. Sales Reports

```typescript
// Sales performance report
const generateSalesReport = async (period: DateRange) => {
  const report = await trpc.reports.salesPerformance.generate({
    startDate: period.start,
    endDate: period.end,
    groupBy: ['date', 'channel', 'category'],
    metrics: ['revenue', 'units', 'orders', 'average_order_value', 'conversion_rate'],
    compareWith: 'PREVIOUS_YEAR',
  });

  return {
    summary: report.summary,
    trends: report.trends,
    topProducts: report.topProducts,
    topCustomers: report.topCustomers,
    channelPerformance: report.channels,
    recommendations: generateSalesInsights(report),
  };
};

// Customer analysis
const generateCustomerAnalysis = async () => {
  const analysis = await trpc.reports.customerAnalysis.generate({
    segments: ['NEW', 'RETURNING', 'VIP'],
    metrics: ['lifetime_value', 'order_frequency', 'average_basket'],
    includeChurn: true,
  });

  return {
    segments: analysis.segments,
    retention: analysis.retentionCurve,
    churn: analysis.churnAnalysis,
    recommendations: analysis.recommendations,
  };
};
```

### 3. Operational Reports

```typescript
// Warehouse efficiency report
const generateEfficiencyReport = async (warehouseId: string) => {
  const report = await trpc.reports.warehouseEfficiency.generate({
    warehouseId,
    period: 'LAST_30_DAYS',
    metrics: [
      'space_utilization',
      'pick_rate',
      'put_away_rate',
      'order_cycle_time',
      'labor_productivity',
    ],
    includeBenchmarks: true,
  });

  return {
    overall: report.overallScore,
    metrics: report.detailedMetrics,
    benchmarks: report.industryBenchmarks,
    improvements: report.improvementOpportunities,
    trends: report.historicalTrends,
  };
};

// Supplier performance
const generateSupplierReport = async () => {
  const report = await trpc.reports.supplierPerformance.generate({
    period: 'LAST_QUARTER',
    metrics: ['on_time_delivery', 'quality_score', 'price_competitiveness', 'responsiveness'],
    includeScorecard: true,
  });

  return {
    rankings: report.supplierRankings,
    scorecards: report.individualScorecards,
    issues: report.performanceIssues,
    recommendations: report.recommendations,
  };
};
```

## Custom Reports

### 1. Report Builder

```typescript
// Custom report configuration
interface CustomReport {
  id: string;
  name: string;
  description: string;

  // Data source
  dataSources: DataSource[];

  // Filters
  filters: ReportFilter[];

  // Columns/Metrics
  columns: ReportColumn[];
  metrics: ReportMetric[];

  // Grouping and sorting
  groupBy?: string[];
  orderBy?: OrderByClause[];

  // Visualization
  charts?: ChartConfig[];

  // Output
  format: 'TABLE' | 'CHART' | 'DASHBOARD';
  exportFormats: ('PDF' | 'EXCEL' | 'CSV')[];
}

// Create custom report
const createCustomReport = async (config: CustomReportConfig) => {
  // Validate configuration
  const validation = await trpc.reports.validateConfig.mutate(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Save report definition
  const report = await trpc.reports.create.mutate({
    ...config,
    createdBy: getCurrentUserId(),
    organizationId: getCurrentOrgId(),
  });

  // Generate initial version
  const result = await generateCustomReport(report.id);

  return {
    report,
    result,
    shareUrl: generateShareUrl(report.id),
  };
};

// Report builder UI components
const ReportBuilder = () => {
  const [config, setConfig] = useState<CustomReportConfig>({
    dataSources: [],
    filters: [],
    columns: [],
    metrics: [],
  });

  return (
    <div className="report-builder">
      <DataSourceSelector
        selected={config.dataSources}
        onChange={(sources) => setConfig({ ...config, dataSources: sources })}
      />

      <FilterBuilder
        dataSources={config.dataSources}
        filters={config.filters}
        onChange={(filters) => setConfig({ ...config, filters })}
      />

      <ColumnSelector
        available={getAvailableColumns(config.dataSources)}
        selected={config.columns}
        onChange={(columns) => setConfig({ ...config, columns })}
      />

      <MetricBuilder
        columns={config.columns}
        metrics={config.metrics}
        onChange={(metrics) => setConfig({ ...config, metrics })}
      />

      <ChartDesigner
        data={previewData}
        charts={config.charts}
        onChange={(charts) => setConfig({ ...config, charts })}
      />

      <ReportPreview config={config} />
    </div>
  );
};
```

### 2. SQL-Based Reports

```typescript
// Execute custom SQL report
const executeSQL = async (query: string, params: any[]) => {
  // Validate SQL (prevent injection)
  const validation = validateSQL(query);
  if (!validation.safe) {
    throw new Error('Invalid SQL query');
  }

  // Add organization filter
  const scopedQuery = addOrganizationScope(query);

  // Execute with read-only connection
  const result = await prisma.$queryRawUnsafe(scopedQuery, ...params);

  // Format results
  return {
    columns: Object.keys(result[0] || {}),
    rows: result,
    rowCount: result.length,
    executionTime: validation.estimatedTime,
  };
};

// SQL templates
const sqlTemplates = {
  inventoryTurnover: `
    SELECT 
      i.sku,
      i.name,
      COALESCE(SUM(sm.quantity), 0) as units_sold,
      AVG(inv.qty_on_hand) as avg_inventory,
      CASE 
        WHEN AVG(inv.qty_on_hand) > 0 
        THEN SUM(sm.quantity) / AVG(inv.qty_on_hand)
        ELSE 0 
      END as turnover_rate
    FROM items i
    LEFT JOIN stock_movements sm ON i.id = sm.item_id 
      AND sm.type = 'ISSUE'
      AND sm.created_at >= :startDate
    LEFT JOIN inventory inv ON i.id = inv.item_id
    WHERE i.organization_id = :organizationId
    GROUP BY i.id, i.sku, i.name
    ORDER BY turnover_rate DESC
  `,

  customerLifetimeValue: `
    SELECT 
      c.id,
      c.name,
      COUNT(DISTINCT o.id) as order_count,
      SUM(o.total_amount) as total_spent,
      AVG(o.total_amount) as avg_order_value,
      MAX(o.created_at) as last_order_date,
      EXTRACT(DAYS FROM (MAX(o.created_at) - MIN(o.created_at))) as customer_lifetime_days
    FROM customers c
    JOIN orders o ON c.id = o.customer_id
    WHERE c.organization_id = :organizationId
    GROUP BY c.id, c.name
    ORDER BY total_spent DESC
  `,
};
```

## Data Visualization

### 1. Chart Types

```typescript
// Time series chart
const generateTimeSeriesChart = (data: TimeSeriesData) => {
  return {
    type: 'line',
    data: {
      labels: data.timestamps,
      datasets: data.series.map((s) => ({
        label: s.name,
        data: s.values,
        borderColor: s.color,
        tension: 0.1,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: data.title },
      },
      scales: {
        x: { type: 'time' },
        y: { beginAtZero: true },
      },
    },
  };
};

// Heatmap visualization
const generateHeatmap = (data: HeatmapData) => {
  return {
    type: 'heatmap',
    data: {
      labels: {
        x: data.xLabels,
        y: data.yLabels,
      },
      datasets: [
        {
          data: data.values,
          backgroundColor: (ctx) => {
            const value = ctx.dataset.data[ctx.dataIndex].v;
            return getHeatmapColor(value, data.min, data.max);
          },
        },
      ],
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw.v} ${data.unit}`,
          },
        },
      },
    },
  };
};

// Sankey diagram for flow analysis
const generateSankeyDiagram = (flows: FlowData[]) => {
  return {
    type: 'sankey',
    data: {
      datasets: [
        {
          data: flows.map((f) => ({
            from: f.source,
            to: f.target,
            flow: f.value,
          })),
          colorFrom: (c) => getNodeColor(c.dataset.data[c.dataIndex].from),
          colorTo: (c) => getNodeColor(c.dataset.data[c.dataIndex].to),
        },
      ],
    },
  };
};
```

### 2. Interactive Dashboards

```typescript
// Dashboard configuration
interface DashboardConfig {
  id: string;
  name: string;
  layout: GridLayout[];
  widgets: DashboardWidget[];
  filters: GlobalFilter[];
  refreshInterval?: number;
}

// Create interactive dashboard
const createDashboard = async (config: DashboardConfig) => {
  const dashboard = await trpc.dashboards.create.mutate(config);

  return {
    id: dashboard.id,
    url: `/dashboards/${dashboard.id}`,
    embedCode: generateEmbedCode(dashboard.id),
  };
};

// Dashboard component
const InteractiveDashboard = ({ dashboardId }) => {
  const { data, isLoading } = trpc.dashboards.get.useQuery({ id: dashboardId });
  const [filters, setFilters] = useState({});

  // Auto-refresh
  useInterval(() => {
    refetch();
  }, data?.refreshInterval || 60000);

  return (
    <DashboardLayout>
      <FilterBar
        filters={data?.filters}
        values={filters}
        onChange={setFilters}
      />

      <GridLayout layout={data?.layout}>
        {data?.widgets.map(widget => (
          <DashboardWidget
            key={widget.id}
            config={widget}
            filters={filters}
            onDrillDown={(params) => handleDrillDown(widget, params)}
          />
        ))}
      </GridLayout>
    </DashboardLayout>
  );
};
```

## Scheduled Reports

### 1. Report Scheduling

```typescript
// Schedule report delivery
const scheduleReport = async (schedule: ReportSchedule) => {
  const scheduled = await trpc.reports.schedule.create.mutate({
    reportId: schedule.reportId,
    frequency: schedule.frequency, // DAILY, WEEKLY, MONTHLY
    time: schedule.time,
    timezone: schedule.timezone,
    recipients: schedule.recipients,
    format: schedule.format,

    // Conditional delivery
    conditions: schedule.conditions, // Only send if conditions met

    // Dynamic parameters
    parameters: schedule.parameters,
  });

  return scheduled;
};

// Report scheduler implementation
const processScheduledReports = async () => {
  const due = await trpc.reports.schedule.getDue.query();

  for (const schedule of due) {
    try {
      // Generate report with current data
      const report = await generateReport(schedule.reportId, {
        ...schedule.parameters,
        asOf: new Date(),
      });

      // Check conditions
      if (schedule.conditions) {
        const shouldSend = await evaluateConditions(schedule.conditions, report);

        if (!shouldSend) {
          continue;
        }
      }

      // Send to recipients
      await sendReport(report, schedule.recipients, {
        format: schedule.format,
        subject: generateSubject(schedule, report),
        message: schedule.message,
      });

      // Log delivery
      await trpc.reports.schedule.logDelivery.mutate({
        scheduleId: schedule.id,
        status: 'SENT',
        recipients: schedule.recipients.length,
      });
    } catch (error) {
      // Handle failure
      await handleScheduleFailure(schedule, error);
    }
  }
};
```

### 2. Report Distribution

```typescript
// Email report distribution
const emailReport = async (
  report: GeneratedReport,
  recipients: Recipient[],
  options: EmailOptions
) => {
  // Convert to requested format
  const attachment = await convertReport(report, options.format);

  // Personalize for each recipient
  for (const recipient of recipients) {
    const personalized = personalizeReport(report, recipient);

    await sendEmail({
      to: recipient.email,
      subject: options.subject,
      html: generateEmailBody(personalized, options),
      attachments: [
        {
          filename: `${report.name}_${format(new Date(), 'yyyy-MM-dd')}.${options.format}`,
          content: attachment,
        },
      ],
    });
  }
};

// Slack integration
const slackReport = async (report: GeneratedReport, channel: string) => {
  // Generate summary
  const summary = generateReportSummary(report);

  // Create chart images
  const charts = await generateChartImages(report.charts);

  // Send to Slack
  await slack.chat.postMessage({
    channel,
    text: summary.text,
    attachments: [
      {
        title: report.name,
        fields: summary.keyMetrics.map((m) => ({
          title: m.label,
          value: m.value,
          short: true,
        })),
        image_url: charts[0]?.url,
      },
    ],
  });

  // Thread with additional charts
  if (charts.length > 1) {
    await postChartsToThread(channel, charts.slice(1));
  }
};
```

## AI-Powered Analytics

### 1. Predictive Analytics

```typescript
// Demand forecasting
const forecastDemand = async (itemId: string, options: ForecastOptions) => {
  const forecast = await trpc.analytics.forecast.demand.query({
    itemId,
    horizon: options.horizonDays || 90,
    method: 'AUTO', // AUTO, ARIMA, PROPHET, LSTM
    includeSeasonality: true,
    includePromotion: true,
    confidenceLevel: 0.95,
  });

  return {
    predictions: forecast.daily,
    confidence: forecast.confidence,
    seasonality: forecast.seasonalFactors,
    accuracy: forecast.modelAccuracy,
    recommendations: generateForecastRecommendations(forecast),
  };
};

// Anomaly detection
const detectAnomalies = async (metric: string, period: DateRange) => {
  const anomalies = await trpc.analytics.anomalies.detect.query({
    metric,
    startDate: period.start,
    endDate: period.end,
    sensitivity: 'MEDIUM',
    includeContext: true,
  });

  return anomalies.map((a) => ({
    ...a,
    severity: calculateSeverity(a),
    explanation: generateExplanation(a),
    actions: suggestActions(a),
  }));
};
```

### 2. Natural Language Insights

```typescript
// Generate AI insights
const generateInsights = async (reportData: ReportData) => {
  const insights = await trpc.analytics.insights.generate.mutate({
    data: reportData,
    focus: ['trends', 'anomalies', 'opportunities', 'risks'],
    style: 'EXECUTIVE_SUMMARY',
  });

  return {
    summary: insights.executiveSummary,
    keyFindings: insights.findings,
    recommendations: insights.recommendations,
    nextSteps: insights.actionItems,
  };
};

// Natural language queries
const queryWithNLP = async (question: string) => {
  const result = await trpc.analytics.nlp.query.mutate({
    question,
    context: 'INVENTORY_MANAGEMENT',
    includeVisualization: true,
  });

  return {
    answer: result.answer,
    data: result.data,
    chart: result.visualization,
    confidence: result.confidence,
    followUp: result.suggestedQuestions,
  };
};
```

## Export and Integration

### 1. Export Formats

```typescript
// Export to Excel with formatting
const exportToExcel = async (report: Report) => {
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  addSummaryData(summarySheet, report.summary);

  // Data sheets
  for (const dataset of report.datasets) {
    const sheet = workbook.addWorksheet(dataset.name);

    // Headers
    sheet.columns = dataset.columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: col.width || 15,
    }));

    // Data with formatting
    dataset.rows.forEach((row, index) => {
      const excelRow = sheet.addRow(row);

      // Apply conditional formatting
      dataset.columns.forEach((col, colIndex) => {
        const cell = excelRow.getCell(colIndex + 1);
        applyFormatting(cell, col, row[col.key]);
      });
    });

    // Charts
    if (dataset.charts) {
      for (const chart of dataset.charts) {
        addChart(sheet, chart);
      }
    }
  }

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// API export endpoint
const createExportEndpoint = async (reportId: string) => {
  const endpoint = await trpc.reports.createAPIEndpoint.mutate({
    reportId,
    authentication: 'API_KEY',
    rateLimit: 100,
    formats: ['JSON', 'CSV', 'XML'],
    parameters: ['date_from', 'date_to', 'format'],
  });

  return {
    url: `https://api.ventry.app/reports/${endpoint.id}`,
    apiKey: endpoint.apiKey,
    documentation: generateAPIDocs(endpoint),
  };
};
```

## Best Practices

### 1. Performance Optimization

```typescript
// Use materialized views for complex reports
const createMaterializedView = async (viewName: string, query: string) => {
  await prisma.$executeRawUnsafe(`
    CREATE MATERIALIZED VIEW ${viewName} AS ${query}
  `);

  // Schedule refresh
  await scheduleViewRefresh(viewName, 'HOURLY');
};

// Implement caching
const getCachedReport = async (reportId: string, params: any) => {
  const cacheKey = generateCacheKey(reportId, params);

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Generate report
  const report = await generateReport(reportId, params);

  // Cache with TTL
  await redis.setex(cacheKey, 3600, JSON.stringify(report));

  return report;
};
```

### 2. Data Accuracy

- **Data Validation**: Verify data integrity before reporting
- **Audit Trail**: Track report generation and access
- **Version Control**: Maintain report definition history
- **Data Lineage**: Document data sources and transformations
- **Quality Checks**: Automated data quality monitoring

### 3. User Experience

```typescript
// Progressive loading for large reports
const streamLargeReport = async function* (reportId: string) {
  const totalRows = await getReportRowCount(reportId);
  const batchSize = 1000;

  // Yield metadata first
  yield {
    type: 'metadata',
    totalRows,
    columns: await getReportColumns(reportId),
  };

  // Stream data in batches
  for (let offset = 0; offset < totalRows; offset += batchSize) {
    const batch = await getReportBatch(reportId, offset, batchSize);

    yield {
      type: 'data',
      rows: batch,
      progress: (offset + batch.length) / totalRows,
    };
  }

  // Final summary
  yield {
    type: 'complete',
    summary: await generateReportSummary(reportId),
  };
};
```

## Troubleshooting

### Common Issues

1. **Slow Report Generation**
   - Add database indexes
   - Use materialized views
   - Implement pagination
   - Optimize queries

2. **Data Discrepancies**
   - Verify timezone handling
   - Check data filters
   - Validate calculations
   - Review data sources

3. **Export Failures**
   - Check file size limits
   - Verify permissions
   - Monitor memory usage
   - Use streaming for large exports

### Performance Monitoring

```sql
-- Monitor report query performance
CREATE TABLE report_performance_log (
  id SERIAL PRIMARY KEY,
  report_id TEXT,
  execution_time_ms INTEGER,
  row_count INTEGER,
  parameters JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analyze slow reports
SELECT
  report_id,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) as executions
FROM report_performance_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY report_id
HAVING AVG(execution_time_ms) > 5000
ORDER BY avg_time DESC;
```

## Next Steps

1. Explore [Standard Reports](#standard-reports)
2. Build [Custom Reports](#custom-reports)
3. Set up [Scheduled Delivery](#scheduled-reports)
4. Enable [AI Analytics](#ai-powered-analytics)
