type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  details?: any
  error?: Error
}

class Logger {
  private static formatError(error: Error): object {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
    }
  }

  private static createEntry(level: LogLevel, message: string, details?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      ...(error && { error: this.formatError(error) }),
    }
  }

  private static log(entry: LogEntry): void {
    const logFn = entry.level === "error" || entry.level === "warn" ? console.error : console.log
    logFn(JSON.stringify(entry, null, 2))
  }

  static debug(message: string, details?: any): void {
    // Only show debug logs in development
    if (process.env.NODE_ENV !== 'production') {
      this.log(this.createEntry("debug", message, details))
    }
  }

  static info(message: string, details?: any): void {
    this.log(this.createEntry("info", message, details))
  }

  static warn(message: string, details?: any, error?: Error): void {
    this.log(this.createEntry("warn", message, details, error))
  }

  static error(message: string, error?: Error, details?: any): void {
    this.log(this.createEntry("error", message, details, error))
  }
}

export default Logger 