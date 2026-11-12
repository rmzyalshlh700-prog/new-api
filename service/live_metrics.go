package service

import (
	"context"
	"net"
	"sync"
	"time"

	"github.com/shirou/gopsutil/cpu"
	"github.com/shirou/gopsutil/load"
	"github.com/shirou/gopsutil/mem"
	gopsnet "github.com/shirou/gopsutil/net"
)

// LiveMetricsSnapshot is one sample of OS-level health metrics, streamed to
// the admin dashboard over SSE once per second.
type LiveMetricsSnapshot struct {
	Timestamp     int64   `json:"timestamp"`
	CPUUsage      float64 `json:"cpu_usage"`    // percent 0-100
	MemoryUsage   float64 `json:"memory_usage"` // percent 0-100
	Load1         float64 `json:"load1"`        // 1-minute load average
	Load5         float64 `json:"load5"`        // 5-minute load average
	Load15        float64 `json:"load15"`       // 15-minute load average
	DownloadBytes uint64  `json:"download_bps"` // bytes per second received
	UploadBytes   uint64  `json:"upload_bps"`   // bytes per second sent
	LatencyMs     float64 `json:"latency_ms"`   // TCP ping to the internet
	LatencyFailed bool    `json:"latency_failed"`
}

const (
	liveMetricsInterval = time.Second
	// liveMetricsPingTarget is a highly available anycast endpoint used to
	// measure raw internet reachability latency.
	liveMetricsPingTarget  = "1.1.1.1:443"
	liveMetricsPingTimeout = 2 * time.Second
)

var (
	liveMetricsMu     sync.Mutex
	liveMetricsLatest LiveMetricsSnapshot
	lastNetCounters   gopsnet.IOCountersStat
	lastNetSampledAt  time.Time
	netCountersPrimed bool
)

// StartLiveMetricsSampler samples OS metrics once per second in the
// background so SSE clients share a single set of gopsutil calls instead of
// hammering the OS individually.
func StartLiveMetricsSampler() {
	go func() {
		ticker := time.NewTicker(liveMetricsInterval)
		defer ticker.Stop()
		for range ticker.C {
			sample := collectLiveMetrics()
			liveMetricsMu.Lock()
			liveMetricsLatest = sample
			liveMetricsMu.Unlock()
		}
	}()
}

func collectLiveMetrics() LiveMetricsSnapshot {
	snapshot := LiveMetricsSnapshot{Timestamp: time.Now().Unix()}

	if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		snapshot.CPUUsage = percents[0]
	}
	if memInfo, err := mem.VirtualMemory(); err == nil {
		snapshot.MemoryUsage = memInfo.UsedPercent
	}
	if avg, err := load.Avg(); err == nil {
		snapshot.Load1 = avg.Load1
		snapshot.Load5 = avg.Load5
		snapshot.Load15 = avg.Load15
	}

	// Network throughput: diff cumulative interface counters over the tick.
	if counters, err := gopsnet.IOCounters(false); err == nil && len(counters) > 0 {
		now := time.Now()
		liveMetricsMu.Lock()
		if netCountersPrimed && !lastNetSampledAt.IsZero() {
			elapsed := now.Sub(lastNetSampledAt).Seconds()
			if elapsed > 0 {
				snapshot.DownloadBytes = uint64(float64(counters[0].BytesRecv-lastNetCounters.BytesRecv) / elapsed)
				snapshot.UploadBytes = uint64(float64(counters[0].BytesSent-lastNetCounters.BytesSent) / elapsed)
			}
		}
		lastNetCounters = counters[0]
		lastNetSampledAt = now
		netCountersPrimed = true
		liveMetricsMu.Unlock()
	}

	// Latency: TCP handshake RTT to an anycast resolver.
	start := time.Now()
	conn, err := net.DialTimeout("tcp", liveMetricsPingTarget, liveMetricsPingTimeout)
	if err != nil {
		snapshot.LatencyFailed = true
	} else {
		snapshot.LatencyMs = float64(time.Since(start).Microseconds()) / 1000.0
		_ = conn.Close()
	}
	return snapshot
}

// GetLiveMetrics returns the most recent sample.
func GetLiveMetrics() LiveMetricsSnapshot {
	liveMetricsMu.Lock()
	defer liveMetricsMu.Unlock()
	return liveMetricsLatest
}

// StreamLiveMetrics writes one JSON snapshot per second to w until ctx is
// cancelled. It never blocks on a slow client longer than the write timeout.
func StreamLiveMetrics(ctx context.Context, write func(LiveMetricsSnapshot) error) {
	ticker := time.NewTicker(liveMetricsInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := write(GetLiveMetrics()); err != nil {
				return
			}
		}
	}
}
