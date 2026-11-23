'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onResult: (code: string) => void
  onClose: () => void
  title?: string
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = 980
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.07, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
    o.start()
    o.stop(ctx.currentTime + 0.14)
  } catch {
    /* ignore */
  }
}

export function Scanner({ onResult, onClose, title = 'اسکن بارکد' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [err, setErr] = useState('')
  const [torch, setTorch] = useState(false)
  const [ready, setReady] = useState(false)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const cbRef = useRef(onResult)
  cbRef.current = onResult

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return
    let stop = false
    let stream: MediaStream | null = null
    let zxingControls: { stop: () => void } | null = null

    async function start(video: HTMLVideoElement) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          })
        } catch {
          /* some phones ignore */
        }
        video.setAttribute('playsinline', 'true')
        video.setAttribute('autoplay', 'true')
        video.muted = true
        video.srcObject = stream
        await video.play()
        setReady(true)

        const BD = (window as unknown as {
          BarcodeDetector?: new (o?: { formats: string[] }) => {
            detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>
          }
        }).BarcodeDetector

        if (BD) {
          const det = new BD({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code'],
          })
          const canvas = canvasRef.current!
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          const loop = async () => {
            if (stop) return
            try {
              if (video.readyState >= 2 && video.videoWidth) {
                const vw = video.videoWidth
                const vh = video.videoHeight
                const cw = Math.max(320, Math.floor(vw * 0.82))
                const ch = Math.max(120, Math.floor(vh * 0.26))
                const sx = Math.floor((vw - cw) / 2)
                const sy = Math.floor((vh - ch) / 2)
                canvas.width = cw
                canvas.height = ch
                ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch)
                const codes = await det.detect(canvas)
                const raw = codes.find((c) => c.rawValue)?.rawValue?.trim()
                if (raw) {
                  stop = true
                  beep()
                  navigator.vibrate?.(35)
                  cbRef.current(raw)
                  return
                }
              }
            } catch {
              /* keep scanning */
            }
            requestAnimationFrame(loop)
          }
          requestAnimationFrame(loop)
          return
        }

        const zxing = await import('@zxing/browser')
        const reader = new zxing.BrowserMultiFormatReader()
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (stop || !result) return
          const text = result.getText()?.trim()
          if (!text) return
          stop = true
          beep()
          navigator.vibrate?.(35)
          cbRef.current(text)
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (/NotAllowed|Permission/i.test(msg)) setErr('دسترسی دوربین لازم است. از تنظیمات مرورگر اجازه بده.')
        else if (/NotFound|DevicesNotFound/i.test(msg)) setErr('دوربینی پیدا نشد.')
        else setErr('دوربین باز نشد. سایت باید روی HTTPS باشد.')
      }
    }

    start(videoEl)
    return () => {
      stop = true
      try {
        zxingControls?.stop()
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torch
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {
      setErr('چراغ‌قوه روی این گوشی در دسترس نیست.')
    }
  }

  return (
    <div className="scan-overlay">
      <div className="scan-top">
        <button type="button" className="scan-close" onClick={onClose}>
          بستن
        </button>
        <strong>{title}</strong>
        <button type="button" className="scan-close" onClick={toggleTorch}>
          {torch ? 'چراغ خاموش' : 'چراغ'}
        </button>
      </div>
      <div className="scan-stage">
        <video ref={videoRef} className="scan-video" playsInline muted autoPlay />
        <div className="scan-frame">
          <i />
          <i />
          <i />
          <i />
          <span className="scan-laser" />
        </div>
        <canvas ref={canvasRef} className="scan-canvas" />
      </div>
      <div className="scan-hint">
        {err || (ready ? 'بارکد را داخل کادر سبز نگه دار — سریع می‌خواند' : 'در حال روشن کردن دوربین…')}
      </div>
    </div>
  )
}

export function SearchBar({
  value,
  onChange,
  onScan,
  placeholder = 'جستجوی کالا یا اسکن بارکد',
}: {
  value: string
  onChange: (v: string) => void
  onScan?: (code: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="search">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search" />
        {onScan ? (
          <button type="button" className="scan-mini" onClick={() => setOpen(true)} aria-label="اسکن بارکد">
            <ScanIcon />
          </button>
        ) : null}
      </div>
      {open ? (
        <Scanner
          onClose={() => setOpen(false)}
          onResult={(code) => {
            setOpen(false)
            onScan?.(code)
          }}
        />
      ) : null}
    </>
  )
}

export function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3" />
      <path d="M5 12h14" />
    </svg>
  )
}
