export class Semaphore {
  private active = 0
  private readonly queue: Array<() => void> = []
  private readonly max: number

  constructor(max: number) {
    this.max = max
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active += 1
      return () => this.release()
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active += 1
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.queue.shift()
    if (next) next()
  }
}

export class KeyedSemaphore {
  private readonly semaphores = new Map<string, Semaphore>()
  private readonly maxPerKey: number

  constructor(maxPerKey: number) {
    this.maxPerKey = maxPerKey
  }

  async acquire(key: string): Promise<() => void> {
    let semaphore = this.semaphores.get(key)
    if (!semaphore) {
      semaphore = new Semaphore(this.maxPerKey)
      this.semaphores.set(key, semaphore)
    }
    return semaphore.acquire()
  }
}
