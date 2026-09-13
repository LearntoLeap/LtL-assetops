/**
 * Screen Wake Lock API — chưa có trong lib DOM của TypeScript đang dùng.
 * Khai báo tối thiểu đúng phần màn hình kiosk cần: xin khoá và nhả khoá.
 */
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

interface Navigator {
  readonly wakeLock?: WakeLock;
}
