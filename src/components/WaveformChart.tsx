import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import { useStore } from '../store/useStore'

const MAX_POINTS = 500
const WINDOW_SECONDS = 30

export default function WaveformChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const { dataPoints, fields } = useStore()

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current, undefined, {
      renderer: 'canvas',
    })
    instanceRef.current = instance

    const handleResize = () => instance.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      instance.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return

    const selectedFields = fields.filter((f) => f.selected)

    if (dataPoints.length === 0 || selectedFields.length === 0) {
      instance.setOption({ series: [] }, { notMerge: true })
      return
    }

    const now = dataPoints[dataPoints.length - 1]?.timestamp ?? Date.now() / 1000
    const windowStart = now - WINDOW_SECONDS

    const series = selectedFields.map((field) => {
      const data: [number, number][] = []
      for (let i = dataPoints.length - 1; i >= 0; i--) {
        const pt = dataPoints[i]
        if (pt.timestamp < windowStart) break
        const val = pt.fields[field.name]
        if (val !== undefined) {
          data.unshift([pt.timestamp * 1000, val])
        }
      }

      const sampled = data.length > MAX_POINTS
        ? data.filter((_, i) => i % Math.ceil(data.length / MAX_POINTS) === 0)
        : data

      return {
        name: field.name,
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5 },
        data: sampled,
        color: field.color,
        connectNulls: false,
        animation: false,
      }
    })

    instance.setOption(
      {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const time = new Date(params[0].data[0]).toLocaleTimeString()
            let html = `<div style="font-size:12px">${time}</div>`
            for (const p of params) {
              html += `<div>${p.marker} ${p.seriesName}: <b>${p.data[1]}</b></div>`
            }
            return html
          },
        },
        legend: {
          data: selectedFields.map((f) => f.name),
          type: 'scroll',
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: {
          left: 50,
          right: 20,
          top: 10,
          bottom: 35,
        },
        xAxis: {
          type: 'time',
          axisLine: { onZero: false },
          splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
        },
        yAxis: {
          type: 'value',
          splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
        },
        dataZoom: [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0, bottom: 25, height: 15 },
        ],
        series,
      },
      { notMerge: true },
    )
  }, [dataPoints, fields])

  return (
    <div className="panel waveform-panel">
      <div ref={chartRef} className="chart-container" />
    </div>
  )
}
