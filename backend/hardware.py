"""
Hardware & Apple Silicon Metal Watchdog for Project Lloyd.
Monitors Unified Memory, Metal GPU layer offloading, thermal pressure, and inference latency.
"""

from __future__ import annotations

import os
import platform
import subprocess
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, Optional

try:
    import psutil
except ImportError:
    psutil = None  # type: ignore


def _run_sysctl(key: str) -> Optional[str]:
    try:
        res = subprocess.run(
            ["sysctl", "-n", key],
            capture_output=True,
            text=True,
            timeout=1.5,
            check=False,
        )
        if res.returncode == 0:
            return res.stdout.strip()
    except Exception:
        pass
    return None


@dataclass
class HardwareWatchdog:
    """Tracks Apple Silicon hardware telemetry, Metal status, and inference latency."""

    chip_brand: str = field(default_factory=lambda: _run_sysctl("machdep.cpu.brand_string") or "Apple Silicon")
    arch: str = field(default_factory=lambda: platform.machine())
    cpu_cores_physical: int = field(
        default_factory=lambda: int(_run_sysctl("hw.perflevel0.physicalcpu") or os.cpu_count() or 8)
    )
    cpu_cores_total: int = field(
        default_factory=lambda: int(_run_sysctl("hw.ncpu") or os.cpu_count() or 8)
    )
    total_ram_bytes: int = field(
        default_factory=lambda: int(_run_sysctl("hw.memsize") or (16 * 1024**3))
    )
    gpu_layers_offloaded: str = "All (-1 / Metal Unified Memory)"
    metal_active: bool = True

    _llm_latencies_ms: Deque[float] = field(default_factory=lambda: deque(maxlen=50))
    _stt_latencies_ms: Deque[float] = field(default_factory=lambda: deque(maxlen=50))
    _tts_latencies_ms: Deque[float] = field(default_factory=lambda: deque(maxlen=50))
    _tokens_per_sec: Deque[float] = field(default_factory=lambda: deque(maxlen=50))
    _boot_time: float = field(default_factory=time.time)

    def record_llm_latency(self, latency_ms: float, tokens_per_sec: float = 0.0) -> None:
        self._llm_latencies_ms.append(max(0.1, float(latency_ms)))
        if tokens_per_sec > 0:
            self._tokens_per_sec.append(float(tokens_per_sec))

    def record_stt_latency(self, latency_ms: float) -> None:
        self._stt_latencies_ms.append(max(0.1, float(latency_ms)))

    def record_tts_latency(self, latency_ms: float) -> None:
        self._tts_latencies_ms.append(max(0.1, float(latency_ms)))

    def set_metal_status(self, active: bool, layers_description: str = "All (-1 / Metal Unified Memory)") -> None:
        self.metal_active = active
        self.gpu_layers_offloaded = layers_description

    def get_thermal_state(self) -> str:
        """Query macOS thermal state without requiring root privileges."""
        thermal_level = _run_sysctl("machdep.xcpm.cpu_thermal_level")
        if thermal_level is not None and thermal_level.isdigit():
            lvl = int(thermal_level)
            if lvl < 25:
                return "Nominal"
            if lvl < 60:
                return "Fair"
            if lvl < 85:
                return "Serious"
            return "Critical"
        return "Nominal (Cool)"

    def get_memory_snapshot(self) -> Dict[str, Any]:
        """Return process RSS and system unified memory metrics in MB/GB."""
        process_rss_mb = 0.0
        system_used_gb = 0.0
        system_total_gb = round(self.total_ram_bytes / (1024**3), 2)
        system_percent = 0.0

        if psutil is not None:
            try:
                proc = psutil.Process(os.getpid())
                process_rss_mb = round(proc.memory_info().rss / (1024**2), 1)
                vm = psutil.virtual_memory()
                system_used_gb = round((vm.total - vm.available) / (1024**3), 2)
                system_percent = round(vm.percent, 1)
            except Exception:
                pass
        else:
            # Fallback via resource module
            import resource
            rusage = resource.getrusage(resource.RUSAGE_SELF)
            # On macOS ru_maxrss is in bytes
            process_rss_mb = round(rusage.ru_maxrss / (1024**2), 1)

        return {
            "process_rss_mb": process_rss_mb,
            "system_used_gb": system_used_gb,
            "system_total_gb": system_total_gb,
            "system_percent": system_percent,
        }

    def get_cpu_usage_percent(self) -> float:
        if psutil is not None:
            try:
                return round(psutil.cpu_percent(interval=None), 1)
            except Exception:
                pass
        return 0.0

    def get_latency_stats(self) -> Dict[str, float]:
        def _avg(d: Deque[float]) -> float:
            return round(sum(d) / len(d), 1) if d else 0.0

        def _last(d: Deque[float]) -> float:
            return round(d[-1], 1) if d else 0.0

        return {
            "avg_llm_ms": _avg(self._llm_latencies_ms),
            "last_llm_ms": _last(self._llm_latencies_ms),
            "avg_stt_ms": _avg(self._stt_latencies_ms),
            "last_stt_ms": _last(self._stt_latencies_ms),
            "avg_tts_ms": _avg(self._tts_latencies_ms),
            "last_tts_ms": _last(self._tts_latencies_ms),
            "avg_tokens_per_sec": _avg(self._tokens_per_sec),
            "last_tokens_per_sec": _last(self._tokens_per_sec),
        }

    def get_snapshot(self) -> Dict[str, Any]:
        mem = self.get_memory_snapshot()
        lat = self.get_latency_stats()
        return {
            "chip": self.chip_brand,
            "arch": self.arch,
            "is_apple_silicon": self.arch == "arm64",
            "metal_active": self.metal_active,
            "gpu_layers_offloaded": self.gpu_layers_offloaded,
            "cpu_cores_total": self.cpu_cores_total,
            "cpu_usage_percent": self.get_cpu_usage_percent(),
            "thermal_state": self.get_thermal_state(),
            "memory": mem,
            "latency": lat,
            "uptime_seconds": round(time.time() - self._boot_time, 1),
        }


watchdog = HardwareWatchdog()
