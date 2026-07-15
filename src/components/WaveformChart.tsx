import { useRef, useEffect, useCallback } from 'react'
import * as echarts from 'echarts'
import { useStore } from '../store/useStore'
import type { DataPoint, FieldSelectorOption } from '../types'

const THROTTLE_MS = 300

function buildSeries(
  dataPoints: DataPoint[],
  selectedFields: FieldSelectorOption[],
  maxPoints: number,
) {
  if (dataPoints.length === 0 || selectedFields.length === 0) return []

  const window = dataPoints.slice(-maxPoints)
  const count = window.length

  return selectedFields.map((field) => {
    const data: [number, number][] = []
    for (let i = 0; i < count; i++) {
      const pt = window[i]
      const val = pt.fields[field.name]
      if (val !== undefined) {
        const x = maxPoints - count + i
        data.push([x, val])
      }
    }

    return {
      name: field.name,
      type: 'line',
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 3,
      smooth: false,
      lineStyle: { width: 1.5 },
      data,
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
  const maxPointsRef = useRef(0)
  const dataPointsRef = useRef<DataPoint[]>([])
  const { dataPoints, fields, maxPoints, setMaxPoints } = useStore()
  maxPointsRef.current = maxPoints
  dataPointsRef.current = dataPoints

  const doUpdate = useCallback(() => {
    const instance = instanceRef.current
    if (!instance) return

    lastUpdateRef.current = Date.now()
    const selectedFields = fields.filter((f) => f.selected)
    const mp = maxPointsRef.current
    instance.setOption(
      {
        xAxis: { max: mp - 1 },
        series: buildSeries(dataPoints, selectedFields, mp),
        legend: { data: selectedFields.map((f) => f.name) },
      },
      { replaceMerge: ['series'] },
    )

    const sinceMove = Date.now() - lastMouseRef.current.time
    if (sinceMove >= 300) {
      instance.dispatchAction({ type: 'hideTip' })
    } else {
      instance.dispatchAction({ type: 'showTip', x: lastMouseRef.current.x, y: lastMouseRef.current.y })
    }
  }, [dataPoints, fields])

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
          const idx = Math.round(params[0].data[0])
          const dp = dataPointsRef.current
          const mp = maxPointsRef.current
          const count = Math.min(dp.length, mp)
          const offset = idx - (mp - count)
          const pt = offset >= 0 ? dp[dp.length - count + offset] : undefined
          let html = `<div style="font-size:12px">#${idx}</div>`
          if (pt) {
            html += `<div style="font-size:11px;opacity:0.7">${new Date(pt.timestamp * 1000).toLocaleTimeString()}</div>`
          }
          for (const p of params) {
            html += `<div>${p.marker} ${p.seriesName}: <b>${p.data[1]}</b></div>`
          }
          return html
        },
      },
      legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 120, top: 10, bottom: 35 },
      xAxis: {
        type: 'value',
        min: 0,
        max: maxPoints - 1,
        axisLine: { onZero: false },
        splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
      },
      yAxis: {
        type: 'value',
        splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.3 } },
      },
      series: [],
    })

    if (dataPoints.length > 0) {
      const selectedFields = fields.filter((f) => f.selected)
      instance.setOption({
        xAxis: { max: maxPoints - 1 },
        series: buildSeries(dataPoints, selectedFields, maxPoints),
        legend: { data: selectedFields.map((f) => f.name) },
      }, { replaceMerge: ['series'] })
    }

    const handleResize = () => instance.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      instance.dispose()
      instanceRef.current = null
    }
  }, [maxPoints])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return

    const now = Date.now()
    const elapsed = now - lastUpdateRef.current

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
  }, [dataPoints, fields, doUpdate])

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
