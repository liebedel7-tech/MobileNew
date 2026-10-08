/**
 * Tagoloan Water District (WDT) - Backend Utilities & Helper Functions
 */

export class ResponseHelper {
  public static success(res: any, data: any, message?: string) {
    return res.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  public static error(res: any, error: string, statusCode: number = 400) {
    return res.status(statusCode).json({
      success: false,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}

export class Logger {
  public static info(message: string, meta?: any) {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
  }

  public static warn(message: string, meta?: any) {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, meta ? meta : '');
  }

  public static error(message: string, error?: any) {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error ? error : '');
  }
}
