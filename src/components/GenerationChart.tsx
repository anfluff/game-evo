import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData
} from 'chart.js'
import type { GenerationStats } from '../game/stats'
import { metricsInOrder } from './generationMetrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const CHART_METRICS = metricsInOrder([
  'turns',
  'avg_population',
  'highest_age',
  'energy_start',
  'hp_gained_eating',
  'hp_gained_consuming_energy',
  'births',
  'consumed_energy',
  'eaten',
  'killed',
  'no_hp'
])

type GenerationChartProps = {
  generations: GenerationStats[]
  animated: boolean
}

/** One line per metric across all generations, the one in progress included. */
export function GenerationChart({ generations, animated }: GenerationChartProps) {
  if (generations.length === 0) {
    return <div className="empty">No data yet</div>
  }

  const data: ChartData<'line'> = {
    // The last generation is still being played, so its totals are partial.
    labels: generations.map((_stats, index) => `Gen ${index + 1}${index === generations.length - 1 ? ' (running)' : ''}`),
    datasets: CHART_METRICS.map(metric => ({
      label: metric.key,
      data: generations.map(metric.value),
      borderColor: `rgb(${metric.color})`,
      backgroundColor: `rgba(${metric.color}, 0.2)`,
      tension: 0.2,
      borderWidth: 2,
      pointRadius: 2,
      fill: false
    }))
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...(animated ? {} : { animation: false }),
    plugins: {
      legend: { position: 'bottom' },
      title: { display: false }
    },
    scales: {
      x: { title: { display: false } },
      y: { beginAtZero: true }
    }
  }
  return <Line data={data} options={options}/>
}
