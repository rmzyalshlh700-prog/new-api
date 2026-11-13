/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Activity, Cpu, Gauge, MemoryStick, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts'

import { TitledCard } from '@/shared/components/ui/titled-card'
import { cn } from '@/shared/lib/utils'

import type { LiveMetrics } from '../hooks/use-live-metrics'

type GaugeRingProps = {
  value: number
  icon: React.ReactNode
  label: string
  tone: 'success' | 'warning' | 'destructive'
}

function gaugeTone(value: number): 'success' | 'warning' | 'destructive' {
  if (value >= 85) return 'destructive'
  if (value >= 60) return 'warning'
  return 'success'
}

const TONE_STROKE: Record<'success' | 'warning' | 'destructive', string> = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
}

function GaugeRing({ value, icon, label, tone }: GaugeRingProps) {
  const data = [{ value: Math.min(100, Math.max(0, value)), fill: TONE_STROKE[tone] }]
  return (
    <div className='relative flex flex-col items-center'>
      <div className='relative size-32'>
        <ResponsiveContainer width='100%' height='100%'>
          <RadialBarChart
            data={data}
            innerRadius='78%'
            outerRadius='100%'
            startAngle={220}
            endAngle={-40}
            barSize={10}
          >
            <RadialBar
              dataKey='value'
              cornerRadius={6}
              background={{ fill: 'hsl(var(--muted))' }}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className='absolute inset-0 flex flex-col items-center justify-center gap-0.5'>
          {icon}
          <span className='text-lg font-semibold tabular-nums'>
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className='text-muted-foreground mt-1 text-xs font-medium'>{label}</span>
    </div>
  )
}

function MiniArea({
  data,
  stroke,
  id,
}: {
  data: number[]
  stroke: string
  id: string
}) {
  const points = data.map((value, index) => ({ index, value }))
  return (
    <div className='h-12 w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor={stroke} stopOpacity={0.35} />
              <stop offset='100%' stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type='monotone'
            dataKey='value'
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ServerPerformanceWidget({
  metrics,
  connected,
  cpuHistory,
  memoryHistory,
}: {
  metrics: LiveMetrics | null
  connected: boolean
  cpuHistory: number[]
  memoryHistory: number[]
}) {
  const { t } = useTranslation()
  const cpu = metrics?.cpu_usage ?? 0
  const memory = metrics?.memory_usage ?? 0

  return (
    <TitledCard
      title={t('Server Performance')}
      icon={<Cpu className='size-4' />}
      description={
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            connected ? 'text-success' : 'text-muted-foreground'
          )}
        >
          {connected ? (
            <>
              <Activity className='size-3.5' aria-hidden='true' />
              {t('Live')}
            </>
          ) : (
            <>
              <WifiOff className='size-3.5' aria-hidden='true' />
              {t('Connecting...')}
            </>
          )}
        </span>
      }
    >
      <div className='grid grid-cols-2 gap-4 px-5 pb-5'>
        <GaugeRing
          value={cpu}
          icon={<Cpu className='text-muted-foreground size-4' />}
          label={t('CPU Usage')}
          tone={gaugeTone(cpu)}
        />
        <GaugeRing
          value={memory}
          icon={<MemoryStick className='text-muted-foreground size-4' />}
          label={t('Memory Usage')}
          tone={gaugeTone(memory)}
        />
      </div>
      <div className='border-t px-5 py-3'>
        <div className='text-muted-foreground mb-1 text-xs font-medium'>
          {t('CPU trend (last 60s)')}
        </div>
        <MiniArea data={cpuHistory} stroke={TONE_STROKE[gaugeTone(cpu)]} id='cpu-spark' />
        <div className='text-muted-foreground mt-2 mb-1 text-xs font-medium'>
          {t('Memory trend (last 60s)')}
        </div>
        <MiniArea
          data={memoryHistory}
          stroke={TONE_STROKE[gaugeTone(memory)]}
          id='memory-spark'
        />
        {metrics && (
          <div className='text-muted-foreground mt-2 flex items-center gap-1.5 text-xs'>
            <Gauge className='size-3.5' aria-hidden='true' />
            {t('Load average')}: {metrics.load1.toFixed(2)} / {metrics.load5.toFixed(2)} /{' '}
            {metrics.load15.toFixed(2)}
          </div>
        )}
      </div>
    </TitledCard>
  )
}
