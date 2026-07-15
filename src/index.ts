/** mymy-auth 库入口:re-export 核心 API(供编程调用) */

export { EmulatorController } from './emulator/controller.js';
export type { ControllerOptions, WaitForOptions, TapResult } from './emulator/controller.js';

export { loginBySms } from './flows/bilibili-login.js';
export type { LoginOptions, LoginResult } from './flows/bilibili-login.js';

export { scanWebLogin } from './flows/bilibili-scan-web.js';
export type { ScanWebOptions, ScanWebResult } from './flows/bilibili-scan-web.js';

export { getLoginStatus } from './flows/bilibili-status.js';
export type { StatusResult } from './flows/bilibili-status.js';

export { SmsStore, store } from './sms/store.js';
export type { SmsMessage, CodeFilter } from './sms/store.js';

export { startServer } from './sms/server.js';
export { ping, getCode, waitForCode, getLatest } from './sms/client.js';
export type { SmsClientOptions, SmsFilter } from './sms/client.js';

export { recordSent, isCoolingDown, remainingCooldown } from './sms/cooldown.js';

export { resolveQrImage, downloadImage } from './qr/grab.js';

export { BILIBILI_PACKAGE, biliSelectors } from './flows/selectors.js';
