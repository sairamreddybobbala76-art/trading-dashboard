import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { CandlestickBar, TickMessage } from '../../types'

interface Props {
  bars: CandlestickBar[]
  ticker: string
  liveTick: TickMessage | null
  onPriceSelect?: (price: number) => void
}

export function CandlestickChart({ bars, ticker, liveTick, onPriceSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const barsRef = useRef<CandlestickBar[]>(bars)
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#11171B' },
        textColor: '#E9ECEC',
      },
      grid: {
        vertLines: { color: '#1e2d35' },
        horzLines: { color: '#1e2d35' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#44545B' },
      timeScale: { borderColor: '#44545B', timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 400,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candleSeries
    volumeRef.current = volumeSeries

    chart.subscribeCrosshairMove((param) => {
      if (param.point && onPriceSelect) {
        const price = candleSeries.coordinateToPrice(param.point.y)
        if (price !== null) {
          setCrosshairPrice(price)
          onPriceSelect(price)
        }
      }
    })

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [])

  // Keep barsRef in sync so the live tick effect always sees current bars
  useEffect(() => {
    barsRef.current = bars
  }, [bars])

  // Load bars whenever they change (new ticker or timeframe)
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return
    if (bars.length === 0) {
      candleRef.current.setData([])
      volumeRef.current.setData([])
      return
    }
    const candleData: CandlestickData<Time>[] = bars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    const volumeData = bars.map((b) => ({
      time: b.time as Time,
      value: b.volume,
      color: b.close >= b.open ? '#26a69a55' : '#ef535055',
    }))
    candleRef.current.setData(candleData)
    volumeRef.current.setData(volumeData)
    chartRef.current?.timeScale().fitContent()
  }, [bars])

  // Live tick: update the last bar in-place (use last bar's time, not tick time)
  useEffect(() => {
    if (!liveTick || !candleRef.current) return
    const last = barsRef.current[barsRef.current.length - 1]
    if (!last) return
    candleRef.current.update({
      time: last.time as Time,
      open: last.open,
      high: Math.max(last.high, liveTick.price),
      low: Math.min(last.low, liveTick.price),
      close: liveTick.price,
    })
  }, [liveTick])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {crosshairPrice && (
        <div className="absolute top-2 right-2 text-xs text-muted font-mono">
          ${crosshairPrice.toFixed(2)}
        </div>
      )}
    </div>
  )
}
