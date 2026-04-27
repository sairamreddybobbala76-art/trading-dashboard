import { useEffect, useRef, useState, useCallback } from 'react'
import type { TickMessage } from '../types'
import { wsBase } from '../services/api'

export function usePriceFeed(ticker: string) {
  const [price, setPrice]     = useState<number | null>(null)
  const [lastBar, setLastBar] = useState<TickMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef            = useRef<WebSocket | null>(null)
  const activeTickerRef  = useRef(ticker)

  // Reset state instantly when ticker switches
  useEffect(() => {
    activeTickerRef.current = ticker
    setPrice(null)
    setLastBar(null)
    setConnected(false)
  }, [ticker])

  const connect = useCallback(() => {
    if (!ticker) return
    const url = `${wsBase()}/ws/price/${ticker}`
    const ws  = new WebSocket(url)

    ws.onopen = () => {
      if (activeTickerRef.current === ticker) setConnected(true)
    }
    ws.onclose = () => {
      if (activeTickerRef.current !== ticker) return
      setConnected(false)
      setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (e) => {
      if (activeTickerRef.current !== ticker) return
      try {
        const msg: TickMessage = JSON.parse(e.data)
        setPrice(msg.price)
        setLastBar(msg)
      } catch {}
    }

    wsRef.current = ws
  }, [ticker])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  return { price, lastBar, connected }
}
