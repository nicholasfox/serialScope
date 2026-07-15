import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import { useStore } from '../store/useStore'

const WINDOW_SECONDS = 30
const THROTTLE_MS = 300

function buildSeries(dataPoints: any[], selectedFields: any[], maxPoints: number) {
  if (dataPoints.length === 0 || selectedFields.length === 0) return []

  const latest = dataPoints[dataPoints.length - 1]
  const windowStart = latest.timestamp - WINDOW_SECONDS

  return selectedFields.map((field) => {
    const data: [number, number][] = []
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const pt = dataPoints[i]
      if (pt.timestamp < windowStart) break
      const val = pt.fields[field.name]
      if (val !== undefined) {
        data.unshift([pt.timestamp * 1000, val])
      }
    }
    const clipped = data.length > maxPoints
      ? data.filter((_, i) => i % Math.ceil(data.length / maxPoints) === 0)
      : data

    return {
      name: field.name,
      type: 'line',
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 3,
      smooth: false,
      lineStyle: { width: 1.5 },
      data: clipped,
      color: field.color,
      connectNulls: false,
      animation: false,
      endLabel: {
        show: true,
        formatter: (params: any) => {
          const v = params.value?.[1]
          return v !== undefined ? `${field.name}=${v}` : ''
        },
        fontSize: 11,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: [2, 6],
        borderRadius: 3,
        color: field.color,
      },
    }
  })
}

const POINTS_OPTIONS = [200, 500, 1000, 2000, 5000]

export default function WaveformChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const lastUpdateRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 })
  const { dataPoints, fields, maxPoints, setMaxPoints } = useStore()

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current, undefined, {
      renderer: 'canvas',
    })
    instanceRef.current = instance

    instance.on('mousemove', (params: any) => {
      if (params.event) {
        lastMouseRef.current = { x: params.event.offsetX, y: params.event.offsetY, time: Date.now() }
      }
    })
    instance.on('mouseout', () => {
      lastMouseRef.current.time = 0
      instance.dispatchAction({ type: 'hideTip' })
    })

    instance.setOption({
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove',
        hideDelay: 0,
        formatter: (params: any) => {
          const time = new Date(params[0].data[0]).toLocaleTimeString()
          let html = `<div style="font-size:12px">${time}</div>`
          for (const p of params) {
            html += `<div>${p.marker} ${p.seriesName}: <b>${p.data[1]}</b></div>`
          }
          return html
        },
      },
      legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 120, top: 10, bottom: 35 },
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
      series: [],
    })

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

    const now = Date.now()
    const elapsed = now - lastUpdateRef.current

    const doUpdate = () => {
      lastUpdateRef.current = Date.now()
      const selectedFields = fields.filter((f) => f.selected)
      instance.setOption(
        { series: buildSeries(dataPoints, selectedFields, maxPoints), legend: { data: selectedFields.map((f) => f.name) } },
        { replaceMerge: ['series'] },
      )

      const sinceMove = Date.now() - lastMouseRef.current.time
      if (sinceMove >= 300) {
        instance.dispatchAction({ type: 'hideTip' })
      } else {
        instance.dispatchAction({ type: 'showTip', x: lastMouseRef.current.x, y: lastMouseRef.current.y })
      }
    }

    if (elapsed >= THROTTLE_MS) {
      doUpdate()
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        doUpdate()
      }, THROTTLE_MS - elapsed)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [dataPoints, fields])

  return (
    <div className="panel waveform-panel">
      <div className="waveform-toolbar">
        <label>Max Points:</label>
        <select value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))}>
          {POINTS_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div ref={chartRef} className="chart-container" />
    </div>
  )
}
