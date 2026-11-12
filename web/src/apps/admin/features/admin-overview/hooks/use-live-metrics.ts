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
import { useEffect, useRef, useState } from 'react'

export interface LiveMetrics {
  timestamp: number
  cpu_usage: number
  memory_usage: number
  load1: number
  load5: number
  load15: number
  download_bps: number
  upload_bps: number
  latency_ms: number
  latency_failed: boolean
}

const MAX_POINTS = 60

// Subscribes to /api/admin/metrics/live over SSE. The connection is closed
// and its history trimmed on unmount to prevent memory leaks.
export function useLiveMetrics(): {
  metrics: LiveMetrics | null
  connected: boolean
  cpuHistory: number[]
  memoryHistory: number[]
  downloadHistory: number[]
  uploadHistory: number[]
} {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memoryHistory, setMemoryHistory] = useState<number[]>([])
  const [downloadHistory, setDownloadHistory] = useState<number[]>([])
  const [uploadHistory, setUploadHistory] = useState<number[]>([])
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/admin/metrics/live')
    sourceRef.current = source

    source.addEventListener('open', () => setConnected(true))
    source.addEventListener('error', () => setConnected(false))
    source.addEventListener('metrics', (event) => {
      try {
        const snapshot: LiveMetrics = JSON.parse((event as MessageEvent).data)
        setMetrics(snapshot)
        setConnected(true)
        setCpuHistory((points) => [...points, snapshot.cpu_usage].slice(-MAX_POINTS))
        setMemoryHistory((points) =>
          [...points, snapshot.memory_usage].slice(-MAX_POINTS)
        )
        setDownloadHistory((points) =>
          [...points, snapshot.download_bps].slice(-MAX_POINTS)
        )
        setUploadHistory((points) =>
          [...points, snapshot.upload_bps].slice(-MAX_POINTS)
        )
      } catch {
        // Ignore malformed frames; the next tick delivers a fresh snapshot.
      }
    })

    return () => {
      source.close()
      sourceRef.current = null
      setConnected(false)
    }
  }, [])

  return { metrics, connected, cpuHistory, memoryHistory, downloadHistory, uploadHistory }
}
