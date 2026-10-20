import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

/** Tree-shaken ECharts: only what our charts use (D14.1). */
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export type { EChartsCoreOption } from 'echarts/core';
export { echarts };
